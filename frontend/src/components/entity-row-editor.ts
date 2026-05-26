import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { EntityRowConfig, ThresholdRule } from '../types/card-config';
import type { HomeAssistant } from '../types/ha-types';
import { localize } from '../localize/localize';
import './threshold-list-editor';
import './predecessor-list-editor';
import type { PredecessorConfig } from '../types/card-config';

@customElement('calendar-stats-entity-row-editor')
export class EntityRowEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) config!: EntityRowConfig;
  @property({ type: Number }) index = 0;
  @property() lang = 'en';

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
    .stale-entity {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--warning-color, orange);
      font-size: 0.85em;
    }
  `;

  private _onThresholdsChanged = (e: Event): void => {
    this._handleFieldChange('thresholds', (e as CustomEvent<{ thresholds: ThresholdRule[] }>).detail.thresholds);
  };

  private _onPredecessorsChanged = (e: Event): void => {
    this._handleFieldChange('predecessors', (e as CustomEvent<{ predecessors: PredecessorConfig[] }>).detail.predecessors);
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

  _handleFieldChange(field: string, value: unknown): void {
    const { entity, name, precision, ...rest } = this.config as EntityRowConfig & Record<string, unknown>;
    const updated: EntityRowConfig & Record<string, unknown> = { entity, name, precision, ...rest, [field]: value };
    if (value === undefined || value === null || value === '') {
      delete updated[field];
    }
    this.dispatchEvent(new CustomEvent('row-changed', {
      detail: { index: this.index, config: updated },
      bubbles: true,
      composed: true,
    }));
  }

  private _isStale(): boolean {
    return this.hass != null && this.config?.entity != null && !this.hass.states[this.config.entity];
  }

  render() {
    const lang = this.lang ?? 'en';
    const entity = this.config?.entity ?? '';
    const name = this.config?.name ?? '';
    const precision = this.config?.precision ?? '';
    const stale = this._isStale();

    return html`
      <div class="row-fields">
        <ha-entity-picker
          data-field="entity"
          .hass=${this.hass}
          .value=${entity}
          .label=${localize('editor.predecessor_entity', lang)}
          allow-custom-entity
          @value-changed=${(e: CustomEvent) => this._handleFieldChange('entity', e.detail.value)}
        ></ha-entity-picker>

        ${stale ? html`
          <div class="stale-entity" data-stale>
            <ha-icon icon="mdi:alert-circle"></ha-icon>
            ${localize('editor.entity_not_found', lang)}
          </div>
        ` : ''}

        <ha-textfield
          data-field="name"
          .label=${localize('editor.name', lang)}
          .value=${name}
          @change=${(e: Event) => this._handleFieldChange('name', (e.target as HTMLInputElement).value)}
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
            this._handleFieldChange('precision', isNaN(v) ? undefined : v);
          }}
        ></ha-textfield>

        <ha-expansion-panel
          data-section="advanced"
          .header=${localize('editor.advanced', lang)}
        >
          <ha-textfield
            data-field="factor"
            .label=${localize('editor.factor', lang)}
            .value=${String(this.config?.factor ?? '')}
            type="number"
            step="any"
            @change=${(e: Event) => {
              const v = parseFloat((e.target as HTMLInputElement).value);
              this._handleFieldChange('factor', isNaN(v) ? undefined : v);
            }}
          ></ha-textfield>

          <ha-textfield
            data-field="unit"
            .label=${localize('editor.unit', lang)}
            .value=${this.config?.unit ?? ''}
            @change=${(e: Event) => this._handleFieldChange('unit', (e.target as HTMLInputElement).value)}
          ></ha-textfield>

          <ha-checkbox
            data-field="show_zero"
            .checked=${this.config?.show_zero ?? false}
            @change=${(e: Event) => this._handleFieldChange('show_zero', (e.target as HTMLInputElement).checked)}
          ></ha-checkbox>
          <label>${localize('editor.show_zero', lang)}</label>

          <ha-checkbox
            data-field="show_min"
            .checked=${this.config?.show_min ?? true}
            @change=${(e: Event) => this._handleFieldChange('show_min', (e.target as HTMLInputElement).checked)}
          ></ha-checkbox>
          <label>${localize('editor.show_min', lang)}</label>

          <ha-checkbox
            data-field="show_avg"
            .checked=${this.config?.show_avg ?? true}
            @change=${(e: Event) => this._handleFieldChange('show_avg', (e.target as HTMLInputElement).checked)}
          ></ha-checkbox>
          <label>${localize('editor.show_avg', lang)}</label>

          <ha-checkbox
            data-field="show_max"
            .checked=${this.config?.show_max ?? true}
            @change=${(e: Event) => this._handleFieldChange('show_max', (e.target as HTMLInputElement).checked)}
          ></ha-checkbox>
          <label>${localize('editor.show_max', lang)}</label>

          <ha-textfield
            data-field="text_color"
            .label=${localize('editor.text_color', lang)}
            .value=${this.config?.text_color ?? ''}
            @change=${(e: Event) => this._handleFieldChange('text_color', (e.target as HTMLInputElement).value)}
          ></ha-textfield>

          <ha-textfield
            data-field="background_color"
            .label=${localize('editor.background_color', lang)}
            .value=${this.config?.background_color ?? ''}
            @change=${(e: Event) => this._handleFieldChange('background_color', (e.target as HTMLInputElement).value)}
          ></ha-textfield>

          <calendar-stats-threshold-list-editor
            .thresholds=${this.config?.thresholds ?? []}
            .lang=${lang}
          ></calendar-stats-threshold-list-editor>

          <calendar-stats-predecessor-list-editor
            .hass=${this.hass}
            .predecessors=${this.config?.predecessors ?? []}
            .lang=${lang}
          ></calendar-stats-predecessor-list-editor>
        </ha-expansion-panel>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-entity-row-editor': EntityRowEditor;
  }
}
