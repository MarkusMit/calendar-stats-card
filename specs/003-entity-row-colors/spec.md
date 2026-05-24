# Feature Specification: Entity Row Color Configuration

**Feature Branch**: `003-entity-row-colors`
**Created**: 2026-05-24
**Status**: Draft
**Input**: User description: "Additional options for entity configuration to optionally configure text or background color"

## Clarifications

### Session 2026-05-24

- Q: What should the configuration property names be? → A: `text_color` (text color) and `background_color` (background color)
- Q: What color value formats are accepted? → A: Any CSS color string — hex codes, HTML named colors, `rgb()`/`rgba()`, `hsl()`, and CSS custom property references (`var(--token)`)

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Static Row Colors on Entity Rows (Priority: P1)

A dashboard user wants to visually distinguish certain entities from others in a dense table. They configure optional `text_color` and/or `background_color` on an entity row to set the text and background color of that entity's entire row (label, data, sub-label, and summary cells).

**Why this priority**: Primary use case — entity identification and visual grouping across the full row. Delivers standalone value with no other feature dependency.

**Independent Test**: Configure one measurement entity with `background_color: "var(--primary-color)"` and a second entity with no color settings. Open dashboard, verify the first entity's entire row has the configured background and the second is unaffected.

**Acceptance Scenarios**:

1. **Given** an entity with `text_color: "#ff0000"`, **When** the table renders, **Then** all cells in that entity's row (label, data, sub-label, summary) have red text.
2. **Given** an entity with `background_color: "#e0f0ff"`, **When** the table renders, **Then** all cells in that entity's row have a blue-tinted background; all other entity rows are unaffected.
3. **Given** an entity with both `text_color: "var(--primary-color)"` and `background_color: "var(--secondary-background-color)"`, **When** the table renders, **Then** both text and background color are applied to all cells in that entity's row.
4. **Given** an entity with no `text_color` or `background_color`, **When** the table renders, **Then** all row cells are visually identical to current default rendering (no inline style).
5. **Given** three entities where only the second has `background_color` set, **When** the table renders, **Then** only the second entity's row cells have the background color; the first and third entities' rows are visually unchanged.
6. **Given** a measurement entity with multiple visible sub-rows (rowspan > 1), **When** `background_color` is set, **Then** the spanned label cell and all sub-label, data, and summary cells for that entity receive the background color.

---

### User Story 2 — Static Row Colors on Expression Rows (Priority: P2)

A user configures `text_color` and/or `background_color` on an expression row to visually highlight a computed entity (e.g., net energy = import − export).

**Why this priority**: Parity with entity rows. Expression rows appear in the same table and users expect consistent configuration options across row types.

**Independent Test**: Configure an expression row with `background_color: "#ffe0e0"`. Open dashboard, verify its entire row has the pink background; all other rows are unaffected.

**Acceptance Scenarios**:

1. **Given** an expression row with `text_color: "green"`, **When** the table renders, **Then** all cells in that expression row have green text.
2. **Given** an expression row with `background_color: "#ffe0e0"`, **When** the table renders, **Then** all cells in that expression row have the configured background.
3. **Given** an expression row with no color fields, **When** the table renders, **Then** the expression row cells are visually identical to current default rendering.

---

### Edge Cases

- Invalid CSS color string (e.g., `text_color: "notacolor"`): applied as-is; the browser renders nothing or inherits — no card-level validation error or crash.
- HA CSS custom property reference (e.g., `var(--primary-color)`): passed through as-is; resolved at render time by the browser in the HA context.
- Both fields omitted: no inline style attribute is added to any cell.
- `text_color` set but `background_color` omitted: only text color applied to all row cells; background remains inherited/default.
- Measurement entity with `show_min: false, show_avg: false, show_max: false` (label-only row): color still applies to the single label cell.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The card MUST accept an optional `text_color` field on entity row configuration; when present, it sets the text color of all cells in that entity's row (label, data, sub-label, and summary cells).
- **FR-002**: The card MUST accept an optional `background_color` field on entity row configuration; when present, it sets the background color of all cells in that entity's row (label, data, sub-label, and summary cells).
- **FR-003**: Both `text_color` and `background_color` MUST accept any CSS color value string: hex codes, HTML named colors, `rgb()`/`rgba()`, `hsl()`, and CSS custom property references (`var(--token)`).
- **FR-004**: When neither `text_color` nor `background_color` is configured, row cell rendering MUST be identical to current behavior — no inline style attribute, no visual change.
- **FR-005**: Color fields MUST apply to all cells of the entity's row (label, data, sub-label, pad, and summary cells); no cell in that entity's row is exempt.
- **FR-006**: Both `text_color` and `background_color` MUST be available on expression rows (`ExpressionRowConfig`) with identical behavior.
- **FR-007**: When a measurement entity's label cell spans multiple sub-rows (rowspan ≥ 1), color fields MUST apply to the spanned label cell and all associated sub-label, data, and summary cells.
- **FR-008**: Configuring colors on one entity MUST NOT affect the styling of any cell belonging to another entity in the same table.

### Key Entities

- **EntityRowConfig**: Extended with optional `text_color?: string` and `background_color?: string`
- **ExpressionRowConfig**: Extended with optional `text_color?: string` and `background_color?: string`

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can visually distinguish any entity in a table by configuring a row color, without any other configuration change required.
- **SC-002**: All four color-field combinations (neither / `text_color` only / `background_color` only / both) render correctly across all entity types (measurement, cumulative, expression) — 100% test pass rate.
- **SC-003**: Color configuration on one entity produces zero visual change to all other entities in the same table, verified by automated tests.
- **SC-004**: Any CSS color value string that a modern browser accepts can be used without a card-level error.

## Assumptions

- Color fields apply to **all cells in the entity's row** — full-row coloring is required because CSS specificity of existing `.label-column { background: var(--card-background-color) }` would override a `<tr>`-level style; per-cell inline styles are the only reliable cross-browser mechanism.
- `text_color` maps to the CSS `color` property (text color); `background_color` maps to `background-color`.
- Values are passed through to inline styles without card-level validation; the browser silently handles invalid CSS color values.
- Feature applies to both `year-table` and `monthly-table` rendering components.
- No UI color picker; values are entered as raw CSS strings in YAML card configuration.
- HA CSS custom property references (`var(--primary-color)`, etc.) are valid inputs and resolve correctly at render time in the HA browser context.
- Threshold-based or conditional coloring is explicitly out of scope (per project constitution); only static per-entity colors are supported.
