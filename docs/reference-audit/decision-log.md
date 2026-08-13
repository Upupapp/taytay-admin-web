# Decision Log

Every intentional divergence from a reference, every deliberate exclusion, and
every structural improvement this project makes on its own authority.

Ids are permanent. A later TAB that overturns a decision adds a new entry that
names the one it supersedes; entries are never edited away.

Status key: **Settled** (decided and in effect) · **Binding** (decided, and the
named future TAB must honour it) · **Open** (identified, deliberately not
decided in TAB 02) · **Superseded**.

---

## Sourcing and boundaries

### DL-01 · Get Hired supplies experience, never technology or features

**Status:** Settled.
**Evidence:** `get-hired-FE/package.json` — `@angular/core ~13.2.5`,
`@ngrx/store ^13.1.0`, `@angular/material ^13.2.5`, `bootstrap ^5.2.0`,
`@nguniversal/express-engine ^13.0.2`.

Get Hired is Angular 13 with NgModules, NgRx, Angular Material and Bootstrap 5.
This repository is Angular 22, standalone, zoneless, signals-first, with no CSS
framework and no UI kit (`CLAUDE.md` §3). Importing its structure would mean
reversing every stack decision made in TAB 01.

**Consequence:** From Get Hired we take state taxonomy, motion and accessibility
rules, copy patterns and layout arrangement. We take no component code, no state
library, no dependency, and no feature. Feature-level refusals are itemised in
the [feature source matrix](./feature-source-matrix.md) §5.

### DL-02 · Esperanza supplies features, never schema, rules or lifecycle enforcement

**Status:** Settled.
**Evidence:** `Esperanza/routes/web.php` — all 40+ routes are `Route::view(...)`.
`app/` holds only `Controller.php`, `User.php`, `AppServiceProvider.php`.
`database/migrations/` holds only stock Laravel tables. Its `CLAUDE.md`: "Never
generate: Controllers …, Models, Migrations, … business logic, DB queries, auth
logic, authorization logic".

Esperanza is a frontend prototype. It proves _which modules an LGU platform
needs_ and _what staff call them_. It cannot testify to how anything behaves,
because nothing in it behaves.

**Consequence:** Any lifecycle, permission model, validation rule or data shape
in this repository is our own decision and must be justified on its own terms —
never as "Esperanza does it this way". It also means **no PHP, Blade or Laravel
artefact may enter this repository** under the guise of reuse (`CLAUDE.md` §2
rule 1).

### DL-03 · The citizen portal is out of scope

**Status:** Settled.
**Evidence:** `Esperanza/resources/views/citizen/` (10 screens), routes `/citizen/*`.

Esperanza bundles citizen and admin portals in one codebase. This project
separates them: the beneficiary-facing surface is the Flutter app
(`Desktop\Taytay_Rizal_LGUIDS_Resident_Mobile_Flutter`), and this repository is
the staff console only (`CLAUDE.md` §1).

**Consequence:** No citizen-facing route is added here. Citizen screens are still
consulted as evidence of what staff must produce — `citizen/status-guide.blade.php`
is why our `StatusCatalog` carries a plain-language `description` per status.

---

## Assistance lifecycle divergences

Baseline for comparison: Esperanza's universal 14-status set and its stated
assistance workflow, _Citizen (Submit Request) → Admin (Review → Assign →
Approve → Release → Completed)_ (`Esperanza/CLAUDE.md`).

### DL-04 · Added `assessment` and `endorsed`; dropped `Assigned`/`Processing`

**Status:** Settled (implemented in TAB 01).

Esperanza moves straight from review to approval. Philippine social-welfare
practice does not: a registered social worker assesses the case — typically a
case study and often a home visit — and then _endorses_ it to the MSWDO head,
who approves. Those are two different people performing two different acts, and
collapsing them destroys the accountability trail.

`assessment` names the work rather than the act of assigning it (assignment is
carried by `assignedTo`, which is orthogonal to status and can change without a
status transition). `endorsed` makes the social worker's recommendation an
explicit, attributable state carrying `SocialWorkerAssessment`.

