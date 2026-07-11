import { describe, it, expect } from 'vitest';
import {
  yearPresetToRange,
  snapRangeToYears,
  stepRangeByYears,
  clampRangeToFloor,
} from '../../../src/services/date-range';
import type { MonthAnchor, DateRange } from '../../../src/types/statistics';

const a = (year: number, month: number): MonthAnchor => ({ year, month });

describe('yearPresetToRange (T016, FR-016)', () => {
  it('this_year → full current calendar year', () => {
    expect(yearPresetToRange('this_year', 2026)).toEqual({ start: a(2026, 1), end: a(2026, 12), preset: 'this_year' });
  });
  it('last_year → full previous calendar year', () => {
    expect(yearPresetToRange('last_year', 2026)).toEqual({ start: a(2025, 1), end: a(2025, 12), preset: 'last_year' });
  });
  it('last_3_years → three whole years ending this year', () => {
    expect(yearPresetToRange('last_3_years', 2026)).toEqual({ start: a(2024, 1), end: a(2026, 12), preset: 'last_3_years' });
  });
  it('last_5_years → five whole years ending this year', () => {
    expect(yearPresetToRange('last_5_years', 2026)).toEqual({ start: a(2022, 1), end: a(2026, 12), preset: 'last_5_years' });
  });
  it('all → from the earliest-data year through this year', () => {
    expect(yearPresetToRange('all', 2026, 2021)).toEqual({ start: a(2021, 1), end: a(2026, 12), preset: 'all' });
  });
  it('all without a known earliest year → current year only', () => {
    expect(yearPresetToRange('all', 2026, null)).toEqual({ start: a(2026, 1), end: a(2026, 12), preset: 'all' });
  });
});

describe('snapRangeToYears (T016, FR-016)', () => {
  it('expands a mid-year range to the enclosing full years', () => {
    const r: DateRange = { start: a(2025, 11), end: a(2026, 2), preset: 'custom' };
    expect(snapRangeToYears(r)).toEqual({ start: a(2025, 1), end: a(2026, 12), preset: 'custom' });
  });
  it('already-snapped range is unchanged', () => {
    const r: DateRange = { start: a(2026, 1), end: a(2026, 12), preset: 'this_year' };
    expect(snapRangeToYears(r)).toEqual(r);
  });
});

describe('stepRangeByYears (T016)', () => {
  it('steps a single year back and forward', () => {
    const r: DateRange = { start: a(2026, 1), end: a(2026, 12), preset: 'this_year' };
    expect(stepRangeByYears(r, -1)).toEqual({ start: a(2025, 1), end: a(2025, 12), preset: 'this_year' });
    expect(stepRangeByYears(stepRangeByYears(r, -1), 1)).toEqual(r);
  });
  it('steps a multi-year span by its own length', () => {
    const r: DateRange = { start: a(2024, 1), end: a(2026, 12), preset: 'last_3_years' };
    expect(stepRangeByYears(r, -1)).toEqual({ start: a(2021, 1), end: a(2023, 12), preset: 'last_3_years' });
  });
});

describe('clampRangeToFloor (T016, FR-015)', () => {
  const earliest = a(2024, 4);

  it('month granularity: start clamped to the earliest anchor', () => {
    const r: DateRange = { start: a(2023, 8), end: a(2024, 7), preset: 'last_12_months' };
    const c = clampRangeToFloor(r, earliest, 'month');
    expect(c.start).toEqual(a(2024, 4));
    expect(c.end).toEqual(a(2024, 7));
  });

  it('year granularity: start clamped to January of the earliest year', () => {
    const r: DateRange = { start: a(2022, 1), end: a(2023, 12), preset: 'custom' };
    const c = clampRangeToFloor(r, earliest, 'year');
    expect(c.start).toEqual(a(2024, 1));
    // end must not precede start
    expect(c.end.year).toBeGreaterThanOrEqual(2024);
  });

  it('range already at/after the floor is unchanged', () => {
    const r: DateRange = { start: a(2024, 5), end: a(2024, 8), preset: 'custom' };
    expect(clampRangeToFloor(r, earliest, 'month')).toEqual(r);
  });

  it('null earliest → unchanged', () => {
    const r: DateRange = { start: a(2020, 1), end: a(2020, 6), preset: 'custom' };
    expect(clampRangeToFloor(r, null, 'month')).toEqual(r);
  });
});
