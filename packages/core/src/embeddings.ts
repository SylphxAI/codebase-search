/**
 * Embedding generation utilities - Pure Functional
 * Uses Vercel AI SDK with OpenAI Provider
 *
 * Design:
 * - Pure functions (no classes)
 * - Immutable data structures
 * - Function composition
 * - Config from environment variables
 */

import { embed, embedMany } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

/**
 * Embedding Provider Config
 */
export interface EmbeddingConfig {
  readonly provider: 'openai' | 'openai-compatible' | 'mock';
  readonly model: string; // Any model name (e.g., 'text-embedding-3-small', 'text-embedding-ada-002', or custom)
  readonly dimensions: number;
  readonly apiKey?: string;
  readonly baseURL?: string; // For OpenAI-compatible endpoints (OpenRouter, Together AI, etc.)
  readonly batchSize?: number;
}

/**
 * Embedding Provider Interface
 */
export interface EmbeddingProvider {
  readonly name: string;
  readonly model: string;
  readonly dimensions: number;
  readonly generateEmbedding: (text: string) => Promise<number[]>;
  readonly generateEmbeddings: (texts: string[]) => Promise<number[][]>;
}

/**
 * Generate mock embedding using deterministic hash
 * Used as fallback when OpenAI is not available
 */
export const generateMockEmbedding = (text: string, dimensions: number): number[] => {
  // Simple hash function for consistency
  const hash = (str: string): number => {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
    }
    return h;
  };

  const baseHash = hash(text);
  const vector: number[] = [];

  for (let i = 0; i < dimensions; i++) {
    // Generate deterministic pseudo-random values
    const seed = baseHash + i;
    const value = (Math.sin(seed) + Math.cos(seed * 0.5)) / 2;
    vector.push(value);
  }

  // Normalize to unit vector
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  return vector.map((val) => val / magnitude);
};

/**
 * Get dimensions for OpenAI model
 * Returns undefined for unknown models (must be specified in config)
 */
const getModelDimensions = (model: string): number | undefined => {
  switch (model) {
    case 'text-embedding-3-large':
      return 3072;
    case 'text-embedding-3-small':
    case 'text-embedding-ada-002':
      return 1536;
    default:
      return undefined; // For custom models, dimensions must be specified
  }
};

/**
 * Create default config from environment
 */
export const createDefaultConfig = (): EmbeddingConfig => {
  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENAI_BASE_URL; // Support custom base URL
  const model = process.env.EMBEDDING_MODEL || 'text-embedding-3-small';
  const customDimensions = process.env.EMBEDDING_DIMENSIONS
    ? parseInt(process.env.EMBEDDING_DIMENSIONS, 10)
    : undefined;

  // Determine provider type
  let provider: EmbeddingConfig['provider'] = 'mock';
  if (apiKey) {
    provider = baseURL ? 'openai-compatible' : 'openai';
  }

  // Get dimensions (from env, model default, or fallback)
  const dimensions = customDimensions || getModelDimensions(model) || 1536;

  return {
    provider,
    model,
    dimensions,
    apiKey,
    baseURL,
    batchSize: 10,
  };
};

/**
 * Create OpenAI embedding model instance
 * Supports both official OpenAI and OpenAI-compatible endpoints
 */
const createEmbeddingModel = (config: EmbeddingConfig) => {
  const provider = createOpenAI({
    apiKey: config.apiKey || process.env.OPENAI_API_KEY,
    baseURL: config.baseURL, // Support custom endpoints (OpenRouter, Together AI, etc.)
  });

  return provider.embedding(config.model);
};

/**
 * Generate single embedding (OpenAI)
 */
const generateOpenAIEmbedding = async (
  model: ReturnType<typeof createEmbeddingModel>,
  text: string,
  dimensions: number
): Promise<number[]> => {
  try {
    const { embedding } = await embed({ model, value: text });
    return embedding;
  } catch (error) {
    console.error('[WARN] OpenAI embedding failed, falling back to mock:', error);
    return generateMockEmbedding(text, dimensions);
  }
};

/**
 * Generate multiple embeddings (OpenAI)
 */
const generateOpenAIEmbeddings = async (
  model: ReturnType<typeof createEmbeddingModel>,
  texts: string[],
  dimensions: number
): Promise<number[][]> => {
  try {
    const { embeddings } = await embedMany({ model, values: texts });
    return embeddings;
  } catch (error) {
    console.error('[WARN] OpenAI embeddings failed, falling back to mock:', error);
    return texts.map((text) => generateMockEmbedding(text, dimensions));
  }
};

/**
 * Create OpenAI Embedding Provider (pure function)
 */
export const createOpenAIProvider = (config: EmbeddingConfig): EmbeddingProvider => {
  const model = createEmbeddingModel(config);

  return {
    name: 'openai',
    model: config.model,
    dimensions: config.dimensions,
    generateEmbedding: (text: string) => generateOpenAIEmbedding(model, text, config.dimensions),
    generateEmbeddings: (texts: string[]) =>
      generateOpenAIEmbeddings(model, texts, config.dimensions),
  };
};

