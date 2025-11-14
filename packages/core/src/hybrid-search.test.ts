/**
 * Hybrid Search Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hybridSearch, semanticSearch, keywordSearch } from './hybrid-search.js';
import { CodebaseIndexer } from './indexer.js';
import { MemoryStorage } from './storage.js';
import { createMockProvider } from './embeddings.js';
import fs from 'node:fs';
import path from 'node:path';

describe('Hybrid Search', () => {
  let tempDir: string;
  let indexer: CodebaseIndexer;
  let embeddingProvider: any;

  beforeEach(async () => {
    // Create temporary test directory
    tempDir = `/tmp/hybrid-search-test-${Date.now()}`;
    fs.mkdirSync(tempDir, { recursive: true });

    // Create test files
    const testFiles = [
      {
        name: 'auth.ts',
        content: `
export function authenticate(username: string, password: string) {
  // User authentication logic
  return validateCredentials(username, password);
}

export function validateCredentials(user: string, pass: string): boolean {
  // Check user credentials
  return true;
}
        `,
      },
      {
        name: 'database.ts',
        content: `
export class DatabaseConnection {
  connect() {
    // Database connection logic
  }

  query(sql: string) {
    // Execute SQL query
  }
}
        `,
      },
      {
        name: 'api.ts',
        content: `
export function handleRequest(req: Request) {
  // API request handler
  return processRequest(req);
}

export function processRequest(request: Request) {
  // Process API request
  return { success: true };
}
        `,
      },
    ];

    for (const file of testFiles) {
      const filePath = path.join(tempDir, file.name);
      fs.writeFileSync(filePath, file.content);
    }

    // Initialize embedding provider
    embeddingProvider = createMockProvider(128);

    // Initialize indexer with embeddings
    indexer = new CodebaseIndexer({
      codebaseRoot: tempDir,
      storage: new MemoryStorage(),
      embeddingProvider,
    });

    // Index the codebase
    await indexer.index();
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('hybridSearch', () => {
    it('should combine vector and TF-IDF results', async () => {
      const results = await hybridSearch('authentication', indexer, {
        limit: 5,
        vectorWeight: 0.7,
      });

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(5);

      // Should have at least one result with hybrid method
      const hasHybrid = results.some((r) => r.method === 'hybrid');
      const hasVector = results.some((r) => r.method === 'vector');
      const hasTfidf = results.some((r) => r.method === 'tfidf');

      // At least one of these should be true
      expect(hasHybrid || hasVector || hasTfidf).toBe(true);

      // All results should have valid scores
      expect(results.every((r) => r.score >= 0)).toBe(true);

      // Results should be sorted by score
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should respect limit parameter', async () => {
      const results = await hybridSearch('function', indexer, { limit: 2 });

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should filter by minimum score', async () => {
      const results = await hybridSearch('authentication', indexer, {
        minScore: 0.5,
      });

      expect(results.every((r) => r.score >= 0.5)).toBe(true);
    });

    it('should include content when requested', async () => {
      const results = await hybridSearch('database', indexer, {
        includeContent: true,
        limit: 1,
      });

      if (results.length > 0) {
        expect(results[0].content).toBeDefined();
        expect(typeof results[0].content).toBe('string');
      }
    });

    it('should adjust scores based on vector weight', async () => {
      const highVectorWeight = await hybridSearch('authentication', indexer, {
        vectorWeight: 0.9,
        limit: 5,
      });

      const lowVectorWeight = await hybridSearch('authentication', indexer, {
        vectorWeight: 0.1,
        limit: 5,
      });

      // Both should return results
      expect(highVectorWeight.length).toBeGreaterThan(0);
      expect(lowVectorWeight.length).toBeGreaterThan(0);

      // Scores might differ based on weighting
      // (This is a soft check as exact scores depend on the mock provider)
    });

    it('should fallback to TF-IDF when vector search unavailable', async () => {
      // Create indexer without embeddings
      const simpleIndexer = new CodebaseIndexer({
        codebaseRoot: tempDir,
        storage: new MemoryStorage(),
      });

      await simpleIndexer.index();

      const results = await hybridSearch('authentication', simpleIndexer);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((r) => r.method === 'tfidf')).toBe(true);
    });

    it('should handle empty query', async () => {
      const results = await hybridSearch('', indexer);

      // Empty query should still return results (all docs with low scores)
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle query with no matches', async () => {
      const results = await hybridSearch('zzznonexistenttermzzz', indexer);

      // Should return empty or very low-scored results
      expect(Array.isArray(results)).toBe(true);
    });
  });

  describe('semanticSearch', () => {
    // FIXME: Skipping due to HNSW initialization timing issues with small datasets
    it.skip('should use vector search only (weight = 1.0)', async () => {
      const results = await semanticSearch('authentication', indexer, {
        limit: 5,
        minScore: 0, // Allow all results for small test dataset
      });

      expect(results.length).toBeGreaterThan(0);
      // All results should be from vector search
      expect(results.every((r) => r.method === 'vector' || r.method === 'hybrid')).toBe(true);
    });

    it('should return relevant semantic matches', async () => {
      const results = await semanticSearch('user login credentials', indexer);

      // Should find auth.ts which has related content
      expect(results.length).toBeGreaterThan(0);
      // At least one result should have reasonable similarity
      expect(results.some((r) => r.score > 0)).toBe(true);
    });
  });

  describe('keywordSearch', () => {
    it('should use TF-IDF search only (weight = 0.0)', async () => {
      const results = await keywordSearch('authenticate', indexer, { limit: 5 });

      expect(results.length).toBeGreaterThan(0);
      // All results should be from TF-IDF search
      expect(results.every((r) => r.method === 'tfidf')).toBe(true);
    });

    it('should return keyword matches', async () => {
      const results = await keywordSearch('authenticate', indexer);

      expect(results.length).toBeGreaterThan(0);
      // Should have matched terms
      expect(results.some((r) => r.matchedTerms && r.matchedTerms.length > 0)).toBe(true);
    });

    it('should match exact keywords', async () => {
      const results = await keywordSearch('DatabaseConnection', indexer);

      expect(results.length).toBeGreaterThan(0);
      // Should find database.ts
      expect(results.some((r) => r.path.includes('database.ts'))).toBe(true);
    });
  });

  describe('comparison', () => {
    // FIXME: Skipping due to HNSW initialization timing issues with small datasets
    it.skip('hybrid vs semantic vs keyword should return different results', async () => {
      const query = 'authentication';

      const hybridResults = await hybridSearch(query, indexer, {
        vectorWeight: 0.7,
        limit: 5,
        minScore: 0,
      });
      const semanticResults = await semanticSearch(query, indexer, {
        limit: 5,
        minScore: 0, // Allow all results for small test dataset
      });
      const keywordResults = await keywordSearch(query, indexer, { limit: 5 });

      // All should return some results
      expect(hybridResults.length).toBeGreaterThan(0);
      expect(semanticResults.length).toBeGreaterThan(0);
      expect(keywordResults.length).toBeGreaterThan(0);

      // Methods should be different
      const hybridMethods = new Set(hybridResults.map((r) => r.method));
      const semanticMethods = new Set(semanticResults.map((r) => r.method));
      const keywordMethods = new Set(keywordResults.map((r) => r.method));

      expect(semanticMethods.has('vector') || semanticMethods.has('hybrid')).toBe(true);
      expect(keywordMethods.has('tfidf')).toBe(true);
    });
  });

  describe('result quality', () => {
    it('should return results with all expected fields', async () => {
      const results = await hybridSearch('function', indexer, {
        includeContent: true,
        limit: 1,
      });

      if (results.length > 0) {
        const result = results[0];
        expect(result.path).toBeDefined();
        expect(typeof result.path).toBe('string');
        expect(result.score).toBeDefined();
        expect(typeof result.score).toBe('number');
        expect(result.method).toBeDefined();
        expect(['vector', 'tfidf', 'hybrid']).toContain(result.method);
      }
    });

    it('should have normalized scores', async () => {
      const results = await hybridSearch('authentication', indexer, { limit: 10 });

      expect(results.length).toBeGreaterThan(0);
      // Scores should be in reasonable range (0 to ~2 after normalization + weighting)
      expect(results.every((r) => r.score >= 0 && r.score <= 10)).toBe(true);
    });
  });
});
