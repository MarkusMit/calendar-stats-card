# Feature Specification: Month Comparison View

**Feature Branch**: `014-month-comparison-view`
**Created**: 2026-07-11
**Status**: Draft
**Input**: User description: "I want to 'compare' a specific month against the same month in previous years. maybe first a table comparing the monthly summary values, with diffs to previous and diffs to the ranges average. then below the daily values of the selected months like in 'monthly' view. the comparison can be opened from the yearly view by clicking the month in each of the years header rows. the yearly view also defines the date range for the comparison."

## Clarifications

### Session 2026-07-11

- Q: Additional capability (user directive) → A: The comparison view has controls to switch to the next/previous month-of-year, wrapping December↔January, while the compared year range stays fixed to the yearly view's range.
- Q: How do the next/previous month controls behave for months without data in any compared year? → A: Navigation walks all 12 months without skipping; a month empty across all compared years shows an empty-state comparison view.
- Q: How is the summary comparison table arranged? → A: Rows = configured entities (as in the monthly/yearly views), columns = compared years; each cell holds the summary value(s) plus both diffs.
- Q: Is the incomplete current month part of the cross-year average? → A: No — excluded for all row types; it is displayed, marked incomplete, and still receives diffs.
- Q: How are the differences represented? → A: Signed absolute diff in the row's unit for all rows; cumulative/expression totals additionally show a percentage (relative to the diff's baseline), omitted when the baseline is zero or missing.
- Q (revision): Layout adjustments after first implementation? → A: Month prev/next controls move into the bottom navigation bar (back control stays above the tables); the daily section renders as ONE table with a section per data-bearing year (aligned day columns), each section header naming month and year; years without data get no daily section (their absence is visible in the summary table); diffs render beside the value, not below it.
- Q (revision 2): Summary-table refinements? → A: A trailing column shows the cross-year average per (sub-)row; each compared year spans three aligned sub-columns — value, previous-year diff, average deviation — under a single colspan year header; the compared month's name moves from the top bar into the summary table's first header cell (the top bar keeps only the back control).
- Q (revision 3): Remaining layout polish? → A: The back control also moves into the bottom navigation bar (no top bar remains); the summary table's month header cell is styled like the header row and the year headers are centered; the monthly (day-grid) table's horizontal scrollbar stays pinned at the viewport's bottom edge via a sticky scrollbar synced with the table container.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Compare one month across years at a glance (Priority: P1)

A user viewing the yearly view wants to know how a specific month performed compared to the same month in the other years of the visible range.
They click that month's label in any year's header row and a comparison view opens.
The comparison view leads with a summary table that lists, for every year in the yearly view's range, the monthly summary values of each configured row — min/avg/max for measurement rows, the monthly total for cumulative rows.
Next to each value the user sees two differences: the change against the same month one year earlier, and the deviation from the average of that value across all compared years.

**Why this priority**: This is the core of the feature.
The cross-year summary table with both diffs answers the user's central question ("is this month unusual?") and is independently useful without the daily detail below it.

**Independent Test**: Configure a multi-year range in the yearly view, click a month label with data in several years, and confirm the comparison opens with one entry per year in range, values matching the yearly view's cells, and arithmetically correct diffs.

**Acceptance Scenarios**:

1. **Given** the yearly view showing a multi-year range, **When** the user clicks a month label in any year's header row, **Then** a comparison view opens for that calendar month covering every year of the yearly view's range.
2. **Given** the comparison view is open, **When** the summary table renders, **Then** each compared year shows the same monthly summary values for each row as the corresponding cell in the yearly view.
3. **Given** a year whose preceding year in the range has data for the compared month, **When** its summary values render, **Then** each value shows a signed difference against the preceding year's value.
4. **Given** at least one compared year with data, **When** the summary table renders, **Then** each value shows a signed deviation from the average of that value across all compared years that have data for the month.
5. **Given** the earliest year of the range, **When** its summary values render, **Then** no previous-year difference is shown for it.
6. **Given** the comparison view is open, **When** the user activates the next or previous month control, **Then** the comparison switches to the adjacent calendar month for the same year range, wrapping December↔January, and an all-empty month shows the empty state.

---

### User Story 2 - Inspect the daily values of the compared months (Priority: P2)

