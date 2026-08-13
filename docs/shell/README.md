# Application Shell, Navigation & Global Interaction (TAB 04)

The authenticated frame every feature renders inside: navigation, topbar,
breadcrumb, global-search trigger, global feedback and motion primitives.

Decisions: `DL-26` (WCAG 2.4.11 / 2.5.8), `DL-27` (responsive semantics),
`DL-28` (search trigger only), `DL-29` (route progress) in
[`../reference-audit/decision-log.md`](../reference-audit/decision-log.md).

---

## Structure

| Component             | File                        | Owns                                               |
| --------------------- | --------------------------- | -------------------------------------------------- |
| `Shell`               | `layout/shell/`             | The frame, and one piece of state: drawer open     |
| `AppNav`              | `layout/navigation/`        | Permission-filtered navigation list                |
| `AppTopbar`           | `layout/topbar/`            | Nav toggle, breadcrumb slot, search trigger, inbox |
| `AppBreadcrumb`       | `layout/breadcrumb/`        | Route-derived trail                                |
| `GlobalSearchTrigger` | `layout/search/`            | Button + Ctrl/Cmd+K. **No search logic** (`DL-28`) |
| `RouteProgress`       | `shared/ui/route-progress/` | Lazy-route loading feedback                        |
| `ViewportService`     | `core/layout/`              | The one breakpoint the shell changes semantics at  |

Copy lives in `layout/layout.copy.ts`, per `DL-23`. Motion and interaction
tokens live in `src/styles/_motion.scss` and `src/styles/_interaction.scss`.

---

## The four acceptance guarantees, and how each is evidenced

### 1. Every primary module in ≤ 2 navigation actions

The navigation model is **flat**. On a wide viewport the sidebar is always
visible, so any module is one action — click the link. On a compact viewport it
is two — open the drawer, click the link. There are no sub-menus, so nothing can
be three deep.

_Evidence:_ `layout.spec.ts` asserts every entry in `NAVIGATION` renders as a
direct `<a>`, that the link count equals the module count, and that **no nested
list exists inside a nav item** — the assertion that would fail if someone added
a fly-out.

### 2. Keyboard navigation through shell and menus

Skip link → topbar → breadcrumb → search → inbox → navigation → main. Every
control is a real `<button>` or `<a>`. The nav toggle publishes `aria-expanded`
and `aria-controls`; the search trigger publishes `aria-keyshortcuts`.

When compact, the drawer is a dialog: focus moves in on open, Escape closes it
and returns focus to the toggle, and while closed it is `inert` so Tab does not
wander into an invisible menu. When wide, Escape deliberately does nothing —
removing the only navigation would be worse than useless.

_Evidence:_ tests for Escape-closes-and-restores-focus, wide-Escape-does-
nothing, inert-when-closed, `aria-modal` when open, scrim behaviour, and drawer
auto-close after navigation.

### 3. No shell-caused horizontal overflow on mobile

The usual cause is a flex child refusing to shrink: `min-width` defaults to
`auto`, so wide content pushes the row wider than the viewport. Every shell
column therefore declares `min-inline-size: 0`, `.shell` clips horizontal
overflow, and nothing is sized in `vw` (which includes the scrollbar).

_Evidence:_ `tools/check-shell-a11y.mjs` fails if `.shell__main`,
`.shell__content` or `.topbar` loses `min-inline-size: 0`, if `.shell` stops
clipping, or if any layout rule sizes to `100vw`.

**Honest limit:** this is a check of the CSS contract, not a rendered
measurement. jsdom performs no layout, and no real browser is installed here.

### 4. prefers-reduced-motion disables non-essential motion

Two kinds of motion, suppressed differently (`DL-15`):

- **Transitional** (drawer sliding in) — collapsed to instant. The end state
  still applies, so nothing becomes unreachable.
- **Ambient** (shimmer, progress bar) — `animation: none`. Shortening a loop
  makes it spin faster rather than stop.

Non-essential transforms are dropped via `.motion-transform`, which the sidebar
carries. Components that need a sensible static end state add their own
fallback — `RouteProgress` becomes a full-width static bar rather than
disappearing.

_Evidence:_ the audit asserts the reduced-motion block exists, uses a
**universal** selector, and sets `animation: none` and `transform: none`.

---

## Checks

```bash
npm run check:shell   # target size, focus scroll margin, motion, overflow contract
npm test              # navigation, keyboard, breadcrumb, search trigger, progress
npm run verify        # lint, typecheck, check:brand, check:shell, tests, build
```

`tools/check-shell-a11y.mjs` exists because jsdom cannot measure layout. It
audits the CSS contract that produces the guarantee instead of asserting the
guarantee itself, and it was validated against a deliberately introduced
regression before being trusted.

---

## Known gaps

- **No real-browser verification.** No Playwright or Puppeteer is installed and
  none was added for a single audit. Overflow, target size and focus visibility
  are enforced through their CSS contract, not measured in a rendering engine.
  A device-lab or Playwright pass is the honest next step.
- **Global search is a trigger only** (`DL-28`) — by design.
- **Breadcrumbs stop at module level.** Detail pages ("Residents › Aurora
  Mercado") need a per-route hook, which belongs with the feature that owns the
  record.
- **Bilingual UI** remains a product decision (`DL-18`); the copy module is
  ready (`DL-23`).
