# Research: Floating Bottom Navigation Bar

**Feature**: 008-floating-bottom-nav  
**Date**: 2026-05-25

---

## Decision 1: Layout Strategy — Flex Column vs. Overlay Positioning

**Decision**: Flex column on `ha-card`.

**Rationale**: The spec's "bottom padding = max(legend height, bar height)" formula was written assuming an overlay approach (position:absolute/sticky). A flex-column layout is strictly superior: the `.card-content` wrapper becomes a flex child that fills remaining height, the `.bottom-bar` is a second flex child anchored at the bottom. No z-index fighting, no overlap, no explicit padding calculation needed — the layout engine enforces separation automatically.

**Alternatives considered**:
- `position: sticky; bottom: 0` on bar — requires a scrollable ancestor; `ha-card` is not a scroll container, so sticky collapses to static.
- `position: absolute; bottom: 0` with `position: relative` on `ha-card` — `ha-card` already has `overflow: hidden` which clips absolute children; removing it changes table horizontal scroll behavior.
- Flex column — no layout hacks, no dynamic height measurement, bar always adjacent to content.

**Implication for FR-005/FR-006**: Both requirements (bottom spacing) are satisfied automatically. The flex child `.card-content` shrinks to exactly (card height − bar height); no data row can be hidden. Dynamic bar height growth (FR-008) is also automatic.

---

## Decision 2: Card Height Behavior

**Decision**: `ha-card` stays block-level (grows with content if not constrained by HA grid); `display: flex; flex-direction: column` added to it.

**Rationale**: HA Lovelace grid cards are height-constrained by the dashboard layout engine. The card itself is `display: block` via `:host { display: block }`. Changing `ha-card` to flex-column does not affect `:host` sizing. The `ha-card` shadow element is a standard `<div>` with HA-provided CSS; adding our flex rules inside the shadow DOM is safe and does not interfere with HA's grid calculations.

---

## Decision 3: Visual Style of Floating Bar

**Decision**: `background: var(--ha-card-background, var(--card-background-color))` + `border-top: 1px solid var(--divider-color)` + subtle shadow.

**Rationale**: HA Energy dashboard's bottom bar uses a card-background fill with a top divider line to visually separate it from the content above. This matches SC-004. Using HA CSS custom properties ensures the bar follows HA theming automatically.

**Token choices**:
- Background: `--ha-card-background` (HA 2023+) with `--card-background-color` fallback.
- Divider: `--divider-color` (standard HA token).
- Shadow: `0 -2px 6px rgba(0,0,0,0.08)` (upward shadow to lift bar visually).

---

## Decision 4: Content Wrapper

**Decision**: Introduce a `.card-content` wrapper `<div>` around the year-table and legend, set to `flex: 1; min-height: 0; overflow: auto`.

**Rationale**: Without `min-height: 0`, flex children with `overflow: auto` do not shrink below their intrinsic height (a well-known flex gotcha). `overflow: auto` replaces the removed `overflow: hidden` on `ha-card` for clipping. Horizontal scroll on the table is preserved via `.table-container { overflow-x: auto }` already in year-table.

---

## Decision 5: Dynamic Bar Height — No ResizeObserver Needed

**Decision**: No `ResizeObserver` or JavaScript height measurement required for this feature.

**Rationale**: With flex-column layout, the content area auto-adjusts to available height as the bar grows. Future features adding controls to the bar do not require any JS measurement — CSS handles it. `ResizeObserver` would only be needed if the bar were an overlay (position:absolute), which this design avoids.

---

## Decision 6: `overflow: hidden` Removal

**Decision**: Remove `overflow: hidden` from `ha-card`; it is no longer needed.

**Rationale**: `overflow: hidden` was present to clip the table, but the `.card-content` flex child with `overflow: auto` provides equivalent clipping within its own box. Horizontal table scroll is already handled inside `.table-container`.
