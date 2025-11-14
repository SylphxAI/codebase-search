# Codebase Search

Intelligent codebase search using TF-IDF - Core library and MCP server.

## 📦 Packages

This monorepo contains two packages:

### [@codebase-search/core](./packages/core)

Core library for intelligent codebase search. Use this if you want to integrate codebase search directly into your application.

```bash
npm install @codebase-search/core
```

**Features:**
- 🔍 TF-IDF based search ranking
- 📁 .gitignore support
- 🚀 Fast in-memory indexing
- 🎯 Code-aware tokenization
- 💾 Lightweight (only depends on `ignore`)

**Usage:**
```typescript
import { CodebaseIndexer } from '@codebase-search/core';

const indexer = new CodebaseIndexer({
  codebaseRoot: '/path/to/project',
  maxFileSize: 1048576, // 1MB
});

// Index the codebase
await indexer.index();

// Search
const results = await indexer.search('user authentication', {
  limit: 10,
  includeContent: true,
});
```

### [@codebase-search/mcp-server](./packages/mcp-server)

MCP (Model Context Protocol) server for codebase search. Use this to add codebase search to Claude Desktop or other MCP clients.

```bash
npm install -g @codebase-search/mcp-server
```

**Claude Desktop Configuration:**
```json
{
  "mcpServers": {
    "codebase-search": {
      "command": "codebase-search-mcp",
      "args": [
        "--root=/path/to/your/project",
        "--max-size=1048576"
      ]
    }
  }
}
```

## 🚀 Quick Start

### For Library Users

```bash
# Install core library
npm install @codebase-search/core

# Or use in your project
import { CodebaseIndexer } from '@codebase-search/core';
```

### For MCP Users

```bash
# Install MCP server globally
npm install -g @codebase-search/mcp-server

# Configure in Claude Desktop (see above)
```

### For Development

```bash
# Clone the repo
git clone https://github.com/SylphxAI/codebase-search.git
cd codebase-search

# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun run test
```

## 🏗️ Architecture

```
codebase-search/
├── packages/
│   ├── core/              # Core search library
│   │   ├── src/
│   │   │   ├── index.ts      # Public API exports
│   │   │   ├── indexer.ts    # Codebase indexing
│   │   │   ├── tfidf.ts      # TF-IDF implementation
│   │   │   ├── storage.ts    # In-memory storage
│   │   │   └── utils.ts      # File scanning utilities
│   │   └── package.json
│   │
│   └── mcp-server/        # MCP server
│       ├── src/
│       │   ├── index.ts      # Server entry point
│       │   └── tool.ts       # MCP tool registration
│       └── package.json
│
├── docs/                  # Documentation
├── package.json           # Workspace root
└── turbo.json            # Turbo configuration
```

## 📚 Documentation

- [Core API Documentation](./packages/core/README.md)
- [MCP Server Documentation](./packages/mcp-server/README.md)
- [How It Works](./docs/how-it-works.md) (Coming soon)
- [Contributing Guide](./CONTRIBUTING.md) (Coming soon)

## 🔧 Development

### Prerequisites

- Node.js >= 18
- Bun (recommended) or npm/yarn/pnpm

### Commands

```bash
# Install dependencies
bun install

# Build all packages
bun run build

# Run tests
bun run test

# Type check
bun run type-check

# Clean build artifacts
bun run clean
```

### Workspace Structure

This is a monorepo managed with:
- **Workspaces** - For package management
- **Turbo** - For build orchestration

Packages are linked using `workspace:*` protocol, allowing local development without publishing.

## 🤝 Use Cases

### As a Library

```typescript
// Direct integration in your app
import { CodebaseIndexer, searchDocuments } from '@codebase-search/core';

const indexer = new CodebaseIndexer({ codebaseRoot: './src' });
await indexer.index();

const results = await indexer.search('authentication logic');
// Returns ranked results with snippets
```

### As an MCP Server

Configure in Claude Desktop to enable codebase search directly in your AI conversations.

### Custom Integrations

```typescript
// Use individual components
import { buildSearchIndex, searchDocuments } from '@codebase-search/core';

const index = buildSearchIndex(documents);
const results = searchDocuments('query', index);
```

## 📊 Performance

- **Indexing Speed**: ~1000-2000 files/second
- **Search Speed**: <100ms for most queries
- **Memory Usage**: ~1-2 MB per 1000 files

## 🔒 Privacy

- All indexing and search happens locally
- No data is sent to external servers
- Respects .gitignore patterns

## 📝 License

MIT

## 🙏 Credits

Built by [SylphxAI](https://github.com/SylphxAI)

## 📮 Support

- GitHub Issues: https://github.com/SylphxAI/codebase-search/issues
- Discussions: https://github.com/SylphxAI/codebase-search/discussions

---

Made with ❤️ for developers who love fast, local code search.
