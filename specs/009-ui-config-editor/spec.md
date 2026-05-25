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
2. **Given** the editor is open with an empty config, **When** the user adds an entity by searching HA entity IDs and saves, **Then** the card displays that entity's data.
3. **Given** the editor contains a valid configuration, **When** the user closes and reopens the editor, **Then** all previously entered values are pre-populated correctly.

---

### User Story 2 — Manage Entity Rows (Priority: P2)

A user adds, removes, and reorders the entity rows that appear on the card.

**Why this priority**: Entity management is the primary configuration task; users will revisit it repeatedly.

**Independent Test**: Open the editor on a card with three entity rows, remove the second, move the first to the bottom, and add a new row — verify the card reflects the new order immediately.

**Acceptance Scenarios**:

1. **Given** the editor is open, **When** the user clicks "Add entity", **Then** an entity-search field appears and the chosen entity is appended to the list.
2. **Given** the editor shows multiple entity rows, **When** the user drags row A below row B, **Then** the card preview updates to reflect the new order.
3. **Given** an entity row exists, **When** the user deletes it, **Then** it disappears from both the editor list and the card preview.

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

1. **Given** the editor, **When** the user chooses "Add expression row", **Then** a text field for the formula and fields for name/unit/precision appear.
2. **Given** an invalid formula, **When** the user submits, **Then** a validation message describes the error without closing the editor.

---

### Edge Cases

- What happens when a previously configured entity no longer exists in HA? The editor should show the stale entity ID clearly so the user can update or remove it.
- What if a user switches a row type from entity to expression (or vice versa) mid-edit? The editor should treat this as replacing the row and discard incompatible fields.
- What if the configuration has fields added by a newer card version that the editor does not recognise? Unknown fields must be preserved and round-tripped unchanged.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The card MUST expose a visual configuration editor accessible from the HA Lovelace card editor panel.
- **FR-002**: The editor MUST allow the user to add entity rows by searching and selecting HA entity IDs.
- **FR-003**: The editor MUST allow the user to remove individual entity rows.
- **FR-004**: The editor MUST allow the user to reorder entity rows via drag-and-drop or explicit up/down controls.
- **FR-005**: The editor MUST allow configuring the optional display name (`name`) for each entity row.
- **FR-006**: The editor MUST allow configuring precision, factor, unit, show_zero, show_min, show_avg, and show_max for each entity row. The `name` and `precision` fields MUST be visible immediately; `factor`, `unit`, `show_zero`, `show_min`, `show_avg`, and `show_max` MUST be grouped in a collapsible "Advanced" section, collapsed by default.
- **FR-007**: The editor MUST allow adding expression rows with a free-text formula field, plus name, unit, precision, and show_zero options. The formula input field MUST display placeholder example text (e.g. `{{ sensor.a - sensor.b }}`) to guide syntax without additional help text or documentation links.
- **FR-008**: All changes in the editor MUST be reflected immediately in the card preview without saving.
- **FR-009**: The editor MUST be fully operable by a user with no knowledge of YAML.
- **FR-010**: Fields not recognised by the editor MUST be preserved unchanged when the configuration is round-tripped through the editor.
- **FR-011**: All user-visible strings in the editor MUST be internationalised (supported locales: `en`, `de`).
- **FR-012**: The editor MUST validate the formula field on blur (when the user leaves the field) and display a validation message for invalid syntax without losing the user's input. No validation fires while the user is actively typing.
- **FR-013**: The editor MUST display a visual indicator for entity rows that reference a non-existent HA entity.
- **FR-014**: The editor's visual design, interaction patterns, and component choices MUST conform to Home Assistant's native Lovelace card editor conventions — using HA-provided UI components and design tokens wherever available, with no custom styling that deviates from HA norms.

### Key Entities

- **Entity Row**: A configurable row displaying statistics for a single HA entity. Attributes: entity ID, name (optional), precision, factor, unit, show_zero, show_min, show_avg, show_max.
- **Expression Row**: A configurable row displaying a value derived from a formula. Attributes: expression, name (optional), unit, precision, show_zero.
- **Card Configuration**: The full set of rows ordered by the user, determining the card's rendered output.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user unfamiliar with YAML can configure a working CalendarStats card with at least one entity row in under 3 minutes from the HA card picker.
- **SC-002**: 100 % of configuration options available in YAML are reachable through the visual editor.
- **SC-003**: Switching between the visual editor and the YAML editor produces no data loss or field corruption on any valid configuration.
- **SC-004**: The editor is fully operational in both `en` and `de` locales with no untranslated strings visible to the user.
- **SC-005**: Expression rows with invalid syntax produce a user-visible error message on blur without discarding the input, and no error fires while the user is actively typing.
- **SC-006**: The editor is visually indistinguishable from a native HA card editor — no custom colours, fonts, or layout patterns that deviate from HA Lovelace conventions.

## Assumptions

- The card is installed as a custom Lovelace resource in Home Assistant 2026.5.0 or later; the HA editor infrastructure (entity picker, config-changed event protocol) is available at that version.
- The visual editor covers all options from the card-config-schema at the time this feature is implemented; options added in future features must extend the editor in their own spec.
- Drag-and-drop reordering is the primary UX for row ordering; keyboard-only fallback (up/down buttons) is included for accessibility but drag-and-drop is the design target.
- The editor renders within the existing HA card editor panel; no custom dialog or modal overlay is required.
- Expression row formula syntax guidance is limited to placeholder example text inside the formula input field; no additional help text or documentation links are in scope.

## Clarifications

### Session 2026-05-25

- Q: Should per-entity advanced options be always visible, or partially/fully collapsed? → A: Name and precision always visible; factor, unit, show_zero, show_min, show_avg, show_max collapsed in a per-row "Advanced" section by default.
- Q: Is inline expression syntax guidance in scope? → A: Placeholder example text inside the formula field only (e.g. `{{ sensor.a - sensor.b }}`); no help text or documentation links.
- Q: When should expression formula validation fire? → A: On blur only; no validation while actively typing.
- Q: Should the editor conform to HA standards and principles? → A: Yes — editor MUST use HA-native UI components and design tokens; no custom styling deviating from HA norms (FR-014, aligned with Constitution Principle I).
