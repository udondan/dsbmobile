import { AxiosError, AxiosHeaders, type AxiosInstance } from 'axios';
import axios from 'axios';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { DsbmobileClient } from '../src/services/dsbmobile.js';
import type { DsbItem } from '../src/types.js';

const PREVIEW_BASE = 'https://light.dsbcontrol.de/DSBlightWebsite/Data/';

function item(overrides: Partial<DsbItem> = {}): DsbItem {
  return {
    Id: 'id',
    Date: '20.03.2026 10:00',
    Title: 'Title',
    Detail: '',
    Tags: '',
    ConType: 1,
    Prio: 0,
    Index: 0,
    Childs: [],
    Preview: '',
    ...overrides,
  };
}

/** An item as the API sends it when it has no children at all. */
function itemWithoutChildren(overrides: Partial<DsbItem> = {}): DsbItem {
  return { ...item(overrides), Childs: undefined as unknown as DsbItem[] };
}

function serverError(status: number): AxiosError {
  return new AxiosError('Request failed', undefined, undefined, undefined, {
    status,
    statusText: '',
    data: undefined,
    headers: {},
    config: { headers: new AxiosHeaders() },
  });
}

type Route = unknown;

/**
 * Creates a client whose API calls are answered from `routes` (path → data,
 * or an Error to throw). `/authid` answers with a valid token unless given.
 */