After reading the summary comparison, the user wants to drill into the day-by-day values that produced those summaries.
Below the summary table, the comparison view shows the selected month's daily values for each compared year, presented like the familiar monthly view — all inside one table with aligned day columns, one section per year, each section header naming the month and its year.

**Why this priority**: Valuable drill-down, but the comparison already delivers its main answer through the summary table, so the daily detail ranks second.

**Independent Test**: Open the comparison for a month with data in at least two years and confirm a daily table per year appears below the summary, with values identical to the monthly view for the same entity, month, and year.

**Acceptance Scenarios**:

1. **Given** the comparison view is open, **When** the daily section renders, **Then** one table appears below the summary with a daily section per data-bearing compared year, in chronological order, each section header naming the month and its year, all sections sharing aligned day columns.
2. **Given** a daily section for a compared year, **When** its cells render, **Then** the values, per-row visibility, precision, zero-handling, and threshold coloring match the monthly view for that same month and year.
3. **Given** a compared year without recorded data for the month, **When** the daily section renders, **Then** that year gets no daily section and no fabricated values; its absence remains visible in the summary table above.

---

### User Story 3 - Return to the yearly view (Priority: P3)

The user finishes the comparison and wants to get back to where they came from.
A back control returns them to the yearly view with the same range and entities they left.

**Why this priority**: Necessary for a round trip, but trivial compared to the comparison content itself.

**Independent Test**: Open a comparison from the yearly view, activate the back control, and confirm the yearly view returns with the previously selected range and entities.

**Acceptance Scenarios**:

1. **Given** the comparison view is open, **When** the user activates the back control, **Then** the yearly view is shown again with the same year range and entities as before.
2. **Given** the comparison view is open, **When** the card re-renders (e.g. data refresh), **Then** the comparison view stays open until the user navigates away.

---

### Edge Cases

- **Single-year range**: the comparison still opens; no previous-year differences exist, and the deviation from the average is zero for every complete value.
- **Lone incomplete month**: when the only compared value is the incomplete current month, no cross-year average exists (it is excluded from the average), so its average deviation is omitted.
- **Year without data for the month**: that year renders empty summary cells, is excluded from the cross-year average, and yields no previous-year difference for the following year.
- **Incomplete current month**: the current (partial) month is shown with its data to date and visibly marked as incomplete; it is excluded from the cross-year average so it does not skew the baseline.
- **Future months**: month labels that hold no data in any year of the range (e.g. future months of the current year in a single-year range) do not open a comparison on click; such months remain reachable via the comparison view's next/previous month controls and then show the empty state.
- **Empty month via navigation**: switching to a month with no data in any compared year shows an empty-state comparison view (no summary values, no daily tables), from which the user can continue navigating or go back.
- **Expression rows**: rows defined by an expression participate in the comparison exactly like entity rows.
- **Zero-value handling**: each row's existing zero-handling setting governs its summary values; the cross-year average and diffs operate on those resulting summary values.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each month label in every year's header row of the yearly view MUST act as a control that opens the month comparison view for that calendar month.
- **FR-002**: The comparison MUST cover exactly the years of the yearly view's currently selected range; the yearly view's range is the single source of the compared date span.
- **FR-003**: The comparison view MUST lead with a summary table whose rows are the configured entities/expressions (as in the monthly and yearly views) and whose columns are the compared years; each year spans three aligned sub-columns — the selected month's summary value (min/avg/max for measurement rows honoring the row's configured visibility, the monthly total for cumulative rows), the previous-year difference (FR-005), and the average deviation (FR-006) — under a single year header, followed by a trailing column showing the cross-year average per (sub-)row; the table's first header cell names the compared month.
- **FR-004**: The summary values in the comparison MUST equal the values shown for the same row, month, and year in the yearly view.
- **FR-005**: For each summary value of a compared year, the system MUST show the signed difference against the same value of the immediately preceding year in the range, omitted when that preceding year has no data for the month or lies outside the range.
- **FR-006**: For each summary value of a compared year, the system MUST show the signed deviation from the average of that value across all compared years that have data for the month.
- **FR-006a**: Differences MUST be presented as signed absolute values in the row's unit of measurement; for cumulative and expression totals, each difference MUST additionally show a signed percentage relative to its baseline (the preceding year's value for FR-005, the cross-year average for FR-006), omitted when that baseline is zero or missing. Measurement rows show no percentages.
- **FR-007**: An incomplete current month MUST be displayed with its data to date, visibly marked as incomplete, and excluded from the cross-year average.
- **FR-008**: A compared year without recorded data for the month MUST render empty cells, distinct from a recorded zero, and MUST be excluded from the cross-year average.
- **FR-009**: Below the summary table, the comparison view MUST render the selected month's daily values in one table with one monthly-view-style section per data-bearing compared year, in chronological order, all sections sharing aligned day columns, each section header naming the month and its year; years without data for the month get no daily section.
- **FR-010**: The daily tables MUST honor all existing per-row settings — label overrides, unit, precision, min/avg/max visibility, zero-handling, and threshold coloring — identically to the monthly view.
- **FR-011**: Threshold coloring MUST also apply to the summary table's value cells, evaluated against each cell's displayed value, consistent with the yearly view.
- **FR-012**: A back control MUST return the user from the comparison view to the yearly view with its previous range and entity configuration intact.
- **FR-013**: The comparison view MUST be session state only; it MUST NOT be persisted to the card configuration.
- **FR-014**: All labels introduced by the comparison view (e.g. difference and average captions, incomplete-month marker, back control) MUST be presented in the user's Home Assistant language for the supported languages (English, German).
- **FR-015**: The comparison view MUST keep a dense layout with no excessive whitespace, consistent with the monthly and yearly views.
- **FR-016**: Month labels whose month holds no data in any compared year MUST NOT open a comparison.
- **FR-017**: The comparison view MUST provide next/previous controls in the bottom navigation bar that switch the compared calendar month (month-of-year) while keeping the compared year range unchanged, wrapping from December to January and from January to December; navigation MUST step through all twelve months without skipping, and a month with no data in any compared year MUST show an empty-state comparison view. The back control sits in the bottom navigation bar as well.

