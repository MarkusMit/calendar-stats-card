import { describe, it, expect, vi, afterEach } from 'vitest';
import { YearSummaryTable } from '../../src/components/year-summary-table';
import type { MonthlySummary, EntityMetadata, DailyValue, MeasurementDailyValue } from '../../src/types/statistics';
import { rowSummaryKey } from '../../src/services/data-transform';

afterEach(() => {
  document.body.innerHTML = '';
});

const YEAR = 2025;

const tempMeta: EntityMetadata = {
  entityId: 'sensor.temp',
  stateClass: 'measurement',
  deviceClass: 'temperature',
  unitOfMeasurement: '°C',
  friendlyName: 'Temperature',
  hasStatistics: true,
};

const rainMeta: EntityMetadata = {
  entityId: 'sensor.rain',
  stateClass: 'total_increasing',
  deviceClass: 'precipitation',
  unitOfMeasurement: 'mm',
  friendlyName: 'Rain',
  hasStatistics: true,
};

function dailyTemp(month: number, day: number, mean: number): [string, MeasurementDailyValue] {
  const dateStr = `${YEAR}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return [`sensor.temp::${dateStr}`, {
    kind: 'measurement', entityId: 'sensor.temp', date: dateStr,
    min: mean - 1, mean, max: mean + 1, partialCoverage: false,
  }];
}

async function renderMixed(): Promise<YearSummaryTable> {
  const el = new YearSummaryTable();
  el.year = YEAR;
  el.visibleMonths = Array.from({ length: 12 }, (_, i) => i + 1);
  el.entityConfigs = [{ entity: 'sensor.temp' }, { entity: 'sensor.rain' }];
  const summaries = new Map<string, MonthlySummary>();
  summaries.set(rowSummaryKey(0, 'sensor.temp', YEAR, 1), {
    entityId: 'sensor.temp', year: YEAR, month: 1, min: -5, mean: 10, max: 15, total: null,
  });
  summaries.set(rowSummaryKey(0, 'sensor.temp', YEAR, 7), {
    entityId: 'sensor.temp', year: YEAR, month: 7, min: 12, mean: 30, max: 33, total: null,
  });
  summaries.set(rowSummaryKey(1, 'sensor.rain', YEAR, 1), {
    entityId: 'sensor.rain', year: YEAR, month: 1, min: null, mean: null, max: null, total: 40,
  });
  summaries.set(rowSummaryKey(1, 'sensor.rain', YEAR, 2), {
    entityId: 'sensor.rain', year: YEAR, month: 2, min: null, mean: null, max: null, total: 20,
  });
  el.monthlySummaries = summaries;
  // temp: 3 days at 10 in Jan, 1 day at 30 in Jul → day-weighted avg = 15
  el.dailyValues = new Map<string, DailyValue>([
    dailyTemp(1, 1, 10), dailyTemp(1, 2, 10), dailyTemp(1, 3, 10),
    dailyTemp(7, 1, 30),
  ]);
  el.entityMetadata = new Map([['sensor.temp', tempMeta], ['sensor.rain', rainMeta]]);
  el.entityErrors = new Set();
  el.lang = 'en';
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  return el;
}

describe('YearSummaryTable — yearly Summary/Total columns (T012)', () => {
  it('header has a Summary column and a Total column (cumulative present)', async () => {
    const el = await renderMixed();
    const headers = [...el.shadowRoot!.querySelectorAll('thead th')].map((h) => h.textContent!.trim());
    expect(headers).toContain('Summary');
    expect(headers).toContain('Total');
  });

  it('de: roll-up column is labeled "Jahr", not the monthly view\'s "Monat"', async () => {
    const el = await renderMixed();
    el.lang = 'de';
    await el.updateComplete;
    const headers = [...el.shadowRoot!.querySelectorAll('thead th')].map((h) => h.textContent!.trim());
    expect(headers).toContain('Jahr');
    expect(headers).not.toContain('Monat');
  });

  it('measurement sub-rows show yearly min / day-weighted avg / max', async () => {
    const el = await renderMixed();
    const rows = [...el.shadowRoot!.querySelectorAll('tbody tr')];
    // rows 0-2 are temp min/avg/max
    const minSummary = rows[0]!.querySelector('td.summary-column');
    const avgSummary = rows[1]!.querySelector('td.summary-column');
    const maxSummary = rows[2]!.querySelector('td.summary-column');
    expect(minSummary?.textContent).toContain('-5.0');
    expect(avgSummary?.textContent).toContain('15.0'); // day-weighted, not 20.0
    expect(maxSummary?.textContent).toContain('33.0');
  });

  it('cumulative row shows yearly Total = sum of monthly totals and Summary over monthly totals', async () => {
    const el = await renderMixed();
    const rows = [...el.shadowRoot!.querySelectorAll('tbody tr')];
    const rainRow = rows[3]!;
    const summaryCells = rainRow.querySelectorAll('td.summary-column');
    expect(summaryCells.length).toBe(2); // Summary + Total
    const summaryText = summaryCells[0]!.textContent!;
    expect(summaryText).toContain('30.0');  // mean of 40, 20
    expect(summaryText).toContain('20.0');  // ↓min
    expect(summaryText).toContain('40.0');  // ↑max
    expect(summaryCells[1]!.textContent).toContain('60.0'); // total
  });
});
