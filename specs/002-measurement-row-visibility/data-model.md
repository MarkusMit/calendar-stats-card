# Data Model: Measurement Row Visibility

**Feature**: 002-measurement-row-visibility
**Date**: 2026-05-24

## EntityRowConfig (extended)

Adds three optional boolean fields alongside the existing `show_zero`:

| Field | Type | Default | Applies to |
|-------|------|---------|------------|
| `show_min` | `boolean?` | `true` | Measurement: min sub-row + summary. Cumulative: min value in summary. |
| `show_avg` | `boolean?` | `true` | Measurement: avg sub-row + summary. Cumulative: avg value in summary. |
| `show_max` | `boolean?` | `true` | Measurement: max sub-row + summary. Cumulative: max value in summary. |

`ExpressionRowConfig`: fields NOT added — expression rows are single-value and have no min/avg/max concept (FR-002).

## Rendering Rules

### Measurement entities (`stateClass === 'measurement'`)

| Condition | Row count | rowspan | Label cell |
|-----------|-----------|---------|------------|
| All three visible (default) | 3 | 3 | Normal |
| 1–2 rows visible | 1–2 | 1–2 | Normal |
| All three hidden | 0 data rows | 1 (label-only) | colspan spans label + sub-label + day columns |

**Row render condition**:
- Min row: `cfg.show_min !== false`
- Avg row: `cfg.show_avg !== false`
- Max row: `cfg.show_max !== false`

**Summary column**: only values for visible rows appear; absent rows show nothing.

### Cumulative entities (`stateClass` in `['total_increasing', 'total']`)

Day column: always shows daily sum — unaffected by `show_min/avg/max`.

Summary column (`div.cumul-summary`):
- Mean value: rendered when `cfg.show_avg !== false`
- Min arrow (`↓`): rendered when `cfg.show_min !== false`
- Max arrow (`↑`): rendered when `cfg.show_max !== false`
- `cumul-minmax` div: rendered only when at least one of min/max is visible
- If all three hidden: summary cell is blank (empty string)

Total column: always shown — not controlled by these flags.

### Expression rows

`show_min`, `show_avg`, `show_max` are absent from `ExpressionRowConfig` — no rendering change.
