# Vector Search 實作計劃

## 概述

基於與 Flow 項目的對比，我們需要實現以下核心功能來達到功能完整性：

1. **Vector Storage (HNSW Index)** - 最高優先級
2. **Hybrid Search** - Vector + TF-IDF
3. **Background Indexing** - 非阻塞索引
4. **Enhanced Progress Tracking** - 詳細進度回調

---

## Phase 1: Vector Storage Implementation

### 1.1 選擇向量存儲方案

**選項對比：**

| 方案 | 優點 | 缺點 | 推薦 |
|------|------|------|------|
| **hnswlib-node** | 快速、成熟、Node.js bindings | C++ 依賴 | ✅ **推薦** |
| **faiss-node** | Facebook 出品、功能強大 | 編譯困難 | ⚠️ 備選 |
| **Pure JS** | 無依賴、跨平台 | 性能差 | ❌ 不推薦 |

**決定：使用 hnswlib-node**
- 理由：成熟、快速、容易集成
- 備選：如果遇到編譯問題，考慮 @xenova/transformers 的內置向量搜索

### 1.2 數據結構設計

```typescript
// packages/core/src/vector-storage.ts

export interface VectorDocument {
  id: string;                    // 唯一標識（file:// URI）
  embedding: number[];           // 向量表示
  metadata: {
    type: 'code' | 'knowledge'; // 文檔類型
    language?: string;           // 編程語言
    content?: string;            // 內容片段（用於預覽）
    category?: string;           // 分類
    path?: string;               // 文件路徑
    [key: string]: any;          // 其他元數據
  };
}

export interface VectorSearchResult {
  doc: VectorDocument;
  similarity: number;  // 0-1，越高越相似
  distance: number;    // 原始距離（cosine distance）
}

export interface VectorStorageOptions {
  dimensions: number;      // 向量維度（1536 for OpenAI）
  indexPath?: string;      // 索引文件路徑
  maxElements?: number;    // 最大元素數量（默認 10000）
  efConstruction?: number; // HNSW 構建參數（默認 200）
  m?: number;              // HNSW M 參數（默認 16）
}
```

### 1.3 核心實現

