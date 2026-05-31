# Phase 0 Research: Default Entity Precision of 1

No `NEEDS CLARIFICATION` markers remained after `/speckit-clarify`.
Research here records the code findings that shape the design.

## Finding 1: Where the default is applied

**Decision**: The display default lives in `frontend/src/components/year-table.ts` at two render sites, not in the config layer.

- L196 (entity day cells): `new Intl.NumberFormat(this.lang, { maximumFractionDigits: cfg.precision ?? 20, minimumFractionDigits: cfg.precision ?? 0 })`
- L281 (cumulative / summary): `const precision = cfg.precision ?? 20;` then L286 `{ maximumFractionDigits: precision, minimumFractionDigits: precision }`

The editors (`entity-row-editor.ts`, `expression-row-editor.ts`) declare `precision` as a `number` selector with **no default** — an unset field leaves `cfg.precision === undefined`, so the default is purely a render-time concern.

**Rationale**: Confirms the change is isolated to `year-table.ts`; no config migration, no editor change required.

**Alternatives considered**: Defaulting in the editor (write `1` into config). Rejected — would mutate user config, break "omit to use default", and not cover programmatically-authored YAML.

## Finding 2: Existing semantics of explicit vs. default precision

**Decision**: The `undefined` path is the only variable-decimal path. Explicit precision already renders fixed-decimal.

- Explicit `precision: N` → `min = max = N` (fixed N decimals) at both sites.
- `undefined` → L196 `min = 0, max = 20` (variable, up to 20 digits, trailing zeros dropped); L281 `min = max = 20`.

Setting the default to `1` therefore makes an unset row render identically to an explicit `precision: 1` (fixed one decimal). This directly satisfies FR-005 (default consistent with explicit) and the edge case `5 → 5.0`.

**Rationale**: A single fallback value of `1` at all three `??` sites yields the spec's required behavior with no special-casing.

**Alternatives considered**: Default `max = 1, min = 0` (drop trailing zero → `5` not `5.0`). Rejected — contradicts the edge case in spec and is inconsistent with how explicit precision renders.

## Finding 3: Single-sourcing the default

**Decision**: Introduce module-level `export const DEFAULT_PRECISION = 1;` and `export function resolvePrecision(cfg: { precision?: number }): number` returning `cfg.precision ?? DEFAULT_PRECISION`; use at both sites.

**Rationale**: Removes the duplicated magic number across two sites (currently `20` in three places), gives TDD a pure, importable unit to test without rendering the Lit component, and keeps the default in one place for any future change. Minimal — one constant, one one-line helper.

**Alternatives considered**:
- Inline-edit the three `??` literals only (no helper). Rejected — leaves the default un-testable in isolation (Constitution II needs a red test) and re-duplicates the magic number.
- Full DOM render test of `year-table`. Rejected — heavier than the requirement warrants (Constitution V); the only logic worth testing is precision selection.

## Finding 4: Documentation drift

**Decision**: Update `docs/README.md` precision default cells — L92 (entity row, currently `native` / "Omit to use HA's native precision (no rounding)") and L114 (expression row, currently `full`) — to state default `1`. Example snippets (L192/210 already `precision: 1`; L200/234 explicit `2`) need no change; audit confirms no contradiction (FR-007).

**Rationale**: FR-006 / SC-004. Without it, shipped docs contradict behavior.
