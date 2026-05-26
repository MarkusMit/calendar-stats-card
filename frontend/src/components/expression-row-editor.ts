import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ExpressionRowConfig, ThresholdRule } from '../types/card-config';
import type { HomeAssistant } from '../types/ha-types';
import { localize } from '../localize/localize';
import { extractEntityIds } from '../services/expression-evaluator';
import './threshold-list-editor';

@customElement('calendar-stats-expression-row-editor')
export class ExpressionRowEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) config!: ExpressionRowConfig;
  @property({ type: Number }) index = 0;
  @property() lang = 'en';

  @state() _dirtyFormula = '';
  @state() _formulaError: string | null = null;

  static styles = css`
    :host {
      display: block;
    }
    .row-fields {
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding: 8px 0;
    }
    .formula-error {
      color: var(--error-color, red);
      font-size: 0.85em;
    }
  `;

  private _onThresholdsChanged = (e: Event): void => {
    this._handleNonFormulaFieldChange('thresholds', (e as CustomEvent<{ thresholds: ThresholdRule[] }>).detail.thresholds);
  };

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('thresholds-changed', this._onThresholdsChanged);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('thresholds-changed', this._onThresholdsChanged);
  }

  willUpdate(changedProps: Map<string, unknown>): void {
    if (changedProps.has('config') && this.config) {
      this._dirtyFormula = this.config.expression ?? '';
    }
  }

  _handleFormulaBlur(value: string): void {
    this._dirtyFormula = value;
    if (!value.trim()) {
      this._formulaError = null;
      return;
    }
    const lang = this.lang ?? 'en';
    let entityIds: string[];
    try {
      entityIds = extractEntityIds(value);
    } catch {
      this._formulaError = localize('editor.invalid_expression_syntax', lang);
      return;
    }
    for (const id of entityIds) {
      if (this.hass && !this.hass.states[id]) {
        this._formulaError = localize('editor.entity_not_found_in_expression', lang).replace('{entity}', id);
        return;
      }
    }
    this._formulaError = null;
    const rest = { ...(this.config as ExpressionRowConfig & Record<string, unknown>) } as Record<string, unknown>;
    delete rest['expression'];
    this.dispatchEvent(new CustomEvent('row-changed', {
      detail: { index: this.index, config: { ...rest, expression: value } },
      bubbles: true,
      composed: true,
    }));
  }

  _handleNonFormulaFieldChange(field: string, value: unknown): void {
    const updated = { ...this.config, [field]: value } as ExpressionRowConfig & Record<string, unknown>;
    if (value === undefined || value === null || value === '') {
      delete updated[field];
    }
    this.dispatchEvent(new CustomEvent('row-changed', {
      detail: { index: this.index, config: updated },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    const lang = this.lang ?? 'en';
    const formula = this._dirtyFormula || this.config?.expression || '';
    const name = this.config?.name ?? '';
    const unit = this.config?.unit ?? '';
    const precision = this.config?.precision ?? '';

    return html`
      <div class="row-fields">
        <ha-textarea
          data-field="expression"
          .label=${localize('editor.formula', lang)}
          .value=${formula}
          placeholder="{{ sensor.a - sensor.b }}"
          @blur=${(e: FocusEvent) => this._handleFormulaBlur((e.target as HTMLTextAreaElement).value)}
        ></ha-textarea>

        ${this._formulaError ? html`
          <div class="formula-error">${this._formulaError}</div>
        ` : ''}

        <ha-textfield
          data-field="name"
          .label=${localize('editor.name', lang)}
          .value=${name}
          @change=${(e: Event) => this._handleNonFormulaFieldChange('name', (e.target as HTMLInputElement).value)}
        ></ha-textfield>

        <ha-textfield
          data-field="unit"
          .label=${localize('editor.unit', lang)}
          .value=${unit}
          @change=${(e: Event) => this._handleNonFormulaFieldChange('unit', (e.target as HTMLInputElement).value)}
        ></ha-textfield>

        <ha-textfield
          data-field="precision"
          .label=${localize('editor.precision', lang)}
          .value=${String(precision)}
          type="number"
          min="0"
          step="1"
          @change=${(e: Event) => {
            const v = parseInt((e.target as HTMLInputElement).value, 10);
            this._handleNonFormulaFieldChange('precision', isNaN(v) ? undefined : v);
          }}
        ></ha-textfield>

        <ha-expansion-panel
          data-section="advanced"
          .header=${localize('editor.advanced', lang)}
        >
          <ha-checkbox
            data-field="show_zero"
            .checked=${this.config?.show_zero ?? false}
            @change=${(e: Event) => this._handleNonFormulaFieldChange('show_zero', (e.target as HTMLInputElement).checked)}
          ></ha-checkbox>
          <label>${localize('editor.show_zero', lang)}</label>

          <ha-textfield
            data-field="text_color"
            .label=${localize('editor.text_color', lang)}
            .value=${this.config?.text_color ?? ''}
            @change=${(e: Event) => this._handleNonFormulaFieldChange('text_color', (e.target as HTMLInputElement).value)}
          ></ha-textfield>

          <ha-textfield
            data-field="background_color"
            .label=${localize('editor.background_color', lang)}
            .value=${this.config?.background_color ?? ''}
            @change=${(e: Event) => this._handleNonFormulaFieldChange('background_color', (e.target as HTMLInputElement).value)}
          ></ha-textfield>

          <calendar-stats-threshold-list-editor
            .thresholds=${this.config?.thresholds ?? []}
            .lang=${lang}
          ></calendar-stats-threshold-list-editor>
        </ha-expansion-panel>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-expression-row-editor': ExpressionRowEditor;
  }
}
