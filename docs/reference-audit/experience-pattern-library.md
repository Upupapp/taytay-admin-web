# Experience Pattern Library — Get Hired

Design and interaction sourcing only. **No feature, domain concept or
implementation technique from Get Hired enters this repository** — see
`DL-01` and §5 of the [feature source matrix](./feature-source-matrix.md).

Evidence base: `Upupapp/get-hired-FE` @
`1982731c00784f0d188453bf503c7d7888455492` (`master`). Paths are relative to
that repository root.

Get Hired maintains a formal design system under `GETHIRED_BRAND_*.md` (20
documents) plus `src/assets/styles/_tokens.scss` and `_motion.scss`. That
system, not its Angular 13 code, is what this library extracts.

Adoption key: **Adopted** (already true in this repo after TAB 01) ·
**Adopt** (binding on the TAB that builds the relevant surface) ·
**Adapted** (taken with a documented change) · **Rejected**.

---

## EPL-01 · The state taxonomy — every state answers seven questions

**Evidence:** `GETHIRED_BRAND_STATE_EXPERIENCE_SYSTEM.md`

> Every UI state answers: what's happening, why, what can I do next, is this
> temporary or final, did my action succeed, can I retry, is my data safe.

Nine named states: Loading (page/section), Inline Loading (action), Uploading,
Processing/Analysing, Empty (first use), Empty (zero results), Error, Success,
Offline/Degraded.

**Adoption: Adapted.** Our `ViewState<T>` (`idle | loading | ready | error`) is
the _transport_ state and stays as-is — it is what makes "no results while
loading" unrepresentable. Get Hired's taxonomy is richer because it distinguishes
states by _cause_, not by transport. Binding rule for later TABs: when a surface
needs a state this union cannot express (uploading, processing, offline), model
it as its own signal beside the `ViewState` rather than widening the union.

**The seven questions are adopted verbatim as the review checklist** for any new
async surface.

---

## EPL-02 · Skeletons mirror the real content shape

**Evidence:** `src/app/shared/components/application-completeness-card/application-completeness-card.component.html`

> `<!-- 7 elements mirror the real content shape: label / timestamp / score-row (pct number + badge) / progress / tips heading / tips body×2 -->`

Also `GETHIRED_BRAND_STATE_EXPERIENCE_SYSTEM.md` §1: "Skeleton shimmer matching
final layout dimensions… Never show blank white screen; never show GIF spinner
alone for page-level loads."

**Adoption: Adopt.** Our `Skeleton` primitive currently emits generic ragged
lines (`skeleton.ts`, `widthFor()`), which is honest for tables but weak for
detail panes. Later TABs building a detail surface should pass a line count that
matches the real layout, or extend `Skeleton` with a shape input. Recorded as an
improvement, not a defect — see `DL-14`.

---

## EPL-03 · Loading has granularity, and each grade has its own text

**Evidence:** `GETHIRED_BRAND_STATE_EXPERIENCE_SYSTEM.md` §§1–4;
`src/app/shared/components/{loading,inline-loading,record-loading,custom-profile-loader}`

| Grade          | Treatment                          | Text                                            |
| -------------- | ---------------------------------- | ----------------------------------------------- |
| Page / section | Skeleton                           | Visually-hidden `aria-live="polite"` "Loading…" |
| Action/button  | Small spinner, **button disabled** | Action-specific: "Saving…", "Publishing…"       |
| Upload         | Real progress bar + filename       | "Uploading [filename]…" → "Upload complete."    |
| Long analysis  | 3–5 step indicator                 | Named steps, never "AI analysing…"              |

