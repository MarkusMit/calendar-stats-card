import { describe, it, expect, vi, afterEach } from 'vitest';
import { YearTable } from '../../src/components/year-table';
import type { EntityConfig } from '../../src/types/card-config';
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

// T002: measurement sub-row visibility (show_min/avg/max)
describe('YearTable — measurement sub-row visibility', () => {
  const testSummary: MonthlySummary = { entityId: ENTITY_ID, year: 2025, month: 1, min: 5, mean: 18, max: 30, total: null };

  async function renderMeasVisibility(cfg: Parameters<typeof Object.assign>[0], summary?: MonthlySummary) {
    const el = new YearTable();
    el.year = 2025;
    el.visibleMonths = [1];
    el.entityConfigs = [cfg as any];
    el.dailyValues = new Map();
    el.monthlySummaries = summary ? new Map([[`${ENTITY_ID}::2025-1`, summary]]) : new Map();
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
    expect(summaries[0]?.textContent?.trim()).toBe('5');
    expect(summaries[1]?.textContent?.trim()).toBe('18');
    expect(summaries[2]?.textContent?.trim()).toBe('30');
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
    expect(summaries[0]?.textContent?.trim()).toBe('18');
    expect(summaries[1]?.textContent?.trim()).toBe('30');
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
    el.entityConfigs = [cfg as any];
    el.dailyValues = new Map();
    el.monthlySummaries = new Map([[`${RAIN_ID}::2025-1`, rainSummary]]);
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
    expect(cols[cols.length - 1]?.textContent?.trim()).toBe('100');
  });

  it('show_avg: false → mean absent; ↓min and ↑max present; total unchanged', async () => {
    const el = await renderCumulVisibility({ entity: RAIN_ID, show_avg: false });
    const summaryEl = el.shadowRoot!.querySelector('.cumul-summary');
    expect(summaryEl!.textContent).not.toContain('18');
    expect(summaryEl!.textContent).toContain('↓5');
    expect(summaryEl!.textContent).toContain('↑30');
    const cols = el.shadowRoot!.querySelectorAll('td.summary-column');
    expect(cols[cols.length - 1]?.textContent?.trim()).toBe('100');
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
    expect(cols[cols.length - 1]?.textContent?.trim()).toBe('100');
  });

  it('show_min: false, show_avg: false, show_max: false → cumul-summary absent; total still shows', async () => {
    const el = await renderCumulVisibility({ entity: RAIN_ID, show_min: false, show_avg: false, show_max: false });
    expect(el.shadowRoot!.querySelector('.cumul-summary')).toBeFalsy();
    const cols = el.shadowRoot!.querySelectorAll('td.summary-column');
    expect(cols[cols.length - 1]?.textContent?.trim()).toBe('100');
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
