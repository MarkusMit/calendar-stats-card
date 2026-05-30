# Tasks: UI Configuration Editor

**Input**: Design documents from `specs/009-ui-config-editor/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/editor-contract.md ✓, quickstart.md ✓

**Tests**: TDD — each failing test written and confirmed RED before its implementation (Constitution Principle II, non-negotiable).

**Realignment note (2026-05-30)**: Tasks T006–T027 were authored against the original spec. Spec was later realigned to match shipped UI (commit 5af7024). Tasks below were rewritten in place to reflect shipped behavior: chip-button add-row UI (FR-002), `ha-form` schema rendering (FR-006/007), no formula placeholder, flat thresholds/predecessors inside Advanced (FR-015/016), collapsible-per-rule threshold panels, plain text inputs for colors/dates, one-row toggle strip with default-on semantics, inline `ha-entity-picker` in main list. T031–T032 added for FR-018 detail-page navigation and FR-019 entity-picker preload (implemented post-task-generation in commits a1a73ed and 532ab71).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story this task belongs to (US1–US6)
- File paths relative to repo root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: i18n strings and HA card registration — required by every subsequent component.

- [x] T001 Add all `editor.*` and `threshold.operators.*` i18n keys to `frontend/src/translations/en.json` AND `frontend/src/translations/de.json` simultaneously (full key list in `specs/009-ui-config-editor/research.md` §6). **Key format note**: JSON keys for threshold operators use underscores (`equals_above`, `not_below`, etc.) while `ThresholdOperator` type values use hyphens (`equals-above`, `not-below`). These differ by design — the JSON key is a lookup name, not the stored operator value.
- [x] T002 [P] Write failing tests for `CalendarStatsCard.getConfigElement()` and `CalendarStatsCard.getStubConfig()` in `frontend/tests/component/calendar-stats-card.test.ts`
- [x] T003 Add `static getConfigElement()` returning `document.createElement('calendar-stats-card-editor')` and `static getStubConfig()` returning `{ type: 'calendar-stats-card', entities: [] }` to `frontend/src/calendar-stats-card.ts` (makes T002 pass)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Root editor element exists before any user story renders rows.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Write failing tests for `CalendarStatsCardEditor`: `setConfig()` stores entities and unknown top-level fields, `hass` property triggers re-render, `config-changed` event shape matches `specs/009-ui-config-editor/contracts/editor-contract.md`, unknown fields preserved in payload (FR-010) in `frontend/tests/component/calendar-stats-card-editor.test.ts`
- [x] T005 Create `frontend/src/components/calendar-stats-card-editor.ts`: `@customElement('calendar-stats-card-editor')`, reactive `hass` property, `setConfig()` destructures `{ type, entities, ...rest }` into `_entities` and `_rest`, `_dispatchConfigChanged()` emits `new CustomEvent('config-changed', { detail: { config: { type: 'calendar-stats-card', entities: [..._entities], ..._rest } }, bubbles: true, composed: true })` (makes T004 pass)

**Checkpoint**: Foundation ready — user story phases can now begin.

---

## Phase 3: User Story 1 — Add Card via Visual UI (Priority: P1) 🎯 MVP

**Goal**: HA opens the visual editor; user adds an entity row via entity picker; card preview updates live.

**Independent Test**: Add CalendarStats from HA card picker → visual form appears with empty-state message → user adds one entity row via picker → card preview renders that entity's data immediately.

### Tests for User Story 1 ⚠️ Write FIRST — confirm RED before implementing

- [x] T006 [P] [US1] Write failing tests for `CalendarStatsCardEditor`: empty-state message renders when `_entities` is empty above the add-row chips (FR-017); `+ Entity` chip-button and `+ Expression` chip-button render below row list (FR-002); clicking `+ Entity` reveals inline `ha-entity-picker` row with cancel control; selecting entity ID appends entity row to `_entities` and dispatches `config-changed` with correct payload in `frontend/tests/component/calendar-stats-card-editor.test.ts`
- [x] T007 [P] [US1] Write failing tests for `EntityRowEditor`: `ha-form` schema renders `entity`, `name`, `precision` immediately (FR-006); dispatches `row-changed` with `{ index, config: EntityRowConfig }` on field changes in `frontend/tests/component/entity-row-editor.test.ts`

### Implementation for User Story 1

- [x] T008 [US1] Create `frontend/src/components/entity-row-editor.ts`: `@customElement('calendar-stats-entity-row-editor')`, props `hass`, `config: EntityRowConfig`, `index: number`, `lang: string`; `ha-form` schema with `entity` (ha-entity-picker selector), `name` (text), `precision` (number) always visible (FR-006); stale-entity indicator — `mdi:alert-circle` icon + `localize('editor.entity_not_found', lang)` when `hass.states[config.entity]` is undefined (FR-013); dispatches `row-changed` on any field change (makes T007 pass)
- [x] T009 [US1] Implement chip-button add-row UI and entity-row rendering in `frontend/src/components/calendar-stats-card-editor.ts`: render empty-state `localize('editor.no_rows', lang)` as italic centered message above add-row chips when `_entities.length === 0` (FR-017); render two HA chip-styled buttons `+ Entity` and `+ Expression` (FR-002); clicking `+ Entity` reveals inline `ha-entity-picker` row with cancel control — selecting ID appends `{ entity: id }` to `_entities`, dispatches `config-changed`, returns to chip row; clicking `+ Expression` appends draft `{ expression: '' }` to `_entities` and opens its detail page (FR-002, FR-007); render unified row list with one-line per row (drag handle, identity, delete, pencil — see T031); handle `row-changed` events to update `_entities[index]` and dispatch `config-changed` (makes T006 pass)

**Checkpoint**: US1 functional — card configurable with one entity row through visual UI without YAML.

---

## Phase 4: User Story 2 — Manage Rows (Priority: P2)

**Goal**: User adds, removes, and reorders entity and expression rows in the unified list.

**Independent Test**: Editor with two entity rows and one expression row — remove middle entity row, drag expression row to top, add new entity row — card preview reflects new order immediately.

### Tests for User Story 2 ⚠️ Write FIRST — confirm RED before implementing

- [x] T010 [P] [US2] Write failing tests for `CalendarStatsCardEditor` in `frontend/tests/component/calendar-stats-card-editor.test.ts` — two groups: **(a) row management** (T012 makes these GREEN): `ha-sortable` `item-moved` event reorders `_entities` and dispatches `config-changed`; delete `ha-icon-button` per row removes entry and dispatches `config-changed`; drag-handle is the sole reorder UX (no up/down buttons — Assumptions). **(b) expression-row addition** (T013 makes these GREEN): clicking `+ Expression` chip appends draft `{ expression: '' }` and opens its detail page but does NOT dispatch `config-changed` until first valid `row-changed` from that row (FR-008); `<calendar-stats-expression-row-editor>` is rendered for expression rows.
- [x] T011 [P] [US2] Write failing tests for `ExpressionRowEditor`: `ha-form` schema renders `expression` as multi-line text selector (no placeholder injection — Clarif. 2026-05-30) plus `name`, `unit`, `precision` always visible (FR-007); dispatches `row-changed` with `ExpressionRowConfig` on valid field changes in `frontend/tests/component/expression-row-editor.test.ts`

### Implementation for User Story 2

- [x] T012 [US2] Add to `frontend/src/components/calendar-stats-card-editor.ts`: wrap row list in `ha-sortable` with handle-selector binding, handle `item-moved` event by splicing `_entities` and dispatching `config-changed`; add delete `ha-icon-button` per row (splice `_entities`, dispatch `config-changed`); no up/down buttons — `ha-sortable` built-in keyboard support covers accessibility (makes T010 group-a tests GREEN)
- [x] T013 [US2] Create `frontend/src/components/expression-row-editor.ts`: `@customElement('calendar-stats-expression-row-editor')`, props `hass`, `config: ExpressionRowConfig`, `index: number`, `lang: string`; internal `_dirtyFormula: string` and `_formulaError: string | null`; `ha-form` schema with `expression` (multi-line text selector, no placeholder), `name`, `unit`, `precision` always visible; dispatches `row-changed` on field changes. Wire into `calendar-stats-card-editor.ts`: render `<calendar-stats-expression-row-editor>` for expression rows in the detail page; on `+ Expression` chip click, append `{ expression: '' }` to `_entities` and open detail page — do NOT call `_dispatchConfigChanged()` at this point; on `row-changed` received, update `_entities[index]` then call `_dispatchConfigChanged()`; in `_dispatchConfigChanged()`, filter `_entities` to exclude any `ExpressionRowConfig` where `expression === ''` before building the payload — this is reorder-safe (checks config value, not index) and ensures FR-008 brand-new rows never reach the card preview until first valid formula (makes T010 group-b tests GREEN and T011 pass)

**Checkpoint**: US1 + US2 functional — full row management (add/remove/reorder both row types).

---

## Phase 5: User Story 3 — Configure Per-Entity Options (Priority: P3)

**Goal**: User sets factor, unit, visibility toggles (show_zero/min/avg/max), and color overrides for entity rows through the Advanced collapsible section.

**Independent Test**: Pick entity row → override name and set precision to 1 → card shows custom name and rounded values; expand Advanced → set factor and unit → card shows scaled values with overridden unit; toggle show_min off → min sub-row hidden.

### Tests for User Story 3 ⚠️ Write FIRST — confirm RED before implementing

- [x] T014 [US3] Write failing tests for `EntityRowEditor` Advanced section: `ha-expansion-panel` renders collapsed by default; `ha-form` schema renders `factor`, `unit`, `text_color`, `background_color` (plain text inputs — Clarif. 2026-05-30); compact one-row strip of `ha-formfield` + `ha-checkbox` for `show_zero`, `show_min`, `show_avg`, `show_max` with default-on semantics (`undefined` and `true` both render checked) (FR-006); each field change dispatches `row-changed` with updated `EntityRowConfig` in `frontend/tests/component/entity-row-editor.test.ts`

### Implementation for User Story 3

- [x] T015 [US3] Add `ha-expansion-panel` Advanced section to `frontend/src/components/entity-row-editor.ts`: `ha-form` schema for `factor` (number), `unit` (text), `text_color` (text), `background_color` (text) — plain text inputs (FR-015 preserves `ha-color-picker` substitution as MAY, not used); compact one-row strip of `ha-formfield` + `ha-checkbox` for `show_zero`/`show_min`/`show_avg`/`show_max` with default-on semantics matching consumer `!== false` logic in monthly-table / year-table; each field change dispatches `row-changed` with updated `EntityRowConfig` spread over unknown row fields (makes T014 pass)

**Checkpoint**: US3 functional — all per-entity display options reachable without YAML.

---

## Phase 6: User Story 4 — Configure Expression Rows (Priority: P3)

**Goal**: Formula validation fires on blur with distinct syntax/entity-not-found errors; Advanced section exposes show_zero and color overrides.

**Independent Test**: Add expression row → enter invalid formula → blur → see "Invalid expression syntax" error, no dispatch → fix formula with valid entity IDs → blur → error clears, `row-changed` dispatched, card preview shows computed values.

### Tests for User Story 4 ⚠️ Write FIRST — confirm RED before implementing

- [x] T016 [US4] Write failing tests for `ExpressionRowEditor` formula validation: blur on invalid syntax → `_formulaError` set to syntax message, `row-changed` NOT dispatched; blur on formula referencing unknown entity ID → distinct entity error message with ID, no dispatch; blur on valid formula → `_formulaError` null, `row-changed` dispatched; formula text preserved in input in all cases (FR-008, FR-012) in `frontend/tests/component/expression-row-editor.test.ts`
- [x] T017 [US4] Write failing tests for `ExpressionRowEditor` Advanced section: `ha-expansion-panel` renders collapsed by default; `ha-formfield` + `ha-checkbox` for `show_zero` with default-on semantics; `ha-form` text inputs for `text_color` and `background_color` (plain text — Clarif. 2026-05-30); changes dispatch `row-changed` in `frontend/tests/component/expression-row-editor.test.ts`

### Implementation for User Story 4

- [x] T018 [US4] Implement formula validation in `frontend/src/components/expression-row-editor.ts`: on blur call `tokenize(formula)` from `frontend/src/services/expression-evaluator.ts` (catch SyntaxError → `_formulaError = localize('editor.invalid_expression_syntax', lang)`); then call `extractEntityIds(formula)` and check each ID in `hass.states` (missing → `_formulaError = localize('editor.entity_not_found_in_expression', lang).replace('{entity}', id)`); if valid → `_formulaError = null`, dispatch `row-changed`; never modify formula text (FR-008, FR-012); render `_formulaError` inline below formula field (makes T016 pass)
- [x] T019 [US4] Add `ha-expansion-panel` Advanced section to `frontend/src/components/expression-row-editor.ts`: `ha-formfield` + `ha-checkbox` `show_zero` with default-on semantics; `ha-form` text inputs for `text_color` + `background_color` (plain text per Clarif. 2026-05-30; FR-015 preserves `ha-color-picker` MAY); each change dispatches `row-changed` (makes T017 pass)

**Checkpoint**: US4 functional — expression rows fully configurable with live formula validation.

---

## Phase 7: User Story 5 — Configure Threshold Rules (Priority: P3)

**Goal**: User adds, edits, and removes threshold rules on both entity and expression rows through a nested Thresholds collapsible inside Advanced.

**Independent Test**: Open entity row Advanced → expand Thresholds → add rule: operator "above", value 30, red text_color → card applies color to cells where value > 30 immediately; remove rule → color disappears.

### Tests for User Story 5 ⚠️ Write FIRST — confirm RED before implementing

- [x] T020 [P] [US5] Write failing tests for `ThresholdListEditor`: chip-styled `+ Add threshold` button appends rule with defaults `{ operator: 'above', value: 0 }`; each rule renders as its own `ha-expansion-panel` with header showing operator symbol + value (e.g. `> 30`) or `name (> 30)` when `name` set; `ha-form` schema inside panel for operator (select with 6 options: above/equals-above/equals-below/below/not-below/not-above), value (number), name (text), text_color (text), background_color (text — plain text inputs per Clarif. 2026-05-30); delete `ha-icon-button` inside panel removes rule; any mutation dispatches `thresholds-changed` with full updated `ThresholdRule[]` in `frontend/tests/component/threshold-list-editor.test.ts`
- [x] T021 [P] [US5] Write failing tests for `EntityRowEditor` Thresholds sub-list: `<calendar-stats-threshold-list-editor>` renders **flat** directly inside the Advanced `ha-expansion-panel` (no extra nested collapsible per list — Clarif. 2026-05-30); `thresholds-changed` event updates `EntityRowConfig.thresholds` and dispatches `row-changed` in `frontend/tests/component/entity-row-editor.test.ts`

### Implementation for User Story 5

- [x] T022 [US5] Create `frontend/src/components/threshold-list-editor.ts`: `@customElement('calendar-stats-threshold-list-editor')`, props `thresholds: ThresholdRule[]` and `lang: string`; chip-styled `+ Add threshold` button appends `{ operator: 'above', value: 0 }`; each rule renders as `ha-expansion-panel` whose header shows operator symbol + value (e.g. `> 30` or `Hot (> 30)` when `name` set); `ha-form` schema inside panel: operator select with 6 values (above/equals-above/equals-below/below/not-below/not-above), value number, name text, text_color text, background_color text — all plain text inputs (FR-015 `ha-color-picker` MAY not used); **operator localization**: i18n key uses underscores but `ThresholdOperator` values use hyphens — look up label as `localize('threshold.operators.' + operator.replace(/-/g, '_'), lang)`; delete `ha-icon-button` inside each panel; dispatches `thresholds-changed` with updated array on any mutation (makes T020 pass)
- [x] T023 [US5] Render `<calendar-stats-threshold-list-editor>` **flat** directly inside the Advanced `ha-expansion-panel` of both `frontend/src/components/entity-row-editor.ts` and `frontend/src/components/expression-row-editor.ts` (no nested collapsible per list — Clarif. 2026-05-30): pass `thresholds` prop; handle `thresholds-changed` event to update config and dispatch `row-changed` (makes T021 pass)

**Checkpoint**: US5 functional — threshold rules configurable on all row types without YAML.

---

## Phase 8: User Story 6 — Configure Predecessor Entities (Priority: P3)

**Goal**: User adds predecessor entries (entity ID, replaced_on date, optional factor) to entity rows through a nested Predecessors collapsible inside Advanced.

**Independent Test**: Open entity row Advanced → expand Predecessors → add predecessor with valid entity ID and replaced_on date → card uses predecessor data for dates before replacement; add predecessor with unknown entity ID → stale-entity warning appears.

### Tests for User Story 6 ⚠️ Write FIRST — confirm RED before implementing

- [x] T024 [P] [US6] Write failing tests for `PredecessorListEditor`: chip-styled `+ Add predecessor` button appends entry `{ entity: '' }`; each entry renders as bordered card (not collapsible — Clarif. 2026-05-30); `ha-form` schema for entity (plain text, any string), replaced_on (text input with `YYYY-MM-DD` placeholder — plain text per Clarif. 2026-05-30), factor (number, optional); delete `ha-icon-button` per entry; stale-entity indicator (warning icon + `localize('editor.entity_not_found', lang)`) when `hass.states[entity]` is undefined (FR-013); any mutation dispatches `predecessors-changed` with full updated `PredecessorConfig[]` in `frontend/tests/component/predecessor-list-editor.test.ts`
- [x] T025 [P] [US6] Write failing tests for `EntityRowEditor` Predecessors sub-list: `<calendar-stats-predecessor-list-editor>` renders **flat** directly inside the Advanced `ha-expansion-panel` (no extra nested collapsible — Clarif. 2026-05-30); `predecessors-changed` event updates `EntityRowConfig.predecessors` and dispatches `row-changed` in `frontend/tests/component/entity-row-editor.test.ts`

### Implementation for User Story 6

- [x] T026 [US6] Create `frontend/src/components/predecessor-list-editor.ts`: `@customElement('calendar-stats-predecessor-list-editor')`, props `hass`, `predecessors: PredecessorConfig[]`, `lang: string`; chip-styled `+ Add predecessor` button appends `{ entity: '' }`; each entry renders as a bordered card with three fields and a delete control (not a collapsible panel — Clarif. 2026-05-30); `ha-form` schema: entity (plain text, any string), replaced_on (text input with `YYYY-MM-DD` placeholder — plain text per Clarif. 2026-05-30; FR-016 preserves `ha-date-input` MAY), factor (number, optional); stale-entity indicator when `hass.states[entry.entity]` undefined (FR-013); dispatches `predecessors-changed` with updated array on any mutation (makes T024 pass)
- [x] T027 [US6] Render `<calendar-stats-predecessor-list-editor>` **flat** directly inside the Advanced `ha-expansion-panel` of `frontend/src/components/entity-row-editor.ts` (no nested collapsible — Clarif. 2026-05-30): pass `hass` and `predecessors` props; handle `predecessors-changed` event to update config and dispatch `row-changed` (makes T025 pass)

**Checkpoint**: All 6 user stories complete — full visual editor coverage of every YAML-configurable field.

---

## Phase 8b: Retrofitted Tasks (Post-Realignment, 2026-05-30)

**Purpose**: Cover FR-018 (detail-page navigation) and FR-019 (entity-picker preload). Both implemented post-task-generation in commits a1a73ed and 532ab71 respectively, then formalized in spec realignment commit 5af7024.

- [x] T031 [US2] Implement row-detail page navigation in `frontend/src/components/calendar-stats-card-editor.ts` (FR-018): unified row list renders each row as a one-line header — drag-handle icon, identity (inline `ha-entity-picker` bound to `entity` for entity rows; function icon + `name`/`expression` text for expression rows), delete `ha-icon-button`, pencil edit `ha-icon-button`; pencil click swaps the panel to a row-detail view containing back-arrow header, row label, type badge, and the appropriate sub-editor (`calendar-stats-entity-row-editor` or `calendar-stats-expression-row-editor`); back arrow returns to row list; row list and detail view are mutually exclusive within the same panel; inline `ha-entity-picker` changes in the main list dispatch `config-changed` without opening the detail page. Tests in `frontend/tests/component/calendar-stats-card-editor.test.ts` cover header rendering, pencil → detail navigation, back-arrow return, inline-picker dispatch behavior.
- [x] T032 [Foundation] Implement `ha-entity-picker` preload in `frontend/src/components/calendar-stats-card-editor.ts` `connectedCallback` (FR-019): call `window.loadCardHelpers()`, then `createCardElement({ type: 'entities', entities: [] }).constructor.getConfigElement()` to force HA's lazy registration; await `customElements.whenDefined('ha-entity-picker')`; until defined, render a localized loading placeholder (`localize('editor.loading', lang)`) in place of the row list. Reason: without preload, inline `ha-entity-picker` instances inside our shadow DOM render zero-height on first editor open. Tests cover loading-placeholder render before whenDefined resolves and row-list render after.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: FR-010 round-trip verification, full test pass, and HA smoke test.

- [x] T028 [P] Write integration test for unknown field round-trip (FR-010): call `setConfig({ type: 'calendar-stats-card', entities: [{ entity: 'sensor.x', unknownRowField: 'r' }], unknownTopField: 't' })` → mutate a known field → assert `config-changed` payload contains `unknownRowField: 'r'` and `unknownTopField: 't'` unchanged in `frontend/tests/component/calendar-stats-card-editor.test.ts`
- [x] T029 [P] Run `npm test` then `npm run lint` from `frontend/` in WSL2; resolve any test failures or lint errors before build
- [x] T030 Build (`npm run build` from `frontend/`) and smoke-test in HA per `specs/009-ui-config-editor/quickstart.md`: copy `frontend/dist/calendar-stats-card.js` to HA `www/`, add Lovelace resource, open card picker, verify visual editor opens and all 6 user story flows work end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — MVP; validate here before continuing
- **US2 (Phase 4)**: Depends on US1 (EntityRowEditor from T008 must exist)
- **US3 (Phase 5)**: Depends on T008 (EntityRowEditor file exists to extend)
- **US4 (Phase 6)**: Depends on T013 (ExpressionRowEditor file exists to extend)
- **US5 (Phase 7)**: Depends on Phase 2; T023 extends T015 and T019, so after US3/US4
- **US6 (Phase 8)**: Depends on T015 (EntityRowEditor Advanced section exists)
- **Retrofitted (Phase 8b)**: T031 depends on US1+US2 (row list + sub-editors exist); T032 depends on Phase 2 (root editor exists)
- **Polish (Phase 9)**: Depends on all user stories complete

### Within Each Phase

- Tests MUST be written and confirmed FAILING before implementation starts
- T002 → T003
- T004 → T005
- T006 ∥ T007 (different files) → T008 → T009
- T010 ∥ T011 (different files) → T012 → T013
- T014 → T015
- T016 → T017 → T018 → T019
- T020 ∥ T021 (different files) → T022 → T023
- T024 ∥ T025 (different files) → T026 → T027
- T028 ∥ T029 → T030

### Parallel Opportunities (same phase, different files)

| Parallel pair | Files |
|---|---|
| T006, T007 | `calendar-stats-card-editor.test.ts` ∥ `entity-row-editor.test.ts` |
| T010, T011 | `calendar-stats-card-editor.test.ts` ∥ `expression-row-editor.test.ts` |
| T020, T021 | `threshold-list-editor.test.ts` ∥ `entity-row-editor.test.ts` |
| T024, T025 | `predecessor-list-editor.test.ts` ∥ `entity-row-editor.test.ts` |
| T028, T029 | test file ∥ terminal |

---

## Parallel Example: User Story 5 (Thresholds)

```
# Write tests in parallel (different files):
T020 → frontend/tests/component/threshold-list-editor.test.ts
T021 → frontend/tests/component/entity-row-editor.test.ts

