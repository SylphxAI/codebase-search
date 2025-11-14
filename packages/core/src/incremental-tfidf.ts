/**
 * Incremental TF-IDF Index Manager
 * Efficiently updates TF-IDF vectors without full rebuild
 */

import type { DocumentVector } from './tfidf.js';
import { tokenize } from './tfidf.js';

export interface IncrementalUpdate {
  type: 'add' | 'update' | 'delete';
  uri: string;
  oldDocument?: DocumentVector;
  newContent?: string;
}

export interface IncrementalStats {
  totalDocuments: number;
  affectedDocuments: number;
  affectedTerms: number;
  updateTime: number;
}

/**
 * Incremental TF-IDF Index Manager
 *
 * ALGORITHM:
 * 1. Track document frequency (df) for each term
 * 2. When document changes:
 *    - Update df for affected terms
 *    - Recalculate IDF for affected terms
 *    - Update TF-IDF only for affected documents
 * 3. Avoid full rebuild unless necessary
 */
export class IncrementalTFIDF {
  private documents: Map<string, DocumentVector>;
  private idf: Map<string, number>;
  private documentFrequency: Map<string, number>;
  private totalDocuments: number;

  constructor(
    initialDocuments: DocumentVector[] = [],
    initialIdf: Map<string, number> = new Map()
  ) {
    this.documents = new Map();
    this.idf = new Map(initialIdf);
    this.documentFrequency = new Map();
    this.totalDocuments = initialDocuments.length;

    // Initialize from existing index
    for (const doc of initialDocuments) {
      this.documents.set(doc.uri, doc);

      // Calculate document frequency from existing documents
      for (const term of doc.rawTerms.keys()) {
        const df = this.documentFrequency.get(term) || 0;
        this.documentFrequency.set(term, df + 1);
      }
    }
  }

  /**
   * Apply multiple updates efficiently
   */
  async applyUpdates(updates: IncrementalUpdate[]): Promise<IncrementalStats> {
    const startTime = Date.now();
    const affectedTerms = new Set<string>();
    const affectedDocuments = new Set<string>();

    // Phase 1: Process all changes and collect affected terms
    for (const update of updates) {
      switch (update.type) {
        case 'add':
          if (update.newContent) {
            const terms = this.extractTerms(update.newContent);
            this.addDocumentInternal(update.uri, terms, affectedTerms);
            affectedDocuments.add(update.uri);
          }
          break;

        case 'update':
          if (update.oldDocument && update.newContent) {
            const oldTerms = update.oldDocument.rawTerms;
            const newTerms = this.extractTerms(update.newContent);
            this.updateDocumentInternal(update.uri, oldTerms, newTerms, affectedTerms);
            affectedDocuments.add(update.uri);
          }
          break;

        case 'delete':
          if (update.oldDocument) {
            this.deleteDocumentInternal(update.uri, update.oldDocument.rawTerms, affectedTerms);
            affectedDocuments.delete(update.uri);
          }
          break;
      }
    }

    // Phase 2: Recalculate IDF for affected terms
    for (const term of affectedTerms) {
      const df = this.documentFrequency.get(term) || 0;
      if (df > 0) {
        this.idf.set(term, Math.log(this.totalDocuments / df));
      } else {
        this.idf.delete(term);
        this.documentFrequency.delete(term);
      }
    }

    // Phase 3: Update TF-IDF for all documents containing affected terms
    for (const doc of this.documents.values()) {
      let needsUpdate = false;

      // Check if this document contains any affected terms
      for (const term of doc.rawTerms.keys()) {
        if (affectedTerms.has(term)) {
          needsUpdate = true;
          break;
        }
      }

      if (needsUpdate) {
        this.recalculateDocumentTFIDF(doc);
        affectedDocuments.add(doc.uri);
      }
    }

    return {
      totalDocuments: this.totalDocuments,
      affectedDocuments: affectedDocuments.size,
      affectedTerms: affectedTerms.size,
      updateTime: Date.now() - startTime,
    };
  }

  /**
   * Add a new document
   */
  private addDocumentInternal(
    uri: string,
    terms: Map<string, number>,
    affectedTerms: Set<string>
  ): void {
    this.totalDocuments++;

    // Update document frequency
    for (const term of terms.keys()) {
      const df = this.documentFrequency.get(term) || 0;
      this.documentFrequency.set(term, df + 1);
      affectedTerms.add(term);
    }

    // Create document vector (TF-IDF will be calculated later)
    const doc: DocumentVector = {
      uri,
      terms: new Map(),
      rawTerms: terms,
      magnitude: 0,
    };

    this.documents.set(uri, doc);
  }

