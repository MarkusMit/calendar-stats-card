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

### User Story 1 — Static Label Cell Colors on Entity Rows (Priority: P1)

A dashboard user wants to visually distinguish certain entities from others in a dense table. They configure optional `text_color` and/or `background_color` on an entity row to set the text and background color of that entity's label cell.

**Why this priority**: Primary use case — entity identification and visual grouping in a sticky label column. Delivers standalone value with no other feature dependency.

**Independent Test**: Configure one measurement entity with `background_color: "var(--primary-color)"` and a second entity with no color settings. Open dashboard, verify the first entity's label cell has the configured background and the second is unaffected. Data cells for both entities are unchanged.

**Acceptance Scenarios**:

1. **Given** an entity with `text_color: "#ff0000"`, **When** the table renders, **Then** the entity's label cell text is red; all data, sub-label, and summary cells are unaffected.
2. **Given** an entity with `background_color: "#e0f0ff"`, **When** the table renders, **Then** the entity's label cell has a blue-tinted background; all other cells are unaffected.
3. **Given** an entity with both `text_color: "var(--primary-color)"` and `background_color: "var(--secondary-background-color)"`, **When** the table renders, **Then** both text and background color are applied to the label cell.
4. **Given** an entity with no `text_color` or `background_color`, **When** the table renders, **Then** the label cell is visually identical to current default rendering (no inline style).
5. **Given** three entities where only the second has `background_color` set, **When** the table renders, **Then** only the second entity's label cell has the background color; the first and third are visually unchanged.
6. **Given** a measurement entity with multiple visible sub-rows (rowspan > 1), **When** `background_color` is set, **Then** the single spanned label cell receives the background color; sub-label cells are unaffected.

---

### User Story 2 — Static Label Cell Colors on Expression Rows (Priority: P2)

A user configures `text_color` and/or `background_color` on an expression row to visually highlight a computed entity (e.g., net energy = import − export).

**Why this priority**: Parity with entity rows. Expression rows appear in the same table and users expect consistent configuration options across row types.

**Independent Test**: Configure an expression row with `background_color: "#ffe0e0"`. Open dashboard, verify its label cell has the pink background; all other rows are unaffected.

**Acceptance Scenarios**:

1. **Given** an expression row with `text_color: "green"`, **When** the table renders, **Then** the expression row's label cell text is green.
2. **Given** an expression row with `background_color: "#ffe0e0"`, **When** the table renders, **Then** the expression row's label cell has the configured background.
3. **Given** an expression row with no color fields, **When** the table renders, **Then** the expression row label cell is visually identical to current default rendering.

---

### Edge Cases

- Invalid CSS color string (e.g., `text_color: "notacolor"`): applied as-is; the browser renders nothing or inherits — no card-level validation error or crash.
- HA CSS custom property reference (e.g., `var(--primary-color)`): passed through as-is; resolved at render time by the browser in the HA context.
- Both fields omitted: no inline style attribute is added to the label cell.
- `text_color` set but `background_color` omitted: only text color applied; background remains inherited/default.
- Measurement entity with `show_min: false, show_avg: false, show_max: false` (label-only row): color still applies to the single label cell.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The card MUST accept an optional `text_color` field on entity row configuration; when present, it sets the text color of that entity's label cell.
- **FR-002**: The card MUST accept an optional `background_color` field on entity row configuration; when present, it sets the background color of that entity's label cell.
- **FR-003**: Both `text_color` and `background_color` MUST accept any CSS color value string: hex codes, HTML named colors, `rgb()`/`rgba()`, `hsl()`, and CSS custom property references (`var(--token)`).
- **FR-004**: When neither `text_color` nor `background_color` is configured, label cell rendering MUST be identical to current behavior — no inline style attribute, no visual change.
- **FR-005**: Color fields MUST apply only to the entity's label cell; data cells, sub-label cells, and summary/total cells MUST NOT be affected.
- **FR-006**: Both `text_color` and `background_color` MUST be available on expression rows (`ExpressionRowConfig`) with identical behavior.
- **FR-007**: When a measurement entity's label cell spans multiple sub-rows (rowspan ≥ 1), color fields MUST apply to that single spanned label cell.
- **FR-008**: Configuring colors on one entity MUST NOT affect the label cell styling of any other entity in the same table.

### Key Entities

- **EntityRowConfig**: Extended with optional `text_color?: string` and `background_color?: string`
- **ExpressionRowConfig**: Extended with optional `text_color?: string` and `background_color?: string`

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can visually distinguish any entity in a table by configuring a label cell color, without any other configuration change required.
- **SC-002**: All four color-field combinations (neither / `text_color` only / `background_color` only / both) render correctly across all entity types (measurement, cumulative, expression) — 100% test pass rate.
- **SC-003**: Color configuration on one entity produces zero visual change to all other entities in the same table, verified by automated tests.
- **SC-004**: Any CSS color value string that a modern browser accepts can be used without a card-level error.

## Assumptions

- Color fields apply to the **label cell only** — the sticky label column is always visible and sufficient for entity identification; applying colors to data cells would increase visual noise in a dense layout.
- `text_color` maps to the CSS `color` property (text color); `background_color` maps to `background-color`.
- Values are passed through to inline styles without card-level validation; the browser silently handles invalid CSS color values.
- Feature applies to both `year-table` and `monthly-table` rendering components.
- No UI color picker; values are entered as raw CSS strings in YAML card configuration.
- HA CSS custom property references (`var(--primary-color)`, etc.) are valid inputs and resolve correctly at render time in the HA browser context.
- Threshold-based or conditional coloring is explicitly out of scope (per project constitution); only static per-entity colors are supported.
