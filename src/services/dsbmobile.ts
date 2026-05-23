import axios, { type AxiosInstance } from 'axios';
import {
  DSB_API_BASE_URL,
  DSB_APP_VERSION,
  DSB_BUNDLE_ID,
  DSB_OS_VERSION,
  REQUEST_TIMEOUT_MS,
} from '../constants.js';
import type {
  DocumentEntry,
  DsbItem,
  NewsEntry,
  SubstitutionEntry,
  SubstitutionPlan,
  TimetableEntry,
} from '../types.js';
import { createAuthError, handleApiError } from '../utils/errors.js';

export interface DsbmobileConfig {
  username: string;
  password: string;
}

/** Decode common HTML entities and trim whitespace. */
function decodeHtmlEntities(s: string): string {
  return s
    .replaceAll('&nbsp;', ' ')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .trim();
}

/** Strip all HTML tags and trim whitespace. */
function stripHtmlTags(s: string): string {
  return s.replaceAll(/<[^>]+>/g, '').trim();
}

/**
 * Client for the DSBmobile Mobile API.
 *
 * Accepts explicit credentials via {@link DsbmobileConfig} and provides
 * methods to fetch timetables, news, documents, and substitution plans.
 *
 * The authentication token is cached in memory for the session lifetime.
 */
export class DsbmobileClient {
  private readonly username: string;
  private readonly password: string;
  private readonly http: AxiosInstance;
  private token: string | undefined;

  constructor(config: DsbmobileConfig) {
    this.username = config.username;
    this.password = config.password;

    this.http = axios.create({
      baseURL: DSB_API_BASE_URL,
      timeout: REQUEST_TIMEOUT_MS,
      headers: {
        Accept: 'application/json',
        'User-Agent': `Dalvik/2.1.0 (Linux; U; Android 5.1; ${DSB_BUNDLE_ID})`,
      },
    });
  }

  /**
   * Authenticates with DSBmobile and caches the token.
   * The token is stable per username, so it can be cached indefinitely.
   *
   * @throws Error if credentials are invalid or the request fails
   */
  private async authenticate(): Promise<void> {
    const response = await this.http.get<string>('/authid', {
      params: {
        bundleid: DSB_BUNDLE_ID,
        appversion: DSB_APP_VERSION,
        osversion: DSB_OS_VERSION,
        pushid: '',
        user: this.username,
        password: this.password,
      },
    });

    // The API returns the token as a JSON string (with quotes), e.g. "uuid-here"
    // An empty string "" means invalid credentials
    const token = response.data;

    if (!token || token === '""' || token === '') {
      throw new Error(createAuthError());
    }

    // Remove surrounding quotes if present
    this.token = token.replaceAll(/^"|"$/g, '');
  }

  /**
   * Ensures a valid token is available, authenticating if necessary.
   */
  private async ensureAuthenticated(): Promise<string> {
    if (!this.token) {
      await this.authenticate();
    }
    return this.token!;
  }

