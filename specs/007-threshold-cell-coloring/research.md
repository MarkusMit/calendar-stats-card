# Research: Threshold-Based Cell Coloring

## Decision 1: Threshold Config Field Names

**Decision**: Use `text_color` and `background_color` on `ThresholdRule` — identical to the existing flat fields on `EntityRowConfig` / `ExpressionRowConfig`.

**Rationale**: No schema migration needed; consistent naming across static and threshold colors; users see one mental model for color fields throughout the entire config. The `thresholds` list is a peer field on the entity config (not nested under `text`/`background`), keeping the hierarchy flat.

**Alternatives considered**:
- Nested objects (`text: { color, thresholds: [...] }`) — rejected by user; over-complicates config structure.
- Nested `text`/`background` objects with `color` sub-option replacing flat fields — evaluated and rejected; would be a breaking config change with no benefit beyond aesthetics, since thresholds already live at the entity level.

---

## Decision 2: Threshold Resolver Location

**Decision**: New pure function `resolveThreshold` in `frontend/src/services/threshold-resolver.ts`.

**Rationale**: Threshold resolution is a non-trivial algorithm (multi-step filter → match → closest-wins → tie-break) with many testable branches. Isolating it in its own service file enables exhaustive unit tests without mounting LitElement components, follows the project's existing service-layer pattern (`data-transform.ts`, `expression-evaluator.ts`), and keeps the rendering components thin.

**Alternatives considered**:
- Inline in `year-table.ts` and `monthly-table.ts` — rejected; duplicates logic, harder to unit-test.
- In `card-config.ts` alongside type definitions — rejected; mixes type declarations with runtime logic.

---

## Decision 3: Cell Role Taxonomy

**Decision**: Six role values: `'min'`, `'avg'`, `'max'`, `'scalar'`, `'summary-min'`, `'summary-avg'`, `'summary-max'`, `'summary-scalar'`.

**Rationale**: `not-below` and `not-above` must fire only for specific cell types. A string literal union is the minimal discriminator: role is computed once per cell based on its position in the rendering loop, then passed to `resolveThreshold`. No runtime overhead — the role is known structurally from the rendering context.

**Alternatives considered**:
- Boolean flags `{ isMin, isMax, isSummary }` — rejected; three booleans with eight meaningful combinations is more confusing than eight explicit role strings.
- Deriving role from `val.kind` — rejected; `val.kind` distinguishes measurement vs cumulative, not sub-row position within a measurement entity.

---

## Decision 4: Closest-Threshold Tie-Breaking

**Decision**: When two matching `ThresholdRule`s are equidistant from the cell value, the rule with the **higher** numeric threshold value wins.

**Rationale**: Deterministic behavior required by SC-003. "Higher value wins" is simple, consistent, and predictable — the more restrictive (harder-to-trigger) threshold takes priority when distances are equal.

**Alternatives considered**:
- First-defined wins — rejected; depends on YAML definition order, surprising to users.
- Lower value wins — rejected; asymmetric; for `above`-type thresholds "higher" is more specific.

---

## Decision 5: Legend Placement

**Decision**: Rendered in `tabularizer-card.ts` after `<year-table>`, inside `<ha-card>`.

**Rationale**: The root card component is the only component with access to the full `CardConfig.entities` list. Legend is card-level (single combined legend); placing it inside `year-table` would require threading full config through unnecessarily. Pattern matches `year-navigator` placement.

**Alternatives considered**:
- Render inside `year-table.ts` — rejected; year-table doesn't own the full entity config list.
- Separate `<threshold-legend>` custom element — rejected; YAGNI. The legend logic is simple enough to inline in `tabularizer-card.ts` render.

---

## Decision 6: Additive-Only Config Change

**Decision**: No breaking changes. Add `thresholds?: ThresholdRule[]` to both row config interfaces. All existing `text_color`/`background_color` fields remain.

**Rationale**: The threshold `text_color`/`background_color` fields use the same format as the row-level fields; no new naming scheme needed. Existing configs work unchanged.

**Alternatives considered**:
- Nested styling objects with migration — evaluated during planning and rejected; no benefit justifies the breaking change to spec 003 users.

---

## Decision 7: `not-below` / `not-above` on Scalar Entities

**Decision**: For scalar (cumulative/expression) entities, both `not-below` and `not-above` apply; cell role is `'scalar'` for daily cells and `'summary-scalar'` for summary cells.

**Rationale**: Spec FR-003 clarified: "On scalar entities with a single daily value, that value is treated as both min and max." The `scalar` role signals this to the resolver.

---

## Decision 8: Legend — Both Colors Present

**Decision**: When a `ThresholdRule` has both `background_color` and `text_color`, the legend entry shows a filled swatch (using `background_color`) plus the name label rendered in `text_color`.

**Rationale**: Swatch represents cell background (primary visual indicator); text color applied to the label mimics how text appears in a matched cell. Maximally informative with minimal space.

**Alternatives considered**:
- Two swatches (one for background, one for text color) — rejected; doubles width with marginal gain.
- Background-only, ignore text color in legend — rejected; loses information when text color is the primary differentiator.
