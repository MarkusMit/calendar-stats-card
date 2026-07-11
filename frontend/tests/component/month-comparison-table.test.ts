import { describe, it, expect, vi, afterEach } from 'vitest';
import { MonthComparisonTable } from '../../src/components/month-comparison-table';
import type { EntityConfig, ThresholdLegendGroup } from '../../src/types/card-config';
import type { MonthlySummary, EntityMetadata, DailyValue } from '../../src/types/statistics';
import { rowSummaryKey } from '../../src/services/data-transform';

afterEach(() => {
  document.body.innerHTML = '';
});

const MONTH = 6;
const NOW = { year: 2026, month: 3 };

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

interface SegmentSpec {
  year: number;
  summaries: Array<{ rowIndex: number; entityId: string; values: Partial<MonthlySummary> }>;
}

function makeSegments(specs: SegmentSpec[]) {
  return specs.map((spec) => {
    const monthlySummaries = new Map<string, MonthlySummary>();
    for (const s of spec.summaries) {
      monthlySummaries.set(rowSummaryKey(s.rowIndex, s.entityId, spec.year, MONTH), {
        entityId: s.entityId, year: spec.year, month: MONTH,
        min: null, mean: null, max: null, total: null,
        ...s.values,
      });
    }
    return {
      year: spec.year,
      visibleMonths: Array.from({ length: 12 }, (_, i) => i + 1),
      monthlySummaries,
      dailyValues: new Map<string, DailyValue>(),
      entityMetadata: new Map([['sensor.temp', tempMeta], ['sensor.rain', rainMeta]]),
    };
  });
}

async function renderTable(overrides: Partial<{
  entityConfigs: EntityConfig[];
  segments: ReturnType<typeof makeSegments>;
  now: { year: number; month: number };
  lang: string;
  month: number;
}> = {}): Promise<MonthComparisonTable> {
  const el = new MonthComparisonTable();
  el.month = overrides.month ?? MONTH;
  el.segments = overrides.segments ?? makeSegments([
    { year: 2024, summaries: [{ rowIndex: 0, entityId: 'sensor.rain', values: { total: 10 } }] },
    { year: 2025, summaries: [{ rowIndex: 0, entityId: 'sensor.rain', values: { total: 14 } }] },
  ]);
  el.entityConfigs = overrides.entityConfigs ?? [{ entity: 'sensor.rain' }];
  el.entityErrors = new Set();
  el.now = overrides.now ?? NOW;
  el.lang = overrides.lang ?? 'en';
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  return el;
}

function cells(el: MonthComparisonTable, selector: string): HTMLElement[] {
  return [...el.shadowRoot!.querySelectorAll<HTMLElement>(selector)];
}

describe('MonthComparisonTable — structure (FR-003, column revision)', () => {
  it('renders one year header per segment with colspan 3 (value | Δ | Ø), chronological', async () => {
    const el = await renderTable();
    const yearHeaders = cells(el, 'th.year-col');
    expect(yearHeaders.map((h) => h.textContent?.trim())).toEqual(['2024', '2025']);
    expect(yearHeaders.map((h) => h.getAttribute('colspan'))).toEqual(['3', '3']);
  });

  it('the first header cell names the compared month', async () => {
    const el = await renderTable();
    const first = el.shadowRoot!.querySelector('th.label-column.header');
    expect(first?.textContent).toContain('June');
  });

  it('renders an average column header after the year columns', async () => {
    const el = await renderTable();
    const avgHeader = el.shadowRoot!.querySelector('th.avg-col');
    expect(avgHeader).toBeTruthy();
    expect(avgHeader!.textContent?.trim()).toBe('avg');
  });

  it('label column shows entity name and unit', async () => {
    const el = await renderTable();
    const label = el.shadowRoot!.querySelector('td.label-column');
    expect(label?.textContent).toContain('Rain');
    expect(label?.textContent).toContain('[mm]');
  });

  it('measurement rows render min/avg/max sub-rows honoring visibility', async () => {
    const segments = makeSegments([
      { year: 2024, summaries: [{ rowIndex: 0, entityId: 'sensor.temp', values: { min: 1, mean: 5, max: 9 } }] },
      { year: 2025, summaries: [{ rowIndex: 0, entityId: 'sensor.temp', values: { min: 2, mean: 6, max: 10 } }] },
    ]);
    const el = await renderTable({ segments, entityConfigs: [{ entity: 'sensor.temp' }] });
    expect(cells(el, 'td.sub-label').length).toBe(3);

    const el2 = await renderTable({ segments, entityConfigs: [{ entity: 'sensor.temp', show_min: false, show_max: false }] });
    expect(cells(el2, 'td.sub-label').length).toBe(1);
  });
});

