# Implementation Plan: Month Comparison View

**Branch**: `014-month-comparison-view` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/014-month-comparison-view/spec.md`

## Summary

Add a **month comparison view** opened by clicking a month label in the yearly view's per-year header rows.
It compares one calendar month across all years of the yearly view's range: first a summary table (rows = entities, columns = years) where each cell shows the month's summary values plus a signed diff to the previous year and a signed deviation from the cross-year average (cumulative totals additionally as a percentage), then per-year daily tables reusing the monthly-view rendering.
Next/previous controls switch the compared month-of-year with December↔January wrap; a back control returns to the yearly view.
The feature is pure presentation over the existing `statisticsByYear` cache (`monthlySummaries` + `dailyValues`) — no new fetching, no config change, session-only state.

## Technical Context

**Language/Version**: TypeScript (ES2021 target), Node.js 24.15 (WSL2)
**Primary Dependencies**: Lit 3.x (LitElement), no new runtime dependencies
**Storage**: N/A — reads the already-cached `ViewState.statisticsByYear`; comparison state is in-memory (session)
**Testing**: Vitest (unit + component), TDD (Constitution II)
**Target Platform**: Home Assistant 2026.5.0+ Lovelace dashboard (browser)
**Project Type**: Single frontend project — HA custom card (`frontend/`)
**Performance Goals**: Opening the comparison and switching months trigger zero websocket calls (all compared years are already loaded by the yearly view); instant render
**Constraints**: UTF-8/LF; HA design tokens only; en + de from introduction; dense layout (Constitution III)
**Scale/Scope**: One new summary-comparison component, clickable month headers in `year-summary-table`, comparison chrome (back + month prev/next) in the host card, ~2 pure diff/average helpers, i18n additions. No config schema change; the UI editor is untouched.

All spec ambiguities were resolved during `/speckit-clarify` (1 user directive + 4 clarifications). No NEEDS CLARIFICATION remains.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. HA-Native Design** — comparison chrome reuses the existing bottom-bar/button/table styling and HA CSS variables; the summary table follows the established table idiom (sticky label column, dense cells). No new visual language.
- [x] **II. Test-First** — every task is specified test-first: pure diff/average helpers get failing unit tests, components get failing DOM tests before implementation ([research.md](./research.md), contracts test obligations).
- [x] **III. Density & Data Fidelity** — summary cells read the existing constitution-compliant `MonthlySummary` values verbatim (SC-002 by construction); diffs and the cross-year average are arithmetic over those values with the incomplete-current-month exclusion specified in [data-model.md](./data-model.md). Dense layout, no decorative whitespace.
- [x] **IV. i18n from Day One** — all new strings (back, diff captions, incomplete marker, empty state, month-nav aria labels) go to `en.json`/`de.json`; month names via `Intl` with the HA language.
- [x] **V. Simplicity** — reuses `year-table` for the daily section, `threshold-resolver`/`readable-text`/`localize` unchanged; one new table component; comparison state is two fields on `ViewState`. Out-of-scope items (charts, cross-month comparison, year-range editing inside the comparison) are excluded.

*No violations — Complexity Tracking table omitted.*

## Project Structure

### Documentation (this feature)

```text
specs/014-month-comparison-view/
├── plan.md              # This file
├── research.md          # Phase 0 — design decisions (entry point, state, diff math, reuse)
├── data-model.md        # Phase 1 — comparison state, cell shape, derivation + validation rules
├── quickstart.md        # Phase 1 — manual verification walkthrough
├── contracts/
│   └── ui-contracts.md  # Phase 1 — component props/events (month-comparison-table, year-summary-table, host)
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 — created by /speckit-tasks (NOT here)
```

### Source Code (repository root)

```text
frontend/src/
├── calendar-stats-card.ts              # host: comparisonMonth state, month-select handler, comparison
│                                       #   render branch (chrome + summary table + per-year year-table),
│                                       #   close-on-range/view-change, back handler
├── components/
│   ├── year-summary-table.ts           # enhanced — month header cells become buttons (data months only),
│   │                                   #   dispatch calendar-stats-month-select
│   ├── month-comparison-table.ts       # NEW — summary comparison table (rows = entities, columns = years,
│   │                                   #   cell = value(s) + Δprev + Øδ [+ % on cumulative totals])
│   ├── year-table.ts                   # reused unchanged — one instance per compared year, single visible month
│   ├── view-mode-toggle.ts             # unchanged
│   └── range-navigator.ts              # unchanged (hidden while the comparison is open)
├── services/
│   ├── data-transform.ts               # add pure comparison helpers (per-row cross-year series, diffs,
│   │                                   #   average with incomplete-month exclusion)
│   ├── threshold-resolver.ts           # reused unchanged
│   └── readable-text.ts                # reused unchanged
├── types/
│   └── statistics.ts                   # add comparisonMonth to ViewState; comparison cell/series types
└── translations/
    ├── en.json                         # comparison.* keys
    └── de.json

frontend/tests/
├── unit/services/                      # data-transform comparison math (diffs, average, exclusions, wrap-agnostic)
└── component/                          # month-comparison-table, year-summary-table month click,
                                        # card comparison wiring (open/navigate/wrap/empty/back/close-on-change)
```

**Structure Decision**: Single frontend project (existing HA card).
The comparison is a third render branch of the host card, active while `viewMode === 'yearly'` and `comparisonMonth` is set; it composes one new summary component with existing `year-table` instances (single visible month per compared year), all fed from the same `statisticsByYear` cache.
This mirrors how the yearly view was added as a sibling presentation and leaves the monthly path untouched.

## Complexity Tracking

*No constitution violations — no entries.*
