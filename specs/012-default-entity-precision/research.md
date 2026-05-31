# Phase 0 Research: Default Entity Precision of 1

No `NEEDS CLARIFICATION` markers remained after `/speckit-clarify`.
Research here records the code findings that shape the design.

## Finding 1: Where the default is applied

**Decision**: The display default lives in `frontend/src/components/year-table.ts` at a **single** render-time site, not in the config layer.

- L196 (`renderEntityRows`): `const nf = new Intl.NumberFormat(this.lang, { maximumFractionDigits: cfg.precision ?? 20, minimumFractionDigits: cfg.precision ?? 0 });`
- This one `nf` constant is reused for **every** numeric cell: daily values (L247/256/265), summary min/avg/max (L285-287), cumulative summary (L359-362), and total (L366). There is no second `NumberFormat` and no `const precision = cfg.precision ?? 20` anywhere in the file (verified by grep).

The editors (`entity-row-editor.ts`, `expression-row-editor.ts`) declare `precision` as a `number` selector with **no default** — an unset field leaves `cfg.precision === undefined`, so the default is purely a render-time concern.

**Rationale**: Confirms the change is a single edit to the shared `nf` in `year-table.ts`; no config migration, no editor change required, and both entity and expression rows are covered because both route through `renderEntityRows` (dispatched at L420).

**Alternatives considered**: Defaulting in the editor (write `1` into config). Rejected — would mutate user config, break "omit to use default", and not cover programmatically-authored YAML.

## Finding 2: Existing semantics of explicit vs. default precision

**Decision**: The `undefined` path is the only variable-decimal path. Explicit precision already renders fixed-decimal.

- Explicit `precision: N` → `min = max = N` (fixed N decimals) — both `??` operands at L196 resolve to `N`.
- `undefined` → L196 `min = 0, max = 20` (variable, up to 20 digits, trailing zeros dropped).

Setting both `min` and `max` to `resolvePrecision(cfg)` (default `1`) therefore makes an unset row render identically to an explicit `precision: 1` (fixed one decimal). This directly satisfies FR-005 (default consistent with explicit) and the edge case `5 → 5.0`.

**Rationale**: Replacing the two `??` operands at the single L196 site with one resolved fixed value yields the spec's required behavior with no special-casing.

**Alternatives considered**: Default `max = 1, min = 0` (drop trailing zero → `5` not `5.0`). Rejected — contradicts the edge case in spec and is inconsistent with how explicit precision renders.

## Finding 3: Single-sourcing the default

**Decision**: Introduce module-level `export const DEFAULT_PRECISION = 1;` and `export function resolvePrecision(cfg: { precision?: number }): number` returning `cfg.precision ?? DEFAULT_PRECISION`; use at the single L196 formatter site.

**Rationale**: Replaces the inline magic number at L196, gives TDD a pure, importable unit to test without rendering the Lit component, and keeps the default in one place for any future change. Minimal — one constant, one one-line helper.

**Alternatives considered**:
- Inline-edit the `??` literals at L196 only (no helper). Rejected — leaves the default un-testable in isolation (Constitution II needs a red test) and keeps a bare magic number.
- Full DOM render test of `year-table`. Rejected — heavier than the requirement warrants (Constitution V); the only logic worth testing is precision selection.

## Finding 4: Documentation drift

**Decision**: Update `docs/README.md` precision default cells — L92 (entity row, currently `native` / "Omit to use HA's native precision (no rounding)") and L114 (expression row, currently `full`) — to state default `1`. Example snippets (L192/210 already `precision: 1`; L200/234 explicit `2`) need no change; audit confirms no contradiction (FR-007).

**Rationale**: FR-006 / SC-004. Without it, shipped docs contradict behavior.
