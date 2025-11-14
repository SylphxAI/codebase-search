#!/usr/bin/env node
/**
 * MCP Codebase Search Server
 * MCP server providing intelligent codebase search
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CodebaseIndexer } from '@codebase-search/core';
import { registerCodebaseSearchTool } from './tool.js';

// Logger utility (stderr for MCP)
const Logger = {
  info: (message: string) => console.error(`[INFO] ${message}`),
  success: (message: string) => console.error(`[SUCCESS] ${message}`),
  error: (message: string, error?: unknown) => {
    console.error(`[ERROR] ${message}`);
    if (error) {
      console.error(error);
    }
  },
};

const SERVER_CONFIG = {
  name: '@codebase-search/mcp-server',
  version: '1.0.0',
  description: 'MCP server providing intelligent codebase search using TF-IDF',
};

/**
 * Start the MCP Codebase Search Server
 */
async function main() {
  Logger.info('🚀 Starting MCP Codebase Search Server...');
  Logger.info(`📋 ${SERVER_CONFIG.description}`);

  // Create MCP server
  const server = new McpServer({
    name: SERVER_CONFIG.name,
    version: SERVER_CONFIG.version,
    description: SERVER_CONFIG.description,
  });

  // Parse command line arguments
  const args = process.argv.slice(2);
  const codebaseRoot = args.find((arg) => arg.startsWith('--root='))?.split('=')[1] || process.cwd();
  const maxFileSize = parseInt(args.find((arg) => arg.startsWith('--max-size='))?.split('=')[1] || '1048576'); // 1MB default
  const autoIndex = !args.includes('--no-auto-index');

  Logger.info(`📂 Codebase root: ${codebaseRoot}`);
  Logger.info(`📏 Max file size: ${(maxFileSize / 1024 / 1024).toFixed(2)} MB`);
  Logger.info(`🔄 Auto-index: ${autoIndex ? 'enabled' : 'disabled'}`);

  // Create indexer
  const indexer = new CodebaseIndexer({
    codebaseRoot,
    maxFileSize,
  });

  // Register codebase search tool
  registerCodebaseSearchTool(server, indexer);

  Logger.info('✓ Registered codebase_search tool');

  // Auto-index on startup if enabled
  if (autoIndex) {
    Logger.info('📚 Starting automatic indexing...');
    try {
      await indexer.index({
        onProgress: (current, total, file) => {
          if (current % 100 === 0 || current === total) {
            Logger.info(`Indexing: ${current}/${total} files (${file})`);
          }
        },
      });
      Logger.success(`✓ Indexed ${await indexer.getIndexedCount()} files`);
    } catch (error) {
      Logger.error('Failed to index codebase', error);
      Logger.info('⚠️  Continuing without index (search will fail until indexed)');
    }
  }

  // Connect to stdio transport
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    Logger.success('✓ MCP Server connected and ready');
    Logger.info('💡 Press Ctrl+C to stop the server');
  } catch (error: unknown) {
    Logger.error('Failed to start MCP server', error);
    process.exit(1);
  }
}

// Handle process signals
process.on('SIGINT', () => {
  Logger.info('\n🛑 Shutting down MCP server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  Logger.info('\n🛑 Shutting down MCP server...');
  process.exit(0);
});

// Start the server
if (import.meta.main) {
  main().catch((error) => {
    Logger.error('Fatal error', error);
    process.exit(1);
  });
}

export { registerCodebaseSearchTool };
