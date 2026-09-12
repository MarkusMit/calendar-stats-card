import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { EntityRowConfig, ThresholdRule } from '../types/card-config';
import type { HomeAssistant } from '../types/ha-types';
import type { EntityMetadata } from '../types/statistics';
import type { StatisticMetaEntry } from '../services/statistics-service';
import { resolveEntityMetadata } from '../services/entity-metadata';
import { localize } from '../localize/localize';
import './threshold-list-editor';
import './predecessor-list-editor';
import type { PredecessorConfig } from '../types/card-config';

const ENTITY_ROW_SCHEMA_MAIN = [
  { name: 'entity', selector: { statistic: {} } },
  { name: 'name', selector: { text: {} } },
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

function advancedSchema(lang: string, kind: RowKind) {
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
    { name: 'unit', selector: { text: {} } },
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

  private _advancedSchemaKey = '';
  private _advancedSchema: ReturnType<typeof advancedSchema> = [];

  static styles = css`
    :host {
      display: block;
    }
    .advanced-content {
      padding: 8px 0;
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

  private _computeLabel = (schema: { name: string }) => {
    const labels: Record<string, string> = {
      entity: localize('editor.entity_row', this.lang),
      name: localize('editor.name', this.lang),
      precision: localize('editor.precision', this.lang),
      state_class: localize('editor.state_class', this.lang),
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
  private _advancedData(kind: RowKind): Record<string, unknown> {
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
    if (this._advancedSchemaKey !== schemaKey) {
      this._advancedSchema = advancedSchema(lang, kind);
      this._advancedSchemaKey = schemaKey;
    }
    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this.config}
        .schema=${ENTITY_ROW_SCHEMA_MAIN}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._handleFormChanged}
      ></ha-form>
      ${stale ? html`
        <div class="stale-entity" data-stale>
          <ha-icon icon="mdi:alert-circle"></ha-icon>
          ${localize('editor.statistic_not_found', lang)}
        </div>
      ` : ''}
      <ha-expansion-panel .header=${localize('editor.advanced', lang)}>
        <div class="advanced-content">
          <ha-form
            .hass=${this.hass}
            .data=${this._advancedData(kind)}
            .schema=${this._advancedSchema}
            .computeLabel=${this._computeLabel}
            @value-changed=${this._handleFormChanged}
          ></ha-form>
          <calendar-stats-threshold-list-editor
            .hass=${this.hass}
            .thresholds=${this.config?.thresholds ?? []}
            .lang=${lang}
          ></calendar-stats-threshold-list-editor>
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
