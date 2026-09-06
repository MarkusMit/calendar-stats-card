import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { EntityConfig, ThresholdRule, ThresholdLegendGroup, CellRole, ThresholdScope } from '../types/card-config';
import { rowKey } from '../types/card-config';
import type { EntityMetadata, ComparisonSeries, ComparisonEntry, MonthlySummary } from '../types/statistics';
import { localize } from '../localize/localize';
import { resolveThreshold, buildCellStyle } from '../services/threshold-resolver';
import { NBSP } from './year-table';
import { ContrastResolver } from '../services/readable-text';
import { buildComparisonSeries } from '../services/data-transform';
import { resolvePrecision } from './year-table';
import type { YearSummarySegment } from './year-summary-table';

type SubRow = 'min' | 'avg' | 'max';

/**
 * Month comparison summary table (spec 014): rows are the configured
 * entities/expressions (measurement rows as min/avg/max sub-rows), columns are
 * the compared years; each cell holds the selected month's summary value plus
 * the previous-year diff and the deviation from the cross-year average
 * (percentages on cumulative/expression totals, FR-006a). Values and diff math
 * come from buildComparisonSeries — this component only formats.
 */
@customElement('calendar-stats-month-comparison-table')
export class MonthComparisonTable extends LitElement {
  @property({ type: Number }) month = 1;
  @property({ attribute: false }) segments: YearSummarySegment[] = [];
  @property({ attribute: false }) entityConfigs: EntityConfig[] = [];
  @property({ attribute: false }) entityErrors: Set<string> = new Set();
  @property({ attribute: false }) now: { year: number; month: number } = { year: 1970, month: 1 };
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

