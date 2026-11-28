import { describe, expect, test } from 'vitest';
import { mergeConsecutivePeriods } from '../src/services/dsbmobile.js';
import type { SubstitutionEntry } from '../src/types.js';

function entry(period: string, overrides: Partial<SubstitutionEntry> = {}): SubstitutionEntry {
  return {
    className: '06b',
    type: 'Vertretung',
    period,
    originalTeacher: 'Fer',
    substituteTeacher: 'Neu',
    subject: 'KU',
    originalRoom: '',
    substituteRoom: 'A007',
    text: '',
    ...overrides,
  };
}

function periods(entries: SubstitutionEntry[]): string[] {
  return mergeConsecutivePeriods(entries).map((item) => item.period);
}

describe('mergeConsecutivePeriods', () => {
  test('merges two identical entries with consecutive periods', () => {
    expect(periods([entry('3'), entry('4')])).toEqual(['3 - 4']);
  });

  test('extends an existing range with a following period', () => {
    expect(periods([entry('3 - 4'), entry('5')])).toEqual(['3 - 5']);
  });

  test('merges entries regardless of their order', () => {
    expect(periods([entry('5 - 6'), entry('3 - 4')])).toEqual(['3 - 6']);
  });

  test('normalizes range formatting', () => {
    expect(periods([entry('5-6')])).toEqual(['5 - 6']);
    expect(periods([entry(' 3 ')])).toEqual(['3']);
  });

  test('ignores the property order of entries', () => {
    const reordered: SubstitutionEntry = {
      text: '',
      substituteRoom: 'A007',
      originalRoom: '',
      subject: 'KU',
      substituteTeacher: 'Neu',
      originalTeacher: 'Fer',
      period: '4',
      type: 'Vertretung',
      className: '06b',
    };
    expect(periods([entry('3'), reordered])).toEqual(['3 - 4']);
  });

  test('keeps entries with a gap between periods separate', () => {
    expect(periods([entry('3'), entry('5')])).toEqual(['3', '5']);
  });

  test('keeps entries separate when any other field differs', () => {
    const result = mergeConsecutivePeriods([entry('3'), entry('4', { substituteTeacher: 'Reu' })]);
    expect(result.map((item) => [item.period, item.substituteTeacher])).toEqual([
      ['3', 'Neu'],
      ['4', 'Reu'],
    ]);
  });

  test('keeps entries of different classes separate', () => {
    expect(periods([entry('3'), entry('4', { className: '06a' })])).toEqual(['3', '4']);
  });

  test('collapses duplicates and overlapping ranges', () => {
    expect(periods([entry('3'), entry('3')])).toEqual(['3']);
    expect(periods([entry('1 - 4'), entry('2 - 3')])).toEqual(['1 - 4']);
  });

  test('keeps entries with unparseable periods unchanged', () => {
    expect(periods([entry(''), entry('7/8'), entry('4 - 2'), entry('3')])).toEqual([
      '',
      '7/8',
      '4 - 2',
      '3',
    ]);
  });

  test('places merged entries at the position of the first entry of their group', () => {
    const result = mergeConsecutivePeriods([
      entry('1', { className: '05a' }),
      entry('3'),
      entry('2', { className: '05a' }),
      entry('4'),
    ]);
    expect(result.map((item) => [item.className, item.period])).toEqual([
      ['05a', '1 - 2'],
      ['06b', '3 - 4'],
    ]);
  });

  test('returns an empty list for no entries', () => {
    expect(mergeConsecutivePeriods([])).toEqual([]);
  });
});
