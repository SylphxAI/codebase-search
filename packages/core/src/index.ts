/**
 * @codebase-search/core
 * Core library for intelligent codebase search using TF-IDF
 */

// Re-export main components
export {
  CodebaseIndexer,
  type IndexerOptions,
  type IndexingStatus,
  type SearchResult,
  type FileChangeEvent,
} from './indexer.js';
export {
  buildSearchIndex,
  searchDocuments,
  processQuery,
  calculateCosineSimilarity,
  type SearchIndex,
  type DocumentVector,
} from './tfidf.js';
export { MemoryStorage, type CodebaseFile } from './storage.js';
export { PersistentStorage } from './storage-persistent.js';
export {
  loadGitignore,
  scanFiles,
  isTextFile,
  detectLanguage,
  simpleHash,
  type ScanOptions,
  type ScanResult,
} from './utils.js';
export {
  createEmbeddingProvider,
  createOpenAIProvider,
  createMockProvider,
  getDefaultEmbeddingProvider,
  createDefaultConfig,
  generateMockEmbedding,
  chunkText,
  cosineSimilarity,
  normalizeVector,
  composeProviders,
  type EmbeddingConfig,
  type EmbeddingProvider,
} from './embeddings.js';
export { LRUCache, createCacheKey, type CacheEntry, type CacheStats } from './search-cache.js';
export {
  IncrementalTFIDF,
  type IncrementalUpdate,
  type IncrementalStats,
} from './incremental-tfidf.js';
export {
  VectorStorage,
  type VectorDocument,
  type VectorSearchResult,
  type VectorStorageOptions,
  type VectorStorageStats,
} from './vector-storage.js';
export {
  hybridSearch,
  semanticSearch,
  keywordSearch,
  type HybridSearchOptions,
  type HybridSearchResult,
} from './hybrid-search.js';
