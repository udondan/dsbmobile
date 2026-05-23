import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseSubstitutionHtml } from '../src/services/dsbmobile.js';
import type { SubstitutionPlan } from '../src/types.js';

const fixtureHtml = new TextDecoder('windows-1252').decode(
  readFileSync(path.join(fileURLToPath(new URL('.', import.meta.url)), 'fixtures/subst_001.htm')),
);

function parse(
  html: string,
  title = 'Test',
  date = '01.01.2026 00:00',
  url = 'http://example.com',
): SubstitutionPlan {
  return parseSubstitutionHtml(html, title, date, url);
}

describe('parseSubstitutionHtml', () => {
  test('parses plan date correctly', () => {
    const plan = parse(fixtureHtml);
    expect(plan.planDate).toBe('20.3.2026 Freitag (Seite 1 / 8)');
  });

  test('passes through title and lastUpdated', () => {
    const plan = parse(fixtureHtml, 'V-Homepage heute', '20.03.2026 10:23');
    expect(plan.title).toBe('V-Homepage heute');
    expect(plan.lastUpdated).toBe('20.03.2026 10:23');
  });

  test('parses affected classes', () => {
    const plan = parse(fixtureHtml);
    expect(plan.affectedClasses).toContain('10a');
    expect(plan.affectedClasses).toContain('11a');
    expect(plan.affectedClasses).toContain('12a');
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
