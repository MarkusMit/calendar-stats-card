import type { ThresholdRule, ThresholdLegendGroup } from '../types/card-config';

type RowGroups = Map<number, { label: string; rules: Set<ThresholdRule> }>;

/**
 * Collects the threshold rules a table's cells triggered, grouped by entity
 * row, and reports them only when they actually changed.
 *
 * Rules are kept per table section. A section whose inputs are unchanged is
 * skipped by `guard` and never re-reports, so its rules have to survive a
 * render it took no part in; only a section that renders again replaces its
 * own contribution.
 */
export class ThresholdLegendCollector {
  private sections = new Map<number, RowGroups>();
  private current: RowGroups | null = null;
  private reported: ThresholdLegendGroup[] = [];

  /** Starts collecting for one section, discarding what it contributed before. */
  beginSection(section: number): void {
    const rows: RowGroups = new Map();
    this.sections.set(section, rows);
    this.current = rows;
  }

  /** Forgets sections outside the current table; call before rendering it. */
  keepSections(count: number): void {
    for (const section of this.sections.keys()) {
      if (section >= count) this.sections.delete(section);
    }
  }

  add(rowIndex: number, label: string, rule: ThresholdRule): void {
    const rows = this.current;
    if (!rows) return;
    let group = rows.get(rowIndex);
    if (!group) {
      group = { label, rules: new Set() };
      rows.set(rowIndex, group);
    }
    group.rules.add(rule);
  }

  /**
   * Every section's rules merged by entity row, in config order, when they
   * differ from the previous report — else null.
   */
  changes(): ThresholdLegendGroup[] | null {
    const merged = new Map<number, { label: string; rules: Set<ThresholdRule> }>();
    for (const rows of this.sections.values()) {
      for (const [rowIndex, group] of rows) {
        const seen = merged.get(rowIndex);
        if (!seen) merged.set(rowIndex, { label: group.label, rules: new Set(group.rules) });
        else for (const rule of group.rules) seen.rules.add(rule);
      }
    }
    const current = [...merged.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, group]) => ({ label: group.label, rules: [...group.rules] }));

    if (!this.differs(current)) return null;
    this.reported = current;
    return current;
  }

  private differs(current: ThresholdLegendGroup[]): boolean {
    if (current.length !== this.reported.length) return true;
    for (let i = 0; i < current.length; i++) {
      const a = current[i]!;
      const b = this.reported[i]!;
      if (a.label !== b.label || a.rules.length !== b.rules.length) return true;
      for (let j = 0; j < a.rules.length; j++) {
        if (a.rules[j] !== b.rules[j]) return true;
      }
    }
    return false;
  }
}
