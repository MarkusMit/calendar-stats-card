import type { DailyValue } from '../types/statistics';

/**
 * Daily values addressed by row key and date.
 *
 * Each row keeps its own date-keyed map. Rendering reads one row's whole month
 * at a time, so a flat `rowKey::date` map would compose a key string for every
 * cell of every render — and keep one such string resident per stored value.
 * Separate maps also let a row key contain `::` (expression rows do).
 */
export class DailyValueIndex {
  private readonly rows = new Map<string, Map<string, DailyValue>>();

  set(rowKey: string, date: string, value: DailyValue): void {
    let row = this.rows.get(rowKey);
    if (!row) {
      row = new Map();
      this.rows.set(rowKey, row);
    }
    row.set(date, value);
  }

  get(rowKey: string, date: string): DailyValue | undefined {
    return this.rows.get(rowKey)?.get(date);
  }

  /** One row's days — the lookup for callers that read many dates of one row. */
  row(rowKey: string): ReadonlyMap<string, DailyValue> | undefined {
    return this.rows.get(rowKey);
  }

  rowKeys(): IterableIterator<string> {
    return this.rows.keys();
  }

  /** Independent copy, inner maps included, so the copy can be written freely. */
  clone(): DailyValueIndex {
    const copy = new DailyValueIndex();
    for (const [rowKey, row] of this.rows) copy.rows.set(rowKey, new Map(row));
    return copy;
  }
}
