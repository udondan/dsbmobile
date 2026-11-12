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
  SubstitutionPlan,
  TimetableEntry,
} from '../types.js';
import { createAuthError, handleApiError } from '../utils/errors.js';
import { parseDocuments, parseNews, parseTimetables } from './items.js';
import { mergeConsecutivePeriods, parseSubstitutionHtml } from './parser.js';

// Exported from here for the SDK entry point and existing imports.
export { mergeConsecutivePeriods, parseSubstitutionHtml } from './parser.js';

export interface DsbmobileConfig {
  username: string;
  password: string;
}

/**
 * Passes already formatted errors through and wraps all others.
 */
function rethrowApiError(error: unknown): never {
  if (error instanceof Error && error.message.startsWith('Error:')) {
    throw error;
  }
  throw new Error(handleApiError(error), { cause: error });
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
    this.token = token.replaceAll(/(?:^")|(?:"$)/g, '');
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
   * Fetches a list endpoint of the API and parses its items.
   */
  private async fetchList<T>(path: string, parse: (items: DsbItem[]) => T[]): Promise<T[]> {
    try {
      const token = await this.ensureAuthenticated();
      const response = await this.http.get<DsbItem[]>(path, { params: { authid: token } });
      return parse(response.data);
    } catch (error) {
      rethrowApiError(error);
    }
  }

  /**
   * Downloads and parses one substitution plan page.
   */
  private async fetchPlan(timetable: TimetableEntry): Promise<SubstitutionPlan> {
    // Use a standalone axios call with the full URL (not the base-URL-bound instance)
    // responseType 'arraybuffer' lets us decode the latin-1 charset ourselves
    const response = await axios.get<ArrayBuffer>(timetable.url, {
      responseType: 'arraybuffer',
      timeout: REQUEST_TIMEOUT_MS,
    });
    // The HTML is encoded in iso-8859-1/windows-1252 — decode it properly
    const htmlText = new TextDecoder('windows-1252').decode(response.data);
    return parseSubstitutionHtml(htmlText, timetable.date);
  }

  /**
   * Fetches all available substitution plan (Vertretungsplan) entries.
   *
   * @returns Array of timetable entries with URLs to HTML plan pages
   * @throws Error if authentication fails or the request fails
   */
  async getTimetables(): Promise<TimetableEntry[]> {
    return this.fetchList('/dsbtimetables', parseTimetables);
  }

  /**
   * Fetches all news and announcements.
   *
   * @returns Array of news entries
   * @throws Error if authentication fails or the request fails
   */
  async getNews(): Promise<NewsEntry[]> {
    return this.fetchList('/newstab', parseNews);
  }

  /**
   * Fetches all available documents.
   *
   * @returns Array of document entries with download URLs
   * @throws Error if authentication fails or the request fails
   */
  async getDocuments(): Promise<DocumentEntry[]> {
    return this.fetchList('/dsbdocuments', parseDocuments);
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
    let timetables: TimetableEntry[];
    try {
      timetables = await this.getTimetables();
    } catch (error) {
      rethrowApiError(error);
    }
    const merged = new Map<string, SubstitutionPlan>();

    for (const timetable of timetables) {
      try {
        const plan = await this.fetchPlan(timetable);
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

    return [...merged.values()].map((plan) => ({
      ...plan,
      entries: mergeConsecutivePeriods(plan.entries),
    }));
  }
}
