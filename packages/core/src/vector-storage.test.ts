/**
 * Vector Storage Tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { VectorStorage, type VectorDocument } from './vector-storage.js';
import fs from 'node:fs';
import path from 'node:path';

describe('VectorStorage', () => {
  let storage: VectorStorage;
  const testIndexPath = '/tmp/test-vector-index.hnsw';

  beforeEach(() => {
    // Clean up any existing test files
    if (fs.existsSync(testIndexPath)) {
      fs.unlinkSync(testIndexPath);
    }
    if (fs.existsSync(`${testIndexPath}.metadata.json`)) {
      fs.unlinkSync(`${testIndexPath}.metadata.json`);
    }

    storage = new VectorStorage({ dimensions: 128 });
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testIndexPath)) {
      fs.unlinkSync(testIndexPath);
    }
    if (fs.existsSync(`${testIndexPath}.metadata.json`)) {
      fs.unlinkSync(`${testIndexPath}.metadata.json`);
    }
  });

  describe('addDocument', () => {
    it('should add a document', () => {
      const doc: VectorDocument = {
        id: 'doc1',
        embedding: Array(128).fill(1),
        metadata: { type: 'code', language: 'typescript' },
      };

      storage.addDocument(doc);

      expect(storage.hasDocument('doc1')).toBe(true);
      expect(storage.getStats().totalDocuments).toBe(1);
    });

    it('should throw error for duplicate document ID', () => {
      const doc: VectorDocument = {
        id: 'doc1',
        embedding: Array(128).fill(1),
        metadata: { type: 'code' },
      };

      storage.addDocument(doc);

      expect(() => storage.addDocument(doc)).toThrow('already exists');
    });

    it('should throw error for wrong dimensions', () => {
      const doc: VectorDocument = {
        id: 'doc1',
        embedding: Array(64).fill(1), // Wrong dimensions
        metadata: { type: 'code' },
      };

      expect(() => storage.addDocument(doc)).toThrow("don't match");
    });
  });

  describe('addDocuments', () => {
    it('should add multiple documents', () => {
      const docs: VectorDocument[] = [
        {
          id: 'doc1',
          embedding: Array(128).fill(1),
          metadata: { type: 'code' },
        },
        {
          id: 'doc2',
          embedding: Array(128).fill(0.5),
          metadata: { type: 'code' },
        },
        {
          id: 'doc3',
          embedding: Array(128).fill(0.25),
          metadata: { type: 'knowledge' },
        },
      ];

      storage.addDocuments(docs);

      expect(storage.getStats().totalDocuments).toBe(3);
      expect(storage.hasDocument('doc1')).toBe(true);
      expect(storage.hasDocument('doc2')).toBe(true);
      expect(storage.hasDocument('doc3')).toBe(true);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      // Add test documents with different embeddings
      storage.addDocument({
        id: 'doc1',
        embedding: Array(128).fill(1),
        metadata: { type: 'code', language: 'typescript' },
      });

      storage.addDocument({
        id: 'doc2',
        embedding: Array(128).fill(0.5),
        metadata: { type: 'code', language: 'javascript' },
      });

      storage.addDocument({
        id: 'doc3',
        embedding: Array(128).fill(0),
        metadata: { type: 'knowledge' },
      });
    });

    it('should find most similar documents', () => {
      const queryVector = Array(128).fill(1);
      const results = storage.search(queryVector, { k: 2 });

      expect(results).toHaveLength(2);
      expect(results[0].doc.id).toBe('doc1');
      expect(results[0].similarity).toBeCloseTo(1, 2);
    });

    it('should respect k parameter', () => {
      const queryVector = Array(128).fill(1);
      const results = storage.search(queryVector, { k: 1 });

      expect(results).toHaveLength(1);
    });

    it('should filter by minimum score', () => {
      const queryVector = Array(128).fill(1);
      const results = storage.search(queryVector, { minScore: 0.8 });

      // Only doc1 should be above 0.8 similarity
      expect(results.length).toBeLessThanOrEqual(2);
      expect(results.every((r) => r.similarity >= 0.8)).toBe(true);
    });

    it('should apply custom filter', () => {
      const queryVector = Array(128).fill(1);
      const results = storage.search(queryVector, {
        k: 10,
        filter: (doc) => doc.metadata.type === 'code',
      });

      expect(results.length).toBeLessThanOrEqual(2);
      expect(results.every((r) => r.doc.metadata.type === 'code')).toBe(true);
    });

    it('should return empty array for empty storage', () => {
      const emptyStorage = new VectorStorage({ dimensions: 128 });
      const results = emptyStorage.search(Array(128).fill(1));

      expect(results).toHaveLength(0);
    });

    it('should throw error for wrong query dimensions', () => {
      const queryVector = Array(64).fill(1); // Wrong dimensions

      expect(() => storage.search(queryVector)).toThrow("don't match");
    });
  });

  describe('getDocument', () => {
    it('should retrieve document by ID', () => {
      const doc: VectorDocument = {
        id: 'doc1',
        embedding: Array(128).fill(1),
        metadata: { type: 'code', language: 'typescript' },
      };

      storage.addDocument(doc);

      const retrieved = storage.getDocument('doc1');
      expect(retrieved).toBeDefined();
      expect(retrieved!.id).toBe('doc1');
      expect(retrieved!.metadata.language).toBe('typescript');
    });

    it('should return undefined for non-existent document', () => {
      const retrieved = storage.getDocument('nonexistent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('deleteDocument', () => {
    it('should delete document', () => {
      const doc: VectorDocument = {
        id: 'doc1',
        embedding: Array(128).fill(1),
        metadata: { type: 'code' },
      };

      storage.addDocument(doc);
      expect(storage.hasDocument('doc1')).toBe(true);

      const deleted = storage.deleteDocument('doc1');
      expect(deleted).toBe(true);
      expect(storage.hasDocument('doc1')).toBe(false);
      expect(storage.getDocument('doc1')).toBeUndefined();
    });

    it('should return false for non-existent document', () => {
      const deleted = storage.deleteDocument('nonexistent');
      expect(deleted).toBe(false);
    });

    it('should not return deleted documents in search', () => {
      storage.addDocument({
        id: 'doc1',
        embedding: Array(128).fill(1),
        metadata: { type: 'code' },
      });

      storage.addDocument({
        id: 'doc2',
        embedding: Array(128).fill(0.5),
        metadata: { type: 'code' },
      });

      storage.deleteDocument('doc1');

      const results = storage.search(Array(128).fill(1), { k: 10 });
      expect(results.every((r) => r.doc.id !== 'doc1')).toBe(true);
    });
  });

  describe('updateDocument', () => {
    it('should update existing document', () => {
      const doc: VectorDocument = {
        id: 'doc1',
        embedding: Array(128).fill(1),
        metadata: { type: 'code', language: 'javascript' },
      };

      storage.addDocument(doc);

      const updated: VectorDocument = {
        id: 'doc1',
        embedding: Array(128).fill(0.5),
        metadata: { type: 'code', language: 'typescript' },
      };

      storage.updateDocument(updated);

      const retrieved = storage.getDocument('doc1');
      expect(retrieved!.metadata.language).toBe('typescript');
    });

    it('should add new document if not exists', () => {
      const doc: VectorDocument = {
        id: 'doc1',
        embedding: Array(128).fill(1),
        metadata: { type: 'code' },
      };

      storage.updateDocument(doc);

      expect(storage.hasDocument('doc1')).toBe(true);
    });
  });

  describe('getAllDocuments', () => {
    it('should return all documents', () => {
      const docs: VectorDocument[] = [
        { id: 'doc1', embedding: Array(128).fill(1), metadata: { type: 'code' } },
        { id: 'doc2', embedding: Array(128).fill(0.5), metadata: { type: 'code' } },
      ];

      storage.addDocuments(docs);

      const allDocs = storage.getAllDocuments();
      expect(allDocs).toHaveLength(2);
    });

    it('should return empty array for empty storage', () => {
      const allDocs = storage.getAllDocuments();
      expect(allDocs).toHaveLength(0);
    });
  });

  describe('save and load', () => {
    it('should persist index to disk', () => {
      const docs: VectorDocument[] = [
        {
          id: 'doc1',
          embedding: Array(128).fill(1),
          metadata: { type: 'code', language: 'typescript' },
        },
        {
          id: 'doc2',
          embedding: Array(128).fill(0.5),
          metadata: { type: 'code', language: 'javascript' },
        },
      ];

      storage.addDocuments(docs);
      storage.save(testIndexPath);

      // Verify files exist
      expect(fs.existsSync(testIndexPath)).toBe(true);
      expect(fs.existsSync(`${testIndexPath}.metadata.json`)).toBe(true);

      // Load in new instance
      const storage2 = new VectorStorage({
        dimensions: 128,
        indexPath: testIndexPath,
      });

      expect(storage2.getStats().totalDocuments).toBe(2);
      expect(storage2.hasDocument('doc1')).toBe(true);
      expect(storage2.hasDocument('doc2')).toBe(true);

      const doc = storage2.getDocument('doc1');
      expect(doc).toBeDefined();
      expect(doc!.metadata.language).toBe('typescript');
    });

    it('should maintain search functionality after load', () => {
      const docs: VectorDocument[] = [
        { id: 'doc1', embedding: Array(128).fill(1), metadata: { type: 'code' } },
        { id: 'doc2', embedding: Array(128).fill(0.5), metadata: { type: 'code' } },
      ];

      storage.addDocuments(docs);
      storage.save(testIndexPath);

      const storage2 = new VectorStorage({
        dimensions: 128,
        indexPath: testIndexPath,
      });

      const results = storage2.search(Array(128).fill(1), { k: 2 });
      expect(results).toHaveLength(2);
      expect(results[0].doc.id).toBe('doc1');
    });

    it('should throw error when saving without path', () => {
      expect(() => storage.save()).toThrow('No index path specified');
    });

    it('should throw error when loading non-existent index', () => {
      expect(() => {
        const storage2 = new VectorStorage({
          dimensions: 128,
          indexPath: '/tmp/nonexistent.hnsw',
        });
        storage2.load();
      }).toThrow();
    });
  });

  describe('clear', () => {
    it('should clear all data', () => {
      const docs: VectorDocument[] = [
        { id: 'doc1', embedding: Array(128).fill(1), metadata: { type: 'code' } },
        { id: 'doc2', embedding: Array(128).fill(0.5), metadata: { type: 'code' } },
      ];

      storage.addDocuments(docs);
      expect(storage.getStats().totalDocuments).toBe(2);

      storage.clear();

      expect(storage.getStats().totalDocuments).toBe(0);
      expect(storage.hasDocument('doc1')).toBe(false);
      expect(storage.hasDocument('doc2')).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', () => {
      const docs: VectorDocument[] = [
        { id: 'doc1', embedding: Array(128).fill(1), metadata: { type: 'code' } },
        { id: 'doc2', embedding: Array(128).fill(0.5), metadata: { type: 'code' } },
      ];

      storage.addDocuments(docs);

      const stats = storage.getStats();
      expect(stats.totalDocuments).toBe(2);
      expect(stats.dimensions).toBe(128);
      expect(stats.indexSize).toBeGreaterThanOrEqual(2);
    });
  });

  describe('performance', () => {
    it('should handle large number of documents', () => {
      const numDocs = 1000;
      const docs: VectorDocument[] = [];

      for (let i = 0; i < numDocs; i++) {
        // Create random-ish embeddings
        const embedding = Array(128)
          .fill(0)
          .map(() => Math.sin(i) + Math.cos(i * 0.5));

        docs.push({
          id: `doc${i}`,
          embedding,
          metadata: { type: 'code', index: i },
        });
      }

      const startAdd = Date.now();
      storage.addDocuments(docs);
      const addTime = Date.now() - startAdd;

      console.error(`[PERF] Added ${numDocs} documents in ${addTime}ms`);

      const startSearch = Date.now();
      const results = storage.search(Array(128).fill(1), { k: 10 });
      const searchTime = Date.now() - startSearch;

      console.error(`[PERF] Searched in ${searchTime}ms`);

      expect(results).toHaveLength(10);
      expect(searchTime).toBeLessThan(100); // Should be fast (<100ms)
    });
  });
});
