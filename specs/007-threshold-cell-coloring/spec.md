# Feature Specification: Threshold-Based Cell Coloring

**Feature Branch**: `007-threshold-cell-coloring`  
**Created**: 2026-05-25  
**Status**: Draft  
**Input**: User description: "text and background coloring should support threshold-based coloring of cells depending on their values. threshold based coloring should override generally defined colors. thresholds should support: above, equals-above, equals-below and below; each of which can be defined multiple times and the one threshold closest to the value is applied. additionally there should be a not-below threshold for the min-value, and a not-above threshold for the max-value."

## Clarifications

### Session 2026-05-25

- Q: Where should the threshold name legend appear — card-level combined, per-entity, or per-month? → A: Single combined legend at the bottom of the card, merging all named thresholds from all entities.
- Q: What visual format does each legend entry use? → A: Small colored swatch (background_color; or colored text label if only text_color is set) + name text.
- Q: In what order do legend entries appear when multiple named thresholds exist? → A: Order of first appearance across entities (config definition order).
- Q: What are the config field names for threshold colors? → A: `text_color` and `background_color` — same flat naming as existing static row colors (spec 003). No renaming, no breaking change. Thresholds are a peer list on the entity config, not nested under `text`/`background`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Single-Level Threshold on Scalar Entity (Priority: P1)

A dashboard user monitors daily precipitation. They want high-rainfall days immediately visible without scanning numbers. They configure a threshold on the precipitation entity so cells with values above a specified level are highlighted in a warning color.

**Why this priority**: Most common use case — one threshold per entity to flag outlier values. Delivers standalone value without any multi-level configuration.

**Independent Test**: Configure a precipitation entity with threshold `above: 10, background_color: "red"`. Open the dashboard; verify that cells where daily value > 10 show red background, and cells ≤ 10 show no threshold-applied background.

**Acceptance Scenarios**:

1. **Given** an entity with threshold `above: 10, background_color: "red"`, **When** a cell value is 12.5, **Then** the cell has red background.
2. **Given** an entity with threshold `above: 10, background_color: "red"`, **When** a cell value is 10, **Then** no threshold color is applied (10 is not strictly greater than 10).
3. **Given** an entity with threshold `below: 5, text_color: "blue"`, **When** a cell value is 3, **Then** the cell has blue text.
4. **Given** an entity with threshold `equals-above: 10, background_color: "orange"`, **When** a cell value is 10, **Then** the cell has orange background (boundary value is included).
5. **Given** an entity with threshold `equals-below: 0, text_color: "cyan"`, **When** a cell value is 0, **Then** the cell has cyan text (boundary value is included).
6. **Given** an entity with no thresholds configured, **When** any cell renders, **Then** cell colors are determined solely by static row color or default styling.

---

### User Story 2 — Multi-Level Thresholds, Closest Wins (Priority: P2)

A user wants gradient-style visual feedback for temperature data: warm orange for above 20°C, hot red for above 30°C. They define multiple `above` thresholds at different levels; the closest matching threshold determines the color for each cell value.

**Why this priority**: Multi-level thresholds are the key differentiator from simple conditional styling. The "closest threshold wins" rule enables fine-grained color scales.

**Independent Test**: Configure an entity with `above: 10` (yellow), `above: 20` (orange), `above: 30` (red). Verify a value of 22 shows orange (closest matching threshold is 20), 35 shows red (closest matching threshold is 30), and 8 shows no threshold color.

**Acceptance Scenarios**:

1. **Given** thresholds `above: 10` (yellow), `above: 20` (orange), `above: 30` (red), **When** value is 22, **Then** orange is applied (10 and 20 both match; 20 is closest to 22).
2. **Given** thresholds `above: 10` (yellow), `above: 20` (orange), `above: 30` (red), **When** value is 8, **Then** no threshold color is applied (no `above` threshold is satisfied).
3. **Given** thresholds `above: 10` (yellow), `above: 20` (orange), `above: 30` (red), **When** value is 35, **Then** red is applied (all three match; 30 is closest to 35).
4. **Given** thresholds `below: 0` (dark-blue), `below: 5` (light-blue), **When** value is -3, **Then** dark-blue is applied (both match; 0 is closest to -3).
5. **Given** thresholds `below: 5` (light-blue), `below: 0` (dark-blue), defined in reverse order, **When** value is -3, **Then** dark-blue still applied (definition order irrelevant; closest always wins).

