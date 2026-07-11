import { describe, it, expect, vi, afterEach } from 'vitest';
import { CalendarStatsCard } from '../../src/calendar-stats-card';
import type { HomeAssistant } from '../../src/types/ha-types';
import type { CardConfig } from '../../src/types/card-config';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function makeHass(overrides: Partial<HomeAssistant> = {}): HomeAssistant {
  return {
    config: { version: '2026.5.0', time_zone: 'UTC' },
    states: {},
    connection: {
      sendMessagePromise: vi.fn().mockResolvedValue({}),
    },
    language: 'en',
    ...overrides,
  };
}

const CONFIG: CardConfig = {
  type: 'custom:calendar-stats-card',
  entities: [{ entity: 'sensor.temp' }],
};

async function createCard(hass: HomeAssistant): Promise<CalendarStatsCard> {
  const el = new CalendarStatsCard();
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  el.setConfig(CONFIG);
  el.hass = hass;
  await el.updateComplete;
  return el;
}

/** Card in yearly view with the initial fetch settled. */
async function createYearlyCard(hass: HomeAssistant = makeHass()): Promise<CalendarStatsCard> {
  const el = await createCard(hass);
  el.viewMode = 'yearly';
  await vi.waitFor(async () => {
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('calendar-stats-year-summary-table')).toBeTruthy();
  }, { timeout: 3000 });
  return el;
}

function openComparison(el: CalendarStatsCard, month: number): void {
  const table = el.shadowRoot!.querySelector('calendar-stats-year-summary-table')!;
  table.dispatchEvent(new CustomEvent('calendar-stats-month-select', {
    detail: { month }, bubbles: true, composed: true,
  }));
}

async function waitForComparison(el: CalendarStatsCard): Promise<void> {
  await vi.waitFor(async () => {
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('button.comparison-back')).toBeTruthy();
  }, { timeout: 3000 });
}

function monthLong(month: number): string {
  return new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2020, month - 1, 1));
}

