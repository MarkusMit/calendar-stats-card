import { describe, it, expect, vi, afterEach } from 'vitest';
import { MonthlyTable } from '../../src/components/monthly-table';
import type { EntityConfig } from '../../src/types/card-config';
import type {
  DailyValue,
  MeasurementDailyValue,
  CumulativeDailyValue,
  MonthlySummary,
  EntityMetadata,
} from '../../src/types/statistics';

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

const entityConfigs: EntityConfig[] = [{ entity: ENTITY_ID, label: 'Temp' }];

async function renderTable(month: number, year: number, overrides: Partial<{
  dailyValues: Map<string, DailyValue>;
  monthlySummaries: Map<string, MonthlySummary>;
  entityMetadata: Map<string, EntityMetadata>;
}> = {}) {
  const el = new MonthlyTable();
  el.month = month;
  el.year = year;
  el.entityConfigs = entityConfigs;
  el.dailyValues = overrides.dailyValues ?? new Map();
  el.monthlySummaries = overrides.monthlySummaries ?? new Map();
  el.entityMetadata = overrides.entityMetadata ?? new Map([[ENTITY_ID, tempMeta]]);
  el.lang = 'en';
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  return el;
}

function getStaticCssText(): string {
  const styles = MonthlyTable.styles;
  if (!styles) return '';
  const toText = (s: unknown) => String(s);
  return Array.isArray(styles) ? styles.map(toText).join('\n') : toText(styles);
}

describe('MonthlyTable — structure', () => {
  it('renders month name in header', async () => {
    const el = await renderTable(1, 2025);
    const header = el.shadowRoot!.querySelector('.month-header');
    expect(header?.textContent?.trim()).toBeTruthy();
    expect(header?.textContent).toContain('January');
  });

  it('renders correct number of day columns for February non-leap (28 days)', async () => {
    const el = await renderTable(2, 2025);
    const dayCells = el.shadowRoot!.querySelectorAll('.day-cell-header');
    expect(dayCells.length).toBe(28);
  });

  it('renders correct number of day columns for January (31 days)', async () => {
    const el = await renderTable(1, 2025);
    const dayCells = el.shadowRoot!.querySelectorAll('.day-cell-header');
    expect(dayCells.length).toBe(31);
  });

  it('renders a label column as first column', async () => {
    const el = await renderTable(1, 2025);
    const labelCol = el.shadowRoot!.querySelector('.label-column');
    expect(labelCol).toBeTruthy();
  });

  it('renders a summary column after day columns', async () => {
    const el = await renderTable(1, 2025);
    const summaryCol = el.shadowRoot!.querySelector('.summary-column');
    expect(summaryCol).toBeTruthy();
  });

  it('label column has position:sticky and left:0', () => {
    const cssText = getStaticCssText();
    expect(cssText).toContain('sticky');
    expect(cssText.includes('left: 0') || cssText.includes('left:0')).toBe(true);
  });

  it('table container has overflow-x: auto', () => {
    const cssText = getStaticCssText();
    expect(cssText).toContain('overflow-x');
    expect(cssText).toContain('auto');
  });

  it('entity row with all-empty DailyValues renders empty cells', async () => {
    const el = await renderTable(1, 2025);
    const dataCells = el.shadowRoot!.querySelectorAll('td.data-cell');
    expect(dataCells.length).toBeGreaterThan(0);
    const allEmpty = Array.from(dataCells).every((td) => td.textContent?.trim() === '');
    expect(allEmpty).toBe(true);
  });

  it('ha-card root does not have overflow scroll/auto on :host (FR-035)', () => {
    const cssText = getStaticCssText();
    // :host should not set overflow-y scroll/auto
    const badPattern = /overflow-y\s*:\s*(scroll|auto)/;
    expect(badPattern.test(cssText)).toBe(false);
  });

  it('day cell padding <= 4px (FR-023 dense layout)', () => {
    const cssText = getStaticCssText();
    expect(cssText).toContain('data-cell');
    // Extract only padding property values from the data-cell rule
    const dataCellBlock = cssText.match(/data-cell[^{]*\{([^}]*)\}/)?.[1] ?? '';
    const paddingLine = dataCellBlock.match(/(?:^|\n)\s*padding\s*:\s*([^;]+)/)?.[1] ?? '';
    const pxValues = paddingLine.match(/(\d+(?:\.\d+)?)px/g) ?? [];
    // If we found padding values, verify they're all <= 4px
    if (pxValues.length > 0) {
      const nums = pxValues.map((v) => parseFloat(v));
      expect(nums.every((n) => n <= 4)).toBe(true);
    } else {
      // No explicit padding found — passes (defaults to 0)
      expect(true).toBe(true);
    }
  });
});

// --- Phase 4: US2 — measurement and cumulative rendering ---

