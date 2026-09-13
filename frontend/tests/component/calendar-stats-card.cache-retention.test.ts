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

/** Selects an explicit month range, the way the range navigator does. */
async function selectRange(el: CalendarStatsCard, year: number): Promise<void> {
  el.shadowRoot!.querySelector('calendar-stats-range-navigator')!.dispatchEvent(
    new CustomEvent('calendar-stats-range-select', {
      detail: { start: { year, month: 1 }, end: { year, month: 12 } },
      bubbles: true,
      composed: true,
    }),
  );
  await settle(el);
}

describe('CalendarStatsCard — statistics cache retention', () => {
  it('drops years far outside the viewed range', async () => {
    const hass = makeHass();
    const el = await settledCard([{ entity: 'sensor.temp' }], hass);
    expect(dailyFetches(hass, THIS_YEAR)).toBe(1);

    await selectRange(el, THIS_YEAR - 8);
    await selectRange(el, THIS_YEAR);

    expect(dailyFetches(hass, THIS_YEAR)).toBe(2);
  });

  it('keeps the neighbouring year, so stepping one page back does not refetch', async () => {
    const hass = makeHass();
    const el = await settledCard([{ entity: 'sensor.temp' }], hass);

    await selectRange(el, THIS_YEAR - 1);
    await selectRange(el, THIS_YEAR);

    expect(dailyFetches(hass, THIS_YEAR)).toBe(1);
  });
});