---

### User Story 3 — Min/Max Special Thresholds (Priority: P2)

A user monitors daily temperature extremes and wants to flag frost-free days (minimum temperature never dipped below 0°C) and comfortable days (maximum temperature stayed at or below 25°C). They configure `not-below: 0` and `not-above: 25` thresholds on the entity.

**Why this priority**: These operators address monitoring needs for extreme-value tracking that standard operators cannot express cleanly; equal priority to multi-level thresholds since they serve a distinct use case.

**Independent Test**: Configure an entity with `not-below: 0, background_color: "lime"`. Verify that days where the minimum value is ≥ 0 show lime background on the relevant cell(s); days where minimum is < 0 show no threshold color on those cells.

**Acceptance Scenarios**:

1. **Given** a `not-below: 0` threshold with `background_color: "lime"`, **When** the applicable cell shows 2.5, **Then** the cell has lime background (2.5 ≥ 0).
2. **Given** a `not-below: 0` threshold with `background_color: "lime"`, **When** the applicable cell shows −1, **Then** no threshold color is applied (−1 < 0, condition not met).
3. **Given** a `not-above: 25` threshold with `text_color: "green"`, **When** the applicable cell shows 22, **Then** the cell has green text (22 ≤ 25).
4. **Given** a `not-above: 25` threshold with `text_color: "green"`, **When** the applicable cell shows 30, **Then** no threshold color is applied (30 > 25).
5. **Given** multiple `not-below` thresholds `not-below: 0` (yellow), `not-below: 5` (green), **When** applicable cell value is 7, **Then** green is applied (both match; 5 is closest to 7).

---

### User Story 4 — Threshold Colors Override Static Row Colors (Priority: P3)

A user has configured a static `background_color` on an entity row. They also add threshold rules. When a threshold matches a cell, the threshold's color takes precedence over the static row color for that specific cell.

**Why this priority**: Interaction with the existing static color feature must be well-defined; lower priority because it requires both features to be in use simultaneously.

**Independent Test**: Configure an entity with static `background_color: "lightgray"` and threshold `above: 10, background_color: "red"`. Verify: value 15 shows red (threshold wins); value 5 shows gray (static wins, no threshold matches).

**Acceptance Scenarios**:

1. **Given** static `background_color: "gray"` and threshold `above: 10, background_color: "red"`, **When** value is 15, **Then** cell has red background (threshold overrides static).
2. **Given** static `background_color: "gray"` and threshold `above: 10, background_color: "red"`, **When** value is 5, **Then** cell has gray background (no threshold matches; static applies).
3. **Given** static `text_color: "black"` and threshold `below: 0, text_color: "blue"`, **When** value is −5, **Then** cell has blue text (threshold overrides static text color).
4. **Given** threshold `above: 10, background_color: "red"` and no static color, **When** value is 5, **Then** cell has default/inherited background (neither threshold nor static applies).

---

### User Story 5 — Named Thresholds and Card Legend (Priority: P2)

A user configures named thresholds on a temperature entity: "Summer day" for max ≥ 25°C, "Heat day" for max ≥ 30°C, "Tropical night" for min not-below 20°C. At the bottom of the card a legend appears, listing each named threshold alongside its color, so any viewer can interpret the colored cells without needing to read the YAML configuration.

**Why this priority**: Completes the coloring feature for shared dashboards — colors are meaningless without a key. Names also allow the same threshold to be referenced consistently across multiple entities.

