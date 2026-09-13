import { vi, describe, it, expect, afterEach } from 'vitest';
import type { ThresholdRule, CellRole, ThresholdScope } from '../../src/types/card-config';

/** Every `thresholds` array handed to `resolveThreshold`, in call order. */
const thresholdArgs: ThresholdRule[][] = [];

vi.mock('../../src/services/threshold-resolver', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/threshold-resolver')>();
  return {
    ...actual,
    resolveThreshold: (
      cellValue: number,
      thresholds: ThresholdRule[],
      cellRole: CellRole,
      cellScope?: ThresholdScope,
    ) => {
      thresholdArgs.push(thresholds);
      return actual.resolveThreshold(cellValue, thresholds, cellRole, cellScope);
    },
  };
});

await import('../../src/components/year-table');
await import('../../src/components/year-summary-table');
import type { YearTable } from '../../src/components/year-table';
import type { YearSummaryTable } from '../../src/components/year-summary-table';
import type { EntityConfig } from '../../src/types/card-config';
import type { DailyValue, MonthlySummary, EntityMetadata } from '../../src/types/statistics';
import { dailyIndex } from '../helpers/daily-values';

const YEAR = 2024;
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
/** Rows that configure no thresholds — the case that used to allocate `[]` per cell. */
const CONFIGS = [
  { entity: 'sensor.a' },
  { entity: 'sensor.b' },
] as const satisfies readonly EntityConfig[];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function buildData() {
  const dailyValues = dailyIndex();
  const monthlySummaries = new Map<string, MonthlySummary>();
  const entityMetadata = new Map<string, EntityMetadata>();
  CONFIGS.forEach((cfg, i) => {
    entityMetadata.set(cfg.entity, {
      unitOfMeasurement: 'C', stateClass: 'measurement', hasStatistics: true,
    } as EntityMetadata);
    for (const m of MONTHS) {
      monthlySummaries.set(`${i}::${cfg.entity}::${YEAR}-${pad(m)}`,
        { min: 1, mean: 5, max: 9, total: 100 } as MonthlySummary);
      for (let d = 1; d <= 31; d++) {
        dailyValues.set(cfg.entity, `${YEAR}-${pad(m)}-${pad(d)}`,
          { kind: 'measurement', min: d, mean: d + 1, max: d + 2 } as DailyValue);
      }
    }
  });
  return { dailyValues, monthlySummaries, entityMetadata };
}

afterEach(() => {
  document.body.innerHTML = '';
  thresholdArgs.length = 0;
});

describe('threshold argument allocation per render', () => {
  it('YearTable hands every threshold-less cell the same empty array', async () => {
    const el = document.createElement('calendar-stats-year-table') as YearTable;
    Object.assign(el, { year: YEAR, visibleMonths: MONTHS, entityConfigs: [...CONFIGS], ...buildData() });
    document.body.appendChild(el);
    await el.updateComplete;

    expect(thresholdArgs.length).toBeGreaterThan(1000);
    expect(new Set(thresholdArgs).size).toBe(1);
  });

  it('YearSummaryTable hands every threshold-less cell the same empty array', async () => {
    const data = buildData();
    const el = document.createElement('calendar-stats-year-summary-table') as YearSummaryTable;
    el.entityConfigs = [...CONFIGS];
    el.segments = [{ year: YEAR, visibleMonths: MONTHS, ...data }];
    document.body.appendChild(el);
    await el.updateComplete;

    expect(thresholdArgs.length).toBeGreaterThan(20);
    expect(new Set(thresholdArgs).size).toBe(1);
  });
});
