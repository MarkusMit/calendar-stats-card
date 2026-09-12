import { describe, it, expect, vi } from 'vitest';
import { StatisticsService } from '../../../src/services/statistics-service';
import type { HomeAssistant } from '../../../src/types/ha-types';

function makeHass(version: string, sendFn: (msg: Record<string, unknown>) => Promise<unknown>): HomeAssistant {
  return {
    config: { version, time_zone: 'UTC' },
    states: {},
    connection: {
      sendMessagePromise: sendFn as <T>(msg: Record<string, unknown>) => Promise<T>,
    },
    language: 'en',
  };
}

const ENTITY_IDS = ['sensor.temp', 'sensor.rain'];
const START = '2025-01-01T00:00:00Z';
const END = '2026-01-01T00:00:00Z';

describe('StatisticsService.fetchDailyStats', () => {
  it('sends recorder/statistics_during_period with period:day', async () => {
    const send = vi.fn().mockResolvedValue({});
    const hass = makeHass('2026.5.0', send);
    const svc = new StatisticsService();
    await svc.fetchDailyStats(hass, ENTITY_IDS, START, END);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'recorder/statistics_during_period', period: 'day', statistic_ids: ENTITY_IDS }),
    );
  });
});

describe('StatisticsService.fetchMonthlyStats', () => {
  it('sends recorder/statistics_during_period with period:month', async () => {
    const send = vi.fn().mockResolvedValue({});
    const hass = makeHass('2026.5.0', send);
    const svc = new StatisticsService();
    await svc.fetchMonthlyStats(hass, ENTITY_IDS, START, END);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'recorder/statistics_during_period', period: 'month', statistic_ids: ENTITY_IDS }),
    );
  });
});

describe('StatisticsService.listStatisticIds', () => {
  it('sends recorder/list_statistic_ids', async () => {
    const send = vi.fn().mockResolvedValue([]);
    const hass = makeHass('2026.5.0', send);
    const svc = new StatisticsService();
    await svc.listStatisticIds(hass);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ type: 'recorder/list_statistic_ids' }));
  });
});

describe('StatisticsService.findEarliestDataPoint', () => {
  it('probes monthly statistics over a wide window and returns the earliest bucket', async () => {
    const t1 = Date.UTC(2024, 3, 1); // Apr 2024
    const t2 = Date.UTC(2021, 8, 1); // Sep 2021 — earliest
    const send = vi.fn().mockResolvedValue({
      'sensor.temp': [{ start: t1, end: t1 + 1, mean: 5 }],
      'sensor.rain': [{ start: t2, end: t2 + 1, sum: 3 }, { start: t1, end: t1 + 1, sum: 9 }],
    });
    const hass = makeHass('2026.5.0', send);
    const svc = new StatisticsService();
    const result = await svc.findEarliestDataPoint(hass, ENTITY_IDS);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'recorder/statistics_during_period', period: 'month', statistic_ids: ENTITY_IDS }),
    );
    expect(result).toEqual({ earliestYear: 2021, earliestMonth: 9 });
  });

  it('returns null when no entity has any statistics', async () => {
    const send = vi.fn().mockResolvedValue({});
    const hass = makeHass('2026.5.0', send);
    const svc = new StatisticsService();
    expect(await svc.findEarliestDataPoint(hass, ENTITY_IDS)).toBeNull();
  });
});

describe('StatisticsService — fetchDailyStats request shape', () => {
  it('sends types array without has_mean or mean_type', async () => {
    const send = vi.fn().mockResolvedValue({});
    const hass = makeHass('2026.5.0', send);
    const svc = new StatisticsService();
    await svc.fetchDailyStats(hass, ENTITY_IDS, START, END);
    const call = send.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(call['types']).toEqual(['mean', 'min', 'max', 'sum', 'change']);
    expect(Object.prototype.hasOwnProperty.call(call, 'has_mean')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(call, 'mean_type')).toBe(false);
  });
});

describe('StatisticsService — WS failure', () => {
  it('rejects with error on WS failure', async () => {
    const send = vi.fn().mockRejectedValue(new Error('WS error'));
    const hass = makeHass('2026.5.0', send);
    const svc = new StatisticsService();
    await expect(svc.fetchDailyStats(hass, ENTITY_IDS, START, END)).rejects.toThrow('WS error');
  });
});

describe('StatisticsService.fetchStatisticsMetadata', () => {
  const META = [
    { statistic_id: 'sensor.temp', statistics_unit_of_measurement: '°C', unit_class: 'temperature', has_sum: false, mean_type: 1, name: null, source: 'recorder' },
    { statistic_id: 'tibber:consumption', statistics_unit_of_measurement: 'kWh', unit_class: 'energy', has_sum: true, mean_type: 0, name: 'Tibber', source: 'tibber' },
  ];

  it('sends recorder/get_statistics_metadata with statistic_ids and returns a map keyed by statistic_id', async () => {
    const send = vi.fn().mockResolvedValue(META);
    const hass = makeHass('2026.5.0', send);
    const svc = new StatisticsService();
    const result = await svc.fetchStatisticsMetadata(hass, ['sensor.temp', 'tibber:consumption']);
    expect(send).toHaveBeenCalledWith({
      type: 'recorder/get_statistics_metadata',
      statistic_ids: ['sensor.temp', 'tibber:consumption'],
    });
    expect(result.get('tibber:consumption')?.name).toBe('Tibber');
    expect(result.get('sensor.temp')?.mean_type).toBe(1);
    expect(result.size).toBe(2);
  });

  it('returns an empty map for a non-array response', async () => {
    const send = vi.fn().mockResolvedValue({});
    const hass = makeHass('2026.5.0', send);
    const svc = new StatisticsService();
    const result = await svc.fetchStatisticsMetadata(hass, ENTITY_IDS);
    expect(result.size).toBe(0);
  });

  it('reuses the cached response for the same id set regardless of order or duplicates', async () => {
    const send = vi.fn().mockResolvedValue(META);
    const hass = makeHass('2026.5.0', send);
    const svc = new StatisticsService();
    await svc.fetchStatisticsMetadata(hass, ['sensor.temp', 'tibber:consumption']);
    await svc.fetchStatisticsMetadata(hass, ['tibber:consumption', 'sensor.temp', 'sensor.temp']);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('fetches again for a different id set', async () => {
    const send = vi.fn().mockResolvedValue(META);
    const hass = makeHass('2026.5.0', send);
    const svc = new StatisticsService();
    await svc.fetchStatisticsMetadata(hass, ['sensor.temp']);
    await svc.fetchStatisticsMetadata(hass, ['sensor.temp', 'tibber:consumption']);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('retries after a rejected call instead of caching the failure', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('WS error')).mockResolvedValue(META);
    const hass = makeHass('2026.5.0', send);
    const svc = new StatisticsService();
    await expect(svc.fetchStatisticsMetadata(hass, ENTITY_IDS)).rejects.toThrow('WS error');
    const result = await svc.fetchStatisticsMetadata(hass, ENTITY_IDS);
    expect(send).toHaveBeenCalledTimes(2);
    expect(result.size).toBe(2);
  });
});
