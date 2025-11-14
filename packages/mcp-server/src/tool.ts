/**
 * Codebase search MCP tool
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { CodebaseIndexer } from '@sylphx/codebase-search';

/**
 * Register codebase search tool
 */
export function registerCodebaseSearchTool(server: McpServer, indexer: CodebaseIndexer): void {
  server.registerTool(
    'codebase_search',
    {
      description: `Search project source files, documentation, and code. Use this to find implementations, functions, classes, or any code-related content.

**IMPORTANT: Use this tool PROACTIVELY before starting work, not reactively when stuck.**

This tool searches across all codebase files and returns the most relevant matches with content snippets.

When to use this tool (BEFORE starting work):
- **Before implementation**: Find existing patterns, similar functions, or reusable components
- **Before refactoring**: Understand current implementation and dependencies
- **Before adding features**: Check for existing similar functionality or conflicting code
- **Before debugging**: Search for error messages, function names, or related code
- **Before writing tests**: Find existing test patterns and test utilities

The search includes:
- Source code files (.ts, .js, .tsx, .jsx, etc.)
- Configuration files (.json, .yaml, .toml, etc.)
- Documentation files (.md, .txt, etc.)
- Build and deployment files

**Best Practice**: Search the codebase BEFORE writing new code to avoid duplication and follow existing patterns.`,
      inputSchema: {
        query: z
          .string()
          .describe('Search query - use natural language, function names, or technical terms'),
        limit: z
          .number()
          .default(10)
          .optional()
          .describe('Maximum number of results to return (default: 10)'),
        include_content: z
          .boolean()
          .default(true)
          .optional()
          .describe('Include file content snippets in results (default: true)'),
        file_extensions: z
          .array(z.string())
          .optional()
          .describe('Filter by file extensions (e.g., [".ts", ".tsx", ".js"])'),
        path_filter: z
          .string()
          .optional()
          .describe('Filter by path pattern (e.g., "src/components", "tests", "docs")'),
        exclude_paths: z
          .array(z.string())
          .optional()
          .describe(
            'Exclude paths containing these patterns (e.g., ["node_modules", ".git", "dist"])'
          ),
      } as any,
    },
    // @ts-expect-error - MCP SDK type mismatch with handler signature
    async ({
      query,
      limit = 10,
      include_content = true,
      file_extensions,
      path_filter,
      exclude_paths,
    }) => {
      try {
        // Check indexing status
        const status = indexer.getStatus();

        if (status.isIndexing) {
          const progressBar =
            '█'.repeat(Math.floor(status.progress / 5)) +
            '░'.repeat(20 - Math.floor(status.progress / 5));

          return {
            content: [
              {
                type: 'text',
                text: `⏳ **Codebase Indexing In Progress**\n\nThe codebase is currently being indexed. Please wait...\n\n**Progress:** ${status.progress}%\n\`${progressBar}\`\n\n**Status:**\n- Files indexed: ${status.indexedFiles}/${status.totalFiles}\n${status.currentFile ? `- Current file: \`${status.currentFile}\`` : ''}\n\n💡 **Tip:** Try your search again in a few seconds.`,
              },
            ],
          };
        }

        const indexedCount = await indexer.getIndexedCount();
        if (indexedCount === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `📭 **Codebase Not Indexed**\n\nThe codebase has not been indexed yet. The MCP server should automatically index on startup.\n\n**If this persists:**\n- Restart the MCP server\n- Check the server logs for errors`,
              },
            ],
          };
        }

        // Perform search
        const results = await indexer.search(query, {
          limit,
          includeContent: include_content,
          fileExtensions: file_extensions,
          pathFilter: path_filter,
          excludePaths: exclude_paths,
        });

        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `🔍 **No Results Found**\n\nNo files matched your search query: "${query}"\n\n**Suggestions:**\n- Try different search terms\n- Use more general keywords\n- Check if file filters are too restrictive\n\n**Total files indexed:** ${indexedCount}`,
              },
            ],
          };
        }

        // Format results
        let formattedResults = `# 🔍 Codebase Search Results\n\n**Query:** "${query}"\n**Results:** ${results.length} / ${indexedCount} files\n\n`;

        for (let i = 0; i < results.length; i++) {
          const result = results[i];
          formattedResults += `## ${i + 1}. \`${result.path}\`\n\n`;
          formattedResults += `- **Score:** ${result.score.toFixed(4)}\n`;
          if (result.language) {
            formattedResults += `- **Language:** ${result.language}\n`;
          }
          formattedResults += `- **Size:** ${(result.size / 1024).toFixed(2)} KB\n`;
          formattedResults += `- **Matched Terms:** ${result.matchedTerms.join(', ')}\n`;

          if (result.snippet) {
            formattedResults += `\n**Snippet:**\n\`\`\`\n${result.snippet}\n\`\`\`\n`;
          }

          formattedResults += '\n---\n\n';
        }

        return {
          content: [
            {
              type: 'text',
              text: formattedResults,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `✗ Codebase search error: ${(error as Error).message}`,
            },
          ],
        };
      }
    }
  );
}
