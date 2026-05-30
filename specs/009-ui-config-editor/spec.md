# Feature Specification: UI Configuration Editor

**Feature Branch**: `009-ui-config-editor`  
**Created**: 2026-05-25  
**Status**: Draft  
**Input**: User description: "The card should also have an UI editor for its configuration."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Add Card via Visual UI (Priority: P1)

A user who does not know YAML opens the HA dashboard editor, adds CalendarStats, and configures it entirely through point-and-click without touching raw YAML.

**Why this priority**: Without this, non-technical users cannot configure the card at all. This is the minimum viable editor.

**Independent Test**: Add the card from the HA card picker, fill in at least one entity row, set a display name, and verify the card renders correctly — all without opening the YAML editor.

**Acceptance Scenarios**:

1. **Given** the user is in the HA dashboard editor, **When** they add CalendarStats and open its editor, **Then** a visual form appears (not a raw YAML textarea).
2. **Given** the editor is open with an empty config, **When** the user adds an entity by searching HA entity IDs and confirms the selection, **Then** the card displays that entity's data immediately.
3. **Given** the editor contains a valid configuration, **When** the user closes and reopens the editor, **Then** all previously entered values are pre-populated correctly.

---

### User Story 2 — Manage Rows (Priority: P2)

A user adds, removes, and reorders entity and expression rows in a single unified list that appears on the card.

**Why this priority**: Entity management is the primary configuration task; users will revisit it repeatedly.

**Independent Test**: Open the editor on a card with two entity rows and one expression row interleaved, remove the second entity row, move the expression row to the top, and add a new entity row — verify the card reflects the new unified order immediately.

**Acceptance Scenarios**:

1. **Given** the editor is open, **When** the user clicks the `+ Entity` chip, **Then** an inline `ha-entity-picker` row appears; selecting an entity ID appends an entity row to the unified list and returns to the chip row.
2. **Given** the editor shows multiple entity rows, **When** the user drags row A below row B by its drag handle, **Then** the card preview updates to reflect the new order.
3. **Given** an entity row exists, **When** the user clicks its delete icon, **Then** it disappears from both the editor list and the card preview.
4. **Given** an entity row exists, **When** the user clicks its pencil icon, **Then** the editor swaps to a detail view showing the back arrow, row label, type badge, and the entity-row sub-editor.

---

### User Story 3 — Configure Per-Entity Options (Priority: P3)

A user customises the display name, precision, unit override, factor scaling, and visibility toggles (show_zero, show_min, show_avg, show_max) for individual entity rows.

**Why this priority**: These options are secondary to basic entity selection; the card is useful without them, but power users need them.

**Independent Test**: Pick any entity row, override its name and set precision to 1, then verify the card preview shows the new name and rounded values.

**Acceptance Scenarios**:

1. **Given** an entity row in the editor, **When** the user enters a custom display name, **Then** the label column in the card shows the custom name.
2. **Given** an entity row, **When** the user changes the precision field to 0, **Then** the card shows whole-number values for that row.
3. **Given** an entity row, **When** the user sets a scale factor and a unit override, **Then** the card shows scaled values with the overridden unit.
4. **Given** an entity row, **When** the user toggles "show min" off, **Then** the min sub-row is hidden in the card.

---

### User Story 4 — Configure Expression Rows (Priority: P3)

A user adds expression rows (arithmetic over entity IDs) through the visual editor.

**Why this priority**: Expression rows require understanding of the formula syntax; the editor should at minimum allow entering the expression string, with optional guidance.

**Independent Test**: Add an expression row, enter a formula referencing two entity IDs, provide a label and unit, and verify the card shows the computed values.

**Acceptance Scenarios**:

1. **Given** the editor, **When** the user clicks the `+ Expression` chip, **Then** a draft expression row is appended and its detail page opens with multi-line formula, name, unit, and precision fields visible.
2. **Given** an invalid formula, **When** the user leaves the formula field (on blur), **Then** a validation message describes the error without discarding the input, and no `config-changed` event fires.

