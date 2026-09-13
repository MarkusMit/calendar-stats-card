import type { ThresholdRule, ThresholdLegendGroup } from '../types/card-config';

/**
 * Collects the threshold rules a table's cells triggered, grouped by entity
 * row, and reports them only when they actually changed.
 *
 * Rendering calls `add` once per coloured cell and `updated()` asks after every
 * render, so the comparison walks the collected groups in place: the reported
 * list is built only when it differs from the last one.
 */
export class ThresholdLegendCollector {
  private groups = new Map<number, { label: string; rules: Set<ThresholdRule> }>();
  private reported: ThresholdLegendGroup[] = [];

  /** Starts a fresh collection. Called at the top of a render. */
  reset(): void {
    this.groups.clear();
  }

  add(rowIndex: number, label: string, rule: ThresholdRule): void {
    let group = this.groups.get(rowIndex);
    if (!group) {
      group = { label, rules: new Set() };
      this.groups.set(rowIndex, group);
    }
    group.rules.add(rule);
  }

  /**
   * The collected groups if they differ from the previous report, else null.
   *
   * Rows come out in config order without sorting: a render walks the entity
   * configs ascending, so the map's insertion order is already that order.
   */
  changes(): ThresholdLegendGroup[] | null {
    if (!this.differs()) return null;
    this.reported = [...this.groups.values()].map((g) => ({ label: g.label, rules: [...g.rules] }));
    return this.reported;
  }

  private differs(): boolean {
    if (this.groups.size !== this.reported.length) return true;
    let row = 0;
    for (const group of this.groups.values()) {
      const previous = this.reported[row++]!;
      if (previous.label !== group.label || previous.rules.length !== group.rules.size) return true;
      let index = 0;
      for (const rule of group.rules) {
        if (previous.rules[index++] !== rule) return true;
      }
    }
    return false;
  }
}
