import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DsbmobileClient } from '../services/dsbmobile.js';
import type { TimetableEntry } from '../types.js';
import { registerListTool } from './shared.js';

/**
 * Registers the get_timetables tool with the MCP server.
 *
 * This tool retrieves all available substitution plan (Vertretungsplan) entries
 * from DSBmobile, including URLs to the HTML plan pages.
 */
export function registerTimetablesTool(server: McpServer, client: DsbmobileClient): void {
  registerListTool(server, {
    name: 'get_timetables',
    title: 'Get DSBmobile Substitution Plans',
    description: `Retrieves all available substitution plan (Vertretungsplan) entries from DSBmobile.

Returns a list of substitution plan entries, each with:
- id: Unique identifier for the plan entry
- title: Plan name (e.g., "Vertretungen-heute" for today's substitutions)
- date: Last updated timestamp in DD.MM.YYYY HH:MM format
- url: URL to the HTML page containing the actual substitution plan table
- previewUrl: URL to a preview image of the plan (optional)

The substitution plan HTML pages contain the detailed schedule showing which
classes have substitutions, which teachers are replaced, which rooms are used, etc.
The HTML format varies by school, so the URL is returned for further processing.

Use this tool when:
- A user asks "Do I have any substitutions today?"
- A user wants to check the school's substitution schedule
- A user asks about teacher absences or room changes

Returns "No substitution plans available" if no plans are currently published.

Error handling:
- Returns an error message if authentication fails (check DSB_USERNAME and DSB_PASSWORD)
- Returns an error message if the DSBmobile service is unavailable`,
    fetch: () => client.getTimetables(),
    emptyMessage: 'Aktuell sind keine Vertretungspläne auf DSBmobile verfügbar.',
    key: 'timetables',
    format: formatTimetables,
    truncationNote: '[Response truncated. Use the plan URLs to access the full content.]',
  });
}

/**
 * Formats timetable entries as human-readable markdown.
 */
function formatTimetables(entries: TimetableEntry[]): string {
  const lines: string[] = [`# DSBmobile Substitution Plans (${entries.length} available)`, ''];

  for (const entry of entries) {
    lines.push(
      `## ${entry.title}`,
      `- **ID**: ${entry.id}`,
      `- **Last Updated**: ${entry.date}`,
      `- **Plan URL**: ${entry.url}`,
    );
    if (entry.previewUrl) {
      lines.push(`- **Preview**: ${entry.previewUrl}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