describe('CalendarStatsCard — month comparison wiring (spec 014 US1)', () => {
  it('a month-select event in the yearly view opens the comparison view (FR-001)', async () => {
    const el = await createYearlyCard();
    openComparison(el, 3);
    await waitForComparison(el);
    expect(el.shadowRoot!.querySelector('calendar-stats-year-summary-table')).toBeNull();
    expect(el.shadowRoot!.querySelector('.comparison-month')?.textContent).toContain(monthLong(3));
  });

  it('with no data in any compared year the comparison shows the empty state (FR-017)', async () => {
    const el = await createYearlyCard();
    openComparison(el, 3);
    await waitForComparison(el);
    expect(el.shadowRoot!.querySelector('.comparison-empty')?.textContent)
      .toContain('No data for this month in any compared year');
    expect(el.shadowRoot!.querySelector('calendar-stats-month-comparison-table')).toBeNull();
  });

  it('next/previous step the compared month with Dec↔Jan wrap (FR-017)', async () => {
    const el = await createYearlyCard();
    openComparison(el, 12);
    await waitForComparison(el);
    el.shadowRoot!.querySelector<HTMLButtonElement>('button.comparison-next')!.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.comparison-month')?.textContent).toContain(monthLong(1));
    el.shadowRoot!.querySelector<HTMLButtonElement>('button.comparison-prev')!.click();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.comparison-month')?.textContent).toContain(monthLong(12));
  });

  it('twelve next clicks cycle through all months back to the start (SC-008)', async () => {
    const el = await createYearlyCard();
    openComparison(el, 7);
    await waitForComparison(el);
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) {
      seen.add(el.shadowRoot!.querySelector('.comparison-month')!.textContent!.trim());
      el.shadowRoot!.querySelector<HTMLButtonElement>('button.comparison-next')!.click();
      await el.updateComplete;
    }
    expect(seen.size).toBe(12);
    expect(el.shadowRoot!.querySelector('.comparison-month')?.textContent).toContain(monthLong(7));
  });

  it('hides the range navigator and view-mode toggle while the comparison is open (research D3)', async () => {
    const el = await createYearlyCard();
    expect(el.shadowRoot!.querySelector('calendar-stats-range-navigator')).toBeTruthy();
    openComparison(el, 3);
    await waitForComparison(el);
    expect(el.shadowRoot!.querySelector('calendar-stats-range-navigator')).toBeNull();
    expect(el.shadowRoot!.querySelector('calendar-stats-view-mode-toggle')).toBeNull();
  });

  it('back, month prev/next controls all live in the bottom bar (user revision 3)', async () => {
    const el = await createYearlyCard();
    openComparison(el, 3);
    await waitForComparison(el);
    expect(el.shadowRoot!.querySelector('.bottom-bar button.comparison-back')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('.bottom-bar button.comparison-prev')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('.bottom-bar .comparison-month')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('.bottom-bar button.comparison-next')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('.comparison-bar')).toBeNull();
  });

  it('switching the view mode closes the comparison (research D3)', async () => {
    const el = await createYearlyCard();
    openComparison(el, 3);
    await waitForComparison(el);
    el.viewMode = 'monthly';
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('button.comparison-back')).toBeNull();
    el.viewMode = 'yearly';
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('calendar-stats-year-summary-table')).toBeTruthy();
    }, { timeout: 3000 });
    expect(el.shadowRoot!.querySelector('button.comparison-back')).toBeNull();
  });

  it('opening and navigating the comparison issues no websocket calls (research D10)', async () => {
    const hass = makeHass();
    const el = await createYearlyCard(hass);
    const sendMsg = hass.connection.sendMessagePromise as ReturnType<typeof vi.fn>;
    const callsBefore = sendMsg.mock.calls.length;
    openComparison(el, 3);
    await waitForComparison(el);
    el.shadowRoot!.querySelector<HTMLButtonElement>('button.comparison-next')!.click();
    await el.updateComplete;
    el.shadowRoot!.querySelector<HTMLButtonElement>('button.comparison-prev')!.click();
    await el.updateComplete;
    expect(sendMsg.mock.calls.length).toBe(callsBefore);
  });
});

const PREV_YEAR = new Date().getFullYear() - 1;
const CURRENT_YEAR = new Date().getFullYear();

/** hass whose recorder returns June data for the previous year only. */
function makeDataHass(): HomeAssistant {
  const monthly = {
    'sensor.rain': [{ start: Date.UTC(PREV_YEAR, 5, 1), end: Date.UTC(PREV_YEAR, 6, 1), sum: 8 }],
  };
  const daily = {
    'sensor.rain': [
      { start: Date.UTC(PREV_YEAR, 5, 10), end: Date.UTC(PREV_YEAR, 5, 11), sum: 5 },
      { start: Date.UTC(PREV_YEAR, 5, 11), end: Date.UTC(PREV_YEAR, 5, 12), sum: 8 },
    ],
  };
  return makeHass({
    states: {
      'sensor.rain': {
        state: '8',
        attributes: { state_class: 'total_increasing', unit_of_measurement: 'mm', friendly_name: 'Rain' },
      },
    } as unknown as HomeAssistant['states'],
    connection: {
      sendMessagePromise: vi.fn().mockImplementation((msg: { period?: string }) =>
        Promise.resolve(msg.period === 'month' ? monthly : daily)),
    },
  });
}

