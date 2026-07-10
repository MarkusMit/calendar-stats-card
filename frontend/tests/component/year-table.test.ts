import { describe, it, expect, vi, afterEach } from 'vitest';
import { YearTable } from '../../src/components/year-table';
import type { EntityConfig, ThresholdRule } from '../../src/types/card-config';
import type { CumulativeDailyValue, MeasurementDailyValue, MonthlySummary, EntityMetadata } from '../../src/types/statistics';

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

describe('YearTable — showYear month header', () => {
  it('showYear=false → month header has no year', async () => {
    const el = await renderYearTable();
    const header = el.shadowRoot!.querySelector('.month-name')!.textContent!;
    expect(header).not.toContain('2025');
  });

  it('showYear=true → month header includes the year', async () => {
    const el = await renderYearTable();
    el.showYear = true;
    await el.updateComplete;
    const header = el.shadowRoot!.querySelector('.month-name')!.textContent!;
    expect(header).toContain('2025');
  });
});

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
    expect(day1?.textContent?.trim()).toBe('0.0');
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

  it('show_zero: false + sum=0 + partialCoverage=true → blank cell (suppression wins)', async () => {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1];
    el.entityConfigs = [{ entity: RAIN_ID, show_zero: false }];
    const dayVal: CumulativeDailyValue = {
      kind: 'cumulative',
      entityId: RAIN_ID,
      date: '2025-01-01',
      sum: 0,
      partialCoverage: true,
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
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.textContent?.trim()).toBe('');
    expect(day1?.classList.contains('has-data')).toBe(false);
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
    expect(minCell?.textContent?.trim()).toBe('0.0');
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
    expect(meanCell?.textContent?.trim()).toBe('5.0');
    expect(meanCell?.classList.contains('has-data')).toBe(true);
    expect(maxCell?.textContent?.trim()).toBe('10.0');
    expect(maxCell?.classList.contains('has-data')).toBe(true);
  });

  it('show_zero: false + nonzero values → renders normally', async () => {
    const el = await renderYearMeasurement(false, 2, 5, 8);
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    const minCell = rows[0]!.querySelectorAll('td.data-cell')[4];
    expect(minCell?.textContent?.trim()).toBe('2.0');
    expect(minCell?.classList.contains('has-data')).toBe(true);
  });
});

// T002: measurement sub-row visibility (show_min/avg/max)
describe('YearTable — measurement sub-row visibility', () => {
  const testSummary: MonthlySummary = { entityId: ENTITY_ID, year: 2025, month: 1, min: 5, mean: 18, max: 30, total: null };

  async function renderMeasVisibility(cfg: Record<string, unknown>, summary?: MonthlySummary) {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1];
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
    const el = await renderMeasVisibility({ entity: ENTITY_ID }, testSummary);
    expect(el.shadowRoot!.querySelectorAll('tbody tr').length).toBe(3);
    const texts = Array.from(el.shadowRoot!.querySelectorAll('td.sub-label')).map(td => td.textContent?.trim());
    expect(texts).toContain('min');
    expect(texts).toContain('avg');
    expect(texts).toContain('max');
    const summaries = el.shadowRoot!.querySelectorAll('td.summary-column');
    expect(summaries[0]?.textContent?.trim()).toBe('5.0');
    expect(summaries[1]?.textContent?.trim()).toBe('18.0');
    expect(summaries[2]?.textContent?.trim()).toBe('30.0');
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

  it('show_min: false → summary shows no min; avg and max summary values present', async () => {
    const el = await renderMeasVisibility({ entity: ENTITY_ID, show_min: false }, testSummary);
    const summaries = el.shadowRoot!.querySelectorAll('td.summary-column');
    expect(summaries.length).toBe(2);
    expect(summaries[0]?.textContent?.trim()).toBe('18.0');
    expect(summaries[1]?.textContent?.trim()).toBe('30.0');
  });
});