**Consequence:** This is what makes DL-06 (separation of duties) enforceable —
without a distinct `endorsed` state there is nothing for approval to be separate
_from_.

### DL-05 · `Ready for Release` became `scheduled`, and carries a date and channel

**Status:** Settled (implemented in TAB 01).

"Ready for Release" describes a readiness condition; `scheduled` describes a
commitment. A beneficiary travelling to the municipal hall needs to know _when_
and _how_, not that their file is ready. Our `Disbursement` therefore carries
`scheduledFor` and a `PayoutMethod`.

### DL-06 · Added `expired`; did not adopt `Archived`

**Status:** Settled (implemented in TAB 01).

`expired` exists because an approved grant that is never claimed is materially
different from one that was cancelled or rejected: the money was committed and
must be released back to the programme. Esperanza has no state for this.

`Archived` is not adopted because it is a _retention_ concern, not a workflow
state. Mixing retention into the lifecycle would make `completed` ambiguous.
Retention policy under RA 10173 belongs to the backend and to a future records
TAB.

### DL-07 · `Waiting Requirements` became `returned`, re-entering at `intake-review`

**Status:** Settled (implemented in TAB 01).

"Waiting requirements" states a condition; `returned` states who holds the ball —
the applicant. Re-entry at `intake-review` rather than at the prior state means
resubmitted documents are always re-validated, which is the point of returning it.

### DL-08 · Separation of duties is enforced, not assumed

**Status:** Settled (implemented in TAB 01, asserted by test).

Neither reference has an authorization model to copy (DL-02). Ours holds that no
single non-administrator role may both approve a request and release its money.
This is standard public-funds internal control and is asserted by a test in
`src/app/domain/access/permission.spec.ts`.

**Consequence:** If a future role change breaks that test, the role change is
wrong, not the test.

---

## Deliberate exclusions from Esperanza

### DL-09 · `admin/payments` is excluded — the money flows the other way

**Status:** Settled.
**Evidence:** `Esperanza/resources/views/admin/payments.blade.php`.

Esperanza's payments module is **citizen → LGU** (fees for documents and
permits). This console's `Disbursements` module is **LGU → beneficiary** (aid
released to an indigent resident). They share the word "payment" and nothing
else: different direction, different authorization, different controls, different
audit obligations.

**Consequence:** `Disbursements` is recorded as this project's own module
(FSM-09), not as an adaptation of Esperanza's. Treating them as the same module
would be the single most damaging false economy available in this audit.

### DL-10 · Document requests, communications and internal forms are excluded

**Status:** Settled, revisitable.
**Evidence:** `admin/document-requests.blade.php`, `admin/communications.blade.php`,
`admin/internal-forms.blade.php`.

- **Document requests** (barangay clearance, certificates) sit with the Civil
  Registry and barangay offices, not the MSWDO. Certificates of indigency appear
  in our domain as a _requirement_ on an assistance request
  (`brgy-indigency`), which is the MSWDO's actual relationship to them.
- **Communications / balita** (announcements, events, office directory) is a
  public-information function; the beneficiary-facing side is the mobile app.
- **Internal forms** are HR/administrative workflows unrelated to casework.

**Consequence:** Excluded from the roadmap. If a later Master Command adds any of
them, this entry is superseded rather than quietly reversed.

### DL-11 · Disaster response (`sakuna`) is in mandate but deferred

**Status:** Open (scope confirmed, timing not decided).
**Evidence:** `admin/sakuna.blade.php` plus 10 tabs under
`admin/partials/sakuna/` — command centre, vulnerability, incidents, evacuation
centres, evacuees, resources, relief, damage assessment, alerts, reports.

Unlike DL-10, this genuinely is MSWDO work: relief distribution and evacuee
management are social-welfare functions, and TAB 01 already anticipated it with
the `disaster-response` and `food-and-relief` programme categories and the
`Family Food Pack` seed programme funded from the LDRRM fund.

It is deferred because it is ten screens with their own domain (incidents,
evacuation centres, damage assessment) and would dominate any TAB it shared.

**Consequence:** No route is added yet. When it is built it needs its own TAB,
and its statuses need their own `StatusCatalog` — the assistance lifecycle does
not fit incident management.

