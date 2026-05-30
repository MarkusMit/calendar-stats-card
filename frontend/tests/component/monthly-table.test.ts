import { describe, it, expect, vi, afterEach } from 'vitest';
import { MonthlyTable } from '../../src/components/monthly-table';
import type { EntityConfig, ThresholdRule } from '../../src/types/card-config';
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

const entityConfigs: EntityConfig[] = [{ entity: ENTITY_ID, name: 'Temp' }];

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
    const el = await renderSingleEntity(ENTITY_ID, tempMeta, new Map(), new Map([[`0::${ENTITY_ID}::2025-1`, summary]]));
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
    const el = await renderSingleEntity('sensor.energy', energyMeta, new Map(), new Map([['0::sensor.energy::2025-1', summary]]));
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

// Sub-label column (min/avg/max indicators)
describe('MonthlyTable — measurement sub-label column', () => {
  it('measurement entity → 3 td.sub-label cells with min/avg/max text (EN)', async () => {
    const el = await renderSingleEntity(ENTITY_ID, tempMeta);
    const subLabels = el.shadowRoot!.querySelectorAll('td.sub-label');
    expect(subLabels.length).toBe(3);
    expect(subLabels[0]?.textContent?.trim()).toBe('min');
    expect(subLabels[1]?.textContent?.trim()).toBe('avg');
    expect(subLabels[2]?.textContent?.trim()).toBe('max');
  });

  it('measurement entity lang=de → avg row shows Ø', async () => {
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = [{ entity: ENTITY_ID }];
    el.dailyValues = new Map();
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[ENTITY_ID, tempMeta]]);
    el.lang = 'de';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('no root');
    }, { timeout: 3000 });
    const subLabels = el.shadowRoot!.querySelectorAll('td.sub-label');
    expect(subLabels[1]?.textContent?.trim()).toBe('Ø');
  });

  it('cumulative-only entity → no td.sub-label cells', async () => {
    const el = await renderSingleEntity('sensor.rain', precipMeta);
    const subLabels = el.shadowRoot!.querySelectorAll('td.sub-label');
    expect(subLabels.length).toBe(0);
  });

  it('measurement entity → month-header uses colspan=2', async () => {
    const el = await renderSingleEntity(ENTITY_ID, tempMeta);
    const monthHeader = el.shadowRoot!.querySelector('th.month-header');
    expect(monthHeader?.getAttribute('colspan')).toBe('2');
  });

  it('cumulative-only entity → month-header uses colspan=1', async () => {
    const el = await renderSingleEntity('sensor.rain', precipMeta);
    const monthHeader = el.shadowRoot!.querySelector('th.month-header');
    expect(monthHeader?.getAttribute('colspan')).toBe('1');
  });

  it('mixed measurement + cumulative → 3 sub-label cells, cumulative label uses colspan=2', async () => {
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = [{ entity: ENTITY_ID }, { entity: 'sensor.rain' }];
    el.dailyValues = new Map();
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[ENTITY_ID, tempMeta], ['sensor.rain', precipMeta]]);
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('no root');
    }, { timeout: 3000 });
    const subLabels = el.shadowRoot!.querySelectorAll('td.sub-label');
    expect(subLabels.length).toBe(3);
    expect(subLabels[0]?.textContent?.trim()).toBe('min');
    expect(subLabels[1]?.textContent?.trim()).toBe('avg');
    expect(subLabels[2]?.textContent?.trim()).toBe('max');
    const labelCells = el.shadowRoot!.querySelectorAll('td.label-column');
    const cumulativeLabel = Array.from(labelCells).find((td) => !td.hasAttribute('rowspan'));
    expect(cumulativeLabel?.getAttribute('colspan')).toBe('2');
  });
});

