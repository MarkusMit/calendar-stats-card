import { describe, it, expect } from 'vitest';
import {
  transformDailyStats,
  transformMonthlyStats,
  computeMonthlySummaryFromDailyValues,
  collectDailySums,
} from '../../../src/services/data-transform';
import type { DailyValue, EntityMetadata } from '../../../src/types/statistics';
import type { EntityConfig } from '../../../src/types/card-config';

// Helpers

const TZ = 'UTC';

// Fixed "today" for deterministic tests: 2025-06-15
const TODAY_MS = new Date('2025-06-15T12:00:00Z').getTime();

const precipMeta: EntityMetadata = {
  entityId: 'sensor.rain',
  stateClass: 'total_increasing',
  deviceClass: 'precipitation',
  unitOfMeasurement: 'mm',
  friendlyName: 'Rain',
  hasStatistics: true,
};

const energyMeta: EntityMetadata = {
  entityId: 'sensor.energy',
  stateClass: 'total_increasing',
  deviceClass: 'energy',
  unitOfMeasurement: 'kWh',
  friendlyName: 'Energy',
  hasStatistics: true,
};

const tempMeta: EntityMetadata = {
  entityId: 'sensor.temp',
  stateClass: 'measurement',
  deviceClass: 'temperature',
  unitOfMeasurement: '°C',
  friendlyName: 'Temperature',
  hasStatistics: true,
};

const totalMeta: EntityMetadata = {
  entityId: 'sensor.net',
  stateClass: 'total',
  deviceClass: 'energy',
  unitOfMeasurement: 'kWh',
  friendlyName: 'Net',
  hasStatistics: true,
};

describe('transformDailyStats — cumulative delta', () => {
  it('computes daily delta from consecutive sum values', () => {
    const start1 = new Date('2025-01-01T00:00:00Z').getTime();
    const start2 = new Date('2025-01-02T00:00:00Z').getTime();
    const raw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.energy': [
        { start: start1, end: start1 + 86400_000, sum: 10 },
        { start: start2, end: start2 + 86400_000, sum: 15 },
      ],
    };
    const result = transformDailyStats(raw, { 'sensor.energy': energyMeta }, TZ, TODAY_MS);
    const day1 = result.get('sensor.energy::2025-01-01');
    const day2 = result.get('sensor.energy::2025-01-02');
    expect(day1?.kind).toBe('cumulative');
    if (day1?.kind === 'cumulative') expect(day1.sum).toBe(10);
    expect(day2?.kind).toBe('cumulative');
    if (day2?.kind === 'cumulative') expect(day2.sum).toBe(5);
  });

  it('uses sum[0] directly for the first tracked day', () => {
    const start = new Date('2025-01-01T00:00:00Z').getTime();
    const raw = { 'sensor.energy': [{ start, end: start + 86400_000, sum: 42 }] };
    const result = transformDailyStats(raw, { 'sensor.energy': energyMeta }, TZ, TODAY_MS);
    const day = result.get('sensor.energy::2025-01-01');
    expect(day?.kind).toBe('cumulative');
    if (day?.kind === 'cumulative') expect(day.sum).toBe(42);
  });

  it('negative delta for total_increasing → 0', () => {
    const s1 = new Date('2025-01-01T00:00:00Z').getTime();
    const s2 = new Date('2025-01-02T00:00:00Z').getTime();
    const raw = {
      'sensor.energy': [
        { start: s1, end: s1 + 86400_000, sum: 10 },
        { start: s2, end: s2 + 86400_000, sum: 8 },
      ],
    };
    const result = transformDailyStats(raw, { 'sensor.energy': energyMeta }, TZ, TODAY_MS);
    const day2 = result.get('sensor.energy::2025-01-02');
    expect(day2?.kind).toBe('cumulative');
    if (day2?.kind === 'cumulative') expect(day2.sum).toBe(0);
  });

  it('negative delta for total → preserved as-is', () => {
    const s1 = new Date('2025-01-01T00:00:00Z').getTime();
    const s2 = new Date('2025-01-02T00:00:00Z').getTime();
    const raw = {
      'sensor.net': [
        { start: s1, end: s1 + 86400_000, sum: 10 },
        { start: s2, end: s2 + 86400_000, sum: 7 },
      ],
    };
    const result = transformDailyStats(raw, { 'sensor.net': totalMeta }, TZ, TODAY_MS);
    const day2 = result.get('sensor.net::2025-01-02');
    expect(day2?.kind).toBe('cumulative');
    if (day2?.kind === 'cumulative') expect(day2.sum).toBe(-3);
  });

  it('today in HA server timezone → EmptyDailyValue', () => {
    // TODAY_MS is 2025-06-15T12:00:00Z → "2025-06-15" in UTC
    const start = new Date('2025-06-15T00:00:00Z').getTime();
    const raw = { 'sensor.energy': [{ start, end: start + 86400_000, sum: 5 }] };
    const result = transformDailyStats(raw, { 'sensor.energy': energyMeta }, TZ, TODAY_MS);
    const today = result.get('sensor.energy::2025-06-15');
    expect(today?.kind).toBe('empty');
  });

  it('future day → EmptyDailyValue', () => {
    const start = new Date('2025-07-01T00:00:00Z').getTime();
    const raw = { 'sensor.energy': [{ start, end: start + 86400_000, sum: 5 }] };
    const result = transformDailyStats(raw, { 'sensor.energy': energyMeta }, TZ, TODAY_MS);
    const future = result.get('sensor.energy::2025-07-01');
    expect(future?.kind).toBe('empty');
  });
});

