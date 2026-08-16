# Responsive, degraded-state, accessibility and performance

The cross-application hardening pass. Built in TAB 22. Decision records:
`DL-118` … `DL-120`.

This is a **findings log** as much as a feature record: what was measured, what
turned out to be a real gap, and what turned out to be fine already.

---

## What was measured, and what it found

| Checked | Result |
| --- | --- |
| Network / offline handling | **Gap** — `navigator.onLine` appeared nowhere. Built. |
| Search debounce | **Gap** — 7 private copies of one constant; 5 screens with none. Consolidated. |
| Shared style primitives | **Gap** — 5 stylesheets redefined the global `.field` divergently. Removed. |
| Component style budget | **Gap** — one file over budget since TAB 16. Cleared. |
| Focus trap in overlays | Already correct — `overlay.behavior.ts`, used by `Modal` and `Drawer`. |
| Reduced motion | Already correct — global `*` rules remove ambient animation outright. |
| Placeholder-as-label | Already correct — 21 placeholders, every one with a real label. |
| `aria-live` discipline | Already correct — 2 regions, both `polite`, none assertive. |
| Fixed pixel widths (zoom risk) | Already correct — only decorative dots and spinners. |
| Accessible chart alternatives | Already correct — `ChartTable` **is** a table (`DL-108`). |

Six of ten were already sound. That is worth recording: a hardening pass that
reports ten fixes is usually a pass that invented some.

---

## Degraded state: warn, never queue

`NetworkStatus` observes `navigator.onLine` and drives a **warning only**.
Nothing is queued, nothing is retried in the background, and nothing is marked
saved on the strength of it (`DL-118`).

The master command is explicit that this is an admin system and that full
offline transactional integrity must not be promised without a backend
strategy. `DL-87` already settled the honest-capture doctrine for field visits —
exactly one state means the office record has it, and a failed send says plainly
that nothing was queued. TAB 22 extends that application-wide.

### What the banner says, and does not

> **Offline** — This device has lost its connection. You can keep reading
> anything already on screen, but nothing can be saved until it returns — and
> nothing is being held in the background to send later.

> **Connection restored** — The connection is back. Anything you tried to save
> while it was down was not kept, so check the record and enter it again if it
> is missing.

Three deliberate choices:

- **`role="status"`, not `role="alert"`.** Losing a connection is a condition of
  the device, not an error in the page. `alert` interrupts a screen reader
  mid-sentence.
- **The restored message does not auto-dismiss.** It says work was *not* kept —
  exactly the message that must survive somebody looking away. A person
  dismisses it; never a timer.
- **No "we will retry" anywhere.** `check:hardening` fails the build if any of
  the three notices starts promising a send, a sync or a queue.

`navigator.onLine` is a weak signal — it reports whether an interface is up, not
whether the API is reachable — and the service is honest about that by never
letting it change behaviour.

---

## One debounce window, not seven

Before TAB 22 the same 250ms lived as a **private `const` in seven list
screens**, and five other screens had no debounce at all — typing "Sarmiento"
fired nine reads across the registry, and the eight thrown away cost exactly as
much as the one kept (`DL-119`).

`SEARCH_DEBOUNCE_MS` and `debouncedTerm` now live in
`shared/state/debounced.ts`, and every screen imports them.

**Only the typed term is debounced.** Choosing a status from a dropdown is a
single deliberate act and takes effect at once — debouncing the whole query
would make every filter feel broken.

The URL-driven lists debounce the *navigation* rather than a signal, because
each keystroke would otherwise push a history entry as well as a query. Same
constant, different application, and the constant is now shared.

---

## A shared primitive is defined once

`.field`, `.field__label`, `.field__input` and `.field__hint` are declared in
`src/styles.scss`, whose own comment warns: *"a field that looks and behaves
differently on each screen is how an encoder learns to distrust one."*

Five feature stylesheets had redefined them anyway, with **different values** —
`display: block` instead of flex, different label and hint colours. A local copy
does not extend the shared control; it replaces it (`DL-120`).