function makeClient(routes: Record<string, Route>) {
  const client = new DsbmobileClient({ username: 'user', password: 'secret' });
  const http = (client as unknown as { http: AxiosInstance }).http;
  const get = vi.spyOn(http, 'get').mockImplementation((url: string) => {
    const route = Object.hasOwn(routes, url)
      ? routes[url]
      : url === '/authid'
        ? '"token-123"'
        : undefined;
    return route instanceof Error ? Promise.reject(route) : Promise.resolve({ data: route });
  });
  return { client, get };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('authentication', () => {
  test('sends the credentials and uses the token without quotes', async () => {
    const { client, get } = makeClient({ '/dsbtimetables': [] });
    await client.getTimetables();

    expect(get).toHaveBeenCalledWith('/authid', {
      params: expect.objectContaining({ user: 'user', password: 'secret' }) as unknown,
    });
    expect(get).toHaveBeenCalledWith('/dsbtimetables', { params: { authid: 'token-123' } });
  });

  test('authenticates only once per client', async () => {
    const { client, get } = makeClient({ '/dsbtimetables': [], '/newstab': [] });
    await client.getTimetables();
    await client.getNews();

    expect(get.mock.calls.filter(([url]) => url === '/authid')).toHaveLength(1);
  });

  test.each(['', '""'])('rejects the token %j as invalid credentials', async (token) => {
    const { client } = makeClient({ '/authid': token });
    await expect(client.getTimetables()).rejects.toThrow(
      'Error: Authentication failed. DSBmobile rejected the provided credentials.',
    );
  });
});

describe('getTimetables', () => {
  test('creates one entry per page of a plan with children', async () => {
    const { client } = makeClient({
      '/dsbtimetables': [
        item({
          Title: 'Vertretungen',
          ConType: 2,
          Childs: [
            item({ Id: 'c1', Detail: 'https://example.com/1.htm', Preview: '1.png' }),
            item({ Id: 'c2', Detail: 'https://example.com/2.htm' }),
            item({ Id: 'c3', Detail: '' }),
          ],
        }),
      ],
    });

    expect(await client.getTimetables()).toEqual([
      {
        id: 'c1',
        title: 'Vertretungen (Seite 1)',
        date: '20.03.2026 10:00',
        url: 'https://example.com/1.htm',
        previewUrl: `${PREVIEW_BASE}1.png`,
      },
      {
        id: 'c2',
        title: 'Vertretungen (Seite 2)',
        date: '20.03.2026 10:00',
        url: 'https://example.com/2.htm',
      },
    ]);
  });

  test('keeps the title of a plan with a single page', async () => {
    const { client } = makeClient({
      '/dsbtimetables': [
        item({
          Title: 'Heute',
          ConType: 2,
          Childs: [item({ Id: 'c1', Detail: 'https://example.com/1.htm' })],
        }),
      ],
    });

    const [entry] = await client.getTimetables();
    expect(entry.title).toBe('Heute');
  });

  test('uses the URL of items without children and skips items without URL', async () => {
    const { client } = makeClient({
      '/dsbtimetables': [
        item({ Id: 'a', Detail: 'https://example.com/a.htm', Preview: 'a.png' }),
        itemWithoutChildren({ Id: 'b', ConType: 2, Detail: 'https://example.com/b.htm' }),
        item({ Id: 'c', ConType: 2 }),
      ],
    });

    expect(await client.getTimetables()).toEqual([
      {
        id: 'a',
        title: 'Title',
        date: '20.03.2026 10:00',
        url: 'https://example.com/a.htm',
        previewUrl: `${PREVIEW_BASE}a.png`,
      },
      { id: 'b', title: 'Title', date: '20.03.2026 10:00', url: 'https://example.com/b.htm' },
    ]);
  });
});

describe('getNews', () => {
  test('returns items and their children, falling back to the parent fields', async () => {
    const { client } = makeClient({
      '/newstab': [
        itemWithoutChildren({ Id: 'n1', Title: 'Ausflug', Detail: 'Text', Tags: 'info' }),
        item({
          Id: 'n2',
          Title: 'Parent',
          Date: '01.01.2026',
          Tags: 'parent',
          Childs: [
            item({ Id: 'c1', Title: '', Date: '', Tags: '', Detail: 'Kind' }),
            item({ Id: 'c2', Title: 'Own', Date: '02.01.2026', Tags: 'own', Detail: '' }),
          ],
        }),
      ],
    });

    expect(await client.getNews()).toEqual([
      { id: 'n1', title: 'Ausflug', detail: 'Text', date: '20.03.2026 10:00', tags: 'info' },
      { id: 'n2', title: 'Parent', detail: '', date: '01.01.2026', tags: 'parent' },
      { id: 'c1', title: 'Parent', detail: 'Kind', date: '01.01.2026', tags: 'parent' },
      { id: 'c2', title: 'Own', detail: '', date: '02.01.2026', tags: 'own' },
    ]);
  });
});

describe('getDocuments', () => {
  test('returns nested and direct documents, skipping those without URL', async () => {
    const { client } = makeClient({
      '/dsbdocuments': [
        item({
          Title: 'Ordner',
          Date: '01.01.2026',
          ConType: 2,
          Childs: [
            item({ Id: 'c1', Title: '', Date: '', Detail: 'https://example.com/c1.pdf' }),
            item({ Id: 'c2', Title: 'Brief', Date: '02.01.2026', Detail: 'https://x/c2.pdf' }),
            item({ Id: 'c3', Detail: '' }),
          ],
        }),
        item({ Id: 'd1', Title: 'Direkt', Detail: 'https://example.com/d1.pdf' }),
        itemWithoutChildren({ Id: 'd2', ConType: 2, Detail: 'https://example.com/d2.pdf' }),
        item({ Id: 'd3', ConType: 2 }),
      ],
    });

    expect(await client.getDocuments()).toEqual([
      { id: 'c1', title: 'Ordner', url: 'https://example.com/c1.pdf', date: '01.01.2026' },
      { id: 'c2', title: 'Brief', url: 'https://x/c2.pdf', date: '02.01.2026' },
      { id: 'd1', title: 'Direkt', url: 'https://example.com/d1.pdf', date: '20.03.2026 10:00' },
      { id: 'd2', title: 'Title', url: 'https://example.com/d2.pdf', date: '20.03.2026 10:00' },
    ]);
  });
});

describe('error handling', () => {
  const methods = [
    ['getTimetables', '/dsbtimetables'],
    ['getNews', '/newstab'],
    ['getDocuments', '/dsbdocuments'],
    ['getSubstitutions', '/dsbtimetables'],
  ] as const;

  test.each(methods)('%s turns API errors into readable messages', async (method, path) => {
    const error = serverError(503);
    const { client } = makeClient({ [path]: error });

    const rejection = client[method]();
    await expect(rejection).rejects.toThrow('Error: DSBmobile service is temporarily unavailable.');
    await expect(rejection).rejects.toHaveProperty('cause', error);
  });

  test.each(methods)('%s passes authentication errors through unchanged', async (method) => {
    const { client } = makeClient({ '/authid': '' });
    await expect(client[method]()).rejects.toThrow(/^Error: Authentication failed\./);
  });

  test('getSubstitutions wraps unexpected errors of getTimetables', async () => {
    const client = new DsbmobileClient({ username: 'user', password: 'secret' });
    const error = new Error('boom');
    vi.spyOn(client, 'getTimetables').mockRejectedValue(error);

    const rejection = client.getSubstitutions();
    await expect(rejection).rejects.toThrow('Error: boom');
    await expect(rejection).rejects.toHaveProperty('cause', error);
  });

  test('getSubstitutions skips pages that fail to load', async () => {
    const { client } = makeClient({
      '/dsbtimetables': [item({ Id: 'a', Detail: 'https://example.com/a.htm' })],
    });
    vi.spyOn(axios, 'get').mockRejectedValue(serverError(404));

    expect(await client.getSubstitutions()).toEqual([]);
  });
});
