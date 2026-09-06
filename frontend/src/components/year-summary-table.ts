import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { EntityConfig, ThresholdRule, ThresholdLegendGroup } from '../types/card-config';
import { rowKey } from '../types/card-config';
import type { DailyValue, MonthlySummary, EntityMetadata } from '../types/statistics';
import { localize } from '../localize/localize';
import { resolveThreshold, buildCellStyle } from '../services/threshold-resolver';
import { NBSP } from './year-table';
import { ContrastResolver } from '../services/readable-text';
import { rowSummaryKey, computeMeasurementYearRollup, computeCumulativeYearRollup } from '../services/data-transform';
import { resolvePrecision } from './year-table';

const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);

/** One calendar year's data slice for the yearly grid. */
export interface YearSummarySegment {
  year: number;
  visibleMonths: number[];
  monthlySummaries: Map<string, MonthlySummary>;
  dailyValues: Map<string, DailyValue>;
  entityMetadata: Map<string, EntityMetadata>;
}

/**
 * Yearly view: all year segments render inside ONE table (a thead/tbody
 * section per year) so every year shares the same column widths — columns
 * are the twelve months, rows are the configured entities/expressions, each
 * cell is that month's summary (measurement min/avg/max sub-rows; cumulative
 * monthly total).
 */
