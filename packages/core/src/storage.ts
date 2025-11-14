/**
 * In-memory storage for codebase index
 */

export interface CodebaseFile {
  path: string;
  content: string;
  size: number;
  mtime: number;
  language?: string;
  hash: string;
}

export class MemoryStorage {
  private files: Map<string, CodebaseFile> = new Map();

  /**
   * Store a file
   */
  async storeFile(file: CodebaseFile): Promise<void> {
    this.files.set(file.path, file);
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
