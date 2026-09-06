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

describe('countExceedances — band count', () => {
  const WARM: ThresholdRule = { operator: 'equals-above', value: 10, name: 'Wet day', background_color: 'blue' };
  const HEAVY: ThresholdRule = { operator: 'equals-above', value: 30, name: 'Heavy day', background_color: 'red' };

  it('stacked rules split the days into disjoint bands', () => {
    // 12, 15 → Wet band; 40, 50, 31 → Heavy band; 3 → neither.
    const stats = rainYear({ 1: 12, 2: 15, 3: 40, 4: 50, 5: 31, 6: 3 });
    const groups = countExceedances([rainRow([WARM, HEAVY])], JAN_2025, stats);
    const [wet, heavy] = groups[0]!.rows;
    expect(wet!.band).toBe(2);
    expect(heavy!.band).toBe(3);
  });

  it('cumulative counts every day the rule applies to, band or not', () => {
    const stats = rainYear({ 1: 12, 2: 15, 3: 40, 4: 50, 5: 31, 6: 3 });
    const groups = countExceedances([rainRow([WARM, HEAVY])], JAN_2025, stats);
    const [wet, heavy] = groups[0]!.rows;
    expect(wet!.cumulative).toBe(5);
    expect(heavy!.cumulative).toBe(3);
  });

  it('band counts sum to the lowest rule cumulative count', () => {
    const stats = rainYear({ 1: 12, 2: 15, 3: 40, 4: 50, 5: 31, 6: 3 });
    const rows = countExceedances([rainRow([WARM, HEAVY])], JAN_2025, stats)[0]!.rows;
    const bandSum = rows.reduce((s, r) => s + r.band, 0);
    expect(bandSum).toBe(rows[0]!.cumulative);
  });

  it('band never exceeds cumulative', () => {
    const stats = rainYear({ 1: 12, 2: 40, 3: 31 });
    for (const row of countExceedances([rainRow([WARM, HEAVY])], JAN_2025, stats)[0]!.rows) {
      expect(row.band).toBeLessThanOrEqual(row.cumulative);
    }
  });

  it('a below-family rule bands the days it colors', () => {
    const dry: ThresholdRule = { operator: 'equals-below', value: 1, name: 'Dry day', background_color: 'grey' };
    const damp: ThresholdRule = { operator: 'equals-below', value: 5, name: 'Damp day', background_color: 'teal' };
    // 0, 1 → Dry band; 3, 4 → Damp band; 20 → neither.
    const stats = rainYear({ 1: 0, 2: 1, 3: 3, 4: 4, 5: 20 });
    const rows = countExceedances([rainRow([dry, damp])], JAN_2025, stats)[0]!.rows;
    const byName = Object.fromEntries(rows.map((r) => [r.rule.name, r]));
    expect(byName['Dry day']!.band).toBe(2);
    expect(byName['Damp day']!.band).toBe(2);
    expect(byName['Damp day']!.cumulative).toBe(4);
  });

  it('an unnamed rule still takes the band it wins away from a named one', () => {
    const unnamedHeavy: ThresholdRule = { operator: 'equals-above', value: 30, background_color: 'red' };
    const stats = rainYear({ 1: 12, 2: 40 });
    const rows = countExceedances([rainRow([WARM, unnamedHeavy])], JAN_2025, stats)[0]!.rows;
    expect(rows).toHaveLength(1);
    // Day 2 is won by the unnamed rule, so it is not in Wet day's band…
    expect(rows[0]!.band).toBe(1);
    // …but it still applies to Wet day, so it counts cumulatively.
    expect(rows[0]!.cumulative).toBe(2);
  });
});

const TEMP_META: EntityMetadata = {
  entityId: 'sensor.temp',
  stateClass: 'measurement',
  deviceClass: 'temperature',
  unitOfMeasurement: '°C',
  friendlyName: 'Temperature',
  hasStatistics: true,
};

