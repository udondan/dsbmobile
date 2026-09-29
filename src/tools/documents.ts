import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CHARACTER_LIMIT } from '../constants.js';
import type { DsbmobileClient } from '../services/dsbmobile.js';
import type { DocumentEntry } from '../types.js';

/**
 * Registers the get_documents tool with the MCP server.
 *
 * This tool retrieves all documents and files available on DSBmobile.
 */
export function registerDocumentsTool(server: McpServer, client: DsbmobileClient): void {
  server.registerTool(
    'get_documents',
    {
      title: 'Get DSBmobile Documents',
      description: `Retrieves all documents and files available on DSBmobile.

Returns a list of document entries, each with:
- id: Unique identifier for the document
- title: Document name or title
- url: Download URL for the document (typically a PDF or image)
- date: Upload date in DD.MM.YYYY HH:MM format

Use this tool when:
- A user asks about school documents or files
- A user wants to download a specific document
- A user asks "Are there any documents on DSBmobile?"

Returns "No documents available" if no documents are currently published.

Error handling:
- Returns an error message if authentication fails (check DSB_USERNAME and DSB_PASSWORD)
- Returns an error message if the DSBmobile service is unavailable`,
      inputSchema: z.object({}).strict(),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async () => {
      try {
        const entries = await client.getDocuments();

        if (entries.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'Aktuell sind keine Dokumente auf DSBmobile verfügbar.',
              },
            ],
          };
        }

        const output = {
          count: entries.length,
          documents: entries,
        };

        const text = formatDocuments(entries);
        const finalText =
          text.length > CHARACTER_LIMIT
            ? text.slice(0, CHARACTER_LIMIT) + '\n\n[Response truncated due to length.]'
            : text;

        return {
          content: [{ type: 'text', text: finalText }],
          structuredContent: output,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
        return {
          content: [{ type: 'text', text: message }],
          isError: true,
        };
      }
    },
  );
}

/**
 * Formats document entries as human-readable markdown.
 */
function formatDocuments(entries: DocumentEntry[]): string {
  const lines: string[] = [`# DSBmobile Documents (${entries.length} available)`, ''];

  for (const entry of entries) {
    lines.push(
      `## ${entry.title}`,
      `- **ID**: ${entry.id}`,
      `- **Date**: ${entry.date}`,
      `- **Download URL**: ${entry.url}`,
      '',
    );
  }

  return lines.join('\n');
}
