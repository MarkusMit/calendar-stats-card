// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  parseRgb,
  relativeLuminance,
  contrastTextColor,
  resolveCssColor,
  autoContrastText,
} from '../../../src/services/readable-text';

describe('parseRgb', () => {
  it('parses 6-digit hex', () => {
    expect(parseRgb('#cce8f5')).toEqual({ r: 204, g: 232, b: 245 });
  });

  it('parses 3-digit hex', () => {
    expect(parseRgb('#fff')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('parses 8-digit hex (ignores alpha)', () => {
    expect(parseRgb('#8b000080')).toEqual({ r: 139, g: 0, b: 0 });
  });

  it('parses rgb()', () => {
    expect(parseRgb('rgb(204, 232, 245)')).toEqual({ r: 204, g: 232, b: 245 });
  });

  it('parses rgba() (ignores alpha)', () => {
    expect(parseRgb('rgba(0, 0, 0, 0.5)')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('returns null for var()', () => {
    expect(parseRgb('var(--my-color)')).toBeNull();
  });

  it('resolves CSS named colors', () => {
    expect(parseRgb('orange')).toEqual({ r: 255, g: 165, b: 0 });
    expect(parseRgb('lightblue')).toEqual({ r: 173, g: 216, b: 230 });
    expect(parseRgb('LightYellow')).toEqual({ r: 255, g: 255, b: 224 }); // case-insensitive
    expect(parseRgb('darkred')).toEqual({ r: 139, g: 0, b: 0 });
    expect(parseRgb('white')).toEqual({ r: 255, g: 255, b: 255 });
    expect(parseRgb('transparent')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('returns null for unknown names and garbage', () => {
    expect(parseRgb('notacolor')).toBeNull();
    expect(parseRgb('')).toBeNull();
    expect(parseRgb('#12')).toBeNull();
  });
});

describe('relativeLuminance', () => {
  it('black → 0', () => {
    expect(relativeLuminance({ r: 0, g: 0, b: 0 })).toBeCloseTo(0, 5);
  });

  it('white → 1', () => {
    expect(relativeLuminance({ r: 255, g: 255, b: 255 })).toBeCloseTo(1, 5);
  });

  it('light bg has high luminance', () => {
    expect(relativeLuminance({ r: 204, g: 232, b: 245 })).toBeGreaterThan(0.5);
  });
});

describe('contrastTextColor', () => {
  it('light/mid backgrounds → black text', () => {
    expect(contrastTextColor({ r: 204, g: 232, b: 245 })).toBe('#000000'); // light blue
    expect(contrastTextColor({ r: 245, g: 240, b: 200 })).toBe('#000000'); // light yellow
    expect(contrastTextColor({ r: 255, g: 165, b: 0 })).toBe('#000000');   // orange
    expect(contrastTextColor({ r: 255, g: 69, b: 0 })).toBe('#000000');    // orangered (WCAG favors black)
  });

  it('dark backgrounds → white text', () => {
    expect(contrastTextColor({ r: 139, g: 0, b: 0 })).toBe('#ffffff');  // dark red
    expect(contrastTextColor({ r: 28, g: 28, b: 28 })).toBe('#ffffff'); // near-black
    expect(contrastTextColor({ r: 0, g: 0, b: 139 })).toBe('#ffffff');  // dark blue
  });
});

describe('resolveCssColor', () => {
  it('resolves hex via parseRgb fallback (no DOM resolution needed)', () => {
    const probe = document.createElement('span');
    expect(resolveCssColor('#cce8f5', probe)).toEqual({ r: 204, g: 232, b: 245 });
  });

  it('returns null when neither computed style nor input parse to rgb', () => {
    const probe = document.createElement('span');
    // happy-dom does not resolve var()/named to rgb → unresolvable
    expect(resolveCssColor('var(--x)', probe)).toBeNull();
  });
});

describe('autoContrastText', () => {
  it('light hex bg → black text', () => {
    const probe = document.createElement('span');
    expect(autoContrastText('#cce8f5', probe)).toBe('#000000');
  });

  it('dark hex bg → white text', () => {
    const probe = document.createElement('span');
    expect(autoContrastText('#8b0000', probe)).toBe('#ffffff');
  });

  it('named light bg → black text (no DOM resolution needed)', () => {
    const probe = document.createElement('span');
    expect(autoContrastText('lightblue', probe)).toBe('#000000');
    expect(autoContrastText('lightyellow', probe)).toBe('#000000');
  });

  it('named dark bg → white text', () => {
    const probe = document.createElement('span');
    expect(autoContrastText('darkred', probe)).toBe('#ffffff');
    expect(autoContrastText('navy', probe)).toBe('#ffffff');
  });

  it('unresolvable color → undefined', () => {
    const probe = document.createElement('span');
    expect(autoContrastText('var(--x)', probe)).toBeUndefined();
  });
});