  /**
   * Fetches all available substitution plan (Vertretungsplan) entries.
   *
   * @returns Array of timetable entries with URLs to HTML plan pages
   * @throws Error if authentication fails or the request fails
   */
  async getTimetables(): Promise<TimetableEntry[]> {
    try {
      const token = await this.ensureAuthenticated();
      const response = await this.http.get<DsbItem[]>('/dsbtimetables', {
        params: { authid: token },
      });

      return this.parseTimetables(response.data);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Error:')) {
        throw error;
      }
      throw new Error(handleApiError(error), { cause: error });
    }
  }

  /**
   * Fetches all news and announcements.
   *
   * @returns Array of news entries
   * @throws Error if authentication fails or the request fails
   */
  async getNews(): Promise<NewsEntry[]> {
    try {
      const token = await this.ensureAuthenticated();
      const response = await this.http.get<DsbItem[]>('/newstab', {
        params: { authid: token },
      });

      return this.parseNews(response.data);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Error:')) {
        throw error;
      }
      throw new Error(handleApiError(error), { cause: error });
    }
  }

  /**
   * Fetches all available documents.
   *
   * @returns Array of document entries with download URLs
   * @throws Error if authentication fails or the request fails
   */
  async getDocuments(): Promise<DocumentEntry[]> {
    try {
      const token = await this.ensureAuthenticated();
      const response = await this.http.get<DsbItem[]>('/dsbdocuments', {
        params: { authid: token },
      });

      return this.parseDocuments(response.data);
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Error:')) {
        throw error;
      }
      throw new Error(handleApiError(error), { cause: error });
    }
  }

  /**
   * Parses raw DSBmobile timetable items into structured TimetableEntry objects.
   * Timetables have ConType=2 with children that contain the actual plan URLs.
   * The parent item holds the descriptive title; children are individual pages.
   */
  private parseTimetables(items: DsbItem[]): TimetableEntry[] {
    const entries: TimetableEntry[] = [];

    for (const item of items) {
      if (item.ConType === 2 && item.Childs && item.Childs.length > 0) {
        const validChildren = item.Childs.filter((c) => c.Detail);
        const multiPage = validChildren.length > 1;

        // Each child represents a page of the plan
        for (const [index, validChild] of validChildren.entries()) {
          const child = validChild;
          // Use the parent's descriptive title; append page number if multi-page
          const title = multiPage ? `${item.Title} (Seite ${index + 1})` : item.Title;

          const entry: TimetableEntry = {
            id: child.Id,
            title,
            date: item.Date,
            url: child.Detail,
          };

          if (child.Preview) {
            entry.previewUrl = `https://light.dsbcontrol.de/DSBlightWebsite/Data/${child.Preview}`;
          }

          entries.push(entry);
        }
      } else if (item.Detail) {
        // Direct URL in Detail field
        const entry: TimetableEntry = {
          id: item.Id,
          title: item.Title,
          date: item.Date,
          url: item.Detail,
        };

        if (item.Preview) {
          entry.previewUrl = `https://light.dsbcontrol.de/DSBlightWebsite/Data/${item.Preview}`;
        }

        entries.push(entry);
      }
    }

    return entries;
  }

  /**
   * Parses raw DSBmobile news items into structured NewsEntry objects.
   */
  private parseNews(items: DsbItem[]): NewsEntry[] {
    const entries: NewsEntry[] = [];

    for (const item of items) {
      entries.push({
        id: item.Id,
        title: item.Title,
        detail: item.Detail,
        date: item.Date,
        tags: item.Tags,
      });

      // Also process nested children if present
      if (item.Childs && item.Childs.length > 0) {
        for (const child of item.Childs) {
          entries.push({
            id: child.Id,
            title: child.Title || item.Title,
            detail: child.Detail,
            date: child.Date || item.Date,
            tags: child.Tags || item.Tags,
          });
        }
      }
    }

    return entries;
  }

  /**
   * Fetches and parses all substitution plan pages, returning structured entries.
   * This fetches the actual HTML content of each timetable page and parses the
   * substitution table into structured data.
   *
   * @returns Array of parsed substitution plans (one per calendar day, pages merged)
   * @throws Error if authentication fails or the request fails
   */
  async getSubstitutions(): Promise<SubstitutionPlan[]> {
    try {
      const timetables = await this.getTimetables();
      const merged = new Map<string, SubstitutionPlan>();

      for (const timetable of timetables) {
        try {
          // Use a standalone axios call with the full URL (not the base-URL-bound instance)
          // responseType 'arraybuffer' lets us decode the latin-1 charset ourselves
          const response = await axios.get<ArrayBuffer>(timetable.url, {
            responseType: 'arraybuffer',
            timeout: REQUEST_TIMEOUT_MS,
          });
          // The HTML is encoded in iso-8859-1/windows-1252 — decode it properly
          const htmlText = new TextDecoder('windows-1252').decode(response.data);
          const plan = parseSubstitutionHtml(htmlText, timetable.date);
          const existing = merged.get(plan.date);
          if (existing) {
            existing.entries.push(...plan.entries);
          } else {
            merged.set(plan.date, { ...plan, entries: [...plan.entries] });
          }
        } catch {
          // Skip pages that fail to load; don't abort the whole request
        }
      }

      return [...merged.values()];
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('Error:')) {
        throw error;
      }
      throw new Error(handleApiError(error), { cause: error });
    }
  }

  /**
   * Parses raw DSBmobile document items into structured DocumentEntry objects.
   */
  private parseDocuments(items: DsbItem[]): DocumentEntry[] {
    const entries: DocumentEntry[] = [];

    for (const item of items) {
      if (item.ConType === 2 && item.Childs && item.Childs.length > 0) {
        // Documents are often nested
        for (const child of item.Childs) {
          if (child.Detail) {
            entries.push({
              id: child.Id,
              title: child.Title || item.Title,
              url: child.Detail,
              date: child.Date || item.Date,
            });
          }
        }
      } else if (item.Detail) {
        entries.push({
          id: item.Id,
          title: item.Title,
          url: item.Detail,
          date: item.Date,
        });
      }
    }

    return entries;
  }
}

