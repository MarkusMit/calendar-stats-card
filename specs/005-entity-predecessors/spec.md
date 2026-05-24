# Feature Specification: Entity Predecessor Configuration

**Feature Branch**: `005-entity-predecessors`
**Created**: 2026-05-25
**Status**: Draft
**Input**: User description: "I want be able to configure 'predecessors' of an entity, in case a device or its HA implementation was replaced. The main configured entity should the current one. Not about best approach, when to use predecessors. check them when main entity doesn't contain data, or specify concrete date of exchange."

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Date-Based Predecessor (Priority: P1)

A user replaced a temperature sensor on 2024-11-01. The old sensor is `sensor.temp_old`, the new one is `sensor.temp_new`. They configure `sensor.temp_old` as a predecessor with `replaced_on: 2024-11-01`. The card now shows uninterrupted temperature data: old sensor data for October and earlier, new sensor data from November onwards.

**Why this priority**: Core use case. Date-based predecessor produces deterministic, continuous historical data. Most users replacing hardware know the date.

**Independent Test**: Configure one entity with one predecessor and a `replaced_on` date. Verify data from before the date comes from the predecessor, data from the date onwards comes from the main entity.

**Acceptance Scenarios**:

1. **Given** an entity row with a predecessor configured with `replaced_on: 2024-11-01`, **When** rendering daily stats for October 2024, **Then** predecessor entity data is shown
2. **Given** an entity row with a predecessor configured with `replaced_on: 2024-11-01`, **When** rendering daily stats for November 2024, **Then** main entity data is shown
3. **Given** both main and predecessor have data on 2024-11-01, **When** rendering that day, **Then** main entity data is used (main wins on exchange date)
4. **Given** main entity has no data on 2024-11-05 (after exchange), **When** rendering that day, **Then** cell is empty (predecessor not consulted after exchange date)

---

### User Story 2 — Fallback Predecessor (Priority: P2)

A user knows their power meter was replaced but doesn't know the exact date. They configure the old entity as a predecessor without a date. The card shows data from the old entity wherever the new entity has no data.

**Why this priority**: Covers cases where the exchange date is unknown. Less deterministic but still useful for continuity.

**Independent Test**: Configure one entity with one predecessor and no `replaced_on` date. Verify predecessor data fills in days where main entity has no data.

**Acceptance Scenarios**:

1. **Given** a predecessor with no `replaced_on` date, **When** main entity has no data for a given day, **Then** predecessor data is shown for that day
2. **Given** a predecessor with no `replaced_on` date, **When** both main and predecessor have data for the same day, **Then** main entity data is used
3. **Given** a predecessor with no `replaced_on` date and predecessor also has no data for a day, **Then** the cell is empty

---

### User Story 3 — Chained Predecessors (Priority: P3)

A user has replaced their rain gauge twice. Sensor A (oldest) → Sensor B → Sensor C (current). They configure all three with corresponding dates. The card shows continuous precipitation data spanning all three devices.

**Why this priority**: Handles multi-replacement history. Less common but important for long-running installations.

**Independent Test**: Configure one entity with two predecessors, each with a `replaced_on` date. Verify each predecessor's data appears in its correct date range.

**Acceptance Scenarios**:

1. **Given** main entity with two predecessors (P1 `replaced_on: 2024-06-01`, P2 `replaced_on: 2023-01-01`), **When** rendering May 2023, **Then** P2 data is shown
2. **Given** same config, **When** rendering July 2024, **Then** main entity data is shown
3. **Given** same config, **When** rendering January 2024, **Then** P1 data is shown
4. **Given** a predecessor in the chain has no data for a day within its range, **Then** that day's cell is empty (no further fallback to next predecessor unless it is also in scope)

---

### Edge Cases

