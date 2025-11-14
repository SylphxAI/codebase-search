/**
 * Codebase indexer service
 */

import path from 'node:path';
import fs from 'node:fs/promises';
import type chokidar from 'chokidar';
import {
  loadGitignore,
  scanFiles,
  simpleHash,
  isTextFile,
  detectLanguage,
  type ScanResult,
} from './utils.js';
import { MemoryStorage, type CodebaseFile } from './storage.js';
import { buildSearchIndex, type SearchIndex } from './tfidf.js';

export interface IndexerOptions {
  codebaseRoot?: string;
  maxFileSize?: number;
  onProgress?: (current: number, total: number, file: string) => void;
  watch?: boolean;
  onFileChange?: (event: FileChangeEvent) => void;
}

export interface FileChangeEvent {
  type: 'add' | 'change' | 'unlink';
  path: string;
  timestamp: number;
}

export interface IndexingStatus {
  isIndexing: boolean;
  progress: number;
  totalFiles: number;
  indexedFiles: number;
  currentFile?: string;
}

export class CodebaseIndexer {
  private codebaseRoot: string;
  private maxFileSize: number;
  private storage: MemoryStorage;
  private searchIndex: SearchIndex | null = null;
  private watcher: any = null;
  private isWatching = false;
  private onFileChangeCallback?: (event: FileChangeEvent) => void;
  private pendingUpdates = new Map<string, NodeJS.Timeout>();
  private ignoreFilter: any = null;
  private status: IndexingStatus = {
    isIndexing: false,
    progress: 0,
    totalFiles: 0,
    indexedFiles: 0,
  };

  constructor(options: IndexerOptions = {}) {
    this.codebaseRoot = options.codebaseRoot || process.cwd();
    this.maxFileSize = options.maxFileSize || 1048576; // 1MB
    this.storage = new MemoryStorage();
    this.onFileChangeCallback = options.onFileChange;
  }

  /**
   * Get current indexing status
   */
  getStatus(): IndexingStatus {
    return { ...this.status };
  }

  /**
   * Get search index
   */
  getSearchIndex(): SearchIndex | null {
    return this.searchIndex;
  }

  /**
   * Index the codebase
   */
  async index(options: IndexerOptions = {}): Promise<void> {
    this.status.isIndexing = true;
    this.status.progress = 0;
    this.status.indexedFiles = 0;

    try {
      // Load .gitignore
      this.ignoreFilter = loadGitignore(this.codebaseRoot);
      const ignoreFilter = this.ignoreFilter;

      // Scan files
      console.error('[INFO] Scanning codebase...');
      const scannedFiles = scanFiles(this.codebaseRoot, {
        ignoreFilter,
        codebaseRoot: this.codebaseRoot,
        maxFileSize: options.maxFileSize,
      });

      this.status.totalFiles = scannedFiles.length;
      console.error(`[INFO] Found ${scannedFiles.length} files`);

      // Store files in memory
      for (let i = 0; i < scannedFiles.length; i++) {
        const file = scannedFiles[i];
        this.status.currentFile = file.path;
        this.status.indexedFiles = i + 1;
        this.status.progress = Math.round(((i + 1) / scannedFiles.length) * 50); // 0-50% for file scanning

        options.onProgress?.(i + 1, scannedFiles.length, file.path);

        const codebaseFile: CodebaseFile = {
          path: file.path,
          content: file.content,
          size: file.size,
          mtime: file.mtime,
          language: file.language,
          hash: simpleHash(file.content),
        };

        await this.storage.storeFile(codebaseFile);
      }

      // Build search index
      console.error('[INFO] Building search index...');
      const documents = scannedFiles.map((file) => ({
        uri: `file://${file.path}`,
        content: file.content,
      }));

      this.searchIndex = buildSearchIndex(documents);
      this.status.progress = 100;

      console.error(`[SUCCESS] Indexed ${scannedFiles.length} files`);

      // Start watching if requested
      if (options.watch) {
        await this.startWatch();
      }
    } catch (error) {
      console.error('[ERROR] Failed to index codebase:', error);
      throw error;
    } finally {
      this.status.isIndexing = false;
      this.status.currentFile = undefined;
    }
  }

  /**
   * Start watching for file changes
   */
  async startWatch(): Promise<void> {
    if (this.isWatching) {
      console.error('[WARN] Already watching for changes');
      return;
    }

    if (!this.ignoreFilter) {
      this.ignoreFilter = loadGitignore(this.codebaseRoot);
    }

    console.error('[INFO] Starting file watcher...');

    const chokidarModule = await import('chokidar');
    this.watcher = chokidarModule.default.watch(this.codebaseRoot, {
      ignored: [
        '**/node_modules/**',
        '**/.git/**',
        '**/dist/**',
        '**/build/**',
        '**/.next/**',
        '**/.turbo/**',
      ],
      ignoreInitial: true,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100,
      },
    });

    this.watcher.on('add', (filePath) => this.handleFileChange('add', filePath));
    this.watcher.on('change', (filePath) => this.handleFileChange('change', filePath));
    this.watcher.on('unlink', (filePath) => this.handleFileChange('unlink', filePath));

