# Feature Specification: Day-of-Month Header with Sunday Highlighting

**Feature Branch**: `006-day-header-sunday`  
**Created**: 2026-05-25  
**Status**: Draft  
**Input**: User description: "re-specify day-of-month header: each month should have its day-of-months in the month-header row, and sundays should be highlighted by using bold font."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Day Numbers in Month Header (Priority: P1)

A user viewing the monthly statistics table sees the day-of-month numbers (1–28/29/30/31) displayed in the header row of each month, giving them an immediate reference for which column corresponds to which calendar day.

**Why this priority**: Core layout requirement — without day numbers in the header, users cannot associate data values with calendar dates. All other header behavior depends on this.

**Independent Test**: Can be fully tested by rendering any month's table and verifying that each column header shows the correct day number for that month.

**Acceptance Scenarios**:

1. **Given** a month with 31 days is displayed, **When** the user views the table header row, **Then** the header contains exactly 31 day-number cells, labeled 1 through 31.
2. **Given** a month with 28 days (February non-leap year) is displayed, **When** the user views the table header row, **Then** the header contains exactly 28 day-number cells, labeled 1 through 28.
3. **Given** a month with 29 days (February leap year) is displayed, **When** the user views the table header row, **Then** the header contains exactly 29 day-number cells.
4. **Given** a month with 30 days is displayed, **When** the user views the table header row, **Then** the header contains exactly 30 day-number cells.

---

### User Story 2 - Sunday Columns Visually Distinguished (Priority: P2)

A user viewing the monthly statistics table can instantly identify which columns correspond to Sundays because those day-number headers are rendered in bold font, distinguishing weekend structure at a glance without requiring any configuration.

**Why this priority**: Adds meaningful calendar orientation. Users can quickly locate weekend data. Depends on P1 (day numbers must exist before they can be styled).

**Independent Test**: Can be fully tested by rendering a known month (e.g., January 2026, where Sundays fall on days 4, 11, 18, 25) and verifying that exactly those day-number headers are bold while all others are not.

**Acceptance Scenarios**:

1. **Given** a month where day 7 is a Sunday, **When** the user views the header row, **Then** the cell for day 7 is displayed in bold font and all other day cells are not bold.
2. **Given** two consecutive months are displayed, **When** the user views both header rows, **Then** Sunday columns are correctly identified for each month independently (Sundays fall on different day numbers across months).
3. **Given** February of a non-leap year (28 days), **When** the user views the header row, **Then** all Sundays within that 28-day range are bold and no non-Sundays are bold.

---

### Edge Cases

- What day-of-week calculation is used when the current locale differs? (Assumption: Sunday is always day 7 of the week regardless of locale week-start setting.)
- How does the header render for the current (partial) month where future days exist but have no data? (Day numbers still appear in the header; data cells for future days are empty.)
- What happens if the card is displayed in a year/month combination that doesn't match the system calendar? (Calendar calculations use the displayed month/year, not the current date.)

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The month table header row MUST display the day-of-month numbers (1 through N, where N is the number of days in that month) as individual column labels.
- **FR-002**: The day-of-month numbers in the header MUST be derived from the actual calendar for the displayed month and year (accounting for varying month lengths and leap years).
- **FR-003**: Day-of-month header cells that correspond to a Sunday MUST be rendered in bold font.
- **FR-004**: Day-of-month header cells that do not correspond to a Sunday MUST NOT be rendered in bold font.
- **FR-005**: The Sunday determination MUST be based on the calendar day-of-week for the specific month and year being displayed, computed independently for each month.
- **FR-006**: The header row layout MUST remain visually consistent (dense, no excessive whitespace) with the existing table design when day numbers and bold styling are applied.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: For any displayed month, every day-number header cell shows the correct day number (1–N) matching the calendar month length — zero mismatches.
- **SC-002**: For any displayed month in any year, all Sunday columns and only Sunday columns have bold header cells — zero false positives and false negatives across all 12 months.
- **SC-003**: The bold highlighting requires no user configuration — it is always active by default.
- **SC-004**: Header rendering is visually indistinguishable from the current layout except for the addition of day numbers and bold Sunday markers — no layout regressions.

## Assumptions

- Sunday is always considered the day to highlight, regardless of locale-specific week-start conventions (e.g., Monday-first locales in Germany still bold Sundays, not Mondays).
- The existing label/entity rows below the header are not affected by this change; only the header row is modified.
- The "Summary" and "Total" columns in the header are unaffected by this change.
- Day numbers in the header are numeric only (no weekday abbreviations or full names).
- No configuration option is needed to disable Sunday highlighting — it is always on.
