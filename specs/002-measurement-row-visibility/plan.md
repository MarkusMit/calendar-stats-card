# Implementation Plan: Measurement Row Visibility

**Branch**: `002-measurement-row-visibility` | **Date**: 2026-05-24 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/002-measurement-row-visibility/spec.md`

## Summary

Add `show_min`, `show_avg`, `show_max` boolean fields to `EntityRowConfig`. For measurement entities these flags hide individual day sub-rows and the corresponding summary values; for cumulative entities they hide the min/avg/max values from the summary column only (day column and total unaffected). Defaults are `true` (all visible — no change to existing behaviour).

**Stack**: TypeScript 5.6+ + Lit 3.2, existing project structure. No new dependencies.

## Technical Context

**Language/Version**: TypeScript 5.6+, Node.js 24.15 (WSL2)
**Primary Dependencies**: Lit 3.2, Rollup 4, Vitest + happy-dom (existing)
**Storage**: N/A
**Testing**: Vitest, happy-dom, @open-wc/testing (existing)
**Target Platform**: HA Lovelace browser runtime, HA 2026.5.0+
**Project Type**: HA Lovelace custom card (incremental feature on existing card)
**Performance Goals**: Rendering-only change — no statistics fetching; no performance impact
**Constraints**: Dense layout preserved; rowspan must equal visible sub-row count

## Constitution Check

*GATE: Must pass before implementation.*

- [x] **I. HA-Native Design** — No new CSS or design tokens; changes are rendering-logic only within existing Lit templates. HA design token usage unchanged.
- [x] **II. Test-First** — Every implementation task is preceded by a failing test task. Red-Green-Refactor applied throughout.
- [x] **III. Density & Data Fidelity** — Hiding rows reduces vertical footprint (more dense, not less). Computation rules unchanged; only rendering gated. Rowspan is computed dynamically so layout remains tight.
- [x] **IV. i18n from Day One** — No new user-visible strings introduced.
- [x] **V. Simplicity** — Three boolean fields added to one type; conditional guards in two render methods. No new abstractions, no new files (except test additions). `show_total` is explicitly out of scope.

*No violations → Complexity Tracking table not required.*

## Project Structure

### Documentation (this feature)

```text
specs/002-measurement-row-visibility/
├── plan.md                    # This file
├── research.md                # Phase 0: design decisions
├── data-model.md              # Phase 1: rendering rules
└── tasks.md                   # Phase 2 output (/speckit-tasks)
```

### Source Files Changed

```text
frontend/src/types/card-config.ts                  # add show_min/avg/max to EntityRowConfig
frontend/src/components/year-table.ts              # conditional sub-row rendering + cumulative summary
frontend/src/components/monthly-table.ts           # same changes for parity
frontend/tests/component/year-table.test.ts        # new tests for visibility flags
frontend/tests/component/monthly-table.test.ts     # new tests for visibility flags
specs/001-monthly-stats-card/contracts/card-config-schema.yaml  # add 3 new fields to entity row schema
```

## Key Design Decisions

### Dynamic rowspan (measurement entities)

`year-table.ts:205` currently hard-codes `rowspan="3"`. Must be computed as:

```ts
const visibleRows = [cfg.show_min, cfg.show_avg, cfg.show_max].filter(v => v !== false).length;
// rowspan = Math.max(visibleRows, 1)  — always at least 1 for the label cell
```

When `visibleRows === 0` (all hidden): render a single `<tr>` with the label cell using `colspan` spanning the sub-label and day columns — no data cells, no summary.

Same logic applies to `monthly-table.ts`.

### Cumulative summary conditional rendering

Current structure (`year-table.ts:244–251`):
```html
<div class="cumul-summary">
  <div>{mean}</div>
  <div class="cumul-minmax"><span>↓{min}</span><span>↑{max}</span></div>
</div>
```

With flags:
- Mean div: rendered when `cfg.show_avg !== false`
- `cumul-minmax` div: rendered when at least one of min/max is visible
- Min span: rendered when `cfg.show_min !== false`
- Max span: rendered when `cfg.show_max !== false`
- If all three hidden: `summaryContent = ''` (empty — total column still renders)

`monthly-table.ts` uses a slash-separated format (`min/avg/max` as text) — same conditional logic but inline.

### Flag check pattern

Mirrors existing `show_zero !== false` convention (not `=== true`), so the default `undefined` behaves as `true` without any explicit default coercion.

### Contract update

Add `show_min`, `show_avg`, `show_max` fields to the entity row schema in
`specs/001-monthly-stats-card/contracts/card-config-schema.yaml` (after `show_zero`).
