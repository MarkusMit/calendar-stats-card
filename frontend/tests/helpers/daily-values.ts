import { DailyValueIndex } from '../../src/services/daily-value-index';
import type { DailyValue } from '../../src/types/statistics';

/**
 * Builds a `DailyValueIndex` from `rowKey::date` entries — the flat shape most
 * tests express their fixtures in. The date is the last `::`-separated segment,
 * so expression row keys that contain `::` themselves still split correctly.
 */
export function dailyIndex(entries: Iterable<readonly [string, DailyValue]> = []): DailyValueIndex {
  const index = new DailyValueIndex();
  for (const [key, value] of entries) {
    const sep = key.lastIndexOf('::');
    index.set(key.slice(0, sep), key.slice(sep + 2), value);
  }
  return index;
}
