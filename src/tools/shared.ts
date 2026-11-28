import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import { CHARACTER_LIMIT } from '../constants.js';

/** All tools only read from DSBmobile. */
export const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
};

/** A plain text response. */
export function textResult(text: string): CallToolResult {
  return { content: [{ type: 'text', text }] };
}

/** An error response with the message of the error. */
export function errorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
  return { content: [{ type: 'text', text: message }], isError: true };
}

/** A text response with structured content. The text is cut at CHARACTER_LIMIT. */
export function structuredResult(
  text: string,
  structuredContent: Record<string, unknown>,
  truncationNote: string,
): CallToolResult {
  const finalText =
    text.length > CHARACTER_LIMIT ? `${text.slice(0, CHARACTER_LIMIT)}\n\n${truncationNote}` : text;
  return { content: [{ type: 'text', text: finalText }], structuredContent };
}

interface ListToolOptions<T> {
  name: string;
  title: string;
  description: string;
  /** Loads the entries. */
  fetch: () => Promise<T[]>;
  /** Text when there are no entries. */
  emptyMessage: string;
  /** Property of the structured content that holds the entries. */
  key: string;
  /** Formats the entries as markdown. */
  format: (entries: T[]) => string;
  /** Appended when the text is cut. */
  truncationNote?: string;
}

/**
 * Registers a tool without arguments that returns a list of entries.
 */
export function registerListTool<T>(server: McpServer, options: ListToolOptions<T>): void {
  server.registerTool(
    options.name,
    {
      title: options.title,
      description: options.description,
      inputSchema: z.object({}).strict(),
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async () => {
      try {
        const entries = await options.fetch();
        return entries.length === 0
          ? textResult(options.emptyMessage)
          : structuredResult(
              options.format(entries),
              { count: entries.length, [options.key]: entries },
              options.truncationNote ?? '[Response truncated due to length.]',
            );
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}
