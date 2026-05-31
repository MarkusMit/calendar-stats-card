# Feature Specification: Default Entity Precision of 1

**Feature Branch**: `012-default-entity-precision`
**Created**: 2026-05-31
**Status**: Draft
**Input**: User description: "Set default precision of entities to 1."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Clean default decimals (Priority: P1)

A user adds entities (or expression rows) to the card without setting a per-row precision.
Numeric values render with a single decimal place by default, keeping the dense monthly tables readable without manual configuration.

**Why this priority**: This is the entire feature.
Without it, users see values at native precision (many decimals) or must set precision on every row by hand.

**Independent Test**: Configure the card with at least one row and no `precision` set.
Verify every numeric cell shows exactly one decimal place.

**Acceptance Scenarios**:

1. **Given** a row with no `precision` configured, **When** a daily value of `1.234` is displayed, **Then** the cell shows `1.2`.
2. **Given** a row with no `precision` configured, **When** the monthly summary min/avg/max are displayed, **Then** each shows one decimal place.
3. **Given** a row with no `precision` configured, **When** a total or daily-diff value is displayed, **Then** it shows one decimal place.

---

### User Story 2 - Per-row override preserved (Priority: P2)

A user who needs more or fewer decimals for a specific row sets `precision` on that row, and that value wins over the new default.

**Why this priority**: The new default must not remove existing per-row control.

**Independent Test**: Configure one row with `precision: 2` and one with none.
Verify the first shows two decimals and the second shows one.

**Acceptance Scenarios**:

1. **Given** a row with `precision: 2`, **When** a value of `1.234` is displayed, **Then** the cell shows `1.23`.
2. **Given** a row with `precision: 0`, **When** a value of `1.6` is displayed, **Then** the cell shows `2`.

---

### Edge Cases

- A whole-number value (e.g. `5`) with the default precision renders as `5.0` — expected, because the default fixes one decimal place.
- A per-row `precision` of `0` still produces zero decimals; the new default only applies when `precision` is unset.
- Existing saved configurations that never set `precision` adopt the new default automatically; no migration is required.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST display numeric values rounded to 1 decimal place when a row has no `precision` configured.
- **FR-002**: A per-row `precision` value MUST take precedence over the default.
- **FR-003**: The default precision MUST apply uniformly to all numeric outputs: daily values, monthly summary (min/avg/max), totals, and daily diffs.
- **FR-004**: The default MUST apply to both entity rows and expression rows, which both expose a `precision` option.
- **FR-005**: Rounding behavior for the default MUST be consistent with rounding already used for an explicitly configured precision.

### Key Entities *(include if feature involves data)*

- **Row configuration (entity row / expression row)**: A user-configured table row carrying an optional `precision` attribute. When `precision` is absent, the new default of 1 applies.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: With no `precision` configured, a value of `1.23` renders as `1.2`.
- **SC-002**: With `precision: 2` configured, a value of `1.23` renders as `1.23` (override unaffected).
- **SC-003**: 100% of numeric cells use one decimal place when no row in the card sets `precision`.

## Assumptions

- "Precision = 1" means one decimal place (one fractional digit), matching the existing `precision` field which counts decimal places.
- The change affects the default only; the per-row `precision` option and its accepted range are unchanged.
- The current default renders values at native precision (no fixed decimal count); this feature replaces that default with a fixed single decimal place.
