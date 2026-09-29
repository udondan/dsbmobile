import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { CHARACTER_LIMIT, ENV_CLASS } from '../constants.js';
import type { DsbmobileClient } from '../services/dsbmobile.js';
import type { SubstitutionEntry, SubstitutionPlan } from '../types.js';

/**
 * Registers the get_substitutions tool with the MCP server.
 *
 * This tool fetches and parses the actual substitution plan HTML pages,
 * returning structured substitution entries grouped by class.
 */
export function registerSubstitutionsTool(server: McpServer, client: DsbmobileClient): void {
  server.registerTool(
    'get_substitutions',
    {
      title: 'Get DSBmobile Substitution Entries',
      description: `Fetches and parses the actual substitution plan (Vertretungsplan) pages from DSBmobile,
returning structured substitution entries for each class.

Returns a list of substitution plans (one per day), each containing:
- date: ISO date string (e.g., "2026-03-20")
- lastUpdated: When the plan was last updated
- entries: Array of substitution entries, each with:
  - className: The class (e.g., "05b", "Q2_Kra")
  - type: Substitution type (e.g., "Vertretung", "Statt-Vertretung", "Entfall")
  - period: Lesson period(s) (e.g., "3" or "5 - 6")
  - originalTeacher: Abbreviation of the absent teacher
  - substituteTeacher: Abbreviation of the substitute teacher
  - subject: Subject abbreviation (e.g., "SPO", "ETHI", "E")
  - originalRoom: Original room
  - substituteRoom: Substitute room
  - text: Additional notes

Use this tool when:
- A user asks "Do I have any substitutions today?"
- A user wants to know which teacher is substituting for whom
- A user asks "Is lesson X cancelled?"
- A user wants to filter substitutions by class name

This tool downloads and parses all plan pages, which may take a few seconds.
For just the list of plan URLs, use get_timetables instead.

The className parameter is optional. If omitted, the DSB_CLASS environment variable
is used as the default filter. If neither is set, all classes are returned.

Error handling:
- Returns an error message if authentication fails (check DSB_USERNAME and DSB_PASSWORD)
- Returns an error message if the DSBmobile service is unavailable`,
      inputSchema: z.object({
        className: z
          .string()
          .optional()
          .describe(
            `Optional: filter results to a specific class name (e.g. '05b', 'Q2_Kra'). Case-insensitive. Defaults to the DSB_CLASS environment variable if set.`,
          ),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async ({ className }) => {
      try {
        const plans = await client.getSubstitutions();

        // Use the provided className, fall back to DSB_CLASS env var, or show all
        const effectiveClass = className ?? process.env[ENV_CLASS];

        if (plans.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'Aktuell sind keine Vertretungspläne auf DSBmobile verfügbar.',
              },
            ],
          };
        }

        // Apply class filter if provided (explicit param takes priority over env var)
        const filter = effectiveClass?.toLowerCase();
        const filtered = filter
          ? plans.map((plan) => ({
              ...plan,
              entries: plan.entries.filter((entry) =>
                entry.className.toLowerCase().includes(filter),
              ),
            }))
          : plans;

        const totalEntries = filtered.reduce((sum, p) => sum + p.entries.length, 0);

        if (filter && totalEntries === 0) {
          return {
            content: [
              {
                type: 'text',
                text: `Keine Vertretungen für Klasse "${effectiveClass}" gefunden.`,
              },
            ],
          };
        }

        const output = {
          planCount: filtered.length,
          totalEntries,
          plans: filtered,
        };

        const text = formatSubstitutions(filtered, effectiveClass);
        const finalText =
          text.length > CHARACTER_LIMIT
            ? text.slice(0, CHARACTER_LIMIT) +
              '\n\n[Response truncated. Use the className filter to narrow results.]'
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
 * Formats substitution plans as human-readable markdown.
 */
function formatSubstitutions(plans: SubstitutionPlan[], filter?: string): string {
  const lines: string[] = [];
  const totalEntries = plans.reduce((sum, p) => sum + p.entries.length, 0);

  const heading = filter
    ? `# Substitutions for class "${filter}" (${totalEntries} entries)`
    : `# DSBmobile Substitution Plans (${totalEntries} total entries)`;

  lines.push(heading, '');

  for (const plan of plans) {
    if (plan.entries.length === 0) continue;

    lines.push(`## ${plan.date}`, `**Last Updated**: ${plan.lastUpdated}`, '');

    // Group entries by class
    const byClass = new Map<string, SubstitutionEntry[]>();
    for (const entry of plan.entries) {
      const list = byClass.get(entry.className) ?? [];
      list.push(entry);
      byClass.set(entry.className, list);
    }

    for (const [cls, entries] of byClass) {
      lines.push(`### Class ${cls}`);
      for (const substitution of entries) {
        const teacher =
          substitution.originalTeacher && substitution.substituteTeacher
            ? `${substitution.originalTeacher} → ${substitution.substituteTeacher}`
            : substitution.substituteTeacher || substitution.originalTeacher;
        const room =
          substitution.originalRoom && substitution.substituteRoom
            ? `${substitution.originalRoom} → ${substitution.substituteRoom}`
            : substitution.substituteRoom || substitution.originalRoom;

        const parts = [
          `**${substitution.type}**`,
          `Period ${substitution.period}`,
          substitution.subject && `Subject: ${substitution.subject}`,
          teacher && `Teacher: ${teacher}`,
          room && `Room: ${room}`,
          substitution.text && `Note: ${substitution.text}`,
        ].filter(Boolean);

        lines.push(`- ${parts.join(' | ')}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}
