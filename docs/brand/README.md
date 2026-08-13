# Brand and Asset System (TAB 03)

The digital identity layer for the MSWDO staff console: colour tokens that are
audited rather than asserted, an asset register that records provenance, and
three components that make the safe behaviour the default.

Decisions behind everything here: `DL-21` (palette), `DL-22` (seal), `DL-23`
(copy/localisation), `DL-24` (images), `DL-25` (accessibility) in
[`../reference-audit/decision-log.md`](../reference-audit/decision-log.md).

---

## 1. The headline: there is no official seal in this repository

The Municipality of Taytay's seal has **not** been vendored, and this is a
deliberate, evidence-backed decision — not an oversight and not a TODO.

| Question                                 | Answer                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------- |
| Does an official site exist?             | Yes — https://www.taytayrizal.gov.ph/ (HTTP 200, checked 2026-08-14)    |
| Is a master seal file published there?   | No. Only Wix CDN **transforms** (`w_225,h_150,…,enc_avif,quality_auto`) |
| Is a licence or terms page published?    | No copyright notice, no terms, no licence, no attribution text          |
| Does RA 8293 §176.1 permit reuse?        | It removes _copyright_; it does not grant emblem-reproduction rights    |
| Is a Taytay ordinance on the seal known? | No. None was located, and none is asserted                              |

Copying a CDN transform would ship a **resized, re-encoded seal** — an altered
one. The acceptance criterion for this TAB is that the seal is never visually
altered, so the only compliant options were "acquire the master with permission"
or "do not ship a seal". Acquisition is not something this repository can do on
its own, so the placeholder path was taken.

**To acquire it properly**, follow `public/brand/README.md`. It is a data
change, not a code change: fill in the manifest entry, drop the file in, run
`npm run check:brand`. `MunicipalSeal` starts rendering it immediately.

---

## 2. Tokens

`src/styles/_brand-tokens.scss` holds the brand ramp, the focus-ring token, the
semantic spacing aliases (`DL-17`) and the fixed seal sizes.
`src/styles.scss` keeps the general palette.

**No Pantone, PMS, CMYK or spot-colour claim is made anywhere.** This project
has no Taytay brand specification, so asserting an equivalence would be
inventing an official fact. `npm run check:brand` fails the build if such a
claim appears in `src/` or `docs/`.

### The palette is audited, not asserted

`src/app/shared/brand/brand-palette.ts` mirrors the colour tokens in TypeScript
so a test can check them. `brand-palette.spec.ts` asserts every pair the
application actually renders against its WCAG 2.2 AA threshold — 4.5:1 for text
(§1.4.3), 3:1 for control boundaries and the focus ring (§1.4.11).

Running that audit for the first time found two TAB 01 values that did not
conform, both now corrected and pinned against reinstatement:

- `--c-text-subtle` was `#7b8896` — **3.62:1** on white, below 4.5:1.
- `--c-border-strong` was `#c3ccd6` — **1.62:1** on white, below 3:1.

Two exemptions are recorded with the clause relied on, rather than quietly
ignored: status-badge tints (the visible **label** carries the state, not the
tint) and decorative rules (`--c-border` identifies no component).

> Adding a colour pairing to a component without adding it to `AUDITED_PAIRS`
> is how a palette silently stops conforming.

---

## 3. Components

All exported from `@shared/index`.

| Component       | Purpose                                                                                                |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| `MunicipalSeal` | The seal, or a provenance-aware placeholder. **No `src` input** — it cannot render an uncleared asset. |
| `BrandMark`     | The lockup: seal beside the office name. The one place the product is named on screen.                 |
| `AppImage`      | Any image. Reserves its box, falls back honestly, never distorts.                                      |

### Why the seal component is safe by construction

`MunicipalSeal` takes a `size` from a fixed set and nothing else. It reads the
manifest and renders an image only when `provenance === 'vendored'` **and** the
path, media type and intrinsic dimensions are all present. There is no input a
caller could use to point it at arbitrary artwork, and no styling hook that
could recolour or crop it: it is drawn into a square with `object-fit: contain`,
so it scales uniformly or not at all.

The placeholder is deliberately unlike a government seal — a dashed square with
initials, no circle, no wreath, no gold. Its accessible name is "Municipal seal
not available", so assistive-technology users are told the same thing the
styling tells everyone else.

### Why images cannot shift the layout

`AppImage` requires `width` and `height` and reserves that box with an explicit
`aspect-ratio` before the network responds. Failure renders a labelled fallback
**in the same box**. Seal sizes are fixed tokens (32/48/96/160 px), so swapping
today's placeholder for a real seal tomorrow moves nothing.

NgOptimizedImage is deferred rather than rejected — see `DL-24`. It earns its
keep with CDN loaders and srcset; we currently vendor zero raster assets.

---

## 4. Copy and localisation

Every user-facing string lives in a typed `*.copy.ts` module beside the code it
serves — `brand.copy.ts` is the worked example. A bare user-facing literal in a
template is now a defect.

This is the precondition for Angular's official i18n path: `$localize` operates
on TypeScript string literals, so switching on `@angular/localize` later changes
those literals and nothing else. `@ngx-translate` is rejected (a dependency, not
the official path, already refused in FSM §5). Runtime language switching is
deferred, not chosen.

Privacy by default: no copy string is personalised, and none is sent to a third
party for translation at runtime.

---

## 5. Checks

```bash
npm run check:brand   # token parity, colour-claim scan, manifest/file integrity
npm test              # contrast audit + component behaviour
npm run verify        # lint, typecheck, check:brand, tests, production build
```

`tools/check-brand-assets.mjs` enforces four things a unit test cannot, because
they are about files and the repository as a whole:

1. **SCSS ↔ TypeScript token parity** — the palette is only a trustworthy audit
   subject if it still describes the stylesheet.
2. **No unsupportable colour-system claims** anywhere in `src/` or `docs/`.
3. **Vendored assets exist on disk**, with declared dimensions.
4. **No unregistered image** sits in `public/brand/` without a manifest entry
   recording its source and permission basis.

---

## 6. Known gaps

- **The seal itself.** Requires the LGU to supply the master file and written
  permission. Everything downstream is ready.
- ~~**WCAG 2.4.11 Focus Not Obscured (AA)**~~ and ~~**WCAG 2.5.8 Target Size
  (AA)**~~ — both closed in TAB 04, see `DL-26`. Applying the 24×24 contract
  found three offenders: the `Modal`, `Drawer` and toast close buttons.
- **Bilingual UI** — the architecture is settled (`DL-23`); whether the console
  ships in Filipino remains a product decision (`DL-18`).
