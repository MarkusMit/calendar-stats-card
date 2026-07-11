# Feature Specification: Threshold Aggregation Scope

**Feature Branch**: `015-threshold-scope`
**Created**: 2026-07-11
**Status**: Draft
**Input**: User description: "Threshold rules need an aggregation scope so daily-intent thresholds stop firing on monthly/yearly aggregate cells. Each threshold rule gets an optional scope — day (default), month, or year — and is only evaluated against cells whose displayed value has that aggregation period: day-scope for daily values and statistics over daily values (all measurement cells at every level, cumulative daily diffs and their monthly summary stats), month-scope for monthly sums and statistics over monthly sums (cumulative monthly totals in the yearly and comparison views, year rollups over monthly totals, and the monthly view's Total column — which becomes colorable), year-scope for yearly sums (the yearly Total column — which becomes colorable). Existing configurations without a scope keep their current correct daily behavior; the wrong coloring of monthly totals disappears without config changes. The threshold editor gets a scope selector; legend behavior is unchanged. Diff cells in the comparison view remain uncolored."

## Clarifications

### Session 2026-07-11

- Q (revision): One scope per rule, or per-period threshold values on each rule? → A: Per-period values.
Each rule carries up to three thresholds — `value` (day), `value_month`, `value_year` — sharing one operator, name, and colors; a rule is inert for periods without a value.
The `scope` field is dropped.
The editor shows three value inputs instead of a scope selector.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Daily thresholds stop firing on monthly totals (Priority: P1)

A user has configured a threshold on a cumulative row, intending it for daily values — for example "flag days with more than 10 mm precipitation".
Since the yearly and comparison views appeared, that same rule also fires on monthly totals (around 100 mm), coloring essentially every monthly cell and making the coloring meaningless.
With per-period thresholds, a rule's `value` applies to day-scale cells only, so monthly and yearly sum cells are no longer colored by it — without the user changing anything.

**Why this priority**: This is the reported defect and the reason for the feature.
Restoring meaningful coloring in the yearly and comparison views is independently valuable even if no month or year values are ever configured.

**Independent Test**: Configure a cumulative row with a single threshold rule (day `value` only) whose value is exceeded by every monthly total but only by some daily values.
Open the yearly view and the month comparison view and verify no monthly-total cell is threshold-colored, while the monthly view's daily cells keep their existing coloring.

**Acceptance Scenarios**:

1. **Given** a cumulative row with threshold `above` and `value: 10` only, **When** the yearly view renders a month cell holding a monthly total of 100, **Then** that cell has no threshold coloring.
2. **Given** the same row, **When** the monthly view renders a daily cell with value 12, **Then** that cell is threshold-colored exactly as before this feature.
3. **Given** the same row, **When** the comparison view renders a year's monthly-total cell of 100, **Then** that cell has no threshold coloring.
4. **Given** the same row, **When** the yearly view renders the year rollup computed over monthly totals, **Then** that rollup cell has no threshold coloring.
5. **Given** a measurement row (e.g. temperature) with a day-value threshold, **When** the yearly view renders its monthly min/avg/max cells, **Then** those cells keep their threshold coloring, because they carry day-scale values.

---

### User Story 2 - Flag notable months with month thresholds (Priority: P2)

The same user now wants to flag genuinely wet months.
They add a month threshold to their rule — for example `value_month: 150` beside the daily `value: 10` — and the yearly view, the comparison view, and the monthly view's Total column color exactly the months whose total exceeds 150, using the rule's shared color.

**Why this priority**: This delivers the new expressive power that motivated per-period thresholds over simply removing aggregate coloring.
It depends on the period-gating mechanism from story 1.

**Independent Test**: Configure a cumulative row with one rule carrying both a day value and a month value.
Verify month cells are gated by the month value only and daily cells by the day value only.

**Acceptance Scenarios**:

