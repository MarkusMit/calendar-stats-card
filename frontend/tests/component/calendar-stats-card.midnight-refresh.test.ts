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

/** Statistics requests only — the earliest-data probe uses the same channel. */
function statsCalls(send: ReturnType<typeof vi.fn>): number {
  return send.mock.calls.filter(
    ([msg]) => (msg as { type?: string })?.type === 'recorder/statistics_during_period',
  ).length;
}

async function settledCard(send: ReturnType<typeof vi.fn>): Promise<CalendarStatsCard> {
  const el = new CalendarStatsCard();
  document.body.appendChild(el);
  el.setConfig(CONFIG);
  el.hass = makeHass(send);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot?.querySelector('.card-content')) throw new Error('not rendered');
  }, { timeout: 3000 });
  await el.updateComplete;
  return el;
}

describe('CalendarStatsCard — midnight refresh', () => {
  it('refetches statistics once the calendar day has rolled over', async () => {
    // 21:50Z is 23:50 in Vienna — ten minutes before the local day ends.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 15, 21, 50)));
    const send = vi.fn().mockResolvedValue({});
    const el = await settledCard(send);
    const before = statsCalls(send);
    expect(before).toBeGreaterThan(0);

    await vi.advanceTimersByTimeAsync(15 * MINUTE);

    await vi.waitFor(async () => {
      await el.updateComplete;
      expect(statsCalls(send)).toBeGreaterThan(before);
    }, { timeout: 3000 });
  });

  it('does not refetch while the day is still running', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 15, 10, 0)));
    const send = vi.fn().mockResolvedValue({});
    const el = await settledCard(send);
    const before = statsCalls(send);

    await vi.advanceTimersByTimeAsync(60 * MINUTE);
    await el.updateComplete;

    expect(statsCalls(send)).toBe(before);
  });

  it('stops the refresh timer when the card is removed', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(Date.UTC(2026, 5, 15, 21, 50)));
    const send = vi.fn().mockResolvedValue({});
    const el = await settledCard(send);
    const before = statsCalls(send);

    el.remove();
    await vi.advanceTimersByTimeAsync(15 * MINUTE);

    expect(statsCalls(send)).toBe(before);
  });
});
