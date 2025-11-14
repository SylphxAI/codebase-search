/**
 * Vector Storage using HNSW Index
 * High-performance approximate nearest neighbor search
 */

import { HierarchicalNSW } from 'hnswlib-node';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Vector Document
 */
export interface VectorDocument {
  readonly id: string; // Unique identifier (file:// URI)
  readonly embedding: readonly number[]; // Vector representation
  readonly metadata: {
    readonly type: 'code' | 'knowledge'; // Document type
    readonly language?: string; // Programming language
    readonly content?: string; // Content snippet (for preview)
    readonly category?: string; // Category
    readonly path?: string; // File path
    readonly [key: string]: any; // Other metadata
  };
}

/**
 * Vector Search Result
 */
export interface VectorSearchResult {
  readonly doc: VectorDocument;
  readonly similarity: number; // 0-1, higher is more similar
  readonly distance: number; // Raw distance (cosine distance)
}

/**
 * Vector Storage Options
 */
export interface VectorStorageOptions {
  readonly dimensions: number; // Vector dimensions (1536 for OpenAI)
  readonly indexPath?: string; // Index file path
  readonly maxElements?: number; // Maximum elements (default 10000)
  readonly efConstruction?: number; // HNSW construction parameter (default 200)
  readonly m?: number; // HNSW M parameter (default 16)
}

/**
 * Vector Storage Statistics
 */
export interface VectorStorageStats {
  readonly totalDocuments: number;
  readonly dimensions: number;
  readonly indexSize: number;
}

/**
 * Vector Storage with HNSW Index
 */
export class VectorStorage {
  private index: HierarchicalNSW;
  private documents: Map<number, VectorDocument>;
  private idToIndex: Map<string, number>; // doc.id -> internal index
  private indexToId: Map<number, string>; // internal index -> doc.id
  private nextId: number = 0;
  private dimensions: number;
  private indexPath?: string;
  private maxElements: number;

  constructor(options: VectorStorageOptions) {
    this.dimensions = options.dimensions;
    this.indexPath = options.indexPath;
    this.maxElements = options.maxElements || 10000;
    this.documents = new Map();
    this.idToIndex = new Map();
    this.indexToId = new Map();

    // Initialize HNSW index
    this.index = new HierarchicalNSW('cosine', this.dimensions);

    if (this.indexPath && fs.existsSync(this.indexPath)) {
      this.load();
    } else {
      const efConstruction = options.efConstruction || 200;
      const m = options.m || 16;

      this.index.initIndex(this.maxElements, m, efConstruction);
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

    if (doc.embedding.length !== this.dimensions) {
      throw new Error(
        `Embedding dimensions (${doc.embedding.length}) don't match index dimensions (${this.dimensions})`
      );
    }

    const internalId = this.nextId++;

    // Add to HNSW index
    this.index.addPoint(doc.embedding as number[], internalId);

    // Store document metadata
    this.documents.set(internalId, doc);
    this.idToIndex.set(doc.id, internalId);
    this.indexToId.set(internalId, doc.id);
  }

  /**
   * Add multiple documents in batch
   */
  addDocuments(docs: readonly VectorDocument[]): void {
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
   * Note: hnswlib doesn't support true deletion, so we remove from our maps
   * The vector still exists in the index but won't be returned in results
   */
  deleteDocument(docId: string): boolean {
    const internalId = this.idToIndex.get(docId);
    if (internalId === undefined) {
      return false;
    }

    this.documents.delete(internalId);
    this.idToIndex.delete(docId);
    this.indexToId.delete(internalId);

    return true;
  }

  /**
   * Search for similar vectors
   */
  search(
    queryVector: readonly number[],
    options: {
      readonly k?: number;
      readonly minScore?: number;
      readonly filter?: (doc: VectorDocument) => boolean;
    } = {}
  ): VectorSearchResult[] {
    const k = options.k || 10;
    const minScore = options.minScore || 0;

    if (queryVector.length !== this.dimensions) {
      throw new Error(
        `Query vector dimensions (${queryVector.length}) don't match index dimensions (${this.dimensions})`
      );
    }

    if (this.documents.size === 0) {
      return [];
    }

    // Search HNSW index (get more for filtering)
    const searchK = Math.min(k * 2, this.index.getCurrentCount());
    const searchResults = this.index.searchKnn(queryVector as number[], searchK);

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
  getAllDocuments(): readonly VectorDocument[] {
    return Array.from(this.documents.values());
  }

  /**
   * Check if document exists
   */
  hasDocument(docId: string): boolean {
    return this.idToIndex.has(docId);
  }

  /**
   * Get statistics
   */
  getStats(): VectorStorageStats {
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
    this.index.writeIndexSync(targetPath);

    // Save document metadata
    const metadata = {
      documents: Array.from(this.documents.entries()),
      idToIndex: Array.from(this.idToIndex.entries()),
      indexToId: Array.from(this.indexToId.entries()),
      nextId: this.nextId,
      dimensions: this.dimensions,
      maxElements: this.maxElements,
    };

    fs.writeFileSync(`${targetPath}.metadata.json`, JSON.stringify(metadata, null, 2));

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
    this.index.readIndexSync(targetPath);

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
    this.maxElements = metadata.maxElements || this.maxElements;

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
    this.index = new HierarchicalNSW('cosine', this.dimensions);
    this.index.initIndex(this.maxElements);
  }
}
