# Implementation Plan: Threshold Aggregation Scope

**Branch**: `015-threshold-scope` | **Date**: 2026-07-11 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/015-threshold-scope/spec.md`

## Summary

Threshold rules gain an optional `scope` field (`day` default, `month`, `year`).
A rule is evaluated only against cells whose displayed value has the rule's aggregation period, so daily-intent thresholds stop firing on monthly/yearly sum cells.
Technically: `resolveThreshold()` gets a cell-scope parameter and pre-filters rules by scope; every call site passes the scope of the cell it renders; the two previously-uncolored Total columns start passing `month`/`year` scope; the threshold editor gains a scope dropdown.

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
- [x] **IV. i18n from Day One** — new editor labels (`editor.threshold_scope`, `threshold.scopes.day|month|year`) land in `en.json` and `de.json` in the same task that introduces them.
- [x] **V. Simplicity** — one optional enum field, one filter expression, no new abstractions; the scope parameter is a plain function argument, not a config/registry mechanism.

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
│   └── card-config.md   # YAML config contract for the scope field
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created by /speckit-plan)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── types/
│   │   └── card-config.ts            # + ThresholdScope type, ThresholdRule.scope
│   ├── services/
│   │   └── threshold-resolver.ts     # + cellScope param, scope pre-filter
│   ├── components/
│   │   ├── year-table.ts             # pass 'day' everywhere; Total column → 'month' (new coloring)
│   │   ├── year-summary-table.ts     # measurement cells 'day'; cumulative month cells + rollup 'month'; Total column → 'year' (new coloring)
│   │   ├── month-comparison-table.ts # measurement 'day'; cumulative value + cross-year avg 'month'
│   │   └── threshold-list-editor.ts  # + scope dropdown
│   └── translations/
│       ├── en.json                   # + scope labels
│       └── de.json                   # + scope labels
└── tests/
    ├── unit/services/threshold-resolver.test.ts          # extend: scope filtering
    └── component/
        ├── year-table.thresholds.test.ts                 # extend/new: Total column coloring, day gating
        ├── year-summary-table.thresholds.test.ts         # extend: month/year scope behavior
        ├── month-comparison-table.test.ts                # extend: scope gating in comparison cells
        └── threshold-list-editor.test.ts                 # extend: scope dropdown round-trip
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

## Design decisions

1. **Scope as a rule field, not separate lists** — one `thresholds` array stays the single config surface; the editor stays one list; legend logic untouched.
2. **Filter before closest-wins** — `resolveThreshold` filters `(rule.scope ?? 'day') === cellScope` in the same `filter()` that already drops colorless rules; distance ranking and tie-breaks then operate on the survivors only (spec FR-008).
3. **Invalid scope values behave as `day`** — normalize with `(rule.scope === 'month' || rule.scope === 'year') ? rule.scope : 'day'` so unknown YAML strings degrade to the default (spec edge case).
4. **`not-below`/`not-above` role exclusion unchanged** — scope filtering is orthogonal to `NOT_BELOW_EXCLUDED`/`NOT_ABOVE_EXCLUDED` role sets (spec FR-013).
5. **Editor dropdown mirrors the operator `select`** — same field markup, `data-field="scope"`, options localized via `threshold.scopes.*`; absent scope displays as Day; selecting Day may write `scope: 'day'` explicitly (harmless, semantically identical).

## Complexity Tracking

No constitution violations — table intentionally empty.
