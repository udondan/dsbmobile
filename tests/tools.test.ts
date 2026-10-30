import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DsbmobileClient } from '../src/services/dsbmobile.js';
import { CHARACTER_LIMIT, ENV_CLASS } from '../src/constants.js';
import { registerDocumentsTool } from '../src/tools/documents.js';
import { registerNewsTool } from '../src/tools/news.js';
import { registerSubstitutionsTool } from '../src/tools/substitutions.js';
import { registerTimetablesTool } from '../src/tools/timetables.js';
import type { DocumentEntry, NewsEntry, SubstitutionPlan, TimetableEntry } from '../src/types.js';

// --- Types ---

interface ToolResult {
  text: string;
  structuredContent: Record<string, unknown>;
  isError: boolean | undefined;
}

// --- Helpers ---

function makeMockClient(overrides: Partial<DsbmobileClient> = {}): DsbmobileClient {
  return {
    getTimetables: vi.fn(() => Promise.resolve<TimetableEntry[]>([])),
    getNews: vi.fn(() => Promise.resolve<NewsEntry[]>([])),
    getDocuments: vi.fn(() => Promise.resolve<DocumentEntry[]>([])),
    getSubstitutions: vi.fn(() => Promise.resolve<SubstitutionPlan[]>([])),
    ...overrides,
  } as unknown as DsbmobileClient;
}

type RegisterFunction = (server: McpServer, client: DsbmobileClient) => void;
type ToolHandler = (arguments_: Record<string, unknown>) => Promise<unknown>;

interface FakeServer {
  registerTool: (name: string, config: unknown, function_: ToolHandler) => void;
}

async function callTool(
  register: RegisterFunction,
  client: DsbmobileClient,
  arguments_: Record<string, unknown> = {},
): Promise<ToolResult> {
  let handler: ToolHandler | undefined;
  const fakeServer: FakeServer = {
    registerTool: (_name, _config, function_) => {
      handler = function_;
    },
  };
  register(fakeServer as unknown as McpServer, client);
  const result = handler!(arguments_) as Promise<{
    content: { text: string }[];
    structuredContent?: Record<string, unknown>;
    isError?: boolean;
  }>;
  const resolved = await result;
  return {
    text: resolved.content[0].text,
    structuredContent: resolved.structuredContent ?? {},
    isError: resolved.isError,
  };
}

// --- Shared fixture ---

function makePlan(entries: SubstitutionPlan['entries']): SubstitutionPlan {
  return {
    date: '2026-03-20',
    lastUpdated: '20.03.2026 10:23',
    entries,
  };
}

const entryA: SubstitutionPlan['entries'][number] = {
  className: '10a',
  type: 'Vertretung',
  period: '3',
  originalTeacher: 'Aaa',
  substituteTeacher: 'Bbb',
  subject: 'SPO',
  originalRoom: 'SPH1',
  substituteRoom: 'A103',
  text: '',
};

const entryB: SubstitutionPlan['entries'][number] = {
  className: '11a',
  type: 'Entfall',
  period: '5',
  originalTeacher: 'Ccc',
  substituteTeacher: '',
  subject: 'DE',
  originalRoom: 'A201',
  substituteRoom: '',
  text: '',
};

// --- Timetables tool ---

describe('get_timetables tool', () => {
  test('returns message when no timetables available', async () => {
    const client = makeMockClient();
    const result = await callTool(registerTimetablesTool, client);
    expect(result.text).toContain('keine');
  });

  test('returns formatted timetable list', async () => {
    const entries: TimetableEntry[] = [
      {
        id: 'abc',
        title: 'V-Homepage heute',
        date: '20.03.2026 10:23',
        url: 'https://example.com/plan.htm',
      },
    ];
    const client = makeMockClient({ getTimetables: vi.fn(() => Promise.resolve(entries)) });
    const result = await callTool(registerTimetablesTool, client);
    expect(result.text).toContain('V-Homepage heute');
    expect(result.text).toContain('https://example.com/plan.htm');
    expect(result.structuredContent.count).toBe(1);
  });

  test('returns error text on failure', async () => {
    const client = makeMockClient({
      getTimetables: vi.fn(() => Promise.reject(new Error('Error: Auth failed'))),
    });
    const result = await callTool(registerTimetablesTool, client);
    expect(result.isError).toBe(true);
    expect(result.text).toContain('Auth failed');
  });
});

// --- Substitutions tool ---

