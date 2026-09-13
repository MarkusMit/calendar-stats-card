import { describe, it, expect, vi, afterEach } from 'vitest';
import '../../src/components/year-table';
import type { YearTable } from '../../src/components/year-table';
import type { EntityConfig, ThresholdRule, ThresholdLegendGroup } from '../../src/types/card-config';
import type { MonthlySummary, EntityMetadata } from '../../src/types/statistics';
import { DailyValueIndex } from '../../src/services/daily-value-index';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const YEAR = 2024;
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const RAIN = 'sensor.rain';

const rainMeta = {
  entityId: RAIN, stateClass: 'total_increasing', deviceClass: 'precipitation',
  unitOfMeasurement: 'mm', friendlyName: 'Rain', hasStatistics: true,
} as EntityMetadata;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/**
 * Twelve months of rain. Day 1 of March is far larger than anything else, so
 * the first day column is wider than the rest — the widths a placeholder has
 * to preserve.
 */
function buildData() {
  const dailyValues = new DailyValueIndex();
  const monthlySummaries = new Map<string, MonthlySummary>();
  for (const m of MONTHS) {
    monthlySummaries.set(`0::${RAIN}::${YEAR}-${pad(m)}`,
      { entityId: RAIN, year: YEAR, month: m, min: 1, mean: 5, max: 9, total: 100 });
    for (let d = 1; d <= 28; d++) {
      dailyValues.set(RAIN, `${YEAR}-${pad(m)}-${pad(d)}`,
        { kind: 'cumulative', entityId: RAIN, date: `${YEAR}-${pad(m)}-${pad(d)}`, sum: d === 1 && m === 3 ? 1234.5 : 5 });
    }
  }
  return { dailyValues, monthlySummaries, entityMetadata: new Map([[RAIN, rainMeta]]) };
}

/** Places every month section at `top`, so the component sees a real layout. */
function stubSectionRects(top: (index: number) => number): void {
  const real = Element.prototype.getBoundingClientRect;
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const section = (this as HTMLElement).dataset?.section;
    if (section === undefined) return real.call(this);
    const y = top(Number(section));
    // Zero height: the component must not mistake the stub for a real measurement.
    return { top: y, bottom: y, left: 0, right: 0, width: 0, height: 0, x: 0, y, toJSON: () => ({}) } as DOMRect;
  });
}

async function renderTable(configs: EntityConfig[] = [{ entity: RAIN }]): Promise<YearTable> {
  const el = document.createElement('calendar-stats-year-table') as YearTable;
  Object.assign(el, { year: YEAR, visibleMonths: MONTHS, entityConfigs: configs, lang: 'en', ...buildData() });
  document.body.appendChild(el);
  await el.updateComplete;
  await nextFrame();
  await el.updateComplete;
  return el;
}

function section(el: YearTable, index: number): HTMLElement {
  return el.shadowRoot!.querySelector<HTMLElement>(`tbody[data-section="${index}"]`)!;
}

function placeholder(el: YearTable, index: number): HTMLElement | null {
  return section(el, index).querySelector<HTMLElement>('tr.section-placeholder');
}

