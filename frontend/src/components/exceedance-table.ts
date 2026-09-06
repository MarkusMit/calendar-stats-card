import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { localize } from '../localize/localize';
import { buildCellStyle } from '../services/threshold-resolver';
import { ContrastResolver } from '../services/readable-text';
import type { ExceedanceGroup } from '../services/threshold-exceedance';

/**
 * Bottom-of-page summary: per named day threshold, how many days of the viewed
 * range it applied to. Purely presentational — the counting lives in
 * services/threshold-exceedance so both views share one source of numbers.
 */
@customElement('calendar-stats-exceedance-table')
export class ExceedanceTable extends LitElement {
  @property({ attribute: false }) groups: ExceedanceGroup[] = [];
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
  `;

  override render() {
    if (this.groups.length === 0) return '';
    return html`
      <div class="title">${localize('exceedance.title', this.lang)}</div>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th class="rule-column">${localize('exceedance.title', this.lang)}</th>
              <th>${localize('exceedance.total', this.lang)}</th>
            </tr>
          </thead>
          <tbody>
            ${this.groups.map((g) => html`
              <tr>
                <td class="group-label" colspan="2">${g.label}</td>
              </tr>
              ${g.rows.map((row) => html`
                <tr>
                  <td class="rule-name" style=${ifDefined(buildCellStyle(
                    undefined, undefined, row.rule, this._contrast.textFor(row.rule.background_color),
                  ))}>${row.rule.name}</td>
                  <td class="count-cell total-cell">${row.cumulative}</td>
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