describe('transformDailyStats — measurement', () => {
  it('passes through HA mean/min/max for measurement entity', () => {
    const start = new Date('2025-01-10T00:00:00Z').getTime();
    const raw: Record<string, { start: number; end: number; mean?: number; min?: number; max?: number }[]> = {
      'sensor.temp': [{ start, end: start + 86400_000, mean: 20, min: 15, max: 25 }],
    };
    const result = transformDailyStats(raw, { 'sensor.temp': tempMeta }, TZ, TODAY_MS);
    const day = result.get('sensor.temp::2025-01-10');
    expect(day?.kind).toBe('measurement');
    if (day?.kind === 'measurement') {
      expect(day.mean).toBe(20);
      expect(day.min).toBe(15);
      expect(day.max).toBe(25);
    }
  });
});

describe('transformDailyStats — edge cases', () => {
  it('entity in rawStats but absent from metadataMap → skipped (no DailyValue produced)', () => {
    const start = new Date('2025-01-01T00:00:00Z').getTime();
    const raw = { 'sensor.unknown': [{ start, end: start + 86400_000, sum: 10 }] };
    const result = transformDailyStats(raw, {}, TZ, TODAY_MS);
    expect(result.size).toBe(0);
  });

  it('entry with undefined sum uses 0 as fallback for first tracked day', () => {
    const start = new Date('2025-01-01T00:00:00Z').getTime();
    const raw = { 'sensor.energy': [{ start, end: start + 86400_000 }] }; // no sum
    const result = transformDailyStats(raw, { 'sensor.energy': energyMeta }, TZ, TODAY_MS);
    const day = result.get('sensor.energy::2025-01-01');
    expect(day?.kind).toBe('cumulative');
    if (day?.kind === 'cumulative') expect(day.sum).toBe(0);
  });
});

describe('transformMonthlyStats — edge cases', () => {
  it('entity in rawStats but absent from metadataMap → skipped', () => {
    const start = new Date('2025-01-01T00:00:00Z').getTime();
    const raw = { 'sensor.unknown': [{ start, end: start + 86400_000 }] };
    const result = transformMonthlyStats(raw, {}, new Map(), [], 2025, TZ, TODAY_MS);
    expect(result.size).toBe(0);
  });

  it('cumulative with no matching daily values → min/mean/max null; total = entry.sum (first-month fallback, feature 011)', () => {
    // Under feature 011 total is driven by HA monthly entry.sum, independent of daily values.
    // min/mean/max still require daily values; absent → null.
    const start = new Date('2025-01-01T00:00:00Z').getTime();
    const raw = { 'sensor.energy': [{ start, end: start + 2678400_000, sum: 50 }] };
    const result = transformMonthlyStats(raw, { 'sensor.energy': energyMeta }, new Map(), [{ entity: 'sensor.energy' }], 2025, TZ, TODAY_MS);
    const summary = result.get('0::sensor.energy::2025-1');
    expect(summary?.min).toBeNull();
    expect(summary?.max).toBeNull();
    expect(summary?.mean).toBeNull();
    expect(summary?.total).toBe(50);  // first-month fallback: total = entry.sum (FR-006)
  });
});

