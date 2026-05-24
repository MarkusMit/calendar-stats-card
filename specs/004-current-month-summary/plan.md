# Implementation Plan: Current Month Summary and Total Columns

**Branch**: `004-current-month-summary` | **Date**: 2026-05-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/004-current-month-summary/spec.md`

## Summary

HA's `recorder/statistics_during_period` with `period: 'month'` does not return an entry for the current in-progress month (the period has not ended). `transformMonthlyStats` only populates a `MonthlySummary` for months where HA returned raw data — so the current month gets no summary entry and the table shows empty summary/total cells.

Fix: extract a `computeMonthlySummaryFromDailyValues` helper from the existing `transformMonthlyStats` measurement and cumulative computation branches; call it in `tabularizer-card.ts` for all non-expression entities for the current month, mirroring the approach already in place for expression rows (lines 219–235).

## Technical Context

**Language/Version**: TypeScript 5.6 (strict), compiled via Rollup 4  
**Primary Dependencies**: Lit 3.2, Vitest 4.1, happy-dom  
**Storage**: N/A (stateless card; data sourced from HA WS API)  
**Testing**: Vitest — unit tests (`tests/unit/`) and component tests (`tests/component/`)  
**Target Platform**: Home Assistant 2026.5.0+ Lovelace dashboard (browser)  
**Project Type**: HA Lovelace custom card  
**Performance Goals**: No new async work; helper is pure synchronous computation over already-loaded `dailyValues`  
**Constraints**: No new dependencies; no changes to HA API calls  
**Scale/Scope**: Affects `tabularizer-card.ts` (orchestration) and `data-transform.ts` (computation); no UI component changes

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [X] **I. HA-Native Design** — No UI changes; fix is in data pipeline only. No new styling.
- [X] **II. Test-First** — TDD required. Unit tests for helper and integration-style tests for card orchestration written and confirmed failing before implementation.
- [X] **III. Density & Data Fidelity** — Fix restores correct computation for incomplete months. All existing rules (measurement card-computed, precipitation zero-exclusion, cumulative from daily sums) apply unchanged via the extracted helper.
- [X] **IV. i18n from Day One** — No user-visible strings introduced.
- [X] **V. Simplicity** — Single helper extraction + one call site addition. No new abstractions beyond the concrete current need.

All five principles pass. No Complexity Tracking entries required.

## Root Cause Analysis

`transformMonthlyStats` loops over `Object.entries(rawStats)` — the raw HA monthly API response. HA does not emit a monthly-period record until the period ends, so the current month is absent from `rawStats`. The function never reaches the computation branches for the current month.

Expression rows bypass this by computing their own summaries in `tabularizer-card.ts` (lines 219–235) via `collectDailySums` — independent of HA monthly stats. Non-expression entities lack this fallback.

**The computation logic for both measurement and cumulative branches already exists inside `transformMonthlyStats`; it just cannot be reached for months absent from `rawStats`.** The fix extracts that logic into a callable helper and invokes it for the current month.

## Design Decision

**Extract `computeMonthlySummaryFromDailyValues`** from the measurement and cumulative branches of `transformMonthlyStats`:

```typescript
// frontend/src/services/data-transform.ts
export function computeMonthlySummaryFromDailyValues(
  entityId: string,
  year: number,
  month: number,
  isMeasurement: boolean,
  isPrecipitation: boolean,
  dailyValues: Map<string, DailyValue>,
): MonthlySummary | null  // null if no daily data for this month
```

`transformMonthlyStats` refactored to call this helper internally (no behavior change for complete months).

In `tabularizer-card.ts`, after `transformMonthlyStats` and the expression-row loop, add a fill-in pass for the current month:

```typescript
// For current year: fill in missing summaries for the current (incomplete) month
if (year === currentYear) {
  for (const cfg of this._config.entities) {
    if (!('entity' in cfg)) continue;
    const entityId = cfg.entity;
    const meta = metadataMap[entityId];
    if (!meta) continue;
    const key = `${entityId}::${year}-${currentMonth}`;
    if (!monthlySummaries.has(key)) {
      const s = computeMonthlySummaryFromDailyValues(
        entityId, year, currentMonth,
        meta.stateClass === 'measurement',
        meta.deviceClass === 'precipitation',
        dailyValues,
      );
      if (s) monthlySummaries.set(key, s);
    }
  }
}
```

This keeps all computation logic in `data-transform.ts`, avoids duplication, and follows the exact pattern already in use for expression rows.

## Project Structure

### Documentation (this feature)

```text
specs/004-current-month-summary/
├── plan.md              ← this file
├── data-model.md        ← not needed (no new entities)
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code (affected files only)

```text
frontend/
├── src/
│   ├── services/
│   │   └── data-transform.ts          ← extract helper, refactor internals
│   └── tabularizer-card.ts            ← add current-month fill-in pass
└── tests/
    └── unit/
        └── services/
            └── data-transform.test.ts ← new tests for helper + current-month case
```

No component files change — `year-table.ts` and `monthly-table.ts` already render whatever `monthlySummaries` contains; they need no modification.

## Quickstart (Independent Test)

Configure a temperature entity (`state_class: measurement`) and an energy entity (`state_class: total_increasing`). On any day after the 1st of the month:

1. Open the dashboard — the current month table shows:
   - Temperature rows: Summary column shows min/avg/max computed from completed days
   - Energy row: Summary column shows avg/min/max, Total column shows cumulative sum of completed days
2. Navigate to a previous year — all months unchanged.
3. Navigate back to current year — current month summary/total still visible.
4. On the 1st day of the month (no completed days): summary/total cells are empty.