// T006: cumulative summary visibility (show_min/avg/max)
describe('YearTable — cumulative summary visibility', () => {
  const RAIN_ID = 'sensor.rain';
  const rainSummary: MonthlySummary = { entityId: RAIN_ID, year: 2025, month: 1, min: 5, mean: 18, max: 30, total: 100 };

  async function renderCumulVisibility(cfg: Record<string, unknown>) {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1];
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

  it('default → mean + ↓min + ↑max all present (regression guard)', async () => {
    const el = await renderCumulVisibility({ entity: RAIN_ID });
    const summaryEl = el.shadowRoot!.querySelector('.cumul-summary');
    expect(summaryEl).toBeTruthy();
    expect(summaryEl!.textContent).toContain('18');
    expect(summaryEl!.textContent).toContain('↓5');
    expect(summaryEl!.textContent).toContain('↑30');
    expect(el.shadowRoot!.querySelector('.cumul-minmax')).toBeTruthy();
  });

  it('show_min: false → ↓min absent; ↑max and mean present; total unchanged', async () => {
    const el = await renderCumulVisibility({ entity: RAIN_ID, show_min: false });
    const summaryEl = el.shadowRoot!.querySelector('.cumul-summary');
    expect(summaryEl!.textContent).not.toContain('↓');
    expect(summaryEl!.textContent).toContain('18');
    expect(summaryEl!.textContent).toContain('↑30');
    const cols = el.shadowRoot!.querySelectorAll('td.summary-column');
    expect(cols[cols.length - 1]?.textContent?.trim()).toBe('100.0');
  });

  it('show_avg: false → mean absent; ↓min and ↑max present; total unchanged', async () => {
    const el = await renderCumulVisibility({ entity: RAIN_ID, show_avg: false });
    const summaryEl = el.shadowRoot!.querySelector('.cumul-summary');
    expect(summaryEl!.textContent).not.toContain('18');
    expect(summaryEl!.textContent).toContain('↓5');
    expect(summaryEl!.textContent).toContain('↑30');
    const cols = el.shadowRoot!.querySelectorAll('td.summary-column');
    expect(cols[cols.length - 1]?.textContent?.trim()).toBe('100.0');
  });

  it('show_max: false → ↑max absent; mean and ↓min present; total unchanged', async () => {
    const el = await renderCumulVisibility({ entity: RAIN_ID, show_max: false });
    const summaryEl = el.shadowRoot!.querySelector('.cumul-summary');
    expect(summaryEl!.textContent).not.toContain('↑');
    expect(summaryEl!.textContent).toContain('18');
    expect(summaryEl!.textContent).toContain('↓5');
  });

  it('show_min: false, show_max: false → cumul-minmax absent; mean present; total shown', async () => {
    const el = await renderCumulVisibility({ entity: RAIN_ID, show_min: false, show_max: false });
    expect(el.shadowRoot!.querySelector('.cumul-minmax')).toBeFalsy();
    const summaryEl = el.shadowRoot!.querySelector('.cumul-summary');
    expect(summaryEl).toBeTruthy();
    expect(summaryEl!.textContent).toContain('18');
    const cols = el.shadowRoot!.querySelectorAll('td.summary-column');
    expect(cols[cols.length - 1]?.textContent?.trim()).toBe('100.0');
  });

  it('show_min: false, show_avg: false, show_max: false → cumul-summary absent; total still shows', async () => {
    const el = await renderCumulVisibility({ entity: RAIN_ID, show_min: false, show_avg: false, show_max: false });
    expect(el.shadowRoot!.querySelector('.cumul-summary')).toBeFalsy();
    const cols = el.shadowRoot!.querySelectorAll('td.summary-column');
    expect(cols[cols.length - 1]?.textContent?.trim()).toBe('100.0');
  });
});