@customElement('calendar-stats-year-summary-table')
export class YearSummaryTable extends LitElement {
  @property({ attribute: false }) segments: YearSummarySegment[] = [];
  @property({ attribute: false }) entityConfigs: EntityConfig[] = [];
  @property({ attribute: false }) entityErrors: Set<string> = new Set();
  @property({ type: String }) lang = 'en';

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
    this._contrast.dispose();
  }

  static styles = css`
    :host {
      display: block;
    }
    .table-container {
      overflow-x: auto;
      scrollbar-width: thin;
    }
    table {
      border-collapse: collapse;
      white-space: nowrap;
      -webkit-user-select: text;
      user-select: text;
    }
    th, td {
      padding: 1px 4px;
    }
    tbody tr {
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
    }
    tbody tr.sub-row td.sub-label {
      border-bottom: hidden;
    }
    td.data-cell {
      padding: 1px 4px;
      color: var(--primary-text-color);
      text-align: right;
      min-width: 34px;
      border-left: 1px solid var(--divider-color, #ccc);
      border-right: 1px solid var(--divider-color, #ccc);
    }
    td.pad-cell {
      min-width: 34px;
      padding: 1px 4px;
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
    .year-header-row th {
      font-weight: normal;
      font-size: 0.9em;
      color: var(--secondary-text-color);
      text-align: center;
      padding: 1px 4px;
      background: var(--secondary-background-color, #f0f0f0);
      border-bottom: 1px solid var(--divider-color, #ccc);
    }
    .year-header-row th.summary-column {
      font-weight: bold;
    }
    .year-header-row th.year-name {
      font-weight: bold;
      font-size: 1em;
      color: var(--primary-text-color);
      text-align: left;
      padding: 4px 6px;
      position: sticky;
      left: 0;
      z-index: 1;
    }
    th.month-col.pad-month {
      opacity: 0.45;
    }
    th.month-col button.month-select {
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
    th.month-col button.month-select:hover,
    th.month-col button.month-select:focus-visible {
      outline: none;
      background: var(--divider-color, rgba(0, 0, 0, 0.12));
    }
    .summary-column {
      color: var(--secondary-text-color);
      border: 1px solid var(--divider-color, #ccc);
      text-align: right;
      padding: 1px 4px;
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
  `;

  private _lastDispatchedGroups: ThresholdLegendGroup[] = [];

  override updated() {
    const labelCol = this.shadowRoot?.querySelector<HTMLElement>('td.label-column[rowspan]');
    if (labelCol) {
      this.style.setProperty('--label-col-width', `${labelCol.getBoundingClientRect().width}px`);
    }
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

  private monthName(month: number): string {
    return new Intl.DateTimeFormat(this.lang, { month: 'short' }).format(
      new Date(2020, month - 1, 1),
    );
  }

  /** Row-type flags from the union of all segments' metadata — the column
   *  structure must be identical across every year section of the table. */
  private _metaFor(key: string): EntityMetadata | undefined {
    for (const seg of this.segments) {
      const meta = seg.entityMetadata.get(key);
      if (meta) return meta;
    }
    return undefined;
  }

  private hasCumulative(): boolean {
    return this.entityConfigs.some((cfg) => {
      const meta = this._metaFor(rowKey(cfg));
      return meta && meta.stateClass !== 'measurement';
    });
  }

  private hasMeasurement(): boolean {
    return this.entityConfigs.some((cfg) => {
      const meta = this._metaFor(rowKey(cfg));
      return meta?.stateClass === 'measurement';
    });
  }

  private _summaryFor(seg: YearSummarySegment, rowIndex: number, key: string, month: number): MonthlySummary | undefined {
    return seg.monthlySummaries.get(rowSummaryKey(rowIndex, key, seg.year, month));
  }

  /** True when the month has data for any row in any segment — only such month
   *  headers open the comparison view (spec 014 FR-001/FR-016). */
  private _monthHasData(month: number): boolean {
    return this.segments.some((seg) =>
      seg.visibleMonths.includes(month) &&
      this.entityConfigs.some((cfg, i) =>
        seg.monthlySummaries.has(rowSummaryKey(i, rowKey(cfg), seg.year, month))));
  }

  private _onMonthSelect(month: number): void {
    this.dispatchEvent(new CustomEvent('calendar-stats-month-select', {
      bubbles: true,
      composed: true,
      detail: { month },
    }));
  }

  private _renderMonthHeader(seg: YearSummarySegment, month: number, clickable: boolean) {
    const name = this.monthName(month);
    const cls = `month-col ${seg.visibleMonths.includes(month) ? '' : 'pad-month'}`;
    if (!clickable) {
      return html`<th class=${cls}>${name}</th>`;
    }
    const ariaLabel = localize('comparison.compare_month', this.lang).replace('{month}', name);
    return html`<th class=${cls}>
      <button class="month-select" aria-label=${ariaLabel} @click=${() => this._onMonthSelect(month)}>${name}</button>
    </th>`;
  }

  private renderEntityRows(seg: YearSummarySegment, cfg: EntityConfig, rowIndex: number, hasMeasurement: boolean, hasCumulative: boolean) {
    const key = rowKey(cfg);
    const precision = resolvePrecision(cfg);
    const nf = new Intl.NumberFormat(this.lang, { maximumFractionDigits: precision, minimumFractionDigits: precision });
    const meta = seg.entityMetadata.get(key) ?? this._metaFor(key);
    const visible = (m: number) => seg.visibleMonths.includes(m);
    const label = cfg.name ?? meta?.friendlyName ?? ('entity' in cfg ? cfg.entity : '');
    const unitStr = ('unit' in cfg && cfg.unit) ? cfg.unit : meta?.unitOfMeasurement;
    const unit = unitStr ? ` [${unitStr}]` : '';
    const groupLabel = `${label}${unit}`;
    const f = ('factor' in cfg && cfg.factor != null) ? cfg.factor : 1;
    const hasStats = meta?.hasStatistics ?? true;
    const hasError = this.entityErrors.has(key);
    const isMeasurement = meta?.stateClass === 'measurement';

    const staticStyle = buildCellStyle(
      cfg.text_color,
      cfg.background_color,
      undefined,
      this._contrast.textFor(cfg.background_color),
    );

    if (isMeasurement && !hasError) {
      const erc = 'entity' in cfg ? cfg : null;
      const visibleRows: Array<'min' | 'avg' | 'max'> = [];
      if (erc?.show_min !== false) visibleRows.push('min');
      if (erc?.show_avg !== false) visibleRows.push('avg');
      if (erc?.show_max !== false) visibleRows.push('max');

      if (visibleRows.length === 0) {
        return html`
          <tr>
            <td class="label-column" style=${ifDefined(staticStyle)}>${hasStats ? '' : '⚠ '}${label}${unit}</td>
          </tr>
        `;
      }

      const cellsFor = (row: 'min' | 'avg' | 'max') => ALL_MONTHS.map((m) => {
        if (!visible(m)) {
          return html`<td class="pad-cell" style=${ifDefined(staticStyle)}></td>`;
        }
        const summary = this._summaryFor(seg, rowIndex, key, m);
        const raw = row === 'min' ? summary?.min : row === 'avg' ? summary?.mean : summary?.max;
        if (raw == null) {
          return html`<td class="data-cell" style=${ifDefined(staticStyle)}>${NBSP}</td>`;
        }
        const v = raw * f;
        const rule = resolveThreshold(v, cfg.thresholds ?? [], row, 'day');
        if (rule) this._addTriggered(rowIndex, groupLabel, rule);
        const style = buildCellStyle(cfg.text_color, cfg.background_color, rule, this._contrast.textFor(rule?.background_color ?? cfg.background_color));
        return html`<td class="data-cell has-data" style=${ifDefined(style)}>${nf.format(v)}</td>`;
      });

      // Yearly Summary roll-up (FR-005): extremes of monthly extremes, day-weighted avg.
      const rollup = computeMeasurementYearRollup(
        rowIndex, key, seg.year, seg.visibleMonths, seg.monthlySummaries, seg.dailyValues,
      );
      const rollupVals: Record<'min' | 'avg' | 'max', number | null> = {
        min: rollup.min != null ? rollup.min * f : null,
        avg: rollup.mean != null ? rollup.mean * f : null,
        max: rollup.max != null ? rollup.max * f : null,
      };
      const summaryStyles: Record<'min' | 'avg' | 'max', string | undefined> = {
        min: staticStyle, avg: staticStyle, max: staticStyle,
      };
      for (const row of visibleRows) {
        const v = rollupVals[row];
        if (v != null) {
          const role = row === 'min' ? 'summary-min' : row === 'avg' ? 'summary-avg' : 'summary-max';
          const rule = resolveThreshold(v, cfg.thresholds ?? [], role, 'day');
          if (rule) this._addTriggered(rowIndex, groupLabel, rule);
          summaryStyles[row] = buildCellStyle(cfg.text_color, cfg.background_color, rule, this._contrast.textFor(rule?.background_color ?? cfg.background_color));
        }
      }

      const rowspan = visibleRows.length;
      return html`${visibleRows.map((row, idx) => html`
        <tr class="${idx < visibleRows.length - 1 ? 'sub-row' : ''}">
          ${idx === 0 ? html`<td class="label-column" rowspan="${rowspan}" style=${ifDefined(staticStyle)}>${hasStats ? '' : '⚠ '}${label}${unit}</td>` : ''}
          <td class="sub-label" style=${ifDefined(staticStyle)}>${localize(row === 'min' ? 'summary.min' : row === 'avg' ? 'summary.avg' : 'summary.max', this.lang)}</td>
          ${cellsFor(row)}
          <td class="summary-column" style=${ifDefined(summaryStyles[row])}>${rollupVals[row] != null ? nf.format(rollupVals[row]!) : NBSP}</td>
          ${hasCumulative ? html`<td class="summary-column" style=${ifDefined(staticStyle)}>${NBSP}</td>` : ''}
        </tr>
      `)}`;
    }

    // Cumulative / expression entity — single row of monthly totals
    const excludeZero = cfg.show_zero === false;
    const rollup = computeCumulativeYearRollup(
      rowIndex, key, seg.year, seg.visibleMonths, seg.monthlySummaries, excludeZero,
    );
    const monthCells = ALL_MONTHS.map((m) => {
      if (!visible(m)) {
        return html`<td class="pad-cell" style=${ifDefined(staticStyle)}></td>`;
      }
      const summary = this._summaryFor(seg, rowIndex, key, m);
      let cellContent = '';
      let numericValue: number | undefined;
      if (hasError) {
        cellContent = '—';
      } else if (!hasStats) {
        // no content
      } else if (summary?.total != null) {
        const v = summary.total * f;
        numericValue = v;
        if (v !== 0 || cfg.show_zero !== false) {
          cellContent = nf.format(v);
        }
      }
      let cellStyle = staticStyle;
      if (numericValue !== undefined && cellContent) {
        // Monthly totals are month-scale sums — gated by month-scope rules (015).
        const rule = resolveThreshold(numericValue, cfg.thresholds ?? [], 'scalar', 'month');
        if (rule) this._addTriggered(rowIndex, groupLabel, rule);
        cellStyle = buildCellStyle(cfg.text_color, cfg.background_color, rule, this._contrast.textFor(rule?.background_color ?? cfg.background_color));
      }
      return html`<td class="data-cell ${cellContent ? 'has-data' : ''}" style=${ifDefined(cellStyle)}>${cellContent || NBSP}</td>`;
    });

    // Yearly Summary (FR-018) and Total (FR-006) columns.
    const cumulErc = 'entity' in cfg ? cfg : null;
    const showMin = cumulErc?.show_min !== false;
    const showAvg = cumulErc?.show_avg !== false;
    const showMax = cumulErc?.show_max !== false;
    const summaryContent = ((rollup.mean != null || rollup.min != null || rollup.max != null) && (showMin || showAvg || showMax))
      ? html`<div class="cumul-summary">
          ${showAvg ? html`<div>${rollup.mean != null ? `Ø${nf.format(rollup.mean * f)}` : ''}</div>` : ''}
          ${(showMin || showMax) ? html`<div class="cumul-minmax">
            ${showMin ? html`<span>${rollup.min != null ? `↓${nf.format(rollup.min * f)}` : ''}</span>` : ''}
            ${showMax ? html`<span>${rollup.max != null ? `↑${nf.format(rollup.max * f)}` : ''}</span>` : ''}
          </div>` : ''}
        </div>`
      : NBSP;
    const totalContent = rollup.total != null ? nf.format(rollup.total * f) : NBSP;

    let cumulSummaryStyle = staticStyle;
    // Yearly total is a year-scale sum — colorable by year-scope rules (015).
    let cumulTotalStyle = staticStyle;
    if (rollup.total != null) {
      const rule = resolveThreshold(rollup.total * f, cfg.thresholds ?? [], 'scalar', 'year');
      if (rule) this._addTriggered(rowIndex, groupLabel, rule);
      cumulTotalStyle = buildCellStyle(cfg.text_color, cfg.background_color, rule, this._contrast.textFor(rule?.background_color ?? cfg.background_color));
    }
    if (rollup.mean != null && (showMin || showAvg || showMax)) {
      // Rollup over monthly totals inherits their month scale (015).
      const rule = resolveThreshold(rollup.mean * f, cfg.thresholds ?? [], 'summary-scalar', 'month');
      if (rule) this._addTriggered(rowIndex, groupLabel, rule);
      cumulSummaryStyle = buildCellStyle(cfg.text_color, cfg.background_color, rule, this._contrast.textFor(rule?.background_color ?? cfg.background_color));
    }

    return html`
      <tr>
        <td class="label-column" colspan="${hasMeasurement ? 2 : 1}" style=${ifDefined(staticStyle)}>${hasStats ? '' : '⚠ '}${label}${unit}</td>
        ${monthCells}
        <td class="summary-column" style=${ifDefined(cumulSummaryStyle)}>${summaryContent}</td>
        <td class="summary-column" style=${ifDefined(cumulTotalStyle)}>${totalContent}</td>
      </tr>
    `;
  }

  render() {
    this._triggeredGroups.clear();
    const hasMeasurement = this.hasMeasurement();
    const hasCumulative = this.hasCumulative();
    // Data presence is a cross-segment property — a month with data in ANY
    // compared year is clickable in EVERY year's header row (spec 014 FR-001).
    const clickableMonths = ALL_MONTHS.map((m) => this._monthHasData(m));

    return html`
      <div class="table-container">
        <table>
          ${this.segments.map((seg) => html`
            <thead>
              <tr class="year-header-row">
                <th class="label-column year-name" colspan="${hasMeasurement ? 2 : 1}">${seg.year}</th>
                ${ALL_MONTHS.map((m) => this._renderMonthHeader(seg, m, clickableMonths[m - 1]!))}
                <th class="summary-column">${localize('table.year_summary', this.lang)}</th>
                ${hasCumulative ? html`<th class="summary-column">${localize('table.total', this.lang)}</th>` : ''}
              </tr>
            </thead>
            <tbody>
              ${this.entityConfigs.map((cfg, i) => this.renderEntityRows(seg, cfg, i, hasMeasurement, hasCumulative))}
            </tbody>
          `)}
        </table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-year-summary-table': YearSummaryTable;
  }
}
