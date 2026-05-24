import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { EntityConfig } from '../types/card-config';
import { rowKey } from '../types/card-config';
import type { DailyValue, MonthlySummary, EntityMetadata } from '../types/statistics';
import { localize } from '../localize/localize';

const TOTAL_DAYS = 31;

@customElement('year-table')
export class YearTable extends LitElement {
  @property({ type: Number }) year = 2025;
  @property({ attribute: false }) visibleMonths: number[] = [];
  @property({ attribute: false }) entityConfigs: EntityConfig[] = [];
  @property({ attribute: false }) dailyValues: Map<string, DailyValue> = new Map();
  @property({ attribute: false }) monthlySummaries: Map<string, MonthlySummary> = new Map();
  @property({ attribute: false }) entityMetadata: Map<string, EntityMetadata> = new Map();
  @property({ attribute: false }) entityErrors: Set<string> = new Set();
  @property({ type: String }) lang = 'en';

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
      border-top: 2px solid var(--divider-color, #ccc);
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
      text-align: right;
      color: var(--secondary-text-color);
      font-size: 0.8em;
      opacity: 0.7;
      padding: 1px 4px;
      white-space: nowrap;
    }
    td.sub-label,
    td.label-column[colspan="2"] {
      border-right: 1px solid var(--divider-color, #ccc);
    }
  `;

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

  private renderEntityRows(cfg: EntityConfig, month: number, days: number, hasMeasurement: boolean) {
    const key = rowKey(cfg);
    const nf = new Intl.NumberFormat(this.lang, { maximumFractionDigits: cfg.precision ?? 20, minimumFractionDigits: cfg.precision ?? 0 });
    const meta = this.entityMetadata.get(key);
    const label = cfg.name ?? meta?.friendlyName ?? ('entity' in cfg ? cfg.entity : '');
    const unitStr = ('unit' in cfg && cfg.unit) ? cfg.unit : meta?.unitOfMeasurement;
    const unit = unitStr ? ` [${unitStr}]` : '';
    const f = ('factor' in cfg && cfg.factor != null) ? cfg.factor : 1;
    const hasStats = meta?.hasStatistics ?? true;
    const hasError = this.entityErrors.has(key);
    const isMeasurement = meta?.stateClass === 'measurement';
    const summaryKey = `${key}::${this.year}-${month}`;
    const summary = this.monthlySummaries.get(summaryKey);

    const colorParts: string[] = [];
    if (cfg.text_color) colorParts.push(`color:${cfg.text_color}`);
    if (cfg.background_color) colorParts.push(`background-color:${cfg.background_color}`);
    const labelStyle = colorParts.length ? colorParts.join(';') : undefined;

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
          minCells.push(html`<td class="pad-cell" style=${ifDefined(labelStyle)}></td>`);
          meanCells.push(html`<td class="pad-cell" style=${ifDefined(labelStyle)}></td>`);
          maxCells.push(html`<td class="pad-cell" style=${ifDefined(labelStyle)}></td>`);
          continue;
        }
        const val = this.dailyValues.get(`${key}::${this.dateStr(month, d)}`);
        if (val?.kind === 'measurement') {
          const pc = val.partialCoverage ? '*' : '';
          const showZero = cfg.show_zero !== false;
          const minV = val.min * f;
          const meanV = val.mean * f;
          const maxV = val.max * f;
          minCells.push(minV === 0 && !showZero ? html`<td class="data-cell" style=${ifDefined(labelStyle)}></td>` : html`<td class="data-cell has-data" style=${ifDefined(labelStyle)}>${nf.format(minV)}${pc}</td>`);
          meanCells.push(meanV === 0 && !showZero ? html`<td class="data-cell" style=${ifDefined(labelStyle)}></td>` : html`<td class="data-cell has-data" style=${ifDefined(labelStyle)}>${nf.format(meanV)}</td>`);
          maxCells.push(maxV === 0 && !showZero ? html`<td class="data-cell" style=${ifDefined(labelStyle)}></td>` : html`<td class="data-cell has-data" style=${ifDefined(labelStyle)}>${nf.format(maxV)}</td>`);
        } else {
          minCells.push(html`<td class="data-cell" style=${ifDefined(labelStyle)}></td>`);
          meanCells.push(html`<td class="data-cell" style=${ifDefined(labelStyle)}></td>`);
          maxCells.push(html`<td class="data-cell" style=${ifDefined(labelStyle)}></td>`);
        }
      }

      if (visibleRows.length === 0) {
        return html`
          <tr>
            <td class="label-column" style=${ifDefined(labelStyle)}>${hasStats ? '' : '⚠ '}${label}${unit}</td>
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

      return html`${visibleRows.map((row, idx) => html`
        <tr class="${idx < visibleRows.length - 1 ? 'sub-row' : ''}">
          ${idx === 0 ? html`<td class="label-column" rowspan="${rowspan}" style=${ifDefined(labelStyle)}>${hasStats ? '' : '⚠ '}${label}${unit}</td>` : ''}
          <td class="sub-label" style=${ifDefined(labelStyle)}>${localize(row === 'min' ? 'summary.min' : row === 'avg' ? 'summary.avg' : 'summary.max', this.lang)}</td>
          ${cells[row]}
          <td class="summary-column" style=${ifDefined(labelStyle)}>${summaryVals[row]}</td>
        </tr>
      `)}`;
    }

