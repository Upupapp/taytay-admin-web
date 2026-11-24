# Staff console design system

How the console looks, and how to build a screen that looks the same. Written from the code as it
stood at the end of the redesign (`DL-200` to `DL-203`, November 2026). Where this file and the code
disagree, the code is right and this file is out of date: fix the file.

**Sources, in order of authority.** The repository checks and the decision log
(`docs/reference-audit/decision-log.md`) win over everything here: a privacy, access or domain rule
is never traded for a look. Then the code (`src/styles.scss`, `src/styles/`, `src/app/shared/ui/`,
`src/app/layout/`). Then this file. Then the mock-ups in [`admin/screens/`](./admin/screens/), which
are drawings with **sample data** ([`README.md`](./README.md) says how to open them): copy their
shapes, never their content.

---

## 1. Where things live

| File                                    | Holds                                                                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/styles.scss`                       | Every colour, gradient, type, radius, height, spacing and status-tone token (`:root`) and their dark values (`@mixin theme-dark`); the reset; the primitives `.btn`, `.field`, `.check`, `.card`; the global focus ring. |
| `src/styles/_brand-tokens.scss`         | Focus-ring tokens, semantic spacing aliases (`DL-17`), seal sizes and the seal placeholder's colours; the `.focus-ring` class.                                                                                           |
| `src/styles/_focus.scss`                | `@mixin ring`, the focus ring's three declarations, written once. Emits no CSS.                                                                                                                                          |
| `src/styles/_interaction.scss`          | `--target-min` (24px), `--focus-scroll-margin`, the `.icon-button` contract.                                                                                                                                             |
| `src/styles/_motion.scss`               | `--motion-*` durations and easings, `.motion-micro` / `.motion-panel`, the reduced-motion rules.                                                                                                                         |
| `src/styles/_fonts.scss`                | The self-hosted Inter and Inter Tight faces (`src/styles/fonts/`). Never add a Google Fonts link: the CSP has no font origin for it.                                                                                     |
| `src/styles/_patterns.scss`             | The page patterns (§4): chips, tabs, KPI figures, notices, fact lists, form sections, grids. Loaded last, so a pattern can refine a primitive.                                                                           |
| `src/app/shared/ui/`                    | The shared components (§5), exported from `@shared/index`.                                                                                                                                                               |
| `src/app/layout/`                       | The frame: shell, sidebar navigation, topbar, breadcrumb, search trigger, notification list (§6).                                                                                                                        |
| `src/app/shared/brand/brand-palette.ts` | The audited TypeScript mirror of the colour tokens, light and dark. `check:brand` keeps it equal to the SCSS; its spec measures its pairs in both themes.                                                                |

A feature stylesheet holds layout for that screen only: grids, gaps, widths, the order of things. It
takes every colour, type size, radius and height from a token, and every repeated shape from a
primitive or a pattern class. `npm run check:styles` enforces the colour, type-size and shadow part
of that (§9).

---

## 2. Tokens (CSS custom properties)

All in `:root`. Names in the first groups are the mock-ups' own, so a rule translated from a mock-up
can keep `var(--card)` as it is written there. The values below are the light theme's; the dark
theme restates the colours and surfaces in `@mixin theme-dark` ("Dark theme", the end of this
section).

### Colours

**Palette** (the design README's): `--blue` #0a2071, `--navy` #08124a, `--gold` #f5da18, `--red`
#e0090a, `--green` #17663a, `--sky` #2d54e0, `--fill` #f2f4f8, `--divider` #eef1f6 (decorative,
exempt from 1.4.11), `--blue-50` #ecf1fc, `--blue-100` #dce5fa.

**Inks**

| Token                                         | Use                                                                                                                                                       |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--primary` (= `--blue`)                      | Primary buttons, current tab, chart line. A fill, never a text colour: brand text is `--link` (`DL-204`).                                                 |
| `--primary-hover` #3a63f0                     | Primary button hover.                                                                                                                                     |
| `--on-primary` #fff                           | Text on `--primary`, `--danger-fill` and the deep fills.                                                                                                  |
| `--deep` (= `--navy`)                         | Deep record cards, the sign-in artwork.                                                                                                                   |
| `--ink` #08124a                               | Headings, names, figures.                                                                                                                                 |
| `--text` #1b2540                              | Body text (`body` default).                                                                                                                               |
| `--text2` #2b3550                             | Secondary text, field labels, `.check` labels.                                                                                                            |
| `--muted`, `--muted2` #4f586c                 | Hints, captions, placeholders. Darkened in `DL-202` to hold 4.5:1 on glass; both names stay because the mock-ups use both.                                |
| `--link` (= `--blue`), `--link-hover` #1d3a9c | Text links.                                                                                                                                               |
| `--danger-fill`, `--danger-fill-hover`        | A filled destructive control: `.btn--danger`, the unread badge. The red ink in light; its own token because the dark red ink is a text colour (`DL-204`). |
| `--on-deep` #fff, `--on-deep-muted` #c3cde6   | Text on `--deep` (audited).                                                                                                                               |

**Tints and their inks** (chips, notices, effects lists — a tint always carries its own ink):
`--blue-tint`, `--gold-tint`, `--gold-tint2`, `--gold-ink` #5c4d00, `--gold-ink2` #3d3505,
`--red-tint`, `--red-ink` #b00708, `--red-ink2` #7a0506, `--green-tint`, `--green-ink` #17663a.

**Status tones** (consumed by `StatusBadge` and the chip modifiers; each pair is audited):
`--tone-{neutral,info,progress,success,warning,danger}-{fg,bg}`.

**Charts:** `--axis`, `--dash`, `--area`, `--bar`, `--chart-line`, `--accent-line`.

**Overlays and options:** `--scrim`, `--scrim2` (behind dialogs), `--ring` (the gap around a badge
on another element), `--option-bg`, `--option-ink` (native `<option>`).

**Deep-panel extras:** `--on-deep-fill`, `--on-deep-edge`, `--on-deep-chip` (white at 7/12/10%).

**Seal placeholder:** `--seal-placeholder-bg`, `-fg`, `-border` (`_brand-tokens.scss`; deliberately
unlike a government seal, so a placeholder is never mistaken for the real one).

### Surfaces

