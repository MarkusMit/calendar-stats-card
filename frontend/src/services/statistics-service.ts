import type { HomeAssistant } from '../types/ha-types';

export type RawStatEntry = {
  start: number;
  end: number;
  mean?: number;
  min?: number;
  max?: number;
  sum?: number;
  state?: number;
};

export type RawStats = Record<string, RawStatEntry[]>;

export type StatisticMetaEntry = {
  statistic_id: string;
  statistics_unit?: string;
  start?: number;
  has_mean?: boolean;
  mean_type?: number;
  [key: string]: unknown;
};

export type StatisticsMetadataResult = {
  earliestYear: number;
  earliestMonth: number;
};

function parseVersion(version: string): [number, number, number] {
  const parts = version.split('.').map(Number);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

function isGE2026_11(version: string): boolean {
  const [major, minor] = parseVersion(version);
  return major > 2026 || (major === 2026 && minor >= 11);
}

export class StatisticsService {
  async fetchDailyStats(
    hass: HomeAssistant,
    entityIds: string[],
    startTime: string,
    endTime: string,
  ): Promise<RawStats> {
    const useNewApi = isGE2026_11(hass.config.version);
    const msg: Record<string, unknown> = {
      type: 'recorder/statistics_during_period',
      start_time: startTime,
      end_time: endTime,
      statistic_ids: entityIds,
      period: 'day',
      types: ['mean', 'min', 'max', 'sum'],
    };
    if (useNewApi) {
      msg['mean_type'] = 1;
    } else {
      msg['has_mean'] = true;
    }
    return hass.connection.sendMessagePromise<RawStats>(msg);
  }

  async fetchMonthlyStats(
    hass: HomeAssistant,
    entityIds: string[],
    startTime: string,
    endTime: string,
  ): Promise<RawStats> {
    const msg: Record<string, unknown> = {
      type: 'recorder/statistics_during_period',
      start_time: startTime,
      end_time: endTime,
      statistic_ids: entityIds,
      period: 'month',
      types: ['mean', 'min', 'max', 'sum'],
    };
    return hass.connection.sendMessagePromise<RawStats>(msg);
  }

  async fetchHourlyStats(
    hass: HomeAssistant,
    entityIds: string[],
    startTime: string,
    endTime: string,
  ): Promise<RawStats> {
    const msg: Record<string, unknown> = {
      type: 'recorder/statistics_during_period',
      start_time: startTime,
      end_time: endTime,
      statistic_ids: entityIds,
      period: 'hour',
      types: ['mean', 'min', 'max', 'sum'],
    };
    return hass.connection.sendMessagePromise<RawStats>(msg);
  }

  async listStatisticIds(hass: HomeAssistant): Promise<StatisticMetaEntry[]> {
    return hass.connection.sendMessagePromise<StatisticMetaEntry[]>({
      type: 'recorder/list_statistic_ids',
    });
  }

  async getStatisticsMetadata(
    hass: HomeAssistant,
    entityIds: string[],
  ): Promise<StatisticsMetadataResult> {
    const entries = await hass.connection.sendMessagePromise<StatisticMetaEntry[]>({
      type: 'recorder/get_statistics_metadata',
      statistic_ids: entityIds,
    });

    let earliestMs: number | null = null;
    for (const entry of entries) {
      if (entry.start != null) {
        if (earliestMs === null || entry.start < earliestMs) {
          earliestMs = entry.start;
        }
      }
    }

    if (earliestMs === null) {
      const now = new Date();
      return { earliestYear: now.getFullYear(), earliestMonth: now.getMonth() + 1 };
    }

    const d = new Date(earliestMs);
    return { earliestYear: d.getFullYear(), earliestMonth: d.getMonth() + 1 };
  }
}