```typescript
import * as hnswlib from 'hnswlib-node';
import fs from 'node:fs';
import path from 'node:path';

export class VectorStorage {
  private index: hnswlib.HierarchicalNSW;
  private documents: Map<number, VectorDocument>;
  private idToIndex: Map<string, number>;  // doc.id -> internal index
  private indexToId: Map<number, string>;  // internal index -> doc.id
  private nextId: number = 0;
  private dimensions: number;
  private indexPath?: string;

  constructor(options: VectorStorageOptions) {
    this.dimensions = options.dimensions;
    this.indexPath = options.indexPath;
    this.documents = new Map();
    this.idToIndex = new Map();
    this.indexToId = new Map();

    // Initialize HNSW index
    this.index = new hnswlib.HierarchicalNSW('cosine', this.dimensions);

    if (this.indexPath && fs.existsSync(this.indexPath)) {
      this.load();
    } else {
      const maxElements = options.maxElements || 10000;
      const efConstruction = options.efConstruction || 200;
      const m = options.m || 16;

      this.index.initIndex(maxElements, efConstruction, m);
      this.index.setEf(50); // Search-time parameter
    }
  }

  /**
   * Add document to vector storage
   */
  addDocument(doc: VectorDocument): void {
    if (this.idToIndex.has(doc.id)) {
      throw new Error(`Document with id ${doc.id} already exists`);
    }

    const internalId = this.nextId++;

    // Add to HNSW index
    this.index.addPoint(doc.embedding, internalId);

    // Store document metadata
    this.documents.set(internalId, doc);
    this.idToIndex.set(doc.id, internalId);
    this.indexToId.set(internalId, doc.id);
  }

  /**
   * Add multiple documents in batch
   */
  addDocuments(docs: VectorDocument[]): void {
    for (const doc of docs) {
      this.addDocument(doc);
    }
  }

  /**
   * Update document (delete + add)
   */
  updateDocument(doc: VectorDocument): void {
    if (this.idToIndex.has(doc.id)) {
      this.deleteDocument(doc.id);
    }
    this.addDocument(doc);
  }

  /**
   * Delete document
   */
  deleteDocument(docId: string): boolean {
    const internalId = this.idToIndex.get(docId);
    if (internalId === undefined) {
      return false;
    }

    // Note: hnswlib doesn't support deletion, so we just remove from our maps
    // The vector still exists in the index but won't be returned in results
    this.documents.delete(internalId);
    this.idToIndex.delete(docId);
    this.indexToId.delete(internalId);

    return true;
  }

  /**
   * Search for similar vectors
   */
  search(
    queryVector: number[],
    options: {
      k?: number;
      minScore?: number;
      filter?: (doc: VectorDocument) => boolean;
    } = {}
  ): VectorSearchResult[] {
    const k = options.k || 10;
    const minScore = options.minScore || 0;

    if (queryVector.length !== this.dimensions) {
      throw new Error(
        `Query vector dimensions (${queryVector.length}) don't match index dimensions (${this.dimensions})`
      );
    }

    // Search HNSW index
    const searchResults = this.index.searchKnn(queryVector, k * 2); // Get more for filtering

    const results: VectorSearchResult[] = [];

    for (let i = 0; i < searchResults.neighbors.length; i++) {
      const internalId = searchResults.neighbors[i];
      const distance = searchResults.distances[i];

      // Convert distance to similarity (cosine: 1 - distance)
      const similarity = 1 - distance;

      // Skip if below threshold
      if (similarity < minScore) {
        continue;
      }

      // Get document
      const doc = this.documents.get(internalId);
      if (!doc) {
        continue; // Document was deleted
      }

      // Apply filter if provided
      if (options.filter && !options.filter(doc)) {
        continue;
      }

      results.push({
        doc,
        similarity,
        distance,
      });

      if (results.length >= k) {
        break;
      }
    }

    return results;
  }

  /**
   * Get document by ID
   */
  getDocument(docId: string): VectorDocument | undefined {
    const internalId = this.idToIndex.get(docId);
    if (internalId === undefined) {
      return undefined;
    }
    return this.documents.get(internalId);
  }

  /**
   * Get all documents
   */
  getAllDocuments(): VectorDocument[] {
    return Array.from(this.documents.values());
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalDocuments: number;
    dimensions: number;
    indexSize: number;
  } {
    return {
      totalDocuments: this.documents.size,
      dimensions: this.dimensions,
      indexSize: this.index.getCurrentCount(),
    };
  }

  /**
   * Save index to disk
   */
  save(savePath?: string): void {
    const targetPath = savePath || this.indexPath;
    if (!targetPath) {
      throw new Error('No index path specified');
    }

    // Ensure directory exists
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Save HNSW index
    this.index.writeIndex(targetPath);

    // Save document metadata
    const metadata = {
      documents: Array.from(this.documents.entries()),
      idToIndex: Array.from(this.idToIndex.entries()),
      indexToId: Array.from(this.indexToId.entries()),
      nextId: this.nextId,
      dimensions: this.dimensions,
    };

    fs.writeFileSync(
      `${targetPath}.metadata.json`,
      JSON.stringify(metadata, null, 2)
    );

    console.error(`[INFO] Vector index saved to ${targetPath}`);
  }

  /**
   * Load index from disk
   */
  load(loadPath?: string): void {
    const targetPath = loadPath || this.indexPath;
    if (!targetPath) {
      throw new Error('No index path specified');
    }

    if (!fs.existsSync(targetPath)) {
      throw new Error(`Index file not found: ${targetPath}`);
    }

    // Load HNSW index
    this.index.readIndex(targetPath);

    // Load document metadata
    const metadataPath = `${targetPath}.metadata.json`;
    if (!fs.existsSync(metadataPath)) {
      throw new Error(`Metadata file not found: ${metadataPath}`);
    }

    const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));

    this.documents = new Map(metadata.documents);
    this.idToIndex = new Map(metadata.idToIndex);
    this.indexToId = new Map(metadata.indexToId);
    this.nextId = metadata.nextId;
    this.dimensions = metadata.dimensions;

    console.error(
      `[INFO] Vector index loaded: ${this.documents.size} documents, ${this.dimensions} dimensions`
    );
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.documents.clear();
    this.idToIndex.clear();
    this.indexToId.clear();
    this.nextId = 0;

    // Reinitialize index
    this.index = new hnswlib.HierarchicalNSW('cosine', this.dimensions);
    this.index.initIndex(10000);
  }
}
```

### 1.4 集成到 Indexer

```typescript
// packages/core/src/indexer.ts (modifications)

export class CodebaseIndexer {
  private vectorStorage?: VectorStorage;
  private embeddingProvider?: EmbeddingProvider;

