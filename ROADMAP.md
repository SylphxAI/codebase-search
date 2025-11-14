# Codebase Search Roadmap

## ✅ Completed Features (v1.0)

### Core Search (Q1 2025)
- [x] TF-IDF based search ranking
- [x] Code-aware tokenization (identifiers, keywords)
- [x] .gitignore support
- [x] Language detection
- [x] Comprehensive test suite (150+ tests)
- [x] CI/CD pipeline with GitHub Actions

### File Watching (Q1 2025)
- [x] Real-time file monitoring with chokidar
- [x] Debounced updates (500ms)
- [x] Automatic index updates on file add/change/delete
- [x] Graceful handling of file operations

### Persistent Storage (Q1 2025)
- [x] SQLite database with Drizzle ORM
- [x] Store file metadata and content
- [x] Store TF-IDF vectors per document
- [x] Store global IDF scores
- [x] Load existing index on startup
- [x] WAL mode for better concurrency
- [x] Database migrations

### MCP Integration (Q1 2025)
- [x] MCP server implementation
- [x] Claude Desktop integration
- [x] Auto-indexing on startup
- [x] Watch mode enabled by default

---

## 🚧 In Progress

### AST Analysis & Symbol Search (Q2 2025)
See "Planned Features" section below for details.

---

## ✅ Recently Completed (Q1 2025)

### Performance Optimizations
- [x] **Hash-based Change Detection** - Skip unchanged files during re-indexing
- [x] **Incremental TF-IDF Updates** - Smart update strategy (only update affected terms/documents)
- [x] **Query Result Caching** - LRU cache with TTL for faster repeated searches
- [x] **Batch Database Operations** - Transaction-based bulk inserts for 10x faster indexing
- [x] **Smart Cache Validation** - Auto-detect when >20% files change, trigger full rebuild

### Semantic Search Foundation
- [x] **Embeddings Interface** - Pure functional API using Vercel AI SDK
- [x] **OpenAI Integration** - Support for text-embedding-3-small/large and ada-002
- [x] **Mock Provider** - Deterministic embeddings for testing
- [x] **Cosine Similarity** - Vector comparison utilities
- [x] **Text Chunking** - Split large texts with overlap for better embeddings

---

## 🎯 Planned Features

### AST Analysis & Symbol Search (Q2 2025)
**Priority: High**

Implement Abstract Syntax Tree (AST) analysis for precise symbol-level search:

- [ ] **AST Parser Integration**
  - TypeScript/JavaScript (using @typescript-eslint/parser or swc)
  - Python (using tree-sitter-python)
  - Go (using tree-sitter-go)
  - Rust (using tree-sitter-rust)
  - Java (using tree-sitter-java)

- [ ] **Symbol Extraction**
  - Function/method definitions
  - Class/interface definitions
  - Variable/constant declarations
  - Type definitions
  - Import/export statements
  - Comments and documentation

- [ ] **Symbol Search**
  - Search by symbol type (function, class, variable, etc.)
  - Find all references to a symbol
  - Find all implementations of an interface
  - Find all callers of a function
  - Search within specific scopes (file, module, package)

- [ ] **Symbol Metadata Storage**
  - New database table for symbols
  - Symbol name, type, location (file, line, column)
  - Scope information (parent symbol, visibility)
  - Signature information (parameters, return type)
  - Documentation/comments

- [ ] **Enhanced Search API**
  ```typescript
  // Symbol-specific search
  await indexer.searchSymbols({
    name: 'getUserData',
    type: 'function',
    scope: 'src/api',
  });

  // Find references
  await indexer.findReferences({
    symbol: 'UserService',
    type: 'class',
  });

  // Find implementations
  await indexer.findImplementations('IUserRepository');
  ```

**Benefits:**
- Precise symbol-level search vs. text-based search
- Understand code structure and relationships
- Better code navigation and refactoring support
- Language-aware search (respects semantics)
- Foundation for code intelligence features

**Technical Approach:**
- Use tree-sitter for universal AST parsing (supports 40+ languages)
- Incremental parsing for fast updates
- Store symbol locations and metadata in SQLite
- Index symbols alongside TF-IDF vectors
- Hybrid search: combine TF-IDF and symbol search for best results

---

### Smart Incremental Indexing (Q2 2025)
**Priority: Medium**

