import { describe, it, expect, vi, afterEach } from 'vitest';
import { CalendarStatsCard } from '../../src/calendar-stats-card';
import type { HomeAssistant } from '../../src/types/ha-types';
import type { CardConfig } from '../../src/types/card-config';
import type { ExceedanceGroup } from '../../src/services/threshold-exceedance';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const CURRENT_YEAR = new Date().getFullYear();
const PREV_YEAR = CURRENT_YEAR - 1;

const WITH_THRESHOLD: CardConfig = {
  type: 'custom:calendar-stats-card',
  entities: [{
    entity: 'sensor.temp',
    name: 'Temperature',
    thresholds: [{ operator: 'equals-above', value: 25, name: 'Summer day', background_color: 'orange' }],
  }],
};

type ExceedanceTable = HTMLElement & { groups: ExceedanceGroup[] };

/** Card whose earliest data point sits in January of the previous year. */
async function createCard(config: CardConfig = WITH_THRESHOLD): Promise<CalendarStatsCard> {
  const earliestStart = Date.UTC(PREV_YEAR, 0, 2);
  const sendMsg = vi.fn()
    .mockResolvedValueOnce({ 'sensor.temp': [{ start: earliestStart, end: earliestStart + 1, sum: 1 }] })
    .mockResolvedValue({});
  const hass: HomeAssistant = {
    config: { version: '2026.5.0', time_zone: 'UTC' },
    states: {},
    connection: { sendMessagePromise: sendMsg },
    language: 'en',
  };
  const el = new CalendarStatsCard();
  document.body.appendChild(el);
  el.setConfig(config);
  el.hass = hass;
  await vi.waitFor(async () => {
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.bottom-bar calendar-stats-range-navigator')).toBeTruthy();
  }, { timeout: 3000 });
  await new Promise((r) => setTimeout(r, 20));
  await el.updateComplete;
  return el;
}

function exceedanceTable(el: CalendarStatsCard): ExceedanceTable {
  return el.shadowRoot!.querySelector('calendar-stats-exceedance-table') as ExceedanceTable;
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

describe('CalendarStatsCard — exceedance counts are memoized', () => {
  it('hands the exceedance table the same groups across a re-render with unchanged inputs', async () => {
    const el = await createCard();
    const first = exceedanceTable(el).groups;

    el.requestUpdate();
    await el.updateComplete;

    expect(exceedanceTable(el).groups).toBe(first);
  });

  it('recounts when the range changes', async () => {
    const el = await createCard();
    expect(exceedanceTable(el).groups[0]!.rows[0]!.byYear.map((y) => y.year)).toEqual([CURRENT_YEAR]);

    selectRange(el, { year: PREV_YEAR, month: 11 }, { year: CURRENT_YEAR, month: 1 });

    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(exceedanceTable(el).groups[0]!.rows[0]!.byYear.map((y) => y.year))
        .toEqual([PREV_YEAR, CURRENT_YEAR]);
    }, { timeout: 3000 });
  });
});

const PLAIN: CardConfig = {
  type: 'custom:calendar-stats-card',
  entities: [{ entity: 'sensor.temp' }],
};

type Table = HTMLElement & { visibleMonths: number[]; render: () => unknown };
type Renderable = HTMLElement & { render: () => unknown };

describe('CalendarStatsCard — table props are stable across re-renders', () => {
  it('does not re-render the year table when the card re-renders with unchanged data', async () => {
    const el = await createCard(PLAIN);
    const table = el.shadowRoot!.querySelector('calendar-stats-year-table') as Table;
    const render = vi.spyOn(Object.getPrototypeOf(table) as Table, 'render');

    el.requestUpdate();
    await el.updateComplete;

    expect(render).not.toHaveBeenCalled();
  });

  it('does not re-render the multi-year monthly table when the card re-renders', async () => {
    const el = await createCard(PLAIN);
    selectRange(el, { year: PREV_YEAR, month: 11 }, { year: CURRENT_YEAR, month: 1 });
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('calendar-stats-year-table')).toBeTruthy();
    }, { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 20));
    await el.updateComplete;
    const table = el.shadowRoot!.querySelector('calendar-stats-year-table') as Table;
    const render = vi.spyOn(Object.getPrototypeOf(table) as Table, 'render');

    el.requestUpdate();
    await el.updateComplete;

    expect(render).not.toHaveBeenCalled();
  });

  it('does not re-render the yearly summary table when the card re-renders', async () => {
    const el = await createCard(PLAIN);
    el.viewMode = 'yearly';
    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.shadowRoot!.querySelector('calendar-stats-year-summary-table')).toBeTruthy();
    }, { timeout: 3000 });
    await new Promise((r) => setTimeout(r, 20));
    await el.updateComplete;
    const table = el.shadowRoot!.querySelector('calendar-stats-year-summary-table') as Renderable;
    const render = vi.spyOn(Object.getPrototypeOf(table) as Renderable, 'render');

    el.requestUpdate();
    await el.updateComplete;

    expect(render).not.toHaveBeenCalled();
  });

  it('still re-renders the year table when the range changes', async () => {
    const el = await createCard(PLAIN);
    selectRange(el, { year: CURRENT_YEAR, month: 1 }, { year: CURRENT_YEAR, month: 3 });

    await vi.waitFor(async () => {
      await el.updateComplete;
      const table = el.shadowRoot!.querySelector('calendar-stats-year-table') as Table;
      expect(table.visibleMonths).toEqual([1, 2, 3]);
    }, { timeout: 3000 });
  });
});
