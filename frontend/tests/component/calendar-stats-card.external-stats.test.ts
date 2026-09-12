import { describe, it, expect, vi, afterEach } from 'vitest';
import { CalendarStatsCard } from '../../src/calendar-stats-card';
import type { HomeAssistant } from '../../src/types/ha-types';
import type { CardConfig } from '../../src/types/card-config';
import type { StatisticMetaEntry } from '../../src/services/statistics-service';

afterEach(() => {
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

const year = new Date().getFullYear();
const dec31prev = Date.UTC(year - 1, 11, 31);
const jan1 = Date.UTC(year, 0, 1);
const jan2 = Date.UTC(year, 0, 2);
const jan3 = Date.UTC(year, 0, 3);

type RawEntry = { start: number; end: number; sum?: number; mean?: number; min?: number; max?: number };

function makeHass(
  daily: Record<string, RawEntry[]>,
  metadata: StatisticMetaEntry[],
  states: HomeAssistant['states'] = {},
): HomeAssistant {
  return {
    config: { version: '2026.5.0', time_zone: 'UTC' },
    states,
    connection: {
      sendMessagePromise: vi.fn().mockImplementation((msg: Record<string, unknown>) => {
        if (msg['type'] === 'recorder/get_statistics_metadata') return Promise.resolve(metadata);
        if (msg['period'] === 'day') return Promise.resolve(daily);
        return Promise.resolve({});
      }),
    },
    language: 'en',
  };
}

async function createCard(config: CardConfig, hass: HomeAssistant): Promise<CalendarStatsCard> {
  const el = new CalendarStatsCard();
  document.body.appendChild(el);
  await vi.waitFor(async () => {
    await el.updateComplete;
    if (!el.shadowRoot) throw new Error('shadow root not ready');
  }, { timeout: 3000 });
  el.setConfig(config);
  el.hass = hass;
  await el.updateComplete;
  return el;
}

async function getFirstTableRoot(card: CalendarStatsCard): Promise<ShadowRoot> {
  let root: ShadowRoot | null = null;
  await vi.waitFor(async () => {
    await card.updateComplete;
    const table = card.shadowRoot!.querySelector('calendar-stats-year-table');
    if (!table?.shadowRoot) throw new Error('year-table not ready');
    await (table as HTMLElement & { updateComplete: Promise<boolean> }).updateComplete;
    root = table.shadowRoot;
  }, { timeout: 3000 });
  return root!;
}

function findRow(root: ShadowRoot, labelPart: string): Element | undefined {
  return Array.from(root.querySelectorAll('tbody tr')).find(
    (row) => row.querySelector('.label-column')?.textContent?.includes(labelPart),
  );
}

const TIBBER_META: StatisticMetaEntry = {
  statistic_id: 'tibber:consumption',
  statistics_unit_of_measurement: 'kWh',
  display_unit_of_measurement: 'Wh',
  unit_class: 'energy',
  has_sum: true,
  mean_type: 0,
  name: 'Tibber',
  source: 'tibber',
};

const FORECAST_META: StatisticMetaEntry = {
  statistic_id: 'forecast:temp',
  statistics_unit_of_measurement: '°C',
  unit_class: 'temperature',
  has_sum: false,
  mean_type: 1,
  name: 'Forecast',
  source: 'forecast',
};

const TIBBER_DAILY: Record<string, RawEntry[]> = {
  'tibber:consumption': [
    { start: dec31prev, end: jan1, sum: 0 },
    { start: jan1, end: jan2, sum: 10 },
    { start: jan2, end: jan3, sum: 7 },
  ],
};

describe('CalendarStatsCard — external statistics rows', () => {
  it('renders a cumulative external statistic with name and statistics unit from metadata', async () => {
    const config: CardConfig = { type: 'custom:calendar-stats-card', entities: [{ entity: 'tibber:consumption' }] };
    const el = await createCard(config, makeHass(TIBBER_DAILY, [TIBBER_META]));
    const root = await getFirstTableRoot(el);
    const row = findRow(root, 'Tibber [kWh]');
    expect(row).toBeTruthy();
    expect(row!.querySelector('.label-column')!.textContent).not.toContain('⚠');
    const cells = row!.querySelectorAll('.data-cell');
    expect(cells[0]?.textContent?.trim()).toBe('10.0');
  });

  it('passes negative deltas through by default (total)', async () => {
    const config: CardConfig = { type: 'custom:calendar-stats-card', entities: [{ entity: 'tibber:consumption' }] };
    const el = await createCard(config, makeHass(TIBBER_DAILY, [TIBBER_META]));
    const root = await getFirstTableRoot(el);
    const cells = findRow(root, 'Tibber')!.querySelectorAll('.data-cell');
    expect(cells[1]?.textContent?.trim()).toBe('-3.0');
  });

  it('clamps negative deltas to zero with state_class: total_increasing', async () => {
    const config: CardConfig = {
      type: 'custom:calendar-stats-card',
      entities: [{ entity: 'tibber:consumption', state_class: 'total_increasing' }],
    };
    const el = await createCard(config, makeHass(TIBBER_DAILY, [TIBBER_META]));
    const root = await getFirstTableRoot(el);
    const cells = findRow(root, 'Tibber')!.querySelectorAll('.data-cell');
    expect(cells[1]?.textContent?.trim()).toBe('0.0');
  });

  it('renders a mean-only external statistic as measurement min/avg/max rows', async () => {
    const config: CardConfig = { type: 'custom:calendar-stats-card', entities: [{ entity: 'forecast:temp' }] };
    const daily = { 'forecast:temp': [{ start: jan1, end: jan2, min: 1, mean: 2, max: 3 }] };
    const el = await createCard(config, makeHass(daily, [FORECAST_META]));
    const root = await getFirstTableRoot(el);
    const row = findRow(root, 'Forecast [°C]');
    expect(row).toBeTruthy();
    expect(row!.querySelector('.sub-label')).toBeTruthy();
    expect(row!.querySelector('.data-cell.has-data')?.textContent?.trim()).toBe('1.0');
  });

  it('flags an id without statistics metadata with a warning prefix', async () => {
    const config: CardConfig = { type: 'custom:calendar-stats-card', entities: [{ entity: 'tibber:consumption' }] };
    const el = await createCard(config, makeHass(TIBBER_DAILY, []));
    const root = await getFirstTableRoot(el);
    const row = findRow(root, 'tibber:consumption');
    expect(row!.querySelector('.label-column')!.textContent).toMatch(/^⚠ /);
  });

  it('keeps the earliest-data probe as the first websocket call', async () => {
    const config: CardConfig = { type: 'custom:calendar-stats-card', entities: [{ entity: 'tibber:consumption' }] };
    const hass = makeHass(TIBBER_DAILY, [TIBBER_META]);
    const el = await createCard(config, hass);
    await getFirstTableRoot(el);
    const send = hass.connection.sendMessagePromise as ReturnType<typeof vi.fn>;
    const first = send.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(first['type']).toBe('recorder/statistics_during_period');
    expect(first['period']).toBe('month');
    const metaCalls = send.mock.calls.filter((c) => (c[0] as Record<string, unknown>)['type'] === 'recorder/get_statistics_metadata');
    expect(metaCalls.length).toBeGreaterThan(0);
    expect((metaCalls[0]![0] as Record<string, unknown>)['statistic_ids']).toEqual(['tibber:consumption']);
  });

  it('lets an external predecessor inherit the main entity\'s resolved kind when the row sets none', async () => {
    const config: CardConfig = {
      type: 'custom:calendar-stats-card',
      entities: [{
        entity: 'sensor.rain',
        predecessors: [{ entity: 'wetter_xls:niederschlag', replaced_on: `${year}-01-03` }],
      }],
    };
    const states: HomeAssistant['states'] = {
      'sensor.rain': {
        entity_id: 'sensor.rain',
        state: '0',
        attributes: { state_class: 'total_increasing', unit_of_measurement: 'mm', friendly_name: 'Rain' },
      },
    };
    const predMeta: StatisticMetaEntry = {
      statistic_id: 'wetter_xls:niederschlag',
      statistics_unit_of_measurement: 'mm',
      unit_class: 'precipitation',
      has_sum: true,
      mean_type: 0,
      name: 'Niederschlag',
      source: 'wetter_xls',
    };
    const rainMeta: StatisticMetaEntry = { ...predMeta, statistic_id: 'sensor.rain', name: null, source: 'recorder' };
    const daily = {
      'wetter_xls:niederschlag': [
        { start: dec31prev, end: jan1, sum: 0 },
        { start: jan1, end: jan2, sum: 10 },
        { start: jan2, end: jan3, sum: 7 },
      ],
      'sensor.rain': [{ start: jan3, end: jan3 + 1, sum: 0 }],
    };
    const el = await createCard(config, makeHass(daily, [predMeta, rainMeta], states));
    const root = await getFirstTableRoot(el);
    const cells = findRow(root, 'Rain [mm]')!.querySelectorAll('.data-cell');
    expect(cells[0]?.textContent?.trim()).toBe('10.0');
    // Inherited total_increasing clamps the predecessor's negative delta.
    expect(cells[1]?.textContent?.trim()).toBe('0.0');
  });

  it('applies the row state_class to an external predecessor', async () => {
    const config: CardConfig = {
      type: 'custom:calendar-stats-card',
      entities: [{
        entity: 'sensor.main',
        state_class: 'total_increasing',
        predecessors: [{ entity: 'tibber:consumption', replaced_on: `${year}-01-03` }],
      }],
    };
    const states: HomeAssistant['states'] = {
      'sensor.main': {
        entity_id: 'sensor.main',
        state: '0',
        attributes: { state_class: 'total_increasing', unit_of_measurement: 'kWh', friendly_name: 'Main' },
      },
    };
    const mainMeta: StatisticMetaEntry = { ...TIBBER_META, statistic_id: 'sensor.main', name: null, source: 'recorder' };
    const daily = { ...TIBBER_DAILY, 'sensor.main': [{ start: jan3, end: jan3 + 1, sum: 0 }] };
    const el = await createCard(config, makeHass(daily, [TIBBER_META, mainMeta], states));
    const root = await getFirstTableRoot(el);
    const cells = findRow(root, 'Main [kWh]')!.querySelectorAll('.data-cell');
    expect(cells[0]?.textContent?.trim()).toBe('10.0');
    expect(cells[1]?.textContent?.trim()).toBe('0.0');
  });
});
