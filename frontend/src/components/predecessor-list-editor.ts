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
    .section-title {
      font-size: 12px;
      font-weight: 500;
      color: var(--secondary-text-color, rgba(0,0,0,0.54));
      padding: 8px 0 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .predecessor-entry {
      border: 1px solid var(--divider-color, rgba(0,0,0,0.12));
      border-radius: 4px;
      padding: 8px;
      margin-bottom: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .field label {
      font-size: 11px;
      color: var(--secondary-text-color, rgba(0,0,0,0.54));
    }
    .field input {
      display: block;
      width: 100%;
      box-sizing: border-box;
      background: transparent;
      border: none;
      border-bottom: 1px solid var(--divider-color, rgba(0,0,0,0.38));
      padding: 4px 2px;
      font-size: 14px;
      color: var(--primary-text-color, rgba(0,0,0,0.87));
      outline: none;
      font-family: inherit;
    }
    .field input:focus {
      border-bottom: 2px solid var(--primary-color, #03a9f4);
    }
    .stale-entity {
      display: flex;
      align-items: center;
      gap: 4px;
      color: var(--warning-color, orange);
      font-size: 0.85em;
    }
    .entry-actions {
      display: flex;
      justify-content: flex-end;
    }
    .add-chip {
      background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.12);
      border-radius: 18px;
      color: var(--primary-color);
      cursor: pointer;
      padding: 6px 14px;
      font-size: 14px;
      font-weight: 500;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-family: inherit;
      margin-top: 8px;
    }
    .add-chip:hover {
      background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.22);
    }
    .add-chip ha-icon {
      --mdc-icon-size: 18px;
      color: var(--primary-color);
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
      <div class="section-title">${localize('editor.predecessors', lang)}</div>
      ${this.predecessors.map((entry, i) => html`
        <div class="predecessor-entry">
          <div class="field">
            <label>${localize('editor.predecessor_entity', lang)}</label>
            <input
              data-field="predecessor_entity"
              type="text"
              .value=${entry.entity}
              @change=${(e: Event) => this._handleEntryChange(i, 'entity', (e.target as HTMLInputElement).value)}
            />
          </div>

          ${this._isStale(entry) ? html`
            <div class="stale-entity" data-stale>
              <ha-icon icon="mdi:alert-circle"></ha-icon>
              ${localize('editor.entity_not_found', lang)}
            </div>
          ` : ''}

          <div class="field">
            <label>${localize('editor.predecessor_replaced_on', lang)}</label>
            <input
              data-field="predecessor_replaced_on"
              type="text"
              placeholder="YYYY-MM-DD"
              .value=${entry.replaced_on ?? ''}
              @change=${(e: Event) => {
                const v = (e.target as HTMLInputElement).value.trim();
                this._handleEntryChange(i, 'replaced_on', v || undefined);
              }}
            />
          </div>

          <div class="field">
            <label>${localize('editor.predecessor_factor', lang)}</label>
            <input
              data-field="predecessor_factor"
              type="number"
              step="any"
              .value=${String(entry.factor ?? '')}
              @change=${(e: Event) => {
                const v = parseFloat((e.target as HTMLInputElement).value);
                this._handleEntryChange(i, 'factor', isNaN(v) ? undefined : v);
              }}
            />
          </div>

          <div class="entry-actions">
            <ha-icon-button
              .label=${localize('editor.remove_predecessor', lang)}
              @click=${() => this._removePredecessor(i)}
            ><ha-icon icon="mdi:delete"></ha-icon></ha-icon-button>
          </div>
        </div>
      `)}
      <button type="button" class="add-chip" data-action="add-predecessor" @click=${() => this._addPredecessor()}>
        <ha-icon icon="mdi:plus"></ha-icon>
        ${localize('editor.add_predecessor', lang)}
      </button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-predecessor-list-editor': PredecessorListEditor;
  }
}
