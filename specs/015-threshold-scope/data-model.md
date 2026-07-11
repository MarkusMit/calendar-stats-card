# Data Model: Threshold Aggregation Scope (per-period values revision)

## ThresholdScope (internal only)

```ts
export type ThresholdScope = 'day' | 'month' | 'year';
```

Semantics: the aggregation period of the quantity a cell displays.
Sums define the period; statistics inherit the period of the values they summarize.
`ThresholdScope` classifies CELLS internally; it is NOT a config field.

## ThresholdRule (extended)

```ts
export interface ThresholdRule {
  operator: ThresholdOperator;   // unchanged — shared across all periods
  value?: number;                // day threshold (now optional)
  value_month?: number;          // NEW — month threshold
  value_year?: number;           // NEW — year threshold
  name?: string;                 // unchanged — one legend entry per rule
  text_color?: string;           // unchanged
  background_color?: string;     // unchanged
}
```

Validation rules:

- Each period threshold is optional; a rule with none of the three is silently ignored (like a colorless rule; FR-001).
- A rule participates in a cell's evaluation only if it defines a threshold for that cell's period (FR-002).
- Colorless-rule handling (spec 007 FR-011) unchanged.

## resolveThreshold contract

```ts
export function resolveThreshold(
  cellValue: number,
  thresholds: ThresholdRule[],
  cellRole: CellRole,            // unchanged — statistic kind (min/avg/max/scalar/summary-*)
  cellScope: ThresholdScope = 'day', // aggregation period of the cell
): ThresholdRule | undefined;
```

Flow:

1. Per rule, look up the threshold for `cellScope`: `value` (day) / `value_month` / `value_year`; absent → rule skipped.
2. Filter: rule has a color AND operator/role match against the period threshold.
3. Closest-wins distance ranking uses the period threshold (unchanged algorithm).
4. Tie-breaks: higher period-threshold value, then first-defined (unchanged).

`CellRole` and `ThresholdScope` stay orthogonal: role encodes which statistic the cell shows, scope encodes over which period.

## Cell classification (per view) — unchanged by the revision

| Cell | Role | Scope |
|---|---|---|
| Monthly view: measurement daily min/avg/max | `min/avg/max` | `day` |
| Monthly view: measurement monthly summary | `summary-min/avg/max` | `day` |
| Monthly view: cumulative/expression daily diff | `scalar` | `day` |
| Monthly view: cumulative monthly summary (Ø/↓/↑ of daily diffs) | `summary-scalar` | `day` |
| Monthly view: Total column (monthly total) | `scalar` | `month` |
| Yearly view: measurement month cells | `min/avg/max` | `day` |
| Yearly view: measurement year rollup | `summary-min/avg/max` | `day` |
| Yearly view: cumulative month cells (monthly totals) | `scalar` | `month` |
| Yearly view: cumulative year rollup (Ø/↓/↑ of monthly totals) | `summary-scalar` | `month` |
| Yearly view: Total column (yearly total) | `scalar` | `year` |
| Comparison: measurement values / cross-year avg | `min/avg/max` / `summary-*` | `day` |
| Comparison: cumulative values / cross-year avg | `scalar` / `summary-scalar` | `month` |
| Comparison: diff and average-deviation cells | — | never evaluated |

## Relationships

- `EntityRowConfig.thresholds` / `ExpressionRowConfig.thresholds`: one flat `ThresholdRule[]`; each rule may span all three periods.
- `ThresholdLegendGroup` unchanged; a named rule enters the legend when any of its period thresholds fires on a visible cell (FR-011), deduped per rule.
