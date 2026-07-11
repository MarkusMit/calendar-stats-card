import { describe, it, expect, vi, afterEach } from 'vitest';
import { YearSummaryTable } from '../../src/components/year-summary-table';
import type { EntityConfig } from '../../src/types/card-config';
import type { MonthlySummary, EntityMetadata, DailyValue } from '../../src/types/statistics';
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

function summariesFor(rowIndex: number, entityId: string, months: Partial<Record<number, Partial<MonthlySummary>>>): Map<string, MonthlySummary> {
  const map = new Map<string, MonthlySummary>();
  for (const [mStr, s] of Object.entries(months)) {
    const month = Number(mStr);
    map.set(rowSummaryKey(rowIndex, entityId, YEAR, month), {
      entityId, year: YEAR, month,
      min: null, mean: null, max: null, total: null,
      ...s,
    });
  }
  return map;
}

async function renderTable(overrides: Partial<{
  entityConfigs: EntityConfig[];
  monthlySummaries: Map<string, MonthlySummary>;
  entityMetadata: Map<string, EntityMetadata>;
  dailyValues: Map<string, DailyValue>;
  visibleMonths: number[];
  lang: string;
}> = {}): Promise<YearSummaryTable> {
  const el = new YearSummaryTable();
  el.segments = [{
    year: YEAR,
    visibleMonths: overrides.visibleMonths ?? Array.from({ length: 12 }, (_, i) => i + 1),
    monthlySummaries: overrides.monthlySummaries ?? new Map(),
    dailyValues: overrides.dailyValues ?? new Map(),
    entityMetadata: overrides.entityMetadata ?? new Map([['sensor.temp', tempMeta]]),
  }];
  el.entityConfigs = overrides.entityConfigs ?? [{ entity: 'sensor.temp' }];
  el.entityErrors = new Set();
  el.lang = overrides.lang ?? 'en';
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  return el;
}

describe('YearSummaryTable — grid structure (T004)', () => {
  it('renders 12 month column headers Jan–Dec', async () => {
    const el = await renderTable();
    const monthHeaders = el.shadowRoot!.querySelectorAll('th.month-col');
    expect(monthHeaders.length).toBe(12);
    expect(monthHeaders[0]!.textContent).toContain('Jan');
    expect(monthHeaders[11]!.textContent).toContain('Dec');
  });

  it('label column shows entity name and unit (FR-012)', async () => {
    const el = await renderTable();
    const label = el.shadowRoot!.querySelector('td.label-column');
    expect(label?.textContent).toContain('Temperature');
    expect(label?.textContent).toContain('[°C]');
  });

  it('measurement entity renders 3 sub-rows (min/avg/max) with monthly summary values', async () => {
    const summaries = summariesFor(0, 'sensor.temp', {
      3: { min: -2, mean: 5, max: 12 },
    });
    const el = await renderTable({ monthlySummaries: summaries });
    const subLabels = el.shadowRoot!.querySelectorAll('td.sub-label');
    expect(subLabels.length).toBe(3);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
    // March column (index: label+sublabel offset) — check row text contains formatted values
    expect(rows[0]!.textContent).toContain('-2.0');  // min row
    expect(rows[1]!.textContent).toContain('5.0');   // avg row
    expect(rows[2]!.textContent).toContain('12.0');  // max row
  });

  it('show_min: false hides the min sub-row', async () => {
    const el = await renderTable({
      entityConfigs: [{ entity: 'sensor.temp', show_min: false }],
    });
    const subLabels = el.shadowRoot!.querySelectorAll('td.sub-label');
    expect(subLabels.length).toBe(2);
  });

  it('cumulative entity renders a single row with monthly totals', async () => {
    const summaries = summariesFor(0, 'sensor.rain', {
      1: { total: 42.5 },
      2: { total: 10 },
    });
    const el = await renderTable({
      entityConfigs: [{ entity: 'sensor.rain' }],
      entityMetadata: new Map([['sensor.rain', rainMeta]]),
      monthlySummaries: summaries,
    });
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    expect(rows.length).toBe(1);
    expect(rows[0]!.textContent).toContain('42.5');
    expect(rows[0]!.textContent).toContain('10.0');
  });

  it('a month with no summary renders an empty cell, not zero (FR-008)', async () => {
    const summaries = summariesFor(0, 'sensor.rain', { 1: { total: 5 } });
    const el = await renderTable({
      entityConfigs: [{ entity: 'sensor.rain' }],
      entityMetadata: new Map([['sensor.rain', rainMeta]]),
      monthlySummaries: summaries,
    });
    const cells = el.shadowRoot!.querySelectorAll('tbody td.data-cell');
    // 12 month cells; only January has data
    const nonEmpty = [...cells].filter((c) => c.textContent!.trim() !== '');
    expect(nonEmpty.length).toBe(1);
    expect(nonEmpty[0]!.textContent).toContain('5.0');
  });

  it('months outside visibleMonths render as pad cells (future clamp)', async () => {
    const el = await renderTable({
      entityConfigs: [{ entity: 'sensor.rain' }],
      entityMetadata: new Map([['sensor.rain', rainMeta]]),
      visibleMonths: [1, 2, 3, 4, 5, 6, 7],
    });
    const padHeaders = el.shadowRoot!.querySelectorAll('th.month-col.pad-month');
    expect(padHeaders.length).toBe(5); // Aug–Dec
    const padCells = el.shadowRoot!.querySelectorAll('tbody td.pad-cell');
    expect(padCells.length).toBe(5);
  });

  it('multiple year segments render inside ONE table (shared column widths)', async () => {
    const el = new YearSummaryTable();
    const meta = new Map([['sensor.rain', rainMeta]]);
    el.segments = [
      { year: YEAR - 1, visibleMonths: Array.from({ length: 12 }, (_, i) => i + 1), monthlySummaries: new Map(), dailyValues: new Map(), entityMetadata: meta },
      { year: YEAR, visibleMonths: Array.from({ length: 12 }, (_, i) => i + 1), monthlySummaries: new Map(), dailyValues: new Map(), entityMetadata: meta },
    ];
    el.entityConfigs = [{ entity: 'sensor.rain' }];
    el.entityErrors = new Set();
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('shadow root not ready');
    }, { timeout: 3000 });
    expect(el.shadowRoot!.querySelectorAll('table').length).toBe(1);
    expect(el.shadowRoot!.querySelectorAll('thead').length).toBe(2);
    expect(el.shadowRoot!.querySelectorAll('tbody').length).toBe(2);
    const yearNames = [...el.shadowRoot!.querySelectorAll('th.year-name')].map((h) => h.textContent!.trim());
    expect(yearNames).toEqual([String(YEAR - 1), String(YEAR)]);
  });
});
