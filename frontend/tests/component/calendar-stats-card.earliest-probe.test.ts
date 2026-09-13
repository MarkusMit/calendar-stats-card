import { describe, it, expect, vi, afterEach } from 'vitest';
import { CalendarStatsCard } from '../../src/calendar-stats-card';
import type { HomeAssistant } from '../../src/types/ha-types';
import type { CardConfig } from '../../src/types/card-config';
import { EARLIEST_PROBE_START } from '../../src/services/statistics-service';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  localStorage.clear();
});

const TEMP = 'sensor.temp';
const YEAR = new Date().getFullYear();

const CONFIG: CardConfig = {
  type: 'custom:calendar-stats-card',
  entities: [{ entity: TEMP }],
};

/** Statistics for Jan 1 of the viewed year, enough for one rendered day cell. */
function dayStats(): Record<string, Array<Record<string, number>>> {
  const start = Date.UTC(YEAR, 0, 1);
  return { [TEMP]: [{ start, end: start + 86400000, min: 1, mean: 2, max: 3 }] };
}

/**
 * `hass` whose earliest-data probe (monthly statistics from 2000) never settles,
 * while the statistics for the viewed year resolve normally.
 */
function makeHassWithStalledProbe(): { hass: HomeAssistant; probeCalls: () => number } {
  let probes = 0;
  const hass = {
    config: { version: '2026.5.0', time_zone: 'UTC' },
    states: {
      [TEMP]: {
        entity_id: TEMP,
        state: '2',
        attributes: {
          state_class: 'measurement',
          device_class: 'temperature',
          unit_of_measurement: '°C',
          friendly_name: 'Temp',
        },
      },
    },
    connection: {
      sendMessagePromise: vi.fn().mockImplementation((msg: Record<string, unknown>) => {
        if (msg['type'] === 'recorder/get_statistics_metadata') return Promise.resolve([]);
        if (msg['start_time'] === EARLIEST_PROBE_START) {
          probes++;
          return new Promise(() => {});
        }
        if (msg['period'] === 'day') return Promise.resolve(dayStats());
        return Promise.resolve({});
      }),
    },
    language: 'en',
  } as unknown as HomeAssistant;
  return { hass, probeCalls: () => probes };
}

/**
 * `hass` whose earliest-data probe stays pending until `resolveProbe()` is
 * called, reporting `earliestYear` as the first recorded month.
 */
function makeHassWithDeferredProbe(earliestYear: number): {
  hass: HomeAssistant;
  resolveProbe: () => void;
} {
  let release = (): void => {};
  const gate = new Promise<void>((r) => { release = r; });
  const earliestStart = Date.UTC(earliestYear, 0, 1);
  const hass = {
    config: { version: '2026.5.0', time_zone: 'UTC' },
    states: {},
    connection: {
      sendMessagePromise: vi.fn().mockImplementation(async (msg: Record<string, unknown>) => {
        if (msg['type'] === 'recorder/get_statistics_metadata') return [];
        if (msg['start_time'] === EARLIEST_PROBE_START) {
          await gate;
          return { [TEMP]: [{ start: earliestStart, end: earliestStart + 1, sum: 1 }] };
        }
        return {};
      }),
    },
    language: 'en',
  } as unknown as HomeAssistant;
  return { hass, resolveProbe: () => release() };
}

async function createCard(hass: HomeAssistant): Promise<CalendarStatsCard> {
  const el = new CalendarStatsCard();
  document.body.appendChild(el);
  await el.updateComplete;
  el.setConfig(CONFIG);
  el.hass = hass;
  await el.updateComplete;
  return el;
}

