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


export class StatisticsService {
  async fetchDailyStats(
    hass: HomeAssistant,
    entityIds: string[],
    startTime: string,
    endTime: string,
  ): Promise<RawStats> {
    return hass.connection.sendMessagePromise<RawStats>({
      type: 'recorder/statistics_during_period',
      start_time: startTime,
      end_time: endTime,
      statistic_ids: entityIds,
      period: 'day',
      types: ['mean', 'min', 'max', 'sum'],
    });
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

  /**
   * Find the first recorded data point across the given entities by probing
   * monthly statistics over a wide window. `recorder/get_statistics_metadata`
   * does not expose an earliest-data timestamp, so the earliest monthly bucket
   * is the authoritative source. Returns null when no entity has statistics.
   */
  async findEarliestDataPoint(
    hass: HomeAssistant,
    entityIds: string[],
  ): Promise<StatisticsMetadataResult | null> {
    const stats = await this.fetchMonthlyStats(
      hass,
      entityIds,
      '2000-01-01T00:00:00Z',
      new Date().toISOString(),
    );

    let earliestMs: number | null = null;
    for (const entries of Object.values(stats ?? {})) {
      if (!Array.isArray(entries)) continue;
      for (const entry of entries) {
        if (entry?.start != null && (earliestMs === null || entry.start < earliestMs)) {
          earliestMs = entry.start;
        }
      }
    }
    if (earliestMs === null) return null;

    // Monthly buckets start at local midnight in the HA server timezone.
    const tz = hass.config.time_zone;
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' })
      .format(new Date(earliestMs));
    const [y, m] = parts.split('-').map(Number);
    return { earliestYear: y!, earliestMonth: m! };
  }
}