    // Cumulative entity — single row
    const dayCells = [];
    for (let d = 1; d <= TOTAL_DAYS; d++) {
      if (d > days) {
        dayCells.push(html`<td class="pad-cell" style=${ifDefined(labelStyle)}></td>`);
        continue;
      }
      const val = this.dailyValues.get(`${key}::${this.dateStr(month, d)}`);
      let cellContent = '';
      if (hasError) {
        cellContent = '—';
      } else if (!hasStats) {
        cellContent = '';
      } else if (val?.kind === 'cumulative') {
        const v = val.sum * f;
        if (v !== 0 || cfg.show_zero !== false) {
          cellContent = `${nf.format(v)}${val.partialCoverage ? '*' : ''}`;
        }
      }
      dayCells.push(html`<td class="data-cell ${cellContent ? 'has-data' : ''}" style=${ifDefined(labelStyle)}>${cellContent}</td>`);
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
    return html`
      <tr>
        <td class="label-column" colspan="${hasMeasurement ? 2 : 1}" style=${ifDefined(labelStyle)}>${hasStats ? '' : '⚠ '}${label}${unit}</td>
        ${dayCells}
        <td class="summary-column" style=${ifDefined(labelStyle)}>${summaryContent}</td>
        <td class="summary-column" style=${ifDefined(labelStyle)}>${totalContent}</td>
      </tr>
    `;
  }

  render() {
    const hasCumulative = this.hasCumulative();
    const hasMeasurement = this.hasMeasurement();

    const dayHeaders: ReturnType<typeof html>[] = [];
    for (let d = 1; d <= TOTAL_DAYS; d++) {
      dayHeaders.push(html`<th>${d}</th>`);
    }

    return html`
      <div class="table-container">
        <table>
          ${this.visibleMonths.map((month, i) => {
            const days = this.daysInMonth(month);
            const totalCols = 1 + (hasMeasurement ? 1 : 0) + TOTAL_DAYS + 1 + (hasCumulative ? 1 : 0);
            const showDayNumbers = i % 3 === 0;
            return html`
              <thead>
                <tr class="month-header-row">
                  ${showDayNumbers ? html`
                    <th class="label-column month-name" colspan="${hasMeasurement ? 2 : 1}">${this.monthName(month)}</th>
                    ${dayHeaders}
                    <th class="summary-column">${localize('table.summary', this.lang)}</th>
                    ${hasCumulative ? html`<th class="summary-column">${localize('table.total', this.lang)}</th>` : ''}
                  ` : html`
                    <th class="month-name">${this.monthName(month)}</th>
                    <th colspan="${totalCols - 1}"></th>
                  `}
                </tr>
              </thead>
              <tbody>
                ${this.entityConfigs.map((cfg) => this.renderEntityRows(cfg, month, days, hasMeasurement))}
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
    'year-table': YearTable;
  }
}
