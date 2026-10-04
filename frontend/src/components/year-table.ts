import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { guard } from 'lit/directives/guard.js';
import type { EntityConfig } from '../types/card-config';
import { rowKey } from '../types/card-config';
import type { MonthlySummary, EntityMetadata } from '../types/statistics';
import { localize } from '../localize/localize';
import { resolveThreshold, buildCellStyle, EMPTY_THRESHOLDS } from '../services/threshold-resolver';
import { ContrastResolver } from '../services/readable-text';
import { rowSummaryKey } from '../services/data-transform';
import { rowLabel } from '../services/row-label';
import { FrameScheduler } from '../services/frame-scheduler';
import { ThresholdLegendCollector } from '../services/threshold-legend';
import { numberFormatter, monthNameFormatter } from '../services/formatters';
import { DailyValueIndex } from '../services/daily-value-index';

const TOTAL_DAYS = 31;

/** Distance, in viewport heights, at which a section is rendered / released. */
const MOUNT_VIEWPORTS = 2;
const UNMOUNT_VIEWPORTS = 4;

/** Row and header heights assumed until a rendered section has been measured. */
const ESTIMATED_ROW_HEIGHT = 19;
const ESTIMATED_HEADER_HEIGHT = 24;

/** Viewport height, or 0 when the document cannot say — a hidden tab reports none. */
function viewportHeight(): number {
  return window.innerHeight || document.documentElement?.clientHeight || 0;
}

/** Largest and smallest value a column holds, per row precision. */
type ColumnExtremes = Map<number, { max: number; min: number }>;

function note(extremes: ColumnExtremes, precision: number, value: number): void {
  const seen = extremes.get(precision);
  if (!seen) {
    extremes.set(precision, { max: value, min: value });
    return;
  }
  if (value > seen.max) seen.max = value;
  if (value < seen.min) seen.min = value;
}

/** The longest text the column's extremes format to — its natural width. */
function widestText(extremes: ColumnExtremes, lang: string): string {
  let widest = '';
  for (const [precision, { max, min }] of extremes) {
    const nf = numberFormatter(lang, precision);
    for (const value of [max, min]) {
      const text = nf.format(value);
      if (text.length > widest.length) widest = text;
    }
  }
  return widest;
}

/** Widest text every column of the table would render, across all sections. */
interface ColumnText {
  label: string;
  days: string[];
  summary: { mean: string; min: string; max: string };
  total: string;
}

/** Empty cells hold a non-breaking space so they keep height and borders. */
export const NBSP = ' ';

/** Default decimal places used when a row config does not set `precision`. */
export const DEFAULT_PRECISION = 1;

/** Effective precision for a row: explicit `precision` if set, else the default. */
export function resolvePrecision(cfg: { precision?: number }): number {
  return cfg.precision ?? DEFAULT_PRECISION;
}

/**
 * One month-of-a-year data slice. When `monthSegments` is set, the table hosts
 * sections that may span different years (month comparison view, spec 014) —
 * all inside ONE table so every section shares the same day-column widths.
 */
export interface MonthSegment {
  year: number;
  month: number;
  dailyValues: DailyValueIndex;
  monthlySummaries: Map<string, MonthlySummary>;
  entityMetadata: Map<string, EntityMetadata>;
}

@customElement('calendar-stats-year-table')
export class YearTable extends LitElement {
  @property({ type: Number }) year = 2025;
  /** When true, the year is shown alongside each month name (for multi-year ranges). */
  @property({ type: Boolean }) showYear = false;
  @property({ attribute: false }) visibleMonths: number[] = [];
  /** When true, each month name is a button that opens the month comparison. */
  @property({ type: Boolean }) monthSelectable = false;
  /** Cross-year section mode (spec 014): overrides year/visibleMonths/dailyValues/
   *  monthlySummaries/entityMetadata; each section's header names month AND year. */
  @property({ attribute: false }) monthSegments: MonthSegment[] | null = null;
  @property({ attribute: false }) entityConfigs: EntityConfig[] = [];
  @property({ attribute: false }) dailyValues: DailyValueIndex = new DailyValueIndex();
  @property({ attribute: false }) monthlySummaries: Map<string, MonthlySummary> = new Map();
  @property({ attribute: false }) entityMetadata: Map<string, EntityMetadata> = new Map();
  @property({ attribute: false }) entityErrors: Set<string> = new Set();
  @property({ type: String }) lang = 'en';

  private _sectionsMemo: { deps: readonly unknown[]; value: MonthSegment[] } | null = null;