---

### User Story 5 — Configure Threshold Rules (Priority: P3)

A user adds, edits, and removes threshold rules on a row to apply conditional colour overrides when values cross defined boundaries.

**Why this priority**: Thresholds are the primary visual alerting mechanism; power users need to configure them through the editor without touching YAML.

**Independent Test**: Open an entity row's Advanced section, expand the Thresholds sub-section, add a rule with operator "above", value 30, and a red `text_color`; verify the card applies the colour to cells where the value exceeds 30 — immediately and without saving.

**Acceptance Scenarios**:

1. **Given** an entity row's Advanced section is open, **When** the user clicks the `+ Add threshold` chip, **Then** a new collapsible threshold panel appears with header `> 0` and fields for operator (dropdown), numeric value, name, text_color, and background_color.
2. **Given** a threshold rule with operator "above" and value 30, **When** the user sets a `text_color`, **Then** the panel header updates to `> 30` and the card preview immediately applies that colour to cells where the value exceeds 30.
3. **Given** a threshold rule, **When** the user removes it via the delete icon inside its panel, **Then** it disappears from both the editor Thresholds list and the card preview styling.

---

### User Story 6 — Configure Predecessor Entities (Priority: P3)

A user adds predecessor entities to an entity row to stitch together historical data from a sensor that has been replaced.

**Why this priority**: Predecessor configuration handles sensor replacement; without editor support, users are forced into raw YAML for this use case.

**Independent Test**: Open an entity row's Advanced section, expand the Predecessors sub-section, add a predecessor with a known historical entity ID and a `replaced_on` date; verify the card uses the predecessor's data for dates strictly before the replacement date.

**Acceptance Scenarios**:

1. **Given** an entity row's Advanced section is open, **When** the user clicks the `+ Add predecessor` chip, **Then** a new bordered card appears with an entity ID text input, a `replaced_on` text input (with `YYYY-MM-DD` placeholder; HA native date picker MAY substitute when available), and an optional `factor` numeric input.
2. **Given** a predecessor entry whose entity ID no longer exists in HA, **Then** the editor displays a warning icon with "Entity not found" next to that entry (FR-013).
3. **Given** a predecessor entry with a `replaced_on` date, **When** the user changes the date, **Then** the card preview updates immediately to reflect the new data boundary.

---

### Edge Cases

