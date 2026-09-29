import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CHARACTER_LIMIT } from '../constants.js';
import type { DsbmobileClient } from '../services/dsbmobile.js';
import type { NewsEntry } from '../types.js';

/**
 * Registers the get_news tool with the MCP server.
 *
 * This tool retrieves all news and announcements from DSBmobile.
 */
export function registerNewsTool(server: McpServer, client: DsbmobileClient): void {
  server.registerTool(
    'get_news',
    {
      title: 'Get DSBmobile News and Announcements',
      description: `Retrieves all news and announcements posted on DSBmobile.

Returns a list of news items, each with:
- id: Unique identifier for the news item
- title: News headline or title
- detail: News content, URL to more details, or plain text announcement
- date: Publication date in DD.MM.YYYY HH:MM format
- tags: Associated tags or categories (may be empty)

Use this tool when:
- A user asks about school announcements or news
- A user wants to know about upcoming school events
- A user asks "What's new at school?"

Returns "No news available" if no news items are currently published.

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
        const entries = await client.getNews();

        if (entries.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'Aktuell sind keine Neuigkeiten auf DSBmobile verfügbar.',
              },
            ],
          };
        }

        const output = {
          count: entries.length,
          news: entries,
        };

        const text = formatNews(entries);
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
 * Formats news entries as human-readable markdown.
 */
function formatNews(entries: NewsEntry[]): string {
  const lines: string[] = [`# DSBmobile News (${entries.length} items)`, ''];

  for (const entry of entries) {
    lines.push(`## ${entry.title}`, `- **ID**: ${entry.id}`, `- **Date**: ${entry.date}`);
    if (entry.tags) {
      lines.push(`- **Tags**: ${entry.tags}`);
    }
    if (entry.detail) {
      lines.push(`- **Content**: ${entry.detail}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
