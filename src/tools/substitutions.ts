import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { ENV_CLASS } from '../constants.js';
import type { DsbmobileClient } from '../services/dsbmobile.js';
import type { SubstitutionEntry, SubstitutionPlan } from '../types.js';
import { errorResult, READ_ONLY_ANNOTATIONS, structuredResult, textResult } from './shared.js';

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
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ className }) => {
      try {
        const plans = await client.getSubstitutions();

        if (plans.length === 0) {
          return textResult('Aktuell sind keine Vertretungspläne auf DSBmobile verfügbar.');
        }

        // The explicit param takes priority over the DSB_CLASS env var; without both show all
        const effectiveClass = className ?? process.env[ENV_CLASS];
        const filtered = filterByClass(plans, effectiveClass);
        const totalEntries = countEntries(filtered);

        return effectiveClass && totalEntries === 0
          ? textResult(`Keine Vertretungen für Klasse "${effectiveClass}" gefunden.`)
          : structuredResult(
              formatSubstitutions(filtered, effectiveClass),
              { planCount: filtered.length, totalEntries, plans: filtered },
              '[Response truncated. Use the className filter to narrow results.]',
            );
      } catch (error) {
        return errorResult(error);
      }
    },
  );
}

/** Keeps the entries whose class contains the filter (case-insensitive). */
function filterByClass(plans: SubstitutionPlan[], filter?: string): SubstitutionPlan[] {
  if (!filter) return plans;
  const needle = filter.toLowerCase();
  return plans.map((plan) => ({
    ...plan,
    entries: plan.entries.filter((entry) => entry.className.toLowerCase().includes(needle)),
  }));
}

function countEntries(plans: SubstitutionPlan[]): number {
  return plans.reduce((sum, p) => sum + p.entries.length, 0);
}

function groupByClass(entries: SubstitutionEntry[]): Map<string, SubstitutionEntry[]> {
  const byClass = new Map<string, SubstitutionEntry[]>();
  for (const entry of entries) {
    const list = byClass.get(entry.className) ?? [];
    list.push(entry);
    byClass.set(entry.className, list);
  }
  return byClass;
}

/** "original → substitute", or whichever of both is set. */
function formatChange(original: string, substitute: string): string {
  return original && substitute ? `${original} → ${substitute}` : substitute || original;
}

function formatEntry(substitution: SubstitutionEntry): string {
  const teacher = formatChange(substitution.originalTeacher, substitution.substituteTeacher);
  const room = formatChange(substitution.originalRoom, substitution.substituteRoom);
  const parts = [
    `**${substitution.type}**`,
    `Period ${substitution.period}`,
    substitution.subject && `Subject: ${substitution.subject}`,
    teacher && `Teacher: ${teacher}`,
    room && `Room: ${room}`,
    substitution.text && `Note: ${substitution.text}`,
  ].filter(Boolean);
  return `- ${parts.join(' | ')}`;
}

function formatPlan(plan: SubstitutionPlan): string[] {
  const lines = [`## ${plan.date}`, `**Last Updated**: ${plan.lastUpdated}`, ''];
  for (const [cls, entries] of groupByClass(plan.entries)) {
    lines.push(`### Class ${cls}`, ...entries.map((entry) => formatEntry(entry)), '');
  }
  return lines;
}

/**
 * Formats substitution plans as human-readable markdown.
 */
function formatSubstitutions(plans: SubstitutionPlan[], filter?: string): string {
  const totalEntries = countEntries(plans);
  const heading = filter
    ? `# Substitutions for class "${filter}" (${totalEntries} entries)`
    : `# DSBmobile Substitution Plans (${totalEntries} total entries)`;

  const sections = plans
    .filter((plan) => plan.entries.length > 0)
    .flatMap((plan) => formatPlan(plan));
  return [heading, '', ...sections].join('\n');
}
