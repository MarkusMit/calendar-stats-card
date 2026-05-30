import { describe, it, expect } from 'vitest';
import {
  transformDailyStats,
  transformMonthlyStats,
  computeMonthlySummaryFromDailyValues,
  collectDailySums,
} from '../../../src/services/data-transform';
import type { EntityMetadata } from '../../../src/types/statistics';
import type { EntityConfig } from '../../../src/types/card-config';

// Helpers
function makeHourlyStats(entityId: string, dates: string[]): Record<string, { start: number; end: number; sum?: number; mean?: number; min?: number; max?: number }[]> {
  const result: Record<string, { start: number; end: number; sum?: number; mean?: number; min?: number; max?: number }[]> = {};
  result[entityId] = dates.map((d) => {
    const [year, month, day, hour] = d.split('-').map(Number);
    const start = new Date(year!, month! - 1, day!, hour!).getTime();
    return { start, end: start + 3600_000, sum: 1 };
  });
  return result;
}

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
    const result = transformDailyStats(raw, { 'sensor.energy': energyMeta }, TZ, TODAY_MS, {});
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
    const result = transformDailyStats(raw, { 'sensor.energy': energyMeta }, TZ, TODAY_MS, {});
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
    const result = transformDailyStats(raw, { 'sensor.energy': energyMeta }, TZ, TODAY_MS, {});
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
    const result = transformDailyStats(raw, { 'sensor.net': totalMeta }, TZ, TODAY_MS, {});
    const day2 = result.get('sensor.net::2025-01-02');
    expect(day2?.kind).toBe('cumulative');
    if (day2?.kind === 'cumulative') expect(day2.sum).toBe(-3);
  });

  it('today in HA server timezone → EmptyDailyValue', () => {
    // TODAY_MS is 2025-06-15T12:00:00Z → "2025-06-15" in UTC
    const start = new Date('2025-06-15T00:00:00Z').getTime();
    const raw = { 'sensor.energy': [{ start, end: start + 86400_000, sum: 5 }] };
    const result = transformDailyStats(raw, { 'sensor.energy': energyMeta }, TZ, TODAY_MS, {});
    const today = result.get('sensor.energy::2025-06-15');
    expect(today?.kind).toBe('empty');
  });

  it('future day → EmptyDailyValue', () => {
    const start = new Date('2025-07-01T00:00:00Z').getTime();
    const raw = { 'sensor.energy': [{ start, end: start + 86400_000, sum: 5 }] };
    const result = transformDailyStats(raw, { 'sensor.energy': energyMeta }, TZ, TODAY_MS, {});
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
    const result = transformDailyStats(raw, { 'sensor.temp': tempMeta }, TZ, TODAY_MS, {});
    const day = result.get('sensor.temp::2025-01-10');
    expect(day?.kind).toBe('measurement');
    if (day?.kind === 'measurement') {
      expect(day.mean).toBe(20);
      expect(day.min).toBe(15);
      expect(day.max).toBe(25);
    }
  });
});

