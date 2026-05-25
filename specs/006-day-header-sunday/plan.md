# Implementation Plan: Day-of-Month Header with Sunday Highlighting

**Branch**: `006-day-header-sunday` | **Date**: 2026-05-25 | **Spec**: [spec.md](spec.md)  
**Input**: Feature specification from `specs/006-day-header-sunday/spec.md`

## Summary

Every month's header row must display day-of-month numbers (1–N) and bold-style cells that fall on Sundays. Applies to both `year-table` (yearly view, currently only shows numbers every 3rd month) and `monthly-table` (monthly view, already shows all day numbers but lacks Sunday styling). Changes are CSS + render-only; no data model or contract changes required.

## Technical Context

**Language/Version**: TypeScript (LitElement web component)  
**Primary Dependencies**: Lit 3.x, Vitest (tests)  
**Storage**: N/A  
**Testing**: Vitest + jsdom, component tests in `frontend/tests/component/`  
**Target Platform**: Home Assistant Lovelace (browser)  
**Project Type**: Custom HA card (web component)  
**Performance Goals**: No change — existing render budget unchanged  
**Constraints**: No new runtime dependencies; no new user-visible strings (Sunday bold is visual-only)  
**Scale/Scope**: Two components modified, ~10 lines of logic change each

## Constitution Check

- [x] **I. HA-Native Design** — Sunday bold uses CSS class with `font-weight: bold` consistent with existing `.month-name` styling; no deviation from HA conventions.
- [x] **II. Test-First** — Failing tests written before implementation for both components; Red-Green-Refactor strictly followed.
- [x] **III. Density & Data Fidelity** — Header styling only; no data computation affected.
- [x] **IV. i18n from Day One** — No new user-visible strings; day numbers are numeric and locale-neutral; Sunday detection is calendar-based with no translated labels.
- [x] **V. Simplicity** — Minimal change: inline Sunday detection (`new Date(year, month-1, d).getDay() === 0`), one new CSS class per component, no new abstractions.

No violations. Complexity Tracking table omitted.

## Project Structure

### Documentation (this feature)

```text
specs/006-day-header-sunday/
├── plan.md              # This file
├── research.md          # Phase 0 output
└── tasks.md             # Phase 2 output (/speckit-tasks command)
```

### Source Code (affected files)

```text
frontend/
├── src/components/
│   ├── year-table.ts        # Move dayHeaders into per-month loop; remove i%3 branch; add Sunday bold
│   └── monthly-table.ts     # Add Sunday bold to existing day header loop
└── tests/component/
    ├── year-table.test.ts   # New tests: Sunday bold, every month shows headers
    └── monthly-table.test.ts  # New tests: Sunday bold
```

## Phase 0: Research

### Sunday Detection

**Decision**: Use `new Date(year, month - 1, d).getDay() === 0` inline in the render loop.

**Rationale**: `Date.getDay()` returns `0` for Sunday — universally available in all target browsers, zero dependencies, one expression. The computation is cheap enough to be fine in a render loop over max 31 days.

**Alternatives considered**:
- Shared utility function: rejected — three similar lines preferred over premature abstraction (Constitution V); both call sites are identical and trivial.
- Intl.DateTimeFormat weekday: rejected — overkill; locale-agnostic Sunday detection needs no i18n.

### year-table: Day Numbers Per Month vs. Shared

**Decision**: Move the `dayHeaders` array generation from outside the `visibleMonths.map()` loop (lines 306-309) to inside it, computing per-month so Sunday columns are correct.

**Rationale**: Sunday position differs per month. Current shared array at lines 306-309 is month-agnostic so it cannot carry Sunday class conditionally.

**Impact**: The `showDayNumbers = i % 3 === 0` branch (line 317) is replaced — spec requires day numbers on every month. The fallback compact header branch (lines 326-329) is removed.

### CSS Approach

**Decision**: Add `.sunday` CSS class to `<th>` elements that fall on Sunday; define `th.sunday { font-weight: bold; }` in each component's `static styles`.

