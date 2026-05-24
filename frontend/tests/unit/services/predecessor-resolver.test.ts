import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolvePredecessorData } from '../../../src/services/predecessor-resolver';
import type { EntityConfig, EntityRowConfig } from '../../../src/types/card-config';
import type { DailyValue, EntityMetadata, MeasurementDailyValue, CumulativeDailyValue } from '../../../src/types/statistics';

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeMeasurementMeta(entityId: string, unit = '°C'): EntityMetadata {
  return {
    entityId,
    stateClass: 'measurement',
    deviceClass: 'temperature',
    unitOfMeasurement: unit,
    friendlyName: entityId,
    hasStatistics: true,
  };
}

function makeCumulativeMeta(entityId: string, unit = 'kWh'): EntityMetadata {
  return {
    entityId,
    stateClass: 'total_increasing',
    deviceClass: 'energy',
    unitOfMeasurement: unit,
    friendlyName: entityId,
    hasStatistics: true,
  };
}

function makeMeasurement(entityId: string, date: string, mean = 10): MeasurementDailyValue {
  return { kind: 'measurement', entityId, date, min: mean - 1, mean, max: mean + 1, partialCoverage: false };
}

function makeCumulative(entityId: string, date: string, sum = 5): CumulativeDailyValue {
  return { kind: 'cumulative', entityId, date, sum, partialCoverage: false };
}

function makeEmpty(entityId: string, date: string): DailyValue {
  return { kind: 'empty', entityId, date };
}

function makeEntityConfig(entity: string, predecessors: EntityRowConfig['predecessors'] = []): EntityConfig {
  return { entity, predecessors };
}

function buildMap(entries: [string, DailyValue][]): Map<string, DailyValue> {
  return new Map(entries);
}

// ─── US1: Date-Based Predecessor ────────────────────────────────────────────

