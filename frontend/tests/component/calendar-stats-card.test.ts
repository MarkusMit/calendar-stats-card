import { describe, it, expect, vi, afterEach } from 'vitest';
import { CalendarStatsCard } from '../../src/calendar-stats-card';
import type { HomeAssistant } from '../../src/types/ha-types';
import { autoContrastText } from '../../src/services/readable-text';
import type { CardConfig, ThresholdRule } from '../../src/types/card-config';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function makeHass(overrides: Partial<HomeAssistant> = {}): HomeAssistant {
  return {
    config: { version: '2026.5.0', time_zone: 'UTC' },
    states: {},
    connection: {
      sendMessagePromise: vi.fn().mockResolvedValue([]),
    },
    language: 'en',
    ...overrides,
  };
}

const CONFIG: CardConfig = {
  type: 'custom:calendar-stats-card',
  entities: [{ entity: 'sensor.temp' }],
};

async function createCard(config: CardConfig = CONFIG, hass?: HomeAssistant): Promise<CalendarStatsCard> {
  const el = new CalendarStatsCard();
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  el.setConfig(config);
  if (hass) el.hass = hass;
  await el.updateComplete;
  return el;
}

describe('CalendarStatsCard — year/month logic', () => {
  it('defaults to the current year (this_year preset)', async () => {
    const el = await createCard(CONFIG, makeHass());
    const currentYear = new Date().getFullYear();
    expect(el.range.preset).toBe('this_year');
    expect(el.range.start).toEqual({ year: currentYear, month: 1 });
    expect(el.range.end.year).toBe(currentYear);
  });

  it('shows monthly tables from Jan through current month for current year', async () => {
    const el = await createCard(CONFIG, makeHass());
    await vi.waitFor(
      async () => {
        await el.updateComplete;
        const yearTable = el.shadowRoot!.querySelector('calendar-stats-year-table');
        if (!yearTable?.shadowRoot) throw new Error('year-table shadow root not ready');
        await (yearTable as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
        const monthRows = yearTable.shadowRoot.querySelectorAll('tr.month-header-row');
        const currentMonth = new Date().getMonth() + 1;
        expect(monthRows.length).toBeGreaterThanOrEqual(1);
        expect(monthRows.length).toBeLessThanOrEqual(currentMonth);
      },
      { timeout: 3000 },
    );
  });

  it('renders loading overlay while statistics are being fetched', async () => {
    const never = new Promise<unknown>(() => {});
    const el = await createCard(CONFIG, makeHass({
      connection: { sendMessagePromise: vi.fn().mockReturnValue(never) },
    }));
    const overlay = el.shadowRoot!.querySelector('calendar-stats-loading-overlay') as HTMLElement & { visible?: boolean } | null;
    expect(overlay).toBeTruthy();
    expect(overlay?.visible).toBe(true);
  });

  it('no year-table rendered during initial loading', async () => {
    const never = new Promise<unknown>(() => {});
    const el = await createCard(CONFIG, makeHass({
      connection: { sendMessagePromise: vi.fn().mockReturnValue(never) },
    }));
    const tables = el.shadowRoot!.querySelectorAll('calendar-stats-year-table');
    expect(tables.length).toBe(0);
  });
});

// T036: localized display tests
describe('CalendarStatsCard — localized display (T036)', () => {
  async function getFirstTableRoot(card: CalendarStatsCard): Promise<ShadowRoot> {
    let root: ShadowRoot | null = null;
    await vi.waitFor(async () => {
      await card.updateComplete;
      const table = card.shadowRoot!.querySelector('calendar-stats-year-table');
      if (!table) throw new Error('no year-table');
      if (!table.shadowRoot) throw new Error('year-table shadow root not ready');
      await (table as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      root = table.shadowRoot;
    }, { timeout: 3000 });
    return root!;
  }

  it('hass.selectedLanguage=de → summary column header is German', async () => {
    const el = await createCard(CONFIG, makeHass({ selectedLanguage: 'de', language: 'de' }));
    const tableRoot = await getFirstTableRoot(el);
    const summaryHeader = tableRoot.querySelector('th.summary-column');
    expect(summaryHeader?.textContent).toContain('Monat');
  });

  it('hass.language=en → summary column header is English', async () => {
    const el = await createCard(CONFIG, makeHass({ language: 'en' }));
    const tableRoot = await getFirstTableRoot(el);
    const summaryHeader = tableRoot.querySelector('th.summary-column');
    expect(summaryHeader?.textContent).toContain('Summary');
  });

  it('no-entities placeholder uses de text', async () => {
    const config = { type: 'custom:calendar-stats-card', entities: [] };
    const el = await createCard(config, makeHass({ selectedLanguage: 'de', language: 'de' }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      const ph = el.shadowRoot!.querySelector('.no-entities');
      if (!ph) throw new Error('placeholder not found');
      expect(ph.textContent).toContain('Keine');
    }, { timeout: 3000 });
  });

  it('range-navigator prev button has lang-aware aria-label', async () => {
    const el = await createCard(CONFIG, makeHass({ selectedLanguage: 'de', language: 'de' }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      const nav = el.shadowRoot!.querySelector('calendar-stats-range-navigator');
      if (!nav || !nav.shadowRoot) throw new Error('navigator not ready');
      const prevBtn = nav.shadowRoot.querySelector('button.prev');
      expect(prevBtn?.getAttribute('aria-label')).toBe('Vorheriger Zeitraum');
    }, { timeout: 3000 });
  });

  it('range-navigator next button has lang-aware aria-label', async () => {
    const el = await createCard(CONFIG, makeHass({ selectedLanguage: 'de', language: 'de' }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      const nav = el.shadowRoot!.querySelector('calendar-stats-range-navigator');
      if (!nav || !nav.shadowRoot) throw new Error('navigator not ready');
      const nextBtn = nav.shadowRoot.querySelector('button.next');
      expect(nextBtn?.getAttribute('aria-label')).toBe('Nächster Zeitraum');
    }, { timeout: 3000 });
  });
});

// T033: name configuration tests
describe('CalendarStatsCard — name configuration (T033)', () => {
  async function getFirstTableRoot(card: CalendarStatsCard): Promise<ShadowRoot> {
    let root: ShadowRoot | null = null;
    await vi.waitFor(async () => {
      await card.updateComplete;
      const table = card.shadowRoot!.querySelector('calendar-stats-year-table');
      if (!table) throw new Error('no year-table');
      if (!table.shadowRoot) throw new Error('year-table shadow root not ready');
      await (table as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      root = table.shadowRoot;
    }, { timeout: 3000 });
    return root!;
  }

  it('name override → label column shows override text', async () => {
    const config = { type: 'custom:calendar-stats-card', entities: [{ entity: 'sensor.temp', name: 'My Override' }] };
    const hass = makeHass({ states: { 'sensor.temp': {
      entity_id: 'sensor.temp', state: '20',
      attributes: { friendly_name: 'Temperature', unit_of_measurement: '°C', state_class: 'measurement' },
    } } });
    const el = await createCard(config, hass);
    const tableRoot = await getFirstTableRoot(el);
    const labelCell = tableRoot.querySelector('td.label-column');
    expect(labelCell?.textContent).toContain('My Override');
    expect(labelCell?.textContent).not.toContain('Temperature');
  });

  it('no label override → falls back to HA friendly name', async () => {
    const config = { type: 'custom:calendar-stats-card', entities: [{ entity: 'sensor.temp' }] };
    const hass = makeHass({ states: { 'sensor.temp': {
      entity_id: 'sensor.temp', state: '20',
      attributes: { friendly_name: 'Outdoor Temp', unit_of_measurement: '°C', state_class: 'measurement' },
    } } });
    const el = await createCard(config, hass);
    const tableRoot = await getFirstTableRoot(el);
    const labelCell = tableRoot.querySelector('td.label-column');
    expect(labelCell?.textContent).toContain('Outdoor Temp');
  });

  it('unit of measurement appended to label in label column', async () => {
    const config = { type: 'custom:calendar-stats-card', entities: [{ entity: 'sensor.temp' }] };
    const hass = makeHass({ states: { 'sensor.temp': {
      entity_id: 'sensor.temp', state: '20',
      attributes: { friendly_name: 'Temperature', unit_of_measurement: '°C', state_class: 'measurement' },
    } } });
    const el = await createCard(config, hass);
    const tableRoot = await getFirstTableRoot(el);
    const labelCell = tableRoot.querySelector('td.label-column');
    expect(labelCell?.textContent).toContain('°C');
  });

  it('empty entities → no-entities placeholder shown, no year-table', async () => {
    const config = { type: 'custom:calendar-stats-card', entities: [] };
    const el = await createCard(config, makeHass());
    await vi.waitFor(async () => {
      await el.updateComplete;
      const placeholder = el.shadowRoot!.querySelector('.no-entities');
      if (!placeholder) throw new Error('placeholder not found');
    }, { timeout: 3000 });
    const tables = el.shadowRoot!.querySelectorAll('calendar-stats-year-table');
    expect(tables.length).toBe(0);
  });

  it('duplicate entity IDs → both labels rendered in year-table', async () => {
    const config = { type: 'custom:calendar-stats-card', entities: [
      { entity: 'sensor.temp', name: 'Row A' },
      { entity: 'sensor.temp', name: 'Row B' },
    ] };
    const el = await createCard(config, makeHass());
    const tableRoot = await getFirstTableRoot(el);
    const labelCells = tableRoot.querySelectorAll('td.label-column');
    const texts = Array.from(labelCells).map((c) => c.textContent ?? '');
    expect(texts.some((t) => t.includes('Row A'))).toBe(true);
    expect(texts.some((t) => t.includes('Row B'))).toBe(true);
  });
});

// T030: year navigation integration tests
describe('CalendarStatsCard — year navigation (T030)', () => {
  it('renders year-navigator component after fetch', async () => {
    const el = await createCard(CONFIG, makeHass());
    await vi.waitFor(async () => {
      await el.updateComplete;
      const nav = el.shadowRoot!.querySelector('calendar-stats-range-navigator');
      expect(nav).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('right arrow disabled when at current period (atEnd)', async () => {
    const el = await createCard(CONFIG, makeHass());
    await vi.waitFor(async () => {
      await el.updateComplete;
      const nav = el.shadowRoot!.querySelector('calendar-stats-range-navigator') as (HTMLElement & { atEnd: boolean }) | null;
      expect(nav).toBeTruthy();
      expect(nav!.atEnd).toBe(true);
    }, { timeout: 3000 });
  });

  it('prev-year event triggers re-fetch for new year', async () => {
    const currentYear = new Date().getFullYear();
    const earliestStart = Date.UTC(currentYear - 1, 0, 2);
    const sendMsg = vi.fn()
      .mockResolvedValueOnce({ 'sensor.temp': [{ start: earliestStart, end: earliestStart + 1, sum: 1 }] })
      .mockResolvedValue({});
    const el = await createCard(CONFIG, makeHass({ connection: { sendMessagePromise: sendMsg } }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('calendar-stats-range-navigator')).toBeTruthy();
    }, { timeout: 3000 });
    const callsBefore = sendMsg.mock.calls.length;
    const nav = el.shadowRoot!.querySelector('calendar-stats-range-navigator')!;
    nav.dispatchEvent(new CustomEvent('calendar-stats-prev-range', { bubbles: true }));
    await vi.waitFor(async () => {
      expect(sendMsg.mock.calls.length).toBeGreaterThan(callsBefore);
    }, { timeout: 3000 });
  });

  it('fully past year shows 12 month sections', async () => {
    const currentYear = new Date().getFullYear();
    const earliestStart = Date.UTC(currentYear - 1, 0, 2);
    const sendMsg = vi.fn()
      .mockResolvedValueOnce({ 'sensor.temp': [{ start: earliestStart, end: earliestStart + 1, sum: 1 }] })
      .mockResolvedValue({});
    const el = await createCard(CONFIG, makeHass({ connection: { sendMessagePromise: sendMsg } }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('calendar-stats-range-navigator')).toBeTruthy();
    }, { timeout: 3000 });
    const nav = el.shadowRoot!.querySelector('calendar-stats-range-navigator')!;
    nav.dispatchEvent(new CustomEvent('calendar-stats-prev-range', { bubbles: true }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      const yearTable = el.shadowRoot!.querySelector('calendar-stats-year-table');
      if (!yearTable?.shadowRoot) throw new Error('year-table not ready');
      await (yearTable as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      const monthRows = yearTable.shadowRoot.querySelectorAll('tr.month-header-row');
      expect(monthRows.length).toBe(12);
    }, { timeout: 3000 });
  });

  it('earliest year shows only months from earliestDataMonth onward', async () => {
    const currentYear = new Date().getFullYear();
    const earliestStart = Date.UTC(currentYear - 1, 5, 2); // June (month index 5)
    const sendMsg = vi.fn()
      .mockResolvedValueOnce({ 'sensor.temp': [{ start: earliestStart, end: earliestStart + 1, sum: 1 }] })
      .mockResolvedValue({});
    const el = await createCard(CONFIG, makeHass({ connection: { sendMessagePromise: sendMsg } }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('calendar-stats-range-navigator')).toBeTruthy();
    }, { timeout: 3000 });
    const nav = el.shadowRoot!.querySelector('calendar-stats-range-navigator')!;
    nav.dispatchEvent(new CustomEvent('calendar-stats-prev-range', { bubbles: true }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      const yearTable = el.shadowRoot!.querySelector('calendar-stats-year-table');
      if (!yearTable?.shadowRoot) throw new Error('year-table not ready');
      await (yearTable as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      const monthRows = yearTable.shadowRoot.querySelectorAll('tr.month-header-row');
      // June=month 6, months 6–12 = 7 sections
      expect(monthRows.length).toBe(7);
    }, { timeout: 3000 });
  });

  it('left arrow disabled when at earliest year (atStart)', async () => {
    const currentYear = new Date().getFullYear();
    const earliestStart = Date.UTC(currentYear - 1, 0, 2);
    const sendMsg = vi.fn()
      .mockResolvedValueOnce({ 'sensor.temp': [{ start: earliestStart, end: earliestStart + 1, sum: 1 }] })
      .mockResolvedValue({});
    const el = await createCard(CONFIG, makeHass({ connection: { sendMessagePromise: sendMsg } }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('calendar-stats-range-navigator')).toBeTruthy();
    }, { timeout: 3000 });
    const nav = el.shadowRoot!.querySelector('calendar-stats-range-navigator')!;
    nav.dispatchEvent(new CustomEvent('calendar-stats-prev-range', { bubbles: true }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      const nav2 = el.shadowRoot!.querySelector('calendar-stats-range-navigator') as (HTMLElement & { atStart: boolean }) | null;
      expect(nav2!.atStart).toBe(true);
    }, { timeout: 3000 });
  });
});

// Expression rows
describe('CalendarStatsCard — expression rows', () => {
  async function getFirstTableRoot(card: CalendarStatsCard): Promise<ShadowRoot> {
    let root: ShadowRoot | null = null;
    await vi.waitFor(async () => {
      await card.updateComplete;
      const table = card.shadowRoot!.querySelector('calendar-stats-year-table');
      if (!table) throw new Error('no year-table');
      if (!table.shadowRoot) throw new Error('year-table shadow root not ready');
      await (table as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      root = table.shadowRoot;
    }, { timeout: 3000 });
    return root!;
  }

  const year = new Date().getFullYear();
  const dec31prev = Date.UTC(year - 1, 11, 31);
  const jan1 = Date.UTC(year, 0, 1);
  const jan2 = Date.UTC(year, 0, 2);

  function makeExpressionHass(): HomeAssistant {
    return makeHass({
      connection: {
        sendMessagePromise: vi.fn().mockImplementation((msg: Record<string, unknown>) => {
          if (msg['type'] === 'recorder/get_statistics_metadata') return Promise.resolve([]);
          if (msg['period'] === 'day') {
            return Promise.resolve({
              'sensor.a': [
                { start: dec31prev, end: jan1, sum: 0 },
                { start: jan1, end: jan2, sum: 10 },
              ],
              'sensor.b': [
                { start: dec31prev, end: jan1, sum: 0 },
                { start: jan1, end: jan2, sum: 5 },
              ],
            });
          }
          return Promise.resolve({});
        }),
      },
      states: {
        'sensor.a': {
          entity_id: 'sensor.a',
          state: '10',
          attributes: { state_class: 'total_increasing', friendly_name: 'Sensor A' },
        },
        'sensor.b': {
          entity_id: 'sensor.b',
          state: '5',
          attributes: { state_class: 'total_increasing', friendly_name: 'Sensor B' },
        },
      },
    });
  }

  it('expression row shows evaluated sum in Jan 1 daily cell', async () => {
    const config: CardConfig = {
      type: 'custom:calendar-stats-card',
      entities: [{ expression: '{{ sensor.a + sensor.b }}', name: 'Combined', unit: 'kWh' }],
    };
    const el = await createCard(config, makeExpressionHass());
    const tableRoot = await getFirstTableRoot(el);
    const rows = tableRoot.querySelectorAll('tbody tr');
    const exprRow = Array.from(rows).find(
      (row) => row.querySelector('.label-column')?.textContent?.includes('Combined'),
    );
    expect(exprRow).toBeTruthy();
    // Jan 1 delta: sensor.a = 10-0=10, sensor.b = 5-0=5, combined = 15
    const firstDataCell = exprRow?.querySelector('.data-cell.has-data');
    expect(firstDataCell?.textContent?.trim()).toBe('15.0');
  });

  it('expression row total column shows sum of daily values', async () => {
    const config: CardConfig = {
      type: 'custom:calendar-stats-card',
      entities: [{ expression: '{{ sensor.a + sensor.b }}', name: 'Combined', unit: 'kWh' }],
    };
    const el = await createCard(config, makeExpressionHass());
    const tableRoot = await getFirstTableRoot(el);
    // Total column header must appear (requires hasCumulative = true for expression row)
    const totalHeader = Array.from(tableRoot.querySelectorAll('th.summary-column')).find(
      (th) => th.textContent?.includes('Total') || th.textContent?.includes('total'),
    );
    expect(totalHeader).toBeTruthy();
    // Total for Jan: only Jan 1 has data → total = 15
    const rows = tableRoot.querySelectorAll('tbody tr');
    const exprRow = Array.from(rows).find(
      (row) => row.querySelector('.label-column')?.textContent?.includes('Combined'),
    );
    const summaryCells = exprRow?.querySelectorAll('.summary-column');
    const totalCell = summaryCells?.[summaryCells.length - 1];
    expect(totalCell?.textContent?.trim()).toBe('15.0');
  });
});

// T007: predecessor entity IDs included in statistics fetch
describe('CalendarStatsCard — predecessor entity IDs in fetch (T007)', () => {
  it('predecessor entity IDs appear in statistic_ids of statistics fetch call', async () => {
    const sendMessagePromise = vi.fn().mockResolvedValue([]);
    const hass = makeHass({ connection: { sendMessagePromise } });
    const config: CardConfig = {
      type: 'custom:calendar-stats-card',
      entities: [
        {
          entity: 'sensor.main',
          predecessors: [{ entity: 'sensor.old', replaced_on: '2024-01-01' }],
        },
      ],
    };

    await createCard(config, hass);

    // Wait for at least one statistics fetch to happen
    await vi.waitFor(() => {
      expect(sendMessagePromise).toHaveBeenCalled();
    }, { timeout: 3000 });

    const statsCalls = sendMessagePromise.mock.calls.filter(
      (c: unknown[]) => (c[0] as Record<string, unknown>)?.type === 'recorder/statistics_during_period',
    );
    expect(statsCalls.length).toBeGreaterThan(0);

    const allFetchedIds: string[] = statsCalls.flatMap(
      (c: unknown[]) => (c[0] as Record<string, unknown>).statistic_ids as string[],
    );
    expect(allFetchedIds).toContain('sensor.main');
    expect(allFetchedIds).toContain('sensor.old');
  });
});

// Feature 011 T018 — monthly fetch range starts at Dec 1 of the prior year (US2 cross-year delta)
describe('CalendarStatsCard — monthly fetch range (feature 011 T018)', () => {
  it('monthly stats request start_time = `${year-1}-12-01T00:00:00Z`', async () => {
    const sendMessagePromise = vi.fn().mockResolvedValue([]);
    const hass = makeHass({ connection: { sendMessagePromise } });
    const config: CardConfig = {
      type: 'custom:calendar-stats-card',
      entities: [{ entity: 'sensor.energy' }],
    };

    await createCard(config, hass);

    // Exclude the wide earliest-data probe (start_time 2000-01-01) — only the
    // per-year monthly summary fetch is under test here.
    const nonProbeMonthly = () => sendMessagePromise.mock.calls.filter((c: unknown[]) => {
      const msg = c[0] as Record<string, unknown>;
      return msg?.type === 'recorder/statistics_during_period' && msg?.period === 'month'
        && msg?.start_time !== '2000-01-01T00:00:00Z';
    });

    await vi.waitFor(() => {
      expect(nonProbeMonthly().length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    const monthlyCalls = nonProbeMonthly();

    const currentYear = new Date().getFullYear();
    // On Jan 1 the card defaults to previous year (per spec 001 FR-001), so viewing year may be currentYear or currentYear - 1.
    // In either case the monthly fetch's start_time must be Dec 1 of (viewing year − 1).
    const monthlyMsg = monthlyCalls[0]![0] as Record<string, unknown>;
    const startTime = monthlyMsg.start_time as string;
    const expectedThisYear = `${currentYear - 1}-12-01T00:00:00Z`;
    const expectedPrevYear = `${currentYear - 2}-12-01T00:00:00Z`;
    expect([expectedThisYear, expectedPrevYear]).toContain(startTime);
  });
});

// --- Legend (grouped by entity, in floating bar behind toggle button) ---

interface LegendGroupInput { label: string; rules: ThresholdRule[]; }

async function applyThresholdGroups(card: CalendarStatsCard, groups: LegendGroupInput[]): Promise<void> {
  let yearTable: Element | null = null;
  await vi.waitFor(async () => {
    await card.updateComplete;
    yearTable = card.shadowRoot!.querySelector('calendar-stats-year-table');
    if (!yearTable) throw new Error('no year-table');
  }, { timeout: 3000 });
  yearTable!.dispatchEvent(new CustomEvent('thresholds-applied', {
    bubbles: true,
    composed: true,
    detail: { groups },
  }));
  await card.updateComplete;
}

/** Click the legend toggle button (if present) to open the popover. */
async function openLegend(card: CalendarStatsCard): Promise<void> {
  const btn = card.shadowRoot!.querySelector('.legend-toggle') as HTMLElement | null;
  btn?.click();
  await card.updateComplete;
}

/** Convenience: single-entity group. */
function group(label: string, ...rules: ThresholdRule[]): LegendGroupInput {
  return { label, rules };
}

describe('CalendarStatsCard — threshold legend (grouped, floating bar)', () => {
  it('no triggered thresholds → no legend button', async () => {
    const card = await createCard(CONFIG, makeHass());
    await applyThresholdGroups(card, []);
    expect(card.shadowRoot!.querySelector('.legend-toggle')).toBeNull();
  });

  it('only unnamed triggered threshold → no legend button', async () => {
    const card = await createCard(CONFIG, makeHass());
    await applyThresholdGroups(card, [group('sensor.temp', { operator: 'above', value: 10, background_color: 'red' })]);
    expect(card.shadowRoot!.querySelector('.legend-toggle')).toBeNull();
  });

  it('named triggered threshold → button shown; popover lists name after open', async () => {
    const card = await createCard(CONFIG, makeHass());
    await applyThresholdGroups(card, [group('Temperature [°C]', { operator: 'above', value: 25, background_color: 'orange', name: 'Summer day' })]);
    const btn = card.shadowRoot!.querySelector('.legend-toggle');
    expect(btn).not.toBeNull();
    // Popover closed initially
    expect(card.shadowRoot!.querySelector('.legend-popover')).toBeNull();
    await openLegend(card);
    const popover = card.shadowRoot!.querySelector('.legend-popover');
    expect(popover).not.toBeNull();
    expect(popover!.textContent).toContain('Summer day');
  });

  it('popover group label shows entity label', async () => {
    const card = await createCard(CONFIG, makeHass());
    await applyThresholdGroups(card, [group('Temperature [°C]', { operator: 'above', value: 25, background_color: 'orange', name: 'Summer day' })]);
    await openLegend(card);
    const groupLabel = card.shadowRoot!.querySelector('.legend-group-label');
    expect(groupLabel?.textContent).toContain('Temperature [°C]');
  });

  it('legend entry swatch has background_color style', async () => {
    const card = await createCard(CONFIG, makeHass());
    await applyThresholdGroups(card, [group('Temperature [°C]', { operator: 'above', value: 25, background_color: 'orange', name: 'Summer day' })]);
    await openLegend(card);
    const swatch = card.shadowRoot!.querySelector('.legend-swatch') as HTMLElement | null;
    expect(swatch).not.toBeNull();
    expect(swatch!.style.backgroundColor).toBeTruthy();
  });

  it('legend entry swatch shows sample letter in text_color', async () => {
    const card = await createCard(CONFIG, makeHass());
    await applyThresholdGroups(card, [group('Temperature [°C]', { operator: 'above', value: 25, background_color: 'orange', text_color: 'blue', name: 'Summer day' })]);
    await openLegend(card);
    const swatch = card.shadowRoot!.querySelector('.legend-swatch') as HTMLElement | null;
    expect(swatch!.textContent!.trim()).toBe('A');
    expect(swatch!.style.color).toBe('blue');
    expect(swatch!.getAttribute('aria-hidden')).toBe('true');
  });

  it('background_color without text_color → swatch letter uses auto-contrast, same as a cell', async () => {
    const card = await createCard(CONFIG, makeHass());
    await applyThresholdGroups(card, [group('Temperature [°C]', { operator: 'above', value: 25, background_color: 'darkred', name: 'Heat day' })]);
    await openLegend(card);
    const swatch = card.shadowRoot!.querySelector('.legend-swatch') as HTMLElement | null;
    expect(swatch!.textContent!.trim()).toBe('A');
    // Must match what buildCellStyle produces for the same rule on a data cell.
    const probe = document.createElement('span');
    const expected = autoContrastText('darkred', probe)!;
    expect(swatch!.style.color).toBe(expected);
  });

  it('text_color only → swatch letter in that color, no background, name plain', async () => {
    const card = await createCard(CONFIG, makeHass());
    await applyThresholdGroups(card, [group('Temperature [°C]', { operator: 'above', value: 25, text_color: 'blue', name: 'Mild day' })]);
    await openLegend(card);
    const swatch = card.shadowRoot!.querySelector('.legend-swatch') as HTMLElement | null;
    expect(swatch).not.toBeNull();
    expect(swatch!.textContent!.trim()).toBe('A');
    expect(swatch!.style.color).toBe('blue');
    expect(swatch!.style.backgroundColor).toBe('');
    const name = card.shadowRoot!.querySelector('.legend-name') as HTMLElement | null;
    expect(name!.textContent!.trim()).toBe('Mild day');
    expect(name!.style.color).toBe('');
  });

  it('rule with neither color → entry rendered without swatch or inline color', async () => {
    const card = await createCard(CONFIG, makeHass());
    await applyThresholdGroups(card, [group('Temperature [°C]', { operator: 'above', value: 25, name: 'Plain day' })]);
    await openLegend(card);
    expect(card.shadowRoot!.querySelector('.legend-swatch')).toBeNull();
    const name = card.shadowRoot!.querySelector('.legend-name') as HTMLElement | null;
    expect(name!.textContent!.trim()).toBe('Plain day');
    expect(name!.style.color).toBe('');
  });

  it('multiple named rules in one entity → one entry each, one group', async () => {
    const card = await createCard(CONFIG, makeHass());
    await applyThresholdGroups(card, [group('Temperature [°C]',
      { operator: 'above', value: 25, background_color: 'orange', name: 'Summer day' },
      { operator: 'above', value: 30, background_color: 'red', name: 'Heat day' },
    )]);
    await openLegend(card);
    expect(card.shadowRoot!.querySelectorAll('.legend-group').length).toBe(1);
    expect(card.shadowRoot!.querySelectorAll('.legend-entry').length).toBe(2);
  });

  it('duplicate names within an entity → deduplicated, first-seen wins', async () => {
    const card = await createCard(CONFIG, makeHass());
    await applyThresholdGroups(card, [group('Temperature [°C]',
      { operator: 'above', value: 25, background_color: 'orange', name: 'Warm' },
      { operator: 'above', value: 30, background_color: 'red', name: 'Warm' },
    )]);
    await openLegend(card);
    const entries = card.shadowRoot!.querySelectorAll('.legend-entry');
    expect(entries.length).toBe(1);
    const swatch = entries[0]!.querySelector('.legend-swatch') as HTMLElement | null;
    expect(swatch!.getAttribute('style')).toContain('orange');
  });

  it('same rule name across two entities → two groups, two entries (not cross-deduped)', async () => {
    const card = await createCard(CONFIG, makeHass());
    await applyThresholdGroups(card, [
      group('Temperature [°C]', { operator: 'above', value: 25, background_color: 'orange', name: 'High' }),
      group('Humidity [%]', { operator: 'above', value: 80, background_color: 'blue', name: 'High' }),
    ]);
    await openLegend(card);
    const groups = card.shadowRoot!.querySelectorAll('.legend-group');
    expect(groups.length).toBe(2);
    expect(card.shadowRoot!.querySelectorAll('.legend-entry').length).toBe(2);
    const labels = Array.from(card.shadowRoot!.querySelectorAll('.legend-group-label')).map((n) => n.textContent ?? '');
    // Config order preserved
    expect(labels[0]).toContain('Temperature');
    expect(labels[1]).toContain('Humidity');
  });

  it('legend title uses i18n — en: "Legend"', async () => {
    const card = await createCard(CONFIG, makeHass({ language: 'en' }));
    await applyThresholdGroups(card, [group('Temperature [°C]', { operator: 'above', value: 10, background_color: 'blue', name: 'Cool' })]);
    await openLegend(card);
    const title = card.shadowRoot!.querySelector('.legend-title');
    expect(title?.textContent?.trim()).toBe('Legend');
  });

  it('legend title uses i18n — de: "Legende"', async () => {
    const card = await createCard(CONFIG, makeHass({ language: 'de' }));
    await applyThresholdGroups(card, [group('Temperatur [°C]', { operator: 'above', value: 10, background_color: 'blue', name: 'Kühl' })]);
    await openLegend(card);
    const title = card.shadowRoot!.querySelector('.legend-title');
    expect(title?.textContent?.trim()).toBe('Legende');
  });

  it('button disappears after re-trigger with no named rules', async () => {
    const card = await createCard(CONFIG, makeHass());
    await applyThresholdGroups(card, [group('Temperature [°C]', { operator: 'above', value: 10, background_color: 'blue', name: 'Cool' })]);
    expect(card.shadowRoot!.querySelector('.legend-toggle')).not.toBeNull();
    await applyThresholdGroups(card, []);
    expect(card.shadowRoot!.querySelector('.legend-toggle')).toBeNull();
    expect(card.shadowRoot!.querySelector('.legend-popover')).toBeNull();
  });

  it('mixed named + unnamed in one entity → only named shown', async () => {
    const card = await createCard(CONFIG, makeHass());
    await applyThresholdGroups(card, [group('Temperature [°C]',
      { operator: 'above', value: 10, background_color: 'blue' },
      { operator: 'above', value: 25, background_color: 'orange', name: 'Summer day' },
    )]);
    await openLegend(card);
    const entries = card.shadowRoot!.querySelectorAll('.legend-entry');
    expect(entries.length).toBe(1);
    expect(card.shadowRoot!.querySelector('.legend-popover')!.textContent).toContain('Summer day');
  });

  it('toggle button opens then closes popover', async () => {
    const card = await createCard(CONFIG, makeHass());
    await applyThresholdGroups(card, [group('Temperature [°C]', { operator: 'above', value: 25, background_color: 'orange', name: 'Summer day' })]);
    await openLegend(card);
    expect(card.shadowRoot!.querySelector('.legend-popover')).not.toBeNull();
    await openLegend(card); // second click closes
    expect(card.shadowRoot!.querySelector('.legend-popover')).toBeNull();
  });

  it('click outside closes the popover', async () => {
    const card = await createCard(CONFIG, makeHass());
    await applyThresholdGroups(card, [group('Temperature [°C]', { operator: 'above', value: 25, background_color: 'orange', name: 'Summer day' })]);
    await openLegend(card);
    expect(card.shadowRoot!.querySelector('.legend-popover')).not.toBeNull();
    document.body.click();
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('.legend-popover')).toBeNull();
  });
});

// --- Floating bottom bar (008) ---

describe('CalendarStatsCard — floating bottom bar', () => {
  // T002
  it('renders .bottom-bar element in shadow DOM', async () => {
    const card = await createCard(CONFIG, makeHass());
    await vi.waitFor(async () => {
      await card.updateComplete;
      expect(card.shadowRoot!.querySelector('.bottom-bar')).not.toBeNull();
    }, { timeout: 3000 });
  });

  // T003
  it('year-navigator is a descendant of .bottom-bar', async () => {
    const card = await createCard(CONFIG, makeHass());
    await vi.waitFor(async () => {
      await card.updateComplete;
      expect(card.shadowRoot!.querySelector('.bottom-bar calendar-stats-range-navigator')).not.toBeNull();
    }, { timeout: 3000 });
  });

  // T004
  it('all year-navigator elements are inside .bottom-bar', async () => {
    const card = await createCard(CONFIG, makeHass());
    await vi.waitFor(async () => {
      await card.updateComplete;
      const bar = card.shadowRoot!.querySelector('.bottom-bar');
      expect(bar).not.toBeNull();
      const navs = Array.from(card.shadowRoot!.querySelectorAll('calendar-stats-range-navigator'));
      expect(navs.length).toBeGreaterThan(0);
      navs.forEach(nav => expect(bar!.contains(nav)).toBe(true));
    }, { timeout: 3000 });
  });

  // T005
  it('year-table is a descendant of .card-content', async () => {
    const card = await createCard(CONFIG, makeHass());
    await vi.waitFor(async () => {
      await card.updateComplete;
      expect(card.shadowRoot!.querySelector('.card-content calendar-stats-year-table')).not.toBeNull();
    }, { timeout: 3000 });
  });

  // T006
  it('prev-range event from .bottom-bar navigator steps the range back a year', async () => {
    const currentYear = new Date().getFullYear();
    const earliestStart = Date.UTC(currentYear - 1, 0, 2);
    const sendMsg = vi.fn()
      .mockResolvedValueOnce({ 'sensor.temp': [{ start: earliestStart, end: earliestStart + 1, sum: 1 }] })
      .mockResolvedValue({});
    const card = await createCard(CONFIG, makeHass({ connection: { sendMessagePromise: sendMsg } }));
    await vi.waitFor(async () => {
      await card.updateComplete;
      expect(card.shadowRoot!.querySelector('.bottom-bar calendar-stats-range-navigator')).not.toBeNull();
    }, { timeout: 3000 });
    const nav = card.shadowRoot!.querySelector('.bottom-bar calendar-stats-range-navigator')!;
    nav.dispatchEvent(new CustomEvent('calendar-stats-prev-range', { bubbles: true }));
    await vi.waitFor(async () => {
      await card.updateComplete;
      expect(card.range.start.year).toBe(currentYear - 1);
      expect(card.range.preset).toBe('this_year');
    }, { timeout: 3000 });
  });

  // T007: FR-007 — .bottom-bar CSS includes HA design tokens
  it('.bottom-bar CSS uses fixed positioning and HA design tokens (FR-007)', () => {
    const cssText = String(CalendarStatsCard.styles);
    expect(cssText).toContain('.bottom-bar');
    expect(cssText).toContain('position: fixed');
    expect(cssText).toContain('--ha-card-background');
  });

  // Legend popover lives in .bottom-bar, not .card-content
  it('opened legend popover is inside .bottom-bar, not .card-content', async () => {
    const card = await createCard(CONFIG, makeHass());
    await applyThresholdGroups(card, [group('Temperature [°C]', { operator: 'above', value: 10, background_color: 'orange', name: 'Warm' })]);
    await openLegend(card);
    const bar = card.shadowRoot!.querySelector('.bottom-bar');
    expect(bar).not.toBeNull();
    expect(bar!.querySelector('.legend-popover')).not.toBeNull();
    const content = card.shadowRoot!.querySelector('.card-content');
    expect(content).not.toBeNull();
    expect(content!.querySelector('.legend-popover')).toBeNull();
  });

  // .card-content holds the year-table, never the legend
  it('.card-content contains year-table but not the legend', async () => {
    const card = await createCard(CONFIG, makeHass());
    await applyThresholdGroups(card, [group('Temperature [°C]', { operator: 'above', value: 10, background_color: 'orange', name: 'Warm' })]);
    await openLegend(card);
    const content = card.shadowRoot!.querySelector('.card-content');
    expect(content).not.toBeNull();
    expect(content!.querySelector('calendar-stats-year-table')).not.toBeNull();
    expect(content!.querySelector('.legend-popover')).toBeNull();
    expect(content!.querySelector('.legend-toggle')).toBeNull();
  });
});

// T002: HA editor protocol
describe('CalendarStatsCard — editor protocol (T002)', () => {
  it('getConfigElement returns element with tag calendar-stats-card-editor', () => {
    const el = CalendarStatsCard.getConfigElement();
    expect(el.tagName.toLowerCase()).toBe('calendar-stats-card-editor');
  });

  it('getStubConfig returns valid CardConfig with empty entities', () => {
    const stub = CalendarStatsCard.getStubConfig();
    expect(stub.type).toBe('custom:calendar-stats-card');
    expect(Array.isArray(stub.entities)).toBe(true);
    expect(stub.entities).toHaveLength(0);
  });
});

describe('CalendarStatsCard — current month hidden on the first of the month', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function freezeAt(iso: string): void {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(iso));
  }

  it('January 1st → no month table, localized hint instead', async () => {
    freezeAt('2026-01-01T12:00:00Z');
    const el = await createCard(CONFIG, makeHass());
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('calendar-stats-year-table')).toBeNull();
      const hint = el.shadowRoot!.querySelector('p.no-entities');
      expect(hint?.textContent).toBe('No completed days in this period yet.');
    }, { timeout: 3000 });
  });

  it('January 2nd → month table back, no hint', async () => {
    freezeAt('2026-01-02T12:00:00Z');
    const el = await createCard(CONFIG, makeHass());
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('calendar-stats-year-table')).toBeTruthy();
      expect(el.shadowRoot!.querySelector('p.no-entities')).toBeNull();
    }, { timeout: 3000 });
  });

  it('hint is localized to German', async () => {
    freezeAt('2026-01-01T12:00:00Z');
    const el = await createCard(CONFIG, makeHass({ language: 'de' }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      const hint = el.shadowRoot!.querySelector('p.no-entities');
      expect(hint?.textContent).toBe('Für diesen Zeitraum liegen noch keine abgeschlossenen Tage vor.');
    }, { timeout: 3000 });
  });
});

