import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { ThresholdRule, ThresholdOperator } from '../types/card-config';
import type { HomeAssistant } from '../types/ha-types';
import { localize } from '../localize/localize';
import { operatorSymbol, operatorLabel } from '../services/threshold-operator';

const OPERATORS: ThresholdOperator[] = ['above', 'equals-above', 'equals-below', 'below', 'not-below', 'not-above'];

/** Per-period value fields: config key → header/label key suffix. */
const PERIOD_FIELDS = [
  { field: 'value', period: 'day' },
  { field: 'value_month', period: 'month' },
  { field: 'value_year', period: 'year' },
] as const;

function ruleSchema(lang: string) {
  return [
    {
      name: 'operator',
      required: true,
      selector: {
        select: {
          mode: 'dropdown',
          options: OPERATORS.map((op) => ({ value: op, label: operatorLabel(op, lang) })),
        },
      },
    },
    {
      // Unnamed on purpose: ha-form hands a named grid item data[name], an unnamed one the whole rule.
      name: '',
      type: 'grid',
      column_min_width: '120px',
      schema: PERIOD_FIELDS.map(({ field }) => ({
        name: field,
        selector: { number: { step: 'any', mode: 'box' } },
      })),
    },
    { name: 'name', selector: { text: {} } },
    { name: 'text_color', selector: { text: {} } },
    { name: 'background_color', selector: { text: {} } },
  ];
}

@customElement('calendar-stats-threshold-list-editor')
export class ThresholdListEditor extends LitElement {
  @property({ attribute: false }) hass?: HomeAssistant;
  @property({ attribute: false }) thresholds: ThresholdRule[] = [];
  @property() lang = 'en';

  private _schemaLang = '';
  private _schema: ReturnType<typeof ruleSchema> = [];

  static styles = css`
    :host {
      display: block;
    }
    ha-expansion-panel {
      margin-bottom: 8px;
    }
    .rule-content {
      padding: 8px 12px 12px;
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

  /** Merges the form value into the rule; cleared fields drop their key, `operator` never clears. */
  _handleFormChanged(index: number, value: Record<string, unknown>): void {
    const updated = this.thresholds.map((r, i) => {
      if (i !== index) return r;
      const next: Record<string, unknown> = { ...r, ...value };
      for (const key of Object.keys(next)) {
        if (next[key] === undefined || next[key] === '') delete next[key];
      }
      if (!next['operator']) next['operator'] = r.operator;
      return next as unknown as ThresholdRule;
    });
    this._dispatchChange(updated);
  }

  private _computeLabel = (schema: { name: string }): string => {
    const labels: Record<string, string> = {
      operator: localize('editor.threshold_operator', this.lang),
      value: localize('editor.threshold_value_day', this.lang),
      value_month: localize('editor.threshold_value_month', this.lang),
      value_year: localize('editor.threshold_value_year', this.lang),
      name: localize('editor.threshold_name', this.lang),
      text_color: localize('editor.text_color', this.lang),
      background_color: localize('editor.background_color', this.lang),
    };
    return labels[schema.name] ?? schema.name;
  };

  private _panelHeader(rule: ThresholdRule): string {
    const symbol = operatorSymbol(rule.operator, this.lang);
    const vals = PERIOD_FIELDS
      .filter(({ field }) => rule[field] != null)
      .map(({ field, period }) => `${localize(`editor.period_${period}`, this.lang)} ${rule[field]}`)
      .join(' · ');
    const base = `${symbol} ${vals || '—'}`;
    return rule.name ? `${rule.name} (${base})` : base;
  }

  render() {
    const lang = this.lang;
    if (this._schemaLang !== lang) {
      this._schema = ruleSchema(lang);
      this._schemaLang = lang;
    }

    return html`
      ${this.thresholds.map((rule, i) => html`
        <ha-expansion-panel
          .header=${this._panelHeader(rule)}
          outlined
        >
          <ha-icon-button
            slot="icons"
            .label=${localize('editor.remove_threshold', lang)}
            @click=${(e: Event) => this._removeThreshold(i, e)}
          ><ha-icon icon="mdi:delete"></ha-icon></ha-icon-button>
          <div class="rule-content">
            <ha-form
              .hass=${this.hass}
              .data=${rule}
              .schema=${this._schema}
              .computeLabel=${this._computeLabel}
              @value-changed=${(e: CustomEvent) => {
                e.stopPropagation();
                this._handleFormChanged(i, e.detail.value as Record<string, unknown>);
              }}
            ></ha-form>
          </div>
        </ha-expansion-panel>
      `)}
      <ha-button appearance="plain" data-action="add-threshold" @click=${() => this._addThreshold()}>
        <ha-icon slot="start" icon="mdi:plus"></ha-icon>
        ${localize('editor.add_threshold', lang)}
      </ha-button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-threshold-list-editor': ThresholdListEditor;
  }
}