### Key Entities *(include if feature involves data)*

- **Comparison selection**: the calendar month chosen by the user plus the set of years taken from the yearly view's active range; the month is switchable via next/previous controls (wrapping December↔January), the year set is not.
- **Summary comparison table**: rows = configured entities/expressions, columns = compared years; each cell holds the monthly summary value(s) together with the previous-year difference and the deviation from the cross-year average.
- **Cross-year average**: per row and summary value, the mean over all compared years that have data for the month, excluding an incomplete current month.
- **Daily detail table**: the monthly-view presentation of one compared year's selected month, one per compared year.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user reaches the month comparison from the yearly view with a single click on a month label.
- **SC-002**: For every row, month, and year with data, the comparison's summary value equals the yearly view's corresponding cell value (100% agreement).
- **SC-003**: Every displayed previous-year difference equals the year's value minus the preceding year's value, and every displayed average deviation equals the year's value minus the cross-year average (100% arithmetic agreement).
- **SC-004**: For every compared year with data, the daily detail values match the monthly view for the same month and year (100% agreement).
- **SC-005**: The comparison lists exactly one entry per year of the yearly view's selected range, in chronological order.
- **SC-006**: All comparison-specific labels are correct in both English and German.
- **SC-007**: A round trip yearly view → comparison → back preserves the yearly view's range and entities in every case.
- **SC-008**: Twelve consecutive next (or previous) activations of the month control cycle through all twelve months and return to the starting month, with the year range unchanged throughout.

## Assumptions

- The comparison reuses the monthly summary values already computed for the yearly view and the daily values already computed for the monthly view; it introduces no new aggregation beyond the cross-year average and the two differences.
- Differences are shown as signed absolute values in the row's unit of measurement; cumulative/expression totals additionally carry a percentage against the respective baseline, measurement rows do not.
- When the immediately preceding year in the range lacks data for the month, the previous-year difference is omitted rather than falling back to an older year.
- The incomplete current month participates in the display and in previous-year differences but not in the cross-year average, so the baseline reflects only complete months.
- The daily detail sections live in one table (chronological, matching the yearly view's year ordering) so their day columns align vertically across years; a side-by-side (horizontal) day alignment across years is not part of this feature.
- Value, previous-year diff, and average deviation occupy separate aligned sub-columns per year (single colspan year header); the cross-year average has its own trailing column.
- Entities present in only part of the range simply show empty cells for years without data; the existing predecessor handling applies unchanged.
- Chart-like visualizations and cross-month comparison (different calendar months side by side) are out of scope.
- The compared month is switchable inside the comparison view via next/previous controls; the compared year range is not changeable there — it always mirrors the yearly view's range.