  /* Styles mirror year-table (monthly tables) so the comparison looks identical. */
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
      white-space: nowrap;
      border-left: 1px solid var(--divider-color, #ccc);
      border-right: 1px solid var(--divider-color, #ccc);
    }
    td.diff-cell {
      padding: 1px 3px;
      font-size: 0.85em;
      opacity: 0.8;
      color: var(--secondary-text-color);
      text-align: right;
      white-space: nowrap;
    }
    td.diff-cell.diff-avg {
      border-right: 1px solid var(--divider-color, #ccc);
    }
    td.avg-cell {
      color: var(--secondary-text-color);
      border: 1px solid var(--divider-color, #ccc);
      text-align: right;
      padding: 1px 3px;
      white-space: nowrap;
    }
    thead th {
      font-weight: normal;
      font-size: 0.9em;
      color: var(--secondary-text-color);
      text-align: center;
      padding: 1px 3px;
      background: var(--secondary-background-color, #f0f0f0);
      border-bottom: 1px solid var(--divider-color, #ccc);
    }
    th.year-col {
      text-align: center;
      font-weight: bold;
      color: var(--primary-text-color);
    }
    thead th.label-column.header {
      font-weight: bold;
      font-size: 1em;
      color: var(--primary-text-color);
      text-align: left;
      padding: 4px 6px;
      background: var(--secondary-background-color, #f0f0f0);
    }
    th.avg-col {
      border-left: 1px solid var(--divider-color, #ccc);
    }
    .incomplete-marker {
      cursor: help;
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

  private _metaFor(key: string): EntityMetadata | undefined {
    for (const seg of this.segments) {
      const meta = seg.entityMetadata.get(key);
      if (meta) return meta;
    }
    return undefined;
  }

  private hasMeasurement(): boolean {
    return this.entityConfigs.some((cfg) => this._metaFor(rowKey(cfg))?.stateClass === 'measurement');
  }

  private _years(): number[] {
    return this.segments.map((s) => s.year);
  }

  private _summariesByYear(): Map<number, Map<string, MonthlySummary>> {
    return new Map(this.segments.map((s) => [s.year, s.monthlySummaries]));
  }

  /** One compared year as three sibling cells: value (threshold-colored) | Δ | Ø. */
  private _renderEntryCells(
    entry: ComparisonEntry,
    cfg: EntityConfig,
    rowIndex: number,
    groupLabel: string,
    role: CellRole,
    scope: ThresholdScope,
    factor: number,
    nf: Intl.NumberFormat,
    sf: Intl.NumberFormat,
    pf: Intl.NumberFormat,
    staticStyle: string | undefined,
  ) {
    const diffCell = (val: number | null, pctVal: number | null, symbol: string, cls: string, titleKey: string) =>
      html`<td class="diff-cell ${cls}" style=${ifDefined(staticStyle)}
        title=${ifDefined(val != null ? localize(titleKey, this.lang) : undefined)}>${val != null
          ? html`${symbol}${sf.format(val * factor)}${pctVal != null ? html`<br>(${pf.format(pctVal)})` : ''}`
          : NBSP}</td>`;

    if (entry.value == null) {
      return html`<td class="data-cell" style=${ifDefined(staticStyle)}>${NBSP}</td>
        ${diffCell(null, null, 'Δ', 'diff-prev', 'comparison.diff_prev')}
        ${diffCell(null, null, 'Ø', 'diff-avg', 'comparison.diff_avg')}`;
    }
    const v = entry.value * factor;
    const rule = resolveThreshold(v, cfg.thresholds ?? [], role, scope);
    if (rule) this._addTriggered(rowIndex, groupLabel, rule);
    const valueStyle = buildCellStyle(
      cfg.text_color, cfg.background_color, rule,
      this._contrast.textFor(rule?.background_color ?? cfg.background_color),
    );
    return html`<td class="data-cell has-data" style=${ifDefined(valueStyle)}>${nf.format(v)}${entry.incomplete
        ? html`<span class="incomplete-marker" title=${localize('comparison.incomplete', this.lang)}>*</span>`
        : ''}</td>
      ${diffCell(entry.diffPrev, entry.pctPrev, 'Δ', 'diff-prev', 'comparison.diff_prev')}
      ${diffCell(entry.diffAvg, entry.pctAvg, 'Ø', 'diff-avg', 'comparison.diff_avg')}`;
  }

  /** Trailing cross-year average cell for a (sub-)row, threshold-colored via the summary role. */
  private _renderAvgCell(
    series: ComparisonSeries,
    cfg: EntityConfig,
    rowIndex: number,
    groupLabel: string,
    summaryRole: CellRole,
    scope: ThresholdScope,
    factor: number,
    nf: Intl.NumberFormat,
    staticStyle: string | undefined,
  ) {
    if (series.crossYearAvg == null) {
      return html`<td class="avg-cell" style=${ifDefined(staticStyle)}>${NBSP}</td>`;
    }
    const v = series.crossYearAvg * factor;
    const rule = resolveThreshold(v, cfg.thresholds ?? [], summaryRole, scope);
    if (rule) this._addTriggered(rowIndex, groupLabel, rule);
    const style = buildCellStyle(
      cfg.text_color, cfg.background_color, rule,
      this._contrast.textFor(rule?.background_color ?? cfg.background_color),
    );
    return html`<td class="avg-cell" style=${ifDefined(style)}>${nf.format(v)}</td>`;
  }

  private renderEntityRows(cfg: EntityConfig, rowIndex: number, hasMeasurement: boolean) {
    const key = rowKey(cfg);
    const precision = resolvePrecision(cfg);
    const nf = new Intl.NumberFormat(this.lang, { maximumFractionDigits: precision, minimumFractionDigits: precision });
    const sf = new Intl.NumberFormat(this.lang, { maximumFractionDigits: precision, minimumFractionDigits: precision, signDisplay: 'exceptZero' });
    const pf = new Intl.NumberFormat(this.lang, { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' });
    const meta = this._metaFor(key);
    const label = cfg.name ?? meta?.friendlyName ?? ('entity' in cfg ? cfg.entity : '');
    const unitStr = ('unit' in cfg && cfg.unit) ? cfg.unit : meta?.unitOfMeasurement;
    const unit = unitStr ? ` [${unitStr}]` : '';
    const groupLabel = `${label}${unit}`;
    const f = ('factor' in cfg && cfg.factor != null) ? cfg.factor : 1;
    const hasError = this.entityErrors.has(key);
    const isMeasurement = meta?.stateClass === 'measurement';
    const years = this._years();
    const byYear = this._summariesByYear();

    const staticStyle = buildCellStyle(
      cfg.text_color, cfg.background_color, undefined, this._contrast.textFor(cfg.background_color),
    );

    if (isMeasurement && !hasError) {
      const erc = 'entity' in cfg ? cfg : null;
      const visibleRows: SubRow[] = [];
      if (erc?.show_min !== false) visibleRows.push('min');
      if (erc?.show_avg !== false) visibleRows.push('avg');
      if (erc?.show_max !== false) visibleRows.push('max');

      if (visibleRows.length === 0) {
        return html`<tr><td class="label-column" style=${ifDefined(staticStyle)}>${groupLabel}</td></tr>`;
      }

      const seriesFor = (row: SubRow): ComparisonSeries => buildComparisonSeries(
        rowIndex, key, row === 'avg' ? 'mean' : row, this.month, years, byYear, this.now,
      );

      const rowspan = visibleRows.length;
      return html`${visibleRows.map((row, idx) => {
        const series = seriesFor(row);
        const summaryRole: CellRole = row === 'min' ? 'summary-min' : row === 'avg' ? 'summary-avg' : 'summary-max';
        return html`
          <tr class="${idx < visibleRows.length - 1 ? 'sub-row' : ''}">
            ${idx === 0 ? html`<td class="label-column" rowspan="${rowspan}" style=${ifDefined(staticStyle)}>${groupLabel}</td>` : ''}
            <td class="sub-label" style=${ifDefined(staticStyle)}>${localize(row === 'min' ? 'summary.min' : row === 'avg' ? 'summary.avg' : 'summary.max', this.lang)}</td>
            ${series.entries.map((entry) => this._renderEntryCells(entry, cfg, rowIndex, groupLabel, row, 'day', f, nf, sf, pf, staticStyle))}
            ${this._renderAvgCell(series, cfg, rowIndex, groupLabel, summaryRole, 'day', f, nf, staticStyle)}
          </tr>
        `;
      })}`;
    }

    // Cumulative / expression row — single 'total' series (percentages per FR-006a).
    const series = buildComparisonSeries(rowIndex, key, 'total', this.month, years, byYear, this.now);
    return html`
      <tr>
        <td class="label-column" colspan="${hasMeasurement ? 2 : 1}" style=${ifDefined(staticStyle)}>${hasError ? '— ' : ''}${groupLabel}</td>
        ${series.entries.map((entry) => this._renderEntryCells(entry, cfg, rowIndex, groupLabel, 'scalar', 'month', f, nf, sf, pf, staticStyle))}
        ${this._renderAvgCell(series, cfg, rowIndex, groupLabel, 'summary-scalar', 'month', f, nf, staticStyle)}
      </tr>
    `;
  }

  render() {
    this._triggeredGroups.clear();
    const hasMeasurement = this.hasMeasurement();
    const monthName = new Intl.DateTimeFormat(this.lang, { month: 'long' }).format(new Date(2020, this.month - 1, 1));

    return html`
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th class="label-column header" colspan="${hasMeasurement ? 2 : 1}">${monthName}</th>
              ${this.segments.map((seg) => html`<th class="year-col" colspan="3">${seg.year}</th>`)}
              <th class="avg-col">${localize('summary.avg', this.lang)}</th>
            </tr>
          </thead>
          <tbody>
            ${this.entityConfigs.map((cfg, i) => this.renderEntityRows(cfg, i, hasMeasurement))}
          </tbody>
        </table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-month-comparison-table': MonthComparisonTable;
  }
}
