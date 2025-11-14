# @sylphx/codebase-search

Core library for intelligent codebase search using TF-IDF.

## Installation

```bash
npm install @sylphx/codebase-search
```

## Usage

### Basic Example

```typescript
import { CodebaseIndexer } from '@sylphx/codebase-search';

// Create indexer
const indexer = new CodebaseIndexer({
  codebaseRoot: '/path/to/project',
  maxFileSize: 1048576, // 1MB
});

// Index the codebase
await indexer.index({
  onProgress: (current, total, file) => {
    console.log(`Indexing ${current}/${total}: ${file}`);
  },
});

// Search
const results = await indexer.search('user authentication', {
  limit: 10,
  includeContent: true,
  fileExtensions: ['.ts', '.tsx'],
  pathFilter: 'src',
  excludePaths: ['node_modules', 'dist'],
});

// Display results
for (const result of results) {
  console.log(`${result.path} (score: ${result.score})`);
  if (result.snippet) {
    console.log(result.snippet);
  }
}
```

### Using Individual Components

```typescript
import { buildSearchIndex, searchDocuments } from '@sylphx/codebase-search';

// Prepare documents
const documents = [
  { uri: 'file://src/auth.ts', content: 'export function authenticate() { ... }' },
  { uri: 'file://src/user.ts', content: 'export class User { ... }' },
];

// Build search index
const index = buildSearchIndex(documents);

// Search
const results = searchDocuments('authenticate user', index, {
  limit: 5,
  minScore: 0.1,
});
```

### File Scanning

```typescript
import { scanFiles, loadGitignore } from '@sylphx/codebase-search';

// Load .gitignore patterns
const ignoreFilter = loadGitignore('/path/to/project');

// Scan files
const files = scanFiles('/path/to/project', {
  ignoreFilter,
  codebaseRoot: '/path/to/project',
  maxFileSize: 1048576,
});

console.log(`Found ${files.length} files`);
```

## API

### `CodebaseIndexer`

Main class for codebase indexing and search.

#### Constructor Options

```typescript
interface IndexerOptions {
  codebaseRoot?: string;      // Default: process.cwd()
  maxFileSize?: number;        // Default: 1048576 (1MB)
  onProgress?: (current: number, total: number, file: string) => void;
}
```

#### Methods

- `async index(options?: IndexerOptions): Promise<void>` - Index the codebase
- `async search(query: string, options?: SearchOptions): Promise<SearchResult[]>` - Search the codebase
- `getStatus(): IndexingStatus` - Get current indexing status
- `async getIndexedCount(): Promise<number>` - Get count of indexed files

#### Search Options

```typescript
interface SearchOptions {
  limit?: number;              // Max results (default: 10)
  includeContent?: boolean;    // Include snippets (default: true)
  fileExtensions?: string[];   // Filter by extensions
  pathFilter?: string;         // Filter by path pattern
  excludePaths?: string[];     // Exclude paths
}
```

#### Search Result

```typescript
interface SearchResult {
  path: string;                // Relative file path
  score: number;               // Relevance score
  matchedTerms: string[];      // Matched search terms
  language?: string;           // Detected language
  size: number;                // File size in bytes
  snippet?: string;            // Code snippet (if includeContent)
}
```

### `buildSearchIndex()`

Build TF-IDF search index from documents.

```typescript
function buildSearchIndex(
  documents: Array<{ uri: string; content: string }>
): SearchIndex
```

### `searchDocuments()`

Search documents using TF-IDF.

```typescript
function searchDocuments(
  query: string,
  index: SearchIndex,
  options?: {
    limit?: number;
    minScore?: number;
  }
): Array<{ uri: string; score: number; matchedTerms: string[] }>
```

### `scanFiles()`

Scan directory for files.

```typescript
function scanFiles(
  dir: string,
  options?: {
    ignoreFilter?: Ignore;
    codebaseRoot?: string;
    maxFileSize?: number;
  }
): ScanResult[]
```

### `loadGitignore()`

Load .gitignore patterns.

```typescript
function loadGitignore(codebaseRoot: string): Ignore
```

## How It Works

1. **File Scanning** - Recursively scans directory respecting .gitignore
2. **Tokenization** - Extracts identifiers (camelCase, snake_case, etc.)
3. **TF-IDF Calculation** - Calculates term frequency and inverse document frequency
4. **Indexing** - Stores document vectors for fast search
5. **Search** - Uses cosine similarity to rank results

### Search Ranking

Results are ranked using:
- **Cosine Similarity** - Angle between query and document vectors
- **Exact Match Boost** - 1.5x for exact term matches
- **Phrase Match Boost** - 2.0x when all query terms found

## Supported File Types

- TypeScript/JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`)
- Python (`.py`)
- Java (`.java`)
- Go (`.go`)
- Rust (`.rs`)
- C/C++ (`.c`, `.cpp`, `.h`, `.hpp`)
- C# (`.cs`)
- Ruby (`.rb`)
- PHP (`.php`)
- Swift (`.swift`)
- Kotlin (`.kt`)
- JSON (`.json`)
- YAML (`.yaml`, `.yml`)
- TOML (`.toml`)
- Markdown (`.md`)
- And more...

## Performance

- **Indexing**: ~1000-2000 files/second
- **Search**: <100ms typical
- **Memory**: ~1-2 MB per 1000 files

## License

MIT
