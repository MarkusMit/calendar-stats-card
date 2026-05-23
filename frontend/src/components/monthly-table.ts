import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { EntityConfig } from '../types/card-config';
import { rowKey } from '../types/card-config';
import type { DailyValue, MonthlySummary, EntityMetadata } from '../types/statistics';
import { localize } from '../localize/localize';

@customElement('monthly-table')
export class MonthlyTable extends LitElement {
  @property({ type: Number }) month = 1;
  @property({ type: Number }) year = 2025;
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
    }
    th, td {
      padding: 1px 3px;
    }
    td.data-cell {
      padding: 1px 3px;
      color: var(--primary-text-color);
      text-align: right;
      min-width: 20px;
    }
    td.data-cell.has-data {
      border: 1px solid var(--divider-color, #ccc);
    }
    td.pad-cell {
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
    }
    .month-header {
      font-weight: bold;
      padding: 4px 4px 2px;
      color: var(--primary-text-color);
      font-size: 1.1em;
    }
    .summary-column {
      color: var(--secondary-text-color);
      border: 1px solid var(--divider-color, #ccc);
      text-align: right;
      padding: 1px 3px;
    }
    .day-cell-header {
      text-align: center;
      padding: 1px 3px;
      color: var(--secondary-text-color);
      font-size: 0.9em;
    }
    .sub-label {
      text-align: right;
      color: var(--secondary-text-color);
      font-size: 0.8em;
      opacity: 0.7;
      padding: 1px 4px;
      white-space: nowrap;
    }
    td.sub-label {
      border-right: 1px solid var(--divider-color, #ccc);
    }
  `;

  private daysInMonth(): number {
    return new Date(this.year, this.month, 0).getDate();
  }

  private monthName(): string {
    return new Intl.DateTimeFormat(this.lang, { month: 'long' }).format(
      new Date(this.year, this.month - 1, 1),
    );
  }

  private dateStr(day: number): string {
    return `${this.year}-${String(this.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private hasMeasurement(): boolean {
    return this.entityConfigs.some((cfg) => {
      const meta = this.entityMetadata.get(rowKey(cfg));
      return meta?.stateClass === 'measurement';
    });
  }

  private renderEntityRow(cfg: EntityConfig, hasMeasurement: boolean) {
    const key = rowKey(cfg);
    const meta = this.entityMetadata.get(key);
    const days = this.daysInMonth();
    const label = cfg.name ?? meta?.friendlyName ?? ('entity' in cfg ? cfg.entity : '');
    const unitStr = ('unit' in cfg && cfg.unit) ? cfg.unit : meta?.unitOfMeasurement;
    const unit = unitStr ? ` [${unitStr}]` : '';
    const f = ('factor' in cfg && cfg.factor != null) ? cfg.factor : 1;
    const hasStats = meta?.hasStatistics ?? true;
    const hasError = this.entityErrors.has(key);
    const nf = new Intl.NumberFormat(this.lang, { maximumFractionDigits: cfg.precision ?? 20, minimumFractionDigits: cfg.precision ?? 0 });
    const isMeasurement = meta?.stateClass === 'measurement';
    const summaryKey = `${key}::${this.year}-${this.month}`;
    const summary = this.monthlySummaries.get(summaryKey);

    if (isMeasurement && !hasError) {
      const minCells = [];
      const meanCells = [];
      const maxCells = [];
      for (let d = 1; d <= 31; d++) {
        if (d > days) {
          minCells.push(html`<td class="pad-cell"></td>`);
          meanCells.push(html`<td class="pad-cell"></td>`);
          maxCells.push(html`<td class="pad-cell"></td>`);
          continue;
        }
        const val = this.dailyValues.get(`${key}::${this.dateStr(d)}`);
        if (val?.kind === 'measurement') {
          const pc = val.partialCoverage ? '*' : '';
          minCells.push(html`<td class="data-cell has-data">${nf.format(val.min * f)}${pc}</td>`);
          meanCells.push(html`<td class="data-cell has-data">${nf.format(val.mean * f)}</td>`);
          maxCells.push(html`<td class="data-cell has-data">${nf.format(val.max * f)}${pc}</td>`);
        } else {
          minCells.push(html`<td class="data-cell"></td>`);
          meanCells.push(html`<td class="data-cell"></td>`);
          maxCells.push(html`<td class="data-cell"></td>`);
        }
      }
      return html`
        <tr class="sub-row">
          <td class="label-column" rowspan="3">${hasStats ? '' : '⚠ '}${label}${unit}</td>
          <td class="sub-label">${localize('summary.min', this.lang)}</td>
          ${minCells}
          <td class="summary-column">${summary?.min != null ? nf.format(summary.min * f) : ''}</td>
        </tr>
        <tr class="sub-row">
          <td class="sub-label">${localize('summary.avg', this.lang)}</td>
          ${meanCells}
          <td class="summary-column">${summary?.mean != null ? nf.format(summary.mean * f) : ''}</td>
        </tr>
        <tr>
          <td class="sub-label">${localize('summary.max', this.lang)}</td>
          ${maxCells}
          <td class="summary-column">${summary?.max != null ? nf.format(summary.max * f) : ''}</td>
        </tr>
      `;
    }

    // Cumulative entity — single row
    const dayCells = [];
    for (let d = 1; d <= 31; d++) {
      if (d > days) {
        dayCells.push(html`<td class="pad-cell"></td>`);
        continue;
      }
      const val = this.dailyValues.get(`${key}::${this.dateStr(d)}`);
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
      dayCells.push(html`<td class="data-cell ${cellContent ? 'has-data' : ''}">${cellContent}</td>`);
    }
    const summaryContent = summary
      ? `${summary.min != null ? nf.format(summary.min * f) : ''}/${summary.mean != null ? nf.format(summary.mean * f) : ''}/${summary.max != null ? nf.format(summary.max * f) : ''}`
      : '';
    const totalContent = summary?.total != null ? nf.format(summary.total * f) : '';
    return html`
      <tr>
        <td class="label-column" colspan="${hasMeasurement ? 2 : 1}">${hasStats ? '' : '⚠ '}${label}${unit}</td>
        ${dayCells}
        <td class="summary-column">${summaryContent}</td>
        <td class="summary-column">${totalContent}</td>
      </tr>
    `;
  }

  render() {
    const days = this.daysInMonth();
    const hasMeasurement = this.hasMeasurement();
    const dayHeaders = [];
    for (let d = 1; d <= 31; d++) {
      if (d > days) {
        dayHeaders.push(html`<th class="pad-cell"></th>`);
      } else {
        dayHeaders.push(html`<th class="day-cell-header">${d}</th>`);
      }
    }

    const hasCumulative = this.entityConfigs.some((cfg) => {
      const meta = this.entityMetadata.get(rowKey(cfg));
      return meta && meta.stateClass !== 'measurement';
    });

    return html`
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th class="label-column month-header" colspan="${hasMeasurement ? 2 : 1}">${this.monthName()}</th>
              ${dayHeaders}
              <th class="summary-column">${localize('table.summary', this.lang)}</th>
              ${hasCumulative ? html`<th class="summary-column">${localize('table.total', this.lang)}</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${this.entityConfigs.map((cfg) => this.renderEntityRow(cfg, hasMeasurement))}
          </tbody>
        </table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'monthly-table': MonthlyTable;
  }
}