    this.isWatching = true;
    console.error('[SUCCESS] File watcher started');
  }

  /**
   * Stop watching for file changes
   */
  async stopWatch(): Promise<void> {
    if (!this.isWatching || !this.watcher) {
      return;
    }

    console.error('[INFO] Stopping file watcher...');
    await this.watcher.close();
    this.watcher = null;
    this.isWatching = false;

    // Clear pending updates
    for (const timeout of this.pendingUpdates.values()) {
      clearTimeout(timeout);
    }
    this.pendingUpdates.clear();

    console.error('[SUCCESS] File watcher stopped');
  }

  /**
   * Handle file change events with debouncing
   */
  private handleFileChange(type: 'add' | 'change' | 'unlink', absolutePath: string): void {
    const relativePath = path.relative(this.codebaseRoot, absolutePath);

    // Check if file should be ignored
    if (this.ignoreFilter?.ignores(relativePath)) {
      return;
    }

    // Debounce updates (wait 500ms after last change)
    const existing = this.pendingUpdates.get(relativePath);
    if (existing) {
      clearTimeout(existing);
    }

    const timeout = setTimeout(async () => {
      this.pendingUpdates.delete(relativePath);
      await this.processFileChange(type, relativePath, absolutePath);
    }, 500);

    this.pendingUpdates.set(relativePath, timeout);
  }

  /**
   * Process file change and update index
   */
  private async processFileChange(
    type: 'add' | 'change' | 'unlink',
    relativePath: string,
    absolutePath: string
  ): Promise<void> {
    const event: FileChangeEvent = {
      type,
      path: relativePath,
      timestamp: Date.now(),
    };

    try {
      if (type === 'unlink') {
        // Remove from storage and rebuild index
        await this.storage.deleteFile(relativePath);
        console.error(`[FILE] Removed: ${relativePath}`);
      } else {
        // Check if file is text and within size limit
        const stats = await fs.stat(absolutePath);
        if (stats.size > this.maxFileSize) {
          console.error(`[FILE] Skipped (too large): ${relativePath}`);
          return;
        }

        if (!isTextFile(absolutePath)) {
          console.error(`[FILE] Skipped (binary): ${relativePath}`);
          return;
        }

        // Read and index file
        const content = await fs.readFile(absolutePath, 'utf-8');
        const codebaseFile: CodebaseFile = {
          path: relativePath,
          content,
          size: stats.size,
          mtime: stats.mtime,
          language: detectLanguage(relativePath),
          hash: simpleHash(content),
        };

        await this.storage.storeFile(codebaseFile);
        console.error(`[FILE] ${type === 'add' ? 'Added' : 'Updated'}: ${relativePath}`);
      }

      // Rebuild search index
      await this.rebuildSearchIndex();

      // Notify callback
      this.onFileChangeCallback?.(event);
    } catch (error) {
      console.error(`[ERROR] Failed to process file change (${relativePath}):`, error);
    }
  }

  /**
   * Rebuild search index from current storage
   */
  private async rebuildSearchIndex(): Promise<void> {
    const allFiles = await this.storage.getAllFiles();
    const documents = allFiles.map((file) => ({
      uri: `file://${file.path}`,
      content: file.content,
    }));

    this.searchIndex = buildSearchIndex(documents);
  }

  /**
   * Check if currently watching for changes
   */
  isWatchEnabled(): boolean {
    return this.isWatching;
  }

  /**
   * Search the codebase
   */
  async search(
    query: string,
    options: {
      limit?: number;
      includeContent?: boolean;
      fileExtensions?: string[];
      pathFilter?: string;
      excludePaths?: string[];
    } = {}
  ): Promise<SearchResult[]> {
    if (!this.searchIndex) {
      throw new Error('Codebase not indexed. Please run index() first.');
    }

    const { limit = 10, includeContent = true } = options;

    // Search using TF-IDF
    const results = await import('./tfidf.js').then((m) =>
      m.searchDocuments(query, this.searchIndex!, { limit })
    );

    // Get file content and apply filters
    const searchResults: SearchResult[] = [];

    for (const result of results) {
      const filePath = result.uri.replace('file://', '');

      // Apply filters
      if (options.fileExtensions && options.fileExtensions.length > 0) {
        if (!options.fileExtensions.some((ext) => filePath.endsWith(ext))) {
          continue;
        }
      }

      if (options.pathFilter && !filePath.includes(options.pathFilter)) {
        continue;
      }

      if (options.excludePaths && options.excludePaths.length > 0) {
        if (options.excludePaths.some((exclude) => filePath.includes(exclude))) {
          continue;
        }
      }

      const file = await this.storage.getFile(filePath);
      if (!file) continue;

      const searchResult: SearchResult = {
        path: file.path,
        score: result.score,
        matchedTerms: result.matchedTerms,
        language: file.language,
        size: file.size,
      };

      if (includeContent) {
        searchResult.snippet = this.extractSnippet(file.content, result.matchedTerms);
      }

      searchResults.push(searchResult);
    }

    return searchResults.slice(0, limit);
  }

  /**
   * Extract a snippet from content around matched terms
   */
  private extractSnippet(content: string, matchedTerms: string[]): string {
    const lines = content.split('\n');
    const matchedLines: Array<{ lineNum: number; line: string }> = [];

    // Find lines containing matched terms
    for (let i = 0; i < lines.length; i++) {
      const lineLower = lines[i].toLowerCase();
      if (matchedTerms.some((term) => lineLower.includes(term))) {
        matchedLines.push({ lineNum: i + 1, line: lines[i].trim() });
        if (matchedLines.length >= 3) break; // Max 3 lines
      }
    }

    if (matchedLines.length === 0) {
      // Return first few lines if no matches found
      return lines
        .slice(0, 3)
        .map((line) => line.trim())
        .join('\n');
    }

    return matchedLines.map((m) => `${m.lineNum}: ${m.line}`).join('\n');
  }

  /**
   * Get file content
   */
  async getFileContent(filePath: string): Promise<string | null> {
    const file = await this.storage.getFile(filePath);
    return file?.content || null;
  }

  /**
   * Get total indexed files count
   */
  async getIndexedCount(): Promise<number> {
    return this.storage.count();
  }
}

export interface SearchResult {
  path: string;
  score: number;
  matchedTerms: string[];
  language?: string;
  size: number;
  snippet?: string;
}