/**
 * Parses the HTML content of a DSBmobile substitution plan page.
 * The HTML is generated by Untis and has a consistent structure.
 * Exported for unit testing.
 */
export function parseSubstitutionHtml(html: string, lastUpdated: string): SubstitutionPlan {
  // Extract plan date (e.g. "20.3.2026 Freitag (Seite 1 / 8)") and convert to ISO date string
  const dateMatch = /class="mon_title">(.*?)<\/div>/.exec(html);
  const rawDate = dateMatch ? decodeHtmlEntities(stripHtmlTags(dateMatch[1])) : '';
  const datePartMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(rawDate);
  if (!datePartMatch) {
    throw new Error(`Could not parse plan date from HTML: "${rawDate}"`);
  }
  const date = `${datePartMatch[3]}-${datePartMatch[2].padStart(2, '0')}-${datePartMatch[1].padStart(2, '0')}`;

  // Parse all table rows
  const entries: SubstitutionEntry[] = [];
  let currentClass = '';

  const allRows = html.matchAll(/<tr[^>]*>(.*?)<\/tr>/gs);
  for (const rowMatch of allRows) {
    const rowHtml = rowMatch[1];
    const cells = [...rowHtml.matchAll(/<t[dh][^>]*>(.*?)<\/t[dh]>/gs)].map((m) =>
      decodeHtmlEntities(stripHtmlTags(m[1])),
    );

    if (cells.length === 0) continue;

    // Class header row: single cell with class name (e.g. "10a  10a" or just "10a")
    if (cells.length === 1) {
      currentClass = cells[0].split(/\s+/)[0] ?? '';
      continue;
    }

    // Skip header row and info rows
    if (cells.length < 5 || cells[0] === 'Art') continue;

    // Substitution row: Art | Stunde | Vertreter | Fach | Raum | Text
    const [type = '', period = '', teacherField = '', subject = '', roomField = '', text = ''] =
      cells;

    // Teacher field: "OriginalTeacher?SubstituteTeacher" or just "SubstituteTeacher"
    const [originalTeacher = '', substituteTeacher = ''] = teacherField.includes('?')
      ? teacherField.split('?')
      : ['', teacherField];

    // Room field: "OriginalRoom?SubstituteRoom" or just "SubstituteRoom"
    const [originalRoom = '', substituteRoom = ''] = roomField.includes('?')
      ? roomField.split('?')
      : ['', roomField];

    entries.push({
      className: currentClass,
      type,
      period,
      originalTeacher,
      substituteTeacher,
      subject,
      originalRoom,
      substituteRoom,
      text: text === '\u00A0' ? '' : text,
    });
  }

  return { date, lastUpdated, entries };
}
