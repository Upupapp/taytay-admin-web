import type { ContrastRequirement } from './contrast';

/**
 * Machine-readable mirror of the colour tokens declared in
 * `src/styles.scss` and `src/styles/_brand-tokens.scss`, in both themes.
 *
 * This exists so the palette can be *audited by a test*. `brand-palette.spec.ts`
 * checks that every pair below meets its WCAG 2.2 AA threshold, and
 * `check:brand` that these values have not drifted from the stylesheets: the
 * light palette against `:root`, the dark one against `:root` with the
 * `theme-dark` mixin laid over it (DL-204).
 *
 * These are the application's colours. They are **not** claimed to be the
 * official colours of the Municipality of Taytay, and no Pantone/CMYK/spot
 * equivalence is asserted — see `DL-21`.
 */
export const BRAND_PALETTE = {
  // Surfaces (DL-200: the page wash's base colour, the solid card, the soft fill)
  bg: '#e7ecf7',
  surface: '#ffffff',
  surfaceMuted: '#f2f4f8',

  // Borders (decorative = the design's divider; interactive = a text field's edge)
  borderDecorative: '#eef1f6',
  borderInteractive: '#6b7489',

  // Ink
  ink: '#08124a',
  text: '#1b2540',
  text2: '#2b3550',
  textMuted: '#4f586c',
  textSubtle: '#4f586c',

  // Brand
  brandPrimary: '#0a2071',
  brandPrimaryHover: '#08124a',
  // A primary button's hover, which the design draws lighter than the button.
  primaryHover: '#3a63f0',
  brandPrimarySoft: '#ecf1fc',
  brandOnPrimary: '#ffffff',
  accent: '#5c4d00',
  // The brand's text colour: links, and the glyph on a soft brand tile. In
  // light it is the primary blue; in dark the primary is a fill (DL-204).
  link: '#0a2071',

  // A filled destructive control (the confirming button, the unread badge).
  dangerFill: '#b00708',
  dangerFillHover: '#7a0506',

  // Focus: a gold outline around a navy inner ring.
  focusRing: '#f5da18',
  focusRingInner: '#08124a',

  // Seal placeholder (deliberately not seal-like — see DL-22)
  sealPlaceholderBg: '#eceff2',
  sealPlaceholderFg: '#46525f',
  sealPlaceholderBorder: '#7d8894',
} as const;

export type BrandColourName = keyof typeof BRAND_PALETTE;

/**
 * The same names in the dark theme (`theme-dark` in styles.scss, DL-204).
 * `satisfies` keeps the two palettes to one set of names, so a colour added to
 * one cannot go unaudited in the other.
 */
export const BRAND_PALETTE_DARK = {
  bg: '#040a22',
  surface: '#0c1a4f',
  surfaceMuted: '#142257',

  borderDecorative: '#1f2c5d',
  borderInteractive: '#7884aa',

  ink: '#ffffff',
  text: '#e6ebf7',
  text2: '#c9d2e8',
  textMuted: '#a4b0cc',
  textSubtle: '#a4b0cc',

  brandPrimary: '#2c51d9',
  brandPrimaryHover: '#0a2071',
  primaryHover: '#3a63f0',
  brandPrimarySoft: '#1a2d6f',
  brandOnPrimary: '#ffffff',
  accent: '#f5da18',
  link: '#9db6ff',

  dangerFill: '#e0090a',
  dangerFillHover: '#b00708',

  // Gold outline, and a blue inner ring that shows on the dark surfaces.
  focusRing: '#f5da18',
  focusRingInner: '#4169f2',

  // The placeholder is not recoloured for the dark theme (DL-199, DL-22).
  sealPlaceholderBg: '#eceff2',
  sealPlaceholderFg: '#46525f',
  sealPlaceholderBorder: '#7d8894',
} as const satisfies Record<BrandColourName, string>;

export type Theme = 'light' | 'dark';

export type BrandPalette = Readonly<Record<BrandColourName, string>>;

