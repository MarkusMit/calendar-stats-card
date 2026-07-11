import { describe, it, expect, vi, afterEach } from 'vitest';
import { YearSummaryTable } from '../../src/components/year-summary-table';
import type { MonthlySummary, EntityMetadata } from '../../src/types/statistics';
import type { ThresholdRule } from '../../src/types/card-config';
import { rowSummaryKey } from '../../src/services/data-transform';

afterEach(() => {
  document.body.innerHTML = '';
});

const YEAR = 2025;

const rainMeta: EntityMetadata = {
  entityId: 'sensor.rain',
  stateClass: 'total_increasing',
  deviceClass: 'precipitation',
  unitOfMeasurement: 'mm',
  friendlyName: 'Rain',
  hasStatistics: true,
};

const tempMeta: EntityMetadata = {
  entityId: 'sensor.temp',
  stateClass: 'measurement',
  deviceClass: 'temperature',
  unitOfMeasurement: '°C',
  friendlyName: 'Temp',
  hasStatistics: true,
};

/** Cumulative rain row with monthly totals 42 (Jan) and 5 (Feb). */
async function renderRain(thresholds: ThresholdRule[]): Promise<YearSummaryTable> {
  const el = new YearSummaryTable();
  el.entityConfigs = [{ entity: 'sensor.rain', thresholds }];
  const summaries = new Map<string, MonthlySummary>();
  summaries.set(rowSummaryKey(0, 'sensor.rain', YEAR, 1), {
    entityId: 'sensor.rain', year: YEAR, month: 1, min: null, mean: null, max: null, total: 42,
  });
  summaries.set(rowSummaryKey(0, 'sensor.rain', YEAR, 2), {
    entityId: 'sensor.rain', year: YEAR, month: 2, min: null, mean: null, max: null, total: 5,
  });
  el.segments = [{
    year: YEAR,
    visibleMonths: Array.from({ length: 12 }, (_, i) => i + 1),
    monthlySummaries: summaries,
    dailyValues: new Map(),
    entityMetadata: new Map([['sensor.rain', rainMeta]]),
  }];
  el.entityErrors = new Set();
  el.lang = 'en';
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  return el;
}

/** Measurement temp row with January min 2 / mean 10 / max 25. */
async function renderTemp(thresholds: ThresholdRule[]): Promise<YearSummaryTable> {
  const el = new YearSummaryTable();
  el.entityConfigs = [{ entity: 'sensor.temp', thresholds }];
  const summaries = new Map<string, MonthlySummary>();
  summaries.set(rowSummaryKey(0, 'sensor.temp', YEAR, 1), {
    entityId: 'sensor.temp', year: YEAR, month: 1, min: 2, mean: 10, max: 25, total: null,
  });
  el.segments = [{
    year: YEAR,
    visibleMonths: [1],
    monthlySummaries: summaries,
    dailyValues: new Map(),
    entityMetadata: new Map([['sensor.temp', tempMeta]]),
  }];
  el.entityErrors = new Set();
  el.lang = 'en';
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  return el;
}

describe('YearSummaryTable — day-scope rules on month-scale cells (015/US1)', () => {
  const dayRule: ThresholdRule = { operator: 'above', value: 20, background_color: 'red', name: 'Heavy rain' };

  it('scope-less (day) rule does NOT color cumulative month cells', async () => {
    const el = await renderRain([dayRule]);
    const cells = [...el.shadowRoot!.querySelectorAll('tbody td.data-cell')];
    const jan = cells.find((c) => c.textContent!.includes('42'));
    expect(jan).toBeTruthy();
    expect((jan as HTMLElement).getAttribute('style') ?? '').not.toContain('background-color:red');
  });

  it('scope-less (day) rule does NOT color the cumulative year rollup', async () => {
    const el = await renderRain([dayRule]);
    const summaryCells = [...el.shadowRoot!.querySelectorAll('tbody td.summary-column')];
    for (const cell of summaryCells) {
      expect((cell as HTMLElement).getAttribute('style') ?? '').not.toContain('background-color:red');
    }
  });

  it('measurement month cells KEEP day-rule coloring (day-scale values)', async () => {
    // not-below 0 on the monthly min (frost-free month) — a day-scale statistic
    const frost: ThresholdRule = { operator: 'not-below', value: 0, background_color: 'lime' };
    const el = await renderTemp([frost]);
    const cells = [...el.shadowRoot!.querySelectorAll('tbody td.data-cell.has-data')];
    const minCell = cells.find((c) => c.textContent!.trim() === '2.0');
    expect(minCell).toBeTruthy();
    expect((minCell as HTMLElement).getAttribute('style') ?? '').toContain('background-color:lime');
  });
});

describe('YearSummaryTable — month-scope rules color monthly totals (015/US2)', () => {
  const monthRule: ThresholdRule = { operator: 'above', value: 20, scope: 'month', background_color: 'blue', name: 'Wet month' };

  it('month rule colors qualifying month cells only', async () => {
    const el = await renderRain([monthRule]);
    const cells = [...el.shadowRoot!.querySelectorAll('tbody td.data-cell')];
    const jan = cells.find((c) => c.textContent!.includes('42'));
    const feb = cells.find((c) => c.textContent!.includes('5'));
    expect((jan as HTMLElement).getAttribute('style') ?? '').toContain('background-color:blue');
    expect((feb as HTMLElement).getAttribute('style') ?? '').not.toContain('background-color:blue');
  });

  it('month rule colors the cumulative year rollup (mean of monthly totals)', async () => {
    // rollup mean = (42+5)/2 = 23.5 > 20 → colored
    const el = await renderRain([monthRule]);
    const summaryCells = [...el.shadowRoot!.querySelectorAll('tbody td.summary-column')];
    const rollup = summaryCells.find((c) => (c.textContent ?? '').includes('Ø'));
    expect(rollup).toBeTruthy();
    expect((rollup as HTMLElement).getAttribute('style') ?? '').toContain('background-color:blue');
  });

  it('emits thresholds-applied with the triggered month-scope rule group', async () => {
    const groups: unknown[] = [];
    const el = new YearSummaryTable();
    el.addEventListener('thresholds-applied', (e) => groups.push(...(e as CustomEvent).detail.groups));
    el.entityConfigs = [{ entity: 'sensor.rain', thresholds: [monthRule] }];
    const summaries = new Map<string, MonthlySummary>();
    summaries.set(rowSummaryKey(0, 'sensor.rain', YEAR, 1), {
      entityId: 'sensor.rain', year: YEAR, month: 1, min: null, mean: null, max: null, total: 42,
    });
    el.segments = [{
      year: YEAR,
      visibleMonths: [1],
      monthlySummaries: summaries,
      dailyValues: new Map(),
      entityMetadata: new Map([['sensor.rain', rainMeta]]),
    }];
    el.entityErrors = new Set();
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (groups.length === 0) throw new Error('no thresholds-applied yet');
    }, { timeout: 3000 });
    const g = groups[0] as { label: string; rules: { name?: string }[] };
    expect(g.label).toContain('Rain');
    expect(g.rules.some((r) => r.name === 'Wet month')).toBe(true);
  });
});
