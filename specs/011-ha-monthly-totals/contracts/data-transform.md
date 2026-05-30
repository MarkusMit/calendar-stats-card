# Contract: `data-transform.ts` Behavioural Diff

## `transformMonthlyStats` — signature adds `viewingYear`, body changes

### Signature (before — feature 010)

```typescript
export function transformMonthlyStats(
  rawStats: RawStats,
  metadataMap: Record<string, EntityMetadata>,
  dailyValues: Map<string, DailyValue>,
  entityConfigs: EntityConfig[],
): Map<string, MonthlySummary>;
```

### Signature (after — feature 011, shipped in commit 3258cb5)

```typescript
export function transformMonthlyStats(
  rawStats: RawStats,
  metadataMap: Record<string, EntityMetadata>,
  dailyValues: Map<string, DailyValue>,
  entityConfigs: EntityConfig[],
  viewingYear: number,
): Map<string, MonthlySummary>;
```

The new 5th parameter, `viewingYear`, drives the lookup-only-entry filter: monthly raw entries from years earlier than `viewingYear` (i.e. the prev-December fetched as a lookup source for January's cross-year delta) are skipped when emitting summaries to the result map.
All call sites in `frontend/src/calendar-stats-card.ts` and `frontend/tests/` updated to pass the year.

### Before (post-feature-010)

For each entity row, for each monthly raw entry, compute the summary entirely from `dailyValues` via `computeMonthlySummaryFromDailyValues(...)`.
The monthly `entry.sum` payload was read only via `entry.start` (to derive `(year, month)` for iteration); the actual `sum` value was discarded.
`total` was derived by `allSums.reduce((a, b) => a + b, 0)` over per-day deltas.

### After (feature 011)

For each entity row, look up the entity's monthly raw entries from `rawStats`. Sort by `start`.
For each entry at index `i` representing month `m`:

```text
sumCurrent = entry.sum
sumPrev    = (i > 0 && sorted[i-1] represents month m-1) ? sorted[i-1].sum : undefined

if (sumCurrent === undefined):
    total = null
else if (sumPrev === undefined):
    total = sumCurrent            // first-tracked-month fallback (FR-006)
else:
    delta = sumCurrent - sumPrev
    if (meta.stateClass === 'total_increasing'):
        total = Math.max(0, delta)    // counter-reset clamp (FR-002a)
    else:                              // 'total' state class
        total = delta                  // legitimate negatives pass through (FR-002a)
```

Min/mean/max for cumulative entity rows continue to be derived via `computeMonthlySummaryFromDailyValues(...)` using per-row `show_zero` (feature 010 behaviour preserved).
Only the `total` field's derivation changes; everything else in the function is structurally identical.

Skip the prev-December entry (which is fetched only to enable the January cross-year delta) — it does NOT produce its own `MonthlySummary` entry in the returned map.
Detection: if the entry's year `< requested year` (or equivalently, if `(year, month)` falls outside the requested viewing year), do not emit a summary.

### Result map key

Unchanged: `rowSummaryKey(rowIndex, entityId, year, month)` from feature 010.

## Caller-side change: `calendar-stats-card.ts`

### Monthly fetch range extension (≈ line 219)

```typescript
// BEFORE
const startTime = `${year}-01-01T00:00:00Z`;
const endTime = `${year + 1}-01-01T00:00:00Z`;

const [dailyRaw, monthlyRaw] = await Promise.all([
  this._service.fetchDailyStats(this._hass, entityIds, dailyStartTime, endTime),
  this._service.fetchMonthlyStats(this._hass, entityIds, startTime, endTime),
]);

// AFTER
const monthlyStartTime = `${year - 1}-12-01T00:00:00Z`; // one extra month for cross-year delta
const startTime = `${year}-01-01T00:00:00Z`;             // still used by other code paths if any
const endTime = `${year + 1}-01-01T00:00:00Z`;

const [dailyRaw, monthlyRaw] = await Promise.all([
  this._service.fetchDailyStats(this._hass, entityIds, dailyStartTime, endTime),
  this._service.fetchMonthlyStats(this._hass, entityIds, monthlyStartTime, endTime),
]);
```

### Expression-row summary loop (≈ line 321) — UNCHANGED

Expression rows continue to use `collectDailySums(...)` + arithmetic sum for their totals (FR-008).
No edit.

### Current-month summary fill (≈ line 346) — UNCHANGED

This loop computes the in-progress current-month summary from daily values when HA's monthly-period statistics for the current month are not yet finalised.
It uses `computeMonthlySummaryFromDailyValues(...)` which still produces `total` via arithmetic daily-sum for the current month — accepted compromise: the rendered total for the **in-progress current month** continues to be an arithmetic sum of available daily deltas, because HA's monthly `sum` for an in-progress month may be partial or absent.

Document this as an explicit edge case: total for past complete months = HA-sum-delta; total for the in-progress current month = arithmetic daily sum (interim value; will become HA-sum-delta once the month closes and HA finalises its monthly statistic).

## Backward compatibility

None required.
Function signatures unchanged.
The card's public Lovelace configuration schema is unchanged.
The bundle's internal data flow is the only thing that shifts.