/** The palette of each theme, by name. */
export const THEME_PALETTES: Readonly<Record<Theme, BrandPalette>> = {
  light: BRAND_PALETTE,
  dark: BRAND_PALETTE_DARK,
};

/** Status-tone pairs, consumed by `StatusBadge`. Foreground carries the label. */
export const TONE_PALETTE = {
  neutral: { fg: '#2b3550', bg: '#f0f2f7' },
  info: { fg: '#0a2071', bg: '#e2e7fb' },
  progress: { fg: '#6b3fa0', bg: '#efe7fb' },
  success: { fg: '#17663a', bg: '#def0e5' },
  warning: { fg: '#5c4d00', bg: '#fcf5be' },
  danger: { fg: '#b00708', bg: '#fbe2e2' },
} as const;

export type ToneName = keyof typeof TONE_PALETTE;

export type TonePalette = Readonly<Record<ToneName, { readonly fg: string; readonly bg: string }>>;

/** The dark theme's tones: its tints over the solid dark card, with its inks. */
export const TONE_PALETTE_DARK = {
  neutral: { fg: '#c9d2e8', bg: '#1f2c5d' },
  info: { fg: '#9db6ff', bg: '#1a2d6f' },
  progress: { fg: '#d4bcf5', bg: '#2b2c6d' },
  success: { fg: '#6ee7a0', bg: '#123251' },
  warning: { fg: '#f5da18', bg: '#2d3547' },
  danger: { fg: '#ff8a8a', bg: '#321743' },
} as const satisfies TonePalette;

export const THEME_TONES: Readonly<Record<Theme, TonePalette>> = {
  light: TONE_PALETTE,
  dark: TONE_PALETTE_DARK,
};

export interface AuditedPair {
  readonly theme: Theme;
  readonly label: string;
  readonly foreground: string;
  readonly background: string;
  readonly requirement: ContrastRequirement;
}

/**
 * Every text and non-text combination the application actually renders, in
 * one theme. Built once and called for each, so a pair audited for light is
 * audited for dark by construction.
 *
 * Adding a colour pairing to a component without adding it here is how a
 * palette silently stops conforming — the audit is only as good as this list.
 */
