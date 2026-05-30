import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { CardConfig, ThresholdRule } from './types/card-config';
import type { HomeAssistant } from './types/ha-types';
import type { ViewState, YearStatistics } from './types/statistics';
import { StatisticsService } from './services/statistics-service';
import { transformDailyStats, transformMonthlyStats, collectDailySums, computeMonthlySummaryFromDailyValues } from './services/data-transform';
import { resolvePredecessorData } from './services/predecessor-resolver';
import { extractEntityIds, evaluate } from './services/expression-evaluator';
import { localize } from './localize/localize';
import './components/loading-overlay';
import './components/year-table';
import './components/year-navigator';
import './components/calendar-stats-card-editor';

@customElement('calendar-stats-card')
export class CalendarStatsCard extends LitElement {
  @state() private _config: CardConfig | null = null;
  @state() private _hass: HomeAssistant | null = null;
  @state() private _triggeredThresholds: ThresholdRule[] = [];
  @state() private _inEditor = false;
  @state() private _viewState: ViewState = {
    selectedYear: new Date().getFullYear(),
    earliestDataYear: null,
    earliestDataMonth: null,
    isLoading: false,
    statisticsByYear: new Map(),
    entityErrors: new Set(),
  };

  private _service = new StatisticsService();
  private _fetchAbortFlag = 0;
  private _warnedPredecessors = new Set<string>();
  private readonly _emptyDailyValues = new Map();
  private readonly _emptyMonthlySummaries = new Map();
  private readonly _emptyEntityMetadata = new Map();
  private _cachedVisibleMonths: { year: number; start: number; end: number; months: number[] } | null = null;

  static styles = css`
    :host {
      display: block;
    }
    ha-card {
      overflow: hidden;
    }
    .card-content {
      padding: 8px;
    }
    .bottom-bar {
      position: fixed;
      bottom: max(16px, var(--safe-area-inset-bottom, 0px));
      right: 16px;
      z-index: 5;
      display: flex;
      align-items: center;
      padding: 4px 8px;
      background: var(--ha-card-background, var(--card-background-color, white));
      border-radius: 24px;
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
      box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.24);
    }
    .no-entities {
      color: var(--secondary-text-color);
      padding: 8px;
    }
    .legend {
      margin-top: 8px;
      padding: 4px 8px;
      border-top: 1px solid var(--divider-color, #e0e0e0);
    }
    .legend-title {
      font-size: 0.75em;
      font-weight: 600;
      color: var(--secondary-text-color);
      margin-bottom: 4px;
    }
    .legend-entries {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .legend-entry {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8em;
    }
    .legend-swatch {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 2px;
      border: 1px solid rgba(0,0,0,0.15);
      flex-shrink: 0;
    }
  `;

  get selectedYear(): number {
    return this._viewState.selectedYear;
  }

  connectedCallback(): void {
    super.connectedCallback();
    // Walk the composed DOM tree (crossing shadow root boundaries) to detect editor context.
    // :host-context() cannot cross shadow DOM boundaries, so JS traversal is required.
    const editorTags = new Set(['hui-card-element-editor', 'hui-dialog-edit-card', 'ha-dialog']);
    let ancestor: Node | null = this.parentNode;
    while (ancestor) {
      if (ancestor instanceof Element && editorTags.has(ancestor.tagName.toLowerCase())) {
        this._inEditor = true;
        return;
      }
      const parent: Node | null = ancestor.parentNode;
      if (parent) {
        ancestor = parent;
      } else if (ancestor instanceof ShadowRoot) {
        ancestor = ancestor.host;
      } else {
        break;
      }
    }
  }

  static getConfigElement(): HTMLElement {
    return document.createElement('calendar-stats-card-editor');
  }

  static getStubConfig(): CardConfig {
    return { type: 'custom:calendar-stats-card', entities: [] };
  }

  setConfig(config: CardConfig): void {
    if (!Array.isArray(config.entities)) {
      throw new Error('calendar-stats-card: "entities" must be an array');
    }
    this._config = config;
  }

  set hass(hass: HomeAssistant) {
    const firstSet = this._hass === null;
    this._hass = hass;

    if (firstSet && this._config) {
      const year = this._resolveDefaultYear(hass);
      this._viewState = { ...this._viewState, selectedYear: year };
      void this._fetchYear(year);
    }
  }

