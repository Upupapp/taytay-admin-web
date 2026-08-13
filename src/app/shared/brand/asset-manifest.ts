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
 * visibly-unofficial placeholder. See `DL-22`.
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
 * Deliberately NOT vendored. Three independent reasons, each verifiable:
 *
 * 1. Only derivatives are publicly available. The official site
 *    (https://www.taytayrizal.gov.ph/) is a Wix site and serves its imagery
 *    through `static.wixstatic.com` transform URLs — e.g.
 *    `.../v1/fill/w_225,h_150,al_c,q_85,.../taytay%20gov.png`. Those are
 *    resized and re-encoded renditions, not the master artwork. Copying one
 *    would mean shipping an *altered* seal, which this TAB forbids outright.
 * 2. No licence or terms of use is published. The site carries no copyright
 *    notice, no terms page and no attribution statement (checked 2026-08-14),
 *    so there is no permission to rely on and no attribution text that could
 *    be reproduced without inventing it.
 * 3. The IP position is not a permission. RA 8293 §176.1 provides that "No
 *    copyright shall subsist in any work of the Government of the Philippines"
 *    while requiring prior approval for exploitation *for profit*. Absence of
 *    copyright is not the same as a right to reproduce an official emblem, and
 *    seals are additionally governed by heraldic and local-ordinance rules that
 *    this project has no evidence about.
 *
 * The correct resolution is procurement, not scraping: the LGU supplies the
 * master file plus written permission, someone fills in the fields below, and
 * `provenance` flips to `vendored`. Until then the placeholder renders.
 */
const MUNICIPAL_SEAL: BrandAsset = {
  id: 'municipal-seal',
  kind: 'seal',
  title: 'Official Seal of the Municipality of Taytay, Rizal',
  provenance: 'not-acquired',
  source: 'https://www.taytayrizal.gov.ph/ (official municipal website)',
  mediaType: null,
  dimensions: null,
  optimizedPath: null,
  attribution: null,
  alterationPolicy: 'scale-only',
  evidence: [
    'Official site resolves: https://taytayrizal.gov.ph -> https://www.taytayrizal.gov.ph/ (HTTP 200, checked 2026-08-14).',
    'Site is Wix-hosted; imagery is served as static.wixstatic.com transform URLs (w_225,h_150,enc_avif,quality_auto) — derivatives, not masters.',
    'No copyright notice, terms-of-use page, licence statement or attribution text found on the site (checked 2026-08-14).',
    'RA 8293 §176.1 verified at https://lawphil.net/statutes/repacts/ra1997/ra_8293_1997.html — removes copyright from government works but does not grant emblem-reproduction rights.',
    'No Sangguniang Bayan ordinance describing the seal was located; none is asserted.',
  ],
};

/**
 * Project-owned monogram used wherever a mark is needed and the seal is not
 * available. It is plain initials in the application typeface: no wreath, no
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
