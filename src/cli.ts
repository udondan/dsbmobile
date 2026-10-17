#!/usr/bin/env node
/**
 * DSBmobile CLI
 *
 * Usage:
 *   dsbmobile mcp                           Start the MCP server (stdio)
 *   dsbmobile substitutions [--class name]  Fetch substitution plans as JSON
 *   dsbmobile timetables                    Fetch timetable entries as JSON
 *   dsbmobile news                          Fetch news entries as JSON
 *   dsbmobile documents                     Fetch documents as JSON
 *
 * Environment variables:
 *   DSB_USERNAME   DSBmobile username/ID (required)
 *   DSB_PASSWORD   DSBmobile password (required)
 *   DSB_CLASS      Default class filter for substitutions (optional)
 */

import { createRequire } from 'node:module';
import { Command } from 'commander';
import { DsbmobileClient } from './services/dsbmobile.js';
import { startMcpServer } from './mcp.js';
import { ENV_CLASS, ENV_PASSWORD, ENV_USERNAME } from './constants.js';

const { version } = createRequire(import.meta.url)('../package.json') as { version: string };

function loadClient(): DsbmobileClient {
  const username = process.env[ENV_USERNAME];
  const password = process.env[ENV_PASSWORD];

  const missing = [!username && ENV_USERNAME, !password && ENV_PASSWORD].filter(
    (v): v is string => typeof v === 'string',
  );

  if (missing.length > 0) {
    console.error(
      `Error: Required environment variables not set: ${missing.join(', ')}\n` +
        `  export ${ENV_USERNAME}=your_username\n` +
        `  export ${ENV_PASSWORD}=your_password`,
    );
    process.exit(1);
  }

  return new DsbmobileClient({ username: username!, password: password! });
}

function print(data: unknown): void {
  console.log(JSON.stringify(data, undefined, 2));
}

const program = new Command();

program
  .name('dsbmobile')
  .description('CLI and MCP server for DSBmobile — access German school substitution plans')
  .version(version);

program
  .command('mcp')
  .description('Start the DSBmobile MCP server over stdio')
  .action(async () => {
    const client = loadClient();
    await startMcpServer(client);
  });

program
  .command('substitutions')
  .description('Fetch substitution plans (Vertretungspläne) as JSON')
  .option('--class <name>', `Filter by class name (e.g. 05b). Defaults to ${ENV_CLASS} env var.`)
  .action(async (options: { class?: string }) => {
    const client = loadClient();
    const plans = await client.getSubstitutions();
    const filter = (options.class ?? process.env[ENV_CLASS])?.toLowerCase();
    const result = filter
      ? plans.map((plan) => ({
          ...plan,
          entries: plan.entries.filter((entry) => entry.className.toLowerCase().includes(filter)),
        }))
      : plans;
    print(result);
  });

program
  .command('timetables')
  .description('Fetch timetable entries (plan URLs) as JSON')
  .action(async () => {
    const client = loadClient();
    print(await client.getTimetables());
  });

program
  .command('news')
  .description('Fetch news and announcements as JSON')
  .action(async () => {
    const client = loadClient();
    print(await client.getNews());
  });

program
  .command('documents')
  .description('Fetch available documents as JSON')
  .action(async () => {
    const client = loadClient();
    print(await client.getDocuments());
  });

try {
  await program.parseAsync(process.argv);
} catch (error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message.startsWith('Error:') ? message : `Error: ${message}`);
  process.exit(1);
}
