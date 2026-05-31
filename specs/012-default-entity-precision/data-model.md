# Phase 1 Data Model: Default Entity Precision of 1

This feature changes a display default; it introduces no new persisted entity and no config-schema change.

## Affected configuration field

| Field | Type | Owner | Before | After |
|-------|------|-------|--------|-------|
| `precision` | `number?` (optional integer ≥ 0) | entity row config & expression row config | unset → variable native precision (up to 20 decimals) | unset → fixed `1` decimal |

- The field's type, accepted range, and editor selector are **unchanged**.
- Only the render-time interpretation of `undefined` changes.

## New code-level constant / helper (not persisted)

| Name | Location | Definition | Purpose |
|------|----------|------------|---------|
| `DEFAULT_PRECISION` | `frontend/src/components/year-table.ts` | `1` | Single source of the default decimal count |
| `resolvePrecision(cfg)` | `frontend/src/components/year-table.ts` | `cfg.precision ?? DEFAULT_PRECISION` | Resolve effective precision for a row at render time |

## Validation / behavior rules

- `resolvePrecision({})` → `1`
- `resolvePrecision({ precision: 2 })` → `2`
- `resolvePrecision({ precision: 0 })` → `0`
- Effective precision `p` is applied as `Intl.NumberFormat(lang, { maximumFractionDigits: p, minimumFractionDigits: p })` (fixed-decimal) at both render sites.

## State transitions

None. Stateless display formatting.
