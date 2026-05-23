import { describe, expect, test, vi } from 'vitest';
import type { DsbmobileClient } from '../src/services/dsbmobile.js';

const registeredTools: string[] = [];
const mockConnect = vi.fn().mockResolvedValue();
const mockRegisterTool = vi.fn((name: string) => {
  registeredTools.push(name);
});

vi.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: class {
    name: string;
    version: string;
    constructor(options: { name: string; version: string }) {
      this.name = options.name;
      this.version = options.version;
    }
    registerTool = mockRegisterTool;
    connect = mockConnect;
  },
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: class {},
}));

function makeMockClient(): DsbmobileClient {
  return {
    getTimetables: vi.fn(),
    getNews: vi.fn(),
    getDocuments: vi.fn(),
    getSubstitutions: vi.fn(),
  } as unknown as DsbmobileClient;
}

describe('startMcpServer', () => {
  test('registers all 4 tools', async () => {
    registeredTools.length = 0;
    const { startMcpServer } = await import('../src/mcp.js');
    const client = makeMockClient();
    await startMcpServer(client);

    expect(registeredTools).toContain('get_timetables');
    expect(registeredTools).toContain('get_substitutions');
    expect(registeredTools).toContain('get_news');
    expect(registeredTools).toContain('get_documents');
    expect(registeredTools).toHaveLength(4);
  });

  test('creates server with name "dsbmobile"', async () => {
    mockRegisterTool.mockClear();
    const { startMcpServer } = await import('../src/mcp.js');
    const client = makeMockClient();
    await startMcpServer(client);

    const serverInstance = mockRegisterTool.mock.contexts[0] as { name: string };
    expect(serverInstance.name).toBe('dsbmobile');
  });

  test('creates server with a semver version', async () => {
    registeredTools.length = 0;
    const { startMcpServer } = await import('../src/mcp.js');
    const client = makeMockClient();
    await startMcpServer(client);

    const contexts = mockRegisterTool.mock.contexts;
    expect((contexts[0] as { version: string }).version).toMatch(/^\d+\.\d+\.\d+/);
  });

  test('connects the server to a transport', async () => {
    mockConnect.mockClear();
    const { startMcpServer } = await import('../src/mcp.js');
    const client = makeMockClient();
    await startMcpServer(client);

    expect(mockConnect).toHaveBeenCalledOnce();
  });
});
