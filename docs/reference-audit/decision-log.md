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
cut used `disbursement.view` for unclaimed payouts and `referral.view` for
unanswered referrals, which put items on the read-only auditor's to-do list that
they could do nothing about. They are now `disbursement.schedule` and
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
   disbursement regardless of date, so the label claimed a window the number did
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