describe('transformDailyStats — partialCoverage', () => {
  it('measurement with < 24 hourly entries → partialCoverage: true', () => {
    const start = new Date('2025-01-05T00:00:00Z').getTime();
    const rawDaily: Record<string, { start: number; end: number; mean?: number; min?: number; max?: number }[]> = {
      'sensor.temp': [{ start, end: start + 86400_000, mean: 20, min: 15, max: 25 }],
    };
    // Only 12 hourly entries for 2025-01-05
    const hourlyDates = Array.from({ length: 12 }, (_, i) => `2025-1-5-${i}`);
    const hourly = makeHourlyStats('sensor.temp', hourlyDates);
    const result = transformDailyStats(rawDaily, { 'sensor.temp': tempMeta }, TZ, TODAY_MS, hourly);
    const day = result.get('sensor.temp::2025-01-05');
    expect(day?.kind).toBe('measurement');
    if (day?.kind === 'measurement') expect(day.partialCoverage).toBe(true);
  });

  it('cumulative: missing first hour → partialCoverage: true', () => {
    const start = new Date('2025-01-05T00:00:00Z').getTime();
    const rawDaily = { 'sensor.energy': [{ start, end: start + 86400_000, sum: 10 }] };
    // Hours 1–23 present, 0 missing
    const hourlyDates = Array.from({ length: 23 }, (_, i) => `2025-1-5-${i + 1}`);
    const hourly = makeHourlyStats('sensor.energy', hourlyDates);
    const result = transformDailyStats(rawDaily, { 'sensor.energy': energyMeta }, TZ, TODAY_MS, hourly);
    const day = result.get('sensor.energy::2025-01-05');
    expect(day?.kind).toBe('cumulative');
    if (day?.kind === 'cumulative') expect(day.partialCoverage).toBe(true);
  });

  it('cumulative: missing last hour → partialCoverage: true', () => {
    const start = new Date('2025-01-05T00:00:00Z').getTime();
    const rawDaily = { 'sensor.energy': [{ start, end: start + 86400_000, sum: 10 }] };
    // Hours 0–22 present, 23 missing
    const hourlyDates = Array.from({ length: 23 }, (_, i) => `2025-1-5-${i}`);
    const hourly = makeHourlyStats('sensor.energy', hourlyDates);
    const result = transformDailyStats(rawDaily, { 'sensor.energy': energyMeta }, TZ, TODAY_MS, hourly);
    const day = result.get('sensor.energy::2025-01-05');
    expect(day?.kind).toBe('cumulative');
    if (day?.kind === 'cumulative') expect(day.partialCoverage).toBe(true);
  });

  it('partialCoverage: false when hourly data unavailable', () => {
    const start = new Date('2025-01-05T00:00:00Z').getTime();
    const rawDaily = { 'sensor.energy': [{ start, end: start + 86400_000, sum: 10 }] };
    const result = transformDailyStats(rawDaily, { 'sensor.energy': energyMeta }, TZ, TODAY_MS, {});
    const day = result.get('sensor.energy::2025-01-05');
    expect(day?.kind).toBe('cumulative');
    if (day?.kind === 'cumulative') expect(day.partialCoverage).toBe(false);
  });
});

describe('transformDailyStats — edge cases', () => {
  it('entity in rawStats but absent from metadataMap → skipped (no DailyValue produced)', () => {
    const start = new Date('2025-01-01T00:00:00Z').getTime();
    const raw = { 'sensor.unknown': [{ start, end: start + 86400_000, sum: 10 }] };
    const result = transformDailyStats(raw, {}, TZ, TODAY_MS, {});
    expect(result.size).toBe(0);
  });

  it('entry with undefined sum uses 0 as fallback for first tracked day', () => {
    const start = new Date('2025-01-01T00:00:00Z').getTime();
    const raw = { 'sensor.energy': [{ start, end: start + 86400_000 }] }; // no sum
    const result = transformDailyStats(raw, { 'sensor.energy': energyMeta }, TZ, TODAY_MS, {});
    const day = result.get('sensor.energy::2025-01-01');
    expect(day?.kind).toBe('cumulative');
    if (day?.kind === 'cumulative') expect(day.sum).toBe(0);
  });
});

describe('transformMonthlyStats — edge cases', () => {
  it('entity in rawStats but absent from metadataMap → skipped', () => {
    const start = new Date('2025-01-01T00:00:00Z').getTime();
    const raw = { 'sensor.unknown': [{ start, end: start + 86400_000 }] };
    const result = transformMonthlyStats(raw, {}, new Map(), []);
    expect(result.size).toBe(0);
  });

  it('cumulative with no matching daily values → min/mean/max/total are null', () => {
    const start = new Date('2025-01-01T00:00:00Z').getTime();
    const raw = { 'sensor.energy': [{ start, end: start + 2678400_000, sum: 50 }] };
    const result = transformMonthlyStats(raw, { 'sensor.energy': energyMeta }, new Map(), [{ entity: 'sensor.energy' }]);
    const summary = result.get('0::sensor.energy::2025-1');
    expect(summary?.min).toBeNull();
    expect(summary?.max).toBeNull();
    expect(summary?.mean).toBeNull();
    expect(summary?.total).toBeNull();
  });
});

