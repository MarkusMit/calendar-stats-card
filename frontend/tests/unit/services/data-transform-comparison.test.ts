import { describe, it, expect } from 'vitest';
import { buildComparisonSeries, wrapMonth, rowSummaryKey } from '../../../src/services/data-transform';
import type { MonthlySummary } from '../../../src/types/statistics';

const MONTH = 6;
const NOW = { year: 2026, month: 3 }; // March 2026 — June is never the incomplete month here

function summaries(entityId: string, year: number, values: Partial<MonthlySummary>): Map<string, MonthlySummary> {
  return new Map([[rowSummaryKey(0, entityId, year, MONTH), {
    entityId, year, month: MONTH,
    min: null, mean: null, max: null, total: null,
    ...values,
  }]]);
}

function byYear(entries: Array<[number, Map<string, MonthlySummary>]>): Map<number, Map<string, MonthlySummary>> {
  return new Map(entries);
}

describe('buildComparisonSeries — value sourcing (FR-003/FR-004)', () => {
  it('reads the requested component from the stored monthly summary per year, chronological', () => {
    const s = buildComparisonSeries(0, 'sensor.rain', 'total', MONTH, [2024, 2025], byYear([
      [2024, summaries('sensor.rain', 2024, { total: 10 })],
      [2025, summaries('sensor.rain', 2025, { total: 14 })],
    ]), NOW);
    expect(s.component).toBe('total');
    expect(s.entries.map((e) => e.year)).toEqual([2024, 2025]);
    expect(s.entries.map((e) => e.value)).toEqual([10, 14]);
  });

  it('a year without a summary yields a null value with all diffs null (FR-008)', () => {
    const s = buildComparisonSeries(0, 'sensor.rain', 'total', MONTH, [2024, 2025], byYear([
      [2025, summaries('sensor.rain', 2025, { total: 14 })],
    ]), NOW);
    const e2024 = s.entries[0]!;
    expect(e2024.value).toBeNull();
    expect(e2024.diffPrev).toBeNull();
    expect(e2024.diffAvg).toBeNull();
    expect(e2024.pctPrev).toBeNull();
    expect(e2024.pctAvg).toBeNull();
  });

  it('measurement components read min/mean/max', () => {
    const data = byYear([[2025, summaries('sensor.temp', 2025, { min: -2, mean: 5, max: 12 })]]);
    expect(buildComparisonSeries(0, 'sensor.temp', 'min', MONTH, [2025], data, NOW).entries[0]!.value).toBe(-2);
    expect(buildComparisonSeries(0, 'sensor.temp', 'mean', MONTH, [2025], data, NOW).entries[0]!.value).toBe(5);
    expect(buildComparisonSeries(0, 'sensor.temp', 'max', MONTH, [2025], data, NOW).entries[0]!.value).toBe(12);
  });
});

describe('buildComparisonSeries — previous-year diff (FR-005)', () => {
  const data = byYear([
    [2023, summaries('sensor.rain', 2023, { total: 8 })],
    [2024, summaries('sensor.rain', 2024, { total: 10 })],
    [2025, summaries('sensor.rain', 2025, { total: 14 })],
  ]);

  it('diffPrev = value(y) − value(y−1)', () => {
    const s = buildComparisonSeries(0, 'sensor.rain', 'total', MONTH, [2023, 2024, 2025], data, NOW);
    expect(s.entries[1]!.diffPrev).toBe(2);
    expect(s.entries[2]!.diffPrev).toBe(4);
  });

  it('the earliest year of the range has no diffPrev', () => {
    const s = buildComparisonSeries(0, 'sensor.rain', 'total', MONTH, [2023, 2024, 2025], data, NOW);
    expect(s.entries[0]!.diffPrev).toBeNull();
  });

  it('diffPrev is omitted (null) when the preceding year has no data — no fallback to older years', () => {
    const gappy = byYear([
      [2023, summaries('sensor.rain', 2023, { total: 8 })],
      [2025, summaries('sensor.rain', 2025, { total: 14 })],
    ]);
    const s = buildComparisonSeries(0, 'sensor.rain', 'total', MONTH, [2023, 2024, 2025], gappy, NOW);
    expect(s.entries[2]!.diffPrev).toBeNull();
  });
});