describe('get_substitutions tool', () => {
  beforeEach(() => {
    delete process.env[ENV_CLASS];
  });

  test('returns message when no plans available', async () => {
    const client = makeMockClient();
    const result = await callTool(registerSubstitutionsTool, client);
    expect(result.text).toContain('keine');
  });

  test('returns all entries when no filter given', async () => {
    const plan = makePlan([entryA, entryB]);
    const client = makeMockClient({ getSubstitutions: vi.fn(() => Promise.resolve([plan])) });
    const result = await callTool(registerSubstitutionsTool, client);
    expect(result.structuredContent.totalEntries).toBe(2);
    expect(result.text).toContain('10a');
    expect(result.text).toContain('11a');
  });

  test('structuredContent plan has date field and no legacy fields', async () => {
    const plan = makePlan([entryA]);
    const client = makeMockClient({ getSubstitutions: vi.fn(() => Promise.resolve([plan])) });
    const result = await callTool(registerSubstitutionsTool, client);
    const plans = result.structuredContent.plans as Record<string, unknown>[];
    expect(plans).toHaveLength(1);
    expect(plans[0].date).toBe('2026-03-20');
    expect(plans[0]).not.toHaveProperty('title');
    expect(plans[0]).not.toHaveProperty('planDate');
    expect(plans[0]).not.toHaveProperty('affectedClasses');
    expect(plans[0]).not.toHaveProperty('url');
  });

  test('text output uses ISO date as section heading', async () => {
    const plan = makePlan([entryA]);
    const client = makeMockClient({ getSubstitutions: vi.fn(() => Promise.resolve([plan])) });
    const result = await callTool(registerSubstitutionsTool, client);
    expect(result.text).toContain('## 2026-03-20');
  });

  test('filters by className parameter', async () => {
    const plan = makePlan([entryA, entryB]);
    const client = makeMockClient({ getSubstitutions: vi.fn(() => Promise.resolve([plan])) });
    const result = await callTool(registerSubstitutionsTool, client, { className: '10a' });
    expect(result.structuredContent.totalEntries).toBe(1);
    expect(result.text).toContain('Class 10a');
    expect(result.text).not.toContain('Class 11a');
  });

  test('className filter is case-insensitive', async () => {
    const plan = makePlan([entryA]);
    const client = makeMockClient({ getSubstitutions: vi.fn(() => Promise.resolve([plan])) });
    const result = await callTool(registerSubstitutionsTool, client, { className: '10A' });
    expect(result.structuredContent.totalEntries).toBe(1);
  });

  test('returns message when filter matches nothing', async () => {
    const plan = makePlan([entryA]);
    const client = makeMockClient({ getSubstitutions: vi.fn(() => Promise.resolve([plan])) });
    const result = await callTool(registerSubstitutionsTool, client, { className: '99z' });
    expect(result.text).toContain('99z');
    expect(result.isError).toBeUndefined();
  });

  test('uses DSB_CLASS env var as default filter', async () => {
    process.env[ENV_CLASS] = '11a';
    const plan = makePlan([entryA, entryB]);
    const client = makeMockClient({ getSubstitutions: vi.fn(() => Promise.resolve([plan])) });
    const result = await callTool(registerSubstitutionsTool, client);
    expect(result.structuredContent.totalEntries).toBe(1);
    expect(result.text).toContain('11a');
    delete process.env[ENV_CLASS];
  });

  test('className param overrides DSB_CLASS env var', async () => {
    process.env[ENV_CLASS] = '11a';
    const plan = makePlan([entryA, entryB]);
    const client = makeMockClient({ getSubstitutions: vi.fn(() => Promise.resolve([plan])) });
    const result = await callTool(registerSubstitutionsTool, client, { className: '10a' });
    expect(result.structuredContent.totalEntries).toBe(1);
    expect(result.text).toContain('10a');
    delete process.env[ENV_CLASS];
  });
});

// --- News tool ---

describe('get_news tool', () => {
  test('returns message when no news available', async () => {
    const client = makeMockClient();
    const result = await callTool(registerNewsTool, client);
    expect(result.text).toContain('keine');
  });

  test('returns formatted news list', async () => {
    const news: NewsEntry[] = [
      {
        id: '1',
        title: 'Schulausflug',
        detail: 'Morgen kein Unterricht',
        date: '20.03.2026 08:00',
        tags: '',
      },
    ];
    const client = makeMockClient({ getNews: vi.fn(() => Promise.resolve(news)) });
    const result = await callTool(registerNewsTool, client);
    expect(result.text).toContain('Schulausflug');
    expect(result.text).toContain('Morgen kein Unterricht');
    expect(result.structuredContent.count).toBe(1);
  });
});

// --- Documents tool ---

