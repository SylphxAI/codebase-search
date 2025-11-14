/**
 * In-memory storage for codebase index
 */

export interface CodebaseFile {
  path: string;
  content: string;
  size: number;
  mtime: number | Date;
  language?: string;
  hash: string;
}

export interface Storage {
  storeFile(file: CodebaseFile): Promise<void>;
  storeFiles?(files: CodebaseFile[]): Promise<void>; // Optional batch operation
  getFile(path: string): Promise<CodebaseFile | null>;
  getAllFiles(): Promise<CodebaseFile[]>;
  deleteFile(path: string): Promise<void>;
  clear(): Promise<void>;
  count(): Promise<number>;
  exists(path: string): Promise<boolean>;
}

export class MemoryStorage implements Storage {
  private files: Map<string, CodebaseFile> = new Map();

  /**
   * Store a file
   */
  async storeFile(file: CodebaseFile): Promise<void> {
    this.files.set(file.path, file);
  }

  /**
   * Store multiple files (batch operation)
   */
  async storeFiles(files: CodebaseFile[]): Promise<void> {
    for (const file of files) {
      this.files.set(file.path, file);
    }
  }

  /**
   * Get a file by path
   */
  async getFile(path: string): Promise<CodebaseFile | null> {
    return this.files.get(path) || null;
  }

  /**
   * Get all files
   */
  async getAllFiles(): Promise<CodebaseFile[]> {
    return Array.from(this.files.values());
  }

  /**
   * Delete a file
   */
  async deleteFile(path: string): Promise<void> {
    this.files.delete(path);
  }

  /**
   * Clear all files
   */
  async clear(): Promise<void> {
    this.files.clear();
  }

  /**
   * Get file count
   */
  async count(): Promise<number> {
    return this.files.size;
  }

  /**
   * Check if file exists
   */
  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }
}
