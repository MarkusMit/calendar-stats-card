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

describe('CalendarStatsCard — yearly view rendering (T006)', () => {
  it("viewMode 'yearly' renders year-summary-table instead of year-table", async () => {
    const el = await createCard(makeHass());
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('calendar-stats-year-table')).toBeTruthy();
    }, { timeout: 3000 });
    el.viewMode = 'yearly';
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('calendar-stats-year-summary-table')).toBeTruthy();
      expect(el.shadowRoot!.querySelector('calendar-stats-year-table')).toBeNull();
    }, { timeout: 3000 });
  });

  it('renders one year-summary-table per year segment, chronological', async () => {
    const currentYear = new Date().getFullYear();
    const earliestStart = new Date(currentYear - 1, 0, 1).getTime();
    const sendMsg = vi.fn()
      .mockResolvedValueOnce([{ statistic_id: 'sensor.temp', start: earliestStart }])
      .mockResolvedValue({});
    const el = await createCard(makeHass({ connection: { sendMessagePromise: sendMsg } }));
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('.bottom-bar calendar-stats-range-navigator')).toBeTruthy();
    }, { timeout: 3000 });
    // custom range spanning two years (monthly mode), then switch to yearly
    const nav = el.shadowRoot!.querySelector('calendar-stats-range-navigator')!;
    nav.dispatchEvent(new CustomEvent('calendar-stats-range-select', {
      detail: { start: { year: currentYear - 1, month: 11 }, end: { year: currentYear, month: 1 } },
      bubbles: true, composed: true,
    }));
    await el.updateComplete;
    el.viewMode = 'yearly';
    await vi.waitFor(async () => {
      await el.updateComplete;
      const tables = [...el.shadowRoot!.querySelectorAll('calendar-stats-year-summary-table')] as (HTMLElement & { year: number })[];
      expect(tables.length).toBe(2);
      expect(tables[0]!.year).toBe(currentYear - 1);
      expect(tables[1]!.year).toBe(currentYear);
    }, { timeout: 3000 });
  });

  it('current-year block: months after the current month have no data (FR-007/SC-005)', async () => {
    const el = await createCard(makeHass());
    el.viewMode = 'yearly';
    await vi.waitFor(async () => {
      await el.updateComplete;
      const table = el.shadowRoot!.querySelector('calendar-stats-year-summary-table') as (HTMLElement & { visibleMonths: number[]; updateComplete: Promise<boolean> }) | null;
      if (!table?.shadowRoot) throw new Error('table not ready');
      await table.updateComplete;
      const currentMonth = new Date().getMonth() + 1;
      // future months are outside visibleMonths → pad-month headers
      const padHeaders = table.shadowRoot.querySelectorAll('th.month-col.pad-month');
      expect(padHeaders.length).toBe(12 - currentMonth);
      expect(table.visibleMonths.every((m: number) => m <= currentMonth)).toBe(true);
    }, { timeout: 3000 });
  });
});
