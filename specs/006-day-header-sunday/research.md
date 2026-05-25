# Research: Day-of-Month Header with Sunday Highlighting

## Sunday Detection

**Decision**: `new Date(year, month - 1, d).getDay() === 0`  
**Rationale**: `Date.getDay()` returns 0 for Sunday in all target browsers. Zero dependencies, one expression, negligible cost over max 31 iterations.  
**Alternatives considered**: `Intl.DateTimeFormat` weekday — rejected as overkill; locale-agnostic Sunday detection needs no i18n.

## year-table Per-Month Header Generation

**Decision**: Move `dayHeaders` generation inside `visibleMonths.map()` loop, remove `i % 3 === 0` conditional entirely.  
**Rationale**: Sunday position is month-specific; a shared static array cannot carry conditional CSS classes. Spec requires every month to show day numbers.  
**Alternatives considered**: Keep shared array and pass month offset — rejected; more complex, still requires per-month recomputation in effect.

## CSS Strategy

**Decision**: `.sunday { font-weight: bold; }` CSS class on `<th>` elements.  
**Rationale**: Class-based approach is testable by `querySelectorAll('th.sunday')`, consistent with existing bold patterns (`.month-name`), and separates style from logic.  
**Alternatives considered**: Inline style — rejected (untestable by class); `data-sunday` attribute — rejected (CSS class is the conventional approach).

## Pad-cells in year-table Headers

**Decision**: After moving header generation per-month, add pad-cell `<th>` for days beyond month length in the header row — consistent with `monthly-table` and `<tbody>` pad behavior.  
**Rationale**: Without pad-cells in the header, columns beyond the month end have no `<th>`, which is a table structure inconsistency. `monthly-table` already does this correctly.
