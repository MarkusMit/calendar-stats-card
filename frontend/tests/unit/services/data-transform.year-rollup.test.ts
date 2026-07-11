import { describe, it, expect } from 'vitest';
import { computeMeasurementYearRollup, rowSummaryKey } from '../../../src/services/data-transform';
import type { MonthlySummary, DailyValue, MeasurementDailyValue } from '../../../src/types/statistics';

const YEAR = 2025;
const ID = 'sensor.temp';

function summaryMap(months: Record<number, { min: number; mean: number; max: number }>): Map<string, MonthlySummary> {
  const map = new Map<string, MonthlySummary>();
  for (const [mStr, s] of Object.entries(months)) {
    const month = Number(mStr);
    map.set(rowSummaryKey(0, ID, YEAR, month), {
      entityId: ID, year: YEAR, month, min: s.min, mean: s.mean, max: s.max, total: null,
    });
  }
  return map;
}

function daily(month: number, day: number, mean: number): [string, MeasurementDailyValue] {
  const dateStr = `${YEAR}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return [`${ID}::${dateStr}`, {
    kind: 'measurement', entityId: ID, date: dateStr,
    min: mean - 1, mean, max: mean + 1, partialCoverage: false,
  }];
}

describe('computeMeasurementYearRollup (T010, FR-005)', () => {
  it('min = lowest monthly min, max = highest monthly max', () => {
    const summaries = summaryMap({
      1: { min: -5, mean: 0, max: 4 },
      7: { min: 12, mean: 20, max: 33 },
    });
    const dailyValues = new Map<string, DailyValue>([daily(1, 1, 0), daily(7, 1, 20)]);
    const r = computeMeasurementYearRollup(0, ID, YEAR, [1, 7], summaries, dailyValues);
    expect(r.min).toBe(-5);
    expect(r.max).toBe(33);
    expect(r.total).toBeNull();
  });

  it('avg is the day-weighted mean of all daily values in the year', () => {
    // January: 3 days at mean 10; July: 1 day at mean 30 → day-weighted = (10*3+30)/4 = 15
    // (an unweighted mean of monthly means would give (10+30)/2 = 20)
    const summaries = summaryMap({
      1: { min: 9, mean: 10, max: 11 },
      7: { min: 29, mean: 30, max: 31 },
    });
    const dailyValues = new Map<string, DailyValue>([
      daily(1, 1, 10), daily(1, 2, 10), daily(1, 3, 10),
      daily(7, 1, 30),
    ]);
    const r = computeMeasurementYearRollup(0, ID, YEAR, [1, 7], summaries, dailyValues);
    expect(r.mean).toBe(15);
  });

  it('months outside visibleMonths are excluded', () => {
    const summaries = summaryMap({
      1: { min: -5, mean: 0, max: 4 },
      12: { min: -20, mean: -10, max: 0 },
    });
    const dailyValues = new Map<string, DailyValue>([daily(1, 1, 0), daily(12, 1, -10)]);
    const r = computeMeasurementYearRollup(0, ID, YEAR, [1], summaries, dailyValues);
    expect(r.min).toBe(-5); // December's -20 not considered
    expect(r.mean).toBe(0); // only January's day
  });

  it('no data at all → all null', () => {
    const r = computeMeasurementYearRollup(0, ID, YEAR, [1, 2, 3], new Map(), new Map());
    expect(r).toEqual({ min: null, mean: null, max: null, total: null });
  });
});