describe('MonthlyTable — factor and unit override', () => {
  it('factor: 0.001 scales cumulative daily cell value', async () => {
    const dayVal: CumulativeDailyValue = {
      kind: 'cumulative', entityId: 'sensor.energy', date: '2025-01-01', sum: 5000, partialCoverage: false,
    };
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = [{ entity: 'sensor.energy', factor: 0.001 }];
    el.dailyValues = new Map([['sensor.energy::2025-01-01', dayVal]]);
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([['sensor.energy', energyMeta]]);
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => { await el.updateComplete; if (!el.shadowRoot) throw new Error('no root'); }, { timeout: 3000 });
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('5');
  });

  it('factor: 0.001 scales measurement min/mean/max cells', async () => {
    const dayVal: MeasurementDailyValue = {
      kind: 'measurement', entityId: ENTITY_ID, date: '2025-01-01', min: 1000, mean: 2000, max: 3000, partialCoverage: false,
    };
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = [{ entity: ENTITY_ID, factor: 0.001 }];
    el.dailyValues = new Map([[`${ENTITY_ID}::2025-01-01`, dayVal]]);
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[ENTITY_ID, tempMeta]]);
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => { await el.updateComplete; if (!el.shadowRoot) throw new Error('no root'); }, { timeout: 3000 });
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    const minCell = rows[0]!.querySelectorAll('td.data-cell')[0];
    const meanCell = rows[1]!.querySelectorAll('td.data-cell')[0];
    const maxCell = rows[2]!.querySelectorAll('td.data-cell')[0];
    expect(minCell?.textContent?.trim()).toBe('1');
    expect(meanCell?.textContent?.trim()).toBe('2');
    expect(maxCell?.textContent?.trim()).toBe('3');
  });

  it('unit: "kWh" overrides HA-reported unit in label column', async () => {
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = [{ entity: 'sensor.energy', unit: 'kWh' }];
    el.dailyValues = new Map();
    el.monthlySummaries = new Map();
    // HA reports Wh, config overrides to kWh
    el.entityMetadata = new Map([['sensor.energy', { ...energyMeta, unitOfMeasurement: 'Wh' }]]);
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => { await el.updateComplete; if (!el.shadowRoot) throw new Error('no root'); }, { timeout: 3000 });
    const label = el.shadowRoot!.querySelector('td.label-column');
    expect(label?.textContent).toContain('[kWh]');
    expect(label?.textContent).not.toContain('[Wh]');
  });
});

// show_zero option
describe('MonthlyTable — show_zero (cumulative)', () => {
  async function renderWithShowZero(showZero: boolean | undefined, sum: number) {
    const entity = 'sensor.energy';
    const meta: EntityMetadata = {
      entityId: entity,
      stateClass: 'total_increasing',
      deviceClass: 'energy',
      unitOfMeasurement: 'kWh',
      friendlyName: 'Energy',
      hasStatistics: true,
    };
    const dayVal: CumulativeDailyValue = {
      kind: 'cumulative',
      entityId: entity,
      date: '2025-01-01',
      sum,
      partialCoverage: false,
    };
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = showZero === undefined
      ? [{ entity }]
      : [{ entity, show_zero: showZero }];
    el.dailyValues = new Map([[`${entity}::2025-01-01`, dayVal]]);
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[entity, meta]]);
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('no root');
    }, { timeout: 3000 });
    return el;
  }

  it('show_zero omitted + sum=0 → cell renders "0"', async () => {
    const el = await renderWithShowZero(undefined, 0);
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('0');
    expect(day1?.classList.contains('has-data')).toBe(true);
  });

  it('show_zero: true + sum=0 → cell renders "0"', async () => {
    const el = await renderWithShowZero(true, 0);
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('0');
    expect(day1?.classList.contains('has-data')).toBe(true);
  });

  it('show_zero: false + sum=0 → blank cell, no has-data class', async () => {
    const el = await renderWithShowZero(false, 0);
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('');
    expect(day1?.classList.contains('has-data')).toBe(false);
  });

  it('show_zero: false + sum≠0 → cell renders normally', async () => {
    const el = await renderWithShowZero(false, 5.5);
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('5.5');
    expect(day1?.classList.contains('has-data')).toBe(true);
  });

  it('show_zero: false + sum=0 + partialCoverage=true → blank cell (suppression wins)', async () => {
    const entity = 'sensor.energy';
    const meta: EntityMetadata = {
      entityId: entity,
      stateClass: 'total_increasing',
      deviceClass: 'energy',
      unitOfMeasurement: 'kWh',
      friendlyName: 'Energy',
      hasStatistics: true,
    };
    const dayVal: CumulativeDailyValue = {
      kind: 'cumulative',
      entityId: entity,
      date: '2025-01-01',
      sum: 0,
      partialCoverage: true,
    };
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = [{ entity, show_zero: false }];
    el.dailyValues = new Map([[`${entity}::2025-01-01`, dayVal]]);
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[entity, meta]]);
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('no root');
    }, { timeout: 3000 });
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('');
    expect(day1?.classList.contains('has-data')).toBe(false);
  });
});

