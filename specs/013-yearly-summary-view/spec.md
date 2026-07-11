# Feature Specification: Yearly Summary View

**Feature Branch**: `013-yearly-summary-view`
**Created**: 2026-07-11
**Status**: Draft
**Input**: User description: "a new view, which - similarily to the monthly tables - the monthly summaries in yearly tables"

## Clarifications

### Session 2026-07-11

- Q: How is a measurement row's yearly Summary min/avg/max computed? → A: Extremes from the monthly summaries (year min = lowest monthly min, year max = highest monthly max); avg = day-weighted mean over the year (equivalent to the mean of all daily values in the year).
- Q: What control switches between the monthly and yearly views? → A: A segmented control with two labeled options (Monthly | Yearly) in the bottom bar.
- Q: How far into the past can the user navigate (earliest-data floor)? → A: Clamp to the period containing the first recorded data point; "previous" is disabled there, and no fully-empty period before the first data is reachable (applies to both the monthly and yearly views' shared navigation).
- Q: Does each year block render all 12 month columns, or only the months in range? → A: The yearly view restricts the selectable range to whole calendar years, so each year block always spans all 12 months (January–December); only the current year (future months) and the earliest-data year (pre-data months) render blank cells.
- Q: Do per-row threshold colorings apply to the yearly-view cells? → A: Yes — apply the same per-row threshold rules to each yearly-view cell (evaluated against that cell's displayed value), with the legend, exactly as in the monthly view.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See a year at a glance with one column per month (Priority: P1)

A user who tracks entities over long periods wants to compare months without scrolling through a wide day-by-day grid.
They switch to the yearly view and see, for each year in view, a compact table whose columns are the twelve months and whose rows are their configured entities.
Each cell holds that month's summary — min/avg/max for measurement entities, the monthly total for cumulative entities — reusing the same summary values already shown at the end of each month in the monthly view.

**Why this priority**: This is the core of the feature. One month-per-column table for a year is the minimum that delivers the "year at a glance" value and is independently useful even without the extras below.

**Independent Test**: Configure a handful of entities, open the yearly view for a past year with data, and confirm a single table appears with twelve month columns and one row per entity, each populated cell matching the corresponding monthly summary from the monthly view.

**Acceptance Scenarios**:

1. **Given** entities with a full year of recorded data, **When** the user opens the yearly view for that year, **Then** a table is shown with one column per month (January–December) and one row per entity, and each cell shows that month's summary.
2. **Given** a measurement entity (e.g. temperature), **When** its row is displayed, **Then** each month cell shows the month's min/avg/max according to the row's configured min/avg/max visibility.
3. **Given** a cumulative entity (e.g. precipitation), **When** its row is displayed, **Then** each month cell shows the month's total.
4. **Given** the current (incomplete) year, **When** the user opens the yearly view, **Then** months after the current month are not shown as data (they are blank or omitted), consistent with how the monthly view hides future periods.

---

### User Story 2 - Per-row yearly summary and total (Priority: P2)

Alongside the twelve month columns, the user wants a roll-up for the whole year so they can read each entity's yearly min/avg/max and, where applicable, its yearly total, without doing mental math across months.

**Why this priority**: High value and a natural parallel to the monthly view's per-month Summary/Total columns, but the view is already useful without it, so it ranks below P1.

**Independent Test**: Open the yearly view for a year with data and confirm each row shows a yearly Summary (min/avg/max) and, for cumulative rows, a yearly Total, and that these aggregate the twelve month cells correctly.

**Acceptance Scenarios**:

1. **Given** a measurement row across a year, **When** the yearly Summary column is shown, **Then** it presents the year's min/avg/max derived from the months in view.
2. **Given** a cumulative row across a year, **When** the yearly Total column is shown, **Then** it presents the sum of the months' totals.
3. **Given** a row configured to exclude zero-value periods, **When** the yearly Summary is computed, **Then** zero-value months are included or excluded consistently with that row's existing zero-handling setting.

---

### User Story 3 - Switch between the monthly and yearly views (Priority: P3)

A user wants to move between the detailed monthly (day-by-day) view and the new yearly (month-by-month) view without reconfiguring the card, keeping the same entities and the same selected time range.

**Why this priority**: Makes the feature discoverable and convenient, but the yearly view can be validated on its own, so it is the lowest of the three.

**Independent Test**: With the monthly view showing a selected range, switch to the yearly view and back, confirming the same entities and time range remain in effect and the switch control is reachable from the navigation bar.

**Acceptance Scenarios**:

1. **Given** the monthly view with a selected time range, **When** the user activates the view switch in the navigation bar, **Then** the yearly view is shown for the same entities and for the full calendar year(s) spanning that range.
2. **Given** the yearly view, **When** the user switches back, **Then** the monthly view returns unchanged.
3. **Given** a multi-year selected range, **When** the yearly view is shown, **Then** each year in the range appears as its own table block, in chronological order.

---

### Edge Cases

- **Multi-year range**: a range spanning more than one year shows one yearly table per year, ordered chronologically, each with the year labeled.
- **Partial data at the boundaries**: a year whose data starts mid-year (earliest available month) shows earlier months as empty rather than fabricating values.
- **Future months**: months after the current month in the current year are never shown as data.
- **Missing / no-data month**: a month with no recorded value for a row shows an empty cell, not a zero.
- **Zero-value months**: whether zero-value months count toward a row's yearly min/avg/max follows that row's existing zero-handling setting.
- **Expression rows**: rows defined by an expression display their monthly summaries in the grid just like entity rows.
- **Labels and units**: the entity label column (including unit of measurement) is shown exactly as in the monthly view.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide a yearly view that presents monthly summaries in a grid with one column per calendar month (January–December) and one row per configured entity or expression.
- **FR-002**: For measurement entities, each month cell MUST show that month's min/avg/max, honoring the row's configured visibility of the minimum, average, and maximum values.
- **FR-003**: For cumulative entities, each month cell MUST show that month's total.
- **FR-004**: The month values shown in the yearly view MUST match the monthly summary values presented in the monthly view for the same entity and month.
- **FR-005**: The system MUST provide, per row, a yearly Summary showing the year's min/avg/max, where the year min is the lowest monthly min, the year max is the highest monthly max, and the year avg is the day-weighted mean over the year (equivalent to the mean of all daily values in the year).
- **FR-006**: For cumulative rows, the system MUST provide a yearly Total that sums the months' totals.
- **FR-007**: The yearly view MUST NOT display data for months after the current month in the current year.
- **FR-008**: A month with no recorded data for a row MUST render as empty, distinct from a recorded value of zero.
- **FR-009**: The inclusion or exclusion of zero-value months in a row's yearly Summary MUST follow that row's existing zero-handling configuration.
- **FR-010**: When the selected time range spans multiple years, the yearly view MUST render one table block per year, in chronological order, each labeled with its year.
- **FR-011**: Users MUST be able to switch between the monthly view and the yearly view via a segmented control with two labeled options (Monthly | Yearly) in the bottom navigation bar, and switching MUST preserve the configured entities and the selected time span (in the yearly view the span is expanded to whole years per FR-016).
- **FR-012**: The yearly view MUST display the entity label column, including unit of measurement, consistently with the monthly view.
- **FR-013**: The yearly view MUST keep a dense layout with no excessive whitespace, consistent with the monthly view.
- **FR-014**: The yearly view MUST present its column and roll-up labels in the user's Home Assistant language for the supported languages (English, German).
- **FR-015**: Navigation into the past MUST be clamped to the period containing the first recorded data point: the "previous" control MUST be disabled once the visible range reaches that first-data period, and no fully-empty period before the first data MUST be reachable. This floor applies to the shared navigation used by both the monthly and yearly views.
- **FR-016**: In the yearly view, the selectable time range MUST be restricted to whole calendar years — range presets and custom selection operate at year granularity and navigation steps by whole years. When the user switches from the monthly view to the yearly view, the current range MUST expand to the full calendar year(s) it spans. (Within a shown year, the current-month and earliest-data clamps of FR-007 and FR-015 still apply, leaving those boundary cells blank.)
- **FR-017**: The yearly view MUST apply each row's threshold rules to its cells — evaluated against each cell's displayed value — and MUST present the threshold legend, consistent with the monthly view's threshold coloring.

### Key Entities *(include if feature involves data)*

- **Yearly table**: a per-year presentation whose columns are the twelve calendar months and whose rows are the configured entities/expressions; each cell is a monthly summary.
- **Monthly summary (per cell)**: the min/avg/max (measurement) or total (cumulative) for one entity in one month — the same summary already computed for the monthly view.
- **Yearly roll-up (per row)**: the year's min/avg/max and, where applicable, total, aggregated across the months in view for one row.
- **View mode**: which presentation is active — monthly (day-by-day) or yearly (month-by-month) — shared with the entity selection and the selected time range.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any entity and month with data, the value shown in the yearly view equals the summary shown for that entity/month in the monthly view (100% agreement).
- **SC-002**: A user can see all twelve months of a year for a given entity without horizontal scrolling on a standard desktop display.
- **SC-003**: Switching from the monthly view to the yearly view (and back) preserves the selected entities in every case, and preserves the selected time span — expanded to whole calendar years while in the yearly view.
- **SC-004**: A multi-year selection shows exactly one labeled table block per year in the selection, in chronological order.
- **SC-005**: No month after the current month is ever shown with data in the yearly view.
- **SC-006**: Column and roll-up labels are correct in both English and German for every supported label.
- **SC-007**: A user cannot navigate to any period that lies entirely before the first recorded data point; the earliest reachable period is the one containing that first data point.

## Assumptions

- The yearly view reuses the monthly summaries already computed for the monthly view (min/avg/max for measurement rows, total for cumulative rows); it does not introduce a new aggregation concept beyond rolling those months up into a per-year Summary/Total.
- The yearly view operates on whole calendar years only: its range selection is year-granular and it renders one full-year block (all 12 months) per year in range. The month-granular range selection remains available in the monthly view; switching to the yearly view expands the active range to the enclosing full year(s), and switching back retains that year-spanning range.
- The yearly and monthly views are mutually exclusive presentations toggled from the navigation bar; they share the same entity configuration and time-range selection. The active view is session state and is not persisted to the card configuration.
- Per-row settings that already exist in the monthly view (label overrides, unit, decimal precision, min/avg/max visibility, zero-handling, threshold coloring) apply unchanged in the yearly view.
- This feature supersedes the earlier "yearly summary tab — out of scope" note in the project guidance; that guidance should be updated to reflect the newly approved scope.
- No new configuration options are required beyond what already configures entities and rows today.
