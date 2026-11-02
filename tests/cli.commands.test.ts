import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import type { DsbmobileConfig } from '../src/services/dsbmobile.js';
import type { SubstitutionPlan } from '../src/types.js';

// Runs src/cli.ts in-process (unlike cli.test.ts, which spawns dist/cli.js) so
// the commands can use a fake client and their coverage is measured.

const mocks = vi.hoisted(() => ({
  config: undefined as DsbmobileConfig | undefined,
  getSubstitutions: vi.fn(),
  getTimetables: vi.fn(),
  getNews: vi.fn(),
  getDocuments: vi.fn(),
  startMcpServer: vi.fn(),
}));

vi.mock('../src/services/dsbmobile.js', () => ({
  DsbmobileClient: class {
    getSubstitutions = mocks.getSubstitutions;
    getTimetables = mocks.getTimetables;
    getNews = mocks.getNews;
    getDocuments = mocks.getDocuments;
    constructor(config: DsbmobileConfig) {
      mocks.config = config;
    }
  },
}));

vi.mock('../src/mcp.js', () => ({ startMcpServer: mocks.startMcpServer }));

class ExitError extends Error {
  constructor(readonly code: number | string | null | undefined) {
    super(`process.exit(${String(code)})`);
  }
}

const originalArgv = process.argv;
const log = vi.spyOn(console, 'log').mockImplementation(vi.fn());
const errorLog = vi.spyOn(console, 'error').mockImplementation(vi.fn());
const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
  throw new ExitError(code);
});

/** Runs the CLI with the given arguments and returns the parsed JSON it printed. */
async function run(...arguments_: string[]): Promise<unknown> {
  process.argv = ['node', 'dsbmobile', ...arguments_];
  vi.resetModules();
  try {
    await import('../src/cli.js');
  } catch (error) {
    if (!(error instanceof ExitError)) {
      throw error;
    }
  }
  const output = log.mock.calls[0]?.[0] as string | undefined;
  return output === undefined ? undefined : JSON.parse(output);
}

function entry(className: string): SubstitutionPlan['entries'][number] {
  return {
    className,
    type: 'Entfall',
    period: '1',
    originalTeacher: '',
    substituteTeacher: '',
    subject: '',
    originalRoom: '',
    substituteRoom: '',
    text: '',
  };
}

const plans: SubstitutionPlan[] = [
  { date: '2026-03-20', lastUpdated: '', entries: [entry('10a'), entry('11B')] },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('DSB_USERNAME', 'user');
  vi.stubEnv('DSB_PASSWORD', 'secret');
  vi.stubEnv('DSB_CLASS', '');
  mocks.config = undefined;
  mocks.getSubstitutions.mockResolvedValue(plans);
});

afterEach(() => {
  process.argv = originalArgv;
  vi.unstubAllEnvs();
});

afterAll(() => {
  vi.restoreAllMocks();
});

describe('CLI commands', () => {
  test('creates the client from the environment variables', async () => {
    mocks.getTimetables.mockResolvedValue([]);
    await run('timetables');
    expect(mocks.config).toEqual({ username: 'user', password: 'secret' });
  });

  test.each([
    ['timetables', mocks.getTimetables],
    ['news', mocks.getNews],
    ['documents', mocks.getDocuments],
  ])('%s prints the result as JSON', async (command, method) => {
    const data = [{ id: command }];
    method.mockResolvedValue(data);
    expect(await run(command)).toEqual(data);
  });

  test('substitutions prints all plans without a filter', async () => {
    expect(await run('substitutions')).toEqual(plans);
  });

  test('substitutions filters by the --class option, ignoring case', async () => {
    vi.stubEnv('DSB_CLASS', '10a');
    const result = (await run('substitutions', '--class', '11b')) as SubstitutionPlan[];
    expect(result[0].entries.map((item) => item.className)).toEqual(['11B']);
  });

  test('substitutions filters by DSB_CLASS when --class is not given', async () => {
    vi.stubEnv('DSB_CLASS', '10A');
    const result = (await run('substitutions')) as SubstitutionPlan[];
    expect(result[0].entries.map((item) => item.className)).toEqual(['10a']);
  });

  test('mcp starts the MCP server with the client', async () => {
    await run('mcp');
    expect(mocks.startMcpServer).toHaveBeenCalledOnce();
    expect(mocks.config).toEqual({ username: 'user', password: 'secret' });
  });
});

describe('CLI errors', () => {
  test('exits 1 and names the missing environment variables', async () => {
    vi.stubEnv('DSB_USERNAME', '');
    vi.stubEnv('DSB_PASSWORD', '');
    await run('news');
    expect(exit).toHaveBeenNthCalledWith(1, 1);
    expect(errorLog.mock.calls[0][0]).toContain(
      'Required environment variables not set: DSB_USERNAME, DSB_PASSWORD',
    );
    expect(mocks.getNews).not.toHaveBeenCalled();
  });

  test.each([
    [
      'an error with prefix',
      new Error('Error: Authentication failed.'),
      'Error: Authentication failed.',
    ],
    ['an error without prefix', new Error('boom'), 'Error: boom'],
    ['a value that is not an error', 'boom', 'Error: boom'],
  ])('prints %s once with the Error prefix and exits 1', async (_name, thrown, expected) => {
    mocks.getNews.mockRejectedValue(thrown);
    await run('news');
    expect(errorLog).toHaveBeenCalledWith(expected);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