Two hard rules: **no fake progress** ("Progress bar fills 0 → real%… No fake
jump"; "No fake progress bar jumping ahead"), and no spinner alone for a
page-level load.

**Adoption: Adopt.** Our `LoadingIndicator` (`size` + `message`) and `Skeleton`
already cover the first two grades. The binding addition for later TABs is that
**inline action text must be action-specific**, never a bare spinner — the
`message` input exists for exactly this.

---

## EPL-04 · Completeness is shown as a state, with graceful degradation

**Evidence:** `application-completeness-card.component.html` — five distinct
render branches: loading skeleton · error + **Try again** · null snapshot
("Completeness details unavailable right now.") · **pre-deployment**
("This application was submitted before completeness tracking was introduced.")
· full content.

**Adoption: Adopt (pattern only).** The _feature_ (CV completeness scoring) is
rejected — see FSM §5. The _pattern_ is directly applicable: our
`outstandingRequirements()` already computes what a request is missing, and the
assistance-request TAB will need to show that.

The genuinely valuable idea is the **pre-deployment branch**: a record that
predates the feature must say so plainly rather than render as 0% or as an
error. Every later TAB that adds a computed field to an existing entity must
handle "this record predates the field".

---

## EPL-05 · Empty-first-use and zero-results are different screens

**Evidence:** `src/app/shared/components/empty-section/empty-section.component.html`
uses two different illustrations keyed on a `search` input
(`empty.png` vs `empty-search.png`). `GETHIRED_BRAND_STATE_EXPERIENCE_SYSTEM.md`
§5 gives first-use the copy formula **"[Verb] your first [noun]"** plus a
primary CTA; §6 covers zero results.

**Adoption: Adopted.** TAB 01 arrived at the same split independently
(`EmptyStateVariant = 'empty' | 'no-results' | 'error' | 'forbidden'`), and
`resident-list-page.html` already swaps heading, message and action on
`hasFilters()`. This is independent corroboration, and the copy formula is
adopted for first-use headings.

---

## EPL-06 · Motion is tokenised, banded, and removable

**Evidence:** `src/assets/styles/_motion.scss`

```scss
$motion-duration-micro: 160ms; // microinteraction band 120–200ms
$motion-duration-card: 220ms; // card enter 180–280ms
$motion-duration-drawer: 260ms; // drawer/dialog 200–300ms
$motion-duration-meter-fill: 650ms;
$motion-ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
```

Two mixins: `motion-safe` (suppress transition + animation) and
`ambient-motion-safe`. The distinction is the point —

> these are removed entirely under reduced motion, never just slowed down

**Adoption: Adapt.** Our `styles.scss` has the global
`prefers-reduced-motion` block that collapses everything to `0.01ms`, which is
the blunt version of the same rule and is sufficient today. Later TABs adding
motion should use the duration bands above and must ensure ambient motion
(our skeleton shimmer) is _removed_, not merely shortened — see `DL-15`.

---

## EPL-07 · Accessibility guardrails as a standing checklist

**Evidence:** `GETHIRED_BRAND_ACCESSIBILITY_GUARDRAILS.md`

Adopted as the accessibility acceptance checklist for every later TAB:

| Guardrail                  | Rule                                                                           | Our status after TAB 01                                                             |
| -------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Visible focus              | Global `:focus-visible` outline, 2px, `outline-offset: 2px`                    | ✅ `styles.scss`                                                                    |
| **No colour-only meaning** | "All state badges: icon + text (not just green/red background)"                | ✅ `StatusBadge` always renders the label; the dot is `aria-hidden`                 |
| Reduced motion             | Global block + per-component mixin; ambient motion removed                     | ✅ global block · ⚠️ no per-component mixin — `DL-15`                               |
| Keyboard: modal            | Focus trap; **Escape returns focus to trigger**                                | ⚠️ Partial — `bindOverlay` restores focus and handles Escape, but does **not** trap |
| Text for animated state    | Visually-hidden `aria-live="polite"` for loading                               | ✅ `LoadingIndicator` renders `role="status"` + hidden "Loading"                    |
| `aria-busy`                | `aria-busy="true"` on the loading region; skeleton blocks `aria-hidden="true"` | ⚠️ Skeleton is `aria-hidden` ✅, but no `aria-busy` on the region — `DL-16`         |
| No flashing / shake        | No shake on error, no pulsing red loop, nothing ≥3 flashes/second              | ✅ No such animation exists                                                         |
| Autoplay                   | No decorative autoplay loops under reduced motion                              | ✅ N/A                                                                              |

The two ⚠️ rows are real, small gaps in TAB 01 output. They are logged
(`DL-15`, `DL-16`) rather than fixed here, because TAB 02 is an audit and must
not change application source.

---

## EPL-08 · Design tokens carry a semantic layer above the numeric scale

**Evidence:** `src/assets/styles/_tokens.scss` — CSS custom properties named
`--gh-<category>-<name>`, covering brand, surfaces, status, gradients, spacing
and radius. The instructive part is the **spacing double-layer**:

```scss
--gh-space-1: 4px;  …  --gh-space-12: 48px;      // numeric scale
--gh-space-micro: 4px;    --gh-space-compact: 8px;
--gh-space-card: 20px;    --gh-space-section: 24px;
--gh-space-major: 32px;   --gh-space-page: 48px;   // semantic aliases
```

**Adoption: Adapt.** Our `styles.scss` already uses CSS custom properties with a
numeric scale (`--space-1` … `--space-7`) and a status-tone layer that Get Hired
lacks — our `--tone-*` pairs are what let `StatusBadge` be driven from the
domain catalog. The missing half is the **semantic alias layer**: `--space-card`
reads better at a call site than `--space-4` and survives a scale change. Logged
as `DL-15`.

Note what is _not_ adopted: Get Hired's palette (`--gh-coral #FF675D`,
`--gh-navy`) and its CTA gradients belong to a commercial recruitment brand.
A municipal welfare console uses the restrained municipal-blue palette
established in TAB 01.

