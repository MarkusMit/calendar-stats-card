import { describe, it, expect } from 'vitest';
import { computeCumulativeYearRollup, rowSummaryKey } from '../../../src/services/data-transform';
import type { MonthlySummary } from '../../../src/types/statistics';

const YEAR = 2025;
const ID = 'sensor.rain';

function summaryMap(totals: Record<number, number | null>): Map<string, MonthlySummary> {
  const map = new Map<string, MonthlySummary>();
  for (const [mStr, total] of Object.entries(totals)) {
    const month = Number(mStr);
    map.set(rowSummaryKey(0, ID, YEAR, month), {
      entityId: ID, year: YEAR, month, min: null, mean: null, max: null, total,
    });
  }
  return map;
}

const ALL = Array.from({ length: 12 }, (_, i) => i + 1);

describe('computeCumulativeYearRollup (T011, FR-006, FR-018)', () => {
  it('total = sum of monthly totals; min/avg/max over monthly totals', () => {
    const summaries = summaryMap({ 1: 10, 2: 30, 3: 20 });
    const r = computeCumulativeYearRollup(0, ID, YEAR, ALL, summaries, false);
    expect(r.total).toBe(60);
    expect(r.min).toBe(10);
    expect(r.max).toBe(30);
    expect(r.mean).toBe(20);
  });

  it('zero-total months excluded from min/avg/max when excludeZero, still in total', () => {
    const summaries = summaryMap({ 1: 0, 2: 30, 3: 20 });
    const r = computeCumulativeYearRollup(0, ID, YEAR, ALL, summaries, true);
    expect(r.total).toBe(50);
    expect(r.min).toBe(20); // January's 0 excluded
    expect(r.mean).toBe(25);
    expect(r.max).toBe(30);
  });

  it('zero-total months included when excludeZero is false', () => {
    const summaries = summaryMap({ 1: 0, 2: 30 });
    const r = computeCumulativeYearRollup(0, ID, YEAR, ALL, summaries, false);
    expect(r.min).toBe(0);
    expect(r.mean).toBe(15);
  });

  it('months with null total or outside visibleMonths are ignored', () => {
    const summaries = summaryMap({ 1: 10, 2: null, 12: 99 });
    const r = computeCumulativeYearRollup(0, ID, YEAR, [1, 2, 3], summaries, false);
    expect(r.total).toBe(10);
    expect(r.min).toBe(10);
    expect(r.max).toBe(10);
  });

  it('no months with totals → all null', () => {
    const r = computeCumulativeYearRollup(0, ID, YEAR, ALL, new Map(), false);
    expect(r).toEqual({ min: null, mean: null, max: null, total: null });
  });
});
