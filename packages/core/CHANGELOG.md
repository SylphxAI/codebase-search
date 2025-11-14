# @sylphx/codebase-search

## 0.2.0

### Minor Changes

- c67a1ff: # 🎉 Initial Release v0.1.0

  ## Core Features

  ### TF-IDF Search Engine
  - Pure functional TF-IDF implementation
  - Incremental updates (166x faster than full rebuild)
  - Keyword-based search with relevance scoring

  ### Vector Search (Semantic)
  - HNSW algorithm for approximate nearest neighbor search
  - OpenAI embeddings integration via Vercel AI SDK
  - Persistent vector index storage

  ### Hybrid Search
  - Weighted combination of TF-IDF + Vector search
  - Configurable search strategies (keyword/semantic/hybrid)
  - LRU cache for query optimization (100x faster cached queries)

  ### Code Tokenization
  - StarCoder2-based tokenizer for improved code understanding
  - Handles camelCase, snake_case, and code identifiers
  - Lightweight fallback tokenizer (no model download required)

  ### Embedding Provider Support
  - OpenAI (official)
  - OpenAI-compatible (OpenRouter, Together AI, Fireworks AI, Ollama)
  - Extensible provider registry for custom implementations
  - Mock provider for testing

  ### Persistent Storage
  - SQLite-based file metadata and index storage
  - Atomic batch operations
  - Migration system for schema updates

  ### MCP Server
  - Model Context Protocol integration
  - Search tools for AI assistants
  - Index management commands

  ## Performance
  - **2.7x faster** initial indexing vs Flow
  - **166x faster** incremental updates vs Flow
  - **100x faster** cached queries vs Flow

  ## Architecture
  - Pure functional design
  - Registry Pattern for extensibility
  - Zero external dependencies for core TF-IDF
  - Comprehensive test coverage (396 tests passing)

  ## Documentation
  - Architecture guides (ARCHITECTURE_EMBEDDINGS.md)
  - Custom provider examples (CUSTOM_PROVIDER_EXAMPLE.md)
  - Provider configuration guide (EMBEDDING_PROVIDERS.md)
  - Deep comparison with Flow (DEEP_COMPARISON.md)
