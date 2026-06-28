import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { EntityConfig, ThresholdRule } from '../types/card-config';
import { rowKey } from '../types/card-config';
import type { DailyValue, MonthlySummary, EntityMetadata } from '../types/statistics';
import { localize } from '../localize/localize';
import { resolveThreshold, buildCellStyle } from '../services/threshold-resolver';
import { autoContrastText } from '../services/readable-text';
import { rowSummaryKey } from '../services/data-transform';

const TOTAL_DAYS = 31;

/** Default decimal places used when a row config does not set `precision`. */
export const DEFAULT_PRECISION = 1;

/** Effective precision for a row: explicit `precision` if set, else the default. */
export function resolvePrecision(cfg: { precision?: number }): number {
  return cfg.precision ?? DEFAULT_PRECISION;
}

@customElement('calendar-stats-year-table')
export class YearTable extends LitElement {
  @property({ type: Number }) year = 2025;
  @property({ attribute: false }) visibleMonths: number[] = [];
  @property({ attribute: false }) entityConfigs: EntityConfig[] = [];
  @property({ attribute: false }) dailyValues: Map<string, DailyValue> = new Map();
  @property({ attribute: false }) monthlySummaries: Map<string, MonthlySummary> = new Map();
  @property({ attribute: false }) entityMetadata: Map<string, EntityMetadata> = new Map();
  @property({ attribute: false }) entityErrors: Set<string> = new Set();
  @property({ type: String }) lang = 'en';

  private _triggeredRules = new Set<ThresholdRule>();

  /** Hidden probe (light DOM child) used to resolve CSS colors via the browser. */
  private _contrastProbe?: HTMLSpanElement;
  /** Cache: effective background string → auto-contrast text color. */
  private _contrastCache = new Map<string, string | undefined>();