/** Yearly card spanning [PREV_YEAR, CURRENT_YEAR] with June data in PREV_YEAR. */
async function createTwoYearCard(): Promise<CalendarStatsCard> {
  const el = new CalendarStatsCard();
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  el.setConfig({ type: 'custom:calendar-stats-card', entities: [{ entity: 'sensor.rain' }] });
  el.hass = makeDataHass();
  await vi.waitFor(async () => {
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('calendar-stats-range-navigator')).toBeTruthy();
  }, { timeout: 3000 });
  const nav = el.shadowRoot!.querySelector('calendar-stats-range-navigator')!;
  nav.dispatchEvent(new CustomEvent('calendar-stats-range-select', {
    detail: { start: { year: PREV_YEAR, month: 1 }, end: { year: CURRENT_YEAR, month: 1 } },
    bubbles: true, composed: true,
  }));
  await el.updateComplete;
  el.viewMode = 'yearly';
  await vi.waitFor(async () => {
    await el.updateComplete;
    const table = el.shadowRoot!.querySelector('calendar-stats-year-summary-table') as (HTMLElement & { segments: { year: number }[] }) | null;
    expect(table).toBeTruthy();
    expect(table!.segments.map((s) => s.year)).toEqual([PREV_YEAR, CURRENT_YEAR]);
  }, { timeout: 3000 });
  return el;
}

type SegmentedYearTable = HTMLElement & {
  monthSegments: Array<{ year: number; month: number }> | null;
  updateComplete: Promise<boolean>;
  shadowRoot: ShadowRoot;
};

describe('CalendarStatsCard — comparison daily section (spec 014 US2, single-table revision)', () => {
  it('renders the daily values as ONE table with a section per data-bearing year (FR-009)', async () => {
    const el = await createTwoYearCard();
    openComparison(el, 6);
    await waitForComparison(el);
    expect(el.shadowRoot!.querySelector('calendar-stats-month-comparison-table')).toBeTruthy();
    const daily = el.shadowRoot!.querySelector('.comparison-daily');
    expect(daily).toBeTruthy();
    const tables = [...daily!.querySelectorAll('calendar-stats-year-table')] as SegmentedYearTable[];
    expect(tables.length).toBe(1);
    expect(tables[0]!.monthSegments!.map((s) => [s.year, s.month])).toEqual([[PREV_YEAR, 6]]);
  });

  it('each section header names the month AND its year (user revision)', async () => {
    const el = await createTwoYearCard();
    openComparison(el, 6);
    await waitForComparison(el);
    const table = el.shadowRoot!.querySelector('.comparison-daily calendar-stats-year-table') as SegmentedYearTable;
    await table.updateComplete;
    const headers = [...table.shadowRoot.querySelectorAll('th.month-name')];
    expect(headers.length).toBe(1); // data-less years get no section
    expect(headers[0]!.textContent).toContain('June');
    expect(headers[0]!.textContent).toContain(String(PREV_YEAR));
  });

  it('no per-year labels or empty notes remain outside the table (user revision)', async () => {
    const el = await createTwoYearCard();
    openComparison(el, 6);
    await waitForComparison(el);
    expect(el.shadowRoot!.querySelector('.comparison-year-label')).toBeNull();
    expect(el.shadowRoot!.querySelector('.comparison-year-empty')).toBeNull();
  });
});

describe('CalendarStatsCard — comparison back control (spec 014 US3)', () => {
  it('back returns to the yearly view with range and entities unchanged (FR-012/SC-007)', async () => {
    const el = await createTwoYearCard();
    const rangeBefore = el.range;
    openComparison(el, 6);
    await waitForComparison(el);
    const back = el.shadowRoot!.querySelector<HTMLButtonElement>('button.comparison-back')!;
    expect(back.textContent).toContain('Back');
    back.click();
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('button.comparison-back')).toBeNull();
      expect(el.shadowRoot!.querySelector('calendar-stats-year-summary-table')).toBeTruthy();
    }, { timeout: 3000 });
    expect(el.range).toEqual(rangeBefore);
    expect(el.viewMode).toBe('yearly');
  });

  it('a hass update while open keeps the comparison visible (US3 scenario 2)', async () => {
    const el = await createTwoYearCard();
    openComparison(el, 6);
    await waitForComparison(el);
    el.hass = makeDataHass();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('button.comparison-back')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('calendar-stats-month-comparison-table')).toBeTruthy();
  });
});

