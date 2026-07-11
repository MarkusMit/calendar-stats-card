import { describe, it, expect, vi, afterEach } from 'vitest';
import { YearSummaryTable } from '../../src/components/year-summary-table';
import type { EntityConfig } from '../../src/types/card-config';
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

function summariesFor(entityId: string, months: number[]): Map<string, MonthlySummary> {
  const map = new Map<string, MonthlySummary>();
  for (const month of months) {
    map.set(rowSummaryKey(0, entityId, YEAR, month), {
      entityId, year: YEAR, month,
      min: null, mean: null, max: null, total: 5,
    });
  }
  return map;
}

async function renderTable(dataMonths: number[], overrides: Partial<{
  entityConfigs: EntityConfig[];
  lang: string;
}> = {}): Promise<YearSummaryTable> {
  const el = new YearSummaryTable();
  el.segments = [{
    year: YEAR,
    visibleMonths: Array.from({ length: 12 }, (_, i) => i + 1),
    monthlySummaries: summariesFor('sensor.rain', dataMonths),
    dailyValues: new Map(),
    entityMetadata: new Map([['sensor.rain', rainMeta]]),
  }];
  el.entityConfigs = overrides.entityConfigs ?? [{ entity: 'sensor.rain' }];
  el.entityErrors = new Set();
  el.lang = overrides.lang ?? 'en';
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  return el;
}

describe('YearSummaryTable — clickable month headers (spec 014 FR-001/FR-016)', () => {
  it('a month with data renders its header as a button', async () => {
    const el = await renderTable([3]);
    const headers = el.shadowRoot!.querySelectorAll('th.month-col');
    const march = headers[2]!;
    const button = march.querySelector('button');
    expect(button).toBeTruthy();
    expect(button!.textContent).toContain('Mar');
  });

  it('clicking a data-bearing month header emits calendar-stats-month-select with the month', async () => {
    const el = await renderTable([3]);
    const listener = vi.fn();
    el.addEventListener('calendar-stats-month-select', listener);
    const button = el.shadowRoot!.querySelectorAll('th.month-col')[2]!.querySelector('button')!;
    button.click();
    expect(listener).toHaveBeenCalledTimes(1);
    expect((listener.mock.calls[0]![0] as CustomEvent).detail).toEqual({ month: 3 });
  });

  it('a month with no data in any segment stays a plain header — no button (FR-016)', async () => {
    const el = await renderTable([3]);
    const may = el.shadowRoot!.querySelectorAll('th.month-col')[4]!;
    expect(may.querySelector('button')).toBeNull();
    expect(may.textContent).toContain('May');
  });

  it('the header button carries a localized aria-label naming the month', async () => {
    const el = await renderTable([3]);
    const button = el.shadowRoot!.querySelectorAll('th.month-col')[2]!.querySelector('button')!;
    const label = button.getAttribute('aria-label') ?? '';
    expect(label).toContain('Mar');
    expect(label.length).toBeGreaterThan(3);
  });

  it('a month with data in a second segment is clickable even when the first segment lacks it', async () => {
    const el = await renderTable([3]);
    el.segments = [
      el.segments[0]!,
      {
        year: YEAR + 1,
        visibleMonths: Array.from({ length: 12 }, (_, i) => i + 1),
        monthlySummaries: new Map([[rowSummaryKey(0, 'sensor.rain', YEAR + 1, 7), {
          entityId: 'sensor.rain', year: YEAR + 1, month: 7,
          min: null, mean: null, max: null, total: 2,
        }]]),
        dailyValues: new Map(),
        entityMetadata: new Map([['sensor.rain', rainMeta]]),
      },
    ];
    await el.updateComplete;
    // July has data only in the second segment; its header must be a button in BOTH segments.
    const allHeaders = [...el.shadowRoot!.querySelectorAll('th.month-col')];
    expect(allHeaders.length).toBe(24);
    expect(allHeaders[6]!.querySelector('button')).toBeTruthy();
    expect(allHeaders[18]!.querySelector('button')).toBeTruthy();
  });
});
