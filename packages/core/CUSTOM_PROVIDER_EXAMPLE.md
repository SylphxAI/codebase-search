# 自定義 Embedding Provider 範例

## 基本結構

```typescript
import {
  registerProvider,
  type EmbeddingProvider,
  type EmbeddingConfig,
} from '@sylphx/codebase-search';

// 定義 provider factory
const createMyProvider = (config: EmbeddingConfig): EmbeddingProvider => {
  return {
    name: 'my-provider',
    model: config.model,
    dimensions: config.dimensions,
    generateEmbedding: async (text: string): Promise<number[]> => {
      // 實現單個文本的 embedding 生成
    },
    generateEmbeddings: async (texts: string[]): Promise<number[][]> => {
      // 實現批量文本的 embedding 生成
    },
  };
};

// 註冊 provider
registerProvider('my-provider', createMyProvider);
```

---

## 範例 1: Cohere Provider

```typescript
import {
  registerProvider,
  type EmbeddingProvider,
  type EmbeddingConfig,
} from '@sylphx/codebase-search';

interface CohereEmbedResponse {
  embeddings: number[][];
}

export const createCohereProvider = (config: EmbeddingConfig): EmbeddingProvider => {
  return {
    name: 'cohere',
    model: config.model,
    dimensions: config.dimensions,
    generateEmbedding: async (text: string): Promise<number[]> => {
      const response = await fetch('https://api.cohere.ai/v1/embed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          texts: [text],
        }),
      });

      const data = (await response.json()) as CohereEmbedResponse;
      return data.embeddings[0];
    },
    generateEmbeddings: async (texts: string[]): Promise<number[][]> => {
      const response = await fetch('https://api.cohere.ai/v1/embed', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          texts,
        }),
      });

      const data = (await response.json()) as CohereEmbedResponse;
      return data.embeddings;
    },
  };
};

// 註冊
registerProvider('cohere', createCohereProvider);

// 使用
const provider = createEmbeddingProvider({
  provider: 'cohere' as any,
  model: 'embed-english-v3.0',
  dimensions: 1024,
  apiKey: process.env.COHERE_API_KEY!,
});
```

---

## 範例 2: Voyage AI Provider

```typescript
interface VoyageEmbedResponse {
  data: Array<{
    embedding: number[];
  }>;
}

export const createVoyageProvider = (config: EmbeddingConfig): EmbeddingProvider => {
  return {
    name: 'voyage',
    model: config.model,
    dimensions: config.dimensions,
    generateEmbedding: async (text: string): Promise<number[]> => {
      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          input: text,
        }),
      });

      const data = (await response.json()) as VoyageEmbedResponse;
      return data.data[0].embedding;
    },
    generateEmbeddings: async (texts: string[]): Promise<number[][]> => {
      const response = await fetch('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          input: texts,
        }),
      });

      const data = (await response.json()) as VoyageEmbedResponse;
      return data.data.map((item) => item.embedding);
    },
  };
};

// 註冊
registerProvider('voyage', createVoyageProvider);
```

---

## 範例 3: 本地 HTTP API Provider

