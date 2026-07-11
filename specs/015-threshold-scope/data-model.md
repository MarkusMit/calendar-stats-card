# Data Model: Threshold Aggregation Scope

## ThresholdScope (new)

```ts
export type ThresholdScope = 'day' | 'month' | 'year';
```

Semantics: the aggregation period of the quantity a cell displays.
Sums define the period; statistics inherit the period of the values they summarize.

## ThresholdRule (extended)

```ts
export interface ThresholdRule {
  operator: ThresholdOperator;   // unchanged
  value: number;                 // unchanged
  scope?: ThresholdScope;        // NEW — absent/invalid ⇒ 'day'
  name?: string;                 // unchanged
  text_color?: string;           // unchanged
  background_color?: string;     // unchanged
}
```

Validation rules:

- `scope` is optional; absent means `day` (FR-001, FR-009).
- Unknown string values normalize to `day` at evaluation time (spec edge case); no error is raised.
- All other rule validation (colorless rules silently ignored, FR-011 of spec 007) is unchanged.

## resolveThreshold contract (extended)

```ts
export function resolveThreshold(
  cellValue: number,
  thresholds: ThresholdRule[],
  cellRole: CellRole,            // unchanged — statistic kind (min/avg/max/scalar/summary-*)
  cellScope: ThresholdScope,     // NEW — aggregation period of the cell
): ThresholdRule | undefined;
```

State/flow:

1. Filter: rule has a color AND `normalizeScope(rule.scope) === cellScope` AND operator/role match.
2. Closest-wins distance ranking among survivors (unchanged).
3. Tie-breaks: higher threshold value, then first-defined (unchanged).

`CellRole` and `ThresholdScope` are orthogonal: role encodes which statistic the cell shows, scope encodes over which period.

## Cell classification (per view)

| Cell | Role | Scope |
|---|---|---|
| Monthly view: measurement daily min/avg/max | `min/avg/max` | `day` |
| Monthly view: measurement monthly summary | `summary-min/avg/max` | `day` |
| Monthly view: cumulative/expression daily diff | `scalar` | `day` |
| Monthly view: cumulative monthly summary (Ø/↓/↑ of daily diffs) | `summary-scalar` | `day` |
| Monthly view: Total column (monthly total) | `scalar` | `month` (newly evaluated) |
| Yearly view: measurement month cells | `min/avg/max` | `day` |
| Yearly view: measurement year rollup | `summary-min/avg/max` | `day` |
| Yearly view: cumulative month cells (monthly totals) | `scalar` | `month` |
| Yearly view: cumulative year rollup (Ø/↓/↑ of monthly totals) | `summary-scalar` | `month` |
| Yearly view: Total column (yearly total) | `scalar` | `year` (newly evaluated) |
| Comparison: measurement values / cross-year avg | `min/avg/max` / `summary-*` | `day` |
| Comparison: cumulative values / cross-year avg | `scalar` / `summary-scalar` | `month` |
| Comparison: diff and average-deviation cells | — | never evaluated |

## Relationships

- `EntityRowConfig.thresholds` and `ExpressionRowConfig.thresholds` keep holding one flat `ThresholdRule[]`; rules of different scopes coexist in the same list.
- `ThresholdLegendGroup` is unchanged; a named rule of any scope enters the legend when it fires on a visible cell (FR-011).