- What if a predecessor entity no longer exists in HA? → Treat as having no data; render empty cell
- What if multiple predecessors have the same `replaced_on` date? → Undefined/invalid config; first one in list wins
- What if `replaced_on` is in the future? → Valid; predecessor covers past dates before that future date
- What if a predecessor is itself misconfigured (wrong entity ID)? → Treat as no data; no error shown
- What if predecessor has different `state_class` or unit than main entity? → Predecessor skipped (treated as no data); warning logged to browser console once per page load

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST support an optional `predecessors` list on entity rows (`EntityRowConfig`); expression rows do not support predecessors
- **FR-002**: Each predecessor MUST have an `entity` field (entity ID) and an optional `replaced_on` date field
- **FR-003**: When `replaced_on` is specified, predecessor data MUST be used for days **strictly before** that date; main entity data MUST be used from that date onwards
- **FR-004**: When `replaced_on` is not specified, predecessor data MUST be used only for days where the main entity has no data
- **FR-005**: When multiple predecessors are configured, they MUST be evaluated by their `replaced_on` dates in ascending order (oldest first); predecessors without dates are treated as the oldest and ordered by their position in the config list
- **FR-006**: For date-based predecessors: if the predecessor in scope has no data for a day, the cell is empty. For dateless (fallback) predecessors: if multiple dateless predecessors exist, each is tried in config list order and the first one that has data for that day is used; if none have data, the cell is empty
- **FR-007**: The display output for predecessor-sourced data MUST be visually identical to main-entity data — no visual distinction
- **FR-008**: Unavailable or missing predecessor entities MUST be treated as having no data (graceful degradation, no error state)
- **FR-009**: The feature MUST work for both `measurement` and `total_increasing`/`increasing` entity types
- **FR-010**: Entities with no `predecessors` configured MUST behave identically to current behavior
- **FR-011**: Each predecessor MUST have the same `state_class` and `unit_of_measurement` (from HA metadata) as the main entity; configured `unit` display overrides are ignored for this check; mismatched predecessors MUST be skipped (treated as having no data)
- **FR-012**: When a predecessor is skipped due to incompatible `state_class` or unit, the system MUST log a warning to the browser console — at most once per page load (or first access) per offending predecessor
- **FR-013**: The monthly summary (min/avg/max) MUST be computed from the merged set of daily values — including both main entity days and predecessor days — not from the main entity's native monthly statistics
- **FR-014**: Partial coverage detection (the `*` indicator) MUST apply to predecessor-sourced days using the same logic as main entity days; a predecessor day with incomplete hourly data is marked partial

### Key Entities

- **EntityRowConfig**: Existing entity row configuration, extended with an optional `predecessors` list
- **PredecessorConfig**: A predecessor definition — entity ID + optional `replaced_on` date
- **Data resolution**: The logic that selects which entity's data to use for each day, given the predecessor chain and dates

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can view continuous daily statistics across a device replacement with no data gaps at the boundary date
- **SC-002**: When both main and predecessor have data for the same day (fallback mode), only the main entity's value is displayed — predecessor data is never mixed in
- **SC-003**: At least three chained predecessors work correctly, each covering their designated date range
- **SC-004**: A card with no predecessors configured produces output identical to the current release
- **SC-005**: An invalid or missing predecessor entity ID causes no error state — affected days render as empty cells
- **SC-006**: A predecessor with incompatible `state_class` or unit produces exactly one browser console warning per page load and its data is not shown
- **SC-007**: The monthly summary (min/avg/max) for a month where some days come from predecessors reflects all displayed daily values, not just the main entity's days

## Assumptions

- Predecessors with mismatched `state_class` or unit are silently skipped with a console warning; no other error handling is needed
- No visual indicator is shown when predecessor data is being displayed — transparency is intentional
- Predecessor configuration is per entity row, not shared/global
- Exchange date precision is day-level; no time-of-day granularity
- Predecessor entities must already have statistics recorded in HA's recorder; this feature does not import or migrate data
- The feature does not provide guidance on when to use predecessors — that is the user's decision
- Expression rows (`ExpressionRowConfig`) do not support `predecessors`; each constituent entity row handles its own predecessor chain, and expressions automatically use the merged values

## Clarifications

### Session 2026-05-25

- Q: Are expression rows in scope for predecessor configuration? → A: Out of scope — expression rows cannot have predecessors
- Q: Which unit is used for predecessor compatibility check (FR-011) — HA metadata or configured override? → A: HA metadata `unit_of_measurement` for both main and predecessor; configured `unit` override is display-only and ignored
- Q: Monthly summary with mixed predecessor data — merged from all daily values or main entity native stats only? → A: Merged — monthly summary computed from all daily values (main + predecessor combined)

### Session 2026-05-25 (continued)

- Q: Multiple dateless predecessors — if 2+ have no `replaced_on` date and main has no data, which is used? → A: First in config list order that has data for that day; if none have data, cell is empty
- Q: Partial coverage (`*`) indicator — apply to predecessor-sourced days? → A: Yes — same logic as main entity days; data quality indicator is source-agnostic
