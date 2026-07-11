# Implementation Plan: Threshold Aggregation Scope

**Branch**: `015-threshold-scope` | **Date**: 2026-07-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/015-threshold-scope/spec.md`

## Summary

(Revised 2026-07-11: per-period values replace the initial per-rule `scope` field — see spec Clarifications.)
Threshold rules gain per-period thresholds: `value` (day, now optional), `value_month`, `value_year`, sharing one operator/name/color set.
A rule is evaluated for a cell only when it defines a threshold for that cell's aggregation period, so daily-intent thresholds stop firing on monthly/yearly sum cells.
Technically: `resolveThreshold()` keeps its cell-scope parameter and looks up each rule's threshold for that period (absent → rule skipped); every call site passes the scope of the cell it renders; the two previously-uncolored Total columns pass `month`/`year`; the threshold editor gains month/year value inputs.

## Technical Context

**Language/Version**: TypeScript 6.0.x (TS 7 blocked by eslint/@rollup peer deps)
**Primary Dependencies**: Lit 3.2, Rollup 4, no new runtime dependencies
**Storage**: N/A (card config lives in Lovelace YAML/storage; one new optional field per threshold rule)
**Testing**: Vitest 4 (unit + component tests, happy-dom), TDD mandatory
**Target Platform**: Home Assistant 2026.5.0+ Lovelace frontend (browser)
**Project Type**: Web frontend (custom Lovelace card), `frontend/` directory
**Performance Goals**: Threshold resolution stays O(rules) per cell; no measurable render impact (< 20 rules per row typical)
**Constraints**: Backward compatible — absent `scope` behaves as `day`; UTF-8/LF; en+de i18n
**Scale/Scope**: 1 type extension, 1 service filter, 3 table components, 1 editor component, 2 translation files

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. HA-Native Design** — the scope selector reuses the existing editor field styling (native-styled `select`, HA design tokens); no new visual language.
- [x] **II. Test-First** — every task starts with failing Vitest tests: resolver scope filtering, per-view component coloring, editor round-trip; see quickstart.md test plan.
- [x] **III. Density & Data Fidelity** — no computation rule changes; only which cells a rule may color.
  Cell classification (day/month/year) mirrors the constitution's derivation paths: daily deltas and stats over daily values are day-scale; HA-sum-delta monthly totals and stats over them are month-scale; the yearly total is year-scale.
- [x] **IV. i18n from Day One** — new editor labels (`editor.threshold_value_day|month|year`) land in `en.json` and `de.json` in the same task that introduces them.
- [x] **V. Simplicity** — two optional number fields, one lookup expression, no new abstractions; the cell-scope parameter is a plain function argument, not a config/registry mechanism.

No violations — Complexity Tracking table not needed.

## Project Structure

### Documentation (this feature)

```text
specs/015-threshold-scope/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── card-config.md   # YAML config contract for per-period values
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── types/
│   │   └── card-config.ts            # + ThresholdScope type (internal), ThresholdRule.value_month/value_year
│   ├── services/
│   │   └── threshold-resolver.ts     # + cellScope param, per-period threshold lookup
│   ├── components/
│   │   ├── year-table.ts             # pass 'day' everywhere; Total column → 'month' (new coloring)
│   │   ├── year-summary-table.ts     # measurement cells 'day'; cumulative month cells + rollup 'month'; Total column → 'year' (new coloring)
│   │   ├── month-comparison-table.ts # measurement 'day'; cumulative value + cross-year avg 'month'
│   │   └── threshold-list-editor.ts  # + month/year value inputs
│   └── translations/
│       ├── en.json                   # + scope labels
│       └── de.json                   # + scope labels
└── tests/
    ├── unit/services/threshold-resolver.test.ts          # extend: scope filtering
    └── component/
        ├── year-table.thresholds.test.ts                 # extend/new: Total column coloring, day gating
        ├── year-summary-table.thresholds.test.ts         # extend: month/year scope behavior
        ├── month-comparison-table.test.ts                # extend: scope gating in comparison cells
        └── threshold-list-editor.test.ts                 # extend: period value inputs round-trip
```

**Structure Decision**: Existing single-frontend layout; the feature only touches the files listed above.

## Cell-scope map (normative for implementation)

Every `resolveThreshold` call site passes the scope of the cell it renders:

| File / site | Cell | Scope |
|---|---|---|
| `year-table.ts:394/403/412` | measurement daily min/avg/max | `day` |
| `year-table.ts:454` | measurement monthly summary min/avg/max | `day` |
| `year-table.ts:496` | cumulative daily diff | `day` |
| `year-table.ts:522` | cumulative monthly summary (mean of daily diffs) | `day` |
| `year-table.ts:520` (`cumulTotalStyle`) | monthly Total column — currently static-only, becomes threshold-evaluated | `month` |
| `year-summary-table.ts:343` | measurement month cells | `day` |
| `year-summary-table.ts:365` | measurement year rollup | `day` |
| `year-summary-table.ts:408` | cumulative month cells (monthly totals) | `month` |
| `year-summary-table.ts:435` | cumulative year rollup (mean of monthly totals) | `month` |
| `year-summary-table.ts:433` (`cumulTotalStyle`) | yearly Total column — currently static-only, becomes threshold-evaluated | `year` |
| `month-comparison-table.ts:256` | per-year summary values (measurement min/avg/max ∕ cumulative total) | `day` ∕ `month` by row kind |
| `month-comparison-table.ts:284` | cross-year average (measurement ∕ cumulative) | `day` ∕ `month` by row kind |
| `month-comparison-table.ts` daily sections | rendered via `year-table` | inherits `year-table` scopes |
| diff / average-deviation cells | never evaluated | — |

The Total-column evaluations reuse the existing `resolveThreshold` + `buildCellStyle` + `_addTriggered` pattern of the neighboring summary cell (legend integration comes free).

## Design decisions (revised: per-period values)

1. **Per-period values on the rule, not separate lists or a scope enum** — one `thresholds` array stays the single config surface; one rule spans all periods with shared operator/name/colors; one legend entry per rule.
2. **Threshold lookup before closest-wins** — `resolveThreshold` maps `cellScope` → `rule.value` / `rule.value_month` / `rule.value_year`; rules without a threshold for the period are dropped in the same `filter()` that drops colorless rules; distance ranking and tie-breaks use the period threshold (spec FR-008).
3. **Rules without any period value are silently ignored** — same lenient handling as colorless rules (spec FR-001 / edge case).
4. **`not-below`/`not-above` role exclusion unchanged** — period lookup is orthogonal to `NOT_BELOW_EXCLUDED`/`NOT_ABOVE_EXCLUDED` role sets (spec FR-013).
5. **Editor gets three optional number inputs** — `data-field="value"` (day), `data-field="value_month"`, `data-field="value_year"`, labeled via `editor.threshold_value_day|month|year`; an emptied input removes the field from the rule.

## Complexity Tracking

No constitution violations — table intentionally empty.
