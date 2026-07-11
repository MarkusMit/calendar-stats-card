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

function hassWithEarliest(yearsBack: number) {
  const currentYear = new Date().getFullYear();
  const earliestStart = Date.UTC(currentYear - yearsBack, 0, 2);
  const sendMsg = vi.fn()
    // first call is the earliest-data probe (monthly statistics_during_period)
    .mockResolvedValueOnce({ 'sensor.temp': [{ start: earliestStart, end: earliestStart + 1, sum: 1 }] })
    .mockResolvedValue({});
  return makeHass({ connection: { sendMessagePromise: sendMsg } });
}

describe('CalendarStatsCard — view switching (T019, FR-011/FR-016)', () => {
  it('renders the view-mode-toggle in the bottom bar', async () => {
    const el = await createCard(makeHass());
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.bottom-bar calendar-stats-view-mode-toggle')).toBeTruthy();
    }, { timeout: 3000 });
  });

  it('toggle event switches to yearly, snaps range to full years, renders yearly table', async () => {
    const el = await createCard(makeHass());
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('calendar-stats-view-mode-toggle')).toBeTruthy();
    }, { timeout: 3000 });
    const toggle = el.shadowRoot!.querySelector('calendar-stats-view-mode-toggle')!;
    toggle.dispatchEvent(new CustomEvent('calendar-stats-view-mode-select', {
      detail: { mode: 'yearly' }, bubbles: true, composed: true,
    }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.viewMode).toBe('yearly');
      expect(el.shadowRoot!.querySelector('calendar-stats-year-summary-table')).toBeTruthy();
      // range snapped to whole calendar year (FR-016)
      expect(el.range.start.month).toBe(1);
      expect(el.range.end.month).toBe(12);
    }, { timeout: 3000 });
  });

  it('switching back to monthly retains the year-spanning range and renders year-table', async () => {
    const el = await createCard(makeHass());
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('calendar-stats-view-mode-toggle')).toBeTruthy();
    }, { timeout: 3000 });
    el.viewMode = 'yearly';
    await el.updateComplete;
    el.viewMode = 'monthly';
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('calendar-stats-year-table')).toBeTruthy();
      expect(el.range.start.month).toBe(1);
      expect(el.range.end.month).toBe(12);
    }, { timeout: 3000 });
  });

  it('navigator gets granularity="year" in yearly mode', async () => {
    const el = await createCard(makeHass());
    el.viewMode = 'yearly';
    await vi.waitFor(async () => {
      await el.updateComplete;
      const nav = el.shadowRoot!.querySelector('calendar-stats-range-navigator') as (HTMLElement & { granularity: string }) | null;
      expect(nav?.granularity).toBe('year');
    }, { timeout: 3000 });
  });

  it('monthly mode: prev step is clamped at the earliest-data floor (FR-015)', async () => {
    const currentYear = new Date().getFullYear();
    const el = await createCard(hassWithEarliest(1)); // earliest = Jan 1 of last year
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('calendar-stats-range-navigator')).toBeTruthy();
    }, { timeout: 3000 });
    const nav = el.shadowRoot!.querySelector('calendar-stats-range-navigator')!;
    // step back twice: this_year → last year (floor) → must not go past
    nav.dispatchEvent(new CustomEvent('calendar-stats-prev-range', { bubbles: true }));
    await el.updateComplete;
    nav.dispatchEvent(new CustomEvent('calendar-stats-prev-range', { bubbles: true }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.range.start.year).toBeGreaterThanOrEqual(currentYear - 1);
    }, { timeout: 3000 });
  });

  it('yearly mode: a 5-year preset is clamped to the earliest-data year — no empty years (bugfix)', async () => {
    const currentYear = new Date().getFullYear();
    const el = await createCard(hassWithEarliest(1)); // data starts last year
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('calendar-stats-range-navigator')).toBeTruthy();
    }, { timeout: 3000 });
    el.viewMode = 'yearly';
    await el.updateComplete;
    const nav = el.shadowRoot!.querySelector('calendar-stats-range-navigator')!;
    nav.dispatchEvent(new CustomEvent('calendar-stats-range-select', {
      detail: { preset: 'last_5_years' }, bubbles: true, composed: true,
    }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.range.start.year).toBe(currentYear - 1);
      const blocks = el.shadowRoot!.querySelectorAll('calendar-stats-year-summary-table');
      expect(blocks.length).toBe(2); // earliest year + current year only
    }, { timeout: 3000 });
  });

  it('yearly mode: All preset spans the earliest-data year through the current year', async () => {
    const currentYear = new Date().getFullYear();
    const el = await createCard(hassWithEarliest(3));
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('calendar-stats-range-navigator')).toBeTruthy();
    }, { timeout: 3000 });
    el.viewMode = 'yearly';
    await el.updateComplete;
    const nav = el.shadowRoot!.querySelector('calendar-stats-range-navigator')!;
    nav.dispatchEvent(new CustomEvent('calendar-stats-range-select', {
      detail: { preset: 'all' }, bubbles: true, composed: true,
    }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.range.start).toEqual({ year: currentYear - 3, month: 1 });
      expect(el.range.end).toEqual({ year: currentYear, month: 12 });
    }, { timeout: 3000 });
  });

  it('yearly mode: prev steps whole years and clamps at the earliest-data year', async () => {
    const currentYear = new Date().getFullYear();
    const el = await createCard(hassWithEarliest(2)); // earliest = Jan of currentYear-2
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('calendar-stats-range-navigator')).toBeTruthy();
    }, { timeout: 3000 });
    el.viewMode = 'yearly';
    await el.updateComplete;
    const nav = el.shadowRoot!.querySelector('calendar-stats-range-navigator')!;
    for (let i = 0; i < 4; i++) {
      nav.dispatchEvent(new CustomEvent('calendar-stats-prev-range', { bubbles: true }));
      await el.updateComplete;
    }
    expect(el.range.start.year).toBeGreaterThanOrEqual(currentYear - 2);
    expect(el.range.start.month).toBe(1);
    expect(el.range.end.month).toBe(12);
  });
});
