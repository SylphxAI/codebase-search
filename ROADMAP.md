# Roadmap

## Current Status (v1.0.0)

### ✅ Completed
- TF-IDF based text search
- .gitignore support
- In-memory indexing
- Code-aware tokenization (camelCase, snake_case, etc.)
- MCP server integration
- Basic file scanning and filtering
- **File watching with auto-index updates (v1.1.0)**
- **Incremental index updates on file changes (v1.1.0)**
- Incremental TypeScript builds
- Monorepo structure with Turbo

### ❌ Critical Missing Features
1. **Tests** - No test coverage
2. **Persistent index** - Currently in-memory only (re-indexes on restart)
3. **Symbol search** - No AST-based search
4. **CI/CD pipeline**
5. **Code quality tools** (linting, formatting)

---

## Phase 1: Foundation (v1.1.0) - Q1 2025 ✅ (Partially Complete)

**Goal:** Establish production-ready quality and reliability

### Testing Infrastructure ✅ (Mostly Complete)
- [x] Unit tests for core TF-IDF algorithms (52 tests, 82.67% coverage)
- [x] Storage tests (100% coverage)
- [x] TF-IDF tests (100% coverage)
- [x] Utils tests (48% coverage - file scanning needs more tests)
- [x] Test coverage reporting (Vitest + v8)
- [ ] Integration tests for indexing pipeline
- [ ] MCP server tests
- [ ] Benchmark suite

### Code Quality ✅ (Complete)
- [x] ESLint configuration (TypeScript support)
- [x] Prettier formatting (configured)
- [ ] Pre-commit hooks (husky - next)
- [ ] Type coverage improvements (`strict: true`)

### CI/CD ✅ (Complete)
- [x] GitHub Actions workflow
  - [x] Run tests on PR
  - [x] Type checking
  - [x] Build validation
  - [x] Coverage upload (Codecov)
- [ ] Automated releases
- [ ] npm publishing workflow

### Documentation ✅ (Complete)
- [x] API documentation (inline JSDoc)
- [x] Architecture documentation
- [x] Roadmap
- [x] Feature analysis
- [ ] Contributing guide
- [ ] Performance benchmarks

---

## Phase 2: Persistence & Performance (v1.2.0) - Q2 2025

**Goal:** Make search fast and persistent across restarts

### Persistent Index
- [ ] SQLite-based index storage
- [ ] Serialize/deserialize TF-IDF vectors
- [ ] Index versioning and migration
- [ ] Configurable storage backends (memory/disk)

### Incremental Indexing ✅ (Partially Complete in v1.1.0)
- [x] File change detection (mtime, hash)
- [x] Partial re-indexing for changed files
- [x] Watch mode for automatic re-indexing
- [x] Debounced indexing on file changes
- [ ] Optimize full index rebuild (currently rebuilds entire index on each change)
- [ ] Smart index updates (only update affected documents)

### Performance Optimizations
- [ ] Worker threads for large codebases
- [ ] Streaming file processing
- [ ] Index compression
- [ ] Query result caching
- [ ] Benchmark improvements (target: <50ms search time)

---

## Phase 3: AST & Symbol Search (v2.0.0) - Q2-Q3 2025

**Goal:** Enable semantic, structure-aware code search

### AST Parsing
- [ ] TypeScript/JavaScript AST parsing (using `@typescript/vfs` or similar)
- [ ] Python AST parsing
- [ ] Go AST parsing
- [ ] Rust AST parsing (via tree-sitter)
- [ ] Language-agnostic tree-sitter integration

### Symbol Extraction
- [ ] Extract all symbols (functions, classes, interfaces, types, variables)
- [ ] Symbol metadata (location, kind, scope, visibility)
- [ ] Import/export relationships
- [ ] Symbol signatures

### Symbol Search
- [ ] Search by symbol name
- [ ] Search by symbol kind (e.g., "find all functions")
- [ ] Search by symbol signature
- [ ] Go-to-definition support
- [ ] Find all references
- [ ] Find implementations

### Structural Search
- [ ] Query language for structural patterns
- [ ] AST-based pattern matching
- [ ] Type-aware search (e.g., "functions returning Promise<User>")
- [ ] Scope-aware search

---

## Phase 4: Advanced Features (v2.1.0+) - Q3-Q4 2025

**Goal:** Add powerful semantic and cross-reference capabilities

### Cross-Reference Analysis
- [ ] Call graph generation
- [ ] Import dependency graph
- [ ] Find unused exports
- [ ] Dead code detection
- [ ] Circular dependency detection

### Semantic Search
- [ ] Embeddings-based semantic search (optional, using local models)
- [ ] Similar code fragment search
- [ ] Code clone detection
- [ ] Search by documentation/comments

### Language Server Protocol (LSP)
- [ ] LSP server implementation
- [ ] Editor integrations (VSCode, Neovim, etc.)
- [ ] Real-time symbol indexing
- [ ] Code navigation

### Enhanced MCP Server
- [ ] Real-time index updates
- [ ] Streaming search results
- [ ] Symbol search via MCP tool
- [ ] Multi-repo indexing
- [ ] Index statistics and diagnostics

---

## Phase 5: Ecosystem & Integrations (v3.0.0) - 2026

**Goal:** Build a rich ecosystem of integrations

### Platform Integrations
- [ ] GitHub API integration (search across repos)
- [ ] GitLab integration
- [ ] Bitbucket integration
- [ ] Self-hosted Git support

### AI Integrations
- [ ] RAG (Retrieval-Augmented Generation) support
- [ ] Code summarization
- [ ] Intelligent query expansion
- [ ] Natural language to structural query

### CLI Tool
- [ ] Standalone CLI for terminal use
- [ ] Interactive search UI (TUI)
- [ ] Query result formatting (JSON, table, etc.)
- [ ] Configuration file support

### Plugins & Extensions
- [ ] Plugin API for custom analyzers
- [ ] Custom tokenizers
- [ ] Custom ranking algorithms
- [ ] Language support plugins

---

## Long-Term Vision

### Multi-Language Support
Expand AST support to cover:
- Java, C#, C++
- Ruby, PHP
- Swift, Kotlin
- Elixir, Clojure
- And more...

### Distributed Indexing
- Index sharding for massive codebases
- Distributed search across multiple machines
- Cloud-native deployment

### Advanced Analytics
- Code complexity metrics
- Code quality scoring
- Technical debt analysis
- Change impact analysis

---

## Contributing

We welcome contributions! Check our [Contributing Guide](./CONTRIBUTING.md) for details.

**Priority Areas for Contributors:**
1. **Tests** - Help us reach 80%+ coverage
2. **AST Parsers** - Add support for more languages
3. **Documentation** - Improve examples and guides
4. **Performance** - Optimize indexing and search

---

## Release Schedule

- **v1.1.0** - Q1 2025 (Testing & Quality)
- **v1.2.0** - Q2 2025 (Persistence & Performance)
- **v2.0.0** - Q3 2025 (AST & Symbol Search)
- **v2.1.0** - Q4 2025 (Advanced Features)
- **v3.0.0** - 2026 (Ecosystem)

**Note:** Dates are estimates and subject to change based on community feedback and priorities.
