import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { CardConfig, EntityConfig, EntityRowConfig, ExpressionRowConfig } from '../types/card-config';
import type { HomeAssistant } from '../types/ha-types';
import { localize } from '../localize/localize';
import './entity-row-editor';
import './expression-row-editor';

@customElement('calendar-stats-card-editor')
export class CalendarStatsCardEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;

  @state() private _entities: EntityConfig[] = [];
  @state() private _rest: Record<string, unknown> = {};
  @state() private _showTypeMenu = false;

  static styles = css`
    :host {
      display: block;
      padding: 8px 0;
    }
    .empty-state {
      color: var(--secondary-text-color);
      padding: 16px 8px;
      text-align: center;
      font-style: italic;
    }
    .add-row-section {
      padding: 8px 0;
    }
    .add-row-btn {
      cursor: pointer;
    }
    .type-menu {
      display: flex;
      gap: 8px;
      padding: 8px 0;
    }
    .row-item {
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
      padding: 4px 0;
    }
  `;

  setConfig(config: CardConfig): void {
    const cfg = config as CardConfig & Record<string, unknown>;
    const rest = { ...cfg } as Record<string, unknown>;
    delete rest['type'];
    delete rest['entities'];
    this._entities = Array.isArray(cfg.entities) ? [...(cfg.entities as EntityConfig[])] : [];
    this._rest = rest;
  }

  _dispatchConfigChanged(): void {
    const filtered = this._entities.filter(
      (e) => !('expression' in e) || (e as ExpressionRowConfig).expression !== '',
    );
    const config: Record<string, unknown> = {
      type: 'calendar-stats-card',
      entities: filtered,
      ...this._rest,
    };
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config },
      bubbles: true,
      composed: true,
    }));
  }

  _addEntityRow(entityId: string): void {
    this._entities = [...this._entities, { entity: entityId } as EntityRowConfig];
    this._showTypeMenu = false;
    this._dispatchConfigChanged();
  }

  _addExpressionRow(): void {
    this._entities = [...this._entities, { expression: '' } as ExpressionRowConfig];
    this._showTypeMenu = false;
    // Do NOT dispatch config-changed yet — expression is empty (FR-008)
  }

  private _removeRow(index: number): void {
    this._entities = this._entities.filter((_, i) => i !== index);
    this._dispatchConfigChanged();
  }

  private _handleRowChanged(e: CustomEvent): void {
    const { index, config } = e.detail as { index: number; config: EntityConfig };
    const updated = [...this._entities];
    updated[index] = config;
    this._entities = updated;
    this._dispatchConfigChanged();
  }

  private get _lang(): string {
    return this.hass?.selectedLanguage ?? this.hass?.language ?? 'en';
  }

  render() {
    const lang = this._lang;
    const empty = this._entities.length === 0;

    return html`
      ${empty ? html`
        <div class="empty-state">
          ${localize('editor.no_rows', lang)}
        </div>
      ` : html`
        <div class="row-list">
          ${this._entities.map((entity, i) => html`
            <div class="row-item">
              ${'entity' in entity
                ? html`<calendar-stats-entity-row-editor
                    .hass=${this.hass}
                    .config=${entity as EntityRowConfig}
                    .index=${i}
                    .lang=${lang}
                    @row-changed=${this._handleRowChanged}
                  ></calendar-stats-entity-row-editor>`
                : html`<calendar-stats-expression-row-editor
                    .hass=${this.hass}
                    .config=${entity as ExpressionRowConfig}
                    .index=${i}
                    .lang=${lang}
                    @row-changed=${this._handleRowChanged}
                  ></calendar-stats-expression-row-editor>`
              }
              <ha-icon-button
                data-action="remove-row"
                .label=${localize('editor.remove_row', lang)}
                @click=${() => this._removeRow(i)}
              >
                <ha-icon icon="mdi:delete"></ha-icon>
              </ha-icon-button>
            </div>
          `)}
        </div>
      `}

      <div class="add-row-section">
        ${this._showTypeMenu ? html`
          <div class="type-menu">
            <ha-entity-picker
              .hass=${this.hass}
              .label=${localize('editor.entity_row', lang)}
              allow-custom-entity
              @value-changed=${(e: CustomEvent) => {
                if (e.detail.value) this._addEntityRow(e.detail.value);
              }}
            ></ha-entity-picker>
            <mwc-button
              @click=${() => { this._addExpressionRow(); }}
            >${localize('editor.expression_row', lang)}</mwc-button>
            <mwc-button @click=${() => { this._showTypeMenu = false; }}>✕</mwc-button>
          </div>
        ` : html`
          <mwc-button
            class="add-row-btn"
            data-action="add-row"
            @click=${() => { this._showTypeMenu = true; }}
          >
            <ha-icon icon="mdi:plus"></ha-icon>
            ${localize('editor.add_row', lang)}
          </mwc-button>
        `}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-card-editor': CalendarStatsCardEditor;
  }
}
