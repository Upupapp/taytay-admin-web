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
and _how_, not that their file is ready. Our `Release` therefore carries
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
permits). This console's `Releases` module is **LGU → beneficiary** (aid
released to an indigent resident). They share the word "payment" and nothing
else: different direction, different authorization, different controls, different
audit obligations.

**Consequence:** `Releases` is recorded as this project's own module
(FSM-09), not as an adaptation of Esperanza's. Treating them as the same module
would be the single most damaging false economy available in this audit.

### DL-10 · Document requests, communications and internal forms are excluded

**Status:** **Superseded in part by `DL-184`**: residents' document requests are built, on the
TOR's terms (Section VIII, Months 4–5). Communications and internal forms stay excluded. Was:
Settled, revisitable.
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

**Status:** Superseded by `DL-199` (10 November 2026): the seal is vendored on the owner's
instruction, from the project website's file. The placeholder and the structural safety property
below still stand.

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

> Both were closed in TAB 04 — see `DL-26`.

---

## Application shell (TAB 04)

### DL-26 · Focus Not Obscured and Target Size are closed by contract, not by claim

**Status:** Settled (implemented in TAB 04). Closes the two items left open by
`DL-20` and restated in `DL-25`.
**Source:** WCAG 2.2, verified at https://www.w3.org/TR/WCAG22/ on 2026-08-14.

- **2.4.11 Focus Not Obscured (Minimum), AA** — "When a user interface
  component receives keyboard focus, the component is not **entirely** hidden
  due to author-created content." The shell has a sticky topbar, so a focused
  control scrolled into view near the top of the page could end up beneath it.
  Fixed with `scroll-margin-block-start` on every focusable element, derived
  from `--shell-topbar-height` so the offset cannot drift from the real bar.
  Sticky `<th>` gets the same treatment.
- **2.5.8 Target Size (Minimum), AA** — 24×24 CSS px. Met **outright** rather
  than through the standard's spacing exception, because spacing is fragile: it
  breaks the moment two controls move closer together. A single `.icon-button`
  contract carries the floor, and every icon-only control uses it. Applying it
  found three that did not: the `Modal`, `Drawer` and toast close buttons.

Neither can be asserted by a unit test, because jsdom performs no layout and
reports no computed size. Claiming them from a jsdom test would be an
unsupported claim. `tools/check-shell-a11y.mjs` therefore audits the **CSS
contract that produces them** — the token value, its application to
`.icon-button`, the scroll-margin rule and its selector coverage — and fails the
build if any of it is removed. The check was verified against a deliberately
introduced regression (lowering `--target-min` to 16px) before being trusted.

**Consequence:** an icon-only button that does not carry `.icon-button` is now a
build failure, not a review comment. The remaining honest gap is that no
real-browser measurement was possible in this environment (no Playwright or
Puppeteer is installed, and none was added for a single audit).

### DL-27 · The sidebar changes semantics, not just appearance, at the breakpoint

**Status:** Settled (implemented in TAB 04).

Below 900px the sidebar becomes an overlay. That is not a styling change: an
overlay that covers the page must trap focus, close on Escape, be dismissible
by a scrim, and announce itself as a dialog — while the wide sidebar must do
none of those things, because it is permanent navigation and Escape must not
remove the only way to move around.

CSS cannot express that difference, so `ViewportService` observes the one
breakpoint and the shell switches semantics: `role="dialog"` + `aria-modal`

- `inert` when closed on compact, plain landmark when wide. Being injectable is
  what lets both sizes be tested; jsdom never matches a media query, so a shell
  reading `matchMedia` inline would be untestable at the compact size.

**Identity and sign-out live in the sidebar footer, not the topbar.** In the
topbar they would have to be hidden on a narrow screen to keep the row on one
line, which strands a mobile user with no way to sign out. In the sidebar they
are one action away on desktop and two on mobile.

**Consequence:** the "every module in at most two navigation actions" guarantee
follows from the navigation being _flat_ — one action wide (click the link), two
compact (open drawer, click). A future sub-menu would break it, which is why the
test asserts there is no nested list inside a nav item.

### DL-28 · Global search ships as a trigger only

**Status:** Settled (implemented in TAB 04). Binding on the search TAB.

The shell owns the button, its accessible name and the Ctrl/Cmd+K shortcut, and
emits `activated`. It does **not** own results, indexing or permissions.

Search spans residents, assistance requests and programmes, each with its own
data scope and its own sensitive-record rules (`DL-19`). Implementing results
here would mean inventing a cross-module permission story inside a layout
component — the wrong place, and beyond what this TAB was asked to do. Least
privilege applies to code as much as to users: the shell gets exactly the
capability it needs to be finished and keyboard-tested.

Activating it today opens an honest "not built yet" panel rather than dead-
clicking.

**Consequence:** the search TAB replaces the shell's handler. It does not need
to touch the trigger, the shortcut or the topbar layout.

### DL-29 · Route progress is indeterminate, and says so

**Status:** Settled (implemented in TAB 04).

Every feature route is lazy, so choosing a module fetches a chunk before
anything renders; on the office's connection that reads as a frozen console.
`RouteProgress` fills the gap.

It is deliberately **indeterminate**. We do not know how long a chunk takes, and
a percentage would be the "fake progress bar jumping ahead" that `EPL-03`
forbids. The moving bar is `aria-hidden`; the announcement is a visually-hidden
`aria-live="polite"` region, so screen-reader users are told once instead of
hearing an animation. Under `prefers-reduced-motion` the bar stops moving but
stays visible, so the signal survives without the motion.

---

## Authentication and permissions (TAB 05)

### DL-30 · Permission is enforced in the data layer, not only in the UI

**Status:** Settled (implemented in TAB 05).

Hiding a control has never been protection — `CLAUDE.md` rule 4 says so, and
until TAB 05 nothing in the repository made that true. The mock adapters now
re-check permission **and** data scope before returning or changing anything,
through a new `ACCESS_CONTEXT` port.

Three layers, and only the last two protect:

1. **Controls** — `AppNav` filters, `*appHasPermission` removes,
   `appDisableWithoutPermission` disables. Usability.
2. **Routes** — `permissionGuard(...)` mirrors each navigation entry.
3. **Data** — `denyUnless(...)` in every mock repository method.

`ACCESS_CONTEXT` is bound to `SessionState`, not `SessionStore`, to break a
cycle: the store reads the adapters to resolve a session, so the adapters cannot
read the store. Splitting "who is signed in" from "how we load it" fixes that
and is better shape anyway.

Refusals travel as **stream errors** (`throwError`), not thrown exceptions. A
repository returns an `Observable`, so a synchronous throw escapes every
`catchError` the callers already have — including `toViewState` — and surfaces
as an uncaught exception instead of an error panel.

**Consequence:** the enforcement tests drive repositories directly, with no
component and no hidden button, so a pass means the refusal survives a bypassed
UI. When the HTTP adapters take over, these checks become the API's job; the
mock is standing in for a server that will do the same.

### DL-31 · A denial discloses nothing about what was refused

**Status:** Settled (implemented in TAB 05).

"You may not open resident res-0005" already tells you res-0005 exists. Under
RA 10173 that is the disclosure a refusal exists to prevent, so denial carries
no record detail anywhere:

- `PermissionDeniedError` holds the **required permission** and a fixed
  non-technical message. No id, no name, no field value.
- An out-of-scope record reads as **absent**, not forbidden. A barangay link
  asking for another barangay's resident gets the same `null` as for a resident
  that does not exist — distinguishing them would confirm the record is on file.
- `permissionGuard` redirects to a fixed `/forbidden` with **no `returnUrl`**.
  Echoing the refused path back into the URL would preserve, and possibly log, an
  identifier the user was not allowed to see.
- The transition check runs **before** the record lookup, so a refused caller
  cannot probe which ids exist by comparing "not found" against "not permitted".
- `/forbidden` names only the user's own identity, which they already know.

### DL-32 · There is no self-registration, and nothing to call

**Status:** Settled (implemented in TAB 05).

Staff accounts are provisioned by an administrator. This is enforced
structurally rather than by omission:

- no `register` route, and `anonymousOnlyGuard` on `/sign-in`;
- **no `register` method on `StaffRepository`** — there is nothing to call even
  if a screen wanted to;
- the sign-in screen _states_ how accounts are issued instead of leaving a user
  hunting for a link that does not exist;
- `tools/check-access.mjs` fails the build if a registration surface appears.

`staff.manage` is administrator-only, so provisioning is also separated from
case work — whoever grants permissions is not working cases with them.

### DL-33 · Sign-in satisfies WCAG 3.3.8 through Mechanism, and stores no password

**Status:** Settled (implemented in TAB 05). Closes the item `DL-20` flagged as
binding on this TAB.
**Source:** WCAG 2.2 §3.3.8 Accessible Authentication (Minimum), Level AA,
verified at https://www.w3.org/TR/WCAG22/ on 2026-08-14.

The criterion treats **remembering a password as a cognitive function test**,
allowed only where the step offers an Alternative, a **Mechanism**, Object
Recognition or Personal Content. This screen relies on Mechanism and provides it
three ways: `autocomplete="username"` / `"current-password"` so password
managers can fill the form; paste is never blocked; and a show-password toggle
for a manually typed password. There is no CAPTCHA, puzzle or transcription
step, and none may be added — each would be a cognitive function test with no
satisfier.

**No password is stored in this repository.** A front end has nothing to verify
a password against, so a fixture password would be a committed credential for no
benefit (`CLAUDE.md` §2 rule 5). The mock checks that the email belongs to an
active account and that the password is well-formed, and treats that as success.
`check:access` fails the build if a credential literal appears.

What the mock _does_ model faithfully is the security-relevant shape: **one
message for every failure**. Unknown address, wrong password and deactivated
account are indistinguishable, so the page cannot be used to enumerate which
municipal staff addresses exist. `returnUrl` is sanitised to same-origin
absolute paths, so the sign-in page cannot be turned into an open redirect.

**Consequence:** this is a _frontend mock_. It authenticates nobody and must not
be mistaken for a security boundary. Its value is that the shape, the copy and
the accessibility are right, so wiring a real API changes the adapter and
nothing else.

---

## Executive dashboard (TAB 06)

### DL-34 · Attention comes before analytics, and is filtered by the permission to _act_

**Status:** Settled (implemented in TAB 06).

The dashboard opens with a ranked list of things a person can do something
about, above every chart. The order is severity first, then size, computed in
the domain (`sortAttention`) so it cannot depend on object-key iteration — the
whole claim of the screen is that the top of the list is what to do next.

Each signal names an **action**, not a status code: "3 requests waiting for
approval", not "3 endorsed". Statuses are the system's vocabulary; the office's
vocabulary is what needs doing.

**The permission on a signal is the one needed to act, not to see.** The first
cut used `release.view` for unclaimed payouts and `referral.view` for
unanswered referrals, which put items on the read-only auditor's to-do list that
they could do nothing about. They are now `release.schedule` and
`referral.manage`. A test asserting the auditor sees an explicitly role-related
empty state is what caught it.

Zero-count signals are dropped rather than rendered as "0". An empty list is a
real answer — and it is worded differently depending on whether nothing needs
doing or nothing is _this user's_ to do.

### DL-35 · The chart is the table

**Status:** Settled (implemented in TAB 06).

`ChartTable` renders a real `<table>` with a `<caption>`, scoped headers and one
row per category. The bar is an `aria-hidden` span inside the row header, sized
against the largest value.

The alternative — a canvas or SVG chart plus a separate "accessible data table"
— is two artifacts that drift. The table stops being updated and quietly starts
lying to the people who depend on it most. One artifact cannot drift from
itself.

Consequences that fall out of it: nothing is conveyed by colour alone, because
every row states its label and value as text and the bar only repeats the
number; keyboard users tab through real links when rows drill down; and a
non-zero row always keeps a visible sliver of bar, so "small but present" never
looks identical to "none".

### DL-36 · Filter state lives in the URL, and travels into every drill-down

> **Narrowed by `DL-137` (TAB 16).** Filter state still lives in the URL — a barangay, a status, a
> date range are office vocabulary and describe no individual. **The search term does not**, because
> it is frequently a resident's name, and a shareable link is that name in the address bar, in a
> screenshot, and in browser history.


**Status:** Settled (implemented in TAB 06).

The dashboard filter (barangay, programme type, period) is read from query
params and written back on change. It is therefore shareable, survives the back
button, and is never held privately where it could disagree with what is shown.

The same filter is passed to `DashboardRepository.summary(filter)` **and**
merged into every metric's drill-down link. That is what makes "all metrics
trace back to underlying filtered records" true rather than asserted: the list a
number opens is constrained exactly as the number was.

Malformed params degrade to _no filter_ rather than throwing or guessing —
`readFilter` validates against the real barangay, category and period
vocabularies. A wrong figure is worse than an unfiltered one.

Routes live in the feature (`dashboard-drill-down.ts`), not the domain. The
domain knows the _situation_; it has no business knowing this application's URLs.

### DL-37 · The dashboard repository was unprotected, and two numbers were misnamed

**Status:** Settled (implemented in TAB 06).

Two honesty fixes found while building on TAB 05's foundation:

1. **`MockDashboardRepository` had no access check at all**, despite
   `docs/access/README.md` claiming `denyUnless(...)` was in "every mock
   repository". An anonymous or unprivileged caller could read municipality-wide
   counts, and aggregate figures are still information about residents. It now
   requires `dashboard.view` and respects barangay scope, so a `barangay-link`
   sees their own barangay's numbers rather than the municipality's.
2. **`disbursedThisMonth` never respected a month.** It summed every released
   release regardless of date, so the label claimed a window the number did
   not honour. It is now `disbursedInPeriod`, governed by the explicit `period`
   filter, and `residentsServedThisMonth` became `residentsServedInPeriod` for
   the same reason.

**Consequence:** the rule in `DL-30` now genuinely holds for every mock
repository, and a test pins it. A metric label that describes a window must be
computed under that window, or renamed.

---

## Constituent registry (TAB 07)

### DL-38 · Redaction happens in the data layer, not in the template

**Status:** Settled (implemented in TAB 07). **Supersedes** the presentation-only
reading of `CLAUDE.md` §6 ("masking is a presentation decision"), which TAB 01
wrote before there was a registry to protect.

Resident reads return a `ResidentView` — the record with its withheld attributes
already removed, plus the list of what was removed and a flag saying the record
is protected. `discloseResident` is a pure domain function; the adapter calls it
on the way out.

The reason is not theoretical. Template masking is correct only while every
binding remembers to mask, and a resident's details are rendered on a list, a
detail page, a summary card, a picker result and an export. One forgotten
binding in any of them is a disclosure, and the one most likely to be forgotten
is the one added last, by someone who never read this file.

Two tiers, because the two kinds of sensitivity are not the same grant:

| Tier                                          | Permission                | Reaches                 |
| --------------------------------------------- | ------------------------- | ----------------------- |
| PhilSys reference, monthly income             | `resident.view-sensitive` | Admin, Head, SW, Intake |
| Protected-sector membership, address, contact | `request.view-sensitive`  | Admin, Head, SW         |

`resident.view-sensitive` is new in this TAB. The protected tier reuses the
existing `request.view-sensitive` rather than inventing a parallel permission:
it gates the same statutory categories (RA 9262, RA 9344) and splitting it would
create two sources of truth for one question.

**What is deliberately still disclosed.** The masked name keeps a surname and a
given initial ("Manalo, C."), and `isProtected` is stated even when the sector
is not. Zero disclosure would be worse: an intake officer who cannot tell that a
record already exists registers a duplicate, and a survivor is put through the
whole intake conversation twice. Barangay is kept for the same reason — scope
and listing depend on it, and it is not the field that endangers anyone.

**Consequence:** `ResidentRepository` reads are typed `ResidentView`. The HTTP
adapter is typed the same way, which states the contract the API owes: the
server redacts, the client does not.

### DL-39 · A record you cannot fully see, you cannot edit

**Status:** Settled (implemented in TAB 07).

A `ResidentDraft` replaces the record. Building one from a redacted copy and
saving it would silently delete exactly the attributes that were withheld — a
protection case losing its contact details because an intake officer corrected a
spelling. So `update` is refused whenever the caller's own view of the record has
anything withheld, in the adapter as well as on the screen.

The alternative — merging a partial draft over the stored record — was rejected.
It makes "what did I just save?" unanswerable from the form, and it is the shape
that produces the bug where a cleared field silently keeps its old value.

**Consequence:** in practice only Admin, Head and Social Worker can edit a
protected record, which is the same set that may open one. Roles which hold
`resident.update` but not the sensitive tiers are told why, not left with a form
that fails on submit.

### DL-40 · A saved view is a name attached to query parameters

**Status:** Settled (implemented in TAB 07). Builds on `DL-36`.

Because filter state already lives in the URL, a saved view needs no filter model
of its own: it stores the query parameters verbatim. Applying one is a
navigation, sharing one is a link, and a list that grows a new filter tomorrow
gains it in saved views for free.

Page and sort are excluded. "Seniors in San Juan" is a population, not a scroll
position, and storing page 3 would hand the next person an arbitrary offset into
a list that has since changed.

Reading the views for a resource costs the same permission as reading the
resource. A view holds no records, but its _name_ can describe a population
("VAWC survivors, Santa Ana"), which is disclosive in the same way the list is.
Shared views belong to the office and cannot be deleted from a list screen;
personal views belong to their owner and are not listed to anyone else.

**Consequence:** `SavedViewsBar` is a shared primitive, usable above any list
whose filters are URL-driven. Persistence is the API's; the mock holds them for
the lifetime of the tab and says so.

### DL-41 · The registry seed is large, generated and deterministic

**Status:** Settled (implemented in TAB 07).

Eight hand-written residents cannot demonstrate that large result sets stay
usable — paging, sort stability, filter combinations and the cost of the
disclosure policy only show up at volume. The seed now carries ten named records
(each exercising a specific path, and referenced by id from the other seed
files) plus 240 generated ones.

Generation is modular arithmetic over fixed name pools, not a random seed, so
the same registry appears on every run. A fixture that differs between runs
turns a real failure into "try it again", which is worse than having no fixture.
All names are fictional combinations of common Philippine given names and
surnames; no field carries real personal data.

**Consequence:** the list is paged by the adapter, so only one page is ever
sorted and disclosed, and `mock-resident.repository.spec.ts` can assert that
paging is stable rather than assuming it.

---

## Household registry (TAB 08)

### DL-42 · A vulnerability indicator is advisory evidence, and that is enforced

**Status:** Settled (implemented in TAB 08).

The household snapshot describes what the records say about a family. It does
not decide eligibility, entitlement or an amount, and the acceptance criterion
for this TAB is that it _cannot_.

A comment saying so would not survive the third TAB that needs a number in a
hurry, so four structural things hold it up, and `tools/check-vulnerability.mjs`
fails the build on any of them:

1. **No decision-shaped field** on the advisory types — `eligible`, `entitled`,
   `qualifies`, `approved`, `grantAmount`, `score`, `points`. A field named like
   a decision becomes one, whatever the doc comment above it says.
2. **The two modules cannot see each other.** `domain/programs/`, which owns
   eligibility rules, never imports the vulnerability module; the vulnerability
   module never learns what a programme grants. Checked in both directions.
3. **No score, only a band.** Four values, from a rule a caseworker can restate
   from memory and check against the list on the screen: two primary indicators
   is `high`, one is `elevated`, two contributing alone is `watch`. A weighted
   sum would be summable, and a summable indicator is a threshold waiting to be
   applied.
4. **The advisory sentence exists and is rendered.** A disclaimer held in copy
   and never shown is worse than none.

**The correction authority is deliberately narrower than the edit authority.**
`household.manage` (moving people between households) reaches intake;
`household.correct-vulnerability` (contradicting what the records say about a
family) reaches the head, social workers and the administrator only. Every
correction carries a reason, an actor and a time, keeps the computed value it
replaced, and can be withdrawn by a further recorded act.

**Consequence:** the screen can be trusted to be evidence. A caseworker who is
asked "why was this family helped?" answers with a case study, and can point at
the working; they never answer "the system said so".

The checker was validated against five planted regressions before being trusted:
a `score` field on the snapshot, an eligibility module importing it, a factor
code dropped from `factorLabel`, the same dropped from `factorRule`, and the
advisory statement removed from the component. The third regression was **missed
on the first attempt** — the check searched the whole copy file, so a code
deleted from one map still passed because it survived in the other — and the
checker was tightened to slice each map out and search it alone.

### DL-43 · Household composition is edited as intents, and committed as a unit

**Status:** Settled (implemented in TAB 08).

The editor collects `MembershipChange` intents — add, remove, change role, set
head — rather than submitting a replacement member list. Two reasons, both
practical:

- **The audit trail can say what a person did.** "Made Marilou the head" is a
  sentence somebody can check a year later; "members changed from A to B" is
  not.
- **A stale screen cannot delete somebody quietly.** A replacement list built
  before a colleague added a member would drop that member on save. An intent
  that no longer applies can be refused instead.

The adapter computes the whole next state — the household, every resident whose
`householdId` moves, the audit line — validates it, and only then assigns, with
no suspension point in the commit. A batch is a unit: an illegal change anywhere
in it rolls back the legal ones too. Changing the head demotes the outgoing head
in the same act, because two heads for even one render is a household two
screens would read differently.

Referential rules live in the adapter rather than the pure validator, because
only the adapter can answer them: does this person exist, and are they already
under another roof. One person, one household — silently moving somebody would
empty a family on a screen nobody happened to be looking at.

**Consequence:** `household → family → person` is consistent by construction,
not by convention, and the tests can assert it by attempting a mixed batch and
checking that nothing at all moved.

### DL-44 · The band is disclosed, never recomputed per viewer

**Status:** Settled (implemented in TAB 08). Extends `DL-38` to households.

The snapshot is computed from **unredacted** member records inside the adapter,
and the _result_ is then disclosed: an uncleared viewer sees the
`protected-member` factor as `withheld`, with no basis and no correction.

The band is not recalculated after that. Two roles looking at the same family
agree on how exposed it is; only the reason is withheld. Recomputing per viewer
would mean an intake officer and a social worker reading different bands off the
same records, and the one with less access would be the one told the family is
fine.

`withheld` is a fourth state precisely so it need not be lied about as `absent`.
The cost is that an uncleared viewer sees a band their visible reasons do not
fully explain, and the screen says so in as many words. That is the same
disclosure `ResidentView.isProtected` already makes: something here needs
careful handling, and you are not the one to handle it.

Correcting a factor you cannot see is refused for the same reason a redacted
record cannot be edited (`DL-39`): overriding a judgement you were never shown
is not a correction.

### DL-45 · The poverty threshold in the code is a placeholder, and says so

**Status:** Settled (implemented in TAB 08). **Open** as a data question.

`MONTHLY_PER_CAPITA_THRESHOLD` is ₱3,000 per person per month. The Philippine
Statistics Authority publishes an official per-capita poverty threshold by
region and semester; this repository is offline and has not read one, so the
figure is a plausible working number and nothing else.

It is stated as a named constant, carried through to the screen as part of the
working, and captioned in the UI as a placeholder that must be reconciled with
the PSA release and the office's own AICS practice before anyone quotes it.

**Consequence:** the wrongness is visible rather than buried, and nothing
depends on the figure being right — which is only tolerable because `DL-42`
holds. An indicator that decided eligibility on an invented threshold would be
indefensible; an indicator that explains its arithmetic and decides nothing can
carry a placeholder honestly until the real number arrives.

**Superseded by `DL-46`** (same TAB, before certification). The reasoning above
is left exactly as it was written. It was wrong — not in its logic, which holds,
but in its premise that no published figure was reachable — and a log that
quietly deletes the wrong turn teaches nobody anything about how the wrong turn
was taken.

### DL-46 · The poverty threshold is the PSA's published figure for Rizal, cited on screen

**Status:** Settled (implemented in TAB 08). **Supersedes `DL-45`.**

`ACTIVE_POVERTY_THRESHOLD` is **PHP 39,055 per person per year** — the annual
per-capita poverty threshold for **Rizal province, 2023**, from the Philippine
Statistics Authority's _2023 Full Year Official Poverty Statistics_, Table 1,
published 15 August 2024.

Sources:
[PSA national report](https://psa.gov.ph/sites/default/files/phdsd/2023%20FY%20Official%20PovStat%20Publication%20Report_r2.pdf)
·
[PSA RSSO IV-A, CALABARZON](https://rsso04a.psa.gov.ph/content/2023-full-year-poverty-statistics-calabarzon)

**Why this supersedes `DL-45`.** That decision reasoned correctly from a false
premise: that the figure could not be obtained, so a labelled placeholder was
the honest option. The primary source was in fact available and was retrieved.
Labelling an invented number is not the same as sourcing one — a caption saying
"placeholder" is read by whoever builds the next screen, not by the family whose
income is being compared against it.

**Which geography.** Three options were compared:

| Option                     | Annual per capita | Why not / why                                                     |
| -------------------------- | ----------------- | ----------------------------------------------------------------- |
| CALABARZON (Region IV-A)   | PHP 37,096        | Correct region, but ~5% below the province Taytay is actually in. |
| **Rizal province**         | **PHP 39,055**    | **Chosen.** Closest authoritative published geography for Taytay. |
| No income threshold at all | —                 | Drops a real indicator to avoid a hard question. Rejected.        |

Rizal, because Taytay is in Rizal and the province is the finest geography the
PSA publishes for it. The regional figure would understate the local threshold
and quietly decline to flag families the province's own statistics count as
poor — an error invisible on screen and always in the same direction.

**Why the comparison is annual.** PHP 39,055 divided by 12 is PHP 3,254.583...,
which does not divide evenly. Storing a rounded PHP 3,254.58 as the boundary
would move it by a fraction of a centavo per person per month, in a direction
nobody chose and nobody would ever notice. So the published figure is kept
exactly as published and the _income_ is annualised instead: the comparison is
two integer multiplications and no division at all. The monthly figure is
derived for display only, shown to the centavo so it reads as derived rather
than published.

**Provenance is structural.** `PovertyThreshold` carries the amount, the
geography, the reference year, the publication date, the source and the source
URL as one object — not a magic number with a comment beside it. The panel cites
all of it on screen with a followable link, because a caseworker asked "where
does that number come from?" must be able to answer from the page they are
looking at. `tools/check-vulnerability.mjs` fails the build if any provenance
field is dropped, if the amount changes without the rest of the citation, if the
comparison reverts to a rounded monthly boundary, or if the citation stops being
rendered. All four checks were validated against planted regressions.

**The advisory boundary is unchanged.** `DL-42` still holds and is still the
reason this is an indicator rather than a means test: nothing derives
eligibility, entitlement or an amount from it. What changed is _why_ it is
defensible. Under `DL-45` it was defensible because it was harmless; it is now
defensible because it is right, and the harmlessness is a separate guarantee
rather than an excuse.

**Retirement and update rule.** The reference year ages. When the PSA publishes
its next full-year release: update `annualPerCapita`, `referenceYear`,
`publishedOn` and `sourceUrl` in the **same change** — they are one fact, not
four — adjust the pinned figure in `tools/check-vulnerability.mjs`, and add a
superseding entry here rather than editing this one. If the office adopts a
different authoritative basis (a PSA semestral figure, or a DSWD AICS means
test), that is also a new entry: this decision is about _which published
statistic_, and changing the answer changes the decision.

---

## Family registry and relationship graph (TAB 09)

### DL-47 · A household is an address; a family is a claim about people

**Status:** Settled (implemented in TAB 09).

Everything before this TAB treated the household as the unit of everything: of
service delivery (`DL-42`), of composition (`DL-43`), and — in the name of one
field — of family. `ResidentProfile.family` listed the people at the same
address. That is the assumption this decision removes.

They are different questions with different cardinalities:

- **one household may hold many families.** A widowed mother, her married son's
  family and a boarder cousin share a roof and are three units of care. The seed
  carries this case (`hh-0001`) so the falsity of "one household, one family" is
  visible on the first screen a user opens, not buried in a doc;
- **a family may have no household at all.** Between addresses, or split across
  two while work or care divides it. `Family.householdId` is nullable and the
  screen says "Not linked to a household — between addresses, or split across
  two. This is a recordable state, not missing data";
- **a relationship belongs to neither.** It is a fact about two people that
  survives both of them moving out, so relationships are recorded resident-to-
  resident and one of the seeded links deliberately crosses two families.

**What changed in existing code.** `ResidentProfile.family` is now
`householdMembers`, typed `HouseholdMemberView`. The rename is the point: a
field called `family` holding a list of housemates is the assumption stated in
the type system, and it would have been copied by everything built on top of it.

**Consequence:** `family.view` / `family.manage` exist alongside
`household.view` / `household.manage` rather than reusing them. The same roles
hold both today; keeping them apart means narrowing one later does not silently
narrow the other.

### DL-48 · Relationship history is appended to, never rewritten

**Status:** Settled (implemented in TAB 09). Extends `DL-43`'s audit trail to
relationships.

Ending a relationship sets `until` and appends an event. Leaving a family sets
`leftOn` and appends an event. **Neither deletes a row**, and there is no update
or delete counterpart anywhere in the store or the port.

The reason is not tidiness. A case study written in 2024 refers to a guardian
who is no longer the guardian, and a payout justified by a family composition
that has since changed. If the record only holds the present, every document the
office has already produced becomes unverifiable. A former member therefore
stays in the graph, marked "Former member"; an ended relationship stays in the
edge list, marked "Ended" with its date.

Every event carries four things, because a change nobody can be named for is a
change nobody is answerable for: what happened as a typed kind, who it happened
to as ids, who did it and when, and **why in their own words**. The reason is
required by the port, not merely by a form.

**Consequence:** `RelationshipEvent.subject` holds ids and enum values rather
than a rendered sentence. Wording is built at display time from the copy module,
so an event recorded today still reads correctly after the copy is rewritten.

### DL-49 · The relationship validator refuses almost nothing

**Status:** Settled (implemented in TAB 09).

Two hard refusals: a relationship from a person to themselves, and a parent link
that reverses one already on file. Everything else is permitted — two guardians,
a step-parent alongside a parent, a grandparent raising a grandchild, a family
with a child at its head.

Real families are stranger than a validator expects, and the failure mode of a
strict one is not that staff record nothing. It is that they record something
false — whatever the form will accept — and the registry becomes confidently
wrong instead of honestly incomplete. An unusual arrangement recorded accurately
is worth more than a tidy one recorded falsely.

**Consequence:** correctness for the unusual cases rests on the audit trail and
on a person being able to read the graph and disagree with it, rather than on
the software refusing to store them.

### DL-50 · The graph is the list

**Status:** Settled (implemented in TAB 09). Applies `DL-35`'s reasoning to a
relationship diagram.

There is no canvas, no SVG and no text alternative bolted beside a picture. The
primary artifact is a structured list of people, each stating in words who they
are to everyone else; CSS arranges those same list items into generation rows.
`relationship-graph.spec.ts` asserts that no `<canvas>` and no `<svg>` exists.

A diagram with an accessible summary beside it is two artifacts, and the one
that stops being maintained is always the summary. One artifact cannot drift
from itself.

What the layout is not allowed to carry:

- **generation is named in words** — "Older generation", "Younger generation" —
  so vertical position is reinforcement, never the only cue;
- **no connector lines are drawn.** A line between two boxes says nothing a
  screen reader can use, and every relationship it would represent is already a
  sentence inside the box;
- **current versus ended is stated in words with its date**, not by a colour or
  a dash pattern; a former member is labelled "Former member".

A second view lists every link exactly once as a real table. The per-person view
answers "who is this person to everyone else"; the edge view answers "what links
exist at all", which is the question somebody proof-reading the record is
actually asking. Both render from the same data.

**Consequence:** deleting the stylesheet leaves the graph fully readable. That
is the only test of "not conveyed by colour or lines alone" worth anything, and
it is the one the component is built to pass.

### DL-51 · Already done is a success, not a validation failure

**Status:** Settled (implemented in TAB 09).

Recording a relationship that already exists returns the existing record.
Repeating a transfer that has already landed returns the current state and
appends no second event. Both are checked **before** validation, not after.

This came out of a test. Validation reported "already recorded" and "that person
is not in this family" — both true, both useless as answers to a retried
request. A dropped response is the ordinary case on a municipal connection, and
a retry that fails with a true-but-unhelpful error trains staff to force the
change through another way.

The distinction that makes it safe: idempotency is keyed on the **link and the
outcome**, not on a request id. "A is the spouse of B" resolves to the existing
marriage even when stated as "B is the spouse of A", because `isSameLink`
understands symmetry. A transfer is "already applied" only when the person is
out of the named source _and_ in the named destination.

`already-recorded` remains in the domain problem vocabulary, because a _form_
should still warn before submitting. The adapter filters it out: warning a user
and refusing a request are different jobs.

**Consequence:** every mutation on `FamilyRepository` can be retried safely, and
the history contains one event per real change rather than one per attempt.

### DL-52 · A case is not an assistance request

**Status:** Settled (implemented in TAB 10).

A **case** is the office's continuing involvement with a household. An
**assistance request** is one intervention inside it. They are separate records,
and a case names the requests attached to it explicitly rather than gathering
every request the subject ever made.

The alternative — one record for both — fails in two directions. Close the
request and the history of the family goes with it; keep the request open for
three years so the history survives, and every figure the office reports about
processing time becomes fiction. A case that outlives several interventions is
the ordinary shape of social work, not an edge case.

The consequence worth naming: a person may be the subject of two open cases at
once — an older-persons file and a crisis intervention after a fire — and a
request belongs to one of them. `SocialCase.linkedRequestIds` is explicit for
exactly that reason.

**Consequence:** the vocabulary has to be taught. The case list says the
distinction in words above the table, on the same argument as `DL-47`.

### DL-53 · Closure is terminal; a recurrence is a new case

**Status:** Settled (implemented in TAB 10).

`closed` has no outward transitions, and there is no `reopen` on the port. A
household whose situation recurs gets a new case that names the old one through
`continuesCaseId`.

Reopening is the obvious alternative and it is worse. It makes "when did this
case end?" a question with several answers, none of them wrong, which is fatal
to any report on how long the office takes to close a case. It also makes the
closure — an outcome recorded by the head, with a reason and a date — editable
by anyone who happens to meet the family again.

`case.close` is held apart from `case.manage` for the same reason: ending the
office's involvement with a family is a decision, not a step.

**Consequence:** opening the continuing case is not yet buildable from the UI,
which is a real gap and is recorded as one. The alternative was a reversible
convenience that would have been very hard to take back.

### DL-54 · The audit-event seam is structural, not procedural

**Status:** Settled (implemented in TAB 10).

Every material change to a case appends a `CaseEvent` in the same act as the
change. Not afterwards, not by a caller who remembers to, and not by an
interceptor that a later refactor can unhook.

Three things hold it in place:

- **Every mutation on `CaseRepository` takes a `reason: string`.** None of them
  is optional. A change nobody had to justify is a change nobody can review.
- **`MockCaseStore` has no update or delete counterpart to `append`.** The only
  assignment to `this.events` is an append.
- **`tools/check-case-audit.mjs` fails the build** if a mutator stops appending,
  if a mutation loses its reason, or if a delete path appears. It was validated
  against six planted regressions, each of which it caught.

The reason this is enforced rather than documented: TAB 08 proved that a checker
which reads the whole file instead of each map separately misses a real
regression, and a comment saying "always write an event" survives exactly until
the third hurried change.

**Consequence:** the API inherits the same obligation. The HTTP adapter carries
the reason on every POST and has no DELETE at all.

### DL-55 · The next action is a record, not an inference

**Status:** Settled (implemented in TAB 10).

"What happens next on this case?" is answered by an open `CaseTask` with a due
date and an owner, never derived from the status.

A status can only say what the _process_ expects next. A task says what _this
office_ undertook to do, by when, and who owes it — which is the thing a
supervisor is actually asking about and the thing a caseworker can be held to.
It is also what makes the work queues meaningful: `overdue` and `due-soon`
count deadlines somebody set, not states somebody has been sitting in.

**Consequence:** a case with no open task shows "nothing is scheduled" rather
than a guess. That is a prompt to record one, and it is honest.

### DL-56 · The timeline merges the case with its interventions

**Status:** Settled (implemented in TAB 10).

`CaseWorkspace.timeline` is assembled at read time from four sources: the case's
own events, its notes, its completed tasks, and the status history of every
assistance request attached to it.

The first acceptance criterion of TAB 10 is that a caseworker can understand the
context and the next action **without opening multiple modules**. Merging on the
screen would have meant four calls read at four moments, and a page that can
show a household that has since moved beside a plan that assumed it had not.
Merging in the adapter means one read, one moment.

Timeline entries are derived, never stored. The stored events hold ids and enum
values only, so an event written today still reads correctly after the copy is
rewritten (`DL-48`, carried forward).

**Consequence:** the timeline is where the case and the money meet. "Endorsed on
the 4th, home visit on the 6th" is one column, in one order.

### DL-57 · `assigned-cases` means mine and nobody's, not mine alone

**Status:** **Superseded by `DL-179`** (casework phase 3): a caseload is the cases assigned to it, without the pool. Was: Settled (implemented in TAB 10; narrows the gap left by `DL-30`).

The `assigned-cases` data scope now narrows something. A social worker sees the
cases assigned to them **and the cases assigned to nobody**; a colleague's
caseload is withheld.

Strict "assigned to me only" is the obvious reading and it makes the
`unassigned` queue useless to the only role that would work from it — which
means work gets picked up by asking a supervisor, or not at all. An unassigned
case is not somebody else's file; it is the office's. The thing the scope exists
to withhold is a colleague's caseload, and that stays withheld.

**Consequence:** the scope still does not narrow residents, households, families
or requests. Cases are where it bites first because cases are where personal
casework detail concentrates.

### DL-58 · A withheld note is shown as withheld, never removed

**Status:** Settled (implemented in TAB 10; applies `DL-38` to case notes).

A note the reader may not open still appears — its author, its time and the fact
that it is restricted — with no body. The body is removed **in the data layer**:
`CaseWorkspace.notes` holds `CaseNoteView`, whose `body` is `null` when
withheld, so a screen cannot leak a paragraph it never received.

Dropping the entry entirely was the alternative, and it is the more dangerous
one. A caseworker who cannot see that three entries are restricted reads the
file as complete and acts as though nothing happened. Knowing that a record
exists and is not yours to read is what makes it possible to ask the right
person.

The tier is narrow on purpose: safety planning under RA 9262, anything
identifying a child in conflict with the law under RA 9344, a confidence given
in a session. Writing into it requires the clearance to read it — a note its own
author cannot re-open is a note that gets written somewhere else.

**Consequence:** `case.view-protected-note` reaches the head, social workers and
the administrator. The auditor holds `case.view` and never this: oversight is
checking that a reason was recorded and the work done in time, which does not
require reading a survivor's safety plan.

### DL-59 · Assignment offers two choices, not a staff directory

**Status:** **Superseded by `DL-179`** (casework phase 3): a case is given to a named social worker from the scoped `assignees` read this entry asked for, or to nobody. Was: Settled (implemented in TAB 10).

The workspace lets a user take a case or return it to the unassigned pool. It
does not offer a list of colleagues.

Handing a case to a named person needs a staff directory, and the roles that
assign cases day to day — intake officers and social workers — do not hold
`staff.view`. Widening that permission to fill a select box would have granted
the whole staff register in order to fill in one field, which is the wrong trade
by a wide margin. The two moves offered need no directory, and they are the two
the queues are built around.

**Consequence:** a supervisor reassigning work between two named workers cannot
yet do it from this screen. Recorded as a gap; the fix is a scoped "assignable
colleagues" read, not a broader `staff.view`.

### DL-60 · The duplicate check is evidence, never a decision

**Status:** Settled (implemented in TAB 11).

TAB 11's third acceptance criterion is that **no client is automatically
approved or denied by a simplistic frontend score**. That is not a promise the
code makes; it is a shape the code has.

`IntakeAdvisory` has no total, no score, no rating, no `eligible` and no
`recommendation`. Each signal carries three things — the **rule** it applied,
the **finding**, and the **records it read** — and then stops. All three are
rendered, because evidence held in a model and never shown is indistinguishable
from a verdict.

There are two tones and neither of them blocks. `note` is context. `caution`
asks the encoder to write a sentence before filing, and the sentence is kept
against their name. A third tone that stopped the submission would be an
automatic denial wearing a different word.

The same rule governs the assessment workspace: `assessmentReadiness` lists what
the office would normally have — a home visit, verified documents — and gates
nothing. A home visit is impossible for a household that has been relocated and
a requirement can legitimately be waived; software that refused the endorsement
there would be denying an applicant on a checklist.

`tools/check-intake.mjs` fails the build if a decision-shaped field appears, if
a blocking tone is added, if a scoring or auto-approving function is exported,
if a signal stops stating its rule or its records, or if any control in the
request templates binds `[disabled]` to the advisory or the readiness list. It
was validated against **seven planted regressions** and caught all seven.

**A note on the two review windows.** `ASSISTANCE_LOOKBACK_MONTHS` (12) and
`SAME_PROGRAMME_WINDOW_DAYS` (90) decide **how much history is shown**, and
nothing else — no grant, refusal, cap or score depends on either. They are
recorded as office review conventions rather than sourced statistics, because
no DSWD issuance fixing a numeric AICS re-application interval was verified in
this offline run. That is a deliberate contrast with `POVERTY_THRESHOLD`, which
carries a full PSA citation precisely because a decision boundary rests on it
(`DL-46`). The office should confirm both figures against its own AICS
guidelines before the first pilot, and if either ever begins to gate an outcome
it needs the threshold's treatment rather than this one.

**Consequence:** the office can be shown a duplicate and still say yes. That is
the point — a second admission for the same condition is a real thing, and the
software's job is to make sure somebody looked and said why.

### DL-61 · The online channel is modelled and withheld

**Status:** Settled (implemented in TAB 11).

`IntakeChannel` includes `online`. `OFFERED_INTAKE_CHANNELS` does not.

A channel a member of staff can select by hand is not an online submission — it
is an encoded one mislabelled, and the distinction is exactly what the field
exists to record. Modelling the value now and withholding it from the picker is
the additive half of expand–migrate–contract: when the resident app in
`Taytay_Rizal_LGUIDS_Resident_Mobile_Flutter` posts its first request, the
domain, the adapters and the reporting already understand it, and nothing has to
be migrated.

The intake screen says the option is unavailable and why, rather than leaving a
gap a reader has to guess at.

**Consequence:** `isOfferedChannel` is the retirement seam. The day the API
accepts resident-filed requests, the fallback is removed by moving one value
between two arrays.

### DL-62 · Four steps, one route

**Status:** Settled (implemented in TAB 11).

The intake flow is a **single route** with four sections, not four navigations.

The acceptance criterion is that a trained encoder completes a common intake
without excessive page changes. Four routes would refetch the applicant's
context on each one, lose an unsaved field on a mistimed Back, and put three
avoidable network round trips between the counter and the applicant standing in
front of it. Sections of one page cost nothing to move between.

The step is held in the URL as a query parameter, on the same argument as
`DL-36`: a refresh, a browser Back and a link sent to a colleague all land where
the encoder was.

The applicant's context panel sits **outside** the step switch, so it is fetched
once when the person is chosen and stays on screen for every later step. That is
what "previous resident and household context visible without retyping" means in
practice, and it is served by reusing `ResidentRepository.getProfile` — the
aggregate TAB 07 already built for this — rather than by a new query.

**Consequence:** the stepper marks which steps still have something outstanding,
because with no page change to interrupt them an encoder can otherwise reach the
end without noticing a gap.

### DL-63 · A draft is not a request

**Status:** Settled (implemented in TAB 11).

A saved intake is a `draft` request with **no control number**. It is listed in
its own section above the request table, never as another row in it.

Two things follow, and both matter. Nothing has been filed, so nobody is waiting
on an answer and the office's reported workload does not include it — mixing the
two would inflate every count the office publishes. And no reference number has
been issued, because handing an applicant a number for a record that may never
be filed is how an office ends up honouring one. The control number is issued at
filing, which is the moment the office takes responsibility.

`saveDraft(draft, id)` is **idempotent on the identifier the caller holds**:
`null` creates, an id updates. Two taps on a slow municipal connection produce
one draft. `submitIntake` is idempotent too — a retried submit returns the filed
request rather than a refusal the encoder cannot act on (`DL-51`, carried
forward).

**Consequence:** the acknowledgement is re-derived on the server at submission
and compared with what the client sent. A client that decided for itself whether
a caution applied could be told not to need one.

### DL-64 · Case closure remains terminal — recorded with its sources

**Status:** Settled (affirmed in TAB 11; does not alter `DL-53`).

The supervisor confirmed the TAB 10 lifecycle decision after review: **a case
that is closed stays closed, and a later welfare need opens a linked successor
case rather than rewriting the closed outcome.** `DL-53` is unchanged and this
entry adds nothing to the code; it records the reasoning and the sources so the
next reader does not have to reconstruct them.

Why it holds:

- **The historical finding is preserved.** The closure states what the office
  concluded and when. Reopening would put that conclusion back within reach of
  anyone who meets the family again, and would make "when did this case end?" a
  question with several defensible answers — fatal to any report on how long the
  office takes to close a case.
- **Audit integrity.** Every case change is an appended event with a reason
  (`DL-54`). A reopening is the one operation that would ask the record to mean
  something different than it did, rather than to say something further.
- **Purpose limitation and retention.** A closed file is retained as a record of
  what was done, not kept open as a live working surface. Reopening quietly
  re-enlarges the purpose the data is being processed for.
- **Explicit continuity.** `continuesCaseId` makes the link between episodes a
  stated fact rather than an inference from a status history.

Sources, **supplied by the supervisor** and recorded here as given:

| What it supports                                              | Source                                                                                                                                                               |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Closure occurs when the client's needs are met                | DSWD Field Office 1, PWD services process — <https://fo1.dswd.gov.ph/pwds/>                                                                                          |
| Aftercare / turnover once an intervention plan is completed   | DSWD, Social Case Management Service rollout — <https://www.dswd.gov.ph/dswd-rolls-out-case-management-system-for-former-rebels-conflict-hit-families-in-zambopen/>  |
| Purpose limitation, minimisation, retention only as necessary | NPC, IRR of the Data Privacy Act of 2012 — <https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/>                                            |
| Controlled access, auditability, archival obligations         | NPC Circular 16-01, Security of Personal Data in Government Agencies — <https://privacy.gov.ph/npc-circular-16-01-security-of-personal-data-in-government-agencies/> |

**These four URLs were not fetched in this offline run.** They are recorded as
the supervisor's researched citations, on the same honesty rule that governs
`CLAUDE.md` §6: a citation nobody verified is labelled as such rather than
presented as checked. A TAB that turns on the precise wording of any of them
should retrieve the primary text first.

**Consequence:** the known gap stands — opening the successor case is not yet
buildable from the UI, and that screen is the natural next piece of case work.
The gap is the price of the guarantee, and it was accepted deliberately.

### DL-65 · Whose programme it is, is a field

**Status:** Settled (implemented in TAB 12).

Every programme carries a `ProgramResponsibility`: who administers it, who holds
the funds, what the municipality's part is, the sentence staff may repeat, and
the sources it rests on. The screens render that record; they do not compose a
description from conditions.

**This corrected a live defect.** The seed described AICS — Medical and Burial —
as funded by the "Municipal social welfare fund". AICS is a DSWD programme with
DSWD-disbursed funds; the LGU refers into it and may augment. An applicant told
the municipality funds it expects a decision the office cannot make, and the
office quietly claims national work as its own.

`responsibilityProblems` refuses the combinations that misrepresent:

- a **national programme recorded as one the municipality runs**;
- an **augmenter that does not hold the funds** — the same error from the other
  side;
- a claim about another agency's programme with **no source**;
- a role with **no statement** a member of staff could actually say.

Enforced three times over, because one is not enough: the form does not offer
the impossible role, the adapter refuses the write, and
`tools/check-programs.mjs` fails the build. It was validated against **six
planted regressions** and caught all six.

Sources, **supplied by the supervisor and not retrieved in this offline run** —
which is why every `verifiedOn` is `null` and the screen says so:

| What it supports | Source |
| --- | --- |
| AICS is a DSWD service | <https://aics.dswd.gov.ph/aics-program/> |
| AICS/AKAP funds are agency-disbursed; LGU and legislator referrals remain subject to DSWD assessment | <https://aics.dswd.gov.ph/2024/11/akap-aics-are-dswd-programs-with-agency-disbursed-funds-dswd-chief/> |
| AICS serves cases especially where LGUs cannot accommodate them | <https://caraga.dswd.gov.ph/programs-and-projects/assistance-to-individuals-in-crisis-situation-aics/> |
| LGU systems with automated decision-making require DPA compliance | <https://privacy.gov.ph/npc-commends-new-dilg-issuance-enhancing-data-privacy-compliance-among-lgus/> |

**Consequence:** where the office does not decide, the screen says so in as many
words. "We referred it" and "we approved it" are the two sentences an applicant
most needs told apart.

### DL-66 · Programme rules are records, not code

**Status:** Settled (implemented in TAB 12).

Eligibility is a list of `EligibilityGuideline`s. Each states what the office
looks for, how firmly (`expected`, `usual`, `context`), on whose authority
(`statute`, `issuance`, `office-convention`), and whether anybody has read the
source. The catalog screens render whatever they are handed.

No component may branch on a programme code or id, and the checker fails the
build if one does. That is what makes the second criterion true: a policy change
is an edit to a record, and the UI does not move.

**None of the three weights refuses anybody.** A fourth meaning "disqualify"
would turn the catalog into the decision engine that `DL-42` and `DL-60` exist
to prevent, and DSWD describes AICS the same way — a screening and database
cross-match followed by a licensed social worker's interview and assessment,
not an automatic disposition
(<https://dswd.gov.ph/request-for-assistance-under-aics-now-easier-for-clients-dswd/>,
<https://www.dswd.gov.ph/aics-and-akap-benefitted-countless-poor-pinoys-dswd-chief-dismisses-claims-the-2-programs-are-being-used-for-political-ends/>;
neither retrieved in this run). The NPC's right-to-be-informed guidance points
the same way: automated decision-making carries disclosure duties this
application avoids incurring by not making decisions
(<https://privacy.gov.ph/the-right-to-be-informed/>).

There is deliberately **no port method** that takes a person and a programme and
answers whether they qualify.

**Consequence:** `ProgramRepository` grew `save`, and nothing that evaluates.

### DL-67 · One template, one wording

**Status:** Settled (implemented in TAB 12).

Shared documents live in a `RequirementTemplate`. A programme names one and adds
its own on top; `resolveRequirements` merges them, with the programme's entry
winning on a shared code.

Before this, every AICS programme retyped the same three documents — which is
how one certificate ends up spelled three ways and waived under two names in a
report. Resolving at read time rather than storing a flattened copy means
correcting the template corrects every programme using it.

**Consequence:** the detail screen labels each document "From template" or "This
programme", so an editor can see what is shared before changing it.

### DL-68 · The review windows get a home without moving

**Status:** Settled (implemented in TAB 12; carries `DL-60` forward).

`ASSISTANCE_LOOKBACK_MONTHS` (12) and `SAME_PROGRAMME_WINDOW_DAYS` (90) stay
exactly where TAB 11 put them, with their values unchanged, so every TAB 11 call
site and test is untouched. `DEFAULT_REVIEW_WINDOW` is **built from them**, so
there is one number rather than two that can disagree, and a programme may carry
its own `ReviewWindowPolicy` where it needs one.

The point of the exercise is the `provenance` field. A window still marked
`convention-pending-confirmation` says so on the programme screen, in a box that
does not go away, until somebody records that they checked it against Taytay's
own AICS guidelines. **That is the measurable retirement condition** the
supervisor asked for: the fallback is retired when `provenance` moves off that
value, and a confirmed window must name what settled it and when.

The windows remain non-blocking. They change how much history an encoder is
shown and nothing else — no request is approved, refused, ranked or suppressed
by them.

**Consequence:** expand-only. Nothing was migrated, nothing broke, and the
office can now set a window per programme without touching code.

### DL-69 · Utilization describes the past; it is not a budget

**Status:** Settled (implemented in TAB 12).

`ProgramUtilization` counts what was filed, what was approved and what was
actually handed over. It has no "remaining", no "balance" and no ceiling.

This front end does not hold the appropriation. A remaining balance computed
from grants alone would be a number the office would be asked to honour, and it
would be wrong the first time a supplemental budget landed. Drafts are excluded
from the count, because a draft is not a request (`DL-63`).

**Consequence:** the screen states in words that it is not a budget position,
and a programme nobody has used returns zeros rather than being absent — an
unused programme is a thing a supervisor should be able to see.

### DL-70 · A filed request never attaches itself to a case

**Status:** Settled (affirmed in TAB 12; no code change).

The supervisor confirmed the rule: cross-matching may **surface** a candidate
case, but an authorised worker must link it explicitly, with a reason and an
audit event. Retries are idempotent and history is append-only.

Nothing in TAB 12 introduced auto-attachment, and nothing in the catalog is
permitted to. The intake advisory already raises an open case as a `note`
saying the request *may* belong inside it (`DL-60`), and `SocialCase.linkedRequestIds`
names its interventions explicitly (`DL-52`) rather than gathering them by
inference. This entry records the reasoning so the next TAB does not "helpfully"
close the loop.

Why it holds: an automatic link is an automatic disposition in miniature — it
decides that this need belongs to that ongoing involvement, which is a
caseworker's judgement about a family, and it would do so without a reason
anybody could later read. DSWD's own description places a licensed social
worker's assessment between the cross-match and any consequence, and the NPC
requires that automated decision-making and profiling logic be disclosed with
its consequences. Not deciding is cheaper than disclosing a decision nobody
wanted.

Sources, **supplied by the supervisor and not retrieved in this offline run**:

| What it supports | Source |
| --- | --- |
| Screening and database cross-match, then interview and assessment | <https://dswd.gov.ph/request-for-assistance-under-aics-now-easier-for-clients-dswd/> |
| Referrals remain subject to licensed social-worker assessment and validation | <https://www.dswd.gov.ph/aics-and-akap-benefitted-countless-poor-pinoys-dswd-chief-dismisses-claims-the-2-programs-are-being-used-for-political-ends/> |
| Notice of automated decision-making and profiling logic and consequences | <https://privacy.gov.ph/the-right-to-be-informed/> |

**Consequence:** linking a request to a case remains a known gap with a
deliberate shape — when it is built, it takes a reason and appends an event,
like every other case mutation (`DL-54`).

### DL-71 · A beneficiary is a standing, not a record

**Status:** Settled (implemented in TAB 13).

There is no `Beneficiary` entity, no `BeneficiaryId` and no beneficiary store.
The registry is a **projection over the resident registry**, keyed on
`ResidentId` from the port down to the route parameter.

The master command asks that a resident, an applicant, a beneficiary and a
programme enrollee be *roles a person holds, not separate person records*, and
that one person retain one canonical identity across every programme. Those are
the same requirement stated twice, and the only way to satisfy it reliably is to
leave no second record for a person to drift into. `deriveStanding` computes the
four roles from what the office actually did — a live request, a released
payout, a standing enrollment — and returns the counts it used, which the detail
screen renders beside each role.

The roles are **not exclusive**. A senior may be on the pension list, have
received a burial grant last year and have a medical request open this morning.
A model that made these mutually exclusive would force the office to pick one
and lose the other two, and the one it lost would be the one somebody needed.

Standing is derived rather than stored for the same reason a vulnerability
factor states its arithmetic: a stored flag can be wrong while the records say
otherwise, and nobody would know which to believe. `check:beneficiary` fails the
build on a `BeneficiaryId`, on a `beneficiaryId` field, and on a stored
`isBeneficiary`-style flag.

**Consequence:** `ResidentProfile` and `BeneficiaryDetail` both assemble history
through **one** function, `historySummaryFor`, extracted from the resident
adapter in this TAB. Two screens that assembled the same history separately
would eventually disagree about what a family received, in front of the family.

### DL-72 · The history is one sequence, and every line cites a record

**Status:** Settled (implemented in TAB 13).

`buildAssistanceTimeline` merges four record types — requests, payouts,
referrals and enrollments — into one ordered sequence, newest first. Read as
four lists side by side, the question a caseworker actually asks ("what has this
office done for these people, and when?") cannot be answered without mentally
interleaving them.

Two rules are enforced by `check:beneficiary`:

- **Every entry names its source.** `sourceKind`, `sourceId` and `reference` are
  required and non-nullable, so any row on screen can be opened and checked. A
  timeline that summarises without citing is a story.
- **Nothing is invented.** No derived milestones, no expected next step, no
  filled-in gaps.

Two omissions are deliberate. An **unfiled draft** has no `submittedAt`, and
dating it to now would assert something that did not happen (`DL-63`). A
**scheduled payout** is a plan, not a receipt, and counting it as history would
tell a family they had received money that is still in the drawer.

The four status vocabularies stay four: `TimelineEntryStatus` is a discriminated
union and each entry renders through the catalog that already owns its wording
and tone. A fifth source type is a compile error rather than an unlabelled row.

Entries sharing a timestamp are broken by `key`, giving a total order. Without
it the same history renders differently on each read, which makes a screenshot
useless as evidence and a test flaky for reasons nobody can reproduce.

**Consequence:** the timeline component is `shared/`, not feature-local — the
household and case screens will want the same list.

### DL-73 · The duplicate queue compares without disclosing

**Status:** Settled (implemented in TAB 13).

A duplicate queue is, structurally, a machine for showing one person's details
to somebody who came to look at another person's record. So the comparison
reports **agreement, not values**: "both records carry the same date of birth",
never the date.

`MatchSignal` carries an attribute, an outcome and the rule that produced it.
The matcher reads values and emits none. The panel that renders a comparison
cannot leak a birth date or a PhilSys fragment because it is never handed one —
defence in depth, since a reviewer clearing a queue is looking at somebody who
is not their client, and a template with the values in scope is one careless
binding away from disclosing them.

Three details of the shape are load-bearing:

- **`not-comparable` is not `differs`.** One record lacking a mobile number is
  no evidence that two people are different, and scoring absence as
  disagreement would hide real duplicates behind incomplete profiles.
- **Each signal states its rule**, so a reviewer can disagree with the machine
  on its own terms (`DL-60`, carried into identity review).
- **Three bands, no score.** `strong`, `moderate`, `weak` order the queue and
  resolve nothing. Merging two people's welfare histories on a percentage is
  precisely what this shape prevents, and a fourth band would be a disposition
  in disguise. `check:beneficiary` fails on a numeric score, on a threshold, and
  on a fourth band.

The one disclosure made by default is a masked name on both sides
(`Mercado, A.`), on the reasoning already settled for `formatProtectedName`: a
reviewer who can see nothing can review nothing.

Enforced in the data layer as well as the view: a caller without
`beneficiary.review-duplicates` receives **no candidates at all**, rather than
candidates it is trusted to hide.

**Consequence:** the beneficiary list carries a boolean
`hasOpenDuplicateReview` and not the candidate. A list everybody scrolls past is
the wrong place to name the other person.

### DL-74 · Resolving an identity is a finding, never a merge

**Status:** Settled (implemented in TAB 13).

The master command says never auto-merge without an explicit reviewed action.
This goes further: **there is no merge at all**, reviewed or otherwise.

Resolving a pair records a judgement with a required reason and the reviewer's
identity:

- **`same-person`** names the record the office keeps using and supersedes the
  other. Both records survive, and so does every request, payout, case and
  enrollment attached to either. The superseded record stops appearing as its
  own entry in the list and stays readable by id.
- **`distinct-people`** is recorded just as deliberately. Without it the same
  pair resurfaces in the queue forever, and a reviewer who has already answered
  is asked again until they answer wrong.

Why not merge, when merging is what a duplicate ordinarily means: welfare
history is the evidence that an office did or did not help a family, and a merge
rewrites it irreversibly on the strength of a clerk's judgement about two names.
A finding is reversible by a later finding; a merge is not reversible by
anything. The append-only doctrine that governs cases (`DL-54`) and relationships
(`DL-48`) applies here with more force, not less.

`resolveIdentity` is **idempotent on the pair** — a double tap on a municipal
connection records one finding — and refuses the *opposite* verdict for an
already-answered pair rather than silently overwriting it. A correction is a new
act with its own reason, and there is no screen for it yet: a stated gap.

`previewResolution` describes what would be **carried across**, never what would
be deleted, because nothing is. It names programmes appearing under both records
without resolving them: which of two payouts was the real episode is an office
judgement, and guessing would quietly rewrite what a family was given.

Permissions follow the same logic. `beneficiary.review-duplicates` is **not**
held by the intake officer, whose counter usually created the second record, and
**not** by the auditor, whose oversight would otherwise be able to alter the
identities it is checking.

**Consequence:** `check:beneficiary` fails the build on any merge or delete of a
person across the domain, the adapters and the screens, and on any
auto-resolution. Validated against **twelve planted regressions**, all twelve
caught — one of which exposed a real defect in the checker itself, where a
required reason on the draft was masking an optional one on the finding.

### DL-75 · An enrollment ends, and the ending is kept

**Status:** Settled (implemented in TAB 13).

Standing programme membership is a `ProgramEnrollment`, distinct from an
assistance request: a request is one intervention with an end, an enrollment is
a continuing relationship that produces interventions over years. Not every
programme has one — one-off crisis assistance does not, because there the
request *is* the whole relationship.

`exited` is terminal, on the same reasoning as case closure (`DL-53`). Somebody
who returns is enrolled afresh and the new record names the old one through
`continuesEnrollmentId`, so "how long were they on it?" keeps a single answer.

Every exit carries a reason from a fixed vocabulary and a **required note**,
because the reasons are not interchangeable: ageing out of a youth programme and
being removed for cause are different facts about a person, and only one of them
should ever colour how the next application is read.

`enrollmentProblems` refuses the combinations that would let a screen and a
report disagree about whether somebody is on a programme — an exited record with
no exit, an exit on a standing one, an unexplained exit, an exit dated before the
enrollment, and an enrollment that continues itself.

**Consequence:** enrollment is read-only in the UI for now. The states exist and
are validated; the screen that records them is a known gap, listed in
`docs/beneficiaries/README.md`.

### DL-76 · A document is required, optional or conditional — and a person rules on it

**Status:** Settled (implemented in TAB 14; supersedes the `isMandatory` boolean).

`ProgramRequirement.isMandatory` and `SubmittedRequirement.isMandatory` are
replaced by a `RequirementObligation` of `required`, `optional` or
`conditional`.

The boolean could not say *"only if you are claiming for a child"*. Faced with
such a document the office had two bad options: record it as required, and every
applicant who did not need it appears to be missing one; or record it as
optional, and nobody chases it from the applicants who do. Both are wrong in
front of a family.

A conditional requirement carries `appliesWhen` — the circumstances, **written
for a person to read** — and an applicability of `undecided`, `applies` or
`does-not-apply`. **The software never evaluates the condition.** It states it,
and a staff member rules on it with a recorded reason and their name. That is
the same refusal to decide that governs vulnerability factors (`DL-42`), the
intake advisory (`DL-60`) and eligibility guidance (`DL-66`); here it would
otherwise decide either that an applicant owes a paper they never needed, or
that a paper the office does need was never asked for.

**An undecided conditional is not outstanding.** Nobody has said it applies, so
nothing is missing yet — it surfaces as a decision the *office* owes, which is a
different prompt aimed at different people. `awaitsApplicabilityDecision` exists
to keep those two apart.

`isOutstandingObligation` is the single derivation, and everything that read
`isMandatory` now reads it: a conditional document cannot be counted one way on
a checklist and another way in a report.

Two statuses were added at the same time. `expired` and `needs-replacement` are
held apart from `rejected` because the applicant did nothing wrong — telling
somebody their certificate was "rejected" when it merely lapsed is inaccurate,
and needlessly bruising at a counter.

**Consequence:** a 57-site migration across seeds, adapters, screens and specs,
rather than adding `obligation` beside the boolean. Two sources of truth for
"must they bring this?" would be worse than either one alone.

### DL-77 · Replacing a document appends; it never overwrites

**Status:** Settled (implemented in TAB 14).

A `RequirementDocument` is an **append-only list of `DocumentVersion`s**.
Recording a replacement marks the previous version `supersededAt` with a
**required** `supersededReason` and appends a new one. Version numbers are
assigned from the length of the history and never reused: version 3 stays
version 3 forever.

Nothing in the domain, the ports, either adapter or any screen removes a
version. There is no `deleteDocument`, no `replaceVersion`, and no path that
reassigns `versions` to a filtered copy — the last of which is how an overwrite
usually disguises itself.

Why this rather than a file with a pointer: the superseded version is the
evidence of what the office actually read when it decided. A request approved in
March on a certificate reissued in June has to remain explicable in December,
and an overwriting model makes that permanently unanswerable — not merely
inconvenient. The append-only doctrine that governs case events (`DL-54`) and
relationships (`DL-48`) applies here with more force, because this is the
evidence rather than the narrative.

Two shapes follow from it:

- **`openDocument` returns a grant, not a URL.** An opaque, short-lived handle
  plus the warning to show first. A model carrying a link is one copy-paste from
  an unauthorised download, and a read the server never sees cannot be logged.
  The warning is composed server-side because only the server knows whether the
  record is handled under a protected sector; a client-side guess would be
  reassuring exactly when it should not be.
- **`encoded` and `external-verification` hold no file.** The office routinely
  verifies a document without keeping a copy, and inventing an empty file for
  those cases makes "is there something to open?" a question the screen has to
  guess at.

Numbers are masked to their last four characters by default (`maskDocumentNumber`),
on the same reasoning that limits the PhilSys reference to four digits
(RA 11055, `CLAUDE.md` §6.2): enough to confirm the right paper is in hand, not
enough to reconstruct an identifier. A number short enough that masking would
reveal most of it is masked whole.

**Consequence:** `check:documents` enforces all of it and was validated against
**thirteen planted regressions, all thirteen caught**. Two of them exposed real
holes in the checker itself — a file-wide search for `'replacement-needs-a-reason'`
passed while the rule raising it was commented out, because the string survived
in the `DocumentProblem` union; and the same failure for `'undecided'`, which
survived in a comparison after being removed from the type. Both checks are now
scoped to the declaration they are about. A third plant reported "stale" against
a real anchor because the repository checks out CRLF on Windows.

### DL-78 · Requirement completion counts; it never decides

**Status:** Settled (implemented in TAB 14).

`RequirementCompletion` carries counts and nothing else. There is deliberately
no `isComplete`, no `isEligible`, no `canApprove` and no percentage promoted to
a verdict, and `check:documents` fails the build if a decision-shaped field
appears.

The master command is explicit — show completion at case level, but never equate
100% document completeness with automatic eligibility. This is the **fourth**
surface where the same doctrine has had to be enforced (`DL-42`, `DL-60`,
`DL-66`), and it is the one where the temptation is strongest, because a
complete checklist genuinely *looks* like a green light in a way a vulnerability
indicator does not.

`describeCompletion` returns the sentence stating the boundary — "Eligibility is
still a caseworker's decision" — **from the domain**, not from a template. A
template is exactly where such a sentence gets shortened to "Complete" by
somebody tidying up, and the checker also verifies that a screen actually
renders it: a rule held and never shown is the same omission it was written to
prevent.

The counts keep four things apart that a single "outstanding" number would
merge: documents genuinely outstanding, conditional documents awaiting a
decision, documents presented but not yet checked, and documents needing another
copy. Only the first is the applicant's to act on.

**Consequence:** the assessment workspace shows counts and the sentence
together, and there is no state in which the screen says a request is ready.

### DL-79 · A permission is a read or a write because it is listed, not because of its name

**Status:** Settled (implemented in TAB 14; corrects a latent defect).

`MUTATING_PERMISSIONS` was derived by name shape: anything not ending in
`.view` and not starting with `report.` counted as mutating. TAB 14 broke it.
`document.download` reads a file and changes nothing, but by its spelling it
made the **auditor** — a read-only role by definition — look like a role that
could alter records, and `isReadOnlyRole('auditor')` began returning false.

The heuristic was always going to fail on the first read whose name did not end
in `.view`; it simply had not been written yet. `READ_ONLY_PERMISSIONS` is now an
explicit list, which fails the other way: a genuinely new *mutating* permission
is treated as mutating by default, and a new read has to be added deliberately
by somebody who thought about it. That is the safe direction for a
classification that separation-of-duties checks depend on.

**Consequence:** caught by an existing test rather than in production — the
permission matrix spec asserts the auditor is read-only, and it failed the moment
the permission was added. A test asserting a property, rather than a snapshot of
current values, is what made a naming heuristic's failure visible.

### DL-80 · The offices we refer to are a directory, not a text field

**Status:** Settled (implemented in TAB 15).

`ServiceProvider` records the destinations the MSWDO refers into: what each
office actually does, how to reach it, which channels it accepts, and how long
it usually takes to answer.

The failure this prevents shows up at a counter rather than in a database.
"PhilHealth Rizal", "Philhealth - Rizal" and "PHIC Rizal" are three spellings of
one office. Once they exist, an applicant asking whether anybody has heard back
cannot be answered, and a report on referral outcomes counts one destination
three ways — which is how an office concludes that a provider never responds
when in fact two thirds of its referrals were filed under other names.

Carrying `servicesOffered` is the second half: a referral sent to an office that
does not do this work costs the family a trip they cannot afford.

`suspended` and `retired` entries are **listed, not hidden**. A worker who
cannot see that a shelter is full will keep sending families there, and a retired
entry has to stay readable or the referrals attached to it stop making sense —
the same reasoning that keeps a superseded document version (`DL-77`).

**Consequence:** `providerProblems` refuses an entry with no channel, no way to
reach it, or no stated service. A directory row that cannot be sent to is a
name, and sending to it produces a referral nobody can follow up.

### DL-81 · A referral cannot be sent without a lawful basis

**Status:** Settled (implemented in TAB 15).

`ReferralRepository.send` takes a `DisclosurePlan` and refuses without one. The
plan carries a `DisclosureAuthority` — `client-consent`, `statutory-mandate` or
`vital-interest` — with a **required note** saying what the client was told,
which law applies, or what the risk was.

The basis is a parameter of the sending rather than a field set earlier, and
that is the whole design. Recording authority and transmitting are one act, so
there is no window in which a referral sits authorised-but-unsent or, worse,
sendable-but-unauthorised.

Three bases rather than one because consent alone would be its own failure.
Insisting on written agreement from somebody unconscious in an emergency room,
or from a child at risk, would mean either not referring or lying about consent
on the record. `vital-interest` requires the worker to say what the risk was,
which is the honest version of what they would otherwise have written anyway.

This is the Data Privacy Act's lawful-basis, minimisation and purpose-limitation
duties (RA 10173) expressed as a function signature rather than a paragraph in a
manual — the same move as `DL-77`'s access grant. **Not verified against the
statute text in this offline run**; a TAB that turns on the precise wording of a
basis should retrieve the IRR first.

**Consequence:** the seed carries a referral in `draft` with `disclosure: null`,
so the refusal is exercised by a record that reached that state honestly.

### DL-82 · What leaves the building is chosen a field at a time

**Status:** Settled (implemented in TAB 15).

The referral summary is **composed** by `composeReferralSummary`, not laid out by
a template. The minimum is the client's name, the reference number and the
reason — enough for the receiving office to know who is coming and why.
Everything else is a `SharedFieldChoice` with a required `because`.

There is deliberately no "share full profile" switch. A single switch is ticked
once and forgotten; naming each field makes each one a decision somebody made
and can be asked about. `check:referrals` fails the build on a bulk share.

Three details are load-bearing:

- **A withheld field is omitted, not blanked.** A line reading "Address:
  withheld" tells the reader there is an address worth hiding, which for a
  protection case is itself the disclosure.
- **A chosen field the record does not hold is skipped**, because an empty line
  invites the receiving office to ask for it.
- **The composer reads `ResidentView`**, so a field the sender was not cleared to
  see is not there to share. The redaction is inherited from `DL-38` rather than
  re-implemented, and the adapter additionally refuses to send extra fields when
  the sender's own view was redacted.

The sheet prints the basis it was shared on and a handling notice naming
RA 10173 — so the receiving office knows the purpose limitation it holds the
information under, rather than being left to assume there is none.

**Consequence:** no referral screen may render a resident field directly, and
`check:referrals` enforces it. The screen is handed a sheet already reduced; a
page holding a fuller record is a page that will eventually print from it.

### DL-83 · Overdue is derived, and moving the date is a recorded act

**Status:** Settled (implemented in TAB 15).

A referral is overdue when the office said it would chase by a date, that date
has passed, and nobody has heard back. `isReferralOverdue` computes it; nothing
stores it. A stored flag would need a nightly job to stay true and would be
wrong every morning until it ran.

The default follow-up date comes from urgency — 2, 7 or 14 days — and is offered
rather than imposed, because a provider that answers in a day and one that
answers in a month are both real and neither is described by a constant. The
window is the office's own convention, recorded as `FOLLOW_UP_BASIS` and
unconfirmed against a written issuance in this offline run.

`reschedule` takes a **required reason and appends it as a note**. Moving a chase
date quietly is precisely how an overdue referral stops being overdue without
anybody acting on it — the queue goes green and the family is still waiting.

Urgency is described in the domain as advisory to the receiving office and
operational to us: it orders our queue and sets our own chase date, and confers
no priority the MSWDO can actually grant over another office's work. The screens
do not imply otherwise.

**Consequence:** the queue is ordered overdue-first, then by urgency, then
oldest — computed by `byReferralUrgency` rather than left to a sort dropdown,
because the order the work is actually done in should not depend on which column
somebody last clicked.

### DL-84 · The referral adapter had no permission checks at all

**Status:** Fixed in TAB 15.

`MockReferralRepository.list` and `.getById` returned seeded referrals to **any
caller, including an unauthenticated one**, with no barangay scoping. Every
other adapter in this application opens with `denyUnless`; this one never did.

It was not caught earlier because the `/referrals` route was a placeholder, so
nothing reachable called it — the `check:access` detector reads routes and
registration surfaces, and a repository nobody routes to has no surface to
inspect. That is the same shape as `feedback_foundation_without_callers`: the
hole was in a foundation whose call sites did not exist yet.

A referral is not a low-value record. It names a client, a receiving office and a
reason, which together disclose more than most single records here — that
somebody is a VAWC survivor is inferable from the destination alone.

**Consequence:** `check:referrals` now asserts that `list`, `forResident`,
`queue` and `listProviders` each check permission and that the adapter applies
barangay scope, so this cannot regress once the screens exist. The lesson
generalises: an adapter written ahead of its screens should be audited when the
screens land, because until then nothing exercises it.

### DL-85 · An observation says whose claim it is

**Status:** Settled (implemented in TAB 16).

A `VisitObservation` carries a **kind**: `observed`, `client-said`,
`third-party-said` or `worker-assessed`. A third-party account must name who
said it, and an attribution on any other kind is refused.

Consider three sentences a worker might write in one paragraph after a home
visit:

- "The roof is missing sheets over the sleeping area."
- "She says her husband has not sent money since March."
- "The household appears unable to meet its own food costs."

The first is checkable by another visit. The second is a report the office is
repeating, and may be wrong without anybody lying. The third is a professional
judgement a later reader may disagree with. Written as prose they become
indistinguishable, and six months on a different worker reads all three as
established fact about the family — at which point the family is arguing with a
record rather than with a person.

Nothing here prevents recording a judgement. It prevents a judgement being
mistaken for something the family said.

Three details make it real rather than decorative:

- **The form asks for the kind first.** A worker who has already written a
  paragraph will not go back and reclassify it.
- **The kind is rendered**, and `check:visits` fails the build if no screen
  shows it. A distinction held and never displayed is the same collapse.
- **`isAllJudgement` surfaces a record built only of assessments.** Not blocked
  — a doorstep conversation can legitimately produce one — but visible, because
  that is the shape that hardens into a label.

Observations are **appended, never edited or removed**. A worker correcting an
earlier one records another saying so, on the same append-only doctrine as case
events (`DL-54`) and document versions (`DL-77`).

**Consequence:** an unattributed "a neighbour said" is refused. It is a rumour
the office cannot check and cannot answer for.

### DL-86 · The visit model holds no location, and the absence is enforced

**Status:** Settled (implemented in TAB 16).

There is no coordinate, no check-in time, no arrival or departure timestamp, no
route and no `navigator.geolocation` call anywhere in the visit domain, its
adapters, its seed or its screens. `check:visits` scans all of them and fails
the build on any of it.

The master command forbids continuous location tracking, covert tracking,
geofencing of clients and background surveillance. Those are easy to refuse as
*features* and easy to acquire as *fields*. A "visit location" column added in
good faith to help a supervisor plan routes is the first half of a system that
records where poor families live and which worker was outside their door at
which minute. The second half arrives as a reporting request a year later, and
by then the data exists.

So the absence is asserted rather than intended. The check is written against
the names such a field arrives under — `latitude`, `coordinates`, `checkedInAt`,
`geofence`, `getCurrentPosition` — and validated against planted regressions
that add each one.

What the visit *does* record is `addressVisited`, **copied** from the household
at scheduling rather than referenced. A household that later moves must not
silently rewrite where a past visit was made; the record would then claim the
worker went somewhere they did not.

**Consequence:** if visit coordinates are ever genuinely needed, that is a
deliberate change with its own decision entry, its own permission and its own
disclosure — not a field somebody adds.

### DL-87 · A field capture never says "probably saved"

**Status:** Settled (implemented in TAB 16).

`CaptureState` is `held-locally`, `sending`, `sent` or `send-failed`. **Exactly
one of them means the office record has it**, and a test asserts that.

Field work happens where the signal does not. The master command is explicit:
do not promise offline transactional integrity without a backend strategy, and
never silently queue a sensitive submission without the user's knowledge. So the
failed state says in words that **nothing was queued in the background** and the
worker must send it again.

A worker who believes a visit was filed and returns to the office to find it was
not has been failed twice — once by the network and once by the interface. The
second failure is the one this application controls.

`unsentWarning` is returned from the domain rather than written in a template,
so it cannot be softened into "you have unsaved changes" — which reads as a
browser nuisance rather than a warning that a family's visit record is about to
be lost. `warnsOnLeaving` includes `sending`, because navigating away mid-send
leaves the worker unable to find out whether it landed.

**Consequence:** no optimistic UI on a visit write. The screen reports what the
data layer confirmed, and nothing else.

### DL-88 · Every visit outcome is terminal, and nobody-home is not a refusal

**Status:** Settled (implemented in TAB 16).

`completed`, `not-found`, `refused` and `cancelled` all transition nowhere. A
second attempt is a **second visit**, so "how many times did we go?" keeps one
answer and a visit that happened cannot be re-described a week later.

`not-found` and `refused` are held apart deliberately, and both apart from
`cancelled`:

- **Nobody home** is the household doing nothing. The status description says
  so in as many words, because a worker reading "failed visit" writes a
  different case note than one reading "nobody home".
- **Declined** is a decision the household made, and their reason is kept in
  their words when they gave one. `visitOutcomeProblems` refuses a declined
  reason on any other outcome: attaching one to a completed visit would put
  words in a household's mouth.
- **Cancelled** is the office calling it off, which is the office's own fact.

The vocabulary matters more here than in most modules because these words end up
describing a family to the next worker who opens the file. "Non-compliant" would
be a label the office then acts on; "nobody home" is what happened.

**Consequence:** the screens carry the same distinction — the list heading for a
missed visit says the office owes it, not the family.
### DL-89 · This module tracks releases; it is not the treasury system

**Status:** Settled (implemented in TAB 17).

The master command asks for release, distribution and release **tracking**.
It supplies no chart of accounts, no fund codes, no bank integration, no posting
rules and no reconciliation process — because those live in the municipality's
accounting and treasury systems, which this application does not replace and was
never given the rules for.

So no accounting concept is invented here. `fundingSourceLabel` is exactly what
its name says: a **label the office was given**, held as text beside the record,
posting to nothing. `approvingReference` is a document reference, not a link into
an approval engine. There is no ledger, no journal entry, no account code, no
debit or credit, no bank account and no posting date anywhere in the domain, the
adapters, the ports or the screens, and `npm run check:releases` fails the build
if one appears.

The failure this prevents is specific and expensive. A field called
`accountCode` looks harmless for a month. Then somebody exports it, an accounting
clerk reconciles the municipal books against it, and the two systems disagree —
at which point the question is which one is right, and this one has no answer,
because nothing here was ever a posting.

The boundary is stated **on the screen**, not only here: a disbursing officer
reading the release detail is told that this records what the office handed over
and posts nothing to the books. A rule an office never sees is one it will
discover by being wrong about it.

**Consequence:** if the LGU later supplies real accounting rules, they arrive as
a backend integration with its own contract — not as fields quietly added to
`Release`.

### DL-90 · A payout session has no status of its own

**Status:** Settled (implemented in TAB 17).

The master command is explicit that batch tools must never hide individual
status. The concrete failure is a batch marked "released" while three people in
it went home with nothing, and nobody able to say which three.

`ReleaseBatch` therefore carries **no status field**. It is a plan — a date, a
venue, an officer and a list of releases — and what it amounts to is derived by
counting its members through `batchProgress`. Each beneficiary keeps their own
status through the batch, start to finish.

What a screen shows is **counts, not a state**: "38 of 41 released, 2 deferred, 1
needing correction" is a sentence a supervisor can act on. "Partially complete"
is not — it names no one, and the two people still waiting are invisible in it.
`describeBatch` builds that sentence in the domain, so no template can collapse
it back into a verdict, and the checker fails the build if it starts returning
one.

Scheduling into a batch sets each member individually to `scheduled`. The batch
never becomes the thing that has been released.

**Consequence:** closing a session (`closedAt`) records that the office stopped
for the day. It says nothing about whether anybody was paid, which is what the
counts are for.

### DL-91 · Self-release warns; it does not block

**Status:** Settled (implemented in TAB 17).

`DL-08` separates approval from release at the permission level, and
`permission.spec.ts` asserts no non-administrator role holds both. That is the
first half.

The second half is that separated *permissions* do not guarantee separated
*people*. A system administrator holds everything by definition, and a
misconfigured account can hold both grants. `isSelfRelease` compares the release
against **who actually approved the request behind it** — read from the data
layer via `ReleaseRepository.approverFor`, never inferred from the current
user's role — and the screen says so before the money moves.

It **warns rather than refuses**. A small municipal office on a bad day may
genuinely have one person available, and blocking the payout punishes the family
for the office's staffing. Naming it puts the fact where an auditor will see it,
which is what the separation was for.

**Consequence:** `canRecordRelease` must not consult `wouldSelfRelease`, and no
template may disable the release control on it. The checker enforces both.

### DL-92 · The payout list is composed, and carries the minimum, masked

**Status:** Settled (implemented in TAB 17).

A manifest is printed, taken out of the office, and handled at a venue that may
be a barangay hall with no lockable drawer. It is the second artefact in this
system that leaves the building, after the referral summary, and it gets the same
treatment (`DL-81`, `DL-82`): **composed by the data layer**, never laid out by a
screen holding fuller records.

A `ManifestLine` carries a name, a masked voucher reference, what is being handed
over, and blank space for a signature. It carries no birth date, no address, no
sector membership, no PhilSys digits and no reason for the assistance. None of
those help anybody at a payout table, and a sheet listing which of your
neighbours is a VAWC survivor is a disclosure the office cannot recall once it is
on a clipboard.

The reference is masked to its last four characters, for the reason a document
number is (`DL-77`): enough to match the voucher in somebody's hand, not enough
to reconstruct the series and guess at other people's.

The acknowledgement column is **left blank on purpose**. Pre-filling how somebody
will acknowledge is how a sheet comes back signed for a person who was never
there.

The name on the line comes from `ResidentView` — already disclosed for the
composing user (`DL-38`) — so an officer whose scope excludes a barangay cannot
print a name they could not read on screen.

**Consequence:** the print stylesheet hides the office's own session cards and
controls. Only the payout list prints.

### DL-93 · Goods are counted; they are never valued

**Status:** Settled (implemented in TAB 17).

A cash grant and a family food pack are not the same record. `ReleaseKind`
distinguishes them, and the invariant runs both ways: a `money` release carries
an amount and no description, an `in-kind` release carries a description and
**no amount at all**. `Release.amount` is `Money | null` for exactly this
reason, and `releaseProblems` rejects either half being wrong.

The temptation is to put a peso figure on the rice so totals are easy. That
figure is invented — nobody at the MSWDO priced that sack — and once it is in the
column it appears in reports as though somebody counted it. A municipal
assistance total that silently includes estimated goods is wrong in a way no
reader can see.

So `sumReleased` filters in-kind releases out rather than coercing them to zero,
and a manifest reports a money total **and** a separate count of goods to hand
out. Two numbers that each mean something, rather than one that means neither.

**Consequence:** every consumer of a release amount handles `null`. That is the
cost, and it is the point: the type makes "what did this family actually get?"
impossible to answer carelessly.

### DL-94 · Deferred is the office's failing; unclaimed is nobody's

**Status:** Settled (implemented in TAB 17).

Two things the office must never record the same way:

- **Deferred** — the beneficiary came, and the office could not release. Every
  member of `DeferralReason` is the office's own: funds not yet with the office,
  a missing approving signature, an identification mismatch, a voucher error, a
  closed office. A deferral without a stated reason is refused by the domain.
- **Unclaimed** — nobody came within the payout window. The office was ready.
  Why they did not come is **not known**, and the screen does not guess.

Collapsing these into one "not released" state blames a household for the
office's missing countersignature, and the record then reads that way to every
worker who opens it afterwards. The queue carries the distinction where it
matters: deferrals sit in the bucket headed "the office must act on these", and
unclaimed payouts do not.

Both are recoverable — each transitions back to `scheduled` — because both
describe a payout that has not happened yet, not a payout that will not.

**Consequence:** the deferral form's reason list is fixed and office-owned. The
checker fails the build if a reason or its label starts describing the
beneficiary.

### DL-95 · The release adapter had no permission checks either

**Status:** Settled (fixed in TAB 17).

`MockReleaseRepository` returned seeded payouts to any caller —
unauthenticated included — with no permission check and no barangay scoping.
`list`, `getById` and `listForRequest` were all open.

This is the **second** adapter found in that state, after `MockReferralRepository`
(`DL-84`), and the cause is identical: both sat behind placeholder routes, so
nothing reachable exercised them and the access detector had no rendered surface
to inspect. A route that does not exist yet is a route whose adapter nobody has
read.

Payout records are not low-value. Each names a person, an amount, and a date and
place at which they can be found collecting money.

Every method now checks its permission — `release.view` to read,
`.schedule` to batch, `.release` to hand over, `.void` to cancel — and applies
barangay scope through the beneficiary, because a release is reachable only if
the person it is for is. Not-found and not-yours read identically (`DL-31`).

**Consequence:** the standing lesson is that a feature's adapter must be audited
when it is **written**, not when its screens are. Two for two says the pattern is
the norm, not an accident. The remaining placeholder routes — reports and
administration — should be assumed to have the same defect until read.
### DL-96 · Three surfaces, and no channel the LGU did not supply

**Status:** Settled (implemented in TAB 18).

The master command's first acceptance criterion is that a user can tell "FYI"
from "action required". That is a modelling problem before it is a styling one,
so this application keeps **three** concepts and never lets a screen blur them:

| | Has an owner | Has a due date | Is completed | Goes away when |
| --- | --- | --- | --- | --- |
| **Work item** | yes | usually | yes | somebody does it |
| **Notification** | no | no | no — only read | never; it is history |
| **Office alert** | no | no | no | the record is fixed |

Collapsing them is how a notification centre becomes noise. An office that has
to read every line to find out whether it is owed anything stops reading any of
them, and the two lines that mattered go with the rest.

The distinction is said **in words on the screen**, not implied by styling: the
notification centre opens with a sentence saying that nothing on it is a job and
that what is owed is on the work list. A user who has learnt to ignore a colour
has not learnt to ignore a sentence.

**And nothing is sent anywhere.** `NotificationChannel` is `toast | inbox |
both`, and it must never gain `email`, `sms`, `push` or a webhook. The LGU
supplied no mail relay, no SMS gateway and no push credentials, so this
application has no way to deliver anything and must not appear to. The failure
is concrete: a `channel: 'sms'` that silently no-ops leaves an office believing
a beneficiary was told to come on Tuesday. Nobody finds out until the family
does not arrive, and by then the record says they were notified.

**Consequence:** when a channel is genuinely provisioned it arrives as a backend
concern with its own delivery receipts, not as a value added to this union.

### DL-97 · A work queue is a view, and the port is read-only

**Status:** Settled (implemented in TAB 18).

`DL-55` established that the next action is a **record** — a `CaseTask` — rather
than something inferred from a status. TAB 18 could easily have broken that by
giving the queue its own task table.

It does not. `WorkRepository` has three methods, all reads: `myQueue`,
`teamQueue`, `alerts`. There is no `complete`, no `assign`, no `snooze`. A
`WorkItem` is a normalised view of something that already exists — a case task,
an assistance request in a particular state, a scheduled visit, an unanswered
referral, a release waiting to go out — and acting on one goes to the repository
that owns that record, which already has the permission checks, the reason
requirement and the audit trail.

A `WorkRepository.complete()` would be a second task system with a second audit
trail, and "what does this office owe this family?" would have two answers
again.

`WorkItem.isManageable` is true only for a `case-task`, and the screen says so
on every other row: an unanswered referral is not something you snooze, it is
something you chase. Offering a control that quietly does nothing is worse than
offering none.

**Consequence:** `CaseRepository` gained `assignTask` and `rescheduleTask`, each
taking a required reason and appending a case event, because that is where task
mutations belong.

### DL-98 · An office alert describes the data; it decides nothing

**Status:** Settled (implemented in TAB 18).

An `OfficeAlert` says something about the records is wrong or risky *right now*:
two people who may be the same person, a voucher that does not match the
registry, an approved request nobody has scheduled.

Nobody completes one. Somebody fixes the record and it stops being true. That is
why it has no due date, no assignee and no done state — giving it any of those
turns "the data is wrong" into "somebody ticked a box", which is how a
data-quality problem gets closed without being fixed. Alerts are derived on
every read and never stored, so one cannot outlive the problem that produced it.

Every alert states its **basis** — the rule it applied and what it read —
because an alert nobody can check is one an office learns to dismiss.

**This is the fifth surface where a signal could quietly become a decision
engine**, after vulnerability indicators (`DL-42`), intake advisories (`DL-60`),
requirement completion (`DL-78`) and programme guidance (`DL-66`). The checker
refuses a decision-shaped field on the type and refuses a template that disables
a control on an alert.

### DL-99 · Snooze is a recorded change of date, not a hidden timer

**Status:** Settled (implemented in TAB 18).

The master command asks for "snooze / remind-later where appropriate". The
appropriate form here is `CaseRepository.rescheduleTask`: a new due date with a
**required reason**, appended to the case history as a `task-rescheduled` event.

A snooze implemented as a hidden timer leaves a file showing nothing while a
household waits another month. The question afterwards is always "why did this
take so long?", and a record that cannot answer it is a record that blames
whoever is holding it now.

Reassignment works the same way (`task-reassigned`). A task that changes hands
silently is one nobody can be asked about, and "who was supposed to do this?" is
the first question after a family is missed.

**Consequence:** there is no snooze on derived work, because there is no record
to write the reason to. `isManageable` says which is which.

### DL-100 · The notification adapter did not know who the current user was

**Status:** Settled (fixed in TAB 18).

`MockNotificationRepository.listForCurrentUser()` returned **every** seeded
notification to **every** caller. The `recipientId` field existed on the model
and nothing read it, so a barangay-link account signing in saw the MSWDO head's
inbox: case assignments, suspended programmes, payout preparations, all of it.

This is the third ungated adapter (`DL-84`, `DL-95`), and the cause here is
different from the first two and worth naming separately. The others were behind
placeholder routes, so nothing exercised them. This one was **wired, reachable
and in daily use** — it was simply *named* for behaviour it did not have. A name
is not an implementation, and a name that describes the intended behaviour is
the easiest possible place to stop looking.

A notification with `recipientId: null` is an office-wide announcement, which is
a deliberate case and not the absence of a recipient. The rule lives in
`isForRecipient` so the two adapters cannot drift, and `markRead` now refuses a
notification that is not yours with the same message as one that does not exist
(`DL-31`).

**Consequence:** audit every adapter method whose name makes a claim —
`forCurrentUser`, `mine`, `visibleTo` — against what it actually filters on.

### DL-101 · No service standard was supplied, so the queue reports waiting, not lateness

**Status:** Settled (implemented in TAB 18).

A case task and a scheduled visit have real due dates because a person set one.
An assistance request sitting in assessment has **none**: the LGU supplied no
service standards, and no issuance in the reference material fixes a turnaround
time for AICS intake at this office.

Inventing "five working days" would be fabricating policy the municipality never
adopted — the same refusal as `DL-89` declining to invent accounting rules. So
`WorkItem.dueOn` is `null` for those items, and they carry `waitingSince`
instead: the day the request was filed, which is a fact the office has.

The queue reports "Waiting 9 days". It never reports "3 days overdue", because
nothing can miss a target that was never set. Undated work is ordered by who has
waited longest, and the screen says plainly why there is no date rather than
leaving an officer to assume the system lost one.

**Consequence:** when the office adopts service standards they become a policy
record with a provenance, like the review windows (`DL-68`) and the poverty
threshold (`DL-46`) — not a constant somebody typed into a queue.

### DL-102 · Overdue is obvious without red-only signalling

**Status:** Settled (implemented in TAB 18).

The master command asks for this explicitly, and it is an accessibility
requirement rather than a preference. Colour is not information: it fails a
colour-blind officer, it fails a monochrome printout, and it fails a screen
reader completely.

So lateness is carried three ways, only one of which is colour:

1. **A sentence on every row** — `describeLateness` returns "Late by 3 days",
   from the domain, so no template can drop it into a class name.
2. **A worded bucket heading** — "Late", with a sentence saying somebody set a
   date and it has passed.
3. **Position and a border rule** — the late bucket comes first and carries a
   left border, which survives printing.

The colour is the fourth carrier and the only optional one.

**Consequence:** `check:work` fails the build if a template that lists work
stops rendering the lateness sentence, checked **per template** rather than
across the set.

### DL-103 · A possible duplicate is a condition of the data, not somebody's job

**Status:** Settled (corrected during TAB 18).

The first build of the work queue emitted one work item per duplicate candidate
pair. On this registry that produced **189 items for a social worker, 182 of
them duplicate pairs**, with seven genuinely late things buried underneath.

That is precisely the notification overload the master command warns against,
and it happened by blurring the distinction the module exists to keep. A
duplicate pair has no assignee and no due date. Nobody completes it. It is a
**condition of the data** — which is what `OfficeAlert` is for — and it now
appears there as one line with a count and a stated basis.

`resolve-data-quality` survives as a `WorkKind`, because a person can still
raise a case task to deal with one. What is refused is the software manufacturing
180 jobs nobody asked for.

**Consequence:** a source belongs on a queue only if a named person owes it. The
checker refuses `duplicate-review` as a `WorkSource`, and a feature test asserts
the personal queue stays under thirty items.
### DL-104 · Reports are aggregate first, and naming people has to argue for itself

**Status:** Settled (implemented in TAB 19).

The master command asks for reporting that supports planning and accountability
**while minimising exposure of citizen data**, with aggregate-first reports by
default and person-level detail only when necessary. That is a modelling rule,
not a screen preference, so the grain is a property of the **report definition**
rather than a choice a screen makes.

Thirteen of the fourteen reports are aggregate. The fourteenth — data
completeness — names residents, and it carries three things the others do not:

1. **A stated reason.** `personLevelJustification` is required on any
   person-level report and forbidden on an aggregate one, and
   `reportProblems` refuses a definition that breaks either rule. "We have
   always shown names here" is not a lawful basis; writing the reason down is
   what makes it reviewable.
2. **A higher permission.** `report.export` rather than `report.view`. Naming
   people is a different act from reading a count of them, and a definition that
   names people behind only `report.view` is refused by the domain.
3. **A caution on screen**, saying it names people and must not be circulated.

The reason completeness must name people is concrete: the report exists to be
worked through record by record, and "42 records incomplete" cannot be acted on
because nobody knows which 42.

**Consequence:** the catalogue is data (`REPORT_CATALOGUE`), like programme
eligibility (`DL-66`). No screen branches on a report id, and `check:reports`
fails the build if the person-level count grows.

### DL-105 · An aggregate is not automatically anonymous

**Status:** Settled (implemented in TAB 19).

"Barangay San Juan: 1 VAWC survivor served" names somebody to anyone in that
barangay who knows who has been to the office. "2" is barely better. A table of
counts can identify a person as surely as a list of names, and the office would
have published it believing it had published statistics.

So counts of **people or households** below a threshold are withheld, and four
choices inside that rule are deliberate:

- **Withheld, not dropped.** A missing row reads as "none", which is a different
  and false claim. The row keeps its label and is marked.
- **Not rounded.** Rounding 2 up to 5 puts a figure in a report that is not
  true, and somebody will act on it.
- **Not zero.** Zero identifies nobody, and hiding it would hide the absence of
  service — exactly the gap a planning report exists to show.
- **The drill-down goes too.** Withholding a figure while leaving a link to the
  four records behind it withholds nothing at all.

The **total is taken before suppression** and labelled as such, because the
alternative is a reader adding up the visible rows and quietly believing a
smaller number. The screen says so above the table, not in a footnote.

The threshold of five follows common statistical disclosure practice for
small-area counts. **No Taytay issuance was supplied fixing it**, so it is
marked `convention-pending-confirmation` and says so on screen, exactly as the
intake review windows do (`DL-68`).

**Consequence:** there is no parameter anywhere — port, adapter or screen —
that asks for the unsuppressed set. "Just this once" is how a threshold stops
being one.

### DL-106 · An export carries its own conditions, inside the file

**Status:** Settled (implemented in TAB 19).

A spreadsheet on somebody's desktop six months from now has no screen around it.
A printed report that does not say what it covers **will** be read as covering
everything, and the office will make a decision on it.

So every export begins with a manifest, in the file: which report it is, the
question it answers, the filter applied **in words**, when it was generated and
by whom, how many rows, whether it names people, whether anything was withheld,
and the handling rule under RA 10173.

The file is **composed by the data layer**, never assembled by a screen — the
same rule as the payout manifest (`DL-92`) and the referral summary (`DL-82`),
and for the same reason: a template holding the fuller result is one binding
away from writing a name into a spreadsheet the report was never meant to
contain. `check:reports` fails the build if a screen touches `csvCell`, a
`Blob`, or `URL.createObjectURL`.

A person-level export is **warned about before the file exists**, not after it
is on somebody's desktop. The warning says plainly that nothing can be recalled.

**Consequence:** `describeFilter` lives in the domain rather than in a template,
because the sentence in the file and the sentence on the screen must be the same
sentence.

### DL-107 · Staff workload counts what people carry; it does not rank them

**Status:** Settled (implemented in TAB 19).

The master command asks for staff workload reporting and warns, in the same
line, to avoid simplistic performance ranking. Both halves are honoured.

The report counts **open items per officer**, so a supervisor can move work.
There is no completion rate, no average turnaround per person, no score and no
index — and the rows are ordered **alphabetically**, not by volume. Sorting by
count is what turns a workload table into a league table, whatever the heading
says.

The caution is rendered above the figures: a heavy caseload is usually a hard
caseload, and the office cannot see from a count who is doing well.

This is the same framing the team queue already uses (`DL-97`), which sorts by
who is most behind **in order to direct help**, not to rank people.

**Consequence:** `check:reports` refuses a productivity, efficiency, completion
rate or score field anywhere in the reports domain, adapters or screens — and
matches those as **identifiers**, so the caution that warns against ranking is
not itself flagged as ranking.

### DL-108 · A chart that is not a table is a claim nobody can check

**Status:** Settled (reaffirmed in TAB 19).

The master command asks that every visualisation get summary text and a tabular
equivalent, that charts not rely on hue alone, and that all chart claims be
verifiable from tabular data.

The `ChartTable` primitive built in TAB 06 already satisfies all three: it is a
real `<table>` with a caption, a header row and one row per category, and the
bar is an `aria-hidden` span that only repeats what the number beside it already
says. TAB 19 **extends it rather than adding a charting library**.

`ReportSeries.summary` is therefore required, not optional. A visualisation with
no plain-text equivalent is one a screen reader cannot convey and a sighted
reader cannot check, and an optional field is one that is eventually omitted.
The summary names the largest row and its share — a claim somebody can verify
against the row beneath it — rather than describing a shape.

**Consequence:** `check:reports` fails the build on a `<canvas>` or `<svg>` in a
report template, on a chart rendered without its summary bound, and on any
charting dependency appearing in `package.json`. A chart plus a separate
accessible table is two things that drift apart, and the table is what stops
being updated.
### DL-109 · Search reads only what it may show

**Status:** Settled (implemented in TAB 20).

The obvious rule is that a search result must not display a case note. The rule
that matters as much, and is easy to miss, is that it must not **match** on one
either.

Suppose search matched note bodies but rendered no snippet. Typing a condition,
a shelter's name, or a surname and getting back exactly one resident tells you
that word appears in that person's file. The office has disclosed the contents
of a protected note without ever rendering it, and the audit trail records a
search rather than a disclosure.

So the searchable fields and the displayable fields are the **same closed set**:
names, reference numbers, barangay, status. `NEVER_SEARCHED` names the fields
that are refused on both sides — note bodies, assessment findings, remarks,
outcomes, service needs, declined reasons, PhilSys digits, income, sectors,
birth dates — and `check:search` fails the build if the adapter reads one.

`SearchHit` has no `snippet`, no `context`, no `matchedText` and no `excerpt`.
There is nowhere for a sentence somebody wrote about a family to live.

`DL-58` already withholds a protected note's body in the data layer, and
`DL-38` withholds a protection case's name. Search is the surface most likely to
reintroduce both, because it is reached from every screen and crosses six record
types at once.

**Consequence:** `SearchRepository.search` takes a term and nothing else. There
is no `fields`, no `includeNotes` and no `deep` — a caller cannot ask search to
read something a result may not show.

### DL-110 · A recent search is not written down

**Status:** Settled (implemented in TAB 20).

The master command says recent searches "may be local-only and must avoid
persisting sensitive query content if unsafe". That is permission, not
instruction, and the safe reading is the narrow one.

A caseworker searching a resident by name leaves that name in the box.
Persisting it puts a resident's name on the device, outside every disclosure
rule the application otherwise applies — and on a shared office machine it is
readable by whoever sits down next.

There is **no way to tell a safe query from an unsafe one**. "Dela Cruz" is a
surname and also a street. "Purok 4" is an address and also a place. A filter
that tried to decide would be wrong in both directions, and wrong quietly.

So nothing is persisted at all. Recent searches live in a signal for the
lifetime of the tab and go when it closes, and the screen **says so** — on a
shared machine there is no other way for an officer to know.

`CLAUDE.md` §2.5 already forbids this application putting session credentials in
`localStorage`. This is the same caution, applied to the same storage, for the
same reason.

**Consequence:** `check:search` fails the build on `localStorage`,
`sessionStorage`, `indexedDB` or `document.cookie` anywhere in the search
domain, its adapter or its screens.

### DL-111 · Saving a view for the office is a separate grant from saving one for yourself

**Status:** Settled (implemented in TAB 20).

The master command asks for personal saved views first, with shared team views
behind an appropriate permission. Before TAB 20 the model had `isShared` and
nothing checked it: any account that could read a list could publish a named
view of it to every colleague.

A personal view is a preference. A **shared view is a small piece of office
configuration**: it appears for everyone who opens that screen, it outlives
whoever wrote it, and — the reason this matters — its *name* describes a
population. "VAWC survivors, Santa Ana" discloses who the office is looking at
to every colleague on that screen, and it holds no records at all.

So creating or removing a shared view costs `view.share`. Everyone keeps their
own views for free, and removing your own still costs nothing beyond owning it.

The grant is held by the administrator **and the MSWDO head**, not the
administrator alone: a supervisor standardising the team's queues is exactly the
person this feature is for, and `settings.manage` would have been too narrow.

**Consequence:** the earlier rule that *nobody* could remove a shared view is
superseded. It was a stand-in for a permission that did not exist yet, and it
left the office unable to correct its own mistakes.

### DL-112 · A record type that was not searched is named, not hidden

**Status:** Settled (implemented in TAB 20).

Search crosses six record types, each gated by its own permission — a
release officer finds the resident and the request behind a payout and no
case file, because they hold no case access (`DL-08`).

The question is what the screen says about the types it skipped. Silently
omitting them produces a result that reads as complete: an officer searches a
family's name, sees no case, and concludes the office has never opened one. That
is a wrong answer delivered with confidence, and it is worse than no answer.

So `SearchResults.withheldTypes` reports what was not searched, and the screen
names them: *"Your account does not cover cases and families, so those were not
searched."* Naming the types rather than saying "some results are hidden" is
deliberate — a user who cannot tell **which** record type they are missing
cannot ask the right person for access.

**Consequence:** the `/search` route itself is guarded only by being signed in.
A narrower guard would hide the very screen that explains which types an account
cannot search.
### DL-113 · Retention is empty on purpose, and says so

**Status:** Settled (implemented in TAB 21).

The master command asks for "retention/purge policy placeholders for future
backend integration". The word *placeholder* is doing real work there, and this
module refuses to quietly upgrade it.

No records disposition schedule was supplied. RA 9470 requires a government
agency to have one approved by the National Archives, and the MSWDO will have
one — but this application was not given it, and the periods differ by record
series in ways nobody can guess.

So every rule carries `provenance: 'awaiting-office-policy'`, a `periodInYears`
of `null`, and the screen prints **"No schedule recorded"** — never a zero,
never "indefinite", never a default. The list covers *every* classified record
type rather than a subset, because showing three of ten with schedules would
imply the other seven need none.

This is the same refusal as `DL-89` (no invented accounting), `DL-101` (no
invented service standard) and `DL-105` (a threshold marked unconfirmed). It is
the most consequential of the four: an office that believes it may delete after
five years, and does, **cannot undo it**.

**Consequence:** the governance screen counts how many record types are still
waiting on a schedule, so the gap is visible rather than dormant — the same
device as `awaitsConfirmation` for the review windows (`DL-68`).

### DL-114 · An audit row says what changed, never what it changed to

**Status:** Settled (implemented in TAB 21).

The master command asks for an event stream with a before/after summary and, in
the same breath, that generic list rows must not dump full sensitive record
values. Those pull against each other unless the split is **structural**.

A rendering rule — "do not show values in the list" — lasts until the first
person who wants to see what changed without clicking through. So the values are
not on the row at all:

- **`AuditRow`** carries actor, action, entity, a summary in words, a timestamp,
  a source, and **which fields moved with how sensitive each is**. No old value,
  no new value, and `toAuditRow` has no parameter that could carry one.
- **`AuditEntryDetail`** is a separate read, by id, behind `audit.view-detail`.

The failure this prevents is specific. An audit list is the one screen designed
to be scrolled, filtered and exported by somebody reviewing *other people's*
work. A row reading `monthlyIncome: 3,200 → 18,000` discloses a resident's
income to every reviewer who filters by date — and does so in the name of
accountability, which is what makes it hard to argue with afterwards.

**`audit.view-detail` is held by the auditor and not the MSWDO head.** Reading
the trail is oversight: did somebody record a reason, assign an owner, act in
time? Reading the values is access to the record. Checking whether a figure was
altered improperly is the audit remit specifically, and it is why that role is
read-only everywhere else.

**Consequence:** the permission is classified `READ_ONLY` explicitly — the same
catch as `document.download` in TAB 14, where a name-shape heuristic would have
called it a mutation and quietly made the auditor a mutating role.

### DL-115 · An account and a directory entry are different records

**Status:** Settled (implemented in TAB 21).

`StaffUser` is the **authorisation** model. Every guard, every adapter and
twenty-eight test fixtures depend on its shape, and it answers exactly one
question: who may do what.

The master command also asks for an internal directory — employee ID, unit,
contact details. Putting those on `StaffUser` would make every permission test
care about a phone number, and would ripple a directory change through
twenty-eight files that have nothing to do with directories.

They are also **different data**. A role is office structure. An employee's
contact number is personal information about that employee, with the same
protection under RA 10173 that a resident's has. Keeping them in separate
records is what makes it possible to show a role without showing a number.

So `StaffProfile` is its own record, keyed on `StaffUserId`. One identity, two
facets, nothing to keep in step — and `StaffAccount` composes both in the data
layer rather than in a screen, so the disclosure decision lives in one place.

**Consequence:** this is the same instinct as `Resident` versus `ResidentView`
(`DL-38`). A model that answers one question stays answerable.

### DL-116 · Deactivation ends a live session, not the next one

**Status:** Settled (fixed in TAB 21).

`MockStaffRepository.signIn` refused a deactivated account. `currentUser()` did
not — it resolved the same account into a fully permissioned identity.

So an account switched off at 10am kept **every grant** until the person
happened to sign out. Worse than either half alone: the office saw the account
marked inactive, believed access had been withdrawn, and it had not been. The
one moment deactivation matters most — somebody being walked out — is the moment
it did nothing.

`canHoldSession` now lives in the domain and both paths ask it, so sign-in and
session cannot drift apart again. The screen states the consequence plainly: an
open session stops being able to act as soon as the next request is made.

**Consequence:** an administrator cannot deactivate the account they are signed
in as. It would take effect immediately and they could not undo it from here.

### DL-117 · A correction is raised, considered and answered — never applied silently

**Status:** Settled (implemented in TAB 21).

RA 10173 gives a data subject the right to have inaccurate personal information
corrected. This application already holds two rules about how: relationship and
family history is append-only (`DL-48`), and replacing a document supersedes
rather than overwrites (`DL-77`).

A correction request is the third face of the same doctrine. Somebody says a
record is wrong; the office decides; and **whichever way it goes, the request
and its answer stay on file**:

- A correction applied with no trace leaves a record that silently disagrees
  with the decision made on the old one — a request approved in March on a
  figure corrected in June must stay explicable in December.
- A request refused with no trace leaves a resident with no evidence they ever
  asked, and nothing to appeal against.

So `applied` and `refused` both require an outcome in words, and both are
**terminal** along with `withdrawn`. Somebody who disagrees raises a new request
naming the old one — the same shape as a case that recurs (`DL-53`), because
reopening rewrites what the office decided and when.

**Consequence:** the record, its states and the reason rule are built; **the
screen that captures one is not**, and the governance page says so rather than
offering a form that goes nowhere. A half-built correction flow is worse than
none: a resident told their request was filed, when it was not, has been failed
twice.
### DL-118 · The office is warned about a lost connection; nothing is queued

**Status:** Settled (implemented in TAB 22).

The master command asks for graceful network-loss handling and, in the same
paragraph, that this admin system must not promise full offline transactional
integrity without a backend strategy — and must **never silently queue a
sensitive submission**.

So `NetworkStatus` observes `navigator.onLine` and drives a **warning only**.
Nothing is held, nothing is retried in the background, and nothing is marked
saved on the strength of it. `navigator.onLine` is a weak signal anyway — it
reports whether an interface is up, not whether the API is reachable — and the
service is honest about that by never letting it change behaviour.

`DL-87` already settled this for field visits: exactly one state means the
office record has it, and a failed send says plainly that nothing was queued in
the background. This extends it application-wide.

Three choices in the banner are deliberate:

- **`role="status"`, not `role="alert"`.** Losing a connection is a condition of
  the device, not an error in the page, and `alert` interrupts a screen reader
  mid-sentence.
- **The reconnected message does not auto-dismiss.** It says work was *not*
  kept — exactly the message that must survive somebody looking away. A person
  dismisses it; never a timer.
- **No "we will retry" anywhere.** A caseworker who reads that closes the tab
  believing the request was filed.

**Consequence:** `check:hardening` fails the build if any notice starts
promising a send or a sync, and if an offline queue, background sync or service
worker registration appears anywhere in the application.

### DL-119 · One debounce window, and only the typed term waits

**Status:** Settled (implemented in TAB 22).

Two findings, one cause.

**Seven list screens each declared `const SEARCH_DEBOUNCE_MS = 250` privately.**
Seven copies of one number is how two screens come to feel different for no
stated reason — the same trap as two constants meaning "due soon", which TAB 18
avoided by importing the case module's window rather than restating it.

**Five other screens had no debounce at all.** Typing "Sarmiento" fired nine
reads across the registry — nine sorts, nine paginations, nine disclosure
passes — and the eight that were thrown away cost exactly as much as the one
that was kept.

`SEARCH_DEBOUNCE_MS` and `debouncedTerm` now live in one module and every screen
imports them.

**Only the typed term is debounced**, never the whole query. Choosing a status
from a dropdown is a single deliberate act and should take effect at once;
debouncing it would make every filter feel broken.

The URL-driven lists debounce the *navigation* rather than a signal, because
each keystroke would otherwise push a history entry as well as a query. Same
constant, different application — and the constant is now shared.

**Consequence:** a screen that declares its own debounce window, or searches
without settling the term, fails the build.

### DL-120 · A shared primitive is defined once, or it is not shared

**Status:** Settled (fixed in TAB 22).

`.field`, `.field__label`, `.field__input` and `.field__hint` have been in
`src/styles.scss` since the shell TAB, under a comment reading: *"a field that
looks and behaves differently on each screen is how an encoder learns to
distrust one."*

Five feature stylesheets had redefined them anyway, and **with different
values** — `display: block` instead of flex, a different label colour, a
different hint colour. Nobody chose that; each screen copied a working block and
adjusted it, and the shared control quietly stopped being shared.

A local copy does not extend a shared primitive. It replaces it, on that one
screen, with something slightly different.

Removing them cleared ~3kB of duplication and brought
`visit-detail-page.scss` back under the component-style budget it had exceeded
**since TAB 16** — six TABs of a warning that was really a symptom.

`.field + .field` now supplies the stacking margin the local copies were
actually there for, which is why they were written in the first place.

**Consequence:** `check:hardening` fails the build if a feature stylesheet
declares a selector that `styles.scss` already owns. The component-style budget
is **not** re-measured there: `ng build` already enforces it against the
compiled CSS, and a second budget with a different number is the same drift in
another costume — so the checker asserts the build's guard still exists instead.

### DL-121 · An acceptance test uses the real adapters, or it is a unit test

**Status:** Settled (implemented in TAB 23).

Every feature spec in this project wires its own repository doubles, which is
correct: a screen test should not depend on seed data it did not choose.

But that means **no test in the project checked whether the seed was coherent**.
A double that returns a plausible `Release` proves the release screen
renders one; it cannot prove the release names a request that exists, belonging
to the resident the release pays. TAB 17 found exactly that defect by hand — a
release citing `req-0007` while naming a resident who belonged to a different
request — and nothing would have caught it.

So `acceptance.spec.ts` wires the **real mock adapter set** through
`provideDataAccess`, exactly as the application does, and walks whole paths
across modules:

- every assistance request resolves to a resident who is on file;
- every release resolves to both a request and a resident;
- money and goods stay apart on every seeded record;
- an overdue referral exists *and* surfaces as work somebody owes;
- a restricted account is refused an export at the adapter, three different ways.

The suite is allowed to override exactly one token: `STAFF_REPOSITORY`, because
that is how it chooses which role is signed in. Overriding any other is how a
suite stops testing the thing it was written for, and `check:hardening` fails
the build if one appears.

**Consequence:** the suite also found a defect in itself. A scope assertion read
`expect(barangays.size).toBeLessThanOrEqual(1)`, which is true of an empty
result — and the result *was* empty, because the fixture built a barangay-link
account with no barangay. Asserting non-emptiness first turned a vacuous pass
into a real check, and into a second test worth having: **an account scoped to
its own barangay with no barangay set sees nothing**, which is the fail-closed
reading of a misconfiguration.

### DL-122 · Newsfeed and Events extend the one permission model

**Status:** Settled (implemented in TAB 24). Its newsfeed half — nine keys and their grants — is superseded by `DL-194`; the events half stands.

The late-phase command adds two modules and says, in as many words, to extend
the existing centralised permission model and not create a second RBAC. That is
easy to agree with and easy to drift from: a new module arrives with its own
notion of who may do what, and a year later the office has two answers to the
same question.

So nineteen keys join the existing `PERMISSIONS` array — nine for Newsfeed, ten
for Events — and nothing else changes about how permission works. That matters
concretely: `check:access` generates its comparison from that array and has
**twice** caught a permission missing from `docs/access/permission-matrix.md`,
in TABs 20 and 21. A parallel array would be invisible to it.

**The keys are written in kebab-case**, not the snake_case the command
suggests. The command's own instruction governs: extending the existing model
means extending its *shape* as well as its location, and one array holding both
`newsfeed.moderate_comments` and `request.view-sensitive` is a model nobody can
predict from memory.

**Roles were mapped, not invented.** The command lists example roles — Newsfeed
Manager, Events Manager, Read-only Executive — and says to map them *only if
compatible with roles already built*. They are:

- the **MSWDO head** takes publishing and moderation, because a post goes out in
  the office's name and that role already answers for what the office says;
- the **auditor** takes the two `view` and two `view-insights` keys and nothing
  that changes anything;
- **caseworkers, intake and release officers take neither module.** Nothing
  about casework implies speaking for the municipality.

`events.export-registrations` and both `view-insights` keys are classified
**read-only**. Exporting discloses but does not change, exactly as `report.export`
is classified — and getting this wrong would have quietly turned the auditor
into a mutating role, which is the same trap `document.download` set in TAB 14
and `audit.view-detail` set in TAB 21.

**Consequence:** the audit seams extend `AuditAction` for the same reason. A
second action vocabulary would need a second explorer, and `DL-114`'s row/detail
split would not apply to a published post.

### DL-123 · The resident contract is written down and never implemented

**Status:** Settled (implemented in TAB 24). Its post and comment half is superseded by `DL-194`; the events half and the asymmetry stand.

The command permits the admin portal to define typed interfaces describing what
the separate resident mobile app consumes, and forbids implementing that app.
Both halves are honoured: `domain/community/resident-contract.ts` is types only,
and `check:community` fails the build on a component, a template, a stylesheet
or a resident feature folder.

Writing the contract down is still worth doing. The resident app is built by
another team against the same backend, and the boundary is easiest to state
while the admin side is being designed — not afterwards, when the two have each
assumed something different about who may post.

**The boundary is an asymmetry.** A resident may **read and respond**: view a
published post, react, comment, share, view a published event, register. A
resident may never **publish** — create or edit a post, schedule, pin, archive,
moderate somebody else's comment, create or cancel an event, see a registration
list, or mark attendance.

That asymmetry is the whole contract. The municipality speaks in its own name;
residents answer. A resident capability that could publish would let somebody
post under the MSWDO's masthead, which is a different kind of harm from any this
application otherwise guards against.

`RESIDENT_MUST_NEVER` names every admin key that is refused, even though the
capability list is already an allow-list. The redundancy is deliberate: an edit
that adds `newsfeed.publish` to the capabilities has to **delete a line that
says why not**, rather than quietly widen a union.

Two shapes carry the same reasoning further:

- `ResidentPostView` names the **office**, never the member of staff who pressed
  publish. A resident sees the MSWDO, not that Grace Ocampo posted at 4pm.
- `ResidentEventView` reports `capacityRemaining` and **not** a registration
  count. A resident deciding whether to attend does not need to know how many
  neighbours already have, and in a municipality this size a low count on a
  sensitive service is disclosive.

### DL-124 · Publishing is one-way, and the screen says so before the act

**Status:** Settled (implemented in TAB 25). Superseded by `DL-194`: the newsfeed was retired. The warning-before-publish doctrine lives on in Balita.

`POST_STATUS_TRANSITIONS.published` is `['archived']`. There is no path from
`published` back to `draft` or `scheduled`, and no screen offers an "unpublish",
a "retract" or an "unsend".

Every other lifecycle in this application is internal. A case moves through
review inside the office; an assistance request is decided by staff. A post is
different in kind: it goes to residents, and once somebody has read it, no
status change reaches them. A `published → draft` transition would let the
office return a post to a state the world already saw it leave, and the record
would then read as though it had never gone out.

Archiving is the only exit, and it is not an undo. The badge says so —
"removed from the feed going forward; it does not reach anybody who already read
it" — because the office reads the badge, not the transition map.

**The warning is shown before the button, not as a confirmation after it.** The
publish control on the detail screen sits below a sentence saying the post
cannot be unsent. A modal that appears *after* somebody has decided is a speed
bump; a sentence read while deciding is information. This is the opposite
treatment from removing a comment (`DL-127`), and deliberately so: publishing is
the ordinary act of this module and warning-by-modal on every post would train
the office to dismiss it.

Archiving is reversible — `archived → published` is allowed — because taking a
post down can itself be a mistake, and an office that cannot put back a
mistakenly archived flood advisory is worse off than one that can.

### DL-125 · An image is described before it is published, and not before

**Status:** Settled (implemented in TAB 25). Superseded by `DL-194` for the newsfeed, which was retired. The doctrine lives on in an event's cover (`DL-193`).

`PostImage.altText` is a **required** `string`, not optional and not nullable,
and `postProblems` refuses to publish a post whose image has none.

An optional field is one that is usually empty. The failure this prevents is
specific: a municipal advisory whose entire content is a poster image — the
evacuation centre, the payout schedule, the cut-off date — is *unreachable* to a
resident using a screen reader, and those are exactly the advisories that most
need reading aloud. WCAG 2.2 AA is the stated conformance target (`DL-20`), and
this is the one place in the application where a failure reaches the public
rather than a member of staff.

**The rule bites at publication, not at every keystroke.** `postProblems` takes
an intent, and `save` skips the alt-text check: a half-written draft with an
image and no description yet is somebody working, not an accessibility failure.
Refusing to save would teach people to write the post somewhere else and paste
it in.

**The field sits beside the image, not behind a disclosure.** `check:newsfeed`
fails the build on a `<details>` element in the composer. A description
reachable only through "advanced options" is a description that is written when
somebody is already being careful — which is not when it is needed.

The message names who is affected rather than the rule that was broken: "a
resident using a screen reader gets nothing from a poster with no description"
is acted on; "alt text required" is worked around.

### DL-126 · Reach is counts, and there is no method that could say more

**Status:** Settled (implemented in TAB 25). Superseded by `DL-194`: the newsfeed was retired. It is the starting point for reactions on Balita, if built.

`Post` carries `reactionCount` and `commentCount`. Nothing in the newsfeed
domain, the port, either adapter or any screen can answer *which* residents
reacted, read or shared, and `check:newsfeed` fails the build on `reactedBy`,
`likedBy`, `viewedBy`, `seenBy` or a port method returning `ResidentId`s.

The office's legitimate question is whether an advisory travelled. That is
answered by a number. The question the data would also answer, if it were held,
is which named residents engaged with a post about — for instance — a VAWC
service or a cash grant, and there is no operational need for that at all
(`RA 10173` data minimisation, and section 6 of `CLAUDE.md`).

The safest way to stop a screen rendering something is to leave the question
unanswerable at the port. A field held "for later" is a field somebody displays;
a method that exists is a method somebody calls. This is the same reasoning as
`SearchRepository.search` taking a term and nothing else (`DL-109`).

The screen states the boundary — "Counts only. The office does not see which
residents reacted, and does not need to." — for the reason given in `DL-89`: a
limit an office never sees is one it discovers by being wrong about it.

### DL-127 · Hiding keeps the words; removal deletes them

**Status:** Settled (implemented in TAB 25). Superseded by `DL-194`: the newsfeed was retired. It is the starting point for comments on Balita, if built.

`CommentState` is `visible | hidden | removed`, and the two moderation outcomes
are different promises:

- **Hidden** — the words are kept, `body` is unchanged, and the comment can be
  put back. Used for something drawing replies away from an advisory, or a
  dispute that may not survive review. Criticism of the office is explicitly not
  a reason to remove anything, and the seeded example says so.
- **Removed** — `body` becomes `null`. The words are gone and cannot be
  restored. Who removed it, when and why stays on file.

`Comment.body` is nullable for exactly this reason, and `check:newsfeed` fails
the build if it stops being.

This is the one place in the application where the append-only doctrine
(`DL-48`, `DL-54`, `DL-77`) is deliberately not followed for the *content* of a
record. Everywhere else, the earlier value is evidence of what the office read
when it decided. Here the earlier value is a resident naming a child and the
school they attend in a public thread — and keeping that forever, so an
append-only rule reads cleanly, preserves the harm the removal was for. The
**act** is append-only; the **words** are not.

Because removal cannot be undone, it is the only act on the post screen behind a
modal, and the confirmation offers hiding as the alternative rather than only
warning. Hiding takes its reason inline, one click, no dialogue: making the
reversible act as heavy as the permanent one is how an office learns to treat
both as routine.

`moderationProblems` requires a reason for every moderation and refuses every
action on an already-removed comment — including `restore`, which would promise
to bring back words the data no longer holds. An official reply is attributed to
the office rather than to the officer who typed it (`DL-123`); the trail records
who acted.

### DL-128 · Registration availability is derived, never stored

**Status:** Settled (implemented in TAB 26).

`RegistrationAvailability` — `not-required | not-open | open | closed | full` —
is computed by `registrationAvailability(event, registeredCount, now)` from
four things: what the office set up, the clock, the count it was handed, and
the event's own status. There is no `registrationState` column anywhere, and
`check:events` fails the build if one appears.

A stored availability needs a job to keep it true. Between the deadline passing
at 5pm and that job running overnight, every screen in the office says
registration is open, and somebody tells a resident to sign up. This is the
same reasoning as `DL-83` (overdue is derived from the follow-up date) and
`DL-126` (a scheduled post's visibility is derived from the clock): a flag
that describes the passage of time is wrong every morning until something
fixes it.

The checker asserts the function **compares** against each input rather than
merely naming it. That distinction was not theoretical — the first version of
the rule passed on `const { opensAt, closesAt, capacity } = event.registration;`
with every test beneath it replaced by `if (false)`.

**`full` is a report, not a refusal.** It is computed from a count the office
was handed and says what the office should be told; whether a place actually
exists is a different question, answered only by the backend (`DL-129`).

### DL-129 · The client counts; the backend decides

**Status:** Settled (implemented in TAB 26).

The command says, in as many words, not to invent backend concurrency
guarantees. This is how that is made structural rather than remembered.

`EventCapacitySummary` carries counts and a **required** `asOf`, and no
`hasRoom`, `canRegister`, `isAvailable` or `isFull`. The screen prints the
timestamp and the sentence "These numbers were true when this screen last
asked. Residents are registering in the app while you read them, and the system
of record decides who gets the last place."

The failure this prevents is concrete and mundane. Two clerks open the same
event, both read "1 place left", both promote somebody from the waitlist, and
one family is turned away at the door by a number this application showed them.
No amount of client-side care fixes that; the only honest thing is to stop
claiming.

So **promotion is offered on any waitlisted registration**, including one the
office's own figures call full. `canOfferPromotion` takes the status and
nothing else — it may not consult the capacity — and `promotionExceedsCapacity`
drives a **warning** beside the button rather than a disabled state. A place
may have opened a second ago, and only the server knows. The attempt is made
and the outcome read back, exactly as `DL-91` warns rather than blocks on a
self-release.

The counts on `LguEvent` are denormalised for the list, and the adapter
recomputes them on every read rather than trusting what it stored.

### DL-130 · A registrant list is composed, and its names go through one reader

**Status:** Settled (implemented in TAB 26).

Reads return `RegistrantView`, built in the data layer, holding exactly:
reference, display name, barangay, when they registered, registration status,
attendance, and notes **only** where the reader holds
`events.manage-registrations`. The checker fails the build on any field added
to that interface.

An events clerk marking attendance at a feeding programme needs to find the
person on a list. They do not need an address, a birth date, PhilSys digits, an
income or a sector, and RA 10173 minimisation is not satisfied by a screen
choosing not to display what it was sent. This is the doctrine of `DL-82` (a
referral summary is composed field by field) and `DL-92` (a payout manifest is
composed by the data layer), applied to the one list in this application that
gets carried to a venue on a clipboard.

**The display name comes from `discloseResident`.** This is the part that was
easy to get wrong: a registrant is a resident, and the events adapter
formatting the name itself would hand an events clerk the full name of somebody
the residents module shows as "Cordero, M." (`DL-38`). One reader for the
protection, or it is not a protection — the same lesson as a capability gate
with a second reader.

The export holds the same closed set as the screen, which is why
`events.export-registrations` is classified read-only: it is not a wider read
than the list it comes from. It carries its handling notice **inside the file**,
in both the manifest and the header rows (`DL-106`).

### DL-131 · Cancelling is one-way, and "past" is not "completed"

**Status:** Settled (implemented in TAB 26).

Two lifecycle decisions, and one distinction between them that is the whole
point of the attendance design.

**`cancelled → archived` only.** An event that was called off and is then back
on is a **new event**, naming the old one through `replacesEventId`, on the
same reasoning as a closed case (`DL-53`) and a published post (`DL-124`):
everybody registered was told it was off and made other plans, and a status
flipping back does not reach them. Cancelling is the one act on the screen
behind a modal, and the confirmation says so.

Cancelling **one registration** is the opposite — freely reversible — because
it is a change to one person's place rather than a public announcement, and
somebody who withdrew on Monday and can come after all on Tuesday should not
have to sign up again from a phone they may not have with them.

**`hasFinished` is the clock's opinion; `completed` is the office's.** A
published event whose date has passed is *past* and not yet *completed*, and
the gap between them is where attendance is marked. `Past` is a view; `completed`
is a recorded act that declares attendance final.

That gap exists for one reason. If an event auto-completed at its end time,
every registrant not yet marked would become a no-show — and a no-show is a
**claim about a person**: that they took a place, deprived somebody on the
waitlist of it, and did not come. It has to be recorded by somebody who was
there. `complete()` therefore sweeps nothing, the badge for `not-checked-in`
says "this is not the same as saying they did not come", `describeAttendance`
reports the unmarked in their own right rather than folding them into no-shows,
and `attendanceRateOf` returns `null` until the office says the list is final —
because a rate taken mid-afternoon reads as a poor turnout and is really an
unfinished list.

---

## DL-132 — the console adopts `release`; the API keeps it

**TAB 08 step 1**, which asks for a decision and forbids half of one: *"Decide whether the console
adopts release or the API adopts release, and change one side completely — URL, payload,
screen and the words the disbursing officer is trained on. Two names for money in one system is
how a reconciliation goes wrong."*

### The measurement

|  | console `release` | API `release` |
| --- | --- | --- |
| occurrences | 451 across 80 files | — |
| database tables | none | `releases`, `release_batches`, `release_transitions` |
| permission keys | none | `request.release`, persisted in `role_assignments` |
| published URLs | none | 7, under `/api/v1`, consumed by **four** clients |
| cost of changing | a compiler-checked rename | a migration, a permission rename, and **`/api/v2`** |

The last row decides it on its own. Backend Article 4: *"Breaking changes require `/api/v2`, never
an in-place mutation."* Renaming `admin/releases` to `admin/releases` is a breaking change to
a published surface that citizen web, citizen mobile, the admin console and verifier devices all
read. Changing the console costs a rename the TypeScript compiler verifies exhaustively.

### The console was already half-way there

`src/app/domain/releases/` holds `release.ts`, `release-batch.ts`, `release-manifest.ts`
and `releases.spec.ts`. Inside `release.ts`, `releaseProblems(release: Release)` and
`sumReleased(releases)` already name their variables the API's way, and `DL-89`, `DL-90`, `DL-91`
and `DL-93` are all written about "a release".

So this is less a change of vocabulary than the removal of a second one that had already lost.

### What changes

`Release` → `Release`, `ReleaseStatus` → `ReleaseStatus`, the filter, the sort field, the
catalogues, the folder, the repository port and token, the route path and the navigation label —
**including the words on screen**, because the command names those specifically and a disbursing
officer trained on one word and reading another is the failure this rule exists to prevent.

`ReleaseKind` and `ReleaseAcknowledgement` are already correct and do not move.

### The one awkward name, kept on purpose

The mechanical rename turned `disbursement.release` into **`release.release`**, which reads oddly.
It stays. The resource is a release and the act is releasing, which is exactly the shape of the
API's own `request.release` — and inventing a synonym to avoid the stutter would put a second word
for money back into the system, which is the thing this entry exists to remove.

The wider divergence around it is **not** settled here: the console holds `release.view`,
`release.schedule`, `release.release` and `release.void`, and the API holds `request.release` and
`request.schedule`. That is part of L-23, which is on the master TODO as its own decision.

### What did not need changing

The **screens already said "Releases"** — title, subtitle, payout-session copy, the navigation
label. Only the types disagreed. So the officer's words were never the problem; the second
vocabulary lived entirely in the code, which is where a naming divergence is hardest to notice and
easiest to keep.

---

## DL-134 — archiving is terminal, superseding DL-124's republish clause

`DL-124` allowed `archived → published`, reasoning that *"taking a post down can itself be a
mistake"*. TAB 10 step 1 asks for the console's lifecycle to be reconciled against the API's, and
the reconciliation went the opposite way to the one the command anticipated: it warns that the API
may be more permissive, and here **the console was**.

`PostStatus::Archived` on the API has **no outgoing transition**, and its stated reason is about
the reader rather than the office:

> An archived post is republished as a NEW post, never resurrected. Resurrecting one would put a
> post back at the top of the feed with its original date, which reads as the office announcing
> something old as if it were new.

That argument wins. `DL-124`'s was about the office's convenience; this one is about what a
resident sees, and this is the module where *"nothing can be taken back"*.

It was also a control that **could not work**. The button would have produced a refusal a
caseworker could do nothing about, which is worse than no button — the console must not expose a
capability the API refuses.

The mistake case is not lost. It is served by publishing a *new* post, which is what actually
happened and what the feed should say happened.

Everything else in `DL-124` stands: no unpublish, no retract, no unsend, and the warning shown
**before** the publish button rather than as a confirmation after.

---

## DL-135 — the inbox is fetched on demand; nothing polls, and nothing claims to be live

TAB 11 step 10: *"Decide the delivery mechanism honestly: poll on a stated interval, or subscribe.
Do not implement a five-second poll against a shared API and call it real time."*

**The decision is neither: on demand.** `NotificationStore.refresh()` runs when the inbox drawer is
opened, and at no other time. There is no interval, no subscription, and no background request.
The only timers in the store dismiss toasts.

### Why that is honest rather than lazy

The console **shows no unread badge**. `unreadCount` exists and is used for exactly one thing —
disabling *Mark all read* inside the drawer that has just been loaded. Nothing in the shell
advertises a number that would have to be kept current.

That is what makes on-demand correct. A badge is a **freshness claim**: a "3" sitting in the corner
tells a caseworker there are three things waiting, and if it is only recomputed when they open the
drawer, it is a claim the system cannot keep. Polling to support a badge nobody asked for would put
a recurring request from every open tab against a shared municipal API for a feature that does not
exist.

### What it costs, said plainly

A notification raised **by the server** — a case assigned to you, a referral gone overdue — is not
seen until somebody opens the inbox. Notifications this console raises itself still appear
immediately as toasts, because they never travelled.

That is a real limitation and it is the right one for now: this is an admin console used by people
sitting at the screen doing the work, not a paging system. `DL-96` already draws the line — a
notification is *something that happened*, and a work item is *something you must do*. Anything
genuinely owed to somebody belongs in their work queue, which is a screen they open deliberately.

### The condition for revisiting

**If a badge is ever added, this decision must be revisited in the same change.** A badge without a
stated refresh interval is the dishonesty the command names; a badge with one is a poll, and the
interval then has to be chosen against real load and written down here.

---

## DL-136 — the mock stays, and can no longer reach a production build

TAB 12 step 5 asks for the mock's future to be decided explicitly, and recommends keeping it
*"scoped to development and testing, with a check that fails the build if a production
configuration can select it."*

**Kept.** Deleting it would remove two things worth more than the risk it carried: the offline path
(a UI change would need a database, a seeded registry and a running API), and the fast test double
that 1,580 tests run against in seconds.

### What made it dangerous was not the mock

`environment.ts` said `production: true` and `dataSource: 'mock'`, and **nothing objected** — the
build succeeded, every test passed, and the bundle was valid. The command names this as having
shipped once already, and it was still true when TAB 12 opened.

Two things now prevent it, and neither is a convention:

* `check:environments` fails the build on a production configuration that selects the mock, points
  at localhost, serves plaintext, ships developer tooling, carries anything shaped like a
  credential, or names an API host no CSP allows.
* `check:bundle` inspects the **built artefact** for seed markers — because a tree-shaking
  assumption is not a guarantee.

### The structural change, which is the real fix

The seam used to be one module holding both adapter sets, chosen at runtime:

```ts
environment.dataSource === 'http' ? httpProviders() : mockProviders()
```

A **runtime** decision over **static** imports. Every mock repository, and through them the entire
seed registry, stayed reachable from a live import — so `check:bundle` found invented residents in
the production artefact on its first run.

It is now two files, swapped by `angular.json` exactly as environments are: `data-access.providers.ts`
names no mock class at all, and `data-access.providers.mock.ts` is selected only by the `development`
configuration. A production build cannot reach the mock because it never imports it.

Production initial bundle after the change: **43 kB**.

---

## DL-137 — the search term never enters the URL

TAB 16's guardrail: *"Never put a resident's name in a page title, a browser tab or a URL that a
screenshot or a shared link would carry."*

The search screen wrote the term to `?q=`, and a test asserted that deliberately: *"keeps the term
in the URL so a search can be sent to a colleague."* The convenience is real and it is not worth
what it costs.

A search for `Dela Cruz` put that name in the address bar — in every screenshot of the screen, in
every pasted link, and in **browser history**, which outlives the session and belongs to whoever
sits at that desk next.

`DL-110` had already reached this conclusion for storage: *"there is no way to tell a safe query
from an unsafe one — 'Dela Cruz' is a surname and also a street"*, so nothing is persisted, and the
recent-terms list lives in a signal for the tab. **The URL is persistence.** It was simply a
surface that entry did not name.

### What is lost, and why it is affordable

A refresh clears the search, and a search cannot be sent to a colleague as a link. That is the same
cost `DL-110` already accepted for the recent-terms list. And the colleague is staff with the same
access: they can type the name themselves, which is one action and leaves no copy anywhere.

## DL-138 — the console is not localised, and the reason is recorded

TAB 16 step 9: *"Decide the Filipino question. One mobile client already localises. Decide whether
the console does too, and if not, record why."*

**Not localised. English only, for now.**

* **The audience is different.** The mobile client speaks to residents, who are entitled to be
  addressed in the language they use. This console is used by MSWDO staff, who work in English —
  the forms, the DSWD issuances, the case files and the reports they file upward are all in
  English, and a console that said *"Naipasa"* while the form said *"Endorsed"* would add a
  translation step to every act rather than removing one.
* **The guardrail is the deciding argument**: *"Do not machine-translate welfare terminology. A
  mistranslated status is a mistranslated decision."* This vocabulary is the office's, and several
  terms — `endorsed`, `deferred`, `unclaimed`, `superseded` — carry meanings that were argued over
  in earlier commands. Translating them is an MSWDO decision about their own words, not an
  engineering task, and doing it badly would put a wrong word on a record about a family.

### What would change the answer

A barangay focal person or an encoder who works in Filipino. That is a real possibility, and the
command's instruction is to *"extract strings before launch rather than retrofitting after"* if the
answer is yes.

**The strings are already extracted**, which is the part that costs money later: every screen reads
its text from a `*.copy.ts` file rather than holding it inline. Adding a locale is a translation
job and a lookup, not a rewrite — so this decision is cheap to reverse, which is why it can be
taken now rather than deferred.

---

## DL-140 — the lawful basis is its own act; `DL-81`'s doctrine survives its mechanism

**Supersedes the mechanism in `DL-81`, not the rule.**

`DL-81` requires that a referral cannot be sent without a lawful basis *recorded in the same act as
the sending*, "so there is no window in which a sendable referral has none". It implemented that as
a signature: `ReferralRepository.send(id, plan)`, with `check:referrals` asserting the shape.

**The mechanism guaranteed the mock and nothing else.** `POST admin/referrals/{referral}/send`
accepts **no body at all** — the plan was being posted to an endpoint that never read it. Against
the real API the guarantee did not exist, and could not have, however strictly the console typed it.

Where it does exist is the server. `ReferralService::send` calls `blockersFor` **inside the row
lock**, before the transition, and refuses `disclosure-basis-required`. Its own comment says why:

> *"The lawful basis is what makes the disclosure lawful at all (RA 10173). A check that lives only
> in a request validator is a check the next write path will not have."*

So the port now mirrors the API: `recordDisclosureBasis` and `shareField` are their own recorded
acts, and `send` takes only an id. A referral without a basis cannot be sent because **the server
will not perform the transition**, which is stronger than a parameter a client could always have
passed an empty object to.

`check:referrals` now asserts the shape that carries the doctrine — the basis is its own act, `send`
takes no plan, and the mock refuses a send without one — rather than the signature that expressed
it. Both directions are validated against planted regressions.

**One field at a time survives unchanged** (`DL-82`). `shareField` records one field with one stated
need, because a batch would let a screen submit six fields under one sentence covering all six.

**What is weaker, and named as such:** the console can now leave a referral with a basis recorded
and no fields chosen, or fields chosen and no basis, between two requests. Neither state can be
*sent*, which is the property that mattered — but the intermediate states exist where previously
the composing screen held everything until one submit. That is the price of matching the API's
shape, and it is paid on a draft nobody outside the office can see.

## DL-141 — an assessor's recommendation is a record, not a decision; the console was missing it

`AssessmentDraft` carried findings, a recommended amount and a home-visit flag, and no
recommendation. That looked like `DL-60` being honoured — intake advises and never decides — and it
was not. `DL-60` is about what the **software** may conclude from a duplicate check. What a social
worker advises after reading a file is the substance of their professional judgement, and leaving
it off the form does not stop the decision being made; it stops the office recording who advised
what before somebody made it.

The backend has held the distinction all along, in the enum's own words:

> A RECOMMENDATION IS NOT A DECISION. … `recommend-approve` — The assessor recommends the case be
> approved. **A human with approval authority decides.** … Completing an assessment therefore moves
> a case to `endorsed` at most.

`POST admin/assistance-requests/{case}/assessment/complete` validates `recommendation` as
`required, in:Recommendation::values()`. The console could not have completed an assessment without
it, and was not trying to: `recordAssessment` posted to `POST .../assessment`, which is the
server's **`open`** action — it takes a `template_code`, starts a blank assessment, and accepts no
findings at all. `check:routes` passed it because both paths are published and both take `POST`; a
verb-aware path check answers "is there an endpoint here", never "is it *this* endpoint".

So the four values now live in `domain/intake/assessment.ts` with the enum's reasoning preserved.
`insufficient-information` is the empty draft's default because it is a first-class answer rather
than an absence — putting `recommend-approve` on a form nobody has filled in is exactly the
collapse this entry is about — and `SocialWorkerAssessment.recommendation` is **nullable** where
the draft's is not: an assessment recorded before the console asked carries none, and "nobody was
asked" is a different claim from "the assessor could not form a view".

### The check had to be narrowed, and narrowing it is not weakening it

`check:intake` rule 1 forbids a decision-shaped field anywhere under `domain/intake`, and
`recommendation` is on its list. Its scope was wider than its doctrine: the rule exists so that no
applicant is approved or denied by a frontend score, and a field a person types is not a score.

The carve-out is one file and one field, and it is paid for by a new rule 1b: **nothing may derive
a recommendation** — no function under `domain/intake` may return `AssessmentRecommendation`. A
human may record one; no code may compute one. Four planted regressions confirm the pair still
bites: `eligible` on `AssessmentDraft`, `recommendation` on `IntakeAdvisory`, a function returning
a recommendation, and `score` declared beside the permitted field. All four fail the check.

### Two fields of the draft have nowhere to go, and one precondition is unmet

`complete` takes `recommendation`, `reason` and `findings`. There is no field for
`recommendedAmount` and none for `homeVisitConducted`, so `toWireAssessment` sends neither and the
loss is written down rather than smuggled into free text. And `complete` requires an assessment
already open, which only `open` creates from a published `template_code` — a vocabulary this
console has never read. The save therefore still fails, but it now fails against the endpoint that
could succeed, which is the half of the fix that does not require choosing templates on the
office's behalf. Both are recorded in `docs/integration/release-engineering.md`.

## DL-142 — an assessment is opened from a published form, and the form says it is provisional

`DL-141` pointed `recordAssessment` at `POST .../assessment/complete` and recorded that the save
still failed, because `complete` requires an assessment already open and nothing in this console
opened one. This closes that: the console reads `GET admin/assessment-templates`, opens an
assessment from a chosen template, answers its questions, and only then completes.

### The version travels with the assessment, and is shown

The server reads a template's version **once**, at open, and pins it on the row — deliberately, and
its own comment says why: reading it again at completion would let a mid-assessment change to the
form alter what an assessment appears to have asked, and the recorded answers would then be
attributed to questions that were not the ones put to that family. It matters most precisely when
somebody is disputing a decision made two years ago.

So `OpenAssessment` carries `templateVersion` and the screen prints it. A version nobody can see is
one nobody notices has changed.

### A form the office has not adopted says so

Both published templates are `placeholder-pending-lgu-approval`, and the config file is blunt about
it: "a plausible AICS-style intake assessment, not Taytay's instrument". The screen carries that
sentence, in the pattern `DL-68` set for the review windows and `DL-105` for the small-cell
threshold — a provisional instrument states that it is provisional until somebody records the check,
rather than being quietly presented as settled office policy.

The mapper reads **any unrecognised status as provisional**. The safe direction for an unknown value
is the one that keeps the caveat up.

### The mock now refuses what the server refuses

`MockAssistanceRequestRepository.recordAssessment` used to complete a case study from nothing. The
server never would: it requires an open assessment, every required question answered, and a stated
reason for a recommendation to refuse. The mock holds all three now, and one existing spec started
failing immediately — it had been filing an assessment against no form at all and passing.

That is the same lesson the requirements checklist taught this repository once already: *a mock more
convenient than the thing it stands in for is one a screen gets built against*. It is also how
`recordAssessment` sat on the wrong endpoint for a whole programme without a single test noticing.

### `reason` is required for exactly one recommendation

The server requires it when recommending refusal, and gives the ground: the applicant will be told a
decision followed from this, and "the assessor recommended refusal" with no stated basis is not
something anybody can appeal or a supervisor can review. `assessmentProblems` says the same thing in
the same words, before the button is pressed.

It is deliberately **not** required for the other three. A reason demanded on every recommendation
becomes a sentence typed to get past the form, and the one place it must mean something is the one
place it would then not. `insufficient-information` in particular asks for nothing extra: it is a
first-class answer precisely so that an incomplete file does not become a denial, and taxing it
would push assessors towards the recommendation that asks fewer questions.

### What the screen refuses, it explains

`canSaveStudy` is false while the form is unopened, a required question is unanswered, or a refusal
has no reason — and every one of those is named on screen beside the disabled button, in the form's
own wording. A disabled control with no stated cause is what `DL-60` and `DL-98` each refuse in
their own domains: software that declines and does not say why. Nothing here is invented — the
server checks all of it again inside its own transaction, which is where the guarantee lives
(`DL-140`). Saying it earlier only saves the assessor from writing findings a failed save would
strand.

### The checks that were not watching

See `docs/integration/release-engineering.md`: four scanners matched `this.api.` contiguously and
so never saw a call whose chain had wrapped across lines. Thirteen calls were invisible, two of them
real pre-existing debt. The counts went **up** because the checks got better, which is the only
reason a ratchet may move that way.

## DL-143 — a scanner that welds a call is one wrapped line from going blind

`DL-142` recorded four checks that had stopped watching part of the surface: their patterns matched
`this\.api\.` with the dots contiguous, so any call whose chain wrapped across lines was invisible.
They were found by accident — three adapter methods were added and a count did not move. This
audits the rest and closes the class.

### The audit, and the two methods that did not work

**First method: widen every scanner's patterns and diff the output.** Widening is monotonic — a
`\s*` also matches nothing — so a rewritten pattern can never report *less*, and a changed verdict
would mean the original had been blind. Result across 37 tools: **27 carried the assumption, none
behaved differently.**

That is a weaker result than it sounds, and mistaking it for "no blind spots" would have ended the
audit one step early. It says the assumption costs nothing *on today's source*. The four defects in
`DL-142` were latent for the whole programme and became real the moment somebody wrote a call that
wrapped. An output diff cannot see a risk that has not fired yet.

**Second method, abandoned: mass-rewrite the lot.** All 118 occurrences across 27 tools were
mechanically widened and every tool's output came back byte-identical. That looked like proof and
was not, for the same reason: monotonic rewrites cannot change a verdict, so identical output
demonstrated only that nothing was *lost*. What it hid was that several patterns had stopped meaning
what they said. `127\.0\.0\.1` came out as `127\s*\.\s*0.0\s*\.\s*1` — with an **unescaped** dot in
the middle, now matching any character — and `psa\.gov\.ph`, `chart\.js` and a CSS `0\.01ms` were
all rewritten to tolerate whitespace inside literals that can never contain any.

None of those is a member access. **A dot in a regex is a member access because of what the pattern
is for, and no amount of looking at the character can tell you.** The rewrite was reverted.

A third rule was tried and is recorded because it was actively wrong rather than merely useless:
rewriting a literal space to `\s+`. In a pattern ending `\n  \}` it catches only the first of two
spaces and yields `\n\s+ \}`, demanding *three* whitespace characters where the source has two —
**stricter, not looser**. It turned five passing checks into confident false failures before the
arithmetic was checked. A widening rule that is not monotonic is not a widening rule.

### What was actually wrong, and what now holds it

Reduced to what could be defended: a pattern that reads **a call on an object** — a receiver, a
dotted hop, and a paren or a generic. Those are the only ones a wrapped chain can reach, because
Prettier breaks a method chain and does not put a newline between an object and a plain property.

**Eighteen more were found**, in exactly the places where a silent miss is worst: `this\.append\(`,
`this\.record\(`, `this\.move\(`, `this\.compose\(`, `this\.disclose\(` — the assertions that a
mutator still appends to its audit trail (`DL-54`), that a registrant row is still composed rather
than returned whole (`DL-130`), that a resident name still goes through `discloseResident`
(`DL-38`). Each would have gone green while the behaviour it guards was gone. Two more were found
after the detector learned that `\)\.length` is also a member access.

All twenty were widened, and every other tool's output was re-run and diffed: **identical**.

`npm run check:scanners` now fails the build on a welded call in any tool. It counts 24 patterns
reading a call on an object and asserts all of them tolerate whitespace. Mutation-tested: restoring
a welded call fails it, adding a new one fails it, and a hostname or an IP literal does not trip it.

One shape slips past by design — `/this\.disclose(/`, welded with an *unescaped* paren. It cannot
ship silently: an unterminated group is not a valid regex and Node refuses to load the file. That
was verified rather than assumed, and the interpreter is a stronger guarantee than this check.

### Why a bare `(` is not a call marker

Accepting one fired on ten property reads whose paren is an alternation —
`meta\.(pageSize|totalItems)`, `API_ENDPOINTS\.(\w+)`, `{{[^}]*\.(birthDate|…)`. A property read is
not what wraps, and a template interpolation never wraps at all. The narrow marker stands.

## DL-144 — a field that is silently discarded is worse than a field that is absent

`DL-141` recorded that `POST .../assessment/complete` has no field for `recommendedAmount` or
`homeVisitConducted`, and left it as a gap to settle. Settling it turned up two corrections.

### It is not a new gap

The welfare schema holds **one amount column anywhere**: `releases.amount_centavos`, money actually
handed over. `welfare_cases` has none. `assessments` has none. The recorded detail response carries
twenty-one keys and not one of them is an amount, which `check:contract`'s own spec has asserted
since TAB 08 — *"There is no money on this resource at all; it lives on releases."*

So `recommendedAmount` is the third field in `L-17`, alongside `requestedAmount` and
`approvedAmount`, and recording it separately was a mistake that would have had TAB 08 solve the
same problem twice. The console models money on the request; the API models money only on the
release. That is one decision, and it is the office's and the backend's, not this lane's.

### The tempting wrong home is closed twice over

`welfare_cases.needs_home_visit` exists, and it is not where a conducted visit goes. *Needs* is a
plan and *conducted* is a fact, and a plan written into the record as a fact is a misrecording that
outlives whoever made it — the same confusion `DL-85` keeps out of a visit narrative, where an
observation, a report and a judgement must each say whose claim it is. It is also **read-only**: the
case controller projects it and no endpoint writes it. Both roads are shut, which is a cleaner
outcome than one road being merely inadvisable.

### What this lane can decide, and did

Not where the amount goes — that is TAB 08's. What a caseworker is told while it goes nowhere.

This repository has already settled the principle three times in other domains. Retention invents
nothing and the screen says "No schedule recorded" rather than a zero (`DL-113`). The correction
capture screen is not built and the governance page says so rather than offering a form that goes
nowhere (`DL-117`). And most directly: *"a half-built invite form is worse than none, because
whoever fills it in reasonably believes an account now exists"* (`DL-32`).

**The belief is the harm.** A social worker who writes "₱6,000 recommended", and learns at approval
that nobody downstream can see it, has been failed the same way — worse, because the family is in
the room for the second conversation. So the assessment screen states plainly that the two figures
stay on the screen, says what the record actually holds instead, and tells the assessor to write
anything an approver must see into the findings, which *is* sent.

The notice sits **above** the two controls, not below. Somebody deciding whether to type an amount
reads a notice above the box; somebody who has already typed one dismisses a notice below it. Same
ordering as the publish warning, for the same reason (`DL-124`). It is styled as a note rather than
an error, because nothing has gone wrong and a caveat dressed as a failure is one people learn to
dismiss (`DL-98`).

### The rule is conditional, so it retires itself

`check:intake` does not assert that a string exists. It reads `toWireAssessment`, and **only if**
the mapper is still dropping `recommended_amount` or `home_visit_conducted` does it require the
notice, require it to say what the record holds, and require it to precede the controls. The day
the backend gains the fields and the mapper sends them, the rule stops applying on its own.

Nobody has to remember to delete a notice that has become untrue — which is the failure mode of
every warning written as a fixed assertion, and the reason this one is wired to the omission it
describes. Mutation-tested four ways: deleting the notice fails, gutting its explanation fails,
moving it below the controls fails, and sending both fields lifts the requirement.

## DL-145 — a ratchet number that goes up is not self-evidently a finding

`DL-142` widened four scanners and recorded that two pieces of real pre-existing debt fell out. One
of them was not debt. It was the tool's own arithmetic, and the correction matters more than the
number.

### What the extra key actually was

`check:query-params` went from 54 unreadable filter keys to 55 when its call-site scan learned to
see a chained call. That was read as a key that had always been sent and always ignored, hidden by
the blind spot — a plausible reading, consistent with what the other three scanners had just turned
up, and wrong.

The 55th key was `householdMembers`, at the resident-profile composition:

```ts
this.api
  .optionalItem<HouseholdDetail>(`${API_ENDPOINTS.households}/${household.id}`)
  .pipe(map((detail) => ({ view, household, householdMembers: detail?.members ?? [], history })));
```

`householdMembers` is a key in the **mapped result**. It is not a query parameter and never reaches
a URL. It was counted because the scan bounded a call at the next `);` rather than at the call's own
closing paren, so the whole `.pipe(map(…))` chain fell inside what the tool believed were the call's
arguments — and the object literal in the mapping function was read as a bag of filter keys.

Widening the scanner did not find debt. It made a **second, older defect in the same tool** visible
for the first time, because until then the tool could not see chained calls at all, and a chain is
the only shape that puts a pipeline inside the argument span.

### The general lesson, which is the reason this has its own entry

`DL-142` and `DL-143` are about scanners that go quiet. This is the opposite failure and it is
easier to get wrong, because the number moved in the direction that looks like diligence. A ratchet
that ticks up is not self-evidently a finding — it is a prompt to go and read the thing it counted.
Recording it as debt would have left a permanent false entry against `L-24` and sent somebody to
"fix" a filter key that does not exist.

The bound is now depth-counted, the same repair `check:routes` had for the same reason: read each
call's own arguments, never a span delimited by punctuation that a chain can move. The scan also
refuses to run if it finds fewer than 50 calls, so a future parser breakage fails loudly instead of
reporting an encouraging zero. Mutation-tested: a camelCase key added at an ordinary call site fails
the check, and so does one added to a chained call.

Ceiling back to **54**. `L-24`'s real figure was never 55.

### The other ceiling stands, and why it cannot come down

`check:mapper-adoption` remains at 45. The debt is genuine — two call sites cast to
`HouseholdDetail`, a type no mapper builds — and it cannot be cleared here, because
`household_memberships` carries **no role column**. `HouseholdRole` is `head | spouse | child |
parent | relative | non-relative` and the resident profile prints it beside a person's name; the
schema records relationships resident-to-resident instead (`DL-47`), which is a different claim.
A mapper would have to invent a relationship for every member of every household.

That is `L-14`'s refusal with a sharper edge: a missing relationship is a gap, an invented one is a
false statement about a family. The cast is meanwhile not inert — against the real API the panel
renders a list of blank cards, the `L-22` failure mode on a screen that names people — and rendering
an empty list instead would assert the household has no members. It needs the backend to publish a
role, and until then it needs what `DL-144` gave the missing amount: the panel saying what it could
not read. Recorded in `docs/integration/release-engineering.md`, not patched.

## DL-146 — "we could not read it" is a third answer, and a screen must not have two

`DL-145` recorded that the resident profile's household panel renders **a list of blank cards**
against the real API: the household payload's membership rows carry `effective_from` and no role,
they were typed straight through as `HouseholdMemberView`, and every property the template reads —
`member.view.resident.id`, `member.role` — comes back `undefined`. This fixes it, and the fix is not
the obvious one.

### Rendering nothing would have been the wrong repair

The reflex is to map what exists and leave the members empty. An empty list renders "No household
members recorded", and that is a **positive claim about a family** made from data nobody sent — the
same trap `L-14` refused for the vulnerability band, where the only available value for a household
nobody had assessed was `'none'`, which reads on screen as "no vulnerability factors present".

There are three answers about who else lives at an address: somebody does, nobody does, and the
office could not read it. The type carried two, so the third had to become one of the others.

### The absence is now a state, not a value

`ResidentProfile.householdMembers` is a `HouseholdComposition` — `{ kind: 'read'; members }` or
`{ kind: 'unavailable'; because }` — on the same principle as `ViewState` making "still loading"
unmistakable for "no results", and `CaseNoteView.body: null` keeping a withheld note listed so
nobody reads a partial file as a complete one (`DL-58`).

The mock answers `read`, because it holds a role for every membership and genuinely can. The HTTP
adapter answers `unavailable` and stops pretending. That divergence is the point: the two adapters
now differ where the *systems* differ, instead of the mock's competence masking the API's gap —
which is how this panel shipped looking fine for the whole programme.

`membersOf()` exists so a caller that only needs a count is not forced to repeat the narrowing, and
it is **deliberately lossy**: it returns `[]` for `unavailable` too. That is why `check:beneficiary`
requires a template reaching the members to branch on `kind` as well. `membersOf(x).length > 0`
reads naturally, does the right thing for both `read` states, and silently reintroduces the whole
defect — one edit deep, invisible in review.

### The sentence names the record, not the software

*"Who else lives at this address could not be read from the office record. This is not a statement
that nobody does — the household register is there, but it does not yet say how each person is
related to the head, and this console will not guess. Open the household record for the address
itself."*

Three things it does deliberately. It **refuses the misreading in as many words**, because the
whole failure is a reader concluding the family is alone. It **says where to look instead**, so the
caseworker is not left holding a dead end. And it says nothing about APIs, payloads or nulls: a
caseworker reading "the endpoint omits household roles" learns about this office's procurement,
where "could not be read" tells them something about the family in front of them.

It lives in the domain rather than in feature copy because the **data layer** is what decides the
answer is unavailable — the same reason a payout manifest and an export notice are composed there
(`DL-92`, `DL-106`). The sentence and the fact travel together, or the second screen states the
absence differently from the first.

### What is still owed

This makes the console honest; it does not make the panel work. `household_memberships` needs a
role, or the API needs to publish the resident-to-resident relationships it already stores
(`DL-47`), before the composition can be read at all. `check:mapper-adoption` stays at 45 for the
same reason. Recorded in `docs/integration/release-engineering.md`.

## DL-147 — an account cannot be switched back on, and the console now says so

`setAccountActive` posted `{ isActive, reason }` to `staff/{id}/status`, a path the API serves at no
verb. **No account has ever been switched off or on from this console.**

`DELETE staff/{staff}` is what exists, and the asymmetry it exposes is the reason this has an entry
rather than a line in a commit message: **there is no reactivation route at all.** Switching an
account back on is not a call somebody forgot to wire — it does not exist on the server.

So the adapter deactivates through `DELETE` and **refuses reactivation with a sentence naming what
to do instead**, on the `setFamilyHead` pattern already in this file. An administrator who clicks
"switch on", sees a success toast, and tells a colleague their access is restored has been failed
twice over — and the colleague finds out at the counter. This is `DL-32`'s rule again, which already
settled that accounts are provisioned outside this console and that a form which cannot work is
worse than none.

### The reason is captured and not sent, and the screen says so

`deactivate` validates nothing and reads no body. Sending `reason` anyway would put a field on the
wire the server discards — the exact dishonesty the mapper layer exists to remove, and the same
shape as the assessment's recommended amount (`DL-144`). It stays required by the port and stays on
the confirmation, because the office asks for it.

`DL-116` is untouched. The server ends the live session itself and enforces the same
self-deactivation guard the console does, so the guarantee never depended on this call.

### One of twenty — and the triage below it was wrong, see `DL-150`

**The classification in this section is superseded.** It was produced by grepping the published
route list for substrings guessed from each composed path, and four of the seven "genuinely absent"
entries turned out to have published counterparts that did not share the substring searched for.
`DL-150` records the corrected triage and the tooling that now does the comparison. The `staff`
finding above stands; the counts and the "genuinely absent" list do not.

### One of twenty, and that is the finding

The instruction was "attack the 404s". Read against the published routes **and the controllers
behind them**, the twenty split four ways, and only this one was a wrong URL:

- **1 wrong endpoint** — this.
- **3 right idea, different model.** The duplicate pair is the sharp one: this console computes a
  resemblance and addresses it by two resident ids, while the API persists a pair row with its own
  uuid, a decision and a note, created by a `detect` run this console never calls. The queue would
  be empty even if the paths matched. Adopting that is a domain change, not a URL edit.
- **6 genuinely absent.** `POST admin/reports/{}/export` is the one to watch: the nearest published
  route, `.../run`, **404s a person-level report by design**, so pointing `export` at it would turn
  the one report that names people into "report not found" (`DL-104`, `DL-106`).
- **10 the case surface**, blocked on ADR 0044.

Triaged in full in `docs/integration/release-engineering.md`. Routes 21 → 20, wire-adoption 11 → 10.
Gate line 05/07 stays NO-GO: nine of the ten non-case paths need a backend route or a decision about
which model wins.

## DL-148 — a duplicate pair is a record the office is holding, not a resemblance it recomputes

`DL-147` triaged the unwired paths and put the duplicate queue in the "right idea, different model"
column. This adopts the API's model, and the model is the whole of it — the URLs were a symptom.

### The console was computing what the office is supposed to be holding

Two records resemble each other from the moment they both exist. A **pair** exists only once
somebody has run a detection and the office has taken it on: the API persists a row with its own
uuid, a `decision`, a `decision_note` and a `decided_at`, and addresses every act on it by that id.

This console had no pair id at all. It addressed a pair by its two resident ids, which cannot name
the same thing, and the consequences ran deeper than two 404s:

- `POST admin/resident-duplicates` and `GET admin/resident-duplicates/preview` are served at no
  verb, so **no finding has ever been recorded and no preview has ever been read**.
- `POST admin/resident-duplicates/detect` was never called, so **the queue was read and never
  filled**. An empty screen meant "nobody has looked" and read as "there are no duplicates" — the
  `DL-112` failure, a wrong answer delivered with confidence, on the surface that decides whether
  two files are one person.

`DuplicateCandidate` and `IdentityResolutionDraft` now carry a `DuplicatePairId`, the adapter posts
to `{pair}/decide` and `{pair}/preview`, and the review page has a **Look for duplicates now**
action that reports a count.

### The count states a number and refuses a verdict

"12 pairs found" beside a queue invites the reading that the software has identified twelve
duplicates. It has identified twelve pairs somebody has to look at. The message says so — *"Each is
a question for a person, not a finding"* — and zero says *"No pair in the registry resembles another
closely enough to ask about"* rather than a bare nought. This is the sixth surface where a signal
could quietly become a decision engine, after `DL-42`, `DL-60`, `DL-66`, `DL-78` and `DL-98`.

### One value translates, and the domain keeps its wording

The API accepts `same-person | different-person`; this console says `same-person |
**distinct-people**`. `DL-74` chose the second deliberately: *these are two people* is a statement
about the records, where *this one differs* reads as a comparison that could be redone. So the
domain keeps its word and `toWireIdentityResolution` carries the translation. Renaming either side
would lose an argument nobody would remember having had, which is what a transport seam exists to
prevent.

### What a finding recorded from here does not say

`decide` takes `decision` and `note` and nothing else. **Which record survives is settled by
`merge`, and this console never calls merge** (`DL-74`: "There is no merge"). So a `same-person`
finding recorded from here says the two records are one person and does *not* say which is
canonical — even though the reviewer picks one on screen to see the preview.

That is a real gap and not a mapping detail: superseding is what stops the second record being used
again, and `IdentityResolution.canonicalResidentId` is a field this console can display from its
mock and never from the server. It is **not** smuggled into `note`, where no query could find it and
no reviewer could rely on it. Recorded in `docs/integration/release-engineering.md`.

The mock keeps computing pairs, because it has no detection run to persist one, and names each pair
from its two resident ids **ordered** — the API stores `lower_resident_id` and `higher_resident_id`
for the same reason. A mock that minted a different id per direction would let a screen record two
findings about one pair and pass.

### Four ratchets moved

Routes 20 → **18**, wire-adoption 10 → **9**, query-params 54 → **53**, mapper-adoption 45 → **44**.
The last two are ground gained by *deleting* a call: the old preview sent two camelCase keys to a
URL nobody serves and cast the answer to `MergePreview`.

## DL-149 — the counts are read at a time, not as of one

`metrics()` asked for `admin/events/{event}/metrics`. The API publishes
`admin/events/{event}/registration-summary`, and the two are not a rename apart: the summary is
built for a registration screen, carries capacity and availability alongside the counts, and nests
attendance under its own key. Six of `EventMetrics`' eight fields map exactly; the other two are
the reason this is a mapper.

### `cancelledCount` is `null`, never `0`

`summaryFor` publishes registered, waitlisted, seats remaining, and attendance as `attended` /
`no_show` / `not_checked_in`. Nothing about withdrawals.

A `0` there says **nobody withdrew** — a claim about a list of real people made from a field the
server never sent. It is `DL-146`'s failure with a number in place of an empty list, and it takes
the same answer: the type carries the absence, and a screen shows it rather than reporting a quiet
nought. The mock keeps a real count, because it genuinely tracks cancellations; the adapters differ
where the systems differ.

### `asOf` is when the console read them, and the wording has to say so

`DL-129` requires the moment to travel with the counts, because "38 registered" without a timestamp
is a claim about *now* that was true at some point. The summary carries no timestamp at all.

The closest true statement available is when this console asked, so that is what the field holds —
and the domain says it in as many words: screens word it **read at**, never *as of*. A server stamp
would be the better number, and asserting one the server did not make would be the worse lie: read
time is *later* than count time, so labelling it "as of" claims the data is fresher than it is. The
difference is small and it is the whole difference between reporting a fact and inheriting one.

Only the server can say when it counted. That it does not is recorded as a gap rather than closed
with a stamp that implies otherwise.

### The rate is derived, and withheld while anyone is unmarked

`attendanceRate` is `null` while any registrant is `not_checked_in`. `DL-131` keeps "not checked in"
and "no-show" apart precisely so that nothing turns an unmarked registrant into an absent one, and a
rate taken mid-marking does exactly that — it reads as a poor turnout and is really an unfinished
afternoon. Being unable to state a rate is the correct answer until somebody has finished marking.

### The tooling caught what a reviewer would not

Adding `@consumes GET admin/events/{event}/registration-summary` made `check:consumer-contract` fail:
the committed expectations file still described the old shape, and **the backend verifies against
that file**. A stale copy means it is proving the wrong thing — a green backend suite about a
request this console no longer makes.

Routes 18 → **17**, mapper-adoption 44 → **43**.

## DL-150 — I triaged the 404s by guessing substrings, and got four of seven wrong

`DL-147` classified the unwired paths and reported six or seven as "genuinely absent — the console
is not calling the wrong thing". That was produced by grepping the published route list for
substrings guessed from each composed path — `'reports/'`, `'privacy/'`, `'families/transfers'` —
and concluding nothing covered them when nothing came back.

Four had published counterparts that share no such substring:

| Composed | Actually published | What I searched for |
| --- | --- | --- |
| `POST admin/reports/{}/export` | `POST admin/exports`, report in the **body** | `reports/` |
| `GET admin/events/{}/registrants/export` | the same generic `POST admin/exports` | `events/` |
| `GET admin/privacy/corrections` | `GET admin/resident-corrections` | `privacy/` |
| `POST admin/families/transfers` | `POST admin/households/{household}/transfers` | `families/transfers` |

A fifth was wrong in the other direction: `GET admin/assistance-requests/advisory` is served as
`GET admin/assistance-requests/{case}/advisory` — per case, not per collection — which I had listed
as nothing at all.

### The export claim was the damaging one

`DL-147` said *"there is no export endpoint whatsoever"* and warned that pointing `export` at
`.../run` would turn the one person-level report into "report not found". The warning about `/run`
was right and beside the point, because `/run` was never the candidate. `POST admin/exports` is the
export endpoint, and it handles the person-level case **better than the console asked for**:

> The permission comes from the REPORT, not the route. A person-level export costs
> `report.export-person-level`; an aggregate costs `report.view`. One endpoint, two prices, decided
> by what is actually being copied out of the database.

That is `DL-104`'s doctrine implemented server-side. Filed as a backend request, it would have had
somebody build a route the API already serves, and `DL-106`'s export notice would have been recorded
as blocked when it is not.

### A guessed substring is a scan that under-reports

Which is the finding this file already carries twice. `DL-142` and `DL-143` are both about scanners
that stopped seeing part of the surface and stayed green about it; `DL-145` is about reading a number
that moved without checking what it counted. This is the same error committed by hand, in the
analysis rather than the tooling, one turn after writing the check that forbids it in code.

So the comparison is no longer done by eye. `node tools/check-routes.mjs --nearest` prints, for every
unwired path, the published routes that share the most path segments. Whoever reads the list is
looking at candidates rather than remembering to search for them.

It **suggests and never decides**, and that limit is load-bearing: `POST .../assessment` and
`POST .../assessment/complete` score identically and mean entirely different things (`DL-141`). A
match is a prompt to read the controller.

### The corrected picture

Of the seven non-case paths, **five are console-side repoints** — the four above plus the advisory —
and `POST admin/assistance-requests/{}/document-requests` is a shape mismatch the original triage got
right (the API raises a request against a **requirement**, not a case). Only
`PATCH admin/assistance-intakes/{}` has no counterpart of any kind: intakes are created and never
amended.

**One genuine backend absence out of seven**, where `DL-147` reported six. The corrected list and
the real backend asks are in `docs/integration/backend-requests.md`.

## DL-151 — a document is asked for against the requirement that needs it

`POST admin/assistance-requests/{case}/document-requests` is served at no verb. The API raises a
request against the **requirement** — `.../{case}/requirements/{requirement}/document-requests` —
and that nesting is the model rather than a URL preference: a request exists because a particular
slot on the checklist is unfilled, and one naming only the case could not say which. The console
already held the `requirementId` on the draft, so the change is which side of the request it
travels on.

### The read was broken in a way no gate could see

`listDocumentRequests` called `collection<DocumentRequest>`, which hands back `response.data`
untouched as an array. This endpoint answers `{ "requests": [...] }`, so `data` is an **object** —
every screen reading it would find no rows and show an empty list.

`check:routes` could not catch it: `GET .../{case}/document-requests` **is** published, at that verb,
and the check answers whether a request reaches an endpoint. `check:mapper-adoption` counted the cast
as debt but says nothing about which shape came back. Three ratchets were green about a read that
returns nothing, which is the case for the fourth question none of them asks: *would the answer be
understood*.

### Two fields the projection does not carry

**`requestedBy` is `null`, never invented.** The row publishes no requester. The point of recording
a request is that an applicant who says they were never told can be checked against something, and
"the office asked" without "and this is who" is a weaker record than it looks — but a fabricated id
would be worse, because it would name somebody.

**`is_applicant_overdue` is published and deliberately not read.** `DL-83` settled that overdue is
derived from the date and never stored: a stored flag needs a nightly job to stay true and is wrong
every morning until it runs. Taking the server's copy would import exactly the staleness the rule
exists to avoid. The console computes it from `neededBy`.

An unrecognised `state` reads as **`open`** — the one that keeps the row in front of somebody.
Defaulting to `answered` or `withdrawn` would quietly close a request the office still owes an
applicant, and nothing downstream would ask again.

### A method was added and then removed, because the gate was right

The domain has modelled a `withdrawn` state and a `withdrawnReason` since TAB 08, and **nothing can
produce either**: the API publishes `POST .../document-requests/{documentRequest}/withdraw` and the
port has no method for it, so a document asked for in error stays open against the applicant
indefinitely — counted as outstanding, and shown to them as something they still owe.

`withdrawDocumentRequest` was written on all three layers, and `check:port-adoption` failed it:
*"declared, implemented on both adapters and reachable from no screen. Either wire it to the feature
that needs it, or remove it."* Adding it to the unreached baseline would have been weakening a
ratchet to make a change pass, which this repository forbids in as many words.

It was removed. The real finding is larger than the missing method and is recorded instead:
**`requestDocument` and `listDocumentRequests` are themselves unreached** — the whole
document-request feature is built, mapped, routed, tested, and reachable from no screen. Withdrawal
is one act of a feature nobody can open, and it should be built with the rest of it rather than
bolted on to satisfy a count.

Routes 17 → **16**, wire-adoption 9 → **8**.

## DL-152 — the office records what it verified; now it records what it asked for

`DL-151` removed `withdrawDocumentRequest` because `check:port-adoption` refused a method no screen
called, and recorded the larger finding: **the whole document-request feature was built, mapped,
routed, tested and reachable from nowhere.** This builds the screen, and the withdraw method comes
back with somewhere to be called from.

### It sits beside the requirement, not on a page of its own

A request exists because a particular slot on the checklist is unfilled — which is why the API
nests the write under `requirements/{requirement}` (`DL-151`). A separate "requests" page would have
to be read alongside the checklist to mean anything, and the two would drift the first time somebody
verified a document without looking at the other tab.

So the asked-for block renders inside the requirement loop on the assessment screen, under the panel
showing what was received. What the office asked for and what it got are one question.

### Three states, said in words

`Waiting on the applicant`, `Provided`, `No longer needed` — a sentence rather than a coloured pill,
because a clerk reads this line out loud to somebody standing at the counter. The channel is beside
it (`Told at the counter`, `Text message`, `Phone call`, `Relayed through the barangay`), because
"we told you" and "we texted you" are different claims when an applicant says they never heard.

### Withdrawing closes the row and never removes it

"We no longer need this" has to stay distinguishable from "we never asked". An applicant told the
office has stopped asking should be able to see when it stopped and why; a deleted row makes the
office's own follow-up unprovable, which is the failure the whole record exists to prevent.

The reason is required — `DL-54`'s rule that a mutation carries why — and the message is never
rewritten: it is what the applicant was actually told. Withdrawing twice is a conflict rather than a
no-op, because the second reason would overwrite the first.

### `run()` was too narrow, and a cast was the wrong fix

The page's helper was typed to `changeStatus`'s observable, so every other act had to be cast into
shape at the call site. The first draft here did exactly that. **A cast to make a helper accept a
caller is a helper that was too narrow** — `CLAUDE.md` §2.2 forbids reaching for one to get past the
type system — so `run<T>(call: Observable<T>, message: string)` is generic now and the casts are
gone.

Port adoption 140/153 → **143/154**; unreached 13 → **11**.

## DL-153 — matching a path is not matching a model

`DL-150` replaced a guessed-substring triage with `check:routes --nearest`, which prints the
published routes sharing the most path segments with each unwired path. Four candidates came back
and were recorded as repoints the console would simply adopt.

**Two of the four were repoints. The other two are different operations wearing similar URLs**, and
so are the two export rows beside them. `--nearest` answered the question it was built for — *what
might this be?* — and I read its answer as *what this is*. The tool's own warning says a match is a
prompt to read the controller; reading the route list is not reading the controller.

### The advisory, which was a repoint, and only half of one

`GET admin/assistance-requests/{case}/advisory` maps field for field: six codes, two tones, and
`rule` / `finding` / `references` on every signal. The two sides agree because both were written to
`DL-60` — the server's class carries no score, no total and no recommendation, which is
`check:intake`'s rule stated from the other end.

But the console asks for the advisory in **two** places, and only one of them has a case. The
assessment screen holds a filed request and now reads the published path, so that advisory works for
the first time. **The intake screen needs it before a case exists** — an encoder picking a resident
and a programme is exactly who `DL-60` puts the evidence in front of, before filing rather than
after — and `IntakeDraft` carries no id to address a case-scoped read with.

So the port has two methods. `advisoryForCase` is the one that works; `advisoryFor` keeps the
collection-level path the API does not serve, and the gap is recorded rather than papered over by
sending a case id that does not exist. `GET admin/assistance-requests/advisory` therefore stays in
the unwired baseline, and that number not moving is the honest outcome.

### The three that are not repoints

**An export is asynchronous.** `POST admin/exports` answers `{id, status: 'queued',
is_downloadable: false, expires_at, …}` and the file arrives later at
`GET admin/exports/{id}/download`. There is deliberately no URL in the payload — the storage key is
withheld so nothing can fetch from anywhere but the gated endpoint. The console models a file coming
back from one call. `event-registrants` **is** in `ReportCatalog`, person-level, priced at
`event.export-registrants` and needing `filters.event_id`, so both export rows are the same work.

**A correction request carries many changed fields.** The console models one `field` and a `claim`;
the API carries `note`, `review_note`, a nested `resident` and `changes[]` of `{field,
current_value, proposed_value}` — and is resident-scoped where the console is generic over
`entityType`/`entityId`.

**A family transfer is not a household transfer.** `ResidentTransfer` carries `toFamilyId`,
`fromFamilyId`, `role` and `moveHousehold`; the published endpoint moves a resident between
addresses and nothing else. This is the one that needs the backend: the family half would be two
further calls, and the adapter's own comment records why that is not free — *"One request, because
the move must be one transaction on the server too."* A partial failure leaves somebody in neither
family, or in a new family at the old address.

### What the mapper does that is worth keeping

An unrecognised **code** is dropped rather than rendered: showing it would put a bare identifier in
front of a caseworker as though it meant something, and `recordsRead` still reports how much was
examined so a shorter list cannot be mistaken for a quieter file.

An unrecognised **tone** is dropped for a sharper reason. `check:intake` fails the build on a
blocking tone. If the server ever grew one, rendering it as a `note` would silently import the thing
the rule forbids, and rendering it verbatim would put an unknown tone on a control. Dropping it
loses a signal and imports no policy.

An advisory the server did not stamp is dated to the epoch — `EMPTY_ADVISORY`'s "nothing read yet" —
never to the clock, on `DL-149`'s distinction between reporting a fact and inheriting one.

Port adoption 143/154 → **144/155**. Routes unchanged at 16, and §4 of
`docs/integration/backend-requests.md` is corrected.

## DL-154 — the async export is not adopted, and quoting a CSV cell is not escaping it

The task was to adopt `POST admin/exports` and clear two unwired paths. **It is not adopted, and the
paths stay** — because the switch would trade a working guarantee for two green numbers.

### What the server's file does not carry

`BuildReportExport::toCsv()` writes one column-header row and then data. Nothing precedes it: no
report name, no question, no filter, no requester, no timestamp, no row count, no statement that the
file names individuals, and **no RA 10173 handling notice** — including on `release-manifest` and
`event-registrants`, the two reports that name people.

`DL-106` requires an export to carry its conditions **inside** the file, *"because a spreadsheet
found on a laptop in eight months has no context except what it carries"*, and requires a
person-level export to be warned about before the file exists. The console composes that preamble
today from `run()`'s result and hands the user a file that honours it.

Adopting the server's export would mean a payout manifest — `reference_number`, `resident_id`,
`amount_centavos` — leaving the building as a bare CSV with nothing saying what it is or how it must
be handled. Two ratchet numbers would improve. A rule that exists to protect the people in the file
would stop being true.

Everything a manifest needs is already in `ReportCatalog` — `title()`, `question()`, `isPersonLevel()`
— and already published on two other endpoints. The export path references none of them, and
`toCsv()` receives only `$rows`, so it could not emit one without a signature change. That is the
ask, recorded in `docs/integration/backend-requests.md` §1.3.

### Three defects that would have shipped with the switch

Found while assessing it, each verified directly rather than taken on trust:

- **`stored_file_id` is a `uuid` column receiving a path** (`exports/2026/08/<uuid7>.csv`). SQLite
  accepts it; **PostgreSQL rejects it, so every export fails.** The same class this console's own
  PostgreSQL run turned up 41 of, and the same class already noted in `ReportController` for
  `audit_entries.entity_id`.
- **Three catalogue entries have no row-builder.** `requestExport` validates against
  `ReportCatalog::values()`, which includes `case-aging`, `field-workload` and `data-completeness`;
  the job's `match` covers six of nine. An input the API accepts and cannot serve.
- **No CSV-injection defence**, on a file whose registrant names are typed by a clerk and which is
  designed to be opened and printed by volunteers.

### And the console had the third hole itself

`csvCell` was `"${value.replace(/"/g, '""')}"` — correct CSV escaping, and **no defence at all**
against formula injection. Quoting solves the parsing problem and does nothing for the other one:
Excel, LibreOffice and Sheets strip the quotes while parsing and evaluate what is left, so
`"=HYPERLINK(…)"` arrives as a live formula.

That is the more useful half of this turn. The defect was found by auditing somebody else's export
path and looking back at ours, and it was in the one file in this repository whose entire premise is
that its output **leaves the building** — opened on somebody else's laptop, months later, in a
spreadsheet nobody here configured, carrying names a clerk typed at intake.

A leading `'` now marks the rest as text on any cell starting `=`, `+`, `-`, `@`, tab or CR. Only
those; ordinary text is untouched and numbers never come through `csvCell` at all. The realistic
case is not `=cmd` in a name field — it is a placeholder `-`, or a filter description that begins
with one, and `-1+1` is a formula to a spreadsheet exactly as much as `=1+1` is.

### Why "not adopted" is the finding rather than a failure

Two ratchets did not move, and a session spent moving ratchets can make that feel like a loss. The
numbers count paths this console composes that the API does not serve; they do not count whether the
file at the end of one is safe to hand somebody. Adopting a worse export to improve a counter is the
same failure as widening a check to make a change pass, wearing different clothes.

## DL-155 — one request, many fields; and a list names them without valuing them

`GET admin/governance/corrections` is served at no verb. The resource exists as
`GET admin/resident-corrections`, and `API_ENDPOINTS.residentCorrections` **was already in the
contract table** — reconciled at some point and never wired up, which is precisely what
`check:routes` counts and what no reviewer would spot in a file this size.

The model differs in four ways, and each one changed something.

### One request carries many changed fields

The console modelled a single `field`. The office record carries `changes[]`. A resident correcting
their surname and their address in one visit was two requests to this console and one to the office,
and the two could be answered differently.

### The values arrive, and the list must not show them

`changes[]` carries `current_value` and `proposed_value`, and the correctable set includes a birth
date, a mobile number and a street address. A list printing `current → proposed` on every row hands
a reviewer a birth date for every pending request **without opening one** — the disclosure `DL-114`
splits an audit row from its values to prevent, on the screen most designed to be scrolled through
other people's records.

A correction is not an audit row, though, and the difference decides the design rather than the
answer: **the reviewer's job is to judge whether the proposed value is right**, which cannot be done
without seeing both. So it is the same split, not the same refusal — the list names the fields, the
values are read on the one being decided.

The **claim** is shown in full, and that is not an inconsistency. "Surname is spelled Sarmiento on
every document the family holds, not Sarmento" quotes both values, and withholding it would leave a
reviewer a request they cannot understand. What stays off the list is the *structured* pair — the
part a screen can render for every row at once, which is what turns a list into a disclosure.

### Four states, and `under-review` had to go

The API has `pending | approved | rejected | withdrawn`; the console had five, including
`under-review`, and **no endpoint could produce it**. It was removed rather than kept for symmetry:
modelling a state no act can reach is the defect `DL-151` found on a document request's `withdrawn`,
and it would have meant a badge no request can ever wear.

The office's wording is kept for the other four and translated at the seam, as a duplicate verdict
is (`DL-148`). `applied` says the record was corrected and the previous value stayed in the trail;
"approved" says only that somebody agreed. An unrecognised status reads as `raised` — the one that
keeps the request in front of somebody.

### A correction is about a resident, and the console pretended otherwise

`entityType`/`entityId` described a generality the API does not have: corrections are resident-scoped
and `CorrectableField` lists twelve resident attributes and nothing else. **Nothing about means or
sector is correctable** — no `monthlyIncome`, no `philsysLastFour` — which is the right answer:
those are assessed or evidenced rather than asserted.

The seed had used the generality. `cor-0003` was a dispute about an approved amount on an assistance
request, and it is gone, because the office record cannot hold it. That is a real loss rather than a
tidy-up — *"the applicant says the amount approved was different"* is a dispute an MSWDO will get —
and it is filed as a gap.

### `check:contract` caught the mistake I made fixing it

The first draft typed `CorrectionChange.field` as a `string` and let `birth_date` into the domain and
onto a template. The seam rule refused it, and the better answer was not an escape hatch but a
**closed union in the console's own casing with labels**: a screen rendering a column name tells a
caseworker `street_address` where a person would say "Street address". The union bought the label as
well as the boundary, and a field the console has no label for is now dropped rather than shown raw.

The gate then failed a second time against the *comment* explaining all this, which named the wire
fields. That is the trap this repository has recorded before — a gate failing on its own explanation
— and the comment was reworded rather than the gate loosened.

Routes 16 → **15**.

## DL-156 — the fourth question: would the answer be understood?

Three ratchets ask three things about a request. `check:routes` asks whether it reaches a real
endpoint at that verb; `check:wire-adoption` whether its body would be understood;
`check:port-adoption` whether anybody makes it at all. **None asks whether the answer would be
understood**, and all three can be green about a read that hands a screen nothing.

`DL-151` found one: `listDocumentRequests` called `collection<DocumentRequest>` on a path that *is*
published, at a verb that *is* served, answering `{ "requests": [...] }` — `data` an object, the
helper handing back a non-array, the screen an empty list. It was found by reading a controller,
which does not scale to 70 reads.

### There is no `ApiResponse::collection`

That is the root of it. The backend answers with `item` (data is an object), `page` (data is an
array plus `meta.pagination`), or nothing. **No envelope produces a bare array**, and the console's
`collection<T>` helper — which returns `response.data` untouched and expects rows — is therefore
wrong wherever it appears.

**29 of 70 reads disagree with the envelope their route answers with.** Not a handful: 41% of the
console's read surface, on a question nothing was asking.

### Two failures, and the quiet one is worse

- **5 read an object as an array.** `data` is `{ … }`, the helper hands back a non-array, the screen
  shows nothing. Loud, once anybody looks — `admin/saved-views`, `admin/privacy/retention`,
  `admin/programs/utilization`, `admin/privacy/classifications`, and the notes on a request.

- **22 read a paginated route as a plain list.** `data` *is* an array, so rows appear and the screen
  looks correct. It has read **the first 25 rows and presented them as the whole list**, because 25
  is the default page size and nothing asked for more. Referrals, releases, visits, events,
  registrations, the audit trail, notifications, the duplicate queue.

The second is `DL-112`'s failure — a wrong answer delivered with confidence — on the queues where a
caseworker counts what is outstanding. A referral list showing 25 of 200 does not look broken. It
looks like an office with 25 referrals.

### The envelope is vendored, because the console has no server to ask

`response-envelopes.json` is derived from `ApiResponse::` in the controller behind each route, and
written down with the backend commit it came from — the same treatment as the route list, for the
same reason: a snapshot that cannot say where it came from is one nobody can tell is stale.

**The extraction was measured before it was trusted**, which after a session of scans that quietly
under-reported felt like the minimum. 286 of 288 routes resolve to exactly one envelope and **none
resolves to two**; the two that do not are a raw CSV stream and a preference write, recorded as
`none` rather than guessed at. Four spot checks against endpoints already read by hand all agreed.

One thing the vendoring exposed on its own: the envelope snapshot is from backend `1907847` and the
route snapshot from `f004930`. **The backend has moved since the routes were vendored**, which is the
staleness `check:routes` says in its own docblock that it cannot see.

### Mutation-tested in both directions

A new `collection`-on-`page` read fails it; an `item` route read as a `page` fails it; and fixing a
baselined read **also** fails it until the baseline is shrunk. A ratchet that only tightens one way
slips back.

Nothing is fixed by this commit and that is deliberate: each of the 29 needs the wrapping key or the
page request that route expects, which is a mapper apiece. The number is recorded the way
`check:routes` recorded 61.

## DL-157 — three of the five reads that showed nothing, and one screen that was already right

`DL-156` counted five reads calling `collection<T>` on an endpoint answering `ApiResponse::item` —
`data` an object, the helper handing back a non-array, the screen showing nothing. Three are fixed.

None was purely an envelope fix. Each endpoint wraps its list under a key and carries fields beside
it, so each needed a mapper, and each mapper turned up something.

### An unclassified record series is read as the most protective thing it could be

`/classifications` sends `classification: null` with `unclassified: true` for a category nobody has
ruled on, and the server's own comment says it is "named rather than left as a null somebody reads
as public". The console reads it as **`sensitive-personal`** and keeps the row.

Both halves matter. Reading it as `public` or `internal` would relax handling on a record type the
office has not thought about; **dropping** it would say there is no such record series at all, which
is `DL-105`'s reason for withholding rather than omitting.

### The retention screen was already right, and I nearly "fixed" it

`/retention` sends real periods — 2555 days for an account, 3650 for a resident — with
`approved: false` and a notice calling them placeholders pending review, adding that no scheduled
deletion occurs while that is true.

My first reading was that the console's "No schedule recorded" had become a false statement, because
the server plainly has a schedule. It has not. `describeRetention` returns "No schedule recorded"
whenever provenance is `awaiting-office-policy`, **even when a period is present**, and that guard is
exactly the protection needed against an unapproved draft: printing "Kept for 10 years" beside a
record series is the invented policy `DL-113` refuses — *the one an office cannot undo once it has
acted on it.*

So the mapper carries `periodInYears` from the server and `provenance` from `approved`, and the
domain withholds the number. The data layer reports what exists; the domain decides what may be
said. The day the DPO approves it, the same payload reads as a schedule with no code change — which
is what makes carrying the numbers now correct rather than premature.

The correction is recorded because I was one edit from making a correct screen wrong, and the thing
that stopped it was reading `describeRetention` before changing anything.

### Nobody owns a shared view, and that is the API being careful

`/saved-views` publishes `is_shared` and `is_mine` and **withholds `owner_subject_id`**, so a reader
cannot see *who* owns a shared view they do not own. `ownerId` is `null` for every view and stays
that way. `DL-111` makes sharing a view a separate grant because its *name* describes a population
to every colleague; not naming its author is the same instinct, and this console does not
reconstruct it.

The endpoint also reads **no query parameters** — it answers every view the caller may see — so the
`resource` filter happens in the adapter rather than pretending the server applied it.

### The two left, and why they are not this piece of work

`admin/programs/utilization` sends five fields per row where `ProgramUtilization` has ten, and keys
them by `program_code` rather than a programme id. `admin/assistance-requests/{case}/notes` sends a
case note — `sensitivity`, `is_withheld`, a nullable `body` — where `RequestNote` carries
`from`/`to`/`reason`, which is a status-transition record. Both are model differences of the kind
`DL-153` catalogued, not envelopes.

The notes one is worth naming precisely: the API implements `DL-58` exactly — a protected note
returns `body: null` and `is_withheld: true`, listed rather than hidden, with a `withheld_count`
beside it — and the console's `RequestNote.body` is a non-null `string`, so it **cannot represent a
withheld note**. The doctrine matches and the type does not.

**Correction (`DL-158`): this section also said `RequestNote` carries `from`/`to`/`reason`, "which is
a status-transition record". It does not.** Those fields belong to `StatusChange`, the interface
declared immediately after it, and a grep that read a fixed number of lines past the type name ran
over the boundary. `RequestNote` was `{id, requestId, authorId, authorName, body, visibility,
createdAt}` — a clean note type. The real divergence was `visibility`, not a conflation.

29 → **26**; the "shows nothing" tier 5 → **2**.

## DL-158 — a note the reader may not see is still a note

`DL-157` left `admin/assistance-requests/{case}/notes` as a model difference. It was less of one
than that entry claimed, and the claim needs correcting first.

### What I got wrong

`DL-157` said `RequestNote` carries `from`/`to`/`reason`, "which is a status-transition record".
**It does not.** Those belong to `StatusChange`, declared immediately after it, and a grep printing a
fixed number of lines past the type name ran across the boundary. `RequestNote` was a clean note
type. The section is corrected in place.

The divergence that is real is narrower and sharper: `body` was a non-null `string`, so the type
**could not represent a withheld note at all** — on the one record where this application's own
doctrine says a withheld entry must still appear.

### The two sides already agreed on the hard part

`DL-58`: a withheld note returns `body: null`, stays listed, and keeps its author and its time, so
nobody reads a partial file as a complete one. The API does exactly that — `body: null`,
`is_withheld: true`, the row present, a `withheld_count` beside the list. Nothing had to be argued;
only the console's type was behind.

`body` is nullable now, `isWithheld` is beside it, and the tier is `CaseNoteSensitivity` — **the
union `domain/cases/case-note.ts` already declares**, not a second copy. `DL-122` refuses a second
vocabulary for permissions because the checker that generates the office reference would not see it;
two sensitivity unions would need two permission maps and would drift.

### It is still not `CaseNoteView`, and that is `DL-52`

The two are now the same shape. They are deliberately not the same type: a case is the office's
continuing involvement with a household and an assistance request is one intervention inside it, so
a note keyed on `AssistanceRequestId` cannot be typed as one keyed on `CaseId` without asserting the
thing `DL-52` exists to deny. What they share — the disclosure rule and its vocabulary — is shared
properly.

### `visibility` is gone, because nothing could produce it

It was `internal | shared-with-applicant`, and the office record has **one axis** — how closely a
note is held — with no notion of a note shown to the applicant. A value a screen could set and no
system of record carries is the defect `DL-151` found on a document request's `withdrawn` state.

Two of the three seeded notes were marked `shared-with-applicant`, so the mock was demonstrating a
capability that does not exist anywhere else. Recorded as a gap, not modelled.

### The mock was showing a file where nothing is ever held back

`listNotes` handed every note back whole, so `isWithheld` was a field nobody had ever seen true, and
any screen or spec written against it would have been written against a fiction. The mock now
withholds in the **data layer** for a reader without `case-note.view-protected`, and the seed has a
protected note so the path exists at all.

That is the same lesson as the requirements checklist and the assessment endpoint: a mock more
convenient than the thing it stands in for is one a screen gets built against.

### Two things read by nothing

`withheld_count` is **not mapped** — `withheldRequestNoteCount` derives it from the rows, this
endpoint does not paginate, so the two cannot disagree, and a count read from the wire is a number a
screen can show while the list beneath it says something else (`DL-83`).

`is_withdrawn` and `withdrawn_reason` are not modelled. The API keeps a withdrawn note rather than
deleting it, with its reason — the shape `DL-127` settled for a comment, where the act is
append-only so a reader can see something was taken back and why. Adding the fields without a screen
that shows them would add something nothing renders; it is filed as work this console owes.

An unrecognised sensitivity reads as **`protected`**. A tier this console does not know is one whose
handling it cannot reason about, and reading it as `routine` would show a body the office may have
meant to hold back.

"Shows nothing" tier 2 → **1**; total 26 → **25**.

## DL-159 — a programme reports what it delivered, and a withheld figure is not a zero

`ProgramUtilization` had ten fields. The office record publishes three, and could not have been read
into the type at all: it suppresses a small cell by **nulling the numbers and keeping the row**, and
every count on the type was a non-null `number`.

That is the same defect a withheld note had (`DL-158`) — a type that cannot represent the protective
case forces a screen to invent one — and here the invention would have been a **zero**. `DL-105` is
explicit that a suppressed count is never dropped (a missing row reads as "none"), never rounded
(that puts an untrue figure in a report) and **never zeroed**, because an absence of service is
itself the finding. A programme reported as having served nobody is a programme somebody closes.

So `releaseCount` and `releasedTotal` are nullable, `isWithheld` sits beside them, and the screens
print "Withheld" with a sentence saying a figure exists and was held back — not a dash a reader
takes for none.

### Seven fields went, and the screens with them

`filedCount`, `openCount`, `completedCount`, `rejectedCount`, `approvedTotal`, `lastFiledAt` and
`lastReleasedAt` have **no counterpart anywhere in the office record**. The mock computed all seven,
so the programme detail screen rendered a full picture that existed only here — and the same screen
against the API would have shown blanks beside five labels.

`approvedTotal` could not have survived in any case: `L-17` records that the schema holds one amount
column anywhere, money actually handed over, so there is no approved total to report.

They are filed as an ask rather than kept as fields nothing fills. A programme's open and completed
counts are worth having; a mock computing them is not how the office gets them. The screen now names
the absence — *"Requests filed, still open, completed and rejected, and the total approved, are not
reported by the office record"* — rather than leaving five blanks.

### "Used" now means money handed over

`isUnused` counted filed requests and counts payouts. A programme with forty pending requests and no
payout reads as unused, which is a narrower claim than the console used to make and a true one — and
the copy follows the meaning: *"Nothing has been handed over under this programme yet."*

A test asserting "utilization for a programme that has been used" failed on exactly this, because
the seeded medical programme has requests and no released payout. It was pointed at the catalogue
rather than at a named programme, so a change to which household was paid does not fail a test about
whether the figure is reported at all.

### Suppression is the server's to decide

`summariseUtilization` always reports `isWithheld: false`. A client suppressing figures it was
already handed would be hiding data it has in its hands, which protects nobody. The mapper reads
`suppressed` from the payload rather than inferring it from the nulls, because a null could also
mean the office genuinely has no figure — and reading suppression off an absence would report a
withholding nobody performed.

**The "shows nothing" tier is now 0.** Total 25 → **24**; the 22 paginated reads remain.

## DL-160 — the snapshots disagreed about a commit, and one of the asks had been fixed

The route snapshot cited backend `f004930` and the envelope snapshot `1907847`. `check:routes` says
in its own docblock that the staleness it cannot see is the backend having moved since — so it was
measured rather than assumed: `php artisan lguids:routes` run **read-only** against the backend and
diffed against the vendored artefact. **293 routes, none added, none removed.**

The surface had not drifted; only the record of what it had been checked against. `routes.source.json`
now carries `reverifiedAt` beside `commit` — where the snapshot was taken, and the latest commit it
was checked against and found identical. The artefact is untouched and its sha256 still matches.

### The backend had moved twice more, and had fixed one of the asks

Between two commands in the same session it went `1907847` → `1aef8d6`, carrying
`926c396 fix(reporting): the export feature could not work in production` — **the `stored_file_id`
defect filed in `DL-154`**. A new migration changes the column to `string(255)`, the original
migration untouched, and the commit records the measurement: *"SQLite: 1129 tests, 1128 passing.
PostgreSQL: 1125 passing, three failures remaining"*, including the same defect class in the import
batch.

`backend-requests.md` is updated to say so. **A filed ask that has been fixed and still reads as open
is a false record**, and the one thing a document like that cannot afford is to be wrong in the
direction of asking for work already done. The other two export defects — three catalogue entries
with no row-builder, and no CSV-injection defence — were re-checked at `1aef8d6` and are **still
open**, and now say so with the commit they were checked at.

The `stored_file_id` entry is struck through rather than deleted, because the **class** is not
closed: a column whose declared type disagrees with what every writer puts in it, invisible to a
SQLite-backed suite. This console's own PostgreSQL run turned up 41 failures of that family.

## DL-161 — a list somebody picks from is read in full; a list somebody browses is read a page at a time

`DL-156` counted 22 reads calling `collection<T>` on a paginated route. They return the first 25
rows and present them as the whole list, and the question left open was what a screen should do
about page two. There is no single answer, because they are not one kind of list.

### Three kinds, and only one of them is a UI problem

**A picker.** Programmes on the intake and assessment screens, service providers on the referral
filter, the report catalogue on the hub. Truncation here is not a missing page — it is a **wrong
answer**. An intake officer who cannot see a programme in the dropdown concludes the office does not
run it and files the request under something else, and nothing on the screen looks wrong. That is
`DL-112`'s failure arriving through a scrollbar instead of a search box.

**A list somebody browses.** Referrals, releases, visits, events, families, the newsfeed, the audit
trail, the duplicate queue. A page is fine here *provided the screen says which page*, and that is
real per-screen work rather than an adapter change.

**A count.** The notifications badge and the work alerts. `meta.pagination.total` is the answer and
counting rows gives 25.

### `everyPage` refuses rather than truncating

`ApiClient.everyPage` asks for the largest page the server allows — `toQueryParams` already clamps
to the API's `MAX_PER_PAGE`, so one request usually suffices — and follows the rest.

Past `PAGE_CEILING` it **throws**. Stopping quietly there would be the defect this method exists to
remove, reintroduced at a higher number; fetching without bound hangs a screen on a registry-sized
answer. Refusing says plainly that nothing is shown, and why. A catalogue past 2,000 entries is not
something a dropdown should be rendering.

Three reads adopted it: the programme picker, the provider list and the report catalogue.

### The check skipped them instead of approving them

Adding `everyPage` to the client made three reads **disappear** from `check:response-shape` rather
than count as correct — its `NEEDS` table maps helper names to envelopes, and a helper it does not
know is skipped. The disagreement count fell by three and the tool was reporting progress for a
surface it had stopped watching.

That is precisely the failure this whole file has spent the session cataloguing (`DL-142`, `DL-143`,
`DL-156`), committed while fixing an instance of it. It surfaced because the count moved by more
than the work justified, which is `DL-145`'s rule — **a ratchet that moves is a prompt to read what
it counted** — and it now cannot recur: the check reads `ApiClient` and fails if a read helper is
missing from the table.

**19 paginated reads remain.** ~~They are the browsable ones.~~ **That claim is wrong — see
`DL-162`.** About half turn out to be per-record reads: a resident's families, a request's releases,
one post's history. Those need `everyPage`, not a page control, and the classification was made from
endpoint names rather than from the methods behind them.

24 → **21**.

## DL-162 — half the "browsable lists" were not lists, and three checks did not know a new helper

`DL-161` said the 19 remaining paginated reads were browsable lists needing a page control. Doing
the work showed otherwise, and the reason the claim was wrong is worth more than the claim.

### It was classified from endpoint names, not from the methods behind them

`admin/families`, `admin/visits`, `admin/referrals`, `admin/releases` read like office-wide lists.
The methods are `familiesOf(residentId)`, `forResident(id)`, `listForRequest(requestId)`,
`duplicatesFor(id)` — **everything about one record**. `DataTable` already has a pager, so the UI
was never the obstacle; the obstacle was that a page control is the wrong answer for a resident's
kinship history. Twelve of those went to `everyPage`, alongside `accounts` and `alerts`, which the
office's own size bounds.

Ten remain and are genuinely office-wide streams — the audit trail, notifications, referrals,
releases, release batches, visits, events, registrations, the newsfeed and its comments. Each needs
its **port** to return a `Page<T>` before a screen can page it, which is why none of them was a
one-line change and why the count did not fall further.

Two more are the `item ← page` pair on the work queues, where an array arrives typed as an object.
That is a different defect and still open.

### Three checks reported progress for surfaces they had stopped reading

Adding one helper to `ApiClient` broke three tools, each in the same way: they enumerate helper
names, and a name they do not know is skipped rather than checked.

- `check:response-shape` **skipped** the three reads that adopted `everyPage`, so its count fell by
  three for work that had not been done. Fixed in `DL-161`, and it now fails if `ApiClient` grows a
  read helper missing from its table.
- `check:query-params` reported **seven fewer unreadable keys**. The calls had not changed — the
  same camelCase keys are still sent — they had simply stopped being seen.
- `check:mapper-adoption` had never counted `collection<T>` **at all**. Adding it and `everyPage`
  took the figure from 43 to **71**: twenty-eight casts, in the one file the check is pointed at,
  that it had never looked at. `collection<Referral>` asserts a snake_case array is a `Referral[]`
  exactly as much as `page<Referral>` does.

The first two were caught because **the number moved by more than the work justified** — `DL-145`'s
rule that a ratchet which moves is a prompt to read what it counted. The third was caught by
checking whether the same hole existed elsewhere once two had been found.

**A check that enumerates the names of things it inspects has a hole shaped like the next name.**
That is now four instances in three turns (`DL-142`, `DL-156`, `DL-161`, this one), and the pattern
is not "these particular tools were sloppy" — it is that an allow-list of helper names is a scan
that under-reports the moment the code grows one.

21 → **12**; mapper-adoption 43 → **71**, which is debt made visible rather than debt added.

## DL-163 — the work queues: a clock nobody sent, and a screen the record cannot fill

Recorded without the code. The two `item ← page` reads on `admin/work/mine` and `admin/work/team`
were investigated in full and the fix was written and then lost to a concurrent checkout in a shared
working tree; a second agent is working in this repository and has its own changes in flight, so
this entry is the finding rather than the change. What follows was read from the controllers at
backend `1aef8d6` and is directly verifiable.

### `asOf` is accepted by none of the three routes

The adapter sends `asOf` as a query parameter, and its own comment says why: *"`asOf` travels as a
parameter rather than being taken from the server's clock so the heading a user reads and the
urgencies underneath it cannot disagree."*

`WorkController::mine`, `::team` and `::alerts` each compute `CarbonImmutable::now()`, derive
`is_overdue` against it, and echo it back as `meta.as_of`. **None of them reads a parameter.** So
the heading showed the console's date and the urgencies were computed against the server's — which
is the disagreement the comment was written to prevent.

The intent was right and the mechanism was backwards. Both should come from the echo. It is the same
shape as `DL-149`: the console cannot state a moment the server did not give it, and the closest
true statement is the one the server stamped.

### The team queue is aggregates; the screen renders items

`byAssignee` runs one grouped query and answers `{assigned_to, total, overdue_count}` per person,
unassigned first, with `meta.unassigned_count` reported separately — *"rather than leaving it to be
inferred from a row a client might page past"*, in its own words.

`TeamMemberLoad` carries `items: readonly WorkItem[]` and the screen renders every person's task
list inline. **The endpoint returns no tasks at all.** The server's model is better — shipping every
row to a client so it can count them is what this console does — and it is `DL-107`'s doctrine
stated from the other end: a workload screen **counts what people carry**.

Two consequences follow. `items` cannot be filled and the per-person list has to go. And `name`
cannot be filled either: the record groups by subject id and publishes no staff name, so a
supervision screen cannot say whose queue it is looking at. That is a gap to file, not a uuid to
render (`DL-155` settled the same question for a correction's requester).

### `buildTeamQueue` sorts into a league table

> Whoever is most behind comes first; unassigned sorts last so it reads as a gap rather than as
> somebody's caseload.

`DL-107` refuses exactly this: *"No rate, no score, no index, and rows ordered alphabetically —
sorting by volume is what turns a workload table into a league table."* The entry was written about
the workload **report**, and the reasoning does not stop at the report's edge — a supervision screen
that puts the person with the most overdue work at the top ranks them every time it is opened.

The office record sorts unassigned first, then by assignee. Adopting that order settles the
contradiction and makes the two agree.

### Four fields the projection does not carry

`itemProjection` publishes `id`, `source`, `type`, `title`, `subject_type`, `subject_id`,
`assigned_to`, `team`, `priority`, `due_on`, `is_overdue`, `waiting_since`, `raised_by_event`.

`WorkItem.subject` and `WorkItem.preview` have no counterpart — the backend records this as a known
divergence rather than an oversight. A queue without them is one somebody has to open every row of.
`assignedToName` and the team `name` are the third and fourth, both for the same reason.

`waiting_since` is set **only when there is no due date**, which is `DL-101` implemented server-side:
an undated item reports waiting, never lateness, because no service standard was supplied.

### Two vocabularies for the same twelve things

`TaskType` and `WorkKind` name the same work and disagree on four spellings — `verify-resident` /
`verify-household`, `referral-follow-up` / `follow-up-referral`, `field-visit` / `conduct-visit`,
`recommendation` / `review-recommendation`. A seam translation, as `DL-148` and `DL-155` already do.

`resolve-duplicate` and `general` have **no console counterpart at all**. A row carrying one has no
honest home: `WorkKind` is a closed union of work the office recognises, and rendering an item under
a kind it is not puts the wrong label on somebody's work. Dropping it shows fewer items, which is
recoverable; mislabelling is not.

### And the reason this entry has no code

A second agent committed `33ddff5` into this working tree and reverted every tracked file this turn
had touched. The `servana-shared-tree-hazard` note is about exactly this, and the cost here was
about forty minutes of work in six files.

The one piece worth knowing for next time: **the loss was silent.** `npm run typecheck` passed
afterwards, because reverting a coherent set of edits leaves a coherent tree. What surfaced it was a
check reporting a state that could not follow from the code as written — the same instinct as
`DL-145`, applied to a working tree instead of a ratchet.

## DL-164 — the backend was replaced, and most of what this console asks for has no server

On 2026-10-20 the owner replaced the Laravel backend with a Node service (`taytay-backend`
`4e6e1f3`; the Laravel tree survives only at tag `laravel-archive`). Every snapshot this console
vendors — `routes.published.json`, `response-envelopes.json`, `types.ts` — was taken from the
Laravel tree before that commit. They describe an API that no longer runs, and every ratchet that
reads them has been measuring against it since.

### What the new API is

It is the back office of the **residents' app**: accounts, ID verification, digital IDs, the office
directory, Tulong information pages, Balita news, office messaging, households as counts. Its
staff surface is `/api/v1/admin/*` plus a few `staff|admin` routes. It has **no** assistance
request, case, referral, release, visit, programme, report, event or dashboard route.

Measured port by port (`docs/integration/node-api-gap-map.md`): of twenty ports, **none** fits,
**seven** fit in part, **thirteen** have no endpoint at all.

### Looking alike is not fitting

The seven partial fits are mostly different things with the same word on them, and wiring them would
put wrong answers on screens that look right:

- `GET /admin/users` is *people with an app account*, not the office's resident registry. A walk-in
  applicant with no phone is not in it, and an officer who searches it concludes the office never
  served them (`DL-112`'s failure, delivered by a list that looked complete).
- A Tulong **service** is an information page with free-text eligibility. A **programme** carries
  guidelines, weights, a responsibility and a funding holder (`DL-65`, `DL-66`). Rendering one as the
  other invents policy fields or drops them.
- Node news has no draft list for staff, no archive, no schedule, and no image description, so the
  newsfeed module's `DL-124` and `DL-125` guarantees cannot be kept over it.

So no port is force-fitted. A port is wired to the Node API only where the Node resource *is* the
thing the port names.

### What the console does instead

1. **A platform area for what the API does serve.** New ports shaped like the Node resources —
   verification review, the office inbox, users and roles, offices, services, hotlines, home
   banners and links, digital IDs, audit, app configuration, Balita — built as their own features.
   Today nobody can approve a resident's ID verification at all, because no screen exists for it.
2. **Unserved ports say so.** In the `http` adapter set, a port with no route is bound to an adapter
   that makes **no request** and fails with a sentence: this part of the console has no server yet.
   Its navigation entry is withheld and one page names every module in that state, so an officer
   never reads an empty screen as an empty record. Mock data never stands in (`DL-136`).
3. **Permissions come from the server.** Node has two staff roles and no permission list, and this
   console grants only keys the server sends (`fromServerIdentity` fails closed). The backend now
   publishes `permissions` on `GET /me` from a table that describes its own route guards
   (`src/auth/capabilities.ts`, probed route by route in `tests/capabilities.test.ts`). The console
   never computes a permission from a role: that would be a second authority one folder away from
   the one `check:auth` already forbids.
4. **Sign-in is Firebase Auth over REST**, not the Firebase SDK. No dependency; the ID token stays in
   `AuthTokenHolder`'s private field and the refresh token in the provider's, nothing reaches web
   storage, and reload still signs out — ADR 0006's terms, which survive only at the backend's
   archive tag and are restated here so they do not hang on it. Sign-out calls the new
   `POST /api/v1/auth/sign-out`, which revokes the account's refresh tokens server-side.
5. **Casework stays, and is not wired.** The thirteen modules keep their domain, their checks and
   their mock adapters. Whether the Node API grows casework, or those screens are retired, is the
   owner's decision; the proposal is in `docs/integration/node-api-migration.md`.

### What this supersedes, and what it does not

- `DL-156`'s "there is no `ApiResponse::collection`, so `collection<T>` is wrong wherever it
  appears" was a fact about Laravel. Node answers several lists with a bare array and `meta: {}`
  (barangays, news categories, banners, hotlines). For those, a list helper is right.
- `DL-161` stands: a picker reads in full and refuses past a ceiling. The pages are now cursors of at
  most fifty, with no total and no sort parameter, so a browsable list says "first fifty, more
  available", never "page 1 of N".
- Each re-pointed check is re-baselined **in its own commit**, stating the old count, the new count
  and the cause — the API was replaced, the code did not regress. A hard rule stays hard: the
  base-path rule passes by removing paths the API does not serve, never by becoming a baseline.
- The launch gate stays **NO-GO**.

### Done in the backend for this entry

`135ec41` — CORS, exact-origin allowlist from `CORS_ALLOWED_ORIGINS`, no wildcard, no credentials.
`189b911` — `permissions` on `GET /me` from `src/auth/capabilities.ts`, probed against the route
guards for five roles, and `POST /api/v1/auth/sign-out`, which revokes the account's refresh tokens.

## DL-165 — the transport moved to the Node API, and every check moved with it

`DL-164` decided what the console does about the Laravel API's replacement. This is step 3 of
`docs/integration/node-api-migration.md`: the transport, the vendored contract, the two adapters the
Node API can actually serve, and every contract check re-pointed at the new spec — in one change,
because a check left reading a Laravel snapshot reports a guarantee about an API that no longer runs.

### What the console now talks to

- **One vendored spec.** `src/app/data/http/contract/openapi.json` is a byte copy of the backend's
  `openapi/openapi.json` at `2736e28` (sha256 `d2c4ac68…`, 103 operations), recorded in
  `openapi.source.json` by `tools/vendor-openapi.mjs`, which refuses to vendor a spec with
  uncommitted edits. `npm run vendor:openapi` replaces `vendor:envelopes`.
- **Cursor paging.** `ApiClient.cursorPage` / `everyPage` send `limit` (clamped to 50 — the API
  refuses more, it does not clamp) and `cursor`, and **never** `page`, `per_page` or `sort`: the API's
  query schemas drop an unknown key rather than refusing it. `everyPage` follows `next_cursor` and
  still **throws** past twenty pages (`DL-161`). `CursorPage<T>` and `CursorRequest` join the domain;
  `Page<T>` stays for the mock and the unserved ports.
- **`list` is a helper again.** `DL-156`'s "no bare-array helper can be right" was a fact about
  Laravel. Node answers seven lists whole with `meta: {}`; `check:response-shape` now allows `list`
  exactly there and refuses it on a cursor-paged route.
- **The error vocabulary is Node's**: thirteen codes, three of them lowercase OTP codes. The union
  and the runtime list are restated in `api.contract.ts` (Node publishes only JSON) and both are
  compared with the spec's enum on every build. `INVALID_STATE_TRANSITION`'s interceptor case is gone
  — Node answers a refused transition with `CONFLICT`. `details` keeps its `string[]` entries and
  leaves out the numeric counters, where one counter used to discard every field message beside it;
  the wait on a `429` comes from `details.retry_after`, because CORS exposes no `Retry-After`.
- **Headers go only to the API.** `apiHeadersInterceptor` used to put the bearer token on every
  request `HttpClient` made, to any origin. It now decorates a request only when its URL is the API
  base followed by `/`.
- **No `Idempotency-Key`.** The API implements none, and its CORS policy allows exactly
  `Authorization`, `Content-Type`, `X-Request-Id` and `X-Client-Channel` — any other header fails the
  preflight before the server sees the request. `ApiClient` writes no longer take an intent;
  `WriteIntent` stays in the domain, held by the screens across retries.
- **`local-api` is `http://localhost:3000/api/v1`**, and so is `local-mock`'s unused copy, which its
  own comment says is kept accurate.

### Two adapters served, eighteen that say they are not

`HttpStaffRepository.currentUser` reads `GET me` through `me.mapper.ts`: permissions exactly as the
server sent them (`fromServerIdentity` keeps the console keys among them — today only `audit.view`),
`roles: [role]`, the narrowest scope, `barangayId: null`. Birth date, sex, mobile, address, street,
purok and the **home** barangay are not read. A `registered`/`verified` account or one not explicitly
`closed: false` is answered as signed out, and its token dropped locally — revoking it would sign
that person out of the residents' app on their phone. `signIn` and `completeMfa` fail with
`unavailable` and say sign-in is not connected yet: the Firebase sign-in is the next change. `list`
and `getById` are unserved — `GET admin/users` is app accounts, not the staff directory.

`HttpNotificationRepository` reads `GET notifications` in full, marks one read with
`POST notifications/{id}/read` and all with `POST notifications/read` (which answers a count, so the
inbox is read again). Kind, severity and action are not on the wire; `notification.mapper.ts`
documents the least it can honestly say: `verification_decided` is a `decision`,
`message_received` is `general`, severity is always `info`, and there is no action until a screen
exists for verification requests or office threads.

The other eighteen ports are bound to `unserved-repositories.ts`: a class per port, every method
failing with *"This part of the console has no server yet…"*, injecting nothing, so no request is
possible. They implement their ports without a cast — a parameterless method returning
`Observable<never>` is assignable to every port method.

### Sign-out drops the token whatever the server answered — superseding the old rule

The port, `SessionStore` and `check:auth` all said a failed sign-out **keeps** the token, so the user
stays visibly signed in over a credential that still works. That was right for a Laravel personal
access token, which lived until revoked. It is wrong for a Firebase ID token, which expires within the
hour on its own: keeping it in memory after somebody asked to leave a shared office computer protects
nobody. So `signOut` posts `auth/sign-out` **first**, with the credential it revokes, and drops the
token in `finalize` once the API has answered; the failure still propagates and the interceptor
reports it. `SessionStore` ends the identity on both paths and the shell leaves for sign-in on both.
What did not change is the half that mattered: clearing **before** the request would send it
unauthenticated and revoke nothing, and `check:auth` rule 5 still fails that.

### Every check, before and after

The before column is `990edfa` against the Laravel snapshots; the after column is this change against
the Node spec. **No count fell because a rule was loosened.** Where a ratchet reached zero it reached
it by removal — the adapters that held the debt now make no request — and at zero it became a hard
rule, its baseline file deleted.

| Check | Before (Laravel) | After (Node) | Cause |
| --- | --- | --- | --- |
| `check:contract-drift` | `types.ts` @ `ba7f5e2`, 13 codes; list vs union | `openapi.json` @ `2736e28`, 103 operations recounted, 13 codes; union **and** list vs the spec's enum | spec vendored; Node publishes JSON, not TypeScript |
| `check:routes` | 40 endpoints, 120 composed vs 293 routes; **15** unwired (ratchet); `cases` sentinel | 3 endpoints, 5 composed, **0** unwired — hard; every `this.api` call must resolve; floors relative to recorded counts | adapters removed, not repaired. New: 18 of 20 ports unserved (ceiling, shrink-only), and an unserved adapter may not inject, name an HTTP client, reach the network or import the mock |
| `check:response-shape` | 61/73 agree; **12** mismatches (ratchet); 7 uncovered | 2/2 agree — hard; an uncovered read now **fails** | envelopes derived from the spec; `list` legitimate on `meta: {}` lists |
| `check:wire-adoption` | 64/72 mapped; **8** unmapped (ratchet) | 3/3 — hard; literal keys must also be declared by the operation's `requestBody`, and an operation with none accepts only `{}` | adapters removed; strengthened, because several Node schemas are strict and the rest drop keys |
| `check:query-params` | **53** keys, measured by *shape* (ceiling) | new measure, **existence** against the operation's declared query parameters, first value **0** — hard; a filter must be a literal | the 53 lived in domain filter interfaces that reached the wire only through deleted adapters |
| `check:mapper-adoption` | **71** casts (ceiling) | **0** — hard; write responses now counted too; helper list asserted against `ApiClient` | 69 casts went with their adapters; `me` and `notifications` read through mappers |
| `check:permission-parity` | **24**/43 guards unreachable vs `AccessControlPermission` (61 keys) | **42**/43 vs `StaffCapability` (15 keys) — only `audit.view` matches; also fails if `/me` stops carrying the enum | the API was replaced; no guard changed. This is `DL-164`'s gap, measured |
| `check:consumer-contract` | 12 interactions, 24 required fields; replayed by the Laravel backend | 3 interactions, 7 required; every field read must be a response property in the spec, every required one required there | Node has no replay, so the comparison runs here |
| `check:contract` | pagination `page/per_page/total_pages`; `-sort` | `has_more`/`next_cursor`; forbids emitting `page`, `per_page`, `sort`, `direction`; request headers limited to the CORS allow-list; `Idempotency-Key` refused; `next_cursor` joins the wire names | |
| `check:auth` | rule 5: `DELETE auth/tokens/current`, clear in `tap` | rule 5: `POST auth/sign-out`, literal or via `API_ENDPOINTS.signOut`; clear only after the request; rule 6's `ROLE_DEFINITIONS` ban extends to `src/app/data/http/` | see the section above |
| `check:money` | 5 writes forward their intent in `HttpReleaseRepository` | the port demands an intent on all 5, and `RELEASE_REPOSITORY` must be bound to its unserved adapter | the doctrine moved: with no idempotency on the API, the only way no family is paid twice by a retry is no money write over HTTP |
| `check:intake` | not-recorded rule read `toWireAssessment` in `to-wire.ts` | reads it anywhere under `data/http`; when absent, requires the assistance port to be unserved | the doctrine (nothing typed is silently discarded) holds by refusal; the rule itself is unchanged |
| `check:port-adoption` | 11/155 | 11/155 | reads ports and screens; `unreached-ports.json` kept |
| `check:scanners` | 39 tools, 736 regexes | 39 tools, 760 regexes, all whitespace-tolerant | |

Each new or rewritten rule was validated against a planted regression before being trusted: nineteen
plants across the twelve checks above, every one caught, every file restored.

`DL-164` asked for each re-pointed check to be re-baselined in its own commit, so that every new
number arrived beside its cause. They arrive together here: the snapshots they read are deleted in
the same change, and an intermediate commit would have had to keep a Laravel artefact alive for the
checks not yet moved — a green build about a retired API, which is the state this entry ends. The
table keeps what the per-commit rule was for: every number, old and new, with its cause.

### What was deleted, and why

Recoverable at `990edfa`; kept nowhere else, because code kept "for later" against a server that no
longer exists is a surface nothing is reading (`DL-143`).

- **The Laravel snapshots and their tooling**: `contract/types.ts`, `source.json`,
  `routes.published.json`, `routes.source.json`, `response-envelopes.json`, and
  `tools/vendor-response-envelopes.mjs`, which parsed PHP controllers that no longer exist.
- **Thirty-eight of the forty `API_ENDPOINTS` entries** (`me` stays, `notifications` moves from
  `me/notifications`, `signOut` is new), the `cases` 404 sentinel among them: a port
  with no Node route makes no request, so it needs no path, and the sentinel guarded a wiring that
  can no longer happen by accident.
- **The ratchet baselines that measured only Laravel**: `unwired-paths.json`,
  `shape-mismatches.json`, `unmapped-writes.json`. `unreached-ports.json` stays — it measures this
  console's screens, not an API.
- **Eighteen HTTP adapters** (2,358 lines of `http-repositories.ts`) and the mappers only they used:
  advisory, assessment, audit, correction, document-request, event-metrics, governance, household,
  request-note, resident, utilization, visit and `to-wire.ts`, with their specs. `file-transport.ts`
  and `UPLOAD_POLICY` went with the one adapter that uploaded (Node's media limit is 5 MB, not 10, if
  it returns). The domain's `DOCUMENT_UPLOAD_POLICY` is untouched.
- **`recorded/`**: nineteen payloads captured from the Laravel API and six specs over them. Their
  replacements in `fixtures/` are **composed from the spec, not recorded** — nothing here runs the
  Node API — and `fixtures.spec.ts` holds every one to its schema (required fields present, nothing
  undeclared, every enum value one the API can send), proving the validator red on a drifted copy.

### Not done here, deliberately

- Firebase sign-in (step 4). Until it lands, the `http` configurations cannot sign in at all.
- Hiding unserved modules from navigation and the page that names them (step 5). Today an unserved
  screen shows its sentence in place of its content.
- `CLAUDE.md` §3 still describes `check:routes`, `check:wire-adoption` and `check:response-shape` as
  ratchets with Laravel's numbers, and `release-engineering.md` quotes them. Both are now stale; the
  constitution is the owner's to amend.
- `fromServerIdentity` still labels a role it does not recognise `auditor` (design doc item 14).
- The inbox port returns one list, so it reads every page and refuses past a thousand rows. It should
  become paged.
- The assessment screen's not-recorded notice describes the retired Laravel schema. Against Node the
  screen cannot save at all; what the notice should say belongs to whoever decides the casework
  question (`DL-164`).

The launch gate stays **NO-GO**. `npm run verify` is green on Windows: 93 spec files, 1,628 tests
(104 and 1,709 before — seventeen Laravel-era spec files went with the code they tested; six came
in, for the Node adapters, the `me` mapper, the fixtures, the unserved ports, the interceptor, and
the `WriteIntent` rule, which moved to the domain when the transport stopped carrying the key).

## DL-166 — staff sign in through Firebase's REST API, and nothing about it outlives the tab

Step 4 of `docs/integration/node-api-migration.md`. The Node API has no sign-in route: it verifies a
Firebase ID token on every request (`verifyIdToken(token, checkRevoked=true)`). So the console signs
in at Google and presents what Google issued. `DL-164` decided it would do so over Firebase
Authentication's REST API rather than the SDK (`node-api-transport-design.md` §4); this entry is what
was built, what it was checked against, and what is still nobody's fact. It closes two of `DL-165`'s
"not done" items: Firebase sign-in, and the `auditor` label on a role the console does not know.

### What was built

- **An identity provider seam**, `src/app/data/http/identity/`, used only by the staff adapter.
  `identity.provider.ts` signs in at `identitytoolkit.googleapis.com/v1/accounts:signInWithPassword`,
  refreshes at `securetoken.googleapis.com/v1/token` (form-encoded), and finishes a TOTP second factor
  at `identitytoolkit.googleapis.com/v2/accounts/mfaSignIn:finalize`. Its calls go out on
  `new HttpClient(inject(HttpBackend))`, past every interceptor, so Google never receives the API's
  bearer token or `X-Client-Channel` and the error interceptor never reports Google's refusals as the
  API's.
- **Two private fields and no third home.** The ID token goes to `AuthTokenHolder.#token`, as
  before. The refresh token stays in the provider's `#refreshToken`: no getter, never in the grant the
  provider returns, never in web storage. The pending second-factor credential proves a password was
  right, so it stays in `#pending` and the screen is handed an opaque handle. Reload signs out, as
  ADR 0006 accepted — restated in `DL-164` so it does not hang on the backend's archive tag.
- **Google's refusals, in the console's words.** `INVALID_LOGIN_CREDENTIALS`, `EMAIL_NOT_FOUND`,
  `INVALID_PASSWORD`, `USER_DISABLED` — and `INVALID_EMAIL`, because the form's address check is
  permissive and Google's is not — are one uniform message. `TOO_MANY_ATTEMPTS_TRY_LATER` is
  `throttled`, with no wait stated because Google states none. Anything else is `unavailable`. A 400
  at the second step is `second-factor-refused`: the same key and project already answered the first
  step, so it refuses the code or a lapsed attempt, not the configuration.
- **`HttpStaffRepository.signIn`**: provider → `tokens.hold` → `GET me` → identity. A resident's
  account or a closed one is refused with the **same** message as a wrong password, and its tokens
  are dropped **locally only** — revoking would sign that resident out of the app on their phone, and
  would tell whoever typed the address that it has an account. `completeMfa` does the same after the
  second factor. `signOut` also makes the provider forget the refresh token.
- **Renewal on demand.** `apiHeadersInterceptor` asks `SESSION_REFRESHER` (a core token, bound in the
  HTTP adapter set to `HttpSessionRefresher`) for a new token when a request to the API finds the
  current one within 60 s of expiry. Every request that finds it so shares one refresh; none waits on
  a timer, and nothing renews in the background (`DL-118`). When renewal fails the credentials are
  dropped, the session is ended and the user goes to sign-in with their screen as the return address —
  and the waiting request is **not sent**, failing as the API's own 401 would.
- **The development verifier**, `identity.provider.mock-verifier.ts`, swapped in by `angular.json` for
  `build:local-api` and nothing else (the `DL-136` technique). It composes `mock:<role>:<subject>`
  from the typed email (lower-cased, `@` as `.`, cut to the backend's `[A-Za-z0-9._-]{1,64}`) and a
  staff/admin choice on screen; the password is not read, and the screen says so, and says the role
  is recorded only the first time that subject reaches the API. No credential literal is committed.
  The API still decides: `GET me` refuses a resident's role here too.
- **The screen says which of these it is** (`SIGN_IN_METHOD`, a domain token): a password form; no
  form at all and a plain sentence when no key was supplied; or the development verifier. The
  explanations come from the adapter, so no development wording is in a production bundle.
- **The role label** (design doc item 14). `fromServerIdentity` labelled a role it did not know
  `auditor`, so every Node administrator was an auditor wherever a role showed. `AuthenticatedUser.role`
  is now `StaffRole | null`, and the label is the server's own (`Staff`, `Administrator`). Nothing is
  granted from either — permissions come only from `/me.permissions`, and `check:auth` rule 6 still
  forbids computing them from a role.
- **The Web API key** is `firebaseWebApiKey: string | null` in every environment, and `null` in all
  four. It is a public identifier, not a secret: it names the Firebase project to Google and ships in
  every browser, and what limits it is a restriction in Google Cloud to the console's origins and the
  Identity Toolkit and Token Service APIs. While it is `null` the provider sends nothing and the screen
  says sign-in is not configured — never a request with an invented key.
- **CSP.** `connect-src` in all three policies (`netlify.toml` production and deploy preview,
  `public/_headers`) gains exactly `https://identitytoolkit.googleapis.com` and
  `https://securetoken.googleapis.com`. Not `*.googleapis.com`, which would admit every Google API —
  storage buckets among them — as somewhere an injected script could post a token.

### Verified against Google's published reference, 2026-11-05

- Sign-in body and answer (`idToken`, `refreshToken`, `expiresIn` as a string of seconds), refresh
  body and answer (`id_token`, `refresh_token`, `expires_in`), the error envelope and "the error code
  is obtained from the message field":
  https://firebase.google.com/docs/reference/rest/auth
- `INVALID_LOGIN_CREDENTIALS` under email enumeration protection, on by default for projects created
  from 15 September 2023:
  https://cloud.google.com/identity-platform/docs/admin/email-enumeration-protection
- `mfaPendingCredential` and `mfaInfo[]` on the sign-in answer:
  https://cloud.google.com/identity-platform/docs/reference/rest/v1/accounts/signInWithPassword
- A TOTP enrolment is one carrying `totpInfo` (an empty object), identified by `mfaEnrollmentId`:
  https://cloud.google.com/identity-platform/docs/reference/rest/v1/MfaEnrollment
- `mfaSignIn:finalize` takes `{ mfaPendingCredential, mfaEnrollmentId, totpVerificationInfo:
  { verificationCode } }` and answers `idToken` and `refreshToken` with **no** `expiresIn`, so the
  lifetime is read from the token's `exp` claim (seconds since the epoch, per
  https://firebase.google.com/docs/auth/admin/verify-id-tokens):
  https://cloud.google.com/identity-platform/docs/reference/rest/v2/accounts.mfaSignIn/finalize
- `mfaSignIn:start` carries only an SMS option, so a TOTP sign-in does not call it:
  https://cloud.google.com/identity-platform/docs/reference/rest/v2/accounts.mfaSignIn/start

`TOO_MANY_ATTEMPTS_TRY_LATER` is listed on the REST page only under sign-up; it is mapped for sign-in
as the design doc asked, and costs nothing if Google never sends it there.

### What the checks now hold

| Check | New rule | Planted regressions, each caught |
| --- | --- | --- |
| `check:auth` | 2b: the refresh token is `#refreshToken` in the provider, with no getter, method or property named for it, and the grant model never names one | a public `refreshToken` field; the private field renamed; `refreshToken` in `IdentityGrant` |
| `check:auth` | 2c: no Firebase SDK import, and no `firebase`/`@firebase/*`/`@angular/fire` dependency | `import … from 'firebase/auth'`; `firebase` in `package.json` |
| `check:auth` | 2d: a `mock:` credential is composed only in the swapped file; nothing imports that file; only `build:local-api` swaps it in | `` `mock:` `` in the real provider; an import of the verifier; the replacement added to `production` |
| `check:environments` | 8: `firebaseWebApiKey` is classified by name **and** shape (`AIza` + 35) and must be stated, `null` included; any other field whose name *contains* a credential word fails (`stripeSecretKey` no longer escapes `apiKey`); local configurations carry none; staging and production differ; a supplied key needs its fingerprint recorded | an invented key; `stripeSecretKey`; the field removed; a valid-shaped unrecorded key; one key in staging and production; a key in `local-api` |
| `check:bundle` | the development verifier's wording is absent from the production artefact and still present in its own file; a Google API key passes only if its sha256 is in `tools/accepted-public-identifiers.json` (empty — no key exists) | the wording appended to a built chunk; the wording removed from the source; an unrecorded key in a chunk — and, as a control, the same key recorded passes |
| `check:headers` | 7: every `connect-src` is `'self'`, exactly one API origin, and exactly the identity provider's two endpoints | an endpoint removed; `https://*.googleapis.com` added; an extra origin |
| `check:contract` | 3: `data/http/identity/` may build URLs on the two identity origins and no other | another absolute URL in the identity folder |

Twenty-one plants, every one caught, every file restored byte for byte. The swap was also proved from
the other side: a `local-api` build compiles with the verifier in place, its bundle carries the
verifier's wording, and no JavaScript in it names `identitytoolkit` — the Firebase provider is not
there.

Every existing rule keeps its strictness; rule 6 (no permission computed from a role) is unchanged
and covers `data/http/identity/` already.

### What is not done, and whose it is

- **No key exists.** Staging and production say "sign-in is not configured" until a person supplies
  each project's Web API key, restricts it in Google Cloud, and records its fingerprint. Until then the
  `http` configurations sign nobody in, honestly.
- **TOTP has not run against a live project.** It is built to the published reference and tested
  against it, but whether the office's Firebase project is upgraded to Identity Platform with TOTP
  enabled nobody has confirmed (design doc R7). Until it is, staff sign in with a password alone. An
  account whose only second factor is SMS is told the console cannot accept it.
- **No expiry is shown for a second-factor attempt**, because Google does not publish how long a
  pending credential lasts.
- **Sign-out revokes every device of that account**, including a staff member's own residents' app
  (R5) — the API's behaviour, unchanged here.
- **Unsaved work is still lost** when a session ends, as it was before (TAB 02's deferred item).

The launch gate stays **NO-GO**. `npm run verify` is green on Windows: 96 spec files, 1,674 tests
(93 and 1,628 before — three new spec files, for the Firebase provider against
`HttpTestingController`, the development verifier, and renewal end to end through the real
interceptors; the staff adapter, the token holder, `fromServerIdentity` and the sign-in screen gained
tests in their own).

## DL-167 — a module the API cannot serve leaves the menu and is named; ID verification gets a screen

Step 5 of `docs/integration/node-api-migration.md`, and the first platform screen of step 6. `DL-164`
promised both: unserved ports "say so", their navigation entries are withheld, and one page names
every module in that state — and nobody can approve a resident's ID verification because no screen
exists for it.

### 1. Unserved modules leave the navigation, and one page names them

Until now the menu offered all eighteen unserved modules in the `http` configuration, and each ended
in the sentence `DL-165` put in its adapter. That was honest per screen and wrong as a console: an
officer opened "Cases", read an error, and concluded the screen was broken — or, where a screen
handles its failure quietly, read an empty table as an office with no cases (`DL-112`).

- **The data layer declares what it cannot serve.** `UNSERVED_PORTS` is a domain token holding
  `DataPort` keys — one per repository token, spelled from it (`ASSISTANCE_REQUEST_REPOSITORY` is
  `assistance-request`). Both adapter sets bind it: the http set to `UNSERVED_HTTP_PORTS`, built
  from a `static port` on each `Unserved…` class; the mock set to `[]`. It has **no default**, so a
  set that forgets to say fails at the first screen rather than offering every link. Features learn
  nothing about adapters (rule 3): they ask `ServedPorts`, in `core/access`.
- **The unit is the port, not the module.** The data layer knows ports; the menu knows modules. Each
  `NavItem` now lists the ports its screen `reads`, and each route carries a `servedGuard` listing the
  same ports — every port the screen reads, not only its main one, because a screen that loads its
  list and not the picker beside it fails half-way and reads as a record with a piece missing. The
  guard comes **before** the permission guard: "this module has no server" is truer than "you may not
  open it", since nobody could.
- **One page names them.** `/unavailable` ("Not connected yet") lists every withheld module with its
  description and, in words, the ports it lacks; then every unserved port; then what the reader can
  open. It never says "no records", "empty" or "none found" — claims about the office it cannot make.
  It lists every withheld module whatever the reader's role: what the server lacks is no secret about
  any record, and a role-filtered list would have two officers describe one console differently. The
  menu links it whenever anything is withheld, so an absent module is never unexplained.
- **Rule 8 holds for ports as it does for permissions.** The menu filters by both; the global search
  trigger (and its Ctrl+K) is withheld when search is not served; the breadcrumb drops its
  "Dashboard" root when the dashboard is not served, because a link labelled Dashboard that lands on
  a page explaining there is no dashboard is the bounce rule 8 forbids, in a quieter place.

`check:unserved` (new, in `verify`) holds the three lists to one another, because no compiler can:

| Rule | Planted regression, caught |
| --- | --- |
| 1. The `Unserved…` bindings are exactly `UNSERVED_HTTP_PORTS`; each class stands for the port it is bound to; the http set binds the token to that list and the mock set to `[]` | a class dropped from the list; a class claiming another port; either binding removed |
| 2. `DATA_PORTS` names every repository token, and nothing else | a key removed |
| 3. Every routed screen guards exactly the ports it reads — directly, through its own feature's files, or through a shared component it names | the case list's guard removed |
| 4. Every menu entry reads exactly what its route guards | an entry's `reads` emptied; an entry's `reads` removed |
| 5. No port read by `core/` is unserved — core runs on every screen, so no route could withhold it | a core file reading the resident registry |
| — `UNSERVED_ROUTE` is a routed screen | the route renamed |

Ten plants, each caught, each file restored byte for byte. Rule 3 reads source text, so it is a
floor: a port reached through a service it does not follow is not seen. Where a shared file exports
two classes it lends both its ports, which over-reports — the safe direction, withholding a module
that might have worked rather than offering one that cannot.

With the http set every one of the eighteen menu entries is withheld: each reads a port the Node API
does not serve. An account in the `http` configuration sees only "Not connected yet", and the page
says the inbox still works. The landing route stays `/dashboard`; in the `http` configuration its
guard sends the reader to that page, which is where a first-time reader should start.

`check:access` is unchanged and still meaningful: no permission moved. `CLAUDE.md` §3 does not list
`check:unserved`; the constitution is the owner's to amend (`DL-165`).

`npm run verify` is green on Windows after this part: 98 spec files, 1,732 tests (96 and 1,674
before — `served-ports.spec.ts` for the guard and the declaration, `unserved-modules.spec.ts` for
both adapter sets and every menu entry against its route; the layout spec gained the withheld menu,
the dashboard crumb and the search trigger).

### 2. ID verification review — the first screen built on what the Node API serves

`GET admin/verification-requests` (cursor-paged, `?status=`), `POST …/{id}/approve`,
`POST …/{id}/reject` and `GET media/{id}/content`, admin only (`verification.review`). Shaped like the
resource, not like casework: a `VerificationRequest` is an **app account** asking to be verified, never
a `ResidentId` or a case (`DL-164`). The whole screen is described in
[`docs/verification/README.md`](../verification/README.md); the decisions are these.

- **One vocabulary.** `verification.review` joins `PERMISSIONS` spelled exactly as the API's
  `StaffCapability`, so `fromServerIdentity` keeps it when `/me` sends it (`DL-122`). The API grants it
  to `admin` alone; here the system administrator holds it by holding every key and no role names it.
  It is mutating. `check:permission-parity` holds at 42 unreachable guards of 44 — the new guard is
  reachable, the first one besides `audit.view`.
- **The lifecycle is defined once** (rule 7): `pending → approved | rejected`, `rejected → pending` as
  the **resident's** move, `approved` terminal. The office's moves are `VERIFICATION_REVIEW_MOVES`.
- **A person decides.** No score, confidence, match or suggestion anywhere — the sixth surface where a
  signal could become a verdict, after `DL-42`, `DL-60`, `DL-66`, `DL-78` and `DL-98`.
- **The images are a government ID and a face.** Loaded only when asked, after a warning (the
  `openDocument` precedent, `DL-77`); read as a `Blob` through the new `ApiClient.blob`, with the bearer
  token in a header and never in an address; shown from object URLs made only by the review and revoked
  on hide, on switching request and on destroy; never stored, never logged. CSP `img-src` gains
  `blob:` and nothing else.
- **A decision says what it does before it is made.** `StatusTransition` gained per-destination
  guidance: the consequences — `VERIFICATION_DECISION_EFFECTS`, read from the backend's handlers at
  `2736e28` and cited beside the list — appear between the choice and the button, which they describe,
  and the reason's label names its reader: the office for an approval, **the resident** for a
  rejection. The API makes an approval's note optional; this console asks for a sentence, as for every
  recorded move (`DL-54`). The outcome is announced in a live region.
- **A browsable list, a page at a time** (`DL-161`): "Showing 20 requests. More are available.", and
  "Show more" follows the cursor. A request the mapper cannot read **refuses the page** instead of
  dropping out of it — one fewer row is a resident waiting on a review nobody knows is owed.
- **No record by address.** The API cannot read one request, so the review is a drawer beside the
  queue, and after a decision the queue is read again rather than patched.
- **The menu, again.** The port is served in the http set, so `check:unserved` now holds 21 ports, 18
  unserved, and 19 menu entries. An administrator in the `http` configuration sees "ID verification"
  and "Not connected yet"; any other account still sees only the latter.

#### The checks it had to satisfy, made stricter rather than looser

| Check | Change | Planted regression, caught |
| --- | --- | --- |
| `check:routes` | `blob` judged as `GET`; 5 endpoints, 9 composed requests, all served at their verb | a reject path renamed |
| `check:response-shape` | a new envelope, `binary` — a `200` whose every media type is non-JSON with `format: binary` — matched both ways | `item` on the media route; `blob` on the list route |
| `check:consumer-contract` | reads `allOf` as one object (union of properties and of required), so the staff view is checked rather than reported as no object; 6 interactions, 28 required fields | a field the API does not send; a required field the API may omit |
| `check:wire-adoption` | unchanged rule; the two bodies are literals checked against `ReviewNotes` / `RejectNotes` | `note` for `notes` |
| `check:query-params` | `blob` classified; `status` declared by the operation | `state` for `status` |
| `check:mapper-adoption` | `blob` listed so the surface comparison stays exact | — |
| `check:headers` | rule 8: `img-src` is exactly `'self' data: blob:` | `blob:` removed; a remote origin added |
| `check:bundle` | the seed's placeholder wording is a seed marker | — |
| `check:verification` | new, in `verify` — see `docs/verification/README.md` | eighteen, each caught |
| `check:port-adoption` | 148 of 159 port methods reached; the 11 unreached unchanged | — |

The fixtures validator in `fixtures.spec.ts` learned `allOf` the same way, and a drift test proves it
is not vacuous: before, a fixture against a composed schema was checked against nothing.

#### Not done, and whose it is

- **Account details on the review** (`GET admin/users/{id}`, `user.view`): more personal data on the
  screen for a better-grounded decision — the owner's call.
- **The reviewer's name** on a decided request: the staff directory is unserved.
- **Not run against a live API**: built and tested against the vendored spec and composed fixtures.
- `CLAUDE.md` §3 does not list `check:unserved` or `check:verification`; the owner's to amend.

The launch gate stays **NO-GO**. `npm run verify` is green on Windows: 102 spec files, 1,790 tests
(98 and 1,732 after part 1 — four new spec files, for the domain model, the mapper, the mock adapter
and the screen; the HTTP adapters, the fixtures, the permission matrix, the layout and the unserved
modules gained tests in their own).

## DL-168 — the office inbox and users and roles: two screens on what the Node API serves

Step 6 of `docs/integration/node-api-migration.md`, after `DL-167`'s ID verification review. Two
staff surfaces the API has served since `DL-164` and no screen has used: residents writing to an
office, and the administrator deciding who is staff. Both are built the way the review was — shaped
like the API's resource, privacy decided in the data layer, what an act does said before the button
— and both move ports from "no screen" to "served", not from "unserved" to "served": the eighteen
unserved casework ports are unchanged.

### 1. The office inbox

`GET threads` (cursor-paged; the server's scope: staff see their office's, an administrator every
office's), `GET threads/{id}`, `GET threads/{id}/messages` (cursor-paged, newest first),
`POST threads/{id}/messages`, `POST threads/{id}/read`, `POST threads/{id}/close`, and
`GET media/{id}/content` for attachments, under `office-inbox.manage`. The office directory
(`GET offices`, public) names the office each conversation went to. Two new ports, `office-inbox` and
`office`, both served in the http set. The screen is described in
[`docs/inbox/README.md`](../inbox/README.md); the decisions are these.

- **What a resident wrote is read by opening it.** The API sends the first 140 characters of the
  latest message with every row; the mapper does not read it and the model has no field for it, so
  the list shows subjects, never words. Nothing in the module logs, stores or notifies — a toast that
  quoted a message would put it on every screen nearby. A refusal repeats the server's sentence, never
  what was being sent (`failureReason`, moved to `shared/state` because two features now use it).
- **No name, said so.** A conversation carries the resident's account id and nothing else, and the
  console has no read that names an account by id. The list says that what was written is shown, not
  who wrote it. Whether staff should see a name is owner decision 8.
- **Attachments follow the ID review exactly.** Loaded only after a warning; bytes through
  `ApiClient.blob`, for a media id the message carries and no other; object URLs revoked on hide, on
  another conversation and on leave. The object-URL handling the review had inline is now
  `ObjectUrls` (`shared/media`) — CLAUDE.md §4: two features need it — and it is the one file in the
  console that calls `URL.createObjectURL`. `check:verification` rule 3 was rewritten to hold the
  review to the holder rather than to its own calls, and is no looser: four plants, each caught.
- **An empty inbox is asked about before it is believed.** The API answers a staff account with no
  office with an empty page, not a refusal — the same answer as an office nobody has written to. At
  sign-in such an account holds no key and is offered no inbox; `GET me` now also says it has no
  office (`AuthenticatedUser.awaitingOffice`, read from `office_id`, never granting anything), and the
  page it lands on says it is not assigned and that an administrator assigns offices under Users and
  roles. Mid-session — the assignment removed after sign-in — the adapter asks `GET me` before
  believing an empty first page and answers `no-office`, which the list renders as that explanation
  instead of the table. "No conversations" is said only to an account that has an office.
- **A conversation has an address.** Unlike a verification request, one thread can be read by id, so
  `/inbox/{id}` is a route a reload or a colleague's link answers. After every act it is read again,
  never patched, and read **quietly** — what is on screen stays until the answer arrives, so the
  reader's focus and the live region telling them the outcome are not wiped by a skeleton.
- **Mark read is the office's mark.** The API keeps one `office_last_read_at` per conversation, so
  marking read clears the count for every colleague; the screen says so before the button, and
  opening a conversation does not mark it read. That `unread_count` also counts colleagues' replies is
  a backend item, recorded in the migration doc.
- **Close is confirmed and asks no reason.** The server records `thread.closed` against the account
  and accepts no body, so there is nowhere for a reason to go; a box whose words go nowhere is a
  record somebody believes exists. The confirmation lists what closing does
  (`THREAD_CLOSE_EFFECTS`, read from the handler at `2736e28`) — including that the resident is not
  told, and that nothing reopens it. `open → closed`, terminal (rule 7).
- **Replies are words.** The API also accepts an image with a reply; sending one needs a multipart
  upload no adapter has, and every contract check would have to learn it. Not done, and said on the
  screen.
- **One vocabulary.** `office-inbox.manage` joins `PERMISSIONS` as the server spells it (`DL-122`).
  Mutating. In the mock it is held by the roles that work at the MSWDO — head, social worker, intake
  officer, release officer — and the administrator; not by the barangay link, who works from a
  barangay rather than at an office (the server's "no office" case), nor the auditor, whose role is
  read-only. The mock does not model offices: every holder sees every seeded conversation, as an
  administrator does on the server.
- **The admin fixture was wrong.** `me-admin.json` listed thirteen capabilities; the backend's
  `capabilitiesFor('admin')` returns all fifteen. It now carries `news.write` and
  `office-inbox.manage`, and the sign-in tests say which server keys the console keeps.

#### The checks it had to satisfy

| Check | Change | Result |
| --- | --- | --- |
| `check:routes` | none | 7 endpoints, 16 composed requests, each served at its verb |
| `check:response-shape` | none | 11 of 11 reads agree with their envelope |
| `check:wire-adoption` | none | 8 of 8 bodies declared by their operation — `{ body }` for a reply, `{}` for read and close |
| `check:query-params` | none | 11 reads, every key declared |
| `check:consumer-contract` | the comparison reads a `201` answer where an operation has no `200` — a reply's `{ thread, message }` — so its mapper can be tagged rather than left unread | 13 interactions, 73 required fields |
| `check:port-adoption` | none | 156 of 167 port methods reached; the 11 unreached unchanged |
| `check:unserved` | none | 23 ports, 18 unserved; 52 routed screens, 20 menu entries |
| `check:permission-parity` | none | 42 of 46 guards unreachable, the ceiling held — both new guards are reachable |
| `check:access` | matrix row | 72 permissions × 7 roles |
| `check:verification` | rule 3 against `ObjectUrls` | four plants, each caught |
| `check:bundle` | the inbox seed's placeholder wording is a seed marker | — |
| `check:inbox` | new, in `verify` — eight rules, see `docs/inbox/README.md` | twenty-four plants, each caught, every file restored byte for byte |

`npm run verify` is green on Windows after this part: 106 spec files, 1,843 tests (102 and 1,790
before — four new spec files, for the domain model, the mappers, the mock adapter and the two
screens; the HTTP adapters, the fixtures, the identity, the permission matrix, the layout and the
unserved modules gained tests in their own).

### 2. Users and roles

`GET admin/users` (cursor-paged, newest first), `PATCH admin/users/{id}/role` and
`PATCH admin/users/{id}/office`, admin only (`user.view`, `user.change-role`, `user.assign-office`),
with the office directory as the picker. The spec has **no** `GET admin/users/{id}`, so there is no
record by address. One new port, `app-account`, served in the http set. The screen is described in
[`docs/accounts/README.md`](../accounts/README.md); the decisions are these.

- **The minimum, because most rows are residents.** Name, email, role and office. The API also sends
  a mobile number and a home barangay; neither is mapped (CLAUDE.md §6.1), and the screen says what it
  leaves out. `verification_status` is not read either: for a resident the role says it, and this
  screen does not decide it.
- **What a change does, before the button.** `ROLE_CHANGE_EFFECTS` and `ROLE_CHANGE_ALWAYS` were read
  from the handler, the repository and the capability table at `2736e28`, and two of them are easy to
  miss in the code: **every role but `verified` revokes the account's digital ID** — promoting a
  verified resident to staff included — and **`verified` marks an account verified without an ID
  review**, issuing no digital ID. The change applies at the person's next request, because the
  database role replaces the token's; a console they have open keeps its menu until reloaded, but the
  server already refuses. The office link survives a role change, unused, and applies again if the
  account becomes staff again.
- **No reason, said so.** Both changes are audited (`user.role_changed`, `user.office_assigned`)
  against the administrator with no reason, so — as with closing a conversation — none is asked for,
  and the effects say the server keeps none.
- **Not one's own role.** The server refuses it with `403` whoever asks; the panel does not offer it
  and says another administrator can, and the method refuses it as well.
- **An office only for staff.** The picker is offered only on a staff account; a leftover link on any
  other role is shown as unused. Clearing a staff account's office is the act that produces part 1's
  "not assigned to an office", and its effects say so.
- **A drawer beside the list,** as for an ID review, and the list read again after a change.
- **A role the console does not know refuses the page.** The spec types `UserListItem.role` as a bare
  string; a role outside the four `RoleChange` lists is one this screen cannot say anything true about
  changing.
- **One vocabulary.** The three keys join `PERMISSIONS` as the server spells them; held by the system
  administrator alone, by holding every key, and named by no role. `user.view` is a read; the other
  two are mutating.
- **The office directory, shared.** Part 1 named offices with a helper in the inbox's folder; with a
  second feature reading the directory it moved to `shared/offices` (CLAUDE.md §4).

#### The checks it had to satisfy

| Check | Change | Result |
| --- | --- | --- |
| `check:routes` | none | 8 endpoints, 19 composed requests, each served at its verb |
| `check:response-shape` | none | 12 of 12 reads agree with their envelope |
| `check:wire-adoption` | none | 10 of 10 bodies declared — `{ role }`, `{ office_id }` |
| `check:query-params` | none | 12 reads, every key declared |
| `check:consumer-contract` | none | 16 interactions, 79 required fields |
| `check:port-adoption` | none | 159 of 170 port methods reached; the 11 unreached unchanged |
| `check:unserved` | none | 24 ports, 18 unserved; 53 routed screens, 21 menu entries |
| `check:permission-parity` | none | 42 of 47 guards unreachable, the ceiling held — the new guard is reachable |
| `check:access` | three matrix rows | 75 permissions × 7 roles |
| `check:bundle` | the account seed's reserved address is a seed marker | — |
| `check:inbox` | its `console` pattern matches a call, not the word — the copy says "this console." | twenty-four plants, still each caught |
| `check:accounts` | new, in `verify` — seven rules, see `docs/accounts/README.md` | twenty-one plants, each caught, every file restored byte for byte |

#### Not done, and whose it is

- **Sending an image with a reply** (part 1): the API accepts one; the console would need a multipart
  upload that no adapter has.
- **A resident's name in the inbox, an account's name and birth date in the ID review**: more personal
  data on screen, and the API sends neither — owner decisions 7 and 8 in
  `docs/integration/node-api-migration.md`.
- **Search among accounts**: the API's list takes a cursor and nothing else.
- **Not run against a live API**: built and tested against the vendored spec and composed fixtures.

The launch gate stays **NO-GO**: the eighteen unserved casework ports are unchanged. `npm run verify`
is green on Windows after this part: 110 spec files, 1,881 tests (106 and 1,843 after part 1 — four
new spec files, for the domain model, the mapper, the mock adapter and the screen; the HTTP adapters,
the fixtures, the permission matrix, the layout and the unserved modules gained tests in their own).

## DL-169 — a staging Firebase project, made by the person who decides, and what it still lacks

On 2026-11-05 Michaela Cailing, who directs this work, asked for the Firebase project to be created
under her account rather than waiting for one to be supplied. `taytay-lgu-ids-staging` now exists
under michaela@lguids.com.ph.

### What it has

- **Authentication** started, **email/password** on with a password required. A throwaway account
  was created, signed in (`signInWithPassword` 200, one-hour ID token), refused with
  `INVALID_LOGIN_CREDENTIALS` on a wrong password — so email-enumeration protection is on, which
  `DL-166`'s mapping already expects — and deleted.
- A **web app**, "Taytay Staff Console". Its browser key is in `environment.staging.ts` and its
  sha256 in `tools/accepted-public-identifiers.json`, as `DL-166` requires.
- The key is **restricted to two APIs**: Identity Toolkit and Token Service — the only two the
  console calls.

### What it does not have, and why

- **No HTTP-referrer restriction.** The staging console has no approved origin yet. The entry in
  `accepted-public-identifiers.json` says so rather than claiming a restriction that does not exist.
- **No two-factor.** TOTP needs Identity Platform, and Google refused to initialise it without a
  billing account (`BILLING_NOT_ENABLED`). Billing was not added on somebody's personal account to
  get past it; staff sign in with a password until the office decides.
- **No service-account key.** The backend's verifier needs one, and it is a real secret. It is made
  by a person in the Firebase console and placed only on the staging VM (CLAUDE.md rule 5).
- **No production project.** Staging and production never share a project (backend
  `deploy-linode.md`).

### And a staging build that would have broken under its own policy

Building the staging configuration for the first time showed that it inherited Angular's default
optimisation, which **inlines critical CSS** into `index.html` — and the staging CSP is
`style-src 'self'`, so every staging page would have loaded unstyled. Production already set
`inlineCritical: false` (TAB 13: "change the feature, not the policy"). Staging now has production's
`optimization` and `budgets`, and `check:headers` and `check:bundle` both pass on a staging build.
A build that is meant to rehearse production has to be built like it.

## DL-170 — what residents see in the app, kept here: the directory, the home screen, the app's settings

Step 6 of `docs/integration/node-api-migration.md`, after `DL-168`. Three staff surfaces the API has
served since `DL-164` and no screen has used, all admin only on the server, and all different from
the screens before them in one way: **they change what every resident reads in the app.** An office
leaves the directory, an emergency number changes, the app refuses to open until it is updated. So
each screen says near its title that residents see it, and every act says what it does before the
button that does it, in sentences read from the backend's handlers rather than assumed. Each moves
ports from "no screen" to "served"; the eighteen unserved casework ports are unchanged.

The backend was read at `2af2243`; its modules are unchanged since `2736e28`, the commit the vendored
spec was taken from, so the domain's citations name `2736e28`.

### 1. The app directory: offices, Tulong pages, hotlines

`GET offices` and `GET services` (public, cursor-paged), `GET services/{slug}`, `GET admin/hotlines`,
and the writes under `admin/offices`, `admin/services` and `admin/hotlines`, under `office.manage`,
`service.manage` and `hotline.manage`. Three new ports — `directory-office`, `tulong-service`,
`hotline` — served in the http set; the Tulong section also reads `office` for its picker. One route,
`/directory`, with the section in the URL. Described in
[`docs/directory/README.md`](../directory/README.md); the decisions are these.

- **A Tulong page is not a programme** (`DL-164`). It is a page a resident reads — the API calls it
  "information only", and there is no application endpoint — with eligibility as a paragraph nobody
  evaluates. It has its own type, `TulongService`, its own port, and its own screen, and
  `check:directory` fails the build if the directory names `Program`, `PROGRAM_REPOSITORY` or an
  eligibility guideline, or the programmes module names a Tulong type. The section says, under its
  title, that a page is not one of the office's assistance programmes.
- **What an act does, before the button.** `OFFICE_EFFECTS`, `SERVICE_EFFECTS` and `HOTLINE_EFFECTS`
  were read from the handlers, repositories and migrations, and the forms list them between the
  fields and the button, growing with the change: a new address says old links stop working; a new
  banner says the old one is deleted; hiding a page says it leaves this list too; featuring one says
  the home screen shows the six newest; a changed hotline number is read back, old and new, in full.
  Every act is audited with no reason, so none is asked for.
- **Deletes are confirmed.** Only through a modal whose effects come before its button: an office's
  delete is **refused while a staff account, a Balita article, a Tulong page or a conversation names
  it** (four foreign keys, none cascading), and the refusal does not say which; a page's delete takes
  its picture; a hotline's offers making it inactive instead. A refusal stays in the modal, in the
  server's words.
- **The contract decides what a change can carry, not the handler.** `OfficePatch` declares four
  fields and `ServicePatch` leaves five out, though the handlers accept them all. The console sends
  only what the spec declares (`check:wire-adoption`) — a field the contract does not declare is one
  the server may drop while reporting success — and shows the rest as set at creation, saying why.
  Recorded as a backend item: declaring them fixes it without code on either side.
- **A hidden page is not in any list.** `GET services` leaves out a page hidden from the catalogue
  unless it is featured, and there is no admin list. The section says so and offers the one read that
  finds one, `GET services/{slug}`; hiding a page says beforehand that it will leave this list. A
  hidden page must never read as a deleted one.
- **A capped list says so.** `GET admin/hotlines` stops at a hundred with no word of more; a listing
  that long carries `mayBeIncomplete`, and the section says there may be lines neither it nor the app
  shows (`DL-161`'s rule, where the server gives no cursor to follow).
- **The first form bodies.** Banners and pictures are files, so `ApiClient` gained `postForm` and
  `patchForm` (`multipart/form-data`, no `Content-Type` set by the console, the bearer added by the
  interceptor as for JSON). A form cannot say `null`, so an office's short name can be replaced but
  not cleared, and an empty coordinate is never sent — the server would read it as `0`.
- **An image is refused before it is sent.** One shared field, `ImageFileField` (`shared/media`), is
  the only file input in any feature. It holds a file to `APP_IMAGE_POLICY` as the server does —
  `MAX_IMAGE_BYTES`, five megabytes, and JPEG, PNG or WebP **by the first bytes**, not the name —
  says what to do in an alert, and hands on nothing it refused. An accepted file is previewed from an
  object URL made by `ObjectUrls`, given back on change and on destroy.
- **No image address.** The API answers banner bytes at a public route on its host; no model carries
  that address, no mapper reads `hero_url`, no directory template draws an `<img>`. A picture is said
  as present or absent.
- **A save sends a list back whole,** so a Tulong page with one contact of a kind the console does not
  know is unreadable rather than shorter — dropping it would delete it on the next save.
- **One vocabulary.** The three keys join `PERMISSIONS` as the server spells them, held by the system
  administrator by holding every key, named by no role, mutating. The route and the menu entry open
  for any of the three; each section is offered only to its own.

#### The checks it had to satisfy, made stricter rather than looser

| Check | Change | Result |
| --- | --- | --- |
| `check:wire-adoption` | walks `postForm`/`patchForm`; **new**: the helper's media type must be the one the operation declares (a form to a form route, JSON to a JSON one); **new**: a `toWire…` mapper is no longer accepted on its name — its declared `…Wire` interface is read and every key held to the operation; the helper table is asserted against `ApiClient` | 17 of 17 bodies; seven plants, each caught (a form to a JSON route, JSON to a form route, an undeclared key on a create, a camelCase key, `description` on an office change, an unreadable mapper, an unknown helper) |
| `check:permission-parity` | reads a guard naming several keys as one guard, unreachable if **any** key is outside `StaffCapability` | 42 of 48, the ceiling held; a planted unknown key beside two good ones caught |
| `check:routes`, `check:response-shape`, `check:query-params`, `check:mapper-adoption` | the two form helpers added to each table, each asserted against `ApiClient` | 12 endpoints and 32 composed requests served at their verbs; 16 of 16 reads agree with their envelope; 16 reads, every key declared |
| `check:consumer-contract` | none | 27 interactions, 157 required fields |
| `check:port-adoption` | none | 173 of 184 port methods reached; the 11 unreached unchanged |
| `check:unserved` | none | 27 ports, 18 unserved; 54 routed screens, 22 menu entries |
| `check:access` | three matrix rows | 78 permissions × 7 roles |
| `check:accounts`, `check:verification` | "named by no role" scanned from the end of `PERMISSIONS` rather than from `ROLE_DEFINITIONS`, which missed the shared lists declared above it | a key planted in `INTAKE_PERMISSIONS` or `SOCIAL_WORKER_PERMISSIONS` now caught; it was not before |
| `check:bundle` | the directory seed's reserved address is a seed marker | — |
| `check:directory` | new, in `verify` — ten rules, see `docs/directory/README.md` | twenty-six plants, each caught, every file restored byte for byte |

`npm run verify` is green on Windows after this part: 115 spec files, 1,960 tests (110 and
1,881 before — five new spec files, for the domain, the mappers, the mock adapters, the shared image
field and the screen; the HTTP adapters, the fixtures, the identity, the layout and the unserved
modules gained tests in their own).

### 2. The home screen: banners and quick links

`GET admin/home/banners` and `GET admin/home/links` (each answered whole), their writes, `POST media`
for a banner's image, `GET media/{id}/content` to show one, and `GET home` as the preview, under
`home.manage`. One new port, `home-screen`, served in the http set; one route, `/home-screen`.
Described in [`docs/home-screen/README.md`](../home-screen/README.md); the decisions are these.

- **No description of a banner's image, said rather than collected** (`DL-125`). The API keeps none —
  `home_banners` stores a title, an image, a link, an order and whether it is shown — so the model
  has no field for one, the form no box, the body no key, and both the section and the form say the
  app has no description to give a resident who cannot see the image. A box the console filled and
  the server dropped would be a description somebody believes residents hear. Recorded as a backend
  item; the console asks for one beside the image the day the API keeps it.
- **An image is stored before its banner,** because that is how the API takes one: `POST media`, then
  the banner naming the id. If the banner is then refused the image stays stored, and nothing in the
  API removes it — nor a replaced image, nor a deleted banner's. The effects say all three before the
  button. The banner `PATCH` always carries the title, because the spec's body (`BannerWrite`)
  requires it though the handler does not.
- **Every link is shown.** The API has no hidden link, so deleting is the only way to take one off the
  home screen, and the list says so; a banner's delete offers hiding instead.
- **A preview read from the server, not composed here.** `GET home` — shown banners by order then age,
  every link, the six newest featured Tulong pages, the hotlines and the latest Balita — read again
  after every save. Names and counts only: an article's words are not read for a preview.
- **Images as bytes, from the data layer.** A banner's image is a public picture, so the preview shows
  them without a warning; still read through `ApiClient.blob` by id, shown from `ObjectUrls`, and
  given back on reload and on leave. The model holds the image's id, never `image_url`.
- **Two features now read form controls the same way**, so `form-values` moved from the directory to
  `shared/forms` (CLAUDE.md §4).
- **One vocabulary.** `home.manage` joins `PERMISSIONS` as the server spells it; the administrator's
  alone, named by no role, mutating.

#### The checks it had to satisfy

| Check | Change | Result |
| --- | --- | --- |
| `check:wire-adoption` | none — the image upload is a `toWire…` mapper whose `MediaUploadWire` is read and held to `POST media`'s form | 22 of 22 bodies |
| `check:routes` | none | 15 endpoints and 42 composed requests served at their verbs |
| `check:response-shape` | none | 20 of 20 reads; the two admin lists `list`, `GET home` an `item`, the image `binary` |
| `check:query-params` | none | 20 reads, every key declared |
| `check:consumer-contract` | none | 35 interactions, 187 required fields |
| `check:port-adoption` | none | 183 of 194 port methods reached; the 11 unreached unchanged |
| `check:unserved` | none | 28 ports, 18 unserved; 55 routed screens, 23 menu entries |
| `check:permission-parity` | none | 42 of 49 guards unreachable, the ceiling held |
| `check:access` | one matrix row | 79 permissions × 7 roles |
| `check:bundle` | the home seed's reserved address and drawn banners are seed markers | — |
| `check:home` | new, in `verify` — eight rules, see `docs/home-screen/README.md` | eighteen plants, each caught, every file restored byte for byte |

`npm run verify` is green on Windows after this part: 119 spec files, 1,995 tests (115 and 1,960 after part 1 —
four new spec files, for the domain, the mappers, the mock adapter and the screen; the HTTP adapters,
the fixtures, the identity, the layout and the unserved modules gained tests in their own).

### 3. The app's settings

`GET app/config` (public) and `PATCH admin/app/config`, under `app-config.manage`. One new port,
`app-config`, served in the http set; one route, `/app-settings`. Described in
[`docs/app-settings/README.md`](../app-settings/README.md); the decisions are these.

- **Every change is reviewed, and a change that can stop residents is acknowledged.** A newer oldest
  app version can force every resident with an older app to update before using it; a new terms or
  privacy version can make every resident accept again. "Review the change" opens a confirmation
  listing what the change does, those first (`appConfigEffects`); for those three
  (`asksEveryResident`) the button stays disabled until the administrator ticks that they understand,
  and `confirm` refuses without it too. Nothing is sent from anywhere else.
- **"Can", because the server enforces nothing.** No route refuses an old app or compares a resident's
  accepted version with these; the app is given the values and decides. The sentences say what the
  app is given and what that can make it do — this console cannot see the app.
- **The privacy notice is the API's, not this screen's.** Its text is served from the API's own record
  and changed by no route, so the screen shows its version and date, says its text is not changed
  here, and warns when residents would be asked to accept a version other than the one served. The
  mapper never reads the text.
- **Only what changed is sent**, `null` to clear a setting or delete a flag, and the settings are read
  again after a save rather than patched. The API's limits are checked before the review opens —
  including the column's twenty characters for the oldest version, which its pattern does not hold.
- **Flags are not secret**: the read is public, and the screen says so above them.
- **No reason is asked for**, because the server's one audit entry keeps none — nor which setting
  changed, which is a backend item.
- **One vocabulary.** `app-config.manage` joins `PERMISSIONS` as the server spells it; the
  administrator's alone, named by no role, mutating.

#### The checks it had to satisfy

| Check | Change | Result |
| --- | --- | --- |
| `check:wire-adoption` | none — the change is a `toWire…` mapper whose `AppConfigPatchWire` is held to `AppConfigPatch` | 23 of 23 bodies |
| `check:routes` | none | 17 endpoints and 44 composed requests served at their verbs |
| `check:response-shape`, `check:query-params` | none | 21 of 21 reads agree with their envelope; every key declared |
| `check:consumer-contract` | none | 37 interactions, 191 required fields |
| `check:port-adoption` | none | 185 of 196 port methods reached; the 11 unreached unchanged |
| `check:unserved` | none | 29 ports, 18 unserved; 56 routed screens, 24 menu entries |
| `check:permission-parity` | none | 42 of 50 guards unreachable, the ceiling held — the three new guards, one naming three keys, are all reachable |
| `check:access` | one matrix row | 80 permissions × 7 roles |
| `check:hardening` | none — its cap of twelve live regions was reached in part 2 and is held: a form's refusal is an alert shown when it happens, and a save that works is announced by the list beside it | 11 live regions, all polite |
| `check:bundle` | the settings seed's reserved address is a seed marker | — |
| `check:app-settings` | new, in `verify` — seven rules, see `docs/app-settings/README.md` | fifteen plants, each caught, every file restored byte for byte |

### Not done, and whose it is

- **The backend items** in `docs/integration/node-api-migration.md`: `OfficePatch` and `ServicePatch`
  declaring less than their handlers accept; no admin list of Tulong pages; no banner removal for an
  office; a silent hotline cap; no description of a home banner's image; stored images never
  removed; a privacy notice no route can change; an audit entry that names no setting. Each is the
  backend's to fix; the console says each on its screen meanwhile.
- **Whether the app's settings should be enforced on the server** — an old app refused, an
  unaccepted version refused — is the office's decision.
- **Digital IDs, Balita and the audit trail** have no screen yet (step 6g).
- **Not run against a live API**: built and tested against the vendored spec and composed fixtures.
- `CLAUDE.md` §3 lists `check:directory`, `check:home` and `check:app-settings`.

The launch gate stays **NO-GO**: the eighteen unserved casework ports are unchanged. `npm run verify`
is green on Windows after this part: 123 spec files, 2,017 tests (119 and 1,995 after part
2 — four new spec files, for the domain, the mapper, the mock adapter and the screen; the HTTP
adapters, the fixtures, the identity, the layout and the unserved modules gained tests in their own).

## DL-171 — the last three staff screens: digital IDs, Balita, the platform audit trail

Step 6 of `docs/integration/node-api-migration.md`, after `DL-170`, and its end: the three staff
surfaces the Node API has served since `DL-164` with no screen. Each moves a port from "no screen"
to "served"; the eighteen unserved casework ports are unchanged. The backend was read at `2af2243`;
the modules these screens use are unchanged since `2736e28`, the commit the vendored spec was taken
from, so the domain's citations name `2736e28`.

### 1. Digital IDs

`POST digital-id/verify` (`digital-id.verify` — every staff account and administrators),
`GET`/`POST admin/users/{id}/digital-id` and `POST admin/digital-ids/{id}/suspend|revoke|reissue`
(`digital-id.manage`, administrators alone). One new port, `digital-id`, served in the http set; the
administrator's section also reads `app-account`. One route, `/digital-ids`, a section per grant.
Described in [`docs/digital-ids/README.md`](../digital-ids/README.md); the decisions are these.

- **A check is a lookup, kept as small as the API makes it.** A pasted or typed payload — no camera,
  and the page says so; a scanner that types into a field is enough. The field is emptied as the code
  is sent; the answer lives in one signal and goes when another code is checked, the answer is
  cleared, or the page is left. Nothing is logged, stored or cached. The screen shows the five
  things the API answers — name, status, expiry, barangay, and the photo only after a warning
  (`DL-167`'s pattern) — and says before the button that the API records each check under the
  checker's account (`digital_id.scanned`) while this console keeps nothing.
- **No verdict** (`DL-60`'s doctrine). The screen repeats the API's status and expiry and says what
  that settles is the checker's decision; there is no "valid" or "accept" in the model.
- **A card is found through its account.** The API has no list of cards, so the administrator's
  section reads app accounts fifty at a time and shows the verified residents among them, saying how
  many accounts were read and whether more are available (`DL-161`). A filtered page is never
  presented as the registry.
- **What each act does, before its button, from the handlers.** Suspend stops the app showing a QR
  code, and **no route lifts a suspension**; revoke ends the card and the administrator's read never
  returns it again; replace revokes and issues a new number in one act, refused (and the old card
  untouched) if the account is no longer a verified resident; issue uses the latest approved
  verification selfie, the only photo the console can offer. Each act is confirmed; the API keeps no
  reason, so none is asked for.
- **One vocabulary.** Both keys join `PERMISSIONS` as the server spells them. The server gives
  `digital-id.verify` to every staff account, so every role holds it in the mock as well, and it is
  classified **read-only** — a check changes nothing on the card, and the auditor stays a read-only
  role. `digital-id.manage` is the administrator's alone, named by no role, mutating.

#### The checks it had to satisfy

| Check | Change | Result |
| --- | --- | --- |
| `check:wire-adoption` | none — the check's body is `toWireDigitalIdVerify` (`DigitalIdVerifyWire`, `token`); the four admin writes send `{}` | 28 of 28 bodies |
| `check:routes` | none | 19 endpoints and 50 composed requests served at their verbs |
| `check:response-shape`, `check:query-params` | none | 23 of 23 reads; the card an `item` read through `optionalItem` (a `404` is "no current card"), the photo `binary` |
| `check:consumer-contract` | regenerated | 43 interactions, 223 required fields |
| `check:port-adoption` | none | 192 of 203 port methods reached; the seven new ones each by a screen, the 11 unreached unchanged |
| `check:unserved` | none | 30 ports, 18 unserved; 57 routed screens, 25 menu entries |
| `check:permission-parity` | none | 42 of 51 guards unreachable, the ceiling held |
| `check:access` | two matrix rows | 82 permissions × 7 roles |
| `check:hardening` | none — the two outcome lines are `role="status"` without a second `aria-live`, so the cap of twelve holds | — |
| `check:bundle` | the sample codes `SAMPLE-QR.` and card numbers `TAY-SAMPLE-` are seed markers | — |
| `check:digital-ids` | new, in `verify` — eight rules, see `docs/digital-ids/README.md` | fifteen plants, each caught, every file restored |

### 2. Balita

`GET news` (published only, pinned first, cursor-paged), `GET news/{id}`, `GET news/categories`,
`POST news` and `PATCH news/{id}` as forms, `POST`/`DELETE news/{id}/pin`, `GET news/{id}/cover`,
under `news.write` — administrators, and staff while assigned to an office. One new port, `balita`,
served in the http set; the editor also reads `office` for its picker. One route, `/balita`.
Described in [`docs/balita/README.md`](../balita/README.md); the decisions are these.

- **Not the newsfeed** (`DL-164`). The newsfeed module keeps what this API has none of — schedule,
  archive, image descriptions, moderation — and stays unserved; Balita has its own model, port,
  screen and key, and `check:balita` fails if the module names the newsfeed's. The page says near its
  title that residents read it in the app's Balita.
- **Publishing is warned about before its button** (`DL-124`'s doctrine, kept on a model that
  cannot keep its mechanism). Above the publish button: every resident can read it at once, nothing
  recalls it from those who have, and no notification is sent. Above "take it off the app": whoever
  read it keeps it, and published again it keeps its first date (`COALESCE(published_at, now())`),
  so it does not return to the top. Above saving a draft, changing a published article and pinning,
  what each does. Every request leaves from one method, and only from a button below its effects.
- **The API lists no drafts, so the page keeps them — in memory.** A draft created, opened or taken
  off here stays on the page with its ID, and the page says it is gone when the page is left; one can
  be opened by its ID, which the audit trail also records. Nothing goes to web storage (`DL-110`).
- **No description of a cover, said rather than collected** (`DL-125`; `d2d9188` for banners). The
  model, the wire and the form have no field for one, and the form says the app has nothing to give a
  resident who cannot see it. Replacing a cover deletes the old image; one cannot be removed. The
  cover is read as bytes on request, never from `cover_url`.
- **Who writes is the server's decision.** Staff post for their own office (the API uses it when none
  is chosen and refuses another) and change only their office's articles; an administrator must
  choose an office. The console offers the choice and shows a refusal in the API's words.
- **One vocabulary.** `news.write` joins `PERMISSIONS` as the server spells it, mutating; the roles
  that hold `office-inbox.manage` — the server's other "staff at an office" key — hold it in the mock.

#### The checks it had to satisfy

| Check | Change | Result |
| --- | --- | --- |
| `check:wire-adoption` | none — `toWireNewsWrite` and `toWireNewsPatch` (`NewsWriteWire`, `NewsPatchWire`) held to the forms `NewsWrite` and `NewsPatch` declare; the pin `{}` | 31 of 31 bodies |
| `check:routes` | none | 21 endpoints and 58 composed requests served at their verbs |
| `check:response-shape`, `check:query-params` | none | 27 of 27 reads; the list a cursor page, the categories a bare `list`, one article an `item` through `optionalItem`, the cover `binary` |
| `check:consumer-contract` | regenerated | 50 interactions, 259 required fields |
| `check:port-adoption` | none | 200 of 211 port methods reached; the eight new ones each by a screen, the 11 unreached unchanged |
| `check:unserved` | none | 31 ports, 18 unserved; 58 routed screens, 26 menu entries |
| `check:permission-parity` | none | 42 of 52 guards unreachable, the ceiling held |
| `check:access` | one matrix row | 83 permissions × 7 roles |
| `check:newsfeed` | none — the newsfeed module is untouched and still passes | — |
| `check:bundle` | the seed's article titles, `SAMPLE BALITA - `, are a seed marker | — |
| `check:balita` | new, in `verify` — eight rules, see `docs/balita/README.md` | sixteen plants, each caught, every file restored |

A fix rode beside this part (`bd60a32`): the digital IDs page's drawer was never opened and its
panel sat outside the drawer's body slot, so "Open the card" showed nothing; the panel's own tests had
built it directly. It is opened now, and a page-level test opens a card from the list.

### 3. The app's audit trail

`GET admin/audit` (cursor-paged, newest first; `audit.view`, administrators alone). One new port,
`platform-audit`, served in the http set. One route, `/app-audit`, beside — not replacing — the
governance audit page, which stays unserved. Described in
[`docs/platform-audit/README.md`](../platform-audit/README.md); the decisions are these.

- **A row is six things, and the screen shows those six** (`DL-114`). Who acted, what they did, to
  which record, when. The API keeps no earlier or later value and no reason; `PlatformAuditEntry` has
  no field that could hold one, the mapper reads exactly the six fields, and the page says so above
  the table.
- **Ids as given, nothing looked up beside them.** The actor and the record are shown by id. The page
  injects one port, so no name, email or record is fetched to decorate a row and the trail discloses
  nothing it does not hold. The screen's spec provides only that port, so a page that looked anything
  up would not build.
- **The action in words, the code either way.** All thirty-three codes the API records at `2736e28`
  have a sentence; a code this console does not know is shown as given and said to be undescribed,
  never dropped or guessed at.
- **Not the governance trail.** Its own model, port and route; `check:platform-audit` fails if the
  module names `GOVERNANCE_REPOSITORY`, `AuditRow` or `AuditEntryDetail`.
- **`audit.view` is a key both vocabularies already shared.** The server gives it to administrators
  alone. In the mock the head and the auditor keep it for the governance page, where `DL-114` put it,
  so in `local-mock` they open this screen as well; against the API only an administrator receives
  it. Taking it from them would have broken the governance doctrine to make a mock match; recorded
  here instead, and the easiest choice to reverse.

#### The checks it had to satisfy

| Check | Change | Result |
| --- | --- | --- |
| `check:routes` | none | 22 endpoints and 59 composed requests served at their verbs |
| `check:response-shape`, `check:query-params` | none | 28 of 28 reads; the trail a cursor page, `limit` and `cursor` declared |
| `check:consumer-contract` | regenerated | 51 interactions, 263 required fields |
| `check:port-adoption` | none | 201 of 212 port methods reached; the one new method by the screen, the 11 unreached unchanged |
| `check:unserved` | none | 32 ports, 18 unserved; 59 routed screens, 27 menu entries |
| `check:permission-parity` | none | 42 of 53 guards unreachable, the ceiling held |
| `check:access` | none — `audit.view` was already a key and a matrix row | 83 permissions × 7 roles |
| `check:bundle` | the seed's row ids, `audit-sample-`, are a seed marker | — |
| `check:platform-audit` | new, in `verify` — seven rules, see `docs/platform-audit/README.md` | ten plants, each caught, every file restored |

### Not done, and whose it is

- **The backend items** in `docs/integration/node-api-migration.md`: no reason kept for an act on a
  digital ID; no way to lift a suspension; no list of cards; no photo can be chosen; no list of Balita
  drafts; no description of a cover; a category or cover that cannot be removed; an audit trail with
  no filter, no values and no reasons. Each is the backend's to fix; each screen says so meanwhile.
- **Not run against a live API**: built and tested against the vendored spec and composed fixtures.
- **Step 6 is complete.** Every staff route the Node API serves has a screen. The eighteen casework
  ports remain unserved, and whether the API grows casework or those screens retire is the owner's
  decision (`DL-164`).
- `CLAUDE.md` §3 lists `check:digital-ids`, `check:balita` and `check:platform-audit`.

The launch gate stays **NO-GO**: the eighteen unserved casework ports are unchanged. `npm run verify`
ran once on Windows after this part: lint, typecheck and every check green; 132 spec files, 2,081
tests (123 and 2,017 before `DL-171` — nine new spec files: the digital ID and Balita domains, mappers and
mock adapters, and the three screens (the audit trail's domain, mapper and mock are covered by its
adapter and screen specs); the HTTP adapters, the fixtures, the identity, the layout and the unserved modules gained
tests in their own). One test timed out under the full suite's load — `events.spec.ts`, untouched by
this entry, 5.8 s against a 5 s limit — and passed alone; the build and `check:bundle`, which `verify`
runs after the tests, were run after it and are green.

## DL-172 — the first real host showed an unstyled console: a nonce TAB 13 named and nobody built

The staging console on LGUIDS-SHARED-LINODE loaded with no component styling. The policy is
`style-src 'self'` with no `'unsafe-inline'` (rightly), and Angular injects component styles as
`<style>` blocks; netlify.toml has said since TAB 13 that "the sanctioned answer is `ngCspNonce`
with a per-response nonce", but nothing ever supplied one. Every earlier check ran without the
policy in front of it — the unit tests, the bundle check, and the walkthrough recording, which
was served by a plain static server — so the gap only showed on the first host that sent the CSP.

**Staging is fixed the sanctioned way.** Its Caddy fills `ngCspNonce` on `<app-root>` with the
request's own id (`templates`, `{http.request.uuid}`) and adds `'nonce-…'` to `style-src` in the
same response. Checked in a browser: three `<style>` blocks, all carrying the nonce, the sign-in
button styled, zero CSP violations. Still no `'unsafe-inline'`. The recipe is in taytay-backend
`deploy/staging-shared-linode/`.

**Netlify production is not fixed yet.** A static host cannot mint a per-response nonce; it needs
an Edge Function that rewrites the attribute and the header together. Until one exists, a
production deploy from this repository renders unstyled. Recorded as a launch blocker.

*Closed by `DL-206` (11 November 2026): the edge function exists, and Netlify serves the staging
console with it.*

**`base-uri 'none'` → `'self'`.** The same browser run reported one more violation: `index.html`
carries `<base href="/">`, which `'none'` refuses, so a reload on a deep path resolved the
script URLs relative to that path and fetched the shell instead of JavaScript. `'self'` admits
the app's own base and still refuses a base pointing anywhere else — which is what the directive
is for. `check:headers` requires the directive, not a value, and still passes.

## DL-173 — the server decides the office's roles: casework keys and a scope on `/me`, an office role on Users and roles

Phase 1a of the casework the owner's delegate decided on 6 November 2026
(`docs/integration/node-api-migration.md`, "Decided 2026-11-06"). Until now the Node API had two
staff roles, `staff` and `admin`, and fifteen platform capabilities; the console's casework screens
are written against seven office roles and 69 more keys that nobody could hold. Client checks are
never the boundary (CLAUDE.md §2.4), so the roles had to be decided where they are enforced. The
backend was changed first, at `taytay-backend` `7996668`, and that spec is the one vendored here.

### What the server now decides

- **An office role, beside the tier.** `users.office_role` holds one of this console's role ids for a
  `staff` account, and `scope_barangay_id` names a barangay link's barangay. `role` stays the
  authentication tier. The database refuses an office role off the staff tier, a stored
  `system-administrator`, and a barangay on any role but `barangay-link`.
- **The role table is the server's.** `src/auth/casework.ts` is a deliberate copy of
  `ROLE_DEFINITIONS` less the fifteen platform keys, which keep their own rule (tier and office).
  Its test parses this repository's `permission.ts` when the two are checked out side by side and
  fails on any difference in a role, a key or a scope. **A change to `ROLE_DEFINITIONS` is therefore
  a change to the backend as well**, or the backend's suite goes red. Here the table stays what it
  was before `DL-165` said it was: documentation, the mock's fixture, and the office's reference.
- **`GET /me`** carries `permissions` = the tier's platform capabilities + the office role's casework
  keys (the spec's new `Permission` enum, 84 keys), `office_role` (`system-administrator` for an
  administrator), and `scope` with `scope_barangay_id`. An administrator holds every key and
  `all-barangays`; a staff account with no office role holds no casework key and `assigned-cases`.
- **`PATCH admin/users/{id}/office-role`**, administrators alone, never one's own account. The reason
  is required and kept with the change in an append-only `office_role_changes` table, in the same
  transaction; the audit trail gets `user.office_role_changed`, which the platform audit screen now
  says in words. Refused: a non-staff or closed account, `system-administrator`, a barangay rule,
  and any role whose keys would hold both `request.approve` and `release.release`.
- **Separation of duties is the server's too.** The backend asserts the same pair as
  `permission.spec.ts` against every assignable role, the route re-checks it, and a test proves no
  assignment through the route produces an account holding both.
- **Leaving the staff tier clears the office role** in the same act, and records the cause; it does
  not come back if the account becomes staff again. Approval rights do not return on their own.
- `requirePermission(key)` beside `requireRole`, for the casework routes phases 2–6 will add.

### What the console now does

- **The scope is read, never computed** (`me.mapper.ts`). `scope` and `scope_barangay_id` are taken as
  sent; a missing or unknown scope, or `own-barangay` naming no barangay, reads as `assigned-cases` —
  failing closed, as `DL-133` does with keys. `AuthenticatedUser.barangayId` is the barangay the
  account may *see*; the home `barangay_id` is still not read.
- **The office role labels the account.** `roles` carries the office role first, so a Node
  administrator is now shown as "System administrator". This supersedes `DL-166`'s `null` for
  administrators: that was right while the server named no console role, and it now names one.
  Nothing decides from it.
- **Users and roles gains an office role section** (`AccountOfficeRole`), its own component because
  it is the one change on that screen that asks why. Offered only for a staff account, never the
  reader's own, under `user.change-role` (the server guards it as it guards the account role, so no
  new key). It lists the six assignable roles with each role's description and scope, then what the
  server does (`OFFICE_ROLE_EFFECTS`, `OFFICE_ROLE_ALWAYS`), then the reason box, then the one button.
  A barangay link is offered the API's own barangays (`GET barangays`, read whole), not
  `TAYTAY_BARANGAYS`, whose ids are this console's. Its outcome is said in the panel's existing live
  region, so `check:hardening`'s cap of twelve holds.
- **The role change's effects were read again**: becoming staff grants no casework permission until an
  office role is given; leaving staff clears the office role and it does not come back.

### Choices made here, each the easiest to reverse

1. **`system-administrator` is never given to a staff account.** The console exempts it from the
   separation-of-duties test because it is the administrator; given to a staff account it would hold
   approval and release together. It is the `admin` tier, and `/me` says so.
2. **An office role does not narrow the platform keys.** A staff account at an office still holds
   `news.write` and `office-inbox.manage` whatever its office role, as before. The console's table
   withholds both from the auditor and the barangay link; the server's platform rule does not. **For
   the owner to decide** whether an office role should narrow them.
3. **`audit.view` stays the platform audit trail, administrators alone.** The head and the auditor
   hold it in this table for the governance page (`DL-114`, `DL-171`), which has no server; against
   the API they hold `audit.view-detail` and not `audit.view`.
4. **Every casework key is published now, before its routes exist.** A guard asking for one is
   holdable from today; its screen stays closed by `servedGuard` until its phase serves it, and
   `check:unserved` is unchanged.
5. **An unchanged assignment records nothing**, and the reasons have no read route yet: they are
   kept for accountability and are not shown to the account holder.

### The checks it had to satisfy

| Check | Change | Result |
| --- | --- | --- |
| `check:permission-parity` | re-pointed from `StaffCapability` to `Permission`, which `/me` now carries; also fails if `Permission` drifts from `StaffCapability` + `CaseworkPermission` | **42 → 0** of 53 guards unreachable, against 84 keys; three plants, each caught |
| `check:accounts` | rule 1 admits `scopeBarangayId` and nothing else; rule 8 new — own account asked first and refused by `save`, effects then reason then one button, the change sent through `toWireOfficeRoleChange`, no `system-administrator`, the reason said to be kept | nine plants, each caught, every file restored |
| `check:consumer-contract` | regenerated | 53 interactions, 265 required fields |
| `check:hardening` | the office role speaks through the panel's live region | 12 live regions, the cap held |
| `fixtures.spec.ts` | reads `oneOf` as `anyOf`, so `office_role` and `scope` are held to their schema rather than waved through | — |
| `check:routes`, `check:wire-adoption`, `check:response-shape` | none | the two new requests served at their verbs, the body declared, `barangays` read with `list` |

## DL-174 — the resident registry is served: redacted by the server, read a cursor page at a time

Phase 1b of the casework decided on 6 November 2026 (`docs/integration/node-api-migration.md`,
"Decided 2026-11-06"), and the end of phase 1a. Backend `taytay-backend` `a4fa8d9` (office roles
narrow the platform keys), `ee83617` (a test that followed from it) and `6544381` (the registry);
the spec vendored here is `6544381`'s.

### Phase 1a, finished as the owner decided (supersedes `DL-173` choices 2 and 3)

- **An office role narrows the fifteen platform keys.** A staff account with an office role holds
  only the platform keys `ROLE_DEFINITIONS` gives that role — still only while it has the office
  `news.write` and `office-inbox.manage` need. The auditor and the barangay link hold neither; the
  head and the auditor hold `audit.view`. A staff account with no office role keeps the tier's keys.
  No office role holds `household.view-counts`, which this console has no word for; the backend's
  parity test now compares the platform keys with this table too, and fails on any difference but
  that one, which it names.
- **The routes check the key, not the tier.** News writes, `GET admin/audit`, `GET households`,
  `POST digital-id/verify` and the thread routes use `requirePermission`; a verified resident still
  opens their own threads. A staff account without `office-inbox.manage` is now **403** on the
  threads where it used to get an empty page — the inbox screen never asks without the key, and its
  "no office" sentence after an empty first page stays as a second line of defence.
- `audit.view` against the API is therefore the head's and the auditor's as well as the
  administrator's: the platform audit screen now opens for them, as this table always said.

### What the server now decides about residents

- **People the office serves, not app accounts.** `office_residents` holds what `ResidentDraft`
  types, PhilSys as the last four digits only (a column that could hold the full PSN is refused by
  its own check) and income as integer centavos. Sectors are an append-only history of acts —
  recorded and ended, each with an actor, a time and a reason — and current membership is the latest
  act. Retiring and restoring keep their reason. The database refuses `UPDATE`/`DELETE` of both
  histories and `DELETE` of a resident, whoever asks.
- **Redaction is the server's** (`DL-38`, now on the far side of the wire). Without
  `resident.view-sensitive` the PSN digits and the income are `null`; on a protected record without
  `request.view-sensitive` the protected sectors, contact and exact address are `null`, and **only
  the surname and the initial of the given name are sent** (`given_name_masked`). `withheld` and
  `is_protected` say what was held back and why.
- **The keys are this console's**: `resident.view`, `resident.create`, `resident.update`,
  `resident.deactivate`; recording or ending `vawc-survivor` or `cicl` also needs
  `request.view-sensitive`, refused before the record is read.
- **Scope**: `own-barangay` reads its barangay and answers elsewhere as not found (`DL-31`), and a
  filter, a new record or a move outside it is refused. **`assigned-cases` — the social worker — is
  refused on every registry route**: a caseload is decided by case assignment, the API holds no cases
  yet, and either guess is wrong. The mock serves the social worker the whole registry; against the
  API that screen shows the server's sentence. **For the owner**: whether a social worker should read
  the whole registry until cases exist.

### What the console now does

- **`HttpResidentRepository`** replaces `UnservedResidentRepository`, and `resident` leaves
  `UNSERVED_PORTS` (seventeen remain). Every read goes through `resident.mapper.ts`, which applies no
  disclosure rule of its own — a second copy of the rule is one that eventually disagrees — and every
  write body through `toWireResidentDraft`, `toWireReason` or `toWireSectorRecord`: flat where the
  draft nests, centavos as `Money` holds them, no sectors and no household.
- **Barangays are joined by name.** The API keys a barangay by its own id; the screens use
  `TAYTAY_BARANGAYS`. `GET barangays` is read once per adapter and the two are joined on the name. A
  barangay whose name matches none refuses the record rather than placing a person somewhere else.
- **`getProfile` makes no request.** A profile is a resident with their household, families and
  assistance history, none of which the API serves; an empty history would say the office never
  helped them (`DL-112`). It refuses in the unserved sentence, and every screen that reads it is
  withheld already.
- **The port changed in two places.** `list` takes a `CursorRequest` and answers a `CursorPage`: the
  API pages by cursor, sends no total and orders the registry itself, alphabetically by surname. The
  list shows "20 shown. More are available." and a "Show more" button, never "page 2 of 9"
  (`DL-161`); page and sort left the URL, which keeps only the filter (`DL-36`); the picker asks for
  the first matches. `setActive` takes a **reason**, asked for in the retire and restore
  confirmations and required before the button acts.
- **The mock was brought to the server's rules** so a screen is not built against a looser boundary:
  search matches names only, every word, and never a protected given name the reader is shown only
  as an initial (it used to match street, barangay and mobile — a match on a field discloses it,
  `DL-109`); a protected-sector filter without `request.view-sensitive` is refused (it used to list
  the masked members of the sector, which is the disclosure itself); a barangay filter outside the
  account's scope is refused rather than answered with an empty page; a PSN or income from a writer
  without `resident.view-sensitive` is refused, and the form no longer offers those two fields to
  such a writer; the order is the server's. The list offers the protected sectors as filters only
  to a reader cleared for them.

### Where the API's model differs from this console's, recorded rather than smoothed

1. **No household.** `Resident.householdId` is `null` from the API, and a household filter is refused
   in words before any request: households are a later phase.
2. **The masked given name is an initial on the record itself**, where the mock kept the full name
   and masked only the display strings. A template printing `resident.name.first` gets "R".
3. **Street is always recorded**, so a masked record always lists `exactAddress` as withheld; the mock
   lists it only when something was on file.
4. **Ending a sector that is not held is a 409** on the API and a quiet no-op in the mock; recording
   one already held is answered as done by both.
5. **The reasons are kept by the API and dropped by the mock**, which has no history to hold them —
   the same thinness the mock already recorded for sectors.
6. **A barangay link's scope is still the API's barangay id** (`DL-173`), while resident records are
   read in this console's ids. Nothing on a reachable screen compares the two yet; the first screen
   that does must join them the same way.

### What is still withheld in the `http` configuration, and why

Serving the port does not by itself bring the screens back, because `check:unserved` holds every
screen to every port it reads: **the Residents list also reads `saved-view`** (its saved-views bar)
and **the resident record reads `family` and `field-visit`**, all unserved. So the Residents menu
entry stays withheld; `/residents/new` and `/residents/{id}/edit` are no longer withheld, but no
menu entry leads to them and saving one navigates to the record, which is. **For the owner**: serve
saved views (phase 6 brought forward) or decide the list may stand without its bar against the API —
either brings the list back. This commit does neither, because the check is right that a screen
reading an unserved port can fail.

### The checks it had to satisfy

| Check | Change | Result |
| --- | --- | --- |
| `check:routes` | `UNSERVED_CEILING` lowered 18 → 17 | every new request at a real route and verb |
| `check:unserved` | the resident binding and declaration removed together | 17 unserved, all declared; 59 screens guarding what they read |
| `check:wire-adoption` | three new `toWire…` mappers, called at each request | 38/38 bodies mapped and declared |
| `check:response-shape` | `office/residents` read with `cursorPage`, one with `optionalItem`, `barangays` with `list` | 32/32 |
| `check:query-params` | `q`, `barangay_id`, `sector`, `age_group`, `include_inactive`, as the operation declares | 32 reads |
| `check:mapper-adoption` | every read through `resident.mapper.ts` | 0 typed calls |
| `check:consumer-contract` | regenerated | 62 interactions, 273 required fields |
| `fixtures.spec.ts` | `office-residents-page.json` and `office-resident.json` held to their schemas | — |

## DL-175 — saved views, households and families are served; only a module's primary port gates its menu entry

Phase 1c of the casework decided on 6 November 2026 (`docs/integration/node-api-migration.md`).
Backend `taytay-backend` `013d74c` (saved views, the office household register, families),
`154a052` and `0c19dd2` (a protected person's address is not given away by the people she lives
with); the spec vendored here is `0c19dd2`'s.

### What the server now decides

- **Saved views** (`/api/v1/office/saved-views`, `DL-110`, `DL-111`). Reading one costs the key of
  the list it opens; a shared view costs `saved-view.share` to save or take away; somebody else's
  personal view is never acknowledged (404); a view of a protected sector needs
  `request.view-sensitive` to save and is not listed without it. The list is answered whole — an
  account keeps at most 50 views per list and the office 50 shared — so it is never mistaken for a
  first page. A view is taken away, never deleted or edited.
- **The office household register** (`/api/v1/office/households`). Registry residents grouped by
  address, recorded by staff. **Not the residents' app households** (`/api/v1/households`, the app's
  accounts grouping themselves by invitation), which share no table and no route with it and were
  not touched. One household per person and one head per household are unique indexes; membership
  changes are the console's intents (`MembershipChange`), applied all or none under row locks and
  refused with the console's `HouseholdProblemCode`s as `details` keys; every act — registering,
  each membership change, each correction and its withdrawal — is appended with its reason to a
  history the database refuses to rewrite.
- **The vulnerability snapshot is computed by the server** from the unredacted member records, a
  port of `computeVulnerability` with the PSA threshold's provenance sent beside it (`DL-46`), and
  only then disclosed, so every role reads the same band (`DL-44`). It stays advisory evidence
  (`DL-42`): no score, no total, nothing reads it to set anything, and `is_indigent` is recorded by a
  person. `check:vulnerability` holds on this side; the server's answer carries no decision-shaped
  field.
- **Families** (`/api/v1/office/families`, `DL-47`, `DL-48`). Members as periods (joined, left; never
  deleted, never reopened), a household or none, several families at one address. Relationships
  resident to resident in one canonical direction, ended and never deleted; recording one already
  standing answers with it (`DL-51`); a reversed parent link is refused. A transfer is one act, the
  household following only on request, and a transfer that already landed answers quietly. Every act
  is appended with actor, time and reason.
- **Scope and redaction are the resident registry's** (`DL-174`), from one shared copy of its
  reader: `own-barangay` sees its barangay and nothing else answers but "not found", `assigned-cases`
  is refused. A family between addresses is in a barangay link's scope only while every current
  member lives there. Members are the registry's redacted records.

### Disclosure the console did not have before, now on both sides of the seam

1. **A protected household withholds its address.** A household with a member under `vawc-survivor`
   or `cicl` withholds its street and purok from a reader without `request.view-sensitive`, and is
   not matched on them: that address is where the protected person lives, and the resident record
   already withholds it. `HouseholdSummary`/`HouseholdDetail` gain `withheld` (`exactAddress`,
   `monthlyIncome`) and `isProtected`, and the screens say "withheld", never a blank (`DL-38`).
2. **So does everybody who lives there.** The household's own address was withheld while every
   other member was listed with their own record — whose street is, as a rule, the same street.
   Beside the masked member, the mother's address said where the daughter lives. Every member's
   street and purok are now withheld from that reader, on a household with a protected member and on
   a family with one **or living in a household that has one** (a second family at her address lives
   on her street too). Found by this console's adapter work, fixed on the server (`154a052`,
   `0c19dd2`) and mirrored in both mock adapters.
3. **The household's income is means**, behind the same key as a resident's: without
   `resident.view-sensitive` it is withheld, so are the two income factors, and recording one needs
   the key. `discloseSnapshot` takes a clearance `{ protected, means }`; a withheld factor reads
   `origin: 'computed'`, so it does not say that somebody corrected it. The band is not recomputed.

### What the console now does

- `HttpSavedViewRepository`, `HttpHouseholdRepository` and `HttpFamilyRepository` replace their
  `Unserved…` adapters; `saved-view`, `household` and `family` leave `UNSERVED_PORTS` (fourteen
  remain). Every read goes through a mapper with no disclosure rule of its own, every body through an
  explicit `toWire…`. The family graph is assembled from the API's members and relationships with
  the domain's own `assignGenerations`/`fromPerspectiveOf`, as the mock assembles it.
- **Both lists read a cursor page**, ordered by reference number by the server, saying "more are
  available" and never a page count (`DL-161`); sort headers the server cannot honour are gone.
- **A household and a family can be recorded**: `HouseholdRepository.create` and
  `FamilyRepository.create` (with a reason), each with a routed form behind its manage key. Without
  them the served lists could only ever be empty.
- **The resident profile is read over the API**: the resident, the household they live in and its
  members. The assistance history is `{ kind: 'unavailable' }` with a sentence saying it is not
  connected yet and is not a statement that the office never helped them (`DL-112`):
  `ResidentProfile.history` became a read/unavailable union like `HouseholdComposition`.
- **"Make head" asks for a reason.** It sent a fixed sentence, "Recorded from the family record.",
  which the API would keep in the family's history for good as if somebody had said it (`DL-48`).
- The platform audit trail words the eleven new audit codes.

### Only a module's primary port gates its menu entry (narrows `DL-167`)

`DL-167` withheld every screen that read any unserved port, which kept the Residents menu entry
withheld for its saved-views bar and the record's field-visit panel. Now a route's `servedGuard` lists
its **primary** ports — the ones the screen cannot work without — and a **secondary panel** whose port
is unserved **degrades in place**: no request is made, and `<app-not-connected>` says, where the panel
would be, that the office's API does not serve it, which is not a statement that there is none.
`ServedPorts.serves()` answers the question; the sentence is composed once, from
`DATA_PORT_HOLDINGS`, in the domain.

`check:unserved` rule 3 now holds every routed screen to: what it reads equals what it guards plus
what it degrades; nothing both; a port counts as degraded only where a file of the screen calls
`serves('<port>')` **and** that component's template renders the notice for it; a degraded port the
screen does not read, or a notice with no `serves()` behind it, fails; and **a screen that reads
ports must guard at least one** — a module whose every panel is optional is one whose menu entry can
lead to nothing. Rule 4 is unchanged (a menu entry reads exactly what its route guards), so the menu
is gated by the primary ports alone. Validated against planted regressions: dropping `serves()`,
guarding and degrading the same port, a list degrading its own primary port and guarding none, a
`serves()` with no notice, and a degraded port the screen does not read — each fails.

In the `http` configuration **Residents, Households and Families are all in the menu.** The resident
list degrades nothing now that saved views are served; the resident record degrades its field-visit
panel in place (and its family panels, should `family` ever be unserved again).

### Where the API's model differs, recorded rather than smoothed

1. **A family's relationships are those among its own members.** A link to somebody in another
   family (a grandmother recorded in the parents' family) is drawn by the mock and not over the API.
2. **No household or family is changed after it is recorded** except through membership: the API
   has no route to change a household's address, income or classification, or to dissolve a family.
3. **A retired resident can still be added to a household**; neither side refuses it.
4. **Two heads in one family are allowed**, as the console's few-rules doctrine says (`DL-49`); the
   server dropped a "several heads" refusal it had on creation for that reason.

### For the owner

- Whether the barangay link should see a family between addresses only when every member lives in
  its barangay (the choice made; the mock showed such a family to everybody).
- Whether a household's income should be means-tier as decided here — the mock showed it to every
  `household.view` holder, including the release officer and the auditor.
- Whether an office needs to correct a household's address or income, or dissolve a family, through
  the console; neither is possible yet.

### The checks it had to satisfy

| Check | Change | Result |
| --- | --- | --- |
| `check:unserved` | rule 3 rewritten: a screen guards its primary ports and degrades the rest in place; the saved-view, household and family bindings and declarations removed together | 14 unserved, all declared; 61 routed screens guarding their primary ports; 2 screens degrade 3 secondary panels in place |
| `check:routes` | `UNSERVED_CEILING` lowered 17 → 14 | 27 endpoints, 87 composed requests, each at a real route and verb |
| `check:response-shape` | the three adapters' reads | 42/42 (was 32/32) |
| `check:wire-adoption` | every new body through a `toWire…` | 48/48 (was 38/38) |
| `check:port-adoption` | `create` on both ports, each reached by its form | 11 of 216 unreached (was 11 of 214) |
| `check:query-params` | `resource`; the household and family list filters, as the operations declare | 42 reads (was 32) |
| `check:consumer-contract` | regenerated | 79 interactions, 348 required fields (was 62, 273) |
| `check:permission-parity` | the new keys' routes | 0 of 55 disagree |
| `check:contract-drift` | vendored `0c19dd2` | 130 operations |
| `check:vulnerability` | `discloseSnapshot` takes a clearance; nothing decision-shaped added | passed |

## DL-176 — programmes are served: the catalogue as records, its rules on the server, utilization said to be not connected

Phase 1d of the casework, the last of phase 1 (`docs/integration/node-api-migration.md`). Backend
`taytay-backend` `f887038`; the spec vendored here is `f887038`'s.

### What the server now decides

- **Programmes are records** (`/api/v1/office/programs`, `DL-66`): name, category, status,
  description, legal basis, funding source, a maximum grant in integer centavos, the structured
  eligibility parameters (read by nothing on the server), the responsibility record, guidance,
  documents, an optional review window, effective dates. The reference (`PRG-0001`) is issued by the
  server and means nothing; `check:programs` still holds every screen to never branching on it.
- **Whose programme it is** (`DL-65`): a national programme recorded as `owner`, an `augmenter`
  where neither the agency nor the fund holder is `lgu-taytay`, and a national programme with no
  source are refused by the route **and by `CHECK` constraints**, so no path to the table records
  them. A statement under twenty characters is refused too. AICS is a DSWD programme with
  DSWD-disbursed funds; the development seed's AICS sample says so.
- **Guidance never gates** (`DL-66`): three weights, none of which refuses anybody; strict bodies
  refuse any field the schema does not name, so a `blocks`, `score` or `eligible` cannot be stored.
- **Documents** (`DL-76`): `required`, `optional` or `conditional`, a conditional one with its
  circumstances in words that nothing evaluates. A conditional document without them, or
  circumstances on one that is not conditional, is refused.
- **Refusals name the console's own rules.** A 422 whose `details` keys are
  `responsibilityProblems`, `guidanceProblems`, `reviewWindowProblems` and `templateProblems` codes,
  plus `condition-without-circumstances` and `circumstances-without-condition`, each with a
  sentence. A change is checked against the record as it would stand, under a row lock.
- **Every version is kept whole** in `office_program_revisions`, appended in the same act as the
  change, and the database refuses to rewrite it or to delete a programme: a request decided under
  last year's wording stays explicable. Audit `office_program.created` / `office_program.updated`.
- **No scope narrows the catalogue.** It holds no personal data, so `program.view` reads it whole —
  the social worker, refused the registry while cases are not served (`DL-174`), reads programmes,
  and so does the barangay link. `program.manage` writes (the head and the administrator).
- **No status transition rule** — the console states none for a programme, and none was invented.
  Moving to `closed` dates `effective_to`; moving away clears it. The mock never set it.
- **Templates are read under their programme**, whole (`DL-67`). No route writes one: the
  development seed is the only source, so in production a programme lists its own documents.

### Utilization is not served, and the screens say so (the choice)

Utilization is counted from releases (`DL-69`, `DL-159`), which the API does not hold until phase 4.
Of the two honest options — leave it unserved and say so in place, or have the server answer an
explicit "not available" — the first was chosen: an endpoint whose only answer is "not available"
would fix a shape before the figures and their small-cell suppression (`DL-105`) exist to design
it from, and phase 4 can add the route and the adapter read it without touching a screen.

So `utilizationFor` and `utilizationSummary` answer a reading — `{ kind: 'read', … }` or
`{ kind: 'unavailable', because }` — as the resident's assistance history does (`DL-175`). The
http adapter answers `unavailable` with `PROGRAM_UTILIZATION_NOT_CONNECTED` and asks the API
nothing. The list drops its two utilization columns and states the sentence above the table — a
column of dashes would read as "nothing handed over"; the record states it in place of the figures.
Never a zero: a zero says the programme delivered nothing, which is the finding that gets it closed.
The mock still computes figures and answers `read`.

### What the console now does

- `HttpProgramRepository` replaces `UnservedProgramRepository`; `program` leaves `UNSERVED_PORTS`
  (thirteen remain). **Programmes is in the menu** in the `http` configuration. Intake, assessment
  and the beneficiary list also read `program` but stay withheld for their own primary ports.
- **`ProgramRepository.list` reads a cursor page** by name (`CursorRequest` → `CursorPage`), with
  "show more" and "N shown", never a page count, as the registry lists do (`DL-161`, `DL-174`).
  `listActive` reads in full through `everyPage`: a picker missing a programme tells an intake
  officer the office does not run it. A one-letter search is refused with a sentence, unsent.
- `save` sends the **whole draft** through `toWireProgramDraft`, `POST` or `PATCH`; the server's
  refusal reaches the form as its message.
- The mapper refuses a programme whose responsibility, a guideline, a document or its review window
  cannot be read, rather than default it: a defaulted responsibility could show a DSWD programme as
  the municipality's, and a dropped document asks an applicant for less than the office does.
- Copy: the empty catalogue no longer says "Add a programme" — no form in this console records one —
  and the utilization column reads "Releases", which is what it has counted since `DL-159`.
- The platform audit trail words the two new codes.

### Where the API's model differs, recorded rather than smoothed

1. **No programme can be created from the console.** `save(draft, null)` is served (`POST`), and
   no screen calls it; the record screen edits an existing programme. Against the API the catalogue
   is therefore empty until a form exists or programmes are recorded another way; `npm run
   dev:memory` and the development seed add three samples named "(sample)".
2. **The console edits part of the record** — name, description, status, funding, legal basis,
   ceiling and the responsibility's agency, fund holder, role and statement. Guidance, sources,
   documents, the eligibility parameters and the review window cannot be changed from it.
3. **Templates have no editor and no write route.**
4. **Revisions are kept but not readable** through the API; the console has no screen for them.

### For the owner

- Whether the console should get a "new programme" form, with guidance, sources and documents.
  Without one, the catalogue the API serves can be filled only by the seed or by direct API calls.
- Whether requirement templates need an editor (a route and a screen), or stay seed-only.
- Whether a programme's status needs transition rules — `closed` terminal, for instance. None is
  stated in the console, and none was invented.
- Whether a change to a programme should carry a reason. The console asks none; the revisions keep
  who, when and what the record said, not why.
- Utilization arrives with releases (phase 4).

### The checks it had to satisfy

| Check | Change | Result |
| --- | --- | --- |
| `check:unserved` | the programme binding and declaration removed together | 13 unserved, all declared; 61 routed screens guarding their primary ports |
| `check:routes` | `UNSERVED_CEILING` lowered 14 → 13 | 28 endpoints, 92 composed requests, each at a real route and verb |
| `check:response-shape` | the programme reads | 46/46 (was 42/42) |
| `check:wire-adoption` | both writes through `toWireProgramDraft` | 50/50 (was 48/48) |
| `check:port-adoption` | the port's seven methods, each reached | 11 of 216 unreached (unchanged) |
| `check:query-params` | `q`, `category`, `status` | 46 reads (was 42) |
| `check:consumer-contract` | regenerated | 84 interactions, 413 required fields (was 79, 348) |
| `check:permission-parity` | `program.view`, `program.manage` | 0 of 55 disagree |
| `check:contract-drift` | vendored `f887038` | 135 operations (was 130) |
| `check:programs` | nothing branches on a programme; no verdict on the port | passed |

## DL-177 — assistance requests are served: intake, filing and the lifecycle; programmes get an editor

Phase 2a of the casework (`docs/integration/node-api-migration.md`). Backend `taytay-backend`
`54c68f0` (the programme editor) and `cf42d64` (assistance requests); the spec vendored here is
`cf42d64`'s. Console `ddf9b13` (the programme editor) and `91ab104` (assistance requests).

### Part 1 — the programme editor (owner-approved; answers `DL-176`'s first, second and fourth questions)

- **A programme's change says why.** `POST`/`PATCH office/programs` require a `reason`, kept beside
  the version it explains in `office_program_revisions`; a reason alone is refused. Revisions written
  before reasons were asked for keep none — null says so rather than inventing one — and the
  database refuses any new revision without one.
- **Requirement templates are written by people** (`/api/v1/office/requirement-templates`): listed
  whole (at most 200, retired ones included), created, changed and retired, each act with a reason
  kept with the template whole in an append-only history; refused by the console's
  `TemplateProblemCode`s plus the two halves of a conditional document (`DL-76`). **Retiring is one
  way**: no new programme adopts a retired set, and one that already names it keeps asking for its
  documents through any other change — retiring never quietly changes what an applicant is asked
  for. `program_count`, counted when read, says how many programmes a change would reach.
- **The console** has a routed "New programme" form for the whole `ProgramDraft` (guidance,
  sources, documents, eligibility parameters, review window), the domain's rules shown as the form
  is filled and enforced on save — a national programme is never offered as one the municipality
  runs (`DL-65`); the record's edit asks for a reason; and `/programs/templates` lists, creates,
  changes and retires templates. Every consequence is stated **above** its button (`DL-124`): the
  version and its reason are kept for good, a template change reaches the N programmes naming it
  from that moment, retiring is one way. The server's refusal reaches the form in its own words.
  The record's edit no longer disables its button; it acts, then says what is missing (as the
  household form does). `ProgramRepository.save` takes the reason; `listTemplates`, `saveTemplate`
  and `retireTemplate` join the port, each reached by a screen; the mock keeps every version with
  its reason and refuses what the server refuses.

### Part 2 — what the server now decides about assistance requests

- **The lifecycle is this console's**, held three times and compared by a test: the backend's
  `lifecycle.ts` for its routes, `office_request_statuses` and `office_request_transitions` for its
  database, and `assistance-request.ts`, `transition-permissions.ts` and the intake constants here,
  read without running them (as `casework.ts`'s role-table parity test reads `permission.ts`).
- **A move is an appended row.** Each status change is a row in `office_request_status_changes`
  with who, when and why (a reason is required on every move); a trigger checks it against the
  transitions table and only then sets the status. The database refuses any other write to the
  status, any change to the history, any change to what a filed request says, and any delete. Each
  move needs the key `TRANSITION_PERMISSIONS` names for the status moved into, so
  `request.approve` and `release.release` — never held together — keep the approver from releasing
  (`DL-08`).
- **A draft has no control number** (`DL-63`). `TAY-YYYY-NNNNNN` is issued at filing, once; a
  retried filing answers as it stands. Drafts are listed only when asked for (`status=draft`) and
  never among filed requests. The checklist is the **programme's** documents — template, then its
  own list — with the counter's answers applied by code; a code the programme does not ask for is
  refused.
- **Filing refuses a record, never an applicant.** `422` keyed by the console's own
  `IntakeProblemCode`s — `no-programme`, `no-reason`, `reason-too-short`,
  `missing-mandatory-requirement` (a required document, or a conditional one ruled to apply,
  neither presented nor excused with a reason; excusing is always open) — while the intake record
  does not yet say what happened at the counter. Nothing refuses on the strength of a signal.
- **The duplicate check decides nothing** (`DL-60`): `assessIntake`, ported — rule, finding and
  records read for each signal, tones `note` and `caution` only, no score, total, `eligible` or
  recommendation. A caution needs the encoder's sentence at filing, kept with who and when; a check
  that changed since it was read is `409`, so nobody acknowledges a caution they never saw.
- **Scope and redaction are the registry's** (`DL-174`), from the one shared reader: `own-barangay`
  reads its barangay and nothing else answers but "not found"; `assigned-cases` is refused on every
  route. A request whose person is under `vawc-survivor` or `cicl` withholds its **words** — the
  reason, the referral, the history's reasons, a waiver's remarks, its notes — from a reader without
  `request.view-sensitive`, and `withheld`/`is_protected` say so (`DL-38`); that reader cannot save
  over the draft. Notes keep the protected tier of `DL-58`.

### Decisions made here

1. **The advisory reads filed requests only** (changes `assessIntake`). A draft is not a request
   (`DL-63`); counted, the draft being filed flagged *itself* as an open request under the same
   programme, so a resumed draft could never be filed against the API (the console asked for an
   acknowledgement the server, which excludes the request being filed, then refused as
   "nothing flagged"), and an abandoned draft raised a caution for ever.
2. **The advisory names what it did not read.** `IntakeAdvisory.unread` (`releases`, `cases`, each
   with a sentence): three of the six signals are counted from payouts and cases, which the API does
   not hold yet, and their silence would read as "nobody at this address was helped" (`DL-112`).
   The panel renders them beside the signals; the mock reads both and answers none.
3. **Scheduling and releasing are refused** (`409`, a sentence) until payouts are served
   (phase 4): a request marked released with no record of what was handed over would be a claim
   that money moved which nobody could check, and the duplicate check would never see it. The
   transitions table is mirrored whole; this is a separate, named gate.
4. **`channel` and `referredBy` are on `AssistanceRequest`.** A resumed draft reset them to
   walk-in; against a server that keeps them, re-saving would have overwritten an encoded or
   referred intake.
5. **The request list reads a cursor page** (`CursorRequest` → `CursorPage`), filed requests
   newest filing first, "N shown. More are available." and "Show more", never a page count
   (`DL-161`); page and sort left the URL. Search matches the **control number only** — the mock
   matched the reason, which discloses it (`DL-109`).
6. **Notes are served read-only to the console.** The API appends a note (`case.note`, the
   protected tier needing `case-note.view-protected`), but the port has no write method and no
   screen reads notes, so the console makes no such request; adding one would grow
   `check:port-adoption`.

### What the console now does

- `HttpAssistanceRequestRepository` replaces `UnservedAssistanceRequestRepository`;
  `assistance-request` leaves `UNSERVED_PORTS` (twelve remain). **Requests and intake are in the
  menu** against the API. Every read goes through `assistance-request.mapper.ts` (no disclosure rule
  of its own; an unknown status refuses the record, an unknown signal code or tone is dropped as the
  domain says); every body through an explicit `toWire…`. Barangays are joined by name as the
  registry's are.
- **Phase 2b methods degrade in place**: `listAssessmentTemplates`, `openAssessment`,
  `answerAssessment`, `recordAssessment`, `reviewRequirement`, `recordDocument`,
  `decideApplicability`, `requestDocument`, `listDocumentRequests`, `withdrawDocumentRequest` and
  `openDocument` answer the unserved refusal and make no request. The request record shows the
  sentence where the assessment and the document review would be, and nothing else breaks — reads
  that went straight into `toSignal` (which rethrows on read) now go through view states.
- The record gains a **History** section (each move with its reason, or "withheld"), asks for the
  duplicate check only of a reader holding `request.create` (the auditor and the release officer
  were sent to the forbidden page by the API's `403`), and hides the document actions with the
  reason shown once while the document list cannot be read.
- Intake restores `channel`/`referredBy` on resume, says so instead of offering a form when a
  draft's words are withheld from the reader, and shows the server's refusal in its words. The
  drafts section reads "Unfinished intakes" (the server lists everyone's, not the reader's), and
  "Start an intake" and "Resume" are shown only to `request.create`.
- `check:intake`'s not-recorded rule no longer assumes an unserved binding: it reads the bound
  adapter's `recordAssessment` and accepts it only while it refuses without sending — validated by
  making it send a request (fails) and restoring it (passes).
- The platform audit trail words the five `office_request.*` codes and the three
  `office_requirement_template.*` codes.

### Where the API's model differs, recorded rather than smoothed

1. **Scheduled and released** are refused by the API (above); the mock, which holds releases,
   still moves to them. The record still offers the move against the API, and the server's
   sentence answers it.
2. **The social worker is refused** on every request route, as on the registry (`DL-174`); the mock
   serves them.
3. **The checklist is the programme's** on the API; the mock accepts what the screen sends.
4. **`recordsRead`** counts the person's own filed requests on the API and the office's in the mock.
5. **Fields the API does not hold** — the approved amount, the assignee, the assessment, decision
   remarks, a requirement's reviewer and applicability ruling — are `null` from the API, and the
   mock does not withhold them on a protected request. Which of them a protected request should
   withhold is a phase 2b question.
6. **A draft with no programme** keeps `programId: ''`, as the mock did, rather than widening the
   type.
7. **An abandoned draft** cancelled before filing is in neither list: it has no control number and
   is not a draft any more. It is still read by its address, and the mapper reads it — it refused
   every non-draft without a number until this entry was written, which would have shown cancelling
   a draft as a failure.

### For the owner

- Whether a social worker should read requests before cases exist (the same question as the
  registry's, `DL-174`).
- Whether an intake officer without `request.view-sensitive` should be able to start a request for
  a protected person (allowed: nothing is withheld from what they are writing) but not save over it
  afterwards (refused: they cannot read what they would overwrite).
- Whether a reason should be required on every status move (it is, on both sides) or only on
  returned, rejected, cancelled and expired.
- Whether retiring a requirement template should stay one way (the choice made), or be reversible.
- Whether the programme record's edit should become the full form (guidance, documents, review
  window are editable only when a programme is created).
- The review windows (`ASSISTANCE_LOOKBACK_MONTHS`, `SAME_PROGRAMME_WINDOW_DAYS`) are still
  conventions awaiting the office's confirmation (`DL-68`); the server holds the same figures.

### The checks it had to satisfy

| Check | Change | Result |
| --- | --- | --- |
| `check:contract-drift` | vendored `54c68f0`, then `cf42d64` | 149 operations (was 135) |
| `check:routes` | `UNSERVED_CEILING` lowered 13 → 12 | 30 endpoints, 105 composed requests (was 28, 92) |
| `check:unserved` | the request binding and declaration removed together | 12 unserved, all declared; 63 routed screens (was 61) |
| `check:response-shape` | the template and request reads | 53/53 (was 46/46) |
| `check:wire-adoption` | every new body through a `toWire…` | 57/57 (was 50/50) |
| `check:port-adoption` | three template methods, each reached | 11 of 219 unreached (was 11 of 216) |
| `check:query-params` | the request list and the advisory | 53 reads (was 46) |
| `check:consumer-contract` | regenerated | 97 interactions, 516 required fields (was 84, 413) |
| `check:permission-parity` | the new routes' keys | 0 of 57 disagree |
| `check:intake` | the not-recorded rule reads the bound adapter | passed; nothing decision-shaped |
| `check:programs` | nothing branches on a programme | passed |

## DL-178 — the rest of a request is served: assignment, the assessment, documents and what the applicant was asked for

Phase 2b of the casework (`docs/integration/node-api-migration.md`), which completes phase 2.
Backend `taytay-backend` `240803d`; the spec vendored here is its. Console `f3ac8d3`.

### Owner decisions implemented

1. **A request is assigned to a social worker for assessment**, with who, when and why, appended
   (`office_request_assignments`); the request's `assigned_to` follows that history and nothing else
   writes it. Assigning needs `request.assess` from an account that is not itself a caseload — the
   MSWDO head, an administrator; the list of whom to assign (`GET office/social-workers`) gives an id
   and a name, nothing more. **`assigned-cases` is served for the first time**: a social worker
   reads, moves, notes and works the filed requests assigned to them, and any other request answers
   as not found. Starting, saving and filing a request, the duplicate check (which reads the person's
   *other* requests), assigning and the resident registry stay refused to a caseload — "everything
   else stays refused". Cases join the caseload in phase 3.
2. **The programme edit page is the full form** — the same fields as New programme, a reason
   required, through the existing `PATCH` (which already took every field).
3. **The request page has a notes box**: the notes listed, and a note added with its tier
   (`DL-58`; `protected` offered only to `case-note.view-protected`). `DL-177`'s sixth decision —
   notes served read-only — is superseded.

### What the server now decides

- **The assessment** is the console's two forms, held by the server as fixed reference data and
  still marked `placeholder-pending-lgu-approval` (compared question by question with the seed). One
  is opened only while the request is in `assessment`, from the current version, pinned then and
  read once; one at a time — asking again answers with the one open. Answers are appended as a
  patch. Completing it records the findings (20 characters or more), the recommended amount, whether
  a home visit was made, and **the recommendation the assessor chose** — a reason required only for
  `recommend-deny`. Nothing derives a recommendation, and **completing moves the request nowhere**:
  endorsing is the transitions' move, as it was, and `assessmentReadiness` still gates nothing
  (`DL-60`). Because the API now takes the amount and the home-visit fact, `toWireAssessment` sends
  both and `check:intake`'s "dropped field declared on screen" rule stopped applying on its own, as
  it was written to.
- **What the office did about a document is a person's act, appended.** A filed request's
  checklist moves only by a row in `office_request_requirement_events` — presented, reviewed or
  ruled — whose trigger alone writes it (`0029` had frozen it whole at filing). `waived`,
  `rejected` and `needs-replacement` need words; only something presented can be anything but
  waived; a conditional document is ruled on with a reason and never evaluated (`DL-76`).
- **Versions are appended** (`DL-77`): replacing one supersedes the version in force with a required
  reason and keeps it; the database refuses a delete, an edit, a second supersession or a gap in the
  numbering. **A new version reads `submitted` again, whatever the last one's review was** — the
  mock had kept `verified`, which put an unchecked file under a checked status.
- **Files** are PDF, JPEG or PNG by their bytes and 10 MB at most — the domain's
  `DOCUMENT_UPLOAD_POLICY`, published on each requirement as `accepts` and compared by a test — and
  are stored through `MediaStore`, **not** the `media` table, which any staff account can read. The
  server names the file (`<code>-v<n>.<ext>`); **the uploader's own file name is not kept**, because
  it says more than the office needs to hold and would be repeated on every screen that lists it.
- **Document numbers are held whole and answered masked** to their last four characters unless the
  reader holds `document.view-full-number`.
- **Opening a file is its own grant**: `document.download`, and `request.view-sensitive` on a
  protected request. The server issues a single-use, five-minute handle — kept only as its hash —
  with a warning it composes (what the file is, how to handle it, that the opening is recorded, that
  nothing was redacted: `redactedForSharing` is always false, because the server keeps the copy the
  office received and makes no other). The handle is exchanged for the bytes in a `POST` body, by the
  same account, because request paths are logged.
- **What the applicant was asked to bring** is recorded with who asked, how and by when; it is
  answered when the document is recorded, withdrawn with a reason, closed once and never removed.
- **Redaction.** A protected request also withholds its assignment reasons, its documents' words and
  its case study, and refuses every write from an uncleared account ("nobody adds to what they may
  not read"). **The case study's words are withheld from an account without `case.view`** — the
  barangay link and the release officer, whose roles were given no case access precisely so the
  casework record of their neighbours is not theirs to read.

### Decisions made here

1. **Who assigns.** `request.assess` from an account that is not itself a caseload — the head and
   an administrator. An intake officer does not assign (the role holds no `request.assess`, and
   moving a request into assessment already needed that key); a social worker does not reassign
   their own. The assignee must be an **open account in the `social-worker` role**: the owner said
   "assigned to a social worker", and a head who assesses needs no assignment to read the request.
2. **A caseload is refused everything that reads beyond its requests** — the duplicate check on a
   request it holds included, because the check names the person's *other* requests, and the
   resident registry. So a social worker assessing does not see the applicant's resident record or
   the previous-assistance signals. The console asks for neither on their behalf (a `403` takes a
   reader off the page), and says so in place.
3. **The case study's words are withheld from an account without `case.view`** (the barangay link
   and the release officer), as well as on a protected request. The recommendation itself, the
   amount and the home-visit fact are not words about the family and stay visible.
4. **Every write on a protected request needs `request.view-sensitive`**, assignment included:
   nobody adds to what they may not read (`DL-177` refused only saving over a draft). An intake
   officer therefore cannot record or review a document on a VAWC survivor's request.
5. **Review words are required for `waived`, `rejected` and `needs-replacement`** — the applicant
   has to be told what to bring instead — and only something presented can be checked, refused,
   lapse or need replacing.
6. **"Document numbers held and shown masked"** is read as: held whole (a clerk must still be able to
   read one back against paper, and `document.view-full-number` exists for that), shown masked.
   Holding only the last four would make that key meaningless and could not be undone; truncating
   the column later can.
7. **The file is fetched only after the reader confirms the server's warning**, and offered as a
   download link released when the dialog closes — never opened automatically. Upload progress is
   not shown: `ApiClient` does not read upload events, so the adapter reports only "done" rather
   than a bar that would be invented (`DL-87`).
8. **An open assessment is found by opening it.** The request carries the latest *completed* case
   study; the open one, with its answers, is answered only by `POST …/assessment`, which returns the
   one open (whichever form) or opens one. The page's "Open the assessment" therefore resumes or
   opens, and says which form it came from.
9. **The forms stay placeholders.** The server holds the console's two forms as fixed reference data,
   still `placeholder-pending-lgu-approval`; adopting Taytay's own is a migration and the office's
   decision (`DL-68`'s pattern).

### What the console now does

- `HttpAssistanceRequestRepository` serves every method; the "not connected yet" sentence for the
  assessment and the documents is gone. Every read through `assistance-request.mapper.ts`, every
  body through an explicit `toWire…` (the document as a form held to the operation's form schema).
- **The request record works end to end**: an assignment panel for holders of `request.assess` who
  are not a caseload (a social worker chosen, a reason required, the history with who, when and
  why, or "withheld"); the case study (forms → open → answers as a patch → complete with the
  recommendation a person chose); document review, rulings with a reason, a version recorded with
  the file refused before sending by the policy the requirement publishes, replaced with a reason
  and the old version kept and listed with its masked number; opening a file as two acts — the
  grant with the server's warning, then the bytes through `ApiClient.postBlob`, the handle in a
  body and the bearer in a header; what the applicant was asked to bring, asked and withdrawn with
  its words; the **notes box**. Every read is a view state, so one that fails says so in its section
  and the rest stands. Completion counts and decides nothing (`DL-78`).
- The port gains `listSocialWorkers`, `assignForAssessment`, `addNote` and `readDocumentFile`,
  each reached by the record page. The withheld vocabulary gains `assignmentReasons` and
  `assessment`.
- The request list narrows by assignee for the head; a social worker's list is their caseload.
- **The programme record's edit is the whole New programme form**, filled from the record and saved
  whole with a reason through the existing `PATCH`; the partial edit is gone (`/programs/:id/edit`).
- The mock is brought to the server's rules where it was more permissive: caseload scope, assessment
  only in assessment, review words and presented-first, a new version reads `submitted` and answers
  open requests for it, protected writes refused, the case study withheld without `case.view`,
  numbers masked without `document.view-full-number`, a grant used once, a new version named as the
  server names it. Two seeded requests for a document named another request's requirements; they
  now name their own.
- The error interceptor reads a JSON refusal that arrives as a `Blob`, so a refused file exchange
  reaches the screen in the server's words.
- The platform audit trail words the eleven new `office_request.*` codes.

### For the owner

- Whether a social worker assessing a request should see the applicant's resident record and the
  previous-assistance check (refused today: decision 2), or wait for cases (phase 3).
- Whether an intake officer should be able to record documents on a protected person's request
  (refused today: decision 4), which would mean giving intake `request.view-sensitive`.
- Whether intake officers, not only the head, should assign requests for assessment.
- The assessment forms are placeholders; the office's own instrument, when adopted, replaces them.
- A social worker can still reach the intake page by typing its address (they hold
  `request.create`); the server refuses them, and only the list's link is hidden.

### The checks it had to satisfy

| Check | Change | Result |
| --- | --- | --- |
| `check:contract-drift` | vendored `240803d` | 163 operations (was 149) |
| `check:routes` | `postBlob` taught | 33 endpoints, 120 composed requests (was 30, 105); 12 of 33 ports unrouted |
| `check:unserved` | the programme edit route | 12 unserved, all declared; 64 routed screens (was 63) |
| `check:response-shape` | knows `postBlob`, judged at `POST` | 57/57 (was 53/53) |
| `check:wire-adoption` | every new body through a `toWire…`, the handle mapped | 69/69 (was 57/57) |
| `check:port-adoption` | four methods, each reached; `listNotes` reached too; baseline lowered | 10 of 223 unreached (was 11 of 219) |
| `check:query-params` | the list's `assigned_to` | 56 reads (was 53) |
| `check:consumer-contract` | regenerated | 109 interactions, 611 required fields (was 97, 516) |
| `check:permission-parity` | the new routes' keys | 0 of 58 disagree |
| `check:intake` | the not-recorded rule reads `toWireAssessment`'s keys under the server's names and requires `recordAssessment` to send it — validated by two planted breaks | passed; nothing decision-shaped |
| `check:documents` | nothing removes a version | passed |

## DL-179 — cases are served: the office's continuing file, appended, and a caseload that is its own

Phase 3 of the casework (`docs/integration/node-api-migration.md`). Backend `taytay-backend`
`aef52f8`; the spec vendored here is its. Console `fc30e89`.

### What the server now decides

- **A case is not a request** (`DL-52`). `office_cases` holds the subject, the category, the
  presenting problem, the status and who holds it; the requests it covers are **named, one link at a
  time** (`office_case_requests`), never inferred from the person. A filed request belongs to one
  case at most, and is about the subject or somebody in the subject's household today. One person
  may be the subject of two open cases.
- **Every write takes a reason and appends its event in the same transaction** (`DL-54`).
  `office_case_events` is the console's `CaseEvent`: identifiers, enum values and the reason. A
  case's status and assignee, and a task's status, assignee and due date, move **only** because an
  event was appended — the event's trigger writes them, and a guard refuses any other write. A case,
  note, task or link inserted without its event is refused **at commit** by a deferred constraint
  trigger. Nothing is updated in place or deleted: not an event, a note, a task, a link or a case.
  Each event is also a platform audit row, `office_case.<act>`.
- **`closed` is terminal** (`DL-53`). Nothing leaves it; every write on a closed case is refused. A
  recurrence is a new case whose `continues_case_id` names a **closed** case. `case.close` is held
  apart from `case.manage`, read from `office_case_statuses` as the console's
  `CASE_TRANSITION_PERMISSIONS`, and compared with the console's file by a test.
- **The next action is an open task** (`DL-55`): the open task due soonest, never the status. Add,
  complete (the reason is the outcome), hand over and reschedule are each an event.
- **Protected notes are withheld in the data layer** (`DL-58`): the entry is listed with its author
  and time, `body` null and `is_withheld` true, for a reader without `case-note.view-protected`;
  writing one needs that key.
- **The queues** (`mine`, `unassigned`, `overdue`, `due-soon`, `stalled`, `all`) are SQL predicates
  on the municipality's calendar, the same for the list and its counts, derived on every read
  (`DL-83`): the next due date and the last activity — the case's events and the moves of the
  requests it names — are never stored.

### Decisions made here

1. **A caseload is the cases assigned to it, and nothing else** — not the unassigned pool. The
   owner's instruction for this phase; it **supersedes `DL-57`**, whose "mine and nobody's" let a
   social worker read every unassigned file in the municipality. A case reaches a social worker by
   being given to them. The mock follows.
2. **Who gives a case, and to whom.** `case.manage` from an account that is not itself a caseload
   — intake, the head, an administrator — to an **open account in the `social-worker` role**, from
   `GET office/cases/assignees` (an id and a name), or back to nobody. This is the scoped
   "assignable colleagues" read **`DL-59`** recorded as the fix for its gap, and supersedes its
   "take it or return it" pair, which a caseload that cannot see the pool could no longer use. A
   social worker does not reassign their own case. Intake assigns cases (unlike requests, `DL-178`
   decision 1) because `DL-59` names intake as a role that assigns cases day to day, and the key is
   `case.manage`.
3. **A case does not widen the registry** — the narrower reading. It admits its worker to the
   person it is about (disclosed by the registry's own rules) and to its own notes, tasks and
   history. The subject's household and family are **not named** to a caseload (`withheld:
   household_context`, `household_id` null); the resident, household and family routes stay
   refused. A linked request is shown only if the request's own scope admits the reader — for a
   social worker, the requests assigned to them; the rest are named by id and counted, never
   opened through the case.
4. **A protected subject's case withholds its words** from a reader without
   `request.view-sensitive` — the summary, every event reason, task titles and outcomes, and every
   note body — and that reader cannot add to it: the rule and the key of a protected request
   (`DL-177`, `DL-178` decision 4), so an intake officer reads that a VAWC survivor's case exists, its
   status and who holds it, and nothing of what it says.
5. **Closing is refused while a task is open.** There is no "cancel" in the port, and closing over
   an open task would leave an undertaking owed by nobody; the worker records what happened to each
   (completing it with an outcome) first.
6. **A task is owed by somebody who can see the case**: its writer, whoever holds the case, or
   nobody yet. Handing a task to a social worker who does not hold the case would give them work on
   a file they cannot open.
7. **A link is never removed.** A wrongly named request stays named; the remedy is a note. An unlink,
   if the office wants one, is a recorded act to add later, not an edit.
8. **Search reads the case reference only** (`DL-109`): the summary is the presenting problem in
   free text, and matching on it would disclose it.
9. **File numbers** are `CASE-YYYY-NNNNNN`, issued when the case is opened, from the municipality's
   year.

### What the console now does

- `HttpCaseRepository` serves every method of the port, and `case` leaves `UNSERVED_PORTS`
  (eleven remain): **Cases is in the menu** against the API. Every read goes through
  `case.mapper.ts` (the subject and the linked requests through the resident and request mappers),
  every body through its own `toWire…`. The household and family beside a case are read from the
  served household and family routes for a reader whose scope reaches them, and not asked for when
  `household_context` is withheld; a failed read of either says so in its panel rather than failing
  the case (`householdContextUnread`).
- The port reads the list **a cursor page at a time** (no sort, no page numbers: the server orders
  newest opened first and sends no total), and gains `open`, `linkRequest` and `listAssignees`, each
  reached by a screen. Every mutation keeps its reason (`check:case-audit` rule 1).
- The domain carries what the server withholds: nullable words, a `withheld` list and
  `isProtected` on the case. A case no longer carries a family of its own; the workspace lists the
  subject's families. **The timeline is one pure function, `caseTimeline`**, used by both adapters —
  the case's events (now with `request-linked`), its notes, its completed tasks and the linked
  requests' moves.
- **Screens.** The list pages by cursor and offers "Open a case" to `case.manage` outside a
  caseload; `/cases/new` opens one (subject through `PersonPicker`), and a closed case offers "Open a
  new case continuing this one" instead of any write. The record gives a case to a named social
  worker or to nobody (hidden from a caseload), sets tasks owed by the writer, the case's holder or
  nobody, hands them over and moves their dates with a reason, names a request (the subject's own
  filed requests), says "withheld" where words are withheld and offers that reader no write, says
  the household is not shown to a caseload rather than "No household recorded", and counts the
  linked requests it cannot open. **Closing is not offered while a task is open**; the record says
  why.
- **The mock follows the server**: the caseload without the pool, who assigns and to whom, the
  closed case, closing over open tasks, task owners, the link rules with one case per request, and
  protected withholding through the same domain function. Requests now sit in a shared
  `MockAssistanceRequestStore`, so the case and request mocks read the same requests.
- The platform audit trail words the ten `office_case.*` codes.
- The work queue stays unserved (phase 6) and out of the menu; its task acts reach the same port.

### For the owner

- Decision 1 — whether a social worker should also see the **unassigned pool** (`DL-57` as it was).
- Decision 3 — whether a social worker on a case should see the subject's **household and family**,
  and the linked requests assigned to colleagues.
- Decision 2 — whether **intake officers** should assign cases (they do), when they do not assign
  requests.
- Decision 5 — whether closing should instead **cancel** open tasks (a recorded act the port does
  not yet have).
- Decision 7 — whether a wrongly linked request needs an **unlink**.
- The console offers a social worker "Name a request" only for the subject's own filed requests;
  the server also accepts a household member's. Whether the screen should offer those too.
- Reassigning a case does not move its open tasks: tasks owed by the previous worker stay theirs,
  and they can no longer open the case. The work queue (phase 6) is where that shows.

### The checks it had to satisfy

| Check | Change | Result |
| --- | --- | --- |
| `check:contract-drift` | vendored `aef52f8` | 176 operations (was 163) |
| `check:routes` | unserved ceiling lowered 12 → 11 | 34 endpoints, 133 composed requests (was 33, 120); 11 of 33 ports unrouted |
| `check:unserved` | `case` served | 11 unserved, all declared; 65 routed screens (was 64); 3 screens degrade 4 panels in place |
| `check:response-shape` | the case reads | 64/64 (was 57/57) |
| `check:wire-adoption` | every case body through a `toWire…` | 78/78 (was 69/69) |
| `check:port-adoption` | three new methods, each reached; `assignTask` reached too; baseline rewritten | 9 of 226 unreached (was 10 of 223) |
| `check:query-params` | the case list's filters and queue | 63 reads (was 56) |
| `check:consumer-contract` | regenerated | 122 interactions, 668 required fields (was 109, 611) |
| `check:permission-parity` | the case routes' keys | 0 of 59 disagree |
| `check:case-audit` | `listAssignees` read as a read; the store's `open`, `linkRequest`, `assignTask` and `rescheduleTask` held to appending an event | 9 port mutators, 9 store mutators, each with a reason and an event |

The backend's own test compares its case lifecycle, transition keys, categories, queues,
thresholds, task kinds and event kinds with this console's domain files (11/11).

## DL-180 — releases are served: payouts in centavos, sessions counted from their members, the request moving with them

Phase 4 of the casework (`docs/integration/node-api-migration.md`). Backend `taytay-backend`
`da22eec`; the spec vendored here is its. Console `e6ce50a`.

### What the server now decides

- **It is not the treasury system** (`DL-89`). No ledger, journal, account code, bank or posting
  date in the tables, the routes or the spec; a body carrying anything else is refused.
  `funding_source_label` is a label and `approving_reference` a document reference.
- **Money is integer centavos, and goods are counted, never valued** (`DL-93`). An integer column; a
  decimal point is refused, never rounded. A money release has an amount and no goods; an in-kind
  release has a description, method `in-kind` and no amount, and the table refuses either half
  wrong. A session's progress and a payout list's total are of the money only, beside a count of
  goods.
- **A release follows approval.** It is prepared (`release.schedule`) only for an approved request,
  one at a time — another only once the first is voided. Its person, barangay and approver are read
  from the request, the approver from the request's own history (the last move into `approved`) and
  kept on the release.
- **Every act appends an event in the same transaction** (`DL-54`'s rule, applied to money). The
  event's trigger alone moves the release, along the console's transitions; nothing is updated in
  place or deleted, and a release without its `prepared` event, or a session with nobody in it, is
  refused at commit. Each act is an `office_release.*` audit row.
- **The request moves with its payout, through its own lifecycle.** Scheduling a release into a
  session appends `approved → scheduled` to the request's history, and recording the hand-over
  appends `scheduled → released` — never a write to its status. The request's own status route still
  refuses both moves (409); completing the request stays its own move (`request.close`).
- **A session has no status** (`DL-90`): a plan kept as opened, its progress counted from the
  members on every read. Opening one schedules each member individually, and is **refused whole**
  if any member cannot be scheduled — a session never quietly leaves somebody out.
- **Deferred is the office's; unclaimed is nobody's** (`DL-94`): a deferral takes one of the fixed
  office reasons and what happened; unclaimed is a status move with a reason and no guess.
- **Self-release warns, never blocks** (`DL-91`): every read says whether the reader approved the
  request (`would_self_release`); a hand-over by the approver is recorded (`self_release`) and
  audited `office_release.self_released`, and goes ahead.
- **The payout list is composed by the server** (`DL-92`): a name as the registry lists it to the
  reader (surname and an initial for a protected person), the reference masked to its last four
  characters, what is handed over, a blank acknowledgement column; voided releases left off;
  composing it audited.
- **Every money write carries `idempotency_key` in its body.** The same key and body replay the first
  answer; the same key with anything else is 409. A refused or invalid write claims no key.

### Decisions made here

1. **The key travels in the body, not in an `Idempotency-Key` header.** `check:money` asked for the
   API to "honour the key and allow it across origins"; allowing a fifth request header is widening
   the CORS policy, which `CLAUDE.md` §2.5 forbids. In the body it needs no CORS change, and the
   screens already hold one intent per act across retries. A replay answers the record **as it
   stands now**, not a stored copy of the first response.
2. **Preparing a release is its own act, with its own screen** (`/releases/prepare?request=`),
   reached from an approved request's record by whoever holds `release.schedule`. Nothing in the
   console created a release before (the mock was seeded), and approving records no granted amount
   (`approvedAmount` is still not served), so the office states the amount or the goods here. The
   port gains `prepare(draft, intent)`, a sixth money write.
3. **What was prepared is kept as prepared.** A wrong amount, method or label is not edited: the
   release is moved to `needs-correction` or voided, and a new one prepared once it is voided.
4. **Back to `scheduled` keeps a release in its session** and is refused to one never in a session;
   a deferred or unclaimed payout may instead be put into a **new** session, which moves it there.
   A session's members are the releases in it now, so one moved on leaves the old session's count.
5. **A request whose payout is under way can still be cancelled or expire** on its own route; the
   release then refuses to be handed over (409) and is voided. The request route does not check for
   an open release.
6. **Payouts are refused to a caseload**, and read under the barangay scope of the request. No
   social worker or barangay link holds a release key today.
7. **A session is opened by the officer who will run it** — the API takes the officer from the
   sign-in, as the console already said — and the API keeps **no close** of a session (`closedAt` is
   always null): closing says nothing about who was paid.
8. **Numbers**: releases `RL-YYYY-NNNNNN`, sessions `RB-YYYY-NNNN`, from the municipality's year.

### What the console now does

- `HttpReleaseRepository` serves every method of the port through `release.mapper.ts`; every money
  write hands the screen's intent to its `toWire…` mapper, which writes `idempotency_key: intent.key`.
  `release` leaves `UNSERVED_PORTS` (ten remain): **Releases is in the menu** against the API.
- The port reads the list **a cursor page at a time** (no sort, no page numbers); the list page keeps
  its buckets over what has been read, offers "Show more", and says that more exist and that the
  groups count only what is shown. Search is reference numbers only, as the API searches.
- `ReleaseBatch` carries `progress`, counted from its members — by the server over HTTP, by
  `batchProgress` in the mock — and the session page says `describeBatch(batch.progress)` instead of
  counting a page of releases it happened to hold. Its picker reads the queue whole (`DL-161`) and
  offers only releases that can move to `scheduled`.
- **Fixed:** the session page held one intent for its lifetime, so a second session opened on the
  same visit would have sent the first one's key. It now takes a new intent once a session is
  recorded.
- The release record offers the remaining moves — unclaimed, needs correction, back on the schedule,
  completed, voided — through `StatusTransition`, under the key each needs (`statusMovesFor`); the
  hand-over, the receipt and a deferral stay their own acts. The request record no longer offers
  `scheduled` or `released` (`PAYOUT_RECORDED_STATUSES`), says why, and links to preparing the
  release.
- The mock follows: cursor paging, `prepare` with the approver from the request's history and one
  release per request, and sessions counted as read.
- The platform audit trail words the nine `office_release*` codes.

### For the owner

- Decision 1 — the key in the body rather than a header (and a replay answering the record as it is
  now).
- Decision 2 — whether approval should record a **granted amount** that the release may not exceed;
  today the release states it and nothing compares the two.
- Decision 3 — whether a prepared release needs a **correction** act rather than void-and-prepare.
- Decision 5 — whether cancelling or expiring a request should be **refused while its release is
  open**.
- Whether a session needs a **close** (decision 7), and whether completing a release should also
  complete its request (it does not; `request.close` is the head's).
- Programme **utilization** and the resident's **assistance history** can now be counted from
  releases; neither is served yet, and both still say they are not connected.

### The checks it had to satisfy

| Check | Change | Result |
| --- | --- | --- |
| `check:money` | rule 1 restored for a served port: every money write takes its intent and hands it to the mapper, every money mapper writes `idempotency_key: intent.key`, no adapter mints one; `prepare` added. Planted regressions (a mapper without the key, an adapter minting one) both fail it | 6 writes |
| `check:releases` | `prepare` held to the permission check in the mock | passed |
| `check:contract-drift` | vendored `da22eec` | 188 operations (was 176) |
| `check:routes` | unserved ceiling lowered 11 → 10 | 36 endpoints, 145 composed requests (was 34, 133); 10 of 33 ports unrouted |
| `check:unserved` | `release` served; the prepare route guards `release` and `assistance-request` | 10 unserved, 66 routed screens |
| `check:response-shape` | the release reads | 72/72 (was 64/64) |
| `check:wire-adoption` | every release body through a `toWire…` | 84/84 (was 78/78) |
| `check:port-adoption` | `listForRequest` reached by the prepare page; baseline rewritten | 8 of 227 unreached (was 9 of 226) |
| `check:query-params` | the release list and queue filters | 71 reads (was 63) |
| `check:consumer-contract` | regenerated | 128 interactions, 682 required fields (was 122, 668) |
| `check:permission-parity` | the release routes' keys | 0 of 60 disagree |

The backend's own test compares its release statuses, labels, transitions, methods, kinds, deferral
reasons, receipt kinds and the manifest notice with this console's domain files.

## DL-181 — referrals and field visits are served: the sheet composed by the server, the basis checked under its lock, and no column for where anybody was

Phase 5 of the casework (`docs/integration/node-api-migration.md`). Backend `taytay-backend`
`6436b70`; the spec vendored here is its. Console: the commit that adds this entry.

### What the server now decides

- **A referral discloses nothing until it is sent, and what it sends is composed** (`DL-81`,
  `DL-82`). Drafting records who, where, what and why. The lawful basis — client consent, a
  statutory mandate, or vital interest — is its own recorded act with the sentence that explains it;
  each field beyond the minimum is shared one call at a time with its stated need, **each once**,
  only under a recorded basis, and only by a writer who could read it (household income needs
  `resident.view-sensitive`). Both acts are open **only while the referral is a draft**: once sent,
  what it disclosed and on what basis is kept as it was.
- **`send` is refused without a basis, under the row lock** (`DL-140`). It takes no body. The route
  reads the referral locked and refuses (409); the database's own event trigger refuses the `sent`
  event again, under the same lock, so a direct insert is refused too. No ordinary move reaches
  `sent`. Sending gives the referral its follow-up date from its urgency (14, 7 or 2 days, counted
  from the day it is sent, as `defaultFollowUpDate` always said) when none was set.
- **The sheet is the server's** (`GET …/summary`): the client's name, "MSWDO Taytay, Rizal", then
  each chosen field valued only from what the reader could themselves read; a field chosen but not
  held is left off, never printed empty. `null` until a basis is recorded. Composing a sheet is an
  audit row (`office_referral.summary_composed`).
- **Overdue is derived** (`DL-83`): `sent_at`, `responded_at` and the outcome are read from the
  history on every read. `responded_at` is the first move to acknowledged, in progress, waiting
  requirements, served or declined — so a note, or the office closing it, is not an answer.
- **A visit record says whose claim each line is** (`DL-85`): an observation carries its kind, a
  third party's account names who gave it, and no other kind carries an attribution — refused by
  the route and by a `CHECK`. Observations are appended, never edited or removed.
- **No tracking** (`DL-86`): no table, column, field or parameter for a coordinate, a check-in, a
  route, an arrival time or a device. The backend test reads the visit tables' columns from
  `information_schema` against a list of tracking words, and shows the list catches them.
  `completed_at` and `recorded_at` are when the office record received the outcome or the line.
- **Honest capture** (`DL-87`): a write answers with the visit as the record now holds it, or an
  error; nothing is queued or retried. Every outcome is final and a visit closes once; the checklist
  moves only while it is scheduled; nothing is observed on a visit cancelled before it was made.
- **Every act appends an event in the same transaction**, mirrored to the platform audit trail
  (`office_referral.*`, `office_visit.*`); nothing is updated in place or deleted; a closed
  referral takes no further writes.

### Decisions made here

1. **The narrower caseload** (as `DL-178`, `DL-179`). A social worker reads only referrals naming a
   case or a filed request assigned to them, and visits on a case assigned to them; drafts a
   referral only from one of those (403 with neither) and schedules a visit only on a case of their
   own. A visit is given to a social worker **only on a case assigned to that worker**, so nobody is
   sent on a visit they could not open. A visit with no case is read by the office scopes only.
2. **A protected client's words are withheld in the data layer** from a reader without
   `request.view-sensitive` — the referral's request, reason, outcome, notes, basis note and each
   field's need; the visit's observations, outcome, needs, refusal reason **and its address** — and
   such a reader cannot add to the record or be given the sheet. The record is still listed, and
   says so. `Referral` and `FieldVisit` gain `withheld`; the screens say "withheld" in place, and
   offer no act on such a record.
3. **What a sheet carries for the composite fields.** "Who else is in the household" is a **count**
   of the other people recorded in the client's household, never their names — they did not consent
   — and is left off for a caseload, which does not read the household (`DL-179`). "Previous
   assistance" lists only filed requests the composer may read, by programme, status and date.
4. **The provider directory is served read-only and starts empty.** Nothing in the API writes it
   yet; offices are named in words on the draft meanwhile. Seeding real offices' contacts nobody
   confirmed would be inventing them.
5. **Scheduling a visit is a screen** (`/visits/schedule?case=`), reached from the case by whoever
   holds `visit.manage`. Nothing in the console scheduled a visit before (the mock was seeded). It
   offers the case's own worker or the signed-in account (unless that account is a caseload),
   copies the address from the person's record (editable: a family between addresses is visited
   where it is), and sets out with the six prompts that were the seed's checklist, now
   `VISIT_CHECKLIST_PROMPTS` in the domain.
6. **Corrections after a visit closes** are allowed by the API as further observations (a correction
   is another line, `DL-85`); the screen still offers the form only while the visit is scheduled.
7. **Numbers**: referrals `RF-YYYY-NNNNNN`, visits `HV-YYYY-NNNNNN`, from the municipality's year.

### What the console now does

- `HttpReferralRepository` and `HttpFieldVisitRepository` serve every method of both ports through
  `referral.mapper.ts` and `field-visit.mapper.ts`, every write through a `toWire…` mapper; `send`
  posts `{}`. `referral` and `field-visit` leave `UNSERVED_PORTS` (eight remain): **Referrals,
  Service providers and Field visits are in the menu** against the API, and the resident record's
  visits panel reads them.
- Both lists read **a cursor page at a time** and say how many are shown and whether more exist;
  the referral list loses its sort controls and page numbers, the visit list keeps its buckets over
  what has been read; "My visits" is read whole or not at all. Search is the reference (and, for a
  referral, the receiving office's name) — never what was written about a person (`DL-109`).
- The visit screens use `visit.manage`, the key the server checks, not `case.manage`; a write that
  fails says it was **not saved and nothing was queued**, in the domain's own `send-failed` words,
  and a write that lands says "Saved to the office record".
- The mock follows the server: cursor paging, the basis and fields only while a draft and each
  field once, the default follow-up from the day it is sent, `respondedAt` only on an answer,
  search by reference, `visit.*` keys, and a protected client's words withheld from an uncleared
  reader.
- The platform audit trail words the thirteen new codes.

### For the owner

- Decision 1 — whether a social worker should see visits **assigned to them on a colleague's case**,
  and visits with **no case** (a verification visit for a request); today neither.
- Decision 3 — whether "who else is in the household" should carry names or relationships rather
  than a count.
- Decision 4 — **who keeps the provider directory**, and from which screen. Until then it is empty.
- Decision 5 — whether the six checklist prompts are the office's, or should be replaced.
- Whether a draft referral that is never sent should **expire**, and whether the sheet needs a
  document attachment act (`attachments` is always empty).

### The checks it had to satisfy

| Check | Change | Result |
| --- | --- | --- |
| `check:visits` | now also reads `data/http/mappers/field-visit.mapper.ts`, and the wire's snake_case names (`field(wire, 'latitude')`, a `checked_in_at` field, an `arrived_at` key). Three planted regressions all fail it | passed |
| `check:referrals` | unchanged; the mock still refuses a send with no basis | passed |
| `check:contract-drift` | vendored `6436b70` | 208 operations (was 188) |
| `check:routes` | unserved ceiling lowered 10 → 8 | 39 endpoints, 165 composed requests; 8 of 33 ports unrouted |
| `check:unserved` | `referral` and `field-visit` served; the schedule route guards `field-visit` and `case` | passed |
| `check:response-shape` | the referral, provider and visit reads (the summary a nullable item) | 83/83 (was 72/72) |
| `check:wire-adoption` | every referral and visit body through a `toWire…`; `send` posts `{}` to an operation with no body | 96/96 (was 84/84) |
| `check:port-adoption` | `schedule` reached by the new page | 8 of 227 unreached |
| `check:query-params` | the referral list, queue and visit filters, as inline literals | 82 reads (was 71) |
| `check:consumer-contract` | regenerated | 136 interactions, 752 required fields (was 128, 682) |
| `check:permission-parity` | the referral and visit routes' keys | 0 of 61 disagree |

All 48 repository checks pass. Focused specs (14 files, the referral, visit, case, resident, acceptance, unserved, layout and HTTP ones): 396/396.

The backend's own test compares its referral statuses, labels, transitions, destinations,
urgencies, follow-up days, bases and their labels, shared fields and their labels, the handling
notice, provider statuses and channels, and the visit statuses, labels, transitions, purposes,
observation kinds and minimum length with this console's domain files.

## DL-182 — the dashboard is served: every figure counted under the scope of the list it opens, and what a reader's lists refuse is absent, not zero

Casework phase 6a (`docs/integration/node-api-migration.md`). Backend `taytay-backend` `0ec3ffb`;
the spec vendored here is its. Console: the commit that adds this entry. The owner made this a
priority deliverable ("Citizen roster and administrative dashboard"): until now the default route
sent every member of staff to `/dashboard`, and the dashboard was unserved, so sign-in landed on
`/unavailable`.

### What the server now decides

- **One read, `GET office/dashboard`, behind `dashboard.view`**, filtered by `barangay_id`,
  `category` and `period` and nothing else (anything else is 422). Read-only: every figure is
  counted in SQL on the request that asks for it, and nothing is stored.
- **Every figure is counted under the scope of the list it links to.** `all-barangays` counts the
  municipality; `own-barangay` counts its barangay, and a `barangay_id` outside it is 403, as on the
  request list; a caseload counts the filed requests assigned to it and the referrals naming its
  case or its request. A number and the list it opens therefore agree, which is what the screen's
  drill-downs always claimed.
- **Filed requests only.** A draft is somebody's unfinished form; the request list does not show
  one among filed requests, so the dashboard does not count one.
- **Payouts are `null`, not zero, for a reader the release list refuses** — without `release.view`,
  or a caseload. An intake officer, a social worker and a barangay link used to see a payout total
  and a card linking to `/releases`, a list their guard refuses (`CLAUDE.md` rule 8). For everybody
  else: scheduled, and for releases handed over (`released`, `claimed`, `completed`) in the period,
  **integer centavos of money releases with goods counted beside them and never valued**
  (`DL-93`), the people served, and the same per programme type.
- **Each attention item carries the key that acts on it and its basis in words** (`DL-98`): the
  rule the server ran, so the figure can be checked. `missing-requirements` does not count an
  undecided conditional document against the applicant (`DL-76`, `DL-78`); `referral-unanswered`
  is a referral sent with no acknowledgement, counted only for a reader of referrals. A zero is
  left out.
- **The residents' app has a block of its own**, for whoever administers it: open resident accounts
  (staff are not citizens) by verification status and new in the period, ID reviews waiting, and
  digital IDs active and unexpired. Each figure sits behind the key of the list it counts —
  `user.view`, `verification.review`, `digital-id.manage` — and the block is `null` for a reader
  who holds none of them. Administrators alone hold them today.

### Decisions made here

1. **No small-cell suppression on the dashboard.** The brief asked to apply `DL-105` to any
   people-count broken down by barangay *if the domain applies it there*. It does not: the only
   breakdown by barangay counts **requests**, and `suppressSmallCells` says in its own words that a
   count of requests identifies nobody on its own. Every row also opens records the reader may
   already read. No people-count is broken down by barangay, and none was added.
2. **The basis comes from the counter.** The domain's `AttentionSignal` gains `basis`, written by
   whoever counted — the API, or the mock in the API's words — rather than by this console's copy,
   which would describe a rule it did not run. The copy still words the *message* (`DL-23`).
3. **Absent is `null` at every level.** `payouts` and `residentApp` are `null` on the summary, and
   each residents' app figure is `null` without its own key; the mapper keeps a wire `null` a
   `null` and never turns it into a zero. The screen says payout figures are not shown, rather than
   leaving a gap a reader takes for "nothing paid out".
4. **The residents' app figures are the whole app's.** The barangay and programme filters do not
   narrow them — a resident's barangay in the app is self-declared, not the office's registry — and
   the screen says so. The period does reach them: "new in the period". The period filter's label
   is now **Period**, since it governs more than releases.
5. **Whole or not at all.** Every other mapper drops a row it cannot read; an aggregate cannot,
   because a dropped barangay reads as "no requests there". One unreadable value refuses the
   summary, and the screen says it could not load.
6. **"Residents served" counts people who received goods only.** They were served; their goods
   are counted, not valued.
7. **`ApiClient.item` drops a key left `undefined`**, as `list` always has, so an optional filter is
   written in the call's object literal where `check:query-params` can read it.

### What the console now does

- `HttpDashboardRepository` serves the port through `mappers/dashboard.mapper.ts`, the barangay
  joined to the API's id on the way out and back to the console's on the way in; a barangay the
  two lists do not share is refused before anything is sent.
- The screen shows the basis under each attention item; the payout cards and the
  released-by-programme table only to a reader of the releases; a programme that released only
  goods as "1 release of goods", never "₱0"; and the residents' app — accounts, ID reviews waiting,
  digital IDs in force, each a link to `/users`, `/verification` or `/digital-ids`, with a table of
  accounts by verification (a table, `DL-108`).
- The mock counts the same way: filed requests, a caseload's own, payouts only for a reader of
  releases, and the app's figures from its seeds. The seeded accounts carry no registration date, so
  "new in the period" reads zero there rather than an invented figure.
- `dashboard` leaves `UNSERVED_HTTP_PORTS`; seven ports remain, and the header of
  `unserved-repositories.ts`, which still said the API served no cases or releases, says what is
  left.

### For the owner

- Whether intake officers, social workers and barangay links should see payout figures. They no
  longer do, because the release list refuses them; granting `release.view` would bring them back.
- Whether the residents' app figures should be narrowed by the barangay a resident declared in the
  app.
- Whether "residents served" should go on counting people who received only goods.

### The checks it had to satisfy

| Check | Change | Result |
| --- | --- | --- |
| `check:contract-drift` | vendored `0ec3ffb` | 209 operations (was 208) |
| `check:routes` | unserved ceiling lowered 8 → 7 | 40 endpoints, 166 composed requests; 7 of 33 ports unrouted |
| `check:unserved` | `dashboard` served | passed |
| `check:response-shape` | the dashboard read, an item | 84/84 (was 83/83) |
| `check:query-params` | `barangay_id`, `category`, `period` as an inline literal | 83 reads (was 82) |
| `check:port-adoption` | unchanged | 8 of 227 unreached |
| `check:consumer-contract` | regenerated | 137 interactions, 755 required fields (was 136, 752) |
| `check:community` | the section's class names say `app-figures`, not `resident-app`: it is staff-facing figures about the app, not a resident surface (`DL-123`) | passed |
| `check:permission-parity` | unchanged | 0 of 61 disagree |

The backend's tests cover empty-office zeros, absent-not-zero groups for each role, the refusals,
scope per role, centavos and goods, the period, referrals and the residents' app.

## DL-183 — the owner's decisions round: seven casework rules decided as best practice, held by the server and said by the console

Backend `taytay-backend` `fb43122` (migration `0034_casework_decisions.sql`); the spec
vendored here is its. Console: the commit that adds this entry. The owner was asked seven open
questions from the casework build and answered "decide the best practice". Each answer below is
the decision, its basis, and where it is held. Supersedes `DL-179`'s `household_context` and the
`document.view-full-number` grant (`DL-77`, `DL-178`). Kept as built, with no change: intake may
assign cases; a barangay link and a release officer read an assessment's recommendation but not its
findings; the idempotency key stays in the body; a prepared release is never edited; a goods-only
recipient already counts as a resident served.

### 1. A document number is held as its last four characters

- **Basis.** RA 10173 (data minimisation: no more than the purpose needs) and RA 11055 (a PhilSys
  number is never held in full, `CLAUDE.md` §6.2). Four characters let a clerk match the paper in
  their hand; the file itself, opened only with `document.download` behind a warning, is the full
  evidence. A key that read the number "in full" protected a copy the office did not need to keep.
- **Server.** The route cuts the number to its last four before it is written; migration `0034`
  cuts every number already held — setting the version table's append-only guard aside for that
  one statement, inside the migration's own transaction, and restoring it unchanged — and adds a
  `CHECK` refusing anything longer. Every reader is answered `••••1234`, and
  `document_number_masked` is true whenever there is a number.
- **Console.** `document.view-full-number` is retired from `PERMISSIONS`, the role table, the
  matrix, the roles page and the `GET /me` fixture, in parity with `src/auth/casework.ts` (the
  backend's parity test reads this file). `lastFourOf` cuts the number before `toWireDocumentUpload`
  sends it and before the mock keeps it; `maskDocumentNumber` says `••••1234` to everybody and is
  idempotent. The form says only the last four are kept. `check:documents` now fails if the key
  returns or either adapter keeps or sends more.
- A number of four characters or fewer is kept whole, as typed: it is too short to be an identifier
  of consequence, and dropping it would read as "no number recorded".

### 2. A case's reassignment moves the previous holder's open tasks

- **Basis.** A task is what the office undertook to do (`DL-55`), owed by whoever holds the family.
  A task left with a worker who no longer holds the case is owed by somebody who will not see it,
  and it falls out of every queue that matters.
- **Server.** In the same transaction as the `assigned`/`unassigned` event, each open task owed by
  the previous holder gets its own `task-reassigned` event, under the reassignment's reason, to the
  new holder — or to nobody, when the case goes back to nobody — each mirrored to the audit trail.
  Tasks owed by anybody else, done or cancelled tasks, and tasks when the case had no holder stay
  as they are.
- **Console.** The assign dialog says, before its button, how many open tasks the present holder
  owes and that they go with the case — to the chosen worker, or to nobody — each recorded with the
  same reason. The mock moves only the previous holder's open tasks, one `task-reassigned` event
  each; anybody else's, and finished ones, stay where they are.

### 3. A case task can be cancelled, with a reason

- **Basis.** `DL-53` keeps closure terminal and refuses it while a task is open; without a way to
  end a task that is no longer needed, the only exits were completing it untruthfully or never
  closing the case. Cancelling is appended, never a delete (`DL-54`).
- **Server.** `POST office/cases/{id}/tasks/{taskId}/cancel` with a required reason (8+ characters)
  appends `task-cancelled`; the database sets the terminal `cancelled` status, who ended it, when,
  and the reason as its outcome. Closing is still refused while any task is open (409, now naming
  "complete or cancel").
- **Console.** `CaseRepository.cancelTask` (`toWireCaseTaskCancellation`). Every open task offers
  "Cancel task" with a required reason, saying first that the task is kept, marked cancelled, with
  the reason as its outcome. Where closing is held back, the open tasks are listed with "Mark as
  done" and "Cancel task", so the way to close is on the same screen. The timeline says "Task
  cancelled", and a cancelled task reads "Cancelled", never "Completed". `check:case-audit` counts
  the new mutator.

### 4. A request's link to a case can be ended, with a reason

- **Basis.** `DL-52`: a case names its interventions explicitly. A link made in error otherwise
  stayed forever, and a request could never move to the case it belonged to.
- **Server.** `POST office/cases/{id}/requests/{requestId}/end` with a required reason appends
  `request-unlinked`; the link row is marked `ended_at`, `ended_by`, `ended_reason` by the event's
  trigger and never deleted. An ended link no longer counts — it leaves `linked_request_ids`, and
  the request may be named by another case or by this one again as a new link with its own event
  — and the case history keeps both events. One standing link per request is a partial unique
  index; the database refuses a delete, or an end without its event.
- **Console.** `CaseRepository.endRequestLink` (`toWireCaseRequestLinkEnd`). Each linked request
  offers "End link" with a required reason, saying before the button that the link stays in the
  case's history and the request may be named again; the timeline says it is no longer part of
  the case and is kept in the history. The mock drops it from `linkedRequestIds` and appends
  `request-unlinked` in the same act.

### 5. A social worker reads what they need for their own clients, and nothing more

- **Basis.** RA 10173's proportionality, both ways: a worker assessing a family needs the person's
  record, household, family and previous assistance — refusing them pushed the work back to intake
  and the screens said "not available" where the worker needed the facts — but needs nobody else's.
  Supersedes `DL-179`'s `household_context`.
- **Server.** A *client* is the subject of a filed request or a case assigned to the worker. For a
  client — and nobody else, who answers 404 as absent — a caseload now reads `GET
  office/residents/{id}`, `GET office/households/{id}`, `GET office/households?resident_id=` (that
  filter alone), `GET office/families/{id}`, `…/residents/{id}/families` and
  `…/relationship-history`, and `GET office/assistance-requests/{id}/advisory` for a request
  assigned to them. The normal redaction tiers (`request.view-sensitive`, `resident.view-sensitive`)
  apply unchanged. The registry's lists, its search, the pre-filing advisory and every registry
  write stay 403. A case no longer withholds `household_context`.
- **Console.** `householdContext` is gone from the domain, the mapper, the mock and the HTTP
  adapter: a social worker's case page reads and shows the client's household, members and
  families like anybody else's, and still says "could not be read" when that read fails. The
  request page shows the client's record and household in place — with no links into the registry,
  whose route stays closed to a caseload — and the previous-assistance check; the check before
  filing stays refused. The mock resident repository mirrors the server: clients only, the list
  refused.
- **Tested both ways** on the server: allowed for an assigned subject, refused for anybody else, and
  lost again when the case or request is taken off the worker.

### 6. Approval records the approved amount

- **Basis.** A release is the office paying out what it decided; without a recorded figure nothing
  could check a payout against the decision, and the self-release warning (`DL-91`) was the only
  control on the money's size. Integer centavos (`CLAUDE.md` rule 6); goods are described, never
  priced (`DL-93`).
- **Server.** A move to `approved` requires `approved_amount_centavos` (integer, ≥ 1) or, for goods,
  `approved_in_kind_description` — one, never both — kept on the status change and answered on the
  request and its history. Preparing a money release above the latest approval's amount is 409, and
  so is one against an approval that recorded no amount; equal or less is allowed. The database
  refuses both (`CHECK … NOT VALID`, so an approval recorded before this decision is kept as it was,
  and a money release against it is refused rather than invented).
- **Console.** Approving is its own act, `AssistanceRequestRepository.approve(id, approval,
  reason)` with a `RequestApproval` (an amount, or goods described; `toWireApproval`), and the
  status-move control no longer offers `approved`. The form takes pesos as text and reads them into
  integer centavos with `parsePesos` — two integers, never a decimal multiplied (`check:money`) —
  or takes a goods description, and refuses anything else in words before sending. The request
  shows the approved amount (`PesoPipe`) or the goods; the prepare-release page shows the approved
  amount and says a money release goes at or under it; the mock refuses a release above it, as the
  server does.

### 7. A request with an open release is not cancelled or expired

- **Basis.** Cancelling a request under a payout that is still scheduled leaves money planned for a
  request the office has closed. The release is voided by its own act first (`DL-90`), so the
  record says who stopped the payout and why.
- **Server.** A move to `cancelled` or `expired` is 409 while the request has a release that is not
  voided and not handed over, saying to void the release first; the database refuses it too.
- **Console.** Before where the cancel and expire buttons would be, a reader of payouts is told
  which release is still open (`holdsRequestOpen`), with a link to it, and is not offered the move;
  a reader who cannot read payouts is told the rule. The mock refuses in the server's words, and
  the HTTP adapter passes on the server's 409.

### What was not done

- The console reads the **latest** approval's figure onto the request and shows that; each
  `status_history` entry's own approved amount is served but not yet mapped onto the console's
  history rows.
- An approval recorded before this decision has no amount, so no money release can be prepared
  against it (409, by design). There is no real data yet; on staging such a request is voided or
  cancelled and filed again.
- Nothing is pushed or deployed: migration `0034` runs on the next staging deploy.

## DL-184 — residents' document requests are served: a catalogue per office, the request worked to the counter, and nothing paid or signed online

**Supersedes `DL-10`'s exclusion of document requests.** Basis: the TOR, Section VIII, Months 4–5
("Document Request: catalog, submission, review, approval, status tracking"), as the requirements
document traces it (§3.2, row T-5; FR-RES-15, FR-STAFF-30, FR-API-8). `DL-10` read the feature as
the barangay's or the Civil Registry's; the TOR names it for the platform, and the API now serves it
for any office. Backend `taytay-backend` `2fd0566` (migration `0035_issuance.sql`); the spec vendored
here is its (228 operations).

### Two things called "document request"

Code and wire say **issuance** (`/issuance-types`, `/office/issuance-requests`), because the console
already calls the office asking an applicant for a document inside casework a "document request"
(`DL-178`). Screens say **"Document requests from residents"**, the menu **"Resident document
requests"**, and the subtitle names the other thing so nobody answers the wrong person.

### What is built

- **Domain** (`domain/issuance`): the eight statuses as a `StatusCatalog`, and every move as one
  `StatusTransitions` map, row for row the backend's `lifecycle.ts` — a spec compares them. Three
  moves are the resident's (cancelling, and answering a request for more); the office is offered
  only its own, and only those the server lists in `allowed_moves`. `released`, `rejected` and
  `cancelled` end a request.
- **One port**, `ISSUANCE_REPOSITORY` (`issuance`), with an HTTP adapter whose every body goes
  through a `toWire…` mapper, and a mock with seed data. The queue's open statuses are read **whole**
  (`everyPage`, one per status), because the queue is ordered oldest waiting first and the server
  pages newest filed first: a queue cut at a page would hide the request that has waited longest
  (`DL-161`). Ended requests only grow and are browsed a page at a time.
- **Screens** at `/resident-documents`: the queue (filter by status and document; whom each request
  waits on and for how long, in words; the office's standard beside it), one request (`:requestId`),
  and the catalogue (`catalogue`).
- **Permissions**: the server's `issuance-type.manage` and `issuance-request.manage`, unchanged. In
  the role table the head keeps the catalogue — an entry tells every resident what the office issues
  and on what terms — and the head, social worker, intake officer and release officer work requests.
  The auditor and the barangay link hold neither, as on the server. The menu entry and the queue
  ask for `issuance-request.manage`; the catalogue route for `issuance-type.manage`, linked from the
  queue, and a spec holds that every role keeping the catalogue also reads requests.
- **The app audit trail** names all fourteen `issuance_type.*` and `issuance_request.*` actions.

### Decisions

1. **No online payment, no document generation, no e-signature.** None was supplied (`DL-09`). The
   fee is integer centavos, shown and paid at the office; the office prepares and signs the paper.
   Every screen of the module says both, in those words.
2. **Every word the office writes on a request is the resident's to read.** The reason field is
   labelled for the resident on every move, and what each move does — who is told, and that the
   notice names only the reference — is shown before the button (`DL-167`'s pattern). The console's
   floor of eight characters applies to every move (`DL-54`); the server's to a refusal and a
   request for more. Marking a request ready asks for the claim details beside the reason:
   `StatusTransition` gained an optional second field for one destination, so no screen builds its
   own move form.
3. **No deadline is invented** (`DL-101`). The waiting time is calendar days since the request
   entered its status (`updated_at`, which the database sets only from an event) and says on whom it
   waits. `processing_days` is the office's standard in **working** days, from its Citizen's
   Charter, shown as "Office standard: N working days" beside it and never subtracted from it: this
   console holds no holiday calendar, so nothing is called late.
4. **Files open only after the server's warning.** "Show" asks for a single-use grant; its warning is
   shown word for word; only "Open it" fetches the bytes, with the handle in a body. An image is shown
   in the window; a PDF opens in a new tab from the same object URL. Every URL is revoked when the
   window closes, another request is opened or the page is left. Superseded versions are listed and
   openable — they are what the office may have read (`DL-77`).
5. **The purpose is read on the request only.** List rows carry none, on the wire or in the model.
6. **A catalogue change sends only what moved**, with a reason; a form that changes nothing says so
   and sends nothing. **Retiring is one-way**: the one act behind a confirmation, which says first
   that residents can no longer choose it, filed requests continue, and nothing brings it back.
7. **The fee is typed in pesos and kept in centavos** by `parsePesos`, which reads the pesos and the
   centavos as two integers; a third decimal place is refused, not rounded (rule 6). An empty fee is
   "not stated", which residents are told; zero is no fee.
8. **The type filter offers the public catalogue** — every office's active documents — because
   the office catalogue needs `issuance-type.manage`, which most of the roles working requests do not
   hold. A request for a retired document is listed under "every document", and the screen says so.
9. **The history names the side and the account as given.** The console cannot name a member of
   staff (`DL-165`), so it says "You" for the signed-in account and shows the ID otherwise.

### Not done, and what the API would need

- **The residents' side** is the mobile app's (FR-RES-15), and is not built here.
- **No filter by resident or reference** on the office list: the API has none. A resident at the
  counter is found by the queue's order and the reference they quote.
- **The backend's parity test** (`tests/casework.test.ts`) skips the two keys in
  `NOT_YET_IN_CONSOLE`; now the console names them, that list can be removed so they are compared like
  every other key.

## DL-185 — the UAT round: console bugs found while writing the test scripts, fixed where the API already serves the fix

Writing the UAT scripts (`cbc15f9`) walked every screen by role and found screens that said one
thing and did another. Each was checked in the code first; all were real. `DL-184` is reserved for
Document Request.

### Fixed in the console

- **Referrals.** "Record outcome" no longer starts at `served`: where the outcome leaves the
  referral is chosen from an empty list and the button waits for it. The compose form names what a
  referral is about — one of the person's open cases or filed requests — and a social worker, whose
  registry search is closed (`DL-183`) and whose unlinked draft the server refuses (403), composes
  from their own assigned cases and requests instead of the person picker; the mock refuses the
  same draft. The basis and share buttons say what they do. A refused act shows the server's field
  messages where the envelope carries them, and is not said twice where the HTTP layer already said
  it. The list's route and menu entry now read `case` and `assistance-request` too.
- **Dashboard.** Figures send `open` (the request list's key), not `openOnly`. The request list
  reads `barangay` and offers a barangay filter to an office-wide reader only. The release list
  reads `q`, `status`, `kind` and `open` from the URL and writes them back (`DL-36`). A narrowing
  the target list cannot apply (programme type, "still owing a document", a barangay on releases)
  is said on the list, never dropped silently. "Record a request" opens the intake form; "Schedule
  payouts" opens `for-release`; "Waiting for an ID review" opens `/verification` for a reviewer.
- **Releases.** The prepare page links the request's real route. A session counts unclaimed apart
  from deferred (`DL-94`); the API folds the two together today, so a session read from it says
  "deferred or unclaimed" (`unclaimed: null`) rather than pinning either count on the other, and
  `check:releases` now fails if the two are counted as one again. Opening a payout session is
  offered only with `release.schedule`. "How" shows the method's label.
- **App audit trail.** `office_case.task_cancelled` and `office_case.request_unlinked` have words.
  Every other action the committed backend emits already had them.
- **Menu.** Field visits asks for `visit.view`, as its route does. Residents, Households and
  Families carry `closedTo: ['assigned-cases']`, and their list routes a matching `scopeGuard`, so
  a caseload is neither offered nor admitted to registry lists the server refuses; their records
  stay reachable from a case or request (`DL-183`). "Try again" re-reads on the request, case,
  release, referral, visit and family pages that showed it and did nothing.
- **Other.** A resumed intake draft says its applicant, from the profile already read for it. The
  document-number note says only the last four characters are kept. Ending a relationship — served
  by the API, with a port and an adapter no screen called — is offered on the family record, with a
  required reason, and says first that the relationship is kept.

### Not done, and what the API would need

- **Sector history**: there is no read route for a resident's sector events ("the reasons have no
  read route yet"), so no screen offers it.
- **Release list**: `barangay_id`, a programme `category`, a period, and a "handed over" group
  (released, claimed, completed), so the payout figures open exactly what they counted.
- **Request list**: a programme `category` and a "still owing a document" filter, for the
  category and missing-requirements figures.
- **App accounts**: a `verification_status` filter on the account list, so each verification row
  opens its own accounts.
- **Session progress**: `unclaimed` counted apart, `deferred` holding deferred only.
- The `issuance_request.*` audit actions belong to the Document Request work (`DL-184`), not yet
  committed in the backend, and are left to it.

## DL-186 — the follow-up round: every dashboard figure opens exactly what it counted, a session counts the unclaimed apart, the texts residents accept are published here, and "Try again" always does something

The backend served what `DL-185` said the API would need: `taytay-backend` `0d1cb14` (issuance: a
request found by its whole reference, `resident_id`, `VERIFICATION_REQUIRED`, an idempotency key on
the resident's sends), `77da0b2` and `0f1ffec` (the Terms of Use and the privacy notice readable and
published by an administrator), and `84c7159` (the dashboard's filters on the lists it links to, and
`deferred_only` and `unclaimed` on a session's progress). The spec vendored here is `0f1ffec`'s (228
operations).

### Every dashboard figure opens a list filtered to exactly that figure

- **Requests.** The list reads `category` and `missingRequirements` from the URL and sends them as
  `category` and `owing_document` — the server counts "missing requirements" with the same SQL. A
  programme type box and a "still owing a document" box are offered to every reader: neither is a
  matter of data scope. `DL-185`'s notice that the list could not narrow that way is gone.
- **Releases** (list and queue). `barangay`, `category`, `group=handed-over` and `period` are read
  from the URL and sent as `barangay_id`, `category`, `status_group` and `period` (`all-time` is
  not sent: it narrows nothing). The barangay box is offered to an office-wide reader only; an
  own-barangay reader's link still carries its barangay and the server decides (another is 403). The
  released-amount figure and each programme row of the money table now open **everything handed
  over in the period** — released, claimed or completed. They used to open `status=released`, which
  left out what had been claimed or completed: a wrong list, not only an unapplied filter. Payouts
  due and unclaimed open by status, with no period, as they are counted. Notice gone.
- **App accounts.** `?verification=` narrows the list to the open residents' accounts with that
  status, sent as `verification_status`. Each verification row opens its own — including "waiting
  for an ID review", which `DL-185` sent to the review queue: that row counts **accounts**, the
  queue counts **reviews**, and the queue keeps its own headline figure. The status narrows the list
  and is not read onto a row, which still carries the minimum (`DL-168`).
- **The whole path is tested**, link by link: the drill-down's query parameters, read by the list
  the link opens, reach the request its HTTP adapter sends (`dashboard-links.spec.ts`). The mock
  adapters apply the same narrowings, and one function reads a mock account's verification for both
  the dashboard's figures and the list.

**Still not exact, and what the API would need:** the referral list reads no barangay and no
programme type, though "referrals waiting for an answer" is counted by both — the list now says so
when a figure carries them, as `DL-185` did for the other two lists, rather than dropping them; and
the accounts headline ("registered", "new in the period") opens the whole account list, because the
list has no "open residents' accounts" narrowing without a status and no period.

### A session counts the unclaimed apart (`DL-94`)

The mapper reads `deferred_only` and `unclaimed`, never the folded `deferred` the API keeps for
older clients, so a session says "1 deferred, 2 unclaimed". `BatchProgress.unclaimed` is a number
on every source and the "deferred or unclaimed" sentence `DL-185` needed is gone. `check:releases`
is stricter for it: it fails if `unclaimed` may be `null` again, if `describeBatch` says the two as
one, or if `toReleaseBatch` reads `deferred` or stops reading either count — each rule tried against
a planted regression.

### A resident's document request is found by its number

- **A reference box** on the queue finds one request by its **whole** number, in whatever status,
  inside the offices the account reads. The API refuses part of one (422), so part of one is refused
  before it is sent (`wholeIssuanceReference`), in words, by the page, the HTTP adapter and the mock.
  While a number is looked up the status and document filters stand aside, and the screen says so.
- **One resident's requests:** `?resident=` (the app account, `resident_id`), linked from the request
  page as "This resident's other requests".
- **`VERIFICATION_REQUIRED`** joins the error vocabulary (`check:contract-drift`). Only a resident's
  app is sent it; should it reach the console it is said as a refusal in the server's words and is
  not taken for a missing grant (no `/forbidden`).
- **The idempotency key** on submit, cancel and resubmit is the resident's app's, and changes nothing
  here.

### The Terms of Use and the privacy notice are published here

**Supersedes `DL-170`'s "the privacy notice's text is the API's own and no route changes it"**, and
with it the half of `check:app-settings`'s rule 5 that kept the mapper from reading the text.

- **The legal texts are editable by an administrator** (`app-config.manage`) in the App settings
  screen, **each with an explicit version the administrator chooses**. The API never derives or
  bumps a version; publishing a text sets the version residents are asked to accept to its own.
- **A version change asks every resident to accept the text again** in the app. The confirmation —
  the existing one, effects before the button — says so plainly, and a new version needs the
  administrator's acknowledgement, like a newer oldest app version. **The same version changes the
  text without asking anyone to accept again**, and the confirmation says that too, with the advice
  to keep a version only to correct a mistake that does not change what residents agree to.
- **No legal text is invented or pre-filled.** While a text's version is `placeholder` the screen
  says no text has been written yet, the placeholder's own sentence is not shown as the text, and
  the editor starts empty; otherwise it starts from the published text. `placeholder` is refused as
  a version, as the API refuses it. The mock serves both texts as the API's placeholders.
- **Shown as text, never rendered.** The current text is shown as written, its formatting marks
  visible; the app lays them out. No HTML is made from it.
- The old version fields stay. A different version typed there beside a published text is refused
  before it is sent (the API answers 422); the same one says nothing more and is folded away.

`check:app-settings` gained rule 8 for the two texts — acknowledgement for a new version of either,
the effects for a new and a kept version and for writing no legal text, the placeholder said to have
no text, the editor started only from the published text, the placeholder's version refused, no
HTML, each text read whole and sent with its version, no invented text in the mock — and was tried
against ten planted regressions, each caught.

### "Try again" re-runs the load everywhere

Eighteen pages (24 panels) showed the shared error panel's "Try again" with nobody listening to it — events,
newsfeed, households, the resident record and form, the administration pages, beneficiaries,
programme detail, reports, search and the work queues. Fixed once, in the shared pattern:

- a failure from `toViewState` carries `retry`, which subscribes to the same read again on the same
  stream (the stream now stays open after a failure, waiting to be asked; after a value it completes
  as before, and a retry asked after the screen has gone sends nothing);
- `AsyncContent` tells a page that listens to `retryRequested` — that page owns its reload, and the
  read is not run twice — and otherwise runs the failure's own `retry`;
- a failure with neither gets **no button**, so no page can ship a "Try again" that does nothing.

### Not verified

Not run against a live API or the staging server; every request shape is held to the vendored spec
by the contract checks and the HTTP specs.

## DL-187 — the beneficiary registry is served: a projection over the resident registry, one history for every screen, utilization counted from releases, and no merge

`taytay-backend` `4ae9941` (migration `0038_office_beneficiaries`) and `fbb86fe` (the spec's named
envelopes) serve `BENEFICIARY_REPOSITORY`, a resident's assistance history and programme
utilization. The spec vendored here is `fbb86fe`'s (239 operations). Casework phase 6b; the
dashboard was 6a (`DL-182`). **Six ports remain unserved**: work, reports, search, governance, the
newsfeed and events.

### What the server holds, and what it never holds

There is **no beneficiary table and no beneficiary id** (`DL-71`, now true on the server). The
registry is a projection over `office_residents`, keyed on the resident's id, with the registry's
own scope and redaction (`personReadable`, `disclose`): `beneficiary.view` reads it; a caseload
(`assigned-cases`) is refused the list and reads its own clients' records (`DL-183`); a protected
record's given name is masked and not matched for a reader not shown it. The standing is **derived on
every read** — `applicant` from a filed request in an open status, `beneficiary` ("Recipient") from a
release handed over — and none of it is stored. The only two tables written are the pairs a
detection run holds and the findings people record, both append-only by trigger.

### One assembly, on the server

`assistanceHistory` (backend `office-beneficiaries/history.ts`) is the one assembly: filed requests
(a draft is not a request, `DL-63`), every release, and sent referrals (a draft referral was never
made). The list's figures, the beneficiary record and `GET office/residents/{id}/assistance-history`
all read it, so the resident profile and the beneficiary record cannot disagree about what a family
received. In this console `historySummaryFor` stays the mock's single assembly; the HTTP adapters
read the server's and assemble nothing. The timeline is still built here, by `buildAssistanceTimeline`,
from that one history; the list's "events" count is the server counting the same lines.

**Goods are counted, never valued** (`DL-93`): the history, the list and utilization carry money as
integer centavos and goods as a count, and `ResidentAssistanceHistory`, `BeneficiarySummary`,
`BeneficiaryDetail` and `ProgramUtilization` gained the count, so a screen never shows "₱0" for a
family that received rice.

### Decisions taken (the owner may overturn any; each is the easiest to reverse)

1. **Programme membership is not recorded by the API, and is said to be so.** No enrollment table was
   invented: no screen records one, and a table nothing fills would make "not a programme member" a
   false finding. On the wire `current_program_names`, `enrollments`, the enrollment evidence counts
   and the preview's `moving_enrollment_count` are `null`; in the domain those fields became nullable
   and the screens say `PROGRAMME_MEMBERSHIP_NOT_RECORDED` or "Not recorded" — never "Not enrolled".
   The `enrollee` standing is never derived, and a programme filter or the `enrollee` filter is
   refused in words by the adapter without a request (and by the server, 422). *For the owner:*
   should the office record programme membership (enrol, suspend, exit with a reason), and from which
   screen?
2. **A resident's history is `beneficiary.view`'s.** A reader of the record without it — the release
   officer and the barangay link — is answered `readable: false` with a sentence
   (`ASSISTANCE_HISTORY_NOT_YOURS`), with a 200, so the profile still opens. One key rather than a key
   per section, because the history is one picture and the role table already says who reads it
   (TAB 13's mock showed it to every reader of the record; the mock now follows the server). *For the
   owner:* should a barangay link see the requests (not the payouts) of residents in their barangay?
3. **A same-person finding is read across, never re-pointed.** Superseding moves nothing: the
   superseded record's requests, releases and referrals stay its own, and are read under the record
   kept — in the list's figures, the record and the history — each line still citing its own record.
   The superseded record leaves the list, stays readable by id (`superseded_by` on the wire), and is
   superseded once at most (the database refuses a second finding naming it). The preview counts what
   stays attached to the superseded record (filed requests, releases, cases about it) and names the
   programmes both records applied to.
4. **The duplicate review is refused to a caseload.** A social worker holds
   `beneficiary.review-duplicates`, but the queue, a detection run and a record's candidates span the
   registry, which `DL-183` keeps from a caseload; so a social worker sees no candidates, and the
   review is the MSWDO head's and the administrator's. Intake and the auditor are withheld it as
   before (`DL-74`). *For the owner:* should social workers review duplicates among their own clients?
5. **A pair holds the signals it was found on.** Detection compares every active record nobody
   superseded, holds each `strong` or `moderate` pair once (`weak` is not held, as the mock's matcher
   drops it), and records the signals as found — an attribute, an outcome and a rule; the database
   refuses a signal with any other key. A later correction to a record does not rewrite a pair already
   held; the reviewer opens both records. Re-running detection adds only new pairs.
6. **The finding's verdict travels in this console's words.** `distinct-people`, not the retired
   API's `different-person`: the Node API was written to the console's vocabulary, so `DL-148`'s
   translation is gone, and the server records which record is kept (`canonical_resident_id`) — the
   gap `DL-148` recorded is closed.
7. **Utilization is counted from releases handed over and nothing else**, and only for readers of
   payouts (`release.view`, not a caseload), as the dashboard withholds its payout group (`DL-182`);
   anybody else is answered `readable: false` with `PROGRAM_UTILIZATION_NOT_YOURS`. Per programme:
   releases handed over (money and goods), the money in centavos, and the goods counted. Figures the
   releases cannot give — filed, open, completed, rejected, approved totals, a remaining balance — are
   not served (`DL-159`, `DL-69`). `withheld` is the server's small-cell flag and is `false`: the
   figures go only to readers who can already list every release behind them, so a small cell hides
   nothing from them (`DL-105` is for counts of people that leave the office).
8. **The received period means a release handed over on those dates** (Manila), not the last activity
   of any kind as the mock used to read it; the mock now reads it the same way.
9. **The list is alphabetical, a cursor at a time** (`DL-161`): `BeneficiaryRepository.list` and
   `duplicateQueue` take a `CursorRequest` and the screens say "more available", never "page 1 of N";
   `BeneficiarySortField` is gone, because the contract sends no `sort`.

### What the console changed

`HttpBeneficiaryRepository` with `beneficiary.mapper.ts` (explicit `toWireIdentityDecision`; every
read whole or refused in words — a row, a line of history or a candidate left out would read as not
being there); `HttpResidentRepository.getProfile` reads the history; `HttpProgramRepository` reads
utilization; `UnservedBeneficiaryRepository` is gone and `check:routes`' unserved ceiling went from 7
to **6**. Two audit codes are labelled (`office_duplicate_pair.detection_run`,
`office_identity_finding.recorded`). Fixtures for every new envelope are held to the vendored spec.

**Still open:** the intake advisory on the server still says payouts and cases are not read
(`office-requests/advisory.ts`, `NOT_READ`); it could now read releases and cases, which is the next
natural step for `DL-60` and was not in this phase.

## DL-188 — production readiness: barangays are reference data, the first administrator comes from a committed command, the advisory reads payouts and cases, and a retried message posts once

`taytay-backend` `a7a1884` (migrations `0039_taytay_barangays` and `0040_message_intents`).
The spec vendored here is that commit's (239 operations; the operation count is unchanged
because no route was added, only bodies and descriptions). No port changed served/unserved state.
It closes the item `DL-187` left open: the server's advisory reads payouts and cases.

### Barangays exist in every database

Until `0039` the five barangays came only from `npm run seed`, which refuses production, and no route
adds one: a production database would have had none, so no resident could name where they live and
no barangay link could be scoped. The migration inserts them as **reference data**, with the seed's
exact codes and names, and skips any row whose code or name is already held (`ON CONFLICT DO
NOTHING`), so staging's seeded rows are untouched.

The names were checked against the PSA's PSGC page for the Municipality of Taytay (10-digit code
`0405813000`), `https://psa.gov.ph/classification/psgc/barangays/0405813000`, read on 2026-11-07:
"There are 5 barangays as of 31 July 2025" — Dolores `0405813001`, Muzon `0405813002`, San Isidro
`0405813003`, San Juan `0405813004`, Santa Ana `0405813005`. **The seed and the PSGC agree** letter
for letter; none of the 2026 PSGC update releases names a Taytay barangay. `code` is the API's slug
(`dolores`, …, `santa-ana`), not the PSGC code; the table has no PSGC column and none was added. The
console reads the list as before (`GET /barangays`) and needed no change.

### The first administrator: `npm run admin:grant -- --email …` (GL-13)

A committed command (`src/ops/`), run inside `taytay-api` so the Firebase key never leaves the
server. It finds the Firebase account by e-mail and refuses one that does not exist, is disabled, or
whose API account was closed; it creates the row a first sign-in would create, as `admin`, or raises
an existing row the way the role route does (office role cleared and recorded, current card
revoked); and it writes one audit row, `user.role_granted_by_bootstrap_command`, **with no actor**,
because no account did it. This console words that code — "Made an account an administrator, by the
bootstrap command run on the server" — and shows the actor as "No account recorded", as it does for
any row without one (`DL-171`). Running it twice changes nothing and writes nothing. **Not
rehearsed**: the staging README keeps "never run unrehearsed in production".

There is **no `admin:revoke`**: demotion stays in "Users and roles", audited under the administrator
who did it and refused on one's own account. A server command would be a second way to take a role
away that names nobody. The break-glass case — the only administrator is unavailable or compromised —
is Firebase "Disable account" (the API checks revocation on every token), `admin:grant` for a new
administrator, and a demotion in the console.

### The intake advisory reads payouts and cases (`DL-60`, `DL-177`)

`DL-177` recorded that the server's previous-assistance check could not read payouts or cases, and
named both in `not_read`. Since casework phase 6b it can, and now does, **under the keys that already
read them**: releases handed over to the applicant (through the one history assembly, `DL-71`, across
same-person findings, `DL-74`) with `beneficiary.view`; cases about the applicant that the case list
would show the reader with `case.view`. Two of the console's existing codes are now raised by the
server — `assistance-within-lookback` (twelve-month window) and `open-case` — both `note`s, so filing
asks no sentence for them and nothing is refused (`DL-60`). A line names a reference and a date or a
case reference; **no amount and no total**, unlike the mock's sentence, which still totals payouts —
the server's finding is the record's count, and the amount is the history's to show to a reader of
it.

`not_read` keeps at most one entry per source, so the panel's list (tracked by source) never repeats
one: `releases` for a role without `beneficiary.view` (the barangay link), or otherwise for payouts to
**other people at the address**, which the check does not read — so `household-assisted-recently`
is never raised yet, and the panel says why; `cases` for a role without `case.view`, or for a
caseload, which looked only among the cases assigned to it. The console's mapper, domain and panel
render all of this unchanged: the codes and sources were already in its vocabulary, and the
sentences are the server's.

### A retried office message posts once

The residents' app retries a send after a timeout, and nothing told a retry from a new message: the
office read the same plea twice. `POST threads` and `POST threads/{id}/messages` now take an optional
`idempotency_key` in the body (a multipart field with a file), exactly as document requests do
(`0036`, the CORS policy is not widened for a header): the same key, sender, act, words and image
replays the first send's message — before anything is read or stored, without notifying anybody
again, even after the thread closed — and the same key with other words or another act is `409`.

This console's staff reply now carries one. `OfficeInboxRepository.reply` takes a `WriteIntent`
(`domain/shared/write-intent.ts`), minted by the thread page when Send is pressed and **held while
the same words are sent again**; new words are a new send with a new key, and the key is dropped on
success and when another conversation opens. The mock replays by key as the API does.

**The residents' app is not changed** by this round. To use it, it would: add a required
`idempotencyKey` to `send()` and `reply()` in
`lib/features/messaging/data/office_messaging_gap_repository.dart` and put
`'idempotency_key': idempotencyKey` in the body map (it travels as a multipart field when a file is
attached, as on document requests); mint the key with `generateIdempotencyKey()` where the resident
presses Send and hold it across every retry of that same message, minting a new one for new words or
a new image; accept the replay's status (`201`, or `200` for a message added to an already-open
thread — as now); and treat a `409` naming the key as a fault in the app, not something to retry.

### A requirement may not be coded `idempotency_key`

The document catalogue editor's `RESERVED_REQUIREMENT_CODES` lacked `idempotency_key`, which the API
reserves (`RESERVED_FIELD_NAMES`) and refuses: the editor now says so in words before the save, as it
does for `type_id`, `purpose` and `note`.

### Decisions taken (the owner may overturn any; each is the easiest to reverse)

1. **The barangay rows keep the seed's slugs as `code`, and no PSGC column is added.** The PSGC code
   is cited in the migration beside each row. Adding a `psgc_code` column later is additive.
2. **The bootstrap audit row has no actor and its own code** rather than `user.role_changed` with an
   invented actor. *For the owner:* should the audit table gain a `source` column instead?
3. **No `admin:revoke`** (above). Adding one later is a small command beside `admin:grant`.
4. **The advisory states no amounts** for payouts, and reads only the applicant's own. *For the
   owner:* should the household's payouts be read (the console's `household-assisted-recently`
   caution), and under which key, given that it tells an encoder about other people's assistance?
5. **Message keys are per sender**, as document-request keys are per resident; a key is never
   shared between a resident and the office.

## DL-189 — search and the work queues are served: each record type searched through its own list, every type answered for, and a queue that is a view

> **UAT scripts since 2026-11-07 (noted 2026-11-08).** The closing "No UAT script covers My work,
> the team's queue or search yet" no longer holds: SRCH-01 to SRCH-04 and WRK-01 to WRK-06 cover
> them (`docs/uat/uat-test-scripts.md`, version 1.2, `80755ea`).
>
> **Accents since 2026-11-08.** The owner question in decision 1 is settled without `unaccent`:
> `taytay-backend` `6e2215b` folds accents and ñ with `translate()` on both sides of
> `visibleNameMatch`, the one rule behind the registry list, global search and the request and case
> searches, so "Pena" finds "Peña" and the reverse. It needs no extension a managed database might
> refuse, and it matches what the mock's `normaliseForSearch` already did.

`taytay-backend` `e76c715` serves `SEARCH_REPOSITORY` and `WORK_REPOSITORY`. The spec vendored
here is that commit's (243 operations). Casework phase 6c, after the dashboard (6a, `DL-182`)
and the beneficiary registry (6b, `DL-187`). **No migration.** **Four ports remain unserved**:
reports, governance, the newsfeed and events.

### Search: the doctrine is the server's now

`GET office/search?q=` takes one term and nothing else — any other parameter is a 422 — so a caller
still cannot ask search to read something a result may not show (`DL-109`). The server searches each
record type **through that list's own repository, filter and scope** — the request list's filed-only
rule and caseload, the case list's caseload, the family list's barangay rule — and counts each
group's total with **the same where-builder as the page**, so a group and the list it opens cannot
disagree about who may be seen. The registry's lists gained a `count` beside `list` for this, and no
second, looser query was written.

**It matches only what a hit shows**, on the server: residents by the names the reader is shown (a
protected person's given names only with `request.view-sensitive`, through the registry list's own
rule, now one function both use); filed requests and cases by reference or their person's shown
names; households by reference; families by name or reference; programmes by name or code. The
lists' own `q` reads more on some lists — a household's street and head's surname, a programme's
description — and search does not: those lists gained a flag that narrows the words to the closed
set. No note, finding, remark, outcome, reason for a request, PhilSys digits, income, sector, birth
date, address or contact is matched or returned: the backend's tests plant a reason for a request,
a case summary, a programme description, a street, PhilSys digits, a birth date and an income, and
find none of them.

**Every type is answered for** (`DL-112`): searched, with its total and at most five hits, or named in
`not_searched` with why — `not-permitted` without the list's key, `caseload` for a social worker and
the registry's three types, which `DL-183` keeps from a caseload. The console's mapper refuses an
answer that leaves a type out, rather than reading it as "nothing matched".

**Nothing is kept or logged.** The API's request log records the path and never the query string;
the staging proxy's site block in the backend repository declares no access log; there is no recent-search store on the server (`DL-110`). The
term travels in the request's query string as every registry list's `q` already does, and never in
the address bar (`DL-137`).

### The work queues: a view, assembled on every read

`GET office/work/mine` and `…/team` (`staff.view`) answer a queue whole; `GET office/work/alerts` a
bare list. There is no write anywhere in the module (`DL-97`). Each source is read **through its own
list's repository and scope** — open case tasks (a new read on the case repository, under the case
list's where-builder), filed requests by status, scheduled visits, the referral follow-up queue, the
open release queue — and an item is listed only to a reader holding the key that acts on it and the
list's key. A source with more than 5000 open records in scope is refused (503), never cut short.
Only a case task is manageable, and its acts stay the case routes', each with a reason. A request
carries **no due date and the day it was filed** (`DL-101`). A task's title on a protected case is
withheld from a reader not cleared for it, and every person is named as the registry names them to
that reader (the payout table's `listedName`, moved to the registry's disclosure module and shared).

Every item kind and alert the mock adapter derives has its source on the server, so none needed a
not-connected answer (`DL-175`).

### Decisions taken (the owner may overturn any; each is the easiest to reverse)

1. **No migration, and no `pg_trgm`.** The term is matched with `lower(…) LIKE '%word%'`, as every
   registry list's `q` already is; a leading wildcard cannot use a btree index, and `pg_trgm` is
   neither loaded in the test database (PGlite) nor used anywhere. At one municipality's registry a
   scan under the lists' own filters is enough. *For the owner:* accent-insensitive matching
   ("Pena" finding "Peña") would need `unaccent` on the server; the lists do not have it either.
2. **Inactive residents are found, and said to be inactive**; dissolved families are not, as on
   the family list (a family hit carries no status to say so).
3. **A request in `assessment` is owed by its assessor; every other request step by the pool of
   whoever holds its key.** The mock put every request on its assignee's list, which left an endorsed
   request on the social worker who endorsed it — where they cannot approve it and the head never sees
   it in "My work". Releases are the release pool's, a visit the worker sent, a referral whoever made
   it, a task its assignee.
4. **The keys that act**: a visit needs `visit.manage` (the mock asked `case.view`, from before visits
   had keys of their own), a referral follow-up `referral.manage` (the mock asked `referral.view`);
   the rest are the mock's.
5. **A referral's preview is its reference, not the service requested** — the mock showed the latter,
   a sentence about the client on a list read by everybody who holds the key.
6. **A case task's kind**: `home-visit`, `document`, `assessment` and `referral` map to the queue's
   kinds; `follow-up` and `review` keep the mock's fallback (`close-case`). The kind is shown on no
   screen; the task's own title is.
7. **The team queue is the work the reader could act on**, as the mock assembled it: the head, who
   approves and does not pay out, sees no "release and record the receipt" items on it. *For the
   owner:* should supervision show every open item regardless of who could act on it?
8. **`missing-requirement` is served as an alert** (the mock derived none; the dashboard counts the
   same condition), with the dashboard's own basis.
9. **The duplicate alert says when the registry has never been checked.** Pairs exist only after
   somebody runs a detection pass, so "no pairs" before the first pass would be a false all-clear; the
   alert is then a notice that no check has run, with a count of 0. Once a pass has run it counts the
   open pairs, strong and moderate, says when the pass ran, and that records added since have not
   been compared.
10. **`as_of` is echoed and decides only whether a passed chase date reads as urgent**; it widens
    nobody's access. `alerts()` takes no parameter and reads Manila today.

### What the console changed

`HttpSearchRepository` with `search.mapper.ts` and `HttpWorkRepository` with `work.mapper.ts`, each
read whole or refused in words; a term too short to search is answered without a request, as the
mock answers it. The team queue is grouped here by `buildTeamQueue`, exactly as the mock groups it.
`UnservedSearchRepository` and `UnservedWorkRepository` are gone and `check:routes`' unserved ceiling
went from 6 to **4**. `/work` is in the menu again for the roles that hold `dashboard.view`.
`check:search` and `check:work` now hold the served adapters to the same line as the mock — the
mapper reads no never-searched field in either spelling and accounts for every type, one term is
sent, the work adapter has the port's three reads and no write verb, manageability is derived from
the source, and an alert without a basis is refused — each validated against a planted regression.

**Still open:** the mock adapter was left as it was, so `local-mock` still differs from the server on
decisions 3 to 5 (an endorsed request on its assessor's list, a visit behind `case.view`, a
referral's service requested as its preview); bringing it into line touches `check:work`'s rules on
the mock and was not in this phase. No UAT script covers My work, the team's queue or search yet.

## DL-190 — reports are served: counted on the server under each reader's scope, small counts of people withheld there, and a file that carries its own conditions

> **UAT scripts since 2026-11-07 (noted 2026-11-08).** The closing "No UAT script covers reports
> yet" no longer holds: RPT-01 to RPT-10 cover them (`docs/uat/uat-test-scripts.md`, version 1.2,
> `80755ea`).

`taytay-backend` `9d81454` serves `REPORT_REPOSITORY`. The spec vendored here is that commit's (246
operations). Casework phase 6d, after search and the work queues (6c, `DL-189`). **No migration.**
**Three ports remain unserved**: governance, the newsfeed and events.

### What the server holds now

`GET office/reports` answers the catalogue this account opens, a bare list in catalogue order: the
console's fourteen definitions, word for word, held on the server to the same `reportProblems`
(`DL-104`) by its tests. Thirteen are counts; `data-completeness` names people, states why, and needs
`report.export-person-level` to open at all. Each report needs its own key on top of `report.view`
(`staff-workload` `staff.view`, `release-status` `release.view`, `referral-outcomes`
`referral.view`). Not found and not yours are one answer, a 404 (`DL-31`).

`GET office/reports/{id}` counts in SQL on the read, **under the scope the list behind each figure
reads with**: a barangay link inside its barangay; a social worker over the cases, filed requests,
visits and referrals assigned to them. Filters are `period`, `barangay_id`, `program_id` and
`status`; the period is counted on the Manila calendar, and what it counts by is the report's own
and said in the coverage line ("Last 90 days, by the day each case was opened"). **A filter a report
does not honour is refused** (422), never ignored — "offering one it ignores is a lie" now holds on
the server as on the screen.

**Suppression is the server's** (`DL-105`). Every series whose `measure` is `people` or
`households` goes through it on the way out; there is no argument that skips it. A count from 1 to
4 is withheld — row and label kept, `value` null, no drill-down — never dropped, rounded or zeroed;
zero is shown. The total is taken **before**. Rows are never ordered by a hidden figure (shown
figures largest first, then withheld rows by label, then zeroes), so the order cannot say which of
two withheld rows is larger, and the sentence beside a table names only a row it shows. The
threshold is 5, `convention-pending-confirmation`, stated in every answer. **Nothing can ask for
the figures before suppression**: the query schemas are strict, so `raw`, `suppress`, `threshold`,
`include_small`, `debug` and every other undeclared parameter are a 422 for every role, the
administrator included — the backend's tests try seven such parameters on the report and on the
export, as an administrator, and check the spec documents no other parameter.

`GET office/reports/{id}/export` needs `report.export-person-level` as well — producing a file is a
separate grant from reading a figure, as the mock already held — and **composes the CSV on the
server** (`DL-106`), like the payout list (`DL-92`): the report, its question, the filter in words,
when and by whom, the rows, whether it names people, what was withheld and why, what could not be
counted, and the RA 10173 handling rule, inside the file before the first figure; a cell a
spreadsheet would evaluate is guarded as `csvCell` guards it. **Exporting is audited**
(`office_report.exported`, `office_report.person_level_exported`), and so is **opening the report
that names people** (`office_report.person_level_read`); the platform audit screen words all three.

### Which reports are served whole, and which say what they cannot count

Each result carries `limits`: what the report's question needs and the records do not hold, in
words, never a zero (the doctrine of `DL-175`). The console shows them under "What this report
cannot count" and the server writes them into the file.

- **Served whole**: caseload, the assistance pipeline, case aging, field visit workload, release
  status, referral outcomes, beneficiaries by barangay and requirements bottlenecks.
- **Programme utilisation**: releases handed over and money handed over by programme, goods counted
  and never valued; *cannot count* programme membership, which is not recorded (`DL-187`).
- **Household vulnerability indicators**: households with a member in each sector, as the mock
  counted; *cannot count* the household vulnerability factors across households, which are worked
  out for one household when it is opened.
- **Demographic service reach**: people served in each sector; *cannot show who was missed* — the
  office holds no count of how many people in each sector live in Taytay.
- **Repeat assistance**: households by how often they applied and by the shortest time between two
  applications (the "how soon" the question asks, which the mock did not count); *cannot count*
  applicants in no household on file, said with their number — or, when that number is below the
  threshold, said without it.
- **Staff workload**: open case tasks, requests in assessment and visits still scheduled, by person;
  *cannot count* referrals and releases, which have no holder on file.
- **Data completeness**: *does not look for* a gap in a field the registry withholds from the reader
  — PhilSys without `resident.view-sensitive`, a protected person's mobile number without
  `request.view-sensitive` — and says so.

### Decisions taken (the owner may overturn any; each is the easiest to reverse)

1. **The two protected sectors are not counted at all for a reader without
   `request.view-sensitive`** — stricter than the mock, which showed them to everyone with
   `report.view`. Their rows stay, marked withheld whatever the figure, and are **left out of the
   total**, so subtracting the shown rows from the total says nothing about them. Today that reader
   is the auditor and the release officer.
2. **A social worker is offered six reports, counted over their caseload** — caseload, pipeline,
   aging, visits, referrals, requirements — and not the five that count the registry or payouts,
   which a caseload's lists refuse (`DL-179`, `DL-183`). The mock gave them office-wide figures. A
   report outside a reader's catalogue is a 404, like one that does not exist.
3. **Aggregate rows carry no drill-down**, as in the mock; only the person-level report opens a
   record, by `resident_id`. A drill-down to a list that does not count by the same rule would
   disagree with its figure in front of the reader. "The drill-down goes with" a withheld cell holds
   structurally: the server sends none on a withheld row, and the mapper refuses one that does.
4. **Drafts are not counted**: request figures are the filed ones, as the request list and the
   dashboard read them. The mock counted drafts, and an aging bucket "Never submitted".
5. **Ordinal series keep their order** (aging buckets, times applied, time between applications);
   the mock sorted them by size. Status series stay largest first, as the mock had them.
6. **"People served" is everybody handed a release, counted once across records found to be the
   same person** (the beneficiary registry's owners), in the barangay their record names now; a
   record since deactivated was still served and is counted.
7. **Staff workload lists every open staff account with an office role, and any account still
   holding an open item**, by name, the unassigned last; its sentence names nobody as the largest
   (the mock's summary named the largest row on every series, this one included). No rate, score or
   rank anywhere in the answer, which the backend's tests check field by field.
8. **The audit rows name no report** (`subject_id` is a uuid and a report id is not): an aggregate
   export is `office_report.exported`; the person-level report has actions of its own.
9. **The person-level report is listed whole or refused** (503 past 5000 records — narrow it to a
   barangay), as the work queues are (`DL-189`).
10. **Only CSV is composed**; the port's `printable` format is refused by the adapter without a
    request.

*For the owner:* **a total taken before suppression discloses a lone withheld figure by
subtraction.** When one row of a series is withheld, the total minus the shown rows is that row's
figure. The doctrine asks for both — the true total, and the small figure withheld — and they
conflict exactly then. The usual remedy is secondary suppression (withholding a second, larger
cell, or the total), which this office has not adopted; the server follows `DL-105` as written.

### What the console changed

`HttpReportRepository` with `report.mapper.ts`. The mapper **refuses rather than renders** an answer
that shows what it should have withheld: a series about people with a shown figure below the
console's own `SMALL_CELL_THRESHOLD` (so a server that lowered its figure is refused here), a
withheld row with a figure, words or a record to open, a total smaller than the shown rows plus one
for each small figure withheld, a series with no summary (`DL-108`), a definition `reportProblems`
rejects, a record to open on an aggregate report, and a file whose content does not carry its
conditions or says it names nobody when its manifest says it does. Money is formatted from integer
centavos with `describePesos`; a money series carries `totalDisplay`. A barangay filter is sent as the API knows the barangay, through the same join by name the registry adapters use, and read back as the console's. `ReportResult` and
`ExportManifest` gained `limits`, and `manifestHeaderLines` writes them into the mock's file too.

The screen shows the limits, the total in words where it is money, and **offers the file to save**:
the export used to say "Export ready." and hand the user nothing. The composed text becomes an object
URL through `ObjectUrls.makeText`, offered as a link carrying the file's name, and given back when the
page is left. Filters reset when another report is opened, so a filter one report honours is never
sent to one that would refuse it.

`UnservedReportRepository` is gone; `check:routes`' unserved ceiling went from 4 to **3**; `/reports`
is in the menu for the roles that hold `report.view`. `check:reports` now holds the served adapter
and mapper too — named filter keys only and no write verb, every refusal above, the file from the
data layer's text — each rule validated against a planted regression (13 of 13 caught).

**Still open:** the mock adapter was left as it was, so `local-mock` still ignores the period and
programme filters, counts drafts and shows the protected sectors to every reader. No UAT script
covers reports yet.

## DL-191 — governance is served: one account store, a switch that ends the session at its next request, and a trail that says what it does not record

> **UAT scripts since 2026-11-08.** The closing "no UAT script covers governance yet" no longer
> holds: GOV-01 to GOV-08 and AUD-07 cover it (`docs/uat/uat-test-scripts.md`, version 1.3).

`taytay-backend` `3a7947c` serves `GOVERNANCE_REPOSITORY`. The spec vendored here is that commit's
(255 operations). Casework phase 6e, after reports (6d, `DL-190`). **Migration `0041`, additive:**
`users.deactivated_at`, the append-only `account_status_changes`, and the two correction-request
tables. **Two ports remain unserved**: the newsfeed and events.

### What the server records, read before anything was written

- **`audit_log` keeps six things a row** (`0009_audit.sql`): who, which action code, which kind of
  record, which record, when, and its id. **No field names, no earlier or later value, no reason, no
  channel.** A reason is kept beside the act in the record's own history (`office_role_changes`,
  the case and request events) and is not joined onto the trail.
- **The trail already holds both populations.** The casework modules write `office_*` codes and
  the account routes `user.*`; Balita, the directory, digital IDs, ID review and the app's settings
  write theirs. `GET admin/audit` (`DL-171`) lists every row by id.
- **There was no deactivation.** `users` had `closed_at` — a resident's own anonymising closure,
  which cannot be undone — and no switch an administrator could turn off and on. `resolveUser`
  reads the account's row on every request, and `rejectClosedAccount` refuses a closed one; the
  Firebase verifier checks revocation. Nothing recorded a sign-in, an employee ID, a unit, an office
  contact or a position for staff.
- **Nothing held a correction request.**

### What is served

| Route | Grant | What it answers |
| --- | --- | --- |
| `GET office/staff`, `…/{id}` | `staff.view` | Staff and admin accounts not closed, by name, the whole list (503 past 1,000): id, name, tier, office role, scope barangay, on or off |
| `POST office/staff/{id}/deactivate`, `…/reactivate` | `staff.manage` | `{ reason }`, kept in `account_status_changes`; audited `user.deactivated` / `user.reactivated`; 403 for the caller's own account; 409 when already so |
| `GET office/audit` | `audit.view` | The office's trail, a cursor page: `office_*` and `user.*` rows in words, `fields_recorded: false`; filters `q`, `action`, `record_type`, `actor_id`, `from`, `to` |
| `GET office/audit/{id}` | `audit.view-detail` | `values_recorded: false`, no change, a notice; audited `office_audit.detail_read` |
| `GET office/governance/classifications`, `…/retention`, `…/corrections` | `settings.manage` | Fixed configuration, every retention period null; correction requests from their table |

### Decisions taken (the owner may overturn any; each is the easiest to reverse)

1. **One account store** (`DL-115` as served). The directory reads the `users` table Users and
   roles reads (`DL-168`), narrowed to staff and admin accounts that are not closed. A closed
   account is anonymised and has nobody left to name, so it is not listed; a switched-off one is,
   marked off. No email, mobile or address is sent: the directory's question is who may act.
2. **What is not held is said, never filled in.** `StaffAccount` gained `lastSignInRecorded`, and
   `role` and `position` became nullable. On the API `profile` is null, `position` null and
   `lastSignInRecorded` false, and the screen says **"Not recorded"** for unit, ID and last sign-in
   — never "Never" or a blank. A staff account with no office role reads **"No office role yet"**
   rather than being left out. `staffRoleLabel` in the domain names a role; `check:auth` keeps
   `ROLE_DEFINITIONS` out of `data/http`, and a label decides nothing.
3. **Switching off is a column and a guard, not closure and not Firebase** (`DL-116`).
   `users.deactivated_at`; `rejectDeactivatedAccount` answers **401** to every request but `GET /me`
   and `POST auth/sign-out` — at the session's **next request**, because `resolveUser` reads the row
   every time. `GET /me` says `deactivated: true` with no permissions; the console's `me.mapper`
   asks `canHoldSession` and opens no session, like a closed account, and a missing flag is refused
   like a missing `closed`. **Firebase is not told**, so switching back on needs nothing from it and
   there is no half-done state between two systems.
4. **Never the caller's own account, on the server** — the route refuses it (403) and
   `account_status_changes_not_self` refuses the row. One administrator may switch another off.
5. **A reason, always, kept beside the act.** `account_status_changes` is append-only (the history
   trigger); the switch and its row are one transaction under the account's lock. Switching to the
   state the account is already in is **409**, not a second record.
6. **A switched-off account keeps its role until it is switched on.** `PATCH admin/users/{id}/role`
   answers 409 meanwhile: moving it to a resident tier would leave a resident refused by the app with
   no screen that lists them.
7. **The office's trail is the casework and staff-account codes, in words.** The residents' app's
   rows stay on the app's trail (`DL-171`). The words are the console's own for the app's trail,
   copied to `trail.ts` and compared by a backend test, and a test fails when a code written
   anywhere in the backend's `src` has no words — a code missing from the table would vanish from
   the office's trail.
8. **Fields not recorded is said on the row** (`DL-114`). `AuditRow` gained `fieldsRecorded`;
   `toAuditRow` takes `null` for "not recorded" and keeps `changedFields` an empty list. Such a row
   is **not counted as touching sensitive information either way**, and `describeAuditRows` says
   which fields changed was not recorded. The row reads "Which fields changed, and their values
   before and after, were not recorded."
9. **"Only sensitive" is refused, not answered** — by the adapter, without a request, in words; the
   server's query schema has no such key (422). An empty answer would read as "nothing sensitive was
   touched", which nobody knows.
10. **The detail says no value was stored, and the opening is still audited.** `AuditEntryDetail`
    gained `valuesRecorded` and `notRecorded`. Rows say `hasDetail: false`, so the screen offers no
    button that opens nothing; the read exists, gated by `audit.view-detail`, and the mapper refuses
    a detail that carries values.
11. **The trail is browsed a page at a time** (`DL-161`). `auditRows(filter, page)` returns a
    `CursorPage`; the screen shows the newest fifty and "Show older entries", and while more exist
    says how many are shown rather than a total. The mock pages the same way.
12. **Source is `api` or `system`.** Every request reaches the server through its API; which screen
    sent it is not recorded. A row with no actor (the first-administrator command) is `system`, its
    actor "The server, with nobody signed in"; a closed actor is "An account since closed", an
    unnamed one "An account with no name recorded".
13. **Classification and retention are fixed server configuration**, not a table: a period with
    legal weight changes through a reviewed commit, and nothing writes either list. Retention
    invents nothing (`DL-113`): every period, basis and disposal note is null, every provenance
    `awaiting-office-policy`; the mapper refuses a period with no office schedule behind it.
14. **Correction requests are read from a real table** (`office_correction_requests` and its
    fields), in the console's four words, with the answered-in-words and terminal rules held by the
    table. Nothing writes there yet, so the list is empty until capture is built, which the page
    already says (`DL-117`).

### What the console changed

`HttpGovernanceRepository` with `governance.mapper.ts`, which **refuses rather than renders** a row
claiming its fields were recorded, a detail carrying values, a retention period with no office
schedule, an applied or refused correction without its words, an administrator not called the
system administrator, and a barangay it cannot place — whole answers or none. A switch is sent with
the reason alone, as `toWireAccountSwitch`. `UnservedGovernanceRepository` is gone; `check:routes`'
unserved ceiling went from 3 to **2**. `check:governance` gained a section for the served adapter —
not recorded is said, sensitivity is never inferred, values are refused, a reason before any switch,
`canHoldSession` on `/me`, "Not recorded" on the staff page and on a row — each rule validated
against a planted regression (13 of 13 caught). The app's audit trail words the three new codes.

### For the owner

- Whether switching an account off should also disable it in Firebase (decision 3).
- Whether the trail should start recording which fields changed — an `audit_log` change — so a row
  can say what moved and how sensitive it was, and "only sensitive" can be answered.
- The record types the server holds that the classification list does not name: cases, home
  visits, families, ID-verification images, inbox messages, digital IDs and staff accounts.
- The office's records disposition schedule under RA 9470.
- When capturing a correction request is to be built, and who may answer one.

The staff page offers no switch on the signed-in administrator's own row and says why, as Users
and roles does for a role (`DL-168`).

**Still open:** no UAT script covers governance yet (`docs/uat/` was left to the agent writing it).
The mock still records sign-ins and profiles the API does not, so `local-mock` shows a unit and an ID
where the API's console says "Not recorded".

## DL-192 — events are served: the office runs them, residents register in their own app, and the last place is the server's to give

> **UAT scripts since 2026-11-08.** The closing "no UAT script covers events yet" no longer holds:
> EVT-01 to EVT-11 cover them (`docs/uat/uat-test-scripts.md`, version 1.4). Their resident steps
> wait for an app build that includes events (D-191 in the app's decision log). Writing them found
> that an event's page announces an export of its registrants but offers no way to save the file,
> so the handling notice inside it cannot be read; EVT-07 is Blocked until it can. Fixed the same
> day: the page offers the file as a link to save, made from the text the data layer composed and
> given back when the page closes, as a report's export is (`DL-190`); EVT-07 runs whole.

`taytay-backend` `580acbb` serves `EVENT_REPOSITORY`, and the residents' side the Flutter app will
be wired to. The spec vendored here is that commit's (277 operations). Casework phase 6f, after
governance (6e, `DL-191`). **Migration `0042`, additive:** `office_events`,
`office_event_registrations`, the append-only `office_event_acts` (every act, with its reason),
`office_event_registration_intents`, a reference sequence, and the `event_registration_updated`
notification type. **One port remains unserved: the newsfeed**, whose future is the owner's
(OD-4). Events were built on Ella's instruction of 8 November 2026, ahead of OD-4 being recorded
as decided for them.

### What is served

| Route | Grant | What it answers |
| --- | --- | --- |
| `GET office/events?view=&q=&category=&from=&to=` | `event.view` | One of the six views, derived from the status and the clock, soonest first, the whole view (503 past 2,000); each event carries the counts that read took |
| `POST office/events`, `PATCH office/events/{id}` | `event.create` / `event.edit` | A draft saved whole; PATCH only while it is a draft |
| `POST office/events/{id}/publish\|cancel\|complete\|archive` | `event.publish`, `.cancel`, `.edit`, `.archive` | With `{ reason }`, kept in `office_event_acts`; publication rules re-run on the server |
| `GET office/events/{id}/capacity` / `…/metrics` | `event.view` / `event.view-insights` | Counts with the server's `as_of`, no verdict |
| `GET office/events/{id}/registrants`, `…/registrants/export` | `event.view` (+ `event.export-registrants`) | The closed set; the same as a file with its conditions inside it |
| `POST office/events/{id}/registrations/{id}/cancel\|restore\|promote\|waitlist`, `…/attendance` | `event.manage-registrations` / `event.mark-attendance` | One registration moved with a reason, or attendance marked by hand |
| `GET office/events/{id}/history` | `event.view` | The office's acts on the event, each with its reason |
| `GET events`, `GET events/{id}`, `POST events/{id}/registrations`, `POST events/{id}/registrations/{id}/cancel` | public / a resident's account | The residents' side: read, register, give up one's own place. **This console calls none of them** (`DL-123`) |

The permission keys were already on the server (`casework.ts`) and in `check:permission-parity`;
nothing was added to either.

### Decisions taken (the owner may overturn any; each is the easiest to reverse)

1. **A draft is saved with its dates** — superseding, for the dates alone, the leniency `DL-125`
   gives a draft. A saved event is an `LguEvent`, which has a start and an end; the mock held a
   dateless draft by stamping "now", and the API will not hold a date nobody chose. `eventProblems`
   asks for both on `save`; the composer says so before its save button.
2. **Only a draft is edited.** A trigger (`guard_office_event`) keeps a published event as it was
   published and holds the lifecycle; an event that has changed is a new event (`DL-131`). No screen
   edits an event yet, so nothing was lost.
3. **Completion waits for the event to start** (409 before) and sweeps nobody into a no-show; a
   completed event's attendance is final, so marking after it is refused.
4. **The office's moves are not capped by capacity.** A resident's own registration is, inside the
   event's row lock. An officer promoting or restoring somebody past the stated figure is a
   reasoned decision the screen warns about first (`promotionExceedsCapacity`), as a self-release is
   (`DL-91`); refusing it would leave the office no way to admit a family at the door, because a
   published event's capacity cannot be edited.
5. **A registrant is an app account, named as they named it.** The API holds no link from an app
   account to the office's resident registry, so `discloseResident`'s protected-sector rule
   (`DL-38`) has nothing to apply to, and none is pretended. The row is the closed set (`DL-130`);
   `toRegistrantView` **refuses** a wider row rather than trimming it.
6. **No office notes on a registration.** Nothing in the port writes one, so the API keeps none and
   `notes` is always null. Likewise `replacesEventId`: nothing records it.
7. **Residents are told in the app**: when an event they hold a place for is called off, and when
   the office moves their place — an in-app notification (`event_registration_updated`), never
   pushed, never carrying the officer's reason. The cancelled badge's "everybody registered has been
   told" is true on the API, not only in the mock.
8. **A completed event stays visible to residents** (`isVisibleToResidents` gained `completed`),
   because completion is when a resident may read their own attendance — `attended`, `absent` or
   `not_recorded`, and nothing before it.
9. **Verified residents only, for every event** (`allows_unverified_residents: false`).
   Admitting an unverified account and refusing it later cannot be undone; the reverse can. The
   console has no per-event setting for it.
10. **A resident may give up their own place until the event starts**, from the app; the waitlist
    is never moved up automatically (`REGISTRATION_STATUS_CATALOG.waitlisted`).
11. **No places-left number anywhere a resident reads.** Availability is a state with the office's
    words; a full event with a waitlist reads `open`, because the app offers its register button on
    `open` alone. `ResidentEventView` in this repository's resident contract lost
    `capacityRemaining` for `registrationState` and the published `capacity` — capacity minus a
    count is the same count.
12. **Full and closed are ordinary outcomes** of a registration (a 200 with nothing taken), not
    errors; `idempotency_key` is required and travels in the body, as a message's does (`0040`),
    because the API's CORS allows four request headers.
13. **Lists are read whole or refused** (`DL-161`): the views, the registrants and the history are
    bare lists with ceilings (2,000, 5,000, 5,000), not pages — the port returns whole lists and the
    screens were built for them.

### What the console changed

`HttpEventRepository` with `event.mapper.ts`; `UnservedEventRepository` is gone and
`check:routes`' unserved ceiling went from 2 to **1**. `check:events` gained section 9 for the served
adapter — bound in the http set, nobody signed up from here, an empty reason refused before any
request, no client-side verdict on a place, completion sending no attendance, the registrant closed
set refused wider, notes never filled, the server's `as_of`, the rate only through
`attendanceRateOf`, the office's notice in the manifest and the file, the reason kept in the
history — each rule validated against a planted regression (17 of 17 caught). The app's audit trail
words the nine new `office_event` codes, the same words the office's trail uses.
`EventMetrics`' comments now say the Node API stamps its counts and reports cancellations.

### For the owner

- Whether a published event's details (date, venue, capacity) may be corrected, and how residents
  who registered are told (decision 2).
- Whether the office may exceed an event's stated capacity, or the server should refuse (decision 4).
- Whether an events clerk should see a registrant's full name, or initials only, given that the
  registry's protected-sector rule cannot reach an app account (decision 5).
- Whether an unverified resident may register for some events (decision 9), which would need a
  per-event setting in the composer.
- Whether the office wants notes on a registration, and who may read them.
- OD-4 for the newsfeed, which stays unserved.

**Still open:** no UAT script covers events yet (`docs/uat/` was left to the agent writing it). The
residents' app is not yet wired to `GET events` and the registration routes; the brief for that is
recorded with phase 6f.

## DL-193 — an event's cover is an image uploaded through the API, served from the API's own route while residents are shown the event, and never an address

**Why.** The residents' app loads an event's cover only from the API's own origin (its D-192): a
picture from a host the LGU does not run tells that host who opened the event and from where. So a
cover the office typed (`office_events.image_url`, `DL-192`) was never shown to anybody, and the
composer's "Image" box invited something that did nothing. The owner delegated the choice; covers
are now uploaded, as a Balita cover and a home banner's image already are (`DL-170`, `DL-171`).
`DL-125` stands unchanged: a cover is described before it is published, the description sits
beside the image, and a draft may be saved without it.

`taytay-backend` `7522174`; the spec vendored here is that commit's (278 operations).

### What the server does

- **Migration `0043`, additive:** `office_events.image_media_id` referencing `media`; the
  image-and-description constraint widened to read it (both or neither); one cover, never beside a
  typed address; a published event's cover never undescribed (`published_at` set, a cover, and no
  words is refused by the database too); and `guard_office_event` taught that a published event
  keeps the cover it went out with.
- **`POST`/`PATCH office/events` take `image_media_id`** with `image_alt_text`. The image is stored
  first with `POST media`. A typed `image_url` is refused as an unknown field.
- **`GET events/{id}/cover`**, public, answers for a **published or completed** event with a cover
  and is 404 otherwise, as a hidden home banner's image is.
- The office's event carries `image_media_id` and `image_url` (that route, set only while it
  answers); the residents' `cover_image` is `{ url, alt_text }` with the same absolute URL, built
  from the request's origin as a Balita `cover_url` is.

### What the console changed

`LguEvent.image` is an `EventCover` — a `MediaId` and the description, **no address** — and
`EventDraft.image` an `EventCoverDraft`: one already stored (a duplicate carries its original's) or
a file chosen in this tab. The composer takes the file through `ImageFileField`, which refuses what
`POST media` would refuse before anything is sent; "Describe the image" stays beside it; and when a
file is chosen, the box above "Save draft" says the image is stored first and stays stored if the
event is then refused, and when residents see it. `HttpEventRepository.saveDraft` refuses what the
domain refuses, then stores the image, then saves the draft naming it (`toWireEventDraft` sends
`image_media_id`). `coverImage` reads `media/{id}/content` with the bearer in a header, a draft's
too; the event's page shows the cover only when asked, from an object URL given back when the page
goes. The list draws no picture. `check:events` gained section 10 for all of it — the model holds
no address, the mapper reads no `image_url`, nothing is stored before a refusal, the upload goes
through `POST media`, the field and the description share the image section, the effects stand
before the button, and every `<img>` binds an object URL from a holder given back on destroy —
each rule validated against a planted regression (14 of 14 caught).

### Decisions taken (each the easiest to reverse)

1. **Only an image this account uploaded, or one already an event's cover.** A cover is served to
   anybody; without this, an `event.create` holder could name a resident's selfie or a message
   attachment by its id and publish it. A duplicate and a draft saved again keep their cover.
2. **A cancelled event's cover is not served.** Residents still see the event, so they learn it is
   off; its poster is not shown advertising it. The console's page says when residents see a cover.
3. **The office reads a draft's cover through `GET media/{id}/content`**, never the public route,
   which would not answer for it.
4. **No picture on the list.** Each would be a request of its own; the cover is on the event's page.
5. **A replaced or refused upload stays stored, unused**, as a home banner's image does. Nothing
   deletes an upload; the composer says so before its button.
6. **An address typed before `0043` is kept, never served, and dropped at the draft's next save.**
   The staging API listed no upcoming or past events on 8 November, so none had been published;
   drafts could not be read without a staff token, and the migration does not depend on there
   being none.

### For the owner

> **Settled 2026-11-08, on the owner's delegation ("decide the best practice").** The first two
> questions below keep what was built. **A cancelled event shows no cover:** a poster carries its
> own date and venue, so somebody glancing down the list reads it as an invitation; the words
> "Called off by Taytay LGU" carry the news instead. **An unused upload is kept:** deleting is the
> one act nobody can take back, and no disposition schedule was supplied, so no deletion period is
> invented (`DL-113`); unused uploads go when the office's schedule says so. The third was a
> defect rather than a question, and is fixed in the backend: see the note under it.

- Whether a cancelled event should keep showing its cover (decision 2).
- Whether replaced and refused uploads should be deleted, and when (decision 5).
- **The API builds absolute URLs from the request's own scheme and sets no `trust proxy`**, so
  behind the staging Caddy every `cover_url`, banner `image_url` and event cover URL reads
  `http://`. The app ignores the host of all three and fetches by path (D-193), so nothing breaks;
  a client that loaded the URL as given would not reach it.
  *Fixed 2026-11-08 in backend `b6f206f`:* Express believes `X-Forwarded-For` and
  `X-Forwarded-Proto` only from loopback and private-network hops, so the URLs read `https://`
  behind Caddy. It mattered more than the URLs: every request had carried Caddy's address, so all
  clients shared one rate-limit bucket and one OTP throttle. `TRUST_PROXY` overrides it for another
  proxy and refuses `true`.

## DL-194 — the console's newsfeed is retired in favour of Balita, the one news channel, and no port is unserved

**Decided by the owner, 9 November 2026** ("do what's best"), on the recommendation the open items
carried (`docs/turnover/known-limitations-and-open-items.md` §4).

**Why.** Residents read news in one place: the app's Balita, which the Node API serves (`GET /news`)
and this console publishes to (`features/balita`, `DL-171`). The API has no newsfeed, and building
one would publish posts that no resident ever sees, because no client reads them. The console's
newsfeed (TAB 25) was a different model — scheduling, image descriptions, comments, moderation,
reach counts — bound since the move to an adapter that made no request (`DL-165`), and after events
were served (`DL-192`) it was the last such port. `CLAUDE.md` held the launch gate at NO-GO while
any port is unserved, "unless the owner retires the screens behind it"; this is that retirement.

It is a removal, not a switch. Dormant code rots, and a gate guarding a module nobody can open is a
green number about nothing (`DL-143`). Git history keeps all of it; the last commit that has it is
`48dfa4f`.

### What went

- **Screens:** `features/newsfeed` (list, composer, detail, copy and spec: 11 files), its three
  routes and its menu entry under Community.
- **Domain:** `domain/newsfeed` (`Post`, `Comment`, their catalogs, transitions, problems and spec:
  3 files), `PostId`, `CommentId`, `NewsfeedRepository`, `NEWSFEED_REPOSITORY`, and `newsfeed` from
  `DATA_PORTS` and `DATA_PORT_HOLDINGS`.
- **Data:** `MockNewsfeedRepository`, its seed and `UnservedNewsfeedRepository`, with their bindings
  in both adapter sets.
- **Keys:** the nine `newsfeed.*` keys, with the head's nine grants and the auditor's two. `PERMISSIONS`
  goes from 84 keys to 75. The ten `event.*` keys `DL-122` added in the same act stay, as does every
  role's grant of them.
- **Resident contract:** `newsfeed.read`, `.react`, `.comment` and `.share`, `ResidentPostView`,
  `ResidentCommentView` and the four post methods. Its events half stays.
- **Gate:** `check:newsfeed`, from `package.json`, `verify` and `CLAUDE.md`.

Seventeen files in all, and the module's page, `docs/newsfeed/README.md`. The compiler and the tests named nothing outside them that depended on the
newsfeed: `discloseResident`, the image policy, `ImageFileField` and events' catalogs never did.

### What stayed, and why

- **Every `AuditAction`**, the newsfeed's seams included (`scheduled`, `pinned`, `unpinned`,
  `comment-hidden`, `comment-restored`, `comment-replied`). The union is the API's trail vocabulary
  as well as this console's: the spec's `category` and `action` filter enumerate all nineteen, and
  the backend's governance test compares its `TRAIL_CATEGORIES` with this union, in order. Events,
  releases and visits use `published`, `archived`, `cancelled` and `scheduled`; the rest are kinds
  the office's trail holds no act of yet, and the API answers them with an empty page.
- **The unserved mechanism** — `UnservedError` and `unserved()` (which still answer two
  staff-directory methods from the served adapter), `UNSERVED_PORTS`, `ServedPorts`,
  `servedGuard`, `/unavailable` and `<app-not-connected>`. The next port the console gains ahead of
  its API needs them. `UNSERVED_HTTP_PORTS` is `[]`.
- **The `me-admin.json` fixture** keeps the nine keys: it records what the API's `/me` still sends.
  `fromServerIdentity` keeps only keys the console knows, so they are set aside as unknown and grant
  nothing (`http-repositories.spec.ts` names all nine), and the session's once-per-session
  developer warning about a drifted vocabulary lists them until the backend drops them.

### What this supersedes

- **`DL-122`, in part:** the nine newsfeed keys and the grants of them. One RBAC, kebab-case, roles
  mapped rather than invented, insights and exports classified read-only — all stand for events.
- **`DL-123`, in part:** a resident's post and comment capabilities and shapes. The asymmetry
  stands: a resident reads and registers, and never publishes. `RESIDENT_MUST_NEVER` now names
  `news.write` in place of the eight refused newsfeed keys, so the one news channel is the one a
  resident is held away from.
- **`DL-124` to `DL-127`, and `DL-134`'s terminal archive:** their subject is gone. What they held
  about publishing outward lives where news goes out now:
  - **A publish cannot be recalled, and the screen says so before the button** (`DL-124`). Balita's
    publish, take-off and pin buttons each stand below their effects (`DL-171`, `check:balita`
    rule 3).
  - **An image is described before it is published** (`DL-125`). An event's cover is described
    beside it, and a published event without the words is refused (`DL-193`). Balita's API keeps no
    description of a cover; the screen says so rather than collecting words it would throw away
    (`DL-171`). That is a gap in the API, recorded rather than closed here.
  - **Reach is counts; hiding keeps the words and removal deletes them** (`DL-126`, `DL-127`). No
    surface has either today. Comments and reactions on Balita (TOR T-17, OD-4, FR-RES-9,
    FR-STAFF-34) remain a future Balita feature for the owner: this retirement removes a console
    screen nobody could reach, not a TOR feature. Whoever builds them starts from these two entries.

### The gates

None was weakened; each was changed to hold the same intent with nothing unserved.

- **`check:routes`:** the unserved ceiling goes from 1 to **0**, so a port bound to an unserved
  adapter now fails the build. The red NO-GO line it printed on every run is now the count: 0 of 33
  bound ports have no route.
- **`check:unserved`:** unchanged, and passing with nothing unserved (32 ports named, 0 unserved,
  all declared). With zero, the menu offers no "Not connected yet" link and the page says "Every
  part of this console is served". One behaviour needed fixing: a staff account linked to no office
  (`DL-168`) reached the sentence saying why it has no office inbox only through that link. The menu
  now offers the link to such an account whatever is served (`app-nav.ts`), and
  `unserved-modules.spec.ts` holds it. The spec holds the withholding mechanism against a port named
  for the purpose (`event`) rather than against an http list that is now empty.
- **`check:balita`:** its clause "not the newsfeed" is kept and made stronger rather than dropped.
  Rule 1 requires the page to say Balita is the one news channel this console publishes to; rule 2
  reads the whole of `src/app`, not just the Balita module, and fails on a newsfeed folder, port,
  token, data port, permission key, route or menu entry — a second news channel is a defect, not a
  neighbour. Validated against eight planted regressions, eight caught. Its two patterns are split so
  that `check:scanners` (`DL-143`) does not read a welded key as a call.
- **`check:community`:** holds `news.write` in `PERMISSIONS` and in `RESIDENT_MUST_NEVER` beside the
  events keys, where it held the newsfeed's. Its check on `ResidentPostView` went with the type. It
  still requires all ten audit seams. Two planted regressions, two caught.
- **`check:access`:** the office reference, `docs/access/permission-matrix.md`, reads 75 permissions
  × 7 roles.
- **`check:permission-parity`:** still 0 unreachable guards; the three newsfeed guards went with
  their routes.
- **`check:port-adoption`:** 6 of 231 port methods reached from no screen, as before; the newsfeed's
  eleven were all reached.
- **`check:consumer-contract`** and **`check:contract-drift`:** unchanged. The consumer
  expectations never named the newsfeed, and the vendored spec is the API's.

### For the owner, and for the backend

- **The backend still names the newsfeed's keys.** `taytay-backend` `src/auth/casework.ts` lists
  the nine `newsfeed.*` keys in `CASEWORK_PERMISSIONS` and grants them to the head and the auditor,
  so its OpenAPI `CaseworkPermission` enum and `/me` carry them. Its parity test
  (`tests/casework.test.ts`, "parity with the staff console") reads this console's `permission.ts`
  when the two are checked out side by side and requires the same casework keys in the same order,
  so **it fails until the backend drops the nine keys and their grants**. This change touches no
  backend file. The backend change is small — remove the keys and grants, regenerate the spec, then
  re-vendor it here with `node tools/vendor-openapi.mjs` — and the two-repo sweep before any push
  (`CLAUDE.md` rule 9) will fail on that test until it is made. Two backend comments also name the
  newsfeed (`office-governance/trail.ts`, and the spec's `action` filter description).
- **Comments and reactions on Balita** (OD-4) are the owner's decision with the LGU, as before.
- **Launch gate line 05/07:** its unserved-port condition now holds. The line itself, and every
  other line, still needs its evidence and its signature.

## DL-195 — a published event is corrected with a trace, no admission passes a safe limit, the door list shows the name an ID was approved under and finds one person at a time, and the office says who may register

**Why.** Four questions came back once events were running, and the owner delegated them ("research
best practices and do what's best"). An office that published the wrong venue could only cancel and
start again, which DL-131 makes a new event and every registrant loses their place. The capacity
warning before a promotion (DL-129) said nothing about the venue's real limit. Initials or a typed
name cannot identify somebody at the door. And every event was closed to residents whose ID the
office has not verified, though a clean-up or an orientation has no reason to be.

`taytay-backend` `cf30686` (migration `0044`); the spec vendored here is that commit's.

**Sources.** Eventbrite tells attendees automatically when an event's date, time or venue changes,
and leaves other edits to the organiser
(https://www.eventbrite.com/help/en-us/articles/748624/what-emails-will-attendees-automatically-receive/).
The NPC's Advisory Opinion 2018-003 (compendium pp. 54–56,
https://privacy.gov.ph/wp-content/uploads/2023/05/compendium_2018_1519.pdf) treats a logbook open to
whoever signs next as a disclosure of everybody already in it, the concern behind its 2020 probe of
open contact-tracing forms. GOV.UK's service manual asks for the identity check proportionate to the
harm the service could do (https://www.gov.uk/service-manual/design/checking-users-identities). The
IRR's §18(c) asks that personal data be adequate and not excessive for the purpose
(https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/).

### 1. A published event is corrected, and the correction is kept

**Supersedes DL-192 decision 2** ("only a draft can be edited"). **DL-131 stands**: cancelling is
one-way, and an event that is back on is a new event.

- **Who and when.** A holder of `event.publish`, because a correction goes out in the office's name
  as the event did. While the event is published and the clock says it has not started; never on a
  cancelled, completed or archived event, and a draft is still edited, not corrected.
- **How it is kept.** `POST office/events/{id}/correct` takes the whole composer with a required
  reason. Each correction is an appended act (`corrected`) with a revision holding what the event
  said before and which fields moved. The database refuses a change to a published event in any
  transaction that kept no revision, after it starts, or that turns registration on or off. The
  event's history lists the correction by its fields — never their values (DL-114) — with the reason
  and whether residents were told.
- **What is material.** When it starts or ends, the venue (name, address, map link, barangay), who may
  register, and fewer places. A capacity or a safe limit below the places already held is refused:
  nobody loses a place to a correction. The waitlist cannot be turned off while anybody is on it.
- **Notices.** A material change sends everybody holding a place or a waitlist place an in-app notice
  (`event_registration_updated`) saying what changed, with the old and the new date, time and venue,
  and that their registration stands. Never the reason. Title, description, contact, cover and what to
  bring are not material; for those the correction form offers **"Tell registered residents"**, off
  by default, for a changed "what to bring". The residents' app opens the event from the notice, and
  a resident who can no longer go gives up their place there as before (its D-194).
- **A correction that changes nothing records nothing** and tells nobody, so a retried request
  answers as the first did without a key. The form says before its button what the correction will
  do, as the cancel and publish confirmations do (DL-124).

### 2. Admitting past capacity keeps its warning, and gains two safeguards

- **A safe limit.** `safe_limit` is optional, at or above the capacity, and only beside one: the
  venue's posted occupant load, or the stock on hand for a distribution. No act brings confirmed
  places above it — a resident registering, the office promoting or restoring — and the server checks
  inside the event's row lock, where every place is decided (DL-129). The composer explains the field
  in plain words. The warning before a promotion past capacity (DL-91, DL-129) stays a warning.
- **A reason for every admission past capacity.** 0042 already required a reason on every promotion
  and restoration (`office_event_acts_reasoned`), so this needed no new rule; what was added is the
  record: the act now says it went past the places (`past_capacity`), the database refuses that mark on
  any act without a reason, and the history says it in words.

### 3. Full names, shown carefully

- **Staff lists keep full names.** Initials cannot identify somebody at the door.
- **The name an ID was approved under.** The API held no name from an ID: the reviewer approves the
  ID against the selfie and is **not sent the account's name** (DL-167, the verification copy says
  so). So the approval now keeps the name the account carries at that moment
  (`verification_requests.name_at_approval`, backfilled from the account for approvals before
  `0044`), and a verified registrant is listed by it — the name the resident gave as the one on their
  ID, frozen so that a later edit does not change whom the door expects. It is **not a transcription
  of the card**, and the list says which source each name comes from. *(Since `DL-197` the reviewer
  is sent the account's name and approves only after ticking that the ID shows it.)*
- **Check-in mode.** The event page has a mode that finds one registrant by name or reference and
  marks attendance, and never shows the list: `GET office/events/{id}/check-in?q=` answers at most
  five matches and whether more matched, for `event.mark-attendance`. While it is on, the registrant
  list is not on the screen. This is the NPC's concern with open logbooks (Advisory Opinion 2018-003;
  the 2020 probe of open contact-tracing forms) applied to a door list somebody turns to face the
  queue.
- **The export stays the composed six columns** (DL-130). The name column carries the same name as
  the list.

### 4. Who may register is the event's setting

- `registration_eligibility` is `verified-residents` (the default) or `app-accounts` (any signed-in
  account). An unverified account registers only at an `app-accounts` event.
- **An event that gives out cash, goods or a benefit stays verified-residents**, enforced by the
  route and the database. The categories decide where they can: a payout, a relief distribution, a
  feeding programme and a medical mission always give something out. A seminar, a livelihood training
  or an assembly may or may not (a starter kit, a snack pack), so the categories **cannot** tell for
  those, and an explicit **"gives out cash, goods or a benefit"** flag (`gives_out_benefit`) decides,
  ticked and fixed for the four categories that always do.
- Staff lists mark registrants who are not ID-verified. The residents' app says who an event is open
  to (`registration.open_to`), and changing the setting on a published event is a material correction.

### Not built

Notes, or an assistance-needs checklist, on registrations. Such needs (a wheelchair, a medical
condition) are health information, which is sensitive personal information under RA 10173 §3(l) and
is processed only on the grounds in §13. Holding them properly needs the resident's explicit consent,
a grant for who may read them, and deletion on a retention period the office sets, and no retention
schedule exists (DL-113). **Owner question** for when the schedule exists.

### Owner questions

1. Should the ID reviewer confirm, or transcribe, the name on the ID when approving it? Today the
   reviewer is not sent the name, so the door list shows the name the resident gave, as it stood at
   approval. **Decided 9 November 2026: confirm (`DL-197`).**
2. Assistance needs on a registration, once a retention schedule exists (above).

### What the console changed

- **Domain.** `EventRegistrationPolicy` gains `safeLimit`, `eligibility` (`RegistrationEligibility`:
  `verified-residents` | `app-accounts`) and `givesOutBenefit`; `BENEFIT_CATEGORIES` and
  `categoryGivesOutBenefit` hold the four categories. `eventProblems` refuses a safe limit that is not
  a whole number, has no capacity, or sits below it, a benefit category not marked as giving
  something out, and a benefit event open to every account — on a draft as well as at publication,
  because none can become right by adding to it. `correctionOf`, `eventCorrectionProblems`,
  `canBeCorrected`, `correctionDraftOf`, `CORRECTION_FIELD_LABELS` and `MATERIAL_CORRECTION_FIELDS`
  are the API's rules, so the form can say before its button what the server will do.
  `RegistrantView` gains `identityVerified` and `nameSource`; `CheckInLookup` is matches and whether
  there were more; `safeLimitReached` is a warning on a snapshot (`DL-129`), never a gate.
- **Ports and adapters.** `EventRepository.correct(id, draft, correction)` and `checkIn(id, term)`.
  The served adapter refuses a correction with no reason or one the publication rules refuse, and a
  lookup under two characters, with no request; a chosen cover is stored first, as for a draft. The
  stand-in refuses what the API refuses, including an admission past the safe limit, and says in its
  trail who the server would have told. `toWireEventCorrection` names every key, as every write body
  here does (`check:wire-adoption`).
- **Screens.** The composer gains the safe limit with its explanation beside it, "Who may register",
  and "This event gives out cash, goods or a benefit", ticked and fixed for the four categories.
  `events/:id/correct` (guarded by `event.publish`) is the same composer started from the event: a
  reason, "Tell registered residents" off by default, the correction's own refusals, and "Saving this
  correction:" listing what changes and who is told, before "Save the correction". The event page
  offers "Correct this event" to a holder of `event.publish` until the event starts; shows who may
  register, whether it gives something out, and the safe limit beside the counts; warns before a
  promotion when the office's count says the safe limit is reached; marks "Not ID-verified" beside a
  name; and has "Check-in mode", which takes the registrant table off the screen and finds one person
  by name or reference (`EventCheckIn`), marks them attended, and empties itself before the next.
- **`check:events` section 11 (new).** A correction carries a reason and the tell flag, the port
  takes them, the four material fields and a capacity cut stay material, only a published event that
  has not started is correctable, the flag is off by default, the effects are said before the
  button, the served adapter refuses a reasonless correction before sending, and the route is
  guarded by `event.publish`; the safe limit is on the policy, refused below capacity, explained with
  "occupant load", refused past by the stand-in, and never disables a promotion; `RegistrantView`
  says who is verified and the list marks who is not; `CheckInLookup` is exactly two fields, check-in
  never reads the list, empties itself after marking, and the table sits in the other branch of
  check-in mode; the export stays six columns; eligibility is exactly two values; the four benefit
  categories stay; a benefit event open to every account is refused; and no assistance-needs field
  exists anywhere in the module. The closed sets it already held — the registrant view's fields, the
  mapper's wire fields and the events routes — were each extended by name for what this decision
  adds, not loosened. Validated against 22 planted regressions, 22 caught (two rules were tightened
  after the first run missed a disabled safe-limit refusal in the stand-in and a second branch
  rendering the table).
- **Spec.** Vendored from `taytay-backend` `12431a3`, which holds `cf30686`'s two routes and the
  newsfeed keys' removal (`DL-194`): the `/me` fixture no longer carries the nine `newsfeed.*` keys,
  and the account test expects `household.view-counts` as the only key it keeps aside.

## DL-196 — a refusal is said where it happened: the error interceptor navigates only when the session is over, a panel the reader cannot open is not asked for, and not found is the screen's own message

**Why.** The developer's UAT dry run of 9 November 2026 (`docs/uat/dry-run-2026-11-09.md`) found a
barangay link and a release officer unable to open any resident's record. The record also asks for
the person's home visits; the API refuses those two roles `visit.view`, and the error interceptor
answered **every** `403` by navigating the whole app to "You do not have access to that section" —
though the page was written to leave the visits panel empty (defect 1, Critical; ROS-05, NFR-06).
The same rule threw away a barangay link's typed form when the API refused its save for another
barangay (defect 2), and sent INTAKE away from "My work" when it pressed "Mark done" on a protected
case's task (defect 6). Separately, no `404` ever reached a screen as "not found": the interceptor
rethrows its parsed `ApiFailure`, and `ApiClient.optionalItem` and the reports adapter tested for the
raw `HttpErrorResponse` it replaces, so every not-found screen showed "Could not load this section"
under one "Request failed" notice per read (defect 4; RPT-01; three notices on an unknown resident).

The interceptor cannot tell which read a screen depends on. `FieldVisitRepository.forResident` is a
panel on the resident record; a visit list read is the visits page's own. A rule keyed on the
request would be wrong on one of them, so the interceptor decides nothing about the screen.

### The rule

1. **The interceptor navigates only on `401`** — the credential is gone and every screen is equally
   unusable — to sign-in with the current screen as the return address, as before.
2. **`/forbidden` is reached only from a route guard.** Every route is guarded with its navigation
   entry's key (rule 8), before any request; that is where "you may not open this section" is
   decided. A `403` that arrives after the guard let the reader in is narrower than the route — a
   panel, a write, a record outside the reader's scope — and is said where it happened.
3. **A refused read** (`403` on `GET` or `HEAD`) raises no toast and no navigation. The screen's
   error panel says it, and `toViewState` now carries the server's sentence (`failureReason`)
   rather than "The information could not be loaded", because the panel is now the only place it is
   said. A side panel says it in its own place.
4. **A refused write** stays on its form, with its contents, and the server's sentence is raised
   once, as "Request refused" with the reference. The resident form also says above the fields that
   the save was refused and nothing was saved, and that what was typed is still there.
5. **Not found on a read** raises no toast: it is the screen's to say ("That report is not
   available", "That resident is not available"). `isNotFound` in `core/http/api-failure.ts` is the
   one test every adapter uses, and it recognises the rethrown `ApiFailure` (`404` or `NOT_FOUND`)
   as well as the raw response. Not found on a write is still raised as "Request failed".
6. **A screen does not ask for a panel its reader's keys cannot read** (usability, never the
   boundary — rule 4). It asks with the key the panel's own route uses: the resident record's
   home-visits panel needs `visit.view` (`/visits`) and its families panel `family.view`
   (`/families/:id`). A panel not asked for says so ("Your role does not open home visits, so none
   were read for this record"), never "No home visit has been recorded", which `DL-112` forbids.

Easiest to reverse of the options weighed: it removes a navigation rather than adding a mechanism.
An alternative, a request flag marking a screen's "primary" read, was rejected because the ports do
not and should not know which screen calls them.

### What else the dry run fixed

- **The signed-in account's barangay** is the API's id in `GET me`; `toServerIdentity` now
  translates it through the same `GET barangays` join every other adapter uses, asked only for an
  account confined to one barangay. A barangay link's footer read "Barangay Unknown barangay"
  (defect 3). A barangay the join cannot place is read as the narrowest scope, as one never named.
- **The resident form offers a barangay link their own barangay only**, and starts a new record
  there (CLAUDE.md "Data scope": the UI does not offer a choice the user cannot use).
- **Check-in mode keeps saying who was marked.** Marking re-read the event, the page went back to
  loading, and the check-in panel was rebuilt without "Marked … as attended." (defect 5). A mark now
  re-reads the counts, the registrant list and the history, and not the event.
- **The dashboard formats amounts with `PesoPipe`.** Its own formatter dropped centavos, so
  "Released by programme type" read ₱3,001 for ₱3,000.50 (defect 7, rule 6). The "Released" caption
  no longer reads a goods recipient as somebody the money went to: "Money or goods to 2
  beneficiaries. The amount is money only; 1 release of goods is counted, not valued." (defect 8,
  `DL-93`).
- **The governance page no longer says the previous value stays in the audit trail**; the trail
  keeps who, what, which record and when, and no values (defect 9, `DL-191`).
- **A staff card says what the account covers by its office role**: "Cases assigned to them" for a
  social worker, not "All barangays" (defect 10).
- **Backend** `taytay-backend` `dc1d571`: a task on a protected case whose words are withheld from
  the reader is listed with `is_manageable: false` for that reader, so "Mark done" is not offered
  only to be refused (defect 6); report sentences say "1 case" and "1 person served" (defect 11);
  the registrant file gives Manila times with the zone stated and the list's words for status and
  attendance (defect 12, `DL-130`). No route or schema changed, so the vendored spec stands.

### Tests

The interceptor's rules each have a test (`api.interceptors.spec.ts`), as does `isNotFound`. The
not-found path is tested on two screens through the real interceptor and the real HTTP adapter —
the resident record and a report — each showing its own message with no notice and no navigation.
The resident record is tested for a barangay link (visits not requested, record shown) and for a
refused panel (said in place, never as "none"); the form for its one barangay and for keeping what
was typed after a refusal; check-in for the sentence and for not re-reading the event; the
dashboard for centavos and the caption; staff cards for coverage; the correction wording.

## DL-197 — an ID reviewer confirms the account's name against the ID, and a checked name is no longer the resident's to change

**Why.** `DL-195` left the owner a question (its owner question 1, and the requirements plan's
`OD-1`): should the ID reviewer confirm, or transcribe, the name on the ID? The reviewer approved an
ID against the selfie **without being sent the account's name** (`DL-167`), so the name an approval
kept (`name_at_approval`), which the office's event door lists show as a verified registrant's,
was the name the resident typed, unchecked against the card. The digital ID showed the account's
**live** name, and `PATCH /me` let any member change it, so a verified account could be renamed and
keep its card. The three options were set out to the owner on 9 November 2026: leave it, confirm, or
transcribe. The owner answered "do whats best".

### The decision: confirm, not transcribe

- **Confirming** is one tick per review, against the name on the screen. **Transcribing** makes the
  office the author of a name the resident never typed, adds a typing error to every review that
  has one, and needs a field the API does not have. **Leaving it** keeps "verified" meaning less
  than the door list and the digital ID say it means.
- **Privacy.** The reviewer already sees the name and birth date printed on the ID. The account's
  copy adds only the comparison (RA 10173, proportionality), so it is sent **only while a decision
  is owed**, shown **in the review beside the images** and never in the queue list, and dropped
  from a decided request.
- **A person compares; the software does not.** The API compares the reviewer's echo with the
  account (did it change while somebody looked?), never the account with the card. There is no match
  score, and `check:verification` rule 1 still refuses one.

### The rule

1. **The API** (`taytay-backend` `c5e1a7d`): a pending request in the admin queue carries
   `account_name` and `account_birthdate`; a decided one carries neither, and a resident's own copy
   never did.
2. **Approving** takes `confirmed_name` and `confirmed_birthdate` (the birth date may be null), sent
   back exactly as read. They are compared with the account under a row lock: an account with no
   name is `409`, and one whose name or birth date is not the one confirmed is `409`. So
   `name_at_approval` is a name somebody checked against a card.
3. **A checked name is not the resident's to change.** `PATCH /me` refuses a change of `name` or
   `birthdate` while verification is `pending` or `verified` (`409`); the same value re-sent is not a
   change. Before a request, and after a rejection, both may still change, so a mismatch can be put
   right.
4. **The console.** The review shows "What the account says" above the images. Approval asks the
   reviewer to tick a statement that names the very name, and the birth date when there is one: "The
   ID shows the name “Ana Cruz”." The shared `StatusTransition` gained `TransitionConfirmation` for
   this: a destination may need a statement ticked, the button waits for it, and the tick clears
   whenever the destination or the statement changes, so it never carries over to another record. An
   account with no name is not offered approval at all (`reviewMovesFor`), and the screen says to
   reject and ask for the name. The approval's consequences now say first that the confirmed name is
   kept and can no longer be changed in the app.
5. **The birth date is usually absent.** The residents' app does not ask for one at sign-up, so the
   review says only the name can be checked, and the statement names only the name.

### What it does not do

- **The door list's words stay** "Name as it stood when their ID was approved". They are true of
  every approval: those before this change (staging test data only) and every one after, which is
  now also checked.
- **There is no office route to change a verified resident's name** (a marriage, a court order).
  The app never offered one either; what changed is that the API no longer lets a direct call
  rename a checked account. An office-side correction, with the ID checked again, is an owner
  question.
- **The residents' app.** A resident whose request is rejected because the name does not match must
  be able to put the name right, and the app's profile screen offered no name field. That change is
  the app's `D-195` (`taytay-mobile-app` `5c4bc4c`). Before an ID is sent, and after a rejection,
  "Edit profile" lets the resident write the name exactly as printed on the ID. While the check is
  pending, and after approval, the name is shown locked with the reason. A "Your name and your ID"
  card above the photos says, before the send button, that the office checks the ID shows the
  account's name and that it cannot be changed afterwards. The start and needs-correction pages
  gained a link to "Edit profile", which only a verified resident's screen had.

### Tests and checks

Backend: the queue's two fields (pending only, absent once decided, never on a resident's copy),
every refusal of an approval, the lock on `PATCH /me` both ways, the kept name, and a nameless
account rejected, named, corrected and approved. Console: the mapper (pending only), the HTTP body,
the mock's two refusals, `identityToConfirm` and `reviewMovesFor`, and the screen (the section, the
statement with and without a birth date, the button held until ticked, the echo sent, the tick
cleared for another request, rejection only without a name, no name in the queue).
`check:verification` gained rule 8: the port's and the adapter's confirmation, the review's
statement, moves from `reviewMovesFor`, `StatusTransition` waiting for the tick, and no account
field in the queue template. Each part was validated against a planted regression (six, all caught).
The UAT scripts (version 1.10) follow it: REG-09 and REG-10 read and tick the name, and REG-14 runs a
rejection for a name that does not match through to approval.

Easiest to reverse of the options: no migration (`name_at_approval` has existed since `0044`), and
removing the confirmation and the lock is a revert.

## DL-198 — the residents' app does not collect a birth date, and the office corrects a verified name against an ID it has seen

**Why.** `DL-197` left two things open, and the owner asked for best practice on both ("do whats
best in the still open", 9 November 2026): the app never asks for a birth date, so only the name is
checked against the ID; and with a checked name fixed in the app, nothing changed a verified
resident's name after a marriage or a court order.

### The birth date is not collected

- **Age is sensitive personal information.** RA 10173 s.3(l)(1) lists "age" among sensitive
  personal information, and s.11(d) requires personal information to be "adequate and not
  excessive in relation to the purposes for which they are collected and processed". Read on
  LawPhil (`lawphil.net/statutes/repacts/ra2012/ra_10173_2012.html`) on 9 November 2026; the
  NPC's and the Official Gazette's pages refused the automated read (403).
- **Nothing downstream uses an account's birth date.** The digital ID shows a name, a photo and a
  barangay; the event lists show a name; no screen or rule reads the account's birth date. Asking
  for one only to compare it with the ID would collect sensitive information for a check whose
  result nothing uses.
- **So the app keeps not asking**, and the review keeps saying "None given. The residents' app does
  not ask for one, so only the name is checked." If a feature ever needs the account's birth date
  (an age-limited event, say), that feature collects it, with the privacy notice updated first, and
  `DL-197`'s comparison then covers it with no further change: the API already sends and compares
  it when the account holds one.

### The office corrects a verified name

1. **The API** (`taytay-backend` `09e1cd0`, migration `0045`):
   `POST admin/users/{id}/name-corrections`, administrator only, never one's own account, and only
   for a verified account (before approval, and after a rejection, the resident changes the name in
   the app). The body is the new name, `previous_name` — the name the screen showed, compared under
   the row lock — and `id_checked: true`, the statement that the person correcting it has seen a
   government ID that shows the new name. The earlier name is appended to `account_name_corrections`
   in the same transaction (append-only), and the act is audited `user.name_corrected`, with the
   same words in both trails.
2. **The lists follow it.** The office's event lists show the name last checked against an ID —
   the approval's, or a later correction's — and say which: "Name the office corrected since,
   against their ID" (`name_source` `office-correction`). The digital ID reads the account's name,
   so it shows the correction at once.
3. **The console.** On "Users and roles", a verified account's panel has "Correct the name" for a
   reader who holds `verification.review` — the key that approves an ID, because correcting a
   checked name is the same judgement. What the server does is said first; the button waits for
   "I have seen a government ID that shows this name.", which clears whenever the name typed
   changes. No reason is asked for: the server keeps none (`DL-168`). The reader's own account is
   refused before the field and again in `save`.
4. **Closing an account now blanks the names the office checked**: `name_at_approval` and both
   names in the correction history, as closure blanks every other personal field. The rows stay, so
   who decided what, and when, survives without saying whom it was about. Before this, a closed
   account's approval kept its name.

### What it does not do

- **It is not a new ID review.** The account stays verified and keeps its digital ID and its
  photo. A correction rests on an ID seen at the counter, which the office does not keep; a
  resident who should be reviewed afresh is moved off "verified" (which revokes the card) and sends
  a new request from the app.
- **The resident is not told in the app.** There is no notification for it; the effects say so, and
  ask the reader to tell the resident at the counter.
- **The history is not on a screen.** The earlier names are kept for accountability, not shown:
  the audit trail says a name was corrected, not what it was, like every other row (`DL-114`).

### Tests and checks

Backend: every refusal (another role, one's own account, a missing account, no statement, an extra
key, an account not verified, a name not the one shown, the same name), the correction and its
history row and audit row, the resident still unable to change it, closure blanking both names and
the approval's, and the event list showing the corrected name as `office-correction`. Console: the
domain's rules, both adapters, the event mapper's third source, and the panel (offered only for a
verified account to an ID reviewer, effects before the button, the statement held and cleared, the
same name refused, one's own account refused, a refusal said). `check:accounts` gained rule 9, and
each of its parts was validated against a planted regression (eight, all caught). UAT ACC-11 runs
it.

Easiest to reverse of the options weighed: the table is additive, and the route and the panel
section can be removed without touching anything else. A resident-initiated name change from the
app, with new ID photos and a review, was weighed and left for later: it needs a new app flow and
a second kind of verification request, for an event the office sees rarely.

## DL-199 — the console shows the municipal seal, the same file as the website and the same artwork as the app

**Status:** Settled (10 November 2026). Supersedes `DL-22`'s refusal, and `DL-24`'s trigger for
adopting NgOptimizedImage.

**Why.** The owner asked for it: "can you see the taytay rizal seal/logo here in this repo — use this
also in the taytay system", pointing at the project's website repository. The residents' app has
shown the seal since 20 October 2026 (`taytay-mobile-app` `06bec4b`), on its home screen, the
digital ID, the directory, Balita and Tulong, while this console still drew "TR" in a dashed
square. One office, two marks.

**What `DL-22` refused, and what has changed.**

1. *Only derivatives were available* — Wix renditions of the municipal site. The file now vendored
   is the website repository's `taytay-rizal-website/assets/images/taytay-seal.png` (commit
   `8df0f54`), a 360 × 360 PNG with transparent corners, copied **byte for byte** (SHA-256
   `2fbd93b1…80f2b9`, in the manifest in full). It is the same artwork as the app's registered seal
   (560 px), which that repository records as the S0 design source "supplied as the official
   Municipality of Taytay seal"; compared by eye on 10 November 2026, the two differ in size and
   margin only. The website's copy is used rather than the app's because it is the one the owner
   pointed at, and the website and the console then serve the identical file; at 2× density the
   console's largest box (160 px) asks for 320 px, which 360 covers.
2. *No permission was published.* That is still true of a document: the Municipality's written
   permission is **not on file** in this repository. The owner's instruction, and the app's record
   of the artwork as LGU-supplied, are the basis today. The manifest says so in its evidence, and
   the open item is in `docs/turnover/known-limitations-and-open-items.md` §4, so the permission is
   asked for rather than assumed.
3. *Absence of copyright is not permission* (RA 8293 §176.1). Unchanged, and the reason item 2
   stays open.

**How.** Nothing about the safety property moved: `MunicipalSeal` still has no `src` input and
draws only what the manifest clears, scale-only, with `object-fit: contain` in a fixed square. The
manifest entry is now `vendored` with path, media type and intrinsic size, and the sign-in page and
the sidebar lockup show the seal with no component change — the swap `DL-22` designed for.

- **The placeholder stays, as its own component** (`SealPlaceholder`), so withdrawing the seal is
  still one line in the manifest, and the fallback stays tested while the live path draws the seal.
- **`AppImage` no longer paints a grey box behind a loaded image.** Its loading and failure layers
  already paint the box; the base colour showed only through transparency, and around the seal it
  would have put a grey square behind a round mark — a background that changes what the seal looks
  like.
- **The browser tab shows the seal** (`<link rel="icon">` to the same file), as the website's does.
  The Angular scaffold's default `favicon.ico` is removed: it was the framework's mark, not the
  office's.
- **NgOptimizedImage stays deferred.** `DL-24` said to adopt it with the first raster asset. Its
  value is CDN loaders and `srcset`; with one 169 KB file, no CDN and fixed sizes, it would add
  configuration and no saving. `AppImage` already sets width, height, `loading` and
  `fetchpriority`. Revisit when there is an image CDN or a second raster asset.

**Not changed.** The residents' app (already shows the same artwork) and the website. Easiest to
reverse: set the manifest entry back to `not-acquired`, and the placeholder renders again.

## DL-200 — the console adopts the redesign, and its typefaces are served from its own origin

**Status:** Settled (10 November 2026). Supersedes the colour values of `DL-21` (not its audit), and
every earlier visual choice the design draws differently. Presentation only.

**Why.** The owner commissioned a redesign of the console and the residents' app together, and
handed over the reference: the console mock-ups (Sign-in, Main, Residents, Resident record and
register, Verification queue and review, Users, App directory and its editor, Office inbox and
thread), a README of tokens and screen patterns, icons and images. It lives in `design/` while the
work runs (git-ignored) and moves to `docs/design/` when it ends. Where the README (written mostly
for the app) and the console mock-ups differ, the console mock-ups win here; the README fills what
they leave open.

**What it overrides, and what it does not.** It overrides the console's older *visual* rules —
palette, type, radii, control sizes, the dark sidebar, shadows. Nothing else moves: ports,
adapters, routes, guards, validators, component inputs and outputs, every wording the checks or
this log require (warnings before buttons, privacy statements), and every non-visual check. Data
still comes from the API; nothing in the mock-ups' sample text is copied.

**Phase 1 — the global layer.**

- **Tokens** (`src/styles.scss`): the README palette; the console theme under the mock-ups' own
  names (`--page`, `--card`, `--primary`, `--ink`, `--text`, `--muted`, `--line`, `--field`, the
  tints and their inks), so a screen translated from a mock-up keeps `var(--card)` as written; the
  header gradient and shapes; the icon-tile gradients; a type scale (`--fs-*`), radii (`--r-*`)
  and control heights (`--h-*`). **No shadows**: `--shadow-*` resolve to `none`.
- **Old names keep working.** Every name a stylesheet used before is declared and points at the new
  value (`--c-text` → `--text`, `--c-brand` → `--primary`, `--radius-md` → `--r-field`, …), so a
  screen not yet restyled draws in the new palette rather than breaking. A few names features used
  without anybody declaring them (`--c-danger`, `--c-link`, `--radius-base`, `--space-loose`, …)
  are declared now too.
- **Shared primitives** (`DL-120`): `.btn` is the design's pill — the plain button is its secondary
  style, `.btn--primary` the filled one — and `.btn--secondary` and `.btn--danger`, used by screens
  but never defined, are defined. `.field__input` is the 46-pixel rounded field; `.field__error` is
  defined; `.card` is white glass over the page's colour wash.
- **The card has no backdrop blur**, although the mock-ups give one. A backdrop filter makes its
  element the containing block of every fixed-position descendant, and two dialogs open inside a
  card (the saved-views bar's, and the card-photo warning on Digital IDs): blurred, the card would
  trap their overlay inside itself. Over the page's smooth wash a blur shows next to nothing. Anybody
  who has asked the system for less transparency gets solid cards.
- **Focus is two rings**: the design's gold outline around a navy inner ring. Gold alone measures
  about 1.2:1 against the light page and could not meet WCAG 1.4.11 (`DL-20`); navy carries the
  ring on every light surface, gold on the navy fills where navy disappears.

**Contrast, measured rather than assumed (`DL-21` still applies).** Two of the mock-ups' colours
fail AA on the page's base colour and were darkened to the nearest shade that passes: the field
border (`#8a93a6` → `#7a8399`, 2.6 → 3.2:1), the secondary muted ink (`#6b7489` → `#5e687c`, 3.9 →
4.7:1). The audit (`brand-palette.ts`, `check:contrast`, `check:brand`) now covers the heading and
secondary inks, the lighter hover of a primary button, the danger button and both focus rings.
Both checks now follow `var()` aliases to the colour a name lands on; before, they read only
literal hex, and an aliased token would have been skipped in silence — `check:contrast` now fails
on a pair it cannot resolve instead of skipping it. **Open:** cards are translucent, so the colour
under a line of muted text depends on where the card sits over the wash. A static audit cannot see
that; the redesign's final phase measures it on the rendered screens.

**Typefaces: Inter and Inter Tight, served from this origin.** The mock-ups load them from a font
service. The console does not: a request to a third party on every page load tells it who opens
the console and when, and the console's CSP (`default-src 'self'`, no `font-src`) would refuse it
anyway. The files are the Fontsource builds of the upstream variable fonts
(`@fontsource-variable/inter` and `/inter-tight` 5.3.0, from jsDelivr), one file per subset
carrying every weight — smaller than the four static weights the design uses. Latin always;
Latin Extended only on a page that draws one of its characters, which matters because the peso
sign (U+20B1) lives there and begins every amount. They sit in `src/styles/fonts/`, the build
hashes them into `/media` (already cached as immutable), and no npm dependency was added for them.
Licence: SIL Open Font License 1.1; the texts sit beside the files and ship at `/licenses/`.

| File | SHA-256 |
| --- | --- |
| `inter-latin-wght-normal.woff2` | `3100e775e8616cd2611beecfa23a4263d7037586789b43f035236a2e6fbd4c62` |
| `inter-latin-ext-wght-normal.woff2` | `34b9c504cab7a73e37b746343a449132e56cf7b5481af2cb81dc74dcff25c956` |
| `inter-tight-latin-wght-normal.woff2` | `77fefe8ca19b9f69b5284832c519e0493127c1f091f0a8936884be7721c4e618` |
| `inter-tight-latin-ext-wght-normal.woff2` | `fd9beddaaec644945809da574cf1caf342073c7e4b46a2ea5bd136c8cf1a9eca` |

**Light only, for now.** The mock-ups also draw a dark theme behind an appearance switch. The
console ships light (`color-scheme: light`, as before); a switch is a feature, and the audit
compares one value per name. Adding it later means a second token block and a second audited
palette, not a change to any screen.

**Not changed.** Component, layout and feature stylesheets (the redesign's later phases restyle
them, one commit each), the residents' app, and the seal (`DL-199`). Easiest to reverse: the old
values are in git history at `17911eb`, and the tokens are the only place they live.

## DL-201 — the console's frame and shared pieces take the redesign: the title stays on the page, the menu stays open, and icons are drawn inline

**Status:** Settled (10 November 2026). Phase 2 of `DL-200`. Presentation only: no selector, input,
output, content slot, route, guard or live region changed.

**What moved.** The shell (sidebar, navigation, topbar, breadcrumb, search trigger) and every shared
piece in `shared/ui` (page header, table, empty state, status badge, dialog, side panel, toasts,
loading, connection banner, saved views, chart table, route progress) are drawn as the console
mock-ups draw them: a glass sidebar floating on the page wash with the page's 16px margin, a header
row of glass pills that scrolls with the page, rounded tables with a soft header band, white dialogs
with large corners on a navy scrim. The pieces a screen repeats (chips, tabs, KPI figures, icon
tiles, notices, filter rows, fact lists, the dashboard grid) are defined once in
`src/styles/_patterns.scss`, on the reasoning of `DL-120`.

**The page title stays on the page.** The task file asked for the page header in "blue gradient +
shapes". None of the twelve console mock-ups draws one: every page sets a 42px display title on the
page wash, a muted lead and a pill-shaped action. The gradient header is the residents' app's, and
`DL-200` already settled that the console mock-ups win where they and the README differ. The
gradient and shape tokens (`--grad-header`, `--header-shape-*`) stay defined and unused, so
switching is a change to `page-header.scss` alone.

**The menu stays open.** The mock-ups fold each navigation section behind a toggle. That would put
every module outside the current section one action further away and break the "at most two
navigation actions" guarantee the navigation is built and tested on, so the sections are always
open and the section titles are headings, not buttons. Everything else in the navigation is as
before: every entry, its permission and scope filter, the unserved link (`DL-167`, `DL-168`).

**Icons are drawn inline.** One `<app-icon>` component draws a path from a typed set
(`shared/ui/icon/icons.ts`): the mock-ups' line icons and the reference's solid ones, only those in
use. Inline rather than image files, so an icon takes the colour of its text and costs no request.
Its host is `aria-hidden`, always; a control with only an icon keeps its own name and the
`.icon-button` class, and `check:shell` now counts an `<app-icon>` as an icon-only button's glyph
(stricter: before, those buttons would not have been checked at all). The sidebar's icon for each
module is keyed by route in `layout/navigation/nav-icons.ts`, because `core/` may not import
`shared/`; the two-letter glyph remains the fallback, and a spec fails while any module lacks an
icon.

**Status is never colour alone.** A badge keeps its label; a toast and an inbox entry show a
different icon shape for each severity; the banner keeps its "Offline" / "Connection restored"
label; the current page in the menu is `aria-current` and bold as well as filled.

**The dark sidebar's inks are retired.** The sidebar is glass now, so `--brand-nav-ink`,
`--brand-nav-ink-muted` and `--brand-nav-section` went, with their mirror in `brand-palette.ts`,
their audit pairs and their entries in `check:brand`'s token map. The brand mark's light tone (for a
navy fill, unused today) prints both lines in white, an audited pair. Gold on the primary fill (the
account initials, the current page's icon) is audited as text.

**The empty state's two illustrations.** The reference's search illustration is drawn for
`no-results`; its offline illustration for `error` while the device is offline, which is when it is
true. A failure while online, `empty` and `forbidden` draw an icon tile instead, so `empty` and
`no-results` never look alike. The files are copied to `public/illustrations/` unchanged. No input
was added: a screen that needs the offline picture while online would need an `offline` variant.

**Smaller things.** The topbar no longer sticks (the mock-ups scroll it); the focus scroll margin
stays tied to its height, so making it sticky again cannot regress WCAG 2.4.11. Closed on a small
screen, the sidebar is hidden as well as moved, because reduced motion drops the transform that
moved it and left it over the page. Dialog widths are 480/640/960 (were 420/620/880) and side
panels 420/660 (were 400/640), towards the mock-ups' wider dialogs. The notification list in the
inbox drawer is its own component, so the shell's stylesheet stays inside the component-style
budget. Not measured: contrast of muted text on the glass sidebar and cards over the wash (open
since `DL-200`; the redesign's final phase measures it on the rendered screens).

## DL-202 — the redesign's last phase: the old token names go, and contrast on glass is measured on the rendered screens

**Status:** Settled (11 November 2026). Phase 4 of `DL-200`. Closes the question `DL-200` and
`DL-201` left open (contrast on the translucent surfaces). Presentation only: no selector, input,
output, route, guard, live region or wording changed.

**The pre-redesign names are retired.** Once every screen had been restyled, nothing but the checks
used `--c-*`, `--radius-*`, `--shadow-*`, `--font-sans` or the `--brand-primary*` ramp, so they went
from `styles.scss` and `_brand-tokens.scss`. `check:contrast` and `check:brand` measure the same
pairs under the names that replaced them (`--text`, `--muted`, `--muted2`, `--primary`, `--deep`,
`--blue-50`, `--on-primary`, `--gold-ink`, `--field-line`, `--page-base`, `--card-solid`,
`--fill`): the same colours, the same thresholds, the same number of pairs. The mirror's
decorative-border entry (`borderDecorative`) now describes the design's divider (`--divider`)
instead of a grey no stylesheet paints any more; it is an exemption, not an audited pair. The
semantic spacing layer of `DL-17` (`--space-card`, `--space-page`, …) is a decision of its own,
not a pre-redesign name, and stays.

**Contrast on glass, measured.** Cards and the sidebar are white glass over a fixed wash of colour,
so the colour under a line of text depends on where it sits; a static audit cannot see that. The
rendered console (local-mock, every module as an administrator, the first record of every list) was
measured at 1280×800 and 1440×900: every text hidden, the pixels behind each run read back and
compared with its colour, beside axe-core (which leaves text on a gradient or translucent surface
"incomplete" rather than measuring it). Muted text did not hold 4.5:1: 3.9–4.2:1 in the sidebar on
every page (its brand line and section titles, over the blue at the top-left and the navy at the
bottom-left of the wash) and 4.3–4.5:1 on cards on about fifteen screens. Worked out for the worst
case, muted text at a card's thin end (28% white) over the navy would fall to about 3.6:1. Three
changes, chosen to keep the glass and the order of the inks rather than to make the cards opaque:

- `--muted` and `--muted2` darken to `#4f586c` (7.1:1 on white; were 5.9 and 5.6:1). The two names
  stay because the mock-ups use both.
- A card's thin end is 40% white instead of 28% (`--card`), so no card is thinner than the glass
  the inks were worked out on (muted text 4.7:1 there over the darkest part of the wash).
- `--field-line` darkens to `#6b7489`, so a field's boundary keeps 3:1 (WCAG 1.4.11) on that same
  thinnest glass.

Measured again afterwards: 2,992 runs of text, none below its threshold; muted text no lower than
5.0:1.

**What else the sweep found.** On the dashboard, the residents'-app panel set its heading in the
global navy ink on the primary fill (1.2:1); it is white now. The intake stepper's "to do" count was
a translucent gold that measured 1.2:1 on the filled current step; it is the audited warning tone.
A date or time field lost its focus ring after the first of its parts, because Chromium stops
matching `:focus-visible` once focus moves inside the field; those fields draw the ring on
`:focus-within`. The roles matrix's visually hidden labels widened the page to 1,475px, because the
box that scrolls the matrix was not positioned; every box that scrolls a table is positioned now.
At 1280px four tables scrolled sideways by 15–60px (a dashboard breakdown, the beneficiary list, the
home screen's two lists); a figure with words after it, a table heading and a row's buttons now wrap
instead. The roles matrix (every permission against every role) still scrolls inside its card at
both widths, by design. The event check-in's Find button no longer sits on a fixed 25px offset: the
field's label, input and hint are rows of a subgrid, so the button stays on the input's row whatever
the label's height.

## DL-203 — the redesign is written down, its reference is kept, and a check keeps literals out of the stylesheets

**Status:** Settled (11 November 2026). Phase 5 of `DL-200`, closing the redesign. No screen, selector,
input, output, route or wording changed; one rule changed value without changing what it paints.

**The reference is kept, as drawn.** The redesign's admin mock-ups, icons and images, and the design
pack's README, are copied to `docs/design/` from the local, ignored `design/` folder (the mobile half
stays in `taytay-mobile-app`). They are drawings with sample data, and the README now says so first:
nothing in them is copied into the app. They are excluded from what would otherwise read them as
source — ESLint (`globalIgnores(['docs/design/admin/'])`; `ng lint` reads only `src/`, but a bare
`eslint .` would parse the mock-ups as Angular templates) and Prettier (`.prettierignore` lists the
README, `admin/`, `icons/` and `images/`, so `npm run format` cannot rewrite them). No build, bundle or
repository check reads them: the build's assets are `public/` and the font licences, `check:brand`'s
image rule covers `public/brand/` only, and its colour-claim scan of `docs/` passes over them.

**The system is written from the code.** `docs/design/DESIGN_SYSTEM.md` lists the tokens, the
primitives, the pattern classes, every shared component with its inputs and an example, the five page
patterns with a reference page and a skeleton each, the rules and the browser sweep. Where it and the
code disagree, the code is right. The Phase 4 sweep script is described rather than committed: it needs
`playwright-core` and `axe-core`, and a dependency is not added for a script the gate does not run.
`CLAUDE.md` §7 gains a "Design" part pointing to it, and `.claude/commands/` gains `new-page`,
`restyle-page`, `change-token` and `redesign`.

**`check:styles` keeps literals out.** Phase 4 swept every colour literal, px font size and shadow out of
the component stylesheets by hand; nothing kept them out. The check reads every stylesheet under `src/`
— component files and inline `styles` — and fails on a colour literal (hex, `rgb()`, `hsl()` and the
other colour functions, or a CSS named colour in a property that takes a colour), a px font size (in
`font-size`, the `font` shorthand or a local `--fs-*` token), and a shadow or glow (`box-shadow` other
than `none` or the focus ring built from the focus tokens; any `text-shadow`; `drop-shadow()`).

- **Who is exempt.** Only `styles.scss` and `_brand-tokens.scss`, and only as the value of a custom
  property: that is what declaring a token is. `shared/ui` and the global partials get no exemption —
  they were already clean and they are what features copy. The one literal the first run found was
  in `styles.scss` itself, the print background `#fff`; it is `var(--card-solid)` now (the same white).
- **Named colours are included** because `white` is `#fff` spelled differently, and the obvious way
  round a hex-only rule. System colours, `transparent` and `currentcolor` pass.
- **Radii and heights are not checked.** Hairlines, `50%` and small offsets are legitimate non-token
  lengths, and a rule that cannot tell them from a stray `14px` radius would be edited rather than
  read. DESIGN_SYSTEM.md asks for the tokens; review holds that line.
- **Validated against planted regressions** in a feature, the layout, `shared/`, `shared/ui`, an
  inline-styled component and a token file's rule: 21 planted violations of every kind, all reported
  with file and line; the allowed forms beside them (the focus ring, `none`, a token declaration, `%`
  and `inherit` sizes, system colours, an id selector, a media query, `url(#…)`) not reported. A walk
  that finds fewer than 60 stylesheets fails as broken rather than reporting clean.

stylelint was not added: one more dependency and configuration for three rules a short script states
in the vocabulary of the other checks.

## DL-204 — the console has a dark theme: it follows the computer unless somebody picks one, and the choice is kept for the tab, not stored

**Status:** Settled (11 November 2026). The owner asked for the admin side's dark mode, which the
redesign's mock-ups draw and `DL-200` left for later. Presentation, and one control in the frame: no
route, guard, port, model or wording outside the frame changed.

*Its default and its control are superseded by `DL-207` (12 November 2026): the console opens light
on every computer, and one Dark mode button switches it. The palette and the no-storage rule stand.*

**Where the colours come from.** The `.theme-dark` block of the admin mock-ups — the same in all
twelve — is `@mixin theme-dark` in `src/styles.scss`, laid over the light `:root`. A token the mixin
does not name keeps its light value in both themes: the palette, the icon tiles, the seal placeholder,
type and sizes. The seal and photographs are never recoloured (`DL-199`). Where a drawn value failed
WCAG AA (text 4.5:1, large text and interface parts 3:1) it was changed the way `DL-202` changed the
light ones, and the comment beside each value says what was measured:

- **The glass** keeps the mock-ups' white sheen (12% → 4%) but lays it on a 70% veil of the page's own
  colour. Over the plain page that looks as drawn; over the bright blue at the top-left of the wash,
  where the sidebar sits, the drawn glass let muted text fall to 2.9:1, links to 3.6:1 and the red ink
  to 3.1:1. The veil damps the glow under a card and leaves it around one.
- `--primary` is a shade darker than the drawn #2d54e0 (#2c51d9): the gold initials and current-page
  icon on it measured 4.3:1. `--muted` is a shade lighter than the drawn #9aa6c4 (#a4b0cc): in the
  browser, a hint on the gold-tinted "late" bucket over the glass measured 4.2:1 (work, visits,
  releases). `--muted2` is `--muted`, as in light (the drawn #8c98b8 measured 4.0:1 on the glass). `--field-line` is a solid #7884aa (the drawn white at 24% is 2.1:1, and an alpha cannot
  be audited). `--on-deep-muted` lightens to #d6def2 (4.0:1 on the dark primary).
- **The focus ring** keeps its gold outline, which carries it on every dark surface; the navy inner
  ring would vanish there, so the dark inner ring is a blue (#4169f2) that holds 3:1 against the dark
  surfaces and against the gold. The light theme's focus pairs are therefore the dark theme's too.
- **Two roles split.** In light the red ink is both a text colour and the fill of a destructive
  button; in dark it is a pink for text on a tint, and white on it is 2.3:1. The fill is its own token,
  `--danger-fill` (light: the red ink, as before; dark: the palette red, white 5.0:1). Likewise
  `--primary` was painted as text in five places, which in dark would be 2.6:1 on the card; they paint
  `--link`, the same blue in light. `check:contrast` now fails on text in `--primary` or a red ink as a
  fill.
- The tokens the mock-ups do not draw in dark (the soft fill, the divider, the soft brand blues, the
  status tones) are the dark tints laid over the solid dark card, as hex, so they can be audited.

**The audits run twice.** `check:contrast` reads the light theme from the `:root` blocks of both token
files and the dark theme from them with `theme-dark` laid over, follows aliases within each, and
measures the same 40 pairs in each (80). It gained the focus-ring pairs, the brand glyph on its soft
tile, and the danger fill; it fails when the dark block is missing, when it declares a token light does
not, and — as for light — when a pair does not resolve. `brand-palette.ts` gains `BRAND_PALETTE_DARK`
and `TONE_PALETTE_DARK` (held to the light names by `satisfies`) and builds its audited pairs once per
theme, so the spec measures 45 pairs in each; `check:brand` compares 24 tokens and the 12 status-tone
tokens with the stylesheet in both themes. Each extension was validated against planted regressions
(a light-era muted grey in dark, a dark tone left to fall back to its light ink, an alpha where a hex
belongs, a dark-only token, text in `--primary`, a red-ink fill, drift in the dark mirror, the mixin
removed); all were reported, then removed.

**How a theme is chosen.** By default the console follows the computer's setting
(`prefers-color-scheme`). "Appearance — System, Light, Dark" in the sidebar's account footer, beside
the identity and sign-out so it is there at every width, overrides it. It is built from the design
system and nothing else: the `.choice-list` fieldset, the `.tabs` pill the mock-ups draw their own
Light / Dark switch with (the chosen tab `.tab--active`), and `.field__hint`. Each tab is a label
around a visually hidden native radio, so arrow keys move and choose and a screen reader announces
the group, the option and its state; the one addition to the patterns is `.tabs--fill` (tabs that
share a narrow box) and the rule that a tab draws its focused radio's ring with the focus tokens. `ThemeService` sets `data-theme` on `<html>` to `light` or `dark`, or removes it for System.
The default needs no script, so no wrong theme flashes before the app starts; that matters because
the CSP (`script-src 'self'`, `check:headers`) refuses the inline snippet that usually reads a stored
choice before the page paints. A printed page is always light: both dark rules are screen-only.
Reduced transparency turns the dark glass solid as it does the light.

**What is stored, and where: nothing.** A theme is not personal data and not a credential, and one
key holding `dark` would be harmless in itself. But `check:auth` refuses `localStorage`,
`sessionStorage`, cookies and IndexedDB anywhere in the console — deliberately a rule about _whether_
the console stores anything, because a rule about _what_ it stores needs somebody to judge every
case correctly forever (ADR 0006, `DL-110`, `DL-166`). An exception for a harmless value is exactly
that judgement, so none is made and the check is unchanged. The choice is a signal in
`ThemeService`, held for the tab. A reload returns to System; it already asks the person to sign in
again, since nothing of the session is stored either. The hint under the control says the choice is
not saved, before anybody relies on it. Remembering it across sign-ins would be a preference on the
staff account, served by the API — a change for the backend, not for browser storage.

**Measured in the browser.** The mock console (local-mock, every module as an administrator, the first
record of every list) at 1280×800 and 1440×900 in each theme: 128 pages a theme, reached at 1280 through
the system setting and at 1440 through the control with the system set to the other theme. The first
dark run found six runs of muted text below 4.5:1 (4.16–4.31:1, the hint on the gold-tinted "late"
bucket of the work queue, field visits and releases), which is why `--muted` is a shade lighter than
drawn. Afterwards, in each theme: every page in the theme asked for; no page wider than the window
(the roles matrix still scrolls inside its card, by design, as in `DL-202`) and nothing past its box;
axe-core reports no colour-contrast violation; and of the text it leaves "incomplete" on glass, every
run measured from pixels holds its threshold (3,069 runs in dark, 3,070 in light). Tabbing through every page and through the frame from the
Appearance control back to the skip link, all 1,618 stops in each theme draw a ring, none on a hidden
element, and the ring holds at least 4.5:1 against what is behind it in dark (10.2:1 in light); the
Appearance radios are ringed on their tab. The arrow keys
move and choose within the Appearance group in both themes. The sweep's focus probe now waits two
frames after each key: the reduced-motion rule turns every property into a 0.01ms transition, and a
style read in the same frame sees where the transition starts — an outline in the text colour, no
inner ring, a skip link still above the page — which first read as faint rings and a hidden skip link.

## DL-205 — an administrator sets how long the app says an ID review usually takes, or makes it say nothing; the console never supplies a number of its own

**Status:** Settled (11 November 2026). The residents' app tells a resident who has sent their ID
that the review "usually takes 1–3 working days". No such service standard is published. The owner
kept that copy for now and asked that an administrator be able to change it here. The API serves the
setting from `taytay-backend` `39d650b`, vendored here at that commit; the app is to read it in a
later step.

**What the setting is.** `verification_review_working_days` in the app's settings: `{ min, max }`,
whole working days with both ends counted, 1 ≤ min ≤ max ≤ 30, or `null`. It is read where every app
reads its settings (`GET app/config`) and written with the rest of them (`PATCH admin/app/config`),
audited like the rest (one `app.config_updated` row naming no setting). In the console it is
`AppConfig.verificationReviewWorkingDays`, under "Verification review time" on App settings: two
whole-number inputs (`.field-row`, a pattern added for a range's two ends), or "Don't state a review
time", which sends `null`. Beside them is the sentence the app will say, made by one function,
`reviewTimePhrase`, using the rule all three repositories build to: "usually takes {min}–{max}
working days", and one number when both ends are the same ("1 working day", "4 working days"). The
confirmation says what the change does ("The app will tell residents an ID review usually takes 2–5
working days", "The app will stop saying how long an ID review takes") and that an app too old to
read the setting keeps saying what it was built to say. It asks for no acknowledgement: it changes a
sentence and asks no resident to update or accept again, and an acknowledgement nobody needs teaches
administrators to tick without reading.

**Null and absent are different answers.** `null` is the office's decision that the app states no
review time. A response without the key comes from an API older than the setting, and that is
**unknown**. The mapper reads it as `undefined`, the screen says the API did not say and offers
nothing to change, and nothing about it is sent. Reading it as `null` would show "Don't state a
review time" as chosen, and the next save would make that true. Reading it as 1–3 would put a number
in the office's mouth. A value that is present but not a range (a string, half a range, fewest above
most) makes the whole configuration unreadable, the rule `DL-170` already applies to every setting.
The upper bound is not enforced on read, because it is the server's policy to change.

**No default in the console.** No standard is published, so the figure is the office's own estimate,
and the console never supplies one: not when the API is silent, not when the app states none and an
administrator chooses to state one (the inputs start empty), not as a placeholder. The only 1–3 in
the console is the mock adapter's seed, which is the value the API's migration stores. The checks on
what is typed mirror the server's, in the server's own words, for usability only. A 422 that names
`verification_review_working_days.min` or `.max` comes back through the data layer as
`AppConfigRefusedError` with each sentence keyed to its input, so the feature never names a wire
field. The confirmation closes and the sentence stands beside that input (`aria-invalid`, named by
`aria-describedby`) until the review time is edited.

**The app keeps today's copy until an administrator changes it.** The migration stores `{ min: 1,
max: 3 }`, the sentence the app already shows, and leaves `updated_at` alone, so nothing a resident
sees changes until somebody here edits the setting. Staging serves it only after a redeploy.

`check:app-settings` rule 9 holds all of the above: the effects and their listing, no acknowledgement,
the app's rule and the preview built from it, no range written into the page, copy, domain or
mapper, absent read as unknown and never sent, the range sent whole under its own key, the refusal
returned by input, and each input's error named on it. It was validated against 19 planted
regressions, all caught and then removed.

## DL-206 — Netlify serves the staging console, with the style nonce from an edge function

**Status:** Settled (11 November 2026). Closes the Netlify half of `DL-172`.

**Why.** The owner asked for the Netlify projects to be "deployed properly", and for `taytaadmin`
to become `taytayadmin`, address included. Fetched on 11 November 2026, https://taytaadmin.netlify.app
served a production build: its policy still named `https://api.<approved-domain>`, so no request
could leave, and `style-src 'self'` with no nonce refused every component style — the unstyled
console `DL-172` recorded as a launch blocker. The project is now `taytayadmin`, at
https://taytayadmin.netlify.app. The old address answers 404: Netlify does not forward a renamed
project.

**What changed.**

1. **Every Netlify context builds `--configuration staging`.** No production API exists, so a
   production build on Netlify can reach nothing. The console names itself "(staging)".
2. **One policy, naming the staging API.** Netlify applies headers to every context: "headers set
   in the netlify.toml are global for all builds and cannot be scoped for specific branches or
   deploy contexts" (docs.netlify.com, read 11 November 2026). So the
   `[[context.deploy-preview.headers]]` block never applied to any deploy, and is removed. Its
   `X-Robots-Tag: noindex, nofollow` is now global, because every Netlify build is a staging one.
3. **The edge function `netlify/edge-functions/csp-nonce.ts`**, declared in `netlify.toml`, mints
   128 random bits per HTML response, stamps `ngCspNonce` on `<app-root>` and adds `'nonce-…'` to
   `style-src` in the same response — the Linode Caddy's recipe. It never creates a policy: an HTML
   page that reaches it without one gets 503, not the console, because a console that looks right
   with nothing in front of it is the failure `DL-172` found and nobody would see.
4. **The staging API's `CORS_ALLOWED_ORIGINS` names `https://taytayadmin.netlify.app`** beside the
   Linode console. An exact origin; deploy previews stay off the list, so a preview loads and
   cannot sign in.

**Checks.** `check:environments` asked whether every deployed environment's API appeared somewhere
in the hosting files, comments included. Production's placeholder origin therefore held the
placeholder in the policy, and the check passed while Netlify served a console that could reach
nothing. It now asks which configuration `netlify.toml` builds, and requires that configuration's
API in every policy, read from the policy lines only. `check:headers` rule 9 requires the edge
function declared on `/*`, imports it and exercises it: a fresh nonce each call, `<app-root>`
stamped, the policy changed in exactly one place, nothing from the forbidden list, 503 without a
policy, and anything that is not HTML untouched. Each rule was validated against planted
regressions (wrong API in either file, a production build command, the function undeclared, an
`'unsafe-inline'` added, a page served without a policy).

**When production comes.** Change the build command and the policy's API origin in one commit —
`check:environments` fails on either alone — or split the policy per context with Netlify's
documented workaround: a `_headers` file per context, copied in by each context's command. HSTS
stays absent until the certificate chain is confirmed (`check:headers` rule 5).

**Not changed.** The Linode staging console and its Caddy nonce. The procedure is in
`docs/turnover/operations-runbook.md` §4. Easiest to reverse: revert the commit, and take the
origin out of `CORS_ALLOWED_ORIGINS` (a backup of the file from before the change is beside it on
the server).

## DL-207 — the console opens light on every computer, and one Dark mode button switches it

**Status:** Settled (12 November 2026). Supersedes `DL-204`'s default ("System follows this
computer") and its three-way Appearance control. `DL-204`'s dark palette, its measurements and its
no-storage rule stand.

**Why.** The owner opened https://taytayadmin.netlify.app on a computer set to dark and asked why
the console was dark: "light mode is the default always", with "a button to change light and dark
mode". Under `DL-204` a computer set to dark opened the console dark, because the stylesheet followed
`prefers-color-scheme` whenever nobody had chosen, and the choice was three radios — System, Light,
Dark — in the sidebar only, so the sign-in page could not change it at all.

**What changed.**

1. **The stylesheet no longer reads `prefers-color-scheme`.** `@mixin theme-dark` is included once,
   under `:root[data-theme='dark']`, screen only; the reduced-transparency restatement follows it at
   the same selector. With no attribute the console is light, on every computer. `index.html`
   declares `color-scheme: light`.
2. **One control, a toggle button.** `ThemeToggle` (`shared/ui/theme-toggle/`) is a
   `.btn.btn--secondary.btn--small` with `aria-pressed` and a label that never changes ("Dark
   mode"), so a screen reader hears its state rather than a name that swaps; the icon (moon, sun) is
   decorative. It is in the sidebar's account footer, where the radios were, and at the top of the
   sign-in page beside the seal. `ThemeSwitch` and its copy are removed.
3. **`ThemeService` moved to `shared/state/`** and knows two themes: `light` (no attribute) and
   `dark`, with `toggle()`. It moved because the sign-in feature and the shell both use the button,
   and `shared/` may not import `core/`.
4. **Still nothing stored** (`check:auth`, `DL-204`): the choice lasts for the tab, and a reload opens
   light again — which is now the default asked for rather than a limitation to apologise for.

**Checks.** `ThemeService`'s spec opens light with no attribute, sets and clears `dark`, toggles, and
writes nothing to storage; `ThemeToggle`'s spec holds the one button, its `aria-pressed`, its
unchanging name and its hidden icon; the shell and sign-in specs find the button where it belongs.
The contrast and brand checks read `@mixin theme-dark` itself and are unaffected.

**Also fixed, found while checking the button on a phone.** The sign-in page scrolled sideways at
390px: `.sign-in` is a grid whose `auto` track took the frame's preferred width (the form's 420px
basis plus padding), so the card ran about 50px past the screen and cut off the fields, the Sign in
button and the new switch. The track is now `minmax(0, 1fr)`; measured on the live site, the page
is exactly the screen's width at 390px and unchanged at 1440px. It predates this entry; the button
only made it visible.

**Not changed.** The dark palette and every token. Easiest to reverse: restore the
`prefers-color-scheme` block in `styles.scss` and the System option.

## DL-208 — a Citizens section in the sidebar holds the registry and the Citizen IDs

**Status:** Settled (12 November 2026). The citizen design pack, prompt A1; board
`docs/design/admin/screens/CitizensOverview.dc.html`.

**Why.** The pack groups everything about the people of Taytay — the registry, the sector lists,
imports and the card the residents' app shows — under one heading, "Citizens". Until now the
registry sat in Casework as "Residents" and the cards under Residents' app as "Digital IDs", so a
clerk looking for a person and then for their ID looked in two sections.

**What changed.**

1. **A `Citizens` section, placed after Casework** as the prompt says. The board draws it first, above
   Casework; the prompt's placement wins, because Dashboard and My work are where a session starts.
2. **"Residents" moved into it as "Citizen registry"** and **"Digital IDs" as "Citizen IDs"**. Each
   keeps its route (`/residents`, `/digital-ids`), its `reads`, its permissions and `closedTo`, so the
   route guards they mirror (rule 8, `check:unserved`, `check:digital-ids`) are unchanged and no
   bookmark breaks. The glyphs follow the labels (`CR`, `CI`).
3. **Icons as on the board:** the registry draws `users`, the IDs keep `idCard`.
4. **Only pages that exist are listed.** Citizen overview, Sectors and Import citizens join the section
   when their pages are built (A3, A6, A7). "Citizen flows" is a design note on the boards, not a
   page, and never joins.

**Checks.** The layout spec's breadcrumbs now read Citizens › Citizen registry, and the unserved page's
spec names Citizen IDs and Citizen registry. `check:community` still finds Casework, Delivery and
Administration: the section is added, nothing is removed.

**Not changed.** Page titles and headings, which their own prompts (A2, A4) restyle. Easiest to
reverse: move the two entries back to their sections.

## DL-209 — the registry's sector filter is a row of tabs; no bulk bar until the API serves a bulk act

**Status:** Settled (12 November 2026). The citizen design pack, prompt A2; board
`docs/design/admin/screens/CitizenRegistry.dc.html`. Restyle of `features/residents/resident-list-page`.

**What changed.**

1. **The sector filter is one row of tabs**: All citizens, then each sector in the domain's order,
   with short labels ("PWD", "4Ps", "CICL") held in `residents.copy.ts`. Each tab is a link to the
   same list with `sector` set (merged with the other filters, replacing the history entry as the
   select did), so the URL is still the filter (`DL-36`) and a saved view still names it. The chosen
   tab carries `aria-current="true"` as well as the fill. The row never wraps: a new pattern,
   `.tabs--scroll`, keeps it as wide as its tabs up to its container and scrolls sideways inside
   itself, positioned like every scrolling box.
2. **VAWC and CICL tabs only for `request.view-sensitive`**, the rule the select had (`DL-174`), and
   the server's refusal stands behind it. The data layer still redacts (`DL-38`).
3. **Search, barangay, age group and Include retired records stay**, in one toolbar as on the board;
   the checkbox is the shared `.check-pill`, the name link `.record-link`, the "more" row
   `.list-more` — their local copies are deleted. The page and the route are titled "Citizen
   registry", the label the Citizens section gives it (`DL-208`).
4. **Every column, link and action stays**: Resident, Barangay, Age, Sectors, Status, the saved views
   (or their not-connected note), Register a resident, Show more.

**Left out, and why.**

- **The bulk bar.** The prompt asks for it with "only actions the API serves", and none is: there is
  no export of residents, no programme list and no printed sector list in the API, and the per-person
  writes that exist do not bulk honestly — adding a sector takes *what was checked* for that person
  (`DL-174`), and retiring a record takes that record's reason. A selection that can do nothing is
  noise, and a checkbox column implies an act; so there is no selection until an act exists.
- **Tab counts.** `GET /office/residents` sends no total (`DL-161`); a count nobody computed is a
  claim.
- **The sex filter, the App and Digital ID filter and the Import button**: not served by
  `GET /office/residents`; they come with A6 and A7.

**Checks.** The residents spec reads the tabs instead of the select's options for the protected-sector
rule, and holds the chosen tab's `aria-current`. Easiest to reverse: restore the select.

## DL-210 — Senior citizens, PWD and Solo parents each have a page: the registry narrowed to the sector

**Status:** Settled (12 November 2026). The citizen design pack, prompt A3; boards
`SectorSeniors.dc.html`, `SectorPWD.dc.html`, `SectorSoloParents.dc.html`. List pattern, from
`residents/resident-list-page`.

**What the office can do.** Open the members of one sector — `residents/sectors/senior-citizen`,
`…/pwd`, `…/solo-parent` — search them by name and narrow by barangay, add somebody to the sector and
end somebody's membership.

**How.**

1. **Three literal routes, not a `:sector` parameter.** Each child route carries its sector in its
   `data`, bound to the page's `sector` input. An unknown sector is the not-found page rather than a
   list read with a value nobody checked, and `check:unserved` can match each menu entry to its route.
   Guarded like the registry: `servedGuard('resident')`, `resident.view`, closed to `assigned-cases`.
2. **The list is the registry's**: `RESIDENT_REPOSITORY.list` with the page's sector fixed, a cursor
   page at a time in the server's order, with the registry's own columns — now defined once in
   `resident-columns.ts` for both screens. Search and barangay live in the URL like the registry's;
   a `sector` parameter in the URL is ignored, so no address can turn the page into another sector's.
3. **Add and End are the existing recorded acts** — `recordSector` (`POST residents/{id}/sectors`) and
   `endSector` (`…/sectors/{sector}/end`) — each from a centred dialog that asks for the reason the
   API requires (what was checked; why it ends), says what the act does before its button, and
   refuses without a person or a reason. The person is found with `PersonPicker`. Both need
   `resident.update`, and are hidden from a reader without it. After either, the list is read again
   from the server.
4. **Under Citizens, three entries**: Senior citizens, Persons with disability, Solo parents, with the
   boards' icons (`senior`, `accessible`, `soloParent`, copied from the mock-ups' paths). Their tabs
   at the top of each page move between the three.

**What the API does not send is named in its place.** The count tiles, the by-barangay, age-band and
benefit breakdowns, the "Needs attention" cards and the sector's own fields (ID number, validity,
social pension, disability type) need data `GET /office/residents` does not have. Each panel shows
`<app-not-connected>`, which now takes either a port or a `figure`: `UNSERVED_FIGURES` in
`domain/ports/data-ports.ts` names what a *served* port's API does not send yet, in the sentence the
port gaps use ("Not connected yet: … This is not a statement that there are none."). A figure is not a
port: nothing is bound to an unserved adapter, and `check:routes`' count stays at zero.

**For whoever serves them.** Counts by barangay or age are people counts, so `DL-105`'s small-cell
suppression applies — withheld below `SMALL_CELL_THRESHOLD`, never a zero, the total taken before.
A Senior Citizen or PWD ID number is a document number, held and shown as its last four characters
only (`DL-183`).

**Checks.** `sector-page.spec.ts`: the list reads only its own sector, even with `?sector=` in the URL;
the registry's columns; the current page marked among the three; the three not-connected panels; the
empty and error states, Try again reading again; Add and End hidden without `resident.update`; End sent
only from its dialog with a reason; Add refusing without a person. `not-connected.spec.ts` holds the
figure's sentence. `ResidentRepository.endSector` is now reached from a screen, so `check:port-adoption`'s
floor drops from six unreached methods to five. Easiest to reverse: remove the three routes and entries.

## DL-216 — App settings publishes the biometric (selfie) consent; until it does, the page says the app cannot take selfies

**Status:** Settled (12 November 2026). Extends `DL-186` (the texts residents accept) to a third
text. Backend `44cae1b` (G1), vendored with the spec at `ebd7aeb`.

**Why.** The server now refuses every selfie (`403 BIOMETRIC_CONSENT_REQUIRED`) until the office
publishes a biometric consent text and the resident agrees to its version as an act of its own.
The text is not seeded, so on deploy no resident can verify by selfie, and the only place it can be
published is this console.

**What changed.**

1. **A third text, in a group of its own.** `AppConfig.biometricConsent` is read whole, like the
   Terms and the privacy notice, and published through `PATCH admin/app/config`
   `{ biometric_consent: { version, body_markdown } }`. It sits in its own fieldset, "Biometric
   (selfie) consent", because residents agree to it apart from the other two (NPC Circular 2023-04:
   no bundled consent). `biometric_consent_version` is not read: it is the text's version, or `null`
   while that is the placeholder, which `biometricVersionAskedNow` derives by the server's rule.
2. **Said plainly while it is missing.** While the text is the placeholder a warning callout at the
   top of the page says "The app cannot take selfies." and that no resident can verify their ID by
   selfie, and the section says it again where the text would be. An API older than G1 sends no
   `biometric_consent`: that is read as unknown (`undefined`), like the review time (`DL-205`), the
   section says the API did not send it, nothing is offered to publish, and no claim about selfies
   is made either way.
3. **What publishing does, before the button.** A first publication: residents can send a selfie
   from now on, each after agreeing to that version in the app, and it cannot be undone here — the
   server accepts no "placeholder" version back. A new version: every resident who agreed to an
   earlier one agrees again before their next selfie; selfies already sent are kept. The same
   version: the text changes without asking anyone. The audit is the server's `app.config_updated`,
   which `APP_CONFIG_EFFECTS.always` already describes.
4. **No acknowledgement.** `asksEveryResident` leaves the biometric consent out: it stops nobody
   using the app — the Terms and the privacy notice are what the app gates on — and a needless tick
   teaches administrators to tick without reading (`DL-205`'s reasoning). The irreversibility is
   said in the effects instead.
5. **A checklist beside the editor, never wording.** `BIOMETRIC_CONSENT_REQUIREMENTS` lists ten
   topics the text has to cover — purpose, what is collected, who sees it, how long it is kept,
   freely given, asked on its own, withdrawing, what withdrawing does, who answers for it, declining
   — each with its source (RA 10173 ss. 3(b), 13(a), 16(b), read on lawphil.net; NPC Circular
   2023-04 and the NPC's 2025 order against Tools for Humanity, from published summaries, and the
   page says to check their own text). "What withdrawing does" states what the server does: it
   erases the selfies, a pending review cannot be approved until a new selfie is sent. The list is
   data: nothing reads it to decide, and nothing puts it into the field.
6. **`BIOMETRIC_CONSENT_REQUIRED`** joins `API_ERROR_CODES` (contract drift) and is told in the
   server's words like `VERIFICATION_REQUIRED`; only a resident's app is ever sent it.

**Checks.** `check:app-settings` rule 10: the top-of-page sentence and its place before every
setting; the three effects and `appConfigEffects` listing them; the biometric consent kept out of
`asksEveryResident`; the mapper reading it whole and unknown when absent, and sending it with its
version; the mock's placeholder; the checklist's topics, sources and place beside the editor; and
every draft set from nothing but what was typed, what is published or `''` — an identifier
allow-list, stricter than rule 8's "no string literal", which a draft built from the checklist
would have passed. The "no text written yet" sentence is now required three times. Validated against
17 planted regressions.

**Left open.** Whether a resident who declines can verify another way (in person) is the owner's
decision; the checklist asks the office to say so and invents none. The verification screen does not
yet read `selfie_erased_at` (G1): an erased selfie reads 404 there and the server refuses its
approval with a 409.

## DL-217 — a hotline says what it is for, and the directory says when no line is the command center

**Status:** Settled (12 November 2026). Backend `ebd7aeb` (G5).

**Why.** The residents' app now picks a line by its `kind`, never by its name: the active
`command-center` is the line it shows when it tells a resident to call for an emergency. The API
allows at most one active command center (a partial unique index; a second is `409`), and its
backfill made every line `other` except 911 (`emergency`), so after deploy no line is the command
center until the office marks one.

**What changed.**

1. **`kind` on every line.** `HOTLINE_KINDS` is the spec's `HotlineKind`, each with words in
   `HOTLINE_KIND_LABELS` (Command center, Emergency 911, Police, Fire, Medical, Disaster and rescue,
   Other). The mapper reads it strictly: an unknown or missing kind makes the line unreadable, never
   `other`, because a command center read as `other` would have the page tell the office it has none.
   A new line's kind is chosen in the form and sent, never left to the server's default.
2. **The form.** A select after the number, with a hint that says the command center is the one line
   the app shows when it tells residents to call for an emergency, and that only one active line can
   be it. Choosing it, active, while another line holds the role shows a warning before the button
   naming that line and saying the server will refuse until that line is given another kind or made
   inactive. It warns and does not block: the list is a moment old, and the server decides
   (`DL-129`). The server's `409` comes back as `HotlineCommandCenterTakenError` (adapter and mock)
   and is put beside the kind with `aria-invalid`, until the kind or "Show in the app" changes.
3. **No automatic hand-over.** The console does not demote the old line and promote the new one in
   two requests: the second could fail after the first succeeded, leaving the app with no command
   center and nobody told. The server's own instruction is "change or deactivate the old one first",
   and the warning says exactly that.
4. **The list.** A "Kind" column of words; the old "Kind" column, which was the free-text category,
   is now headed "Category". Below the list the section names the command center, or says plainly
   "No line is marked as the command center." with what to do. Becoming, giving up or deleting the
   command center says what it does before the button.

**Checks.** `check:directory` rule 11: the kinds equal the vendored spec's enum, each in words; the
mapper's strict read; the kind sent on create and update; the `409` mapped to the domain's refusal in
the adapter and the mock; the select, its hint, the warning before the button, the button never held
by it, the refusal beside the kind; the kind column as words; and the "no command center" sentence.
Validated against 14 planted regressions.
