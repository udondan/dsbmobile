import type { DocumentEntry, DsbItem, NewsEntry, TimetableEntry } from '../types.js';

const PREVIEW_BASE_URL = 'https://light.dsbcontrol.de/DSBlightWebsite/Data/';

/** Items with ConType 2 hold their data in Childs. The API may leave Childs out. */
function nestedChildren(item: DsbItem): DsbItem[] {
  return item.ConType === 2 ? (item.Childs ?? []) : [];
}

function toTimetableEntry(source: DsbItem, title: string, date: string): TimetableEntry {
  const entry: TimetableEntry = { id: source.Id, title, date, url: source.Detail };
  if (source.Preview) {
    entry.previewUrl = `${PREVIEW_BASE_URL}${source.Preview}`;
  }
  return entry;
}

/**
 * Parses raw DSBmobile timetable items into structured TimetableEntry objects.
 * Timetables have ConType=2 with children that contain the actual plan URLs.
 * The parent item holds the descriptive title; children are individual pages.
 */
export function parseTimetables(items: DsbItem[]): TimetableEntry[] {
  return items.flatMap((item) => {
    const children = nestedChildren(item);
    if (children.length === 0) {
      // Direct URL in Detail field
      return item.Detail ? toTimetableEntry(item, item.Title, item.Date) : [];
    }
    // Each child is a page of the plan. Use the parent's title, with the page number if
    // there is more than one page.
    const pages = children.filter((child) => child.Detail);
    return pages.map((page, index) =>
      toTimetableEntry(
        page,
        pages.length > 1 ? `${item.Title} (Seite ${index + 1})` : item.Title,
        item.Date,
      ),
    );
  });
}

/**
 * Parses raw DSBmobile news items into structured NewsEntry objects.
 * Nested children are listed after their parent and inherit missing fields from it.
 */
export function parseNews(items: DsbItem[]): NewsEntry[] {
  return items.flatMap((item) => [
    { id: item.Id, title: item.Title, detail: item.Detail, date: item.Date, tags: item.Tags },
    ...(item.Childs ?? []).map((child) => ({
      id: child.Id,
      title: child.Title || item.Title,
      detail: child.Detail,
      date: child.Date || item.Date,
      tags: child.Tags || item.Tags,
    })),
  ]);
}

/**
 * Parses raw DSBmobile document items into structured DocumentEntry objects.
 * Documents are often nested; children inherit missing fields from their parent.
 */
export function parseDocuments(items: DsbItem[]): DocumentEntry[] {
  return items.flatMap((item) => {
    const children = nestedChildren(item);
    if (children.length === 0) {
      return item.Detail
        ? { id: item.Id, title: item.Title, url: item.Detail, date: item.Date }
        : [];
    }
    return children
      .filter((child) => child.Detail)
      .map((child) => ({
        id: child.Id,
        title: child.Title || item.Title,
        url: child.Detail,
        date: child.Date || item.Date,
      }));
  });
}
