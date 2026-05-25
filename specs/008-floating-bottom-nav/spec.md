# Feature Specification: Floating Bottom Navigation Bar

**Feature Branch**: `008-floating-bottom-nav`
**Created**: 2026-05-25
**Status**: Draft
**Input**: User description: "the year navigator shall be moved from the page's header to a floating area at the page's bottom, similar to HA's Energy dashboard. (there might be added more features to that area in the future.) if the page doesn't show a legend, make sure, there's enough footspace so that the floating area doesn't cover relevant data."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Year Navigator Moves to Floating Bottom Bar (Priority: P1)

The year navigator controls (previous year / current year label / next year) are relocated from the top of the card to a floating bar anchored at the bottom of the visible card area. The bar is always accessible without scrolling, does not cover table content, and leaves adequate space below the table when no legend is shown.

**Why this priority**: Core UX change — without this, the feature does not exist. All other stories depend on it.

**Independent Test**: Card loads with year navigator visible at the bottom; table data is fully readable; navigating years works identically to before.

**Acceptance Scenarios**:

1. **Given** the card is loaded, **When** the user views it, **Then** the year navigator appears in a floating bar at the bottom of the card and is absent from the header area.
2. **Given** no legend is shown, **When** the card renders, **Then** the table has sufficient bottom padding/margin so that the last row of data is not obscured by the floating bar.
3. **Given** the floating bar is present, **When** the user clicks previous/next year, **Then** the year changes and the table updates exactly as before.
4. **Given** the card is scrolled (if content exceeds viewport), **When** the user scrolls, **Then** the floating bar remains anchored to the bottom of the card (not the viewport).

---

### User Story 2 - Legend Co-exists with Floating Bar (Priority: P2)

When a threshold legend is displayed, it remains in its current position (rendered in the normal document flow, between the table and the bottom of the card). The floating bar floats on top of the card's bottom edge. The card's bottom padding ensures the floating bar never covers the legend or the table.

**Why this priority**: The legend (feature 007) is the only existing bottom-area element. It requires no repositioning — only the bottom padding rule needs to account for the floating bar's height.

**Independent Test**: Configure an entity with named thresholds that fire; verify legend is fully visible and not covered by the floating bar.

**Acceptance Scenarios**:

1. **Given** named thresholds are triggered and a legend is shown, **When** the card renders, **Then** the legend is fully visible in its current position and the floating bar does not overlap it.
2. **Given** the floating bar is taller than the legend, **When** the card renders, **Then** the bottom padding is increased to match the floating bar's height so no content is obscured.
3. **Given** the legend is taller than or equal to the floating bar's height, **When** the card renders, **Then** no additional bottom padding adjustment is needed beyond what the legend naturally provides.
4. **Given** no named thresholds are triggered, **When** the card renders, **Then** the legend is absent and the floating bar's height alone determines the required bottom padding.

---

### Edge Cases

- What happens when the card is very short (few months / single entity)? Floating bar must not overlap data even on minimal-height cards.
- What happens when the floating bar area grows in a future feature addition? Bottom spacing must be derived from the bar's actual rendered height, not a hard-coded value.
- What happens on very narrow card widths? Floating bar must not clip or wrap in a way that obscures navigation controls.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The year navigator MUST be removed from the card header area.
- **FR-002**: The year navigator MUST be rendered in a floating bar anchored to the bottom of the card.
- **FR-003**: The floating bar MUST remain visible without scrolling when the card fits in the viewport.
- **FR-004**: The floating bar MUST NOT overlap or obscure any table row data, including the last visible row.
- **FR-005**: When no legend is displayed, the card MUST reserve bottom space equal to the floating bar's height so the last data row is fully visible.
- **FR-006**: The legend MUST remain in its current document-flow position (unchanged). When the floating bar is taller than the legend, the card MUST add bottom padding equal to the difference so the legend is not obscured. When the legend is taller than or equal to the floating bar, no additional padding is required.
- **FR-007**: The floating bar MUST be visually distinguished from the table content (e.g., background, border, or shadow).
- **FR-008**: The floating bar's structure MUST be extensible — additional controls can be added in future features without redesigning the bar.
- **FR-009**: Year navigation behavior (previous/next/current year, disabled states at boundaries) MUST remain unchanged.
- **FR-010**: The floating bar MUST be anchored to the card, not the browser viewport.

### Key Entities

- **Floating Bottom Bar**: A persistent UI region at the card's bottom edge. Currently hosts the year navigator; designed to accept additional controls in future.
- **Year Navigator**: Existing previous/next/label control, unchanged in behavior, relocated in position.
- **Bottom Spacing**: Dynamic padding applied below the table to prevent the floating bar from covering data. Derived from the bar's actual rendered height.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The year navigator is absent from the header area and present at the bottom on 100% of card renders.
- **SC-002**: Zero table rows or legend entries are obscured by the floating bar under all configurations (no legend, with legend, narrow width, minimal data).
- **SC-003**: Year navigation completes without any change in behavior — previous/next/disabled states all function identically to the current implementation.
- **SC-004**: The floating bar's visual treatment is consistent with HA's Energy dashboard bottom bar style (background, elevation/shadow).
- **SC-005**: Adding a new control to the floating bar in a future feature requires no structural change to the bar's container.

## Assumptions

- The floating bar is anchored to the **card element**, not the browser viewport — the card is a fixed-height widget within the HA dashboard.
- The bottom spacing adjustment is calculated dynamically from the floating bar's rendered height, not a fixed pixel value, to remain correct as the bar grows.
- The legend (if present) remains in its current document-flow position (between the table and the card's bottom edge). It is not moved into or restructured around the floating bar.
- Bottom padding equals `max(legend height, floating bar height)` — the larger of the two determines the required clearance.
- Mobile/narrow-width layout is in scope; the bar must not clip navigation controls on narrow cards.
- No horizontal scrolling is introduced by the floating bar.
- The visual style of the floating bar follows the HA Energy dashboard pattern as a reference, adapted to this card's existing design language.