  /**
   * Normalized section list — single-year (monthly view) or cross-year
   * (comparison). Reused while the inputs are identical: callers key their own
   * memos on this array, and the single-year branch would otherwise hand out a
   * fresh one on every render.
   */
  private _sections(): MonthSegment[] {
    const deps = [
      this.monthSegments, this.visibleMonths, this.year,
      this.dailyValues, this.monthlySummaries, this.entityMetadata,
    ] as const;
    const memo = this._sectionsMemo;
    if (memo && memo.deps.every((d, i) => d === deps[i])) return memo.value;

    const value = this.monthSegments && this.monthSegments.length > 0
      ? this.monthSegments
      : this.visibleMonths.map((month) => ({
        year: this.year,
        month,
        dailyValues: this.dailyValues,
        monthlySummaries: this.monthlySummaries,
        entityMetadata: this.entityMetadata,
      }));
    this._sectionsMemo = { deps, value };
    return value;
  }

  /** Metadata lookup across all sections (column structure must match everywhere). */
  private _metaFor(sections: MonthSegment[], key: string): EntityMetadata | undefined {
    for (const sec of sections) {
      const meta = sec.entityMetadata.get(key);
      if (meta) return meta;
    }
    return undefined;
  }

  /** Triggered threshold rules grouped by entity row index (preserves config order). */
  private _legend = new ThresholdLegendCollector();
  /** Shared auto-contrast text-color resolver for threshold-colored cells. */
  private _contrast = new ContrastResolver();

  /** Sections rendered in full; the rest stand in as one hidden placeholder row. */
  private _mountedSections = new Set<number>();
  /** Identity of the section list the mounted set belongs to. */
  private _sectionsKey = '';
  /** Measured height of one data row, until then an estimate. */
  private _rowHeight = ESTIMATED_ROW_HEIGHT;
  private _viewportFrame = new FrameScheduler();