- What happens when a previously configured entity no longer exists in HA? The editor should show the stale entity ID clearly so the user can update or remove it. This applies to both main entity IDs and predecessor entity IDs (FR-013).
- What if a user switches a row type from entity to expression (or vice versa) mid-edit? There is no in-place type switch; the user must delete the row and add a new one of the desired type. The edge case of "incompatible fields discarded" applies only to internal state during add/remove, not to a type-selector UI.
- What if the configuration has fields added by a newer card version that the editor does not recognise? Unknown fields must be preserved and round-tripped unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The card MUST expose a visual configuration editor accessible from the HA Lovelace card editor panel.
- **FR-002**: The editor MUST present two add-row chips below the unified row list, styled as HA chip-buttons: `+ Entity` and `+ Expression`. Clicking `+ Entity` reveals an inline `ha-entity-picker` row with a cancel control; selecting an entity ID appends a new entity row and returns to the chip row. Clicking `+ Expression` immediately appends a draft expression row with `expression: ''` and opens its detail page; the draft is excluded from the dispatched config until the user enters a valid formula (FR-008).
- **FR-003**: The editor MUST allow the user to remove individual rows (entity or expression).
- **FR-004**: The editor MUST present all rows (entity and expression) in a single unified ordered list and allow the user to reorder them freely via drag-and-drop. Each row exposes a drag-handle icon (`ha-sortable` handle-selector); the row list is wrapped in `ha-sortable` and emits `item-moved` events that splice `_entities` and dispatch `config-changed`.
- **FR-005**: The editor MUST allow configuring the optional display name (`name`) for each row (entity or expression).
- **FR-006**: The editor MUST allow configuring precision, factor, unit, show_zero, show_min, show_avg, show_max, text_color, background_color, thresholds, and predecessors for each entity row. The `entity`, `name`, and `precision` fields MUST be visible immediately in the row detail page via `ha-form`. All remaining fields MUST live inside a collapsible "Advanced" section (`ha-expansion-panel`), collapsed by default. Inside Advanced: `factor`, `unit`, `text_color`, `background_color` render via `ha-form`; `show_zero`, `show_min`, `show_avg`, `show_max` render as a compact one-row strip of `ha-formfield` + `ha-checkbox` (default-on semantics: `undefined` and `true` both render as checked); thresholds and predecessors render as embedded sub-editors directly inside Advanced (no extra nested collapsible per list).
- **FR-007**: Clicking the `+ Expression` chip MUST append a draft expression row and open its detail page. In the detail page, the fields `expression` (rendered as multi-line `ha-form` text selector), `name`, `unit`, and `precision` MUST be immediately visible. The fields `show_zero`, `text_color`, `background_color`, and `thresholds` MUST live inside a collapsible "Advanced" section, collapsed by default.
- **FR-015**: The editor MUST allow configuring row-level `text_color` and `background_color` overrides and a list of threshold rules (`thresholds`) for both entity and expression rows. Each threshold rule specifies an operator (`above`, `equals-above`, `equals-below`, `below`, `not-below`, `not-above`), a numeric value, an optional name, and optional per-threshold `text_color`/`background_color`. Color fields MAY use the HA native color picker component (`ha-color-picker` or equivalent) where available; the current implementation falls back to plain text inputs throughout. The scalar color fields render inside the per-row "Advanced" section; the `thresholds` sub-list renders directly inside Advanced. Each individual threshold rule MUST render as a collapsible `ha-expansion-panel` whose header shows the operator symbol and value (e.g. `> 30` or `Hot (> 30)` when `name` is set); a chip-styled `+ Add threshold` button appends a new rule with defaults `{ operator: 'above', value: 0 }`.
- **FR-016**: The editor MUST allow configuring a list of predecessor entities (`predecessors`) for entity rows. Each predecessor entry specifies an entity ID (entered as a plain text input — any string accepted; FR-013 flags unknown IDs), an optional replacement date (`replaced_on`, ISO YYYY-MM-DD), and an optional numeric `factor`. The `replaced_on` field MAY use the HA native date picker (`ha-date-input` or equivalent) where available; the current implementation uses a plain text input with a `YYYY-MM-DD` placeholder. The `predecessors` sub-list renders directly inside the per-row "Advanced" section; each entry renders as a bordered card with the three fields and a delete control. A chip-styled `+ Add predecessor` button appends a new entry with `{ entity: '' }`.
- **FR-008**: All changes in the editor MUST be reflected immediately in the card preview without saving. When an expression formula is invalid, the preview MUST retain the last successfully computed result for that row until a valid formula is entered; it MUST NOT blank the row or show an error placeholder in the preview. A brand-new expression row with no prior valid formula MUST be hidden from the card preview until the first valid formula is entered.
- **FR-017**: When no rows are configured, the editor MUST display an italic empty-state message in place of the row list (above the add-row chips), localized via `editor.no_rows`.
- **FR-018**: The unified row list MUST present each row as a one-line header with: a drag-handle icon, the row's identity (an inline `ha-entity-picker` bound to `entity` for entity rows; a function icon plus `name` or `expression` text for expression rows), a delete icon button, and a pencil edit icon button. The pencil button MUST open a dedicated row-detail view (replacing the list view in the editor panel) containing a back-arrow header, the row label and a type badge, and the row's sub-editor (`calendar-stats-entity-row-editor` or `calendar-stats-expression-row-editor`). The back arrow returns to the row list. Inline edits to an entity row's entity ID via the inline picker dispatch `config-changed` without opening the detail page.
- **FR-019**: The root editor MUST preload the `ha-entity-picker` custom element on `connectedCallback` (via `window.loadCardHelpers().createCardElement({ type: 'entities', entities: [] }).constructor.getConfigElement()`, then `customElements.whenDefined('ha-entity-picker')`). Until the element is defined, the editor MUST render a localized loading placeholder (`editor.loading`) in place of the row list.
- **FR-009**: The editor MUST be fully operable by a user with no knowledge of YAML.
- **FR-010**: Fields not recognised by the editor MUST be preserved unchanged when the configuration is round-tripped through the editor.
- **FR-011**: All user-visible strings in the editor MUST be internationalised (supported locales: `en`, `de`).
- **FR-012**: The editor MUST validate the formula field on blur (when the user leaves the field) and display a validation message without losing the user's input. Validation covers both syntactic well-formedness (valid expression within `{{ }}`) and whether entity IDs referenced in the formula exist in HA. The error message MUST distinguish the failure type: syntax errors show "invalid expression syntax"; missing entity IDs show "entity not found: `<id>`". No validation fires while the user is actively typing.
- **FR-013**: The editor MUST display a warning icon with a short user-visible text message (e.g. "Entity not found") for rows that reference a non-existent HA entity — both the main entity ID on entity rows and any predecessor entity IDs within the predecessors sub-list. The message text MUST be internationalised per FR-011.
- **FR-014**: The editor's visual design, interaction patterns, and component choices MUST conform to Home Assistant's native Lovelace card editor conventions — using HA-provided UI components and design tokens wherever available, with no custom styling that deviates from HA norms.