**Rationale**: Class-based approach is testable (`querySelectorAll('th.sunday')`), separates concerns from data rendering, and matches existing patterns (`.month-name` also uses bold font-weight override).

**Alternatives considered**:
- Inline style on `<th>`: rejected — not testable by class selector, pollutes Lit template.
- Attribute-based (`data-sunday`): rejected — CSS class is the conventional approach.

## Phase 1: Design

### No Data Model Changes

This feature is header rendering only. No new entity types, config fields, or statistics shapes are introduced.

### No Contract Changes

No externally-observable API or config schema changes. The card config YAML, custom element properties, and event interfaces are unchanged.

### Implementation Design

#### `monthly-table.ts` changes

Current header loop (`render()`, lines 258-264):
```ts
for (let d = 1; d <= 31; d++) {
  if (d > days) {
    dayHeaders.push(html`<th class="pad-cell"></th>`);
  } else {
    dayHeaders.push(html`<th class="day-cell-header">${d}</th>`);
  }
}
```

Updated — add `sunday` class when `new Date(this.year, this.month - 1, d).getDay() === 0`:
```ts
for (let d = 1; d <= 31; d++) {
  if (d > days) {
    dayHeaders.push(html`<th class="pad-cell"></th>`);
  } else {
    const isSunday = new Date(this.year, this.month - 1, d).getDay() === 0;
    dayHeaders.push(html`<th class="day-cell-header ${isSunday ? 'sunday' : ''}">${d}</th>`);
  }
}
```

New CSS rule added to `static styles`:
```css
th.sunday {
  font-weight: bold;
}
```

#### `year-table.ts` changes

Current structure (lines 306-309, outside loop):
```ts
const dayHeaders: ReturnType<typeof html>[] = [];
for (let d = 1; d <= TOTAL_DAYS; d++) {
  dayHeaders.push(html`<th>${d}</th>`);
}
```

And inside the loop (lines 317-329), `showDayNumbers = i % 3 === 0` conditional renders either full headers or compact month-name-only row.

Updated — move header generation inside `visibleMonths.map()`, always render full headers, add Sunday detection:
```ts
// Inside visibleMonths.map((month, i) => { ... })
const days = this.daysInMonth(month);
const dayHeaders = [];
for (let d = 1; d <= TOTAL_DAYS; d++) {
  if (d > days) {
    dayHeaders.push(html`<th class="pad-cell"></th>`);
  } else {
    const isSunday = new Date(this.year, month - 1, d).getDay() === 0;
    dayHeaders.push(html`<th class="${isSunday ? 'sunday' : ''}">${d}</th>`);
  }
}
```

Remove `showDayNumbers` variable and the compact fallback branch entirely.

New CSS rule added to `static styles`:
```css
th.sunday {
  font-weight: bold;
}
```

Note: `year-table` currently shows pad-cell placeholders only in `tbody` rows, not in the header row (the shared `dayHeaders` had no pad-cells). After the change, header pad-cells for days beyond month length will appear, consistent with `monthly-table` behavior.

### Test Design

#### `monthly-table.test.ts` — new tests

```
describe('MonthlyTable — Sunday header highlighting') {
  it('January 2025: days 5,12,19,26 are Sundays → th.sunday count = 4')
  it('January 2025: day 1 (Wednesday) is NOT bold → th.sunday excludes day 1')
  it('February 2025 (28 days): correct Sunday cells only')
}
```

Verification: `el.shadowRoot!.querySelectorAll('th.sunday')` — check count and `textContent` values.

#### `year-table.test.ts` — new tests

```
describe('YearTable — day headers shown on every month') {
  it('January 2025 as first month → th count in header = 31 + label cols')
  it('January 2025 as 4th month (index 3, was previously hidden) → th day headers still present')
}

describe('YearTable — Sunday header highlighting') {
  it('January 2025: th.sunday cells match days 5,12,19,26')
  it('February 2025: th.sunday cells match correct Sundays')
  it('two months rendered → Sunday headers correct for each month independently')
}
```
