import { describe, it, expect, vi, afterEach } from 'vitest';
import { CalendarStatsCard } from '../../src/calendar-stats-card';
import type { HomeAssistant } from '../../src/types/ha-types';
import type { CardConfig } from '../../src/types/card-config';
import type { MonthSegment } from '../../src/components/year-table';

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

type SegmentedYearTable = HTMLElement & {
  monthSegments: MonthSegment[] | null;
  updateComplete: Promise<boolean>;
  shadowRoot: ShadowRoot;
};

const CURRENT_YEAR = new Date().getFullYear();
const PREV_YEAR = CURRENT_YEAR - 1;

/** Card with statistics reaching back to January of the previous year. */
async function createTwoYearCard(): Promise<CalendarStatsCard> {
  const earliestStart = Date.UTC(PREV_YEAR, 0, 2);
  const sendMsg = vi.fn()
    .mockResolvedValueOnce({ 'sensor.temp': [{ start: earliestStart, end: earliestStart + 1, sum: 1 }] })
    .mockResolvedValue({});
  const el = new CalendarStatsCard();
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  el.setConfig(CONFIG);
  el.hass = makeHass({ connection: { sendMessagePromise: sendMsg } });
  await vi.waitFor(async () => {
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.bottom-bar calendar-stats-range-navigator')).toBeTruthy();
  }, { timeout: 3000 });
  return el;
}

function selectRange(
  el: CalendarStatsCard,
  start: { year: number; month: number },
  end: { year: number; month: number },
): void {
  const nav = el.shadowRoot!.querySelector('calendar-stats-range-navigator')!;
  nav.dispatchEvent(new CustomEvent('calendar-stats-range-select', {
    detail: { start, end },
    bubbles: true, composed: true,
  }));
}

describe('CalendarStatsCard — monthly view over a multi-year range', () => {
  it('renders ONE year-table hosting all months as segments so day columns share widths', async () => {
    const el = await createTwoYearCard();
    selectRange(el, { year: PREV_YEAR, month: 11 }, { year: CURRENT_YEAR, month: 1 });
    await vi.waitFor(async () => {
      await el.updateComplete;
      const tables = [...el.shadowRoot!.querySelectorAll('calendar-stats-year-table')] as SegmentedYearTable[];
      expect(tables.length).toBe(1);
      expect(tables[0]!.monthSegments!.map((s) => [s.year, s.month])).toEqual([
        [PREV_YEAR, 11],
        [PREV_YEAR, 12],
        [CURRENT_YEAR, 1],
      ]);
    }, { timeout: 3000 });
  });

  it('each month section header names the month AND its year', async () => {
    const el = await createTwoYearCard();
    selectRange(el, { year: PREV_YEAR, month: 12 }, { year: CURRENT_YEAR, month: 1 });
    await vi.waitFor(async () => {
      await el.updateComplete;
      const table = el.shadowRoot!.querySelector('calendar-stats-year-table') as SegmentedYearTable | null;
      if (!table?.shadowRoot) throw new Error('year-table not ready');
      await table.updateComplete;
      const headers = [...table.shadowRoot.querySelectorAll('th.month-name')].map((h) => h.textContent);
      expect(headers).toEqual([
        `December ${PREV_YEAR}`,
        `January ${CURRENT_YEAR}`,
      ]);
    }, { timeout: 3000 });
  });

  it('single-year range keeps the year out of month headers (no behavior change)', async () => {
    const el = await createTwoYearCard();
    selectRange(el, { year: CURRENT_YEAR, month: 1 }, { year: CURRENT_YEAR, month: 1 });
    await vi.waitFor(async () => {
      await el.updateComplete;
      const tables = [...el.shadowRoot!.querySelectorAll('calendar-stats-year-table')] as SegmentedYearTable[];
      expect(tables.length).toBe(1);
      expect(tables[0]!.monthSegments ?? null).toBeNull();
      if (!tables[0]!.shadowRoot) throw new Error('year-table not ready');
      await tables[0]!.updateComplete;
      const header = tables[0]!.shadowRoot.querySelector('th.month-name')!.textContent!;
      expect(header).toContain('January');
      expect(header).not.toContain(String(CURRENT_YEAR));
    }, { timeout: 3000 });
  });
});
