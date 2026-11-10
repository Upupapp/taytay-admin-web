import type { ContrastRequirement } from './contrast';

/**
 * Machine-readable mirror of the colour tokens declared in
 * `src/styles.scss` and `src/styles/_brand-tokens.scss`.
 *
 * This exists so the palette can be *audited by a test*. `brand-palette.spec.ts`
 * checks two things: that every pair below meets its WCAG 2.2 AA threshold, and
 * that these values have not drifted from the stylesheets.
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

  // Borders
  borderDecorative: '#e1e6f0',
  borderInteractive: '#7a8399',

  // Ink
  ink: '#08124a',
  text: '#1b2540',
  text2: '#2b3550',
  textMuted: '#5a6478',
  textSubtle: '#5e687c',

  // Brand
  brandPrimary: '#0a2071',
  brandPrimaryHover: '#08124a',
  // A primary button's hover, which the design draws lighter than the button.
  primaryHover: '#3a63f0',
  brandPrimarySoft: '#ecf1fc',
  brandOnPrimary: '#ffffff',
  accent: '#5c4d00',

  // Focus: a gold outline around a navy inner ring.
  focusRing: '#f5da18',
  focusRingInner: '#08124a',

  // Seal placeholder (deliberately not seal-like — see DL-22)
  sealPlaceholderBg: '#eceff2',
  sealPlaceholderFg: '#46525f',
  sealPlaceholderBorder: '#7d8894',
} as const;

export type BrandColourName = keyof typeof BRAND_PALETTE;

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

export interface AuditedPair {
  readonly label: string;
  readonly foreground: string;
  readonly background: string;
  readonly requirement: ContrastRequirement;
}

const SURFACES: readonly (readonly [string, string])[] = [
  ['surface', BRAND_PALETTE.surface],
  ['page background', BRAND_PALETTE.bg],
  ['muted surface', BRAND_PALETTE.surfaceMuted],
];

/**
 * Every text and non-text combination the application actually renders.
 *
 * Adding a colour pairing to a component without adding it here is how a
 * palette silently stops conforming — the audit is only as good as this list.
 */
export const AUDITED_PAIRS: readonly AuditedPair[] = [
  // Body ink on each surface.
  ...SURFACES.flatMap(([surfaceName, background]): AuditedPair[] =>
    (['ink', 'text', 'text2', 'textMuted', 'textSubtle'] as const).map((ink) => ({
      label: `${ink} on ${surfaceName}`,
      foreground: BRAND_PALETTE[ink],
      background,
      requirement: 'text' as const,
    })),
  ),

  // Links and emphasis on each surface.
  ...SURFACES.flatMap(([surfaceName, background]): AuditedPair[] => [
    {
      label: `brand link on ${surfaceName}`,
      foreground: BRAND_PALETTE.brandPrimary,
      background,
      requirement: 'text',
    },
    {
      label: `accent on ${surfaceName}`,
      foreground: BRAND_PALETTE.accent,
      background,
      requirement: 'text',
    },
  ]),

  // Text on brand fills (primary buttons, the current page in the navigation).
  {
    label: 'on-primary text on brand primary',
    foreground: BRAND_PALETTE.brandOnPrimary,
    background: BRAND_PALETTE.brandPrimary,
    requirement: 'text',
  },
  {
    label: 'on-primary text on brand hover',
    foreground: BRAND_PALETTE.brandOnPrimary,
    background: BRAND_PALETTE.brandPrimaryHover,
    requirement: 'text',
  },
  {
    label: 'on-primary text on a primary button under the pointer',
    foreground: BRAND_PALETTE.brandOnPrimary,
    background: BRAND_PALETTE.primaryHover,
    requirement: 'text',
  },
  // The design's gold on the primary fill: the account initials in the sidebar
  // and the current page's icon in the navigation. Held to the text threshold.
  {
    label: 'gold on brand primary (sidebar initials, current-page icon)',
    foreground: BRAND_PALETTE.focusRing,
    background: BRAND_PALETTE.brandPrimary,
    requirement: 'text',
  },
  {
    label: 'brand text on brand soft',
    foreground: BRAND_PALETTE.brandPrimaryHover,
    background: BRAND_PALETTE.brandPrimarySoft,
    requirement: 'text',
  },

  // Status badge labels. The label — not the tint — carries the meaning.
  ...(
    Object.entries(TONE_PALETTE) as readonly (readonly [ToneName, { fg: string; bg: string }])[]
  ).map(([tone, pair]): AuditedPair => ({
    label: `${tone} badge label on its tint`,
    foreground: pair.fg,
    background: pair.bg,
    requirement: 'text',
  })),

  // Non-text: control boundaries and the focus ring (WCAG 1.4.11).
  ...SURFACES.map(([surfaceName, background]): AuditedPair => ({
    label: `interactive border on ${surfaceName}`,
    foreground: BRAND_PALETTE.borderInteractive,
    background,
    requirement: 'nonText',
  })),
  // The focus ring is two rings (DL-200). The navy inner ring carries it on
  // every light surface; the gold outline carries it on the navy fills, where
  // the inner ring disappears; and the two must stay distinct from each other.
  ...SURFACES.map(([surfaceName, background]): AuditedPair => ({
    label: `focus ring (inner) on ${surfaceName}`,
    foreground: BRAND_PALETTE.focusRingInner,
    background,
    requirement: 'nonText',
  })),
  ...(
    [
      ['brand primary', BRAND_PALETTE.brandPrimary],
      ['brand hover', BRAND_PALETTE.brandPrimaryHover],
      ['its inner ring', BRAND_PALETTE.focusRingInner],
    ] as const
  ).map(([fillName, background]): AuditedPair => ({
    label: `focus ring (outline) against ${fillName}`,
    foreground: BRAND_PALETTE.focusRing,
    background,
    requirement: 'nonText',
  })),

  // Seal placeholder must read as a real boundary, not a ghost.
  {
    label: 'seal placeholder border on surface',
    foreground: BRAND_PALETTE.sealPlaceholderBorder,
    background: BRAND_PALETTE.surface,
    requirement: 'nonText',
  },
  {
    label: 'seal placeholder monogram on its background',
    foreground: BRAND_PALETTE.sealPlaceholderFg,
    background: BRAND_PALETTE.sealPlaceholderBg,
    requirement: 'text',
  },
];

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
      label: 'decorative border (--c-border) against surfaces',
      reason:
        'Table rules and card edges are decoration. They do not identify a control or ' +
        'convey state, so no 1.4.11 threshold applies. Control boundaries use ' +
        '--c-border-strong, which is audited at 3:1.',
    },
    {
      label: 'the official municipal seal',
      reason:
        'WCAG 1.4.3 exempts logotypes: "Text that is part of a logo or brand name has no ' +
        'contrast requirement." The seal is also never recoloured, so its contrast is not ' +
        "this application's to adjust. See DL-22.",
    },
  ];
