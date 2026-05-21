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

describe('StatisticsService.fetchHourlyStats', () => {
  it('sends recorder/statistics_during_period with period:hour', async () => {
    const send = vi.fn().mockResolvedValue({});
    const hass = makeHass('2026.5.0', send);
    const svc = new StatisticsService();
    await svc.fetchHourlyStats(hass, ENTITY_IDS, START, END);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'recorder/statistics_during_period', period: 'hour', statistic_ids: ENTITY_IDS }),
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

describe('StatisticsService.getStatisticsMetadata', () => {
  it('sends recorder/get_statistics_metadata and returns earliest start', async () => {
    const now = Date.now();
    const older = now - 1_000_000;
    const send = vi.fn().mockResolvedValue([
      { statistic_id: 'sensor.temp', statistics_unit: '°C', has_mean: true, start: now },
      { statistic_id: 'sensor.rain', statistics_unit: 'mm', has_mean: false, start: older },
    ]);
    const hass = makeHass('2026.5.0', send);
    const svc = new StatisticsService();
    const result = await svc.getStatisticsMetadata(hass, ENTITY_IDS);
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'recorder/get_statistics_metadata', statistic_ids: ENTITY_IDS }),
    );
    const earliestDate = new Date(older);
    expect(result.earliestYear).toBe(earliestDate.getFullYear());
    expect(result.earliestMonth).toBe(earliestDate.getMonth() + 1);
  });
});

describe('StatisticsService — mean_type vs has_mean', () => {
  it('uses has_mean param on HA < 2026.11', async () => {
    const send = vi.fn().mockResolvedValue({});
    const hass = makeHass('2026.5.0', send);
    const svc = new StatisticsService();
    await svc.fetchDailyStats(hass, ENTITY_IDS, START, END);
    const call = send.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(call, 'has_mean') || Object.prototype.hasOwnProperty.call(call, 'mean_type')).toBe(true);
    // On 2026.5 should use has_mean (legacy), not mean_type
    if (Object.prototype.hasOwnProperty.call(call, 'mean_type')) {
      // mean_type should not be present on HA < 2026.11
      expect(call['mean_type']).toBeUndefined();
    }
  });

  it('uses mean_type param on HA >= 2026.11', async () => {
    const send = vi.fn().mockResolvedValue({});
    const hass = makeHass('2026.11.0', send);
    const svc = new StatisticsService();
    await svc.fetchDailyStats(hass, ENTITY_IDS, START, END);
    const call = send.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(call, 'mean_type')).toBe(true);
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
