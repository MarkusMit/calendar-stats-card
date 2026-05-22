import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { EntityConfig } from '../types/card-config';
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
      border-right: 1px solid var(--divider-color, #ccc);
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
      const meta = this.entityMetadata.get(cfg.entity);
      return meta && meta.stateClass !== 'measurement';
    });
  }

  private renderEntityRows(cfg: EntityConfig, month: number, days: number) {
    const nf = new Intl.NumberFormat(this.lang, { maximumFractionDigits: cfg.precision ?? 20, minimumFractionDigits: cfg.precision ?? 0 });
    const meta = this.entityMetadata.get(cfg.entity);
    const label = cfg.name ?? meta?.friendlyName ?? cfg.entity;
    const unit = meta?.unitOfMeasurement ? ` [${meta.unitOfMeasurement}]` : '';
    const hasStats = meta?.hasStatistics ?? true;
    const hasError = this.entityErrors.has(cfg.entity);
    const isMeasurement = meta?.stateClass === 'measurement';
    const summaryKey = `${cfg.entity}::${this.year}-${month}`;
    const summary = this.monthlySummaries.get(summaryKey);

    if (isMeasurement && !hasError) {
      const minCells = [];
      const meanCells = [];
      const maxCells = [];
      for (let d = 1; d <= TOTAL_DAYS; d++) {
        if (d > days) {
          minCells.push(html`<td class="pad-cell"></td>`);
          meanCells.push(html`<td class="pad-cell"></td>`);
          maxCells.push(html`<td class="pad-cell"></td>`);
          continue;
        }
        const key = `${cfg.entity}::${this.dateStr(month, d)}`;
        const val = this.dailyValues.get(key);
        if (val?.kind === 'measurement') {
          const pc = val.partialCoverage ? '*' : '';
          minCells.push(html`<td class="data-cell has-data">${nf.format(val.min)}${pc}</td>`);
          meanCells.push(html`<td class="data-cell has-data">${nf.format(val.mean)}</td>`);
          maxCells.push(html`<td class="data-cell has-data">${nf.format(val.max)}</td>`);
        } else {
          minCells.push(html`<td class="data-cell"></td>`);
          meanCells.push(html`<td class="data-cell"></td>`);
          maxCells.push(html`<td class="data-cell"></td>`);
        }
      }
      return html`
        <tr>
          <td class="label-column" rowspan="3">${hasStats ? '' : '⚠ '}${label}${unit}</td>
          ${minCells}
          <td class="summary-column">${summary?.min != null ? nf.format(summary.min) : ''}</td>
        </tr>
        <tr>
          ${meanCells}
          <td class="summary-column">${summary?.mean != null ? nf.format(summary.mean) : ''}</td>
        </tr>
        <tr>
          ${maxCells}
          <td class="summary-column">${summary?.max != null ? nf.format(summary.max) : ''}</td>
        </tr>
      `;
    }

    // Cumulative entity — single row
    const dayCells = [];
    for (let d = 1; d <= TOTAL_DAYS; d++) {
      if (d > days) {
        dayCells.push(html`<td class="pad-cell"></td>`);
        continue;
      }
      const key = `${cfg.entity}::${this.dateStr(month, d)}`;
      const val = this.dailyValues.get(key);
      let cellContent = '';
      if (hasError) {
        cellContent = '—';
      } else if (!hasStats) {
        cellContent = '';
      } else if (val?.kind === 'cumulative') {
        cellContent = `${nf.format(val.sum)}${val.partialCoverage ? '*' : ''}`;
      }
      dayCells.push(html`<td class="data-cell ${cellContent ? 'has-data' : ''}">${cellContent}</td>`);
    }
    const summaryContent = summary
      ? html`<div class="cumul-summary">
          <div>${summary.mean != null ? nf.format(summary.mean) : ''}</div>
          <div class="cumul-minmax">
            <span>${summary.min != null ? `↓${nf.format(summary.min)}` : ''}</span>
            <span>${summary.max != null ? `↑${nf.format(summary.max)}` : ''}</span>
          </div>
        </div>`
      : '';
    const totalContent = summary?.total != null ? nf.format(summary.total) : '';
    return html`
      <tr>
        <td class="label-column">${hasStats ? '' : '⚠ '}${label}${unit}</td>
        ${dayCells}
        <td class="summary-column">${summaryContent}</td>
        <td class="summary-column">${totalContent}</td>
      </tr>
    `;
  }

  render() {
    const hasCumulative = this.hasCumulative();

    const dayHeaders: ReturnType<typeof html>[] = [];
    for (let d = 1; d <= TOTAL_DAYS; d++) {
      dayHeaders.push(html`<th>${d}</th>`);
    }

    return html`
      <div class="table-container">
        <table>
          <tbody>
            ${this.visibleMonths.map((month, i) => {
              const days = this.daysInMonth(month);
              const totalCols = 1 + TOTAL_DAYS + 1 + (hasCumulative ? 1 : 0);
              const showDayNumbers = i % 3 === 0;
              return html`
                <tr class="month-header-row">
                  ${showDayNumbers ? html`
                    <th class="label-column month-name">${this.monthName(month)}</th>
                    ${dayHeaders}
                    <th class="summary-column">${localize('table.summary', this.lang)}</th>
                    ${hasCumulative ? html`<th class="summary-column">${localize('table.total', this.lang)}</th>` : ''}
                  ` : html`
                    <th class="month-name">${this.monthName(month)}</th>
                    <th colspan="${totalCols - 1}"></th>
                  `}
                </tr>
                ${this.entityConfigs.map((cfg) => this.renderEntityRows(cfg, month, days))}
              `;
            })}
          </tbody>
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
