# Implementation Plan: Threshold Exceedance Table

**Branch**: `016-threshold-exceedance-table` | **Date**: 2026-09-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/016-threshold-exceedance-table/spec.md`

## Summary

Add a dense table at the end of the card that counts, per named day threshold, how many days of the viewed range fell into that threshold's band and how many reached it in total.

Counting is a pure service over the daily values already fetched for every year of the range, so it produces identical numbers in the monthly and the yearly view (FR-014) even though the yearly view renders no day cells.
The band is defined as "the rule that colors the cell", reusing the existing coloring resolution, which keeps the counts verifiable against the tables above and handles low-value thresholds without extra logic.
A new presentational component renders the result; the card wires it in after the view tables.

## Technical Context

**Language/Version**: TypeScript 6.0 (`strict`), ES2022 modules
**Primary Dependencies**: Lit 3.2 (`@customElement`, reactive properties); no new runtime dependency
**Storage**: N/A — derived per render from in-memory statistics, nothing persisted
**Testing**: Vitest 4.1 — `unit` project (node) for the service, `component` project (happy-dom) for the element
**Target Platform**: Home Assistant 2026.5.0+ Lovelace, evergreen browsers
**Project Type**: Frontend-only custom card, bundled by Rollup to `frontend/dist/calendar-stats-card.js`
**Performance Goals**: No perceptible added render cost; the table recomputes with the card
**Constraints**: Bounded by days × rows × rules — under ~20 000 map lookups for a five-year, ten-row config, all synchronous
**Scale/Scope**: 1 new service, 1 new component, 1 exported function on an existing service, 1 extracted label helper, 3 translation keys

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. HA-Native Design** — the component copies `year-summary-table`'s structure and tokens (`--divider-color`, `--secondary-background-color`, `--primary-text-color` with fallbacks). No new visual language; rule colors are applied through the same style builder the cells and the legend swatch use.
- [x] **II. Test-First** — every task below names its failing test first: service behaviour in `tests/unit/services/`, rendering in `tests/component/`, wiring in the card's component test. Baseline is 646 passing tests; the two refactors must not change an existing assertion.
- [x] **III. Density & Data Fidelity** — same cell padding, borders and font sizes as the existing tables, no decorative whitespace. Per-row-type derivation is specified explicitly (measurement → min/avg/max candidates, cumulative and expression → one scalar candidate) and mirrors the renderer. See the note below on `show_zero`.
- [x] **IV. i18n from Day One** — three new keys in `en.json` and `de.json`; no literal display string in the component.
- [x] **V. Simplicity** — no config flag, no interaction, no caching, no per-month breakdown. The one new export (`matchingThresholds`) and the one extracted helper (`rowLabel`) each have a concrete current caller and remove duplication rather than anticipating it.

**Principle III note**: the constitution states `show_zero` MUST NOT affect measurement-entity *summaries*.
That rule governs monthly min/avg/max derivation and is untouched here.
The exceedance counts are a count of visible day cells, not a summary of values, and they follow the day-cell suppression that already ships in the renderer — required by SC-003 ("every band count equals the number of days visibly colored").

*No violations — Complexity Tracking table omitted.*

## Project Structure

### Documentation (this feature)

```text
specs/016-threshold-exceedance-table/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0 output — 7 decisions
├── data-model.md        # Phase 1 output — derived structures
├── quickstart.md        # Phase 1 output — try-it walkthrough
├── contracts/
│   └── ui-contracts.md  # Phase 1 output — rendered surface + translation keys
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   ├── components/
│   │   ├── exceedance-table.ts        # NEW — presentational element
│   │   ├── year-table.ts              # MODIFIED — use the extracted row label helper
│   │   └── ...
│   ├── services/
│   │   ├── threshold-exceedance.ts    # NEW — countExceedances(), pure
│   │   ├── threshold-resolver.ts      # MODIFIED — export matchingThresholds()
│   │   ├── row-label.ts               # NEW — rowLabel(cfg, meta), extracted from year-table
│   │   └── ...
│   ├── translations/{en,de}.json      # MODIFIED — exceedance.* keys
│   └── calendar-stats-card.ts         # MODIFIED — import, compute, render
└── tests/
    ├── unit/services/
    │   ├── threshold-exceedance.test.ts   # NEW
    │   ├── threshold-resolver.test.ts     # MODIFIED — matchingThresholds cases
    │   └── row-label.test.ts              # NEW
    └── component/
        ├── exceedance-table.test.ts       # NEW
        └── calendar-stats-card.test.ts    # MODIFIED — placement and visibility
