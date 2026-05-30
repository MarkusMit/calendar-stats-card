# Feature Specification: Replace Hardcoded Precipitation Zero-Exclusion With `show_zero`

**Feature Branch**: `010-precip-show-zero`
**Created**: 2026-05-30
**Status**: Draft
**Input**: User description: "replace hardcoded exclusions of zero values from monthly summary stats for precipitation values. use `show_zero` config option instead. update readme accordingly"

## Clarifications

### Session 2026-05-30

- Q: Should `docs/README.md` include a migration / upgrade note for existing precipitation users whose summary stats will change? → A: No.
  The card has not been publicly released yet, so there are no upgrade users to warn.
  No migration note is required in the README and no in-card upgrade warning is in scope.
- Q: For `total_increasing` entities where a counter-reset is treated as `0` (spec 001 FR-015), does `show_zero: false` exclude those reset-induced zeros from the monthly summary too? → A: Yes — uniform treatment.
  Reset-induced and natural zeros are indistinguishable in the daily-values pipeline; both are excluded together when `show_zero: false`.
  No provenance tracking is added (YAGNI per Constitution V).
- Q: Does the editor toggle label (`editor.show_zero`) need to be reworded for the expanded dual effect? → A: Yes — reword to "Include zero-value days".
  Applies to both `en.json` and `de.json`; German translation derived from the new English source by the implementation.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Precipitation user controls zero-rain handling via config (Priority: P1)

A user with a daily-rainfall entity configures whether no-rain days count in the monthly summary statistics.
Today the card silently excludes zero-rain days for any `device_class: precipitation` entity — the user has no way to override this.
After this change, the user explicitly sets `show_zero: false` on the entity to exclude zero days from both the day cells and the monthly summary min/avg/max; without that option the summary includes every recorded day, including no-rain days.

**Why this priority**: This is the core behaviour change.
The hardcoded device-class branch is removed in this story; everything else follows from it.

**Independent Test**: Configure a precipitation entity with `show_zero: false`, verify the monthly summary min/avg/max ignore zero-rain days.
Configure the same entity with `show_zero: true` (or omitted), verify the same statistics include zero-rain days.

**Acceptance Scenarios**:

1. **Given** a `device_class: precipitation` entity with `show_zero: false`, **When** the card renders a monthly summary, **Then** zero-sum days are excluded from min, avg, and max.
2. **Given** a `device_class: precipitation` entity with `show_zero: true` (or omitted), **When** the card renders a monthly summary, **Then** zero-sum days are included in min, avg, and max (min and avg may now be 0 where previously they reflected only rainy days).
3. **Given** a `device_class: precipitation` entity, **When** the user toggles `show_zero` in the visual editor, **Then** the card preview updates the summary min/avg/max immediately, in addition to the existing day-cell blanking behaviour.

---

### User Story 2 — Any cumulative entity can opt into zero-exclusion (Priority: P2)

A user with a sparse cumulative entity (e.g. an irrigation valve meter that runs on a few days per month) sets `show_zero: false` so the monthly summary reflects only the days the meter actually ran.
Previously this option only blanked the day cells; the summary still included zeros and dragged the average down.

**Why this priority**: Extending `show_zero` semantics to the summary unlocks the symmetry that motivated removing the device-class branch in the first place.
Without it, the change in Story 1 would feel like a regression for precipitation users.

**Independent Test**: Configure a non-precipitation cumulative entity (e.g. `device_class: energy`) with `show_zero: false`.
Verify the monthly summary min/avg/max exclude zero-sum days.

**Acceptance Scenarios**:

