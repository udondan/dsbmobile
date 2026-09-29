/**
 * TypeScript interfaces for DSBmobile API data structures
 */

/**
 * Raw item structure returned by the DSBmobile API.
 * ConType determines how data is encoded:
 * - 2: Data is in Childs array (nested items)
 * - 4: Detail contains a link to an HTML web page
 * - 5: Detail contains plain text
 * - 6: Detail contains a link to an image/file
 */
export interface DsbItem {
  Id: string;
  Date: string;
  Title: string;
  Detail: string;
  Tags: string;
  ConType: number;
  Prio: number;
  Index: number;
  Childs: DsbItem[];
  Preview: string;
}

/**
 * A processed timetable/substitution plan entry
 */
export interface TimetableEntry {
  /** Unique identifier */
  id: string;
  /** Plan name (e.g., "Vertretungen-heute") */
  title: string;
  /** Last updated date in DD.MM.YYYY HH:MM format */
  date: string;
  /** URL to the HTML plan page */
  url: string;
  /** URL to the preview image (if available) */
  previewUrl?: string;
}

/**
 * A processed news/announcement entry
 */
export interface NewsEntry {
  /** Unique identifier */
  id: string;
  /** News headline */
  title: string;
  /** News content or URL */
  detail: string;
  /** Publication date in DD.MM.YYYY HH:MM format */
  date: string;
  /** Associated tags */
  tags: string;
}

/**
 * A single substitution entry parsed from a timetable HTML page
 */
export interface SubstitutionEntry {
  /** Class name (e.g., "05b") */
  className: string;
  /** Type of substitution (e.g., "Vertretung", "Statt-Vertretung", "Entfall") */
  type: string;
  /** Lesson period(s) (e.g., "3" or "5 - 6") */
  period: string;
  /** Original teacher abbreviation */
  originalTeacher: string;
  /** Substitute teacher abbreviation */
  substituteTeacher: string;
  /** Subject */
  subject: string;
  /** Original room */
  originalRoom: string;
  /** Substitute room */
  substituteRoom: string;
  /** Additional notes */
  text: string;
}

/**
 * A substitution plan for a single date, merging all pages for that day
 */
export interface SubstitutionPlan {
  /** ISO date string (e.g., "2026-03-20") */
  date: string;
  /** Last updated timestamp */
  lastUpdated: string;
  /** All substitution entries for this date */
  entries: SubstitutionEntry[];
}

/**
 * A processed document entry
 */
export interface DocumentEntry {
  /** Unique identifier */
  id: string;
  /** Document name */
  title: string;
  /** Download URL */
  url: string;
  /** Upload date in DD.MM.YYYY HH:MM format */
  date: string;
}