### Key Entities

- **Entity Row**: A configurable row displaying statistics for a single HA entity. Attributes: entity ID, name (optional), precision, factor, unit, show_zero, show_min, show_avg, show_max, text_color (optional), background_color (optional), thresholds (optional list), predecessors (optional list).
- **Expression Row**: A configurable row displaying a value derived from a formula. Attributes: expression, name (optional), unit, precision, show_zero, text_color (optional), background_color (optional), thresholds (optional list).
- **Threshold Rule**: A conditional colour override applied to a row's cells. Attributes: operator (one of `above`, `equals-above`, `equals-below`, `below`, `not-below`, `not-above`), numeric value, name (optional), text_color (optional), background_color (optional).
- **Predecessor Config**: An entity that preceded the main entity for a date range. Attributes: entity ID, replaced_on (optional ISO date YYYY-MM-DD — predecessor covers dates strictly before this), factor (optional numeric multiplier).
- **Card Configuration**: The full set of rows ordered by the user, determining the card's rendered output.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user unfamiliar with YAML can configure a working CalendarStats card with at least one entity row in under 3 minutes from the HA card picker.
- **SC-002**: 100 % of configuration options available in YAML are reachable through the visual editor.
- **SC-003**: Switching between the visual editor and the YAML editor produces no data loss or field corruption on any valid configuration.
- **SC-004**: The editor is fully operational in both `en` and `de` locales with no untranslated strings visible to the user.
- **SC-005**: Expression rows with an invalid formula produce a user-visible error message on blur without discarding the input, and no error fires while the user is actively typing. Syntax errors and unknown entity references produce distinct messages ("invalid expression syntax" vs "entity not found: `<id>`").
- **SC-006**: The editor is visually indistinguishable from a native HA card editor — no custom colours, fonts, or layout patterns that deviate from HA Lovelace conventions.

## Assumptions