Removing them:

- cleared ~3kB of divergent duplication,
- brought `visit-detail-page.scss` back under the component-style budget it had
  exceeded since TAB 16,
- and made every form field in the application look the same again.

`.field + .field` now supplies the stacking margin the local copies were
really there for.

---

## Accessibility checklist

Target: **WCAG 2.2 Level AA** (`DL-20`).

| Requirement | How it is met | Guarded by |
| --- | --- | --- |
| Semantic headings and landmarks | `PageHeader`, one `<main>`, labelled `<section>`s | `check:shell` |
| Keyboard navigation, logical focus order | Real `<button>`/`<a>` throughout; no `tabindex > 0` | `check:shell` |
| Focus trap in dialogs and drawers | `overlay.behavior.ts` — Tab cycles, Escape closes, focus restored | `check:hardening` |
| `aria-live` only for meaningful updates | 2 regions, both polite (route progress, person picker) | `check:hardening` |
| Form labels, hints, error summaries | Every input in a `<label>` or `aria-label`led | `check:hardening` |
| Never placeholder-as-label | 21 placeholders, all additionally labelled | `check:hardening` |
| Never colour or hover alone | Status badges carry text; late work carries a sentence (`DL-102`); the connection banner carries a word | `check:work` |
| Touch targets | `--target-min` on interactive controls; `.field__input` at 36px | — |
| Reduced motion | Ambient animation removed outright, transitional collapsed (`DL-15`) | `check:hardening` |
| Accessible charts | `ChartTable` **is** a table with a caption and summary (`DL-108`) | `check:reports` |
| Chart claims verifiable | Every series carries a required summary sentence | `check:reports` |

### Responsive

- **Desktop** — dense but breathable; grids at `minmax(280–320px, 1fr)`.
- **Tablet** — the sidebar becomes a modal drawer below 900px, with focus
  trapping and `aria-modal`, because that is a change of *semantics* and not
  just appearance (`ViewportService`).
- **Mobile** — cards rather than tables where a table cannot fit; wide tables
  scroll inside their own `overflow-x` container rather than the page.
- **Zoom** — no fixed pixel widths on containers; the only `px` widths in the
  application are decorative dots and spinners.
- **Long Filipino names and purok addresses** — no `text-overflow: ellipsis` on
  a name anywhere; names wrap.

---

## Performance findings

| Finding | Action |
| --- | --- |
| Search fired one read per keystroke on 5 screens | Debounced (`DL-119`) |
| 7 duplicate debounce constants | Consolidated |
| ~3kB of duplicated component CSS | Removed (`DL-120`) |
| One stylesheet over budget since TAB 16 | Cleared; the build now emits no warnings |
| Routes | Already all lazy — verified, unchanged |
| Skeletons | Already via `AsyncContent` — verified, unchanged |
| Charting library | None, deliberately (`DL-108`) — verified, unchanged |
| Virtualised lists | **Not added.** A municipal caseload does not reach the sizes that justify the complexity, and the list caps are stated rather than implicit (`LIST_LIMIT = 300`). |

**No image payload work was needed**: the application ships the municipal seal
and nothing else, and `check:brand` already guards it.

---

## Files

| Path | What it holds |
| --- | --- |
| `core/network/network-status.ts` | The connection signal and the three notices |
| `shared/ui/connection-banner/` | The banner, mounted once by the shell |
| `shared/state/debounced.ts` | `SEARCH_DEBOUNCE_MS`, `debounced`, `debouncedTerm` |
| `styles.scss` | The shared field primitives, defined once |
| `styles/_motion.scss` | The reduced-motion contract |
| `shared/ui/overlay/overlay.behavior.ts` | Focus trapping (earlier TAB) |
| `tools/check-hardening.mjs` | The build gate for all of the above |

`npm run check:hardening` was validated against 19 planted regressions; every
one fails the build.