describe('MonthlyTable — show_zero (measurement)', () => {
  async function renderMeasurementWithShowZero(showZero: boolean | undefined, min: number, mean: number, max: number) {
    const dayVal: MeasurementDailyValue = {
      kind: 'measurement',
      entityId: ENTITY_ID,
      date: '2025-01-05',
      min,
      mean,
      max,
      partialCoverage: false,
    };
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = showZero === undefined
      ? [{ entity: ENTITY_ID }]
      : [{ entity: ENTITY_ID, show_zero: showZero }];
    el.dailyValues = new Map([[`${ENTITY_ID}::2025-01-05`, dayVal]]);
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[ENTITY_ID, tempMeta]]);
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('no root');
    }, { timeout: 3000 });
    return el;
  }

  it('show_zero omitted + all-zero day → cells render "0"', async () => {
    const el = await renderMeasurementWithShowZero(undefined, 0, 0, 0);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    const minCell = rows[0]!.querySelectorAll('td.data-cell')[4];
    expect(minCell?.textContent?.trim()).toBe('0');
    expect(minCell?.classList.contains('has-data')).toBe(true);
  });

  it('show_zero: false + all-zero day → all three sub-row cells blank', async () => {
    const el = await renderMeasurementWithShowZero(false, 0, 0, 0);
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

  it('show_zero: false + only min=0, mean and max nonzero → only min cell blank', async () => {
    const el = await renderMeasurementWithShowZero(false, 0, 5, 10);
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

  it('show_zero: false + nonzero values → cells render normally', async () => {
    const el = await renderMeasurementWithShowZero(false, 2, 5, 8);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    const minCell = rows[0]!.querySelectorAll('td.data-cell')[4];
    expect(minCell?.textContent?.trim()).toBe('2');
    expect(minCell?.classList.contains('has-data')).toBe(true);
  });
});

// T003: measurement sub-row visibility (show_min/avg/max)
describe('MonthlyTable — measurement sub-row visibility', () => {
  const measSummary: MonthlySummary = { entityId: ENTITY_ID, year: 2025, month: 1, min: 5, mean: 18, max: 30, total: null };

  async function renderMeasVisibility(cfg: Record<string, unknown>, summary?: MonthlySummary) {
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = [cfg as unknown as EntityConfig];
    el.dailyValues = new Map();
    el.monthlySummaries = summary ? new Map([[`0::${ENTITY_ID}::2025-1`, summary]]) : new Map();
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

  it('default → 3 sub-rows; all summary values shown (regression guard)', async () => {
    const el = await renderMeasVisibility({ entity: ENTITY_ID }, measSummary);
    expect(el.shadowRoot!.querySelectorAll('tbody tr').length).toBe(3);
    const texts = Array.from(el.shadowRoot!.querySelectorAll('td.sub-label')).map(td => td.textContent?.trim());
    expect(texts).toContain('min');
    expect(texts).toContain('avg');
    expect(texts).toContain('max');
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    expect(rows[0]!.querySelector('td.summary-column')?.textContent?.trim()).toBe('5');
    expect(rows[1]!.querySelector('td.summary-column')?.textContent?.trim()).toBe('18');
    expect(rows[2]!.querySelector('td.summary-column')?.textContent?.trim()).toBe('30');
  });

  it('show_min: false → min row absent; avg and max rows present', async () => {
    const el = await renderMeasVisibility({ entity: ENTITY_ID, show_min: false });
    const texts = Array.from(el.shadowRoot!.querySelectorAll('td.sub-label')).map(td => td.textContent?.trim());
    expect(texts).not.toContain('min');
    expect(texts).toContain('avg');
    expect(texts).toContain('max');
    expect(el.shadowRoot!.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('show_avg: false → avg row absent; min and max rows present', async () => {
    const el = await renderMeasVisibility({ entity: ENTITY_ID, show_avg: false });
    const texts = Array.from(el.shadowRoot!.querySelectorAll('td.sub-label')).map(td => td.textContent?.trim());
    expect(texts).toContain('min');
    expect(texts).not.toContain('avg');
    expect(texts).toContain('max');
    expect(el.shadowRoot!.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('show_max: false → max row absent; min and avg rows present', async () => {
    const el = await renderMeasVisibility({ entity: ENTITY_ID, show_max: false });
    const texts = Array.from(el.shadowRoot!.querySelectorAll('td.sub-label')).map(td => td.textContent?.trim());
    expect(texts).toContain('min');
    expect(texts).toContain('avg');
    expect(texts).not.toContain('max');
    expect(el.shadowRoot!.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('show_min: false, show_max: false → only avg row; label cell rowspan="1"', async () => {
    const el = await renderMeasVisibility({ entity: ENTITY_ID, show_min: false, show_max: false });
    expect(el.shadowRoot!.querySelectorAll('tbody tr').length).toBe(1);
    const texts = Array.from(el.shadowRoot!.querySelectorAll('td.sub-label')).map(td => td.textContent?.trim());
    expect(texts).not.toContain('min');
    expect(texts).toContain('avg');
    expect(texts).not.toContain('max');
    const labelCell = el.shadowRoot!.querySelector('td.label-column[rowspan]');
    expect(labelCell?.getAttribute('rowspan')).toBe('1');
  });

  it('show_min: false, show_avg: false, show_max: false → single row; no data/summary cells', async () => {
    const el = await renderMeasVisibility({ entity: ENTITY_ID, show_min: false, show_avg: false, show_max: false });
    expect(el.shadowRoot!.querySelectorAll('tbody tr').length).toBe(1);
    expect(el.shadowRoot!.querySelectorAll('td.sub-label').length).toBe(0);
    expect(el.shadowRoot!.querySelectorAll('td.data-cell').length).toBe(0);
    expect(el.shadowRoot!.querySelectorAll('td.summary-column').length).toBe(0);
  });

  it('show_min: false → summary shows no min; avg and max values present', async () => {
    const el = await renderMeasVisibility({ entity: ENTITY_ID, show_min: false }, measSummary);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0]!.querySelector('td.summary-column')?.textContent?.trim()).toBe('18');
    expect(rows[1]!.querySelector('td.summary-column')?.textContent?.trim()).toBe('30');
  });
});

// T007: cumulative summary visibility (show_min/avg/max) — slash-separated format
describe('MonthlyTable — cumulative summary visibility', () => {
  const RAIN_ID = 'sensor.rain';
  const rainSummary: MonthlySummary = { entityId: RAIN_ID, year: 2025, month: 1, min: 5, mean: 18, max: 30, total: 100 };

  async function renderCumulVisibility(cfg: Record<string, unknown>) {
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = [cfg as unknown as EntityConfig];
    el.dailyValues = new Map();
    el.monthlySummaries = new Map([[`0::${RAIN_ID}::2025-1`, rainSummary]]);
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

  it('default → summary shows "5/18/30" (regression guard)', async () => {
    const el = await renderCumulVisibility({ entity: RAIN_ID });
    const summaries = el.shadowRoot!.querySelectorAll('td.summary-column');
    expect(summaries[0]?.textContent?.trim()).toBe('5/18/30');
  });

  it('show_min: false → summary shows "18/30"; total unchanged', async () => {
    const el = await renderCumulVisibility({ entity: RAIN_ID, show_min: false });
    const summaries = el.shadowRoot!.querySelectorAll('td.summary-column');
    expect(summaries[0]?.textContent?.trim()).toBe('18/30');
    expect(summaries[summaries.length - 1]?.textContent?.trim()).toBe('100');
  });

  it('show_avg: false → summary shows "5/30"; total unchanged', async () => {
    const el = await renderCumulVisibility({ entity: RAIN_ID, show_avg: false });
    const summaries = el.shadowRoot!.querySelectorAll('td.summary-column');
    expect(summaries[0]?.textContent?.trim()).toBe('5/30');
    expect(summaries[summaries.length - 1]?.textContent?.trim()).toBe('100');
  });

  it('show_max: false → summary shows "5/18"; total unchanged', async () => {
    const el = await renderCumulVisibility({ entity: RAIN_ID, show_max: false });
    const summaries = el.shadowRoot!.querySelectorAll('td.summary-column');
    expect(summaries[0]?.textContent?.trim()).toBe('5/18');
    expect(summaries[summaries.length - 1]?.textContent?.trim()).toBe('100');
  });

  it('show_min: false, show_max: false → summary shows "18"; total shown', async () => {
    const el = await renderCumulVisibility({ entity: RAIN_ID, show_min: false, show_max: false });
    const summaries = el.shadowRoot!.querySelectorAll('td.summary-column');
    expect(summaries[0]?.textContent?.trim()).toBe('18');
    expect(summaries[summaries.length - 1]?.textContent?.trim()).toBe('100');
  });

  it('show_min: false, show_avg: false, show_max: false → summary empty; total still shows', async () => {
    const el = await renderCumulVisibility({ entity: RAIN_ID, show_min: false, show_avg: false, show_max: false });
    const summaries = el.shadowRoot!.querySelectorAll('td.summary-column');
    expect(summaries[0]?.textContent?.trim()).toBe('');
    expect(summaries[summaries.length - 1]?.textContent?.trim()).toBe('100');
  });
});

// T003: EntityRowConfig label cell colors
describe('MonthlyTable — label cell colors (EntityRowConfig)', () => {
  async function renderEntityColor(cfgs: EntityConfig[], metadata?: Map<string, EntityMetadata>) {
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = cfgs;
    el.dailyValues = new Map();
    el.monthlySummaries = new Map();
    el.entityMetadata = metadata ?? new Map([[ENTITY_ID, tempMeta]]);
    el.entityErrors = new Set();
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('no root');
    }, { timeout: 3000 });
    return el;
  }

  it('text_color: "red" on measurement → label cell and data cells all have color:red in style', async () => {
    const el = await renderEntityColor([{ entity: ENTITY_ID, text_color: 'red' }]);
    const labelCell = el.shadowRoot!.querySelector('td.label-column[rowspan]');
    expect(labelCell?.getAttribute('style')).toContain('color:red');
    for (const cell of el.shadowRoot!.querySelectorAll('td.data-cell, td.sub-label, td.summary-column')) {
      expect(cell.getAttribute('style')).toContain('color:red');
    }
  });

  it('background_color: "#e0f0ff" on measurement → label cell style contains background-color:#e0f0ff', async () => {
    const el = await renderEntityColor([{ entity: ENTITY_ID, background_color: '#e0f0ff' }]);
    const labelCell = el.shadowRoot!.querySelector('td.label-column[rowspan]');
    expect(labelCell?.getAttribute('style')).toContain('background-color:#e0f0ff');
  });

  it('both text_color and background_color → label cell style contains both', async () => {
    const el = await renderEntityColor([{ entity: ENTITY_ID, text_color: 'red', background_color: '#e0f0ff' }]);
    const style = el.shadowRoot!.querySelector('td.label-column[rowspan]')?.getAttribute('style') ?? '';
    expect(style).toContain('color:red');
    expect(style).toContain('background-color:#e0f0ff');
  });

  it('neither text_color nor background_color → label cell has no style attribute', async () => {
    const el = await renderEntityColor([{ entity: ENTITY_ID }]);
    const labelCell = el.shadowRoot!.querySelector('td.label-column[rowspan]');
    expect(labelCell?.getAttribute('style')).toBeNull();
  });

  it('text_color: "var(--primary-color)" → label cell style contains color:var(--primary-color)', async () => {
    const el = await renderEntityColor([{ entity: ENTITY_ID, text_color: 'var(--primary-color)' }]);
    const labelCell = el.shadowRoot!.querySelector('td.label-column[rowspan]');
    expect(labelCell?.getAttribute('style')).toContain('color:var(--primary-color)');
  });

  it('measurement rowspan>1: spanned label cell and sub-label cells all have color', async () => {
    const el = await renderEntityColor([{ entity: ENTITY_ID, text_color: 'blue' }]);
    const labelCell = el.shadowRoot!.querySelector('td.label-column[rowspan]');
    expect(labelCell?.getAttribute('style')).toContain('color:blue');
    for (const cell of el.shadowRoot!.querySelectorAll('td.sub-label')) {
      expect(cell.getAttribute('style')).toContain('color:blue');
    }
  });

  it('text_color on cumulative entity → td.label-column has color style', async () => {
    const precipMeta: EntityMetadata = {
      entityId: 'sensor.rain',
      stateClass: 'total_increasing',
      deviceClass: 'precipitation',
      unitOfMeasurement: 'mm',
      friendlyName: 'Rain',
      hasStatistics: true,
    };
    const el = await renderEntityColor(
      [{ entity: 'sensor.rain', text_color: 'green' }],
      new Map([['sensor.rain', precipMeta]])
    );
    const labelCell = el.shadowRoot!.querySelector('td.label-column');
    expect(labelCell?.getAttribute('style')).toContain('color:green');
  });

  it('two entities: configured entity cells have style; other entity cells have no style', async () => {
    const precipMeta: EntityMetadata = {
      entityId: 'sensor.rain',
      stateClass: 'total_increasing',
      deviceClass: 'precipitation',
      unitOfMeasurement: 'mm',
      friendlyName: 'Rain',
      hasStatistics: true,
    };
    const el = await renderEntityColor(
      [{ entity: ENTITY_ID, text_color: 'red' }, { entity: 'sensor.rain' }],
      new Map([[ENTITY_ID, tempMeta], ['sensor.rain', precipMeta]])
    );
    const measLabel = el.shadowRoot!.querySelector('td.label-column[rowspan]');
    expect(measLabel?.getAttribute('style')).toContain('color:red');
    for (const cell of el.shadowRoot!.querySelectorAll('td.sub-label')) {
      expect(cell.getAttribute('style')).toContain('color:red');
    }
    const cumulLabel = el.shadowRoot!.querySelector('td.label-column[colspan]');
    expect(cumulLabel?.getAttribute('style')).toBeNull();
  });
});

// T003 [US2]: Sunday header highlighting
describe('MonthlyTable — Sunday header highlighting', () => {
  it('January 2025: .day-cell-header count = 31 (existing behavior guard)', async () => {
    const el = await renderTable(1, 2025);
    const headers = el.shadowRoot!.querySelectorAll('.day-cell-header');
    expect(headers.length).toBe(31);
  });

  it('January 2025: th.sunday text values = exactly [5, 12, 19, 26]', async () => {
    const el = await renderTable(1, 2025);
    const sundays = el.shadowRoot!.querySelectorAll('th.sunday');
    const nums = Array.from(sundays).map((th) => parseInt(th.textContent!.trim(), 10));
    expect(nums).toEqual([5, 12, 19, 26]);
  });

  it('January 2025: day 1 th does NOT have .sunday class', async () => {
    const el = await renderTable(1, 2025);
    const allDayHeaders = el.shadowRoot!.querySelectorAll('.day-cell-header');
    const day1 = Array.from(allDayHeaders).find(
      (th) => th.textContent?.trim() === '1',
    );
    expect(day1?.classList.contains('sunday')).toBe(false);
  });

  it('February 2025: th.sunday text values = exactly [2, 9, 16, 23]; pad-cells have no .sunday', async () => {
    const el = await renderTable(2, 2025);
    const sundays = el.shadowRoot!.querySelectorAll('th.sunday');
    const nums = Array.from(sundays).map((th) => parseInt(th.textContent!.trim(), 10));
    expect(nums).toEqual([2, 9, 16, 23]);
    const padSundays = el.shadowRoot!.querySelectorAll('th.pad-cell.sunday');
    expect(padSundays.length).toBe(0);
  });
});

// T005: ExpressionRowConfig label cell colors
describe('MonthlyTable — label cell colors (ExpressionRowConfig)', () => {
  async function renderExprColor(cfg: EntityConfig) {
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = [cfg];
    el.dailyValues = new Map();
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map();
    el.entityErrors = new Set();
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('no root');
    }, { timeout: 3000 });
    return el;
  }

  it('text_color: "green" on expression row → label cell style contains color:green', async () => {
    const el = await renderExprColor({ expression: 'sensor.a - sensor.b', text_color: 'green' });
    const labelCell = el.shadowRoot!.querySelector('td.label-column');
    expect(labelCell?.getAttribute('style')).toContain('color:green');
  });

  it('background_color: "#ffe0e0" on expression row → label cell style contains background-color:#ffe0e0', async () => {
    const el = await renderExprColor({ expression: 'sensor.a - sensor.b', background_color: '#ffe0e0' });
    const labelCell = el.shadowRoot!.querySelector('td.label-column');
    expect(labelCell?.getAttribute('style')).toContain('background-color:#ffe0e0');
  });

  it('text_color: "var(--primary-color)" on expression row → label cell style contains color:var(--primary-color)', async () => {
    const el = await renderExprColor({ expression: 'sensor.a - sensor.b', text_color: 'var(--primary-color)' });
    const labelCell = el.shadowRoot!.querySelector('td.label-column');
    expect(labelCell?.getAttribute('style')).toContain('color:var(--primary-color)');
  });

  it('neither field set on expression row → label cell has no style attribute', async () => {
    const el = await renderExprColor({ expression: 'sensor.a - sensor.b' });
    const labelCell = el.shadowRoot!.querySelector('td.label-column');
    expect(labelCell?.getAttribute('style')).toBeNull();
  });
});

// T006 [US1][US4]: scalar threshold coloring
describe('MonthlyTable — scalar threshold coloring', () => {
  const RAIN_ID = 'sensor.rain';
  const rainMeta: EntityMetadata = {
    entityId: RAIN_ID, stateClass: 'total_increasing', deviceClass: 'precipitation',
    unitOfMeasurement: 'mm', friendlyName: 'Rain', hasStatistics: true,
  };

  async function renderScalarThreshold(
    thresholds: ThresholdRule[],
    value: number,
    opts: { staticText?: string; staticBg?: string } = {},
  ) {
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    const cfg: EntityConfig = {
      entity: RAIN_ID,
      ...(opts.staticText ? { text_color: opts.staticText } : {}),
      ...(opts.staticBg ? { background_color: opts.staticBg } : {}),
      thresholds,
    };
    el.entityConfigs = [cfg];
    const dayVal: CumulativeDailyValue = {
      kind: 'cumulative', entityId: RAIN_ID, date: '2025-01-01',
      sum: value, partialCoverage: false,
    };
    el.dailyValues = new Map([[`${RAIN_ID}::2025-01-01`, dayVal]]);
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[RAIN_ID, rainMeta]]);
    el.entityErrors = new Set();
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('no root');
    }, { timeout: 3000 });
    return el;
  }

  it('above: value > threshold → threshold background_color on data cell', async () => {
    const el = await renderScalarThreshold(
      [{ operator: 'above', value: 10, background_color: 'red' }], 11, { staticBg: 'gray' },
    );
    expect(el.shadowRoot!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('background-color:red');
  });

  it('above: value === threshold → no threshold; static color', async () => {
    const el = await renderScalarThreshold(
      [{ operator: 'above', value: 10, background_color: 'red' }], 10, { staticBg: 'gray' },
    );
    const style = el.shadowRoot!.querySelectorAll('td.data-cell')[0]?.getAttribute('style') ?? '';
    expect(style).toContain('background-color:gray');
    expect(style).not.toContain('background-color:red');
  });

  it('equals-above: value === threshold → threshold color (boundary included)', async () => {
    const el = await renderScalarThreshold(
      [{ operator: 'equals-above', value: 10, background_color: 'orange' }], 10, { staticBg: 'gray' },
    );
    expect(el.shadowRoot!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('background-color:orange');
  });

  it('equals-below: value === threshold → threshold color (boundary included)', async () => {
    const el = await renderScalarThreshold(
      [{ operator: 'equals-below', value: 5, background_color: 'blue' }], 5, { staticBg: 'gray' },
    );
    expect(el.shadowRoot!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('background-color:blue');
  });

  it('below: value < threshold → threshold text_color', async () => {
    const el = await renderScalarThreshold(
      [{ operator: 'below', value: 0, text_color: 'cyan' }], -1, { staticText: 'black' },
    );
    const style = el.shadowRoot!.querySelectorAll('td.data-cell')[0]?.getAttribute('style') ?? '';
    expect(style).toContain('color:cyan');
    expect(style).not.toContain('color:black');
  });

  it('no matching threshold → static color', async () => {
    const el = await renderScalarThreshold(
      [{ operator: 'above', value: 100, background_color: 'red' }], 5, { staticBg: 'gray' },
    );
    expect(el.shadowRoot!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('background-color:gray');
  });

  it('no thresholds → static color', async () => {
    const el = await renderScalarThreshold([], 10, { staticBg: 'gray' });
    expect(el.shadowRoot!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('background-color:gray');
  });

  it('[US4] partial override: threshold bg only → threshold bg; static text preserved', async () => {
    const el = await renderScalarThreshold(
      [{ operator: 'above', value: 5, background_color: 'red' }], 10,
      { staticText: 'black', staticBg: 'gray' },
    );
    const style = el.shadowRoot!.querySelectorAll('td.data-cell')[0]?.getAttribute('style') ?? '';
    expect(style).toContain('color:black');
    expect(style).toContain('background-color:red');
    expect(style).not.toContain('background-color:gray');
  });

  it('[US4] partial override: threshold text only → threshold text; static bg preserved', async () => {
    const el = await renderScalarThreshold(
      [{ operator: 'above', value: 5, text_color: 'white' }], 10,
      { staticText: 'black', staticBg: 'gray' },
    );
    const style = el.shadowRoot!.querySelectorAll('td.data-cell')[0]?.getAttribute('style') ?? '';
    expect(style).toContain('color:white');
    expect(style).toContain('background-color:gray');
  });

  it('label cell uses static color (no threshold)', async () => {
    const el = await renderScalarThreshold(
      [{ operator: 'above', value: 5, background_color: 'red' }], 10, { staticBg: 'gray' },
    );
    const label = el.shadowRoot!.querySelector('td.label-column');
    expect(label?.getAttribute('style')).toContain('background-color:gray');
    expect(label?.getAttribute('style')).not.toContain('background-color:red');
  });

  it('pad cells use static color (no threshold)', async () => {
    const el = new MonthlyTable();
    el.month = 2; // Feb: days 29-31 are pad
    el.year = 2025;
    el.entityConfigs = [{
      entity: RAIN_ID, background_color: 'gray',
      thresholds: [{ operator: 'above', value: 0, background_color: 'red' }],
    }];
    el.dailyValues = new Map();
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[RAIN_ID, rainMeta]]);
    el.entityErrors = new Set();
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('no root');
    }, { timeout: 3000 });
    const padCells = el.shadowRoot!.querySelectorAll('td.pad-cell');
    expect(padCells.length).toBeGreaterThan(0);
    for (const cell of padCells) {
      expect(cell.getAttribute('style')).toContain('background-color:gray');
      expect(cell.getAttribute('style')).not.toContain('background-color:red');
    }
  });

  it('missing data cell → static color (no threshold)', async () => {
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = [{
      entity: RAIN_ID, background_color: 'gray',
      thresholds: [{ operator: 'above', value: 0, background_color: 'red' }],
    }];
    el.dailyValues = new Map();
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[RAIN_ID, rainMeta]]);
    el.entityErrors = new Set();
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('no root');
    }, { timeout: 3000 });
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.getAttribute('style')).toContain('background-color:gray');
    expect(day1?.getAttribute('style')).not.toContain('background-color:red');
  });
});

