import type { MonthAnchor } from '../types/statistics';

const KEY_PREFIX = 'calendar-stats-card:earliest:';

/**
 * Storage key for one row set. Sorted so the same entities in a different
 * config order share an entry, and scoped to the exact set so adding or
 * removing a row cannot reuse the previous answer.
 */
export function earliestCacheKey(entityIds: string[]): string {
  return `${KEY_PREFIX}${[...entityIds].sort().join(',')}`;
}

/**
 * The cached first recorded month, or null when absent or unreadable.
 *
 * Caching is sound because Home Assistant never purges long-term statistics:
 * the first recorded month only moves when statistics are deleted or the row
 * set changes, and the probe that runs alongside corrects the value either way.
 */
export function readCachedEarliest(key: string): MonthAnchor | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return null; // storage disabled or blocked
  }
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<MonthAnchor>;
    const { year, month } = parsed;
    if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
    return { year: year as number, month: month as number };
  } catch {
    return null; // malformed entry
  }
}

export function writeCachedEarliest(key: string, value: MonthAnchor): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the probe result still applies to this session.
  }
}
