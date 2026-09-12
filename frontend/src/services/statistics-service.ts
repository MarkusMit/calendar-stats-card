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

/** One entry of `recorder/get_statistics_metadata` / `recorder/list_statistic_ids`.
 *  `mean_type`: 0 none, 1 arithmetic, 2 circular. Values from
 *  `statistics_during_period` arrive in `statistics_unit_of_measurement`. */
export type StatisticMetaEntry = {
  statistic_id: string;
  statistics_unit_of_measurement: string | null;
  display_unit_of_measurement?: string | null;
  unit_class: string | null;
  has_sum: boolean;
  mean_type: number;
  name?: string | null;
  source: string;
};

export type StatisticsMetadataResult = {
  earliestYear: number;
  earliestMonth: number;
};


export class StatisticsService {
  /** Metadata responses keyed by sorted, deduplicated id list. */
  private readonly _metadataCache = new Map<string, Promise<Map<string, StatisticMetaEntry>>>();

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

  /**
   * Fetch statistics metadata for the given ids, keyed by `statistic_id`.
   * Cached per id set for the service's lifetime; a rejected call is evicted
   * so the next request retries.
   */
  fetchStatisticsMetadata(
    hass: HomeAssistant,
    ids: string[],
  ): Promise<Map<string, StatisticMetaEntry>> {
    const unique = [...new Set(ids)].sort();
    const key = unique.join('\n');
    const cached = this._metadataCache.get(key);
    if (cached) return cached;

    const pending = hass.connection
      .sendMessagePromise<unknown>({ type: 'recorder/get_statistics_metadata', statistic_ids: unique })
      .then((res) => {
        const map = new Map<string, StatisticMetaEntry>();
        if (Array.isArray(res)) {
          for (const entry of res as StatisticMetaEntry[]) map.set(entry.statistic_id, entry);
        }
        return map;
      })
      .catch((err: unknown) => {
        this._metadataCache.delete(key);
        throw err;
      });
    this._metadataCache.set(key, pending);
    return pending;
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
