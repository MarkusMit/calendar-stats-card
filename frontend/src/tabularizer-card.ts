import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { CardConfig } from './types/card-config';
import type { HomeAssistant } from './types/ha-types';
import type { ViewState, YearStatistics } from './types/statistics';
import { StatisticsService } from './services/statistics-service';
import { transformDailyStats, transformMonthlyStats } from './services/data-transform';
import { localize } from './localize/localize';
import './components/loading-overlay';
import './components/monthly-table';
import './components/year-navigator';

@customElement('tabularizer-card')
export class TabularzerCard extends LitElement {
  @state() private _config: CardConfig | null = null;
  @state() private _hass: HomeAssistant | null = null;
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

  static styles = css`
    :host {
      display: block;
    }
    ha-card {
      padding: 8px;
      overflow: hidden;
    }
    .no-entities {
      color: var(--secondary-text-color);
      padding: 8px;
    }
  `;

  get selectedYear(): number {
    return this._viewState.selectedYear;
  }

  setConfig(config: CardConfig): void {
    if (!Array.isArray(config.entities)) {
      throw new Error('tabularizer-card: "entities" must be an array');
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

    if (year < currentYear) {
      const startMonth = (year === earliestDataYear && earliestDataMonth != null) ? earliestDataMonth : 1;
      return Array.from({ length: 13 - startMonth }, (_, i) => startMonth + i);
    }
    // Current year: Jan through current month
    return Array.from({ length: currentMonth }, (_, i) => i + 1);
  }

  private async _fetchYear(year: number): Promise<void> {
    if (!this._hass || !this._config) return;

    const token = ++this._fetchAbortFlag;
    this._viewState = { ...this._viewState, isLoading: true };
    this.requestUpdate();

    const entityIds = [...new Set(this._config.entities.map((e) => e.entity))];
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
        this._service.fetchDailyStats(this._hass, entityIds, startTime, endTime),
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

      const tz = this._hass.config.time_zone;
      const dailyValues = transformDailyStats(dailyRaw as Record<string, { start: number; end: number; mean?: number; min?: number; max?: number; sum?: number }[]>, metadataMap, tz, Date.now(), {});
      const monthlySummaries = transformMonthlyStats(monthlyRaw as Record<string, { start: number; end: number; mean?: number; min?: number; max?: number; sum?: number }[]>, metadataMap, dailyValues);

      const yearStats: YearStatistics = {
        dailyValues,
        monthlySummaries,
        entityMetadata: new Map(Object.entries(metadataMap)),
      };

      const newByYear = new Map(this._viewState.statisticsByYear);
      newByYear.set(year, yearStats);

      this._viewState = { ...this._viewState, isLoading: false, statisticsByYear: newByYear };
    } catch (_err) {
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
        ${config
          ? html`<year-navigator
              .year=${selectedYear}
              .atCurrentYear=${atCurrentYear}
              .atEarliestYear=${atEarliestYear}
              .lang=${lang}
              @tabularizer-prev-year=${this._onPrevYear}
              @tabularizer-next-year=${this._onNextYear}
            ></year-navigator>`
          : ''}
        ${!isLoading && config && config.entities.length === 0
          ? html`<p class="no-entities">${localize('card.no_entities', lang)}</p>`
          : ''}
        ${!isLoading && config && config.entities.length > 0
          ? this._visibleMonths(selectedYear).map(
              (month) => html`
                <monthly-table
                  .month=${month}
                  .year=${selectedYear}
                  .entityConfigs=${config.entities}
                  .dailyValues=${yearStats?.dailyValues ?? new Map()}
                  .monthlySummaries=${yearStats?.monthlySummaries ?? new Map()}
                  .entityMetadata=${yearStats?.entityMetadata ?? new Map()}
                  .entityErrors=${this._viewState.entityErrors}
                  .lang=${lang}
                ></monthly-table>
              `,
            )
          : ''}
      </ha-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'tabularizer-card': TabularzerCard;
  }
}

// HA custom card registration
if (!window.customCards) {
  window.customCards = [];
}
window.customCards.push({
  type: 'tabularizer-card',
  name: 'Tabularizer Card',
  description: 'Dense monthly statistics table for Home Assistant entities',
});

declare global {
  interface Window {
    customCards?: Array<{ type: string; name: string; description: string }>;
  }
}
