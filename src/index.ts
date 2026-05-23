/**
 * @udondan/dsbmobile — SDK entry point.
 *
 * @example
 * ```ts
 * import { DsbmobileClient } from '@udondan/dsbmobile';
 *
 * const client = new DsbmobileClient({ username: 'user', password: 'pass' });
 * const substitutions = await client.getSubstitutions();
 * ```
 */

export { DsbmobileClient, parseSubstitutionHtml } from './services/dsbmobile.js';
export type { DsbmobileConfig } from './services/dsbmobile.js';

export type {
  DsbItem,
  TimetableEntry,
  NewsEntry,
  SubstitutionEntry,
  SubstitutionPlan,
  DocumentEntry,
} from './types.js';
