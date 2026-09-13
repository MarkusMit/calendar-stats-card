import { describe, it, expect, vi, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import { CalendarStatsCard } from '../../src/calendar-stats-card';
import type { HomeAssistant } from '../../src/types/ha-types';
import type { CardConfig, EntityConfig } from '../../src/types/card-config';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

function makeHass(): HomeAssistant {
  return {
    config: { version: '2026.5.0', time_zone: 'UTC' },
    states: {},
    connection: { sendMessagePromise: vi.fn().mockResolvedValue([]) },
    language: 'en',
  };
}

const THIS_YEAR = new Date().getFullYear();

function config(entities: EntityConfig[]): CardConfig {
  return { type: 'custom:calendar-stats-card', entities };
}

/** How often the card asked HA for `year`'s daily statistics. */
function dailyFetches(hass: HomeAssistant, year: number): number {
  const startTime = `${year - 1}-12-31T00:00:00Z`;
  return (hass.connection.sendMessagePromise as unknown as Mock).mock.calls
    .filter(([msg]) => msg.type === 'recorder/statistics_during_period'
      && msg.period === 'day' && msg.start_time === startTime).length;
}

async function settle(el: CalendarStatsCard): Promise<void> {
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot?.querySelector('.card-content')) throw new Error('not rendered yet');
  }, { timeout: 3000 });
  await new Promise((r) => setTimeout(r, 20));
  await el.updateComplete;
}

async function settledCard(entities: EntityConfig[], hass: HomeAssistant): Promise<CalendarStatsCard> {
  const el = new CalendarStatsCard();
  document.body.appendChild(el);
  el.setConfig(config(entities));
  el.hass = hass;
  await settle(el);
  return el;
}

describe('CalendarStatsCard — statistics cache invalidation on setConfig', () => {
  it('refetches when a configured entity changes', async () => {
    const hass = makeHass();
    const el = await settledCard([{ entity: 'sensor.temp' }], hass);
    expect(dailyFetches(hass, THIS_YEAR)).toBe(1);

    el.setConfig(config([{ entity: 'sensor.rain' }]));
    await settle(el);

    expect(dailyFetches(hass, THIS_YEAR)).toBe(2);
  });

  it('refetches when the rows are reordered, because summaries are keyed by row index', async () => {
    const hass = makeHass();
    const rows: EntityConfig[] = [{ entity: 'sensor.temp' }, { entity: 'sensor.rain' }];
    const el = await settledCard(rows, hass);

    el.setConfig(config([rows[1]!, rows[0]!]));
    await settle(el);

    expect(dailyFetches(hass, THIS_YEAR)).toBe(2);
  });

  it('keeps the cache when only render-time options change', async () => {
    const hass = makeHass();
    const el = await settledCard([{ entity: 'sensor.temp' }], hass);

    el.setConfig(config([{ entity: 'sensor.temp', background_color: 'red', precision: 3 }]));
    await settle(el);

    expect(dailyFetches(hass, THIS_YEAR)).toBe(1);
  });
});