/**
 * Create Mock Embedding Provider (pure function)
 */
export const createMockProvider = (dimensions = 1536): EmbeddingProvider => ({
  name: 'mock',
  model: 'mock',
  dimensions,
  generateEmbedding: (text: string) => Promise.resolve(generateMockEmbedding(text, dimensions)),
  generateEmbeddings: (texts: string[]) =>
    Promise.resolve(texts.map((text) => generateMockEmbedding(text, dimensions))),
});

/**
 * Provider Factory Type
 */
type ProviderFactory = (config: EmbeddingConfig) => EmbeddingProvider;

/**
 * Provider Registry (modular design)
 */
const providerRegistry = new Map<string, ProviderFactory>();

/**
 * Register a provider factory
 */
export const registerProvider = (name: string, factory: ProviderFactory): void => {
  providerRegistry.set(name, factory);
};

/**
 * Get registered provider names
 */
export const getRegisteredProviders = (): string[] => {
  return Array.from(providerRegistry.keys());
};

// Register built-in providers
registerProvider('openai', (config) => {
  console.error(`[INFO] Creating OpenAI provider: ${config.model} (${config.dimensions} dims)`);
  return createOpenAIProvider(config);
});

registerProvider('openai-compatible', (config) => {
  console.error(
    `[INFO] Creating OpenAI-compatible provider: ${config.model} (${config.dimensions} dims)`,
    config.baseURL ? `at ${config.baseURL}` : ''
  );
  return createOpenAIProvider(config);
});

registerProvider('mock', (config) => {
  console.error('[INFO] Creating Mock embedding provider');
  return createMockProvider(config.dimensions);
});

/**
 * Create Embedding Provider from config (pure function)
 * Uses provider registry for modularity
 */
export const createEmbeddingProvider = (config: EmbeddingConfig): EmbeddingProvider => {
  const factory = providerRegistry.get(config.provider);

  if (!factory) {
    console.error(`[WARN] Unknown provider '${config.provider}', using mock`);
    const mockFactory = providerRegistry.get('mock');
    return mockFactory!(config);
  }

  return factory(config);
};

/**
 * Get default embedding provider (pure function with I/O)
 */
export const getDefaultEmbeddingProvider = async (): Promise<EmbeddingProvider> => {
  const config = createDefaultConfig();
  return createEmbeddingProvider(config);
};

/**
 * Chunk text into smaller pieces
 * Pure function - no side effects
 */
export const chunkText = (
  text: string,
  options: {
    readonly maxChunkSize?: number;
    readonly overlap?: number;
  } = {}
): readonly string[] => {
  const maxChunkSize = options.maxChunkSize ?? 1000;
  const overlap = options.overlap ?? 100;

  if (text.length === 0) {
    return [];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + maxChunkSize, text.length);
    const chunk = text.slice(start, end);
    chunks.push(chunk);

    // If we've reached the end, break
    if (end >= text.length) {
      break;
    }

    // Move start forward, ensuring it advances
    const nextStart = end - overlap;
    if (nextStart <= start) {
      // Avoid infinite loop: ensure we always move forward
      start = end;
    } else {
      start = nextStart;
    }
  }

  return chunks;
};

/**
 * Calculate cosine similarity between two vectors
 * Returns value between -1 and 1 (1 = identical, 0 = orthogonal, -1 = opposite)
 */
export const cosineSimilarity = (vecA: number[], vecB: number[]): number => {
  if (vecA.length !== vecB.length) {
    throw new Error(
      `Vector dimension mismatch: ${vecA.length} vs ${vecB.length}`
    );
  }

  const { dotProduct, normA, normB } = vecA.reduce(
    (acc, aVal, i) => {
      const bVal = vecB[i];
      return {
        dotProduct: acc.dotProduct + aVal * bVal,
        normA: acc.normA + aVal * aVal,
        normB: acc.normB + bVal * bVal,
      };
    },
    { dotProduct: 0, normA: 0, normB: 0 }
  );

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

/**
 * Normalize vector to unit length
 */
export const normalizeVector = (vector: number[]): number[] => {
  const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) {
    return vector;
  }
  return vector.map((val) => val / magnitude);
};

/**
 * Compose embedding providers (primary + fallback)
 */
export const composeProviders = (
  primary: EmbeddingProvider,
  fallback: EmbeddingProvider
): EmbeddingProvider => ({
  name: `${primary.name}+${fallback.name}`,
  model: primary.model,
  dimensions: primary.dimensions,
  generateEmbedding: async (text: string) => {
    try {
      return await primary.generateEmbedding(text);
    } catch {
      return await fallback.generateEmbedding(text);
    }
  },
  generateEmbeddings: async (texts: string[]) => {
    try {
      return await primary.generateEmbeddings(texts);
    } catch {
      return await fallback.generateEmbeddings(texts);
    }
  },
});
