# Implementation Plan: Yearly Summary View

**Branch**: `013-yearly-summary-view` | **Date**: 2026-07-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/013-yearly-summary-view/spec.md`

## Summary

Add a second presentation — the **yearly view** — that lays the already-computed monthly summaries into a per-year grid: columns are the twelve months (Jan–Dec), rows are the configured entities/expressions, and each cell is that month's summary (min/avg/max for measurement rows, the monthly total for cumulative rows), plus a per-row yearly Summary/Total roll-up.
A **Monthly | Yearly** segmented control in the bottom bar toggles between the existing monthly (day-by-day) view and the new yearly view; the yearly view operates on whole calendar years only.
The feature reuses the existing per-year data pipeline (`statisticsByYear` cache of `monthlySummaries` + `dailyValues`) — no new data fetching or aggregation concept — and also tightens the shared range navigation so the user can no longer scroll before the first recorded data point (FR-015).

## Technical Context

**Language/Version**: TypeScript (ES2021 target), Node.js 24.15 (WSL2)
**Primary Dependencies**: Lit 3.x (LitElement), no new runtime dependencies
**Storage**: N/A — reads Home Assistant recorder statistics via the existing `StatisticsService` websocket calls; all view state is in-memory (session)
**Testing**: Vitest (unit + component), TDD (Constitution II)
**Target Platform**: Home Assistant 2026.5.0+ Lovelace dashboard (browser)
**Project Type**: Single frontend project — HA custom card (`frontend/`)
**Performance Goals**: Instant view switch (no refetch for already-loaded years); 60 fps scroll; dense render of ≤ N entities × 12 months per year block
**Constraints**: UTF-8/LF; HA design tokens only; en + de from introduction; no horizontal scroll for 12 columns on desktop (SC-002)
**Scale/Scope**: One new table component, one segmented-control component, one shared-navigator enhancement, ~2 new aggregation helpers, i18n additions. No config schema change.

All spec ambiguities were resolved during `/speckit-clarify` (5 clarifications). No NEEDS CLARIFICATION remains.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. HA-Native Design** — new segmented control and yearly table reuse existing HA CSS variables (`--primary-text-color`, `--secondary-background-color`, `--divider-color`, etc.) and the established bottom-bar / table styling; no new visual idioms.
- [x] **II. Test-First** — every task below is specified test-first (failing Vitest unit/component tests before implementation). Aggregation helpers and clamping are pure and unit-tested; components have DOM tests.
- [x] **III. Density & Data Fidelity** — dense grid, no decorative whitespace. Month cells reuse constitution-compliant monthly summaries verbatim (measurement min/max are the card-computed true extremes; cumulative totals are the HA-sum-delta values). Yearly roll-up rules are specified in [research.md](./research.md) and [data-model.md](./data-model.md).
- [x] **IV. i18n from Day One** — all new strings (view-toggle labels, year-range presets) added to `en.json`/`de.json`; month names via `Intl` with the HA language. No hard-coded display text.
- [x] **V. Simplicity** — reuses the existing data pipeline and threshold/contrast/localize services; one new table component and one toggle. The feature was previously listed "out of scope" but is now explicitly approved (spec + CLAUDE.md updated). No speculative abstractions.

*No violations — Complexity Tracking table omitted.*

## Project Structure

### Documentation (this feature)

```text
specs/013-yearly-summary-view/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions on roll-up math, reuse, navigation floor
├── data-model.md        # Phase 1 — view state, yearly roll-up entities, derivation rules
├── quickstart.md        # Phase 1 — manual verification walkthrough
├── contracts/
│   └── ui-contracts.md  # Phase 1 — component props/events (yearly table, segmented control, navigator)
├── checklists/
│   └── requirements.md  # Spec quality checklist (from /speckit-specify)
└── tasks.md             # Phase 2 — created by /speckit-tasks (NOT here)
```

### Source Code (repository root)

```text
frontend/src/
├── calendar-stats-card.ts          # host: adds viewMode state, renders yearly tables, year-range snap, floor clamp
├── components/
│   ├── year-table.ts               # existing monthly (day-by-day) table — unchanged
│   ├── year-summary-table.ts       # NEW — yearly grid (12 month columns + yearly Summary/Total)
│   ├── view-mode-toggle.ts         # NEW — Monthly | Yearly segmented control
│   └── range-navigator.ts          # enhanced — granularity ('month' | 'year') + earliest-data floor clamp
├── services/
│   ├── data-transform.ts           # add yearly roll-up helpers (measurement day-weighted avg / extremes; cumulative)
│   ├── date-range.ts               # add year-granular preset/step helpers + floor clamp
│   ├── threshold-resolver.ts       # reused unchanged
│   └── readable-text.ts            # reused unchanged
├── types/
│   └── statistics.ts               # add viewMode to ViewState; yearly roll-up types
└── translations/
    ├── en.json                     # view.monthly/yearly, range.this_year (exists), last_year, last_3_years, ...
    └── de.json

frontend/tests/
├── unit/services/                  # date-range year helpers + floor clamp; data-transform yearly roll-up
└── component/                      # year-summary-table, view-mode-toggle, range-navigator (year mode + floor), card wiring
```

**Structure Decision**: Single frontend project (existing HA card). The yearly view is a sibling table component to the existing `year-table`, driven by the same `statisticsByYear` cache; the host card selects which table to render based on `viewMode`. This mirrors the existing "one `year-table` per year segment" rendering and avoids touching the monthly path.

## Complexity Tracking

*No constitution violations — no entries.*