# Implement sequentially:
T022 → Create frontend/src/components/threshold-list-editor.ts
T023 → Wire into entity-row-editor.ts and expression-row-editor.ts
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T005)
3. Complete Phase 3: US1 (T006–T009)
4. **STOP and VALIDATE**: Add card from HA picker, confirm visual editor opens, add one entity row, verify live preview without YAML
5. Proceed to US2–US6 one story at a time

### Incremental Delivery

1. Setup + Foundational → foundation ready
2. US1 → entity rows live-update → MVP
3. US2 → full row management (add/remove/reorder + expression rows)
4. US3 → all per-entity Advanced options
5. US4 → expression formula validation
6. US5 → threshold rules
7. US6 → predecessor entities
8. Polish → build + HA smoke test

---

## Notes

- [P] marks tasks in different files with no cross-dependencies — can run in parallel with sufficient team
- TDD is non-negotiable (Constitution II): RED before GREEN, every time
- All `localize()` calls reference keys added in T001 — zero hardcoded strings in components
- Unknown field preservation (FR-010) is implemented at root editor level in T005; verified end-to-end in T028
- `ha-color-picker` fallback: check `customElements.get('ha-color-picker')` at render time; fall back to `ha-textfield` accepting any CSS color string
- Formula validation uses `tokenize()` and `extractEntityIds()` from `frontend/src/services/expression-evaluator.ts` — do not reimplement
- `localize('editor.entity_not_found_in_expression', lang).replace('{entity}', id)` — `localize()` does not support placeholder substitution natively (see `specs/009-ui-config-editor/research.md` §6)
- 32 tasks total across 10 phases (T031–T032 retrofitted in Phase 8b after 2026-05-30 spec realignment)
