/**
 * Tests for LRU Cache implementation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LRUCache, createCacheKey } from './search-cache.js';

describe('LRUCache', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>(3, 1); // 3 entries, 1 minute TTL
  });

  describe('get and set', () => {
    it('should store and retrieve values', () => {
      cache.set('key1', 'value1');
      expect(cache.get('key1')).toBe('value1');
    });

    it('should return undefined for non-existent keys', () => {
      expect(cache.get('nonexistent')).toBeUndefined();
    });

    it('should update existing keys', () => {
      cache.set('key1', 'value1');
      cache.set('key1', 'value2');
      expect(cache.get('key1')).toBe('value2');
    });
  });

  describe('LRU eviction', () => {
    it('should evict least recently used entry when cache is full', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Cache is now full (size 3)
      // key1 is least recently used

      cache.set('key4', 'value4'); // Should evict key1

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBe('value2');
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });

    it('should update LRU order on get', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      // Access key1 to make it most recently used
      cache.get('key1');

      // Now key2 is least recently used
      cache.set('key4', 'value4'); // Should evict key2

      expect(cache.get('key1')).toBe('value1');
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBe('value3');
      expect(cache.get('key4')).toBe('value4');
    });
  });

  describe('TTL expiration', () => {
    it('should expire entries after TTL', async () => {
      vi.useFakeTimers();

      const shortCache = new LRUCache<string>(10, 0.01); // 0.01 minutes = 600ms
      shortCache.set('key1', 'value1');

      expect(shortCache.get('key1')).toBe('value1');

      // Advance time by 1 second (beyond TTL)
      vi.advanceTimersByTime(1000);

      expect(shortCache.get('key1')).toBeUndefined();

      vi.useRealTimers();
    });

    it('should refresh TTL on access', async () => {
      vi.useFakeTimers();

      const shortCache = new LRUCache<string>(10, 0.01); // 0.01 minutes = 600ms
      shortCache.set('key1', 'value1');

      // Advance time by 500ms
      vi.advanceTimersByTime(500);

      // Access entry (should refresh TTL)
      expect(shortCache.get('key1')).toBe('value1');

      // Advance time by another 500ms (total 1000ms, but entry was refreshed at 500ms)
      vi.advanceTimersByTime(500);

      // Entry should still be valid (only 500ms since last access)
      expect(shortCache.get('key1')).toBe('value1');

      vi.useRealTimers();
    });
  });

  describe('stats', () => {
    it('should track hits and misses', () => {
      cache.set('key1', 'value1');

      cache.get('key1'); // hit
      cache.get('key1'); // hit
      cache.get('key2'); // miss
      cache.get('key3'); // miss

      const stats = cache.stats();
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBe(0.5);
    });

    it('should report cache size', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      const stats = cache.stats();
      expect(stats.size).toBe(2);
      expect(stats.maxSize).toBe(3);
    });

    it('should handle hit rate when no accesses', () => {
      const stats = cache.stats();
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('clear', () => {
    it('should remove all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      cache.set('key3', 'value3');

      cache.clear();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
      expect(cache.get('key3')).toBeUndefined();
      expect(cache.stats().size).toBe(0);
    });

    it('should reset stats', () => {
      cache.set('key1', 'value1');
      cache.get('key1'); // hit
      cache.get('key2'); // miss

      cache.clear();

      const stats = cache.stats();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe('invalidate', () => {
    it('should clear all entries', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');

      cache.invalidate();

      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });

  describe('cleanup', () => {
    it('should remove expired entries', async () => {
      vi.useFakeTimers();

      const shortCache = new LRUCache<string>(10, 0.01); // 0.01 minutes = 600ms
      shortCache.set('key1', 'value1');
      shortCache.set('key2', 'value2');

      // Advance time by 1 second
      vi.advanceTimersByTime(1000);

      // Add a new entry (not expired)
      shortCache.set('key3', 'value3');

      // Cleanup expired entries
      shortCache.cleanup();

      // key1 and key2 should be removed, key3 should remain
      expect(shortCache.get('key1')).toBeUndefined();
      expect(shortCache.get('key2')).toBeUndefined();
      expect(shortCache.get('key3')).toBe('value3');

      vi.useRealTimers();
    });
  });
});

describe('createCacheKey', () => {
  it('should create consistent keys for same parameters', () => {
    const key1 = createCacheKey('test query', { limit: 10 });
    const key2 = createCacheKey('test query', { limit: 10 });
    expect(key1).toBe(key2);
  });

  it('should create different keys for different queries', () => {
    const key1 = createCacheKey('query1', { limit: 10 });
    const key2 = createCacheKey('query2', { limit: 10 });
    expect(key1).not.toBe(key2);
  });

  it('should create different keys for different limits', () => {
    const key1 = createCacheKey('test', { limit: 10 });
    const key2 = createCacheKey('test', { limit: 20 });
    expect(key1).not.toBe(key2);
  });

  it('should normalize query case', () => {
    const key1 = createCacheKey('Test Query', {});
    const key2 = createCacheKey('test query', {});
    expect(key1).toBe(key2);
  });

  it('should handle file extensions', () => {
    const key1 = createCacheKey('test', { fileExtensions: ['.ts', '.js'] });
    const key2 = createCacheKey('test', { fileExtensions: ['.js', '.ts'] }); // Different order
    expect(key1).toBe(key2); // Should be same (sorted)
  });

  it('should handle path filter', () => {
    const key1 = createCacheKey('test', { pathFilter: 'src/' });
    const key2 = createCacheKey('test', { pathFilter: 'lib/' });
    expect(key1).not.toBe(key2);
  });

  it('should handle exclude paths', () => {
    const key1 = createCacheKey('test', { excludePaths: ['node_modules', 'dist'] });
    const key2 = createCacheKey('test', { excludePaths: ['dist', 'node_modules'] }); // Different order
    expect(key1).toBe(key2); // Should be same (sorted)
  });

  it('should handle default values', () => {
    const key1 = createCacheKey('test', {});
    const key2 = createCacheKey('test', { limit: 10 });
    expect(key1).toBe(key2); // Default limit is 10
  });
});