  get hass(): HomeAssistant | null {
    return this._hass;
  }

  private _resolveDefaultYear(hass: HomeAssistant): number {
    const tz = hass.config.time_zone;
    const now = Date.now();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const dateStr = formatter.format(new Date(now));
    const [yearStr, monthStr, dayStr] = dateStr.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = Number(dayStr);
    // If today is Jan 1, default to previous year
    if (month === 1 && day === 1) return year - 1;
    return year;
  }

  private _currentYearMonth(): { year: number; month: number } {
    if (!this._hass) {
      const now = new Date();
      return { year: now.getFullYear(), month: now.getMonth() + 1 };
    }
    const tz = this._hass.config.time_zone;
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit' }).format(new Date());
    const [y, m] = parts.split('-').map(Number);
    return { year: y ?? new Date().getFullYear(), month: m ?? new Date().getMonth() + 1 };
  }

  private _visibleMonths(year: number): number[] {
    const { earliestDataYear, earliestDataMonth } = this._viewState;
    const { year: currentYear, month: currentMonth } = this._currentYearMonth();

    const startMonth = (year < currentYear && year === earliestDataYear && earliestDataMonth != null)
      ? earliestDataMonth : 1;
    const endMonth = year < currentYear ? 12 : currentMonth;

    const c = this._cachedVisibleMonths;
    if (c && c.year === year && c.start === startMonth && c.end === endMonth) return c.months;

    const months = Array.from({ length: endMonth - startMonth + 1 }, (_, i) => startMonth + i);
    this._cachedVisibleMonths = { year, start: startMonth, end: endMonth, months };
    return months;
  }