describe('YearTable — lazily rendered month sections', () => {
  it('renders every section when the layout gives no position information', async () => {
    const el = await renderTable();
    // happy-dom reports zero rects, so nothing can be ruled out of view.
    for (const index of [0, 5, 11]) {
      expect(placeholder(el, index)).toBeNull();
      expect(section(el, index).querySelectorAll('tr').length).toBeGreaterThan(0);
    }
  });

  it('renders every section when the viewport height is unknown', async () => {
    // A hidden tab or an unsized embedding context reports no viewport. That
    // rules nothing out of view, so nothing may be released.
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(0);
    vi.spyOn(document.documentElement, 'clientHeight', 'get').mockReturnValue(0);
    stubSectionRects(() => 500_000);
    const el = await renderTable();

    for (const index of [0, 5, 11]) expect(placeholder(el, index)).toBeNull();
  });

  it('replaces the rows of far-off sections with one placeholder row', async () => {
    stubSectionRects((i) => (i === 0 ? 0 : 500_000));
    const el = await renderTable();

    expect(placeholder(el, 0)).toBeNull();
    expect(placeholder(el, 7)).not.toBeNull();
    expect(section(el, 7).querySelectorAll('tr').length).toBe(1);
  });

  it('gives the placeholder the widest text each column would render, so widths do not move', async () => {
    stubSectionRects((i) => (i === 0 ? 0 : 500_000));
    const el = await renderTable();

    const cells = [...placeholder(el, 7)!.querySelectorAll('td')];
    // label, then 31 day columns, then summary and total.
    expect(cells[1]!.textContent).toBe('1,234.5');
    expect(cells[2]!.textContent).toBe('5.0');
    expect(cells[0]!.textContent).toContain('Rain');
  });

  it('hides the placeholder without removing it from the layout', async () => {
    stubSectionRects((i) => (i === 0 ? 0 : 500_000));
    const el = await renderTable();

    const row = placeholder(el, 7)!;
    expect(row.getAttribute('aria-hidden')).toBe('true');
    expect(getComputedStyle(row).visibility).toBe('hidden');
  });

  it('reserves height in proportion to the rows the section stands in for', async () => {
    stubSectionRects((i) => (i === 0 ? 0 : 500_000));
    const one = await renderTable([{ entity: RAIN }]);
    const three = await renderTable([{ entity: RAIN }, { entity: RAIN }, { entity: RAIN }]);

    const height = (el: YearTable) => Number(/height:\s*(\d+(?:\.\d+)?)px/.exec(placeholder(el, 7)!.getAttribute('style') ?? '')?.[1]);
    expect(height(one)).toBeGreaterThan(0);
    expect(height(three)).toBeCloseTo(height(one) * 3, 5);
  });

  it('renders a section for real once scrolling brings it into range', async () => {
    let far = true;
    stubSectionRects((i) => (i === 0 || !far ? 0 : 500_000));
    const el = await renderTable();
    expect(placeholder(el, 7)).not.toBeNull();

    far = false;
    window.dispatchEvent(new Event('scroll'));
    await nextFrame();
    await el.updateComplete;

    expect(placeholder(el, 7)).toBeNull();
  });

  it('renders only the section that changed, not every mounted one', async () => {
    // Cost per mount must not grow with how much is already on screen.
    let near = 1;
    stubSectionRects((i) => (i <= near ? 0 : 500_000));
    const el = await renderTable();

    const proto = Object.getPrototypeOf(el) as { renderEntityRows: (...args: never[]) => unknown };
    const original = proto.renderEntityRows;
    let rowRenders = 0;
    proto.renderEntityRows = function (this: YearTable, ...args: never[]) {
      rowRenders++;
      return original.apply(this, args);
    };
    try {
      near = 2;
      window.dispatchEvent(new Event('scroll'));
      await nextFrame();
      await el.updateComplete;
    } finally {
      proto.renderEntityRows = original;
    }

    // One newly mounted section, one configured row.
    expect(rowRenders).toBe(1);
  });

  it('releases a section again once scrolling takes it far away', async () => {
    let far = false;
    stubSectionRects((i) => (i === 0 || !far ? 0 : 500_000));
    const el = await renderTable();
    expect(placeholder(el, 7)).toBeNull();

    far = true;
    window.dispatchEvent(new Event('scroll'));
    await nextFrame();
    await el.updateComplete;

    expect(placeholder(el, 7)).not.toBeNull();
  });

  it('keeps the thresholds of sections that were skipped when another mounts', async () => {
    // Mounting re-renders the table, but unchanged sections are skipped and
    // never re-report what they triggered. Their rules have to survive that.
    const wet: ThresholdRule = { operator: 'above', value: 10, name: 'Wet', background_color: 'blue' };
    let near = 2;
    stubSectionRects((i) => (i <= near ? 0 : 500_000));

    const el = document.createElement('calendar-stats-year-table') as YearTable;
    const reported: ThresholdLegendGroup[][] = [];
    el.addEventListener('thresholds-applied', (e) => reported.push((e as CustomEvent).detail.groups));
    Object.assign(el, {
      year: YEAR, visibleMonths: MONTHS, lang: 'en',
      entityConfigs: [{ entity: RAIN, thresholds: [wet] }], ...buildData(),
    });
    document.body.appendChild(el);
    await el.updateComplete;
    await nextFrame();
    await el.updateComplete;

    // March holds the only value above the threshold and is already mounted;
    // bringing later sections in must not drop its rule from the legend.
    near = 6;
    window.dispatchEvent(new Event('scroll'));
    await nextFrame();
    await el.updateComplete;

    expect(reported.length).toBeGreaterThan(0);
    expect(reported.at(-1)!.flatMap((g) => g.rules)).toContain(wet);
  });

  it('stops answering the viewport once removed from the document', async () => {
    stubSectionRects((i) => (i === 0 ? 0 : 500_000));
    const el = await renderTable();
    el.remove();
    const render = vi.spyOn(el, 'requestUpdate');

    window.dispatchEvent(new Event('scroll'));
    await nextFrame();

    expect(render).not.toHaveBeenCalled();
  });
});
