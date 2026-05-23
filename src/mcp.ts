import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { DsbmobileClient } from './services/dsbmobile.js';
import { registerDocumentsTool } from './tools/documents.js';
import { registerNewsTool } from './tools/news.js';
import { registerSubstitutionsTool } from './tools/substitutions.js';
import { registerTimetablesTool } from './tools/timetables.js';

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

export async function startMcpServer(client: DsbmobileClient): Promise<void> {
  const server = new McpServer({ name: 'dsbmobile', version });

  registerTimetablesTool(server, client);
  registerSubstitutionsTool(server, client);
  registerNewsTool(server, client);
  registerDocumentsTool(server, client);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('DSBmobile MCP server running via stdio');
}
