import { describe, it, expect, vi, afterEach } from 'vitest';
import { CalendarStatsCard } from '../../src/calendar-stats-card';
import type { HomeAssistant } from '../../src/types/ha-types';
import type { ThresholdRule } from '../../src/types/card-config';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const PREV_YEAR = new Date().getFullYear() - 1;
const CURRENT_YEAR = new Date().getFullYear();

/** hass whose recorder returns June data for the previous year only. */
function makeDataHass(): HomeAssistant {
  const monthly = {
    'sensor.rain': [{ start: Date.UTC(PREV_YEAR, 5, 1), end: Date.UTC(PREV_YEAR, 6, 1), sum: 8 }],
  };
  const daily = {
    'sensor.rain': [
      { start: Date.UTC(PREV_YEAR, 5, 10), end: Date.UTC(PREV_YEAR, 5, 11), sum: 5 },
      { start: Date.UTC(PREV_YEAR, 5, 11), end: Date.UTC(PREV_YEAR, 5, 12), sum: 8 },
    ],
  };
  return {
    config: { version: '2026.5.0', time_zone: 'UTC' },
    language: 'en',
    states: {
      'sensor.rain': {
        state: '8',
        attributes: { state_class: 'total_increasing', unit_of_measurement: 'mm', friendly_name: 'Rain' },
      },
    } as unknown as HomeAssistant['states'],
    connection: {
      sendMessagePromise: vi.fn().mockImplementation((msg: { period?: string }) =>
        Promise.resolve(msg.period === 'month' ? monthly : daily)),
    } as unknown as HomeAssistant['connection'],
  };
}

/** Card in the month-comparison view, where two tables report thresholds at once. */
async function comparisonCard(): Promise<CalendarStatsCard> {
  const el = new CalendarStatsCard();
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  el.setConfig({ type: 'custom:calendar-stats-card', entities: [{ entity: 'sensor.rain' }] });
  el.hass = makeDataHass();
  await vi.waitFor(async () => {
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('calendar-stats-range-navigator')).toBeTruthy();
  }, { timeout: 3000 });
  el.shadowRoot!.querySelector('calendar-stats-range-navigator')!.dispatchEvent(
    new CustomEvent('calendar-stats-range-select', {
      detail: { start: { year: PREV_YEAR, month: 1 }, end: { year: CURRENT_YEAR, month: 1 } },
      bubbles: true, composed: true,
    }),
  );
  await el.updateComplete;
  el.viewMode = 'yearly';
  await vi.waitFor(async () => {
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('calendar-stats-year-summary-table')).toBeTruthy();
  }, { timeout: 3000 });

  el.shadowRoot!.querySelector('calendar-stats-year-summary-table')!.dispatchEvent(
    new CustomEvent('calendar-stats-month-select', { detail: { month: 6 }, bubbles: true, composed: true }),
  );
  await vi.waitFor(async () => {
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('calendar-stats-month-comparison-table')).toBeTruthy();
    expect(el.shadowRoot!.querySelector('.comparison-daily calendar-stats-year-table')).toBeTruthy();
  }, { timeout: 3000 });
  return el;
}

function report(card: CalendarStatsCard, selector: string, label: string, rule: ThresholdRule): void {
  card.shadowRoot!.querySelector(selector)!.dispatchEvent(new CustomEvent('thresholds-applied', {
    bubbles: true, composed: true, detail: { groups: [{ label, rules: [rule] }] },
  }));
}

async function legendNames(card: CalendarStatsCard): Promise<string[]> {
  await card.updateComplete;
  (card.shadowRoot!.querySelector('.legend-toggle') as HTMLElement | null)?.click();
  await card.updateComplete;
  return [...card.shadowRoot!.querySelectorAll('.legend-name')].map((n) => n.textContent!.trim());
}

const MONTHLY_RULE: ThresholdRule = { operator: 'above', value_month: 5, name: 'Wet month', background_color: 'blue' };
const DAILY_RULE: ThresholdRule = { operator: 'above', value: 4, name: 'Wet day', background_color: 'red' };

describe('CalendarStatsCard — threshold legend across several tables', () => {
  it('lists the rules of every table on screen, not only the one that reported last', async () => {
    const card = await comparisonCard();

    report(card, 'calendar-stats-month-comparison-table', 'Rain [mm]', MONTHLY_RULE);
    report(card, '.comparison-daily calendar-stats-year-table', 'Rain [mm]', DAILY_RULE);

    expect(await legendNames(card)).toEqual(['Wet month', 'Wet day']);
  });

  it('keeps the rules of a table that reported earlier when another one reports', async () => {
    const card = await comparisonCard();

    report(card, '.comparison-daily calendar-stats-year-table', 'Rain [mm]', DAILY_RULE);
    report(card, 'calendar-stats-month-comparison-table', 'Rain [mm]', MONTHLY_RULE);

    expect(await legendNames(card)).toEqual(['Wet day', 'Wet month']);
  });

  it('forgets the rules of a table once it leaves the view', async () => {
    const card = await comparisonCard();
    report(card, 'calendar-stats-month-comparison-table', 'Rain [mm]', MONTHLY_RULE);
    report(card, '.comparison-daily calendar-stats-year-table', 'Rain [mm]', DAILY_RULE);
    await card.updateComplete;

    card.shadowRoot!.querySelector<HTMLButtonElement>('button.comparison-back')!.click();
    await vi.waitFor(async () => {
      await card.updateComplete;
      expect(card.shadowRoot!.querySelector('calendar-stats-month-comparison-table')).toBeNull();
    }, { timeout: 3000 });
    await card.updateComplete;

    expect(card.shadowRoot!.querySelector('.legend-toggle')).toBeNull();
  });
});