// --- Threshold exceedance table (spec 016) ---

describe('CalendarStatsCard — exceedance table', () => {
  const withThreshold: CardConfig = {
    type: 'custom:calendar-stats-card',
    entities: [{
      entity: 'sensor.temp',
      name: 'Temperature',
      thresholds: [{ operator: 'equals-above', value: 25, name: 'Summer day', background_color: 'orange' }],
    }],
  };

  it('renders in the monthly view when a rule qualifies', async () => {
    const card = await createCard(withThreshold, makeHass());
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('calendar-stats-exceedance-table')).not.toBeNull();
  });

  it('renders after the data tables, inside the card content', async () => {
    const card = await createCard(withThreshold, makeHass());
    await card.updateComplete;
    const content = card.shadowRoot!.querySelector('.card-content')!;
    const table = content.querySelector('calendar-stats-exceedance-table');
    expect(table).not.toBeNull();
    const lastTable = [...content.querySelectorAll('calendar-stats-year-table, calendar-stats-year-summary-table')].pop();
    if (lastTable) {
      expect(lastTable.compareDocumentPosition(table!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    }
  });

  it('is absent when no rule qualifies', async () => {
    const card = await createCard(CONFIG, makeHass());
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('calendar-stats-exceedance-table')).toBeNull();
  });

  it('is absent when the only rule is unnamed', async () => {
    const unnamed: CardConfig = {
      type: 'custom:calendar-stats-card',
      entities: [{
        entity: 'sensor.temp',
        thresholds: [{ operator: 'equals-above', value: 25, background_color: 'orange' }],
      }],
    };
    const card = await createCard(unnamed, makeHass());
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('calendar-stats-exceedance-table')).toBeNull();
  });
});

