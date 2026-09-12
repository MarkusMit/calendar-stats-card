import { LitElement, html, css } from 'lit';
import type { PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { CardConfig, EntityConfig, EntityRowConfig, ExpressionRowConfig } from '../types/card-config';
import type { HomeAssistant } from '../types/ha-types';
import { localize } from '../localize/localize';
import { StatisticsService } from '../services/statistics-service';
import type { StatisticMetaEntry } from '../services/statistics-service';
import './entity-row-editor';
import './expression-row-editor';

/** Stable reference: ha-selector re-initialises when the selector object changes identity. */
const STATISTIC_SELECTOR = { statistic: {} };

const OPTIONS_SCHEMA = [
  { name: 'show_threshold_table', selector: { boolean: {} } },
];

@customElement('calendar-stats-card-editor')
export class CalendarStatsCardEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;

  @state() private _entities: EntityConfig[] = [];
  @state() private _rest: Record<string, unknown> = {};
  @state() private _editingIndex: number | null = null;
  @state() private _formReady = customElements.get('ha-form') != null;
  /** Statistic ids known to the recorder; null until loaded or when the request failed. */
  @state() private _knownStatisticIds: Set<string> | null = null;
  /** Recorder metadata by statistic id; same lifecycle as the id set. */
  @state() private _statMeta: Map<string, StatisticMetaEntry> | null = null;

  private readonly _service = new StatisticsService();
  private _statisticIdsRequested = false;

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
    .options-section {
      padding: 8px 0 0;
      border-top: 1px solid var(--divider-color, #e0e0e0);
      margin-top: 8px;
    }
    .options-title {
      color: var(--secondary-text-color);
      font-weight: 600;
      font-size: 0.9em;
      margin-bottom: 4px;
    }
    .add-row {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 0;
    }
    .add-row ha-selector {
      flex: 1;
      min-width: 0;
    }
    .add-row ha-button {
      flex-shrink: 0;
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
    .row-content ha-selector {
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

  connectedCallback(): void {
    super.connectedCallback();
    void this._ensureFormLoaded();
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('hass') && this.hass && !this._statisticIdsRequested) {
      this._statisticIdsRequested = true;
      void this._loadStatisticIds();
    }
  }

  private async _loadStatisticIds(): Promise<void> {
    try {
      const entries = await this._service.listStatisticIds(this.hass);
      if (!Array.isArray(entries)) return;
      this._statMeta = new Map(entries.map((e) => [e.statistic_id, e]));
      this._knownStatisticIds = new Set(this._statMeta.keys());
    } catch {
      // ids stay unknown; row editors then show no stale warning
    }
  }

  /** ha-form (and with it ha-selector) ships with the entities card editor. */
  private async _ensureFormLoaded(): Promise<void> {
    if (this._formReady) return;
    if (customElements.get('ha-form')) {
      this._formReady = true;
      return;
    }
    const w = window as unknown as { loadCardHelpers?: () => Promise<{ createCardElement: (cfg: unknown) => Promise<{ constructor: { getConfigElement?: () => Promise<unknown> } }> }> };
    const helpers = await w.loadCardHelpers?.();
    if (helpers) {
      try {
        const card = await helpers.createCardElement({ type: 'entities', entities: [] });
        await card?.constructor?.getConfigElement?.();
      } catch {
        // ignore — fall through to whenDefined
      }
    }
    await customElements.whenDefined('ha-form');
    this._formReady = true;
  }

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

  /** Only the non-default (false) is written, so the shown-by-default case stays implicit. */
  private _handleOptionsChanged = (e: CustomEvent): void => {
    const value = e.detail.value as Record<string, unknown>;
    const checked = value['show_threshold_table'] !== false;
    const rest = { ...this._rest };
    if (checked) delete rest['show_threshold_table'];
    else rest['show_threshold_table'] = false;
    this._rest = rest;
    this._dispatchConfigChanged();
  };

  _addEntityRow(entityId: string): void {
    const newIndex = this._entities.length;
    this._entities = [...this._entities, { entity: entityId } as EntityRowConfig];
    this._editingIndex = newIndex;
    this._dispatchConfigChanged();
  }

  _addExpressionRow(): void {
    const newIndex = this._entities.length;
    this._entities = [...this._entities, { expression: '' } as ExpressionRowConfig];
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

  /** An emptied inline selector removes the row; HA's entities editor behaves the same. */
  private _handleEntityPicked(index: number, entityId: string): void {
    const current = this._entities[index] as EntityRowConfig;
    if (!entityId) {
      this._removeRow(index);
      return;
    }
    if (current.entity === entityId) return;
    const updated = [...this._entities];
    updated[index] = { ...current, entity: entityId };
    this._entities = updated;
    this._dispatchConfigChanged();
  }

  private _computeOptionLabel = (schema: { name: string }): string =>
    localize(`editor.${schema.name}`, this._lang);

  private get _lang(): string {
    return this.hass?.selectedLanguage ?? this.hass?.language ?? 'en';
  }

  render() {
    const lang = this._lang;

    if (this._editingIndex !== null && this._entities[this._editingIndex]) {
      return this._renderDetail(this._editingIndex, lang);
    }

    if (!this._formReady) {
      return html`<div class="empty-state">${localize('editor.loading', lang)}</div>`;
    }

    const empty = this._entities.length === 0;

    return html`
      <div class="options-section">
        <div class="options-title">${localize('editor.options', lang)}</div>
        <ha-form
          .hass=${this.hass}
          .data=${{ show_threshold_table: this._rest['show_threshold_table'] !== false }}
          .schema=${OPTIONS_SCHEMA}
          .computeLabel=${this._computeOptionLabel}
          @value-changed=${this._handleOptionsChanged}
        ></ha-form>
      </div>

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

      <div class="add-row">
        <ha-selector
          data-action="add-entity-row"
          .hass=${this.hass}
          .selector=${STATISTIC_SELECTOR}
          .value=${''}
          .label=${localize('editor.add_entity', lang)}
          @value-changed=${(e: CustomEvent) => {
            const v = e.detail.value as string | undefined;
            if (v) this._addEntityRow(v);
          }}
        ></ha-selector>
        <ha-button data-action="add-expression-row" @click=${() => { this._addExpressionRow(); }}>
          <ha-icon slot="start" icon="mdi:plus"></ha-icon>
          ${localize('editor.add_expression', lang)}
        </ha-button>
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
                <ha-selector
                  .hass=${this.hass}
                  .selector=${STATISTIC_SELECTOR}
                  .value=${(entity as EntityRowConfig).entity}
                  @value-changed=${(e: CustomEvent) => {
                    this._handleEntityPicked(i, (e.detail.value as string | undefined) ?? '');
                  }}
                ></ha-selector>
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
            .label=${localize('editor.edit_row', lang)}
            @click=${() => this._editRow(i)}
          ><ha-icon icon="mdi:pencil"></ha-icon></ha-icon-button>
          <ha-icon-button
            .label=${localize('editor.remove_row', lang)}
            @click=${() => this._removeRow(i)}
          ><ha-icon icon="mdi:close"></ha-icon></ha-icon-button>
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
              .knownStatisticIds=${this._knownStatisticIds}
              .statMeta=${this._statMeta?.get((entity as EntityRowConfig).entity)}
              .config=${entity as EntityRowConfig}
              .index=${index}
              .lang=${lang}
              @row-changed=${this._handleRowChanged}
            ></calendar-stats-entity-row-editor>`
          : html`<calendar-stats-expression-row-editor
              .hass=${this.hass}
              .knownStatisticIds=${this._knownStatisticIds}
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
