import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PredecessorConfig } from '../types/card-config';
import type { HomeAssistant } from '../types/ha-types';
import { localize } from '../localize/localize';

/** Stable reference: ha-selector re-initialises when the selector object changes identity. */
const STATISTIC_SELECTOR = { statistic: {} };

const PREDECESSOR_SCHEMA = [
  { name: 'entity', selector: STATISTIC_SELECTOR },
  { name: 'replaced_on', selector: { date: {} } },
  { name: 'factor', selector: { number: { step: 0.001, mode: 'box' } } },
];

@customElement('calendar-stats-predecessor-list-editor')
export class PredecessorListEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) predecessors: PredecessorConfig[] = [];
  @property() lang = 'en';
  /** Statistic ids known to the recorder; null while not loaded (no stale warning). */
  @property({ attribute: false }) knownStatisticIds: Set<string> | null = null;

  static styles = css`
    :host {
      display: block;
    }
    ha-expansion-panel {
      margin-bottom: 8px;
    }
    .entry-content {
      padding: 8px 12px 12px;
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

  private _dispatchChange(entries: PredecessorConfig[]): void {
    this.dispatchEvent(new CustomEvent('predecessors-changed', {
      detail: { predecessors: entries },
      bubbles: true,
      composed: true,
    }));
  }

  _addPredecessor(): void {
    this._dispatchChange([...this.predecessors, { entity: '' }]);
  }

  _removePredecessor(index: number): void {
    this._dispatchChange(this.predecessors.filter((_, i) => i !== index));
  }

  /** Merges the form value into the entry; cleared optional fields drop their key. */
  _handleFormChanged(index: number, value: Record<string, unknown>): void {
    const updated = this.predecessors.map((p, i) => {
      if (i !== index) return p;
      const next: Record<string, unknown> = { ...p, ...value };
      for (const key of Object.keys(next)) {
        if (key !== 'entity' && (next[key] === undefined || next[key] === '')) delete next[key];
      }
      if (!next['entity']) next['entity'] = '';
      return next as unknown as PredecessorConfig;
    });
    this._dispatchChange(updated);
  }

  private _computeLabel = (schema: { name: string }): string => {
    const labels: Record<string, string> = {
      entity: localize('editor.predecessor_entity', this.lang),
      replaced_on: localize('editor.predecessor_replaced_on', this.lang),
      factor: localize('editor.predecessor_factor', this.lang),
    };
    return labels[schema.name] ?? schema.name;
  };

  private _isStale(entry: PredecessorConfig): boolean {
    return entry.entity !== '' && this.knownStatisticIds !== null && !this.knownStatisticIds.has(entry.entity);
  }

  private _header(entry: PredecessorConfig): string {
    if (!entry.entity) return localize('editor.add_predecessor', this.lang);
    return this.hass?.states?.[entry.entity]?.attributes?.friendly_name ?? entry.entity;
  }

  render() {
    const lang = this.lang;

    return html`
      ${this.predecessors.map((entry, i) => html`
        <ha-expansion-panel
          outlined
          .header=${this._header(entry)}
          .secondary=${entry.replaced_on ?? ''}
        >
          <ha-icon-button
            slot="icons"
            .label=${localize('editor.remove_predecessor', lang)}
            @click=${(e: Event) => { e.stopPropagation(); this._removePredecessor(i); }}
          ><ha-icon icon="mdi:delete"></ha-icon></ha-icon-button>
          <div class="entry-content">
            <ha-form
              .hass=${this.hass}
              .data=${entry}
              .schema=${PREDECESSOR_SCHEMA}
              .computeLabel=${this._computeLabel}
              @value-changed=${(e: CustomEvent) => {
                e.stopPropagation();
                this._handleFormChanged(i, e.detail.value as Record<string, unknown>);
              }}
            ></ha-form>
            ${this._isStale(entry) ? html`
              <div class="stale-entity" data-stale>
                <ha-icon icon="mdi:alert-circle"></ha-icon>
                ${localize('editor.statistic_not_found', lang)}
              </div>
            ` : ''}
          </div>
        </ha-expansion-panel>
      `)}
      <ha-button data-action="add-predecessor" @click=${() => this._addPredecessor()}>
        <ha-icon slot="start" icon="mdi:plus"></ha-icon>
        ${localize('editor.add_predecessor', lang)}
      </ha-button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-predecessor-list-editor': PredecessorListEditor;
  }
}
