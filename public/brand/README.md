# `public/brand/` — official brand assets

| File              | What it is                                                                              | Record                                    |
| ----------------- | --------------------------------------------------------------------------------------- | ----------------------------------------- |
| `taytay-seal.png` | Official Seal of the Municipality of Taytay, Rizal. 360 × 360 PNG, transparent corners. | `DL-199`; manifest entry `municipal-seal` |

The seal was vendored on 10 November 2026 on the project owner's instruction
(`DL-199`, superseding `DL-22`): the project website's file
(`Upupapp/taytay-website`, `taytay-rizal-website/assets/images/taytay-seal.png`)
copied **byte for byte**, and the same artwork the residents' app ships. Its
SHA-256 is in the asset manifest (`src/app/shared/brand/asset-manifest.ts`).

**Still open:** the Municipality's written permission is not on file. Keep it
outside this repository when it comes, and record who granted it and when in
the manifest's `evidence`.

## Do not

- Do not re-encode, crop, pad, recolour, trace, redraw or "clean up" the seal.
  Replace it only with a file from the Municipality, and update the manifest's
  hash, size and source in the same commit.
- Do not download the seal from the municipal website. Its imagery is served
  through Wix CDN transform URLs (`.../v1/fill/w_225,h_150,...,enc_avif,...`),
  which are **resized and re-encoded derivatives**.
- Do not generate a seal-like image with any tool.
- Do not copy an asset from another LGU project.

## To add or replace an asset

1. **Obtain the file** — ideally SVG, otherwise the largest available PNG — and
   record who supplied it and on what basis.
2. **Optimise without altering**, or not at all. Lossless only; verify the
   result is visually identical. The seal is shipped as supplied.
3. **Place it here** as `public/brand/<name>.<ext>` and note its exact intrinsic
   dimensions.
4. **Fill in the manifest entry** — `provenance: 'vendored'`, `optimizedPath`,
   `mediaType`, `dimensions`, `source`, and `attribution` (text from the rights
   holder only, never invented; `null` means none supplied).
5. **Run `npm run check:brand`.** It fails if the file is missing, if an image
   here has no manifest entry, or if the tokens have drifted.

`MunicipalSeal` renders whatever the manifest clears. No component code changes;
setting the provenance back to `not-acquired` brings the placeholder back.

## Why the box never moves

Every brand surface reserves its box from fixed size tokens
(`--seal-size-*`), independent of whether an image loads, so swapping the
placeholder for the seal caused no layout shift.
