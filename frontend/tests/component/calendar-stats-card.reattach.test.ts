import { describe, it, expect, vi, afterEach } from 'vitest';
import { CalendarStatsCard } from '../../src/calendar-stats-card';
import type { HomeAssistant } from '../../src/types/ha-types';
import type { CardConfig } from '../../src/types/card-config';

afterEach(() => {
  document.body.innerHTML = '';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const CONFIG: CardConfig = {
  type: 'custom:calendar-stats-card',
  entities: [{ entity: 'sensor.temp' }],
};

const MINUTE = 60_000;

function makeHass(send: ReturnType<typeof vi.fn>): HomeAssistant {
  return {
    config: { version: '2026.5.0', time_zone: 'Europe/Vienna' },
    states: {},
    connection: { sendMessagePromise: send as unknown as HomeAssistant['connection']['sendMessagePromise'] },
    language: 'en',
  };
}

function statsCalls(send: ReturnType<typeof vi.fn>): number {
  return send.mock.calls.filter(
    ([msg]) => (msg as { type?: string })?.type === 'recorder/statistics_during_period',
  ).length;
}

async function settledCard(send: ReturnType<typeof vi.fn>, parent: ParentNode = document.body): Promise<CalendarStatsCard> {
  const el = new CalendarStatsCard();
  parent.appendChild(el);
  el.setConfig(CONFIG);
  el.hass = makeHass(send);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot?.querySelector('.card-content')) throw new Error('not rendered');
  }, { timeout: 3000 });
  await el.updateComplete;
  return el;
}

// Home Assistant detaches and reattaches cards when a dashboard view is switched
// or a card is dragged to a new position.
describe('CalendarStatsCard — reattached to the DOM', () => {
  it('resumes the midnight refresh', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 15, 21, 50)));
    const send = vi.fn().mockResolvedValue({});
    const el = await settledCard(send);
    const before = statsCalls(send);
    expect(before).toBeGreaterThan(0);

    el.remove();
    document.body.appendChild(el);
    await el.updateComplete;

    await vi.advanceTimersByTimeAsync(15 * MINUTE);

    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(statsCalls(send)).toBeGreaterThan(before);
    }, { timeout: 3000 });
  });

  it('leaves editor mode when moved out of the editor dialog', async () => {
    const dialog = document.createElement('ha-dialog');
    document.body.appendChild(dialog);
    const el = await settledCard(vi.fn().mockResolvedValue({}), dialog);
    expect(el.shadowRoot!.querySelector('.bottom-bar')).toBeNull();

    document.body.appendChild(el);
    await el.updateComplete;

    expect(el.shadowRoot!.querySelector('.bottom-bar')).not.toBeNull();
  });
});
