import { describe, it, expect, vi, afterEach } from 'vitest';
import { YearTable } from '../../src/components/year-table';
import '../../src/components/year-summary-table';
import '../../src/components/month-comparison-table';
import type { EntityMetadata } from '../../src/types/statistics';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const rainMeta: EntityMetadata = {
  entityId: 'sensor.rain',
  stateClass: 'measurement',
  deviceClass: 'precipitation',
  unitOfMeasurement: 'mm',
  friendlyName: 'Rain',
  hasStatistics: true,
};

/** Resolves after the browser would have run its animation-frame callbacks. */
function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function renderTable(): Promise<YearTable> {
  const el = new YearTable();
  el.year = 2025;
  el.visibleMonths = [6];
  el.entityConfigs = [{ entity: 'sensor.rain' }];
  el.entityMetadata = new Map([['sensor.rain', rainMeta]]);
  el.lang = 'en';
  document.body.appendChild(el);
  await el.updateComplete;
  await nextFrame();
  return el;
}

/** Counts the layout-forcing reads the table performs while `work` runs. */
async function countLayoutReads(work: () => Promise<void>): Promise<number> {
  let reads = 0;
  const rect = vi.spyOn(Element.prototype, 'getBoundingClientRect');
  rect.mockImplementation(function (this: Element) {
    reads++;
    return { width: 0, height: 0, top: 0, left: 0, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  });
  const owner = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollWidth')
    ? Element.prototype
    : HTMLElement.prototype;
  const original = Object.getOwnPropertyDescriptor(owner, 'scrollWidth')!;
  Object.defineProperty(owner, 'scrollWidth', {
    configurable: true,
    get() { reads++; return 0; },
  });
  try {
    await work();
  } finally {
    Object.defineProperty(owner, 'scrollWidth', original);
    rect.mockRestore();
  }
  return reads;
}

describe('YearTable — layout measurement', () => {
  it('does not force layout inside the update callback', async () => {
    const el = await renderTable();

    const reads = await countLayoutReads(async () => {
      el.visibleMonths = [7];
      await el.updateComplete;
    });

    expect(reads).toBe(0);
  });

  it('measures on the next animation frame instead', async () => {
    const el = await renderTable();

    const reads = await countLayoutReads(async () => {
      el.visibleMonths = [7];
      await el.updateComplete;
      await nextFrame();
    });

    expect(reads).toBeGreaterThan(0);
  });

  it('applies the measured widths to the host and the scrollbar spacer', async () => {
    const el = await renderTable();

    expect(el.style.getPropertyValue('--label-col-width')).toMatch(/px$/);
    const spacer = el.shadowRoot!.querySelector<HTMLElement>('.sticky-scrollbar-spacer')!;
    expect(spacer.style.width).toMatch(/px$/);
  });

  it('does not rewrite widths that have not changed', async () => {
    const el = await renderTable();
    const setProperty = vi.spyOn(CSSStyleDeclaration.prototype, 'setProperty');

    el.visibleMonths = [7];
    await el.updateComplete;
    await nextFrame();

    expect(setProperty).not.toHaveBeenCalled();
  });
});

const segment = () => ({
  year: 2025,
  visibleMonths: [6],
  monthlySummaries: new Map(),
  dailyValues: new Map(),
  entityMetadata: new Map([['sensor.rain', rainMeta]]),
});

describe('YearSummaryTable — layout measurement', () => {
  it('does not force layout inside the update callback', async () => {
    const el = document.createElement('calendar-stats-year-summary-table') as HTMLElement & {
      segments: unknown[]; entityConfigs: unknown[]; updateComplete: Promise<boolean>;
    };
    el.entityConfigs = [{ entity: 'sensor.rain' }];
    el.segments = [segment()];
    document.body.appendChild(el);
    await el.updateComplete;
    await nextFrame();

    const reads = await countLayoutReads(async () => {
      el.segments = [segment()];
      await el.updateComplete;
    });

    expect(reads).toBe(0);
  });
});

describe('MonthComparisonTable — layout measurement', () => {
  it('does not force layout inside the update callback', async () => {
    const el = document.createElement('calendar-stats-month-comparison-table') as HTMLElement & {
      month: number; segments: unknown[]; entityConfigs: unknown[]; updateComplete: Promise<boolean>;
    };
    el.month = 6;
    el.entityConfigs = [{ entity: 'sensor.rain' }];
    el.segments = [segment()];
    document.body.appendChild(el);
    await el.updateComplete;
    await nextFrame();

    const reads = await countLayoutReads(async () => {
      el.segments = [segment()];
      await el.updateComplete;
    });

    expect(reads).toBe(0);
  });
});
