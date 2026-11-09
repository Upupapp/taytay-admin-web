/**
 * Brand asset manifest.
 *
 * The single register of every image this application treats as official or
 * semi-official identity. Components read the manifest instead of hard-coding
 * a path, so an asset that has not been lawfully acquired cannot accidentally
 * be rendered as though it had.
 *
 * The rule this file exists to enforce: **an asset is rendered only when its
 * provenance is `vendored`.** Anything else falls back to a neutral,
 * visibly-unofficial placeholder. See `DL-22` and `DL-199`.
 */

export type AssetKind = 'seal' | 'wordmark' | 'monogram' | 'icon';

export type AssetProvenance =
  /** Present in this repository, with a recorded source and permission basis. */
  | 'vendored'
  /** Drawn by this project. Owned by the project, never claimed to be official. */
  | 'generated'
  /** Known to exist, deliberately not copied. `evidence` says why. */
  | 'not-acquired';

/** How the asset may be treated at render time. */
export type AlterationPolicy =
  /** Uniform scaling only. No recolour, crop, rotation, filter or overlay. */
  | 'scale-only'
  /** Project-owned artwork that may be restyled freely. */
  | 'unrestricted';

export interface AssetDimensions {
  readonly width: number;
  readonly height: number;
}

export interface BrandAsset {
  readonly id: string;
  readonly kind: AssetKind;
  readonly title: string;
  readonly provenance: AssetProvenance;
  /** Origin of the file, or of the *claim* when not acquired. */
  readonly source: string | null;
  /** IANA media type of the vendored file. */
  readonly mediaType: string | null;
  /**
   * Intrinsic pixel dimensions. Required for anything vendored: width and
   * height must be known up front so the box is reserved and the image cannot
   * shift layout when it loads.
   */
  readonly dimensions: AssetDimensions | null;
  /** Path served from `public/`, or `null` when nothing is vendored. */
  readonly optimizedPath: string | null;
  /**
   * Attribution text to display or record. `null` means *no attribution text
   * has been supplied by the rights holder* — it does not mean "none required".
   */
  readonly attribution: string | null;
  readonly alterationPolicy: AlterationPolicy;
  /** Why this entry says what it says. Every claim here must be checkable. */
  readonly evidence: readonly string[];
}

/**
 * The municipal seal.
 *
 * Vendored on the project owner's instruction (10 November 2026, `DL-199`,
 * superseding `DL-22`'s refusal): the same file the project's public website
 * shows, copied byte for byte, and the same artwork the residents' app already
 * ships as its registered seal. One seal across the website, the app and this
 * console, so a resident and an officer see the same mark.
 *
 * What is still open is said in `evidence` rather than smoothed over: the
 * Municipality's written permission is not on file in this repository, and no
 * attribution text has been supplied, so none is shown (`attribution: null`
 * means "none supplied", not "none required").
 */
const MUNICIPAL_SEAL: BrandAsset = {
  id: 'municipal-seal',
  kind: 'seal',
  title: 'Official Seal of the Municipality of Taytay, Rizal',
  provenance: 'vendored',
  source:
    'Upupapp/taytay-website, commit 8df0f54, taytay-rizal-website/assets/images/taytay-seal.png — copied byte for byte on 2026-11-10 on the project owner’s instruction.',
  mediaType: 'image/png',
  dimensions: { width: 360, height: 360 },
  optimizedPath: 'brand/taytay-seal.png',
  attribution: null,
  alterationPolicy: 'scale-only',
  evidence: [
    'File: public/brand/taytay-seal.png, PNG with an alpha channel (transparent corners), 360 × 360 px, 169,289 bytes, SHA-256 2fbd93b1c49993dbee7e75bfcef841700f128b9315b4e43c18e750707c80f2b9 — identical to the website’s file.',
    'Same artwork as the residents’ app’s registered seal (taytay-mobile-app assets/brand/taytay_seal.png, 560 px), recorded there as the S0 design source supplied as the official Municipality of Taytay seal; compared by eye on 2026-11-10, no difference but size and margin.',
    'Not recompressed, cropped, padded or recoloured; drawn with object-fit: contain at 32, 48, 96 or 160 px. At 2× density the largest box asks for 320 px, which the 360 px file covers.',
    'The Municipality’s written permission is not on file in this repository; it is an open item in docs/turnover/known-limitations-and-open-items.md.',
    'RA 8293 §176.1 (https://lawphil.net/statutes/repacts/ra1997/ra_8293_1997.html) removes copyright from government works; it is not itself a permission to reproduce an emblem, which is why the permission stays an open item.',
  ],
};

/**
 * Project-owned monogram: the initials `SealPlaceholder` draws when the seal is
 * not available. Since `DL-199` that happens only if the seal is withdrawn by
 * setting its provenance back, which needs no code change. It is plain initials in the application typeface: no wreath, no
 * circular emblem, no gold, nothing that imitates a government seal.
 */
const APP_MONOGRAM: BrandAsset = {
  id: 'app-monogram',
  kind: 'monogram',
  title: 'Taytay Social Welfare monogram',
  provenance: 'generated',
  source: 'Drawn in CSS by this repository (src/app/shared/brand/).',
  mediaType: null,
  dimensions: null,
  optimizedPath: null,
  attribution: null,
  alterationPolicy: 'unrestricted',
  evidence: [
    'Rendered as text in the application typeface; no external file is involved.',
    'Deliberately non-heraldic so it can never be mistaken for the municipal seal.',
  ],
};

export const BRAND_ASSETS: readonly BrandAsset[] = [MUNICIPAL_SEAL, APP_MONOGRAM];

export function findAsset(id: string): BrandAsset | undefined {
  return BRAND_ASSETS.find((asset) => asset.id === id);
}

/**
 * A manifest entry that has cleared every check needed to be rendered: it is
 * vendored, and it knows its own path, media type and intrinsic size.
 */
export interface RenderableAsset extends BrandAsset {
  readonly optimizedPath: string;
  readonly mediaType: string;
  readonly dimensions: AssetDimensions;
}

/** True only when the asset is safe to render as an image. */
export function isRenderable(asset: BrandAsset): asset is RenderableAsset {
  return (
    asset.provenance === 'vendored' &&
    asset.optimizedPath !== null &&
    asset.dimensions !== null &&
    asset.mediaType !== null
  );
}

/**
 * Narrows an asset for rendering, or returns `null`. Components use this rather
 * than reaching for a non-null assertion — an unacquired asset is a normal,
 * expected state, not a type-system inconvenience.
 */
export function asRenderable(asset: BrandAsset | undefined): RenderableAsset | null {
  return asset !== undefined && isRenderable(asset) ? asset : null;
}

export const MUNICIPAL_SEAL_ID = MUNICIPAL_SEAL.id;
export const APP_MONOGRAM_ID = APP_MONOGRAM.id;
