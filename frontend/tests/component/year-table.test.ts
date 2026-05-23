import { describe, it, expect, vi, afterEach } from 'vitest';
import { YearTable } from '../../src/components/year-table';
import type { EntityConfig } from '../../src/types/card-config';
import type { CumulativeDailyValue, MeasurementDailyValue, EntityMetadata } from '../../src/types/statistics';

afterEach(() => {
  document.body.innerHTML = '';
});

const ENTITY_ID = 'sensor.temp';

const tempMeta: EntityMetadata = {
  entityId: ENTITY_ID,
  stateClass: 'measurement',
  deviceClass: 'temperature',
  unitOfMeasurement: '°C',
  friendlyName: 'Temperature',
  hasStatistics: true,
};

const precipMeta: EntityMetadata = {
  entityId: 'sensor.rain',
  stateClass: 'total_increasing',
  deviceClass: 'precipitation',
  unitOfMeasurement: 'mm',
  friendlyName: 'Rain',
  hasStatistics: true,
};

async function renderYearTable(overrides: Partial<{
  entityConfigs: EntityConfig[];
  entityMetadata: Map<string, EntityMetadata>;
  lang: string;
}> = {}) {
  const el = new YearTable();
  el.year = 2025;
  el.visibleMonths = [1];
  el.entityConfigs = overrides.entityConfigs ?? [{ entity: ENTITY_ID }];
  el.dailyValues = new Map();
  el.monthlySummaries = new Map();
  el.entityMetadata = overrides.entityMetadata ?? new Map([[ENTITY_ID, tempMeta]]);
  el.entityErrors = new Set();
  el.lang = overrides.lang ?? 'en';
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  return el;
}

describe('YearTable — measurement sub-label column', () => {
  it('measurement entity → 3 td.sub-label cells with min/avg/max text (EN)', async () => {
    const el = await renderYearTable();
    const subLabels = el.shadowRoot!.querySelectorAll('td.sub-label');
    expect(subLabels.length).toBe(3);
    expect(subLabels[0]?.textContent?.trim()).toBe('min');
    expect(subLabels[1]?.textContent?.trim()).toBe('avg');
    expect(subLabels[2]?.textContent?.trim()).toBe('max');
  });

  it('measurement entity lang=de → avg row shows Ø', async () => {
    const el = await renderYearTable({ lang: 'de' });
    const subLabels = el.shadowRoot!.querySelectorAll('td.sub-label');
    expect(subLabels[1]?.textContent?.trim()).toBe('Ø');
  });

  it('cumulative-only entity → no td.sub-label cells', async () => {
    const el = await renderYearTable({
      entityConfigs: [{ entity: 'sensor.rain' }],
      entityMetadata: new Map([['sensor.rain', precipMeta]]),
    });
    const subLabels = el.shadowRoot!.querySelectorAll('td.sub-label');
    expect(subLabels.length).toBe(0);
  });

  it('mixed measurement + cumulative → 3 sub-label cells, cumulative label uses colspan=2', async () => {
    const el = await renderYearTable({
      entityConfigs: [{ entity: ENTITY_ID }, { entity: 'sensor.rain' }],
      entityMetadata: new Map([[ENTITY_ID, tempMeta], ['sensor.rain', precipMeta]]),
    });
    const subLabels = el.shadowRoot!.querySelectorAll('td.sub-label');
    expect(subLabels.length).toBe(3);
    expect(subLabels[0]?.textContent?.trim()).toBe('min');
    expect(subLabels[1]?.textContent?.trim()).toBe('avg');
    expect(subLabels[2]?.textContent?.trim()).toBe('max');
    const labelCells = el.shadowRoot!.querySelectorAll('td.label-column');
    const cumulativeLabel = Array.from(labelCells).find((td) => !td.hasAttribute('rowspan'));
    expect(cumulativeLabel?.getAttribute('colspan')).toBe('2');
  });

  it('measurement entity → month-name header uses colspan=2', async () => {
    const el = await renderYearTable();
    const monthName = el.shadowRoot!.querySelector('th.month-name');
    expect(monthName?.getAttribute('colspan')).toBe('2');
  });

  it('cumulative-only entity → month-name header uses colspan=1', async () => {
    const el = await renderYearTable({
      entityConfigs: [{ entity: 'sensor.rain' }],
      entityMetadata: new Map([['sensor.rain', precipMeta]]),
    });
    const monthName = el.shadowRoot!.querySelector('th.month-name');
    expect(monthName?.getAttribute('colspan')).toBe('1');
  });
});

