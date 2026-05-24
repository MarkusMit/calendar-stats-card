# Research: Measurement Row Visibility

**Feature**: 002-measurement-row-visibility
**Date**: 2026-05-24

## Decision 1: Dynamic rowspan for measurement label cell

**Decision**: Compute `rowspan` as the count of visible sub-rows (`[showMin, showAvg, showMax].filter(Boolean).length`). When 0 visible, render a single `<tr>` with only the label cell spanning 3 columns (label + sub-label + day range) and no data content.

**Rationale**: `year-table.ts:205` currently hard-codes `rowspan="3"`. Visibility flags reduce the physical row count per entity; the label cell must span exactly the rendered rows to avoid broken grid alignment.

**Alternatives considered**: Always render 3 rows and hide with CSS (`visibility: hidden` / `display: none`). Rejected — hidden rows still occupy vertical space, which defeats the purpose of the feature (reducing visual noise and vertical footprint).

---

## Decision 2: Cumulative summary conditional rendering

**Decision**: The cumulative summary `div.cumul-summary` in `year-table.ts:244–251` renders mean + `div.cumul-minmax(↓min ↑max)`. Visibility flags conditionally include each element. If all three are hidden, `summaryContent` is an empty string (summary cell stays blank); the total cell is unaffected.

**Rationale**: Minimal structural change — the existing div-based layout already separates mean from min/max, making conditional wrapping natural.

**Alternatives considered**: Separate span elements per value in a flat list. Rejected — would require CSS restructuring with no benefit.

---

## Decision 3: `monthly-table.ts` parity

**Decision**: Apply the same changes to `monthly-table.ts` for completeness. Although `year-table.ts` is the primary rendering component, `monthly-table.ts` is used for standalone contexts and must stay consistent.

**Rationale**: Spec says visibility applies to "all monthly tables"; both components render monthly tables.

---

## Decision 4: Default behaviour

**Decision**: `show_min ?? true`, `show_avg ?? true`, `show_max ?? true`. Check via `cfg.show_min !== false` (mirrors the existing `show_zero !== false` pattern throughout the codebase).

**Rationale**: Consistency with `show_zero` convention already used in `year-table.ts:190`.
