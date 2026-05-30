import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ExpressionRowConfig, ThresholdRule } from '../types/card-config';
import type { HomeAssistant } from '../types/ha-types';
import { localize } from '../localize/localize';
import { extractEntityIds } from '../services/expression-evaluator';
import './threshold-list-editor';

const EXPRESSION_ROW_SCHEMA_MAIN = [
  { name: 'expression', selector: { text: { multiline: true } } },
  { name: 'name', selector: { text: {} } },
  { name: 'unit', selector: { text: {} } },
  { name: 'precision', selector: { number: { min: 0, step: 1, mode: 'box' } } },
];

const EXPRESSION_ROW_SCHEMA_ADVANCED = [
  { name: 'show_zero', selector: { boolean: {} } },
  { name: 'text_color', selector: { text: {} } },
  { name: 'background_color', selector: { text: {} } },
];

@customElement('calendar-stats-expression-row-editor')
export class ExpressionRowEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) config!: ExpressionRowConfig;
  @property({ type: Number }) index = 0;
  @property() lang = 'en';

  @state() _formulaError: string | null = null;

  static styles = css`
    :host {
      display: block;
    }
    .formula-error {
      color: var(--error-color, red);
      font-size: 0.85em;
      padding: 4px 0;
    }
    .advanced-content {
      padding: 8px 0;
    }
  `;

  private _onThresholdsChanged = (e: Event): void => {
    const thresholds = (e as CustomEvent<{ thresholds: ThresholdRule[] }>).detail.thresholds;
    this.dispatchEvent(new CustomEvent('row-changed', {
      detail: { index: this.index, config: { ...this.config, thresholds } },
      bubbles: true,
      composed: true,
    }));
  };

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('thresholds-changed', this._onThresholdsChanged);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('thresholds-changed', this._onThresholdsChanged);
  }

  private _computeLabel = (schema: { name: string }) => {
    const labels: Record<string, string> = {
      expression: localize('editor.formula', this.lang),
      name: localize('editor.name', this.lang),
      unit: localize('editor.unit', this.lang),
      precision: localize('editor.precision', this.lang),
      show_zero: localize('editor.show_zero', this.lang),
      text_color: localize('editor.text_color', this.lang),
      background_color: localize('editor.background_color', this.lang),
    };
    return labels[schema.name] ?? schema.name;
  };

  private _handleFormChanged(ev: CustomEvent): void {
    const formData = ev.detail.value as Record<string, unknown>;
    const expression = (formData['expression'] as string) ?? '';

    if (expression.trim()) {
      try {
        const entityIds = extractEntityIds(expression);
        this._formulaError = null;
        for (const id of entityIds) {
          if (this.hass && !this.hass.states[id]) {
            this._formulaError = localize('editor.entity_not_found_in_expression', this.lang).replace('{entity}', id);
            break;
          }
        }
      } catch {
        this._formulaError = localize('editor.invalid_expression_syntax', this.lang);
      }
    } else {
      this._formulaError = null;
    }

    if (this._formulaError) return;

    const updated = { ...this.config, ...formData };
    this.dispatchEvent(new CustomEvent('row-changed', {
      detail: { index: this.index, config: updated },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    const lang = this.lang ?? 'en';
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this.config}
        .schema=${EXPRESSION_ROW_SCHEMA_MAIN}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._handleFormChanged}
      ></ha-form>
      ${this._formulaError ? html`
        <div class="formula-error">${this._formulaError}</div>
      ` : ''}
      <ha-expansion-panel .header=${localize('editor.advanced', lang)}>
        <div class="advanced-content">
          <ha-form
            .hass=${this.hass}
            .data=${this.config}
            .schema=${EXPRESSION_ROW_SCHEMA_ADVANCED}
            .computeLabel=${this._computeLabel}
            @value-changed=${this._handleFormChanged}
          ></ha-form>
          <calendar-stats-threshold-list-editor
            .thresholds=${this.config?.thresholds ?? []}
            .lang=${lang}
          ></calendar-stats-threshold-list-editor>
        </div>
      </ha-expansion-panel>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-expression-row-editor': ExpressionRowEditor;
  }
}
