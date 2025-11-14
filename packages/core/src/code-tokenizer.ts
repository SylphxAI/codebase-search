/**
 * Code-Aware Tokenizer using StarCoder2
 *
 * StarCoder2 tokenizer is lightweight (only 4.7MB) and provides
 * world-class code tokenization quality without requiring the full model.
 */

import { AutoTokenizer } from '@huggingface/transformers';

export interface CodeToken {
  readonly text: string;
  readonly id: number;
}

export interface TokenizerOptions {
  readonly modelPath?: string;
  readonly cacheDir?: string;
}

/**
 * StarCoder2 Code Tokenizer
 *
 * Uses StarCoder2's tokenizer (4.7MB) for accurate code tokenization.
 * Does NOT require downloading the full 15B parameter model.
 */
export class CodeTokenizer {
  private tokenizer: any;
  private initialized = false;
  private modelPath: string;

  constructor(options: TokenizerOptions = {}) {
    // Default to StarCoder2 tokenizer (only downloads tokenizer files, not model)
    this.modelPath = options.modelPath || 'bigcode/starcoder2-15b';
  }

  /**
   * Initialize tokenizer (downloads ~4.7MB on first use)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      console.error('[INFO] Loading StarCoder2 tokenizer (4.7MB, one-time download)...');
      const startTime = Date.now();

      this.tokenizer = await AutoTokenizer.from_pretrained(this.modelPath);

      const loadTime = Date.now() - startTime;
      console.error(`[SUCCESS] Tokenizer loaded in ${loadTime}ms`);

      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to load tokenizer: ${error.message}`);
    }
  }

  /**
   * Tokenize code into terms for TF-IDF indexing
   */
  async tokenize(code: string): Promise<string[]> {
    if (!this.initialized) {
      await this.initialize();
    }

    if (!code || code.trim().length === 0) {
      return [];
    }

    try {
      // Encode with StarCoder2
      const encoded = await this.tokenizer(code);
      const inputIds = encoded.input_ids.tolist()[0];

      // Decode each token ID to get the actual tokens
      const tokens: string[] = [];
      for (const id of inputIds) {
        const token = await this.tokenizer.decode([id], {
          skip_special_tokens: true,
        });

        const cleaned = token.trim().toLowerCase();
        if (cleaned.length > 0) {
          tokens.push(cleaned);
        }
      }

      return tokens;
    } catch (error) {
      console.error('[ERROR] Tokenization failed:', error);
      return this.fallbackTokenize(code);
    }
  }

  /**
   * Fallback to simple tokenization if StarCoder2 fails
   */
  private fallbackTokenize(code: string): string[] {
    // Simple regex-based tokenization as fallback
    return code
      .toLowerCase()
      .split(/[\s\W]+/)
      .filter((w) => w.length > 2);
  }

  /**
   * Extract unique terms with frequency counts
   */
  async extractTerms(code: string): Promise<Map<string, number>> {
    const tokens = await this.tokenize(code);
    const termFreq = new Map<string, number>();

    for (const token of tokens) {
      termFreq.set(token, (termFreq.get(token) || 0) + 1);
    }

    return termFreq;
  }

  /**
   * Check if tokenizer is ready
   */
  isReady(): boolean {
    return this.initialized;
  }
}

/**
 * Create and initialize a code tokenizer
 */
export async function createCodeTokenizer(
  options?: TokenizerOptions
): Promise<CodeTokenizer> {
  const tokenizer = new CodeTokenizer(options);
  await tokenizer.initialize();
  return tokenizer;
}

/**
 * Simple code-aware tokenization (lightweight fallback, no dependencies)
 *
 * Handles:
 * - camelCase → ["camel", "case", "camelcase"]
 * - snake_case → ["snake", "case", "snake_case"]
 * - Identifiers
 * - String contents
 *
 * Returns array with duplicates (for frequency counting)
 */
export function simpleCodeTokenize(code: string): string[] {
  const terms: string[] = [];

  // 1. Handle camelCase and PascalCase
  const camelCaseMatches = code.matchAll(/[a-z]+|[A-Z][a-z]+/g);
  for (const match of camelCaseMatches) {
    terms.push(match[0].toLowerCase());
  }

  // 2. Handle snake_case
  const snakeCaseMatches = code.matchAll(/[a-z]+(?:_[a-z]+)*/g);
  for (const match of snakeCaseMatches) {
    const word = match[0];
    terms.push(word.toLowerCase());
    terms.push(...word.split('_'));
  }

  // 3. Extract identifiers
  const identifierMatches = code.matchAll(/\b[a-zA-Z_][a-zA-Z0-9_]*\b/g);
  for (const match of identifierMatches) {
    terms.push(match[0].toLowerCase());
  }

  // 4. Extract string literal contents
  const stringMatches = code.matchAll(/"([^"]*)"|'([^"]*)'/g);
  for (const match of stringMatches) {
    const content = match[1] || match[2];
    if (content) {
      terms.push(...content.toLowerCase().split(/\s+/));
    }
  }

  // Return with duplicates (don't deduplicate here, for frequency counting)
  return terms.filter((t) => t.length > 1);
}

/**
 * Extract terms from code with frequency counts (simple version)
 */
export function simpleExtractTerms(code: string): Map<string, number> {
  const tokens = simpleCodeTokenize(code);
  const termFreq = new Map<string, number>();

  for (const token of tokens) {
    termFreq.set(token, (termFreq.get(token) || 0) + 1);
  }

  return termFreq;
}
