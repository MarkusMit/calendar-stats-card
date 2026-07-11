# Feature Specification: Threshold Aggregation Scope

**Feature Branch**: `015-threshold-scope`
**Created**: 2026-07-11
**Status**: Draft
**Input**: User description: "Threshold rules need an aggregation scope so daily-intent thresholds stop firing on monthly/yearly aggregate cells. Each threshold rule gets an optional scope — day (default), month, or year — and is only evaluated against cells whose displayed value has that aggregation period: day-scope for daily values and statistics over daily values (all measurement cells at every level, cumulative daily diffs and their monthly summary stats), month-scope for monthly sums and statistics over monthly sums (cumulative monthly totals in the yearly and comparison views, year rollups over monthly totals, and the monthly view's Total column — which becomes colorable), year-scope for yearly sums (the yearly Total column — which becomes colorable). Existing configurations without a scope keep their current correct daily behavior; the wrong coloring of monthly totals disappears without config changes. The threshold editor gets a scope selector; legend behavior is unchanged. Diff cells in the comparison view remain uncolored."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Daily thresholds stop firing on monthly totals (Priority: P1)

A user has configured a threshold on a cumulative row, intending it for daily values — for example "flag days with more than 10 mm precipitation".
Since the yearly and comparison views appeared, that same rule also fires on monthly totals (around 100 mm), coloring essentially every monthly cell and making the coloring meaningless.
With aggregation scopes, the rule defaults to the day scope and is evaluated only against day-scale cells, so monthly and yearly sum cells are no longer colored by it — without the user changing anything.

**Why this priority**: This is the reported defect and the reason for the feature.
Restoring meaningful coloring in the yearly and comparison views is independently valuable even if no new scopes are ever configured.

**Independent Test**: Configure a cumulative row with a single threshold rule (no scope given) whose value is exceeded by every monthly total but only by some daily values.
Open the yearly view and the month comparison view and verify no monthly-total cell is threshold-colored, while the monthly view's daily cells keep their existing coloring.

**Acceptance Scenarios**:

1. **Given** a cumulative row with threshold `above: 10` and no scope, **When** the yearly view renders a month cell holding a monthly total of 100, **Then** that cell has no threshold coloring.
2. **Given** the same row, **When** the monthly view renders a daily cell with value 12, **Then** that cell is threshold-colored exactly as before this feature.
3. **Given** the same row, **When** the comparison view renders a year's monthly-total cell of 100, **Then** that cell has no threshold coloring.
4. **Given** the same row, **When** the yearly view renders the year rollup computed over monthly totals, **Then** that rollup cell has no threshold coloring.
5. **Given** a measurement row (e.g. temperature) with a day-scope threshold, **When** the yearly view renders its monthly min/avg/max cells, **Then** those cells keep their threshold coloring, because they carry day-scale values.

---

### User Story 2 - Flag notable months with month-scope thresholds (Priority: P2)

The same user now wants to flag genuinely wet months.
They add a second rule on the precipitation row — for example "above 150, scope month" — and the yearly view, the comparison view, and the monthly view's Total column color exactly the months whose total exceeds 150.

**Why this priority**: This delivers the new expressive power that motivated choosing a scope field over simply removing aggregate coloring.
It depends on the scope mechanism from story 1.

**Independent Test**: Configure a cumulative row with one day-scope and one month-scope rule.
Verify month cells are colored only by the month-scope rule and daily cells only by the day-scope rule.

**Acceptance Scenarios**:

1. **Given** a cumulative row with `above: 150` at month scope, **When** the yearly view renders a month cell with total 180, **Then** that cell is colored by the month-scope rule.
2. **Given** the same rule, **When** the yearly view renders a month cell with total 120, **Then** that cell has no threshold coloring.
3. **Given** the same rule, **When** the monthly view renders that month's Total column cell with value 180, **Then** that Total cell is colored — a cell that previously never received threshold coloring.
4. **Given** the same rule, **When** the comparison view renders a compared year's monthly-total cell of 180, **Then** that cell is colored.
5. **Given** the same rule, **When** the monthly view renders a daily cell of 160 (freak rain day), **Then** the month-scope rule does not color it; only day-scope rules are considered for daily cells.
6. **Given** multiple month-scope rules matching a monthly total, **When** the cell renders, **Then** the closest-threshold-wins selection runs among the month-scope rules only, with the existing tie-break order.

---

### User Story 3 - Flag notable years with year-scope thresholds (Priority: P3)

The user wants the yearly Total column to highlight exceptional years — for example a yearly precipitation sum above 1200 mm.
They add a rule with year scope, and only the yearly Total cells meeting the condition are colored.

**Why this priority**: Completes the scope ladder and makes the last uncolored sum cell expressive, but it is the least frequently viewed cell type.

**Independent Test**: Configure a cumulative row with a year-scope rule and verify only yearly Total cells satisfying the condition are colored, in any view that shows them.

**Acceptance Scenarios**:

1. **Given** a cumulative row with `above: 1200` at year scope, **When** the yearly view renders a yearly Total of 1300, **Then** that Total cell is colored — a cell that previously never received threshold coloring.
2. **Given** the same rule, **When** the yearly view renders a yearly Total of 900, **Then** that cell has no threshold coloring.
3. **Given** the same rule, **When** any month cell or daily cell renders, **Then** the year-scope rule never colors it.

---

### User Story 4 - Configure the scope in the visual editor (Priority: P3)