// T002: EntityRowConfig label cell colors
describe('YearTable — label cell colors (EntityRowConfig)', () => {
  async function renderEntityColor(cfgs: EntityConfig[], metadata?: Map<string, EntityMetadata>) {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1];
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
    const el = await renderEntityColor(
      [{ entity: 'sensor.rain', text_color: 'green' }],
      new Map([['sensor.rain', precipMeta]])
    );
    const labelCell = el.shadowRoot!.querySelector('td.label-column');
    expect(labelCell?.getAttribute('style')).toContain('color:green');
  });

  it('two entities: configured entity cells have style; other entity cells have no style', async () => {
    const el = await renderEntityColor(
      [{ entity: ENTITY_ID, text_color: 'red' }, { entity: 'sensor.rain' }],
      new Map([[ENTITY_ID, tempMeta], ['sensor.rain', precipMeta]])
    );
    // Entity 1 (measurement): label and sub-label cells have style
    const measLabel = el.shadowRoot!.querySelector('td.label-column[rowspan]');
    expect(measLabel?.getAttribute('style')).toContain('color:red');
    for (const cell of el.shadowRoot!.querySelectorAll('td.sub-label')) {
      expect(cell.getAttribute('style')).toContain('color:red');
    }
    // Entity 2 (cumulative, no color): its label cell has no style
    const cumulLabel = el.shadowRoot!.querySelector('td.label-column[colspan]');
    expect(cumulLabel?.getAttribute('style')).toBeNull();
  });
});

// T004 [US2]: Sunday header highlighting
describe('YearTable — Sunday header highlighting', () => {
  async function renderYearTableForSunday(month: number) {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [month];
    el.entityConfigs = [{ entity: ENTITY_ID }];
    el.dailyValues = new Map();
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[ENTITY_ID, tempMeta]]);
    el.entityErrors = new Set();
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('shadow root not ready');
    }, { timeout: 3000 });
    return el;
  }

  it('January 2025: th.sunday text values = exactly [5, 12, 19, 26]', async () => {
    const el = await renderYearTableForSunday(1);
    const sundays = el.shadowRoot!.querySelectorAll('th.sunday');
    const nums = Array.from(sundays).map((th) => parseInt(th.textContent!.trim(), 10));
    expect(nums).toEqual([5, 12, 19, 26]);
  });

  it('February 2025: th.sunday text values = exactly [2, 9, 16, 23]', async () => {
    const el = await renderYearTableForSunday(2);
    const sundays = el.shadowRoot!.querySelectorAll('th.sunday');
    const nums = Array.from(sundays).map((th) => parseInt(th.textContent!.trim(), 10));
    expect(nums).toEqual([2, 9, 16, 23]);
  });

  it('two-month render: January and February Sundays correct independently', async () => {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1, 2];
    el.entityConfigs = [{ entity: ENTITY_ID }];
    el.dailyValues = new Map();
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[ENTITY_ID, tempMeta]]);
    el.entityErrors = new Set();
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('shadow root not ready');
    }, { timeout: 3000 });
    const theads = el.shadowRoot!.querySelectorAll('thead');
    const janSundays = Array.from(theads[0]!.querySelectorAll('th.sunday')).map(
      (th) => parseInt(th.textContent!.trim(), 10),
    );
    const febSundays = Array.from(theads[1]!.querySelectorAll('th.sunday')).map(
      (th) => parseInt(th.textContent!.trim(), 10),
    );
    expect(janSundays).toEqual([5, 12, 19, 26]);
    expect(febSundays).toEqual([2, 9, 16, 23]);
  });
});

// T001 [US1]: day headers present on every month
describe('YearTable — day headers present on every month', () => {
  async function renderYearTableMonths(visibleMonths: number[]) {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = visibleMonths;
    el.entityConfigs = [{ entity: ENTITY_ID }];
    el.dailyValues = new Map();
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[ENTITY_ID, tempMeta]]);
    el.entityErrors = new Set();
    el.lang = 'en';
    document.body.appendChild(el);
    await vi.waitFor(async () => {
      await el.updateComplete;
      if (!el.shadowRoot) throw new Error('shadow root not ready');
    }, { timeout: 3000 });
    return el;
  }

  it('2nd month in a 2-month render shows 28 numeric day headers (February 2025)', async () => {
    const el = await renderYearTableMonths([1, 2]);
    const theads = el.shadowRoot!.querySelectorAll('thead');
    const febThs = Array.from(theads[1]!.querySelectorAll('th')).filter(
      (th) => /^\d+$/.test(th.textContent?.trim() ?? ''),
    );
    expect(febThs.length).toBe(28);
    const dayNums = febThs.map((th) => parseInt(th.textContent!.trim(), 10));
    expect(dayNums).toEqual(Array.from({ length: 28 }, (_, i) => i + 1));
  });

  it('February 2025 as sole month: header has exactly 28 numeric th + 3 pad-cell th', async () => {
    const el = await renderYearTableMonths([2]);
    const thead = el.shadowRoot!.querySelector('thead')!;
    const numericThs = Array.from(thead.querySelectorAll('th')).filter(
      (th) => /^\d+$/.test(th.textContent?.trim() ?? ''),
    );
    const padThs = thead.querySelectorAll('th.pad-cell');
    expect(numericThs.length).toBe(28);
    expect(padThs.length).toBe(3);
  });
});