- [ ] **Hash-based Change Detection**
  - Compare file hashes to detect changes
  - Skip unchanged files on re-index
  - Only rebuild affected TF-IDF vectors

- [ ] **Partial Index Updates**
  - Update only changed documents
  - Recalculate IDF scores incrementally
  - Maintain index consistency

- [ ] **Background Indexing**
  - Queue-based indexing for large codebases
  - Progress reporting
  - Cancellation support

**Benefits:**
- Faster re-indexing (only changed files)
- Lower resource usage
- Better user experience for large codebases

---

### Advanced Search Features (Q2-Q3 2025)
**Priority: Medium**

- [ ] **Fuzzy Search**
  - Levenshtein distance for typo tolerance
  - Phonetic matching
  - Configurable similarity threshold

- [ ] **Regular Expression Search**
  - Regex pattern matching
  - Syntax highlighting in results
  - Performance optimizations

- [ ] **Multi-language Support**
  - Language-specific tokenization
  - Language-specific stop words
  - Polyglot codebase support

- [ ] **Search Filters**
  - Filter by language
  - Filter by file path pattern
  - Filter by date range
  - Filter by file size

- [ ] **Search Ranking Improvements**
  - BM25 algorithm (alternative to TF-IDF)
  - Learning to rank (ML-based ranking)
  - User feedback integration

---

### Code Intelligence (Q3 2025)
**Priority: Low**

Building on AST analysis:

- [ ] **Code Navigation**
  - Go to definition
  - Go to implementation
  - Go to type definition
  - Find all references

- [ ] **Code Completion**
  - Context-aware suggestions
  - Import suggestions
  - Symbol suggestions

- [ ] **Refactoring Support**
  - Rename symbol across codebase
  - Extract function/method
  - Move symbol to different file

- [ ] **Code Quality**
  - Dead code detection
  - Unused imports detection
  - Circular dependency detection

---

### Enterprise Features (Q3-Q4 2025)
**Priority: Low**

- [ ] **Multi-repository Support**
  - Index multiple repositories
  - Cross-repository search
  - Repository management UI

- [ ] **Team Features**
  - Shared index across team
  - Collaborative annotations
  - Code ownership tracking

- [ ] **Advanced Security**
  - Encrypted database
  - Access control
  - Audit logging

- [ ] **Analytics**
  - Search query analytics
  - Usage statistics
  - Performance metrics

---

### Documentation & Ecosystem (Ongoing)

- [ ] **Documentation**
  - API reference
  - Architecture guide
  - Performance tuning guide
  - Best practices

- [ ] **Integrations**
  - VS Code extension
  - JetBrains plugin
  - Vim plugin
  - Emacs package

- [ ] **Developer Experience**
  - CLI tool for testing
  - Web UI for visualization
  - Debug mode with detailed logs
  - Performance profiling tools

---

## 📝 Research & Exploration

### Future Possibilities

- **Semantic Search**
  - Vector embeddings for code semantics
  - AI-powered code understanding
  - Natural language queries

- **Code Graph Analysis**
  - Dependency graph
  - Call graph
  - Data flow analysis
  - Control flow analysis

- **Language Models Integration**
  - Code summarization
  - Code explanation
  - Code generation suggestions

- **Real-time Collaboration**
  - Live index updates across team
  - Shared search history
  - Collaborative annotations

---

## 🤝 Contributing

We welcome contributions! See areas where you can help:

1. **AST Analysis** - Help implement tree-sitter integration
2. **Performance** - Optimize indexing and search algorithms
3. **Language Support** - Add support for more languages
4. **Documentation** - Improve docs and examples
5. **Testing** - Add more test coverage

---

## 📅 Release Schedule

- **v1.0** (Q1 2025) - Core features + persistent storage ✅
- **v1.1** (Q2 2025) - AST analysis + symbol search
- **v1.2** (Q2 2025) - Smart incremental indexing
- **v2.0** (Q3 2025) - Advanced search + code intelligence
- **v2.1** (Q4 2025) - Enterprise features

---

## 💬 Feedback

We'd love to hear your thoughts! Please:
- Open an issue for feature requests
- Join discussions for roadmap input
- Share your use cases and pain points

---

**Last Updated**: 2025-01-15