  constructor(options: IndexerOptions = {}) {
    // ... existing code ...

    // Initialize vector storage if embedding provider is available
    if (options.embeddingProvider) {
      this.embeddingProvider = options.embeddingProvider;
      const vectorPath = path.join(
        this.codebaseRoot,
        '.codebase-search',
        'vectors.hnsw'
      );

      this.vectorStorage = new VectorStorage({
        dimensions: options.embeddingProvider.dimensions,
        indexPath: vectorPath,
      });
    }
  }

  /**
   * Index with optional vector embeddings
   */
  async index(options: IndexerOptions = {}): Promise<void> {
    // ... existing TF-IDF indexing ...

    // Build vector index if embedding provider available
    if (this.embeddingProvider && this.vectorStorage) {
      console.error('[INFO] Generating embeddings for vector search...');

      const files = await this.storage.getAllFiles();
      const batchSize = 10;

      for (let i = 0; i < files.length; i += batchSize) {
        const batch = files.slice(i, i + batchSize);
        const contents = batch.map(f => f.content);

        // Generate embeddings
        const embeddings = await this.embeddingProvider.generateEmbeddings(contents);

        // Add to vector storage
        for (let j = 0; j < batch.length; j++) {
          const file = batch[j];
          const embedding = embeddings[j];

          const doc: VectorDocument = {
            id: `file://${file.path}`,
            embedding,
            metadata: {
              type: 'code',
              language: file.language,
              content: file.content.substring(0, 500), // Preview
              path: file.path,
            },
          };

          this.vectorStorage.addDocument(doc);
        }

        console.error(
          `[INFO] Generated embeddings for ${Math.min((i + 1) * batchSize, files.length)}/${files.length} files`
        );
      }

      // Save vector index
      this.vectorStorage.save();
      console.error('[SUCCESS] Vector index built and saved');
    }
  }

  /**
   * Get vector storage (for hybrid search)
   */
  getVectorStorage(): VectorStorage | undefined {
    return this.vectorStorage;
  }

  /**
   * Get embedding provider (for hybrid search)
   */
  getEmbeddingProvider(): EmbeddingProvider | undefined {
    return this.embeddingProvider;
  }
}
```

---

## Phase 2: Hybrid Search Implementation

### 2.1 Hybrid Search Strategy

```typescript
// packages/core/src/hybrid-search.ts

export interface HybridSearchOptions {
  limit?: number;
  minScore?: number;
  vectorWeight?: number;  // 0-1, default 0.7
  includeContent?: boolean;
  fileExtensions?: string[];
  pathFilter?: string;
  excludePaths?: string[];
}

export interface HybridSearchResult {
  path: string;
  score: number;
  method: 'vector' | 'tfidf' | 'hybrid';
  matchedTerms?: string[];
  similarity?: number;
  content?: string;
  language?: string;
}

/**
 * Hybrid search combining vector and TF-IDF
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
      console.error('[INFO] Using hybrid search (vector + TF-IDF)');

      // 1. Vector search
      const queryEmbedding = await embeddingProvider.generateEmbedding(query);
      const vectorResults = await vectorStorage.search(queryEmbedding, {
        k: limit * 2, // Get more for merging
        minScore: minScore / vectorWeight, // Adjust threshold
      });

      // 2. TF-IDF search
      const tfidfResults = await indexer.search(query, {
        limit: limit * 2,
        includeContent,
      });

      // 3. Merge results
      const merged = mergeSearchResults(
        vectorResults,
        tfidfResults,
        vectorWeight
      );

      // 4. Filter and limit
      return merged
        .filter(r => r.score >= minScore)
        .slice(0, limit);

    } catch (error) {
      console.warn('[WARN] Hybrid search failed, falling back to TF-IDF:', error);
    }
  }

  // Fallback to TF-IDF only
  console.error('[INFO] Using TF-IDF search only');
  const results = await indexer.search(query, { limit, includeContent });

  return results.map(r => ({
    path: r.path,
    score: r.score,
    method: 'tfidf' as const,
    matchedTerms: r.matchedTerms,
    content: r.content,
    language: r.language,
  }));
}

/**
 * Merge vector and TF-IDF results with weighted scoring
 */