// T004: ExpressionRowConfig label cell colors
describe('YearTable — label cell colors (ExpressionRowConfig)', () => {
  async function renderExprColor(cfg: EntityConfig) {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1];
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

// T005 [US1][US4]: scalar threshold coloring
describe('YearTable — scalar threshold coloring', () => {
  const RAIN_ID = 'sensor.rain';

  async function renderScalarThreshold(
    thresholds: ThresholdRule[],
    value: number,
    opts: { staticText?: string; staticBg?: string } = {},
  ) {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1];
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

  it('above: value > threshold → threshold background_color on data cell', async () => {
    const el = await renderScalarThreshold(
      [{ operator: 'above', value: 10, background_color: 'red' }], 11, { staticBg: 'gray' },
    );
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.getAttribute('style')).toContain('background-color:red');
    expect(day1?.getAttribute('style')).not.toContain('background-color:gray');
  });

  it('above: value === threshold → no threshold; static color', async () => {
    const el = await renderScalarThreshold(
      [{ operator: 'above', value: 10, background_color: 'red' }], 10, { staticBg: 'gray' },
    );
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.getAttribute('style')).toContain('background-color:gray');
    expect(day1?.getAttribute('style')).not.toContain('background-color:red');
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

  it('below: value < threshold → threshold text_color applied', async () => {
    const el = await renderScalarThreshold(
      [{ operator: 'below', value: 0, text_color: 'cyan' }], -1, { staticText: 'black' },
    );
    const day1 = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(day1?.getAttribute('style')).toContain('color:cyan');
    expect(day1?.getAttribute('style')).not.toContain('color:black');
  });

  it('below: value === threshold → no threshold; static color', async () => {
    const el = await renderScalarThreshold(
      [{ operator: 'below', value: 0, text_color: 'cyan' }], 0, { staticText: 'black' },
    );
    expect(el.shadowRoot!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('color:black');
  });

  it('no matching threshold → static color on data cell', async () => {
    const el = await renderScalarThreshold(
      [{ operator: 'above', value: 100, background_color: 'red' }], 5, { staticBg: 'gray' },
    );
    expect(el.shadowRoot!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('background-color:gray');
  });

  it('no thresholds → static color on data cell', async () => {
    const el = await renderScalarThreshold([], 10, { staticBg: 'gray' });
    expect(el.shadowRoot!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('background-color:gray');
  });

  it('[US4] partial override: threshold background_color only → threshold bg; static text_color preserved', async () => {
    const el = await renderScalarThreshold(
      [{ operator: 'above', value: 5, background_color: 'red' }], 10,
      { staticText: 'black', staticBg: 'gray' },
    );
    const style = el.shadowRoot!.querySelectorAll('td.data-cell')[0]?.getAttribute('style') ?? '';
    expect(style).toContain('color:black');
    expect(style).toContain('background-color:red');
    expect(style).not.toContain('background-color:gray');
  });

  it('[US4] partial override: threshold text_color only → threshold text; static background preserved', async () => {
    const el = await renderScalarThreshold(
      [{ operator: 'above', value: 5, text_color: 'white' }], 10,
      { staticText: 'black', staticBg: 'gray' },
    );
    const style = el.shadowRoot!.querySelectorAll('td.data-cell')[0]?.getAttribute('style') ?? '';
    expect(style).toContain('color:white');
    expect(style).toContain('background-color:gray');
  });

  it('label cell uses static color (threshold not applied to label)', async () => {
    const el = await renderScalarThreshold(
      [{ operator: 'above', value: 5, background_color: 'red' }], 10, { staticBg: 'gray' },
    );
    const label = el.shadowRoot!.querySelector('td.label-column');
    expect(label?.getAttribute('style')).toContain('background-color:gray');
    expect(label?.getAttribute('style')).not.toContain('background-color:red');
  });

  it('pad cells use static color (no threshold applied)', async () => {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [2]; // Feb: days 29-31 are pad cells
    el.entityConfigs = [{
      entity: RAIN_ID, background_color: 'gray',
      thresholds: [{ operator: 'above', value: 0, background_color: 'red' }],
    }];
    el.dailyValues = new Map();
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[RAIN_ID, precipMeta]]);
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
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1];
    el.entityConfigs = [{
      entity: RAIN_ID, background_color: 'gray',
      thresholds: [{ operator: 'above', value: 0, background_color: 'red' }],
    }];
    el.dailyValues = new Map(); // no data
    el.monthlySummaries = new Map();
    el.entityMetadata = new Map([[RAIN_ID, precipMeta]]);
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

// T009 [US2][US3]: measurement threshold coloring
describe('YearTable — measurement threshold coloring', () => {
  async function renderMeasurementThreshold(
    thresholds: ThresholdRule[],
    minV: number, avgV: number, maxV: number,
    opts: { staticBg?: string } = {},
  ) {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1];
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

  it('multi-level above on max: closest threshold wins', async () => {
    const t1: ThresholdRule = { operator: 'above', value: 20, background_color: 'orange' };
    const t2: ThresholdRule = { operator: 'above', value: 30, background_color: 'red' };
    const el = await renderMeasurementThreshold([t1, t2], 10, 15, 35, { staticBg: 'gray' });
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    // max=35: dist(35,20)=15, dist(35,30)=5 → red
    expect(rows[2]!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('background-color:red');
  });

  it('standard above operator fires on avg cells', async () => {
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

  it('not-below: min cell below threshold → no threshold color', async () => {
    const el = await renderMeasurementThreshold(
      [{ operator: 'not-below', value: 20, background_color: 'lime' }],
      10, 15, 25, { staticBg: 'gray' },
    );
    const rows = el.shadowRoot!.querySelectorAll('tbody tr');
    expect(rows[0]!.querySelectorAll('td.data-cell')[0]?.getAttribute('style')).toContain('background-color:gray');
  });

  it('summary cells use correct roles: summary-min/avg/max', async () => {
    const rule: ThresholdRule = { operator: 'above', value: 10, background_color: 'red' };
    const summary: MonthlySummary = { entityId: ENTITY_ID, year: 2025, month: 1, min: 5, mean: 15, max: 25, total: null };
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1];
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
    // min=5 → no threshold (5 not > 10); avg=15 → red; max=25 → red
    expect(summaries[0]?.getAttribute('style')).toBeNull();
    expect(summaries[1]?.getAttribute('style')).toContain('background-color:red');
    expect(summaries[2]?.getAttribute('style')).toContain('background-color:red');
  });

  it('summary-min/max role respects not-below/not-above exclusions', async () => {
    const nb: ThresholdRule = { operator: 'not-below', value: 5, background_color: 'lime' };
    const na: ThresholdRule = { operator: 'not-above', value: 30, background_color: 'green' };
    const summary: MonthlySummary = { entityId: ENTITY_ID, year: 2025, month: 1, min: 10, mean: 15, max: 20, total: null };
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1];
    el.entityConfigs = [{ entity: ENTITY_ID, thresholds: [nb, na] }];
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
    // summary-min: not-below:5 fires (10>=5), not-above excluded → lime
    // summary-avg: not-below excluded, not-above excluded → null
    // summary-max: not-above:30 fires (20<=30), not-below excluded → green
    expect(summaries[0]?.getAttribute('style')).toContain('background-color:lime');
    expect(summaries[1]?.getAttribute('style')).toBeNull();
    expect(summaries[2]?.getAttribute('style')).toContain('background-color:green');
  });
});

describe('YearTable — cumulative total column ignores thresholds', () => {
  const RAIN_ID = 'sensor.rain';

  async function renderTotal(thresholds: ThresholdRule[], total: number, staticBg?: string) {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1];
    el.entityConfigs = [{
      entity: RAIN_ID,
      ...(staticBg ? { background_color: staticBg } : {}),
      thresholds,
    }];
    el.dailyValues = new Map();
    el.monthlySummaries = new Map([[
      `0::${RAIN_ID}::2025-1`,
      { entityId: RAIN_ID, year: 2025, month: 1, min: 1, mean: 5, max: 9, total },
    ]]);
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

  it('threshold matching total value does not color total cell; static color applies', async () => {
    const el = await renderTotal(
      [{ operator: 'above', value: 50, background_color: 'red' }], 100, 'gray',
    );
    const cols = el.shadowRoot!.querySelectorAll('td.summary-column');
    const totalCell = cols[cols.length - 1];
    expect(totalCell?.textContent?.trim()).toBe('100.0');
    expect(totalCell?.getAttribute('style')).not.toContain('background-color:red');
    expect(totalCell?.getAttribute('style')).toContain('background-color:gray');
  });

  it('threshold still colors the summary (mean) column', async () => {
    const el = await renderTotal(
      [{ operator: 'above', value: 1, background_color: 'red' }], 100, 'gray',
    );
    const cols = el.shadowRoot!.querySelectorAll('td.summary-column');
    // mean=5 > 1 → summary cell red; total cell stays gray
    expect(cols[0]?.getAttribute('style')).toContain('background-color:red');
    expect(cols[cols.length - 1]?.getAttribute('style')).toContain('background-color:gray');
  });
});

describe('YearTable — auto-contrast text color', () => {
  const RAIN_ID = 'sensor.rain';

  async function renderCell(cfg: Partial<EntityConfig>, dayValue: number) {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1];
    el.entityConfigs = [{ entity: RAIN_ID, ...cfg } as EntityConfig];
    const dayVal: CumulativeDailyValue = {
      kind: 'cumulative', entityId: RAIN_ID, date: '2025-01-01',
      sum: dayValue, partialCoverage: false,
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

  it('light hex background, no text_color → black auto-contrast text', async () => {
    const el = await renderCell({ background_color: '#cce8f5' }, 5);
    const cell = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(cell?.getAttribute('style')).toContain('color:#000000');
    expect(cell?.getAttribute('style')).toContain('background-color:#cce8f5');
  });

  it('dark hex threshold background → white auto-contrast text', async () => {
    const el = await renderCell(
      { thresholds: [{ operator: 'above', value: 10, background_color: '#8b0000' }] }, 20,
    );
    const cell = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(cell?.getAttribute('style')).toContain('color:#ffffff');
    expect(cell?.getAttribute('style')).toContain('background-color:#8b0000');
  });

  it('explicit text_color is respected (auto-contrast does not override)', async () => {
    const el = await renderCell({ background_color: '#cce8f5', text_color: 'red' }, 5);
    const cell = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(cell?.getAttribute('style')).toContain('color:red');
    expect(cell?.getAttribute('style')).not.toContain('color:#000000');
  });

  it('no background → no injected color', async () => {
    const el = await renderCell({}, 5);
    const cell = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    const style = cell?.getAttribute('style');
    expect(style == null || !style.includes('color:#')).toBe(true);
  });

  it('named light background → black auto-contrast text (regression)', async () => {
    const el = await renderCell({ background_color: 'lightblue' }, 5);
    const cell = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(cell?.getAttribute('style')).toContain('color:#000000');
    expect(cell?.getAttribute('style')).toContain('background-color:lightblue');
  });

  it('named dark background → white auto-contrast text', async () => {
    const el = await renderCell({ background_color: 'darkred' }, 5);
    const cell = el.shadowRoot!.querySelectorAll('td.data-cell')[0];
    expect(cell?.getAttribute('style')).toContain('color:#ffffff');
  });
});