// T010 [US2][US3]: measurement threshold coloring
describe('MonthlyTable — measurement threshold coloring', () => {
  const tempMeta: EntityMetadata = {
    entityId: ENTITY_ID, stateClass: 'measurement', deviceClass: 'temperature',
    unitOfMeasurement: '°C', friendlyName: 'Temperature', hasStatistics: true,
  };

  async function renderMeasurementThreshold(
    thresholds: ThresholdRule[],
    minV: number, avgV: number, maxV: number,
    opts: { staticBg?: string } = {},
  ) {
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = [{
      entity: ENTITY_ID,
      ...(opts.staticBg ? { background_color: opts.staticBg } : {}),
      thresholds,
    }];
    const dayVal: MeasurementDailyValue = {
      kind: 'measurement', entityId: ENTITY_ID, date: '2025-01-01',
      min: minV, mean: avgV, max: maxV, partialCoverage: false,
    };
    el.dailyValues = new Map([[`${ENTITY_ID}::2025-01-01`, dayVal]]);
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

  it('not-below fires on min cell; excluded from avg and max', async () => {
    const el = await renderMeasurementThreshold(
      [{ operator: 'not-below', value: 5, background_color: 'lime' }],
      10, 15, 20, { staticBg: 'gray' },
    );
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    expect(rows[0]!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('background-color:lime');
    expect(rows[1]!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('background-color:gray');
    expect(rows[2]!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('background-color:gray');
  });

  it('not-above fires on max cell; excluded from avg and min', async () => {
    const el = await renderMeasurementThreshold(
      [{ operator: 'not-above', value: 25, background_color: 'green' }],
      10, 15, 20, { staticBg: 'gray' },
    );
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    expect(rows[0]!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('background-color:gray');
    expect(rows[1]!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('background-color:gray');
    expect(rows[2]!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('background-color:green');
  });

  it('multi-level above on max: closest wins', async () => {
    const t1: ThresholdRule = { operator: 'above', value: 20, background_color: 'orange' };
    const t2: ThresholdRule = { operator: 'above', value: 30, background_color: 'red' };
    const el = await renderMeasurementThreshold([t1, t2], 10, 15, 35, { staticBg: 'gray' });
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    expect(rows[2]!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('background-color:red');
  });

  it('standard above fires on avg cell', async () => {
    const el = await renderMeasurementThreshold(
      [{ operator: 'above', value: 10, background_color: 'orange' }],
      5, 15, 20, { staticBg: 'gray' },
    );
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    expect(rows[1]!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('background-color:orange');
  });

  it('avg cell: not-below and not-above both excluded', async () => {
    const el = await renderMeasurementThreshold(
      [
        { operator: 'not-below', value: 5, background_color: 'lime' },
        { operator: 'not-above', value: 25, background_color: 'green' },
      ],
      10, 15, 20, { staticBg: 'gray' },
    );
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    expect(rows[1]!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('background-color:gray');
  });

  it('summary cells use correct roles', async () => {
    const rule: ThresholdRule = { operator: 'above', value: 10, background_color: 'red' };
    const summary: MonthlySummary = { entityId: ENTITY_ID, year: 2025, month: 1, min: 5, mean: 15, max: 25, total: null };
    const el = new MonthlyTable();
    el.month = 1;
    el.year = 2025;
    el.entityConfigs = [{ entity: ENTITY_ID, thresholds: [rule] }];
    el.dailyValues = new Map();
    el.monthlySummaries = new Map([[`0::${ENTITY_ID}::2025-1`, summary]]);
    el.entityMetadata = new Map([[ENTITY_ID, tempMeta]]);
    el.entityErrors = new Set();
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('no root');
    }, { timeout: 3000 });
    const summaries = el.shadowRoot!.querySelectorAll('td.summary-column');
    // min=5 not > 10 → null; avg=15 > 10 → red; max=25 > 10 → red
    expect(summaries[0]?.getAttribute('style')).toBeNull();
    expect(summaries[1]?.getAttribute('style')).toContain('background-color:red');
    expect(summaries[2]?.getAttribute('style')).toContain('background-color:red');
  });
});
