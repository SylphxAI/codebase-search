/**
 * Hybrid Search - Combines Vector and TF-IDF Search
 */

import type { CodebaseIndexer, SearchResult } from './indexer.js';
import type { VectorStorage, VectorSearchResult } from './vector-storage.js';
import type { EmbeddingProvider } from './embeddings.js';

/**
 * Hybrid Search Options
 */
export interface HybridSearchOptions {
  readonly limit?: number;
  readonly minScore?: number;
  readonly vectorWeight?: number; // 0-1, default 0.7
  readonly includeContent?: boolean;
  readonly fileExtensions?: string[];
  readonly pathFilter?: string;
  readonly excludePaths?: string[];
}

/**
 * Hybrid Search Result
 */
export interface HybridSearchResult {
  readonly path: string;
  readonly score: number;
  readonly method: 'vector' | 'tfidf' | 'hybrid';
  readonly matchedTerms?: string[];
  readonly similarity?: number;
  readonly content?: string;
  readonly language?: string;
}

/**
 * Hybrid search combining vector and TF-IDF
 * Returns weighted combination of both approaches
 */
export async function hybridSearch(
  query: string,
  indexer: CodebaseIndexer,
  options: HybridSearchOptions = {}
): Promise<HybridSearchResult[]> {
  const {
    limit = 10,
    minScore = 0.01,
    vectorWeight = 0.7,
    includeContent = false,
  } = options;

  const vectorStorage = indexer.getVectorStorage();
  const embeddingProvider = indexer.getEmbeddingProvider();

  // Try hybrid search if vector search is available
  if (vectorStorage && embeddingProvider) {
    try {
      // Pure vector search (skip TF-IDF)
      if (vectorWeight >= 0.99) {
        console.error('[INFO] Using vector search only');

        const queryEmbedding = await embeddingProvider.generateEmbedding(query);
        const vectorResults = vectorStorage.search(queryEmbedding, {
          k: limit,
          minScore: minScore,
        });

        return vectorResults.map((r) => ({
          path: r.doc.id.replace('file://', ''),
          score: r.similarity,
          method: 'vector' as const,
          similarity: r.similarity,
          content: r.doc.metadata.content,
          language: r.doc.metadata.language,
        }));
      }

      // Pure TF-IDF search (skip vector)
      if (vectorWeight <= 0.01) {
        console.error('[INFO] Using TF-IDF search only');
        const results = await indexer.search(query, { limit, includeContent });
        return results.map((r) => ({
          path: r.path,
          score: r.score,
          method: 'tfidf' as const,
          matchedTerms: r.matchedTerms,
          content: r.snippet,
          language: r.language,
        }));
      }

      // Hybrid search
      console.error('[INFO] Using hybrid search (vector + TF-IDF)');

      // 1. Vector search
      const queryEmbedding = await embeddingProvider.generateEmbedding(query);
      const vectorResults = vectorStorage.search(queryEmbedding, {
        k: limit * 2, // Get more for merging
        minScore: 0, // Get all results for merging
      });

      // 2. TF-IDF search
      const tfidfResults = await indexer.search(query, {
        limit: limit * 2,
        includeContent,
      });

      // 3. Merge results
      const merged = mergeSearchResults(vectorResults, tfidfResults, vectorWeight);

      // 4. Filter and limit
      return merged.filter((r) => r.score >= minScore).slice(0, limit);
    } catch (error) {
      console.error('[WARN] Hybrid search failed, falling back to TF-IDF:', error);
    }
  }

  // Fallback to TF-IDF only
  console.error('[INFO] Using TF-IDF search only');
  const results = await indexer.search(query, { limit, includeContent });

  return results.map((r) => ({
    path: r.path,
    score: r.score,
    method: 'tfidf' as const,
    matchedTerms: r.matchedTerms,
    content: r.snippet,
    language: r.language,
  }));
}

/**
 * Merge vector and TF-IDF results with weighted scoring
 */
function mergeSearchResults(
  vectorResults: readonly VectorSearchResult[],
  tfidfResults: readonly SearchResult[],
  vectorWeight: number
): HybridSearchResult[] {
  const resultMap = new Map<string, HybridSearchResult>();

  // Normalize scores to 0-1 range
  const maxVectorScore = Math.max(...vectorResults.map((r) => r.similarity), 0.01);
  const maxTfidfScore = Math.max(...tfidfResults.map((r) => r.score), 0.01);

  // Add vector results
  for (const result of vectorResults) {
    const path = result.doc.id.replace('file://', '');
    const normalizedScore = result.similarity / maxVectorScore;

    resultMap.set(path, {
      path,
      score: normalizedScore * vectorWeight,
      method: 'vector',
      similarity: result.similarity,
      content: result.doc.metadata.content,
      language: result.doc.metadata.language,
    });
  }

  // Add/merge TF-IDF results
  for (const result of tfidfResults) {
    const normalizedScore = result.score / maxTfidfScore;
    const existing = resultMap.get(result.path);

    if (existing) {
      // Combine scores (weighted sum) - create new object
      resultMap.set(result.path, {
        path: result.path,
        score: existing.score + normalizedScore * (1 - vectorWeight),
        method: 'hybrid' as const,
        matchedTerms: result.matchedTerms,
        similarity: existing.similarity,
        content: result.snippet || existing.content,
        language: result.language || existing.language,
      });
    } else {
      resultMap.set(result.path, {
        path: result.path,
        score: normalizedScore * (1 - vectorWeight),
        method: 'tfidf',
        matchedTerms: result.matchedTerms,
        content: result.snippet,
        language: result.language,
      });
    }
  }

  // Sort by combined score
  return Array.from(resultMap.values()).sort((a, b) => b.score - a.score);
}

/**
 * Semantic search (vector only)
 * Convenience method for pure semantic search
 */
export async function semanticSearch(
  query: string,
  indexer: CodebaseIndexer,
  options: Omit<HybridSearchOptions, 'vectorWeight'> = {}
): Promise<HybridSearchResult[]> {
  return hybridSearch(query, indexer, { ...options, vectorWeight: 1.0 });
}

/**
 * Keyword search (TF-IDF only)
 * Convenience method for pure keyword search
 */
export async function keywordSearch(
  query: string,
  indexer: CodebaseIndexer,
  options: Omit<HybridSearchOptions, 'vectorWeight'> = {}
): Promise<HybridSearchResult[]> {
  return hybridSearch(query, indexer, { ...options, vectorWeight: 0.0 });
}
