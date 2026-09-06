import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { EntityConfig, ThresholdRule, ThresholdLegendGroup } from '../types/card-config';
import { rowKey } from '../types/card-config';
import type { DailyValue, MonthlySummary, EntityMetadata } from '../types/statistics';
import { localize } from '../localize/localize';
import { resolveThreshold, buildCellStyle } from '../services/threshold-resolver';
import { ContrastResolver } from '../services/readable-text';
import { rowSummaryKey } from '../services/data-transform';
import { rowLabel } from '../services/row-label';
import { FrameScheduler } from '../services/frame-scheduler';
import { numberFormatter, monthNameFormatter } from '../services/formatters';

const TOTAL_DAYS = 31;

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
  dailyValues: Map<string, DailyValue>;
  monthlySummaries: Map<string, MonthlySummary>;
  entityMetadata: Map<string, EntityMetadata>;
}

@customElement('calendar-stats-year-table')
export class YearTable extends LitElement {
  @property({ type: Number }) year = 2025;
  /** When true, the year is shown alongside each month name (for multi-year ranges). */
  @property({ type: Boolean }) showYear = false;
  @property({ attribute: false }) visibleMonths: number[] = [];
  /** Cross-year section mode (spec 014): overrides year/visibleMonths/dailyValues/
   *  monthlySummaries/entityMetadata; each section's header names month AND year. */
  @property({ attribute: false }) monthSegments: MonthSegment[] | null = null;
  @property({ attribute: false }) entityConfigs: EntityConfig[] = [];
  @property({ attribute: false }) dailyValues: Map<string, DailyValue> = new Map();
  @property({ attribute: false }) monthlySummaries: Map<string, MonthlySummary> = new Map();
  @property({ attribute: false }) entityMetadata: Map<string, EntityMetadata> = new Map();
  @property({ attribute: false }) entityErrors: Set<string> = new Set();
  @property({ type: String }) lang = 'en';