---

## EPL-09 · List toolbar: search, filter and export sit with the table

**Evidence:** `src/app/shared/components/reusable-table/reusable-table.component.html`
— the component owns a search input, a status-filter dropdown and an export
control above the table body.

**Adoption: Rejected as structure, adopted as layout.** Bundling search and
filters _into_ the table component is what makes such components hard to reuse —
it forces every consumer to accept one filtering model. Our `DataTable` is
deliberately presentational (rows in, intent out), with filters owned by the
feature page, as `resident-list-page.html` shows.

What _is_ adopted is the **visual arrangement**: search left, filters beside it,
export right, directly above the table, with the result count adjacent. Later
TABs should keep that arrangement while leaving the wiring in the page.

---

## EPL-10 · Semantic dialogs, not one generic modal

**Evidence:** `src/app/shared/components/{confirmation-dialog,success-dialog,updated-dialog}`

Get Hired ships three _named_ dialogs rather than one modal with a mode flag.

**Adoption: Adapted.** We keep the single `Modal` primitive — three near-identical
components is duplication our `CLAUDE.md` §7 forbids. The transferable insight is
that **the call site should read semantically**. Later TABs should build thin
feature-level wrappers (e.g. a confirm-destructive-action dialog) over `Modal`
rather than repeating heading/body/action markup on every page.

Note also that Get Hired routes _success_ through a dialog. We route success
through `NotificationStore` toasts, which is less interruptive. Retained.

---

## EPL-11 · Multi-step flows show progress and allow going back

**Evidence:** `src/app/shared/components/main-stepper/main-stepper.component.html`
— numbered steps, completed steps replace the number with a check, `disabled`
steps are not clickable, and completed steps are clickable to navigate back.

**Adoption: Adopt.** Directly relevant to assistance-request intake, which is a
long form with document upload. Binding for the intake TAB: show the step count
up front, mark completed steps, allow backward navigation, and never let a
forward step be reachable before its prerequisites.

---

## EPL-12 · Tabbed sub-navigation within a module

**Evidence:** `src/app/shared/components/tab-selectors`; corroborated on the
feature side by Esperanza, where `constituents`, `users`, `settings`, `reports`
and `sakuna` are each one route with a `tab` parameter
(`routes/web.php`).

**Adoption: Adopt, with a routing rule.** Both references converge on tabs for
dense modules, so tabs are the sanctioned pattern. Our rule, which neither
reference follows: **each tab gets its own URL**, as Esperanza's named routes
already imply (`admin.constituents.data-quality`). A tab a user cannot reach
must not render, and its route carries the same permission as its content —
that is `CLAUDE.md` rule 8 applied one level deeper.

---

## EPL-13 · Correspondence is a thread, not a field

**Evidence:** `src/app/shared/components/message-thread`

**Adoption: Adopt.** Our `CaseNote` already carries `authorName`, `createdAt`
and a `visibility` of `internal | shared-with-applicant`. Rendering those as a
chronological thread — with the internal/shared distinction visible at a glance
— is the pattern the assistance-request detail TAB should follow.

---

## EPL-14 · An honest "not built yet" screen

**Evidence:** `src/app/shared/components/under-construction`

**Adoption: Adopted.** TAB 01 arrived at the same conclusion:
`FeaturePlaceholderPage` renders the real page header plus an `EmptyState`
naming the TAB that will build it. Both references agree that a planned-but-
absent screen should say so rather than 404 or render blank.

---

## EPL-15 · The conformance target is WCAG 2.2 Level AA

**Evidence:** neither reference names a conformance target. Get Hired's
`GETHIRED_BRAND_ACCESSIBILITY_GUARDRAILS.md` is a practical checklist, not a
standard, so the target is this project's own decision — recorded as `DL-20`
and verified on 2026-08-14 against the primary document,
[WCAG 2.2](https://www.w3.org/TR/WCAG22/), W3C Recommendation of
12 December 2024.

**Adoption: Adopt.** EPL-07's checklist is how we work day to day; WCAG 2.2 AA
is what we are accountable to. The criteria introduced in 2.2 that bear on this
console — 2.4.11 Focus Not Obscured (AA), 2.5.7 Dragging Movements (AA),
2.5.8 Target Size (AA), 3.2.6 Consistent Help (A), 3.3.7 Redundant Entry (A) and
3.3.8 Accessible Authentication (AA) — are set out with their consequences in
`DL-20`.

Two are worth flagging here because they constrain surfaces already built:
**2.4.11** interacts with our sticky topbar and sticky table headers, and
**2.5.8** applies to the small icon buttons in `DataTable`, `Modal` and
`Drawer`.