describe('transformMonthlyStats', () => {
  it('measurement → min/mean/max computed from daily values, not HA monthly entry', () => {
    const start = new Date('2025-01-01T00:00:00Z').getTime();
    const raw: Record<string, { start: number; end: number; mean?: number; min?: number; max?: number; sum?: number }[]> = {
      'sensor.temp': [{ start, end: start + 2678400_000, mean: 18, min: 5, max: 30 }], // HA entry deliberately differs
    };
    const dailyValues = new Map<string, import('../../../src/types/statistics').DailyValue>([
      ['sensor.temp::2025-01-01', { kind: 'measurement', entityId: 'sensor.temp', date: '2025-01-01', min: -14, mean: -3, max: 10 }],
      ['sensor.temp::2025-01-02', { kind: 'measurement', entityId: 'sensor.temp', date: '2025-01-02', min: -7, mean: 2, max: 8 }],
    ]);
    const result = transformMonthlyStats(raw, { 'sensor.temp': tempMeta }, dailyValues, [{ entity: 'sensor.temp' }], 2025, TZ, TODAY_MS);
    const summary = result.get('0::sensor.temp::2025-1');
    expect(summary).toBeDefined();
    expect(summary?.min).toBe(-14);
    expect(summary?.mean).toBeCloseTo((-3 + 2) / 2);
    expect(summary?.max).toBe(10);
    expect(summary?.total).toBeNull();
  });

  it('measurement with no daily values → null min/mean/max', () => {
    const start = new Date('2025-01-01T00:00:00Z').getTime();
    const raw: Record<string, { start: number; end: number; mean?: number; min?: number; max?: number; sum?: number }[]> = {
      'sensor.temp': [{ start, end: start + 2678400_000, mean: 18, min: 5, max: 30 }],
    };
    const result = transformMonthlyStats(raw, { 'sensor.temp': tempMeta }, new Map(), [{ entity: 'sensor.temp' }], 2025, TZ, TODAY_MS);
    const summary = result.get('0::sensor.temp::2025-1');
    expect(summary).toBeDefined();
    expect(summary?.min).toBeNull();
    expect(summary?.mean).toBeNull();
    expect(summary?.max).toBeNull();
    expect(summary?.total).toBeNull();
  });

  it('cumulative row with show_zero: false → zero-sum days excluded from min/mean/max (FR-002)', () => {
    // Build daily values for Jan 2025: days 1-3 have sum 0, 5, 10
    const dailyValues = new Map([
      ['sensor.rain::2025-01-01', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-01', sum: 0 }],
      ['sensor.rain::2025-01-02', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-02', sum: 5 }],
      ['sensor.rain::2025-01-03', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-03', sum: 10 }],
    ]);
    const monthlyRaw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.rain': [{ start: new Date('2025-01-01T00:00:00Z').getTime(), end: new Date('2025-02-01T00:00:00Z').getTime(), sum: 15 }],
    };
    const cfgs: EntityConfig[] = [{ entity: 'sensor.rain', show_zero: false }];
    const result = transformMonthlyStats(monthlyRaw, { 'sensor.rain': precipMeta }, dailyValues, cfgs, 2025, TZ, TODAY_MS);
    const summary = result.get('0::sensor.rain::2025-1');
    expect(summary?.min).toBe(5);   // 0 excluded
    expect(summary?.max).toBe(10);
    expect(summary?.mean).toBeCloseTo(7.5); // (5+10)/2
  });

  it('cumulative row with show_zero omitted (default true) → zero-sum days INCLUDED in min/mean/max (FR-002)', () => {
    const dailyValues = new Map([
      ['sensor.energy::2025-01-01', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2025-01-01', sum: 0 }],
      ['sensor.energy::2025-01-02', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2025-01-02', sum: 10 }],
    ]);
    const monthlyRaw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.energy': [{ start: new Date('2025-01-01T00:00:00Z').getTime(), end: new Date('2025-02-01T00:00:00Z').getTime(), sum: 10 }],
    };
    const cfgs: EntityConfig[] = [{ entity: 'sensor.energy' }]; // show_zero omitted = default include
    const result = transformMonthlyStats(monthlyRaw, { 'sensor.energy': energyMeta }, dailyValues, cfgs, 2025, TZ, TODAY_MS);
    const summary = result.get('0::sensor.energy::2025-1');
    expect(summary?.min).toBe(0);   // zero included
    expect(summary?.max).toBe(10);
    expect(summary?.mean).toBe(5);
  });

  it('precipitation row + show_zero omitted (default true) → zero-sum days INCLUDED in summary (FR-002 default; new in feature 010)', () => {
    // Pre-feature-010 behaviour: precipitation always excluded zeros.
    // Post-feature-010: only show_zero:false excludes — default-include applies even to precipitation.
    const dailyValues = new Map([
      ['sensor.rain::2025-01-01', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-01', sum: 0 }],
      ['sensor.rain::2025-01-02', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-02', sum: 4 }],
      ['sensor.rain::2025-01-03', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-03', sum: 8 }],
    ]);
    const monthlyRaw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.rain': [{ start: new Date('2025-01-01T00:00:00Z').getTime(), end: new Date('2025-02-01T00:00:00Z').getTime(), sum: 12 }],
    };
    const cfgs: EntityConfig[] = [{ entity: 'sensor.rain' }];
    const result = transformMonthlyStats(monthlyRaw, { 'sensor.rain': precipMeta }, dailyValues, cfgs, 2025, TZ, TODAY_MS);
    const summary = result.get('0::sensor.rain::2025-1');
    expect(summary?.min).toBe(0);   // zero now INCLUDED for precipitation
    expect(summary?.max).toBe(8);
    expect(summary?.mean).toBeCloseTo((0 + 4 + 8) / 3);
  });

  it('cumulative row + show_zero: false + all-zero month → summary min/mean/max are null (FR-006)', () => {
    const dailyValues = new Map([
      ['sensor.energy::2025-01-01', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2025-01-01', sum: 0 }],
      ['sensor.energy::2025-01-02', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2025-01-02', sum: 0 }],
      ['sensor.energy::2025-01-03', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2025-01-03', sum: 0 }],
    ]);
    const monthlyRaw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.energy': [{ start: new Date('2025-01-01T00:00:00Z').getTime(), end: new Date('2025-02-01T00:00:00Z').getTime(), sum: 0 }],
    };
    const cfgs: EntityConfig[] = [{ entity: 'sensor.energy', show_zero: false }];
    const result = transformMonthlyStats(monthlyRaw, { 'sensor.energy': energyMeta }, dailyValues, cfgs, 2025, TZ, TODAY_MS);
    const summary = result.get('0::sensor.energy::2025-1');
    expect(summary).toBeDefined();
    expect(summary?.min).toBeNull();
    expect(summary?.mean).toBeNull();
    expect(summary?.max).toBeNull();
    expect(summary?.total).toBe(0);  // total stays 0 (sum of all days)
  });

  it('total_increasing + counter-reset day (negative delta clamped to 0) + show_zero: false → that day excluded uniformly with naturally-zero day (clarification 2026-05-30)', () => {
    // transformDailyStats clamps negative deltas to 0 for total_increasing entities.
    // After clamp the day is indistinguishable from a naturally-zero day; both must be excluded
    // together when show_zero: false. No origin metadata preserved (YAGNI).
    const d1 = new Date('2025-01-01T00:00:00Z').getTime();
    const d2 = new Date('2025-01-02T00:00:00Z').getTime();
    const d3 = new Date('2025-01-03T00:00:00Z').getTime();
    const d4 = new Date('2025-01-04T00:00:00Z').getTime();
    // Day 1: sum=100 (baseline). Day 2: sum=200 (delta=100). Day 3: sum=50 (negative delta → clamped to 0, counter reset).
    // Day 4: sum=50 (delta=0, naturally zero). With show_zero:false, days 3 and 4 are both excluded.
    const rawDaily: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.energy': [
        { start: d1, end: d1 + 86400_000, sum: 100 },
        { start: d2, end: d2 + 86400_000, sum: 200 },
        { start: d3, end: d3 + 86400_000, sum: 50 },
        { start: d4, end: d4 + 86400_000, sum: 50 },
      ],
    };
    const dailyValues = transformDailyStats(rawDaily, { 'sensor.energy': energyMeta }, TZ, TODAY_MS);
    // Sanity: day 3 was clamped to 0
    const day3Val = dailyValues.get('sensor.energy::2025-01-03');
    expect(day3Val?.kind).toBe('cumulative');
    expect((day3Val as { sum: number }).sum).toBe(0);
    // Day 4 also produces a natural zero delta
    const day4Val = dailyValues.get('sensor.energy::2025-01-04');
    expect((day4Val as { sum: number }).sum).toBe(0);

    const monthlyRaw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.energy': [{ start: d1, end: new Date('2025-02-01T00:00:00Z').getTime(), sum: 100 }],
    };
    const cfgs: EntityConfig[] = [{ entity: 'sensor.energy', show_zero: false }];
    const result = transformMonthlyStats(monthlyRaw, { 'sensor.energy': energyMeta }, dailyValues, cfgs, 2025, TZ, TODAY_MS);
    const summary = result.get('0::sensor.energy::2025-1');
    // Only days 1 (delta=100) and 2 (delta=100) survive the exclusion. Day 1's sum was the baseline (no prevSum) so its delta is 100.
    expect(summary?.min).toBe(100);
    expect(summary?.max).toBe(100);
    expect(summary?.mean).toBe(100);
  });

  it('measurement entity → excludeZero ignored; summary identical with show_zero true vs false (FR-007 regression guard)', () => {
    const dailyValues = new Map([
      ['sensor.temp::2025-01-01', { kind: 'measurement' as const, entityId: 'sensor.temp', date: '2025-01-01', min: -5, mean: 0, max: 5 }],
      ['sensor.temp::2025-01-02', { kind: 'measurement' as const, entityId: 'sensor.temp', date: '2025-01-02', min: -2, mean: 3, max: 10 }],
    ]);
    const monthlyRaw: Record<string, { start: number; end: number; mean?: number; min?: number; max?: number }[]> = {
      'sensor.temp': [{ start: new Date('2025-01-01T00:00:00Z').getTime(), end: new Date('2025-02-01T00:00:00Z').getTime(), mean: 1.5, min: -5, max: 10 }],
    };
    const cfgsWithShow: EntityConfig[] = [{ entity: 'sensor.temp', show_zero: true }];
    const cfgsWithoutShow: EntityConfig[] = [{ entity: 'sensor.temp', show_zero: false }];
    const resultShow = transformMonthlyStats(monthlyRaw, { 'sensor.temp': tempMeta }, dailyValues, cfgsWithShow, 2025, TZ, TODAY_MS);
    const resultHide = transformMonthlyStats(monthlyRaw, { 'sensor.temp': tempMeta }, dailyValues, cfgsWithoutShow, 2025, TZ, TODAY_MS);
    const sShow = resultShow.get('0::sensor.temp::2025-1');
    const sHide = resultHide.get('0::sensor.temp::2025-1');
    // Both summaries identical for measurement state_class (show_zero is inapplicable per FR-007).
    expect(sShow?.min).toBe(sHide?.min);
    expect(sShow?.mean).toBe(sHide?.mean);
    expect(sShow?.max).toBe(sHide?.max);
    expect(sShow?.min).toBe(-5);
    expect(sShow?.max).toBe(10);
  });

  it('duplicate entity rows with conflicting show_zero → each row gets an independent summary keyed by row index (no first-write-wins collision)', () => {
    // Two rows reference the same entity; one wants zeros included, the other excluded.
    // Each row MUST get its own summary entry in the result map.
    const dailyValues = new Map([
      ['sensor.rain::2025-01-01', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-01', sum: 0 }],
      ['sensor.rain::2025-01-02', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-02', sum: 4 }],
      ['sensor.rain::2025-01-03', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-03', sum: 8 }],
    ]);
    const monthlyRaw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.rain': [{ start: new Date('2025-01-01T00:00:00Z').getTime(), end: new Date('2025-02-01T00:00:00Z').getTime(), sum: 12 }],
    };
    const cfgs: EntityConfig[] = [
      { entity: 'sensor.rain', name: 'Rain (include zeros)' },                  // row 0, show_zero default true
      { entity: 'sensor.rain', name: 'Rain (exclude zeros)', show_zero: false }, // row 1, show_zero false
    ];
    const result = transformMonthlyStats(monthlyRaw, { 'sensor.rain': precipMeta }, dailyValues, cfgs, 2025, TZ, TODAY_MS);

    const row0 = result.get('0::sensor.rain::2025-1');
    const row1 = result.get('1::sensor.rain::2025-1');

    expect(row0).toBeDefined();
    expect(row1).toBeDefined();

    // Row 0: zeros included → min=0, mean = (0+4+8)/3
    expect(row0?.min).toBe(0);
    expect(row0?.max).toBe(8);
    expect(row0?.mean).toBeCloseTo((0 + 4 + 8) / 3);

    // Row 1: zeros excluded → min=4, mean = (4+8)/2
    expect(row1?.min).toBe(4);
    expect(row1?.max).toBe(8);
    expect(row1?.mean).toBeCloseTo((4 + 8) / 2);

    // Total is identical for both (FR-004) — every recorded day sums regardless of show_zero
    expect(row0?.total).toBe(12);
    expect(row1?.total).toBe(12);
  });

  it('cumulative monthly total = HA monthly sum delta (FR-002; unaffected by show_zero per FR-004)', () => {
    // After feature 011: total = HA monthly sum[m] - sum[m-1].
    // Jan: no prev-month entry -> first-month fallback uses sum[Jan] directly = 100.
    // Feb: sum[Feb] - sum[Jan] = 130 - 100 = 30.
    // Daily values are still present and drive min/mean/max but no longer drive total.
    const s1 = new Date('2025-01-01T00:00:00Z').getTime();
    const s2 = new Date('2025-02-01T00:00:00Z').getTime();
    const s3 = new Date('2025-03-01T00:00:00Z').getTime();
    const raw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.energy': [
        { start: s1, end: s2, sum: 100 },  // cumulative-since-tracking at end of Jan
        { start: s2, end: s3, sum: 130 },  // cumulative-since-tracking at end of Feb
      ],
    };
    const dailyValues = new Map([
      ['sensor.energy::2025-01-01', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2025-01-01', sum: 3 }],
      ['sensor.energy::2025-01-02', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2025-01-02', sum: 7 }],
      ['sensor.energy::2025-02-01', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2025-02-01', sum: 30 }],
    ]);
    const cfgs: EntityConfig[] = [{ entity: 'sensor.energy', show_zero: false }];
    const result = transformMonthlyStats(raw, { 'sensor.energy': energyMeta }, dailyValues, cfgs, 2025, TZ, TODAY_MS);
    const jan = result.get('0::sensor.energy::2025-1');
    const feb = result.get('0::sensor.energy::2025-2');
    expect(jan?.total).toBe(100);  // first-month fallback: sum[Jan] = 100 (no prev)
    expect(feb?.total).toBe(30);   // sum[Feb] - sum[Jan] = 130 - 100 = 30
  });
});

describe('computeMonthlySummaryFromDailyValues', () => {
  it('measurement entity: min/mean/max from daily entries, total null', () => {
    const dailyValues = new Map([
      ['sensor.temp::2026-05-01', { kind: 'measurement' as const, entityId: 'sensor.temp', date: '2026-05-01', min: 10, mean: 15, max: 20 }],
      ['sensor.temp::2026-05-02', { kind: 'measurement' as const, entityId: 'sensor.temp', date: '2026-05-02', min: 8, mean: 13, max: 18 }],
      ['sensor.temp::2026-05-03', { kind: 'measurement' as const, entityId: 'sensor.temp', date: '2026-05-03', min: 12, mean: 17, max: 22 }],
    ]);
    const result = computeMonthlySummaryFromDailyValues('sensor.temp', 2026, 5, true, false, dailyValues);
    expect(result).not.toBeNull();
    expect(result!.min).toBe(8);
    expect(result!.mean).toBeCloseTo((15 + 13 + 17) / 3);
    expect(result!.max).toBe(22);
    expect(result!.total).toBeNull();
  });

  it('cumulative entity: total = sum of daily sums, min/mean/max from sums', () => {
    const dailyValues = new Map([
      ['sensor.energy::2026-05-01', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2026-05-01', sum: 5 }],
      ['sensor.energy::2026-05-02', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2026-05-02', sum: 3 }],
      ['sensor.energy::2026-05-03', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2026-05-03', sum: 8 }],
    ]);
    const result = computeMonthlySummaryFromDailyValues('sensor.energy', 2026, 5, false, false, dailyValues);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(16);  // 5 + 3 + 8
    expect(result!.min).toBe(3);
    expect(result!.mean).toBeCloseTo((5 + 3 + 8) / 3);
    expect(result!.max).toBe(8);
  });

  it('cumulative entity with excludeZero=true: zero-sum days excluded from min/mean/max, total includes all (FR-002, FR-004)', () => {
    const dailyValues = new Map([
      ['sensor.rain::2026-05-01', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2026-05-01', sum: 0 }],
      ['sensor.rain::2026-05-02', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2026-05-02', sum: 4 }],
      ['sensor.rain::2026-05-03', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2026-05-03', sum: 0 }],
      ['sensor.rain::2026-05-04', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2026-05-04', sum: 6 }],
    ]);
    const result = computeMonthlySummaryFromDailyValues('sensor.rain', 2026, 5, false, true, dailyValues);
    expect(result).not.toBeNull();
    expect(result!.total).toBe(10);  // 0 + 4 + 0 + 6
    expect(result!.min).toBe(4);     // zeros excluded
    expect(result!.mean).toBeCloseTo((4 + 6) / 2);
    expect(result!.max).toBe(6);
  });

  it('no daily data for month: returns null', () => {
    const dailyValues = new Map([
      ['sensor.temp::2026-04-01', { kind: 'measurement' as const, entityId: 'sensor.temp', date: '2026-04-01', min: 5, mean: 10, max: 15 }],
    ]);
    const result = computeMonthlySummaryFromDailyValues('sensor.temp', 2026, 5, true, false, dailyValues);
    expect(result).toBeNull();
  });
});

// US3 — expression rows follow the same show_zero rule.
// The expression-row summary loop in calendar-stats-card.ts uses collectDailySums(..., excludeZero)
// to derive min/mean/max from a row's per-day evaluated sums. The boolean flag comes from
// `cfg.show_zero === false`. These unit tests pin the helper's behaviour directly; the integration
// wiring is verified by the existing expression-row tests in calendar-stats-card.test.ts plus the
// production caller in src/calendar-stats-card.ts line ~321.
describe('collectDailySums — show_zero semantic for expression rows (FR-003)', () => {
  const EXPR = '{{ sensor.a + sensor.b }}';
  const baseDays = new Map([
    [`${EXPR}::2025-01-01`, { kind: 'cumulative' as const, entityId: EXPR, date: '2025-01-01', sum: 0 }],
    [`${EXPR}::2025-01-02`, { kind: 'cumulative' as const, entityId: EXPR, date: '2025-01-02', sum: 5 }],
    [`${EXPR}::2025-01-03`, { kind: 'cumulative' as const, entityId: EXPR, date: '2025-01-03', sum: 0 }],
    [`${EXPR}::2025-01-04`, { kind: 'cumulative' as const, entityId: EXPR, date: '2025-01-04', sum: 10 }],
  ]);

  it('expression row with show_zero: false → collectDailySums returns only non-zero days', () => {
    const sums = collectDailySums(EXPR, 2025, 1, baseDays, true /* excludeZero, as derived from show_zero === false */);
    expect(sums.sort((a, b) => a - b)).toEqual([5, 10]);
  });

  it('expression row with show_zero omitted (default true) → collectDailySums returns every recorded day including zeros', () => {
    const sums = collectDailySums(EXPR, 2025, 1, baseDays, false /* excludeZero, default include */);
    expect(sums.sort((a, b) => a - b)).toEqual([0, 0, 5, 10]);
  });
});

// Feature 011 — HA monthly sum delta for cumulative-row totals.
// transformMonthlyStats now reads entry.sum and computes total = sum[m] - sum[m-1] with
// first-month fallback and per-state-class negative-delta clamp. Daily-sum arithmetic is
// no longer the source of total for cumulative entity rows.
describe('transformMonthlyStats — HA monthly sum delta (feature 011)', () => {
  const tsJan2025 = new Date('2025-01-01T00:00:00Z').getTime();
  const tsFeb2025 = new Date('2025-02-01T00:00:00Z').getTime();
  const tsMar2025 = new Date('2025-03-01T00:00:00Z').getTime();
  const tsDec2024 = new Date('2024-12-01T00:00:00Z').getTime();

  it('T003 — first tracked month uses sum directly (FR-006)', () => {
    // Single monthly entry; no prev-month → total = entry.sum.
    const raw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.energy': [{ start: tsJan2025, end: tsFeb2025, sum: 250 }],
    };
    const result = transformMonthlyStats(raw, { 'sensor.energy': energyMeta }, new Map(), [{ entity: 'sensor.energy' }], 2025, TZ, TODAY_MS);
    const jan = result.get('0::sensor.energy::2025-1');
    expect(jan?.total).toBe(250);
  });

  it('T004 — missing entry.sum → total is null', () => {
    const raw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.energy': [{ start: tsJan2025, end: tsFeb2025 /* sum omitted */ }],
    };
    const result = transformMonthlyStats(raw, { 'sensor.energy': energyMeta }, new Map(), [{ entity: 'sensor.energy' }], 2025, TZ, TODAY_MS);
    const jan = result.get('0::sensor.energy::2025-1');
    expect(jan?.total).toBeNull();
  });

  it('T005 — total_increasing: negative monthly delta clamps to 0 (FR-002a counter-reset anomaly)', () => {
    // Jan sum 1000 → Feb sum 50 (meter reset); raw Feb delta = -950 → clamped to 0.
    const raw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.energy': [
        { start: tsJan2025, end: tsFeb2025, sum: 1000 },
        { start: tsFeb2025, end: tsMar2025, sum: 50 },
      ],
    };
    const result = transformMonthlyStats(raw, { 'sensor.energy': energyMeta }, new Map(), [{ entity: 'sensor.energy' }], 2025, TZ, TODAY_MS);
    const feb = result.get('0::sensor.energy::2025-2');
    expect(feb?.total).toBe(0);  // clamped: total_increasing never goes negative
  });

  it('T006 — total: negative monthly delta passes through as-is (FR-002a legitimate net export)', () => {
    // Same shape as T005 but stateClass: 'total' → negative is legitimate.
    const raw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.net': [
        { start: tsJan2025, end: tsFeb2025, sum: 1000 },
        { start: tsFeb2025, end: tsMar2025, sum: 50 },
      ],
    };
    const result = transformMonthlyStats(raw, { 'sensor.net': totalMeta }, new Map(), [{ entity: 'sensor.net' }], 2025, TZ, TODAY_MS);
    const feb = result.get('0::sensor.net::2025-2');
    expect(feb?.total).toBe(-950);  // raw delta preserved for `total` state class
  });

  it('T007 — monthly gap → post-gap month uses sum directly (Research Q2 gap-handling)', () => {
    // Jan and March entries exist; February is missing.
    // March's prev entry is January (not the immediately preceding month),
    // so March falls back to sum[Mar] directly rather than subtracting Jan's stale sum.
    const raw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.energy': [
        { start: tsJan2025, end: tsFeb2025, sum: 100 },
        { start: tsMar2025, end: new Date('2025-04-01T00:00:00Z').getTime(), sum: 350 },
      ],
    };
    const result = transformMonthlyStats(raw, { 'sensor.energy': energyMeta }, new Map(), [{ entity: 'sensor.energy' }], 2025, TZ, TODAY_MS);
    const jan = result.get('0::sensor.energy::2025-1');
    const mar = result.get('0::sensor.energy::2025-3');
    expect(jan?.total).toBe(100);   // first tracked month
    expect(mar?.total).toBe(350);   // gap → first-month fallback (not 350 - 100 = 250)
  });

  it('T008 — prev-December raw entry (year-1) does NOT produce a summary entry in the result map', () => {
    // Dec-2024 is fetched only as a lookup source for Jan-2025's cross-year delta.
    // It MUST be skipped when emitting summaries (viewingYear filter).
    const raw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.energy': [
        { start: tsDec2024, end: tsJan2025, sum: 500 },   // lookup-only
        { start: tsJan2025, end: tsFeb2025, sum: 800 },   // viewing year
      ],
    };
    const result = transformMonthlyStats(raw, { 'sensor.energy': energyMeta }, new Map(), [{ entity: 'sensor.energy' }], 2025, TZ, TODAY_MS);
    expect(result.has('0::sensor.energy::2024-12')).toBe(false);
    expect(result.has('0::sensor.energy::2025-1')).toBe(true);
    const jan = result.get('0::sensor.energy::2025-1');
    expect(jan?.total).toBe(300);  // cross-year delta: 800 - 500 (US2 territory but proven here too)
  });

  it('T008a — measurement entity summary unaffected by HA-sum-delta refactor (FR-003, SC-004 regression guard)', () => {
    // Measurement entities skip the HA-sum-delta path. min/mean/max from daily values; total null.
    const raw: Record<string, { start: number; end: number; mean?: number; min?: number; max?: number; sum?: number }[]> = {
      // HA monthly entry for measurement — sum/min/max would mislead if naively read; must be ignored.
      'sensor.temp': [{ start: tsJan2025, end: tsFeb2025, mean: 18, min: 5, max: 30, sum: 999 }],
    };
    const dailyValues = new Map([
      ['sensor.temp::2025-01-01', { kind: 'measurement' as const, entityId: 'sensor.temp', date: '2025-01-01', min: -14, mean: -3, max: 10 }],
      ['sensor.temp::2025-01-02', { kind: 'measurement' as const, entityId: 'sensor.temp', date: '2025-01-02', min: -7, mean: 2, max: 8 }],
    ]);
    const result = transformMonthlyStats(raw, { 'sensor.temp': tempMeta }, dailyValues, [{ entity: 'sensor.temp' }], 2025, TZ, TODAY_MS);
    const summary = result.get('0::sensor.temp::2025-1');
    expect(summary).toBeDefined();
    expect(summary?.min).toBe(-14);                 // from daily, not HA monthly min=5
    expect(summary?.mean).toBeCloseTo((-3 + 2) / 2); // from daily, not HA monthly mean=18
    expect(summary?.max).toBe(10);                  // from daily, not HA monthly max=30
    expect(summary?.total).toBeNull();              // measurement entities have no total
  });
});

describe('transformMonthlyStats — timezone bucket attribution', () => {
  // HA returns monthly buckets starting at LOCAL midnight in the server timezone.
  // In Europe/Vienna (UTC+2 in summer) the May bucket starts 2026-04-30T22:00:00Z;
  // UTC getters mislabel it as April, shifting every monthly total back one month.
  it('attributes monthly buckets via HA timezone, not UTC (bug: May column showed June-to-date total)', () => {
    const monthlyRaw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.rain': [
        { start: Date.parse('2026-03-31T22:00:00Z'), end: Date.parse('2026-04-30T22:00:00Z'), sum: 100 }, // April bucket
        { start: Date.parse('2026-04-30T22:00:00Z'), end: Date.parse('2026-05-31T22:00:00Z'), sum: 130 }, // May bucket
        { start: Date.parse('2026-05-31T22:00:00Z'), end: Date.parse('2026-06-30T22:00:00Z'), sum: 137 }, // June bucket (in progress)
      ],
    };
    const cfgs: EntityConfig[] = [{ entity: 'sensor.rain' }];
    const result = transformMonthlyStats(monthlyRaw, { 'sensor.rain': precipMeta }, new Map(), cfgs, 2026, 'Europe/Vienna', TODAY_MS);
    expect(result.get('0::sensor.rain::2026-4')?.total).toBe(100); // first-tracked-month fallback
    expect(result.get('0::sensor.rain::2026-5')?.total).toBe(30);  // May = 130 - 100
    expect(result.get('0::sensor.rain::2026-6')?.total).toBe(7);   // June-to-date = 137 - 130
  });

  it('January bucket starting Dec 31 UTC (local midnight Jan 1 CET) is not dropped by the viewing-year guard', () => {
    const monthlyRaw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.rain': [
        { start: Date.parse('2025-12-31T23:00:00Z'), end: Date.parse('2026-01-31T23:00:00Z'), sum: 20 }, // Jan 2026 bucket (CET = UTC+1)
      ],
    };
    const cfgs: EntityConfig[] = [{ entity: 'sensor.rain' }];
    const result = transformMonthlyStats(monthlyRaw, { 'sensor.rain': precipMeta }, new Map(), cfgs, 2026, 'Europe/Vienna', TODAY_MS);
    expect(result.get('0::sensor.rain::2026-1')?.total).toBe(20);
  });

  it('Dec-of-prior-year lookup bucket (local midnight Dec 1 CET) stays excluded from summaries', () => {
    const monthlyRaw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.rain': [
        { start: Date.parse('2025-11-30T23:00:00Z'), end: Date.parse('2025-12-31T23:00:00Z'), sum: 10 }, // Dec 2025 bucket
        { start: Date.parse('2025-12-31T23:00:00Z'), end: Date.parse('2026-01-31T23:00:00Z'), sum: 25 }, // Jan 2026 bucket
      ],
    };
    const cfgs: EntityConfig[] = [{ entity: 'sensor.rain' }];
    const result = transformMonthlyStats(monthlyRaw, { 'sensor.rain': precipMeta }, new Map(), cfgs, 2026, 'Europe/Vienna', TODAY_MS);
    expect(result.get('0::sensor.rain::2025-12')).toBeUndefined(); // lookup-only, FR-007
    expect(result.get('0::sensor.rain::2026-1')?.total).toBe(15);  // cross-year delta: 25 - 10
  });
});