```

**Structure Decision**: The existing frontend-only layout is kept.
Aggregation goes in `src/services/` alongside `threshold-resolver.ts` and `data-transform.ts`; presentation goes in `src/components/` alongside the other tables.
The split is what makes FR-014 achievable and lets the counting rules be tested without a DOM.

## Design

### 1. `matchingThresholds()` — `frontend/src/services/threshold-resolver.ts`

Export the candidate list that `resolveThreshold` already computes internally:

```ts
export function matchingThresholds(
  cellValue: number,
  thresholds: ThresholdRule[],
  cellRole: CellRole,
  cellScope?: ThresholdScope,
): ThresholdRule[]
```

It applies the existing filters unchanged — the rule must define a value for the period, must carry a color, must pass the operator test, and must not be excluded for the cell role.
`resolveThreshold` keeps its signature and its closest-wins / highest-value / first-defined tie-break, now selecting from that list.
Pure refactor: no existing assertion changes.

### 2. `rowLabel()` — new `frontend/src/services/row-label.ts`

Extract the label composition currently inline in `year-table.ts` (`cfg.name` → friendly name → entity id, plus ` [unit]` from `cfg.unit` or the metadata unit).
`year-table.ts` calls it for its legend groups; the new service calls it for its exceedance groups (FR-004).

### 3. `countExceedances()` — new `frontend/src/services/threshold-exceedance.ts`

Pure, DOM-free:

```ts
export interface ExceedanceRow { rule: ThresholdRule; band: number; cumulative: number; }
export interface ExceedanceGroup { label: string; rows: ExceedanceRow[]; }

export function countExceedances(
  entities: EntityConfig[],
  segments: Array<{ year: number; months: number[] }>,
  statisticsByYear: Map<number, YearStatistics>,
  metadata: Map<string, EntityMetadata>,
): ExceedanceGroup[]
```

Per row config, per segment month, per day: look up `dailyValues` by `<rowKey>::YYYY-MM-DD`, skip empty-kind entries (FR-010), apply the row `factor`, build the candidate `(value, role)` pairs per row type, then per candidate add the `resolveThreshold` winner to the day's band set and all `matchingThresholds` results to the day's cumulative set.
Increment once per set member after each day (FR-008).
Finally drop rules without a name or day value, sort by day value ascending, and drop empty groups.
Derivation detail lives in [data-model.md](data-model.md); the reasoning behind each choice in [research.md](research.md).

### 4. `<calendar-stats-exceedance-table>` — new `frontend/src/components/exceedance-table.ts`

Properties `groups: ExceedanceGroup[]` (`attribute: false`) and `lang`.
Structure, style ordering and the closing `HTMLElementTagNameMap` declaration follow `year-summary-table.ts`.
A group header row carries the group label; each rule row shows the name — tinted with the rule's colors through the shared cell-style builder and the shared contrast resolver, as the legend swatch is (FR-016) — then the band and cumulative counts.
Renders nothing when `groups` is empty.

### 5. Wiring — `frontend/src/calendar-stats-card.ts`

Side-effect import next to the other components.
In `render()`, compute the groups from the already-derived visible month segments and render the element after the view ternary, inside `.card-content`, when not in comparison mode and the groups are non-empty (FR-001, FR-012).
The existing bottom padding reservation keeps the floating bar clear of it.

### 6. Translations

Add the `exceedance` group to `en.json` and `de.json` per [contracts/ui-contracts.md](contracts/ui-contracts.md).

## Verification

From `frontend/`: `npm test`, `npm run lint`, `npm run build` — baseline 646 tests / 37 files, lint exit 0.
Then deploy and check against real data per [quickstart.md](quickstart.md): band counts equal the visibly colored days, band counts sum to the lowest threshold's total, and the numbers are unchanged after switching to the yearly view.

## Next

`/speckit-tasks` to generate the dependency-ordered task list.