1. **Given** a cumulative row with a rule `above` with `value_month: 150`, **When** the yearly view renders a month cell with total 180, **Then** that cell is colored by the rule.
2. **Given** the same rule, **When** the yearly view renders a month cell with total 120, **Then** that cell has no threshold coloring.
3. **Given** the same rule, **When** the monthly view renders that month's Total column cell with value 180, **Then** that Total cell is colored — a cell that previously never received threshold coloring.
4. **Given** the same rule, **When** the comparison view renders a compared year's monthly-total cell of 180, **Then** that cell is colored.
5. **Given** a rule with `value_month: 150` and `value: 10`, **When** the monthly view renders a daily cell of 160 (freak rain day), **Then** the daily cell is gated by the day value 10 (colored), never by the month value.
6. **Given** a rule with only `value_month` set (no `value`), **When** any daily cell renders, **Then** the rule never colors it — the rule is inert for the day period.
7. **Given** multiple rules with month values matching a monthly total, **When** the cell renders, **Then** the closest-threshold-wins selection compares the rules' month values only, with the existing tie-break order.

---

### User Story 3 - Flag notable years with year thresholds (Priority: P3)

The user wants the yearly Total column to highlight exceptional years — for example a yearly precipitation sum above 1200 mm.
They add a `value_year` threshold, and only the yearly Total cells meeting the condition are colored.

**Why this priority**: Completes the period ladder and makes the last uncolored sum cell expressive, but it is the least frequently viewed cell type.

**Independent Test**: Configure a cumulative row with a rule carrying a year value and verify only yearly Total cells satisfying the condition are colored, in any view that shows them.

**Acceptance Scenarios**:

1. **Given** a cumulative row with a rule `above` with `value_year: 1200`, **When** the yearly view renders a yearly Total of 1300, **Then** that Total cell is colored — a cell that previously never received threshold coloring.
2. **Given** the same rule, **When** the yearly view renders a yearly Total of 900, **Then** that cell has no threshold coloring.
3. **Given** a rule with only `value_year` set, **When** any month cell or daily cell renders, **Then** the rule never colors it.

---

### User Story 4 - Configure the period values in the visual editor (Priority: P3)

A user editing the card in the visual configuration editor sees, for each threshold rule, three value inputs — day, month, and year — alongside the existing operator, name, and color fields.
Each input may be left empty (the rule is then inert for that period), and the labels appear in the user's language (English or German).

**Why this priority**: YAML users can already set the fields once they exist; the editor controls are a convenience layer on top.

**Independent Test**: Open the threshold editor, enter a month value, save, and verify the stored configuration carries `value_month` and the editor re-displays it; clear it and verify the field is removed.

**Acceptance Scenarios**:

1. **Given** a threshold rule with only a day value, **When** the editor displays it, **Then** the day input shows the value and the month and year inputs are empty.
2. **Given** the user enters a month value, **When** the configuration is saved, **Then** the rule carries `value_month` and re-opening the editor shows it.
3. **Given** the user clears a period input, **When** the configuration is saved, **Then** that period value is absent from the rule.
4. **Given** the Home Assistant language is German, **When** the editor renders, **Then** the three value inputs are labeled in German.

---

### Edge Cases

