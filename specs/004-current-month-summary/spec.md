# Feature Specification: Current Month Summary and Total Columns

**Feature Branch**: `004-current-month-summary`
**Created**: 2026-05-24
**Status**: Draft
**Input**: User description: "fix: I originally decided that the current incomplete month should not show summary and total. I now revert this decision. current (incomplete) month should also show summary and totals where applicable."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Running Monthly Totals for the Current Month (Priority: P1)

A dashboard user monitors ongoing statistics — e.g., cumulative energy usage, rainfall this month, or average indoor temperature — as the month progresses. Currently the current (incomplete) month shows day-by-day data but no summary or total figures. The user wants to see the running monthly summary and total, computed from the completed days so far, updated each day as new data arrives.

**Why this priority**: Single user story — the entire feature is this one behavioral change. The current suppression of summary/total for the current month is a regression from the user's desired UX.

**Independent Test**: Load the card on any day other than the first of the month. Verify that the current month's summary column shows values for each entity, and that the total column shows a value for cumulative entities — both computed from completed past days only.

**Acceptance Scenarios**:

1. **Given** the current month has multiple completed past days of cumulative entity data, **When** the card renders, **Then** the current month's total column shows the cumulative sum of those completed days.
2. **Given** the current month has multiple completed past days of measurement entity data, **When** the card renders, **Then** the current month's summary column shows the min, avg, and max across those completed days.
3. **Given** it is the first day of the month (no completed past days yet), **When** the card renders, **Then** summary and total cells for the current month are empty — no data is available yet.
4. **Given** a precipitation entity with some zero-sum days in the current month, **When** the card renders, **Then** the current month's summary excludes zero-sum days from avg/min/max, consistent with the existing precipitation rule.
5. **Given** both the current (incomplete) month and a previous (complete) month are visible, **When** comparing their summary/total columns, **Then** both columns use the same visual format — no special styling distinguishes the current month's summary from a completed month's.

---

### Edge Cases

- First day of the month (no completed days): summary and total cells are empty — same as a complete month with no data.
- Single completed day: summary shows the single day's values as min, avg, and max; total shows that day's value.
- Today's cell remains empty (FR-028 unchanged); the summary/total is computed only from strictly completed past days.
- Year-table view: current month's summary/total columns follow the same rules as monthly-table view.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The current (incomplete) calendar month MUST display a summary column computed from all completed past days in that month, using the same computation rules as complete months (measurement: card-computed min/avg/max from daily values; cumulative: card-computed from daily sums).
- **FR-002**: The current (incomplete) calendar month MUST display a total column for cumulative entities (`total_increasing` / `total`), computed from the completed past days' daily sums.
- **FR-003**: Summary and total values for the current month MUST be derived exclusively from completed past days; today's data and any future days MUST NOT contribute to the calculation (consistent with FR-028).
- **FR-004**: All existing monthly summary computation rules MUST apply to the current month without exception: zero-sum day exclusion for `device_class: precipitation` (FR-016), card-computed measurement min/avg/max (FR-010), expression row summaries from daily values (FR-039).
- **FR-005**: When the current month has no completed past days (e.g., first day of the month), summary and total cells for that month MUST be empty, identical to the existing behavior for any month with no available data.

### Key Entities

- **Current month**: The calendar month containing today, as determined by the HA server's configured timezone (`hass.config.time_zone`).
- **Completed past day**: Any calendar day strictly before today in HA server time — the set of days that contribute to summary/total calculations.
- **MonthlySummary**: The computed aggregate (min, mean, max, total) for one entity over one calendar month, now computed for the current month from available completed days.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On any day after the first of the month, a user can read a running monthly summary (min/avg/max) and total directly from the current month's table without any navigation or configuration change.
- **SC-002**: All entity types (measurement, cumulative, expression) display their applicable summary/total for the current month — 100% parity with complete-month behavior.
- **SC-003**: On the first day of the month, summary and total cells for the current month are empty — 0 regression from the "no data yet" case.
- **SC-004**: 100% automated test pass rate covering current-month summary for measurement, cumulative, and precipitation entity types.

## Assumptions

- "Current month" is determined by the HA server timezone, consistent with the existing FR-028 definition of "today."
- No special visual indicator (e.g., asterisk, dimmed styling) is added to current-month summary/total cells to mark them as partial — the incomplete day cells already signal that the month is in progress.
- The monthly summary data for the current month is sourced the same way as for complete months: card-computed from daily `DailyValue` entries already fetched for the day cells.
- This change affects both the `monthly-table` component (single-month view) and the `year-table` component (full-year view).
- Expression rows (FR-039) are included — their monthly summary/total follows the same rules as cumulative entities.
