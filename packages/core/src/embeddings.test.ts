/**
 * Tests for Embedding utilities
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  generateMockEmbedding,
  createMockProvider,
  createDefaultConfig,
  chunkText,
  cosineSimilarity,
  normalizeVector,
  composeProviders,
  type EmbeddingProvider,
} from './embeddings.js';

describe('generateMockEmbedding', () => {
  it('should generate embedding of correct dimensions', () => {
    const embedding = generateMockEmbedding('test text', 128);
    expect(embedding).toHaveLength(128);
  });

  it('should generate normalized vectors (magnitude = 1)', () => {
    const embedding = generateMockEmbedding('test', 512);

    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    expect(magnitude).toBeCloseTo(1, 10);
  });

  it('should be deterministic for same input', () => {
    const embedding1 = generateMockEmbedding('hello world', 256);
    const embedding2 = generateMockEmbedding('hello world', 256);

    for (let i = 0; i < embedding1.length; i++) {
      expect(embedding1[i]).toBe(embedding2[i]);
    }
  });

  it('should generate different embeddings for different text', () => {
    const embedding1 = generateMockEmbedding('hello', 256);
    const embedding2 = generateMockEmbedding('world', 256);

    // Embeddings should be different
    let different = false;
    for (let i = 0; i < embedding1.length; i++) {
      if (embedding1[i] !== embedding2[i]) {
        different = true;
        break;
      }
    }
    expect(different).toBe(true);
  });
});

describe('createMockProvider', () => {
  let provider: EmbeddingProvider;

  beforeEach(() => {
    provider = createMockProvider(128);
  });

  it('should create provider with correct config', () => {
    expect(provider.name).toBe('mock');
    expect(provider.model).toBe('mock');
    expect(provider.dimensions).toBe(128);
  });

  it('should generate single embedding', async () => {
    const embedding = await provider.generateEmbedding('test text');
    expect(embedding).toHaveLength(128);
  });

  it('should generate multiple embeddings', async () => {
    const embeddings = await provider.generateEmbeddings(['text1', 'text2', 'text3']);
    expect(embeddings).toHaveLength(3);
    expect(embeddings[0]).toHaveLength(128);
    expect(embeddings[1]).toHaveLength(128);
    expect(embeddings[2]).toHaveLength(128);
  });

  it('should generate consistent embeddings', async () => {
    const embedding1 = await provider.generateEmbedding('hello');
    const embedding2 = await provider.generateEmbedding('hello');

    for (let i = 0; i < embedding1.length; i++) {
      expect(embedding1[i]).toBe(embedding2[i]);
    }
  });
});

describe('createDefaultConfig', () => {
  it('should create config with mock provider when no API key', () => {
    // Save original env
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const config = createDefaultConfig();
    expect(config.provider).toBe('mock');
    expect(config.dimensions).toBeGreaterThan(0);

    // Restore env
    if (originalKey) {
      process.env.OPENAI_API_KEY = originalKey;
    }
  });

  it('should use default model and dimensions', () => {
    const config = createDefaultConfig();
    expect(config.model).toBe('text-embedding-3-small');
    expect(config.dimensions).toBe(1536); // Default for text-embedding-3-small
    expect(config.batchSize).toBe(10);
  });
});

describe('chunkText', () => {
  it('should chunk text into pieces', () => {
    const text = 'a'.repeat(2500);
    const chunks = chunkText(text, { maxChunkSize: 1000, overlap: 0 });

    expect(chunks.length).toBe(3);
    expect(chunks[0].length).toBe(1000);
    expect(chunks[1].length).toBe(1000);
    expect(chunks[2].length).toBe(500);
  });

  it('should handle text shorter than chunk size', () => {
    const text = 'short text';
    const chunks = chunkText(text, { maxChunkSize: 1000 });

    expect(chunks.length).toBe(1);
    expect(chunks[0]).toBe(text);
  });

  it('should use default chunk size', () => {
    const text = 'a'.repeat(1500);
    const chunks = chunkText(text);

    expect(chunks.length).toBeGreaterThan(1);
  });

  it('should create overlapping chunks', () => {
    const text = 'a'.repeat(250);
    const chunks = chunkText(text, { maxChunkSize: 100, overlap: 20 });

    expect(chunks.length).toBeGreaterThan(2);

    // Check overlap (last 20 chars of chunk[0] should match first 20 of chunk[1])
    const chunk0End = chunks[0].slice(-20);
    const chunk1Start = chunks[1].slice(0, 20);
    expect(chunk0End).toBe(chunk1Start);
  });

  it('should handle empty text', () => {
    const chunks = chunkText('');
    expect(chunks.length).toBe(0);
  });
});

describe('cosineSimilarity', () => {
  it('should calculate similarity of identical vectors as 1', () => {
    const vec = [1, 2, 3, 4];
    const similarity = cosineSimilarity(vec, vec);
    expect(similarity).toBeCloseTo(1, 10);
  });

  it('should calculate similarity of orthogonal vectors as 0', () => {
    const vec1 = [1, 0];
    const vec2 = [0, 1];
    const similarity = cosineSimilarity(vec1, vec2);
    expect(similarity).toBeCloseTo(0, 10);
  });

  it('should calculate similarity of opposite vectors as -1', () => {
    const vec1 = [1, 2, 3];
    const vec2 = [-1, -2, -3];
    const similarity = cosineSimilarity(vec1, vec2);
    expect(similarity).toBeCloseTo(-1, 10);
  });

  it('should handle similar vectors', () => {
    const vec1 = [1, 2, 3];
    const vec2 = [1, 2, 4];
    const similarity = cosineSimilarity(vec1, vec2);
    expect(similarity).toBeGreaterThan(0.9);
    expect(similarity).toBeLessThan(1);
  });

  it('should handle zero vectors', () => {
    const vec1 = [0, 0, 0];
    const vec2 = [1, 2, 3];
    const similarity = cosineSimilarity(vec1, vec2);
    expect(similarity).toBe(0);
  });

  it('should throw error for mismatched dimensions', () => {
    const vec1 = [1, 2, 3];
    const vec2 = [1, 2];
    expect(() => cosineSimilarity(vec1, vec2)).toThrow();
  });

  it('should be symmetric', () => {
    const vec1 = [1, 2, 3];
    const vec2 = [4, 5, 6];
    const sim1 = cosineSimilarity(vec1, vec2);
    const sim2 = cosineSimilarity(vec2, vec1);
    expect(sim1).toBeCloseTo(sim2, 10);
  });
});

describe('normalizeVector', () => {
  it('should normalize vector to unit length', () => {
    const vec = [3, 4]; // Length 5
    const normalized = normalizeVector(vec);

    const magnitude = Math.sqrt(normalized.reduce((sum, val) => sum + val * val, 0));
    expect(magnitude).toBeCloseTo(1, 10);
  });

  it('should maintain direction', () => {
    const vec = [3, 4];
    const normalized = normalizeVector(vec);

    // Direction should be maintained (ratios should be same)
    expect(normalized[0] / normalized[1]).toBeCloseTo(vec[0] / vec[1], 10);
  });

  it('should handle zero vector', () => {
    const vec = [0, 0, 0];
    const normalized = normalizeVector(vec);

    expect(normalized).toEqual(vec);
  });

  it('should handle already normalized vector', () => {
    const vec = [0.6, 0.8]; // Already unit length
    const normalized = normalizeVector(vec);

    expect(normalized[0]).toBeCloseTo(0.6, 10);
    expect(normalized[1]).toBeCloseTo(0.8, 10);
  });
});

describe('composeProviders', () => {
  it('should use primary provider when available', async () => {
    const primary = createMockProvider(128);
    const fallback = createMockProvider(256);

    const composed = composeProviders(primary, fallback);

    const embedding = await composed.generateEmbedding('test');
    expect(embedding).toHaveLength(128); // Should use primary dimensions
  });

  it('should have combined name', () => {
    const primary = createMockProvider(128);
    const fallback = createMockProvider(256);

    const composed = composeProviders(primary, fallback);
    expect(composed.name).toBe('mock+mock');
  });

  it('should fallback when primary fails', async () => {
    const failingProvider: EmbeddingProvider = {
      name: 'failing',
      model: 'test',
      dimensions: 128,
      generateEmbedding: async () => {
        throw new Error('Provider failed');
      },
      generateEmbeddings: async () => {
        throw new Error('Provider failed');
      },
    };

    const fallback = createMockProvider(256);
    const composed = composeProviders(failingProvider, fallback);

    const embedding = await composed.generateEmbedding('test');
    expect(embedding).toHaveLength(256); // Should use fallback dimensions
  });

  it('should fallback for batch generation', async () => {
    const failingProvider: EmbeddingProvider = {
      name: 'failing',
      model: 'test',
      dimensions: 128,
      generateEmbedding: async () => {
        throw new Error('Provider failed');
      },
      generateEmbeddings: async () => {
        throw new Error('Provider failed');
      },
    };

    const fallback = createMockProvider(256);
    const composed = composeProviders(failingProvider, fallback);

    const embeddings = await composed.generateEmbeddings(['test1', 'test2']);
    expect(embeddings).toHaveLength(2);
    expect(embeddings[0]).toHaveLength(256);
  });
});

describe('integration: similarity search', () => {
  it('should find similar texts', async () => {
    const provider = createMockProvider(256);

    const texts = ['apple fruit', 'banana fruit', 'car vehicle', 'truck vehicle'];

    const embeddings = await provider.generateEmbeddings(texts);

    // Similarity between fruits
    const fruitSim = cosineSimilarity(embeddings[0], embeddings[1]);

    // Similarity between vehicles
    const vehicleSim = cosineSimilarity(embeddings[2], embeddings[3]);

    // Similarity between fruit and vehicle
    const crossSim = cosineSimilarity(embeddings[0], embeddings[2]);

    // Fruits should be more similar to each other than to vehicles
    expect(fruitSim).toBeGreaterThan(crossSim);
    expect(vehicleSim).toBeGreaterThan(crossSim);
  });
});