- **Per-period selection**: for a given cell, the closest-threshold-wins selection and its tie-breaks compare only the rules' values for that cell's period; rules without a value for that period are invisible to that cell.
- **Month or year values on measurement rows**: measurement rows have no sum cells, so those values never fire; this is silently allowed, not an error, and such rules never appear in the legend via those periods.
- **Min/max-targeting operators (`not-below`/`not-above`) on month or year cells**: sum cells are single-value cells, so both operators apply to them, mirroring the existing behavior on daily single-value cells.
- **Named rules firing via month or year values**: they enter the legend exactly like day-value firings — only when they fire on a visible cell in the current render, shown once per rule.
- **Difference and average-deviation cells in the comparison view**: remain uncolored regardless of any period value.
- **Rule with none of the three period values**: silently ignored, like a rule without colors.
- **Expression rows**: behave like cumulative rows for period classification of their cells.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Each threshold rule MUST support up to three period thresholds — `value` (day), `value_month`, and `value_year` — sharing the rule's operator, name, and colors; each is optional, and a rule with none of the three MUST be silently ignored.
- **FR-002**: For each cell, a rule MUST be evaluated only when it defines a threshold for the cell's aggregation period, comparing the cell value against that period's threshold; periods without a defined threshold MUST ignore the rule entirely.
- **FR-003**: Day-scale cells are all cells whose value is a daily value or a statistic over daily values without cross-day summation: measurement cells at every level (daily, monthly summary, yearly rollup, comparison, cross-year average), cumulative and expression daily values, and their monthly summary min/avg/max.
- **FR-004**: Month-scale cells are all cells whose value is a monthly sum or a statistic over monthly sums: cumulative and expression month cells in the yearly view, the corresponding cells in the comparison view including its cross-year average, yearly rollups computed over monthly totals, and the monthly view's per-month Total column.
- **FR-005**: Year-scale cells are all cells whose value is a yearly sum: the yearly view's Total column for cumulative and expression rows.
- **FR-006**: The monthly view's Total column, previously never threshold-colored, MUST become colorable via rules' month values.
- **FR-007**: The yearly view's Total column, previously never threshold-colored, MUST become colorable via rules' year values.
- **FR-008**: The closest-threshold-wins selection and its existing tie-break order MUST be computed per cell among the rules defining a threshold for that cell's period, using those period thresholds for distance and tie comparison.
- **FR-009**: Existing configurations (rules with only `value`) MUST keep their current behavior on all day-scale cells unchanged; their coloring of month- and year-scale cells MUST disappear without any configuration change.
- **FR-010**: The threshold editor MUST offer three optional value inputs per rule — day, month, year — localized in English and German; clearing an input removes that period threshold from the rule.
- **FR-011**: Legend behavior MUST remain unchanged: a named rule appears in the legend exactly when it fires on a visible cell in the current render, regardless of which period value fired, shown once per rule.
- **FR-012**: Difference and average-deviation cells in the comparison view MUST remain free of threshold coloring.
- **FR-013**: The existing cell-role restrictions of the min/max-targeting operators MUST continue to apply unchanged for every period.

### Key Entities

- **Aggregation period**: the period of the quantity a cell displays — day, month, or year; sums define the period, statistics inherit the period of the values they summarize.
- **ThresholdRule**: extended by optional `value_month` and `value_year` thresholds beside the now-optional day `value`; operator, name, and colors are shared across the periods.
- **Scoped cell**: every value cell in the monthly, yearly, and comparison views carries exactly one aggregation period per FR-003/004/005; diff cells carry none.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With an unmodified pre-existing configuration, no monthly- or yearly-sum cell shows threshold coloring, and every day-scale cell renders exactly as before the change — 100% agreement in automated view tests.
- **SC-002**: A rule's month value colors exactly the sum cells meeting its condition in the yearly view, the comparison view, and the monthly Total column — 100% automated test pass rate.
- **SC-003**: A rule's year value colors exactly the yearly Total cells meeting its condition and never any other cell — 100% automated test pass rate.
- **SC-004**: For rule lists mixing per-period thresholds, the correct closest rule is selected per cell period across at least 3 distinct value bands per period — verified by automated tests.
- **SC-005**: A user can set a rule's period values entirely through the visual editor, without touching YAML, and the values round-trip through save and reload.
- **SC-006**: All new labels are correct in English and German for every supported label.

## Assumptions

- The period terminology day/month/year matches the aggregation periods already present in the card; no finer or coarser periods are needed.
- Month and year values on measurement rows are permitted but inert, since measurement rows expose no sum cells; no validation error is raised.
- This feature supersedes the spec 007 assumption that "threshold rules apply to all data value cells … colored consistently", and refines spec 013 FR-017 and spec 014 FR-011: threshold application in those views is now gated by the rule's per-period thresholds.
- Percentage figures shown next to comparison diffs are annotations of diff cells and therefore never threshold-colored.
- No migration is needed: rules that only define `value` simply act on day cells only.
- A revision during implementation replaced the earlier per-rule `scope` field with the per-period values model (see Clarifications); the `scope` field is not part of the delivered configuration surface.
