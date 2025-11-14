# 🔮 未來功能分析

## 當前狀態（v0.1.0）

**✅ 已完成：**
- TF-IDF 搜索（關鍵字匹配）
- Vector Search（語義搜索）
- Hybrid Search（加權合併）
- Incremental Updates（增量更新）
- Code Tokenization（StarCoder2）

**核心流程：**
```
用戶查詢 "user authentication"
    ↓
1. TF-IDF: 搜索包含 "user", "authentication" 的文件
2. Vector: 搜索語義相似的文件（可能用 "login", "auth" 等詞）
3. Hybrid: 加權合併兩者結果
    ↓
返回排序結果
```

---

## 🤔 建議的未來功能

### 1. Vector Index 異步持久化 ⚙️

**現況：**
```typescript
// 當前是同步寫入（阻塞）
save() {
  this.index.writeIndexSync(targetPath);  // 阻塞主線程
  fs.writeFileSync(`${targetPath}.metadata.json`, ...);
}
```

**優化：**
```typescript
// 改為異步（不阻塞）
async save() {
  await this.index.writeIndex(targetPath);  // 不阻塞
  await fs.promises.writeFile(`${targetPath}.metadata.json`, ...);
}
```

**好處：**
- ✅ 不阻塞主線程
- ✅ 用戶操作更流暢
- ⚠️ 但實際影響不大（寫入通常只需 10-50ms）

**值得做嗎？** 🟡 **可選** - 影響不大，優先級低

---

### 2. Query Expansion 🔍

**問題：**
```
用戶搜索: "auth"
當前只搜索: "auth"
```

**優化：**
```
用戶搜索: "auth"
自動擴展: ["auth", "authentication", "login", "credential", "signin"]
搜索所有擴展詞 → 合併結果
```

**實現方式：**

#### 方式 A：同義詞詞典（簡單）
```typescript
const synonyms = {
  auth: ['authentication', 'login', 'credential', 'signin'],
  db: ['database', 'storage', 'persistence'],
  api: ['endpoint', 'route', 'handler'],
};

function expandQuery(query: string): string[] {
  const words = query.split(' ');
  const expanded = words.map(word => [word, ...(synonyms[word] || [])]);
  return expanded.flat();
}
```

**優點：** 簡單，快速
**缺點：** 需手動維護詞典

#### 方式 B：Embedding 相似度（智能）
```typescript
async function expandQuery(query: string, provider: EmbeddingProvider) {
  // 1. 生成查詢的 embedding
  const queryEmb = await provider.generateEmbedding(query);

  // 2. 從代碼庫中找相似的詞
  const allTerms = indexer.getAllTerms();  // 從 IDF 中獲取
  const termEmbeddings = await provider.generateEmbeddings(allTerms);

  // 3. 找最相似的詞
  const similarities = termEmbeddings.map((emb, i) => ({
    term: allTerms[i],
    score: cosineSimilarity(queryEmb, emb),
  }));

  // 4. 返回相似度高的詞
  return similarities
    .filter(s => s.score > 0.8)
    .map(s => s.term)
    .slice(0, 5);
}
```

**優點：** 智能，自適應
**缺點：** 需要 API 調用，慢，貴

**好處：**
- ✅ 提升召回率（找到更多相關結果）
- ✅ 處理縮寫和同義詞
- ⚠️ 可能增加噪音（不相關結果）

**值得做嗎？** 🟢 **可選** - 對某些場景有用，但不緊急

---

### 3. Result Reranking 📊

**問題：**
```
當前 Hybrid Search:
1. Vector 搜索 → 得分 A
2. TF-IDF 搜索 → 得分 B
3. 加權合併: score = 0.7*A + 0.3*B
4. 返回結果
```

**優化：**
```
Hybrid + Reranking:
1. Hybrid 搜索 → 獲取 50 個候選
2. 用更強的模型重新排序 → 返回最好的 10 個
```

**實現：**
```typescript
async function rerank(
  query: string,
  candidates: SearchResult[]
): Promise<SearchResult[]> {
  // 使用專門的 reranking 模型
  const reranker = await createReranker({
    model: 'cross-encoder/ms-marco-MiniLM-L-12-v2'
  });

  // 計算每個候選與查詢的相關性
  const scores = await reranker.score(
    query,
    candidates.map(c => c.content)
  );

  // 按新分數排序
  return candidates
    .map((c, i) => ({ ...c, rerankScore: scores[i] }))
    .sort((a, b) => b.rerankScore - a.rerankScore);
}
```

**Reranking 模型：**
- 專門訓練來判斷「查詢-文檔」相關性
- 比簡單的 cosine similarity 更準確
- 但更慢（需要對每個候選都計算）

**好處：**
- ✅ 更準確的排序
- ✅ 結合多個信號
- ⚠️ 更慢（每個查詢需要額外模型調用）
- ⚠️ 需要額外的模型（增加複雜度）

**值得做嗎？** 🟢 **可選** - 高級功能，對大部分用戶不必要

---

### 4. Distributed Search 🌐

