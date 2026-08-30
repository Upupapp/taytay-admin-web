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

**Status:** Settled (implemented in TAB 10; narrows the gap left by `DL-30`).

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

**Status:** Settled (implemented in TAB 10).

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

**Status:** Settled (implemented in TAB 24).

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

**Status:** Settled (implemented in TAB 24).

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

**Status:** Settled (implemented in TAB 25).

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

**Status:** Settled (implemented in TAB 25).

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

**Status:** Settled (implemented in TAB 25).

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

**Status:** Settled (implemented in TAB 25).

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
