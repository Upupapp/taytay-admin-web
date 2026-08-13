/**
 * User-facing copy for the brand surface.
 *
 * This file establishes the convention chosen in `DL-23`: **every user-facing
 * string lives in a typed `*.copy.ts` module beside the code it serves, never
 * inline in a template.** Two reasons:
 *
 * 1. Localisation. Angular's official path is `@angular/localize`, whose
 *    `$localize` tagged template works on string literals in TypeScript. When
 *    localisation is switched on, the literals below become
 *    ``$localize`Municipal seal` `` and nothing else moves. Call sites do not
 *    change.
 * 2. Review. Copy about provenance and officiality is a correctness concern,
 *    not decoration. Keeping it in one small file means it can be read and
 *    approved without hunting through templates.
 *
 * Privacy by default: no string here is personalised, and none is ever sent to
 * a third party for translation at runtime.
 */
export const BRAND_COPY = {
  /** Alt text when the genuine seal is displayed. */
  sealAlt: 'Official Seal of the Municipality of Taytay, Rizal',

  /**
   * Accessible name for the placeholder. It must not imply officiality — a
   * screen-reader user has to learn the same thing a sighted user learns from
   * the neutral styling: this is a stand-in.
   */
  sealPlaceholderLabel: 'Municipal seal not available',
  sealPlaceholderTooltip:
    'The official seal has not been supplied to this application. A neutral placeholder is shown in its place.',

  /** Wordmark, used in the shell and on the sign-in screen. */
  organisationName: 'Taytay Social Welfare',
  organisationUnit: 'Municipal Social Welfare and Development Office',
  municipality: 'Taytay, Rizal',

  /** Generic image states, used by `AppImage`. */
  imageLoading: 'Loading image',
  imageUnavailable: 'Image unavailable',
} as const;

export type BrandCopyKey = keyof typeof BRAND_COPY;
