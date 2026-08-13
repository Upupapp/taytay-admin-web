import { AUDITED_PAIRS, BRAND_PALETTE, DOCUMENTED_EXEMPTIONS, TONE_PALETTE } from './brand-palette';
import {
  contrastRatio,
  contrastRatioRounded,
  meetsAa,
  parseHex,
  relativeLuminance,
  WCAG_AA,
} from './contrast';

describe('WCAG contrast maths', () => {
  it('matches the reference extremes', () => {
    // Black on white is the maximum possible ratio, 21:1.
    expect(contrastRatioRounded('#000000', '#ffffff')).toBe(21);
    // A colour against itself is 1:1.
    expect(contrastRatioRounded('#10559a', '#10559a')).toBe(1);
  });

  it('is symmetric', () => {
    expect(contrastRatio('#1b2733', '#ffffff')).toBeCloseTo(
      contrastRatio('#ffffff', '#1b2733'),
      10,
    );
  });

  it('computes relative luminance at the endpoints', () => {
    expect(relativeLuminance(parseHex('#000000'))).toBeCloseTo(0, 10);
    expect(relativeLuminance(parseHex('#ffffff'))).toBeCloseTo(1, 10);
  });

  it('expands three-digit hex', () => {
    expect(parseHex('#fff')).toEqual(parseHex('#ffffff'));
  });

  it('rejects anything that is not hex, rather than guessing', () => {
    expect(() => parseHex('rebeccapurple')).toThrow(/Not a hex colour/);
    expect(() => parseHex('#12345')).toThrow(/Not a hex colour/);
  });

  it('applies the documented AA thresholds', () => {
    expect(WCAG_AA.text).toBe(4.5);
    expect(WCAG_AA.largeText).toBe(3);
    expect(WCAG_AA.nonText).toBe(3);
  });
});

describe('brand palette conforms to WCAG 2.2 Level AA', () => {
  it('audits at least one pair for every surface and every tone', () => {
    // Guards against the audit quietly shrinking to nothing.
    expect(AUDITED_PAIRS.length).toBeGreaterThanOrEqual(25);
  });

  it.each(AUDITED_PAIRS.map((pair) => [pair.label, pair] as const))('%s', (_label, pair) => {
    const ratio = contrastRatioRounded(pair.foreground, pair.background);
    const required = WCAG_AA[pair.requirement];

    expect(
      ratio,
      `${pair.label}: ${pair.foreground} on ${pair.background} is ${ratio}:1, ` +
        `below the WCAG AA ${pair.requirement} threshold of ${required}:1`,
    ).toBeGreaterThanOrEqual(required);
  });

  it('keeps every status tone legible', () => {
    for (const [tone, pair] of Object.entries(TONE_PALETTE)) {
      expect(meetsAa(pair.fg, pair.bg, 'text'), `${tone} label`).toBe(true);
    }
  });

  it('records a reason for every deliberate exemption', () => {
    expect(DOCUMENTED_EXEMPTIONS.length).toBeGreaterThan(0);
    for (const exemption of DOCUMENTED_EXEMPTIONS) {
      expect(exemption.reason.length).toBeGreaterThan(40);
    }
  });
});

describe('palette regressions caught in TAB 03', () => {
  // These two values shipped in TAB 01 and did not conform. The assertions
  // below fail if anyone reinstates them. See DL-21.
  it('does not reinstate the old subtle ink, which was 3.62:1 on white', () => {
    expect(BRAND_PALETTE.textSubtle).not.toBe('#7b8896');
    expect(contrastRatio('#7b8896', BRAND_PALETTE.surface)).toBeLessThan(WCAG_AA.text);
    expect(meetsAa(BRAND_PALETTE.textSubtle, BRAND_PALETTE.surface, 'text')).toBe(true);
  });

  it('does not reinstate the old control border, which was 1.62:1 on white', () => {
    expect(BRAND_PALETTE.borderInteractive).not.toBe('#c3ccd6');
    expect(contrastRatio('#c3ccd6', BRAND_PALETTE.surface)).toBeLessThan(WCAG_AA.nonText);
    expect(meetsAa(BRAND_PALETTE.borderInteractive, BRAND_PALETTE.surface, 'nonText')).toBe(true);
  });
});
