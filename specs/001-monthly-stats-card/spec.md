# Feature Specification: Monthly Stats Card

**Feature Branch**: `001-monthly-stats-card`
**Created**: 2026-05-19
**Status**: Draft
**Input**: User description: "New Home Assistant app, which Displays HA entity statistics in dense monthly tables. Entities are user-configured with optional label overrides. One page shows all past months of a year; future months are hidden."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Annual Entity Statistics (Priority: P1)

A home automation user opens a dedicated HA dashboard view (configured as a full-width panel) and sees the Tabularizer card filling the entire screen. The card defaults to the current year, displaying dense monthly tables for all completed months plus the current (in-progress) month. The user can see the entire year's data in one scrollable view.

**Why this priority**: Core value proposition — if this doesn't work, the card serves no purpose.

**Independent Test**: Configure card with one entity, open dashboard, verify monthly tables appear for all past months of the current year with correct daily values.

**Acceptance Scenarios**:

1. **Given** the current date is mid-year, **When** the card loads, **Then** monthly tables are visible for all months from January through the current month on a single page.
2. **Given** future months exist in the calendar year, **When** viewing the current year, **Then** those months are not shown at all.
3. **Given** it is January 1st, **When** the card loads, **Then** the previous year is shown by default (no completed data exists in the new year).
4. **Given** it is January 2nd, **When** the card loads, **Then** the current year is shown with only the January table, and only day 1 has data (day 2 is today — empty; day 3 onward is future — empty).

---

### User Story 2 - View Dense Daily Statistics per Entity (Priority: P1)

A user examines a monthly table and sees each configured entity displayed as a row. Columns represent each day of the month, followed by a summary. Each entity row renders according to its HA state_class — combined min/avg/max for `measurement` entities, or a daily sum for `total_increasing` / `total` entities. The layout is compact with no wasted whitespace.

**Why this priority**: The core display mechanism — data must render correctly per entity type within the dense layout.

**Independent Test**: Configure one temperature entity (`state_class: measurement`) and one precipitation entity (`state_class: total_increasing`). Verify temperature shows combined min/avg/max per day cell in a single row; precipitation shows a single daily sum. Verify summary column is correct.

**Acceptance Scenarios**:

1. **Given** a temperature entity (`state_class: measurement`) is configured, **When** viewing a monthly table, **Then** each day cell shows a combined min/avg/max value in a single row (no separate rows for min and max).
2. **Given** a precipitation entity (`state_class: total_increasing`) is configured, **When** viewing a monthly table, **Then** each day cell shows a single daily sum (accumulated total for that day).
3. **Given** a precipitation entity (`state_class: total_increasing`) with many zero-sum days, **When** viewing the summary column, **Then** avg/min/max calculations exclude days where the daily sum is zero; the total column shows the HA-authoritative monthly cumulative sum.
4. **Given** an electricity meter entity (`state_class: total_increasing` or `total`), **When** viewing a monthly table, **Then** each day cell shows the daily sum (accumulated change for that calendar day).
5. **Given** any entity row, **When** visible, **Then** the label column shows the configured label (or HA friendly name if no override) plus the unit of measurement.

---

### User Story 3 - Navigate Between Years (Priority: P2)

A user wants to review statistics from a previous year. The card displays a year navigator — a previous-year arrow button, the current year label, and a next-year arrow button (`‹ 2025 ›`) — at the top of the card. The user taps the left arrow to step back one year at a time. For fully past years, all 12 months are shown; for the earliest data year, only months from the first recorded data point onward are shown. When returning to the current year, months from January through the current month are shown (current month may have empty cells if no completed days exist yet).

**Why this priority**: Enables historical review without requiring a new card instance per year. Core viewing of the current year works without this.

**Independent Test**: With HA history spanning at least 2 years, use year navigation to switch to the previous year and verify all 12 months appear with correct historical data.

**Acceptance Scenarios**:

