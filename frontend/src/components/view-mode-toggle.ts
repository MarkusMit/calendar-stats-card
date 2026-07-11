import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localize } from '../localize/localize';
import type { ViewMode } from '../types/statistics';

/** Segmented Monthly | Yearly control for the floating bottom bar (FR-011). */
@customElement('calendar-stats-view-mode-toggle')
export class ViewModeToggle extends LitElement {
  @property({ type: String }) mode: ViewMode = 'monthly';
  @property({ type: String }) lang = 'en';

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      padding: 4px 0;
    }
    .segments {
      display: inline-flex;
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
      border-radius: 16px;
      overflow: hidden;
    }
    button.segment {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--primary-text-color);
      font-size: 0.9em;
      padding: 4px 10px;
      line-height: 1;
      transition: background-color 0.15s ease-in-out;
    }
    button.segment:hover {
      background-color: var(--secondary-background-color, rgba(0, 0, 0, 0.06));
    }
    button.segment:focus-visible {
      outline: none;
      background-color: var(--secondary-background-color, rgba(0, 0, 0, 0.06));
    }
    button.segment[aria-pressed='true'] {
      background-color: var(--primary-color, #03a9f4);
      color: var(--text-primary-color, #fff);
      font-weight: bold;
      cursor: default;
    }
    button.segment + button.segment {
      border-left: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
    }
  `;

  private _select(mode: ViewMode): void {
    if (mode === this.mode) return;
    this.dispatchEvent(new CustomEvent('calendar-stats-view-mode-select', {
      detail: { mode },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    return html`
      <div class="segments" role="group">
        <button
          class="segment"
          aria-pressed=${this.mode === 'monthly'}
          @click=${() => this._select('monthly')}
        >${localize('view.monthly', this.lang)}</button>
        <button
          class="segment"
          aria-pressed=${this.mode === 'yearly'}
          @click=${() => this._select('yearly')}
        >${localize('view.yearly', this.lang)}</button>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-view-mode-toggle': ViewModeToggle;
  }
}