function auditedPairsFor(theme: Theme, palette: BrandPalette, tones: TonePalette): AuditedPair[] {
  const pair = (
    label: string,
    foreground: string,
    background: string,
    requirement: ContrastRequirement,
  ): AuditedPair => ({ theme, label: `${theme}: ${label}`, foreground, background, requirement });

  const surfaces: readonly (readonly [string, string])[] = [
    ['surface', palette.surface],
    ['page background', palette.bg],
    ['muted surface', palette.surfaceMuted],
  ];

  return [
    // Body ink on each surface.
    ...surfaces.flatMap(([surfaceName, background]): AuditedPair[] =>
      (['ink', 'text', 'text2', 'textMuted', 'textSubtle'] as const).map((ink) =>
        pair(`${ink} on ${surfaceName}`, palette[ink], background, 'text'),
      ),
    ),

    // Links and emphasis on each surface. The brand's text is `link` (the
    // primary blue in light; the primary is a fill in dark, DL-204).
    ...surfaces.flatMap(([surfaceName, background]): AuditedPair[] => [
      pair(`brand link on ${surfaceName}`, palette.link, background, 'text'),
      pair(`accent on ${surfaceName}`, palette.accent, background, 'text'),
    ]),

    // Text on brand fills (primary buttons, the current page in the navigation).
    pair('on-primary text on brand primary', palette.brandOnPrimary, palette.brandPrimary, 'text'),
    pair(
      'on-primary text on brand hover',
      palette.brandOnPrimary,
      palette.brandPrimaryHover,
      'text',
    ),
    pair(
      'on-primary text on a primary button under the pointer',
      palette.brandOnPrimary,
      palette.primaryHover,
      'text',
    ),
    // The design's gold on the primary fill: the account initials in the sidebar
    // and the current page's icon in the navigation. Held to the text threshold.
    pair(
      'gold on brand primary (sidebar initials, current-page icon)',
      palette.focusRing,
      palette.brandPrimary,
      'text',
    ),
    // The glyph on a soft brand tile (empty states, avatars, the file button).
    pair('brand text on brand soft', palette.link, palette.brandPrimarySoft, 'text'),

    // White on a filled destructive control.
    pair('on-primary text on the danger fill', palette.brandOnPrimary, palette.dangerFill, 'text'),
    pair(
      'on-primary text on the danger fill under the pointer',
      palette.brandOnPrimary,
      palette.dangerFillHover,
      'text',
    ),

    // Status badge labels. The label — not the tint — carries the meaning.
    ...(Object.entries(tones) as readonly (readonly [ToneName, { fg: string; bg: string }])[]).map(
      ([tone, { fg, bg }]): AuditedPair => pair(`${tone} badge label on its tint`, fg, bg, 'text'),
    ),

    // Non-text: control boundaries and the focus ring (WCAG 1.4.11).
    ...surfaces.map(([surfaceName, background]): AuditedPair =>
      pair(
        `interactive border on ${surfaceName}`,
        palette.borderInteractive,
        background,
        'nonText',
      ),
    ),
    // The focus ring is two rings (DL-200). The inner ring carries it on every
    // surface; the gold outline carries it on the brand fills, where the inner
    // ring may disappear; and the two must stay distinct from each other.
    ...surfaces.map(([surfaceName, background]): AuditedPair =>
      pair(`focus ring (inner) on ${surfaceName}`, palette.focusRingInner, background, 'nonText'),
    ),
    ...(
      [
        ['brand primary', palette.brandPrimary],
        ['brand hover', palette.brandPrimaryHover],
        ['its inner ring', palette.focusRingInner],
      ] as const
    ).map(([fillName, background]): AuditedPair =>
      pair(`focus ring (outline) against ${fillName}`, palette.focusRing, background, 'nonText'),
    ),

    // Seal placeholder must read as a real boundary, not a ghost.
    pair(
      'seal placeholder border on surface',
      palette.sealPlaceholderBorder,
      palette.surface,
      'nonText',
    ),
    pair(
      'seal placeholder monogram on its background',
      palette.sealPlaceholderFg,
      palette.sealPlaceholderBg,
      'text',
    ),
  ];
}

/** The audited pairs of both themes: the same list, measured in each. */
export const AUDITED_PAIRS: readonly AuditedPair[] = (['light', 'dark'] as const).flatMap((theme) =>
  auditedPairsFor(theme, THEME_PALETTES[theme], THEME_TONES[theme]),
);

/**
 * Colours deliberately **exempt** from a contrast threshold, with the reason.
 *
 * Recording exemptions explicitly is what stops "it fails but that's fine"
 * from becoming folklore. Each entry names the WCAG clause relied on.
 */
export const DOCUMENTED_EXEMPTIONS: readonly { readonly label: string; readonly reason: string }[] =
  [
    {
      label: 'status badge tint against the surface behind it',
      reason:
        'WCAG 1.4.11 covers information *required to identify* a component or state. ' +
        'StatusBadge always renders the status label as text, and the dot is aria-hidden, ' +
        'so the tint is supplementary and carries no meaning on its own.',
    },
    {
      label: 'decorative rules (--divider, --line, --line2) against surfaces',
      reason:
        'Table rules, hairlines and card edges are decoration. They do not identify a control ' +
        'or convey state, so no 1.4.11 threshold applies. Control boundaries use ' +
        '--field-line, which is audited at 3:1.',
    },
    {
      label: 'the official municipal seal',
      reason:
        'WCAG 1.4.3 exempts logotypes: "Text that is part of a logo or brand name has no ' +
        'contrast requirement." The seal is also never recoloured, so its contrast is not ' +
        "this application's to adjust. See DL-22.",
    },
  ];