describe('CalendarStatsCard — exceedance table across views', () => {
  const withThreshold: CardConfig = {
    type: 'custom:calendar-stats-card',
    entities: [{
      entity: 'sensor.temp',
      name: 'Temperature',
      thresholds: [{ operator: 'equals-above', value: 25, name: 'Summer day', background_color: 'orange' }],
    }],
  };

  function counts(card: CalendarStatsCard): Array<[string, number, number]> {
    const el = card.shadowRoot!.querySelector('calendar-stats-exceedance-table') as
      (HTMLElement & { groups: Array<{ label: string; rows: Array<{ band: number; cumulative: number }> }> }) | null;
    if (!el) return [];
    return el.groups.flatMap((g) => g.rows.map((r) => [g.label, r.band, r.cumulative] as [string, number, number]));
  }

  it('renders in the yearly view', async () => {
    const card = await createCard(withThreshold, makeHass());
    card.viewMode = 'yearly';
    await vi.waitFor(async () => {
      await card.updateComplete;
      if (!card.shadowRoot!.querySelector('calendar-stats-year-summary-table')) throw new Error('not yearly yet');
    }, { timeout: 3000 });
    expect(card.shadowRoot!.querySelector('calendar-stats-exceedance-table')).not.toBeNull();
  });

  it('is absent while the month comparison is open', async () => {
    const card = await createCard(withThreshold, makeHass());
    card.viewMode = 'yearly';
    await vi.waitFor(async () => {
      await card.updateComplete;
      if (!card.shadowRoot!.querySelector('calendar-stats-year-summary-table')) throw new Error('not yearly yet');
    }, { timeout: 3000 });
    card.shadowRoot!.querySelector('calendar-stats-year-summary-table')!.dispatchEvent(
      new CustomEvent('calendar-stats-month-select', { detail: { month: 3 }, bubbles: true, composed: true }),
    );
    await vi.waitFor(async () => {
      await card.updateComplete;
      if (!card.shadowRoot!.querySelector('button.comparison-back')) throw new Error('no comparison');
    }, { timeout: 3000 });
    expect(card.shadowRoot!.querySelector('calendar-stats-exceedance-table')).toBeNull();
  });

  it('reports the same counts in the monthly and the yearly view', async () => {
    const card = await createCard(withThreshold, makeHass());
    await card.updateComplete;
    const monthly = counts(card);
    card.viewMode = 'yearly';
    await vi.waitFor(async () => {
      await card.updateComplete;
      if (!card.shadowRoot!.querySelector('calendar-stats-year-summary-table')) throw new Error('not yearly yet');
    }, { timeout: 3000 });
    expect(counts(card)).toEqual(monthly);
    expect(monthly.length).toBeGreaterThan(0);
  });
});

