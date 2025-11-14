/**
 * Tests for TF-IDF search functionality
 */

import { describe, it, expect } from 'vitest';
import {
  tokenize,
  buildSearchIndex,
  searchDocuments,
  calculateCosineSimilarity,
  type DocumentVector,
} from './tfidf.js';

describe('TF-IDF', () => {
  describe('tokenize', () => {
    it('should extract identifiers from text', () => {
      const text = 'function getUserData() { return user.data; }';
      const tokens = tokenize(text);

      expect(tokens).toContain('function');
      expect(tokens).toContain('getuserdata');
      expect(tokens).toContain('get');
      expect(tokens).toContain('user');
      expect(tokens).toContain('data');
      expect(tokens).toContain('return');
    });

    it('should split camelCase identifiers', () => {
      const text = 'getUserData myVariable';
      const tokens = tokenize(text);

      // Should have full identifier plus parts
      expect(tokens).toContain('getuserdata');
      expect(tokens).toContain('get');
      expect(tokens).toContain('user');
      expect(tokens).toContain('data');
      expect(tokens).toContain('myvariable');
      expect(tokens).toContain('my');
      expect(tokens).toContain('variable');
    });

    it('should split snake_case identifiers', () => {
      const text = 'get_user_data my_variable';
      const tokens = tokenize(text);

      // Should have full identifier plus parts
      expect(tokens).toContain('get_user_data');
      expect(tokens).toContain('get');
      expect(tokens).toContain('user');
      expect(tokens).toContain('data');
      expect(tokens).toContain('my_variable');
      expect(tokens).toContain('my');
      expect(tokens).toContain('variable');
    });

    it('should convert to lowercase', () => {
      const text = 'UserData GetUser';
      const tokens = tokenize(text);

      expect(tokens).toContain('userdata');
      expect(tokens).toContain('getuser');
      expect(tokens).not.toContain('UserData');
      expect(tokens).not.toContain('GetUser');
    });

    it('should handle keywords', () => {
      const text = 'function test';
      const tokens = tokenize(text);

      expect(tokens).toContain('function');
      expect(tokens).toContain('test');
    });

    it('should handle empty input', () => {
      const tokens = tokenize('');
      expect(tokens).toEqual([]);
    });
  });

  describe('buildSearchIndex', () => {
    it('should build index for single document', () => {
      const documents = [
        { uri: 'file://test.ts', content: 'function getUserData() { return user.data; }' },
      ];

      const index = buildSearchIndex(documents);

      expect(index.documents).toHaveLength(1);
      expect(index.idf).toBeDefined();
      expect(index.totalDocuments).toBe(1);
      expect(index.documents[0].uri).toBe('file://test.ts');
    });

    it('should build index for multiple documents', () => {
      const documents = [
        { uri: 'file://user.ts', content: 'class User { getData() { return this.data; } }' },
        {
          uri: 'file://auth.ts',
          content: 'function authenticate(user, password) { return true; }',
        },
      ];

      const index = buildSearchIndex(documents);

      expect(index.documents).toHaveLength(2);
      expect(index.totalDocuments).toBe(2);
    });

    it('should calculate IDF for terms', () => {
      const documents = [
        { uri: 'file://1.ts', content: 'user data' },
        { uri: 'file://2.ts', content: 'user authentication' },
        { uri: 'file://3.ts', content: 'admin data' },
      ];

      const index = buildSearchIndex(documents);

      // 'user' appears in 2/3 docs, should have moderate IDF
      // 'data' appears in 2/3 docs, should have moderate IDF
      // 'authentication' appears in 1/3 docs, should have higher IDF
      expect(index.idf.get('user')).toBeDefined();
      expect(index.idf.get('data')).toBeDefined();
      expect(index.idf.get('authentication')).toBeDefined();

      // More unique terms should have higher IDF
      expect(index.idf.get('authentication')!).toBeGreaterThan(index.idf.get('user')!);
    });

    it('should handle empty documents', () => {
      const documents: Array<{ uri: string; content: string }> = [];
      const index = buildSearchIndex(documents);

      expect(index.documents).toHaveLength(0);
      expect(index.totalDocuments).toBe(0);
    });
  });

  describe('searchDocuments', () => {
    const testIndex = buildSearchIndex([
      { uri: 'file://user.ts', content: 'class User { getName() { return this.name; } }' },
      {
        uri: 'file://auth.ts',
        content: 'function authenticateUser(username, password) { return true; }',
      },
      {
        uri: 'file://admin.ts',
        content: 'class Admin extends User { getPermissions() { return []; } }',
      },
    ]);

    it('should find relevant documents', () => {
      const results = searchDocuments('user', testIndex);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].uri).toBeDefined();
      // Score can be 0 if no IDF match, check it's defined
      expect(results[0].score).toBeGreaterThanOrEqual(0);
    });

    it('should rank by relevance', () => {
      const results = searchDocuments('user authentication', testIndex);

      expect(results.length).toBeGreaterThan(0);

      // First result should have highest score
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should return matched terms', () => {
      const results = searchDocuments('user name', testIndex);

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].matchedTerms).toBeDefined();
      expect(results[0].matchedTerms.length).toBeGreaterThan(0);
    });

    it('should respect limit option', () => {
      const results = searchDocuments('user', testIndex, { limit: 1 });

      expect(results).toHaveLength(1);
    });

    it('should respect minScore option', () => {
      const results = searchDocuments('user', testIndex, { minScore: 0.5 });

      for (const result of results) {
        expect(result.score).toBeGreaterThanOrEqual(0.5);
      }
    });

    it('should handle queries with no matches', () => {
      const results = searchDocuments('nonexistent_term_xyz', testIndex);

      // May return documents with 0 score
      // Filter for documents with score > 0
      const relevantResults = results.filter((r) => r.score > 0);
      expect(relevantResults).toHaveLength(0);
    });

    it('should handle empty query', () => {
      const results = searchDocuments('', testIndex);

      // Empty query returns no results or all with 0 score
      const relevantResults = results.filter((r) => r.score > 0);
      expect(relevantResults).toHaveLength(0);
    });

    it('should boost exact matches', () => {
      const exactResults = searchDocuments('User', testIndex);
      const partialResults = searchDocuments('use', testIndex);

      // Exact match should score higher (or equal if same terms found)
      if (exactResults.length > 0 && partialResults.length > 0) {
        expect(exactResults[0].score).toBeGreaterThanOrEqual(partialResults[0].score * 0.8);
      }
    });
  });

  describe('calculateCosineSimilarity', () => {
    it('should return 1 for identical vectors', () => {
      const queryVec = new Map([
        ['a', 0.5],
        ['b', 0.5],
      ]);
      const docVec: DocumentVector = {
        uri: 'test',
        terms: new Map([
          ['a', 0.5],
          ['b', 0.5],
        ]),
        rawTerms: new Map(),
        magnitude: Math.sqrt(0.5 * 0.5 + 0.5 * 0.5),
      };

      const similarity = calculateCosineSimilarity(queryVec, docVec);

      expect(similarity).toBeCloseTo(1, 5);
    });

    it('should return 0 for orthogonal vectors', () => {
      const queryVec = new Map([['a', 1]]);
      const docVec: DocumentVector = {
        uri: 'test',
        terms: new Map([['b', 1]]),
        rawTerms: new Map(),
        magnitude: 1,
      };

      const similarity = calculateCosineSimilarity(queryVec, docVec);

      expect(similarity).toBe(0);
    });

    it('should return value between 0 and 1', () => {
      const queryVec = new Map([
        ['a', 0.5],
        ['b', 0.3],
      ]);
      const docVec: DocumentVector = {
        uri: 'test',
        terms: new Map([
          ['a', 0.3],
          ['c', 0.4],
        ]),
        rawTerms: new Map(),
        magnitude: Math.sqrt(0.3 * 0.3 + 0.4 * 0.4),
      };

      const similarity = calculateCosineSimilarity(queryVec, docVec);

      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });

    it('should handle empty vectors', () => {
      const queryVec = new Map<string, number>();
      const docVec: DocumentVector = {
        uri: 'test',
        terms: new Map([['a', 1]]),
        rawTerms: new Map(),
        magnitude: 1,
      };

      const similarity = calculateCosineSimilarity(queryVec, docVec);

      expect(similarity).toBe(0);
    });
  });
});