| Token               | Value / use                                                                                                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--page-base`       | #e7ecf7, the page colour under the wash; `body` background.                                                                                                                                      |
| `--page`            | The wash: five soft radial blobs over `--page-base`, painted once by a fixed `body::before`.                                                                                                     |
| `--card`            | White glass, 62% → 40% (`DL-202`). `.card` uses it.                                                                                                                                              |
| `--card-solid`      | #fff. Listboxes, a field with focus, print, the reduced-transparency fallback.                                                                                                                   |
| `--card-flat`       | White 40%: the secondary `.btn`.                                                                                                                                                                 |
| `--card-edge`       | White 70%: the 1px edge of a glass card.                                                                                                                                                         |
| `--soft`            | Navy 6%: soft rows, disabled fields, sub-panels.                                                                                                                                                 |
| `--soft2`           | White 42%: table header band, soft blocks inside a card.                                                                                                                                         |
| `--field`           | White 55%: a field at rest.                                                                                                                                                                      |
| `--hover`           | White 55%: hover on a button or row.                                                                                                                                                             |
| `--sel`             | Sky 12%: a chosen tile or option.                                                                                                                                                                |
| `--line`, `--line2` | Navy 10% / 18%: hairlines and the secondary button's border.                                                                                                                                     |
| `--field-line`      | #6b7489: a field's boundary (3:1, WCAG 1.4.11).                                                                                                                                                  |
| `--glass-filter`    | `blur(22px) saturate(170%)`. Only on an element that never contains a fixed overlay (sidebar, topbar pills): a backdrop filter traps a modal opened inside it. `.card` has none for that reason. |

`prefers-reduced-transparency: reduce` turns `--card`, `--card-flat` and `--field` solid white.

### Gradients

`--page` (above), `--card` (above), `--deep-panel` (radial glows over `--deep`: the sign-in artwork,
deep cards), `--tile-{blue,green,gold,red,navy,sky}` (icon tiles, 135°; glyph `--tile-ink` white,
`--tile-gold-ink` navy on gold). `--grad-header` and the `--header-shape-*` tokens hold the README's
blue header with its two circles; **no screen uses them** — a page name is not drawn at all
(`DL-246`), and a shown heading sits on the wash, not on a gradient (`DL-201`).

### Type

Families: `--font-body` (Inter), `--font-display` (Inter Tight: page and section titles, `h1`/`h2`),
`--font-mono` (codes and ids).

| Token             | Size   | Use                                         |
| ----------------- | ------ | ------------------------------------------- |
| `--fs-display`    | 42px   | A shown page heading (`DL-246`)             |
| `--fs-kpi-lg`     | 44px   | The dashboard's headline counts (DL-231)    |
| `--fs-kpi`        | 38px   | Headline figure (`.kpi__value`)             |
| `--fs-kpi-md`     | 36px   | A figure in a row of four (DL-231)          |
| `--fs-kpi-money`  | 34px   | A peso total beside counts (DL-231)         |
| `--fs-kpi-sm`     | 28px   | A figure in a row of five or six (DL-231)   |
| `--fs-hero`       | 34px   | Unused since DL-246 (was the hero band)     |
| `--fs-title-xl`   | 32px   | Sign-in title                               |
| `--fs-title-lg`   | 26px   | Record title                                |
| `--fs-title`      | 24px   | Card or dialog title                        |
| `--fs-title-md`   | 22px   | Step title, feature panel title             |
| `--fs-title-sm`   | 20px   | `.section-title--display`                   |
| `--fs-heading`    | 18px   | Heading inside a panel                      |
| `--fs-subheading` | 16px   | Sub-heading, large avatar initials          |
| `--fs-section`    | 15px   | `.section-title`, page lead                 |
| `--fs-body`       | 14.5px | Body (`body` default)                       |
| `--fs-control`    | 14px   | Primary buttons, fields, navigation         |
| `--fs-sm`         | 13.5px | Secondary buttons, breadcrumbs, list detail |
| `--fs-label`      | 13px   | Field labels                                |
| `--fs-xs`         | 12.5px | Hints, chips, supporting text               |
| `--fs-2xs`        | 12px   | Captions under media                        |
| `--fs-caption`    | 11.5px | Table headings                              |
| `--fs-micro`      | 11px   | Eyebrow labels, counters                    |

Weights `--fw-regular` 400, `--fw-medium` 500, `--fw-semibold` 600, `--fw-bold` 700. Line heights
`--lh-body` 1.5, `--lh-snug` 1.25, `--lh-display` 1.05. Letter spacing `--ls-display` −0.025em,
`--ls-title` −0.01em, `--ls-caps` 0.06em (uppercase eyebrows).

### Radii

`--r-xs` 4 · `--r-sm` 10 · `--r-md` 12 (navigation items) · `--r-field` 14 · `--r-lg` 16 (notice
boxes) · `--r-box` 18 · `--r-xl` 20 (sections inside a card) · `--r-card` 24 · `--r-panel` 28
(dialogs, large panels) · `--r-frame` 36 (sign-in frame) · `--r-pill` 999 (buttons, chips, tabs) ·
tiles `--r-tile` 14, `--r-tile-sm` 11, `--r-tile-lg` 17 · `--header-radius` 28 (unused, see
Gradients).

### Heights and sizes

`--h-field` 46 · `--h-btn` 44 (primary) · `--h-btn-sm` 38 (secondary) · `--h-btn-lg` 48 (the page's
call to action, form footers) · `--h-nav` 42 · `--h-tab` 40 · `--h-icon-btn` 46 · icon tiles
`--tile` 44, `--tile-sm` 36, `--tile-lg` 56 · seals `--seal-size-{sm,md,lg,xl}` 32/48/96/160 ·
shell `--shell-sidebar-width` 256, `--shell-topbar-height` 60 · `--target-min` 24 (the WCAG 2.5.8
floor every control keeps).

### Spacing

Numeric scale `--space-1` … `--space-7` = 4, 8, 12, 16, 24, 32, 48. Semantic aliases
(`_brand-tokens.scss`, `DL-17`): `--space-micro`, `-compact`, `-snug`, `-base`, `-card`, `-loose`,
`-section`, `-page`. A few patterns use the mock-ups' in-between values (6px, 10px, 14px, 22px) for
padding; a new screen uses the scale.

### Focus

`--focus-ring-color` (gold), `--focus-ring-inner` (navy), `--focus-ring-width` 3px,
`--focus-ring-offset` 2px (`_brand-tokens.scss`); `--focus-scroll-margin` keeps a focused element
clear of the topbar (`_interaction.scss`). The global rule draws a gold outline **and** a navy inner
ring:

```scss
outline: var(--focus-ring-width) solid var(--focus-ring-color);
outline-offset: var(--focus-ring-offset);
box-shadow: 0 0 0 var(--focus-ring-offset) var(--focus-ring-inner);
```

The gold alone fails 3:1 on light surfaces; the navy alone vanishes on navy fills. Never remove either
half, never `outline: none` without a replacement, and use `.focus-ring` to opt a custom element in.
The three declarations are written once, as `@mixin ring` in `src/styles/_focus.scss`; the global
rule, `.focus-ring` and a radio tab's ring (§4, Tabs) each `@include focus.ring`, and a new place
that draws the ring in a global stylesheet does the same rather than typing them again.
Date and time inputs draw it on `:focus-within`, because Chromium stops matching `:focus-visible`
after their first part (`DL-202`).

### Motion

`--motion-micro` 160ms, `--motion-panel` 220ms, `--motion-overlay` 260ms, `--motion-ease-standard`,
`--motion-ease-decelerate`. Reduced motion removes ambient animation outright (`_motion.scss`,
`check:shell`).

### Dark theme

The console has a light and a dark theme (`DL-204`), the dark one drawn from the `.theme-dark` block
of the mock-ups (the same in all twelve).

**How the tokens are paired.** `:root` holds every token's light value. `@mixin theme-dark` in
`src/styles.scss` holds the dark value of each colour and surface that differs; a token it does not
name keeps its light value in both themes — the palette (`--blue` … `--sky`), the tiles, the seal
placeholder, type, radii, sizes. The mixin is included once, for the screen only, so a printed page is
always light, and only when the Dark mode button has put `data-theme="dark"` on `<html>`. The
stylesheet does not read `prefers-color-scheme`: the console opens light on every computer, including
one set to dark (`DL-207`).

```scss
@media screen {
  :root[data-theme='dark'] {
    @include theme-dark; // Dark mode turned on with the button
  }
}
```

Reduced transparency is restated after it, at its specificity, so it turns the dark glass solid
as well. An alias resolves within its theme: the light `--danger-fill: var(--red-ink)` would land on
the dark red ink if `theme-dark` did not restate it, exactly as in the browser.

**Where the dark values leave the mock-up.** Each failed WCAG AA as drawn; the comment beside each
value in `styles.scss` gives the measurement.

| Token                                                        | Mock-up                         | Dark value                                      | Why                                                                                                                                                  |
| ------------------------------------------------------------ | ------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--card`                                                     | white 12% → 4%                  | the same, over a 70% veil of `--page-base`      | Over the bright blue at the top-left (the sidebar) muted text fell to 2.9:1, links 3.6:1, red ink 3.1:1.                                             |
| `--primary`                                                  | #2d54e0                         | #2c51d9                                         | Gold initials and the current-page icon on it measured 4.3:1.                                                                                        |
| `--muted`, `--muted2`                                        | #9aa6c4, #8c98b8                | #a4b0cc for both                                | Measured 4.2:1 on the gold-tinted "late" bucket over the glass, and #8c98b8 4.0:1 at the top-left; one value for both names, as in light (`DL-202`). |
| `--field-line`                                               | white 24%                       | #7884aa                                         | 2.1:1 on the solid card, and an alpha cannot be audited.                                                                                             |
| `--on-deep-muted`                                            | — (light #c3cde6)               | #d6def2                                         | 4.0:1 on the dark primary (a tally, the app-figures notice).                                                                                         |
| `--focus-ring-inner`                                         | — (gold outline only)           | #4169f2                                         | The light navy vanishes on dark; this holds 3:1 on the dark surfaces and against the gold.                                                           |
| `--danger-fill`, `--danger-fill-hover`                       | #e0090a badge                   | `var(--red)`, #b00708                           | The dark red ink is a pink for text on a tint; white on it is 2.3:1.                                                                                 |
| `--fill`, `--divider`, `--blue-50`, `--blue-100`, `--tone-*` | — (README palette, light tints) | the dark tints laid over `--card-solid`, as hex | Not in the mock-up; solid so they can be audited.                                                                                                    |

**Two roles the audit holds.** Brand text is `--link` (the same blue as `--primary` in light): never
`color: var(--primary)`, because in dark the primary is a fill (2.6:1 on the dark card). A filled
destructive control is `--danger-fill`: never a red ink as a background. `check:contrast` fails on
either.

**Adding a colour token, in both themes.**

1. Declare it in `:root` beside its group, with a comment saying what it is for.
2. Declare its dark value in `theme-dark`, unless it is a fixed brand colour that reads on both (then
   say so in the comment). A token declared only in `theme-dark` fails `check:contrast`.
3. If it is painted as text or as a boundary, add its pair to `tools/check-contrast.mjs` and to
   `auditedPairsFor` in `brand-palette.ts`: each list runs once per theme. If it is in `TOKEN_MAP`
   (`tools/check-brand-assets.mjs`) or is a status tone, give it the same values in `BRAND_PALETTE` /
   `BRAND_PALETTE_DARK` (or `TONE_PALETTE` / `TONE_PALETTE_DARK`).
4. A value that fails in one theme is changed in that theme, never the threshold. A token that plays
   a different part in each theme is two tokens, each named for its part.
5. Sweep the screens it is painted on in both themes (§10): glass is not audited statically.

`.claude/commands/change-token.md` walks through it.

**The control** (`DL-207`). One "Dark mode" button, `app-theme-toggle`
(`shared/ui/theme-toggle/theme-toggle.ts`): a `.btn.btn--secondary.btn--small` toggle button with
`aria-pressed`, a moon icon while the console is light and a sun while it is dark, and a label that
never changes, so a screen reader hears "Dark mode, pressed" or "not pressed". It sits in the
topbar beside the live-updates toggle, at the top right of every page (above a page's own actions,
such as the dashboard's Refresh), where it stays at every width — on a phone-width screen it narrows
to its icon and keeps "Dark mode" as its name — and at the top of the sign-in page beside the seal,
so the theme can be changed before signing in.
`ThemeService` (`shared/state/theme.service.ts`) sets `data-theme="dark"` on `<html>`, or removes it
for light. Light is the default and needs no script, so nothing flashes before the app starts — and
the CSP (`script-src 'self'`) refuses the inline snippet a stored choice would need.
`<meta name="color-scheme" content="light">` and each theme's `color-scheme` give native controls,
the date picker and scrollbars the matching scheme.

**Storage: none.** `check:auth` refuses `localStorage`, `sessionStorage`, cookies and IndexedDB
anywhere in `src/` — a rule about _whether_ the console stores anything, which needs no judgement —
so the choice is held in memory for the tab. A reload opens light again, which is the default the
owner asked for (`DL-207`).

**Images.** The seal and photographs are never recoloured for the dark theme (`DL-199`, `DL-22`).

---

## 3. Global primitives (`src/styles.scss`, `_interaction.scss`)

Defined once and never redefined in a feature stylesheet (`DL-120`, `check:hardening`).

| Class                                                                        | What it is                                                                                                                                                               |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `.btn`                                                                       | The secondary button: 38px pill, `--line2` border, glass fill.                                                                                                           |
| `.btn--primary`                                                              | 44px, `--primary` fill, hover `--primary-hover`. Inside `.form-footer`: 48px.                                                                       |
| `.btn--danger`                                                               | Filled red: the _confirming_ button of a destructive act, inside its dialog. Never an archive or a restore, which a restore undoes (`DL-225`, §7).                      |
| `.btn--danger-outline`, `.btn--danger-soft`                                  | A destructive act that opens a confirmation (`_patterns.scss`). Not Archive: that row button is a plain `.btn`.                                                         |
| `.btn--secondary`, `.btn--subtle`                                            | Explicit secondary; borderless text button.                                                                                                                              |
| `.btn--small`                                                                | A row action in a table (never below `--target-min`).                                                                                                                    |
| `.btn--arrow` + `.btn__arrow`                                                | A row action ending in a round primary arrow chip (`_patterns.scss`).                                                                                                    |
| `.icon-button`                                                               | Any control whose only content is a glyph: round, ≥ `--target-min`. Needs an `aria-label` or a `.visually-hidden` text (`check:shell`).                                  |
| `.field` + `.field__label`, `.field__input`, `.field__hint`, `.field__error` | The labelled control. `.field__input` is a 46px filled field; `select.field__input` gets the chevron; `textarea` grows vertically. `.field--narrow` caps width at 240px. |
| `.field__input--pill`                                                        | The rounded filter field (`_patterns.scss`), used in `.toolbar` and `.filter-bar`.                                                                                       |
| `.check`                                                                     | A checkbox or radio with its label.                                                                                                                                      |
| `.card`                                                                      | Glass card: `--card`, `--card-edge`, `--r-card`, no padding (see `.card--padded`).                                                                                       |
| `.visually-hidden`                                                           | Text for assistive technology only.                                                                                                                                      |
| `.focus-ring`                                                                | The focus treatment, for a custom element that needs it explicitly.                                                                                                      |

---

## 4. Pattern classes (`src/styles/_patterns.scss`)

Use the class; do not re-type the mock-up's inline styles.

| Group             | Classes                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cards             | `.card--padded` (20/22 padding), `.card--panel` (r28, big panels), `.card--deep` (navy record card), `.stack` (column, gap 14).                                                                                                                                                                                                                                                                                                           |
| Headings          | `.section-title` (15/700), `.section-title--display` (20, Inter Tight), `.eyebrow` (11px capitals), `.status-line` (the count line under a list; give it `role="status"` when it changes).                                                                                                                                                                                                                                                |
| Filters           | `.toolbar` (a row of `.field`s, labels above), `.filter-bar` + `__field` / `__note` (the dashboard's single glass pill), `.search-field` / `.icon-field` + `__icon` (a field with a leading glyph), `.check-pill` (a checkbox filter). On a phone (≤640px) each `.toolbar` field takes the whole row and a `.filter-bar__field` puts its label above its select; a select's chosen text that does not fit ends in an ellipsis (`DL-227`). |
| Tables            | `app-data-table` for any list (§5); `.table-scroll` + `.simple-table` (+ `__num`) for a plain table in feature markup; `.table-scroll--simple` when a check reads the table's own class; `.simple-table--stack` stacks a feature's own table on a phone like `DataTable` (give it explicit roles and a `data-label` on each `td`); `.row-actions`: a record's acts side by side, wrapping (`.btn--small` each). Every scrolling box is `position: relative`. Give every `.table-scroll` `[appScrollRegion]="<its caption>"` (`shared/ui/scroll-region`): while the table is wider than its card the box becomes a focusable region named by that label, so its hidden columns are reachable from the keyboard (axe `scrollable-region-focusable`, `DL-227`). |
| Chips             | `.chip` + `--info                                                                                                                                                                                                                                                                                                                                                                                                                         | progress                 | success                                                                                                                                                  | warning                                      | danger`, `ul.chip-list`. Sectors and categories only — **a status is always `app-status-badge`**. |
| Tabs              | `ul.tabs` of `.tab` (+ `.tab--active` or `aria-current` / `aria-selected`), `.tab__count`, `.step-number` (numbered steps). `.tabs--fill`: the tabs share the box's width (a short choice in a narrow column). `.tabs--sub`: a compact, content-width strip on the soft fill for a filter inside a section (`ArchiveTabs`). Hover never outranks a chosen tab. A radio group drawn as tabs (reference: the relationship graph's view): a `.choice-list` fieldset whose legend names the group, a `.tabs` of `<label class="tab">`, each around a `.visually-hidden` radio; the chosen tab is read from its radio (`.tab:has(> input:checked)`, no class), filled and underlined, so it is marked without colour; the tab draws the focused radio's ring (`.tab:has(> input:focus-visible)`). In forced colours a chosen tab takes `Highlight`. On a phone (≤640px) every strip but `.tabs--fill` stays on one line across the row and scrolls sideways inside itself, as `.tabs--scroll` does at every width — never a wrapped lozenge (`DL-227`). |
| Figures           | `.kpi` / `a.kpi` (+ `__label`, `__value`, `__value--long`, `__hint`, `__arrow`): a link KPI fills primary on hover and focus. `.tally-row` + `.tally` (+ `--primary                                                                                                                                                                                                                                                                       | gold                     | red                                                                                                                                                      | soft`, `--figure-first`): a record's totals. |
| Grids             | `.bento` + `.span-3` … `.span-9` (12 columns; halves ≤1100px, full ≤700px; each panel or tile is as tall as its own content, never stretched to its tallest neighbour, `DL-227`), `.record-grid` (+ `__wide`): auto-fit two columns of panels, `.split` + `__main` / `__side` (3fr/2fr work page with a context column, one column ≤1100px).                                                                                                                                                                               |
| Records           | `dl.facts` (+ `.facts__row` or `.facts__item`, `.facts__row--wide`, `.facts--pairs`), `.soft-list` of `.soft-row` (+ `--stacked`, `__meta`), `.subpanel` (+ `--soft`, `--deep`; a preview of what a change will look like is a `.subpanel.subpanel--soft` headed by a `.section-title`), `.record-link`, `.withheld` (words withheld from this reader).                                                                                                                                                                                                             |
| Icons and people  | `.icon-tile` (+ `--sm                                                                                                                                                                                                                                                                                                                                                                                                                     | lg`, `--round`, `--green | gold                                                                                                                                                     | red                                          | navy                                                                                              | sky | soft | blue-soft | red-soft`), `.avatar`/`.avatar--lg`(initials from`InitialsPipe`, always `aria-hidden`). |
| Notices           | `.callout` (+ `--warning                                                                                                                                                                                                                                                                                                                                                                                                                  | danger                   | success`, `__title`, an inner `ul`), `.effects`(+`__lead`): "what this does", always **before** its button; `.note-box` (a quiet note with a left rule: nothing here, not built, a count that decides nothing; never a preview). A callout or note box takes its column's width; no page caps it. |
| Forms             | `.form-panel`, `.form-section` (+ `__legend`, `__note`): a hairline fieldset with its legend in the edge; `.choice-list` + `.choice` (+ `__text`, `__hint`): radio/checkbox tiles; `.form-footer` (Cancel + submit, end-aligned 48px pills; on a phone ≤480px a column of full-width buttons, submit on top); on a phone ≤600px a `.form-section` drops its frame and keeps its legend; `.form-problem:empty` hides an empty alert line (never on a live region); `.field-row`: short `.field`s side by side (a range's two ends), each up to 240px, wrapping when narrow; each field's label, input, hint and error sit on four shared tracks (subgrid), so the inputs stay level whatever a label or hint wraps to and an error under one leaves the other in place. `.field input[type='file']` is styled globally. |
| Navigation        | `.action-link` (+ `--primary`, `__label`, `__arrow`): a quick action with a leading tile; `.back-link` + `__arrow` (the one way back from a record or sub-page, above its page header and outside its read; a form leaves by Cancel in its footer, `DL-227`); `.list-more` (count line + Show more).                                                                                                                                                                                                                                                                                |
| Whole-page notice | `.notice-page` (+ `--under-header`): not found, no access, not built yet — an `app-empty-state` in one centred 720px panel; the empty state draws no panel of its own inside it (one frame, `DL-227`). |

---

## 5. Shared components (`src/app/shared/ui/`)

Import from `@shared/index`. Every one is standalone, OnPush, with signal inputs.

### PageHeader — `app-page-header`

Every routed page's one `h1`, and its actions. **A page name is read, not drawn** (`DL-246`): the
breadcrumb already says where the reader is, so the `h1` is `.visually-hidden` and what shows is a
slim row of the page's actions, right-aligned at the top of the content and wrapping at phone width.
With no actions and no lead it takes no room at all. `subtitle` is not drawn on a page name.

`showTitle` draws the heading as before — 42px Inter Tight on the wash, the subtitle as a muted
lead, the actions bottom-right — for a heading that is **data or a message, not a page name**: a
record's reference or name ("RL-2026-000001", a family's name), or a not-found or not-connected
message. `lead` is a sentence the page owes its reader whatever the title does — the five app-facing
pages' "Residents see this in the Taytay app" (`check:home`, `check:directory`, `check:balita`,
`check:app-settings`) — drawn at the start of the action row.

Inputs: `title` (required), `subtitle`, `showTitle`, `lead`. Slot: `[page-actions]`. Actions keep
their own button sizes (`.btn`, `.btn--primary`).

Where a list has a filter card, its actions sit **in the card** instead of the header row: at the
top right beside the saved views (`.panel-head` holding the bar and a `.toolbar__actions`), or at
the end of the filter row (`.toolbar__actions` as the toolbar's last child). Both are in
`_patterns.scss`; the registry is the reference.

```angular-html
<!-- A page name: read, not drawn; the actions in a slim row -->
<app-page-header [title]="copy.title">
  <a
    page-actions
    *appHasPermission="'resident.create'"
    class="btn btn--primary"
    routerLink="/residents/new"
  >
    <app-icon name="plus" [stroke]="2.2" /> {{ copy.create }}
  </a>
</app-page-header>

<!-- A record's reference: data, drawn -->
<app-page-header showTitle [title]="release.referenceNumber" [subtitle]="kindLabel(release)" />
```

### DataTable — `app-data-table`

Any list of records. Presentational: rows in, intent out. Header band, hairline rows, sort chevrons,
`aria-sort`, its own skeleton while `loading`, its own empty state.
Inputs: `columns`, `rows`, `rowKey`, `caption` (required); `loading`, `page`, `sort`, `selectable`,
`emptyVariant`, `emptyHeading`, `emptyMessage`, `emptyActionLabel`.
Outputs: `sortChanged`, `pageChanged`, `rowSelected`, `emptyActionSelected`.
A column (`TableColumn<T>`) has `key`, `header`, and either `value: (row) => string` or a `cell`
template; optional `sortField`, `align`, `width`, `hideHeader`.

```ts
private readonly nameCell = viewChild.required<TemplateRef<{ $implicit: ResidentView }>>('nameCell');
protected readonly columns = computed<readonly TableColumn<ResidentView>[]>(() => [
  { key: 'name', header: this.copy.columnResident, cell: this.nameCell() },
  {
    key: 'barangay',
    header: this.copy.columnBarangay,
    value: (view) => barangayName(view.resident.address.barangayId),
  },
]);
```

```angular-html
<app-data-table
  [caption]="copy.caption"
  [columns]="columns()"
  [rows]="rows()"
  [rowKey]="rowKey"
  [loading]="isLoading()"
  [emptyVariant]="hasFilters() ? 'no-results' : 'empty'"
  [emptyHeading]="hasFilters() ? copy.noResultsHeading : copy.emptyHeading"
  [emptyActionLabel]="hasFilters() ? copy.clear : null"
  (emptyActionSelected)="clearFilters()"
/>
```

**On a phone (≤640px) each row is a block** of header–value lines: every cell carries its column's
header as `data-label`, which CSS prints beside the value with empty alternative text (a reader
hears the header once, from the header cell); a column with `hideHeader` (the row's actions) runs
across the row under the values, so no action falls off the card; sortable headers stay above the
rows as sort buttons, the others are hidden only visually; the table keeps explicit `role`s so a
stacked row is still read as a row. Wider, a table that does not fit scrolls inside `.table-wrap`,
which then becomes a focusable region named by the caption (`ScrollRegion`, `DL-227`).

Put it inside a `.card.card--panel.card--padded` (it has no padding of its own). The API sends no
totals: say "N shown, more available" in a `.status-line`, never "page 1 of N" (`DL-161`).

### AsyncContent — `app-async-content`

Wraps a `ViewState<T>` (`idle | loading | ready | error`): skeleton while loading, error panel with
Try again on failure, the caller's template once ready. The screen can never read a value that has
not arrived.
Inputs: `state`, `content` (required); `errorHeading`, `retryLabel`, `loadingMessage`,
`skeletonLines` (0 = spinner). Output: `retryRequested` (bind it only if the screen owns its reload;
otherwise the failure's own retry runs, `DL-186`).

```ts
protected readonly state = toSignal(
  this.filter$.pipe(switchMap((f) => toViewState(this.repository.summary(f)))),
  { initialValue: LOADING },
);
```

```angular-html
<app-async-content [state]="state()" [content]="body" [skeletonLines]="6">
  <ng-template #body let-summary>…</ng-template>
</app-async-content>
```

### EmptyState — `app-empty-state`

Nothing to show. `empty` (nothing exists yet: blue inbox tile, invites creating), `no-results`
(filters hid everything: the search illustration, invites clearing), `error` (the offline
illustration while `NetworkStatus` says offline, otherwise a red tile), `forbidden` (gold lock).
Never collapse `empty` and `no-results`.
Inputs: `heading` (required), `variant`, `message`, `actionLabel`, `headingLevel` (3; a
whole-page notice with no page header passes 1). Output: `actionSelected`.

```angular-html
<app-empty-state
  variant="no-results"
  [heading]="copy.noResults"
  [actionLabel]="copy.clear"
  (actionSelected)="clear()"
/>
```

### StatusBadge — `app-status-badge`

The only way to render a workflow status. Label, tone and description come from the domain catalog.
Inputs: `catalog`, `status` (required), `labelOverride`.

```angular-html
<app-status-badge [catalog]="ASSISTANCE_STATUS_CATALOG" [status]="request.status" />
```

### Modal — `app-modal`

A focused decision: a confirmation, a short form, and the large review/edit dialogs
(verification review, users, directory and home-screen editors). **Centred**, `position: fixed`,
focus trapped; Escape and the backdrop close it when `dismissible`. Sizes `small` 480, `medium` 640,
`large` 960.
Inputs: `open` (model, two-way), `heading` (required), `description`, `size`, `dismissible`.
Output: `dismissed`. Slots: `[modal-body]`, `[modal-actions]`.

```angular-html
<app-modal [(open)]="confirming" [heading]="copy.closeHeading" size="small" (dismissed)="cancel()">
  <div modal-body class="effects">
    <b>{{ copy.closeEffectsLead }}</b> …
  </div>
  <button modal-actions type="button" class="btn btn--danger" (click)="close()">
    {{ copy.close }}
  </button>
</app-modal>
```

### Drawer — `app-drawer`

Context beside a list when the reader must keep their place (the notification inbox). The duplicate
review's finding is a decision and opens in a centred `app-modal size="large"` (`DL-227`). Floats 16px inside the viewport, r28 corners; `narrow` 420, `wide` 660.
Inputs: `open` (model), `heading` (required), `description`, `side` (`end` | `start`), `size`,
`dismissible`. Output: `dismissed`. Slots: `[drawer-body]`, `[drawer-actions]`.
A decision is a centred modal, not a drawer.

### ChartTable — `app-chart-table`

A breakdown. It **is** a real `<table>` with a caption; the bar beside each label is `aria-hidden`
and repeats the number. Never add a second chart for the same figures (`DL-108`).
Inputs: `caption`, `rows` (required; `ChartRow`: `key`, `label`, `value`, `display?`,
`routerLink?`, `queryParams?`), `labelHeader`, `valueHeader`, `emptyMessage`, `summary`.

```angular-html
<app-chart-table
  [caption]="copy.byStatusCaption"
  [summary]="copy.byStatusSummary"
  [labelHeader]="copy.statusHeader"
  [valueHeader]="copy.requestsHeader"
  [rows]="statusRows()"
/>
```

### BarChart — `app-bar-chart`

The printed report sheet's chart only (`DL-228`, §7 "Report sheet"): inline SVG, `aria-hidden`, one
or two series, the figure printed at each bar's end, "withheld" (input `withheldLabel`) and no bar
for a withheld figure. Inputs: `series`, `rows` (`{ key, label, values: (number | null)[] }`),
`withheldLabel`, `format`. Always beside a table of the same rows; on a screen, use `ChartTable`.

### SavedViewsBar — `app-saved-views-bar`

Named filters above a list whose filters live in the URL; drawn as the `.tabs` strip. Applying a view
is a navigation. One's own personal view is archived from the strip (an icon button labelled
"Archive the saved view …", no confirmation: a filter, reversible) and the outcome is announced with
how to restore; **Archived views** beside **Save this view** lists the archived ones with Restore
(`DL-225`).
Inputs: `resource`, `currentParams` (required), `currentUserId`, and label overrides (`heading`,
`allLabel`, `saveLabel`, `saveDescription`, `nameLabel`, `confirmLabel`). Guard it with the port:
`@if (servesSavedViews) { … } @else { <app-not-connected port="saved-view" /> }`.

### Icon — `app-icon`

Inline SVG glyphs, always `aria-hidden`. Inputs: `name` (required, `IconName`), `size` (18),
`stroke` (1.8). Names live in `icons.ts`; nav icon per route in `layout/navigation/nav-icons.ts` (a
spec fails if a route has none); `SEVERITY_ICONS` maps a notification severity to a glyph. To add one,
copy the path from a mock-up's inline `<svg>` or from [`icons/`](./icons/) (mark it `solid: true`).
A button with only an icon carries `.icon-button` and a label.

### Loading — `app-skeleton`, `app-loading-indicator`

`app-skeleton [lines]` for content whose shape is known (preferred for tables and records);
`app-loading-indicator [size] [message]` (`small | medium | large`) with an accessible live message.
Usually reached through `AsyncContent` or `DataTable [loading]` rather than placed directly.

### Mounted once, never placed by a feature

`app-toast-host` (by `App`; raise messages through `NotificationStore`), `app-connection-banner`
(by the shell: `role="status"`, the reconnected message dismissed by a person, nothing queued,
`DL-118`), `app-route-progress` (by the shell: an indeterminate bar, `aria-hidden`, announced once),
`app-live-indicator` (by the topbar: the Live toggle, never announced, `DL-222`).

### Other shared pieces restyled with the redesign

| Piece                                                                                | Where               | Use for                                                       |
| ------------------------------------------------------------------------------------ | ------------------- | ------------------------------------------------------------- |
| `ResidentSummaryCard`                                                                | `shared/residents`  | One resident, said the same way on every screen.              |
| `PersonPicker`                                                                       | `shared/residents`  | "Who is this for?" — the only sanctioned resident search.     |
| `StatusTransition`                                                                   | `shared/cases`      | Any lifecycle move; captures the reason, refuses without.     |
| `CaseTimeline`                                                                       | `shared/cases`      | A record's history: an ordered list, no connectors (`DL-56`). |
| `VulnerabilitySnapshotPanel`                                                         | `shared/households` | Household indicators, advisory only (`DL-42`).                |
| `RelationshipGraph`                                                                  | `shared/families`   | Relationships; the graph is the list (`DL-50`).               |
| `ImageFileField`                                                                     | `shared/media`      | An image picker with a preview and a refusal line.            |
| `ListChangedNotice` (`app-list-changed-notice`)                                      | `shared/ui`         | A paged list changed under its reader: "Reload list" (`DL-222`). |
| `ArchiveDialog` (`app-archive-dialog`)                                               | `shared/archive`    | Every archive and restore: effects, a reason, the confirm (§7). |
| `ArchiveHistory` (`app-archive-history [source]`)                                    | `shared/archive`    | A record's archives and restores, newest first, in words.     |
| `ArchiveTabs` (`app-archive-tabs`)                                                   | `shared/archive`    | "In use \| Archived" above a list, held in the URL.            |
| `BrandMark`, `MunicipalSeal`, `SealPlaceholder`                                      | `shared/brand`      | The console's name and seal (`DL-199`).                       |
| `NotConnected` (`app-not-connected [port]`)                                          | `core/access`       | A panel whose port the API does not serve (`DL-175`).         |
| `PesoPipe`, `BarangayNamePipe`, `PersonNamePipe`, `RelativeTimePipe`, `InitialsPipe`, `DisplayDatePipe` | `shared/pipes` | Formatting; `{{ name \| initials }}` feeds `.avatar`; every date goes through `displayDate` (§8 rule 12). |
| `HasPermissionDirective` (`*appHasPermission`)                                       | `core/access`       | Hide what the reader cannot do (usability, not security).     |

---

## 6. The frame (`src/app/layout/`)

`app-shell` mounts, in order: `app-route-progress`, the skip link, `app-connection-banner`, the glass
sidebar (`app-brand-mark`, `app-nav`, the signed-in identity, the Dark mode button
`app-theme-toggle` and sign-out), and the main column
(`app-topbar`: the navigation toggle, `app-breadcrumb`, `app-global-search-trigger`, the Live
toggle `app-live-indicator` and the notification inbox button; then `main#main-content`). The notification inbox is an `app-drawer` holding `app-notification-list`.

Settled for the frame (`DL-201`): navigation sections are always open (their titles are `h2`, not
toggles); the topbar scrolls with the page; the sidebar is the one glass element with a backdrop
filter; at ≤900px it becomes a solid drawer. Exactly one menu entry is current — the longest route
the URL falls under (`activeNavRoute`, which the breadcrumb uses too) — and it is scrolled into the
menu's view after each navigation. A page under an entry with a heading of its own (`/work/team`) is
named in the entry's `pages`, so the breadcrumb ends with that heading; an entry's label is the term
its page heading uses (`DL-227`). A new module's route needs a nav icon in
`nav-icons.ts`, and its route guard mirrors the permissions of its `NAVIGATION` entry (CLAUDE.md
rule 8).

---

## 7. Page patterns

Every new page picks one. Each skeleton below is the minimum; the reference implementation shows the
whole thing with its states.

### List

Mock-up: [`Residents.dc.html`](./admin/screens/Residents.dc.html) (also `VerificationQueue`, `Users`,
`AppDirectory`). Reference: `src/app/features/residents/resident-list-page.*`.

```angular-html
<app-page-header [title]="copy.title" />

<section class="card card--panel card--padded stack" [attr.aria-label]="copy.caption">
  <!-- saved views, if the list's filters live in the URL, with the page's actions top right -->
  <div class="panel-head">
    <app-saved-views-bar … />
    <div class="toolbar__actions">
      <a class="btn btn--primary" routerLink="new">{{ copy.create }}</a>
    </div>
  </div>
  <div class="toolbar">
    <label class="field">
      <span class="field__label">{{ copy.search }}</span>
      <span class="search-field">
        <app-icon name="search" class="search-field__icon" [size]="16" [stroke]="2" />
        <input type="search" class="field__input field__input--pill" (input)="onSearch($event)" />
      </span>
    </label>
    <!-- one .field per filter; offer only filters this reader can use -->
  </div>

  <app-data-table … />

  @if (rows().length > 0) {
    <div class="list-more">
      <p class="status-line" role="status">{{ copy.shown(rows().length) }}</p>
      @if (hasMore()) {
        <button type="button" class="btn" (click)="showMore()">{{ copy.showMore }}</button>
      }
    </div>
  }
</section>
```

The mock-up's KPI row and side panels need totals the API does not send; they are left out until it
does (see "API fields needed" in the redesign notes, and `DL-161`).

### Detail (record)

Mock-up: [`ResidentRecord.dc.html`](./admin/screens/ResidentRecord.dc.html). Reference:
`src/app/features/residents/resident-detail-page.*`; `households/household-detail-page.*` for the
plain `.record-grid` form.

```angular-html
<app-async-content [state]="state()" [content]="body" [skeletonLines]="8">
  <ng-template #body let-record>
    <app-page-header showTitle [title]="record.name">
      <a page-actions class="btn" [routerLink]="editLink()">{{ copy.edit }}</a>
    </app-page-header>
    <!-- a protected or withheld record says so first -->
    <aside class="callout callout--danger">
      <h2 class="callout__title">…</h2>
      <p>…</p>
    </aside>
    <dl class="tally-row">…</dl>
    <div class="record-grid">
      <section class="card card--padded" aria-labelledby="facts-heading">
        <h2 class="section-title" id="facts-heading">{{ copy.factsHeading }}</h2>
        <dl class="facts">
          <div class="facts__row">
            <dt>…</dt>
            <dd>…</dd>
          </div>
        </dl>
      </section>
      <section class="card card--padded record-grid__wide">…</section>
    </div>
  </ng-template>
</app-async-content>
```

A record whose port is unserved shows `<app-not-connected>` where the panel would be, never mock data.

**A fact's wrapper has two names in use.** Each `dt`/`dd` pair in a `dl.facts` sits in a `div`: the
residents, households, families, import and sector-application pages call it `.facts__row`; the
events, referrals, releases (record and payout session) and visits pages call it `.facts__item`
(`releases.spec.ts` reads that name). Neither class is styled: `.facts` lays out its children, and
only `.facts__row--wide` (a fact across the whole row) carries a rule. A new page uses
`.facts__row`.

### Form

Mock-ups: [`ResidentRegister.dc.html`](./admin/screens/ResidentRegister.dc.html),
[`AppDirectoryEdit.dc.html`](./admin/screens/AppDirectoryEdit.dc.html). Reference:
`src/app/features/households/household-form-page.*` (the global form classes);
`residents/resident-form-page.*` is the closest to ResidentRegister but keeps local `form__*`
classes from before `.form-section` existed.

```angular-html
<app-page-header [title]="copy.title" />

<form class="card card--panel card--padded form-panel" novalidate (submit)="submit($event)">
  @if (refusal(); as message) {
    <div class="callout callout--danger" role="alert">
      <p>{{ message }}</p>
    </div>
  }
  <fieldset class="form-section">
    <legend class="form-section__legend">{{ copy.sectionHeading }}</legend>
    <label class="field">
      <span class="field__label">{{ copy.nameLabel }}</span>
      <input class="field__input" … />
      <span class="field__hint">{{ copy.nameHint }}</span>
    </label>
  </fieldset>

  <p class="effects" id="form-effects">{{ copy.whatThisDoes }}</p>

  <div class="form-footer">
    <a class="btn" routerLink="..">{{ copy.cancel }}</a>
    <button
      type="submit"
      class="btn btn--primary"
      aria-describedby="form-effects"
      [disabled]="saving()"
    >
      {{ saving() ? copy.saving : copy.save }}
    </button>
  </div>
</form>
```

The validator decides what is optional, not the mock-up. Wording a check requires before a button
(effects, warnings, privacy statements) stays above that button.

**A field's parts come in one order: label, input, hint, error.** The hint is under its input, as in
the skeleton, so a hint that wraps never moves the input it describes, and every form reads the same
way. Above the fields stay only the sentences that introduce more than one input or that must be
read before a button: a section's `.form-section__note`, a fieldset's note under its legend, and
`ImageFileField`'s limits, which stand before the file picker because the picker is a button that
acts (`check:directory`, `check:home`). The directory, home-screen and App settings forms follow
it.

**Fields side by side.** A new form stacks its fields (`.field + .field` spaces them) and puts short
fields that belong together in a `.field-row`; it does not add a grid of its own. The household,
family and programme forms keep the local `__grid` (240px auto-fit columns, a full-row `__wide`)
they had before `.field-row` existed: their sections mix fields, checkboxes and full-width rows, so
moving them would change how they look, not only where the rule lives. A grid or row that holds
fields resets the stacked margin for its own children (`.my-grid > .field + .field { margin-block-start: 0; }`,
as `.field-row` and `.toolbar` do): left in place, it drops the second field of a row 16px below the
first (`DL-227`).

**A preview** of what a change will look like (what the app will say, the record a finding will
leave) is a `.subpanel.subpanel--soft` headed by a `.section-title`, beside the inputs it follows.
A `.note-box` is for "nothing here" and "decides nothing", never for a preview.

A field's own error is a `.field__error` after its input, with an id that the input's
`aria-describedby` names after the hint's, and `aria-invalid="true"` on the input, which draws the
red edge. A server's refusal of one field goes in the same place: the data layer maps the wire's
field name to the domain's, so the feature never names a wire field (App settings' review time,
`DL-205`).

### Dashboard

Mock-up: [`Main.dc.html`](./admin/screens/Main.dc.html). Reference:
`src/app/features/dashboard/dashboard-page.*` (it lays its rows out with local `.metrics` and
`.panels` grids; `.bento` is the shared 12-column grid for a new one).

```angular-html
<app-page-header [title]="copy.title" />
<section class="filter-bar" [attr.aria-label]="copy.filterHeading">…</section>

<app-async-content [state]="state()" [content]="body">
  <ng-template #body let-summary>
    <div class="bento">
      <a class="kpi span-3" [routerLink]="…" [queryParams]="…">
        <span class="kpi__label">
          {{ copy.openRequests }}
          <span class="kpi__arrow" aria-hidden="true">
            <app-icon name="arrowUpRight" [size]="13" [stroke]="2.4" />
          </span>
        </span>
        <span class="kpi__value">{{ summary.openRequests }}</span>
        <span class="kpi__hint">{{ copy.openRequestsHint }}</span>
      </a>
      <section class="card card--panel card--padded span-6">
        <app-chart-table [caption]="…" [rows]="…" />
      </section>
    </div>
  </ng-template>
</app-async-content>
```

A figure links to the records behind it. A figure the API does not provide is not drawn.

### Live updates — every pattern (`DL-222`)

A data view keeps itself current by re-reading through its own repository when the API says a topic
it shows changed. Swap `toViewState` for `liveViewState`: the first read and a new query still show
the skeleton; a re-read **never** does, swaps the new value in only on success, and keeps what is on
screen when it fails (the topbar then says "Not updated" with **Refresh now**).

```ts
private readonly live = inject(LiveUpdates);                       // @core/live/live-updates
protected readonly state = toSignal(
  this.query$.pipe(switchMap((q) => liveViewState(                 // @shared/state/live-view-state
    () => this.repository.list(q),                                 // list: its query
    this.live.changes(['residents']),                              // the topics its read counts
    this.live,                                                     // hears "Updated 10:32" / failures
  ))),
  { initialValue: LOADING },
);
// Detail: switchMap((id) => liveViewState(() => this.repository.get(id), this.live.changes(['cases']), this.live))
```

- **List with more pages loaded:** it does not reshuffle. Wrap the refreshes in
  `unlessPaged(refreshes, () => this.further().length > 0, () => this.listChanged.set(true))`, and
  above the rows show `@if (listChanged()) { <app-list-changed-notice (reload)="reloadList()" /> }` —
  "This list has changed. Reload list", a `.callout` with a small secondary button. Reloading starts
  from the first page and clears the flag.
- **Form:** re-read nothing the person is editing; input, scroll position and selection are theirs.
- **Detail with side panels:** the record re-reads with `liveViewState`; a panel that shapes its own
  answer wraps its read in `liveRead(() => …, this.live.changes([...]), this.live)`, which keeps
  what it shows when a re-read fails. Drafts, reasons and open dialogs are their own signals.
- **Conversation:** a re-read adds the messages it brings, drops none already shown, and never
  marks the conversation read.
- **Topics** are `LiveTopic` (`@core/live/change-feed`), named for what the read counts. A screen
  whose topic never arrives still refreshes on reconnect, resync and when the tab is looked at again.
- **The topbar control** (`app-live-indicator`, mounted once): a glass pill like the inbox button
  with a status dot (`--tone-success-fg` live, `--tone-info-fg` every 15 s, `--tone-warning-fg`
  reconnecting, hollow `--muted` paused or idle) and the word "Live"; the state follows in
  `--fs-xs` `--muted` words ("Reconnecting · Updated 10:32"), hidden at ≤640px but kept as the
  button's description. It is a toggle (`aria-pressed`) with the fixed name "Live updates", pauses
  every update on the page (WCAG 2.2.2), and is **never announced**: no live region, no
  `role="status"`. It is absent where live updates are off (the mock set, signed out).

### Archive and restore (`DL-225`)

Reference: `src/app/features/directory/offices-section.*` (the App directory's three sections and
the Home screen's two lists are the same). Nothing an office user does deletes a record: a record is
**archived** — out of the app, kept here, read-only — and **restored**.

```angular-html
<app-archive-tabs [archived]="archived()" [label]="copy.tabsLabel" />
<!-- In use rows: Edit · Archive. Archived rows: "Archived 3 Mar 2026 by M. Cruz", the reason,
     History · Restore — and no Edit: an archived record is read-only. -->
<button type="button" class="btn" [attr.aria-label]="copy.archiveLabel(row.name)" (click)="askArchive(row)">
  {{ listCopy.archive }}
</button>

@if (moving(); as move) {
  <app-archive-dialog
    [heading]="…"
    [effects]="move.act === 'archive' ? archiveEffects : restoreEffects"
    [confirmLabel]="move.act === 'archive' ? copy.archiveConfirm : copy.restoreConfirm"
    [busy]="moveBusy()"
    [problem]="moveProblem()"
    [problemLines]="moveProblemLines()"
    (confirmed)="confirmMove($event)"
    (dismissed)="cancelMove()"
  />
}
```

- **The tabs** are the residents list's `.tabs` (`[queryParams]` + `queryParamsHandling="merge"`),
  so the choice is in the URL and a page's own `?section=` survives it. Two lists on one page hold
  their choice in two parameters (`archivedBanners`, `archivedLinks`).
- **The button classes.** Archive is consequential but reversible, so it is drawn like the other
  reversible acts: the row's **Archive** and **Restore** are plain `.btn`, beside **Edit**; the
  dialog confirms with `.btn--primary`, as App settings' review does, and cancels with
  `.btn--secondary`. Never `.btn--danger*`, which promises that something cannot be undone
  (`check:directory`, `check:home`, `check:archive`).
- **The dialog** says, in this order: the effects (`.effects`, from the domain's `…_EFFECTS.archive`
  / `.restore`: what residents stop seeing, that it stays here under Archived with your name, the
  date and your reason, that it can be restored), the required reason (a `.field` textarea with its
  hint; the confirm stays disabled until a reason the server would take, 1 to 500 characters, and a
  whitespace-only one is said beside the box), then the buttons. A refusal is a `.callout--danger`
  `role="alert"` in plain words — never the API's code — and the dialog stays open; an office still
  in use lists what uses it, one line per kind.
- **The history** is `ArchiveHistory` under the form in the edit dialog, and in its own dialog from
  an archived row's **History**: an ordered `.soft-list`, newest first, each line the act, the time,
  who and why. Loading, the error with Try again and "never archived" are said.
- **All four states** on both tabs: the skeleton, the empty Archived tab ("No archived …", saying
  what archiving keeps), the error with Try again (a list too long to read whole says so), offline.
- **Two acts with no dialog.** A feature flag is archived and restored inside App settings' review,
  whose effects name each flag; a saved view is archived from its bar and announced. Neither has a
  reason, because the API keeps none.

### Inbox (messaging)

Mock-ups: [`OfficeInbox.dc.html`](./admin/screens/OfficeInbox.dc.html),
[`OfficeThread.dc.html`](./admin/screens/OfficeThread.dc.html). Reference:
`src/app/features/inbox/inbox-page.*` (list) and `thread-page.*` (conversation).

```angular-html
<!-- list: a list page whose rows are conversations -->
<app-page-header [title]="copy.title" />
<section class="card card--panel card--padded" aria-labelledby="inbox-heading">
  <app-async-content [state]="state()" [content]="list">
    <ng-template #list let-page><app-data-table … /></ng-template>
  </app-async-content>
</section>

<!-- thread: facts beside the messages, the reply under them -->
<a class="back-link" routerLink="/inbox"><app-icon name="arrowRight" class="back-link__arrow" /> {{ copy.back }}</a>
<app-async-content [state]="state()" [content]="thread">
  <ng-template #thread let-conversation>
    <app-page-header showTitle [title]="conversation.subject" />
    <div class="thread__layout">
      <section class="card card--padded"><dl class="facts">…</dl></section>
      <section class="card card--panel card--padded">
        <ol class="thread__messages">
          …
        </ol>
      </section>
      <form class="card card--padded">…reply…</form>
    </div>
  </ng-template>
</app-async-content>
```

The message bubbles are local to `thread-page.scss` (one screen uses them); move them to
`_patterns.scss` the day a second screen does. The list shows no preview of what a resident wrote,
attachments open only after a warning, and nothing is logged (`check:inbox`).

### Report sheet (print)

Reference: `src/app/features/reports/summary-report-page.*` with `summary-section.ts` (`DL-228`) — the
summary report in the office's standard template, drawn from one read of
`GET office/reports/summary`. A page whose job is a **document to print**: the screen is the paper's
preview, and the paper is the deliverable.

```angular-html
<a class="back-link summary__chrome" routerLink="/reports">…</a>
<app-page-header class="summary__chrome" … />
<section class="card card--padded summary__filters">…filters in the URL…</section>
<app-async-content [state]="sheetState()" [content]="sheet">
  <ng-template #sheet let-report>
    <section class="card card--padded summary__actions summary__chrome">
      <p class="status-line">…what Print does…</p>
      <button class="btn btn--primary">…</button>
      <p class="status-line">…what the CSV is…</p>
      <button class="btn">…</button>
    </section>
    <article class="card card--padded report-sheet">
      <header class="report-sheet__letterhead">
        <app-municipal-seal size="lg" decorative /> …
      </header>
      … title, period, "Narrowed to", executive summary …
      @for (section of report.sections; track section.key) {
        <app-summary-section … />
      }
      … signatures (inputs held in signals, never saved or sent), footer …
    </article>
  </ng-template>
</app-async-content>
```

- **The server words it; the sheet lays it out.** Letterhead, headings, notes, totals labels and
  suppression notices are the API's; the page adds no figure up (`DL-105`).
- **Each section is a chart and its table.** The table (`.table-scroll` + `.simple-table`) is the
  record; `app-bar-chart` (`shared/ui/bar-chart`) is inline SVG, `aria-hidden`, with the figure
  printed at the end of every bar, the legend naming each series (`--bar`, then
  `--tone-success-fg`), and "withheld" — never a bar of zero — where a figure is withheld.
  `check:reports` holds the chart to being hidden and beside a table.
- **Print is the PDF.** `src/styles/_report-print.scss` hides the frame (sidebar, top bar, banners,
  route progress, drawer, toasts) only while a `.report-sheet` is on the page, and gives it a named
  A4 `@page` with "Page n of N" at the foot. The page's own stylesheet hides `.summary__chrome` and the
  filters; each section avoids breaking inside itself. Print re-reads the report first (a run the
  API audits), then calls `window.print()`; the browser's "Save as PDF" makes the file. No PDF or
  spreadsheet library.
- **Not live.** Every read is an audited run, so the page is named in `check:live` as a report run
  and prints when it was generated instead.
- States: the skeleton while loading, `EmptyState` above the sheet when nothing was counted (the sheet
  still prints: a period with no service is a finding), the error panel with Try again, and the
  offline illustration through `AsyncContent`.

### Also in use

- **Review or edit dialog** — VerificationReview, Users, AppDirectoryEdit mock-ups: a centred
  `app-modal size="large"` whose body is a two-column grid of `.subpanel`s.
- **Work page with context** — `.split`: the work in `__main`, the applicant or record in `__side`
  (`requests/intake-page`, `requests/assessment-page`, `events/event-detail-page`).
- **Whole-page notice** — `.notice-page` around an `app-empty-state` (`errors/not-found-page`,
  `errors/forbidden-page`, `placeholder/feature-placeholder-page`).
- **Sign-in** — [`SignIn.dc.html`](./admin/screens/SignIn.dc.html): `features/auth/`.

---

## 8. Rules

1. **Tokens and shared pieces only.** A feature stylesheet holds layout. Colours, type sizes, radii
   and heights are tokens; a repeated shape is a primitive, a pattern class or a shared component. A
   value the scale lacks becomes a token in `src/styles.scss` (and, for a colour, an audited pair:
   see `.claude/commands/change-token.md`), never a number in a component.
2. **No shadows or glows.** `box-shadow` is `none` or the focus ring; no `text-shadow`, no
   `drop-shadow()`. Depth comes from glass, hairlines and soft fills.
3. **Dialogs are centred.** `app-modal`, `position: fixed`, focus trapped. A drawer is for context
   beside a list, not for a decision.
4. **Real data only.** Every name, count, date, message and photo comes from the API. Nothing from a
   mock-up's sample data is typed into a template or a copy file. A design element that needs a field
   the API does not send is left out — hidden gracefully, not faked — and the field is recorded.
5. **Four data states on every data view.** Loading (a skeleton: `AsyncContent`, `DataTable
[loading]`); empty (`EmptyState`, with `empty` and `no-results` kept apart); error (an
   `EmptyState`/callout with **Try again** that does something, `DL-186`); offline (the shell's
   connection banner warns, an error while offline draws the offline illustration, and nothing is
   queued or promised, `DL-118`).
6. **Visible focus.** Keep the two-ring focus; every focusable thing shows it. Icon-only buttons are
   `.icon-button` with a label. `check:shell` and `check:hardening` hold the contract.
7. **Widths.** Check every page at **1280** and **1440** wide: no horizontal page scroll; a wide
   table scrolls inside its own `.table-scroll` (positioned) or wraps. The frame also adapts at
   narrow widths (the sidebar becomes a drawer at ≤900px). At **390** a `DataTable` stacks its rows
   (§5) and no word is broken to fit a column: wrapping is `overflow-wrap: break-word`, never
   `anywhere`, which splits "Mendoza" and "FAM-2026-000001" to make a column narrower (`DL-227`).
8. **Checks win over a mock-up.** Privacy, access and domain checks (`check:verification`,
   `check:inbox`, `check:directory`, `check:balita`, …) and the decision log outrank any drawing.
   Where they read a class or an exact attribute, keep it beside the new classes.
9. **Contrast is audited, in both themes.** Colour tokens are hex or `var()` of hex in `styles.scss` /
   `_brand-tokens.scss` (light in `:root`, dark in `theme-dark`), mirrored in `brand-palette.ts`; text
   pairs hold 4.5:1, boundaries and graphics 3:1. A boundary or graphic in the brand blue (a focused
   field's edge, a checkbox's accent, a spinner's arc, a progress bar) is `--link`, never
   `--primary`, which is a fill in dark (2.6:1 on the card). On glass, measure in the browser in both
   themes (§10). Dark is the same design with dark tokens: no dark-only layout and no `[data-theme]` selector outside the
   token file (§2, "Dark theme").
10. **Budget and CSP.** A component stylesheet warns at 4 kB and fails at 8 kB (`angular.json`);
    move a reusable rule to `_patterns.scss` or split a child component. No static `style=""`
    attributes (the CSP is `style-src 'self'`); `[style.x]` bindings are fine.
11. **Presentation never changes behaviour.** A restyle keeps every selector, input, output, route,
    guard, live region and required sentence.
12. **One way to write a date.** Every date on screen goes through `displayDate`
    (`shared/pipes/display-date.pipe`), or `formatDisplayDate` in a class: `date` 21 Nov 2026,
    `date-time` 21 Nov 2026, 7:17 PM, `time` 7:17 PM; `date-time-seconds` only where the order
    within a minute matters (an audit trail, a count's "as of"), `weekday-date-time` when the day of
    the week is the answer (an event). Never Angular's `date` pipe with a pattern of its own, never an
    ISO string as it came from the API. A `<time>` keeps its machine-readable `datetime` (`DL-227`).
13. **One `h1` per page; a page name is not drawn** (`DL-246`). Every routed page has exactly one
    `h1` (WCAG 2.4.6, 1.3.1), through `app-page-header`. A page name is `.visually-hidden`: the
    breadcrumb says it, and the mock-ups' drawn titles and leads are overridden by the owner. Only a
    heading that is data or a message is drawn (`showTitle`): a record's reference or name, a
    not-found or not-connected notice. A sentence a check requires the page to show goes in `lead`,
    never into a hidden heading. Actions go in the list's filter card where it has one, otherwise in
    the header's slim row; never a page-wide title band.

---

## 9. Guards

| Command                   | Holds                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check:styles`    | No colour literal (hex, `rgb()`, `hsl()`, …, named colours), no px font size, no shadow or glow anywhere under `src/`, except a token's value in `styles.scss` / `_brand-tokens.scss` (`DL-203`). |
| `npm run check:live`      | Live updates stay hints re-read through the screens' own repositories: no `EventSource`/`WebSocket`, no polling or visibility watching outside `core/live`, topic names only, the indicator and the list-changed notice never announced (`DL-222`). |
| `npm run check:contrast`  | The audited colour pairs meet their thresholds in the light theme and the dark one; no text in `--primary`, no fill in a red ink (`DL-204`); no border, outline, accent, fill or stroke in `--primary` while it is below 3:1 on a surface in either theme. |
| `npm run check:brand`     | SCSS colour tokens and status tones equal `brand-palette.ts` in both themes; no unsupportable colour-system claim; brand images registered.                                                       |
| `npm run check:shell`     | Target size, focus scroll margin, reduced motion, icon-only buttons, overflow rules in the frame.                                                                                                 |
| `npm run check:hardening` | `.btn`, `.field`, `.card` are not redefined in a feature (`DL-120`); overlays trap focus.                                                                                                         |
| `npm run check:archive`   | No Delete anywhere a person reads it; every archive and restore says what it does before its `.btn--primary`, never a `.btn--danger*` (`DL-225`).                                                |
| `ng build`                | The component-style budget.                                                                                                                                                                       |

All run in `npm run verify`.

---

## 10. The browser sweep

The checks above read source; they cannot see a rendered page. Phase 4 of the redesign measured the
rendered console with a script kept **outside the repository**, because it needs `playwright-core`
and `axe-core`, which this repository does not depend on. To repeat it:

1. In a scratch folder outside the repo: `npm init -y`, `npm i playwright-core axe-core`, and point
   the script at an installed Chromium (`npx playwright install chromium`, or an existing
   `ms-playwright` folder).
2. Build the mock console into that folder:
   `npx ng build --configuration development --output-path=<scratch>/dist` (development is
   local-mock: no API, seeded data).
3. The script serves `dist/browser` from `node:http` with an SPA fallback to `index.html`, opens it
   headless, and signs in as the seeded administrator (the email in the mock seed, any password of
   eight or more characters, code `000000`).
4. It navigates **inside the app** (`history.pushState` + a `popstate` event): a reload loses the
   in-memory session. It visits every `NAVIGATION` route, the routes outside the menu (`/residents/new`,
   `/administration/roles`, `/forbidden`, a not-found path, …) and the first record of every list, at
   1280×800 and 1440×900, **once per theme**: light as the console opens, then dark after pressing
   the Dark mode button. Emulating `prefers-color-scheme` no longer reaches the dark theme
   (`DL-207`); run one pass with the system set to dark to confirm the console still opens light.
5. On each page it records:
   - **overflow** — the document wider than the viewport (`scrollWidth > clientWidth`), any
     element that pokes past its clipping ancestor without being a scroll box, and clipped text;
   - **focus** — Tab through the page; every stop must draw an outline or a box-shadow ring on
     itself or a close ancestor, and none may land on a hidden element;
   - **contrast** — axe-core's `color-contrast` rule, plus a pixel measurement for text on glass
     (axe leaves it "incomplete"): hide all text, screenshot, read the pixels behind each text run,
     compare with the text colour at the 2nd percentile;
   - **ring contrast** — the outline's colour against the backgrounds behind the ringed element.
6. It writes a JSON report and prints a compact summary. Phase 4 ended at 0 page overflows, 0 focus
   stops without a ring, 0 axe violations and 0 measured runs below AA (2,992 runs); the dark theme's
   results are in `DL-204`.

For a spot check of one page, the Playwright MCP tools (navigate, resize to 1280/1440, Tab, read
computed styles) do the same by hand. Keep screenshots out of the conversation; read the DOM and
computed styles instead.

---

## 11. Known gaps

- The theme choice is not remembered across a reload, which opens light again: the console stores
  nothing in the browser (`check:auth`, `DL-204`, `DL-207`). Remembering it would need a server-side preference on the staff account.
- The gradient header is defined (`--grad-header`) but unused (`DL-201`); the citizens overview's
  hero band, its one user, went with the drawn page names (`DL-246`).
- KPI rows, trend charts and per-section counts drawn in the mock-ups wait for API fields (counts,
  totals, per-week series, office category); they are listed in the redesign's notes and are not
  drawn until the API sends them.
- `.bento`'s one user is the citizens overview; the dashboard uses its own grids.
- Closed (November 2026): a whole-page notice without a page header (`errors/forbidden-page`,
  `errors/not-found-page`) had no `h1` (axe `page-has-heading-one`). `EmptyState` now takes
  `[headingLevel]` (1, 2 or 3; default 3, looking the same at every level), and those two notices
  pass 1, because the notice is the page. A notice under a page header keeps the default.