  private async _fetchYear(year: number): Promise<void> {
    if (!this._hass || !this._config) return;

    const token = ++this._fetchAbortFlag;
    this._viewState = { ...this._viewState, isLoading: true };
    this.requestUpdate();

    const entityIds = [...new Set(
      this._config.entities.flatMap((cfg) => {
        if ('entity' in cfg) {
          const ids = [cfg.entity];
          if (cfg.predecessors) ids.push(...cfg.predecessors.map((p) => p.entity));
          return ids;
        }
        return extractEntityIds(cfg.expression);
      }),
    )];
    const dailyStartTime = `${year - 1}-12-31T00:00:00Z`;
    const startTime = `${year}-01-01T00:00:00Z`;
    const endTime = `${year + 1}-01-01T00:00:00Z`;

    try {
      // Resolve earliest data year on first fetch
      if (this._viewState.earliestDataYear === null) {
        const meta = await this._service.getStatisticsMetadata(this._hass, entityIds);
        if (token !== this._fetchAbortFlag) return;
        this._viewState = {
          ...this._viewState,
          earliestDataYear: meta.earliestYear,
          earliestDataMonth: meta.earliestMonth,
        };
      }

      const [dailyRaw, monthlyRaw] = await Promise.all([
        this._service.fetchDailyStats(this._hass, entityIds, dailyStartTime, endTime),
        this._service.fetchMonthlyStats(this._hass, entityIds, startTime, endTime),
      ]);

      if (token !== this._fetchAbortFlag) return;

      // Build metadata map from hass.states
      const metadataMap: Record<string, import('./types/statistics').EntityMetadata> = {};
      for (const id of entityIds) {
        const stateObj = this._hass.states[id];
        const attrs = stateObj?.attributes;
        metadataMap[id] = {
          entityId: id,
          stateClass: (attrs?.['state_class'] as 'measurement' | 'total_increasing' | 'total') ?? 'unknown',
          deviceClass: (attrs?.['device_class'] as string | null) ?? null,
          unitOfMeasurement: (attrs?.['unit_of_measurement'] as string | null) ?? null,
          friendlyName: (attrs?.['friendly_name'] as string | null) ?? null,
          hasStatistics: true,
        };
      }

      // Add synthetic metadata for expression rows
      for (const cfg of this._config.entities) {
        if (!('expression' in cfg)) continue;
        metadataMap[cfg.expression] = {
          entityId: cfg.expression,
          stateClass: 'total',
          deviceClass: null,
          unitOfMeasurement: cfg.unit ?? null,
          friendlyName: cfg.name ?? null,
          hasStatistics: true,
        };
      }

      const tz = this._hass.config.time_zone;
      const nowMs = Date.now();
      const dailyValues = resolvePredecessorData(
        this._config.entities,
        transformDailyStats(dailyRaw as Record<string, { start: number; end: number; mean?: number; min?: number; max?: number; sum?: number }[]>, metadataMap, tz, nowMs, {}),
        metadataMap,
        this._warnedPredecessors,
      );

      // Compute expression daily values from constituent entity daily values
      const todayStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      }).format(new Date(nowMs));
      for (const cfg of this._config.entities) {
        if (!('expression' in cfg)) continue;
        const exprEntityIds = extractEntityIds(cfg.expression);
        for (let m = 1; m <= 12; m++) {
          const daysInMonth = new Date(year, m, 0).getDate();
          for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const key = `${cfg.expression}::${dateStr}`;
            if (dateStr >= todayStr) {
              dailyValues.set(key, { kind: 'empty', entityId: cfg.expression, date: dateStr });
              continue;
            }
            const context: Record<string, number> = {};
            let hasData = false;
            for (const id of exprEntityIds) {
              const v = dailyValues.get(`${id}::${dateStr}`);
              if (v?.kind === 'cumulative') { context[id] = v.sum; hasData = true; }
              else if (v?.kind === 'measurement') { context[id] = v.mean; hasData = true; }
              else { context[id] = 0; }
            }
            if (hasData) {
              dailyValues.set(key, {
                kind: 'cumulative',
                entityId: cfg.expression,
                date: dateStr,
                sum: evaluate(cfg.expression, context),
                partialCoverage: false,
              });
            }
          }
        }
      }

      const monthlySummaries = transformMonthlyStats(monthlyRaw as Record<string, { start: number; end: number; mean?: number; min?: number; max?: number; sum?: number }[]>, metadataMap, dailyValues);

      // Compute expression monthly summaries from expression daily values
      for (const cfg of this._config.entities) {
        if (!('expression' in cfg)) continue;
        for (let m = 1; m <= 12; m++) {
          const sums = collectDailySums(cfg.expression, year, m, dailyValues, false);
          if (sums.length === 0) continue;
          const total = sums.reduce((a, b) => a + b, 0);
          monthlySummaries.set(`${cfg.expression}::${year}-${m}`, {
            entityId: cfg.expression,
            year,
            month: m,
            min: Math.min(...sums),
            mean: total / sums.length,
            max: Math.max(...sums),
            total,
          });
        }
      }

      // For current year: fill in missing summaries for the current (incomplete) month
      const { year: currentYear, month: currentMonth } = this._currentYearMonth();
      if (year === currentYear) {
        for (const cfg of this._config.entities) {
          if (!('entity' in cfg)) continue;
          const entityId = cfg.entity;
          const meta = metadataMap[entityId];
          if (!meta) continue;
          const key = `${entityId}::${year}-${currentMonth}`;
          if (!monthlySummaries.has(key)) {
            const s = computeMonthlySummaryFromDailyValues(
              entityId, year, currentMonth,
              meta.stateClass === 'measurement',
              meta.deviceClass === 'precipitation',
              dailyValues,
            );
            if (s) monthlySummaries.set(key, s);
          }
        }
      }

      const yearStats: YearStatistics = {
        dailyValues,
        monthlySummaries,
        entityMetadata: new Map(Object.entries(metadataMap)),
      };

      const newByYear = new Map(this._viewState.statisticsByYear);
      newByYear.set(year, yearStats);

      this._viewState = { ...this._viewState, isLoading: false, statisticsByYear: newByYear };
    } catch {
      if (token !== this._fetchAbortFlag) return;
      this._viewState = {
        ...this._viewState,
        isLoading: false,
        entityErrors: new Set(entityIds),
      };
    }

    this.requestUpdate();
  }

  private _onPrevYear() {
    const { selectedYear, earliestDataYear } = this._viewState;
    const floor = earliestDataYear ?? selectedYear;
    if (selectedYear <= floor) return;
    const newYear = selectedYear - 1;
    this._viewState = { ...this._viewState, selectedYear: newYear };
    this.requestUpdate();
    void this._fetchYear(newYear);
  }

  private _onNextYear() {
    const { selectedYear } = this._viewState;
    const { year: currentYear } = this._currentYearMonth();
    if (selectedYear >= currentYear) return;
    const newYear = selectedYear + 1;
    this._viewState = { ...this._viewState, selectedYear: newYear };
    this.requestUpdate();
    void this._fetchYear(newYear);
  }

  getCardSize(): number {
    return this._visibleMonths(this._viewState.selectedYear).length;
  }

  private _onThresholdsApplied(e: CustomEvent<{ rules: ThresholdRule[] }>): void {
    const newRules = e.detail.rules;
    const old = this._triggeredThresholds;
    if (newRules.length !== old.length || newRules.some((r, i) => r !== old[i])) {
      this._triggeredThresholds = newRules;
    }
  }

  private _buildLegend(rules: ThresholdRule[], lang: string) {
    const seen = new Set<string>();
    const named: ThresholdRule[] = [];
    for (const r of rules) {
      if (r.name && !seen.has(r.name)) {
        seen.add(r.name);
        named.push(r);
      }
    }
    if (named.length === 0) return '';
    return html`
      <div class="legend">
        <div class="legend-title">${localize('legend.title', lang)}</div>
        <div class="legend-entries">
          ${named.map(r => html`
            <span class="legend-entry">
              <span class="legend-swatch" style=${ifDefined(
                r.background_color ? `background-color:${r.background_color}` : undefined,
              )}></span>
              ${r.name}
            </span>
          `)}
        </div>
      </div>
    `;
  }

  render() {
    const { isLoading, selectedYear } = this._viewState;
    const config = this._config;
    const hass = this._hass;
    const lang = hass?.selectedLanguage ?? hass?.language ?? 'en';

    const yearStats = this._viewState.statisticsByYear.get(selectedYear);
    const { year: currentYear } = this._currentYearMonth();
    const { earliestDataYear } = this._viewState;
    const atCurrentYear = selectedYear >= currentYear;
    const atEarliestYear = earliestDataYear !== null && selectedYear <= earliestDataYear;

    return html`
      <ha-card>
        <loading-overlay .visible=${isLoading} .lang=${lang}></loading-overlay>
        <div class="card-content">
          ${!isLoading && config && config.entities.length === 0
            ? html`<p class="no-entities">${localize('card.no_entities', lang)}</p>`
            : ''}
          ${!isLoading && config && config.entities.length > 0
            ? html`<year-table
                .year=${selectedYear}
                .visibleMonths=${this._visibleMonths(selectedYear)}
                .entityConfigs=${config.entities}
                .dailyValues=${yearStats?.dailyValues ?? this._emptyDailyValues}
                .monthlySummaries=${yearStats?.monthlySummaries ?? this._emptyMonthlySummaries}
                .entityMetadata=${yearStats?.entityMetadata ?? this._emptyEntityMetadata}
                .entityErrors=${this._viewState.entityErrors}
                .lang=${lang}
                @thresholds-applied=${this._onThresholdsApplied}
              ></year-table>
              ${this._buildLegend(this._triggeredThresholds, lang)}`
            : ''}
        </div>
        ${!this._inEditor ? html`<div class="bottom-bar">
          ${config
            ? html`<year-navigator
                .year=${selectedYear}
                .atCurrentYear=${atCurrentYear}
                .atEarliestYear=${atEarliestYear}
                .lang=${lang}
                @calendar-stats-prev-year=${this._onPrevYear}
                @calendar-stats-next-year=${this._onNextYear}
              ></year-navigator>`
            : ''}
        </div>` : ''}
      </ha-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-card': CalendarStatsCard;
  }
}

// HA custom card registration
if (!window.customCards) {
  window.customCards = [];
}
window.customCards.push({
  type: 'calendar-stats-card',
  name: 'Calendar Stats Card',
  description: localize('card.description', (navigator.language ?? 'en').split('-')[0]!),
});

declare global {
  interface Window {
    customCards?: Array<{ type: string; name: string; description: string }>;
  }
}
