# Feature Specification: Threshold Exceedance Table

**Feature Branch**: `016-threshold-exceedance-table`
**Created**: 2026-09-06
**Status**: Draft
**Input**: User description: "At the end of the page, add a table with days exceeding thresholds of the viewed date range.
It should show both, days only between this threshold and the next, and all days above this threshold."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Count the days a threshold was reached (Priority: P1)

A user has configured named thresholds on a row — for example "Summer day" at 25 °C and "Hot day" at 30 °C — and sees individual days colored in the monthly tables.
They want to know how often each threshold was actually reached over the range they are looking at, without counting colored cells by hand.
Below the tables, a compact table lists each named threshold with the number of days it applied to.

**Why this priority**: This is the reported need and the reason for the feature.
A single count column already answers "how often did this happen?", which is the whole point of the request.

**Independent Test**: Configure a temperature row with one named threshold, open a range of a few past months, and verify the number shown equals the number of days colored by that threshold in the tables above.

**Acceptance Scenarios**:

1. **Given** a row with one named day threshold and a viewed range containing 7 days that reach it, **When** the page renders, **Then** the exceedance table lists that threshold with a count of 7.
2. **Given** a row whose named threshold is reached on no day of the viewed range, **When** the page renders, **Then** the threshold is listed with a count of 0.
3. **Given** the user navigates to a different range, **When** the new range renders, **Then** the counts refer to the newly viewed range only.

---

### User Story 2 - Separate the band from the running total (Priority: P1)

With several thresholds stacked on one row, a user wants both readings: how many days fell into a given threshold's own band, and how many days reached that threshold or anything beyond it.
For thresholds at 25 and 30, a day at 28 belongs to the 25 band and a day at 32 to the 30 band, while both days count toward the cumulative total of the 25 threshold.

**Why this priority**: Without both numbers, the table is ambiguous — a reader cannot tell whether "12 summer days" excludes the hot days or includes them.
The two columns together are what the user asked for.

**Independent Test**: Configure two named thresholds on one row, view a range containing days in each band, and verify that the band counts are disjoint and that each cumulative count equals the sum of the band counts at and beyond that threshold.

**Acceptance Scenarios**:

1. **Given** thresholds at 25 and 30 and a range containing 5 days between 25 and 30 and 3 days at or above 30, **When** the page renders, **Then** the 25 row shows a band count of 5 and a cumulative count of 8, and the 30 row shows 3 and 3.
2. **Given** any row of the table, **When** the counts are read, **Then** the band counts of all thresholds of that row sum to the cumulative count of its lowest threshold.
3. **Given** a threshold that flags low values instead of high ones, **When** the page renders, **Then** its band holds the days that this threshold colors and its cumulative count holds every day it applies to.

---

### User Story 3 - Consistent counts across views and ranges (Priority: P2)

A user switches between the monthly and yearly views, or widens the range across several years, and expects the same days to be counted the same way.

**Why this priority**: The counts lose their value if they change with the view.
It is a correctness guarantee on top of the two stories above rather than a separate capability.

**Independent Test**: Note the counts in the monthly view for a multi-year range, switch to the yearly view without changing the range, and verify every number is unchanged.

**Acceptance Scenarios**:

1. **Given** a range spanning several years, **When** the page renders, **Then** the counts cover every visible day of every year in the range.
2. **Given** the same range, **When** the user switches between the monthly and the yearly view, **Then** all counts stay identical.
3. **Given** the user opens the month comparison, **When** that view renders, **Then** the exceedance table is not shown.

---

### Edge Cases

- A threshold without a name is not listed — there would be nothing to label its row with.
- A threshold that only defines a month or year value is not listed, because it describes aggregated sums rather than days.
- A row whose day shows several values (minimum, average, maximum) counts that day once for a threshold, even when the threshold applies to more than one of those values.
- Days that are not yet complete — today and any future day of the viewed range — are not counted.
- A day whose value is hidden because zero values are suppressed for that row is not counted, matching the fact that no cell is colored for it.
- When no configured threshold qualifies, no table and no heading appear at all.
- When the viewed range holds no data at all, qualifying thresholds are still listed, each with a count of 0.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The card MUST render an exceedance table after all data tables, at the end of the page content.
- **FR-002**: The table MUST contain one row per threshold rule that has both a name and a day threshold value, taken from every configured row.
- **FR-003**: Threshold rules without a name, and rules that define only a month or a year threshold, MUST NOT appear.
- **FR-004**: Rows MUST be grouped per configured entity or expression row, labelled the same way the legend labels its groups, including the unit.
- **FR-005**: Within a group, rows MUST be ordered by day threshold value ascending.
- **FR-006**: Each row MUST show a band count: the number of days in the viewed range for which that rule is the one that determines the cell's coloring.
- **FR-007**: Each row MUST show a cumulative count: the number of days in the viewed range on which that rule applies at all, whether or not another rule takes precedence for the coloring.
- **FR-008**: A day MUST be counted at most once per rule, even when the row displays several values for that day and the rule applies to more than one of them.
- **FR-009**: Counting MUST cover every visible day of every month of the viewed range, across all years the range spans.
- **FR-010**: Incomplete days — today and future days — MUST NOT be counted.
- **FR-011**: Counting MUST reflect what the tables show: values suppressed because zero values are hidden for a row MUST NOT be counted, and any configured scaling factor for the row MUST be applied before comparing against thresholds.
- **FR-012**: The table MUST appear in the monthly view and in the yearly view, and MUST NOT appear in the month comparison view.
- **FR-013**: The table MUST appear whenever at least one qualifying threshold rule exists, without any configuration option to enable it.
- **FR-014**: The counts for a given range MUST be identical in the monthly and the yearly view.
- **FR-015**: All headings and column labels of the table MUST be available in English and German.
- **FR-016**: Each threshold row MUST carry the visual marking of its rule, so a row can be matched to the colored cells it summarizes.
- **FR-017**: In the yearly view, when the range spans more than one year, each row MUST show its two counts separately for every displayed year, in chronological order, followed by the counts over the whole range.
- **FR-018**: A displayed year with no matching day MUST still get its own columns, showing zero.
- **FR-019**: The per-year counts of a row MUST sum to that row's counts over the whole range.
- **FR-020**: The monthly view MUST keep the range-wide counts without per-year columns, and a yearly view showing a single year MUST do the same.

### Key Entities

- **Threshold exceedance row**: one named day threshold of one configured row, together with its band count and its cumulative count for the viewed range.
- **Exceedance group**: the exceedance rows belonging to one configured entity or expression row, carrying that row's display label.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can read how often any named threshold was reached in the viewed range without counting colored cells manually.
- **SC-002**: For every configured row, the band counts of its thresholds sum exactly to the cumulative count of its lowest threshold.
- **SC-003**: Every band count equals the number of days visibly colored by that threshold in the tables above it, for any viewed range.
- **SC-004**: Switching between the monthly and the yearly view over the same range leaves every count unchanged.
- **SC-005**: Navigating to another range updates every count to that range with no stale values remaining.

## Assumptions

- The table is read-only and offers no interaction; selecting a row or drilling into the counted days is out of scope.
- Counts are whole numbers of days; no percentages, averages or per-month breakdowns are shown.
- The table follows the dense layout of the existing tables and adds no vertical whitespace beyond what the surrounding tables use.
- Only day-scale thresholds are meaningful here, so no separate table or column is provided for month or year thresholds.
- The existing rule that decides which rule colors a cell when several apply is reused unchanged; this feature does not alter any coloring.
- The daily values needed for counting are already loaded for every year of the viewed range in both views, so no additional data retrieval is required.