describe('CalendarStatsCard — earliest-data probe does not gate the first render', () => {
  it('renders the year table while the earliest-data probe is still pending', async () => {
    const { hass, probeCalls } = makeHassWithStalledProbe();
    const el = await createCard(hass);

    await vi.waitFor(async () => {
      await el.updateComplete;
      const table = el.shadowRoot!.querySelector('calendar-stats-year-table');
      if (!table?.shadowRoot) throw new Error('year-table not rendered');
      await (table as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
      expect(table.shadowRoot.querySelectorAll('tr.month-header-row').length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    expect(probeCalls()).toBe(1);
  });

  it('hides the loading overlay while the earliest-data probe is still pending', async () => {
    const { hass } = makeHassWithStalledProbe();
    const el = await createCard(hass);

    await vi.waitFor(async () => {
      await el.updateComplete;
      const overlay = el.shadowRoot!.querySelector('calendar-stats-loading-overlay') as
        (HTMLElement & { visible?: boolean }) | null;
      expect(overlay?.visible).toBe(false);
    }, { timeout: 3000 });
  });
});

describe('CalendarStatsCard — the "all" preset waits for the earliest data point', () => {
  it('spans from the earliest recorded year when the probe is still pending on selection', async () => {
    const earliestYear = new Date().getFullYear() - 6;
    const { hass, resolveProbe } = makeHassWithDeferredProbe(earliestYear);
    const el = await createCard(hass);
    el.viewMode = 'yearly';
    await el.updateComplete;

    let nav: Element | null = null;
    await vi.waitFor(async () => {
      await el.updateComplete;
      nav = el.shadowRoot!.querySelector('calendar-stats-range-navigator');
      if (!nav) throw new Error('range-navigator not rendered');
    }, { timeout: 3000 });

    // Selected while the probe has not reported yet.
    nav!.dispatchEvent(new CustomEvent('calendar-stats-range-select', {
      detail: { preset: 'all' },
      bubbles: true,
      composed: true,
    }));
    resolveProbe();

    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(el.range.preset).toBe('all');
      expect(el.range.start.year).toBe(earliestYear);
    }, { timeout: 3000 });
  });
});

describe('CalendarStatsCard — the earliest data point is cached across card instances', () => {
  /** `hass` reporting `earliestYear`, or never settling the probe when `stall`. */
  function makeHass(earliestYear: number, stall: boolean): HomeAssistant {
    const earliestStart = Date.UTC(earliestYear, 0, 1);
    return {
      config: { version: '2026.5.0', time_zone: 'UTC' },
      states: {},
      connection: {
        sendMessagePromise: vi.fn().mockImplementation((msg: Record<string, unknown>) => {
          if (msg['type'] === 'recorder/get_statistics_metadata') return Promise.resolve([]);
          if (msg['start_time'] === EARLIEST_PROBE_START) {
            return stall
              ? new Promise(() => {})
              : Promise.resolve({ [TEMP]: [{ start: earliestStart, end: earliestStart + 1, sum: 1 }] });
          }
          return Promise.resolve({});
        }),
      },
      language: 'en',
    } as unknown as HomeAssistant;
  }

  async function navigatorEarliest(el: CalendarStatsCard): Promise<{ year: number } | null> {
    let nav: (Element & { earliest?: { year: number } | null }) | null = null;
    await vi.waitFor(async () => {
      await el.updateComplete;
      nav = el.shadowRoot!.querySelector('calendar-stats-range-navigator');
      if (!nav) throw new Error('range-navigator not rendered');
    }, { timeout: 3000 });
    return nav!.earliest ?? null;
  }

  it('reuses the cached year in a later card instance whose probe never reports', async () => {
    const earliestYear = new Date().getFullYear() - 6;

    const first = await createCard(makeHass(earliestYear, false));
    await vi.waitFor(async () => {
      expect((await navigatorEarliest(first))?.year).toBe(earliestYear);
    }, { timeout: 3000 });
    first.remove();
    document.body.innerHTML = '';

    const second = await createCard(makeHass(earliestYear, true));
    expect((await navigatorEarliest(second))?.year).toBe(earliestYear);
  });

  it('ignores the cached year for a different set of entities', async () => {
    const earliestYear = new Date().getFullYear() - 6;

    const first = await createCard(makeHass(earliestYear, false));
    await vi.waitFor(async () => {
      expect((await navigatorEarliest(first))?.year).toBe(earliestYear);
    }, { timeout: 3000 });
    first.remove();
    document.body.innerHTML = '';

    const other = new CalendarStatsCard();
    document.body.appendChild(other);
    await other.updateComplete;
    other.setConfig({ type: 'custom:calendar-stats-card', entities: [{ entity: 'sensor.other' }] });
    other.hass = makeHass(earliestYear, true);
    await other.updateComplete;

    expect(await navigatorEarliest(other)).toBeNull();
  });
});
