import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localize } from '../localize/localize';
import { compareAnchors } from '../services/date-range';
import type { MonthAnchor, RangePreset, DateRange } from '../types/statistics';

const PRESETS: RangePreset[] = [
  'this_month',
  'this_quarter',
  'this_year',
  'last_3_months',
  'last_12_months',
];

/** Presets offered in year granularity (yearly view, FR-016). */
const YEAR_PRESETS: RangePreset[] = [
  'this_year',
  'last_year',
  'last_3_years',
  'last_5_years',
];

@customElement('calendar-stats-range-navigator')
export class RangeNavigator extends LitElement {
  @property({ attribute: false }) range: DateRange = {
    start: { year: new Date().getFullYear(), month: 1 },
    end: { year: new Date().getFullYear(), month: 1 },
    preset: 'this_year',
  };
  @property({ type: Boolean }) atStart = false;
  @property({ type: Boolean }) atEnd = false;
  /** 'year' restricts presets/picker/stepping to whole calendar years (yearly view). */
  @property({ type: String }) granularity: 'month' | 'year' = 'month';
  @property({ attribute: false }) now: MonthAnchor = { year: new Date().getFullYear(), month: 1 };
  @property({ attribute: false }) earliest: MonthAnchor | null = null;
  @property({ type: String }) lang = 'en';