describe('transformMonthlyStats', () => {
  it('measurement → min/mean/max computed from daily values, not HA monthly entry', () => {
    const start = new Date('2025-01-01T00:00:00Z').getTime();
    const raw: Record<string, { start: number; end: number; mean?: number; min?: number; max?: number; sum?: number }[]> = {
      'sensor.temp': [{ start, end: start + 2678400_000, mean: 18, min: 5, max: 30 }], // HA entry deliberately differs
    };
    const dailyValues = new Map<string, import('../../../src/types/statistics').DailyValue>([
      ['sensor.temp::2025-01-01', { kind: 'measurement', entityId: 'sensor.temp', date: '2025-01-01', min: -14, mean: -3, max: 10, partialCoverage: false }],
      ['sensor.temp::2025-01-02', { kind: 'measurement', entityId: 'sensor.temp', date: '2025-01-02', min: -7, mean: 2, max: 8, partialCoverage: false }],
    ]);
    const result = transformMonthlyStats(raw, { 'sensor.temp': tempMeta }, dailyValues, [{ entity: 'sensor.temp' }]);
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
    const result = transformMonthlyStats(raw, { 'sensor.temp': tempMeta }, new Map(), [{ entity: 'sensor.temp' }]);
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
      ['sensor.rain::2025-01-01', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-01', sum: 0, partialCoverage: false }],
      ['sensor.rain::2025-01-02', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-02', sum: 5, partialCoverage: false }],
      ['sensor.rain::2025-01-03', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-03', sum: 10, partialCoverage: false }],
    ]);
    const monthlyRaw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.rain': [{ start: new Date('2025-01-01T00:00:00Z').getTime(), end: new Date('2025-02-01T00:00:00Z').getTime(), sum: 15 }],
    };
    const cfgs: EntityConfig[] = [{ entity: 'sensor.rain', show_zero: false }];
    const result = transformMonthlyStats(monthlyRaw, { 'sensor.rain': precipMeta }, dailyValues, cfgs);
    const summary = result.get('0::sensor.rain::2025-1');
    expect(summary?.min).toBe(5);   // 0 excluded
    expect(summary?.max).toBe(10);
    expect(summary?.mean).toBeCloseTo(7.5); // (5+10)/2
  });

  it('cumulative row with show_zero omitted (default true) → zero-sum days INCLUDED in min/mean/max (FR-002)', () => {
    const dailyValues = new Map([
      ['sensor.energy::2025-01-01', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2025-01-01', sum: 0, partialCoverage: false }],
      ['sensor.energy::2025-01-02', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2025-01-02', sum: 10, partialCoverage: false }],
    ]);
    const monthlyRaw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.energy': [{ start: new Date('2025-01-01T00:00:00Z').getTime(), end: new Date('2025-02-01T00:00:00Z').getTime(), sum: 10 }],
    };
    const cfgs: EntityConfig[] = [{ entity: 'sensor.energy' }]; // show_zero omitted = default include
    const result = transformMonthlyStats(monthlyRaw, { 'sensor.energy': energyMeta }, dailyValues, cfgs);
    const summary = result.get('0::sensor.energy::2025-1');
    expect(summary?.min).toBe(0);   // zero included
    expect(summary?.max).toBe(10);
    expect(summary?.mean).toBe(5);
  });

  it('precipitation row + show_zero omitted (default true) → zero-sum days INCLUDED in summary (FR-002 default; new in feature 010)', () => {
    // Pre-feature-010 behaviour: precipitation always excluded zeros.
    // Post-feature-010: only show_zero:false excludes — default-include applies even to precipitation.
    const dailyValues = new Map([
      ['sensor.rain::2025-01-01', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-01', sum: 0, partialCoverage: false }],
      ['sensor.rain::2025-01-02', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-02', sum: 4, partialCoverage: false }],
      ['sensor.rain::2025-01-03', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-03', sum: 8, partialCoverage: false }],
    ]);
    const monthlyRaw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.rain': [{ start: new Date('2025-01-01T00:00:00Z').getTime(), end: new Date('2025-02-01T00:00:00Z').getTime(), sum: 12 }],
    };
    const cfgs: EntityConfig[] = [{ entity: 'sensor.rain' }];
    const result = transformMonthlyStats(monthlyRaw, { 'sensor.rain': precipMeta }, dailyValues, cfgs);
    const summary = result.get('0::sensor.rain::2025-1');
    expect(summary?.min).toBe(0);   // zero now INCLUDED for precipitation
    expect(summary?.max).toBe(8);
    expect(summary?.mean).toBeCloseTo((0 + 4 + 8) / 3);
  });

  it('cumulative row + show_zero: false + all-zero month → summary min/mean/max are null (FR-006)', () => {
    const dailyValues = new Map([
      ['sensor.energy::2025-01-01', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2025-01-01', sum: 0, partialCoverage: false }],
      ['sensor.energy::2025-01-02', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2025-01-02', sum: 0, partialCoverage: false }],
      ['sensor.energy::2025-01-03', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2025-01-03', sum: 0, partialCoverage: false }],
    ]);
    const monthlyRaw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.energy': [{ start: new Date('2025-01-01T00:00:00Z').getTime(), end: new Date('2025-02-01T00:00:00Z').getTime(), sum: 0 }],
    };
    const cfgs: EntityConfig[] = [{ entity: 'sensor.energy', show_zero: false }];
    const result = transformMonthlyStats(monthlyRaw, { 'sensor.energy': energyMeta }, dailyValues, cfgs);
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
    // together when show_zero: false. No origin metadata preserved (YAGNI per Constitution V).
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
    const dailyValues = transformDailyStats(rawDaily, { 'sensor.energy': energyMeta }, TZ, TODAY_MS, {});
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
    const result = transformMonthlyStats(monthlyRaw, { 'sensor.energy': energyMeta }, dailyValues, cfgs);
    const summary = result.get('0::sensor.energy::2025-1');
    // Only days 1 (delta=100) and 2 (delta=100) survive the exclusion. Day 1's sum was the baseline (no prevSum) so its delta is 100.
    expect(summary?.min).toBe(100);
    expect(summary?.max).toBe(100);
    expect(summary?.mean).toBe(100);
  });

  it('measurement entity → excludeZero ignored; summary identical with show_zero true vs false (FR-007 regression guard)', () => {
    const dailyValues = new Map([
      ['sensor.temp::2025-01-01', { kind: 'measurement' as const, entityId: 'sensor.temp', date: '2025-01-01', min: -5, mean: 0, max: 5, partialCoverage: false }],
      ['sensor.temp::2025-01-02', { kind: 'measurement' as const, entityId: 'sensor.temp', date: '2025-01-02', min: -2, mean: 3, max: 10, partialCoverage: false }],
    ]);
    const monthlyRaw: Record<string, { start: number; end: number; mean?: number; min?: number; max?: number }[]> = {
      'sensor.temp': [{ start: new Date('2025-01-01T00:00:00Z').getTime(), end: new Date('2025-02-01T00:00:00Z').getTime(), mean: 1.5, min: -5, max: 10 }],
    };
    const cfgsWithShow: EntityConfig[] = [{ entity: 'sensor.temp', show_zero: true }];
    const cfgsWithoutShow: EntityConfig[] = [{ entity: 'sensor.temp', show_zero: false }];
    const resultShow = transformMonthlyStats(monthlyRaw, { 'sensor.temp': tempMeta }, dailyValues, cfgsWithShow);
    const resultHide = transformMonthlyStats(monthlyRaw, { 'sensor.temp': tempMeta }, dailyValues, cfgsWithoutShow);
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
      ['sensor.rain::2025-01-01', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-01', sum: 0, partialCoverage: false }],
      ['sensor.rain::2025-01-02', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-02', sum: 4, partialCoverage: false }],
      ['sensor.rain::2025-01-03', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-03', sum: 8, partialCoverage: false }],
    ]);
    const monthlyRaw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.rain': [{ start: new Date('2025-01-01T00:00:00Z').getTime(), end: new Date('2025-02-01T00:00:00Z').getTime(), sum: 12 }],
    };
    const cfgs: EntityConfig[] = [
      { entity: 'sensor.rain', name: 'Rain (include zeros)' },                  // row 0, show_zero default true
      { entity: 'sensor.rain', name: 'Rain (exclude zeros)', show_zero: false }, // row 1, show_zero false
    ];
    const result = transformMonthlyStats(monthlyRaw, { 'sensor.rain': precipMeta }, dailyValues, cfgs);

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

  it('cumulative monthly total = sum of daily values (unaffected by show_zero — FR-004)', () => {
    const s1 = new Date('2025-01-01T00:00:00Z').getTime();
    const s2 = new Date('2025-02-01T00:00:00Z').getTime();
    const s3 = new Date('2025-03-01T00:00:00Z').getTime();
    const raw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.energy': [
        { start: s1, end: s2, sum: 100 },
        { start: s2, end: s3, sum: 130 },
      ],
    };
    const dailyValues = new Map([
      ['sensor.energy::2025-01-01', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2025-01-01', sum: 3, partialCoverage: false }],
      ['sensor.energy::2025-01-02', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2025-01-02', sum: 7, partialCoverage: false }],
      ['sensor.energy::2025-02-01', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2025-02-01', sum: 30, partialCoverage: false }],
    ]);
    const cfgs: EntityConfig[] = [{ entity: 'sensor.energy', show_zero: false }];
    const result = transformMonthlyStats(raw, { 'sensor.energy': energyMeta }, dailyValues, cfgs);
    const jan = result.get('0::sensor.energy::2025-1');
    const feb = result.get('0::sensor.energy::2025-2');
    expect(jan?.total).toBe(10);   // 3 + 7 — totals sum every day regardless of show_zero
    expect(feb?.total).toBe(30);
  });
});

describe('computeMonthlySummaryFromDailyValues', () => {
  it('measurement entity: min/mean/max from daily entries, total null', () => {
    const dailyValues = new Map([
      ['sensor.temp::2026-05-01', { kind: 'measurement' as const, entityId: 'sensor.temp', date: '2026-05-01', min: 10, mean: 15, max: 20, partialCoverage: false }],
      ['sensor.temp::2026-05-02', { kind: 'measurement' as const, entityId: 'sensor.temp', date: '2026-05-02', min: 8, mean: 13, max: 18, partialCoverage: false }],
      ['sensor.temp::2026-05-03', { kind: 'measurement' as const, entityId: 'sensor.temp', date: '2026-05-03', min: 12, mean: 17, max: 22, partialCoverage: false }],
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
      ['sensor.energy::2026-05-01', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2026-05-01', sum: 5, partialCoverage: false }],
      ['sensor.energy::2026-05-02', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2026-05-02', sum: 3, partialCoverage: false }],
      ['sensor.energy::2026-05-03', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2026-05-03', sum: 8, partialCoverage: false }],
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
      ['sensor.rain::2026-05-01', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2026-05-01', sum: 0, partialCoverage: false }],
      ['sensor.rain::2026-05-02', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2026-05-02', sum: 4, partialCoverage: false }],
      ['sensor.rain::2026-05-03', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2026-05-03', sum: 0, partialCoverage: false }],
      ['sensor.rain::2026-05-04', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2026-05-04', sum: 6, partialCoverage: false }],
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
      ['sensor.temp::2026-04-01', { kind: 'measurement' as const, entityId: 'sensor.temp', date: '2026-04-01', min: 5, mean: 10, max: 15, partialCoverage: false }],
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
    [`${EXPR}::2025-01-01`, { kind: 'cumulative' as const, entityId: EXPR, date: '2025-01-01', sum: 0, partialCoverage: false }],
    [`${EXPR}::2025-01-02`, { kind: 'cumulative' as const, entityId: EXPR, date: '2025-01-02', sum: 5, partialCoverage: false }],
    [`${EXPR}::2025-01-03`, { kind: 'cumulative' as const, entityId: EXPR, date: '2025-01-03', sum: 0, partialCoverage: false }],
    [`${EXPR}::2025-01-04`, { kind: 'cumulative' as const, entityId: EXPR, date: '2025-01-04', sum: 10, partialCoverage: false }],
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
