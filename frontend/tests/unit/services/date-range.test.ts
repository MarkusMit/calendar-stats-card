import { describe, it, expect } from 'vitest';
import {
  addMonths,
  compareAnchors,
  presetToRange,
  stepRange,
  rangeYears,
  visibleMonthsForYear,
  atRangeStart,
  atRangeEnd,
} from '../../../src/services/date-range';
import type { MonthAnchor, DateRange } from '../../../src/types/statistics';

const a = (year: number, month: number): MonthAnchor => ({ year, month });

describe('addMonths', () => {
  it('adds within a year', () => {
    expect(addMonths(a(2026, 3), 2)).toEqual(a(2026, 5));
  });
  it('rolls forward across year boundary', () => {
    expect(addMonths(a(2026, 11), 3)).toEqual(a(2027, 2));
  });
  it('subtracts across year boundary', () => {
    expect(addMonths(a(2026, 2), -3)).toEqual(a(2025, 11));
  });
  it('exact year multiples', () => {
    expect(addMonths(a(2026, 7), -12)).toEqual(a(2025, 7));
  });
});

describe('compareAnchors', () => {
  it('less / equal / greater', () => {
    expect(compareAnchors(a(2025, 12), a(2026, 1))).toBeLessThan(0);
    expect(compareAnchors(a(2026, 5), a(2026, 5))).toBe(0);
    expect(compareAnchors(a(2026, 6), a(2026, 5))).toBeGreaterThan(0);
  });
});

describe('presetToRange', () => {
  const now = a(2026, 7); // July 2026

  it('this_month → single current month', () => {
    expect(presetToRange('this_month', now)).toEqual({ start: a(2026, 7), end: a(2026, 7), preset: 'this_month' });
  });

  it('this_quarter → quarter-aligned start .. now (Q3 starts July)', () => {
    expect(presetToRange('this_quarter', now)).toEqual({ start: a(2026, 7), end: a(2026, 7), preset: 'this_quarter' });
  });

  it('this_quarter aligns to quarter start for mid-quarter month (Aug → Q3 Jul)', () => {
    expect(presetToRange('this_quarter', a(2026, 8))).toEqual({ start: a(2026, 7), end: a(2026, 8), preset: 'this_quarter' });
  });

  it('this_quarter for Q1 month (Feb → start Jan)', () => {
    expect(presetToRange('this_quarter', a(2026, 2))).toEqual({ start: a(2026, 1), end: a(2026, 2), preset: 'this_quarter' });
  });

  it('this_year → Jan .. now', () => {
    expect(presetToRange('this_year', now)).toEqual({ start: a(2026, 1), end: a(2026, 7), preset: 'this_year' });
  });

  it('last_3_months → 3-month window ending now', () => {
    expect(presetToRange('last_3_months', now)).toEqual({ start: a(2026, 5), end: a(2026, 7), preset: 'last_3_months' });
  });

  it('last_12_months → 12-month window crossing year boundary', () => {
    expect(presetToRange('last_12_months', now)).toEqual({ start: a(2025, 8), end: a(2026, 7), preset: 'last_12_months' });
  });
});

describe('stepRange — calendar-aligned', () => {
  const now = a(2026, 7);

  it('this_month prev → previous single month', () => {
    const r = presetToRange('this_month', now);
    expect(stepRange(r, -1, now)).toEqual({ start: a(2026, 6), end: a(2026, 6), preset: 'this_month' });
  });

  it('this_month next → next single month', () => {
    const r = presetToRange('this_month', a(2026, 5));
    expect(stepRange(r, 1, now)).toEqual({ start: a(2026, 6), end: a(2026, 6), preset: 'this_month' });
  });

  it('this_quarter prev → full previous quarter', () => {
    const r = presetToRange('this_quarter', now); // Q3 Jul..Jul
    expect(stepRange(r, -1, now)).toEqual({ start: a(2026, 4), end: a(2026, 6), preset: 'this_quarter' });
  });

  it('this_quarter prev rolls to prior year Q4', () => {
    const r: DateRange = { start: a(2026, 1), end: a(2026, 3), preset: 'this_quarter' };
    expect(stepRange(r, -1, now)).toEqual({ start: a(2025, 10), end: a(2025, 12), preset: 'this_quarter' });
  });

  it('this_year prev → full previous calendar year Jan..Dec', () => {
    const r = presetToRange('this_year', now); // 2026 Jan..Jul
    expect(stepRange(r, -1, now)).toEqual({ start: a(2025, 1), end: a(2025, 12), preset: 'this_year' });
  });

  it('stepping this_year to the current year re-clamps end to now', () => {
    const r: DateRange = { start: a(2025, 1), end: a(2025, 12), preset: 'this_year' };
    expect(stepRange(r, 1, now)).toEqual({ start: a(2026, 1), end: a(2026, 7), preset: 'this_year' });
  });
});

