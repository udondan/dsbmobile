import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { afterEach, describe, expect, test, vi } from 'vitest';
import axios from 'axios';
import { DsbmobileClient, parseSubstitutionHtml } from '../src/services/dsbmobile.js';
import type { SubstitutionPlan } from '../src/types.js';

const fixtureHtml = new TextDecoder('windows-1252').decode(
  readFileSync(path.join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures/subst_001.htm')),
);

function parse(html: string, lastUpdated = '01.01.2026 00:00'): SubstitutionPlan {
  return parseSubstitutionHtml(html, lastUpdated);
}

describe('parseSubstitutionHtml', () => {
  test('parses plan date as ISO date string', () => {
    const plan = parse(fixtureHtml);
    expect(plan.date).toBe('2026-03-20');
  });

  test('passes through lastUpdated', () => {
    const plan = parse(fixtureHtml, '20.03.2026 10:23');
    expect(plan.lastUpdated).toBe('20.03.2026 10:23');
  });

  test('parses correct number of substitution entries', () => {
    const plan = parse(fixtureHtml);
    expect(plan.entries.length).toBe(8);
  });

  test('parses first entry for class 10a correctly', () => {
    const plan = parse(fixtureHtml);
    const entry = plan.entries[0];
    expect(entry.className).toBe('10a');
    expect(entry.type).toBe('Vertretung');
    expect(entry.period).toBe('3');
    expect(entry.originalTeacher).toBe('Aaa');
    expect(entry.substituteTeacher).toBe('Bbb');
    expect(entry.subject).toBe('SPO');
    expect(entry.originalRoom).toBe('SPH1');
    expect(entry.substituteRoom).toBe('A103');
  });

  test('parses multi-period entry correctly', () => {
    const plan = parse(fixtureHtml);
    const entry = plan.entries.find((item) => item.period === '5 - 6' && item.className === '10b');
    expect(entry).toBeDefined();
    expect(entry!.type).toBe('Statt-Vertretung');
    expect(entry!.originalTeacher).toBe('Ddd');
    expect(entry!.substituteTeacher).toBe('Eee');
    expect(entry!.subject).toBe('ETHI');
  });

  test('handles entry with no room change (single room field)', () => {
    const plan = parse(fixtureHtml);
    // 10b entry has room 'A208' with no '?' separator
    const entry = plan.entries.find((item) => item.className === '10b');
    expect(entry).toBeDefined();
    expect(entry!.originalRoom).toBe('');
    expect(entry!.substituteRoom).toBe('A208');
  });

  test('groups entries by class correctly', () => {
    const plan = parse(fixtureHtml);
    const class10a = plan.entries.filter((item) => item.className === '10a');
    const class11a = plan.entries.filter((item) => item.className === '11a');
    expect(class10a.length).toBe(2);
    expect(class11a.length).toBe(3);
  });

  test('returns empty entries for HTML with no substitutions', () => {
    const emptyHtml = `<html><body>
      <div class="mon_title">01.01.2026 Donnerstag</div>
      <table class="mon_list"><tr class='list'><th class="list">Art</th></tr></table>
    </body></html>`;
    const plan = parse(emptyHtml);
    expect(plan.entries.length).toBe(0);
  });
});

// Minimal single-entry HTML for a given date label (e.g. "20.3.2026 Freitag (Seite 1 / 2)")
function makePageHtml(dateLabel: string): ArrayBuffer {
  const html = [
    `<div class="mon_title">${dateLabel}</div>`,
    '<table>',
    '<tr><td>10a</td></tr>',
    '<tr><td>Vertretung</td><td>3</td><td>Aaa</td><td>SPO</td><td>A101</td><td>&nbsp;</td></tr>',
    '</table>',
  ].join('');
  return new TextEncoder().encode(html).buffer;
}

describe('getSubstitutions - page merging', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('merges multiple pages with the same date into one plan', async () => {
    const client = new DsbmobileClient({ username: 'u', password: 'p' });
    vi.spyOn(client, 'getTimetables').mockResolvedValue([
      { id: '1', title: 'Page 1', date: '20.03.2026 10:00', url: 'http://example.com/p1' },
      { id: '2', title: 'Page 2', date: '20.03.2026 10:00', url: 'http://example.com/p2' },
    ]);
    vi.spyOn(axios, 'get').mockResolvedValue({
      data: makePageHtml('20.3.2026 Freitag (Seite 1 / 2)'),
    });

    const plans = await client.getSubstitutions();
    expect(plans).toHaveLength(1);
    expect(plans[0].date).toBe('2026-03-20');
    expect(plans[0].entries).toHaveLength(2);
  });

  test('keeps plans for different dates separate', async () => {
    const client = new DsbmobileClient({ username: 'u', password: 'p' });
    vi.spyOn(client, 'getTimetables').mockResolvedValue([
      { id: '1', title: 'Day 1', date: '20.03.2026 10:00', url: 'http://example.com/p1' },
      { id: '2', title: 'Day 2', date: '21.03.2026 10:00', url: 'http://example.com/p2' },
    ]);
    vi.spyOn(axios, 'get')
      .mockResolvedValueOnce({ data: makePageHtml('20.3.2026 Freitag (Seite 1 / 1)') })
      .mockResolvedValueOnce({ data: makePageHtml('21.3.2026 Samstag (Seite 1 / 1)') });

    const plans = await client.getSubstitutions();
    expect(plans).toHaveLength(2);
    expect(plans[0].date).toBe('2026-03-20');
    expect(plans[1].date).toBe('2026-03-21');
  });

  test('skips pages where date cannot be parsed', async () => {
    const client = new DsbmobileClient({ username: 'u', password: 'p' });
    vi.spyOn(client, 'getTimetables').mockResolvedValue([
      { id: '1', title: 'Page 1', date: '20.03.2026 10:00', url: 'http://example.com/p1' },
    ]);
    vi.spyOn(axios, 'get').mockResolvedValue({
      data: new TextEncoder().encode('<html><body>no date here</body></html>').buffer,
    });

    const plans = await client.getSubstitutions();
    expect(plans).toHaveLength(0);
  });
});
