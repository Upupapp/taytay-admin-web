/**
 * WCAG contrast maths.
 *
 * Implements the relative-luminance and contrast-ratio definitions from
 * WCAG 2.2 (W3C Recommendation, 12 December 2024) so that the brand palette can
 * be *audited by a test* rather than eyeballed. See `DL-20` for the conformance
 * target and `DL-21` for the palette decision.
 */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Parses `#rgb` or `#rrggbb`. Throws on anything else — tokens must be literal hex. */
export function parseHex(hex: string): Rgb {
  const value = hex.trim().replace(/^#/, '');
  const expanded =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;

  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) {
    throw new Error(`Not a hex colour: "${hex}"`);
  }

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

/**
 * WCAG relative luminance.
 * https://www.w3.org/TR/WCAG22/#dfn-relative-luminance
 */
export function relativeLuminance(colour: Rgb): number {
  const channel = (raw: number): number => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(colour.r) + 0.7152 * channel(colour.g) + 0.0722 * channel(colour.b);
}

/**
 * WCAG contrast ratio, always >= 1. Order of arguments does not matter.
 * https://www.w3.org/TR/WCAG22/#dfn-contrast-ratio
 */
export function contrastRatio(a: string, b: string): number {
  const first = relativeLuminance(parseHex(a));
  const second = relativeLuminance(parseHex(b));
  const lighter = Math.max(first, second);
  const darker = Math.min(first, second);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Rounded to 2dp, for readable assertion messages. */
export function contrastRatioRounded(a: string, b: string): number {
  return Math.round(contrastRatio(a, b) * 100) / 100;
}

/**
 * WCAG 2.2 AA thresholds.
 *
 * 1.4.3 Contrast (Minimum), Level AA — 4.5:1 for text, 3:1 for large-scale text
 *   (>= 18pt, or >= 14pt bold).
 * 1.4.11 Non-text Contrast, Level AA — 3:1 for user-interface components and
 *   for graphical objects required to understand the content.
 *
 * Note the standard's own exemption: *logotypes* have no contrast requirement.
 * That is why the municipal seal is audited for correct rendering but not for
 * contrast — see `DL-22`.
 */
export const WCAG_AA = {
  text: 4.5,
  largeText: 3,
  nonText: 3,
} as const;

export type ContrastRequirement = keyof typeof WCAG_AA;

export function meetsAa(
  foreground: string,
  background: string,
  requirement: ContrastRequirement = 'text',
): boolean {
  return contrastRatio(foreground, background) >= WCAG_AA[requirement];
}
