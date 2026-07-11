# Research: Threshold Aggregation Scope

No NEEDS CLARIFICATION items remained in the Technical Context; the decisions below were settled during pre-spec analysis (plan-mode session 2026-07-11) with the user.

## Decision 1 (revised): Per-period threshold values on each rule

- **Decision**: Extend `ThresholdRule` with optional `value_month` and `value_year` beside the (now optional) day `value`; a rule is evaluated for a cell only when it defines a threshold for that cell's period.
- **Rationale**: Matches the user's mental model — one phenomenon ("Wet"), one rule, one color/name/legend entry, three magnitudes.
Month-only or year-only rules fall out naturally by omitting the other values.
- **Revision note**: The first implementation used a per-rule `scope` enum (one period per rule).
The user corrected the design after seeing it: per-period values were the intended shape.
The `scope` field was removed before release, so no compatibility surface remains.
- **Alternatives considered**:
  - Per-rule `scope` enum — implemented first, then replaced; forces three rules (and three legend entries) for one phenomenon across periods.
  - Supporting both `scope` and per-period values — ambiguity rules needed, more config surface; rejected per constitution simplicity.
  - Separate `monthly_thresholds` / `yearly_thresholds` lists — same power, more config surface, duplicated editor UI; rejected.
  - Auto-normalizing monthly totals by day count before evaluating daily rules — semantically misleading ("day above 10" ≠ "month averaging 10/day"), breaks legend meaning; rejected.
  - Removing threshold coloring from sum cells with no replacement — loses the "flag notable months" capability the user wants; rejected.

## Decision 2: Where the scope filter lives

- **Decision**: Inside `resolveThreshold()` as a pre-filter, via a new `cellScope` parameter.
- **Rationale**: The function already receives per-cell context (`cellRole`) and already pre-filters colorless rules; adding the scope predicate there guarantees closest-wins and tie-breaks run only among matching-scope rules (FR-008) with a one-line change, and all 13 call sites get the behavior uniformly.
- **Alternatives considered**: filtering at each call site (13 duplications, easy to miss one); a wrapper function (needless indirection per constitution Principle V).

## Decision 3: Cell classification (which cell has which scope)

- **Decision**: Sums define the period; statistics inherit the period of the values they summarize.
  Day: all measurement cells at every level, cumulative daily diffs, and their monthly summary min/avg/max.
  Month: cumulative monthly totals wherever shown (yearly view month cells, comparison values and cross-year average, year rollups over monthly totals, monthly view Total column).
  Year: yearly Total column.
- **Rationale**: Matches unit-scale reality — a monthly minimum temperature IS a daily value, so day rules must keep coloring it (no regression); a monthly precipitation total is a different magnitude, so day rules must not touch it.
  Consistent with the constitution's Principle III derivation paths.
- **Alternatives considered**: classifying by view (monthly view = day, yearly view = month) — wrong, because the yearly view shows day-scale measurement stats; rejected.

## Decision 4: Handling of invalid YAML scope values

- **Decision**: Any value other than `month` or `year` is treated as `day`.
- **Rationale**: Matches the card's lenient handling of optional config fields; avoids hard failures on typos; the default is also the least surprising fallback.
- **Alternatives considered**: config validation error — the card has no validation-error channel for row sub-fields today; introducing one is out of scope.

## Decision 5: Total columns become colorable

- **Decision**: The monthly view's per-month Total column joins `month` scope; the yearly view's Total column joins `year` scope; both reuse the existing resolve/build/trigger pattern.
- **Rationale**: User-confirmed requirement (FR-006/FR-007); with scope gating in place these cells can now be colored meaningfully, closing the "every value cell is colorable" consistency gap.
- **Alternatives considered**: keeping them static-only — smaller diff but leaves year-scope with no target cell and month-scope inconsistent between views; rejected by user.
