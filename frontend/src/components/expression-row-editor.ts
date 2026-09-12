import { LitElement, html, css } from 'lit';
import type { PropertyValues } from 'lit';
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
  /** Statistic ids known to the recorder; null while not loaded (ids are not checked). */
  @property({ attribute: false }) knownStatisticIds: Set<string> | null = null;

  /** Syntax errors block saving; an unknown id only warns (the row saves and renders empty). */
  @state() private _syntaxError: string | null = null;
  @state() private _entityWarning: string | null = null;

  static styles = css`
    :host {
      display: block;
    }
    .formula-error,
    .formula-warning {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.85em;
      padding: 4px 0;
    }
    .formula-error {
      color: var(--error-color, red);
    }
    .formula-warning {
      color: var(--warning-color, orange);
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

  private _computeHelper = (schema: { name: string }): string | undefined =>
    schema.name === 'expression' ? localize('editor.formula_help', this.lang) : undefined;

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('config') || changed.has('knownStatisticIds') || changed.has('lang')) {
      this._validate(this.config?.expression ?? '');
    }
  }

  /** Sets the syntax error and the unknown-id warning for `expression`; returns true when the syntax is valid. */
  private _validate(expression: string): boolean {
    this._syntaxError = null;
    this._entityWarning = null;
    if (!expression.trim()) return true;
    let ids: string[];
    try {
      ids = extractEntityIds(expression);
    } catch {
      this._syntaxError = localize('editor.invalid_expression_syntax', this.lang);
      return false;
    }
    const missing = this.knownStatisticIds === null ? undefined : ids.find((id) => !this.knownStatisticIds!.has(id));
    if (missing) {
      this._entityWarning = localize('editor.statistic_not_found_in_expression', this.lang).replace('{entity}', missing);
    }
    return true;
  }

  private _handleFormChanged(ev: CustomEvent): void {
    const formData = ev.detail.value as Record<string, unknown>;
    const expression = (formData['expression'] as string) ?? '';
    if (!this._validate(expression)) return;

    const updated = { ...this.config, ...formData };
    // show_zero defaults to true; only the non-default false is written.
    if (updated.show_zero === true) delete updated.show_zero;
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
        .computeHelper=${this._computeHelper}
        @value-changed=${this._handleFormChanged}
      ></ha-form>
      ${this._syntaxError ? html`
        <div class="formula-error" data-error>
          <ha-icon icon="mdi:alert-circle"></ha-icon>
          ${this._syntaxError}
        </div>
      ` : this._entityWarning ? html`
        <div class="formula-warning" data-warning>
          <ha-icon icon="mdi:alert-circle"></ha-icon>
          ${this._entityWarning}
        </div>
      ` : ''}
      <ha-expansion-panel .header=${localize('editor.advanced', lang)}>
        <div class="advanced-content">
          <ha-form
            .hass=${this.hass}
            .data=${{ ...this.config, show_zero: this.config?.show_zero !== false }}
            .schema=${EXPRESSION_ROW_SCHEMA_ADVANCED}
            .computeLabel=${this._computeLabel}
            @value-changed=${this._handleFormChanged}
          ></ha-form>
          <calendar-stats-threshold-list-editor
            .hass=${this.hass}
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