describe('MonthComparisonTable — values, diffs, average (FR-004/FR-005/FR-006)', () => {
  it('value cells equal the injected monthly summaries (SC-002)', async () => {
    const el = await renderTable();
    const values = cells(el, 'td.data-cell');
    expect(values[0]!.textContent).toContain('10.0');
    expect(values[1]!.textContent).toContain('14.0');
  });

  it('diffs live in their own columns: Δ then Ø per year, signed', async () => {
    const el = await renderTable();
    const diffs = cells(el, 'td.diff-cell').map((c) => c.textContent?.replace('−', '-').trim());
    // order: 2024 Δ (none), 2024 Ø (−2), 2025 Δ (+4), 2025 Ø (+2)
    expect(diffs[0]).toBe('');
    expect(diffs[1]).toContain('-2.0');
    expect(diffs[2]).toContain('+4.0');
    expect(diffs[3]).toContain('+2.0');
  });

  it('the average column shows the cross-year average per (sub-)row', async () => {
    const el = await renderTable();
    const avg = cells(el, 'td.avg-cell');
    expect(avg.length).toBe(1);
    expect(avg[0]!.textContent).toContain('12.0');
  });

  it('diff cells carry localized captions as titles (FR-014)', async () => {
    const el = await renderTable();
    expect(el.shadowRoot!.querySelector('td.diff-cell[title="Difference to previous year"]')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('td.diff-cell[title="Deviation from multi-year average"]')).toBeTruthy();
  });

  it('german captions when lang=de', async () => {
    const el = await renderTable({ lang: 'de' });
    expect(el.shadowRoot!.querySelector('td.diff-cell[title="Differenz zum Vorjahr"]')).toBeTruthy();
  });

  it('a year without data renders empty value and diff cells (FR-008)', async () => {
    const segments = makeSegments([
      { year: 2024, summaries: [] },
      { year: 2025, summaries: [{ rowIndex: 0, entityId: 'sensor.rain', values: { total: 14 } }] },
    ]);
    const el = await renderTable({ segments });
    const values = cells(el, 'td.data-cell');
    expect(values[0]!.textContent?.trim()).toBe('');
    expect(values[1]!.textContent).toContain('14.0');
    const diffs = cells(el, 'td.diff-cell').map((c) => c.textContent?.trim());
    expect(diffs[0]).toBe('');
    expect(diffs[1]).toBe('');
    // avg = 14 → 2025 Ø-diff 0.0
    expect(cells(el, 'td.avg-cell')[0]!.textContent).toContain('14.0');
  });
});

describe('MonthComparisonTable — percentages (FR-006a)', () => {
  it('cumulative totals show percentages inside the diff cells', async () => {
    const el = await renderTable();
    const prevDiff = cells(el, 'td.diff-cell')[2]!;
    expect(prevDiff.textContent).toContain('40');
    expect(prevDiff.textContent).toContain('%');
  });

  it('measurement rows show no percentages', async () => {
    const segments = makeSegments([
      { year: 2024, summaries: [{ rowIndex: 0, entityId: 'sensor.temp', values: { mean: 10 } }] },
      { year: 2025, summaries: [{ rowIndex: 0, entityId: 'sensor.temp', values: { mean: 14 } }] },
    ]);
    const el = await renderTable({ segments, entityConfigs: [{ entity: 'sensor.temp', show_min: false, show_max: false }] });
    expect(el.shadowRoot!.textContent).not.toContain('%');
  });
});

describe('MonthComparisonTable — incomplete current month (FR-007)', () => {
  it('marks the incomplete current month and excludes it from the average column', async () => {
    const segments = makeSegments([
      { year: 2024, summaries: [{ rowIndex: 0, entityId: 'sensor.rain', values: { total: 10 } }] },
      { year: 2025, summaries: [{ rowIndex: 0, entityId: 'sensor.rain', values: { total: 3 } }] },
    ]);
    const el = await renderTable({ segments, now: { year: 2025, month: MONTH } });
    expect(el.shadowRoot!.querySelector('td.data-cell .incomplete-marker')).toBeTruthy();
    // avg = 10 (2025 excluded) → avg column 10.0; 2025 Ø-diff = −7
    expect(cells(el, 'td.avg-cell')[0]!.textContent).toContain('10.0');
    const diffs = cells(el, 'td.diff-cell').map((c) => c.textContent?.replace('−', '-').trim());
    expect(diffs[3]).toContain('-7.0');
  });
});

describe('MonthComparisonTable — thresholds (FR-011)', () => {
  it('colors value cells via threshold rules, never diff cells, and emits thresholds-applied', async () => {
    const listener = vi.fn();
    document.body.addEventListener('thresholds-applied', listener);
    const el = await renderTable({
      entityConfigs: [{
        entity: 'sensor.rain',
        thresholds: [{ operator: 'above', value: 12, name: 'wet', background_color: '#ff0000' }],
      }],
    });
    await el.updateComplete;
    const colored = cells(el, 'td.data-cell').filter((c) => (c.getAttribute('style') ?? '').includes('background-color'));
    expect(colored.length).toBe(1); // only the 14.0 cell (2025) exceeds 12
    const coloredDiffs = cells(el, 'td.diff-cell').filter((c) => (c.getAttribute('style') ?? '').includes('background-color'));
    expect(coloredDiffs.length).toBe(0);
    await vi.waitFor(() => {
      expect(listener).toHaveBeenCalled();
      const groups = (listener.mock.calls.at(-1)![0] as CustomEvent<{ groups: ThresholdLegendGroup[] }>).detail.groups;
      expect(groups.length).toBe(1);
      expect(groups[0]!.rules[0]!.name).toBe('wet');
    });
    document.body.removeEventListener('thresholds-applied', listener);
  });
});
