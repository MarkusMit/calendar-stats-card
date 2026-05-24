# Feature Specification: Measurement Row Visibility

**Feature Branch**: `002-measurement-row-visibility`
**Created**: 2026-05-24
**Status**: Draft
**Input**: User description: "Additional options for entity configuration to optionally hide each of min, max, avg rows of measurement entities"

## Clarifications

### Session 2026-05-24

- Q: What are the names of the three configuration fields? → A: `show_min`, `show_avg`, `show_max` — boolean per sub-row, positive logic (default `true`), mirroring the existing `show_zero` naming convention.
- Q: For cumulative entities, which summary values should be hideable? → A: min/avg/max in the summary column only — reuse `show_min`, `show_avg`, `show_max`; they now apply to cumulative entity summary values as well as measurement sub-rows. The total value is always shown and is not hideable.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Selectively Show Measurement Sub-Rows (Priority: P1)

A user configures a temperature sensor and wants only the average value visible — the min and max rows add visual noise they don't need. They set `show_min: false` and `show_max: false` on the entity config. The card renders only the avg sub-row for that entity across all monthly tables, reducing the entity's vertical footprint to one row.

**Why this priority**: Core use case. Users with many entities benefit most from collapsing measurement rows they don't need.

**Independent Test**: Configure a measurement entity with `show_min: false, show_max: false`. Open dashboard, verify only the avg row is visible; min and max sub-rows are absent. Other entities are unaffected.

**Acceptance Scenarios**:

1. **Given** `show_min: false` is set for a measurement entity, **When** the card renders, **Then** the min sub-row for that entity is absent from all monthly tables.
2. **Given** `show_avg: false` is set for a measurement entity, **When** the card renders, **Then** the avg sub-row for that entity is absent from all monthly tables.
3. **Given** `show_max: false` is set for a measurement entity, **When** the card renders, **Then** the max sub-row for that entity is absent from all monthly tables.
4. **Given** none of `show_min`, `show_avg`, `show_max` is set, **When** the card renders, **Then** all three sub-rows appear (unchanged default behaviour).
5. **Given** `show_min: false, show_max: false` for entity A and default config for entity B, **When** the card renders, **Then** entity A shows 1 row (avg only); entity B shows all 3 rows; column alignment is maintained across both entities.

---

### User Story 2 - Summary Column Respects Visibility (Priority: P1)

A user who hides the min row (measurement) or the min summary value (cumulative) expects the summary column to omit that value, so the summary stays consistent with what the user chose to show.

**Why this priority**: Without this, summary shows values the user explicitly suppressed — misleading and defeats the purpose of the config.

**Independent Test**: Configure a measurement entity with `show_min: false` and a cumulative entity with `show_avg: false`. Verify measurement summary omits min; cumulative summary omits avg (total still shown). Both day columns unaffected.

**Acceptance Scenarios**:

1. **Given** `show_min: false` on a measurement entity, **When** viewing the summary column, **Then** no min value appears in the summary for that entity.
2. **Given** `show_avg: false` on a measurement entity, **When** viewing the summary column, **Then** no avg value appears in the summary for that entity.
3. **Given** `show_max: false` on a measurement entity, **When** viewing the summary column, **Then** no max value appears in the summary for that entity.
4. **Given** `show_min: false` on a cumulative entity, **When** viewing the summary column, **Then** no min value appears in the summary; the total value is still shown.
5. **Given** `show_avg: false` on a cumulative entity, **When** viewing the summary column, **Then** no avg value appears in the summary; total still shown.
6. **Given** `show_max: false` on a cumulative entity, **When** viewing the summary column, **Then** no max value appears in the summary; total still shown.
7. **Given** `show_min: false, show_avg: false, show_max: false` on a cumulative entity, **When** viewing the summary column, **Then** only the total value is shown; no min/avg/max values appear.

---

### Edge Cases

