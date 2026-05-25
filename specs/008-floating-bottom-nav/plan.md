# Implementation Plan: Floating Bottom Navigation Bar

**Branch**: `008-floating-bottom-nav` | **Date**: 2026-05-25 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/008-floating-bottom-nav/spec.md`

---

## Summary

Relocate `year-navigator` from the top of `ha-card` to a floating bar anchored at the card's bottom, using a flex-column layout on `ha-card`. A `.card-content` wrapper (flex: 1) holds the table and legend; `.bottom-bar` (flex: 0) sits below it. No DOM overlap, no JavaScript height measurement, no new reactive state.

---

## Technical Context

**Language/Version**: TypeScript 5.x + LitElement 3.x (lit@3)  
**Primary Dependencies**: lit@3, HA CSS custom properties (design tokens)  
**Storage**: N/A  
**Testing**: Vitest 4 + happy-dom (component tests), threads (unit tests)  
**Target Platform**: Home Assistant 2026.5.0+ Lovelace custom card  
**Project Type**: Web component (single bundle, `frontend/dist/calendar-stats-card.js`)  
**Performance Goals**: No regression in render time; bar appears on first paint  
**Constraints**: No new JS dependencies; HA design tokens only; bar must not clip on narrow widths  
**Scale/Scope**: Single-file main component change (`calendar-stats-card.ts`); zero behavioral changes

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **I. HA-Native Design** — `.bottom-bar` uses `--ha-card-background`, `--divider-color`, `--card-background-color` HA tokens. No custom color palette introduced.
- [x] **II. Test-First** — All structural and behavioral changes tested before implementation (see task plan).
- [x] **III. Density & Data Fidelity** — No layout change affects data display; flex-column ensures table rows are never obscured.
- [x] **IV. i18n from Day One** — No new user-visible strings introduced. Year navigator strings unchanged.
- [x] **V. Simplicity** — No abstraction beyond the `.bottom-bar` div; no ResizeObserver; no new state fields; flex layout handles all spacing automatically.

*No violations. Complexity Tracking table not required.*

---

## Project Structure

### Documentation (this feature)

```text
specs/008-floating-bottom-nav/
├── plan.md              ← this file
├── research.md          ← layout strategy, visual style decisions
├── data-model.md        ← entity relationships, CSS variable inventory
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code (affected files only)

```text
frontend/src/
└── calendar-stats-card.ts     # ha-card CSS + render() restructuring

frontend/tests/
└── component/
    └── calendar-stats-card.test.ts   # new/updated tests for bottom-bar
```

No new files in `frontend/src/`. `year-navigator.ts` and all other components are unchanged.

---

## Design

### Layout Change (calendar-stats-card.ts)

**ha-card CSS (before)**:
```css
ha-card { padding: 8px; overflow: hidden; }
```

**ha-card CSS (after)**:
```css
ha-card {
  display: flex;
  flex-direction: column;
  /* overflow: hidden removed — .card-content provides equivalent clipping via overflow: auto (research Decision 6) */
}
.card-content {
  flex: 1 1 0;
  min-height: 0;
  overflow: auto;
  padding: 8px;
}
.bottom-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px 8px;
  background: var(--ha-card-background, var(--card-background-color));
  border-top: 1px solid var(--divider-color);
  box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.08);
}
```

**render() structure (after)**:
```html
<ha-card>
  <loading-overlay ...></loading-overlay>
  <div class="card-content">
    <!-- conditional: no-entities message or year-table -->
    ${this._buildLegend(...)}
  </div>
  <div class="bottom-bar">
    <year-navigator ...></year-navigator>
  </div>
</ha-card>
```

`year-navigator` is **removed** from the top-level `<ha-card>` children and placed inside `.bottom-bar`. All its bindings (`year`, `atCurrentYear`, `atEarliestYear`, `@year-changed`) remain identical.

### Why No ResizeObserver

The flex-column layout makes the content area a flex sibling of the bar. When the bar grows (future features), `.card-content` automatically shrinks by the same amount. `min-height: 0` on `.card-content` ensures flex shrinking works correctly. No JavaScript measurement is ever required.

### Extensibility (FR-008)

Future controls are added as siblings of `<year-navigator>` inside `.bottom-bar`:
```html
<div class="bottom-bar">
  <year-navigator ...></year-navigator>
  <!-- future: <some-other-control> -->
</div>
```
No structural redesign required.

---

## Test Plan

All tests written RED before implementation (Constitution II).

### New component tests (calendar-stats-card.test.ts)

| # | Test | Assert |
|---|------|--------|
| T002 | Card renders `.bottom-bar` | `shadowRoot.querySelector('.bottom-bar')` not null |
| T003 | `year-navigator` inside `.bottom-bar` | `.bottom-bar` contains `year-navigator` |
| T004 | No `year-navigator` outside `.bottom-bar` | No `year-navigator` as direct child of `ha-card` |
| T005 | `.card-content` wraps `year-table` | `.card-content` contains `year-table` |
| T006 | Year navigation still works | Dispatch `year-changed` from bar's navigator, table re-renders |
| T007 | `.bottom-bar` has HA CSS tokens (FR-007) | `border-top` style + `background` contains `--ha-card-background` or `--card-background-color` |
| T010 | Legend inside `.card-content`, not `.bottom-bar` | `_buildLegend` output not in `.bottom-bar` |
| T011 | `.card-content` contains both `year-table` and `.legend` | Both descendants present when thresholds triggered |

### Existing tests

All 348 existing tests must continue to pass (no regression).

---

## Task Breakdown (preview — detail in tasks.md)

1. **T001** Baseline test run (regression gate)
2. **T002–T007** Write failing tests for bottom-bar structure and visual style (US1)
3. **T008** CSS: add `.card-content`, `.bottom-bar`; remove `overflow: hidden` from `ha-card`
4. **T009** Restructure `render()`: move year-navigator to `.bottom-bar`, wrap content in `.card-content`
5. **T010–T011** Write failing tests for legend placement (US2)
6. **T012** Manual visual QA (SC-004, FR-003/004/005/010)
7. **T013** Full regression — all 348 + new tests pass

---

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| `min-height: 0` forgotten on `.card-content` | Medium | Specific test T4 verifies table renders; visual QA catches flex overflow |
| HA theme override of `ha-card` display | Low | `:host` override with `!important` if needed; HA rarely overrides `display` on child divs |
| Bottom bar clips year-navigator text on narrow cards | Low | `year-navigator` is `display: flex; justify-content: center`; bar is `flex: 0 0 auto`; no width constraint added |
