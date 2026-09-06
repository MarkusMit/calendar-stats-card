import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { CardConfig, ThresholdRule, ThresholdLegendGroup } from './types/card-config';
import type { HomeAssistant } from './types/ha-types';
import type { ViewState, YearStatistics, DateRange, RangePreset, MonthAnchor, ViewMode } from './types/statistics';
import { StatisticsService } from './services/statistics-service';
import { transformDailyStats, transformMonthlyStats, collectDailySums, computeMonthlySummaryFromDailyValues, rowSummaryKey, wrapMonth } from './services/data-transform';
import { rowKey } from './types/card-config';
import { resolvePredecessorData } from './services/predecessor-resolver';
import { extractEntityIds, evaluate } from './services/expression-evaluator';
import { presetToRange, stepRange, rangeYears, visibleMonthsForYear, atRangeStart, atRangeEnd, yearPresetToRange, snapRangeToYears, stepRangeByYears, clampRangeToFloor } from './services/date-range';
import { localize } from './localize/localize';
import { buildCellStyle } from './services/threshold-resolver';
import { ContrastResolver } from './services/readable-text';
import { zonedDateFormatter, zonedDateString, monthNameFormatter } from './services/formatters';
import { countExceedances } from './services/threshold-exceedance';
import type { ExceedanceGroup, MonthSpan } from './services/threshold-exceedance';
import './components/loading-overlay';
import './components/year-table';
import type { MonthSegment } from './components/year-table';
import './components/year-summary-table';
import './components/month-comparison-table';
import './components/view-mode-toggle';
import './components/range-navigator';
import './components/exceedance-table';
import './components/calendar-stats-card-editor';

@customElement('calendar-stats-card')
export class CalendarStatsCard extends LitElement {
  @state() private _config: CardConfig | null = null;
  /** Not reactive: HA reassigns `hass` on every state push, and the card's own
   *  output depends on it only through the language and time zone below. */
  private _hass: HomeAssistant | null = null;
  /** The parts of `hass` the template actually reads — these do trigger a render. */
  @state() private _lang = 'en';
  @state() private _timeZone: string | null = null;
  @state() private _thresholdGroups: ThresholdLegendGroup[] = [];
  @state() private _legendOpen = false;
  @state() private _inEditor = false;
  @state() private _viewState: ViewState = {
    range: presetToRange('this_year', { year: new Date().getFullYear(), month: new Date().getMonth() + 1 }),
    viewMode: 'monthly',
    comparisonMonth: null,
    earliestDataYear: null,
    earliestDataMonth: null,
    isLoading: false,
    statisticsByYear: new Map(),
    entityErrors: new Set(),
  };

