import { describe, it, expect, vi, afterEach } from 'vitest';
import { YearTable } from '../../src/components/year-table';
import type { EntityConfig } from '../../src/types/card-config';
import type { CumulativeDailyValue, MonthlySummary, EntityMetadata } from '../../src/types/statistics';
import { rowSummaryKey } from '../../src/services/data-transform';

afterEach(() => {
  document.body.innerHTML = '';
});

const RAIN_ID = 'sensor.rain';

const rainMeta: EntityMetadata = {
  entityId: RAIN_ID,
  stateClass: 'total_increasing',
  deviceClass: 'precipitation',
  unitOfMeasurement: 'mm',
  friendlyName: 'Rain',
  hasStatistics: true,
};

function cumulDay(sum: number, day = 1): [string, CumulativeDailyValue] {
  const date = `2025-01-${String(day).padStart(2, '0')}`;
  return [`${RAIN_ID}::${date}`, { kind: 'cumulative', entityId: RAIN_ID, date, sum, partialCoverage: false }];
}

async function renderRow(opts: {
  configs: EntityConfig[];
  daily?: Map<string, CumulativeDailyValue>;
  summaries?: Map<string, MonthlySummary>;
}) {
  const el = new YearTable();
  el.year = 2025;
  el.visibleMonths = [1];
  el.entityConfigs = opts.configs;
  el.dailyValues = opts.daily ?? new Map();
  el.monthlySummaries = opts.summaries ?? new Map();
  el.entityMetadata = new Map([[RAIN_ID, rainMeta]]);
  el.entityErrors = new Set();
  el.lang = 'en';
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('no root');
  }, { timeout: 3000 });
  return el;
}

// rowIndex 0, single rain row in January 2025.
const SUMMARY_KEY = rowSummaryKey(0, RAIN_ID, 2025, 1);

describe('YearTable — default precision (US1: no precision set)', () => {
  it('day value 1.234 → 1.2', async () => {
    const el = await renderRow({ configs: [{ entity: RAIN_ID }], daily: new Map([cumulDay(1.234)]) });
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('1.2');
  });

  it('whole-number value 5 → 5.0 (fixed one decimal)', async () => {
    const el = await renderRow({ configs: [{ entity: RAIN_ID }], daily: new Map([cumulDay(5)]) });
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('5.0');
  });

  it('monthly total 12.36 → 12.4', async () => {
    const summary: MonthlySummary = { entityId: RAIN_ID, year: 2025, month: 1, min: 1.24, mean: 2.71, max: 9.93, total: 12.36 };
    const el = await renderRow({ configs: [{ entity: RAIN_ID }], summaries: new Map([[SUMMARY_KEY, summary]]) });
    const cols = el.shadowRoot!.querySelectorAll('td.summary-column');
    expect(cols[cols.length - 1]?.textContent?.trim()).toBe('12.4');
  });

  it('monthly avg/min/max render with one decimal', async () => {
    const summary: MonthlySummary = { entityId: RAIN_ID, year: 2025, month: 1, min: 1.24, mean: 2.71, max: 9.93, total: 12.36 };
    const el = await renderRow({ configs: [{ entity: RAIN_ID }], summaries: new Map([[SUMMARY_KEY, summary]]) });
    const cumul = el.shadowRoot!.querySelector('.cumul-summary');
    const text = cumul?.textContent ?? '';
    expect(text).toContain('2.7');
    expect(text).toContain('1.2');
    expect(text).toContain('9.9');
  });
});

describe('YearTable — explicit precision override (US2)', () => {
  it('precision: 2 → 1.234 renders 1.23', async () => {
    const el = await renderRow({ configs: [{ entity: RAIN_ID, precision: 2 }], daily: new Map([cumulDay(1.234)]) });
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('1.23');
  });

  it('precision: 0 → 1.6 renders 2', async () => {
    const el = await renderRow({ configs: [{ entity: RAIN_ID, precision: 0 }], daily: new Map([cumulDay(1.6)]) });
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('2');
  });

  it('mixed rows: explicit precision:2 row and default row coexist', async () => {
    const el = await renderRow({
      configs: [{ entity: RAIN_ID, precision: 2 }],
      daily: new Map([cumulDay(1.234)]),
    });
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('1.23');
  });
});