  /**
   * Auto-contrast text color (black/white) for a cell background, or undefined
   * when no background is set or the color cannot be resolved.
   */
  private autoTextFor(bg: string | undefined): string | undefined {
    if (!bg) return undefined;
    const cached = this._contrastCache.get(bg);
    if (cached !== undefined || this._contrastCache.has(bg)) return cached;
    if (!this._contrastProbe) {
      const span = document.createElement('span');
      span.style.cssText = 'position:absolute;width:0;height:0;visibility:hidden;pointer-events:none';
      // Light-DOM child of the table: inherits theme CSS vars, not slotted/rendered.
      this.appendChild(span);
      this._contrastProbe = span;
    }
    const result = autoContrastText(bg, this._contrastProbe);
    this._contrastCache.set(bg, result);
    return result;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._contrastProbe?.remove();
    this._contrastProbe = undefined;
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
    }
    td.data-cell.has-data {
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

  private _lastDispatchedRules: ThresholdRule[] = [];

  override updated() {
    const labelCol = this.shadowRoot?.querySelector<HTMLElement>('td.label-column[rowspan]');
    if (labelCol) {
      this.style.setProperty('--label-col-width', `${labelCol.getBoundingClientRect().width}px`);
    }
    const current = [...this._triggeredRules];
    const prev = this._lastDispatchedRules;
    if (current.length !== prev.length || current.some((r, i) => r !== prev[i])) {
      this._lastDispatchedRules = current;
      this.dispatchEvent(new CustomEvent('thresholds-applied', {
        bubbles: true,
        composed: true,
        detail: { rules: current },
      }));
    }
  }

  private daysInMonth(month: number): number {
    return new Date(this.year, month, 0).getDate();
  }

  private dateStr(month: number, day: number): string {
    return `${this.year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private monthName(month: number): string {
    return new Intl.DateTimeFormat(this.lang, { month: 'long' }).format(
      new Date(this.year, month - 1, 1),
    );
  }

  private hasCumulative(): boolean {
    return this.entityConfigs.some((cfg) => {
      const meta = this.entityMetadata.get(rowKey(cfg));
      return meta && meta.stateClass !== 'measurement';
    });
  }

  private hasMeasurement(): boolean {
    return this.entityConfigs.some((cfg) => {
      const meta = this.entityMetadata.get(rowKey(cfg));
      return meta?.stateClass === 'measurement';
    });
  }

  private renderEntityRows(cfg: EntityConfig, rowIndex: number, month: number, days: number, hasMeasurement: boolean) {
    const key = rowKey(cfg);
    const precision = resolvePrecision(cfg);
    const nf = new Intl.NumberFormat(this.lang, { maximumFractionDigits: precision, minimumFractionDigits: precision });
    const meta = this.entityMetadata.get(key);
    const label = cfg.name ?? meta?.friendlyName ?? ('entity' in cfg ? cfg.entity : '');
    const unitStr = ('unit' in cfg && cfg.unit) ? cfg.unit : meta?.unitOfMeasurement;
    const unit = unitStr ? ` [${unitStr}]` : '';
    const f = ('factor' in cfg && cfg.factor != null) ? cfg.factor : 1;
    const hasStats = meta?.hasStatistics ?? true;
    const hasError = this.entityErrors.has(key);
    const isMeasurement = meta?.stateClass === 'measurement';
    const summaryKey = rowSummaryKey(rowIndex, key, this.year, month);
    const summary = this.monthlySummaries.get(summaryKey);

    const staticStyle = buildCellStyle(
      cfg.text_color,
      cfg.background_color,
      undefined,
      this.autoTextFor(cfg.background_color),
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
        const val = this.dailyValues.get(`${key}::${this.dateStr(month, d)}`);
        if (val?.kind === 'measurement') {
          const pc = val.partialCoverage ? '*' : '';
          const showZero = cfg.show_zero !== false;
          const minV = val.min * f;
          const meanV = val.mean * f;
          const maxV = val.max * f;

          if (minV === 0 && !showZero) {
            minCells.push(html`<td class="data-cell" style=${ifDefined(staticStyle)}></td>`);
          } else {
            const minRule = resolveThreshold(minV, cfg.thresholds ?? [], 'min');
            if (minRule) this._triggeredRules.add(minRule);
            const minStyle = buildCellStyle(cfg.text_color, cfg.background_color, minRule, this.autoTextFor(minRule?.background_color ?? cfg.background_color));
            minCells.push(html`<td class="data-cell has-data" style=${ifDefined(minStyle)}>${nf.format(minV)}${pc}</td>`);
          }

          if (meanV === 0 && !showZero) {
            meanCells.push(html`<td class="data-cell" style=${ifDefined(staticStyle)}></td>`);
          } else {
            const avgRule = resolveThreshold(meanV, cfg.thresholds ?? [], 'avg');
            if (avgRule) this._triggeredRules.add(avgRule);
            const avgStyle = buildCellStyle(cfg.text_color, cfg.background_color, avgRule, this.autoTextFor(avgRule?.background_color ?? cfg.background_color));
            meanCells.push(html`<td class="data-cell has-data" style=${ifDefined(avgStyle)}>${nf.format(meanV)}</td>`);
          }

          if (maxV === 0 && !showZero) {
            maxCells.push(html`<td class="data-cell" style=${ifDefined(staticStyle)}></td>`);
          } else {
            const maxRule = resolveThreshold(maxV, cfg.thresholds ?? [], 'max');
            if (maxRule) this._triggeredRules.add(maxRule);
            const maxStyle = buildCellStyle(cfg.text_color, cfg.background_color, maxRule, this.autoTextFor(maxRule?.background_color ?? cfg.background_color));
            maxCells.push(html`<td class="data-cell has-data" style=${ifDefined(maxStyle)}>${nf.format(maxV)}${pc}</td>`);
          }
        } else {
          minCells.push(html`<td class="data-cell" style=${ifDefined(staticStyle)}></td>`);
          meanCells.push(html`<td class="data-cell" style=${ifDefined(staticStyle)}></td>`);
          maxCells.push(html`<td class="data-cell" style=${ifDefined(staticStyle)}></td>`);
        }
      }

      if (visibleRows.length === 0) {
        return html`
          <tr>
            <td class="label-column" style=${ifDefined(staticStyle)}>${hasStats ? '' : '⚠ '}${label}${unit}</td>
          </tr>
        `;
      }

      const rowspan = visibleRows.length;
      const cells = { min: minCells, avg: meanCells, max: maxCells } as const;
      const summaryVals = {
        min: summary?.min != null ? nf.format(summary.min * f) : '',
        avg: summary?.mean != null ? nf.format(summary.mean * f) : '',
        max: summary?.max != null ? nf.format(summary.max * f) : '',
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
            const rule = resolveThreshold(v, cfg.thresholds ?? [], role);
            if (rule) this._triggeredRules.add(rule);
            summaryStyles[row] = buildCellStyle(cfg.text_color, cfg.background_color, rule, this.autoTextFor(rule?.background_color ?? cfg.background_color));
          }
        }
      }

      const hasCumulative = this.hasCumulative();
      return html`${visibleRows.map((row, idx) => html`
        <tr class="${idx < visibleRows.length - 1 ? 'sub-row' : ''}">
          ${idx === 0 ? html`<td class="label-column" rowspan="${rowspan}" style=${ifDefined(staticStyle)}>${hasStats ? '' : '⚠ '}${label}${unit}</td>` : ''}
          <td class="sub-label" style=${ifDefined(staticStyle)}>${localize(row === 'min' ? 'summary.min' : row === 'avg' ? 'summary.avg' : 'summary.max', this.lang)}</td>
          ${cells[row]}
          <td class="summary-column" style=${ifDefined(summaryStyles[row])}>${summaryVals[row]}</td>
          ${hasCumulative ? html`<td class="summary-column" style=${ifDefined(staticStyle)}></td>` : ''}
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
      const val = this.dailyValues.get(`${key}::${this.dateStr(month, d)}`);
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
        const rule = resolveThreshold(numericValue, cfg.thresholds ?? [], 'scalar');
        if (rule) this._triggeredRules.add(rule);
        cellStyle = buildCellStyle(cfg.text_color, cfg.background_color, rule, this.autoTextFor(rule?.background_color ?? cfg.background_color));
      }
      dayCells.push(html`<td class="data-cell ${cellContent ? 'has-data' : ''}" style=${ifDefined(cellStyle)}>${cellContent}</td>`);
    }

    const cumulErc = 'entity' in cfg ? cfg : null;
    const showMin = cumulErc?.show_min !== false;
    const showAvg = cumulErc?.show_avg !== false;
    const showMax = cumulErc?.show_max !== false;
    const summaryContent = (summary && (showMin || showAvg || showMax))
      ? html`<div class="cumul-summary">
          ${showAvg ? html`<div>${summary.mean != null ? nf.format(summary.mean * f) : ''}</div>` : ''}
          ${(showMin || showMax) ? html`<div class="cumul-minmax">
            ${showMin ? html`<span>${summary.min != null ? `↓${nf.format(summary.min * f)}` : ''}</span>` : ''}
            ${showMax ? html`<span>${summary.max != null ? `↑${nf.format(summary.max * f)}` : ''}</span>` : ''}
          </div>` : ''}
        </div>`
      : '';
    const totalContent = summary?.total != null ? nf.format(summary.total * f) : '';

    let cumulSummaryStyle = staticStyle;
    // Total column never gets threshold coloring — static color only.
    const cumulTotalStyle = staticStyle;
    if (summary?.mean != null && (showMin || showAvg || showMax)) {
      const rule = resolveThreshold(summary.mean * f, cfg.thresholds ?? [], 'summary-scalar');
      if (rule) this._triggeredRules.add(rule);
      cumulSummaryStyle = buildCellStyle(cfg.text_color, cfg.background_color, rule, this.autoTextFor(rule?.background_color ?? cfg.background_color));
    }

    return html`
      <tr>
        <td class="label-column" colspan="${hasMeasurement ? 2 : 1}" style=${ifDefined(staticStyle)}>${hasStats ? '' : '⚠ '}${label}${unit}</td>
        ${dayCells}
        <td class="summary-column" style=${ifDefined(cumulSummaryStyle)}>${summaryContent}</td>
        <td class="summary-column" style=${ifDefined(cumulTotalStyle)}>${totalContent}</td>
      </tr>
    `;
  }

  render() {
    this._triggeredRules.clear();
    const hasCumulative = this.hasCumulative();
    const hasMeasurement = this.hasMeasurement();

    return html`
      <div class="table-container">
        <table>
          ${this.visibleMonths.map((month) => {
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
            return html`
              <thead>
                <tr class="month-header-row">
                  <th class="label-column month-name" colspan="${hasMeasurement ? 2 : 1}">${this.monthName(month)}</th>
                  ${dayHeaders}
                  <th class="summary-column">${localize('table.summary', this.lang)}</th>
                  ${hasCumulative ? html`<th class="summary-column">${localize('table.total', this.lang)}</th>` : ''}
                </tr>
              </thead>
              <tbody>
                ${this.entityConfigs.map((cfg, i) => this.renderEntityRows(cfg, i, month, days, hasMeasurement))}
              </tbody>
            `;
          })}
        </table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-year-table': YearTable;
  }
}