**Independent Test**: Configure one entity with `above: 25, name: "Summer day", background_color: "orange"` and one entity with no named thresholds. Open the card with data containing at least one day where the value exceeds 25; verify a legend section appears at the bottom showing exactly one entry ("Summer day" with an orange swatch). View a period where no values exceed 25; verify no legend appears. Remove the name; verify the legend disappears.

**Acceptance Scenarios**:

1. **Given** at least one named threshold rule matches a visible cell value during rendering, **When** the card renders, **Then** a legend section appears at the bottom of the card.
2. **Given** no threshold rules have a `name` field, **When** the card renders, **Then** no legend section appears.
3. **Given** named threshold rules triggered from two different entities, **When** the card renders, **Then** the legend contains combined entries from both entities in definition order.
4. **Given** two threshold rules on different entities sharing the same name, both triggered, **When** the card renders, **Then** the legend shows that name exactly once (first-defined wins).
5. **Given** a threshold rule with a name but no `text_color` or `background_color` (ignored per FR-011), **When** the card renders, **Then** that name does NOT appear in the legend.
6. **Given** named threshold rules are configured but none match any visible cell value in the current view, **When** the card renders, **Then** no legend section appears.

---

### Edge Cases

- Threshold tie (two thresholds equidistant from the value): the threshold with the higher numeric threshold value wins. When two equidistant matching thresholds also share the same numeric threshold value, the first-defined rule (config definition order) wins.
- Threshold rule with neither `text_color` nor `background_color`: rule is silently ignored; no error.
- Cell with no numeric value (missing data, null): no threshold is evaluated; cell renders with static or default styling.
- `not-below` / `not-above` on a cumulative/expression entity (single daily value, cell role `'scalar'`): both operators apply — the single daily value is treated as both the minimum and maximum for targeting purposes.
- Thresholds configured on an expression row: supported with identical behavior to entity rows.
- Named threshold with no colors (silently ignored per FR-011): not shown in legend.
- Two entities share same threshold name but different colors: first-defined entry wins in the legend (definition order); no error.
- Named threshold that never triggers in the current view: NOT shown in legend; the legend shows only rules that matched at least one visible cell during the current render.
- Threshold with only `text_color` set and a static `background_color` present: threshold overrides `text_color`, static `background_color` still applies.
- Threshold with only `background_color` set and a static `text_color` present: threshold overrides `background_color`, static `text_color` still applies.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each entity and expression row configuration MUST support an optional list of threshold rules; each rule specifies an operator, a numeric threshold value, an optional `name`, and at least one of optional `text_color` or `background_color`. These field names are identical to the existing static row color fields on `EntityRowConfig` and `ExpressionRowConfig`.
- **FR-002**: Supported operators MUST include `above` (cell value strictly greater than threshold), `equals-above` (cell value ≥ threshold), `equals-below` (cell value ≤ threshold), and `below` (cell value strictly less than threshold).
- **FR-003**: Supported operators MUST include `not-below` and `not-above`; `not-below` applies only to min-value cells and fires when that cell's value is ≥ the threshold; `not-above` applies only to max-value cells and fires when that cell's value is ≤ the threshold. On scalar entities with a single daily value, that value is treated as both min and max, so both operators apply to it.
- **FR-004**: Multiple threshold rules of the same operator type MUST be supported on a single entity.
- **FR-005**: When multiple threshold rules match a cell value, the rule whose threshold value is numerically closest to the cell value MUST be applied; all non-matching rules are ignored.
- **FR-006**: When two matching rules are equidistant from the cell value, the rule with the higher numeric threshold value MUST win. When two equidistant matching rules also share the same numeric threshold value, the first-defined rule (config definition order) MUST win.
- **FR-007**: A threshold color (`text_color` or `background_color`) MUST override the corresponding static row color for the matched cell; colors not specified in the threshold rule fall back to the static row color or default.
- **FR-008**: When no threshold rule matches a cell value, the static row color (if configured) MUST apply to that cell unchanged.
- **FR-009**: Threshold rules MUST be evaluated per cell independently; a threshold match on one cell MUST NOT affect any other cell in the same row or table.
- **FR-010**: Cells with no numeric value (missing data) MUST NOT be evaluated against threshold rules and MUST render with static or default styling only.
- **FR-011**: Threshold rules with neither `text_color` nor `background_color` specified MUST be silently ignored; they MUST NOT cause an error, affect other rules, or appear in the legend.
- **FR-012**: When at least one valid named threshold rule fires (matches a cell value) during rendering of the current view, the card MUST render a legend section at the bottom of the card.
- **FR-013**: The legend MUST combine named threshold entries from all entities into a single list; entries from the same name appearing in multiple entities MUST be deduplicated (first-defined wins).
- **FR-014**: Named threshold rules that do not fire during rendering of the current view MUST NOT appear in the legend; only rules that matched at least one visible cell are eligible for legend display.
- **FR-015**: When no valid named threshold rule fires during the current render (including the case where named rules are configured but none match any visible cell value), the legend MUST NOT be rendered.
- **FR-016**: Each legend entry MUST display a swatch showing a sample glyph, paired with the threshold name as a plain text label.
The swatch MUST reproduce what the rule does to a matched cell: `background_color` as the swatch background, and the glyph in `text_color`, or in the auto-contrast color when only `background_color` is set.
A rule with only `text_color` MUST still show the swatch, with no background fill and the glyph in that color.
A rule with neither color MUST show no swatch.
- **FR-017**: Legend entries MUST be ordered by first appearance across all entities, following config definition order; duplicate names are deduplicated on first occurrence.

