# Phase 0 Research: Reconcile HA Monthly Stats With Cumulative Totals

## Q1 — How is the monthly fetch range extended to cover the prev-month for cross-year delta?

**Decision**: Change the monthly `fetchMonthlyStats` call's `startTime` parameter in `calendar-stats-card.ts:219` from `${year}-01-01T00:00:00Z` to `${year - 1}-12-01T00:00:00Z`.
The `endTime` stays at `${year + 1}-01-01T00:00:00Z`.
HA's `recorder/statistics_during_period` with `period: 'month'` snaps to month boundaries in the HA server's configured timezone (local midnight), not UTC; passing Dec-1 returns the December entry of the prior year alongside the requested year's twelve months — thirteen entries total per entity instead of twelve.
Bucket `start` timestamps therefore fall in the *previous* UTC month for timezones east of UTC (e.g. Europe/Vienna May bucket starts `2026-04-30T22:00:00Z`), so month attribution must use `hass.config.time_zone`, never UTC getters.
(Correction 2026-06-05: the original "(UTC)" claim here was wrong and led to a one-month bucket-attribution shift, fixed in `transformMonthlyStats`.)

**Rationale**: Single-fetch extension is simpler than a separate prior-year fetch and matches how the daily fetch already over-reaches into the prior year (`dailyStartTime = ${year - 1}-12-31T00:00:00Z`).
HA returns the additional entry in the same WebSocket round-trip; no extra request needed.
NFR-001 budget intact (no bundle/runtime impact).

**Alternatives considered**:
- *Two separate fetches (current year + prev-December)*: more network overhead, two round-trips instead of one, asynchronous coordination.
  Rejected.
- *Fetch full prior year always*: ~12× the data, no benefit.
  Rejected.
- *Lazy prev-month fetch on-demand when rendering January*: adds a render-time async step, complicates the data flow.
  Rejected (Constitution V — simplicity).

## Q2 — How does `transformMonthlyStats` look up the prev-month sum?

**Decision**: After fetching extended monthly raw data (Q1), the per-row loop iterates over the sorted entries for that entity.
For each entry at index `i` representing `(year_i, month_i)`, the prev-month sum is `sorted[i - 1].sum` when `i > 0` AND `sorted[i - 1]` represents the immediately preceding month; otherwise FR-006's first-month fallback applies (`total = sorted[i].sum` directly).

The "immediately preceding month" check guards the edge case where an entity has a gap in its monthly statistics (e.g. sensor was offline for a whole month).
If the gap exists, treat the post-gap month as a "first" month for delta purposes.

**Rationale**: Sorting by `start` already exists in the function (current behaviour). Index-based lookup of the previous entry is O(1) per month. No additional state needed.
The gap-handling rule prevents over-counting: if November and January exist but December does not, January's total should be `sum[Jan] − sum[Nov]` only if we trust that November→January was continuous; otherwise it overstates January.
Safer to use `sum[Jan]` directly (treats January as a fresh start) and document the gap.

**Alternatives considered**:
- *Build a `Map<entityId, Map<yearMonth, sum>>` once and look up by key*: cleaner, ~10 extra LOC, identical complexity.
  Rejected — sorted-index approach is simpler.
- *Strict cross-year delta: always use prev-December for January regardless of intervening gaps*: would silently mis-attribute usage when a gap exists.
  Rejected — fail-safe behaviour (treat gap as restart) preferred.

## Q3 — Where does the negative-delta clamp live? (FR-002a)

**Decision**: Inside `transformMonthlyStats`, immediately after computing the delta, branch on `meta.stateClass`:
- `'total_increasing'` → `total = Math.max(0, delta)`
- `'total'` → `total = delta` (as-is)
- Other state classes are unreachable in this branch (the function only processes entity rows with cumulative state class; measurement rows take a different code path).

Implementation site is the same place where the prev-month subtraction happens, so the clamp is co-located with its trigger.

**Rationale**: Mirrors spec 001 FR-015 (daily-delta clamp) at the monthly granularity.
Single decision site keeps the rule discoverable.
No new helper function — three lines of inline logic.

**Alternatives considered**:
- *Clamp at render time in `monthly-table.ts`*: separates rule from computation; harder to test.
  Rejected.
- *Always clamp regardless of state class*: would silently drop legitimate negative deltas for `total` entities (net energy export).
  Rejected (contradicts spec 001 FR-015 + FR-002a).

## Q4 — Are expression rows touched by this feature?

**Decision**: No.
Expression rows keep their current arithmetic-daily-sum total derivation in `calendar-stats-card.ts:317` (the dedicated expression-row loop is unchanged).
HA does not store monthly-period statistics for formulas, so the HA-sum-delta rule is inapplicable to expression rows.

**Rationale**: FR-008 explicitly out-of-scopes expression rows for this feature.
Editing the expression-row loop would either require a parallel arithmetic-sum-of-monthlies (no semantic benefit; we'd be re-deriving what we already have from daily sums) or require synthesising fake monthly entries (added complexity for no user-visible change).

**Alternatives considered**:
- *Make expression-row totals consistent with cumulative-row totals via some synthesis*: rejected — no HA monthly stat exists; would be implementation noise.

## Q5 — What about the missing-`sum` edge case (FR / Edge Cases)?

**Decision**: When `entry.sum` is `undefined` (HA returned the entry but the `sum` field is absent or null), the total is set to `null` in the returned `MonthlySummary` — same null convention the function already uses for missing data.
The renderer in `monthly-table.ts` / `year-table.ts` already maps `null` total to an empty cell (no fallback, no `—` dash — consistent with how `min`/`mean`/`max` null is currently rendered).

**Rationale**: Spec edge case explicitly forbids silent fallback to daily-sum arithmetic (would mask data-quality issues).
`null` is the existing data-model convention for "no value".

**Alternatives considered**:
- *Show `—` dash for missing sum*: inconsistent with how min/mean/max are rendered when null.
  Rejected.
- *Substitute prev-month's sum unchanged (delta = 0)*: misleading — gives the impression of "zero usage this month" when truth is "unknown".
  Rejected.
