# Implementation Plan: UI Configuration Editor

**Branch**: `009-ui-config-editor` | **Date**: 2026-05-25 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/009-ui-config-editor/spec.md`

## Summary

Add a `calendar-stats-card-editor` LitElement that exposes all `CardConfig` fields through HA-native UI components. The editor registers via `CalendarStatsCard.getConfigElement()`, receives `hass` and config from HA, and communicates changes via `config-changed` CustomEvents. Five focused sub-components handle the unified row list, per-entity-row editing, per-expression-row editing (with formula validation), threshold sub-list editing, and predecessor sub-list editing.

## Technical Context

**Language/Version**: TypeScript 6.0 · Lit 3.2 · Node.js 24.15 (WSL2)
**Primary Dependencies**: Lit 3.2 (existing); HA-native web components — `ha-entity-picker`, `ha-sortable`, `ha-expansion-panel`, `ha-textfield`, `ha-select`, `ha-list-item`, `ha-color-picker`, `ha-date-input`, `ha-icon-button`, `ha-checkbox`
**Storage**: N/A — configuration stored by HA Lovelace via `config-changed` protocol
**Testing**: Vitest 4.x + happy-dom + @open-wc/testing (existing setup unchanged)
**Target Platform**: HA 2026.5.0+ Lovelace editor panel (custom card)
**Project Type**: Lovelace custom card editor — LitElement web components
**Performance Goals**: `config-changed` dispatched within same microtask as user interaction; no perceptible preview lag
**Constraints**: No custom styling deviating from HA norms (FR-014 / Constitution I); all strings i18n'd from first introduction (FR-011 / Constitution IV); TDD — tests fail before implementation (Constitution II)
**Scale/Scope**: 5 new LitElement components; 5 new test files; 2 modified source files (`calendar-stats-card.ts`, translations)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. HA-Native Design** — All editor components use HA-native web components (`ha-entity-picker`, `ha-sortable`, `ha-expansion-panel`, `ha-textfield`, `ha-select`, `ha-color-picker`, `ha-date-input`); no custom styling; FR-014 mandates this explicitly.
- [x] **II. Test-First** — Vitest + happy-dom test files written and confirmed failing before each component is implemented; Red-Green-Refactor followed per task.
- [x] **III. Density & Data Fidelity** — N/A for editor: no display computations or layout density concerns; editor only stores/validates configuration.
- [x] **IV. i18n from Day One** — All user-visible editor strings (labels, errors, empty state, operator names) added to `en.json` and `de.json` before the corresponding component renders them; existing `localize()` mechanism used throughout.
- [x] **V. Simplicity** — One justified exception documented in Complexity Tracking (threshold/color editor). No abstractions beyond current need; five components with single responsibilities.

## Project Structure

### Documentation (this feature)

```text
specs/009-ui-config-editor/
├── plan.md              # This file
├── research.md          # Phase 0: HA editor protocol, component availability, formula validation
├── data-model.md        # Phase 1: editor state and component hierarchy
├── quickstart.md        # Phase 1: developer setup and test guide
├── contracts/
│   └── editor-contract.md   # config-changed protocol, element interface
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code

```text
frontend/src/
├── calendar-stats-card.ts              ← modified: add getConfigElement(), getStubConfig()
├── components/
│   ├── loading-overlay.ts              (existing, unchanged)
│   ├── monthly-table.ts                (existing, unchanged)
│   ├── year-navigator.ts               (existing, unchanged)
│   ├── year-table.ts                   (existing, unchanged)
│   ├── calendar-stats-card-editor.ts   ← new: root editor element
│   ├── entity-row-editor.ts            ← new: per-entity-row editor
│   ├── expression-row-editor.ts        ← new: per-expression-row editor
│   ├── threshold-list-editor.ts        ← new: threshold sub-list editor
│   └── predecessor-list-editor.ts      ← new: predecessor sub-list editor
├── localize/
│   └── localize.ts                     (existing, unchanged)
├── translations/
│   ├── en.json                         ← modified: add editor.* and threshold.operators.* keys
│   └── de.json                         ← modified: add editor.* and threshold.operators.* keys
└── types/
    └── card-config.ts                  (existing, unchanged)

frontend/tests/component/
├── calendar-stats-card.test.ts         (existing, extended: getConfigElement test)
├── calendar-stats-card-editor.test.ts  ← new
├── entity-row-editor.test.ts           ← new
├── expression-row-editor.test.ts       ← new
├── threshold-list-editor.test.ts       ← new
└── predecessor-list-editor.test.ts     ← new
```

**Structure Decision**: Frontend-only, single-project layout. Editor components live alongside existing card components in `frontend/src/components/`. Test files mirror source structure in `frontend/tests/component/`.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Threshold + color editor (overrides CLAUDE.md "Color coding for threshold violations — Out of Scope") | User explicitly requested in spec clarification (Clarifications, Session 2026-05-25): all YAML fields must be reachable via editor (SC-002); thresholds/colors already exist in `CardConfig` schema | Keeping them YAML-only violates SC-002 after user decision to include them; CLAUDE.md restriction is overridden by the spec |
