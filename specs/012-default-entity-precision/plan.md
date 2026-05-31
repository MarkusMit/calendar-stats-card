# Implementation Plan: Default Entity Precision of 1

**Branch**: `012-default-entity-precision` | **Date**: 2026-05-31 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/012-default-entity-precision/spec.md`

## Summary

Change the card's default numeric display precision from "native / no rounding" to a fixed **1 decimal place** for any row (entity or expression) that does not set `precision`.
The per-row `precision` option and its existing fixed-decimal behavior are unchanged.
Documentation (`docs/README.md`) is updated to match.

Technical approach: the default currently lives as inline `?? 20` / `?? 0` fallbacks in the single shared `Intl.NumberFormat` constant `nf` inside `year-table.ts` (`renderEntityRows`, ~L196).
That one `nf` formats every numeric cell — daily values (L247/256/265), summary min/avg/max (L285-287), cumulative summary (L359-362), and totals (L366) — for both entity and expression rows.
Single-source the default into a `DEFAULT_PRECISION` constant plus a tiny pure `resolvePrecision()` helper, change the fallback value to `1`, and apply it at that one formatter site.

## Technical Context

**Language/Version**: TypeScript (ES2022 target), Node.js 24.15 (WSL2) for build/test
**Primary Dependencies**: Lit (custom element), `Intl.NumberFormat` (built-in) — no new dependencies
**Storage**: N/A (card config is HA-managed Lovelace YAML/JSON)
**Testing**: Vitest (`frontend/`); TDD per Constitution II
**Target Platform**: Home Assistant 2026.5.0+ (browser, WASM-free)
**Project Type**: Single frontend project (HA Lovelace custom card)
**Performance Goals**: No change; formatting is per-cell `Intl.NumberFormat`, unaffected
**Constraints**: UTF-8 + LF; i18n via existing localize mechanism (no new strings here)
**Scale/Scope**: 1 shared-formatter edit in 1 source file + 1 new helper/constant + README text (2 cells)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. HA-Native Design** — no UI/styling change; only the default decimal count of already-rendered cells. Uses standard `Intl.NumberFormat`. Compliant.
- [x] **II. Test-First** — failing Vitest unit test for `resolvePrecision()` (and the `DEFAULT_PRECISION` value) written and confirmed red before the source change. Compliant.
- [x] **III. Density & Data Fidelity** — display-format only; no change to any min/avg/max/total computation path or `device_class`/`show_zero` logic. Compliant.
- [x] **IV. i18n from Day One** — no new user-visible strings; `Intl.NumberFormat` already receives `this.lang`. Compliant.
- [x] **V. Simplicity** — single-sourcing the default replaces inline magic numbers in the shared formatter and is the minimum needed for FR-005 consistency + testability; no speculative abstraction. Compliant.

No violations. Complexity Tracking table omitted.

## Project Structure

### Documentation (this feature)

```text
specs/012-default-entity-precision/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── precision-default.md   # Phase 1 output (display contract)
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
frontend/
├── src/
│   └── components/
│       └── year-table.ts          # shared `nf` formatter default (~L196) + new DEFAULT_PRECISION/resolvePrecision
└── tests/
    └── unit/
        └── components/
            └── year-table.precision.test.ts   # NEW — failing-first unit test

docs/
└── README.md                      # precision default text (entity row ~L92, expression row ~L114)
```

**Structure Decision**: Existing single-frontend layout.
The only source file touched is `frontend/src/components/year-table.ts`; a new colocated unit test under `frontend/tests/unit/components/`; documentation in `docs/README.md`.
No new module or directory is introduced.

## Complexity Tracking

No constitution violations; table intentionally empty.
