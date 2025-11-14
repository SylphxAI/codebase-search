# Embeddings 架構設計

## 🎯 設計原則

### 1. Modularity（模塊化）
- ✅ 每個 provider 獨立
- ✅ 新增 provider 不需要修改核心代碼
- ✅ 使用 Registry Pattern

### 2. Open-Closed Principle
- ✅ 對擴展開放（可以添加新 provider）
- ✅ 對修改關閉（不需要改現有代碼）

### 3. Pure Functional
- ✅ 純函數設計
- ✅ 不可變數據結構
- ✅ 易於測試

---

## 🏗️ 架構對比

### ❌ 舊設計（Switch Case）

```typescript
export const createEmbeddingProvider = (config: EmbeddingConfig): EmbeddingProvider => {
  switch (config.provider) {
    case 'openai':
      return createOpenAIProvider(config);
    case 'openai-compatible':
      return createOpenAIProvider(config);
    case 'mock':
      return createMockProvider(config.dimensions);
    default:
      return createMockProvider(config.dimensions);
  }
};
```

**問題：**
1. 每次添加新 provider 都要修改這個函數
2. 違反 Open-Closed Principle
3. 測試需要 mock 整個 switch case
4. 不支持動態註冊 provider

### ✅ 新設計（Registry Pattern）

```typescript
// Provider Registry
const providerRegistry = new Map<string, ProviderFactory>();

// Register function
export const registerProvider = (name: string, factory: ProviderFactory): void => {
  providerRegistry.set(name, factory);
};

// Built-in providers
registerProvider('openai', createOpenAIProvider);
registerProvider('openai-compatible', createOpenAIProvider);
registerProvider('mock', createMockProvider);

// Factory function
export const createEmbeddingProvider = (config: EmbeddingConfig): EmbeddingProvider => {
  const factory = providerRegistry.get(config.provider);
  if (!factory) {
    return providerRegistry.get('mock')!(config);
  }
  return factory(config);
};
```

**優勢：**
1. ✅ 添加新 provider 只需調用 `registerProvider()`
2. ✅ 符合 Open-Closed Principle
3. ✅ 易於測試（可以 mock registry）
4. ✅ 支持動態註冊（runtime）
5. ✅ 可以查看所有已註冊的 provider

---

## 🔧 使用方式

### 1. 使用內建 Provider

```typescript
import { createEmbeddingProvider } from '@sylphx/codebase-search';

// OpenAI
const provider = createEmbeddingProvider({
  provider: 'openai',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  apiKey: process.env.OPENAI_API_KEY,
});

// OpenAI-compatible
const provider = createEmbeddingProvider({
  provider: 'openai-compatible',
  model: 'text-embedding-3-small',
  dimensions: 1536,
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1',
});
```

### 2. 添加自定義 Provider

```typescript
import { registerProvider, type EmbeddingProvider, type EmbeddingConfig } from '@sylphx/codebase-search';

// 定義 Cohere provider
const createCohereProvider = (config: EmbeddingConfig): EmbeddingProvider => {
  return {
    name: 'cohere',
    model: config.model,
    dimensions: config.dimensions,
    generateEmbedding: async (text: string) => {
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
      const data = await response.json();
      return data.embeddings[0];
    },
    generateEmbeddings: async (texts: string[]) => {
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
      const data = await response.json();
      return data.embeddings;
    },
  };
};

// 註冊 Cohere provider
registerProvider('cohere', createCohereProvider);

// 使用 Cohere
const cohereProvider = createEmbeddingProvider({
  provider: 'cohere' as any, // TypeScript: 需要 type assertion
  model: 'embed-english-v3.0',
  dimensions: 1024,
  apiKey: process.env.COHERE_API_KEY,
});
```

### 3. 查看已註冊的 Provider

```typescript
import { getRegisteredProviders } from '@sylphx/codebase-search';

const providers = getRegisteredProviders();
console.log('Available providers:', providers);
// Output: ['openai', 'openai-compatible', 'mock', 'cohere']
```

---

## 📦 Provider Interface

