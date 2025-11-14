# @codebase-search/mcp-server

MCP server for codebase search - Model Context Protocol integration.

## Installation

### Global Installation (Recommended)

```bash
npm install -g @codebase-search/mcp-server
```

### Local Installation

```bash
npm install @codebase-search/mcp-server
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

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

### Command Line Options

- `--root=<path>` - Codebase root directory (default: current directory)
- `--max-size=<bytes>` - Maximum file size to index (default: 1048576 = 1MB)
- `--no-auto-index` - Disable automatic indexing on startup

## Usage

### In Claude Desktop

Once configured, use the `codebase_search` tool in your conversations:

```
Search the codebase for user authentication logic
```

Claude will use the tool with parameters:
```json
{
  "query": "user authentication",
  "limit": 10,
  "include_content": true
}
```

### Command Line

```bash
# Start with default settings (indexes current directory)
codebase-search-mcp

# Index specific directory
codebase-search-mcp --root=/path/to/project

# Custom max file size (2MB)
codebase-search-mcp --root=/path/to/project --max-size=2097152

# Start without auto-indexing
codebase-search-mcp --no-auto-index
```

## MCP Tool: `codebase_search`

### Description

Search project source files, documentation, and code. Returns ranked results with code snippets.

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | Yes | - | Search query (natural language or technical terms) |
| `limit` | number | No | 10 | Maximum number of results |
| `include_content` | boolean | No | true | Include code snippets |
| `file_extensions` | string[] | No | - | Filter by extensions (e.g., `[".ts", ".tsx"]`) |
| `path_filter` | string | No | - | Filter by path (e.g., `"src/components"`) |
| `exclude_paths` | string[] | No | - | Exclude paths (e.g., `["node_modules", "dist"]`) |

### Example Requests

**Basic Search:**
```json
{
  "query": "user authentication"
}
```

**Filtered Search:**
```json
{
  "query": "React components",
  "limit": 5,
  "file_extensions": [".tsx", ".jsx"],
  "path_filter": "src/components",
  "exclude_paths": ["tests", "__tests__"]
}
```

### Response Format

```markdown
# 🔍 Codebase Search Results

**Query:** "user authentication"
**Results:** 3 / 1234 files

## 1. `src/auth/login.ts`

- **Score:** 0.8765
- **Language:** TypeScript
- **Size:** 12.34 KB
- **Matched Terms:** user, authentication, login

**Snippet:**
```
15: export async function authenticateUser(credentials: UserCredentials) {
16:   const user = await findUserByEmail(credentials.email);
17:   return verifyPassword(user, credentials.password);
```

---
```

## Best Practices

### Proactive Search

Use codebase search **before** writing code:
- Find existing patterns and implementations
- Check for similar functionality
- Discover reusable components
- Understand current architecture

### Effective Queries

**Good:**
- "user authentication login"
- "React form validation"
- "database connection pool"

**Less Effective:**
- "code" (too generic)
- "function" (too common)
- Very long sentences

### File Filters

Use filters to narrow results:
```json
{
  "query": "component",
  "file_extensions": [".tsx", ".jsx"],
  "path_filter": "src/components",
  "exclude_paths": ["node_modules", "dist", "build"]
}
```

## How It Works

1. **Startup**: Server indexes codebase automatically (unless `--no-auto-index`)
2. **Indexing**: Scans files, respects .gitignore, builds TF-IDF index
3. **Search**: Receives query via MCP, searches index, returns ranked results
4. **Results**: Formatted markdown with scores, snippets, and metadata

## Supported Files

All text-based source files:
- Source code (`.ts`, `.js`, `.py`, `.java`, etc.)
- Config files (`.json`, `.yaml`, `.toml`)
- Documentation (`.md`, `.txt`)
- Scripts (`.sh`, `.bash`)

Binary files and files larger than `--max-size` are automatically skipped.

## Performance

- **Startup Time**: ~1-5 seconds for typical projects
- **Search Time**: <100ms for most queries
- **Memory Usage**: ~1-2 MB per 1000 files

## Troubleshooting

### "Codebase Not Indexed"

The server hasn't finished indexing yet. Wait a few seconds and try again.

### "Indexing In Progress"

The server is still indexing. You'll see progress (e.g., "50% complete").

### No Results

Try:
- More general search terms
- Remove filters
- Check if files exist in the codebase

### Server Not Starting

Check:
- Command is correct in config
- Path to codebase exists
- No permission issues

## Development

```bash
# Clone repo
git clone https://github.com/SylphxAI/codebase-search.git
cd codebase-search

# Install dependencies
bun install

# Build
bun run build

# Run locally
cd packages/mcp-server
bun run dev
```

## License

MIT
