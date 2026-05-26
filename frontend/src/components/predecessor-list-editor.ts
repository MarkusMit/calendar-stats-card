import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PredecessorConfig } from '../types/card-config';
import type { HomeAssistant } from '../types/ha-types';
import { localize } from '../localize/localize';

@customElement('calendar-stats-predecessor-list-editor')
export class PredecessorListEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) predecessors: PredecessorConfig[] = [];
  @property() lang = 'en';

  static styles = css`
    :host {
      display: block;
    }
    .predecessor-entry {
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
      padding: 8px 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .stale-entity {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--warning-color, orange);
      font-size: 0.85em;
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

  _handleEntryChange(index: number, field: string, value: unknown): void {
    const updated = this.predecessors.map((p, i) =>
      i === index ? { ...p, [field]: value } : p,
    );
    this._dispatchChange(updated);
  }

  private _isStale(entry: PredecessorConfig): boolean {
    return entry.entity !== '' && this.hass != null && !this.hass.states[entry.entity];
  }

  render() {
    const lang = this.lang;

    return html`
      <div>
        ${this.predecessors.map((entry, i) => html`
          <div class="predecessor-entry">
            <ha-textfield
              data-field="predecessor_entity"
              .label=${localize('editor.predecessor_entity', lang)}
              .value=${entry.entity}
              @change=${(e: Event) => this._handleEntryChange(i, 'entity', (e.target as HTMLInputElement).value)}
            ></ha-textfield>

            ${this._isStale(entry) ? html`
              <div class="stale-entity" data-stale>
                <ha-icon icon="mdi:alert-circle"></ha-icon>
                ${localize('editor.entity_not_found', lang)}
              </div>
            ` : ''}

            <ha-textfield
              data-field="predecessor_replaced_on"
              .label=${localize('editor.predecessor_replaced_on', lang)}
              .value=${entry.replaced_on ?? ''}
              placeholder="YYYY-MM-DD"
              @change=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value.trim();
                this._handleEntryChange(i, 'replaced_on', v || undefined);
              }}
            ></ha-textfield>

            <ha-textfield
              data-field="predecessor_factor"
              .label=${localize('editor.predecessor_factor', lang)}
              .value=${String(entry.factor ?? '')}
              type="number"
              step="any"
              @change=${(e: Event) => {
                const v = parseFloat((e.target as HTMLInputElement).value);
                this._handleEntryChange(i, 'factor', isNaN(v) ? undefined : v);
              }}
            ></ha-textfield>

            <ha-icon-button
              data-action="remove-predecessor"
              .label=${localize('editor.remove_predecessor', lang)}
              @click=${() => this._removePredecessor(i)}
            >
              <ha-icon icon="mdi:delete"></ha-icon>
            </ha-icon-button>
          </div>
        `)}

        <mwc-button
          data-action="add-predecessor"
          @click=${() => this._addPredecessor()}
        >
          <ha-icon icon="mdi:plus"></ha-icon>
          ${localize('editor.add_predecessor', lang)}
        </mwc-button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-predecessor-list-editor': PredecessorListEditor;
  }
}