每個 provider 必須實現 `EmbeddingProvider` 接口：

```typescript
export interface EmbeddingProvider {
  readonly name: string;                                       // Provider 名稱
  readonly model: string;                                      // 模型名稱
  readonly dimensions: number;                                 // Embedding 維度
  readonly generateEmbedding: (text: string) => Promise<number[]>;        // 單個文本
  readonly generateEmbeddings: (texts: string[]) => Promise<number[][]>;  // 批量文本
}
```

---

## 🧪 測試策略

### 1. 測試 Registry

```typescript
import { registerProvider, getRegisteredProviders, createEmbeddingProvider } from './embeddings.js';

describe('Provider Registry', () => {
  it('should register and retrieve provider', () => {
    const mockFactory = (config) => ({ name: 'test', ...config });
    registerProvider('test', mockFactory);

    const providers = getRegisteredProviders();
    expect(providers).toContain('test');
  });

  it('should create provider from registry', () => {
    const provider = createEmbeddingProvider({
      provider: 'test',
      model: 'test-model',
      dimensions: 128,
    });

    expect(provider.name).toBe('test');
  });
});
```

### 2. 測試自定義 Provider

```typescript
describe('Custom Provider', () => {
  it('should work with custom Cohere provider', async () => {
    registerProvider('cohere', createCohereProvider);

    const provider = createEmbeddingProvider({
      provider: 'cohere',
      model: 'embed-english-v3.0',
      dimensions: 1024,
      apiKey: 'test-key',
    });

    // Mock fetch
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ embeddings: [[0.1, 0.2, ...]] }),
    });

    const embedding = await provider.generateEmbedding('test');
    expect(embedding).toHaveLength(1024);
  });
});
```

---

## 🎨 設計模式

### 1. Registry Pattern

**用途：** 管理多個實現（providers）

**優點：**
- 動態註冊
- 易於擴展
- 解耦

### 2. Factory Pattern

**用途：** 創建 provider 實例

**優點：**
- 封裝創建邏輯
- 統一接口
- 易於測試

### 3. Strategy Pattern

**用途：** 不同 provider 實現相同接口

**優點：**
- 可互換
- 易於添加新實現
- 運行時切換

---

## 🔄 擴展性

### 添加新 Provider 的步驟

1. **實現 EmbeddingProvider 接口**
   ```typescript
   const createMyProvider = (config: EmbeddingConfig): EmbeddingProvider => {
     return {
       name: 'my-provider',
       model: config.model,
       dimensions: config.dimensions,
       generateEmbedding: async (text) => { /* 實現 */ },
       generateEmbeddings: async (texts) => { /* 實現 */ },
     };
   };
   ```

2. **註冊 Provider**
   ```typescript
   registerProvider('my-provider', createMyProvider);
   ```

3. **使用 Provider**
   ```typescript
   const provider = createEmbeddingProvider({
     provider: 'my-provider' as any,
     model: 'my-model',
     dimensions: 512,
     apiKey: 'my-key',
   });
   ```

**完成！不需要修改任何核心代碼！**

---

## 📊 對比表

| 特性 | Switch Case | Registry Pattern |
|------|-------------|------------------|
| **擴展性** | ❌ 需要修改代碼 | ✅ 只需註冊 |
| **Open-Closed** | ❌ 違反 | ✅ 遵守 |
| **測試** | ⚠️ 需要 mock switch | ✅ 獨立測試 |
| **動態註冊** | ❌ 不支持 | ✅ 支持 |
| **查看 Provider** | ❌ 不支持 | ✅ 支持 |
| **代碼複雜度** | 🟡 中等 | 🟢 低 |

---

## 🎯 總結

**Registry Pattern 的優勢：**

1. ✅ **模塊化** - 每個 provider 獨立
2. ✅ **可擴展** - 添加新 provider 不需要修改核心代碼
3. ✅ **可測試** - 易於單元測試
4. ✅ **靈活性** - 支持動態註冊
5. ✅ **可維護** - 代碼更清晰

**這是比 Switch Case 更好的設計！** 🎉
