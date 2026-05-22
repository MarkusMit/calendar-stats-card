import { describe, it, expect } from 'vitest';
import {
  transformDailyStats,
  transformMonthlyStats,
} from '../../../src/services/data-transform';
import type { EntityMetadata } from '../../../src/types/statistics';

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
    const result = transformMonthlyStats(raw, {}, new Map());
    expect(result.size).toBe(0);
  });

  it('cumulative with no matching daily values → min/mean/max/total are null', () => {
    const start = new Date('2025-01-01T00:00:00Z').getTime();
    const raw = { 'sensor.energy': [{ start, end: start + 2678400_000, sum: 50 }] };
    const result = transformMonthlyStats(raw, { 'sensor.energy': energyMeta }, new Map());
    const summary = result.get('sensor.energy::2025-1');
    expect(summary?.min).toBeNull();
    expect(summary?.max).toBeNull();
    expect(summary?.mean).toBeNull();
    expect(summary?.total).toBeNull();
  });
});

describe('transformMonthlyStats', () => {
  it('measurement → passes through HA monthly min/mean/max', () => {
    const start = new Date('2025-01-01T00:00:00Z').getTime();
    const raw: Record<string, { start: number; end: number; mean?: number; min?: number; max?: number; sum?: number }[]> = {
      'sensor.temp': [{ start, end: start + 2678400_000, mean: 18, min: 5, max: 30 }],
    };
    const result = transformMonthlyStats(raw, { 'sensor.temp': tempMeta }, new Map());
    const summary = result.get('sensor.temp::2025-1');
    expect(summary).toBeDefined();
    expect(summary?.mean).toBe(18);
    expect(summary?.min).toBe(5);
    expect(summary?.max).toBe(30);
    expect(summary?.total).toBeNull();
  });

  it('precipitation → zero-sum days excluded from min/mean/max (FR-016)', () => {
    // Build daily values for Jan 2025: days 1-3 have sum 0, 5, 10
    const dailyValues = new Map([
      ['sensor.rain::2025-01-01', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-01', sum: 0, partialCoverage: false }],
      ['sensor.rain::2025-01-02', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-02', sum: 5, partialCoverage: false }],
      ['sensor.rain::2025-01-03', { kind: 'cumulative' as const, entityId: 'sensor.rain', date: '2025-01-03', sum: 10, partialCoverage: false }],
    ]);
    const monthlyRaw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.rain': [{ start: new Date('2025-01-01T00:00:00Z').getTime(), end: new Date('2025-02-01T00:00:00Z').getTime(), sum: 15 }],
    };
    const result = transformMonthlyStats(monthlyRaw, { 'sensor.rain': precipMeta }, dailyValues);
    const summary = result.get('sensor.rain::2025-1');
    expect(summary?.min).toBe(5);   // 0 excluded
    expect(summary?.max).toBe(10);
    expect(summary?.mean).toBeCloseTo(7.5); // (5+10)/2
  });

  it('energy → zero-sum days INCLUDED in min/mean/max (FR-016)', () => {
    const dailyValues = new Map([
      ['sensor.energy::2025-01-01', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2025-01-01', sum: 0, partialCoverage: false }],
      ['sensor.energy::2025-01-02', { kind: 'cumulative' as const, entityId: 'sensor.energy', date: '2025-01-02', sum: 10, partialCoverage: false }],
    ]);
    const monthlyRaw: Record<string, { start: number; end: number; sum?: number }[]> = {
      'sensor.energy': [{ start: new Date('2025-01-01T00:00:00Z').getTime(), end: new Date('2025-02-01T00:00:00Z').getTime(), sum: 10 }],
    };
    const result = transformMonthlyStats(monthlyRaw, { 'sensor.energy': energyMeta }, dailyValues);
    const summary = result.get('sensor.energy::2025-1');
    expect(summary?.min).toBe(0);   // zero included
    expect(summary?.max).toBe(10);
    expect(summary?.mean).toBe(5);
  });

  it('cumulative monthly total = sum of daily values', () => {
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
    const result = transformMonthlyStats(raw, { 'sensor.energy': energyMeta }, dailyValues);
    const jan = result.get('sensor.energy::2025-1');
    const feb = result.get('sensor.energy::2025-2');
    expect(jan?.total).toBe(10);   // 3 + 7
    expect(feb?.total).toBe(30);   // 30
  });
});