function mergeSearchResults(
  vectorResults: VectorSearchResult[],
  tfidfResults: SearchResult[],
  vectorWeight: number
): HybridSearchResult[] {
  const resultMap = new Map<string, HybridSearchResult>();

  // Normalize scores to 0-1 range
  const maxVectorScore = Math.max(...vectorResults.map(r => r.similarity), 0.01);
  const maxTfidfScore = Math.max(...tfidfResults.map(r => r.score), 0.01);

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
      // Combine scores (weighted sum)
      existing.score += normalizedScore * (1 - vectorWeight);
      existing.method = 'hybrid';
      existing.matchedTerms = result.matchedTerms;
      // Keep more detailed content from TF-IDF if available
      if (result.content) {
        existing.content = result.content;
      }
    } else {
      resultMap.set(result.path, {
        path: result.path,
        score: normalizedScore * (1 - vectorWeight),
        method: 'tfidf',
        matchedTerms: result.matchedTerms,
        content: result.content,
        language: result.language,
      });
    }
  }

  // Sort by combined score
  return Array.from(resultMap.values())
    .sort((a, b) => b.score - a.score);
}

/**
 * Convenience method for semantic search (vector only)
 */
export async function semanticSearch(
  query: string,
  indexer: CodebaseIndexer,
  options: Omit<HybridSearchOptions, 'vectorWeight'> = {}
): Promise<HybridSearchResult[]> {
  return hybridSearch(query, indexer, { ...options, vectorWeight: 1.0 });
}

/**
 * Convenience method for keyword search (TF-IDF only)
 */
export async function keywordSearch(
  query: string,
  indexer: CodebaseIndexer,
  options: Omit<HybridSearchOptions, 'vectorWeight'> = {}
): Promise<HybridSearchResult[]> {
  return hybridSearch(query, indexer, { ...options, vectorWeight: 0.0 });
}
```

---

## Phase 3: Background Indexing

### 3.1 Non-blocking Indexing

```typescript
// packages/core/src/indexer.ts (modifications)

export class CodebaseIndexer {
  private indexingPromise: Promise<void> | null = null;
  private indexingStatus: IndexingStatus = {
    isIndexing: false,
    progress: 0,
    totalFiles: 0,
    indexedFiles: 0,
    stage: 'idle',
  };

  /**
   * Index with queue management (prevents duplicate indexing)
   */
  async index(options: IndexerOptions = {}): Promise<void> {
    // If already indexing, wait for current operation
    if (this.indexingPromise) {
      console.error('[INFO] Indexing already in progress, waiting...');
      return this.indexingPromise;
    }

    // Start new indexing operation
    this.indexingPromise = this.performIndexing(options)
      .finally(() => {
        this.indexingPromise = null;
        this.indexingStatus.stage = 'idle';
      });

    return this.indexingPromise;
  }

  /**
   * Start background indexing (non-blocking)
   */
  startBackgroundIndexing(options: IndexerOptions = {}): void {
    if (this.indexingPromise) {
      console.error('[INFO] Indexing already in progress');
      return;
    }

    console.error('[INFO] Starting background indexing...');

    // Start indexing but don't wait for it
    this.index(options).catch(error => {
      console.error('[ERROR] Background indexing failed:', error);
      this.indexingStatus.error = error.message;
    });
  }

  /**
   * Get current indexing status
   */
  getStatus(): IndexingStatus {
    return { ...this.indexingStatus };
  }

  /**
   * Internal indexing implementation
   */
  private async performIndexing(options: IndexerOptions): Promise<void> {
    this.indexingStatus = {
      isIndexing: true,
      progress: 0,
      totalFiles: 0,
      indexedFiles: 0,
      stage: 'scanning',
    };

    try {
      // Stage 1: File scanning
      this.indexingStatus.stage = 'scanning';
      const files = await this.scanFiles();
      this.indexingStatus.totalFiles = files.length;

      // Stage 2: TF-IDF indexing
      this.indexingStatus.stage = 'tfidf';
      await this.buildTFIDFIndex(files, (progress) => {
        this.indexingStatus.indexedFiles = progress.current;
        this.indexingStatus.progress = (progress.current / progress.total) * 50;
        this.indexingStatus.currentFile = progress.fileName;
        options.onProgress?.(progress);
      });

      // Stage 3: Vector indexing (if available)
      if (this.embeddingProvider && this.vectorStorage) {
        this.indexingStatus.stage = 'vectors';
        await this.buildVectorIndex(files, (progress) => {
          this.indexingStatus.progress = 50 + (progress.current / progress.total) * 50;
          options.onProgress?.(progress);
        });
      }

      this.indexingStatus.progress = 100;
      this.indexingStatus.stage = 'complete';

      console.error(`[SUCCESS] Indexing complete: ${files.length} files`);

    } catch (error) {
      this.indexingStatus.stage = 'error';
      this.indexingStatus.error = error.message;
      throw error;
    } finally {
      this.indexingStatus.isIndexing = false;
    }
  }
}
```

---

## Phase 4: Testing Strategy

### 4.1 Unit Tests for Vector Storage

```typescript
// packages/core/src/vector-storage.test.ts