describe('transformMonthlyStats — current month total excludes today', () => {
  // TODAY_MS is 2025-06-15 in UTC, so June 2025 is the current (incomplete) month
  // and May 2025 is a completed month.
  const tsApr2025 = new Date('2025-04-01T00:00:00Z').getTime();
  const tsMay2025 = new Date('2025-05-01T00:00:00Z').getTime();
  const tsJun2025 = new Date('2025-06-01T00:00:00Z').getTime();
  const tsJul2025 = new Date('2025-07-01T00:00:00Z').getTime();

  /** Daily cumulative values for `day` = 1..count of the given month, each worth `perDay`. */
  function dailySums(entityId: string, month: number, count: number, perDay: number) {
    const map = new Map<string, DailyValue>();
    for (let day = 1; day <= count; day++) {
      const date = `2025-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      map.set(`${entityId}::${date}`, {
        kind: 'cumulative',
        entityId,
        date,
        sum: perDay,
      });
    }
    return map;
  }

  it('current month total comes from completed daily values, not the HA monthly bucket (FR-003)', () => {
    // HA's June bucket already contains today's partial hours: 175 - 100 = 75.
    // The rendered day cells only cover June 1–14 → 14 x 5 = 70.
    const raw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.energy': [
        { start: tsMay2025, end: tsJun2025, sum: 100 },
        { start: tsJun2025, end: tsJul2025, sum: 175 },
      ],
    };
    const dailyValues = dailySums('sensor.energy', 6, 14, 5);
    const result = transformMonthlyStats(raw, { 'sensor.energy': energyMeta }, dailyValues, [{ entity: 'sensor.energy' }], 2025, TZ, TODAY_MS);

    expect(result.get('0::sensor.energy::2025-6')?.total).toBe(70);
  });

  it('completed months keep the HA monthly sum delta even when it differs from the daily sum', () => {
    // May delta = 100 - 40 = 60; the daily values deliberately add up to 55 only.
    const raw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.energy': [
        { start: tsApr2025, end: tsMay2025, sum: 40 },
        { start: tsMay2025, end: tsJun2025, sum: 100 },
      ],
    };
    const dailyValues = dailySums('sensor.energy', 5, 11, 5);
    const result = transformMonthlyStats(raw, { 'sensor.energy': energyMeta }, dailyValues, [{ entity: 'sensor.energy' }], 2025, TZ, TODAY_MS);

    expect(result.get('0::sensor.energy::2025-5')?.total).toBe(60);
  });

  it('current month with no completed days → total is null (first day of the month)', () => {
    const raw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.energy': [
        { start: tsMay2025, end: tsJun2025, sum: 100 },
        { start: tsJun2025, end: tsJul2025, sum: 112 },
      ],
    };
    const result = transformMonthlyStats(raw, { 'sensor.energy': energyMeta }, new Map(), [{ entity: 'sensor.energy' }], 2025, TZ, TODAY_MS);

    expect(result.get('0::sensor.energy::2025-6')?.total).toBeNull();
  });

  it('current month total ignores show_zero — zero days contribute 0 either way', () => {
    const dailyValues = dailySums('sensor.rain', 6, 14, 0);
    dailyValues.set('sensor.rain::2025-06-03', {
      kind: 'cumulative', entityId: 'sensor.rain', date: '2025-06-03', sum: 12,
    });
    const raw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.rain': [
        { start: tsMay2025, end: tsJun2025, sum: 200 },
        { start: tsJun2025, end: tsJul2025, sum: 219 },
      ],
    };
    const cfgs: EntityConfig[] = [{ entity: 'sensor.rain', show_zero: false }];
    const result = transformMonthlyStats(raw, { 'sensor.rain': precipMeta }, dailyValues, cfgs, 2025, TZ, TODAY_MS);

    expect(result.get('0::sensor.rain::2025-6')?.total).toBe(12);
  });

  it('measurement rows in the current month still have a null total', () => {
    const raw: Record<string, { start: number; end: number; mean?: number; min?: number; max?: number; sum?: number }[]> = {
      'sensor.temp': [{ start: tsJun2025, end: tsJul2025, mean: 18, min: 5, max: 30, sum: 999 }],
    };
    const dailyValues = new Map<string, DailyValue>([
      ['sensor.temp::2025-06-01', { kind: 'measurement', entityId: 'sensor.temp', date: '2025-06-01', min: 10, mean: 15, max: 20 }],
    ]);
    const result = transformMonthlyStats(raw, { 'sensor.temp': tempMeta }, dailyValues, [{ entity: 'sensor.temp' }], 2025, TZ, TODAY_MS);

    expect(result.get('0::sensor.temp::2025-6')?.total).toBeNull();
  });
});

describe('transformMonthlyStats - months covered only by predecessor daily values', () => {
  it('measurement row gets a summary for a month without an HA monthly bucket of its own', () => {
    // Main sensor only started in March; January carries predecessor-resolved daily values.
    const tsMar2025 = new Date('2025-03-01T00:00:00Z').getTime();
    const raw = {
      'sensor.temp': [{ start: tsMar2025, end: tsMar2025 + 2678400_000, mean: 18, min: 5, max: 30 }],
    };
    const dailyValues = new Map<string, DailyValue>([
      ['sensor.temp::2025-01-01', { kind: 'measurement', entityId: 'sensor.temp', date: '2025-01-01', min: -14, mean: -3, max: 10 }],
      ['sensor.temp::2025-01-02', { kind: 'measurement', entityId: 'sensor.temp', date: '2025-01-02', min: -7, mean: 2, max: 8 }],
      ['sensor.temp::2025-03-01', { kind: 'measurement', entityId: 'sensor.temp', date: '2025-03-01', min: 1, mean: 5, max: 9 }],
    ]);
    const result = transformMonthlyStats(raw, { 'sensor.temp': tempMeta }, dailyValues, [{ entity: 'sensor.temp' }], 2025, TZ, TODAY_MS);
    const jan = result.get('0::sensor.temp::2025-1');
    expect(jan).toBeDefined();
    expect(jan?.min).toBe(-14);
    expect(jan?.max).toBe(10);
    expect(jan?.total).toBeNull();
    expect(result.get('0::sensor.temp::2025-2')).toBeUndefined();
    expect(result.get('0::sensor.temp::2025-3')?.min).toBe(1);
  });

  it('cumulative row gets min/mean/max but an empty total for a month without an HA monthly bucket', () => {
    const tsMar2025 = new Date('2025-03-01T00:00:00Z').getTime();
    const raw = {
      'sensor.energy': [{ start: tsMar2025, end: tsMar2025 + 2678400_000, sum: 100 }],
    };
    const dailyValues = new Map<string, DailyValue>([
      ['sensor.energy::2025-01-01', { kind: 'cumulative', entityId: 'sensor.energy', date: '2025-01-01', sum: 4 }],
      ['sensor.energy::2025-01-02', { kind: 'cumulative', entityId: 'sensor.energy', date: '2025-01-02', sum: 6 }],
    ]);
    const result = transformMonthlyStats(raw, { 'sensor.energy': energyMeta }, dailyValues, [{ entity: 'sensor.energy' }], 2025, TZ, TODAY_MS);
    const jan = result.get('0::sensor.energy::2025-1');
    expect(jan?.min).toBe(4);
    expect(jan?.max).toBe(6);
    expect(jan?.mean).toBe(5);
    expect(jan?.total).toBeNull();
  });
});