1. **Given** the card is on the current year and the previous year is not the earliest data year, **When** the user navigates to the previous year, **Then** all 12 monthly tables for that year are shown.
2. **Given** the user is viewing a previous year, **When** the user navigates forward to the current year, **Then** only months from January through the current month are shown.
3. **Given** the user is viewing the current year, **When** the user attempts to navigate forward, **Then** navigation beyond the current year is not possible.
4. **Given** the card loads initially on any day other than January 1st, **When** no year has been selected, **Then** the current year is displayed by default.
5. **Given** the card loads on January 1st, **When** no year has been selected, **Then** the previous year is displayed by default.

---

### User Story 4 - Configure Entities and Label Overrides (Priority: P2)

A user configures the card to track specific HA entities — for example, outdoor temperature, daily rainfall, and electricity usage — and assigns friendly display names. The user edits the card configuration, provides entity IDs, and optionally sets display labels per entity.

**Why this priority**: Without configuration, the card shows nothing. This story enables the setup that P1 stories depend on.

**Independent Test**: Edit card YAML configuration, add 3 entities with label overrides, save, verify card renders with the overridden labels in all monthly tables.

**Acceptance Scenarios**:

1. **Given** a user adds an entity ID to the card configuration, **When** the card renders, **Then** that entity appears as a row in every monthly table.
2. **Given** a user sets a label override for an entity, **When** the card renders, **Then** the overridden label is shown in the label column instead of the HA-provided friendly name.
3. **Given** no label override is set for an entity, **When** the card renders, **Then** the entity's HA-provided friendly name is used as the label.

---

### User Story 5 - Localized Display (Priority: P3)

A user with a German (Austria) HA installation sees month names and UI text in German. An English-language user sees English text. No manual locale configuration in the card is needed.

**Why this priority**: Important for usability in supported locales but does not affect core data correctness.

**Independent Test**: Set HA language to `de-AT`, load card, verify month names and column headers appear in German. Repeat with `en`.

**Acceptance Scenarios**:

1. **Given** HA is configured for `en` locale, **When** the card renders, **Then** all text labels, month names, and headers appear in English.
2. **Given** HA is configured for `de-AT` locale, **When** the card renders, **Then** all text labels, month names, and headers appear in Austrian German.

---

### Edge Cases

- What happens when an entity has no recorded data for a specific day? → Cell is shown as empty (dash or blank).
- What happens when a cumulative entity counter resets or rolls over during a day? → Negative daily difference is treated as 0 (anomalous reset, not negative consumption).
- What happens on January 1st? → The card defaults to the previous year (all 12 months, complete data). The current year is still reachable via the right arrow but shows only an empty January table.
- What happens when no entities are configured? → Card displays a localised placeholder message prompting the user to add entities via card configuration; no monthly tables are rendered.
- What happens when a configured entity no longer exists in HA? → Row is still shown with entity ID and an error or unavailable indicator; other entities are unaffected.
- What happens when a configured entity has no HA long-term statistics enabled? → The entity row is shown with a warning indicator on the label cell; all day cells are empty; other entities are unaffected.
- What happens when a completed day has partial hourly data for a range entity? → Cell shows available min/avg/max with a coverage indicator.
- What happens when a cumulative entity has a gap at the start or end of a day? → Daily diff is unreliable; cell shows a best-effort value with a coverage indicator.
- What happens when the monthly total does not equal the sum of the visible daily diff cells? → This is expected; monthly total is HA's authoritative monthly-period cumulative sum and takes precedence. No reconciliation is performed.
- What happens while statistics data is loading? → A loading spinner is shown over the card; once loaded, tables render. On partial failure, affected cells display `—`; rows/months with successful data remain fully visible.
- What happens with months that have different day counts (28/29/30/31)? → Column count matches the actual number of days in that month.
- What happens when today is the first day of a new month? → Previous month is now complete and remains shown; current month appears with only day 1.
- What happens when navigating to the earliest year with data? → Only months from the first month with recorded data onward are shown; earlier months in that year are hidden.
- What happens if the user tries to navigate before the earliest data year? → The left arrow is disabled; navigation is not possible.