/** One year of measurement days for sensor.temp, keyed by day-of-month. */
function tempYear(days: Record<number, [number, number, number] | null>): Map<number, YearStatistics> {
  const dailyValues = new Map<string, DailyValue>();
  for (const [d, triple] of Object.entries(days)) {
    const date = day(Number(d));
    dailyValues.set(`sensor.temp::${date}`, triple === null
      ? { kind: 'empty', entityId: 'sensor.temp', date }
      : { kind: 'measurement', entityId: 'sensor.temp', date, min: triple[0], mean: triple[1], max: triple[2], partialCoverage: false });
  }
  return new Map([[2025, {
    dailyValues,
    monthlySummaries: new Map(),
    entityMetadata: new Map([['sensor.temp', TEMP_META]]),
  }]]);
}

function tempRow(thresholds: ThresholdRule[], overrides: Partial<EntityConfig> = {}): EntityConfig {
  return { entity: 'sensor.temp', name: 'Temperature', thresholds, ...overrides } as EntityConfig;
}

describe('countExceedances — measurement rows', () => {
  const SUMMER: ThresholdRule = { operator: 'equals-above', value: 25, name: 'Summer day', background_color: 'orange' };

  it('counts a day when any of min/avg/max reaches the rule', () => {
    // Only the max reaches 25 on day 1; nothing does on day 2.
    const stats = tempYear({ 1: [10, 18, 26], 2: [5, 10, 15] });
    const rows = countExceedances([tempRow([SUMMER])], JAN_2025, stats)[0]!.rows;
    expect(rows[0]!.cumulative).toBe(1);
    expect(rows[0]!.band).toBe(1);
  });

  it('counts a day only once when the rule applies to several of its values', () => {
    // min, mean and max all clear 25 — still one day.
    const stats = tempYear({ 1: [26, 28, 30] });
    const rows = countExceedances([tempRow([SUMMER])], JAN_2025, stats)[0]!.rows;
    expect(rows[0]!.cumulative).toBe(1);
    expect(rows[0]!.band).toBe(1);
  });

  it('ignores values whose sub-row is hidden', () => {
    // Only the max clears the threshold, and the max sub-row is hidden.
    const stats = tempYear({ 1: [10, 18, 26] });
    const rows = countExceedances([tempRow([SUMMER], { show_max: false })], JAN_2025, stats)[0]!.rows;
    expect(rows[0]!.cumulative).toBe(0);
  });

  it('counts through a visible sub-row when another is hidden', () => {
    const stats = tempYear({ 1: [26, 28, 30] });
    const rows = countExceedances([tempRow([SUMMER], { show_max: false })], JAN_2025, stats)[0]!.rows;
    expect(rows[0]!.cumulative).toBe(1);
  });

  it('skips a zero value when show_zero is false', () => {
    const freezing: ThresholdRule = { operator: 'equals-below', value: 0, name: 'Ice day', background_color: 'cyan' };
    const stats = tempYear({ 1: [0, 0, 0] });
    const shown = countExceedances([tempRow([freezing])], JAN_2025, stats)[0]!.rows;
    const hidden = countExceedances([tempRow([freezing], { show_zero: false })], JAN_2025, stats)[0]!.rows;
    expect(shown[0]!.cumulative).toBe(1);
    expect(hidden[0]!.cumulative).toBe(0);
  });

  it('a non-zero value on a show_zero:false row still counts', () => {
    const stats = tempYear({ 1: [10, 18, 26] });
    const rows = countExceedances([tempRow([SUMMER], { show_zero: false })], JAN_2025, stats)[0]!.rows;
    expect(rows[0]!.cumulative).toBe(1);
  });

  it('bands split across min/avg/max by whichever rule wins that value', () => {
    const hot: ThresholdRule = { operator: 'equals-above', value: 30, name: 'Hot day', background_color: 'red' };
    // Day 1: max 32 wins Hot; mean 26 wins Summer → the day is in BOTH bands, once each.
    const stats = tempYear({ 1: [20, 26, 32] });
    const rows = countExceedances([tempRow([SUMMER, hot])], JAN_2025, stats)[0]!.rows;
    const byName = Object.fromEntries(rows.map((r) => [r.rule.name, r]));
    expect(byName['Summer day']!.band).toBe(1);
    expect(byName['Hot day']!.band).toBe(1);
  });

  it('uses the measurement label with its unit', () => {
    const stats = tempYear({ 1: [10, 18, 26] });
    expect(countExceedances([tempRow([SUMMER])], JAN_2025, stats)[0]!.label).toBe('Temperature [°C]');
  });
});
