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
  // Surfaces
  bg: '#f4f6f8',
  surface: '#ffffff',
  surfaceMuted: '#f8fafc',

  // Borders
  borderDecorative: '#dfe4ea',
  borderInteractive: '#7d8894',

  // Ink
  text: '#1b2733',
  textMuted: '#5b6b7c',
  textSubtle: '#606b78',

  // Brand
  brandPrimary: '#10559a',
  brandPrimaryHover: '#0b3f74',
  brandPrimarySoft: '#e8f0f9',
  brandOnPrimary: '#ffffff',
  accent: '#b45309',

  // Sidebar ink, used on the brand-hover fill.
  sidebarInk: '#dce8f4',
  sidebarInkMuted: '#a9c3dc',
  sidebarSectionTitle: '#8fb0cf',

  // Seal placeholder (deliberately not seal-like — see DL-22)
  sealPlaceholderBg: '#eceff2',
  sealPlaceholderFg: '#46525f',
  sealPlaceholderBorder: '#7d8894',
} as const;

export type BrandColourName = keyof typeof BRAND_PALETTE;

/** Status-tone pairs, consumed by `StatusBadge`. Foreground carries the label. */
export const TONE_PALETTE = {
  neutral: { fg: '#46525f', bg: '#eceff2' },
  info: { fg: '#0b4f8a', bg: '#e2eefb' },
  progress: { fg: '#6b3fa0', bg: '#efe7fb' },
  success: { fg: '#1a6b3c', bg: '#e2f4e9' },
  warning: { fg: '#8a5a06', bg: '#fcf1dc' },
  danger: { fg: '#98231d', bg: '#fbe6e4' },
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
    (['text', 'textMuted', 'textSubtle'] as const).map((ink) => ({
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

  // Text on brand fills (primary buttons, sidebar).
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
    label: 'brand text on brand soft',
    foreground: BRAND_PALETTE.brandPrimaryHover,
    background: BRAND_PALETTE.brandPrimarySoft,
    requirement: 'text',
  },

  // Sidebar. Every ink used on the dark fill, including the small section
  // headings that are easiest to get wrong.
  ...(['sidebarInk', 'sidebarInkMuted', 'sidebarSectionTitle'] as const).map(
    (ink): AuditedPair => ({
      label: `${ink} on sidebar fill`,
      foreground: BRAND_PALETTE[ink],
      background: BRAND_PALETTE.brandPrimaryHover,
      requirement: 'text',
    }),
  ),

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
  ...SURFACES.map(([surfaceName, background]): AuditedPair => ({
    label: `focus ring on ${surfaceName}`,
    foreground: BRAND_PALETTE.brandPrimary,
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
