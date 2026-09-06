import { describe, it, expect } from 'vitest';
import { countExceedances } from '../../../src/services/threshold-exceedance';
import type { EntityConfig, ThresholdRule } from '../../../src/types/card-config';
import type { DailyValue, EntityMetadata, YearStatistics } from '../../../src/types/statistics';

const RAIN_META: EntityMetadata = {
  entityId: 'sensor.rain',
  stateClass: 'total_increasing',
  deviceClass: 'precipitation',
  unitOfMeasurement: 'mm',
  friendlyName: 'Rain',
  hasStatistics: true,
};

function day(n: number): string {
  return `2025-01-${String(n).padStart(2, '0')}`;
}

/** One year of cumulative daily sums for sensor.rain, keyed by day-of-month. */
function rainYear(sums: Record<number, number | null>, meta: EntityMetadata = RAIN_META): Map<number, YearStatistics> {
  const dailyValues = new Map<string, DailyValue>();
  for (const [d, sum] of Object.entries(sums)) {
    const date = day(Number(d));
    dailyValues.set(`sensor.rain::${date}`, sum === null
      ? { kind: 'empty', entityId: 'sensor.rain', date }
      : { kind: 'cumulative', entityId: 'sensor.rain', date, sum, partialCoverage: false });
  }
  return new Map([[2025, {
    dailyValues,
    monthlySummaries: new Map(),
    entityMetadata: new Map([['sensor.rain', meta]]),
  }]]);
}

const JAN_2025 = [{ year: 2025, months: [1] }];

function rainRow(thresholds: ThresholdRule[], overrides: Partial<EntityConfig> = {}): EntityConfig {
  return { entity: 'sensor.rain', name: 'Rain', thresholds, ...overrides } as EntityConfig;
}

const WET: ThresholdRule = { operator: 'equals-above', value: 10, name: 'Wet day', background_color: 'blue' };

describe('countExceedances — cumulative rows, cumulative count', () => {
  it('counts the days a named rule applies to', () => {
    const stats = rainYear({ 1: 12, 2: 3, 3: 20, 4: 0 });
    const groups = countExceedances([rainRow([WET])], JAN_2025, stats);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.label).toBe('Rain [mm]');
    expect(groups[0]!.rows).toHaveLength(1);
    expect(groups[0]!.rows[0]!.rule).toBe(WET);
    expect(groups[0]!.rows[0]!.cumulative).toBe(2);
  });

  it('a rule matching no day is listed with a count of 0', () => {
    const stats = rainYear({ 1: 1, 2: 2 });
    const groups = countExceedances([rainRow([WET])], JAN_2025, stats);
    expect(groups[0]!.rows[0]!.cumulative).toBe(0);
  });

  it('empty-kind days (today and future) are not counted', () => {
    const stats = rainYear({ 1: 12, 2: null, 3: null });
    const groups = countExceedances([rainRow([WET])], JAN_2025, stats);
    expect(groups[0]!.rows[0]!.cumulative).toBe(1);
  });

  it('days absent from the map are not counted', () => {
    const stats = rainYear({ 1: 12 });
    const groups = countExceedances([rainRow([WET])], JAN_2025, stats);
    expect(groups[0]!.rows[0]!.cumulative).toBe(1);
  });

  it('applies the row factor before comparing', () => {
    // Raw sums of 5 are below the threshold; scaled by 4 they clear it.
    const stats = rainYear({ 1: 5, 2: 5, 3: 1 });
    const groups = countExceedances([rainRow([WET], { factor: 4 })], JAN_2025, stats);
    expect(groups[0]!.rows[0]!.cumulative).toBe(2);
  });

  it('counts zero days for a cumulative row regardless of show_zero', () => {
    const zeroRule: ThresholdRule = { operator: 'equals-below', value: 0, name: 'Dry day', background_color: 'grey' };
    const stats = rainYear({ 1: 0, 2: 0, 3: 5 });
    const shown = countExceedances([rainRow([zeroRule])], JAN_2025, stats);
    const hidden = countExceedances([rainRow([zeroRule], { show_zero: false })], JAN_2025, stats);
    expect(shown[0]!.rows[0]!.cumulative).toBe(2);
    expect(hidden[0]!.rows[0]!.cumulative).toBe(2);
  });
});

describe('countExceedances — which rules qualify', () => {
  it('drops rules without a name', () => {
    const unnamed: ThresholdRule = { operator: 'equals-above', value: 10, background_color: 'blue' };
    const stats = rainYear({ 1: 12 });
    expect(countExceedances([rainRow([unnamed])], JAN_2025, stats)).toEqual([]);
  });

  it('drops rules with no day value', () => {
    const monthOnly: ThresholdRule = { operator: 'equals-above', value_month: 10, name: 'Wet month', background_color: 'blue' };
    const stats = rainYear({ 1: 12 });
    expect(countExceedances([rainRow([monthOnly])], JAN_2025, stats)).toEqual([]);
  });

  it('drops rules with neither color, since they colour nothing', () => {
    const colorless: ThresholdRule = { operator: 'equals-above', value: 10, name: 'Wet day' };
    const stats = rainYear({ 1: 12 });
    expect(countExceedances([rainRow([colorless])], JAN_2025, stats)).toEqual([]);
  });

  it('a row without thresholds produces no group', () => {
    const stats = rainYear({ 1: 12 });
    expect(countExceedances([rainRow([])], JAN_2025, stats)).toEqual([]);
  });

  it('keeps qualifying rules alongside dropped ones', () => {
    const unnamed: ThresholdRule = { operator: 'equals-above', value: 30, background_color: 'red' };
    const stats = rainYear({ 1: 12, 2: 40 });
    const groups = countExceedances([rainRow([WET, unnamed])], JAN_2025, stats);
    expect(groups[0]!.rows.map((r) => r.rule)).toEqual([WET]);
  });

  it('orders rows by day value ascending', () => {
    const heavy: ThresholdRule = { operator: 'equals-above', value: 30, name: 'Heavy day', background_color: 'red' };
    const stats = rainYear({ 1: 40 });
    const groups = countExceedances([rainRow([heavy, WET])], JAN_2025, stats);
    expect(groups[0]!.rows.map((r) => r.rule.name)).toEqual(['Wet day', 'Heavy day']);
  });
});

describe('countExceedances — grouping', () => {
  it('uses the shared row label including the unit', () => {
    const stats = rainYear({ 1: 12 });
    const groups = countExceedances([rainRow([WET], { name: undefined })], JAN_2025, stats);
    expect(groups[0]!.label).toBe('Rain [mm]');
  });

  it('two rows on the same entity stay separate groups', () => {
    const stats = rainYear({ 1: 12 });
    const groups = countExceedances([rainRow([WET]), rainRow([WET], { name: 'Rain copy' })], JAN_2025, stats);
    expect(groups).toHaveLength(2);
    expect(groups[1]!.label).toBe('Rain copy [mm]');
  });
});
