import { describe, it, expect, vi, afterEach } from 'vitest';
import { YearSummaryTable } from '../../src/components/year-summary-table';
import type { MonthlySummary, EntityMetadata } from '../../src/types/statistics';
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

async function renderWithThreshold(): Promise<YearSummaryTable> {
  const el = new YearSummaryTable();
  el.year = YEAR;
  el.visibleMonths = Array.from({ length: 12 }, (_, i) => i + 1);
  el.entityConfigs = [{
    entity: 'sensor.rain',
    thresholds: [{ operator: 'above', value: 20, background_color: 'red', name: 'Heavy rain' }],
  }];
  const summaries = new Map<string, MonthlySummary>();
  summaries.set(rowSummaryKey(0, 'sensor.rain', YEAR, 1), {
    entityId: 'sensor.rain', year: YEAR, month: 1, min: null, mean: null, max: null, total: 42,
  });
  summaries.set(rowSummaryKey(0, 'sensor.rain', YEAR, 2), {
    entityId: 'sensor.rain', year: YEAR, month: 2, min: null, mean: null, max: null, total: 5,
  });
  el.monthlySummaries = summaries;
  el.dailyValues = new Map();
  el.entityMetadata = new Map([['sensor.rain', rainMeta]]);
  el.entityErrors = new Set();
  el.lang = 'en';
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  return el;
}

describe('YearSummaryTable — threshold coloring (T005)', () => {
  it('colors a month cell whose value triggers a rule; non-triggering cell stays plain', async () => {
    const el = await renderWithThreshold();
    const cells = [...el.shadowRoot!.querySelectorAll('tbody td.data-cell')];
    const jan = cells.find((c) => c.textContent!.includes('42'));
    const feb = cells.find((c) => c.textContent!.includes('5'));
    expect(jan).toBeTruthy();
    expect(feb).toBeTruthy();
    expect((jan as HTMLElement).getAttribute('style') ?? '').toContain('background-color:red');
    expect((feb as HTMLElement).getAttribute('style') ?? '').not.toContain('background-color:red');
  });

  it('emits thresholds-applied with the triggered rule group', async () => {
    const groups: unknown[] = [];
    const el = new YearSummaryTable();
    el.addEventListener('thresholds-applied', (e) => groups.push(...(e as CustomEvent).detail.groups));
    // configure before attach so the first render dispatches
    el.year = YEAR;
    el.visibleMonths = [1];
    el.entityConfigs = [{
      entity: 'sensor.rain',
      thresholds: [{ operator: 'above', value: 20, background_color: 'red', name: 'Heavy rain' }],
    }];
    const summaries = new Map<string, MonthlySummary>();
    summaries.set(rowSummaryKey(0, 'sensor.rain', YEAR, 1), {
      entityId: 'sensor.rain', year: YEAR, month: 1, min: null, mean: null, max: null, total: 42,
    });
    el.monthlySummaries = summaries;
    el.dailyValues = new Map();
    el.entityMetadata = new Map([['sensor.rain', rainMeta]]);
    el.entityErrors = new Set();
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (groups.length === 0) throw new Error('no thresholds-applied yet');
    }, { timeout: 3000 });
    const g = groups[0] as { label: string; rules: { name?: string }[] };
    expect(g.label).toContain('Rain');
    expect(g.rules.some((r) => r.name === 'Heavy rain')).toBe(true);
  });
});
