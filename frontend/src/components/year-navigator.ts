import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localize } from '../localize/localize';

@customElement('year-navigator')
export class YearNavigator extends LitElement {
  @property({ type: Number }) year = new Date().getFullYear();
  @property({ type: Boolean }) atCurrentYear = false;
  @property({ type: Boolean }) atEarliestYear = false;
  @property({ type: String }) lang = 'en';

  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 4px 0;
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
    .year-label {
      min-width: 4ch;
      text-align: center;
      font-weight: bold;
      color: var(--primary-text-color);
    }
  `;

  private _onPrev() {
    this.dispatchEvent(new CustomEvent('tabularizer-prev-year', { bubbles: true, composed: true }));
  }

  private _onNext() {
    this.dispatchEvent(new CustomEvent('tabularizer-next-year', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <button class="prev" ?disabled=${this.atEarliestYear} @click=${this._onPrev}
        aria-label=${localize('nav.previous_year', this.lang)}>‹</button>
      <span class="year-label">${this.year}</span>
      <button class="next" ?disabled=${this.atCurrentYear} @click=${this._onNext}
        aria-label=${localize('nav.next_year', this.lang)}>›</button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'year-navigator': YearNavigator;
  }
}
