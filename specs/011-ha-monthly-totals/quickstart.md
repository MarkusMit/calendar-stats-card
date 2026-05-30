# Quickstart: Reconcile HA Monthly Stats With Cumulative Totals

## Prerequisites

- Node.js 24.15; `npm install` already completed in `frontend/`.
- Working tree on branch `011-ha-monthly-totals`.

## Verify green baseline

```bash
cd frontend
npm test
```

447/447 green from feature 010.
If anything is red, stop and report before any new work.

## TDD walkthrough

### Step 1 — Red: update existing total assertions; add new tests

Edit `frontend/tests/unit/services/data-transform.test.ts`:

- **Modify** the existing test `cumulative monthly total = sum of daily values (unaffected by show_zero — FR-004)`: change the assertion to expect HA-sum-delta semantics.
  Provide realistic monthly raw entries with `sum` populated (e.g. Dec 2024: `sum: 1000`, Jan 2025: `sum: 1100` → Jan total = 100).
  Assertion: `jan?.total` is `100`, not `10`.
- **Add** test: cross-year January delta.
  Fixture: entity with December-of-prior-year `sum: 500` and January `sum: 800` → Jan total = 300.
- **Add** test: first tracked month fallback (no prev-month entry).
  Fixture: entity with only one monthly entry → total = `sum` directly.
- **Add** test: missing `sum` field for current month → total is `null`.
- **Add** test: `total_increasing` negative-delta clamp.
  Fixture: monthly entries showing `sum[m] < sum[m-1]` (counter reset) → total = `0`, not negative.
- **Add** test: `total` state-class negative-delta as-is.
  Fixture: same shape but `stateClass: 'total'` → total = the (negative) delta, unchanged.
- **Add** test: gap month → treat as first-month fallback.
  Fixture: entries for Jan and March (Feb missing) → March total = `sum[Mar]` directly (not `sum[Mar] − sum[Jan]`).
- **Add** test: prev-December raw entry from extended fetch does NOT produce a summary for that month (it serves only as the lookup source for January's delta).
  Fixture: monthly raw includes Dec 2024 + Jan 2025 entries; result map contains only the Jan entry, not Dec.

Edit `frontend/tests/component/calendar-stats-card.test.ts` if any expression-row or integration test currently mocks `recorder/statistics_during_period` `period: 'month'` requests — verify they assert the new request range (`monthlyStartTime` = Dec 1 of prior year).
If they do not assert the range, no change needed (the new range still satisfies the test).

Run tests:

```bash
npm test
```

Expect RED on the new and modified assertions.
Other tests should stay GREEN.

### Step 2 — Green: implement

Edit `frontend/src/services/data-transform.ts`:

In `transformMonthlyStats`, replace the `for (const entry of sorted) { ... }` loop with the new logic from `contracts/data-transform.md`:

1. Sort entries by `start`.
2. For each entry at index `i`, derive `(year, month)`.
3. If `(year, month)` falls outside the requested viewing year, skip (it's the prev-December lookup-only entry).
4. Compute `total`:
   - If `entry.sum` undefined → `total = null`.
   - Else if no `sorted[i-1]` OR `sorted[i-1]` does not represent the immediately preceding month → `total = entry.sum` (first-month fallback).
   - Else compute `delta = entry.sum - sorted[i-1].sum`; apply clamp per `meta.stateClass`.
5. Compute `min`/`mean`/`max` as today (`computeMonthlySummaryFromDailyValues(...)`) — unchanged.
6. Assemble the `MonthlySummary` and store via `rowSummaryKey(...)`.

Edit `frontend/src/calendar-stats-card.ts` (≈ line 219):

```typescript
const monthlyStartTime = `${year - 1}-12-01T00:00:00Z`;
// ...
this._service.fetchMonthlyStats(this._hass, entityIds, monthlyStartTime, endTime),
```

Run tests:

```bash
npm test
```

Expect GREEN.

### Step 3 — Refactor / lint / build

```bash
npm run lint
npm run build
```

Both must pass.

### Step 4 — Doc + governance updates

1. **`.specify/memory/constitution.md`**:
   - Amend Principle III with the four-bullet derivation rule set (FR-009).
   - Bump version `2.0.0` → `2.1.0`.
   - Prepend sync-impact-report entry.
2. **`specs/010-precip-show-zero/spec.md` FR-004**: drop the parenthetical "(its value continues to come from HA's authoritative monthly statistics)" — was inaccurate before this feature, and now redundant (FR-002 of feature 011 makes the rule explicit).
3. **`docs/README.md`**: brief Behaviour & limits update — note that monthly totals come from HA's authoritative monthly figure and may differ from arithmetic sum of visible daily cells (spec 001 already permits this).
4. **`.claude/CLAUDE.md`**: SPECKIT marker repointed to `specs/011-ha-monthly-totals/plan.md`.

### Step 5 — Verify in HA (manual)

Deploy and check in a real HA instance:

1. Configure a `total_increasing` electricity meter with multi-year history.
   Navigate to January of any past year.
   Verify total ≈ HA's official January delta.
2. Configure a `total` net-energy meter.
   Navigate to a month where net export exceeded import.
   Verify total renders as negative (not clamped to 0).
3. Configure a brand-new entity (≤ 1 month of data).
   View its earliest month.
   Verify total = HA's cumulative `sum` since tracking began.