**問題：**
```
當前架構：單機
- 所有文件在一個 Vector Index
- 所有查詢在一個進程
```

**限制：**
- 最多處理 ~10 萬文件（受內存限制）
- 單核 CPU 查詢

**優化：分散式架構**
```typescript
class DistributedVectorStorage {
  private shards: VectorStorage[] = [];  // 多個分片

  constructor(numShards: number) {
    // 創建多個 shard（每個 shard 處理部分文件）
    for (let i = 0; i < numShards; i++) {
      this.shards.push(new VectorStorage({ dimensions: 128 }));
    }
  }

  addDocument(doc: VectorDocument) {
    // 根據文件 ID 分配到不同 shard
    const shardId = hash(doc.id) % this.shards.length;
    this.shards[shardId].addDocument(doc);
  }

  async search(queryVector: number[], options) {
    // 並行搜索所有 shard
    const shardResults = await Promise.all(
      this.shards.map(shard => shard.search(queryVector, options))
    );

    // 合併結果
    const merged = mergeAndRerank(shardResults);
    return merged.slice(0, options.k);
  }
}
```

**好處：**
- ✅ 支持百萬級文件
- ✅ 並行搜索（更快）
- ✅ 橫向擴展
- ⚠️ 複雜度大增
- ⚠️ 需要管理多個進程/服務器

**使用場景：**
- 超大代碼庫（>10 萬文件）
- 企業級應用
- 多租戶 SaaS

**值得做嗎？** 🔴 **不建議** - 當前用戶不需要，過度設計

---

## 📊 功能評估總結

| 功能 | 複雜度 | 價值 | 適用場景 | 建議 |
|------|--------|------|----------|------|
| **異步持久化** | 🟢 低 | 🟡 小 | 大文件頻繁保存 | 🟡 可選 |
| **Query Expansion** | 🟡 中 | 🟢 中 | 用戶查詢模糊 | 🟢 值得考慮 |
| **Result Reranking** | 🟡 中 | 🟢 中 | 追求最高準確度 | 🟢 高級功能 |
| **Distributed Search** | 🔴 高 | 🟡 小 | 百萬級文件 | 🔴 不建議 |

---

## 🎯 建議優先級

### ✅ **v0.1.0（已完成）**
- TF-IDF + Vector + Hybrid Search
- Incremental Updates
- Code Tokenization

### 🟡 **v0.2.0（可選優化）**
**如果用戶反饋搜索不夠準確，可以考慮：**
1. Query Expansion（同義詞擴展）- 提升召回率
2. 優化 Hybrid Search 權重調整

**但當前搜索質量已經很好，可能不需要！**

### 🟢 **v0.3.0+（高級功能）**
**只在有明確需求時才做：**
- Result Reranking（追求極致準確度）
- 異步持久化（優化體驗）

### 🔴 **不建議做**
- Distributed Search（過度設計，當前不需要）

---

## 🤔 核心問題：**當前 v0.1.0 夠唔夠用？**

### 當前能力：
```
用戶查詢: "user authentication logic"

TF-IDF 會找到:
✅ 包含 "user", "authentication", "logic" 的文件
✅ 處理 camelCase (getUserAuth, authenticateUser)
✅ 精確匹配

Vector Search 會找到:
✅ 語義相似的文件（即使用不同詞）
✅ 例如：包含 "login", "credential", "access control"

Hybrid 合併:
✅ 平衡精確匹配和語義相似
✅ 提供最相關的結果
```

### 大部分場景下，這已經足夠！

**只有在以下情況才需要優化：**
1. 用戶反饋搜索不準確
2. 需要處理特殊查詢（縮寫、領域專有名詞）
3. 追求極致體驗

---

## 💡 我的建議

### **v0.1.0 發佈後：**

1. **先觀察用戶使用情況**
   - 搜索結果準確嗎？
   - 有沒有常見的失敗案例？
   - 性能夠不夠？

2. **根據反饋決定下一步**
   - 如果搜索質量好 → 不需要優化
   - 如果用戶常搜索不到 → 考慮 Query Expansion
   - 如果排序不準 → 考慮 Reranking

3. **避免過度優化**
   - 當前功能已經很完整
   - 不要為了做而做
   - 保持簡單

### **立即要做的：**
❌ **什麼都不用做！**

v0.1.0 已經完美，可以發佈使用了！ 🎉

---

## 🎊 總結

**你問的那些未來功能：**
- **Vector Index 異步持久化** → 🟡 優化體驗，影響小
- **Query Expansion** → 🟢 提升召回率，看需求
- **Result Reranking** → 🟢 提升準確度，看需求
- **Distributed Search** → 🔴 過度設計，不建議

**建議：**
✅ **v0.1.0 已經完美，先發佈使用**
✅ **根據用戶反饋再決定是否需要這些優化**
✅ **不要過度優化！**

**當前搜索能力：**
- TF-IDF（精確匹配）✅
- Vector Search（語義搜索）✅
- Hybrid（智能合併）✅
- Code Tokenization（StarCoder2）✅

**已經足夠應對絕大部分場景！** 🎉