describe('YearTable — show_zero (cumulative)', () => {
  const RAIN_ID = 'sensor.rain';

  async function renderYearCumulative(showZero: boolean | undefined, sum: number) {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1];
    el.entityConfigs = showZero === undefined
      ? [{ entity: RAIN_ID }]
      : [{ entity: RAIN_ID, show_zero: showZero }];
    const dayVal: CumulativeDailyValue = {
      kind: 'cumulative',
      entityId: RAIN_ID,
      date: '2025-01-01',
      sum,
      partialCoverage: false,
    };
    el.dailyValues = new Map([[`${RAIN_ID}::2025-01-01`, dayVal]]);
    el.monthlySummaries = new Map();
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

  it('show_zero omitted + sum=0 → cell renders "0"', async () => {
    const el = await renderYearCumulative(undefined, 0);
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('0');
    expect(day1?.classList.contains('has-data')).toBe(true);
  });

  it('show_zero: false + sum=0 → blank cell, no has-data class', async () => {
    const el = await renderYearCumulative(false, 0);
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('');
    expect(day1?.classList.contains('has-data')).toBe(false);
  });

  it('show_zero: false + sum≠0 → cell renders normally', async () => {
    const el = await renderYearCumulative(false, 3.2);
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('3.2');
    expect(day1?.classList.contains('has-data')).toBe(true);
  });
});

describe('YearTable — show_zero (measurement)', () => {
  async function renderYearMeasurement(showZero: boolean | undefined, min: number, mean: number, max: number) {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1];
    el.entityConfigs = showZero === undefined
      ? [{ entity: ENTITY_ID }]
      : [{ entity: ENTITY_ID, show_zero: showZero }];
    const dayVal: MeasurementDailyValue = {
      kind: 'measurement',
      entityId: ENTITY_ID,
      date: '2025-01-05',
      min,
      mean,
      max,
      partialCoverage: false,
    };
    el.dailyValues = new Map([[`${ENTITY_ID}::2025-01-05`, dayVal]]);
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[ENTITY_ID, tempMeta]]);
    el.entityErrors = new Set();
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('no root');
    }, { timeout: 3000 });
    return el;
  }

  it('show_zero omitted + all-zero day → cells render "0"', async () => {
    const el = await renderYearMeasurement(undefined, 0, 0, 0);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    const minCell = rows[0]!.querySelectorAll('td.data-cell')[4];
    expect(minCell?.textContent?.trim()).toBe('0');
    expect(minCell?.classList.contains('has-data')).toBe(true);
  });

  it('show_zero: false + all-zero day → all three sub-row cells blank', async () => {
    const el = await renderYearMeasurement(false, 0, 0, 0);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    const minCell = rows[0]!.querySelectorAll('td.data-cell')[4];
    const meanCell = rows[1]!.querySelectorAll('td.data-cell')[4];
    const maxCell = rows[2]!.querySelectorAll('td.data-cell')[4];
    expect(minCell?.textContent?.trim()).toBe('');
    expect(minCell?.classList.contains('has-data')).toBe(false);
    expect(meanCell?.textContent?.trim()).toBe('');
    expect(meanCell?.classList.contains('has-data')).toBe(false);
    expect(maxCell?.textContent?.trim()).toBe('');
    expect(maxCell?.classList.contains('has-data')).toBe(false);
  });

  it('show_zero: false + only min=0 → only min cell blank', async () => {
    const el = await renderYearMeasurement(false, 0, 5, 10);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    const minCell = rows[0]!.querySelectorAll('td.data-cell')[4];
    const meanCell = rows[1]!.querySelectorAll('td.data-cell')[4];
    const maxCell = rows[2]!.querySelectorAll('td.data-cell')[4];
    expect(minCell?.textContent?.trim()).toBe('');
    expect(minCell?.classList.contains('has-data')).toBe(false);
    expect(meanCell?.textContent?.trim()).toBe('5');
    expect(meanCell?.classList.contains('has-data')).toBe(true);
    expect(maxCell?.textContent?.trim()).toBe('10');
    expect(maxCell?.classList.contains('has-data')).toBe(true);
  });

  it('show_zero: false + nonzero values → renders normally', async () => {
    const el = await renderYearMeasurement(false, 2, 5, 8);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    const minCell = rows[0]!.querySelectorAll('td.data-cell')[4];
    expect(minCell?.textContent?.trim()).toBe('2');
    expect(minCell?.classList.contains('has-data')).toBe(true);
  });
});
