import { describe, it, expect, afterEach } from 'vitest';
import '../../src/components/year-table';
import '../../src/components/year-summary-table';
import type { YearTable } from '../../src/components/year-table';
import type { YearSummaryTable } from '../../src/components/year-summary-table';
import type { EntityConfig } from '../../src/types/card-config';
import type { DailyValue, MonthlySummary, EntityMetadata } from '../../src/types/statistics';
import { DailyValueIndex } from '../../src/services/daily-value-index';

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
  const dailyValues = new DailyValueIndex();
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
        dailyValues.set(key, `${YEAR}-${pad(m)}-${pad(d)}`,
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

describe('YearTable — daily lookup cost per render', () => {
  it('resolves each row once per month section instead of once per day cell', async () => {
    const el = document.createElement('calendar-stats-year-table') as YearTable;
    Object.assign(el, { year: YEAR, visibleMonths: MONTHS, entityConfigs: [...CONFIGS], ...buildData() });
    document.body.appendChild(el);
    await el.updateComplete;

    let rowCalls = 0;
    let getCalls = 0;
    const realRow = DailyValueIndex.prototype.row;
    const realGet = DailyValueIndex.prototype.get;
    DailyValueIndex.prototype.row = function (this: DailyValueIndex, rowKey: string) {
      rowCalls++;
      return realRow.call(this, rowKey);
    };
    DailyValueIndex.prototype.get = function (this: DailyValueIndex, rowKey: string, date: string) {
      getCalls++;
      return realGet.call(this, rowKey, date);
    };
    try {
      el.visibleMonths = [...MONTHS];
      await el.updateComplete;
    } finally {
      DailyValueIndex.prototype.row = realRow;
      DailyValueIndex.prototype.get = realGet;
    }

    // 3 rows x 12 month sections; a per-cell lookup would be 36 x 31.
    expect(rowCalls).toBeGreaterThan(0);
    expect(rowCalls).toBeLessThanOrEqual(CONFIGS.length * MONTHS.length);
    expect(getCalls).toBe(0);
  });
});

describe('YearTable — section list identity', () => {
  it('hands out the same section list while its inputs are unchanged', async () => {
    const el = document.createElement('calendar-stats-year-table') as YearTable;
    Object.assign(el, { year: YEAR, visibleMonths: MONTHS, entityConfigs: [...CONFIGS], ...buildData() });
    document.body.appendChild(el);
    await el.updateComplete;

    // Downstream memos (placeholder column widths, row-type flags) key on this
    // array, so a fresh one per render would put a full data walk back on the
    // render path.
    const inner = el as unknown as { _sections: () => unknown };
    const first = inner._sections();
    el.lang = 'de';
    await el.updateComplete;

    expect(inner._sections()).toBe(first);
  });
});

describe('YearTable — day key cost per render', () => {
  it('builds the day keys of a section once, not again on every render', async () => {
    const el = document.createElement('calendar-stats-year-table') as YearTable;
    Object.assign(el, { year: YEAR, visibleMonths: MONTHS, entityConfigs: [...CONFIGS], ...buildData() });
    document.body.appendChild(el);
    await el.updateComplete;

    const proto = Object.getPrototypeOf(el) as { dayKeys: (y: number, m: number) => string[] };
    const original = proto.dayKeys;
    let calls = 0;
    proto.dayKeys = function (this: YearTable, y: number, m: number) {
      calls++;
      return original.call(this, y, m);
    };
    try {
      el.lang = 'de';
      await el.updateComplete;
    } finally {
      proto.dayKeys = original;
    }

    // The sections did not change, so their date strings did not either.
    expect(calls).toBe(0);
  });
});