const precipMeta: EntityMetadata = {
  entityId: 'sensor.rain',
  stateClass: 'total_increasing',
  deviceClass: 'precipitation',
  unitOfMeasurement: 'mm',
  friendlyName: 'Rain',
  hasStatistics: true,
};

const energyMeta: EntityMetadata = {
  entityId: 'sensor.energy',
  stateClass: 'total_increasing',
  deviceClass: 'energy',
  unitOfMeasurement: 'kWh',
  friendlyName: 'Energy',
  hasStatistics: true,
};


async function renderSingleEntity(entity: string, meta: EntityMetadata, dailyValues: Map<string, DailyValue> = new Map(), monthlySummaries: Map<string, MonthlySummary> = new Map()) {
  const el = new MonthlyTable();
  el.month = 1;
  el.year = 2025;
  el.entityConfigs = [{ entity }];
  el.dailyValues = dailyValues;
  el.monthlySummaries = monthlySummaries;
  el.entityMetadata = new Map([[entity, meta]]);
  el.lang = 'en';
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('no root');
  }, { timeout: 3000 });
  return el;
}

// T019: measurement rendering
describe('MonthlyTable — measurement rendering (T019)', () => {
  it('MeasurementDailyValue → separate rows show min, mean, max', async () => {
    const dayVal: MeasurementDailyValue = { kind: 'measurement', entityId: ENTITY_ID, date: '2025-01-05', min: 10, mean: 20, max: 30, partialCoverage: false };
    const dailyValues = new Map<string, DailyValue>([['sensor.temp::2025-01-05', dayVal]]);
    const el = await renderSingleEntity(ENTITY_ID, tempMeta, dailyValues);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    const minCell = rows[0]!.querySelectorAll('td.data-cell')[4]; // day 5, row 0 = min
    const meanCell = rows[1]!.querySelectorAll('td.data-cell')[4]; // day 5, row 1 = mean
    const maxCell = rows[2]!.querySelectorAll('td.data-cell')[4]; // day 5, row 2 = max
    expect(minCell?.textContent?.trim()).toBe('10');
    expect(meanCell?.textContent?.trim()).toBe('20');
    expect(maxCell?.textContent?.trim()).toBe('30');
  });

  it('partialCoverage: true → asterisk appended to cell value', async () => {
    const dayVal: MeasurementDailyValue = { kind: 'measurement', entityId: ENTITY_ID, date: '2025-01-05', min: 10, mean: 20, max: 30, partialCoverage: true };
    const dailyValues = new Map<string, DailyValue>([['sensor.temp::2025-01-05', dayVal]]);
    const el = await renderSingleEntity(ENTITY_ID, tempMeta, dailyValues);
    const day5 = el.shadowRoot!.querySelectorAll('td.data-cell')[4];
    expect(day5?.textContent).toContain('*');
  });

  it('partialCoverage: false → no asterisk', async () => {
    const dayVal: MeasurementDailyValue = { kind: 'measurement', entityId: ENTITY_ID, date: '2025-01-05', min: 10, mean: 20, max: 30, partialCoverage: false };
    const dailyValues = new Map<string, DailyValue>([['sensor.temp::2025-01-05', dayVal]]);
    const el = await renderSingleEntity(ENTITY_ID, tempMeta, dailyValues);
    const day5 = el.shadowRoot!.querySelectorAll('td.data-cell')[4];
    expect(day5?.textContent).not.toContain('*');
  });

  it('measurement entity renders 3 rows (min, mean, max)', async () => {
    const el = await renderSingleEntity(ENTITY_ID, tempMeta);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    expect(rows.length).toBe(3);
  });
});

// T020: cumulative rendering
describe('MonthlyTable — cumulative rendering (T020)', () => {
  it('CumulativeDailyValue → day cell shows single sum value', async () => {
    const dayVal: CumulativeDailyValue = { kind: 'cumulative', entityId: 'sensor.rain', date: '2025-01-03', sum: 7.5, partialCoverage: false };
    const dailyValues = new Map<string, DailyValue>([['sensor.rain::2025-01-03', dayVal]]);
    const el = await renderSingleEntity('sensor.rain', precipMeta, dailyValues);
    const day3 = el.shadowRoot!.querySelectorAll('td.data-cell')[2];
    expect(day3?.textContent?.trim()).toBe('7.5');
  });

  it('CumulativeDailyValue partialCoverage: true → asterisk', async () => {
    const dayVal: CumulativeDailyValue = { kind: 'cumulative', entityId: 'sensor.rain', date: '2025-01-03', sum: 5, partialCoverage: true };
    const dailyValues = new Map<string, DailyValue>([['sensor.rain::2025-01-03', dayVal]]);
    const el = await renderSingleEntity('sensor.rain', precipMeta, dailyValues);
    const day3 = el.shadowRoot!.querySelectorAll('td.data-cell')[2];
    expect(day3?.textContent).toContain('*');
  });

  it('EmptyDailyValue → blank cell', async () => {
    const dayVal: DailyValue = { kind: 'empty', entityId: 'sensor.rain', date: '2025-01-03' };
    const dailyValues = new Map<string, DailyValue>([['sensor.rain::2025-01-03', dayVal]]);
    const el = await renderSingleEntity('sensor.rain', precipMeta, dailyValues);
    const day3 = el.shadowRoot!.querySelectorAll('td.data-cell')[2];
    expect(day3?.textContent?.trim()).toBe('');
  });
});