---

## Improvements this project makes on its own authority

### DL-12 · Resident verification state is a gap worth closing

**Status:** Open.
**Evidence:** `Esperanza/resources/views/admin/constituents.blade.php` — filter
values `Verified`, `Partially Verified`, `Unverified`, `For Validation`.

Our `Resident` carries only `isActive`. Esperanza is right that a registry needs
to record _how well identity has been established_, because it gates what
assistance can be released.

**Consequence:** Recommended for the residents TAB as a `StatusCatalog<VerificationState>`
alongside the existing sector tags — not as a boolean. Deliberately not added in
TAB 02, which must not change application source.

### DL-13 · Completeness is adopted as a pattern, not as a feature

**Status:** Binding on the assistance-request TAB.
**Evidence:** `get-hired-FE/src/app/shared/components/application-completeness-card/`.

Get Hired's CV-completeness _feature_ is rejected (FSM §5). Its **state handling**
is adopted: loading → error+retry → unavailable → **pre-deployment** → content.

The pre-deployment branch is the valuable part. Any TAB that adds a computed
field to an existing entity must render records that predate the field with an
honest explanation, never as `0%` and never as an error.

Our `outstandingRequirements()` already computes the underlying value.

### DL-14 · Skeletons should mirror content shape

**Status:** Open (improvement, not a defect).
**Evidence:** `application-completeness-card.component.html`;
`GETHIRED_BRAND_STATE_EXPERIENCE_SYSTEM.md` §1.

Our `Skeleton` emits generic ragged lines, which is fine for tables and weak for
detail panes. A later TAB building a detail surface should either pass a matching
line count or extend the primitive with a shape input.

### DL-15 · Ambient motion must be removed under reduced motion, not shortened

**Status:** Binding on any TAB that adds animation.
**Evidence:** `get-hired-FE/src/assets/styles/_motion.scss` — separate
`motion-safe` and `ambient-motion-safe` mixins; "these are removed entirely
under reduced motion, never just slowed down".

Our global `prefers-reduced-motion` block collapses all durations to `0.01ms`.
For transitions that is correct. For a _continuous_ animation — our skeleton
shimmer — a 0.01ms duration means it loops furiously rather than stopping, which
is worse than the original. The global block is sufficient today only because the
shimmer is our lone ambient animation and its effect at 0.01ms is imperceptible
rather than distracting.

**Consequence:** Any new continuous animation must set `animation: none` under
`prefers-reduced-motion`, not rely on the duration override.

### DL-16 · Two small accessibility gaps in TAB 01 output

**Status:** **Superseded by `DL-25`** (both gaps closed in TAB 03). The record
below is kept as written, because it is the evidence that they were found.
**Evidence:** `GETHIRED_BRAND_ACCESSIBILITY_GUARDRAILS.md` checklist vs our source.

1. **No `aria-busy` on loading regions.** Our `Skeleton` is correctly
   `aria-hidden`, and `LoadingIndicator` carries `role="status"`, but the region
   being loaded is not marked busy.
2. **`Modal`/`Drawer` do not trap focus.** `bindOverlay` moves focus in on open,
   restores it to the trigger on close, and handles Escape — but Tab can still
   walk out of an open dialog into the page behind it.

Both are real. Neither is fixed in TAB 02 because this TAB is an audit and must
not change application source. They are the first candidates for the next TAB
that touches those primitives.

### DL-17 · Adopt a semantic spacing layer above the numeric scale

**Status:** Open.
**Evidence:** `get-hired-FE/src/assets/styles/_tokens.scss` — numeric
`--gh-space-1…12` plus semantic `--gh-space-card`, `--gh-space-section`,
`--gh-space-page`.

`--space-card` communicates intent at the call site and survives a change to the
underlying scale; `--space-4` does not. Our `styles.scss` has only the numeric
layer. (Our `--tone-*` layer is the same idea applied to colour, and Get Hired
has no equivalent — so this is a one-way gap, not a wholesale deficiency.)

### DL-18 · Filipino module naming and bilingual UI are deferred, not rejected

