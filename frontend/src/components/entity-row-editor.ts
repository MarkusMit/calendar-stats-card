import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { EntityRowConfig, ThresholdRule } from '../types/card-config';
import type { HomeAssistant } from '../types/ha-types';
import { localize } from '../localize/localize';
import './threshold-list-editor';
import './predecessor-list-editor';
import type { PredecessorConfig } from '../types/card-config';

const ENTITY_ROW_SCHEMA = [
  { name: 'entity', selector: { entity: {} } },
  { name: 'name', selector: { text: {} } },
  { name: 'precision', selector: { number: { min: 0, step: 1, mode: 'box' } } },
  {
    name: 'advanced',
    type: 'expandable',
    flatten: true,
    schema: [
      { name: 'factor', selector: { number: { step: 0.001, mode: 'box' } } },
      { name: 'unit', selector: { text: {} } },
      { name: 'show_zero', selector: { boolean: {} } },
      { name: 'show_min', selector: { boolean: {} } },
      { name: 'show_avg', selector: { boolean: {} } },
      { name: 'show_max', selector: { boolean: {} } },
      { name: 'text_color', selector: { text: {} } },
      { name: 'background_color', selector: { text: {} } },
    ],
  },
];

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
      advanced: localize('editor.advanced', this.lang),
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
        .schema=${ENTITY_ROW_SCHEMA}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._handleFormChanged}
      ></ha-form>
      <calendar-stats-threshold-list-editor
        .thresholds=${this.config?.thresholds ?? []}
        .lang=${lang}
      ></calendar-stats-threshold-list-editor>
      <calendar-stats-predecessor-list-editor
        .hass=${this.hass}
        .predecessors=${this.config?.predecessors ?? []}
        .lang=${lang}
      ></calendar-stats-predecessor-list-editor>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-entity-row-editor': EntityRowEditor;
  }
}