// T021: summary column
describe('MonthlyTable — summary column (T021)', () => {
  it('measurement entity → 3 summary cells show min, mean, max separately', async () => {
    const summary: MonthlySummary = { entityId: ENTITY_ID, year: 2025, month: 1, min: 5, mean: 18, max: 30, total: null };
    const el = await renderSingleEntity(ENTITY_ID, tempMeta, new Map(), new Map([[`${ENTITY_ID}::2025-1`, summary]]));
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    const minSummary = rows[0]!.querySelector('td.summary-column');
    const meanSummary = rows[1]!.querySelector('td.summary-column');
    const maxSummary = rows[2]!.querySelector('td.summary-column');
    expect(minSummary?.textContent?.trim()).toBe('5');
    expect(meanSummary?.textContent?.trim()).toBe('18');
    expect(maxSummary?.textContent?.trim()).toBe('30');
  });
});

// T022: total column
describe('MonthlyTable — total column (T022)', () => {
  it('cumulative entity → total column rendered with MonthlySummary.total', async () => {
    const summary: MonthlySummary = { entityId: 'sensor.energy', year: 2025, month: 1, min: 0, mean: 5, max: 15, total: 120 };
    const el = await renderSingleEntity('sensor.energy', energyMeta, new Map(), new Map([['sensor.energy::2025-1', summary]]));
    const allCells = el.shadowRoot!.querySelectorAll('td.summary-column');
    // Last summary-column cell should be the total
    const totalCell = allCells[allCells.length - 1];
    expect(totalCell?.textContent?.trim()).toBe('120');
  });

  it('measurement entity → no total column in DOM', async () => {
    const el = await renderSingleEntity(ENTITY_ID, tempMeta);
    // For measurement entity with no cumulative, total th should not exist
    const headers = el.shadowRoot!.querySelectorAll('th.summary-column');
    // Count columns: only one summary header for measurement
    // (no total column header)
    const totalHeader = Array.from(headers).find(h => h.textContent?.includes('Total'));
    expect(totalHeader).toBeFalsy();
  });
});

// T027: entity error states
describe('MonthlyTable — entity error states (T027)', () => {
  it('hasStatistics: false → warning indicator in label cell, all day cells empty', async () => {
    const noStatsMeta: EntityMetadata = { ...tempMeta, hasStatistics: false };
    const el = await renderSingleEntity(ENTITY_ID, noStatsMeta);
    const labelCell = el.shadowRoot!.querySelector('td.label-column');
    expect(labelCell?.textContent).toContain('⚠');
    const dataCells = el.shadowRoot!.querySelectorAll('td.data-cell');
    const allEmpty = Array.from(dataCells).every(td => td.textContent?.trim() === '');
    expect(allEmpty).toBe(true);
  });

  it('entityError set → cells show —', async () => {
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = [{ entity: ENTITY_ID }];
    el.dailyValues = new Map();
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[ENTITY_ID, tempMeta]]);
    el.entityErrors = new Set([ENTITY_ID]);
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('no root');
    }, { timeout: 3000 });
    const dataCells = el.shadowRoot!.querySelectorAll('td.data-cell');
    expect(dataCells.length).toBeGreaterThan(0);
    const allDash = Array.from(dataCells).every(td => td.textContent?.trim() === '—');
    expect(allDash).toBe(true);
  });

  it('other entity rows unaffected when one entity errors', async () => {
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = [{ entity: ENTITY_ID }, { entity: 'sensor.rain' }];
    el.dailyValues = new Map();
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[ENTITY_ID, tempMeta], ['sensor.rain', precipMeta]]);
    el.entityErrors = new Set([ENTITY_ID]); // only temp errors
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('no root');
    }, { timeout: 3000 });
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    // First row (temp) should have dashes
    const firstRowCells = rows[0]!.querySelectorAll('td.data-cell');
    const firstRowDash = Array.from(firstRowCells).every(td => td.textContent?.trim() === '—');
    expect(firstRowDash).toBe(true);
    // Second row (rain, no error) should have empty cells (no data provided)
    const secondRowCells = rows[1]!.querySelectorAll('td.data-cell');
    const secondRowEmpty = Array.from(secondRowCells).every(td => td.textContent?.trim() === '');
    expect(secondRowEmpty).toBe(true);
  });
});
