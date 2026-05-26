import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ThresholdRule, ThresholdOperator } from '../types/card-config';
import { localize } from '../localize/localize';

const OPERATORS: ThresholdOperator[] = ['above', 'equals-above', 'equals-below', 'below', 'not-below', 'not-above'];

@customElement('calendar-stats-threshold-list-editor')
export class ThresholdListEditor extends LitElement {
  @property({ attribute: false }) thresholds: ThresholdRule[] = [];
  @property() lang = 'en';

  static styles = css`
    :host {
      display: block;
    }
    .threshold-rule {
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
      padding: 8px 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
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

  _removeThreshold(index: number): void {
    this._dispatchChange(this.thresholds.filter((_, i) => i !== index));
  }

  _handleRuleChange(index: number, field: string, value: unknown): void {
    const updated = this.thresholds.map((r, i) =>
      i === index ? { ...r, [field]: value } : r,
    );
    this._dispatchChange(updated);
  }

  private _operatorLabel(op: ThresholdOperator): string {
    const key = op.replace(/-/g, '_');
    return localize(`threshold.operators.${key}`, this.lang);
  }

  render() {
    const lang = this.lang;

    return html`
      <div>
        ${this.thresholds.map((rule, i) => html`
          <div class="threshold-rule">
            <ha-select
              data-field="operator"
              .label=${localize('editor.threshold_operator', lang)}
              .value=${rule.operator}
              @selected=${(e: CustomEvent) => this._handleRuleChange(i, 'operator', e.detail.value)}
            >
              ${OPERATORS.map((op) => html`
                <ha-list-item .value=${op}>${this._operatorLabel(op)}</ha-list-item>
              `)}
            </ha-select>

            <ha-textfield
              data-field="value"
              .label=${localize('editor.threshold_value', lang)}
              .value=${String(rule.value)}
              type="number"
              step="any"
              @change=${(e: Event) => {
                const v = parseFloat((e.target as HTMLInputElement).value);
                this._handleRuleChange(i, 'value', isNaN(v) ? 0 : v);
              }}
            ></ha-textfield>

            <ha-textfield
              data-field="threshold_name"
              .label=${localize('editor.threshold_name', lang)}
              .value=${rule.name ?? ''}
              @change=${(e: Event) => this._handleRuleChange(i, 'name', (e.target as HTMLInputElement).value)}
            ></ha-textfield>

            <ha-textfield
              data-field="threshold_text_color"
              .label=${localize('editor.text_color', lang)}
              .value=${rule.text_color ?? ''}
              @change=${(e: Event) => this._handleRuleChange(i, 'text_color', (e.target as HTMLInputElement).value)}
            ></ha-textfield>

            <ha-textfield
              data-field="threshold_background_color"
              .label=${localize('editor.background_color', lang)}
              .value=${rule.background_color ?? ''}
              @change=${(e: Event) => this._handleRuleChange(i, 'background_color', (e.target as HTMLInputElement).value)}
            ></ha-textfield>

            <ha-icon-button
              data-action="remove-threshold"
              .label=${localize('editor.remove_threshold', lang)}
              @click=${() => this._removeThreshold(i)}
            >
              <ha-icon icon="mdi:delete"></ha-icon>
            </ha-icon-button>
          </div>
        `)}

        <mwc-button
          data-action="add-threshold"
          @click=${() => this._addThreshold()}
        >
          <ha-icon icon="mdi:plus"></ha-icon>
          ${localize('editor.add_threshold', lang)}
        </mwc-button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-threshold-list-editor': ThresholdListEditor;
  }
}