describe('resolvePredecessorData — date-based predecessor (US1)', () => {
  const MAIN = 'sensor.main';
  const PRED = 'sensor.pred';
  const REPLACED_ON = '2024-11-01';

  const mainMeta = makeMeasurementMeta(MAIN);
  const predMeta = makeMeasurementMeta(PRED);
  const metadataMap = { [MAIN]: mainMeta, [PRED]: predMeta };

  const cfg = makeEntityConfig(MAIN, [{ entity: PRED, replaced_on: REPLACED_ON }]);

  it('uses predecessor data for date strictly before replaced_on', () => {
    const predVal = makeMeasurement(PRED, '2024-10-15', 20);
    const dailyValues = buildMap([
      [`${PRED}::2024-10-15`, predVal],
    ]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    const resolved = result.get(`${MAIN}::2024-10-15`);
    expect(resolved?.kind).toBe('measurement');
    expect((resolved as MeasurementDailyValue).mean).toBe(20);
  });

  it('uses main entity data for date equal to replaced_on (main wins on exchange date)', () => {
    const mainVal = makeMeasurement(MAIN, REPLACED_ON, 15);
    const predVal = makeMeasurement(PRED, REPLACED_ON, 99);
    const dailyValues = buildMap([
      [`${MAIN}::${REPLACED_ON}`, mainVal],
      [`${PRED}::${REPLACED_ON}`, predVal],
    ]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    const resolved = result.get(`${MAIN}::${REPLACED_ON}`);
    expect(resolved?.kind).toBe('measurement');
    expect((resolved as MeasurementDailyValue).mean).toBe(15);
  });

  it('uses main entity data for date after replaced_on', () => {
    const mainVal = makeMeasurement(MAIN, '2024-11-05', 15);
    const dailyValues = buildMap([
      [`${MAIN}::2024-11-05`, mainVal],
    ]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    const resolved = result.get(`${MAIN}::2024-11-05`);
    expect((resolved as MeasurementDailyValue).mean).toBe(15);
  });

  it('cell empty when main has no data on/after replaced_on (predecessor not consulted)', () => {
    const predVal = makeMeasurement(PRED, '2024-11-05', 99);
    const dailyValues = buildMap([
      [`${PRED}::2024-11-05`, predVal],
    ]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    expect(result.has(`${MAIN}::2024-11-05`)).toBe(false);
  });

  it('resolved DailyValue.entityId equals main entity ID', () => {
    const predVal = makeMeasurement(PRED, '2024-10-01', 20);
    const dailyValues = buildMap([
      [`${PRED}::2024-10-01`, predVal],
    ]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    const resolved = result.get(`${MAIN}::2024-10-01`);
    expect(resolved?.entityId).toBe(MAIN);
  });

  it('monthly summary includes predecessor days (FR-013/SC-007)', () => {
    // 2024-10 has 31 days; predecessor covers all of them (replaced_on = 2024-11-01)
    // Verify merged data exists under main entity key for each day
    const entries: [string, DailyValue][] = [];
    for (let day = 1; day <= 31; day++) {
      const date = `2024-10-${String(day).padStart(2, '0')}`;
      entries.push([`${PRED}::${date}`, makeMeasurement(PRED, date, day)]);
    }
    const dailyValues = buildMap(entries);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    // All October days should be present under main entity key
    let count = 0;
    for (let day = 1; day <= 31; day++) {
      const date = `2024-10-${String(day).padStart(2, '0')}`;
      const v = result.get(`${MAIN}::${date}`);
      if (v?.kind === 'measurement') count++;
    }
    expect(count).toBe(31);
  });

  it('works for total_increasing (cumulative) entity type (FR-009)', () => {
    const mainCumMeta = makeCumulativeMeta(MAIN);
    const predCumMeta = makeCumulativeMeta(PRED);
    const cumMetadataMap = { [MAIN]: mainCumMeta, [PRED]: predCumMeta };

    const predVal = makeCumulative(PRED, '2024-10-15', 7);
    const dailyValues = buildMap([[`${PRED}::2024-10-15`, predVal]]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, cumMetadataMap, warned);

    const resolved = result.get(`${MAIN}::2024-10-15`);
    expect(resolved?.kind).toBe('cumulative');
    expect((resolved as CumulativeDailyValue).sum).toBe(7);
    expect(resolved?.entityId).toBe(MAIN);
  });
});

// ─── US2: Fallback Predecessor ───────────────────────────────────────────────

describe('resolvePredecessorData — fallback predecessor (US2)', () => {
  const MAIN = 'sensor.main';
  const PRED = 'sensor.pred';

  const mainMeta = makeMeasurementMeta(MAIN);
  const predMeta = makeMeasurementMeta(PRED);
  const metadataMap = { [MAIN]: mainMeta, [PRED]: predMeta };

  const cfg = makeEntityConfig(MAIN, [{ entity: PRED }]); // no replaced_on

  it('predecessor data used when main entity has EmptyDailyValue', () => {
    const predVal = makeMeasurement(PRED, '2024-03-10', 25);
    const dailyValues = buildMap([
      [`${MAIN}::2024-03-10`, makeEmpty(MAIN, '2024-03-10')],
      [`${PRED}::2024-03-10`, predVal],
    ]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    const resolved = result.get(`${MAIN}::2024-03-10`);
    expect(resolved?.kind).toBe('measurement');
    expect((resolved as MeasurementDailyValue).mean).toBe(25);
    expect(resolved?.entityId).toBe(MAIN);
  });

  it('predecessor data used when main entity has no entry in map', () => {
    const predVal = makeMeasurement(PRED, '2024-03-10', 25);
    const dailyValues = buildMap([
      [`${PRED}::2024-03-10`, predVal],
    ]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    const resolved = result.get(`${MAIN}::2024-03-10`);
    expect(resolved?.kind).toBe('measurement');
    expect((resolved as MeasurementDailyValue).mean).toBe(25);
  });

  it('main entity data used when both main and predecessor have data', () => {
    const mainVal = makeMeasurement(MAIN, '2024-03-10', 15);
    const predVal = makeMeasurement(PRED, '2024-03-10', 99);
    const dailyValues = buildMap([
      [`${MAIN}::2024-03-10`, mainVal],
      [`${PRED}::2024-03-10`, predVal],
    ]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    const resolved = result.get(`${MAIN}::2024-03-10`);
    expect((resolved as MeasurementDailyValue).mean).toBe(15);
  });

  it('cell empty when main has no data AND predecessor also has no data', () => {
    const dailyValues = buildMap([
      [`${MAIN}::2024-03-10`, makeEmpty(MAIN, '2024-03-10')],
      [`${PRED}::2024-03-10`, makeEmpty(PRED, '2024-03-10')],
    ]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    const resolved = result.get(`${MAIN}::2024-03-10`);
    expect(resolved?.kind).toBe('empty');
  });

  it('works for measurement entity type (FR-009)', () => {
    const predVal = makeMeasurement(PRED, '2024-03-10', 5);
    const dailyValues = buildMap([
      [`${PRED}::2024-03-10`, predVal],
    ]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    expect(result.get(`${MAIN}::2024-03-10`)?.kind).toBe('measurement');
  });
});

// ─── US3: Chained Predecessors ───────────────────────────────────────────────

describe('resolvePredecessorData — chained predecessors (US3)', () => {
  const MAIN = 'sensor.main';
  const P1 = 'sensor.p1'; // replaced_on: 2024-06-01
  const P2 = 'sensor.p2'; // replaced_on: 2023-01-01

  const metadataMap = {
    [MAIN]: makeMeasurementMeta(MAIN),
    [P1]: makeMeasurementMeta(P1),
    [P2]: makeMeasurementMeta(P2),
  };

  // Config list order: [P1, P2] — resolver must sort by date to get P2 before P1
  const cfg = makeEntityConfig(MAIN, [
    { entity: P1, replaced_on: '2024-06-01' },
    { entity: P2, replaced_on: '2023-01-01' },
  ]);

  it('P2 active before 2023-01-01', () => {
    const p2Val = makeMeasurement(P2, '2022-12-31', 2);
    const dailyValues = buildMap([[`${P2}::2022-12-31`, p2Val]]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    const resolved = result.get(`${MAIN}::2022-12-31`);
    expect((resolved as MeasurementDailyValue).mean).toBe(2);
    expect(resolved?.entityId).toBe(MAIN);
  });

  it('P1 active from 2023-01-01 to 2024-05-31', () => {
    const p1Val = makeMeasurement(P1, '2023-06-15', 1);
    const dailyValues = buildMap([[`${P1}::2023-06-15`, p1Val]]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    const resolved = result.get(`${MAIN}::2023-06-15`);
    expect((resolved as MeasurementDailyValue).mean).toBe(1);
  });

  it('main entity active from 2024-06-01', () => {
    const mainVal = makeMeasurement(MAIN, '2024-07-01', 50);
    const dailyValues = buildMap([[`${MAIN}::2024-07-01`, mainVal]]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    const resolved = result.get(`${MAIN}::2024-07-01`);
    expect((resolved as MeasurementDailyValue).mean).toBe(50);
  });

  it('day within P2 range with no P2 data → no entry under main key', () => {
    const dailyValues = buildMap([]); // P2 has no data for that day
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    expect(result.has(`${MAIN}::2022-06-01`)).toBe(false);
  });

  it('three-predecessor chain resolves at each boundary', () => {
    const P3 = 'sensor.p3';
    const metaWith3 = {
      ...metadataMap,
      [P3]: makeMeasurementMeta(P3),
    };
    const cfg3 = makeEntityConfig(MAIN, [
      { entity: P1, replaced_on: '2024-06-01' },
      { entity: P2, replaced_on: '2023-01-01' },
      { entity: P3, replaced_on: '2022-01-01' },
    ]);

    const p3Val = makeMeasurement(P3, '2021-06-15', 3);
    const p2Val = makeMeasurement(P2, '2022-06-15', 2);
    const p1Val = makeMeasurement(P1, '2023-06-15', 1);
    const mainVal = makeMeasurement(MAIN, '2024-07-01', 0);

    const dailyValues = buildMap([
      [`${P3}::2021-06-15`, p3Val],
      [`${P2}::2022-06-15`, p2Val],
      [`${P1}::2023-06-15`, p1Val],
      [`${MAIN}::2024-07-01`, mainVal],
    ]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg3], dailyValues, metaWith3, warned);

    expect((result.get(`${MAIN}::2021-06-15`) as MeasurementDailyValue).mean).toBe(3);
    expect((result.get(`${MAIN}::2022-06-15`) as MeasurementDailyValue).mean).toBe(2);
    expect((result.get(`${MAIN}::2023-06-15`) as MeasurementDailyValue).mean).toBe(1);
    expect((result.get(`${MAIN}::2024-07-01`) as MeasurementDailyValue).mean).toBe(0);
  });
});

// ─── Polish: Compatibility Check (FR-011 / FR-012) ──────────────────────────

describe('resolvePredecessorData — compatibility check (FR-011/FR-012)', () => {
  const MAIN = 'sensor.main';
  const PRED = 'sensor.pred';

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('predecessor with different stateClass is skipped', () => {
    const mainMeta = makeMeasurementMeta(MAIN);
    const predMeta = makeCumulativeMeta(PRED, '°C'); // different stateClass
    const metadataMap = { [MAIN]: mainMeta, [PRED]: predMeta };
    const cfg = makeEntityConfig(MAIN, [{ entity: PRED }]);

    const predVal = makeCumulative(PRED, '2024-03-10', 7);
    const dailyValues = buildMap([[`${PRED}::2024-03-10`, predVal]]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    expect(result.has(`${MAIN}::2024-03-10`)).toBe(false);
  });

  it('predecessor with different unitOfMeasurement is skipped', () => {
    const mainMeta = makeMeasurementMeta(MAIN, '°C');
    const predMeta = makeMeasurementMeta(PRED, '°F'); // different unit
    const metadataMap = { [MAIN]: mainMeta, [PRED]: predMeta };
    const cfg = makeEntityConfig(MAIN, [{ entity: PRED }]);

    const predVal = makeMeasurement(PRED, '2024-03-10', 20);
    const dailyValues = buildMap([[`${PRED}::2024-03-10`, predVal]]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    expect(result.has(`${MAIN}::2024-03-10`)).toBe(false);
  });

  it('console.warn called with predecessor ID when skipped for incompatibility', () => {
    const mainMeta = makeMeasurementMeta(MAIN, '°C');
    const predMeta = makeMeasurementMeta(PRED, '°F');
    const metadataMap = { [MAIN]: mainMeta, [PRED]: predMeta };
    const cfg = makeEntityConfig(MAIN, [{ entity: PRED }]);

    const dailyValues = buildMap([[`${PRED}::2024-03-10`, makeMeasurement(PRED, '2024-03-10', 5)]]);
    const warned = new Set<string>();

    resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining(PRED));
  });

  it('console.warn called at most once per predecessor ID (deduplication)', () => {
    const mainMeta = makeMeasurementMeta(MAIN, '°C');
    const predMeta = makeMeasurementMeta(PRED, '°F');
    const metadataMap = { [MAIN]: mainMeta, [PRED]: predMeta };
    const cfg = makeEntityConfig(MAIN, [{ entity: PRED }]);

    const dailyValues = buildMap([
      [`${PRED}::2024-03-10`, makeMeasurement(PRED, '2024-03-10', 5)],
      [`${PRED}::2024-03-11`, makeMeasurement(PRED, '2024-03-11', 6)],
    ]);
    const warned = new Set<string>();

    resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    const warnCalls = (console.warn as ReturnType<typeof vi.fn>).mock.calls.filter(
      (c) => String(c[0]).includes(PRED),
    );
    expect(warnCalls).toHaveLength(1);
  });

  it('compatible predecessors are not warned and are used normally', () => {
    const mainMeta = makeMeasurementMeta(MAIN, '°C');
    const predMeta = makeMeasurementMeta(PRED, '°C'); // same unit
    const metadataMap = { [MAIN]: mainMeta, [PRED]: predMeta };
    const cfg = makeEntityConfig(MAIN, [{ entity: PRED }]);

    const predVal = makeMeasurement(PRED, '2024-03-10', 20);
    const dailyValues = buildMap([[`${PRED}::2024-03-10`, predVal]]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    expect(result.get(`${MAIN}::2024-03-10`)?.kind).toBe('measurement');
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('predecessor absent from metadataMap is skipped silently without console.warn (FR-008)', () => {
    const mainMeta = makeMeasurementMeta(MAIN);
    const metadataMap = { [MAIN]: mainMeta }; // PRED not in map
    const cfg = makeEntityConfig(MAIN, [{ entity: PRED }]);

    const predVal = makeMeasurement(PRED, '2024-03-10', 20);
    const dailyValues = buildMap([[`${PRED}::2024-03-10`, predVal]]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    expect(result).toBeDefined();
    expect(console.warn).not.toHaveBeenCalled();
  });
});

// ─── Polish: Multiple Undated Predecessors ───────────────────────────────────

describe('resolvePredecessorData — multiple undated predecessors (FR-005/FR-006)', () => {
  const MAIN = 'sensor.main';
  const PRED_A = 'sensor.pred_a';
  const PRED_B = 'sensor.pred_b';

  const mainMeta = makeMeasurementMeta(MAIN);
  const predAMeta = makeMeasurementMeta(PRED_A);
  const predBMeta = makeMeasurementMeta(PRED_B);
  const metadataMap = { [MAIN]: mainMeta, [PRED_A]: predAMeta, [PRED_B]: predBMeta };

  const cfg = makeEntityConfig(MAIN, [{ entity: PRED_A }, { entity: PRED_B }]); // both undated

  it('first predecessor in list order with data wins', () => {
    const aVal = makeMeasurement(PRED_A, '2024-03-10', 10);
    const bVal = makeMeasurement(PRED_B, '2024-03-10', 99);
    const dailyValues = buildMap([
      [`${PRED_A}::2024-03-10`, aVal],
      [`${PRED_B}::2024-03-10`, bVal],
    ]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    expect((result.get(`${MAIN}::2024-03-10`) as MeasurementDailyValue).mean).toBe(10);
  });

  it('second predecessor used when first has no data for that day', () => {
    const bVal = makeMeasurement(PRED_B, '2024-03-10', 99);
    const dailyValues = buildMap([
      [`${PRED_B}::2024-03-10`, bVal],
    ]);
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    expect((result.get(`${MAIN}::2024-03-10`) as MeasurementDailyValue).mean).toBe(99);
  });

  it('cell empty when no undated predecessor has data', () => {
    const dailyValues = buildMap([]); // neither has data
    const warned = new Set<string>();

    const result = resolvePredecessorData([cfg], dailyValues, metadataMap, warned);

    expect(result.has(`${MAIN}::2024-03-10`)).toBe(false);
  });
});
