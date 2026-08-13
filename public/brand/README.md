# `public/brand/` — official brand assets

This directory is **empty of images on purpose.**

No official Taytay asset has been lawfully acquired for this repository. The
municipal seal is registered in the asset manifest
(`src/app/shared/brand/asset-manifest.ts`) with `provenance: 'not-acquired'`
and the evidence for that decision. Until an asset is supplied, the application
renders a neutral placeholder that is visibly not a government seal.

## Do not

- Do not download the seal from the municipal website. Its imagery is served
  through Wix CDN transform URLs (`.../v1/fill/w_225,h_150,...,enc_avif,...`),
  which are **resized and re-encoded derivatives**. Shipping one would mean
  shipping an altered seal.
- Do not trace, redraw, recolour, or "clean up" the seal.
- Do not generate a seal-like image with any tool.
- Do not copy an asset from another LGU project.

## To add an asset properly

1. **Obtain the master file and written permission** from the Municipality of
   Taytay — ideally SVG, otherwise the largest available PNG. Record who
   granted it and when. Keep the permission itself outside this repository.
2. **Optimise without altering.** Lossless only: SVGO for SVG, lossless PNG
   recompression. Do not crop, pad, recolour, flatten transparency, or change
   the aspect ratio. Verify the optimised file is visually identical.
3. **Place it here** as `public/brand/<name>.<ext>` and note its exact intrinsic
   dimensions.
4. **Fill in the manifest entry** — set `provenance: 'vendored'`, and supply
   `optimizedPath`, `mediaType`, `dimensions`, `source` and `attribution`
   (attribution text must come from the rights holder, never invented).
5. **Run `npm run check:brand`.** It fails if the file is missing, if an image
   here has no manifest entry, or if the tokens have drifted.

`MunicipalSeal` starts rendering the real asset the moment the manifest says it
is vendored. No component code changes.

## Why the box never moves

Every brand surface reserves its box from fixed size tokens
(`--seal-size-*`), independent of whether an image loads. Swapping the
placeholder for the real seal therefore causes no layout shift.
