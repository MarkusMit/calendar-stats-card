import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ThresholdRule, ThresholdOperator } from '../types/card-config';
import { localize } from '../localize/localize';

const OPERATORS: ThresholdOperator[] = ['above', 'equals-above', 'equals-below', 'below', 'not-below', 'not-above'];

/** Per-period value fields: config key → editor label key suffix. */
const PERIOD_FIELDS = [
  { field: 'value', labelKey: 'threshold_value_day' },
  { field: 'value_month', labelKey: 'threshold_value_month' },
  { field: 'value_year', labelKey: 'threshold_value_year' },
] as const;

const OPERATOR_SYMBOL: Record<ThresholdOperator, string> = {
  'above': '>',
  'equals-above': '≥',
  'equals-below': '≤',
  'below': '<',
  'not-below': '≥',
  'not-above': '≤',
};

@customElement('calendar-stats-threshold-list-editor')
export class ThresholdListEditor extends LitElement {
  @property({ attribute: false }) thresholds: ThresholdRule[] = [];
  @property() lang = 'en';

  static styles = css`
    :host {
      display: block;
    }
    .section-title {
      font-size: 12px;
      font-weight: 500;
      color: var(--secondary-text-color, rgba(0,0,0,0.54));
      padding: 8px 0 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .threshold-fields {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px 0;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .field-row {
      display: flex;
      flex-direction: row;
      gap: 8px;
    }
    .field-row .field {
      flex: 1 1 0;
      min-width: 0;
    }
    .field label {
      font-size: 11px;
      color: var(--secondary-text-color, rgba(0,0,0,0.54));
    }
    .field input,
    .field select {
      display: block;
      width: 100%;
      box-sizing: border-box;
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.38));
      padding: 4px 2px;
      font-size: 14px;
      color: var(--primary-text-color, rgba(0,0,0,0.87));
      outline: none;
      font-family: inherit;
    }
    .field input:focus,
    .field select:focus {
      border-bottom: 2px solid var(--primary-color, #03a9f4);
    }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
    }
    .panel-header-label {
      font-size: 14px;
    }
    .add-chip {
      background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.12);
      border-radius: 18px;
      color: var(--primary-color);
      cursor: pointer;
      padding: 6px 14px;
      font-size: 14px;
      font-weight: 500;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: inherit;
      margin-top: 8px;
    }
    .add-chip:hover {
      background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.22);
    }
    .add-chip ha-icon {
      --mdc-icon-size: 18px;
      color: var(--primary-color);
    }
  `;

  private _dispatchChange(rules: ThresholdRule[]): void {
    this.dispatchEvent(new CustomEvent('thresholds-changed', {
      detail: { thresholds: rules },
      bubbles: true,
      composed: true,
    }));
  }

  _addThreshold(): void {
    this._dispatchChange([...this.thresholds, { operator: 'above', value: 0 }]);
  }

  _removeThreshold(index: number, e?: Event): void {
    e?.stopPropagation();
    this._dispatchChange(this.thresholds.filter((_, i) => i !== index));
  }

  _handleRuleChange(index: number, field: string, value: unknown): void {
    const updated = this.thresholds.map((r, i) => {
      if (i !== index) return r;
      if (value === undefined) {
        const rest = { ...(r as Record<string, unknown>) };
        delete rest[field];
        return rest as unknown as ThresholdRule;
      }
      return { ...r, [field]: value };
    });
    this._dispatchChange(updated);
  }

  private _operatorLabel(op: ThresholdOperator): string {
    const key = op.replace(/-/g, '_');
    return localize(`threshold.operators.${key}`, this.lang);
  }

  private _panelHeader(rule: ThresholdRule): string {
    const symbol = OPERATOR_SYMBOL[rule.operator] ?? rule.operator;
    const vals = [rule.value, rule.value_month, rule.value_year]
      .filter((v): v is number => v != null)
      .join('/');
    const base = `${symbol} ${vals || '—'}`;
    return rule.name ? `${rule.name} (${base})` : base;
  }

  render() {
    const lang = this.lang;

    return html`
      <div class="section-title">${localize('editor.thresholds', lang)}</div>
      ${this.thresholds.map((rule, i) => html`
        <ha-expansion-panel
          .header=${this._panelHeader(rule)}
          outlined
        >
          <div class="threshold-fields">
            <div class="field">
              <label>${localize('editor.threshold_operator', lang)}</label>
              <select
                data-field="operator"
                @change=${(e: Event) => this._handleRuleChange(i, 'operator', (e.target as HTMLSelectElement).value)}
              >
                ${OPERATORS.map((op) => html`
                  <option value=${op} ?selected=${rule.operator === op}>${this._operatorLabel(op)}</option>
                `)}
              </select>
            </div>
            <div class="field-row">
              ${PERIOD_FIELDS.map(({ field, labelKey }) => html`
                <div class="field">
                  <label>${localize(`editor.${labelKey}`, lang)}</label>
                  <input
                    data-field=${field}
                    type="number"
                    step="any"
                    .value=${rule[field] != null ? String(rule[field]) : ''}
                    @change=${(e: Event) => {
                      const v = parseFloat((e.target as HTMLInputElement).value);
                      this._handleRuleChange(i, field, isNaN(v) ? undefined : v);
                    }}
                  />
                </div>
              `)}
            </div>
            <div class="field">
              <label>${localize('editor.threshold_name', lang)}</label>
              <input
                data-field="threshold_name"
                type="text"
                .value=${rule.name ?? ''}
                @change=${(e: Event) => this._handleRuleChange(i, 'name', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="field">
              <label>${localize('editor.text_color', lang)}</label>
              <input
                data-field="threshold_text_color"
                type="text"
                .value=${rule.text_color ?? ''}
                @change=${(e: Event) => this._handleRuleChange(i, 'text_color', (e.target as HTMLInputElement).value)}
              />
            </div>
            <div class="field">
              <label>${localize('editor.background_color', lang)}</label>
              <input
                data-field="threshold_background_color"
                type="text"
                .value=${rule.background_color ?? ''}
                @change=${(e: Event) => this._handleRuleChange(i, 'background_color', (e.target as HTMLInputElement).value)}
              />
            </div>
            <ha-icon-button
              .label=${localize('editor.remove_threshold', lang)}
              @click=${(e: Event) => this._removeThreshold(i, e)}
            ><ha-icon icon="mdi:delete"></ha-icon></ha-icon-button>
          </div>
        </ha-expansion-panel>
      `)}
      <button type="button" class="add-chip" data-action="add-threshold" @click=${() => this._addThreshold()}>
        <ha-icon icon="mdi:plus"></ha-icon>
        ${localize('editor.add_threshold', lang)}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-threshold-list-editor': ThresholdListEditor;
  }
}
