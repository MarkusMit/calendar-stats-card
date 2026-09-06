import { describe, it, expect, vi, afterEach } from 'vitest';
import { YearTable } from '../../src/components/year-table';
import { YearSummaryTable } from '../../src/components/year-summary-table';
import { MonthComparisonTable } from '../../src/components/month-comparison-table';
import type { EntityMetadata, MonthlySummary, CumulativeDailyValue, DailyValue } from '../../src/types/statistics';
import { rowSummaryKey } from '../../src/services/data-transform';

afterEach(() => {
  document.body.innerHTML = '';
});

const NBSP = ' ';
const RAIN_ID = 'sensor.rain';

const rainMeta: EntityMetadata = {
  entityId: RAIN_ID,
  stateClass: 'total_increasing',
  deviceClass: 'precipitation',
  unitOfMeasurement: 'mm',
  friendlyName: 'Rain',
  hasStatistics: true,
};

async function waitReady(el: HTMLElement & { updateComplete: Promise<boolean> }): Promise<void> {
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('no root');
  }, { timeout: 3000 });
}

describe('empty cells render a non-breaking space (borders via td.data-cell)', () => {
  it('YearTable: day cells without data contain NBSP', async () => {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1];
    el.entityConfigs = [{ entity: RAIN_ID }];
    const dayVal: CumulativeDailyValue = {
      kind: 'cumulative', entityId: RAIN_ID, date: '2025-01-01',
      sum: 12,
    };
    el.dailyValues = new Map([[`${RAIN_ID}::2025-01-01`, dayVal]]);
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[RAIN_ID, rainMeta]]);
    el.entityErrors = new Set();
    el.lang = 'en';
    await waitReady(el);
    const cells = [...el.shadowRoot!.querySelectorAll('td.data-cell')];
    const day2 = cells[1]!; // Jan 2 — no data
    expect(day2.textContent).toBe(NBSP);
    const day1 = cells[0]!; // Jan 1 — has data
    expect(day1.textContent).toContain('12');
  });

  it('YearSummaryTable: month cells without data contain NBSP', async () => {
    const el = new YearSummaryTable();
    el.entityConfigs = [{ entity: RAIN_ID }];
    const summaries = new Map<string, MonthlySummary>();
    summaries.set(rowSummaryKey(0, RAIN_ID, 2025, 1), {
      entityId: RAIN_ID, year: 2025, month: 1, min: null, mean: null, max: null, total: 42,
    });
    el.segments = [{
      year: 2025,
      visibleMonths: [1, 2],
      monthlySummaries: summaries,
      dailyValues: new Map<string, DailyValue>(),
      entityMetadata: new Map([[RAIN_ID, rainMeta]]),
    }];
    el.entityErrors = new Set();
    el.lang = 'en';
    await waitReady(el);
    const cells = [...el.shadowRoot!.querySelectorAll('td.data-cell')];
    const feb = cells[1]!; // February — no summary
    expect(feb.textContent).toBe(NBSP);
  });

  it('MonthComparisonTable: value, diff, and average cells without data contain NBSP', async () => {
    const el = new MonthComparisonTable();
    el.month = 6;
    const monthlySummaries = new Map<string, MonthlySummary>();
    el.segments = [{
      year: 2024,
      visibleMonths: Array.from({ length: 12 }, (_, i) => i + 1),
      monthlySummaries,
      dailyValues: new Map<string, DailyValue>(),
      entityMetadata: new Map([[RAIN_ID, rainMeta]]),
    }];
    el.entityConfigs = [{ entity: RAIN_ID }];
    el.entityErrors = new Set();
    el.now = { year: 2026, month: 3 };
    el.lang = 'en';
    await waitReady(el);
    expect(el.shadowRoot!.querySelector('td.data-cell')!.textContent).toBe(NBSP);
    for (const diff of el.shadowRoot!.querySelectorAll('td.diff-cell')) {
      expect(diff.textContent).toBe(NBSP);
    }
    expect(el.shadowRoot!.querySelector('td.avg-cell')!.textContent).toBe(NBSP);
  });
});