## Clarifications

### Session 2026-05-19

- Q: What UI control type should year navigation use? → A: Arrow buttons flanking year label (`‹ YYYY ›`); left steps back, right steps forward (disabled on current year).
- Q: What does the card show during data load and on statistics fetch failure? → A: Spinner overlay while loading; on failure, affected cells show `—` inline; unaffected entities/months remain visible.
- Q: How far back can year navigation go? → A: Navigation stops at the earliest year any configured entity has recorded data; months before the first data point in that year are hidden (same rule as future months in the current year).
- Q: How should wide monthly tables (31 day columns) handle overflow? → A: Each table scrolls horizontally; label column is sticky (always visible while scrolling).

### Session 2026-05-20

- Q: Should scalar measurement entities (e.g., precipitation) have a monthly total column? → A: Yes — a monthly total column showing the sum of all non-zero daily values for the month.
- Q: Is the component a Lovelace card or a custom HA panel/dashboard? → A: A Lovelace custom card (`custom:tabularizer-card`) intended for full-width deployment in a Lovelace panel-type view; users set the view `type: panel` so the card fills the entire screen. Standard card architecture applies; no custom sidebar panel registration required.
- Q: How does vertical overflow work when all 12 monthly tables are shown? → A: The card renders at full content height; vertical scrolling is provided by the native HA dashboard/browser scroll. No internal vertical scrollbar within the card itself. Horizontal scrolling per table (FR-026) is independent and coexists with page-level vertical scroll.

### Session 2026-05-19 (remaining gaps)

- Q: What does the card show when no entities are configured? → A: A localised placeholder message prompting the user to add entities via the card configuration; no tables are rendered.
- Q: What year does the card default to on January 1st? → A: The previous year — on January 1st the current year has no completed data, so the card defaults to the previous (completed) year instead.

### Session 2026-05-19 (gaps in data)

- Q: What does today's cell show? → A: Empty — only fully completed past days display values; today and future days are always empty.
- Q: What happens when a configured entity has no HA long-term statistics? → A: The entity row is shown with a warning indicator on the label cell; all day cells are empty; other entities are unaffected.
- Q: How should completed days with partial hourly coverage be rendered? → A: Range entities (e.g., temperature): show a cell-level coverage indicator when the day has fewer than 24 hours of data (incomplete min/avg/max). Cumulative entities: show a cell-level indicator when gaps fall at the start or end of the day (daily diff is unreliable). Scalar entities: render silently without indicator.
- Q: Should the monthly summary and total columns be computed from daily cells or sourced from HA's native monthly-period statistics? → A: Use HA's native monthly-period statistics directly; monthly columns are authoritative and independent of the daily cells (may not equal the arithmetic sum of visible daily values).

## Requirements *(mandatory)*

### Functional Requirements

**Year navigation**

- **FR-001**: Card MUST default to displaying the current year on initial load, with one exception: when today is January 1st, the card MUST default to the previous year, since the current year contains no completed data.
- **FR-002**: Card MUST provide a year navigator — a left arrow button, a year label, and a right arrow button (`‹ YYYY ›`) — allowing users to step one year at a time.
- **FR-003**: The right arrow MUST be disabled when viewing the current year; navigation beyond the current year is not permitted.
- **FR-004**: The left arrow MUST be disabled when viewing the earliest year in which any configured entity has recorded statistics; navigation before that year is not permitted.

**Visible months**

- **FR-005**: When viewing the current year, the card MUST display one monthly table for each month from January through the current month only; future months MUST NOT be shown.
- **FR-006**: When viewing a fully past year (not the earliest data year), the card MUST display all 12 monthly tables.
- **FR-007**: When viewing the earliest year that has data, the card MUST display only months from the first month with any recorded data onward; months before that MUST NOT be shown.