describe('get_documents tool', () => {
  test('returns message when no documents available', async () => {
    const client = makeMockClient();
    const result = await callTool(registerDocumentsTool, client);
    expect(result.text).toContain('keine');
  });

  test('returns formatted document list', async () => {
    const documents: DocumentEntry[] = [
      {
        id: '1',
        title: 'Elternbrief',
        url: 'https://example.com/brief.pdf',
        date: '13.03.2026 09:00',
      },
    ];
    const client = makeMockClient({ getDocuments: vi.fn(() => Promise.resolve(documents)) });
    const result = await callTool(registerDocumentsTool, client);
    expect(result.text).toContain('Elternbrief');
    expect(result.text).toContain('https://example.com/brief.pdf');
    expect(result.structuredContent.count).toBe(1);
  });
});

// --- Shared behavior of all tools ---

const longText = 'x'.repeat(CHARACTER_LIMIT);

const tools = [
  {
    name: 'get_timetables',
    register: registerTimetablesTool,
    method: 'getTimetables',
    data: [{ id: '1', title: longText, date: '', url: 'https://example.com' }],
  },
  {
    name: 'get_substitutions',
    register: registerSubstitutionsTool,
    method: 'getSubstitutions',
    data: [makePlan([{ ...entryA, text: longText }])],
  },
  {
    name: 'get_news',
    register: registerNewsTool,
    method: 'getNews',
    data: [{ id: '1', title: 'News', detail: longText, date: '', tags: '' }],
  },
  {
    name: 'get_documents',
    register: registerDocumentsTool,
    method: 'getDocuments',
    data: [{ id: '1', title: longText, url: 'https://example.com', date: '' }],
  },
] as const;

describe.each(tools)('$name tool (shared behavior)', ({ register, method, data }) => {
  beforeEach(() => {
    delete process.env[ENV_CLASS];
  });

  test('truncates responses longer than the character limit', async () => {
    const client = makeMockClient({ [method]: vi.fn(() => Promise.resolve(data)) });
    const result = await callTool(register, client);
    expect(result.text.length).toBeLessThan(CHARACTER_LIMIT + 200);
    expect(result.text).toContain('[Response truncated');
  });

  test('returns the error message when the client fails', async () => {
    const client = makeMockClient({
      [method]: vi.fn(() => Promise.reject(new Error('Error: Service down'))),
    });
    const result = await callTool(register, client);
    expect(result.isError).toBe(true);
    expect(result.text).toBe('Error: Service down');
  });

  test('returns a generic message when the client throws something that is not an error', async () => {
    const client = makeMockClient({
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      [method]: vi.fn(() => Promise.reject('boom')),
    });
    const result = await callTool(register, client);
    expect(result.isError).toBe(true);
    expect(result.text).toBe('An unexpected error occurred.');
  });
});

describe('tool output details', () => {
  beforeEach(() => {
    delete process.env[ENV_CLASS];
  });

  test('get_timetables lists the preview URL when present', async () => {
    const entries: TimetableEntry[] = [
      {
        id: '1',
        title: 'Plan',
        date: '',
        url: 'https://example.com/plan.htm',
        previewUrl: 'https://example.com/preview.png',
      },
    ];
    const client = makeMockClient({ getTimetables: vi.fn(() => Promise.resolve(entries)) });
    const result = await callTool(registerTimetablesTool, client);
    expect(result.text).toContain('- **Preview**: https://example.com/preview.png');
  });

  test('get_news lists tags and leaves out empty content', async () => {
    const news: NewsEntry[] = [{ id: '1', title: 'Info', detail: '', date: '', tags: 'wichtig' }];
    const client = makeMockClient({ getNews: vi.fn(() => Promise.resolve(news)) });
    const result = await callTool(registerNewsTool, client);
    expect(result.text).toContain('- **Tags**: wichtig');
    expect(result.text).not.toContain('**Content**');
  });

  test('get_substitutions skips empty plans and shows notes and single teachers or rooms', async () => {
    const emptyPlan = { ...makePlan([]), date: '2026-03-19' };
    const plan = makePlan([
      { ...entryA, text: 'Raumwechsel' },
      { ...entryB, originalTeacher: '', substituteTeacher: 'Fff', originalRoom: '' },
      { ...entryB, subject: '', originalTeacher: '', originalRoom: '', substituteRoom: 'B1' },
    ]);
    const client = makeMockClient({
      getSubstitutions: vi.fn(() => Promise.resolve([emptyPlan, plan])),
    });
    const result = await callTool(registerSubstitutionsTool, client);
    expect(result.text).not.toContain('## 2026-03-19');
    expect(result.text).toContain('Note: Raumwechsel');
    expect(result.text).toContain('Teacher: Aaa → Bbb');
    expect(result.text).toContain('Teacher: Fff');
    expect(result.text).toContain('Room: B1');
  });
});