### Key Entities

- **ThresholdRule**: Specifies operator (`above`, `equals-above`, `equals-below`, `below`, `not-below`, `not-above`), numeric threshold value, optional `name`, optional `text_color`, optional `background_color`.
- **LegendEntry**: Derived at render time from all named, non-ignored ThresholdRules across all entities; deduplicated by name (first-defined wins).
- **EntityRowConfig**: Extended with an optional list of `ThresholdRule` entries.
- **ExpressionRowConfig**: Extended with an optional list of `ThresholdRule` entries with identical behavior.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can configure threshold rules on any entity or expression row and have cells colored automatically based on their values, without any additional configuration outside the entity definition.
- **SC-002**: All four threshold operators (`above`, `equals-above`, `equals-below`, `below`) produce correct results at boundary values — 100% automated test pass rate.
- **SC-003**: For entities with multiple threshold rules, the correct "closest threshold" rule is applied for all tested value ranges — verified by automated tests covering at least 5 distinct value bands per operator combination.
- **SC-004**: When a threshold matches, the threshold color overrides the static row color for the matched cell; non-matched cells retain static row colors — verified by automated tests.
- **SC-005**: `not-below` and `not-above` threshold rules produce correct results for boundary values — 100% automated test pass rate.
- **SC-006**: The legend appears if and only if at least one valid named threshold fires during rendering of the current view — verified by automated tests covering triggered/not-triggered/absent-name scenarios.
- **SC-007**: A user can identify what each cell color means by reading the legend without accessing the card configuration.

## Assumptions

- Threshold rules apply to all data value cells (daily values and monthly summary cells); both cell types display numeric values and should be colored consistently.
- Threshold rules are evaluated against the numeric value displayed in the specific cell being rendered, not a derived aggregate (except for `not-below`/`not-above` where the targeted cell type is clarified in FR-003).
- Threshold `text_color` and `background_color` accept the same CSS color value formats as static row colors: hex codes, HTML named colors, `rgb()`/`rgba()`, `hsl()`, and CSS custom property references (`var(--token)`).
- Thresholds apply to both `year-table` and `monthly-table` rendering components.
- No limit on the number of threshold rules per entity; performance impact is negligible for typical configurations (< 20 rules per entity).
- The "closest threshold wins" rule is applied across all operator types combined; operators are not evaluated in separate priority groups.
- This feature supersedes the "threshold-based coloring is out of scope" note in the existing entity row colors specification (spec 003).