**Monthly table structure**

- **FR-008**: Each monthly table MUST include one column per calendar day of that month (day 1 through last day of the month).
- **FR-009**: Each monthly table MUST include a label column as the first column, showing the entity's display label and unit of measurement.
- **FR-010**: Each monthly table MUST include a summary column showing monthly min, avg, and max. For `measurement` entities, values MUST be sourced from HA's native monthly-period statistics (authoritative). For cumulative (`total_increasing` / `total`) entities, values MUST be computed by the card from available daily sums with zero-exclusion applied (see FR-016), since HA native monthly mean includes zero-sum days.
- **FR-011**: Each monthly table MUST include a total column for cumulative (`total_increasing` / `total`) entities, sourced from HA's native monthly-period cumulative sum; this value is authoritative and may not equal the arithmetic sum of the visible daily sum cells.
- **FR-012**: Each configured entity MUST appear as exactly one row in every monthly table.

**Entity-type rendering**

- **FR-014**: For `measurement` state_class entities (e.g., temperature), each day cell MUST show combined min/avg/max within one row; separate min and max rows are not permitted.
- **FR-015**: For cumulative (`total_increasing` / `total`) entities (e.g., precipitation gauge, electricity meter), each day cell MUST show the daily sum (the accumulated change for that calendar day, as provided by HA's per-day statistics).
- **FR-016**: For cumulative (`total_increasing` / `total`) entities, the monthly summary min/avg/max MUST exclude days where the daily sum is zero (e.g., no-rain days excluded from precipitation average). The card MUST compute this corrected summary from available daily values, since HA native monthly statistics do not apply this exclusion.
- **FR-017**: Days without recorded data for an entity MUST be shown as empty cells with no fabricated values.
- **FR-028**: Today's cell and all future days within the current month MUST always be shown as empty, regardless of any partial statistics that may exist for the current day.
- **FR-029**: When a configured entity has no HA long-term statistics, its label cell MUST display a warning indicator; its day cells MUST be empty; other entity rows MUST be unaffected.
- **FR-030**: For `measurement` state_class entities, a day cell with fewer than 24 hours of recorded statistics MUST display a coverage indicator alongside the min/avg/max value to signal that the figures may be incomplete.
- **FR-031**: For cumulative entities, a day cell MUST display a coverage indicator when recorded statistics are missing at the start or end of the calendar day, because the daily difference calculation is unreliable in that case.
- **FR-032**: For cumulative (`total_increasing` / `total`) entities, gaps in recorded statistics that do not fall at the start or end of the calendar day MUST be rendered silently; no coverage indicator is shown (coverage indicators only apply to day-boundary gaps per FR-031).

**Loading and error states**

- **FR-018**: While statistics data is being fetched, the card MUST display a loading indicator; the layout MUST remain visible and not be replaced by a full error screen.
- **FR-019**: When statistics for a specific entity or date range cannot be loaded, the affected cells MUST display `—`; successfully loaded data elsewhere MUST remain unaffected.

**Configuration**

- **FR-020**: Card MUST allow users to configure a list of HA entity IDs to display.
- **FR-033**: When no entities are configured, the card MUST display a localised placeholder message instructing the user to add at least one entity; no monthly tables MUST be rendered.
- **FR-021**: Card MUST allow an optional display label override per configured entity.
- **FR-022**: When no label override is provided for an entity, the entity's HA-provided friendly name MUST be used as the label.

**Layout and localisation**

- **FR-023**: Card layout MUST be dense — no excessive whitespace; maximum data density per screen area.
- **FR-035**: The card MUST render at full content height with no internal vertical scrollbar; vertical scrolling is delegated to the native HA dashboard page scroll.
- **FR-026**: Each monthly table MUST support horizontal scrolling to accommodate all day columns (up to 31).
- **FR-027**: The label column of each monthly table MUST remain sticky (always visible) while the user scrolls the day columns horizontally.
- **FR-024**: Card MUST support English (`en`) and Austrian German (`de-AT`) for all displayed text.
- **FR-025**: The active locale MUST be determined automatically from the HA instance's language setting; no per-card locale configuration is required.

### Key Entities

- **EntityConfig**: A user-specified HA entity ID with an optional label override; the card resolves the entity's measurement type from HA metadata.
- **MonthlyTable**: The data grid for one calendar month — rows are entity configs, columns are days plus label/summary/total columns.
- **DailyValue**: The statistic(s) recorded for one entity on one calendar day: min/avg/max triple for `measurement` entities; daily sum (accumulated change) for `total_increasing` / `total` entities.
- **MonthlySummary**: Monthly-period statistics for one entity. `measurement` entities: min, avg, max sourced from HA native monthly statistics (authoritative). `total_increasing` / `total` entities: min, avg, max computed by the card from daily sums with zero-exclusion applied (zero-sum days excluded), plus a total sourced from HA native monthly cumulative sum.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: On initial load (any day except January 1st), all months from January through the current month of the current year are visible on a single card. On January 1st, the previous year's 12 monthly tables are shown by default.
- **SC-002**: Users can navigate to any previous year that has data; fully past years show all 12 monthly tables; the earliest data year shows only months from the first recorded data point onward.
- **SC-003**: No future month is ever rendered when viewing the current year, regardless of the current date.
- **SC-004**: Monthly summary and total statistics are correct: cumulative (`total_increasing` / `total`) entities exclude zero-sum days from avg/min/max in the monthly summary; `measurement` entities include all recorded days; cumulative monthly totals match HA's authoritative monthly figures.
- **SC-005**: A user can configure 3–10 entities with optional label overrides in under 5 minutes using the standard HA card configuration interface.
- **SC-006**: The card renders correctly in both English and Austrian German — all text elements are translated with no untranslated strings visible.
- **SC-007**: All monthly tables load and render within 3 seconds per year-view for configurations of up to 10 entities on a standard HA installation.
- **SC-008**: Each monthly table scrolls horizontally to accommodate up to 31 day columns; the entity label column remains visible (sticky) at all times while scrolling so users always know which row they are reading.

## Assumptions

- The card defaults to the current year; backward navigation is bounded by the earliest year any configured entity has recorded data (no navigation into years with no data).
- In the earliest data year, only months from the first month with recorded data onward are shown (mirrors the current-year future-month rule).
- In fully past years (not earliest, not current), all 12 monthly tables are shown.
- The current (in-progress) month IS shown; only fully completed past days (strictly before today) display data; today's cell and all future days within the current month appear as empty cells.
- Entity display behavior is determined automatically from HA `state_class` metadata (`measurement`, `total_increasing`, or `total`) — no explicit type configuration is required from the user.
- All `total_increasing` / `total` entities apply the same zero-exclusion rule for monthly summary min/avg/max. Entities requiring different aggregation behavior are out of scope.
- Card configuration is performed via the standard HA Lovelace YAML card editor; a dedicated graphical configuration UI is not in scope for this feature.
- The card targets HA version 2026.5.0 and later; compatibility with older versions is not guaranteed.
- The card is designed for full-width deployment: the recommended configuration is a dedicated Lovelace view with `type: panel` so the card fills the entire screen. The card remains a standard Lovelace custom card element (`custom:tabularizer-card`); no custom sidebar panel registration is required. Non-panel views are not explicitly unsupported but the dense multi-table layout is optimised for full screen width.
- The card renders at full content height (no internal vertical scrollbar). With 12 monthly tables, the page will be tall; vertical scrolling is handled by the HA dashboard's native browser scroll. Per-table horizontal scrolling (FR-026) is independent and coexists with page-level vertical scroll.
