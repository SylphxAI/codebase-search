/**
 * Basic usage example of @sylphx/codebase-search
 * Run with: bun run examples/basic-usage.ts
 */

import { CodebaseIndexer } from '@sylphx/codebase-search';

async function main() {
  console.log('🔍 Codebase Search Example\n');

  // Create indexer for current directory
  const indexer = new CodebaseIndexer({
    codebaseRoot: process.cwd(),
    maxFileSize: 1048576, // 1MB
  });

  console.log('📚 Indexing codebase...');

  // Index with progress callback
  await indexer.index({
    onProgress: (current, total, file) => {
      if (current % 10 === 0 || current === total) {
        console.log(`  ${current}/${total} files indexed`);
      }
    },
  });

  const indexedCount = await indexer.getIndexedCount();
  console.log(`✓ Indexed ${indexedCount} files\n`);

  // Example searches
  const queries = [
    'CodebaseIndexer',
    'search function',
    'TypeScript interface',
  ];

  for (const query of queries) {
    console.log(`\n🔎 Search: "${query}"`);
    console.log('─'.repeat(50));

    const results = await indexer.search(query, {
      limit: 3,
      includeContent: true,
    });

    if (results.length === 0) {
      console.log('  No results found');
      continue;
    }

    for (const result of results) {
      console.log(`\n  📄 ${result.path}`);
      console.log(`     Score: ${result.score.toFixed(4)}`);
      console.log(`     Matched: ${result.matchedTerms.join(', ')}`);

      if (result.snippet) {
        console.log(`\n     Snippet:`);
        const snippetLines = result.snippet.split('\n');
        for (const line of snippetLines.slice(0, 2)) {
          console.log(`       ${line}`);
        }
      }
    }
  }

  console.log('\n\n✨ Done!');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