  /**
   * Scrolling never updates the component, so the section pass is driven from
   * the viewport itself. Capture phase: a Lovelace view may scroll an ancestor
   * element rather than the document, and scroll events do not bubble.
   */
  override connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('scroll', this._onViewportChange, { passive: true, capture: true });
    window.addEventListener('resize', this._onViewportChange, { passive: true });
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('scroll', this._onViewportChange, { capture: true });
    window.removeEventListener('resize', this._onViewportChange);
    this._layoutFrame.cancel();
    this._scrollFrame.cancel();
    this._viewportFrame.cancel();
    this._contrast.dispose();
  }

  private _onViewportChange = (): void => {
    this._viewportFrame.schedule(() => this._syncVisibleSections());
  };

  static styles = css`
    :host {
      display: block;
    }
    .table-container {
      overflow-x: auto;
      /* The visible horizontal scrollbar is the viewport-sticky twin below —
         hide the container's own to avoid doubling. */
      scrollbar-width: none;
    }
    .table-container::-webkit-scrollbar {
      display: none;
    }
    .sticky-scrollbar {
      position: sticky;
      bottom: 0;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: thin;
    }
    .sticky-scrollbar-spacer {
      height: 1px;
    }
    table {
      border-collapse: collapse;
      white-space: nowrap;
      -webkit-user-select: text;
      user-select: text;
    }
    th, td {
      padding: 1px 3px;
    }
    tbody tr {
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
    }
    tbody tr.sub-row td.sub-label {
      border-bottom: hidden;
    }
    td.data-cell {
      padding: 1px 3px;
      color: var(--primary-text-color);
      text-align: right;
      min-width: 20px;
      border-left: 1px solid var(--divider-color, #ccc);
      border-right: 1px solid var(--divider-color, #ccc);
    }
    td.pad-cell, th.pad-cell {
      min-width: 20px;
      padding: 1px 3px;
      background: var(--secondary-background-color, #f5f5f5);
      opacity: 0.3;
    }
    .label-column {
      position: sticky;
      left: 0;
      z-index: 1;
      background: var(--card-background-color, #fff);
      color: var(--secondary-text-color);
      white-space: nowrap;
      padding: 1px 6px 1px 4px;
      vertical-align: top;
    }
    .month-header-row th {
      font-weight: normal;
      font-size: 0.9em;
      color: var(--secondary-text-color);
      text-align: center;
      padding: 1px 3px;
      background: var(--secondary-background-color, #f0f0f0);
      border-bottom: 1px solid var(--divider-color, #ccc);
    }
    .month-header-row th.month-name {
      font-weight: bold;
      font-size: 1em;
      color: var(--primary-text-color);
      text-align: left;
      padding: 4px 6px;
      position: sticky;
      left: 0;
      z-index: 1;
    }
    .month-header-row th.month-name button.month-select {
      background: none;
      border: none;
      padding: 0;
      margin: 0;
      font: inherit;
      color: inherit;
      cursor: pointer;
      text-decoration: underline dotted;
      text-underline-offset: 2px;
      border-radius: 3px;
    }
    .month-header-row th.month-name button.month-select:hover,
    .month-header-row th.month-name button.month-select:focus-visible {
      outline: none;
      background: var(--divider-color, rgba(0, 0, 0, 0.12));
    }
    .month-header-row th.pad-cell {
      opacity: 1;
    }
    .month-header-row th.summary-column {
      font-weight: bold;
    }
    .col-header th {
      text-align: center;
      padding: 1px 3px;
      color: var(--secondary-text-color);
      font-size: 0.9em;
      border-bottom: 2px solid var(--divider-color, #ccc);
    }
    .col-header .label-column {
      font-size: 1em;
      font-weight: normal;
    }
    .summary-column {
      color: var(--secondary-text-color);
      border: 1px solid var(--divider-color, #ccc);
      text-align: right;
      padding: 1px 3px;
    }
    .cumul-summary {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      white-space: nowrap;
    }
    .cumul-minmax {
      display: flex;
      justify-content: space-between;
      gap: 4px;
      width: 100%;
      font-size: 0.85em;
      opacity: 0.8;
    }
    .sub-label {
      position: sticky;
      left: var(--label-col-width, 0px);
      z-index: 1;
      background: var(--card-background-color, #fff);
      text-align: right;
      color: var(--secondary-text-color);
      font-size: 0.8em;
      padding: 1px 4px;
      white-space: nowrap;
    }
    td.sub-label,
    td.label-column[colspan="2"] {
      border-right: 1px solid var(--divider-color, #ccc);
    }
    th.sunday {
      font-weight: bold;
    }
    /* Stands in for a section that is out of view: hidden, but still sized, so
       the table's auto-laid-out columns keep the widths they would have with
       every section rendered. */
    tr.section-placeholder {
      visibility: hidden;
    }
  `;


  /** Both scroll containers, resolved once — the template never replaces them. */
  private _container: HTMLElement | null = null;
  private _sticky: HTMLElement | null = null;
  private _scrollFrame = new FrameScheduler();

  /**
   * Keeps the sticky scrollbar and the (scrollbar-less) table container in
   * lockstep. Registered here rather than through a template binding so the
   * listeners are passive: a non-passive scroll listener on the element being
   * scrolled blocks the compositor for the whole gesture.
   */
  override firstUpdated(): void {
    const container = this.shadowRoot?.querySelector<HTMLElement>('.table-container') ?? null;
    const sticky = this.shadowRoot?.querySelector<HTMLElement>('.sticky-scrollbar') ?? null;
    this._container = container;
    this._sticky = sticky;
    if (!container || !sticky) return;
    container.addEventListener('scroll', () => this._mirrorScroll(container, sticky), { passive: true });
    sticky.addEventListener('scroll', () => this._mirrorScroll(sticky, container), { passive: true });
  }

  /**
   * Mirrors one scroll position onto the other on the next frame. A gesture
   * fires scroll events faster than the browser paints, and the mirrored write
   * echoes back as another scroll event, so the work is coalesced into one
   * frame and skipped once both sides agree.
   */
  private _mirrorScroll(from: HTMLElement, to: HTMLElement): void {
    this._scrollFrame.schedule(() => {
      if (to.scrollLeft !== from.scrollLeft) to.scrollLeft = from.scrollLeft;
    });
  }

  private _layoutFrame = new FrameScheduler();
  private _lastLabelWidth = '';
  private _lastSpacerWidth = '';

  private _rowCount = 0;

  /**
   * Starts the mounted set over when the section list itself changed. Before
   * anything is laid out the estimate decides — a short table mounts whole, a
   * long one mounts its first screenful — and the frame pass corrects it
   * against real positions.
   */
  private _resetMountedSections(sections: MonthSegment[], rowCount: number): void {
    const key = sections.map((sec) => `${sec.year}-${sec.month}`).join(',');
    if (key === this._sectionsKey) return;
    this._sectionsKey = key;
    this._mountedSections = new Set();
    const viewport = viewportHeight();
    const sectionHeight = Math.max(ESTIMATED_HEADER_HEIGHT + rowCount * this._rowHeight, 1);
    // A viewport of zero means the document cannot place anything yet, which
    // rules nothing out: render it all rather than guess at one section.
    const initial = viewport > 0
      ? Math.max(1, Math.ceil((viewport * (1 + MOUNT_VIEWPORTS)) / sectionHeight))
      : sections.length;
    for (let i = 0; i < Math.min(sections.length, initial); i++) this._mountedSections.add(i);
  }

  /**
   * Renders the sections near the viewport and releases those far outside it.
   * A layout that reports nothing — every rect at the origin — rules nothing
   * out, so everything stays rendered.
   */
  private _syncVisibleSections(): void {
    const bodies = this.shadowRoot?.querySelectorAll<HTMLElement>('tbody[data-section]');
    if (!bodies || bodies.length === 0) return;
    const viewport = viewportHeight();
    if (viewport === 0) return;
    const mount = viewport * MOUNT_VIEWPORTS;
    const release = viewport * UNMOUNT_VIEWPORTS;
    let changed = false;
    for (const body of bodies) {
      const index = Number(body.dataset.section);
      const rect = body.getBoundingClientRect();
      const mounted = this._mountedSections.has(index);
      if (!mounted && rect.top <= viewport + mount && rect.bottom >= -mount) {
        this._mountedSections.add(index);
        changed = true;
      } else if (mounted && (rect.top > viewport + release || rect.bottom < -release)) {
        this._mountedSections.delete(index);
        changed = true;
      }
    }
    if (changed) this.requestUpdate();
  }

  /** Learns the real row height from a rendered section so placeholders match it. */
  private _measureRowHeight(): void {
    if (this._rowCount === 0) return;
    const rendered = this.shadowRoot?.querySelector<HTMLElement>('tbody[data-section]:not([data-placeholder])');
    if (!rendered) return;
    const height = rendered.getBoundingClientRect().height / this._rowCount;
    if (height > 0 && Math.abs(height - this._rowHeight) > 0.5) {
      this._rowHeight = height;
      this.requestUpdate();
    }
  }

  /**
   * Measures the sticky column and the scroll width. Runs on an animation
   * frame, not in `updated()`, so a table of thousands of cells is not laid
   * out synchronously on every render; both reads happen before either write,
   * and unchanged values are not written back at all.
   */
  private _syncWidths(): void {
    const labelCol = this.shadowRoot?.querySelector<HTMLElement>('td.label-column[rowspan]');
    const container = this._container;
    const spacer = this._sticky?.firstElementChild as HTMLElement | null;
    const labelWidth = labelCol ? `${labelCol.getBoundingClientRect().width}px` : null;
    // The sticky scrollbar's spacer matches the table's scroll width so both
    // scroll areas share the same range (no overflow → scrollbar auto-hides).
    const spacerWidth = container && spacer ? `${container.scrollWidth}px` : null;
    if (labelWidth !== null && labelWidth !== this._lastLabelWidth) {
      this._lastLabelWidth = labelWidth;
      this.style.setProperty('--label-col-width', labelWidth);
    }
    if (spacerWidth !== null && spacer && spacerWidth !== this._lastSpacerWidth) {
      this._lastSpacerWidth = spacerWidth;
      spacer.style.setProperty('width', spacerWidth);
    }
  }

  override updated() {
    this._layoutFrame.schedule(() => {
      this._syncVisibleSections();
      this._measureRowHeight();
      this._syncWidths();
    });
    const groups = this._legend.changes();
    if (groups) {
      this.dispatchEvent(new CustomEvent('thresholds-applied', {
        bubbles: true,
        composed: true,
        detail: { groups },
      }));
    }
  }

  private daysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
  }

  private dateStr(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private monthName(month: number): string {
    return monthNameFormatter(this.lang).format(new Date(2020, month - 1, 1));
  }

  private _renderMonthName(sec: MonthSegment, withYear: boolean) {
    const name = this.monthName(sec.month);
    const text = withYear ? `${name} ${sec.year}` : name;
    if (!this.monthSelectable) return text;
    const ariaLabel = localize('comparison.compare_month', this.lang).replace('{month}', name);
    return html`<button class="month-select" aria-label=${ariaLabel} @click=${() => this._onMonthSelect(sec.month)}>${text}</button>`;
  }

  private _onMonthSelect(month: number): void {
    this.dispatchEvent(new CustomEvent('calendar-stats-month-select', {
      bubbles: true,
      composed: true,
      detail: { month },
    }));
  }

  private hasCumulative(sections: MonthSegment[]): boolean {
    return this.entityConfigs.some((cfg) => {
      const meta = this._metaFor(sections, rowKey(cfg));
      return meta && meta.stateClass !== 'measurement';
    });
  }

  private hasMeasurement(sections: MonthSegment[]): boolean {
    return this.entityConfigs.some((cfg) => {
      const meta = this._metaFor(sections, rowKey(cfg));
      return meta?.stateClass === 'measurement';
    });
  }

  /** Date keys of the section's 31 day columns, built once and shared by every row. */
  private dayKeys(year: number, month: number): string[] {
    const keys: string[] = [];
    for (let d = 1; d <= TOTAL_DAYS; d++) keys.push(this.dateStr(year, month, d));
    return keys;
  }

  private _dayKeysMemo: { sections: MonthSegment[]; value: string[][] } | null = null;

  /**
   * Every section's day keys, rebuilt only when the section list itself
   * changes. The dates a section covers do not depend on anything else, and
   * rebuilding them per render is 31 strings per month on the render path.
   */
  private _sectionDayKeys(sections: MonthSegment[]): string[][] {
    const memo = this._dayKeysMemo;
    if (memo && memo.sections === sections) return memo.value;
    const value = sections.map((sec) => this.dayKeys(sec.year, sec.month));
    this._dayKeysMemo = { sections, value };
    return value;
  }

  private _columnTextMemo: { deps: readonly unknown[]; value: ColumnText } | null = null;

  /**
   * Widest text each column of the whole table would render. A placeholder row
   * carries these, so a column is exactly as wide as it would be with every
   * section rendered — mounting a section never shifts the layout.
   *
   * Values are compared as numbers and only the winners are formatted: doing it
   * the other way round would format every cell of every section, which is the
   * work the placeholders exist to avoid.
   */
  private _columnText(sections: MonthSegment[]): ColumnText {
    const deps = [sections, this.entityConfigs, this.lang, this.entityErrors] as const;
    const memo = this._columnTextMemo;
    if (memo && memo.deps.length === deps.length && memo.deps.every((d, i) => d === deps[i])) {
      return memo.value;
    }

    const days: ColumnExtremes[] = Array.from({ length: TOTAL_DAYS }, () => new Map());
    const mean: ColumnExtremes = new Map();
    const low: ColumnExtremes = new Map();
    const high: ColumnExtremes = new Map();
    const total: ColumnExtremes = new Map();
    let label = '';

    const dayKeysBySection = this._sectionDayKeys(sections);
    this._legend.keepSections(sections.length);
    sections.forEach((sec, sectionIndex) => {
      const dayKeys = dayKeysBySection[sectionIndex]!;
      this.entityConfigs.forEach((cfg, rowIndex) => {
        const key = rowKey(cfg);
        const meta = sec.entityMetadata.get(key);
        const precision = resolvePrecision(cfg);
        const f = ('factor' in cfg && cfg.factor != null) ? cfg.factor : 1;
        const text = `${meta?.hasStatistics ?? true ? '' : '⚠ '}${rowLabel(cfg, meta)}`;
        if (text.length > label.length) label = text;

        const dayRow = sec.dailyValues.row(key);
        if (dayRow) {
          for (let d = 0; d < TOTAL_DAYS; d++) {
            const val = dayRow.get(dayKeys[d]!);
            if (val?.kind === 'cumulative') note(days[d]!, precision, val.sum * f);
            else if (val?.kind === 'measurement') {
              note(days[d]!, precision, val.min * f);
              note(days[d]!, precision, val.mean * f);
              note(days[d]!, precision, val.max * f);
            }
          }
        }

        const summary = sec.monthlySummaries.get(rowSummaryKey(rowIndex, key, sec.year, sec.month));
        if (!summary) return;
        if (summary.mean != null) note(mean, precision, summary.mean * f);
        if (summary.min != null) note(low, precision, summary.min * f);
        if (summary.max != null) note(high, precision, summary.max * f);
        if (summary.total != null) note(total, precision, summary.total * f);
      });
    });

    const value: ColumnText = {
      label,
      days: days.map((extremes) => widestText(extremes, this.lang)),
      summary: {
        mean: widestText(mean, this.lang),
        min: widestText(low, this.lang),
        max: widestText(high, this.lang),
      },
      total: widestText(total, this.lang),
    };
    this._columnTextMemo = { deps, value };
    return value;
  }

  /** Number of rows a fully rendered section occupies. */
  private _sectionRowCount(sections: MonthSegment[]): number {
    return this.entityConfigs.reduce((rows, cfg) => {
      const meta = this._metaFor(sections, rowKey(cfg));
      if (meta?.stateClass !== 'measurement') return rows + 1;
      const erc = 'entity' in cfg ? cfg : null;
      const subRows = (erc?.show_min !== false ? 1 : 0)
        + (erc?.show_avg !== false ? 1 : 0)
        + (erc?.show_max !== false ? 1 : 0);
      return rows + Math.max(subRows, 1);
    }, 0);
  }

  /** The hidden stand-in for a section that is out of view. */
  private renderSectionPlaceholder(sections: MonthSegment[], rowCount: number, hasMeasurement: boolean, hasCumulative: boolean) {
    const text = this._columnText(sections);
    return html`
      <tr class="section-placeholder" aria-hidden="true" style="height:${rowCount * this._rowHeight}px">
        <td class="label-column" colspan="${hasMeasurement ? 2 : 1}">${text.label || NBSP}</td>
        ${text.days.map((day) => html`<td class="data-cell">${day || NBSP}</td>`)}
        <td class="summary-column">${hasCumulative
          ? html`<div class="cumul-summary">
              <div>Ø${text.summary.mean}</div>
              <div class="cumul-minmax"><span>↓${text.summary.min}</span><span>↑${text.summary.max}</span></div>
            </div>`
          : (text.summary.mean || NBSP)}</td>
        ${hasCumulative ? html`<td class="summary-column">${text.total || NBSP}</td>` : ''}
      </tr>
    `;
  }

  private renderEntityRows(cfg: EntityConfig, rowIndex: number, sec: MonthSegment, days: number, hasMeasurement: boolean, hasCumulative: boolean, dayKeys: string[]) {
    const { year, month } = sec;
    const key = rowKey(cfg);
    const precision = resolvePrecision(cfg);
    const nf = numberFormatter(this.lang, precision);
    const meta = sec.entityMetadata.get(key);
    // One lookup for the row's whole month — day cells read the inner map directly.
    const dayRow = sec.dailyValues.row(key);
    const groupLabel = rowLabel(cfg, meta);
    const f = ('factor' in cfg && cfg.factor != null) ? cfg.factor : 1;
    const hasStats = meta?.hasStatistics ?? true;
    const hasError = this.entityErrors.has(key);
    const isMeasurement = meta?.stateClass === 'measurement';
    const summaryKey = rowSummaryKey(rowIndex, key, year, month);
    const summary = sec.monthlySummaries.get(summaryKey);

    const staticStyle = buildCellStyle(
      cfg.text_color,
      cfg.background_color,
      undefined,
      this._contrast.textFor(cfg.background_color),
    );

    if (isMeasurement && !hasError) {
      const erc = 'entity' in cfg ? cfg : null;
      const showMin = erc?.show_min !== false;
      const showAvg = erc?.show_avg !== false;
      const showMax = erc?.show_max !== false;
      const visibleRows: Array<'min' | 'avg' | 'max'> = [];
      if (showMin) visibleRows.push('min');
      if (showAvg) visibleRows.push('avg');
      if (showMax) visibleRows.push('max');

      const minCells = [];
      const meanCells = [];
      const maxCells = [];
      for (let d = 1; d <= TOTAL_DAYS; d++) {
        if (d > days) {
          minCells.push(html`<td class="pad-cell" style=${ifDefined(staticStyle)}></td>`);
          meanCells.push(html`<td class="pad-cell" style=${ifDefined(staticStyle)}></td>`);
          maxCells.push(html`<td class="pad-cell" style=${ifDefined(staticStyle)}></td>`);
          continue;
        }
        const val = dayRow?.get(dayKeys[d - 1]!);
        if (val?.kind === 'measurement') {
          const showZero = cfg.show_zero !== false;
          const minV = val.min * f;
          const meanV = val.mean * f;
          const maxV = val.max * f;

          if (minV === 0 && !showZero) {
            minCells.push(html`<td class="data-cell" style=${ifDefined(staticStyle)}>${NBSP}</td>`);
          } else {
            const minRule = resolveThreshold(minV, cfg.thresholds ?? EMPTY_THRESHOLDS, 'min', 'day');
            if (minRule) this._legend.add(rowIndex, groupLabel, minRule);
            const minStyle = buildCellStyle(cfg.text_color, cfg.background_color, minRule, this._contrast.textFor(minRule?.background_color ?? cfg.background_color));
            minCells.push(html`<td class="data-cell has-data" style=${ifDefined(minStyle)}>${nf.format(minV)}</td>`);
          }

          if (meanV === 0 && !showZero) {
            meanCells.push(html`<td class="data-cell" style=${ifDefined(staticStyle)}>${NBSP}</td>`);
          } else {
            const avgRule = resolveThreshold(meanV, cfg.thresholds ?? EMPTY_THRESHOLDS, 'avg', 'day');
            if (avgRule) this._legend.add(rowIndex, groupLabel, avgRule);
            const avgStyle = buildCellStyle(cfg.text_color, cfg.background_color, avgRule, this._contrast.textFor(avgRule?.background_color ?? cfg.background_color));
            meanCells.push(html`<td class="data-cell has-data" style=${ifDefined(avgStyle)}>${nf.format(meanV)}</td>`);
          }

          if (maxV === 0 && !showZero) {
            maxCells.push(html`<td class="data-cell" style=${ifDefined(staticStyle)}>${NBSP}</td>`);
          } else {
            const maxRule = resolveThreshold(maxV, cfg.thresholds ?? EMPTY_THRESHOLDS, 'max', 'day');
            if (maxRule) this._legend.add(rowIndex, groupLabel, maxRule);
            const maxStyle = buildCellStyle(cfg.text_color, cfg.background_color, maxRule, this._contrast.textFor(maxRule?.background_color ?? cfg.background_color));
            maxCells.push(html`<td class="data-cell has-data" style=${ifDefined(maxStyle)}>${nf.format(maxV)}</td>`);
          }
        } else {
          minCells.push(html`<td class="data-cell" style=${ifDefined(staticStyle)}>${NBSP}</td>`);
          meanCells.push(html`<td class="data-cell" style=${ifDefined(staticStyle)}>${NBSP}</td>`);
          maxCells.push(html`<td class="data-cell" style=${ifDefined(staticStyle)}>${NBSP}</td>`);
        }
      }

      if (visibleRows.length === 0) {
        return html`
          <tr>
            <td class="label-column" style=${ifDefined(staticStyle)}>${hasStats ? '' : '⚠ '}${groupLabel}</td>
          </tr>
        `;
      }

      const rowspan = visibleRows.length;
      const cells = { min: minCells, avg: meanCells, max: maxCells } as const;
      const summaryVals = {
        min: summary?.min != null ? nf.format(summary.min * f) : NBSP,
        avg: summary?.mean != null ? nf.format(summary.mean * f) : NBSP,
        max: summary?.max != null ? nf.format(summary.max * f) : NBSP,
      };
      const summaryStyles: Record<'min' | 'avg' | 'max', string | undefined> = {
        min: staticStyle,
        avg: staticStyle,
        max: staticStyle,
      };
      if (summary) {
        const rawSummaryVals = {
          min: summary.min != null ? summary.min * f : null,
          avg: summary.mean != null ? summary.mean * f : null,
          max: summary.max != null ? summary.max * f : null,
        };
        for (const row of visibleRows) {
          const v = rawSummaryVals[row];
          if (v != null) {
            const role = row === 'min' ? 'summary-min' : row === 'avg' ? 'summary-avg' : 'summary-max';
            const rule = resolveThreshold(v, cfg.thresholds ?? EMPTY_THRESHOLDS, role, 'day');
            if (rule) this._legend.add(rowIndex, groupLabel, rule);
            summaryStyles[row] = buildCellStyle(cfg.text_color, cfg.background_color, rule, this._contrast.textFor(rule?.background_color ?? cfg.background_color));
          }
        }
      }

      return html`${visibleRows.map((row, idx) => html`
        <tr class="${idx < visibleRows.length - 1 ? 'sub-row' : ''}">
          ${idx === 0 ? html`<td class="label-column" rowspan="${rowspan}" style=${ifDefined(staticStyle)}>${hasStats ? '' : '⚠ '}${groupLabel}</td>` : ''}
          <td class="sub-label" style=${ifDefined(staticStyle)}>${localize(row === 'min' ? 'summary.min' : row === 'avg' ? 'summary.avg' : 'summary.max', this.lang)}</td>
          ${cells[row]}
          <td class="summary-column" style=${ifDefined(summaryStyles[row])}>${summaryVals[row]}</td>
          ${hasCumulative ? html`<td class="summary-column" style=${ifDefined(staticStyle)}>${NBSP}</td>` : ''}
        </tr>
      `)}`;
    }

    // Cumulative entity — single row
    const dayCells = [];
    for (let d = 1; d <= TOTAL_DAYS; d++) {
      if (d > days) {
        dayCells.push(html`<td class="pad-cell" style=${ifDefined(staticStyle)}></td>`);
        continue;
      }
      const val = dayRow?.get(dayKeys[d - 1]!);
      let cellContent = '';
      let numericValue: number | undefined;
      if (hasError) {
        cellContent = '—';
      } else if (!hasStats) {
        // no content
      } else if (val?.kind === 'cumulative') {
        const v = val.sum * f;
        numericValue = v;
        if (v !== 0 || cfg.show_zero !== false) {
          cellContent = nf.format(v);
        }
      }
      let cellStyle = staticStyle;
      if (numericValue !== undefined) {
        const rule = resolveThreshold(numericValue, cfg.thresholds ?? EMPTY_THRESHOLDS, 'scalar', 'day');
        if (rule) this._legend.add(rowIndex, groupLabel, rule);
        cellStyle = buildCellStyle(cfg.text_color, cfg.background_color, rule, this._contrast.textFor(rule?.background_color ?? cfg.background_color));
      }
      dayCells.push(html`<td class="data-cell ${cellContent ? 'has-data' : ''}" style=${ifDefined(cellStyle)}>${cellContent || NBSP}</td>`);
    }

    const cumulErc = 'entity' in cfg ? cfg : null;
    const showMin = cumulErc?.show_min !== false;
    const showAvg = cumulErc?.show_avg !== false;
    const showMax = cumulErc?.show_max !== false;
    const summaryContent = (summary && (showMin || showAvg || showMax))
      ? html`<div class="cumul-summary">
          ${showAvg ? html`<div>${summary.mean != null ? `Ø${nf.format(summary.mean * f)}` : ''}</div>` : ''}
          ${(showMin || showMax) ? html`<div class="cumul-minmax">
            ${showMin ? html`<span>${summary.min != null ? `↓${nf.format(summary.min * f)}` : ''}</span>` : ''}
            ${showMax ? html`<span>${summary.max != null ? `↑${nf.format(summary.max * f)}` : ''}</span>` : ''}
          </div>` : ''}
        </div>`
      : NBSP;
    const totalContent = summary?.total != null ? nf.format(summary.total * f) : NBSP;

    let cumulSummaryStyle = staticStyle;
    // Monthly total is a month-scale sum — colorable by month-scope rules (015).
    let cumulTotalStyle = staticStyle;
    if (summary?.total != null) {
      const rule = resolveThreshold(summary.total * f, cfg.thresholds ?? EMPTY_THRESHOLDS, 'scalar', 'month');
      if (rule) this._legend.add(rowIndex, groupLabel, rule);
      cumulTotalStyle = buildCellStyle(cfg.text_color, cfg.background_color, rule, this._contrast.textFor(rule?.background_color ?? cfg.background_color));
    }
    if (summary?.mean != null && (showMin || showAvg || showMax)) {
      const rule = resolveThreshold(summary.mean * f, cfg.thresholds ?? EMPTY_THRESHOLDS, 'summary-scalar', 'day');
      if (rule) this._legend.add(rowIndex, groupLabel, rule);
      cumulSummaryStyle = buildCellStyle(cfg.text_color, cfg.background_color, rule, this._contrast.textFor(rule?.background_color ?? cfg.background_color));
    }

    return html`
      <tr>
        <td class="label-column" colspan="${hasMeasurement ? 2 : 1}" style=${ifDefined(staticStyle)}>${hasStats ? '' : '⚠ '}${groupLabel}</td>
        ${dayCells}
        <td class="summary-column" style=${ifDefined(cumulSummaryStyle)}>${summaryContent}</td>
        <td class="summary-column" style=${ifDefined(cumulTotalStyle)}>${totalContent}</td>
      </tr>
    `;
  }

  render() {
    // One scan of the sections feeds every column decision below; recomputing
    // it per row would rescan every section for every row.
    const sections = this._sections();
    const hasCumulative = this.hasCumulative(sections);
    const hasMeasurement = this.hasMeasurement(sections);
    const rowCount = this._sectionRowCount(sections);
    const dayKeysBySection = this._sectionDayKeys(sections);
    this._rowCount = rowCount;
    this._resetMountedSections(sections, rowCount);
    // Cross-year section mode always shows the year in the month header.
    const withYear = this.showYear || (this.monthSegments?.length ?? 0) > 0;

    return html`
      <div class="table-container">
        <table>
          ${sections.map((sec, sectionIndex) => {
            const mounted = this._mountedSections.has(sectionIndex);
            // Re-render a section only when something about it changed: a mount
            // would otherwise rebuild every other mounted section with it, which
            // makes scrolling cost more the more of the table is on screen.
            return guard([
              sec, mounted, rowCount, hasMeasurement, hasCumulative, withYear,
              this.monthSelectable, this.lang, this.entityConfigs, this.entityErrors, this._rowHeight,
            ], () => this._renderSection(
              sec, sectionIndex, mounted, dayKeysBySection[sectionIndex]!,
              sections, rowCount, hasMeasurement, hasCumulative, withYear,
            ));
          })}
        </table>
      </div>
      <div class="sticky-scrollbar">
        <div class="sticky-scrollbar-spacer"></div>
      </div>
    `;
  }

  /** One month section: its header row and either its rows or a placeholder. */
  private _renderSection(
    sec: MonthSegment,
    sectionIndex: number,
    mounted: boolean,
    dayKeys: string[],
    sections: MonthSegment[],
    rowCount: number,
    hasMeasurement: boolean,
    hasCumulative: boolean,
    withYear: boolean,
  ) {
    this._legend.beginSection(sectionIndex);
    const days = this.daysInMonth(sec.year, sec.month);
    // Weekday of the 1st, then count forward — one Date per month instead of one per day.
    const firstWeekday = new Date(sec.year, sec.month - 1, 1).getDay();
    const dayHeaders = [];
    for (let d = 1; d <= TOTAL_DAYS; d++) {
      if (d > days) {
        dayHeaders.push(html`<th class="pad-cell"></th>`);
      } else {
        const isSunday = (firstWeekday + d - 1) % 7 === 0;
        dayHeaders.push(html`<th class="${isSunday ? 'sunday' : ''}">${d}</th>`);
      }
    }
    return html`
      <thead>
        <tr class="month-header-row">
          <th class="label-column month-name" colspan="${hasMeasurement ? 2 : 1}">${this._renderMonthName(sec, withYear)}</th>
          ${dayHeaders}
          <th class="summary-column">${localize('table.summary', this.lang)}</th>
          ${hasCumulative ? html`<th class="summary-column">${localize('table.total', this.lang)}</th>` : ''}
        </tr>
      </thead>
      <tbody data-section="${sectionIndex}" ?data-placeholder=${!mounted}>
        ${mounted
          ? this.entityConfigs.map((cfg, i) => this.renderEntityRows(cfg, i, sec, days, hasMeasurement, hasCumulative, dayKeys))
          : this.renderSectionPlaceholder(sections, rowCount, hasMeasurement, hasCumulative)}
      </tbody>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-year-table': YearTable;
  }
}
