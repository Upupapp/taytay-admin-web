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
