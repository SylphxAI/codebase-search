/**
 * @codebase-search/core
 * Core library for intelligent codebase search using TF-IDF
 */

// Re-export main components
export { CodebaseIndexer, type IndexerOptions, type IndexingStatus, type SearchResult } from './indexer.js';
export { buildSearchIndex, searchDocuments, processQuery, calculateCosineSimilarity, type SearchIndex, type DocumentVector } from './tfidf.js';
export { MemoryStorage, type CodebaseFile } from './storage.js';
export { loadGitignore, scanFiles, isTextFile, detectLanguage, simpleHash, type ScanOptions, type ScanResult } from './utils.js';
