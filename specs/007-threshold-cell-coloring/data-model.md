# Data Model: Threshold-Based Cell Coloring

## New Interface (`frontend/src/types/card-config.ts`)

### ThresholdOperator

```typescript
export type ThresholdOperator =
  | 'above'          // cell value > threshold value
  | 'equals-above'   // cell value >= threshold value
  | 'equals-below'   // cell value <= threshold value
  | 'below'          // cell value < threshold value
  | 'not-below'      // min/scalar cells only: cell value >= threshold value
  | 'not-above';     // max/scalar cells only: cell value <= threshold value
```

### ThresholdRule

```typescript
export interface ThresholdRule {
  operator: ThresholdOperator;
  value: number;
  name?: string;           // Display name for legend entry
  text_color?: string;     // CSS color value — same format as EntityRowConfig.text_color
  background_color?: string;
}
```

A rule is **valid** (eligible for matching and legend) only when at least one of `text_color` or `background_color` is defined. Rules with no color fields are silently ignored.

### EntityRowConfig (modified — additive only)

```typescript
export interface EntityRowConfig {
  // ... existing fields unchanged ...
  text_color?: string;       // unchanged from spec 003
  background_color?: string; // unchanged from spec 003
  thresholds?: ThresholdRule[];  // NEW
}
```

### ExpressionRowConfig (modified — additive only)

```typescript
export interface ExpressionRowConfig {
  // ... existing fields unchanged ...
  text_color?: string;       // unchanged from spec 003
  background_color?: string; // unchanged from spec 003
  thresholds?: ThresholdRule[];  // NEW
}
```

No breaking changes. Existing configs with `text_color`/`background_color` continue to work as-is.

## Cell Role Taxonomy

Used by `resolveThreshold` to filter `not-below` and `not-above` operators:

| Role | When assigned | `not-below` fires? | `not-above` fires? |
|------|--------------|-------------------|-------------------|
| `'min'` | Daily min sub-row cell (measurement entity) | ✓ | ✗ |
| `'avg'` | Daily avg sub-row cell (measurement entity) | ✗ | ✗ |
| `'max'` | Daily max sub-row cell (measurement entity) | ✗ | ✓ |
| `'scalar'` | Daily cell for cumulative/expression entity | ✓ | ✓ |
| `'summary-min'` | Monthly summary min cell | ✓ | ✗ |
| `'summary-avg'` | Monthly summary avg cell | ✗ | ✗ |
| `'summary-max'` | Monthly summary max cell | ✗ | ✓ |
| `'summary-scalar'` | Monthly summary cell for cumulative entity | ✓ | ✓ |

```typescript
export type CellRole =
  | 'min' | 'avg' | 'max' | 'scalar'
  | 'summary-min' | 'summary-avg' | 'summary-max' | 'summary-scalar';
```

## New Service (`frontend/src/services/threshold-resolver.ts`)

### resolveThreshold

```typescript
export function resolveThreshold(
  cellValue: number,
  thresholds: ThresholdRule[],
  cellRole: CellRole,
): ThresholdRule | undefined
```

**Algorithm**:

1. **Filter invalid rules**: exclude rules where `!t.text_color && !t.background_color`.
2. **Filter by cell role**:
   - Exclude `not-below` for roles `'avg'`, `'max'`, `'summary-avg'`, `'summary-max'`.
   - Exclude `not-above` for roles `'min'`, `'avg'`, `'summary-min'`, `'summary-avg'`.
3. **Evaluate operator**:
   - `above`: `cellValue > t.value`
   - `equals-above`: `cellValue >= t.value`
   - `equals-below`: `cellValue <= t.value`
   - `below`: `cellValue < t.value`
   - `not-below`: `cellValue >= t.value`
   - `not-above`: `cellValue <= t.value`
4. **Select closest**: among matching rules, pick `min(|cellValue - t.value|)`.
5. **Tie-break (primary)**: equidistant → higher `t.value` wins.
6. **Tie-break (secondary)**: same distance AND same `t.value` → first-defined rule (config definition order) wins.
7. **Return**: winning rule or `undefined`.

### buildCellStyle

```typescript
export function buildCellStyle(
  staticTextColor: string | undefined,
  staticBgColor: string | undefined,
  threshold: ThresholdRule | undefined,
): string | undefined
```

Merges static and threshold colors into an inline CSS style string:
- Start: `textColor = staticTextColor`, `bgColor = staticBgColor`.
- If threshold matched: override `textColor` with `threshold.text_color` if defined; override `bgColor` with `threshold.background_color` if defined.
- Build: `["color:X", "background-color:Y"].join(';')` — return `undefined` if both empty.

## Legend Entry (derived)

Not stored — computed in `calendar-stats-card.ts` render method from triggered rules only.

```typescript
type LegendEntry = {
  name: string;
  text_color?: string;
  background_color?: string;
};
```

**Triggered rule accumulation** (in year-table / monthly-table):
- During each render pass, every non-`undefined` result from `resolveThreshold` is a triggered `ThresholdRule`.
- Accumulate triggered rules in first-seen order using object-identity deduplication (same rule object matched on multiple cells is added only once).
- After rendering, dispatch a `thresholds-applied` CustomEvent (`bubbles: true, composed: true`) with `detail: { rules: ThresholdRule[] }` containing the accumulated list.

**Communication to card**:
- `calendar-stats-card` listens for `thresholds-applied` on its shadow root.
- On receipt, stores `detail.rules` in `@state() private _triggeredThresholds: ThresholdRule[]`.
- This reactive state property triggers a re-render that includes the legend.

**Legend collection algorithm** (from triggered rules):
1. Receive `triggeredRules: ThresholdRule[]` — rules that fired during the last render, in first-seen order.
2. For each rule where `t.name` defined AND (`t.text_color` OR `t.background_color`):
   - If name not already in seen set: add entry, add name to seen set.
3. If resulting list non-empty: render legend; otherwise suppress legend entirely.

## i18n Keys (new)

`frontend/src/translations/en.json`: add `"legend": { "title": "Legend" }`  
`frontend/src/translations/de.json`: add `"legend": { "title": "Legende" }`
