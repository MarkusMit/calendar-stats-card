# Tasks: UI Configuration Editor

**Input**: Design documents from `specs/009-ui-config-editor/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/editor-contract.md ✓, quickstart.md ✓

**Tests**: TDD — each failing test written and confirmed RED before its implementation (Constitution Principle II, non-negotiable).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story this task belongs to (US1–US6)
- File paths relative to repo root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: i18n strings and HA card registration — required by every subsequent component.

- [ ] T001 Add all `editor.*` and `threshold.operators.*` i18n keys to `frontend/src/translations/en.json` AND `frontend/src/translations/de.json` simultaneously (full key list in `specs/009-ui-config-editor/research.md` §6). **Key format note**: JSON keys for threshold operators use underscores (`equals_above`, `not_below`, etc.) while `ThresholdOperator` type values use hyphens (`equals-above`, `not-below`). These differ by design — the JSON key is a lookup name, not the stored operator value.
- [ ] T002 [P] Write failing tests for `CalendarStatsCard.getConfigElement()` and `CalendarStatsCard.getStubConfig()` in `frontend/tests/component/calendar-stats-card.test.ts`
- [ ] T003 Add `static getConfigElement()` returning `document.createElement('calendar-stats-card-editor')` and `static getStubConfig()` returning `{ type: 'calendar-stats-card', entities: [] }` to `frontend/src/calendar-stats-card.ts` (makes T002 pass)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Root editor element exists before any user story renders rows.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [ ] T004 Write failing tests for `CalendarStatsCardEditor`: `setConfig()` stores entities and unknown top-level fields, `hass` property triggers re-render, `config-changed` event shape matches `specs/009-ui-config-editor/contracts/editor-contract.md`, unknown fields preserved in payload (FR-010) in `frontend/tests/component/calendar-stats-card-editor.test.ts`
- [ ] T005 Create `frontend/src/components/calendar-stats-card-editor.ts`: `@customElement('calendar-stats-card-editor')`, reactive `hass` property, `setConfig()` destructures `{ type, entities, ...rest }` into `_entities` and `_rest`, `_dispatchConfigChanged()` emits `new CustomEvent('config-changed', { detail: { config: { type: 'calendar-stats-card', entities: [..._entities], ..._rest } }, bubbles: true, composed: true })` (makes T004 pass)

**Checkpoint**: Foundation ready — user story phases can now begin.

---

## Phase 3: User Story 1 — Add Card via Visual UI (Priority: P1) 🎯 MVP

**Goal**: HA opens the visual editor; user adds an entity row via entity picker; card preview updates live.

**Independent Test**: Add CalendarStats from HA card picker → visual form appears with empty-state message → user adds one entity row via picker → card preview renders that entity's data immediately.

### Tests for User Story 1 ⚠️ Write FIRST — confirm RED before implementing

- [ ] T006 [P] [US1] Write failing tests for `CalendarStatsCardEditor`: empty-state message renders when `_entities` is empty (FR-017), "Add row" button is present, "Entity row" option triggers `ha-entity-picker`, entity selection appends to `_entities` and dispatches `config-changed` with correct payload in `frontend/tests/component/calendar-stats-card-editor.test.ts`
- [ ] T007 [P] [US1] Write failing tests for `EntityRowEditor`: `ha-entity-picker` renders with correct entity ID, `ha-textfield` for name and precision are always visible, dispatches `row-changed` with `{ index, config: EntityRowConfig }` on field changes in `frontend/tests/component/entity-row-editor.test.ts`

### Implementation for User Story 1

- [ ] T008 [US1] Create `frontend/src/components/entity-row-editor.ts`: `@customElement('calendar-stats-entity-row-editor')`, props `hass`, `config: EntityRowConfig`, `index: number`, `lang: string`; `ha-entity-picker` for entity ID; `ha-textfield` name + precision (always visible); stale-entity indicator — `mdi:alert-circle` icon + `localize('editor.entity_not_found', lang)` when `hass.states[config.entity]` is undefined (FR-013); dispatches `row-changed` on any field change (makes T007 pass)
- [ ] T009 [US1] Implement "Add row" button and entity-row rendering in `frontend/src/components/calendar-stats-card-editor.ts`: render empty-state `localize('editor.no_rows', lang)` message when `_entities.length === 0` (FR-017); "Add row" button opens type menu with "Entity row" and "Expression row" options; "Entity row" presents `ha-entity-picker` then appends `{ entity: id }` to `_entities` and dispatches `config-changed`; render `<calendar-stats-entity-row-editor>` per entity row; handle `row-changed` events to update `_entities[index]` and dispatch `config-changed` (makes T006 pass)

**Checkpoint**: US1 functional — card configurable with one entity row through visual UI without YAML.

---

## Phase 4: User Story 2 — Manage Rows (Priority: P2)

**Goal**: User adds, removes, and reorders entity and expression rows in the unified list.

**Independent Test**: Editor with two entity rows and one expression row — remove middle entity row, drag expression row to top, add new entity row — card preview reflects new order immediately.

### Tests for User Story 2 ⚠️ Write FIRST — confirm RED before implementing

- [ ] T010 [P] [US2] Write failing tests for `CalendarStatsCardEditor` in `frontend/tests/component/calendar-stats-card-editor.test.ts` — two groups: **(a) row management** (T012 makes these GREEN): `ha-sortable` `item-moved` event reorders `_entities` and dispatches `config-changed`; remove `ha-icon-button` per row deletes entry and dispatches `config-changed`; up/down buttons reorder `_entities` and dispatch `config-changed`. **(b) expression-row addition** (T013 makes these GREEN): "Expression row" option internally appends a draft row but does NOT dispatch `config-changed` until first valid `row-changed` from that row (FR-008); `<calendar-stats-expression-row-editor>` is rendered for expression rows.
- [ ] T011 [P] [US2] Write failing tests for `ExpressionRowEditor`: `ha-textarea` renders for formula with placeholder `{{ sensor.a - sensor.b }}` (FR-007); `ha-textfield` for name, unit, precision are always visible (FR-007); dispatches `row-changed` with `ExpressionRowConfig` on valid field changes in `frontend/tests/component/expression-row-editor.test.ts`

### Implementation for User Story 2

- [ ] T012 [US2] Add to `frontend/src/components/calendar-stats-card-editor.ts`: wrap row list in `ha-sortable`, handle `item-moved` event by splicing `_entities` and dispatching `config-changed`; add remove `ha-icon-button` per row (splice `_entities`, dispatch `config-changed`); add up/down `ha-icon-button` keyboard fallback with same splice logic (makes T010 group-a tests GREEN)
- [ ] T013 [US2] Create `frontend/src/components/expression-row-editor.ts`: `@customElement('calendar-stats-expression-row-editor')`, props `hass`, `config: ExpressionRowConfig`, `index: number`, `lang: string`; internal `_dirtyFormula: string` and `_formulaError: string | null`; `ha-textarea` formula with placeholder; `ha-textfield` name/unit/precision (always visible); dispatches `row-changed` on name/unit/precision field changes. Wire into `calendar-stats-card-editor.ts`: render `<calendar-stats-expression-row-editor>` for expression rows; on "Add Expression row" click, append `{ expression: '' }` to `_entities` and render it — do NOT call `_dispatchConfigChanged()` at this point; on `row-changed` received, update `_entities[index]` then call `_dispatchConfigChanged()`; in `_dispatchConfigChanged()`, filter `_entities` to exclude any `ExpressionRowConfig` where `expression === ''` before building the payload — this is reorder-safe (checks config value, not index) and ensures FR-008 brand-new rows never reach the card preview until first valid formula (makes T010 group-b tests GREEN and T011 pass)

**Checkpoint**: US1 + US2 functional — full row management (add/remove/reorder both row types).

---

## Phase 5: User Story 3 — Configure Per-Entity Options (Priority: P3)

**Goal**: User sets factor, unit, visibility toggles (show_zero/min/avg/max), and color overrides for entity rows through the Advanced collapsible section.

**Independent Test**: Pick entity row → override name and set precision to 1 → card shows custom name and rounded values; expand Advanced → set factor and unit → card shows scaled values with overridden unit; toggle show_min off → min sub-row hidden.

### Tests for User Story 3 ⚠️ Write FIRST — confirm RED before implementing

- [ ] T014 [US3] Write failing tests for `EntityRowEditor` Advanced section: `ha-expansion-panel` renders collapsed by default; contains `ha-textfield` for factor and unit; `ha-checkbox` for show_zero, show_min, show_avg, show_max; `ha-color-picker` for text_color and background_color; each field change dispatches `row-changed` with updated `EntityRowConfig` in `frontend/tests/component/entity-row-editor.test.ts`

### Implementation for User Story 3

- [ ] T015 [US3] Add `ha-expansion-panel` Advanced section to `frontend/src/components/entity-row-editor.ts`: `ha-textfield` factor + unit; `ha-checkbox` show_zero/show_min/show_avg/show_max; `ha-color-picker` text_color + background_color (fall back to `ha-textfield` if `customElements.get('ha-color-picker')` is undefined per FR-015); each field change dispatches `row-changed` with updated `EntityRowConfig` spread over unknown row fields (makes T014 pass)

**Checkpoint**: US3 functional — all per-entity display options reachable without YAML.

---

## Phase 6: User Story 4 — Configure Expression Rows (Priority: P3)

**Goal**: Formula validation fires on blur with distinct syntax/entity-not-found errors; Advanced section exposes show_zero and color overrides.

**Independent Test**: Add expression row → enter invalid formula → blur → see "Invalid expression syntax" error, no dispatch → fix formula with valid entity IDs → blur → error clears, `row-changed` dispatched, card preview shows computed values.

### Tests for User Story 4 ⚠️ Write FIRST — confirm RED before implementing

- [ ] T016 [US4] Write failing tests for `ExpressionRowEditor` formula validation: blur on invalid syntax → `_formulaError` set to syntax message, `row-changed` NOT dispatched; blur on formula referencing unknown entity ID → distinct entity error message with ID, no dispatch; blur on valid formula → `_formulaError` null, `row-changed` dispatched; formula text preserved in input in all cases (FR-008, FR-012) in `frontend/tests/component/expression-row-editor.test.ts`
- [ ] T017 [US4] Write failing tests for `ExpressionRowEditor` Advanced section: `ha-expansion-panel` renders collapsed by default; `ha-checkbox` for show_zero; `ha-color-picker` for text_color and background_color; changes dispatch `row-changed` in `frontend/tests/component/expression-row-editor.test.ts`

### Implementation for User Story 4

- [ ] T018 [US4] Implement formula validation in `frontend/src/components/expression-row-editor.ts`: on blur call `tokenize(formula)` from `frontend/src/services/expression-evaluator.ts` (catch SyntaxError → `_formulaError = localize('editor.invalid_expression_syntax', lang)`); then call `extractEntityIds(formula)` and check each ID in `hass.states` (missing → `_formulaError = localize('editor.entity_not_found_in_expression', lang).replace('{entity}', id)`); if valid → `_formulaError = null`, dispatch `row-changed`; never modify formula text (FR-008, FR-012); render `_formulaError` inline below formula field (makes T016 pass)
- [ ] T019 [US4] Add `ha-expansion-panel` Advanced section to `frontend/src/components/expression-row-editor.ts`: `ha-checkbox` show_zero; `ha-color-picker` text_color + background_color (same fallback logic as EntityRowEditor T015); each change dispatches `row-changed` (makes T017 pass)

**Checkpoint**: US4 functional — expression rows fully configurable with live formula validation.

---

## Phase 7: User Story 5 — Configure Threshold Rules (Priority: P3)

**Goal**: User adds, edits, and removes threshold rules on both entity and expression rows through a nested Thresholds collapsible inside Advanced.

**Independent Test**: Open entity row Advanced → expand Thresholds → add rule: operator "above", value 30, red text_color → card applies color to cells where value > 30 immediately; remove rule → color disappears.

### Tests for User Story 5 ⚠️ Write FIRST — confirm RED before implementing

- [ ] T020 [P] [US5] Write failing tests for `ThresholdListEditor`: "Add threshold" button appends rule with defaults; remove `ha-icon-button` deletes rule; `ha-select` operator has 6 `ha-list-item` options (above/equals-above/equals-below/below/not-below/not-above); `ha-textfield` type=number for value; `ha-textfield` for name; `ha-color-picker` for text_color and background_color per rule; any mutation dispatches `thresholds-changed` with full updated `ThresholdRule[]` in `frontend/tests/component/threshold-list-editor.test.ts`
- [ ] T021 [P] [US5] Write failing tests for `EntityRowEditor` Thresholds sub-section: nested `ha-expansion-panel` inside Advanced renders `<calendar-stats-threshold-list-editor>`; `thresholds-changed` event updates `EntityRowConfig.thresholds` and dispatches `row-changed` in `frontend/tests/component/entity-row-editor.test.ts`

### Implementation for User Story 5

- [ ] T022 [US5] Create `frontend/src/components/threshold-list-editor.ts`: `@customElement('calendar-stats-threshold-list-editor')`, props `thresholds: ThresholdRule[]` and `lang: string`; "Add threshold" button appends `{ operator: 'above', value: 0 }`; remove `ha-icon-button` per rule; `ha-select` + `ha-list-item` for operator (6 values: above/equals-above/equals-below/below/not-below/not-above); **operator localization**: i18n key uses underscores but `ThresholdOperator` values use hyphens — look up label as `localize('threshold.operators.' + operator.replace(/-/g, '_'), lang)`; `ha-textfield` type=number value + `ha-textfield` name; `ha-color-picker` text_color + background_color per rule; dispatches `thresholds-changed` with updated array on any mutation (makes T020 pass)
- [ ] T023 [US5] Add nested Thresholds `ha-expansion-panel` inside the Advanced section of both `frontend/src/components/entity-row-editor.ts` and `frontend/src/components/expression-row-editor.ts`: render `<calendar-stats-threshold-list-editor>` with `thresholds` prop; handle `thresholds-changed` event to update config and dispatch `row-changed` (makes T021 pass)

**Checkpoint**: US5 functional — threshold rules configurable on all row types without YAML.

---

## Phase 8: User Story 6 — Configure Predecessor Entities (Priority: P3)

**Goal**: User adds predecessor entries (entity ID, replaced_on date, optional factor) to entity rows through a nested Predecessors collapsible inside Advanced.

**Independent Test**: Open entity row Advanced → expand Predecessors → add predecessor with valid entity ID and replaced_on date → card uses predecessor data for dates before replacement; add predecessor with unknown entity ID → stale-entity warning appears.

### Tests for User Story 6 ⚠️ Write FIRST — confirm RED before implementing

- [ ] T024 [P] [US6] Write failing tests for `PredecessorListEditor`: "Add predecessor" button appends entry; remove `ha-icon-button` deletes entry; `ha-textfield` accepts any entity ID string; `ha-date-input` renders for replaced_on; `ha-textfield` type=number for factor (optional); stale-entity indicator (warning icon + `localize('editor.entity_not_found', lang)`) when `hass.states[entity]` is undefined (FR-013); any mutation dispatches `predecessors-changed` with full updated `PredecessorConfig[]` in `frontend/tests/component/predecessor-list-editor.test.ts`
- [ ] T025 [P] [US6] Write failing tests for `EntityRowEditor` Predecessors sub-section: nested `ha-expansion-panel` inside Advanced renders `<calendar-stats-predecessor-list-editor>`; `predecessors-changed` event updates `EntityRowConfig.predecessors` and dispatches `row-changed` in `frontend/tests/component/entity-row-editor.test.ts`

### Implementation for User Story 6

- [ ] T026 [US6] Create `frontend/src/components/predecessor-list-editor.ts`: `@customElement('calendar-stats-predecessor-list-editor')`, props `hass`, `predecessors: PredecessorConfig[]`, `lang: string`; "Add predecessor" button appends `{ entity: '' }`; remove `ha-icon-button` per entry; `ha-textfield` entity ID (plain text, any string); `ha-date-input` replaced_on (fall back to `ha-textfield` with YYYY-MM-DD format hint and blur ISO-date validation per FR-016); `ha-textfield` type=number factor (optional); stale-entity indicator when `hass.states[entry.entity]` undefined (FR-013); dispatches `predecessors-changed` with updated array on any mutation (makes T024 pass)
- [ ] T027 [US6] Add nested Predecessors `ha-expansion-panel` inside the Advanced section of `frontend/src/components/entity-row-editor.ts`: render `<calendar-stats-predecessor-list-editor>` with `hass` and `predecessors` props; handle `predecessors-changed` event to update config and dispatch `row-changed` (makes T025 pass)

**Checkpoint**: All 6 user stories complete — full visual editor coverage of every YAML-configurable field.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: FR-010 round-trip verification, full test pass, and HA smoke test.

- [ ] T028 [P] Write integration test for unknown field round-trip (FR-010): call `setConfig({ type: 'calendar-stats-card', entities: [{ entity: 'sensor.x', unknownRowField: 'r' }], unknownTopField: 't' })` → mutate a known field → assert `config-changed` payload contains `unknownRowField: 'r'` and `unknownTopField: 't'` unchanged in `frontend/tests/component/calendar-stats-card-editor.test.ts`
- [ ] T029 [P] Run `npm test` then `npm run lint` from `frontend/` in WSL2; resolve any test failures or lint errors before build
- [ ] T030 Build (`npm run build` from `frontend/`) and smoke-test in HA per `specs/009-ui-config-editor/quickstart.md`: copy `frontend/dist/calendar-stats-card.js` to HA `www/`, add Lovelace resource, open card picker, verify visual editor opens and all 6 user story flows work end-to-end

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
- 30 tasks total across 9 phases