describe('VectorStorage', () => {
  let storage: VectorStorage;

  beforeEach(() => {
    storage = new VectorStorage({ dimensions: 128 });
  });

  describe('add and search', () => {
    it('should add documents and search', async () => {
      // Add documents
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

      // Search
      const results = storage.search(Array(128).fill(1), { k: 2 });

      expect(results).toHaveLength(2);
      expect(results[0].doc.id).toBe('doc1');
      expect(results[0].similarity).toBeCloseTo(1, 2);
    });
  });

  describe('save and load', () => {
    it('should persist index to disk', () => {
      // Add documents
      storage.addDocument({
        id: 'doc1',
        embedding: Array(128).fill(1),
        metadata: { type: 'code' },
      });

      // Save
      const tempPath = '/tmp/test-index.hnsw';
      storage.save(tempPath);

      // Load in new instance
      const storage2 = new VectorStorage({
        dimensions: 128,
        indexPath: tempPath,
      });

      const doc = storage2.getDocument('doc1');
      expect(doc).toBeDefined();
      expect(doc!.id).toBe('doc1');
    });
  });
});
```

### 4.2 Integration Tests for Hybrid Search

```typescript
// packages/core/src/hybrid-search.test.ts

describe('Hybrid Search', () => {
  let indexer: CodebaseIndexer;
  let embeddingProvider: EmbeddingProvider;

  beforeEach(async () => {
    embeddingProvider = createMockProvider(128);
    indexer = new CodebaseIndexer({
      codebaseRoot: './test-fixtures',
      embeddingProvider,
    });

    await indexer.index();
  });

  it('should combine vector and TF-IDF results', async () => {
    const results = await hybridSearch('authentication', indexer, {
      limit: 5,
      vectorWeight: 0.7,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].method).toMatch(/vector|tfidf|hybrid/);
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('should fallback to TF-IDF when vector search unavailable', async () => {
    // Create indexer without embeddings
    const simpleIndexer = new CodebaseIndexer({
      codebaseRoot: './test-fixtures',
    });
    await simpleIndexer.index();

    const results = await hybridSearch('authentication', simpleIndexer);

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].method).toBe('tfidf');
  });
});
```

---

## Dependencies 更新

```json
// packages/core/package.json
{
  "dependencies": {
    "@ai-sdk/openai": "^1.0.11",
    "ai": "^4.0.35",
    "better-sqlite3": "^11.8.1",
    "chokidar": "^4.0.3",
    "drizzle-orm": "^0.36.4",
    "hnswlib-node": "^3.0.0",  // NEW
    "ignore": "^7.0.5"
  }
}
```

---

## Timeline

| Phase | 功能 | 估計時間 | 優先級 |
|-------|------|----------|--------|
| 1.1 | Vector Storage 實現 | 2-3 days | 🔴 High |
| 1.2 | 集成到 Indexer | 1 day | 🔴 High |
| 2.1 | Hybrid Search | 1-2 days | 🔴 High |
| 3.1 | Background Indexing | 1 day | 🟡 Medium |
| 4.1 | 單元測試 | 1 day | 🟡 Medium |
| 4.2 | 集成測試 | 1 day | 🟡 Medium |
| - | **總計** | **7-10 days** | - |

---

## Success Criteria

1. **Vector Storage**
   - ✅ 可以添加、搜索、刪除向量
   - ✅ 持久化到磁盤並正確加載
   - ✅ k-NN 搜索返回正確結果
   - ✅ 性能：1000 vectors search < 10ms

2. **Hybrid Search**
   - ✅ 正確結合 vector 和 TF-IDF 結果
   - ✅ 權重調整影響排序
   - ✅ Fallback 機制正常工作
   - ✅ 搜索質量：相關性 > 80%

3. **Background Indexing**
   - ✅ 非阻塞執行
   - ✅ 進度追蹤準確
   - ✅ 錯誤處理正確
   - ✅ 不會重複索引

4. **Testing**
   - ✅ 單元測試覆蓋率 > 80%
   - ✅ 集成測試通過
   - ✅ 性能測試達標

---

## Next Steps

1. **立即開始**: 安裝 `hnswlib-node` 並實現基礎 VectorStorage 類
2. **驗證**: 寫簡單的測試確保 HNSW 正常工作
3. **集成**: 添加到 CodebaseIndexer
4. **測試**: 端到端測試確保功能完整

準備好開始實作了嗎？🚀
