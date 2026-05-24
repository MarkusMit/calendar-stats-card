# Implementation Plan: Entity Row Color Configuration

**Branch**: `003-entity-row-colors` | **Date**: 2026-05-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/003-entity-row-colors/spec.md`

## Summary

Extend `EntityRowConfig` and `ExpressionRowConfig` with optional `text_color` and `background_color`
string fields. When present, forward the values as inline `color` / `background-color` CSS on the
entity's label cell (`td.label-column`) in both `year-table` and `monthly-table` components. No
validation — values pass through to the browser as-is.

## Technical Context

**Language/Version**: TypeScript 5.6 (frontend/), Node.js 24.15 (WSL2)
**Primary Dependencies**: Lit 3.2, Rollup 4, Vitest + happy-dom
**Storage**: N/A
**Testing**: Vitest — component tests in `frontend/tests/component/`
**Target Platform**: Home Assistant 2026.5.0+, Lovelace custom card
**Project Type**: Frontend library (Lit web component)
**Performance Goals**: No additional rendering cost beyond inline style attribute
**Constraints**: No card-level validation; browser silently ignores invalid CSS values
**Scale/Scope**: 2 type extensions + 6 label-cell render sites (3 per component)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. HA-Native Design** — Using CSS custom properties (`var(--token)`) as first-class values
  aligns with HA's design token system. No new component styling introduced; only user-supplied
  inline styles on the label cell.
- [x] **II. Test-First** — TDD is mandatory; tests written and confirmed failing before any
  implementation. All 6 render sites and both entity types covered.
- [x] **III. Density & Data Fidelity** — Feature applies only to label cell styling; no layout,
  whitespace, or computation changes. Density unaffected.
- [x] **IV. i18n from Day One** — No user-visible strings introduced. CSS color values are not
  localizable. No i18n changes required.
- [x] **V. Simplicity** — 2 optional fields, 6 targeted inline style applications. No abstractions,
  no helpers, no third-party dependencies. Threshold/conditional coloring remains out of scope.

*All principles satisfied. No Complexity Tracking entries required.*

## Project Structure

### Documentation (this feature)

```text
specs/003-entity-row-colors/
├── plan.md              # This file
├── spec.md              # Feature specification
├── checklists/
│   └── requirements.md  # Pre-implementation checklist
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (modified files)

```text
frontend/
├── src/
│   ├── types/
│   │   └── card-config.ts          # Add text_color?, background_color? to EntityRowConfig + ExpressionRowConfig
│   └── components/
│       ├── year-table.ts           # Apply inline style to 3 label-cell td sites
│       └── monthly-table.ts        # Apply inline style to 3 label-cell td sites
└── tests/
    └── component/
        ├── year-table.test.ts      # New describe block for color rendering
        └── monthly-table.test.ts   # New describe block for color rendering
```

## Phase 0: Research

No NEEDS CLARIFICATION items. All decisions resolved:

- **Inline style mechanism**: `ifDefined` from `lit/directives/if-defined.js` — renders no `style`
  attribute when neither color field is set (satisfies FR-004). Build style string conditionally:
  `color:X` and/or `background-color:Y`, joined with `;`. Not `styleMap` (adds empty style attribute
  when given `{}`; would violate FR-004 in tests).
  
- **CSS property mapping**: `text_color` → CSS `color`; `background_color` → CSS `background-color`.

- **Validation**: None. Browser handles invalid values silently. Card-level validation would be
  over-engineering for a passthrough field.

- **No new dependencies**: `lit/directives/if-defined.js` is part of Lit 3.2 (already installed).

## Phase 1: Design

### Type Extension

`EntityRowConfig` and `ExpressionRowConfig` in `frontend/src/types/card-config.ts`:

```typescript
text_color?: string;       // CSS color → inline style: color
background_color?: string; // CSS color → inline style: background-color
```

### Render Pattern (both components)

Compute once per entity render call:

```typescript
const colorParts: string[] = [];
if (cfg.text_color) colorParts.push(`color:${cfg.text_color}`);
if (cfg.background_color) colorParts.push(`background-color:${cfg.background_color}`);
const labelStyle = colorParts.length ? colorParts.join(';') : undefined;
```

Apply on every `td.label-column`:

```typescript
import { ifDefined } from 'lit/directives/if-defined.js';
// ...
html`<td class="label-column" style=${ifDefined(labelStyle)}>...`
```

### Label Cell Sites (6 total)

**year-table.ts** (`renderEntityRows`):
1. Measurement label-only row (`visibleRows.length === 0`) — line ~216
2. Measurement spanned label cell (`idx === 0`, `rowspan`) — line ~231
3. Cumulative row (`colspan`) — line ~276

**monthly-table.ts** (`renderEntityRow`):
4. Measurement label-only row (`visibleRows.length === 0`) — line ~166
5. Measurement spanned label cell (`idx === 0`, `rowspan`) — line ~181
6. Cumulative row (`colspan`) — line ~225

### No data-model.md

Type extension is trivial (two optional string fields). Data model document not required.

### No contracts/

YAML card configuration is the user contract; already fully specified in spec.md FR-001–FR-008.
No API, no external interface.

### No quickstart.md

Feature is too small for a standalone quickstart.

## Agent Context Update

Plan file: `specs/003-entity-row-colors/plan.md`