**Status:** Open.
**Evidence:** Esperanza names modules **Tulong** (assistance), **Dokyu**
(documents), **Sakuna** (disaster), **Balita** (news);
`get-hired-FE` ships `@ngx-translate/core` and a `language-selection` component.

Filipino labels are a genuine usability signal for LGU staff and residents, and
both references independently point at localisation.

Deferred because it is a cross-cutting decision: adopting it later means
retrofitting every string, so it should be decided deliberately rather than
drifted into. Our current UI is English-only with plain-language status
descriptions.

**Consequence:** If bilingual UI is wanted, it should be decided _before_ the
feature TABs write their copy, not after.

### DL-19 · Sensitive-sector masking has no source in either reference

**Status:** Settled (implemented in TAB 01).

Neither reference masks anything. Our masking of `vawc-survivor` (RA 9262) and
`cicl` (RA 9344) records in list views, gated on `request.view-sensitive`, is
this project's own decision under RA 10173 and the sectoral statutes.

**Consequence:** Do not look for a reference implementation — there is none. The
rule is: the adapter returns the full record, suppression is a presentation
decision, and the API enforces its own copy (`CLAUDE.md` §6).

---

## External standards

### DL-20 · WCAG 2.2 Level AA is the accessibility conformance target

**Status:** Binding on all later TABs.
**Source (verified 2026-08-14 against the primary document):**
[Web Content Accessibility Guidelines (WCAG) 2.2](https://www.w3.org/TR/WCAG22/),
**W3C Recommendation, 12 December 2024.**

The W3C states that WCAG 2.2 is additive to 2.1 — conforming to 2.2 also
conforms to 2.1 — and "recommends that sites adopt WCAG 2.2 as their new
conformance target, even if formal obligations mention previous versions".

Get Hired's guardrails document (`GETHIRED_BRAND_ACCESSIBILITY_GUARDRAILS.md`)
is a good practical checklist but is not itself a standard and does not name a
conformance target. Naming one is this project's decision.

Success criteria **new in 2.2** that later TABs must plan for, with the levels as
published:

| Criterion | Name                                | Level | Why it bites here                                                                                                           |
| --------- | ----------------------------------- | ----- | --------------------------------------------------------------------------------------------------------------------------- |
| 2.4.11    | Focus Not Obscured (Minimum)        | AA    | Our shell has a **sticky topbar** and sticky table headers. A keyboard-focused row can end up underneath them.              |
| 2.5.7     | Dragging Movements                  | AA    | Any future drag interaction (reordering, file drop) needs a non-drag alternative.                                           |
| 2.5.8     | Target Size (Minimum)               | AA    | 24×24 CSS px minimum. Our `DataTable` sort buttons and the `Modal`/`Drawer` close buttons are small and should be measured. |
| 3.2.6     | Consistent Help                     | A     | Help must sit in a consistent place across pages once we add it.                                                            |
| 3.3.7     | Redundant Entry                     | A     | Assistance intake must not re-ask for information the resident record already holds.                                        |
| 3.3.8     | Accessible Authentication (Minimum) | AA    | Binding on the credential sign-in TAB: no cognitive-function test (no puzzles, no transcription) without an alternative.    |

Also new: 2.4.12 Focus Not Obscured (Enhanced) (AAA), 2.4.13 Focus Appearance
(AAA), 3.3.9 Accessible Authentication (Enhanced) (AAA) — not targeted at AA.

**Consequence:** 3.3.8 in particular constrains a future TAB before it starts,
which is exactly the kind of thing this audit exists to surface early. The two
gaps in DL-16 are also WCAG-relevant (focus trapping supports 2.4.3 Focus Order
and 2.1.2 No Keyboard Trap's intent for dialogs).

---

## Brand and asset system (TAB 03)

### DL-21 · The palette is the application's, not the municipality's — and it is audited

**Status:** Settled (implemented in TAB 03).
**Source:** WCAG 2.2 §1.4.3 Contrast (Minimum) and §1.4.11 Non-text Contrast,
verified at https://www.w3.org/TR/WCAG22/ on 2026-08-14.

This project has no access to a Taytay brand specification. It therefore makes
no claim about official municipal colours, and asserts **no Pantone, PMS, CMYK
or spot-colour equivalence** for anything. `tools/check-brand-assets.mjs` fails
the build if such a claim appears anywhere in `src/` or `docs/`.

What the palette _is_: the restrained municipal-blue ramp chosen in TAB 01, now
mirrored in `src/app/shared/brand/brand-palette.ts` so it can be checked by
machine rather than by eye. `brand-palette.spec.ts` asserts every rendered
foreground/background pair against its AA threshold.

Auditing it caught two values shipped in TAB 01 that did not conform:

| Token               | Was       | Measured | Now       | Clause                 |
| ------------------- | --------- | -------- | --------- | ---------------------- |
| `--c-text-subtle`   | `#7b8896` | 3.62:1   | `#606b78` | 1.4.3 AA (needs 4.5:1) |
| `--c-border-strong` | `#c3ccd6` | 1.62:1   | `#7d8894` | 1.4.11 AA (needs 3:1)  |

Both regressions are pinned by assertions, so reinstating either value fails the
suite.

Two exemptions are recorded rather than "fixed", because the standard grants
them: status-badge tints (the label carries the meaning, not the tint) and
decorative rules (`--c-border`, which identifies nothing). Both are listed in
`DOCUMENTED_EXEMPTIONS` with the clause relied on.

**Consequence:** adding a colour pairing to a component without adding it to
`AUDITED_PAIRS` is how a palette silently stops conforming. The audit is only as
good as that list.

### DL-22 · The municipal seal is not vendored, and the placeholder is not a seal

**Status:** Settled (implemented in TAB 03).

The official seal is deliberately **not** copied into this repository. Three
independent reasons, each checkable:

1. **Only derivatives are available.** The official site
   (https://www.taytayrizal.gov.ph/, HTTP 200 on 2026-08-14) is Wix-hosted and
   serves imagery through `static.wixstatic.com` transform URLs such as
   `.../v1/fill/w_225,h_150,al_c,q_85,...,enc_avif,quality_auto/taytay%20gov.png`.
   Those are resized, re-encoded renditions. Copying one would mean shipping an
   **altered** seal — precisely what this TAB forbids.
2. **No permission is published.** The site carries no copyright notice, no
   terms-of-use page, no licence and no attribution statement (checked
   2026-08-14). There is nothing to rely on, and no attribution text that could
   be reproduced without inventing it.
3. **Absence of copyright is not permission.** RA 8293 §176.1 — verified at
   https://lawphil.net/statutes/repacts/ra1997/ra_8293_1997.html — provides that
   "No copyright shall subsist in any work of the Government of the Philippines",
   requiring prior approval only for exploitation _for profit_. That removes a
   copyright barrier; it does not grant the right to reproduce an official
   emblem, and seals carry separate heraldic and local-ordinance rules about
   which this project has **no evidence**. No Taytay ordinance is cited because
   none was located, and inventing one would be worse than the gap.
   (The Official Gazette copy of RA 8293 returned HTTP 403; the text was read
   from a law repository instead. Flagged so the citation is not overstated.)

Instead, `MunicipalSeal` renders a **provenance-aware placeholder**: a dashed
square with the letters "TR" in the application typeface. No circle, no wreath,
no gold, no ribbon — nothing that imitates or is derived from a government seal.
Its accessible name is "Municipal seal not available", so a screen-reader user
learns exactly what a sighted user learns.

The safety property is **structural**: the component has no `src` input. Path
and dimensions come from the manifest, gated on `provenance === 'vendored'`, so
it cannot render an asset the manifest has not cleared. Acquisition is a data
change (fill in the manifest, drop the file into `public/brand/`), not a code
change — the workflow is in `public/brand/README.md`.

**Consequence:** the seal is never recoloured, cropped, redrawn, rotated or
overlaid. It is drawn into a fixed square with `object-fit: contain`, so it
scales uniformly or not at all. WCAG exempts logotypes from contrast, and since
we may not alter it, its contrast is not ours to adjust.

### DL-23 · Copy lives in typed copy modules — supersedes the architecture half of DL-18

**Status:** Settled (implemented in TAB 03). Supersedes `DL-18` in part.
**Source:** Angular's official i18n guide (https://angular.dev/guide/i18n),
whose workflow is "Add the localize package" (`@angular/localize`) and "Deploy
multiple locales" — build-time, one bundle per locale.

`DL-18` deferred bilingual UI while warning that it had to be decided **before**
feature TABs wrote copy. TAB 03 is the first TAB to add material user-facing
copy, so the decision is due now.

**Decided:** every user-facing string lives in a typed `*.copy.ts` module beside
the code it serves, never inline in a template. `brand.copy.ts` is the worked
example.

Why this and not the alternatives:

- **`@angular/localize` is the destination, not the starting point.** Its
  `$localize` tagged template works on string literals in TypeScript, so today's
  `'Municipal seal not available'` becomes a tagged literal and no call site
  moves. Installing it now would buy per-locale builds we have no translations
  for.
- **`@ngx-translate` is rejected.** It is a dependency, it is not the official
  path, and it was already refused for feature purposes in FSM §5.
- **Runtime language switching is deferred, not chosen.** If the LGU requires
  switching without a reload, that requirement supersedes this entry — the
  centralised copy modules make either path cheap, which is the point.

Privacy by default: no copy string is personalised, and none is sent to a third
party for translation at runtime. A future locale preference is a staff-profile
setting held by the API — never a tracking vector, never in analytics.

**Consequence:** a template containing a bare user-facing string literal is now
a defect. `DL-18` remains in force for the _product_ question of whether the UI
ships in Filipino; only the architecture half is settled here.

### DL-24 · Layout shift is prevented by reserved boxes, not by NgOptimizedImage

**Status:** Settled (implemented in TAB 03).
**Source:** Angular's image guide (https://angular.dev/guide/image-optimization),
which describes NgOptimizedImage as "Preventing layout shift by requiring width
and height" and warning "if the image will be visually distorted when rendered".

`AppImage` requires `width` and `height` and reserves that box with an explicit
`aspect-ratio` before the network responds. A slow, failed or missing image
therefore cannot reflow the page — the same mechanism NgOptimizedImage relies
on, applied directly. `object-fit: contain` guarantees artwork is never
distorted to fill the box, which matters most for the seal.

NgOptimizedImage itself is **deferred, not rejected**. Its distinctive value is
CDN loaders, `priority` hints and srcset generation; this application currently
vendors **zero** raster assets and has no image CDN, so it would add build-time
warnings with nothing to optimise. Adopt it when the first raster asset is
vendored, or when an image CDN appears.

**Consequence:** every image goes through `AppImage` or a component built on it.
An `<img>` written directly in a feature template, with no reserved box, is a
defect.

### DL-25 · The DL-16 accessibility gaps are closed — supersedes DL-16

**Status:** Settled (implemented in TAB 03). **Supersedes `DL-16`.**

`DL-16` recorded two real gaps in TAB 01 output and left them for "the next TAB
that touches those primitives". TAB 03 owns accessibility, so both are closed
here.

1. **`aria-busy` on loading regions.** `AsyncContent` marks its host busy while
   the state is `loading` or `idle`, and `DataTable` marks its table region busy
   while rows load. Assistive technology now announces "busy" instead of reading
   a half-built section — or worse, an empty one. `AppImage` does the same for a
   single image.
2. **Focus trap in `Modal` and `Drawer`.** `bindOverlay` now handles `Tab` and
   `Shift+Tab`, cycling focus between the first and last focusable descendants
   of the panel and pulling focus back when it has escaped. A dialog that
   declares `aria-modal="true"` while letting Tab walk into the page behind it
   is lying to assistive technology: the content behind is inert to a mouse user
   but not to a keyboard user.

Both are covered by tests — wrap forward, wrap backward, recovery from escaped
focus, and no interference once closed.

**Consequence:** `DL-16` is closed. Two WCAG 2.2 items named in `DL-20` remain
open and are **not** claimed as resolved: **2.4.11 Focus Not Obscured** (the
sticky topbar and sticky table headers can still overlap a focused row) and
**2.5.8 Target Size** (small icon buttons in `DataTable`, `Modal` and `Drawer`
have not been measured).
