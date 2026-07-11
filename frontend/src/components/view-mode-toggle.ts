import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localize } from '../localize/localize';
import type { ViewMode } from '../types/statistics';

const MODES: ViewMode[] = ['monthly', 'yearly'];

/**
 * View-mode selector for the floating bottom bar (FR-011): a compact dropdown
 * (trigger button + popover) instead of a segmented control, so the bar fits
 * portrait mobile screens.
 */
@customElement('calendar-stats-view-mode-toggle')
export class ViewModeToggle extends LitElement {
  @property({ type: String }) mode: ViewMode = 'monthly';
  @property({ type: String }) lang = 'en';

  @state() private _open = false;

  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      padding: 4px 0;
      position: relative;
    }
    button {
      background: none;
      border: none;
      cursor: pointer;
      color: var(--primary-text-color);
      line-height: 1;
    }
    .mode-toggle {
      /* Match the legend toggle's inherited font size (1em) in the bottom bar. */
      font-size: 1em;
      padding: 4px 10px;
      border-radius: 16px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: background-color 0.15s ease-in-out;
    }
    .mode-toggle:hover,
    .mode-toggle[aria-expanded='true'] {
      background-color: var(--secondary-background-color, rgba(0, 0, 0, 0.06));
    }
    .mode-toggle:focus-visible {
      outline: none;
      background-color: var(--secondary-background-color, rgba(0, 0, 0, 0.06));
    }
    .caret {
      font-size: 0.7em;
    }
    .mode-popover {
      position: absolute;
      bottom: 100%;
      left: 0;
      margin-bottom: 8px;
      min-width: 120px;
      padding: 4px;
      background: var(--ha-card-background, var(--card-background-color, white));
      border: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
      border-radius: 8px;
      box-shadow: 0px 2px 8px rgba(0, 0, 0, 0.24);
      z-index: 6;
      display: flex;
      flex-direction: column;
    }
    .mode-option {
      text-align: left;
      font-size: 0.9em;
      padding: 6px 8px;
      border-radius: 6px;
      width: 100%;
    }
    .mode-option:hover {
      background-color: var(--secondary-background-color, rgba(0, 0, 0, 0.06));
    }
    .mode-option.active {
      font-weight: bold;
      color: var(--primary-color);
    }
  `;

  private _toggleOpen(): void {
    if (this._open) this._close();
    else this._openPopover();
  }

  private _openPopover(): void {
    this._open = true;
    document.addEventListener('click', this._onDocClick);
  }

  private _close(): void {
    if (!this._open) return;
    this._open = false;
    document.removeEventListener('click', this._onDocClick);
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this._onDocClick);
  }

  private _onDocClick = (e: MouseEvent): void => {
    if (e.composedPath().includes(this)) return;
    this._close();
  };

  private _select(mode: ViewMode): void {
    this._close();
    if (mode === this.mode) return;
    this.dispatchEvent(new CustomEvent('calendar-stats-view-mode-select', {
      detail: { mode },
      bubbles: true,
      composed: true,
    }));
  }

  render() {
    return html`
      <button
        class="mode-toggle"
        aria-haspopup="true"
        aria-expanded=${this._open}
        @click=${this._toggleOpen}
      >${localize(`view.${this.mode}`, this.lang)}<span class="caret">▾</span></button>
      ${this._open
        ? html`<div class="mode-popover">
            ${MODES.map((m) => html`<button
              class="mode-option ${m === this.mode ? 'active' : ''}"
              @click=${() => this._select(m)}
            >${localize(`view.${m}`, this.lang)}</button>`)}
          </div>`
        : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-view-mode-toggle': ViewModeToggle;
  }
}