describe('buildComparisonSeries — cross-year average and diffAvg (FR-006/FR-007/FR-008)', () => {
  it('crossYearAvg is the mean over years with data; diffAvg = value − avg', () => {
    const s = buildComparisonSeries(0, 'sensor.rain', 'total', MONTH, [2023, 2024, 2025], byYear([
      [2023, summaries('sensor.rain', 2023, { total: 8 })],
      [2025, summaries('sensor.rain', 2025, { total: 14 })],
    ]), NOW);
    expect(s.crossYearAvg).toBe(11); // (8 + 14) / 2 — 2024 has no data, excluded
    expect(s.entries[0]!.diffAvg).toBe(-3);
    expect(s.entries[2]!.diffAvg).toBe(3);
  });

  it('the incomplete current month is excluded from the average but keeps its own diffs (FR-007)', () => {
    const now = { year: 2025, month: MONTH };
    const s = buildComparisonSeries(0, 'sensor.rain', 'total', MONTH, [2023, 2024, 2025], byYear([
      [2023, summaries('sensor.rain', 2023, { total: 8 })],
      [2024, summaries('sensor.rain', 2024, { total: 10 })],
      [2025, summaries('sensor.rain', 2025, { total: 3 })],
    ]), now);
    expect(s.crossYearAvg).toBe(9); // (8 + 10) / 2 — 2025 incomplete, excluded
    const e2025 = s.entries[2]!;
    expect(e2025.incomplete).toBe(true);
    expect(e2025.diffPrev).toBe(-7); // still diffed against 2024 (clarification Q3)
    expect(e2025.diffAvg).toBe(-6);
    expect(s.entries[0]!.incomplete).toBe(false);
  });

  it('single complete year: diffPrev null, diffAvg 0', () => {
    const s = buildComparisonSeries(0, 'sensor.rain', 'total', MONTH, [2025], byYear([
      [2025, summaries('sensor.rain', 2025, { total: 14 })],
    ]), NOW);
    expect(s.crossYearAvg).toBe(14);
    expect(s.entries[0]!.diffPrev).toBeNull();
    expect(s.entries[0]!.diffAvg).toBe(0);
  });

  it('lone incomplete current month: crossYearAvg and diffAvg are null (analysis U1)', () => {
    const now = { year: 2025, month: MONTH };
    const s = buildComparisonSeries(0, 'sensor.rain', 'total', MONTH, [2025], byYear([
      [2025, summaries('sensor.rain', 2025, { total: 3 })],
    ]), now);
    expect(s.crossYearAvg).toBeNull();
    expect(s.entries[0]!.diffAvg).toBeNull();
  });
});

describe('buildComparisonSeries — percentages (FR-006a)', () => {
  it('total series carry pctPrev/pctAvg relative to their baselines', () => {
    const s = buildComparisonSeries(0, 'sensor.rain', 'total', MONTH, [2024, 2025], byYear([
      [2024, summaries('sensor.rain', 2024, { total: 10 })],
      [2025, summaries('sensor.rain', 2025, { total: 14 })],
    ]), NOW);
    const e2025 = s.entries[1]!;
    expect(e2025.pctPrev).toBeCloseTo(0.4); // +4 over baseline 10
    expect(e2025.pctAvg).toBeCloseTo(2 / 12); // +2 over avg 12
  });

  it('pct is null when the baseline is zero', () => {
    const s = buildComparisonSeries(0, 'sensor.rain', 'total', MONTH, [2024, 2025], byYear([
      [2024, summaries('sensor.rain', 2024, { total: 0 })],
      [2025, summaries('sensor.rain', 2025, { total: 14 })],
    ]), NOW);
    expect(s.entries[1]!.pctPrev).toBeNull(); // baseline 0
    expect(s.entries[1]!.diffPrev).toBe(14);  // absolute diff still present
  });

  it('non-total components never carry percentages', () => {
    const s = buildComparisonSeries(0, 'sensor.temp', 'mean', MONTH, [2024, 2025], byYear([
      [2024, summaries('sensor.temp', 2024, { mean: 10 })],
      [2025, summaries('sensor.temp', 2025, { mean: 14 })],
    ]), NOW);
    expect(s.entries[1]!.pctPrev).toBeNull();
    expect(s.entries[1]!.pctAvg).toBeNull();
    expect(s.entries[1]!.diffPrev).toBe(4);
  });
});

describe('wrapMonth (FR-017)', () => {
  it('steps forward and backward within the year', () => {
    expect(wrapMonth(5, 1)).toBe(6);
    expect(wrapMonth(5, -1)).toBe(4);
  });

  it('wraps December→January and January→December', () => {
    expect(wrapMonth(12, 1)).toBe(1);
    expect(wrapMonth(1, -1)).toBe(12);
  });

  it('twelve forward steps return to the start month (SC-008)', () => {
    let m = 7;
    for (let i = 0; i < 12; i++) m = wrapMonth(m, 1);
    expect(m).toBe(7);
  });
});
