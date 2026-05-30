# Data Model: Reconcile HA Monthly Stats With Cumulative Totals

## Schema diff

**None at the public configuration level** (FR-004 — no card-config schema change).

Internal data structures touched:

## `RawStatEntry` (existing)

Defined in `frontend/src/services/statistics-service.ts:3`:

```typescript
export type RawStatEntry = {
  start: number;
  end: number;
  mean?: number;
  min?: number;
  max?: number;
  sum?: number;
  state?: number;
};
```

**No type change.** Feature 011 starts *reading* the `sum` field on monthly-period entries (previously discarded — only `start` was consumed for iteration).
For `total_increasing` and `total` state classes, `sum` is HA's cumulative-since-tracking-began value at the end of the period.

## `MonthlySummary.total` (existing, semantic shift)

Defined in `frontend/src/types/statistics.ts`:

```typescript
export interface MonthlySummary {
  entityId: string;
  year: number;
  month: number;
  min: number | null;
  mean: number | null;
  max: number | null;
  total: number | null;
}
```

**No type change. `total` field semantics change for cumulative entity rows**:

| Row type | `total` derivation BEFORE feature 011 | `total` derivation AFTER feature 011 |
|---|---|---|
| Cumulative entity (`total_increasing`) | Arithmetic sum of per-day deltas in `dailyValues` map | `Math.max(0, HA_monthly_sum[month] − HA_monthly_sum[prev_month])` from `rawStats`; `HA_monthly_sum[earliest]` fallback if no prev entry |
| Cumulative entity (`total`) | Arithmetic sum of per-day deltas | `HA_monthly_sum[month] − HA_monthly_sum[prev_month]`; negative passed through as-is; `HA_monthly_sum[earliest]` fallback |
| Expression row | Arithmetic sum of per-day evaluated values | **Unchanged** — still arithmetic sum (no HA monthly stat for formulas; FR-008) |
| Measurement row | `null` (no total column rendered) | **Unchanged** — still `null` |

**No metadata field change.** The clamp decision depends on `EntityMetadata.stateClass` which is already populated from `hass.states[id].attributes.state_class`.

## `null` semantics (CHK13-derived FR-006 carry-over from feature 010)

When the HA monthly `sum` field is missing for the requested month (`entry.sum === undefined`), the resulting `MonthlySummary.total` is `null`.
Renderer convention (existing): cells with `null` numeric value render empty (no content, no `—` dash).

This `null` convention also applies when:
- The entity has no rawStats entry for that month at all (already true today).
- The prev-month sum is missing AND it is not the first tracked month (gap in HA statistics; treat as "first month for delta" per Research Q2).

## Affected runtime entities (summary)

| Entity | Field | Before | After |
|---|---|---|---|
| `RawStatEntry` | `sum?: number` | populated by HA, ignored on monthly path | populated by HA, **read** on monthly path to compute total |
| `MonthlySummary` | `total: number \| null` for cumulative rows | arithmetic-sum-of-daily-deltas | HA `sum`-delta with clamp/fallback per state class |
| `MonthlySummary` | other fields (`min`/`mean`/`max`) | unchanged | unchanged |
| `EntityMetadata` | `stateClass` | already used by data-transform | now also drives the negative-delta clamp decision |