```typescript
interface LocalEmbedResponse {
  embedding: number[];
}

interface LocalBatchEmbedResponse {
  embeddings: number[][];
}

export const createLocalTransformerProvider = (
  config: EmbeddingConfig
): EmbeddingProvider => {
  const baseURL = config.baseURL || 'http://localhost:8000';

  return {
    name: 'local-transformer',
    model: config.model,
    dimensions: config.dimensions,
    generateEmbedding: async (text: string): Promise<number[]> => {
      const response = await fetch(`${baseURL}/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });

      const data = (await response.json()) as LocalEmbedResponse;
      return data.embedding;
    },
    generateEmbeddings: async (texts: string[]): Promise<number[][]> => {
      const response = await fetch(`${baseURL}/embed/batch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texts }),
      });

      const data = (await response.json()) as LocalBatchEmbedResponse;
      return data.embeddings;
    },
  };
};

// 註冊
registerProvider('local-transformer', createLocalTransformerProvider);

// 使用
const provider = createEmbeddingProvider({
  provider: 'local-transformer' as any,
  model: 'sentence-transformers/all-MiniLM-L6-v2',
  dimensions: 384,
  baseURL: 'http://localhost:8000',
});
```

---

## 範例 4: 帶錯誤處理的 Provider

```typescript
export const createRobustProvider = (config: EmbeddingConfig): EmbeddingProvider => {
  return {
    name: 'robust-provider',
    model: config.model,
    dimensions: config.dimensions,
    generateEmbedding: async (text: string): Promise<number[]> => {
      try {
        const response = await fetch('https://api.example.com/embed', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ text, model: config.model }),
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.embedding;
      } catch (error) {
        console.error('[ERROR] Embedding generation failed:', error);
        // Fallback to mock embedding
        return Array(config.dimensions).fill(0).map(() => Math.random());
      }
    },
    generateEmbeddings: async (texts: string[]): Promise<number[][]> => {
      // 批量處理，帶重試機制
      const maxRetries = 3;
      let attempt = 0;

      while (attempt < maxRetries) {
        try {
          const response = await fetch('https://api.example.com/embed/batch', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${config.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ texts, model: config.model }),
          });

          if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
          }

          const data = await response.json();
          return data.embeddings;
        } catch (error) {
          attempt++;
          console.error(`[WARN] Attempt ${attempt}/${maxRetries} failed:`, error);

          if (attempt >= maxRetries) {
            // Fallback to individual requests
            console.error('[WARN] Batch request failed, falling back to individual requests');
            return Promise.all(
              texts.map((text) => this.generateEmbedding(text))
            );
          }

          // 指數退避
          await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt)));
        }
      }

      // TypeScript: 這行不會被執行，但需要滿足返回類型
      return [];
    },
  };
};
```

---

## 使用完整範例

```typescript
// 1. 註冊所有自定義 provider
import {
  registerProvider,
  createEmbeddingProvider,
  getRegisteredProviders,
} from '@sylphx/codebase-search';

// 註冊 Cohere
registerProvider('cohere', createCohereProvider);

// 註冊 Voyage
registerProvider('voyage', createVoyageProvider);

// 註冊本地
registerProvider('local-transformer', createLocalTransformerProvider);

// 2. 查看可用 provider
console.log('Available providers:', getRegisteredProviders());
// ['openai', 'openai-compatible', 'mock', 'cohere', 'voyage', 'local-transformer']

// 3. 使用任意 provider
const cohereProvider = createEmbeddingProvider({
  provider: 'cohere' as any,
  model: 'embed-english-v3.0',
  dimensions: 1024,
  apiKey: process.env.COHERE_API_KEY!,
});

const embedding = await cohereProvider.generateEmbedding('test text');
console.log('Embedding:', embedding.length); // 1024

// 4. 在 indexer 中使用
import { CodebaseIndexer } from '@sylphx/codebase-search';

const indexer = new CodebaseIndexer({
  codebaseRoot: '/path/to/project',
  embeddingProvider: cohereProvider,
});

await indexer.index();
```

---

## 測試自定義 Provider

```typescript
import { describe, it, expect, beforeEach } from 'vitest';

describe('Custom Cohere Provider', () => {
  beforeEach(() => {
    // Mock fetch
    global.fetch = vi.fn();
  });

  it('should generate single embedding', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        embeddings: [[0.1, 0.2, 0.3]],
      }),
    });

    registerProvider('cohere', createCohereProvider);

    const provider = createEmbeddingProvider({
      provider: 'cohere' as any,
      model: 'embed-english-v3.0',
      dimensions: 3,
      apiKey: 'test-key',
    });

    const embedding = await provider.generateEmbedding('test');

    expect(embedding).toEqual([0.1, 0.2, 0.3]);
    expect(global.fetch).toHaveBeenCalledWith(
      'https://api.cohere.ai/v1/embed',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      })
    );
  });

  it('should generate batch embeddings', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        embeddings: [
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ],
      }),
    });

    const provider = createEmbeddingProvider({
      provider: 'cohere' as any,
      model: 'embed-english-v3.0',
      dimensions: 3,
      apiKey: 'test-key',
    });

    const embeddings = await provider.generateEmbeddings(['test1', 'test2']);

    expect(embeddings).toHaveLength(2);
    expect(embeddings[0]).toEqual([0.1, 0.2, 0.3]);
    expect(embeddings[1]).toEqual([0.4, 0.5, 0.6]);
  });
});
```

---

## TypeScript 類型擴展

如果要讓 TypeScript 識別自定義 provider，可以使用模塊擴展：

```typescript
// types/embeddings.d.ts
import '@sylphx/codebase-search';

declare module '@sylphx/codebase-search' {
  interface EmbeddingConfig {
    provider: 'openai' | 'openai-compatible' | 'mock' | 'cohere' | 'voyage' | 'local-transformer';
  }
}
```

這樣就不需要 `as any` 了：

```typescript
const provider = createEmbeddingProvider({
  provider: 'cohere', // ✅ TypeScript 認識
  model: 'embed-english-v3.0',
  dimensions: 1024,
  apiKey: process.env.COHERE_API_KEY!,
});
```