- What if all three rows are hidden (`show_min: false, show_avg: false, show_max: false`) for a measurement entity? → The entity renders no data rows; only the label cell appears (spanning a single-row height) as a visual placeholder so the user knows the entity is configured but fully suppressed.
- What if `show_min`/`show_avg`/`show_max` are set on an expression row? → These fields are ignored; expression rows are single-value rows with no min/avg/max concept.
- What if a measurement entity has only one row visible and another has three? → Each entity group occupies its own set of rows; no requirement for equal row counts across entities.
- What if the sub-label column renders for a table with only one visible row per measurement entity? → Sub-label cell still shows the appropriate label (e.g., "avg") for the single visible row.
- What if all three summary values are hidden for a cumulative entity? → The summary cell shows only the total value; the entity's day column is unaffected and continues to show daily sums.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `EntityRowConfig` MUST support three optional boolean fields: `show_min`, `show_avg`, and `show_max`. The default for each is `true`.
- **FR-002**: For expression rows, `show_min`, `show_avg`, and `show_max` MUST be ignored; expression rows are single-value rows with no min/avg/max concept.
- **FR-003**: When `show_min: false` for a measurement entity, the min sub-row MUST NOT be rendered in any monthly table for that entity.
- **FR-004**: When `show_avg: false` for a measurement entity, the avg sub-row MUST NOT be rendered in any monthly table for that entity.
- **FR-005**: When `show_max: false` for a measurement entity, the max sub-row MUST NOT be rendered in any monthly table for that entity.
- **FR-006**: For measurement entities, the summary column MUST only display values for visible sub-rows. If a sub-row is hidden, its corresponding summary value (min, avg, or max) MUST also be absent.
- **FR-007**: When all three of `show_min`, `show_avg`, and `show_max` are `false` for a measurement entity, the entity MUST render a single label-only row with no day-cell content.
- **FR-008**: The sub-label column cell for each visible measurement sub-row MUST continue to display the correct localised label (min, avg/Ø, max).
- **FR-009**: For cumulative entities, `show_min`, `show_avg`, and `show_max` control the visibility of those values in the summary column only; the day column (daily sum) is always shown regardless of these settings.
- **FR-010**: When `show_min: false` for a cumulative entity, the min value MUST NOT appear in the summary column for that entity.
- **FR-011**: When `show_avg: false` for a cumulative entity, the avg value MUST NOT appear in the summary column for that entity.
- **FR-012**: When `show_max: false` for a cumulative entity, the max value MUST NOT appear in the summary column for that entity.
- **FR-013**: For cumulative entities, the total value in the summary column is always shown regardless of `show_min`, `show_avg`, or `show_max` settings; it is not hideable by this feature.

### Key Entities

- **EntityRowConfig** (extended): Existing config type gains three optional boolean fields — `show_min?: boolean`, `show_avg?: boolean`, `show_max?: boolean` — each defaulting to `true`. For measurement entities, these control sub-row rendering and summary values. For cumulative entities, these control summary column values only. For expression rows, these fields are ignored.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can hide any combination of min, avg, max for both measurement entities (sub-rows) and cumulative entities (summary values) by setting one or more boolean fields on the entity config; no other configuration change is required.
- **SC-002**: The summary column is always consistent with visible values — hidden min/avg/max values never appear in the summary for any entity type.
- **SC-003**: For cumulative entities, the total summary value is always visible regardless of `show_min`/`show_avg`/`show_max` settings.
- **SC-004**: Hiding rows on one entity has no visual effect on any other entity in the same table.
- **SC-005**: Default behaviour (all three values visible) is preserved for all existing configurations that omit the new fields.

## Assumptions

- For measurement entities, `show_min/avg/max` affects both day sub-rows and the corresponding summary values.
- For cumulative entities, `show_min/avg/max` affects only the summary column; day columns always show the full daily sum.
- Expression rows are unaffected by these fields.
- The total column for cumulative entities is always shown; a `show_total` field is out of scope for this feature.
- Hiding a value does not affect the underlying data or statistics fetching; it only controls rendering.
- Field names `show_min`, `show_avg`, `show_max` mirror the existing `show_zero` naming convention.
- Card configuration is via the standard HA Lovelace YAML editor; no graphical config UI is added for this feature.