  private _service = new StatisticsService();
  private _fetchAbortFlag = 0;
  /** True once the earliest-data probe ran (whether or not it found data). */
  private _earliestProbed = false;
  private _warnedPredecessors = new Set<string>();
  /** Shared auto-contrast text-color resolver, so legend swatches match data cells. */
  private _contrast = new ContrastResolver();
  private readonly _emptyDailyValues = new Map();
  private readonly _emptyMonthlySummaries = new Map();
  private readonly _emptyEntityMetadata = new Map();

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
    /* Reserve space so the fixed bottom bar never covers the last data rows. */
    .card-content:not(.in-editor) {
      padding-bottom: calc(56px + max(16px, var(--safe-area-inset-bottom, 0px)));
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
    .comparison-month {
      font-weight: bold;
      color: var(--primary-text-color);
      min-width: 5.5em;
      text-align: center;
    }
    .bottom-bar button.comparison-back,
    .bottom-bar button.comparison-prev,
    .bottom-bar button.comparison-next {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--primary-text-color);
      padding: 4px 10px;
      line-height: 1;
      border-radius: 16px;
      white-space: nowrap;
    }
    .bottom-bar button.comparison-back:hover,
    .bottom-bar button.comparison-prev:hover,
    .bottom-bar button.comparison-next:hover,
    .bottom-bar button.comparison-back:focus-visible,
    .bottom-bar button.comparison-prev:focus-visible,
    .bottom-bar button.comparison-next:focus-visible {
      outline: none;
      background-color: var(--secondary-background-color, rgba(0, 0, 0, 0.06));
    }
    .comparison-empty {
      color: var(--secondary-text-color);
      padding: 8px 0;
    }
    .comparison-daily {
      margin-top: 8px;
    }
    .legend-toggle {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--primary-text-color);
      padding: 4px 12px;
      line-height: 1;
      display: inline-flex;
      align-items: center;
      border-radius: 16px;
      transition: background-color 0.15s ease-in-out;
    }
    .legend-toggle:hover,
    .legend-toggle[aria-expanded="true"] {
      background-color: var(--secondary-background-color, rgba(0, 0, 0, 0.06));
    }
    .legend-toggle:focus-visible {
      outline: none;
      background-color: var(--secondary-background-color, rgba(0, 0, 0, 0.06));
    }
    .legend-popover {
      position: absolute;
      bottom: 100%;
      right: 0;
      margin-bottom: 8px;
      max-width: min(90vw, 480px);
      max-height: 50vh;
      overflow: auto;
      padding: 6px 10px;
      background: var(--ha-card-background, var(--card-background-color, white));
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
      border-radius: 8px;
      box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.24);
    }
    .legend-title {
      font-size: 0.75em;
      font-weight: 600;
      color: var(--secondary-text-color);
      margin-bottom: 4px;
    }
    .legend-groups {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .legend-group {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .legend-group-label {
      font-size: 0.8em;
      font-weight: 600;
      color: var(--secondary-text-color);
    }
    .legend-entry {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 0.8em;
    }
    .legend-swatch {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 12px;
      height: 12px;
      border-radius: 2px;
      border: 1px solid rgba(0,0,0,0.15);
      flex-shrink: 0;
      font-size: 9px;
      font-weight: 600;
      line-height: 1;
    }
  `;

  get range(): DateRange {
    return this._viewState.range;
  }

  get viewMode(): ViewMode {
    return this._viewState.viewMode;
  }

  set viewMode(mode: ViewMode) {
    if (mode === this._viewState.viewMode) return;
    // Entering the yearly view expands the span to whole calendar years (FR-016);
    // switching back retains the year-spanning range.
    const range = mode === 'yearly' ? snapRangeToYears(this._viewState.range) : this._viewState.range;
    // A view-mode change closes an open month comparison (spec 014, research D3).
    this._viewState = { ...this._viewState, viewMode: mode, range, comparisonMonth: null };
    this.requestUpdate();
    if (mode === 'yearly') void this._fetchRange(range);
  }

  private _onViewModeSelect(e: CustomEvent<{ mode: ViewMode }>): void {
    this.viewMode = e.detail.mode;
  }

  /** Navigation granularity for the active view. */
  private _granularity(): 'month' | 'year' {
    return this._viewState.viewMode === 'yearly' ? 'year' : 'month';
  }

  /** Earliest-data floor anchor for the active granularity (FR-015). */
  private _floorAnchor(): MonthAnchor | null {
    const earliest = this._earliestAnchor();
    if (earliest === null) return null;
    return this._granularity() === 'year' ? { year: earliest.year, month: 1 } : earliest;
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
    this._lang = hass.selectedLanguage ?? hass.language ?? 'en';
    this._timeZone = hass.config.time_zone;

    if (firstSet && this._config) {
      const range = presetToRange('this_year', this._currentYearMonth());
      this._viewState = { ...this._viewState, range };
      void this._fetchRange(range);
    }
  }

  get hass(): HomeAssistant | null {
    return this._hass;
  }

  /** Last today/earliest values, reused while equal so child props keep their identity. */
  private _nowMemo: { year: number; month: number; day: number } | null = null;
  private _earliestMemo: MonthAnchor | null = null;

  /** Today in the HA server timezone. `day` gates the current month's table (visible from the 2nd). */
  private _currentYearMonth(): { year: number; month: number; day: number } {
    const tz = this._timeZone;
    let value: { year: number; month: number; day: number };
    if (tz === null) {
      const now = new Date();
      value = { year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() };
    } else {
      const parts = zonedDateFormatter(tz).format(new Date());
      const [y, m, d] = parts.split('-').map(Number);
      const fallback = new Date();
      value = {
        year: y ?? fallback.getFullYear(),
        month: m ?? fallback.getMonth() + 1,
        day: d ?? fallback.getDate(),
      };
    }
    const prev = this._nowMemo;
    if (prev && prev.year === value.year && prev.month === value.month && prev.day === value.day) {
      return prev;
    }
    this._nowMemo = value;
    return value;
  }

  private _earliestAnchor(): MonthAnchor | null {
    const { earliestDataYear, earliestDataMonth } = this._viewState;
    if (earliestDataYear === null || earliestDataMonth === null) return null;
    const prev = this._earliestMemo;
    if (prev && prev.year === earliestDataYear && prev.month === earliestDataMonth) return prev;
    const value = { year: earliestDataYear, month: earliestDataMonth };
    this._earliestMemo = value;
    return value;
  }

  /** Fetch every year the range spans that is not already cached, under one loading state. */
  private async _fetchRange(range: DateRange): Promise<void> {
    if (!this._hass || !this._config) return;

    const token = ++this._fetchAbortFlag;
    this._viewState = { ...this._viewState, isLoading: true };
    this.requestUpdate();

    const years = rangeYears(range).filter((y) => !this._viewState.statisticsByYear.has(y));
    for (const y of years) {
      const ok = await this._fetchOneYear(y, token);
      if (!ok) return; // a newer fetch superseded this one
    }

    if (token !== this._fetchAbortFlag) return;
    this._viewState = { ...this._viewState, isLoading: false };
    this.requestUpdate();
  }

  private async _fetchOneYear(year: number, token: number): Promise<boolean> {
    if (!this._hass || !this._config) return false;

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
    // Monthly fetch extends back to Dec 1 of the prior year so January's HA-sum-delta
    // can subtract sum[Dec of prev year] for the cross-year boundary (feature 011 FR-007).
    const monthlyStartTime = `${year - 1}-12-01T00:00:00Z`;
    const endTime = `${year + 1}-01-01T00:00:00Z`;

    try {
      // Resolve the first recorded data point once, from the earliest monthly
      // statistics bucket (HA metadata carries no earliest-data timestamp).
      if (!this._earliestProbed) {
        const meta = await this._service.findEarliestDataPoint(this._hass, entityIds);
        if (token !== this._fetchAbortFlag) return false;
        this._earliestProbed = true;
        if (meta) {
          this._viewState = {
            ...this._viewState,
            earliestDataYear: meta.earliestYear,
            earliestDataMonth: meta.earliestMonth,
          };
        }
      }

      const [dailyRaw, monthlyRaw] = await Promise.all([
        this._service.fetchDailyStats(this._hass, entityIds, dailyStartTime, endTime),
        this._service.fetchMonthlyStats(this._hass, entityIds, monthlyStartTime, endTime),
      ]);

      if (token !== this._fetchAbortFlag) return false;

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
        transformDailyStats(dailyRaw as Record<string, { start: number; end: number; mean?: number; min?: number; max?: number; sum?: number }[]>, metadataMap, tz, nowMs),
        metadataMap,
        this._warnedPredecessors,
      );

      // Compute expression daily values from constituent entity daily values
      const todayStr = zonedDateString(nowMs, tz);
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
              });
            }
          }
        }
      }

      const monthlySummaries = transformMonthlyStats(monthlyRaw as Record<string, { start: number; end: number; mean?: number; min?: number; max?: number; sum?: number }[]>, metadataMap, dailyValues, this._config.entities, year, tz, nowMs);

      // Compute expression monthly summaries from expression daily values.
      // min/mean/max exclude zero-value days when the row's show_zero is false (FR-003);
      // total always sums all days (zero days contribute 0 anyway, FR-004).
      // Keyed by row index so duplicate expression rows with different show_zero each get
      // an independent summary.
      this._config.entities.forEach((cfg, rowIndex) => {
        if (!('expression' in cfg)) return;
        const excludeZero = cfg.show_zero === false;
        for (let m = 1; m <= 12; m++) {
          const filteredSums = collectDailySums(cfg.expression, year, m, dailyValues, excludeZero);
          const allSums = excludeZero
            ? collectDailySums(cfg.expression, year, m, dailyValues, false)
            : filteredSums;
          if (allSums.length === 0) continue;
          const total = allSums.reduce((a, b) => a + b, 0);
          monthlySummaries.set(rowSummaryKey(rowIndex, cfg.expression, year, m), {
            entityId: cfg.expression,
            year,
            month: m,
            min: filteredSums.length > 0 ? Math.min(...filteredSums) : null,
            mean: filteredSums.length > 0 ? total / filteredSums.length : null,
            max: filteredSums.length > 0 ? Math.max(...filteredSums) : null,
            total,
          });
        }
      });

      // For current year: fill in missing summaries for the current (incomplete) month.
      // Keyed by row index (matches transformMonthlyStats and the renderer lookup).
      const { year: currentYear, month: currentMonth } = this._currentYearMonth();
      if (year === currentYear) {
        this._config.entities.forEach((cfg, rowIndex) => {
          if (!('entity' in cfg)) return;
          const entityId = cfg.entity;
          const meta = metadataMap[entityId];
          if (!meta) return;
          const key = rowSummaryKey(rowIndex, entityId, year, currentMonth);
          if (!monthlySummaries.has(key)) {
            const s = computeMonthlySummaryFromDailyValues(
              entityId, year, currentMonth,
              meta.stateClass === 'measurement',
              cfg.show_zero === false,
              dailyValues,
            );
            if (s) monthlySummaries.set(key, s);
          }
        });
      }

      const yearStats: YearStatistics = {
        dailyValues,
        monthlySummaries,
        entityMetadata: new Map(Object.entries(metadataMap)),
      };

      const newByYear = new Map(this._viewState.statisticsByYear);
      newByYear.set(year, yearStats);

      this._viewState = { ...this._viewState, statisticsByYear: newByYear };
    } catch {
      if (token !== this._fetchAbortFlag) return false;
      this._viewState = {
        ...this._viewState,
        entityErrors: new Set(entityIds),
      };
    }

    this.requestUpdate();
    return true;
  }

  private _applyRange(range: DateRange): void {
    // A range change would silently swap the compared year set — close instead (spec 014, research D3).
    this._viewState = { ...this._viewState, range, comparisonMonth: null };
    this.requestUpdate();
    void this._fetchRange(range);
  }

  private _onMonthSelect(e: CustomEvent<{ month: number }>): void {
    if (this._viewState.viewMode !== 'yearly') return;
    this._viewState = { ...this._viewState, comparisonMonth: e.detail.month };
    this.requestUpdate();
  }

  private _stepComparisonMonth(step: number): void {
    const current = this._viewState.comparisonMonth;
    if (current === null) return;
    this._viewState = { ...this._viewState, comparisonMonth: wrapMonth(current, step) };
    this.requestUpdate();
  }

  private _closeComparison(): void {
    this._viewState = { ...this._viewState, comparisonMonth: null };
    this.requestUpdate();
  }

  private _onPrevRange = (): void => {
    const gran = this._granularity();
    if (atRangeStart(this._viewState.range, this._floorAnchor())) return;
    const stepped = gran === 'year'
      ? stepRangeByYears(this._viewState.range, -1)
      : stepRange(this._viewState.range, -1, this._currentYearMonth());
    // FR-015: a step can never cross the earliest-data floor.
    this._applyRange(clampRangeToFloor(stepped, this._earliestAnchor(), gran));
  };

  private _onNextRange = (): void => {
    if (atRangeEnd(this._viewState.range, this._currentYearMonth())) return;
    const stepped = this._granularity() === 'year'
      ? stepRangeByYears(this._viewState.range, 1)
      : stepRange(this._viewState.range, 1, this._currentYearMonth());
    this._applyRange(stepped);
  };

  private _onRangeSelected(e: CustomEvent): void {
    const d = e.detail as { preset?: RangePreset; start?: MonthAnchor; end?: MonthAnchor };
    const gran = this._granularity();
    let range: DateRange;
    if (d.preset) {
      range = gran === 'year'
        ? yearPresetToRange(d.preset, this._currentYearMonth().year, this._viewState.earliestDataYear)
        : presetToRange(d.preset, this._currentYearMonth());
    } else if (d.start && d.end) {
      range = { start: d.start, end: d.end, preset: 'custom' };
    } else return;
    this._applyRange(clampRangeToFloor(range, this._earliestAnchor(), gran));
  }

  getCardSize(): number {
    const range = this._viewState.range;
    const now = this._currentYearMonth();
    const earliest = this._earliestAnchor();
    if (this._viewState.viewMode === 'yearly') {
      // One compact block per year in range.
      return Math.max(rangeYears(range).length * 2, 1);
    }
    const total = rangeYears(range).reduce(
      (sum, y) => sum + visibleMonthsForYear(range, y, now, earliest, now.day).length,
      0,
    );
    return total || 1;
  }

  private _onThresholdsApplied(e: CustomEvent<{ groups: ThresholdLegendGroup[] }>): void {
    this._thresholdGroups = e.detail.groups ?? [];
    if (this._displayGroups().length === 0 && this._legendOpen) {
      this._setLegendOpen(false);
    }
  }

  /** Groups with rules deduped by name (first-seen wins); groups with no named rule dropped. */
  private _displayGroups(): ThresholdLegendGroup[] {
    const result: ThresholdLegendGroup[] = [];
    for (const g of this._thresholdGroups) {
      const seen = new Set<string>();
      const named: ThresholdRule[] = [];
      for (const r of g.rules) {
        if (r.name && !seen.has(r.name)) {
          seen.add(r.name);
          named.push(r);
        }
      }
      if (named.length > 0) result.push({ label: g.label, rules: named });
    }
    return result;
  }

  private _onDocClick = (e: MouseEvent): void => {
    const bar = this.shadowRoot?.querySelector('.bottom-bar');
    if (bar && e.composedPath().includes(bar)) return;
    this._setLegendOpen(false);
  };

  private _setLegendOpen(open: boolean): void {
    if (this._legendOpen === open) return;
    this._legendOpen = open;
    if (open) {
      document.addEventListener('click', this._onDocClick);
    } else {
      document.removeEventListener('click', this._onDocClick);
    }
  }

  private _toggleLegend(): void {
    this._setLegendOpen(!this._legendOpen);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this._onDocClick);
    this._contrast.dispose();
  }

  /** Legend toggle button + popover, rendered inside the floating bottom bar. */
  private _renderLegend(lang: string) {
    const groups = this._displayGroups();
    if (groups.length === 0) return '';
    return html`
      <button class="legend-toggle" aria-expanded=${this._legendOpen} @click=${this._toggleLegend}>
        ${localize('legend.title', lang)}
      </button>
      ${this._legendOpen ? html`
        <div class="legend-popover">
          <div class="legend-title">${localize('legend.title', lang)}</div>
          <div class="legend-groups">
            ${groups.map(g => html`
              <div class="legend-group">
                <span class="legend-group-label">${g.label}:</span>
                ${g.rules.map(r => html`
                  <span class="legend-entry">
                    ${r.background_color || r.text_color ? html`
                      <span class="legend-swatch" aria-hidden="true" style=${ifDefined(
                        buildCellStyle(undefined, undefined, r, this._contrast.textFor(r.background_color)),
                      )}>${localize('legend.swatch_sample', lang)}</span>
                    ` : ''}
                    <span class="legend-name">${r.name}</span>
                  </span>
                `)}
              </div>
            `)}
          </div>
        </div>` : ''}
    `;
  }

  /** Last result per memo name, with the dependencies it was computed from. */
  private _memos = new Map<string, { deps: readonly unknown[]; value: unknown }>();

  /**
   * Reuses the previous result while every dependency is identical. Child
   * components diff their properties by identity, so a rebuilt-but-equal array
   * would re-render a whole table; memoizing keeps those renders out.
   */
  private _memoize<T>(name: string, deps: readonly unknown[], compute: () => T): T {
    const hit = this._memos.get(name);
    if (hit && hit.deps.length === deps.length && hit.deps.every((d, i) => d === deps[i])) {
      return hit.value as T;
    }
    const value = compute();
    this._memos.set(name, { deps, value });
    return value;
  }

  /**
   * Exceedance counts for the visible range. Counting walks every day of every
   * visible month, so the result is reused until the entities, the fetched
   * statistics or the visible months actually change.
   */
  private _exceedanceGroups(entities: CardConfig['entities'], yearSegments: MonthSpan[]): ExceedanceGroup[] {
    const stats = this._viewState.statisticsByYear;
    return this._memoize('exceedance', [entities, stats, yearSegments], () =>
      countExceedances(entities, yearSegments, stats));
  }

  /** Years with at least one visible month, in chronological order. */
  private _yearSegments(
    range: DateRange,
    now: { year: number; month: number; day: number },
    earliest: MonthAnchor | null,
  ): Array<{ year: number; months: number[] }> {
    return this._memoize('yearSegments', [range, now, earliest], () =>
      rangeYears(range)
        .map((year) => ({ year, months: visibleMonthsForYear(range, year, now, earliest, now.day) }))
        .filter((seg) => seg.months.length > 0));
  }

  /** Per-year data slices for the yearly view and the month comparison. */
  private _buildSegments(yearSegments: Array<{ year: number; months: number[] }>) {
    const stats = this._viewState.statisticsByYear;
    return this._memoize('segments', [yearSegments, stats], () => yearSegments.map((seg) => {
      const yearStats = stats.get(seg.year);
      return {
        year: seg.year,
        visibleMonths: seg.months,
        monthlySummaries: yearStats?.monthlySummaries ?? this._emptyMonthlySummaries,
        dailyValues: yearStats?.dailyValues ?? this._emptyDailyValues,
        entityMetadata: yearStats?.entityMetadata ?? this._emptyEntityMetadata,
      };
    }));
  }

  /** Flat month-section list for the monthly view over a multi-year range. */
  private _buildMonthSegments(yearSegments: Array<{ year: number; months: number[] }>): MonthSegment[] {
    return this._memoize('monthSegments', [yearSegments, this._viewState.statisticsByYear], () => yearSegments.flatMap((seg) => {
      const yearStats = this._viewState.statisticsByYear.get(seg.year);
      return seg.months.map((month) => ({
        year: seg.year,
        month,
        dailyValues: yearStats?.dailyValues ?? this._emptyDailyValues,
        monthlySummaries: yearStats?.monthlySummaries ?? this._emptyMonthlySummaries,
        entityMetadata: yearStats?.entityMetadata ?? this._emptyEntityMetadata,
      }));
    }));
  }

  /** True when any configured row has a summary for the month in this segment. */
  private _segmentHasMonthData(seg: ReturnType<CalendarStatsCard['_buildSegments']>[number], month: number): boolean {
    if (!this._config) return false;
    return this._config.entities.some((cfg, i) =>
      seg.monthlySummaries.has(rowSummaryKey(i, rowKey(cfg), seg.year, month)));
  }

  /** Month comparison view (spec 014): chrome + cross-year summary table. */
  private _renderComparison(
    segments: ReturnType<CalendarStatsCard['_buildSegments']>,
    lang: string,
    now: { year: number; month: number },
  ) {
    const config = this._config!;
    const month = this._viewState.comparisonMonth!;
    const hasAnyData = segments.some((seg) => this._segmentHasMonthData(seg, month));

    // Daily section: one section per data-bearing year inside ONE year-table so
    // every section shares the same day-column widths; a year without data gets
    // no section (its absence is visible in the summary table above).
    const dailySegments = this._memoize('comparisonDailySegments', [segments, month], () => segments
      .filter((seg) => this._segmentHasMonthData(seg, month))
      .map((seg) => ({
        year: seg.year,
        month,
        dailyValues: seg.dailyValues,
        monthlySummaries: seg.monthlySummaries,
        entityMetadata: seg.entityMetadata,
      })));

    return html`
      ${hasAnyData
        ? html`<calendar-stats-month-comparison-table
            .month=${month}
            .segments=${segments}
            .entityConfigs=${config.entities}
            .entityErrors=${this._viewState.entityErrors}
            .now=${now}
            .lang=${lang}
            @thresholds-applied=${this._onThresholdsApplied}
          ></calendar-stats-month-comparison-table>
          <div class="comparison-daily">
            <calendar-stats-year-table
              .monthSegments=${dailySegments}
              .entityConfigs=${config.entities}
              .entityErrors=${this._viewState.entityErrors}
              .lang=${lang}
              @thresholds-applied=${this._onThresholdsApplied}
            ></calendar-stats-year-table>
          </div>`
        : html`<p class="comparison-empty">${localize('comparison.no_data', lang)}</p>`}
    `;
  }

  /** Back + month prev/next controls shown in the bottom bar while the comparison is open. */
  private _renderComparisonNav(lang: string) {
    const month = this._viewState.comparisonMonth!;
    const monthName = monthNameFormatter(lang).format(new Date(2020, month - 1, 1));
    return html`
      <button class="comparison-back" @click=${this._closeComparison}>← ${localize('comparison.back', lang)}</button>
      <button class="comparison-prev" aria-label=${localize('comparison.prev_month', lang)}
        @click=${() => this._stepComparisonMonth(-1)}>‹</button>
      <span class="comparison-month">${monthName}</span>
      <button class="comparison-next" aria-label=${localize('comparison.next_month', lang)}
        @click=${() => this._stepComparisonMonth(1)}>›</button>
    `;
  }

  render() {
    const { isLoading, range } = this._viewState;
    const config = this._config;
    const lang = this._lang;

    const now = this._currentYearMonth();
    const earliest = this._earliestAnchor();
    const yearSegments = this._yearSegments(range, now, earliest);
    const showYear = yearSegments.length > 1;
    const comparisonOpen = this._viewState.viewMode === 'yearly' && this._viewState.comparisonMonth !== null;
    const exceedanceGroups = config && !comparisonOpen && config.show_threshold_table !== false
      ? this._exceedanceGroups(config.entities, yearSegments)
      : [];

    return html`
      <ha-card>
        <calendar-stats-loading-overlay .visible=${isLoading} .lang=${lang}></calendar-stats-loading-overlay>
        <div class="card-content ${this._inEditor ? 'in-editor' : ''}">
          ${!isLoading && config && config.entities.length === 0
            ? html`<p class="no-entities">${localize('card.no_entities', lang)}</p>`
            : ''}
          ${!isLoading && config && config.entities.length > 0 && yearSegments.length === 0
            ? html`<p class="no-entities">${localize('card.no_visible_months', lang)}</p>`
            : ''}
          ${!isLoading && config && config.entities.length > 0 && yearSegments.length > 0
            ? (comparisonOpen
              ? this._renderComparison(this._buildSegments(yearSegments), lang, now)
              : this._viewState.viewMode === 'yearly'
                // All year segments in ONE table component so every year
                // section shares the same column widths.
                ? html`<calendar-stats-year-summary-table
                    .segments=${this._buildSegments(yearSegments)}
                    .entityConfigs=${config.entities}
                    .entityErrors=${this._viewState.entityErrors}
                    .lang=${lang}
                    @thresholds-applied=${this._onThresholdsApplied}
                    @calendar-stats-month-select=${this._onMonthSelect}
                  ></calendar-stats-year-summary-table>`
                // Multi-year ranges put every month into ONE year-table (as
                // cross-year segments) so all sections share the same
                // day-column widths; single-year ranges already do via the
                // per-year props and keep the year out of the month headers.
                : showYear
                  ? html`<calendar-stats-year-table
                      .monthSegments=${this._buildMonthSegments(yearSegments)}
                      .entityConfigs=${config.entities}
                      .entityErrors=${this._viewState.entityErrors}
                      .lang=${lang}
                      @thresholds-applied=${this._onThresholdsApplied}
                    ></calendar-stats-year-table>`
                  : yearSegments.map((seg) => {
                    const yearStats = this._viewState.statisticsByYear.get(seg.year);
                    return html`<calendar-stats-year-table
                      .year=${seg.year}
                      .visibleMonths=${seg.months}
                      .entityConfigs=${config.entities}
                      .dailyValues=${yearStats?.dailyValues ?? this._emptyDailyValues}
                      .monthlySummaries=${yearStats?.monthlySummaries ?? this._emptyMonthlySummaries}
                      .entityMetadata=${yearStats?.entityMetadata ?? this._emptyEntityMetadata}
                      .entityErrors=${this._viewState.entityErrors}
                      .lang=${lang}
                      @thresholds-applied=${this._onThresholdsApplied}
                    ></calendar-stats-year-table>`;
                  }))
            : ''}
          ${exceedanceGroups.length > 0
            ? html`<calendar-stats-exceedance-table
                .groups=${exceedanceGroups}
                .years=${this._viewState.viewMode === 'yearly' ? yearSegments.map((seg) => seg.year) : []}
                .lang=${lang}
              ></calendar-stats-exceedance-table>`
            : ''}
        </div>
        ${!this._inEditor ? html`<div class="bottom-bar">
          ${config && comparisonOpen ? this._renderComparisonNav(lang) : ''}
          ${config && !comparisonOpen
            ? html`<calendar-stats-view-mode-toggle
                .mode=${this._viewState.viewMode}
                .lang=${lang}
                @calendar-stats-view-mode-select=${this._onViewModeSelect}
              ></calendar-stats-view-mode-toggle>
              <calendar-stats-range-navigator
                .range=${range}
                .now=${now}
                .earliest=${earliest}
                .granularity=${this._granularity()}
                .atStart=${atRangeStart(range, this._floorAnchor())}
                .atEnd=${atRangeEnd(range, now)}
                .lang=${lang}
                @calendar-stats-prev-range=${this._onPrevRange}
                @calendar-stats-next-range=${this._onNextRange}
                @calendar-stats-range-select=${this._onRangeSelected}
              ></calendar-stats-range-navigator>`
            : ''}
          ${this._renderLegend(lang)}
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
