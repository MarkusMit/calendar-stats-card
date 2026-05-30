import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localize } from '../localize/localize';

@customElement('calendar-stats-loading-overlay')
export class LoadingOverlay extends LitElement {
  @property({ type: Boolean }) visible = false;
  @property({ type: String }) lang = 'en';

  static styles = css`
    :host {
      display: block;
    }
    .overlay {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: rgba(var(--card-background-color, 255, 255, 255), 0.8);
    }
    .spinner {
      width: 24px;
      height: 24px;
      border: 3px solid var(--divider-color, #ccc);
      border-top-color: var(--primary-text-color, #333);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;

  render() {
    if (!this.visible) {
      return html`<div class="overlay" hidden></div>`;
    }
    return html`
      <div class="overlay" aria-label=${localize('card.loading', this.lang)}>
        <div class="spinner"></div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'calendar-stats-loading-overlay': LoadingOverlay;
  }
}