- The card is installed as a custom Lovelace resource in Home Assistant 2026.5.0 or later; the HA editor infrastructure (entity picker, config-changed event protocol) is available at that version.
- The visual editor covers all options from the card-config-schema at the time this feature is implemented; options added in future features must extend the editor in their own spec.
- Drag-and-drop reordering via `ha-sortable` (handle-selector based) is the sole row-ordering UX; explicit up/down keyboard buttons are not implemented. Accessibility for keyboard-only users relies on `ha-sortable`'s built-in keyboard support.
- The editor renders within the existing HA card editor panel; no custom dialog or modal overlay is required. The row list and the row detail page are mutually exclusive views in the same panel; the editor expands vertically without a fixed height limit; overflow is handled by the HA panel's own scroll.
- Expression row formula syntax guidance: the current implementation renders the formula via a `ha-form` multi-line text selector and does NOT inject placeholder example text. No help text or documentation links are in scope.

## Clarifications

### Session 2026-05-30 (post-implementation spec realignment)

- Q: Add-row UI — single button + dropdown menu, or two chips? → A: Two chips (`+ Entity`, `+ Expression`) rendered as HA chip-buttons; `+ Entity` reveals an inline `ha-entity-picker` with cancel; `+ Expression` immediately appends a draft and opens its detail page. Supersedes FR-002's earlier "single Add row button + menu" wording.
- Q: Thresholds and predecessors — nested collapsible sub-section per list inside Advanced, or flat? → A: Flat inside Advanced. The lists render directly inside the Advanced `ha-expansion-panel`. Individual threshold rules are each their own `ha-expansion-panel`; predecessor entries render as bordered cards (not collapsibles). Supersedes the 2026-05-25 "nested collapsibles per sub-list" answer.
- Q: Row editing UX — inline expansion or detail page navigation? → A: Detail page. The unified row list shows a pencil icon per row; clicking it swaps the panel to a detail view with back arrow, row label, type badge, and the sub-editor. Inline editing of the entity ID via the row's inline `ha-entity-picker` is still allowed without entering the detail page (FR-018).
- Q: Empty-state placement — below the Add row button or above it? → A: Above the add-row chips, in place of the row list, as an italic centered message. Supersedes FR-017's earlier "below" wording.
- Q: Formula placeholder example text — required? → A: No. The current implementation renders the formula via a `ha-form` multi-line text selector without injecting placeholder text. Supersedes the 2026-05-25 placeholder-text clarification.
- Q: Keyboard up/down row reordering — implemented? → A: No. `ha-sortable` drag-and-drop is the sole reorder mechanism; accessibility relies on its built-in keyboard support.
- Q: Color picker — `ha-color-picker` always? → A: No — plain text inputs are used throughout for both scalar color fields and threshold per-rule color fields. The FR-015 allowance for `ha-color-picker` substitution is preserved as MAY, not MUST.
- Q: `replaced_on` date input — `ha-date-input` always? → A: No — plain text input with `YYYY-MM-DD` placeholder is used. FR-016 preserves `ha-date-input` substitution as MAY, not MUST.
- Q: Visibility toggles layout — vertical or one-row strip? → A: One-row strip of `ha-formfield` + `ha-checkbox` for `show_zero`, `show_min`, `show_avg`, `show_max` to keep the row editor compact. Default-on semantics: `undefined` and `true` both render as checked (matches consumer `!== false` logic in monthly-table / year-table).
- Q: Each threshold rule's display in the list — flat fields or collapsible per rule? → A: Collapsible per rule. Each rule renders as an `ha-expansion-panel` whose header shows `operator-symbol value` (e.g. `> 30`) or `name (> 30)` when `name` is set.
- Q: Entity-row identity in the main list — label-only or inline picker? → A: Inline `ha-entity-picker` bound to the row's `entity`. Changes via the inline picker dispatch `config-changed` without opening the detail page. Expression rows show a function icon + `name`/`expression` text (no picker).
- Q: `ha-entity-picker` preloading — required? → A: Yes. `connectedCallback` calls `loadCardHelpers` → `createCardElement({ type: 'entities', entities: [] })` → `getConfigElement()` to force HA's lazy registration, then awaits `customElements.whenDefined('ha-entity-picker')`. Until defined, a localized loading placeholder (`editor.loading`) is shown in place of the row list. Reason: without preload, inline `ha-entity-picker` instances inside our shadow DOM render zero-height on first editor open.

