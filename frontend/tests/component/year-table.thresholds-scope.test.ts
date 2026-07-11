import { describe, it, expect, vi, afterEach } from 'vitest';
import { YearTable } from '../../src/components/year-table';
import type { ThresholdRule } from '../../src/types/card-config';
import type { EntityMetadata, MonthlySummary, CumulativeDailyValue } from '../../src/types/statistics';
import { rowSummaryKey } from '../../src/services/data-transform';

afterEach(() => {
  document.body.innerHTML = '';
});

const RAIN_ID = 'sensor.rain';

const precipMeta: EntityMetadata = {
  entityId: RAIN_ID,
  stateClass: 'total_increasing',
  deviceClass: 'precipitation',
  unitOfMeasurement: 'mm',
  friendlyName: 'Rain',
  hasStatistics: true,
};

/** Cumulative rain row: one daily value (12 mm on Jan 1) and a January monthly total of 160 mm. */
async function renderRain(thresholds: ThresholdRule[]): Promise<YearTable> {
  const el = new YearTable();
  el.year = 2025;
  el.visibleMonths = [1];
  el.entityConfigs = [{ entity: RAIN_ID, thresholds }];
  const dayVal: CumulativeDailyValue = {
    kind: 'cumulative', entityId: RAIN_ID, date: '2025-01-01',
    sum: 12, partialCoverage: false,
  };
  el.dailyValues = new Map([[`${RAIN_ID}::2025-01-01`, dayVal]]);
  const summary: MonthlySummary = {
    entityId: RAIN_ID, year: 2025, month: 1, min: 12, mean: 12, max: 12, total: 160,
  };
  el.monthlySummaries = new Map([[rowSummaryKey(0, RAIN_ID, 2025, 1), summary]]);
  el.entityMetadata = new Map([[RAIN_ID, precipMeta]]);
  el.entityErrors = new Set();
  el.lang = 'en';
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('no root');
  }, { timeout: 3000 });
  return el;
}

function totalCell(el: YearTable): HTMLElement {
  // Cumulative row: last summary-column cell is the Total column.
  const summaryCells = [...el.shadowRoot!.querySelectorAll<HTMLElement>('tbody td.summary-column')];
  const cell = summaryCells.at(-1);
  if (!cell || !cell.textContent!.includes('160')) throw new Error('total cell not found');
  return cell;
}

describe('YearTable — Total column threshold coloring by scope (015/US2)', () => {
  it('month-scope rule colors the Total column when the monthly total qualifies', async () => {
    const el = await renderRain([{ operator: 'above', value: 150, scope: 'month', background_color: 'blue' }]);
    expect(totalCell(el).getAttribute('style') ?? '').toContain('background-color:blue');
  });

  it('month-scope rule leaves the Total column plain when the total does not qualify', async () => {
    const el = await renderRain([{ operator: 'above', value: 200, scope: 'month', background_color: 'blue' }]);
    expect(totalCell(el).getAttribute('style') ?? '').not.toContain('background-color:blue');
  });

  it('day-scope rule NEVER colors the Total column', async () => {
    // total 160 far exceeds the day rule's 10 — must still not color
    const el = await renderRain([{ operator: 'above', value: 10, background_color: 'red' }]);
    expect(totalCell(el).getAttribute('style') ?? '').not.toContain('background-color:red');
  });

  it('month-scope rule NEVER colors daily cells', async () => {
    // daily value 12 exceeds the month rule's 5 — must still not color
    const el = await renderRain([{ operator: 'above', value: 5, scope: 'month', background_color: 'blue' }]);
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.getAttribute('style') ?? '').not.toContain('background-color:blue');
  });

  it('day-scope rule still colors daily cells (regression guard)', async () => {
    const el = await renderRain([{ operator: 'above', value: 10, background_color: 'red' }]);
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.getAttribute('style') ?? '').toContain('background-color:red');
  });

  it('named month-scope rule firing on the Total column reports to the legend', async () => {
    const groups: unknown[] = [];
    document.body.addEventListener('thresholds-applied', (e) => groups.push(...(e as CustomEvent).detail.groups));
    await renderRain([{ operator: 'above', value: 150, scope: 'month', name: 'Wet month', background_color: 'blue' }]);
    await vi.waitFor(() => {
      if (groups.length === 0) throw new Error('no thresholds-applied yet');
    }, { timeout: 3000 });
    const g = groups[0] as { rules: { name?: string }[] };
    expect(g.rules.some((r) => r.name === 'Wet month')).toBe(true);
  });
});
