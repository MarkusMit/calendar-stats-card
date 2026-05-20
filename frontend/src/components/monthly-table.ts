import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { EntityConfig } from '../types/card-config';
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
    }
    table {
      border-collapse: collapse;
      white-space: nowrap;
    }
    th, td {
      padding: 2px 4px;
    }
    td.data-cell {
      padding: 2px 4px;
      color: var(--primary-text-color);
      border: 1px solid var(--divider-color, #ccc);
      text-align: right;
      min-width: 24px;
    }
    .label-column {
      position: sticky;
      left: 0;
      z-index: 1;
      background: var(--card-background-color, #fff);
      color: var(--secondary-text-color);
      white-space: nowrap;
      padding: 2px 8px 2px 4px;
      border-right: 1px solid var(--divider-color, #ccc);
    }
    .month-header {
      font-weight: bold;
      padding: 4px;
      color: var(--primary-text-color);
    }
    .summary-column {
      color: var(--secondary-text-color);
      border: 1px solid var(--divider-color, #ccc);
      text-align: right;
      padding: 2px 4px;
    }
    .day-cell-header {
      text-align: right;
      padding: 2px 4px;
      color: var(--secondary-text-color);
      font-size: 0.75em;
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

  private renderEntityRow(cfg: EntityConfig) {
    const meta = this.entityMetadata.get(cfg.entity);
    const days = this.daysInMonth();
    const label = cfg.label ?? meta?.friendlyName ?? cfg.entity;
    const unit = meta?.unitOfMeasurement ? ` [${meta.unitOfMeasurement}]` : '';
    const hasStats = meta?.hasStatistics ?? true;
    const hasError = this.entityErrors.has(cfg.entity);
    const nf = new Intl.NumberFormat(this.lang, { maximumFractionDigits: 1 });

    const dayCells = [];
    for (let d = 1; d <= days; d++) {
      const key = `${cfg.entity}::${this.dateStr(d)}`;
      const val = this.dailyValues.get(key);
      let cellContent = '';
      if (hasError) {
        cellContent = '—';
      } else if (!hasStats) {
        cellContent = '';
      } else if (val?.kind === 'measurement') {
        cellContent = `${nf.format(val.min)}/${nf.format(val.mean)}/${nf.format(val.max)}${val.partialCoverage ? '*' : ''}`;
      } else if (val?.kind === 'cumulative') {
        cellContent = `${nf.format(val.sum)}${val.partialCoverage ? '*' : ''}`;
      }
      dayCells.push(html`<td class="data-cell">${cellContent}</td>`);
    }

    const summaryKey = `${cfg.entity}::${this.year}-${this.month}`;
    const summary = this.monthlySummaries.get(summaryKey);
    const summaryContent = summary
      ? `${summary.min != null ? nf.format(summary.min) : ''}/${summary.mean != null ? nf.format(summary.mean) : ''}/${summary.max != null ? nf.format(summary.max) : ''}`
      : '';

    const isCumulative = meta && meta.stateClass !== 'measurement';
    const totalContent = isCumulative && summary?.total != null ? nf.format(summary.total) : '';

    return html`
      <tr>
        <td class="label-column">${hasStats ? '' : '⚠ '}${label}${unit}</td>
        ${dayCells}
        <td class="summary-column">${summaryContent}</td>
        ${isCumulative ? html`<td class="summary-column">${totalContent}</td>` : ''}
      </tr>
    `;
  }

  render() {
    const days = this.daysInMonth();
    const dayHeaders = [];
    for (let d = 1; d <= days; d++) {
      dayHeaders.push(html`<th class="day-cell-header">${d}</th>`);
    }

    const hasCumulative = this.entityConfigs.some((cfg) => {
      const meta = this.entityMetadata.get(cfg.entity);
      return meta && meta.stateClass !== 'measurement';
    });

    return html`
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th class="label-column month-header" colspan="1">${this.monthName()}</th>
              ${dayHeaders}
              <th class="summary-column">${localize('table.summary', this.lang)}</th>
              ${hasCumulative ? html`<th class="summary-column">${localize('table.total', this.lang)}</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${this.entityConfigs.map((cfg) => this.renderEntityRow(cfg))}
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
