/**
 * Code Tokenizer Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { CodeTokenizer, simpleCodeTokenize, simpleExtractTerms } from './code-tokenizer.js';

describe('simpleCodeTokenize', () => {
  it('should handle camelCase', () => {
    const tokens = simpleCodeTokenize('getUserData');

    expect(tokens).toContain('get');
    expect(tokens).toContain('user');
    expect(tokens).toContain('data');
    expect(tokens).toContain('getuserdata');
  });

  it('should handle PascalCase', () => {
    const tokens = simpleCodeTokenize('UserService');

    expect(tokens).toContain('user');
    expect(tokens).toContain('service');
    expect(tokens).toContain('userservice');
  });

  it('should handle snake_case', () => {
    const tokens = simpleCodeTokenize('is_authenticated');

    expect(tokens).toContain('is');
    expect(tokens).toContain('authenticated');
    expect(tokens).toContain('is_authenticated');
  });

  it('should extract identifiers', () => {
    const tokens = simpleCodeTokenize('function authenticate(user, password) {}');

    expect(tokens).toContain('function');
    expect(tokens).toContain('authenticate');
    expect(tokens).toContain('user');
    expect(tokens).toContain('password');
  });

  it('should extract string contents', () => {
    const tokens = simpleCodeTokenize('const msg = "user authentication failed"');

    expect(tokens).toContain('user');
    expect(tokens).toContain('authentication');
    expect(tokens).toContain('failed');
  });

  it('should handle complex code', () => {
    const code = `
      class UserAuthService {
        async authenticateUser(userId: string) {
          const user = await this.findUser(userId);
          return user.isAuthenticated;
        }
      }
    `;

    const tokens = simpleCodeTokenize(code);

    expect(tokens).toContain('user');
    expect(tokens).toContain('auth');
    expect(tokens).toContain('service');
    expect(tokens).toContain('authenticate');
    expect(tokens).toContain('userid');
    expect(tokens).toContain('find');
  });
});

describe('simpleExtractTerms', () => {
  it('should count term frequencies', () => {
    // Use actual code with identifiers
    const code = 'const user = getUser(); if (user) return user;';
    const terms = simpleExtractTerms(code);

    // 'user' appears 3 times as identifier
    expect(terms.get('user')).toBeGreaterThanOrEqual(3);
  });

  it('should handle code with duplicates', () => {
    const code = `
      function getUserData(userId) {
        const user = findUser(userId);
        return user;
      }
    `;

    const terms = simpleExtractTerms(code);

    expect(terms.get('user')).toBeGreaterThan(1); // appears multiple times
  });
});

describe('CodeTokenizer (StarCoder2)', () => {
  let tokenizer: CodeTokenizer;

  // Skip if running in CI without model cache
  const shouldSkip = process.env.CI === 'true' && !process.env.HF_HOME;

  beforeAll(async () => {
    if (shouldSkip) return;

    tokenizer = new CodeTokenizer();
    // Initialize will download 4.7MB on first run
    await tokenizer.initialize();
  }, 30000); // 30s timeout for download

  it.skipIf(shouldSkip)('should initialize successfully', () => {
    expect(tokenizer.isReady()).toBe(true);
  });

  it.skipIf(shouldSkip)('should tokenize simple code', async () => {
    const tokens = await tokenizer.tokenize('getUserData(userId)');

    expect(tokens.length).toBeGreaterThan(0);
    // StarCoder2 should understand code structure
    expect(tokens.some((t) => t.includes('get') || t.includes('user'))).toBe(true);
  });

  it.skipIf(shouldSkip)('should tokenize complex code', async () => {
    const code = `
      async function authenticateUser(username: string, password: string) {
        const user = await findUserByUsername(username);
        if (!user) throw new Error('User not found');
        return await verifyPassword(user, password);
      }
    `;

    const tokens = await tokenizer.tokenize(code);

    expect(tokens.length).toBeGreaterThan(10);
    // Should extract meaningful tokens
    expect(tokens.some((t) => t.includes('authenticate'))).toBe(true);
    expect(tokens.some((t) => t.includes('user'))).toBe(true);
    expect(tokens.some((t) => t.includes('password'))).toBe(true);
  });

  it.skipIf(shouldSkip)('should extract terms with frequencies', async () => {
    const code = 'user user authenticate user';
    const terms = await tokenizer.extractTerms(code);

    expect(terms.size).toBeGreaterThan(0);
    // Should count frequencies
    const userFreq = terms.get('user');
    expect(userFreq).toBeGreaterThanOrEqual(1);
  });

  it.skipIf(shouldSkip)('should handle empty input', async () => {
    const tokens = await tokenizer.tokenize('');
    expect(tokens).toHaveLength(0);
  });

  it.skipIf(shouldSkip)('should handle whitespace', async () => {
    const tokens = await tokenizer.tokenize('   \n\t  ');
    expect(tokens).toHaveLength(0);
  });

  it('should fallback on error', async () => {
    // Test fallback without initialization
    const uninitializedTokenizer = new CodeTokenizer();

    // Mock tokenizer to throw error
    (uninitializedTokenizer as any).initialized = true;
    (uninitializedTokenizer as any).tokenizer = {
      encode: () => {
        throw new Error('Mock error');
      },
    };

    const tokens = await uninitializedTokenizer.tokenize('getUserData');

    // Should use fallback tokenization
    expect(tokens.length).toBeGreaterThan(0);
    expect(tokens).toContain('getuserdata');
  });
});

describe('performance comparison', () => {
  it('simple tokenizer should be fast', () => {
    const code = 'function getUserData(userId) { return user; }';

    const start = Date.now();
    for (let i = 0; i < 1000; i++) {
      simpleCodeTokenize(code);
    }
    const duration = Date.now() - start;

    // Should process 1000 iterations quickly
    expect(duration).toBeLessThan(100); // <100ms for 1000 iterations
  });
});
