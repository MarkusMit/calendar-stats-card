# Research: Floating Bottom Navigation Bar

**Feature**: 008-floating-bottom-nav  
**Date**: 2026-05-25

---

## Decision 1: Layout Strategy — Block Flow (revised after implementation)

**Decision**: Natural block flow. `.card-content` then `.bottom-bar` as sequential block children of `ha-card`.

**Rationale**: `ha-card` is a shadow DOM custom element. Its `:host { display: block }` takes precedence over our `display: flex` rule applied from the parent shadow DOM (authority conflict in shadow DOM cascade). As a result, the flex container had `height: auto` — `.card-content` with `flex: 1 1 0` collapsed to zero, clipping the table. Block flow is the correct approach: document order places the bar after all content, so it is always at the card's bottom. No overlap, no collapsing, no height dependency.

**Alternatives considered and ruled out**:
- `position: sticky; bottom: 0` on bar — requires a scrollable ancestor; `ha-card` is not a scroll container so sticky collapses to static.
- `position: absolute; bottom: 0` — `overflow: hidden` on `ha-card` clips absolute children below the border box.
- Flex column — fails because `ha-card`'s shadow DOM `:host` overrides external `display: flex`; flex container has `height: auto`, so flex children don't distribute space correctly (`.card-content` collapses to zero).
- `.card-wrapper` inner div with `height: 100%` — requires `ha-card` to have a defined height, which HA's masonry layout does not guarantee.

**Implication for FR-005/FR-006**: Both satisfied automatically by document order. Bar is after table and legend; no data row can be obscured. No JS height measurement needed.

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
