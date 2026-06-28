export interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Parse a CSS color string into RGB. Supports #rgb, #rgba, #rrggbb, #rrggbbaa,
 * rgb(...) and rgba(...). Alpha is ignored. Returns null for anything else
 * (named colors, var(...), gradients, etc.) — those need browser resolution.
 */
export function parseRgb(input: string): Rgb | null {
  const str = input.trim();
  if (str === '') return null;

  if (str[0] === '#') {
    const hex = str.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      const r = parseInt(hex.charAt(0) + hex.charAt(0), 16);
      const g = parseInt(hex.charAt(1) + hex.charAt(1), 16);
      const b = parseInt(hex.charAt(2) + hex.charAt(2), 16);
      if ([r, g, b].some(Number.isNaN)) return null;
      return { r, g, b };
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      if ([r, g, b].some(Number.isNaN)) return null;
      return { r, g, b };
    }
    return null;
  }

  const m = str.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) {
    const r = Math.round(Number(m[1]));
    const g = Math.round(Number(m[2]));
    const b = Math.round(Number(m[3]));
    if ([r, g, b].some(Number.isNaN)) return null;
    return { r, g, b };
  }

  return null;
}

/** WCAG relative luminance of an sRGB color (0 = black, 1 = white). */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/**
 * Pick black or white text for the given background, whichever yields the
 * higher WCAG contrast ratio.
 */
export function contrastTextColor(bg: Rgb): '#000000' | '#ffffff' {
  const lum = relativeLuminance(bg);
  // Contrast vs white = 1.05 / (lum + 0.05); vs black = (lum + 0.05) / 0.05.
  const contrastWithBlack = (lum + 0.05) / 0.05;
  const contrastWithWhite = 1.05 / (lum + 0.05);
  return contrastWithBlack >= contrastWithWhite ? '#000000' : '#ffffff';
}

/**
 * Resolve any CSS color string to RGB. Uses a DOM probe so the browser can
 * compute named colors and var(...). Falls back to direct parsing (covers
 * plain hex and test environments that do not resolve to rgb()).
 */
export function resolveCssColor(input: string, probe: HTMLElement): Rgb | null {
  try {
    probe.style.color = '';
    probe.style.color = input;
    const computed = getComputedStyle(probe).color;
    const fromComputed = parseRgb(computed);
    if (fromComputed) return fromComputed;
  } catch {
    // getComputedStyle/probe unavailable — fall through to direct parse.
  }
  return parseRgb(input);
}

/**
 * Compute a readable (black/white) text color for the given background string,
 * or undefined when the background cannot be resolved to RGB.
 */
export function autoContrastText(bg: string, probe: HTMLElement): string | undefined {
  const rgb = resolveCssColor(bg, probe);
  return rgb ? contrastTextColor(rgb) : undefined;
}