  /** Normalized section list — single-year (monthly view) or cross-year (comparison). */
  private _sections(): MonthSegment[] {
    if (this.monthSegments && this.monthSegments.length > 0) return this.monthSegments;
    return this.visibleMonths.map((month) => ({
      year: this.year,
      month,
      dailyValues: this.dailyValues,
      monthlySummaries: this.monthlySummaries,
      entityMetadata: this.entityMetadata,
    }));
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
  private _triggeredGroups = new Map<number, { label: string; rules: Set<ThresholdRule> }>();

  private _addTriggered(rowIndex: number, label: string, rule: ThresholdRule): void {
    let g = this._triggeredGroups.get(rowIndex);
    if (!g) {
      g = { label, rules: new Set() };
      this._triggeredGroups.set(rowIndex, g);
    }
    g.rules.add(rule);
  }

  /** Shared auto-contrast text-color resolver for threshold-colored cells. */
  private _contrast = new ContrastResolver();

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._layoutFrame.cancel();
    this._contrast.dispose();
  }

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
  `;

  private _lastDispatchedGroups: ThresholdLegendGroup[] = [];

  /** Keep the sticky scrollbar and the (scrollbar-less) table container in lockstep. */
  private _onContainerScroll = (): void => {
    const container = this.shadowRoot?.querySelector<HTMLElement>('.table-container');
    const sticky = this.shadowRoot?.querySelector<HTMLElement>('.sticky-scrollbar');
    if (container && sticky && sticky.scrollLeft !== container.scrollLeft) {
      sticky.scrollLeft = container.scrollLeft;
    }
  };

  private _onStickyScroll = (): void => {
    const container = this.shadowRoot?.querySelector<HTMLElement>('.table-container');
    const sticky = this.shadowRoot?.querySelector<HTMLElement>('.sticky-scrollbar');
    if (container && sticky && container.scrollLeft !== sticky.scrollLeft) {
      container.scrollLeft = sticky.scrollLeft;
    }
  };

  private _layoutFrame = new FrameScheduler();
  private _lastLabelWidth = '';
  private _lastSpacerWidth = '';

  /**
   * Measures the sticky column and the scroll width. Runs on an animation
   * frame, not in `updated()`, so a table of thousands of cells is not laid
   * out synchronously on every render; both reads happen before either write,
   * and unchanged values are not written back at all.
   */
  private _syncWidths(): void {
    const labelCol = this.shadowRoot?.querySelector<HTMLElement>('td.label-column[rowspan]');
    const container = this.shadowRoot?.querySelector<HTMLElement>('.table-container');
    const spacer = this.shadowRoot?.querySelector<HTMLElement>('.sticky-scrollbar-spacer');
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
    this._layoutFrame.schedule(() => this._syncWidths());
    const current: ThresholdLegendGroup[] = [...this._triggeredGroups.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([, g]) => ({ label: g.label, rules: [...g.rules] }));
    if (this._groupsChanged(current, this._lastDispatchedGroups)) {
      this._lastDispatchedGroups = current;
      this.dispatchEvent(new CustomEvent('thresholds-applied', {
        bubbles: true,
        composed: true,
        detail: { groups: current },
      }));
    }
  }

  private _groupsChanged(a: ThresholdLegendGroup[], b: ThresholdLegendGroup[]): boolean {
    if (a.length !== b.length) return true;
    for (let i = 0; i < a.length; i++) {
      const ga = a[i]!;
      const gb = b[i]!;
      if (ga.label !== gb.label || ga.rules.length !== gb.rules.length) return true;
      for (let j = 0; j < ga.rules.length; j++) {
        if (ga.rules[j] !== gb.rules[j]) return true;
      }
    }
    return false;
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

  private renderEntityRows(cfg: EntityConfig, rowIndex: number, sec: MonthSegment, days: number, hasMeasurement: boolean, hasCumulative: boolean) {
    const { year, month } = sec;
    const key = rowKey(cfg);
    const precision = resolvePrecision(cfg);
    const nf = numberFormatter(this.lang, precision);
    const meta = sec.entityMetadata.get(key);
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
        const val = sec.dailyValues.get(`${key}::${this.dateStr(year, month, d)}`);
        if (val?.kind === 'measurement') {
          const pc = val.partialCoverage ? '*' : '';
          const showZero = cfg.show_zero !== false;
          const minV = val.min * f;
          const meanV = val.mean * f;
          const maxV = val.max * f;

          if (minV === 0 && !showZero) {
            minCells.push(html`<td class="data-cell" style=${ifDefined(staticStyle)}>${NBSP}</td>`);
          } else {
            const minRule = resolveThreshold(minV, cfg.thresholds ?? [], 'min', 'day');
            if (minRule) this._addTriggered(rowIndex, groupLabel, minRule);
            const minStyle = buildCellStyle(cfg.text_color, cfg.background_color, minRule, this._contrast.textFor(minRule?.background_color ?? cfg.background_color));
            minCells.push(html`<td class="data-cell has-data" style=${ifDefined(minStyle)}>${nf.format(minV)}${pc}</td>`);
          }

          if (meanV === 0 && !showZero) {
            meanCells.push(html`<td class="data-cell" style=${ifDefined(staticStyle)}>${NBSP}</td>`);
          } else {
            const avgRule = resolveThreshold(meanV, cfg.thresholds ?? [], 'avg', 'day');
            if (avgRule) this._addTriggered(rowIndex, groupLabel, avgRule);
            const avgStyle = buildCellStyle(cfg.text_color, cfg.background_color, avgRule, this._contrast.textFor(avgRule?.background_color ?? cfg.background_color));
            meanCells.push(html`<td class="data-cell has-data" style=${ifDefined(avgStyle)}>${nf.format(meanV)}</td>`);
          }

          if (maxV === 0 && !showZero) {
            maxCells.push(html`<td class="data-cell" style=${ifDefined(staticStyle)}>${NBSP}</td>`);
          } else {
            const maxRule = resolveThreshold(maxV, cfg.thresholds ?? [], 'max', 'day');
            if (maxRule) this._addTriggered(rowIndex, groupLabel, maxRule);
            const maxStyle = buildCellStyle(cfg.text_color, cfg.background_color, maxRule, this._contrast.textFor(maxRule?.background_color ?? cfg.background_color));
            maxCells.push(html`<td class="data-cell has-data" style=${ifDefined(maxStyle)}>${nf.format(maxV)}${pc}</td>`);
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
            const rule = resolveThreshold(v, cfg.thresholds ?? [], role, 'day');
            if (rule) this._addTriggered(rowIndex, groupLabel, rule);
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
      const val = sec.dailyValues.get(`${key}::${this.dateStr(year, month, d)}`);
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
          cellContent = `${nf.format(v)}${val.partialCoverage ? '*' : ''}`;
        }
      }
      let cellStyle = staticStyle;
      if (numericValue !== undefined) {
        const rule = resolveThreshold(numericValue, cfg.thresholds ?? [], 'scalar', 'day');
        if (rule) this._addTriggered(rowIndex, groupLabel, rule);
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
      const rule = resolveThreshold(summary.total * f, cfg.thresholds ?? [], 'scalar', 'month');
      if (rule) this._addTriggered(rowIndex, groupLabel, rule);
      cumulTotalStyle = buildCellStyle(cfg.text_color, cfg.background_color, rule, this._contrast.textFor(rule?.background_color ?? cfg.background_color));
    }
    if (summary?.mean != null && (showMin || showAvg || showMax)) {
      const rule = resolveThreshold(summary.mean * f, cfg.thresholds ?? [], 'summary-scalar', 'day');
      if (rule) this._addTriggered(rowIndex, groupLabel, rule);
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
    this._triggeredGroups.clear();
    // One scan of the sections feeds every column decision below; recomputing
    // it per row would rescan every section for every row.
    const sections = this._sections();
    const hasCumulative = this.hasCumulative(sections);
    const hasMeasurement = this.hasMeasurement(sections);
    // Cross-year section mode always shows the year in the month header.
    const withYear = this.showYear || (this.monthSegments?.length ?? 0) > 0;

    return html`
      <div class="table-container" @scroll=${this._onContainerScroll}>
        <table>
          ${sections.map((sec) => {
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
                  <th class="label-column month-name" colspan="${hasMeasurement ? 2 : 1}">${this.monthName(sec.month)}${withYear ? ` ${sec.year}` : ''}</th>
                  ${dayHeaders}
                  <th class="summary-column">${localize('table.summary', this.lang)}</th>
                  ${hasCumulative ? html`<th class="summary-column">${localize('table.total', this.lang)}</th>` : ''}
                </tr>
              </thead>
              <tbody>
                ${this.entityConfigs.map((cfg, i) => this.renderEntityRows(cfg, i, sec, days, hasMeasurement, hasCumulative))}
              </tbody>
            `;
          })}
        </table>
      </div>
      <div class="sticky-scrollbar" @scroll=${this._onStickyScroll}>
        <div class="sticky-scrollbar-spacer"></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-year-table': YearTable;
  }
}