A user editing the card in the visual configuration editor sees, for each threshold rule, a scope selector alongside the existing operator, value, name, and color fields.
It offers Day, Month, and Year, defaults to Day, and is labeled in the user's language (English or German).

**Why this priority**: YAML users can already set the field once it exists; the editor control is a convenience layer on top.

**Independent Test**: Open the threshold editor, change a rule's scope to Month, save, and verify the stored configuration carries the month scope and the editor re-displays it.

**Acceptance Scenarios**:

1. **Given** a threshold rule without a scope, **When** the editor displays it, **Then** the scope selector shows Day.
2. **Given** the user selects Month, **When** the configuration is saved, **Then** the rule carries the month scope and re-opening the editor shows Month.
3. **Given** the Home Assistant language is German, **When** the editor renders, **Then** the scope selector and its options appear in German.

---

### Edge Cases

- **Mixed-scope rule lists**: the closest-threshold-wins selection and its tie-breaks operate only among rules whose scope matches the cell; rules of other scopes are invisible to that cell.
- **Month- or year-scope rules on measurement rows**: measurement rows have no sum cells, so such rules never fire; this is silently allowed, not an error, and they never appear in the legend.
- **Min/max-targeting operators (`not-below`/`not-above`) with month or year scope**: sum cells are single-value cells, so both operators apply to them, mirroring the existing behavior on daily single-value cells.
- **Named rules with month or year scope**: they enter the legend exactly like day-scope rules — only when they fire on a visible cell in the current render.
- **Difference and average-deviation cells in the comparison view**: remain uncolored regardless of any scope.
- **Invalid scope value in YAML**: treated as the default day scope, consistent with the card's lenient handling of optional fields.
- **Expression rows**: behave like cumulative rows for scope classification of their cells.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each threshold rule MUST support an optional aggregation scope with the values day, month, and year; a rule without a scope MUST behave as day scope.
- **FR-002**: A threshold rule MUST be evaluated only against cells whose displayed value has the rule's aggregation period; cells of other periods MUST ignore the rule entirely.
- **FR-003**: Day-scale cells are all cells whose value is a daily value or a statistic over daily values without cross-day summation: measurement cells at every level (daily, monthly summary, yearly rollup, comparison, cross-year average), cumulative and expression daily values, and their monthly summary min/avg/max.
- **FR-004**: Month-scale cells are all cells whose value is a monthly sum or a statistic over monthly sums: cumulative and expression month cells in the yearly view, the corresponding cells in the comparison view including its cross-year average, yearly rollups computed over monthly totals, and the monthly view's per-month Total column.
- **FR-005**: Year-scale cells are all cells whose value is a yearly sum: the yearly view's Total column for cumulative and expression rows.
- **FR-006**: The monthly view's Total column, previously never threshold-colored, MUST become colorable by month-scope rules.
- **FR-007**: The yearly view's Total column, previously never threshold-colored, MUST become colorable by year-scope rules.
- **FR-008**: The closest-threshold-wins selection and its existing tie-break order MUST be computed among the rules matching the cell's scope only.
- **FR-009**: Existing configurations without scope fields MUST keep their current behavior on all day-scale cells unchanged; their coloring of month- and year-scale cells MUST disappear without any configuration change.
- **FR-010**: The threshold editor MUST offer a scope selector per rule with the options Day, Month, and Year, defaulting to Day, localized in English and German.
- **FR-011**: Legend behavior MUST remain unchanged: a named rule of any scope appears in the legend exactly when it fires on a visible cell in the current render.
- **FR-012**: Difference and average-deviation cells in the comparison view MUST remain free of threshold coloring.
- **FR-013**: The existing cell-role restrictions of the min/max-targeting operators MUST continue to apply unchanged within every scope.

### Key Entities

- **Aggregation scope**: the period of the quantity a cell displays — day, month, or year; sums define the period, statistics inherit the period of the values they summarize.
- **ThresholdRule**: extended by the optional aggregation scope; all other attributes (operator, value, name, colors) unchanged.
- **Scoped cell**: every value cell in the monthly, yearly, and comparison views carries exactly one aggregation scope per FR-003/004/005; diff cells carry none.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With an unmodified pre-existing configuration, no monthly- or yearly-sum cell shows threshold coloring, and every day-scale cell renders exactly as before the change — 100% agreement in automated view tests.
- **SC-002**: A month-scope rule colors exactly the sum cells meeting its condition in the yearly view, the comparison view, and the monthly Total column — 100% automated test pass rate.
- **SC-003**: A year-scope rule colors exactly the yearly Total cells meeting its condition and never any other cell — 100% automated test pass rate.
- **SC-004**: For mixed-scope rule lists, the correct closest rule is selected per cell scope across at least 3 distinct value bands per scope — verified by automated tests.
- **SC-005**: A user can set a rule's scope entirely through the visual editor, without touching YAML, and the choice round-trips through save and reload.
- **SC-006**: All new labels are correct in English and German for every supported label.

## Assumptions

- The scope terminology day/month/year matches the aggregation periods already present in the card; no finer or coarser periods are needed.
- Month- and year-scope rules on measurement rows are permitted but inert, since measurement rows expose no sum cells; no validation error is raised.
- This feature supersedes the spec 007 assumption that "threshold rules apply to all data value cells … colored consistently", and refines spec 013 FR-017 and spec 014 FR-011: threshold application in those views is now gated by the rule's aggregation scope.
- Percentage figures shown next to comparison diffs are annotations of diff cells and therefore never threshold-colored.
- No migration is needed: absent scope fields simply mean day scope.
