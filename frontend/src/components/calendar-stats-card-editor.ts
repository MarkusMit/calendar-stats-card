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
    .add-chip {
      --mdc-theme-primary: var(--primary-color);
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
    }
    .add-chip:hover {
      background: rgba(var(--rgb-primary-color, 3, 169, 244), 0.22);
    }
    .add-chip ha-icon,
    .add-chip ha-svg-icon {
      --mdc-icon-size: 18px;
      color: var(--primary-color);
    }
    .type-menu {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      padding: 8px 0;
      align-items: center;
    }
    .type-menu-cancel {
      background: transparent;
      border: none;
      color: var(--secondary-text-color);
      cursor: pointer;
      padding: 6px 10px;
      font-size: 14px;
    }
    .entity-picker-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
    }
    .entity-picker-row ha-entity-picker,
    .entity-picker-row ha-selector {
      flex: 1;
    }
    .row-list {
      display: flex;
      flex-direction: column;
    }
    .row-item {
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
    }
    .row-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 4px;
      border-radius: 4px;
    }
    .drag-handle {
      cursor: grab;
      color: var(--secondary-text-color);
      flex-shrink: 0;
      --mdc-icon-size: 20px;
    }
    .drag-handle:active {
      cursor: grabbing;
    }
    .row-content {
      flex: 1;
      min-width: 0;
    }
    .row-content ha-entity-picker {
      display: block;
      width: 100%;
    }
    .row-label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-size: 14px;
      padding: 8px 0;
    }
    .expression-row-content {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .expression-row-content ha-icon {
      flex-shrink: 0;
      color: var(--secondary-text-color);
    }
    .sortable-ghost {
      opacity: 0.4;
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
    .row-type-badge {
      font-size: 11px;
      color: var(--secondary-text-color);
      flex-shrink: 0;
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

  _moveRow(oldIndex: number, newIndex: number): void {
    if (oldIndex === newIndex) return;
    if (oldIndex < 0 || oldIndex >= this._entities.length) return;
    if (newIndex < 0 || newIndex >= this._entities.length) return;
    const updated = [...this._entities];
    const [moved] = updated.splice(oldIndex, 1);
    updated.splice(newIndex, 0, moved!);
    this._entities = updated;
    this._dispatchConfigChanged();
  }

  private _handleItemMoved = (e: Event): void => {
    const detail = (e as CustomEvent<{ oldIndex: number; newIndex: number }>).detail;
    this._moveRow(detail.oldIndex, detail.newIndex);
  };

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

  private _handleEntityPicked(index: number, entityId: string): void {
    const current = this._entities[index] as EntityRowConfig;
    if (current.entity === entityId) return;
    const updated = [...this._entities];
    updated[index] = { ...current, entity: entityId };
    this._entities = updated;
    this._dispatchConfigChanged();
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
        <ha-sortable
          handle-selector=".drag-handle"
          @item-moved=${this._handleItemMoved}
        >
          <div class="row-list">
            ${this._entities.map((entity, i) => this._renderRow(entity, i, lang))}
          </div>
        </ha-sortable>
      `}

      <div class="add-row-section">
        ${!this._showTypeMenu ? html`
          <button
            type="button"
            class="add-chip add-row-btn"
            data-action="add-row"
            @click=${() => { this._showTypeMenu = true; this._addingEntityRow = false; }}
          >
            <ha-icon icon="mdi:plus"></ha-icon>
            ${localize('editor.add_row', lang)}
          </button>
        ` : !this._addingEntityRow ? html`
          <div class="type-menu">
            <button type="button" class="add-chip" @click=${() => { this._addingEntityRow = true; }}>
              <ha-icon icon="mdi:plus"></ha-icon>
              ${localize('editor.entity_row', lang)}
            </button>
            <button type="button" class="add-chip" @click=${() => { this._addExpressionRow(); }}>
              <ha-icon icon="mdi:plus"></ha-icon>
              ${localize('editor.expression_row', lang)}
            </button>
            <button type="button" class="type-menu-cancel" @click=${() => { this._showTypeMenu = false; }}>✕</button>
          </div>
        ` : html`
          <div class="entity-picker-row">
            <ha-entity-picker
              .hass=${this.hass}
              allow-custom-entity
              @value-changed=${(e: CustomEvent) => {
                const v = e.detail.value as string | undefined;
                if (v) this._addEntityRow(v);
              }}
            ></ha-entity-picker>
            <button type="button" class="type-menu-cancel" @click=${() => { this._addingEntityRow = false; }}>✕</button>
          </div>
        `}
      </div>
    `;
  }

  private _renderRow(entity: EntityConfig, i: number, lang: string) {
    const isEntity = 'entity' in entity;
    return html`
      <div class="row-item">
        <div class="row-header">
          <ha-svg-icon
            class="drag-handle"
            .path=${'M7,19V17H9V19H7M11,19V17H13V19H11M15,19V17H17V19H15M7,15V13H9V15H7M11,15V13H13V15H11M15,15V13H17V15H15M7,11V9H9V11H7M11,11V9H13V11H11M15,11V9H17V11H15M7,7V5H9V7H7M11,7V5H13V7H11M15,7V5H17V7H15Z'}
            .label=${localize('editor.reorder_row', lang)}
          ></ha-svg-icon>
          ${isEntity
            ? html`
              <div class="row-content">
                <ha-entity-picker
                  .hass=${this.hass}
                  .value=${(entity as EntityRowConfig).entity}
                  allow-custom-entity
                  @value-changed=${(e: CustomEvent) => {
                    const v = e.detail.value as string | undefined;
                    if (v) this._handleEntityPicked(i, v);
                  }}
                ></ha-entity-picker>
              </div>
            `
            : html`
              <div class="row-content">
                <div class="expression-row-content">
                  <ha-icon icon="mdi:function-variant"></ha-icon>
                  <span class="row-label">${
                    (entity as ExpressionRowConfig).name
                    || (entity as ExpressionRowConfig).expression
                    || localize('editor.expression_row', lang)
                  }</span>
                </div>
              </div>
            `
          }
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
