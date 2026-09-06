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

/** A card that has finished its initial fetch and settled, ready to be observed. */
async function settledCard(hass: HomeAssistant = makeHass()): Promise<CalendarStatsCard> {
  const el = new CalendarStatsCard();
  document.body.appendChild(el);
  el.setConfig(CONFIG);
  el.hass = hass;
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot?.querySelector('.card-content')) throw new Error('not rendered yet');
  }, { timeout: 3000 });
  await new Promise((r) => setTimeout(r, 20));
  await el.updateComplete;
  return el;
}

function spyOnRender() {
  return vi.spyOn(CalendarStatsCard.prototype, 'render');
}

describe('CalendarStatsCard — re-render triggers', () => {
  it('does not re-render when hass is reassigned with unchanged language and time zone', async () => {
    const el = await settledCard();
    const render = spyOnRender();

    for (let i = 0; i < 5; i++) {
      el.hass = makeHass();
      await el.updateComplete;
    }

    expect(render).not.toHaveBeenCalled();
  });

  it('re-renders and re-localizes when the hass language changes', async () => {
    const el = await settledCard();

    el.hass = makeHass({ language: 'de' });
    await el.updateComplete;

    const toggle = el.shadowRoot!.querySelector('calendar-stats-view-mode-toggle') as HTMLElement & { lang: string };
    expect(toggle.lang).toBe('de');
  });

  it('re-renders when the hass time zone changes', async () => {
    const el = await settledCard();
    const render = spyOnRender();

    el.hass = makeHass({ config: { version: '2026.5.0', time_zone: 'Australia/Sydney' } });
    await el.updateComplete;

    expect(render).toHaveBeenCalled();
  });

  it('keeps serving the latest hass object to consumers', async () => {
    const el = await settledCard();
    const next = makeHass();

    el.hass = next;

    expect(el.hass).toBe(next);
  });
});
