import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { localize } from '../localize/localize';
import { buildCellStyle } from '../services/threshold-resolver';
import { ContrastResolver } from '../services/readable-text';
import type { ThresholdOperator, ThresholdRule } from '../types/card-config';
import type { ExceedanceGroup, ExceedanceRow } from '../services/threshold-exceedance';

const OPERATOR_KEYS: Record<ThresholdOperator, string> = {
  'above': 'above',
  'equals-above': 'equals_above',
  'equals-below': 'equals_below',
  'below': 'below',
  'not-below': 'not_below',
  'not-above': 'not_above',
};

/**
 * Bottom-of-page summary: per named day threshold, how many days of the viewed
 * range it applied to. Purely presentational — the counting lives in
 * services/threshold-exceedance so both views share one source of numbers.
 */
@customElement('calendar-stats-exceedance-table')
export class ExceedanceTable extends LitElement {
  @property({ attribute: false }) groups: ExceedanceGroup[] = [];
  /** Years to break the counts down by; fewer than two renders the plain layout. */
  @property({ attribute: false }) years: number[] = [];
  @property({ type: String }) lang = 'en';

  /** Shared auto-contrast text-color resolver for threshold-colored cells. */
  private _contrast = new ContrastResolver();

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this._contrast.dispose();
  }

  static styles = css`
    :host {
      display: block;
      margin-top: 8px;
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
    .title {
      font-size: 0.75em;
      font-weight: 600;
      color: var(--secondary-text-color);
      margin-bottom: 2px;
    }
    thead th {
      font-weight: normal;
      font-size: 0.9em;
      color: var(--secondary-text-color);
      text-align: right;
      background: var(--secondary-background-color, #f0f0f0);
      border-bottom: 1px solid var(--divider-color, #ccc);
    }
    thead th.year-group {
      text-align: center;
      font-weight: 600;
      border-left: 1px solid var(--divider-color, #ccc);
    }
    thead th.rule-column {
      text-align: left;
    }
    tbody tr {
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
    }
    td.group-label {
      color: var(--secondary-text-color);
      font-weight: 600;
      font-size: 0.85em;
      padding-top: 3px;
    }
    td.rule-name {
      color: var(--primary-text-color);
      padding: 1px 6px 1px 4px;
      border-left: 1px solid var(--divider-color, #ccc);
      border-right: 1px solid var(--divider-color, #ccc);
    }
    td.count-cell {
      color: var(--primary-text-color);
      text-align: right;
      min-width: 34px;
      border-right: 1px solid var(--divider-color, #ccc);
    }
    /* Tint the running totals so they read as a column, not as more digits. */
    td.total-cell {
      background: var(--secondary-background-color, #f0f0f0);
    }
    /* The range-wide pair carries the answer most readers want first. */
    td.count-cell.all-years,
    thead th.year-group.all-years {
      font-weight: 700;
    }
  `;

  /** "Summer day (≥ 25)" — the name alone does not say what the threshold is. */
  private _ruleLabel(rule: ThresholdRule): string {
    const symbol = localize(`threshold.symbols.${OPERATOR_KEYS[rule.operator]}`, this.lang);
    return `${rule.name} (${symbol} ${rule.value})`;
  }

  /** Per-year columns only pay off from two years on — one year duplicates the overall pair. */
  private get _yearColumns(): number[] {
    return this.years.length > 1 ? this.years : [];
  }

  private _renderHead() {
    const years = this._yearColumns;
    if (years.length === 0) {
      return html`
        <tr>
          <th class="rule-column">${localize('exceedance.title', this.lang)}</th>
          <th>${localize('exceedance.band', this.lang)}</th>
          <th>${localize('exceedance.total', this.lang)}</th>
        </tr>
      `;
    }
    return html`
      <tr>
        <th class="rule-column" rowspan="2">${localize('exceedance.title', this.lang)}</th>
        ${years.map((y) => html`<th class="year-group" colspan="2">${y}</th>`)}
        <th class="year-group all-years" colspan="2">${localize('exceedance.all_years', this.lang)}</th>
      </tr>
      <tr>
        ${[...years, null].map(() => html`
          <th>${localize('exceedance.band', this.lang)}</th>
          <th>${localize('exceedance.total', this.lang)}</th>
        `)}
      </tr>
    `;
  }

  private _renderCounts(row: ExceedanceRow) {
    const years = this._yearColumns;
    const perYear = years.map((y) => row.byYear.find((e) => e.year === y) ?? { year: y, band: 0, cumulative: 0 });
    const all = { year: 0, band: row.band, cumulative: row.cumulative };
    // The range-wide pair is only worth emphasising when year columns sit beside it.
    const emphasis = years.length > 0 ? ' all-years' : '';
    return [...perYear, all].map((entry, i) => {
      const mark = i === perYear.length ? emphasis : '';
      return html`
        <td class="count-cell band-cell${mark}">${entry.band}</td>
        <td class="count-cell total-cell${mark}">${entry.cumulative}</td>
      `;
    });
  }

  override render() {
    if (this.groups.length === 0) return '';
    const columns = 1 + 2 * (this._yearColumns.length + 1);
    return html`
      <div class="title">${localize('exceedance.title', this.lang)}</div>
      <div class="table-container">
        <table>
          <thead>${this._renderHead()}</thead>
          <tbody>
            ${this.groups.map((g) => html`
              <tr>
                <td class="group-label" colspan="${columns}">${g.label}</td>
              </tr>
              ${g.rows.map((row) => html`
                <tr>
                  <td class="rule-name" style=${ifDefined(buildCellStyle(
                    undefined, undefined, row.rule, this._contrast.textFor(row.rule.background_color),
                  ))}>${this._ruleLabel(row.rule)}</td>
                  ${this._renderCounts(row)}
                </tr>
              `)}
            `)}
          </tbody>
        </table>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-exceedance-table': ExceedanceTable;
  }
}