  /**
   * Update an existing document
   */
  private updateDocumentInternal(
    uri: string,
    oldTerms: Map<string, number>,
    newTerms: Map<string, number>,
    affectedTerms: Set<string>
  ): void {
    // Collect all affected terms (old + new)
    for (const term of oldTerms.keys()) {
      affectedTerms.add(term);
    }
    for (const term of newTerms.keys()) {
      affectedTerms.add(term);
    }

    // Update document frequency
    // Remove old terms
    for (const term of oldTerms.keys()) {
      const df = this.documentFrequency.get(term) || 0;
      this.documentFrequency.set(term, Math.max(0, df - 1));
    }

    // Add new terms
    for (const term of newTerms.keys()) {
      const df = this.documentFrequency.get(term) || 0;
      this.documentFrequency.set(term, df + 1);
    }

    // Update document
    const doc = this.documents.get(uri);
    if (doc) {
      doc.rawTerms = newTerms;
      doc.terms.clear();
      doc.magnitude = 0;
    }
  }

  /**
   * Delete a document
   */
  private deleteDocumentInternal(
    uri: string,
    terms: Map<string, number>,
    affectedTerms: Set<string>
  ): void {
    this.totalDocuments--;

    // Update document frequency
    for (const term of terms.keys()) {
      const df = this.documentFrequency.get(term) || 0;
      this.documentFrequency.set(term, Math.max(0, df - 1));
      affectedTerms.add(term);
    }

    this.documents.delete(uri);
  }

  /**
   * Extract terms from content
   */
  private extractTerms(content: string): Map<string, number> {
    const tokens = tokenize(content);
    const frequencies = new Map<string, number>();

    for (const token of tokens) {
      frequencies.set(token, (frequencies.get(token) || 0) + 1);
    }

    return frequencies;
  }

  /**
   * Calculate TF for a document
   */
  private calculateTF(termFrequency: Map<string, number>): Map<string, number> {
    const totalTerms = Array.from(termFrequency.values()).reduce((sum, freq) => sum + freq, 0);
    const tf = new Map<string, number>();

    for (const [term, freq] of termFrequency.entries()) {
      tf.set(term, freq / totalTerms);
    }

    return tf;
  }

  /**
   * Recalculate TF-IDF for a document
   */
  private recalculateDocumentTFIDF(doc: DocumentVector): void {
    const tf = this.calculateTF(doc.rawTerms);
    doc.terms.clear();

    // Calculate TF-IDF for each term
    for (const [term, tfScore] of tf.entries()) {
      const idfScore = this.idf.get(term) || 0;
      doc.terms.set(term, tfScore * idfScore);
    }

    // Recalculate magnitude
    let sumSquares = 0;
    for (const tfidf of doc.terms.values()) {
      sumSquares += tfidf * tfidf;
    }
    doc.magnitude = Math.sqrt(sumSquares);
  }

  /**
   * Get current index state
   */
  getIndex(): {
    documents: DocumentVector[];
    idf: Map<string, number>;
    totalDocuments: number;
  } {
    return {
      documents: Array.from(this.documents.values()),
      idf: new Map(this.idf),
      totalDocuments: this.totalDocuments,
    };
  }

  /**
   * Check if full rebuild is recommended
   * Returns true if changes are too extensive for incremental update
   */
  shouldFullRebuild(updates: IncrementalUpdate[]): boolean {
    const changeRatio = updates.length / Math.max(this.totalDocuments, 1);

    // If >20% of documents changed, recommend full rebuild
    if (changeRatio > 0.2) {
      return true;
    }

    // Count new unique terms
    const newTerms = new Set<string>();
    for (const update of updates) {
      if (update.type === 'add' || update.type === 'update') {
        if (update.newContent) {
          const tokens = tokenize(update.newContent);
          for (const token of tokens) {
            if (!this.documentFrequency.has(token)) {
              newTerms.add(token);
            }
          }
        }
      }
    }

    // If too many new terms, recommend full rebuild
    if (newTerms.size > 1000) {
      return true;
    }

    return false;
  }
}
