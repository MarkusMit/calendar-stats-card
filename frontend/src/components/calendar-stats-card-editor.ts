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
  @state() private _addingEntityRow = false;
  @state() private _editingIndex: number | null = null;

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
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 0;
      align-items: center;
    }
    .entity-picker-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
    }
    .entity-picker-row ha-selector {
      flex: 1;
    }
    .row-item {
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
    }
    .row-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 4px;
      border-radius: 4px;
    }
    .row-label {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
    }
    .row-type-badge {
      font-size: 11px;
      color: var(--secondary-text-color);
      flex-shrink: 0;
    }
    .detail-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 4px;
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
      margin-bottom: 8px;
    }
    .detail-title {
      flex: 1;
      font-size: 16px;
      font-weight: 500;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .detail-content {
      padding: 0 4px 8px;
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
      type: 'custom:calendar-stats-card',
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
    const newIndex = this._entities.length;
    this._entities = [...this._entities, { entity: entityId } as EntityRowConfig];
    this._showTypeMenu = false;
    this._addingEntityRow = false;
    this._editingIndex = newIndex;
    this._dispatchConfigChanged();
  }

  _addExpressionRow(): void {
    const newIndex = this._entities.length;
    this._entities = [...this._entities, { expression: '' } as ExpressionRowConfig];
    this._showTypeMenu = false;
    this._addingEntityRow = false;
    this._editingIndex = newIndex;
    // Do NOT dispatch config-changed yet — expression is empty (FR-008)
  }

  private _removeRow(index: number): void {
    if (this._editingIndex === index) this._editingIndex = null;
    else if (this._editingIndex !== null && this._editingIndex > index) this._editingIndex--;
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

  private _editRow(index: number): void {
    this._editingIndex = index;
  }

  private _closeDetail(): void {
    this._editingIndex = null;
  }

  private get _lang(): string {
    return this.hass?.selectedLanguage ?? this.hass?.language ?? 'en';
  }

  render() {
    const lang = this._lang;

    if (this._editingIndex !== null && this._entities[this._editingIndex]) {
      return this._renderDetail(this._editingIndex, lang);
    }

    const empty = this._entities.length === 0;

    return html`
      ${empty ? html`
        <div class="empty-state">
          ${localize('editor.no_rows', lang)}
        </div>
      ` : html`
        <div class="row-list">
          ${this._entities.map((entity, i) => {
            const isEntity = 'entity' in entity;
            const typeBadge = isEntity
              ? localize('editor.entity_row', lang)
              : localize('editor.expression_row', lang);
            const label = isEntity
              ? ((entity as EntityRowConfig).name || (entity as EntityRowConfig).entity || typeBadge)
              : ((entity as ExpressionRowConfig).name || (entity as ExpressionRowConfig).expression || typeBadge);
            return html`
              <div class="row-item">
                <div class="row-header">
                  <ha-icon icon=${isEntity ? 'mdi:chart-line' : 'mdi:function-variant'}></ha-icon>
                  <span class="row-label">${label}</span>
                  <span class="row-type-badge">${typeBadge}</span>
                  <ha-icon-button
                    .label=${localize('editor.remove_row', lang)}
                    @click=${() => this._removeRow(i)}
                  ><ha-icon icon="mdi:delete"></ha-icon></ha-icon-button>
                  <ha-icon-button
                    .label=${localize('editor.edit_row', lang)}
                    @click=${() => this._editRow(i)}
                  ><ha-icon icon="mdi:pencil"></ha-icon></ha-icon-button>
                </div>
              </div>
            `;
          })}
        </div>
      `}

      <div class="add-row-section">
        ${!this._showTypeMenu ? html`
          <mwc-button
            class="add-row-btn"
            data-action="add-row"
            raised
            @click=${() => { this._showTypeMenu = true; this._addingEntityRow = false; }}
          >
            <ha-icon icon="mdi:plus"></ha-icon>
            ${localize('editor.add_row', lang)}
          </mwc-button>
        ` : !this._addingEntityRow ? html`
          <div class="type-menu">
            <mwc-button raised @click=${() => { this._addingEntityRow = true; }}>
              <ha-icon icon="mdi:plus"></ha-icon>
              ${localize('editor.entity_row', lang)}
            </mwc-button>
            <mwc-button raised @click=${() => { this._addExpressionRow(); }}>
              <ha-icon icon="mdi:plus"></ha-icon>
              ${localize('editor.expression_row', lang)}
            </mwc-button>
            <mwc-button @click=${() => { this._showTypeMenu = false; }}>✕</mwc-button>
          </div>
        ` : html`
          <div class="entity-picker-row">
            <ha-selector
              .hass=${this.hass}
              .selector=${{ entity: {} }}
              @value-changed=${(e: CustomEvent) => {
                if (e.detail.value) this._addEntityRow(e.detail.value as string);
              }}
            ></ha-selector>
            <mwc-button @click=${() => { this._addingEntityRow = false; }}>✕</mwc-button>
          </div>
        `}
      </div>
    `;
  }

  private _renderDetail(index: number, lang: string) {
    const entity = this._entities[index]!;
    const isEntity = 'entity' in entity;
    const typeBadge = isEntity
      ? localize('editor.entity_row', lang)
      : localize('editor.expression_row', lang);
    const label = isEntity
      ? ((entity as EntityRowConfig).name || (entity as EntityRowConfig).entity || typeBadge)
      : ((entity as ExpressionRowConfig).name || (entity as ExpressionRowConfig).expression || typeBadge);

    return html`
      <div class="detail-header">
        <ha-icon-button
          .label=${localize('editor.back', lang)}
          @click=${this._closeDetail}
        ><ha-icon icon="mdi:arrow-left"></ha-icon></ha-icon-button>
        <span class="detail-title">${label}</span>
        <span class="row-type-badge">${typeBadge}</span>
      </div>
      <div class="detail-content">
        ${isEntity
          ? html`<calendar-stats-entity-row-editor
              .hass=${this.hass}
              .config=${entity as EntityRowConfig}
              .index=${index}
              .lang=${lang}
              @row-changed=${this._handleRowChanged}
            ></calendar-stats-entity-row-editor>`
          : html`<calendar-stats-expression-row-editor
              .hass=${this.hass}
              .config=${entity as ExpressionRowConfig}
              .index=${index}
              .lang=${lang}
              @row-changed=${this._handleRowChanged}
            ></calendar-stats-expression-row-editor>`
        }
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-card-editor': CalendarStatsCardEditor;
  }
}
