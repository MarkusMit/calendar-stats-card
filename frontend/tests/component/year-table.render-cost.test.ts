import { describe, it, expect, afterEach } from 'vitest';
import '../../src/components/year-table';
import '../../src/components/year-summary-table';
import type { YearTable } from '../../src/components/year-table';
import type { YearSummaryTable } from '../../src/components/year-summary-table';
import type { EntityConfig } from '../../src/types/card-config';
import type { DailyValue, MonthlySummary, EntityMetadata } from '../../src/types/statistics';

const YEAR = 2024;
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const CONFIGS = [
  { entity: 'sensor.a' },
  { entity: 'sensor.b', precision: 2 },
  { entity: 'sensor.c' },
] as const satisfies readonly EntityConfig[];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function buildData() {
  const dailyValues = new Map<string, DailyValue>();
  const monthlySummaries = new Map<string, MonthlySummary>();
  const entityMetadata = new Map<string, EntityMetadata>();
  CONFIGS.forEach((cfg, i) => {
    const key = cfg.entity;
    entityMetadata.set(key, {
      unitOfMeasurement: 'C', stateClass: 'measurement', hasStatistics: true,
    } as EntityMetadata);
    for (const m of MONTHS) {
      monthlySummaries.set(`${i}::${key}::${YEAR}-${pad(m)}`,
        { min: 1, mean: 5, max: 9, total: 100 } as MonthlySummary);
      for (let d = 1; d <= 31; d++) {
        dailyValues.set(`${key}::${YEAR}-${pad(m)}-${pad(d)}`,
          { kind: 'measurement', min: d, mean: d + 1, max: d + 2 } as DailyValue);
      }
    }
  });
  return { dailyValues, monthlySummaries, entityMetadata };
}

/** Counts Intl constructions while the given work runs. */
async function countIntlConstructions(work: () => Promise<void>): Promise<{ numberFormats: number; dateTimeFormats: number }> {
  const RealNumberFormat = Intl.NumberFormat;
  const RealDateTimeFormat = Intl.DateTimeFormat;
  let numberFormats = 0;
  let dateTimeFormats = 0;
  Intl.NumberFormat = new Proxy(RealNumberFormat, {
    construct(target, args: [] ) { numberFormats++; return new target(...args); },
  });
  Intl.DateTimeFormat = new Proxy(RealDateTimeFormat, {
    construct(target, args: []) { dateTimeFormats++; return new target(...args); },
  });
  try {
    await work();
  } finally {
    Intl.NumberFormat = RealNumberFormat;
    Intl.DateTimeFormat = RealDateTimeFormat;
  }
  return { numberFormats, dateTimeFormats };
}

afterEach(() => { document.body.innerHTML = ''; });

describe('YearTable — formatter cost per render', () => {
  it('builds at most one number formatter per distinct precision, not one per row and month', async () => {
    const el = document.createElement('calendar-stats-year-table') as YearTable;
    Object.assign(el, { year: YEAR, visibleMonths: MONTHS, entityConfigs: [...CONFIGS], ...buildData() });
    document.body.appendChild(el);
    await el.updateComplete;

    const counts = await countIntlConstructions(async () => {
      el.visibleMonths = [...MONTHS];
      await el.updateComplete;
    });

    // Two distinct precisions in CONFIGS (default and 2); 36 row-sections rendered.
    expect(counts.numberFormats).toBeLessThanOrEqual(2);
    expect(counts.dateTimeFormats).toBeLessThanOrEqual(1);
  });
});

describe('YearSummaryTable — formatter cost per render', () => {
  it('builds at most one number formatter per distinct precision', async () => {
    const data = buildData();
    const el = document.createElement('calendar-stats-year-summary-table') as YearSummaryTable;
    el.entityConfigs = [...CONFIGS];
    el.segments = [{ year: YEAR, visibleMonths: MONTHS, ...data }];
    document.body.appendChild(el);
    await el.updateComplete;

    const counts = await countIntlConstructions(async () => {
      el.segments = [{ year: YEAR, visibleMonths: MONTHS, ...data }];
      await el.updateComplete;
    });

    expect(counts.numberFormats).toBeLessThanOrEqual(2);
  });
});

describe('YearTable — section scan cost per render', () => {
  it('builds the section list once per render instead of once per row and column lookup', async () => {
    const el = document.createElement('calendar-stats-year-table') as YearTable;
    Object.assign(el, { year: YEAR, visibleMonths: MONTHS, entityConfigs: [...CONFIGS], ...buildData() });
    document.body.appendChild(el);
    await el.updateComplete;

    const proto = Object.getPrototypeOf(el) as { _sections: () => unknown };
    const original = proto._sections;
    let calls = 0;
    proto._sections = function (this: YearTable) { calls++; return original.call(this); };
    try {
      el.visibleMonths = [...MONTHS];
      await el.updateComplete;
    } finally {
      proto._sections = original;
    }

    expect(calls).toBeLessThanOrEqual(1);
  });
});