### Session 2026-05-25

- Q: Should per-entity advanced options be always visible, or partially/fully collapsed? → A: Name and precision always visible; factor, unit, show_zero, show_min, show_avg, show_max collapsed in a per-row "Advanced" section by default.
- Q: Is inline expression syntax guidance in scope? → A: Placeholder example text inside the formula field only (e.g. `{{ sensor.a - sensor.b }}`); no help text or documentation links.
- Q: When should expression formula validation fire? → A: On blur only; no validation while actively typing.
- Q: Should the editor conform to HA standards and principles? → A: Yes — editor MUST use HA-native UI components and design tokens; no custom styling deviating from HA norms (FR-014, aligned with Constitution Principle I).
- Q: Which fields missing from the spec should be added as editor-configurable? → A: All — text_color, background_color, thresholds, and predecessors all get editor UI (FR-015, FR-016); overrides CLAUDE.md color-coding out-of-scope restriction.
- Q: Can a user switch a row between entity and expression type in-place? → A: No — delete and re-add only; no type-selector UI; no in-place conversion.
- Q: How should the editor handle overflow when many rows exist? → A: Editor expands vertically without a height limit; HA's own panel scroll handles overflow; no fixed-height row-list container.
- Q: Should entity and expression rows share a single unified ordered list or be kept in separate groups? → A: Single unified list — all row types interleave freely and are reordered together (FR-004).
- Q: Should thresholds and predecessors have nested collapsibles within Advanced, or appear flat? → A: Nested collapsibles — each sub-list (thresholds, predecessors) gets its own collapsible sub-section inside "Advanced" (FR-015, FR-016).
- Q: What does expression formula validation cover? → A: Syntax + entity existence — validates well-formed expression within `{{ }}` AND checks referenced entity IDs exist in HA (FR-012, SC-005).
- Q: What format should color fields accept? → A: HA native color picker (`ha-color-picker` or equivalent) where available; fall back to plain text input if HA does not expose one (FR-015).
- Q: Should the stale-entity visual indicator (FR-013) also apply to predecessor entity IDs? → A: Yes — same indicator applies to predecessor entity IDs within the predecessors sub-list.
- Q: How should the add-row UI be presented? → A: Single "Add row" button opens a menu to choose "Entity row" or "Expression row" (FR-002, FR-007).
- Q: What input component for the predecessor `replaced_on` date field? → A: HA native date picker (`ha-date-input` or equivalent); fall back to text input with `YYYY-MM-DD` hint validated on blur (FR-016).
- Q: For expression rows, which fields are always visible vs in Advanced? → A: Always visible: formula, name, unit, precision — Advanced: show_zero, text_color, background_color, thresholds (FR-007).
- Q: Should the empty state show anything beyond the "Add row" button? → A: Yes — empty-state message below the button (e.g. "No rows yet — add your first row above") (FR-017).
- Q: What input method for predecessor entity IDs? → A: Plain text input — any entity ID string accepted; FR-013 visual indicator flags unknown IDs (FR-016).
- Q: Should formula validation distinguish syntax errors from entity-not-found? → A: Yes — distinct messages: "invalid expression syntax" vs "entity not found: `<id>`" (FR-012, SC-005).
- Q: Does the stale entity indicator include user-visible text? → A: Yes — warning icon + short text (e.g. "Entity not found"); text subject to FR-011 i18n (FR-013).
- Q: What does the card preview show while an expression formula is invalid? → A: Last valid computed result retained; preview never blanks or shows an error placeholder for that row (FR-008).
- Q: Should User Stories be added for threshold and predecessor configuration? → A: Yes — User Story 5 (configure thresholds) and User Story 6 (configure predecessors) added with acceptance scenarios.
- Q: What does the preview show for a brand-new expression row before any valid formula exists? → A: Row hidden from preview until first valid formula entered; only then does FR-008 "last valid result" retention apply (FR-008).
