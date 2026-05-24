import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
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

  override updated() {
    const labelCol = this.shadowRoot?.querySelector<HTMLElement>('td.label-column[rowspan]');
    if (labelCol) {
      this.style.setProperty('--label-col-width', `${labelCol.getBoundingClientRect().width}px`);
    }
  }

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
      for (let d = 1; d <= 31; d++) {
        if (d > days) {
          minCells.push(html`<td class="pad-cell" style=${ifDefined(labelStyle)}></td>`);
          meanCells.push(html`<td class="pad-cell" style=${ifDefined(labelStyle)}></td>`);
          maxCells.push(html`<td class="pad-cell" style=${ifDefined(labelStyle)}></td>`);
          continue;
        }
        const val = this.dailyValues.get(`${key}::${this.dateStr(d)}`);
        if (val?.kind === 'measurement') {
          const pc = val.partialCoverage ? '*' : '';
          const showZero = cfg.show_zero !== false;
          const minV = val.min * f;
          const meanV = val.mean * f;
          const maxV = val.max * f;
          minCells.push(minV === 0 && !showZero ? html`<td class="data-cell" style=${ifDefined(labelStyle)}></td>` : html`<td class="data-cell has-data" style=${ifDefined(labelStyle)}>${nf.format(minV)}${pc}</td>`);
          meanCells.push(meanV === 0 && !showZero ? html`<td class="data-cell" style=${ifDefined(labelStyle)}></td>` : html`<td class="data-cell has-data" style=${ifDefined(labelStyle)}>${nf.format(meanV)}</td>`);
          maxCells.push(maxV === 0 && !showZero ? html`<td class="data-cell" style=${ifDefined(labelStyle)}></td>` : html`<td class="data-cell has-data" style=${ifDefined(labelStyle)}>${nf.format(maxV)}${pc}</td>`);
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

      const hasCumulative = this.entityConfigs.some((c) => {
        const m = this.entityMetadata.get(rowKey(c));
        return m && m.stateClass !== 'measurement';
      });
      return html`${visibleRows.map((row, idx) => html`
        <tr class="${idx < visibleRows.length - 1 ? 'sub-row' : ''}">
          ${idx === 0 ? html`<td class="label-column" rowspan="${rowspan}" style=${ifDefined(labelStyle)}>${hasStats ? '' : '⚠ '}${label}${unit}</td>` : ''}
          <td class="sub-label" style=${ifDefined(labelStyle)}>${localize(row === 'min' ? 'summary.min' : row === 'avg' ? 'summary.avg' : 'summary.max', this.lang)}</td>
          ${cells[row]}
          <td class="summary-column" style=${ifDefined(labelStyle)}>${summaryVals[row]}</td>
          ${hasCumulative ? html`<td class="summary-column" style=${ifDefined(labelStyle)}></td>` : ''}
        </tr>
      `)}`;
    }

    // Cumulative entity — single row
    const dayCells = [];
    for (let d = 1; d <= 31; d++) {
      if (d > days) {
        dayCells.push(html`<td class="pad-cell" style=${ifDefined(labelStyle)}></td>`);
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
      dayCells.push(html`<td class="data-cell ${cellContent ? 'has-data' : ''}" style=${ifDefined(labelStyle)}>${cellContent}</td>`);
    }
    const cumulErc = 'entity' in cfg ? cfg : null;
    const showMin = cumulErc?.show_min !== false;
    const showAvg = cumulErc?.show_avg !== false;
    const showMax = cumulErc?.show_max !== false;
    let summaryContent = '';
    if (summary && (showMin || showAvg || showMax)) {
      const parts: string[] = [];
      if (showMin) parts.push(summary.min != null ? nf.format(summary.min * f) : '');
      if (showAvg) parts.push(summary.mean != null ? nf.format(summary.mean * f) : '');
      if (showMax) parts.push(summary.max != null ? nf.format(summary.max * f) : '');
      summaryContent = parts.join('/');
    }
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