describe('CalendarStatsCard — exceedance per-year columns', () => {
  const withThreshold: CardConfig = {
    type: 'custom:calendar-stats-card',
    entities: [{
      entity: 'sensor.temp',
      name: 'Temperature',
      thresholds: [{ operator: 'equals-above', value: 25, name: 'Summer day', background_color: 'orange' }],
    }],
  };

  function table(card: CalendarStatsCard): (HTMLElement & { years: number[] }) | null {
    return card.shadowRoot!.querySelector('calendar-stats-exceedance-table') as
      (HTMLElement & { years: number[] }) | null;
  }

  async function toYearly(card: CalendarStatsCard): Promise<void> {
    card.viewMode = 'yearly';
    await vi.waitFor(async () => {
      await card.updateComplete;
      if (!card.shadowRoot!.querySelector('calendar-stats-year-summary-table')) throw new Error('not yearly yet');
    }, { timeout: 3000 });
  }

  it('passes the displayed years in the yearly view', async () => {
    const card = await createCard(withThreshold, makeHass());
    await toYearly(card);
    const el = table(card)!;
    expect(el.years.length).toBeGreaterThan(0);
    expect(el.years).toEqual([...el.years].sort((a, b) => a - b));
  });

  it('passes no years in the monthly view', async () => {
    const card = await createCard(withThreshold, makeHass());
    await card.updateComplete;
    expect(table(card)!.years).toEqual([]);
  });

  it('the years match the rows own per-year entries', async () => {
    const card = await createCard(withThreshold, makeHass());
    await toYearly(card);
    const el = table(card) as unknown as { years: number[]; groups: Array<{ rows: Array<{ byYear: Array<{ year: number }> }> }> };
    const rowYears = el.groups[0]!.rows[0]!.byYear.map((y) => y.year);
    expect(el.years).toEqual(rowYears);
  });
});

describe('CalendarStatsCard — exceedance table visibility option', () => {
  const base = {
    entity: 'sensor.temp',
    name: 'Temperature',
    thresholds: [{ operator: 'equals-above' as const, value: 25, name: 'Summer day', background_color: 'orange' }],
  };

  it('renders the table when show_threshold_table is omitted', async () => {
    const card = await createCard({ type: 'custom:calendar-stats-card', entities: [base] }, makeHass());
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('calendar-stats-exceedance-table')).not.toBeNull();
  });

  it('renders the table when show_threshold_table is true', async () => {
    const card = await createCard({ type: 'custom:calendar-stats-card', entities: [base], show_threshold_table: true } as CardConfig, makeHass());
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('calendar-stats-exceedance-table')).not.toBeNull();
  });

  it('hides the table when show_threshold_table is false', async () => {
    const card = await createCard({ type: 'custom:calendar-stats-card', entities: [base], show_threshold_table: false } as CardConfig, makeHass());
    await card.updateComplete;
    expect(card.shadowRoot!.querySelector('calendar-stats-exceedance-table')).toBeNull();
  });
});