describe('stepRange — rolling / custom', () => {
  const now = a(2026, 7);

  it('last_3_months prev shifts window back 3 months', () => {
    const r = presetToRange('last_3_months', now); // May..Jul
    expect(stepRange(r, -1, now)).toEqual({ start: a(2026, 2), end: a(2026, 4), preset: 'last_3_months' });
  });

  it('last_12_months prev shifts window back 12 months', () => {
    const r = presetToRange('last_12_months', now); // Aug2025..Jul2026
    expect(stepRange(r, -1, now)).toEqual({ start: a(2024, 8), end: a(2025, 7), preset: 'last_12_months' });
  });

  it('custom shifts by its own length', () => {
    const r: DateRange = { start: a(2026, 2), end: a(2026, 5), preset: 'custom' }; // 4 months
    expect(stepRange(r, 1, now)).toEqual({ start: a(2026, 6), end: a(2026, 9), preset: 'custom' });
    expect(stepRange(r, -1, now)).toEqual({ start: a(2025, 10), end: a(2026, 1), preset: 'custom' });
  });
});

describe('atRangeStart / atRangeEnd', () => {
  const now = a(2026, 7);
  const earliest = a(2024, 3);

  it('atRangeEnd true when end >= now', () => {
    expect(atRangeEnd({ start: a(2026, 1), end: a(2026, 7), preset: 'this_year' }, now)).toBe(true);
    expect(atRangeEnd({ start: a(2026, 1), end: a(2026, 6), preset: 'custom' }, now)).toBe(false);
  });

  it('atRangeStart true when start <= earliest', () => {
    expect(atRangeStart({ start: a(2024, 3), end: a(2024, 6), preset: 'custom' }, earliest)).toBe(true);
    expect(atRangeStart({ start: a(2024, 4), end: a(2024, 6), preset: 'custom' }, earliest)).toBe(false);
  });

  it('atRangeStart false when earliest unknown', () => {
    expect(atRangeStart({ start: a(2020, 1), end: a(2020, 6), preset: 'custom' }, null)).toBe(false);
  });
});

describe('rangeYears', () => {
  it('single year', () => {
    expect(rangeYears({ start: a(2026, 1), end: a(2026, 7), preset: 'this_year' })).toEqual([2026]);
  });
  it('two years', () => {
    expect(rangeYears({ start: a(2025, 8), end: a(2026, 7), preset: 'last_12_months' })).toEqual([2025, 2026]);
  });
  it('three years', () => {
    expect(rangeYears({ start: a(2024, 11), end: a(2026, 2), preset: 'custom' })).toEqual([2024, 2025, 2026]);
  });
});

describe('visibleMonthsForYear', () => {
  const now = a(2026, 7);
  const earliest = a(2025, 4);

  it('full interior year returns the in-range months', () => {
    const r: DateRange = { start: a(2025, 8), end: a(2026, 5), preset: 'custom' };
    expect(visibleMonthsForYear(r, 2025, now, null)).toEqual([8, 9, 10, 11, 12]);
    expect(visibleMonthsForYear(r, 2026, now, null)).toEqual([1, 2, 3, 4, 5]);
  });

  it('clamps future months in the current year to now', () => {
    const r: DateRange = { start: a(2026, 1), end: a(2026, 12), preset: 'custom' };
    expect(visibleMonthsForYear(r, 2026, now, null)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('floors to earliest month in the earliest data year', () => {
    const r: DateRange = { start: a(2025, 1), end: a(2025, 12), preset: 'this_year' };
    expect(visibleMonthsForYear(r, 2025, now, earliest)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('year before earliest data → empty', () => {
    const r: DateRange = { start: a(2024, 1), end: a(2026, 7), preset: 'custom' };
    expect(visibleMonthsForYear(r, 2024, now, earliest)).toEqual([]);
  });

  it('year after now → empty', () => {
    const r: DateRange = { start: a(2026, 1), end: a(2027, 3), preset: 'custom' };
    expect(visibleMonthsForYear(r, 2027, now, null)).toEqual([]);
  });
});