1. **Given** any cumulative (`total_increasing` / `total`) entity with `show_zero: false`, **When** the card renders a monthly summary, **Then** zero-sum days are excluded from min, avg, and max — regardless of `device_class`.
2. **Given** the same entity, **When** the monthly **total** column renders, **Then** the value is unchanged (the total comes from HA's authoritative monthly statistics; zero days contribute zero to it either way).

---

### User Story 3 — Expression rows follow the same `show_zero` rule (Priority: P2)

A user with an expression row that frequently evaluates to zero (e.g. a net-export formula on overcast days) sets `show_zero: false` to exclude those days from the monthly summary min/avg/max.

**Why this priority**: Expression rows already respect `show_zero` for day cells.
Extending the rule to summaries keeps expression rows behaving consistently with entity rows.

**Independent Test**: Configure an expression row whose daily value is `0` on at least one day with `show_zero: false`.
Verify the monthly summary min/avg/max exclude those zero days.

**Acceptance Scenarios**:

1. **Given** an expression row with `show_zero: false`, **When** the card renders a monthly summary, **Then** zero-value days are excluded from min, avg, and max.
2. **Given** an expression row with `show_zero: true` (or omitted), **When** the card renders a monthly summary, **Then** every day with a computed value is included.

---

### User Story 4 — Documentation reflects the new rule (Priority: P1)

A user reading `docs/README.md` and the project constitution learns the single rule that drives zero-handling — `show_zero` — and is no longer told that precipitation gets special treatment.

**Why this priority**: A behaviour change without doc updates causes user confusion.
P1 because the docs must ship in the same release as the code change.

**Independent Test**: Read `docs/README.md`.
Verify (a) the `show_zero` description in the entity-row table mentions the summary-column effect, and (b) no references to a precipitation-only zero-exclusion rule remain.

**Acceptance Scenarios**:

1. **Given** `docs/README.md` after this feature ships, **When** a user reads the `show_zero` description, **Then** it explicitly states that summary min/avg/max also exclude zero days (not only the day cells).
2. **Given** the same document, **When** a user searches for "precipitation", **Then** no statement remains that zero days are automatically excluded for precipitation entities.
3. **Given** the project constitution (`.specify/memory/constitution.md`), **When** a contributor reads Principle III (Density & Data Fidelity), **Then** the precipitation-specific zero-exclusion rule is removed and replaced with the generic `show_zero` rule.

---

### Edge Cases

- A precipitation entity with no explicit `show_zero` setting now includes zero-rain days in its summary min/avg/max.
  Users who want zero-rain days excluded must set `show_zero: false`.
- A precipitation entity with `show_zero: false` produces a summary where avg/min/max may all be the same single-day value if only one day had rain — same as today.
- An entity month with **all** zero-sum days and `show_zero: false` produces an empty summary (no min/avg/max rendered) rather than `0/0/0`.
- A `total_increasing` entity day whose value comes from a counter-reset clamp-to-zero (spec 001 FR-015) is indistinguishable from a naturally-zero day in the summary pipeline.
  With `show_zero: false`, both are excluded; with `show_zero: true`, both are included.
- Duplicate entity rows with conflicting `show_zero` (e.g. `Rain (include zeros)` and `Rain (exclude zeros)` both pointing to `sensor.rain`): each row renders its own day cells AND its own monthly summary independently. Per FR-002a, the summary map is keyed by row index, so two rows never share a summary entry.
- The monthly **total** column is unaffected by `show_zero` regardless of value — total comes from HA's authoritative monthly statistics, which already sums actual values.
- `measurement` entities are unaffected — `show_zero` does not apply to measurement-state-class rows in any column.
- Migration of stored configurations is not required — existing configs remain valid; only the rendering rules change.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The card MUST NOT apply any device-class-specific rule to monthly summary min/avg/max calculations.
  The `device_class: precipitation` hardcoded zero-exclusion behaviour MUST be removed entirely from the card's data pipeline.
  Scope clarification: `device_class` MUST NOT be read by any monthly-summary computation path.
  Other consumers (label rendering, unit-of-measurement display, threshold matching, and any future non-summary code) MAY continue to read `device_class` from `EntityMetadata`; this requirement does not ban the field globally.
- **FR-002**: For cumulative (`total_increasing` / `total`) entity rows, the monthly summary min/avg/max MUST exclude zero-sum days when the row's `show_zero` is `false`, and MUST include zero-sum days when `show_zero` is `true` or omitted (default).
  All zero-sum days are treated uniformly regardless of origin — a day whose sum is `0` because the value was naturally zero, and a `total_increasing` day whose negative counter-reset sum was clamped to `0` (spec 001 FR-015), are both excluded together when `show_zero: false`.
  No origin metadata is preserved.
- **FR-002a**: When multiple entity rows reference the same HA entity ID with different `show_zero` settings, each row MUST receive an **independent** monthly summary derived from its own `show_zero` value.
  The summary map MUST be keyed by row index (position in the `entities` list), not solely by entity ID, so duplicate-entity rows do not collide.
  Per-row day-cell rendering already respects per-row `show_zero` (cell blanking is computed per row); this requirement extends the symmetry to summary cells.
- **FR-003**: For expression rows, the monthly summary min/avg/max MUST exclude zero-value days when the row's `show_zero` is `false`, and MUST include zero-value days when `show_zero` is `true` or omitted (default).
- **FR-004**: The monthly **total** column MUST remain unaffected by `show_zero` (its value continues to come from HA's authoritative monthly statistics).
- **FR-005**: Day-cell rendering behaviour driven by `show_zero` MUST remain unchanged (cells with computed value exactly `0` render blank when `show_zero: false`).
- **FR-006**: When all qualifying days in a month are zero-valued and `show_zero: false`, the monthly summary cells (min/avg/max) MUST render empty rather than `0/0/0`.
- **FR-007**: `measurement` state-class entities MUST NOT be affected by this change — `show_zero` remains inapplicable to them.
- **FR-008**: The card MUST NOT require any configuration migration.
  Existing card configurations MUST continue to load and render without modification; only the rendering rules change.
- **FR-009**: `docs/README.md` MUST be updated so the `show_zero` row in the entity-row and expression-row option tables describes the new dual effect (day-cell blanking AND summary exclusion).
- **FR-010**: `docs/README.md` MUST no longer state that zero days are excluded for `device_class: precipitation` entities automatically.
- **FR-011**: The project constitution (`.specify/memory/constitution.md`, Principle III) MUST be updated to remove the precipitation-specific zero-exclusion rule and reflect the new `show_zero`-driven generic rule.
  Constitution version MUST bump as a MAJOR change (governance rule semantics change).
- **FR-012**: The card MUST surface this behavioural change in the relevant feature spec(s) (at minimum `specs/001-monthly-stats-card/spec.md`, FR-016) so the historical record matches the shipping behaviour.
  Realignment via amended clarification entries is acceptable — full spec rewrites are not required.
- **FR-013**: The visual editor toggle label `editor.show_zero` MUST be reworded so it reflects the expanded dual effect (day-cell blanking AND summary exclusion).
  English value MUST become exactly **"Include zero-value days"**.
  The corresponding German entry MUST be updated to a semantically equivalent translation (current value "Nullwerttage anzeigen" no longer conveys the dual effect).
  Both `frontend/src/translations/en.json` and `frontend/src/translations/de.json` MUST be updated in the same commit.

### Key Entities

- **Entity Row Config — `show_zero` field**: Existing boolean field on `EntityRowConfig`.
  Default `true`.
  After this change, controls both day-cell blanking (existing) and monthly-summary min/avg/max inclusion (new).
- **Expression Row Config — `show_zero` field**: Existing boolean field on `ExpressionRowConfig`.
  Default `true`.
  Same dual effect after this change.
- **Monthly Summary**: For cumulative and expression rows, derived from per-day values.
  After this change, derivation respects the row's `show_zero` setting and ignores `device_class`.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100 % of the card's monthly-summary code paths that previously branched on `device_class === 'precipitation'` are removed (verifiable by source search returning zero matches).
- **SC-002**: A precipitation entity configured with `show_zero: false` produces exactly the same monthly summary min/avg/max values it produced before this change (parity for users who explicitly opt in to the old behaviour).
- **SC-003**: A precipitation entity configured with `show_zero: true` (or omitted) produces a monthly summary min/avg/max that includes zero-rain days — verifiably different from the previous default behaviour.
- **SC-004**: A non-precipitation cumulative entity configured with `show_zero: false` excludes zero-sum days from its monthly summary min/avg/max — a new capability that was unreachable in any prior version.
- **SC-005**: `docs/README.md` contains no remaining occurrence of "precipitation" in the context of automatic zero-exclusion; the `show_zero` table rows describe both effects.
- **SC-006**: The constitution's Principle III no longer mentions `device_class: precipitation`; the new rule is generic and reachable from any `show_zero: false` config.
- **SC-007**: Card configurations valid before this change load and render after this change without error (no migration required).
- **SC-008**: User can flip `show_zero` in the visual editor and see the monthly summary cells update in the preview within the same render cycle as the day cells.
- **SC-009**: The visual editor displays the `show_zero` toggle with the English label "Include zero-value days" (and the equivalent updated German label).
  The previous label "Show zero-value days" / "Nullwerttage anzeigen" no longer appears in the editor UI in either locale.
- **SC-010**: A configuration with two entity rows referencing the same entity ID — one with `show_zero: true` (or omitted), the other with `show_zero: false` — produces two distinct monthly summaries: one including zero-value days, the other excluding them.
  Per-row day-cell rendering and per-row summary rendering both respect each row's own `show_zero` value (no shared/collided summary).

## Assumptions

- The `show_zero` field already exists on both `EntityRowConfig` and `ExpressionRowConfig` (default `true`); no new schema fields are required.
- Extending `show_zero` to summary stats is acceptable as a single semantic change.
  Splitting it into separate fields (e.g. `show_zero_in_cells` vs `show_zero_in_summary`) is rejected as premature complexity (Constitution Principle V — YAGNI).
- The card has not been publicly released yet, so no migration note for upgrading users is required in the README and no in-card upgrade warning is in scope (clarification 2026-05-30).
- The monthly **total** column already uses HA's authoritative monthly statistics, not the per-day-sum arithmetic; no logic in that column needs to change to remain correct.
- Test suite updates accompany the implementation (TDD per Constitution Principle II); test count delta is left to the implementation plan.