  @state() private _open = false;
  @state() private _from: MonthAnchor = { year: new Date().getFullYear(), month: 1 };
  @state() private _to: MonthAnchor = { year: new Date().getFullYear(), month: 1 };

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px 0;
      position: relative;
    }
    button {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--primary-text-color);
      font-size: 1.1em;
      padding: 2px 8px;
      line-height: 1;
    }
    button:disabled {
      opacity: 0.3;
      cursor: default;
    }
    .prev,
    .next {
      border-radius: 16px;
      transition: background-color 0.15s ease-in-out;
    }
    .prev:not(:disabled):hover,
    .next:not(:disabled):hover,
    .prev:focus-visible,
    .next:focus-visible {
      outline: none;
      background-color: var(--secondary-background-color, rgba(0, 0, 0, 0.06));
    }
    .range-label {
      min-width: 8ch;
      text-align: center;
      font-weight: bold;
      font-size: 1em;
      border-radius: 16px;
      padding: 4px 10px;
      transition: background-color 0.15s ease-in-out;
    }
    .range-label:hover,
    .range-label[aria-expanded='true'] {
      background-color: var(--secondary-background-color, rgba(0, 0, 0, 0.06));
    }
    .range-label:focus-visible {
      outline: none;
      background-color: var(--secondary-background-color, rgba(0, 0, 0, 0.06));
    }
    .popover {
      position: absolute;
      bottom: 100%;
      right: 0;
      margin-bottom: 8px;
      min-width: 220px;
      max-width: min(90vw, 360px);
      max-height: 60vh;
      overflow: auto;
      padding: 8px;
      background: var(--ha-card-background, var(--card-background-color, white));
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
      border-radius: 8px;
      box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.24);
      z-index: 6;
    }
    .presets {
      display: flex;
      flex-direction: column;
    }
    .preset {
      text-align: left;
      font-size: 0.9em;
      padding: 6px 8px;
      border-radius: 6px;
      width: 100%;
    }
    .preset:hover {
      background-color: var(--secondary-background-color, rgba(0, 0, 0, 0.06));
    }
    .preset.active {
      font-weight: bold;
      color: var(--primary-color);
    }
    .custom {
      border-top: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
      margin-top: 6px;
      padding-top: 6px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .custom-title {
      font-size: 0.75em;
      font-weight: 600;
      color: var(--secondary-text-color);
    }
    .custom-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85em;
    }
    .custom-row label {
      min-width: 3ch;
      color: var(--secondary-text-color);
    }
    select {
      background: var(--ha-card-background, var(--card-background-color, white));
      color: var(--primary-text-color);
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
      border-radius: 4px;
      padding: 2px 4px;
    }
    .apply {
      align-self: flex-end;
      font-size: 0.85em;
      padding: 4px 12px;
      border-radius: 16px;
      color: var(--primary-color);
    }
    .apply:disabled {
      color: var(--secondary-text-color);
    }
  `;

  private _monthName(month: number): string {
    return new Intl.DateTimeFormat(this.lang, { month: 'short' }).format(new Date(2020, month - 1, 1));
  }

  private static _pad2(n: number): string {
    return String(n).padStart(2, '0');
  }

  /** Label reflects the displayed span: year `YYYY`, quarter `YYYY-Qn`, month
   *  `YYYY-MM`, and any other span as a compact numeric range. */
  private _rangeLabel(): string {
    const { start, end, preset } = this.range;
    if (this.granularity === 'year') {
      return start.year === end.year ? String(start.year) : `${start.year}–${end.year}`;
    }
    switch (preset) {
      case 'this_year':
        return String(start.year);
      case 'this_quarter':
        return `${start.year}-Q${Math.floor((start.month - 1) / 3) + 1}`;
      case 'this_month':
        return `${start.year}-${RangeNavigator._pad2(start.month)}`;
      default:
        return this._compactRange(start, end);
    }
  }

  private _compactRange(start: MonthAnchor, end: MonthAnchor): string {
    const s = `${start.year}-${RangeNavigator._pad2(start.month)}`;
    if (compareAnchors(start, end) === 0) return s;
    if (start.year === end.year) return `${s}–${RangeNavigator._pad2(end.month)}`;
    return `${s}–${end.year}-${RangeNavigator._pad2(end.month)}`;
  }

  private _toggleOpen(): void {
    if (this._open) this._close();
    else this._openPopover();
  }

  private _openPopover(): void {
    // Seed the custom draft from the active range.
    this._from = { ...this.range.start };
    this._to = { ...this.range.end };
    this._open = true;
    document.addEventListener('click', this._onDocClick);
  }

  private _close(): void {
    if (!this._open) return;
    this._open = false;
    document.removeEventListener('click', this._onDocClick);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this._onDocClick);
  }

  private _onDocClick = (e: MouseEvent): void => {
    if (e.composedPath().includes(this)) return;
    this._close();
  };

  private _onPrev(): void {
    this.dispatchEvent(new CustomEvent('calendar-stats-prev-range', { bubbles: true, composed: true }));
  }

  private _onNext(): void {
    this.dispatchEvent(new CustomEvent('calendar-stats-next-range', { bubbles: true, composed: true }));
  }

  private _selectPreset(preset: RangePreset): void {
    this._close();
    this.dispatchEvent(
      new CustomEvent('calendar-stats-range-select', {
        detail: { preset },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _applyCustom(): void {
    if (this._applyDisabled()) return;
    // Year granularity emits whole-calendar-year anchors (FR-016).
    const start = this.granularity === 'year' ? { year: this._from.year, month: 1 } : { ...this._from };
    const end = this.granularity === 'year' ? { year: this._to.year, month: 12 } : { ...this._to };
    this._close();
    this.dispatchEvent(
      new CustomEvent('calendar-stats-range-select', {
        detail: { start, end },
        bubbles: true,
        composed: true,
      }),
    );
  }

  private _applyDisabled(): boolean {
    return this.granularity === 'year'
      ? this._from.year > this._to.year
      : compareAnchors(this._from, this._to) > 0;
  }

  private _yearOptions(): number[] {
    const maxYear = this.now.year;
    const minYear = this.earliest?.year ?? maxYear - 5;
    const years: number[] = [];
    for (let y = minYear; y <= maxYear; y++) years.push(y);
    return years;
  }

  private _renderMonthYear(which: 'from' | 'to'): unknown {
    const val = which === 'from' ? this._from : this._to;
    const onMonth = (e: Event) => {
      const month = Number((e.target as HTMLSelectElement).value);
      if (which === 'from') this._from = { ...this._from, month };
      else this._to = { ...this._to, month };
    };
    const onYear = (e: Event) => {
      const year = Number((e.target as HTMLSelectElement).value);
      if (which === 'from') this._from = { ...this._from, year };
      else this._to = { ...this._to, year };
    };
    return html`
      <div class="custom-row">
        <label>${which === 'from' ? localize('range.from', this.lang) : localize('range.to', this.lang)}</label>
        ${this.granularity === 'month' ? html`
          <select class="${which}-month" @change=${onMonth}>
            ${Array.from({ length: 12 }, (_, i) => i + 1).map(
              (m) => html`<option value=${m} ?selected=${m === val.month}>${this._monthName(m)}</option>`,
            )}
          </select>` : ''}
        <select class="${which}-year" @change=${onYear}>
          ${this._yearOptions().map(
            (y) => html`<option value=${y} ?selected=${y === val.year}>${y}</option>`,
          )}
        </select>
      </div>
    `;
  }

  render() {
    const applyDisabled = this._applyDisabled();
    const presets = this.granularity === 'year' ? YEAR_PRESETS : PRESETS;
    return html`
      <button class="prev" ?disabled=${this.atStart} @click=${this._onPrev}
        aria-label=${localize('range.prev', this.lang)}>‹</button>
      <button
        class="range-label"
        aria-haspopup="true"
        aria-expanded=${this._open}
        @click=${this._toggleOpen}
      >${this._rangeLabel()}</button>
      <button class="next" ?disabled=${this.atEnd} @click=${this._onNext}
        aria-label=${localize('range.next', this.lang)}>›</button>
      ${this._open
        ? html`<div class="popover">
            <div class="presets">
              ${presets.map(
                (p) => html`<button
                  class="preset ${this.range.preset === p ? 'active' : ''}"
                  @click=${() => this._selectPreset(p)}
                >${localize(`range.${p}`, this.lang)}</button>`,
              )}
            </div>
            <div class="custom">
              <span class="custom-title">${localize('range.custom', this.lang)}</span>
              ${this._renderMonthYear('from')}
              ${this._renderMonthYear('to')}
              <button class="apply" ?disabled=${applyDisabled} @click=${this._applyCustom}>
                ${localize('range.apply', this.lang)}
              </button>
            </div>
          </div>`
        : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-range-navigator': RangeNavigator;
  }
}
