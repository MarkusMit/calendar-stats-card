import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { EntityRowConfig, ThresholdRule } from '../types/card-config';
import type { HomeAssistant } from '../types/ha-types';
import type { EntityMetadata } from '../types/statistics';
import type { StatisticMetaEntry } from '../services/statistics-service';
import { resolveEntityMetadata } from '../services/entity-metadata';
import { editorLabel, editorHelper } from '../services/editor-labels';
import { localize } from '../localize/localize';
import './threshold-list-editor';
import './predecessor-list-editor';
import type { PredecessorConfig } from '../types/card-config';

const ENTITY_ROW_SCHEMA_MAIN = [
  { name: 'entity', selector: { statistic: {} } },
  { name: 'name', selector: { text: {} } },
  { name: 'unit', selector: { text: {} } },
  { name: 'precision', selector: { number: { min: 0, step: 1, mode: 'box' } } },
];

const VISIBILITY_FIELDS = ['show_zero', 'show_min', 'show_avg', 'show_max'] as const;
type VisibilityField = typeof VISIBILITY_FIELDS[number];

type RowKind = EntityMetadata['stateClass'];

/** Visibility switches that affect the given row kind; unknown kinds get all of them. */
function visibilityFields(kind: RowKind): readonly VisibilityField[] {
  if (kind === 'measurement') return ['show_min', 'show_avg', 'show_max'];
  if (kind === 'unknown') return VISIBILITY_FIELDS;
  return ['show_zero'];
}

function displaySchema(lang: string, kind: RowKind) {
  const stateClass = kind === 'measurement' ? [] : [{
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
  }];
  return [
    ...stateClass,
    { name: 'factor', selector: { number: { step: 0.001, mode: 'box' } } },
    { name: 'text_color', selector: { text: {} } },
    { name: 'background_color', selector: { text: {} } },
    ...visibilityFields(kind).map((name) => ({ name, selector: { boolean: {} } })),
  ];
}

@customElement('calendar-stats-entity-row-editor')
export class EntityRowEditor extends LitElement {
  @property({ attribute: false }) hass!: HomeAssistant;
  @property({ attribute: false }) config!: EntityRowConfig;
  @property({ type: Number }) index = 0;
  @property() lang = 'en';
  /** Statistic ids known to the recorder; null while not loaded (no stale warning). */
  @property({ attribute: false }) knownStatisticIds: Set<string> | null = null;
  /** Recorder metadata for this row's id; decides the kind of external statistics. */
  @property({ attribute: false }) statMeta: StatisticMetaEntry | undefined = undefined;

  private _displaySchemaKey = '';
  private _displaySchema: ReturnType<typeof displaySchema> = [];

  static styles = css`
    :host {
      display: block;
    }
    ha-expansion-panel {
      margin-top: 8px;
    }
    .panel-content {
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

  private _computeLabel = (schema: { name: string }): string => editorLabel(schema.name, this.lang);
  private _computeHelper = (schema: { name: string }): string | undefined => editorHelper(schema.name, this.lang);

  private _handleFormChanged(ev: CustomEvent): void {
    const updated = { ...this.config, ...(ev.detail.value as Record<string, unknown>) };
    // A cleared dropdown arrives as undefined or ''; neither belongs in the config.
    if (!updated.state_class) delete updated.state_class;
    // Visibility switches default to true; only the non-default false is written.
    for (const field of VISIBILITY_FIELDS) {
      if (updated[field] === true) delete updated[field];
    }
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

  private _kind(): RowKind {
    const entity = this.config?.entity ?? '';
    return resolveEntityMetadata(
      entity,
      this.hass?.states?.[entity]?.attributes,
      this.statMeta,
      this.config?.state_class,
    ).stateClass;
  }

  /** Form data with the visibility switches resolved to their effective value. */
  private _displayData(kind: RowKind): Record<string, unknown> {
    const data: Record<string, unknown> = { ...this.config };
    for (const field of visibilityFields(kind)) {
      data[field] = this.config?.[field] !== false;
    }
    return data;
  }

  render() {
    const lang = this.lang ?? 'en';
    const stale = this._isStale();
    const kind = this._kind();
    const schemaKey = `${lang}:${kind}`;
    if (this._displaySchemaKey !== schemaKey) {
      this._displaySchema = displaySchema(lang, kind);
      this._displaySchemaKey = schemaKey;
    }
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this.config}
        .schema=${ENTITY_ROW_SCHEMA_MAIN}
        .computeLabel=${this._computeLabel}
        .computeHelper=${this._computeHelper}
        @value-changed=${this._handleFormChanged}
      ></ha-form>
      ${stale ? html`
        <div class="stale-entity" data-stale>
          <ha-icon icon="mdi:alert-circle"></ha-icon>
          ${localize('editor.statistic_not_found', lang)}
        </div>
      ` : ''}
      <ha-expansion-panel outlined data-section="display" .header=${localize('editor.section_display', lang)}>
        <div class="panel-content">
          <ha-form
            .hass=${this.hass}
            .data=${this._displayData(kind)}
            .schema=${this._displaySchema}
            .computeLabel=${this._computeLabel}
            .computeHelper=${this._computeHelper}
            @value-changed=${this._handleFormChanged}
          ></ha-form>
        </div>
      </ha-expansion-panel>
      <ha-expansion-panel outlined data-section="thresholds" .header=${localize('editor.thresholds', lang)}>
        <div class="panel-content">
          <calendar-stats-threshold-list-editor
            .hass=${this.hass}
            .thresholds=${this.config?.thresholds ?? []}
            .lang=${lang}
          ></calendar-stats-threshold-list-editor>
        </div>
      </ha-expansion-panel>
      <ha-expansion-panel outlined data-section="predecessors" .header=${localize('editor.predecessors', lang)}>
        <div class="panel-content">
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
