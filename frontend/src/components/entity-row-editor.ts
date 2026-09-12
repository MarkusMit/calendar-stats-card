import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { EntityRowConfig, ThresholdRule } from '../types/card-config';
import type { HomeAssistant } from '../types/ha-types';
import { localize } from '../localize/localize';
import './threshold-list-editor';
import './predecessor-list-editor';
import type { PredecessorConfig } from '../types/card-config';

const ENTITY_ROW_SCHEMA_MAIN = [
  { name: 'entity', selector: { statistic: {} } },
  { name: 'name', selector: { text: {} } },
  { name: 'precision', selector: { number: { min: 0, step: 1, mode: 'box' } } },
];

function advancedSchema(lang: string) {
  return [
    {
      name: 'state_class',
      selector: {
        select: {
          mode: 'dropdown',
          options: [
            { value: 'total', label: localize('editor.state_class_total', lang) },
            { value: 'total_increasing', label: localize('editor.state_class_total_increasing', lang) },
          ],
        },
      },
    },
    { name: 'factor', selector: { number: { step: 0.001, mode: 'box' } } },
    { name: 'unit', selector: { text: {} } },
    { name: 'text_color', selector: { text: {} } },
    { name: 'background_color', selector: { text: {} } },
  ];
}

const VISIBILITY_FIELDS = ['show_zero', 'show_min', 'show_avg', 'show_max'] as const;
type VisibilityField = typeof VISIBILITY_FIELDS[number];

@customElement('calendar-stats-entity-row-editor')
export class EntityRowEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) config!: EntityRowConfig;
  @property({ type: Number }) index = 0;
  @property() lang = 'en';
  /** Statistic ids known to the recorder; null while not loaded (no stale warning). */
  @property({ attribute: false }) knownStatisticIds: Set<string> | null = null;

  private _advancedSchemaLang = '';
  private _advancedSchema: ReturnType<typeof advancedSchema> = [];

  static styles = css`
    :host {
      display: block;
    }
    .advanced-content {
      padding: 8px 0;
    }
    .visibility-row {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 16px;
      padding: 8px 0;
    }
    .visibility-row ha-formfield {
      --mdc-typography-body2-font-size: 13px;
    }
    .stale-entity {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--warning-color, orange);
      font-size: 0.85em;
      padding: 4px 0;
    }
  `;

  private _onThresholdsChanged = (e: Event): void => {
    this._dispatchRowChanged({ thresholds: (e as CustomEvent<{ thresholds: ThresholdRule[] }>).detail.thresholds });
  };

  private _onPredecessorsChanged = (e: Event): void => {
    this._dispatchRowChanged({ predecessors: (e as CustomEvent<{ predecessors: PredecessorConfig[] }>).detail.predecessors });
  };

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('thresholds-changed', this._onThresholdsChanged);
    this.addEventListener('predecessors-changed', this._onPredecessorsChanged);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('thresholds-changed', this._onThresholdsChanged);
    this.removeEventListener('predecessors-changed', this._onPredecessorsChanged);
  }

  private _dispatchRowChanged(patch: Partial<EntityRowConfig>): void {
    this.dispatchEvent(new CustomEvent('row-changed', {
      detail: { index: this.index, config: { ...this.config, ...patch } },
      bubbles: true,
      composed: true,
    }));
  }

  private _computeLabel = (schema: { name: string }) => {
    const labels: Record<string, string> = {
      entity: localize('editor.entity_row', this.lang),
      name: localize('editor.name', this.lang),
      precision: localize('editor.precision', this.lang),
      state_class: localize('editor.state_class', this.lang),
      factor: localize('editor.factor', this.lang),
      unit: localize('editor.unit', this.lang),
      show_zero: localize('editor.show_zero', this.lang),
      show_min: localize('editor.show_min', this.lang),
      show_avg: localize('editor.show_avg', this.lang),
      show_max: localize('editor.show_max', this.lang),
      text_color: localize('editor.text_color', this.lang),
      background_color: localize('editor.background_color', this.lang),
    };
    return labels[schema.name] ?? schema.name;
  };

  private _handleFormChanged(ev: CustomEvent): void {
    const updated = { ...this.config, ...(ev.detail.value as Record<string, unknown>) };
    // A cleared dropdown arrives as undefined or ''; neither belongs in the config.
    if (!updated.state_class) delete updated.state_class;
    this.dispatchEvent(new CustomEvent('row-changed', {
      detail: { index: this.index, config: updated },
      bubbles: true,
      composed: true,
    }));
  }

  private _handleVisibilityChanged(field: VisibilityField, ev: Event): void {
    const target = ev.target as HTMLInputElement & { checked: boolean };
    const updated = { ...this.config, [field]: target.checked };
    this.dispatchEvent(new CustomEvent('row-changed', {
      detail: { index: this.index, config: updated },
      bubbles: true,
      composed: true,
    }));
  }

  private _isStale(): boolean {
    const entity = this.config?.entity;
    return Boolean(entity) && this.knownStatisticIds !== null && !this.knownStatisticIds.has(entity);
  }

  render() {
    const lang = this.lang ?? 'en';
    const stale = this._isStale();
    if (this._advancedSchemaLang !== lang) {
      this._advancedSchema = advancedSchema(lang);
      this._advancedSchemaLang = lang;
    }
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this.config}
        .schema=${ENTITY_ROW_SCHEMA_MAIN}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._handleFormChanged}
      ></ha-form>
      ${stale ? html`
        <div class="stale-entity" data-stale>
          <ha-icon icon="mdi:alert-circle"></ha-icon>
          ${localize('editor.statistic_not_found', lang)}
        </div>
      ` : ''}
      <ha-expansion-panel .header=${localize('editor.advanced', lang)}>
        <div class="advanced-content">
          <ha-form
            .hass=${this.hass}
            .data=${this.config}
            .schema=${this._advancedSchema}
            .computeLabel=${this._computeLabel}
            @value-changed=${this._handleFormChanged}
          ></ha-form>
          <div class="visibility-row">
            ${VISIBILITY_FIELDS.map((field) => html`
              <ha-formfield .label=${this._computeLabel({ name: field })}>
                <ha-checkbox
                  data-field=${field}
                  .checked=${this.config?.[field] !== false}
                  @change=${(e: Event) => this._handleVisibilityChanged(field, e)}
                ></ha-checkbox>
              </ha-formfield>
            `)}
          </div>
          <calendar-stats-threshold-list-editor
            .thresholds=${this.config?.thresholds ?? []}
            .lang=${lang}
          ></calendar-stats-threshold-list-editor>
          <calendar-stats-predecessor-list-editor
            .hass=${this.hass}
            .knownStatisticIds=${this.knownStatisticIds}
            .predecessors=${this.config?.predecessors ?? []}
            .lang=${lang}
          ></calendar-stats-predecessor-list-editor>
        </div>
      </ha-expansion-panel>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-entity-row-editor': EntityRowEditor;
  }
}
