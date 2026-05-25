# Data Model: Floating Bottom Navigation Bar

**Feature**: 008-floating-bottom-nav  
**Date**: 2026-05-25

---

## Entities

### FloatingBottomBar (UI Container)

A persistent UI region at the bottom of `ha-card`. Rendered as `.bottom-bar` div.

| Field | Type | Notes |
|-------|------|-------|
| children | LitElement slot / HTML children | Hosts `year-navigator`; accepts additional controls in future |
| height | auto (CSS) | Derived from content; never hard-coded |

**State transitions**: Always visible; no conditional logic on the bar itself.

**Validation**: Must contain at least `year-navigator`. Future controls are siblings inside `.bottom-bar`.

---

### CardContent (UI Container)

Wraps `year-table` + legend. Flex child that fills remaining card height.

| Field | Type | Notes |
|-------|------|-------|
| flex | `1 1 0` | Fills all space not taken by `.bottom-bar` |
| overflow | `auto` | Replaces removed `overflow: hidden` on `ha-card` |
| min-height | `0` | Required for flex shrink to work correctly |

---

### YearNavigator (Relocated)

Existing `<year-navigator>` web component. No behavioral changes — only its DOM parent changes.

| Field | Type | Notes |
|-------|------|-------|
| year | number | Bound from card's `_year` state |
| atCurrentYear | boolean | Disables next button |
| atEarliestYear | boolean | Disables prev button |
| Events | `year-changed` | Card listens as before |

**Before** (parent): `ha-card` (direct child)  
**After** (parent): `.bottom-bar` (inside `ha-card`)

---

### Legend (Unchanged)

`_buildLegend()` output remains in `.card-content`, below `year-table`. No structural change.

---

## Layout Relationships

```
ha-card  [display: flex; flex-direction: column]
├── loading-overlay
├── .card-content  [flex: 1 1 0; min-height: 0; overflow: auto]
│   ├── year-table
│   └── .legend  (conditional, unchanged)
└── .bottom-bar  [flex: 0 0 auto; display: flex; align-items: center; justify-content: center]
    └── year-navigator
```

---

## CSS Variable Inventory

| Variable | Source | Usage |
|----------|--------|-------|
| `--ha-card-background` | HA token | `.bottom-bar` background fill |
| `--card-background-color` | HA token (fallback) | `.bottom-bar` background fallback |
| `--divider-color` | HA token | `.bottom-bar` top border |

---

## No New State Fields

`tabularizer-card.ts` gains no new `@state()` or `@property()` fields. All existing state (`_year`, `_triggeredThresholds`, etc.) is unchanged. The change is purely structural (DOM layout).
