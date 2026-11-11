#!/usr/bin/env node
/**
 * check:contrast — WCAG 2.2 AA contrast, computed rather than eyeballed.
 *
 * TAB 16 step 4: *"Contrast and zoom: 4.5:1 for text and 3:1 for interface components … Status
 * colours must remain distinguishable in greyscale — colour alone is never the signal."*
 *
 * ## Why a check and not an audit note
 *
 * Contrast is the one accessibility requirement that is **fully mechanical** — a ratio between two
 * numbers, with a threshold. Everything else in TAB 16 needs a person at a screen: keyboard order,
 * screen-reader announcements, whether an error message actually helps. This does not, so leaving
 * it to a manual audit wastes the audit's attention on arithmetic and lets a token drift the day
 * somebody adjusts a shade.
 *
 * It computes the real WCAG relative-luminance ratio, so a pair that misses by 0.1 is caught the
 * same as one that misses by 3.
 *
 * ## What it cannot tell you
 *
 * That a colour is *used* where the check assumes. It pairs each foreground token with the
 * background token it is named for; a screen that puts `--tone-danger-fg` on `--primary` is a
 * combination no static rule anticipated, and only a person looking at the screen will see it.
 *
 * ## Two themes, one list of pairs
 *
 * The console has a light and a dark theme (DL-204). The light values are the `:root` blocks of
 * `src/styles/_brand-tokens.scss` and `src/styles.scss`; the dark values are those with the
 * declarations of `@mixin theme-dark` in `src/styles.scss` laid over them, exactly as the cascade
 * lays them over `:root`. Every pair below is measured in **both**, against the same threshold. A
 * pair names a *role* — the brand's text, a destructive button's fill — so a token that plays the
 * role in both themes is named, and the roles the pairs assume are themselves checked (a stylesheet
 * that paints text in `--primary` or white on a red ink fails, because in the dark theme those are
 * a fill and a text colour respectively).
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const TEXT_MINIMUM = 4.5;
const COMPONENT_MINIMUM = 3;

const failures = [];

const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
const styles = stripComments(readFileSync(join(ROOT, 'src/styles.scss'), 'utf8'));
const brandTokens = stripComments(
  readFileSync(join(ROOT, 'src/styles/_brand-tokens.scss'), 'utf8'),
);

/** The text between the brace that `opener` ends with and the brace that closes it. */
function blockBody(text, opener) {
  const match = opener.exec(text);

  if (!match) {
    return undefined;
  }

  const start = match.index + match[0].length;
  let depth = 1;
  let at = start;

  for (; at < text.length && depth > 0; at++) {
    if (text[at] === '{') depth++;
    else if (text[at] === '}') depth--;
  }

  return depth === 0 ? text.slice(start, at - 1) : undefined;
}

function declarationsOf(body) {
  /** @type {Map<string, string>} */
  const declared = new Map();

  for (const [, name, value] of (body ?? '').matchAll(/(--[a-z0-9-]+):\s*([^;{}]+);/g)) {
    declared.set(name, value.trim());
  }

  return declared;
}

/*
 * Each token is followed through its `var()` aliases to the colour it lands on. Since the
 * redesign (DL-200) several design tokens are aliases (`--primary` is `var(--blue)`, `--deep` is
 * `var(--navy)`); reading only literal hex would have skipped them, and a skipped pair is a pair
 * nobody measured. An alias resolves within its theme: the light `--danger-fill: var(--red-ink)`
 * would land on the dark red ink if the dark block did not restate it, as it would in a browser.
 */
const lightRoot = blockBody(styles, /^:root\s*\{/m);
const darkMixin = blockBody(styles, /@mixin theme-dark\s*\{/);

if (lightRoot === undefined) {
  failures.push(
    'src/styles.scss has no top-level `:root { … }` block: the light theme cannot be read.',
  );
}

if (darkMixin === undefined) {
  failures.push(
    'src/styles.scss has no `@mixin theme-dark { … }` block: the dark theme (DL-204) cannot be ' +
      'read, so none of its pairs can be measured.',
  );
}

const light = new Map([
  ...declarationsOf(blockBody(brandTokens, /^:root\s*\{/m)),
  ...declarationsOf(lightRoot),
]);
const darkOverrides = declarationsOf(darkMixin);
const dark = new Map([...light, ...darkOverrides]);

// A token the dark block declares that the light theme does not would be undefined in light: the
// two themes must name the same tokens.
for (const name of darkOverrides.keys()) {
  if (!light.has(name)) {
    failures.push(
      `${name} is declared by the dark theme only. Declare it in :root as well, so the light theme ` +
        'has a value for it and both are audited.',
    );
  }
}

function hexTokens(declared) {
  const resolve = (name, seen = new Set()) => {
    const value = declared.get(name);

    if (value === undefined || seen.has(name)) {
      return undefined;
    }

    seen.add(name);
    const alias = /^var\((--[a-z0-9-]+)\)$/.exec(value);

    return alias ? resolve(alias[1], seen) : value;
  };

  /** @type {Record<string, string>} */
  const tokens = {};

  for (const name of declared.keys()) {
    const value = resolve(name);

    if (value !== undefined && /^#[0-9a-fA-F]{3,8}$/.test(value)) {
      tokens[name] = value;
    }
  }

  return tokens;
}

function channel(value) {
  const c = value / 255;

  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const full = hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex;

  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a, b) {
  const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (lighter + 0.05) / (darker + 0.05);
}

let checked = 0;

function audit(theme, tokens) {
  function require(foreground, background, minimum, what) {
    // A pair whose colour cannot be found used to be skipped in silence. It fails now: a rename
    // that left a token behind would otherwise turn this check green by measuring less.
    if (tokens[foreground] === undefined || tokens[background] === undefined) {
      failures.push(
        `${theme}: ${what}: ${foreground} on ${background} does not resolve to a hex colour in ` +
          'the token files, so it cannot be measured.',
      );

      return;
    }

    checked++;

    const value = ratio(tokens[foreground], tokens[background]);

    if (value < minimum) {
      failures.push(
        `${theme}: ${what}: ${foreground} on ${background} is ${value.toFixed(2)}:1, below ${minimum}:1.\n` +
          `    ${tokens[foreground]} on ${tokens[background]}. A caseworker reads this screen forty\n` +
          `    times a day, on an older monitor in a bright office.`,
      );
    }
  }

  // ── body text ────────────────────────────────────────────────────────────
  for (const background of ['--page-base', '--card-solid', '--fill']) {
    require('--text', background, TEXT_MINIMUM, 'body text');
    require('--muted', background, TEXT_MINIMUM, 'muted text');
    require('--muted2', background, TEXT_MINIMUM, 'subtle text');
    require('--ink', background, TEXT_MINIMUM, 'heading ink');
    require('--text2', background, TEXT_MINIMUM, 'secondary text');
  }

  // ── white text on the filled buttons (DL-200) ────────────────────────────
  require('--on-primary', '--primary', TEXT_MINIMUM, 'primary button label');
  require('--on-primary', '--primary-hover', TEXT_MINIMUM, 'primary button label on hover');
  // A filled destructive control (`.btn--danger`, the unread badge). In light the fill is the red
  // ink, as before DL-204; in dark the red ink is text on a tint, so the fill is its own role.
  require('--on-primary', '--danger-fill', TEXT_MINIMUM, 'danger button label');
  require('--on-primary', '--danger-fill-hover', TEXT_MINIMUM, 'danger button label on hover');

  // ── text on the deep panel (sign-in artwork, the dashboard's dark card) ──
  require('--on-deep', '--deep', TEXT_MINIMUM, 'text on the deep panel');
  require('--on-deep-muted', '--deep', TEXT_MINIMUM, 'muted text on the deep panel');
  require('--on-deep-muted', '--primary', TEXT_MINIMUM, 'muted text on a primary panel');

  // ── brand text: links, and the brand glyph on a soft brand tile ──────────
  // `--link` is the brand's text colour in both themes; in light it is the same blue as
  // `--primary`, which these pairs named before the dark theme made `--primary` a fill (DL-204).
  require('--link', '--card-solid', TEXT_MINIMUM, 'brand text');
  require('--link', '--page-base', TEXT_MINIMUM, 'brand text');
  require('--link', '--blue-50', TEXT_MINIMUM, 'brand glyph on a soft brand tile');
  require('--gold-ink', '--card-solid', TEXT_MINIMUM, 'accent text');

  // ── status tones, each on its own background ─────────────────────────────
  for (const tone of ['neutral', 'info', 'progress', 'success', 'warning', 'danger']) {
    require(`--tone-${tone}-fg`, `--tone-${tone}-bg`, TEXT_MINIMUM, `${tone} status text`);
  }

  // ── interface components: borders must be visible against what they enclose
  require('--field-line', '--card-solid', COMPONENT_MINIMUM, 'strong border');
  require('--field-line', '--page-base', COMPONENT_MINIMUM, 'strong border');

  // ── the focus ring: two rings, and between them it shows on everything ────
  for (const background of ['--page-base', '--card-solid', '--fill']) {
    require('--focus-ring-inner', background, COMPONENT_MINIMUM, 'focus ring (inner)');
  }
  for (const fill of ['--primary', '--deep', '--focus-ring-inner']) {
    require('--focus-ring-color', fill, COMPONENT_MINIMUM, 'focus ring (outline)');
  }
}

const THEMES = [
  ['light', hexTokens(light)],
  ['dark', hexTokens(dark)],
];

for (const [theme, tokens] of THEMES) audit(theme, tokens);

/*
 * ── the roles the pairs assume ─────────────────────────────────────────────
 *
 * The pairs measure `--link` as the brand's text and `--danger-fill` as the destructive fill. A
 * stylesheet that paints text in `--primary`, or puts white on a red ink, is a combination they do
 * not measure — and in the dark theme it fails outright (`--primary` on the dark card is 2.6:1; white
 * on the dark red ink is 2.3:1).
 *
 * A boundary or a graphic in `--primary` is the same mistake at the 3:1 threshold (WCAG 1.4.11): a
 * focused field's edge, a checkbox's accent, a spinner's arc, drawn on the theme's surfaces. That
 * rule is measured rather than assumed: it applies while `--primary` falls below 3:1 on any surface
 * in either theme, and names the measurement. A fill with its own label on it (`background`) is not
 * a boundary and is not matched.
 */
const SURFACES = ['--page-base', '--card-solid', '--fill'];
const primaryBelowBoundary = THEMES.flatMap(([theme, tokens]) =>
  SURFACES.filter(
    (surface) =>
      tokens['--primary'] !== undefined &&
      tokens[surface] !== undefined &&
      ratio(tokens['--primary'], tokens[surface]) < COMPONENT_MINIMUM,
  ).map(
    (surface) =>
      `${ratio(tokens['--primary'], tokens[surface]).toFixed(2)}:1 on the ${theme} ${surface}`,
  ),
);
const BOUNDARY_PROPERTY =
  '(?:border(?:-(?:block|inline)(?:-(?:start|end))?|-(?:top|right|bottom|left))?(?:-color)?' +
  '|outline(?:-color)?|accent-color|caret-color|column-rule(?:-color)?' +
  '|text-decoration(?:-color)?|fill|stroke)';

const MISUSE = [
  [
    /(?<![\w-])color\s*:\s*var\(--primary\)/,
    'paints text in --primary. It is a fill in the dark theme (2.6:1 on the dark card); brand text ' +
      'is --link, the same blue in light.',
  ],
  [
    /(?<![\w-])background(?:-color)?\s*:\s*var\(--red-ink2?\)/,
    'fills with a red ink. In the dark theme the red inks are text colours for a tint; a filled ' +
      'destructive control is --danger-fill (or --danger-fill-hover).',
  ],
  ...(primaryBelowBoundary.length === 0
    ? []
    : [
        [
          new RegExp(`(?<![\\w-])${BOUNDARY_PROPERTY}\\s*:[^;{}]*var\\(--primary\\)`),
          `draws a boundary or graphic in --primary, which is ${primaryBelowBoundary.join(', ')}: ` +
            'below the 3:1 a boundary needs. Use --link, the same blue in light.',
        ],
      ]),
];

function walk(dir) {
  const out = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);

    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (
      /\.(scss|css)$/.test(entry) ||
      (entry.endsWith('.ts') && !entry.endsWith('.spec.ts'))
    ) {
      out.push(full);
    }
  }

  return out;
}

for (const file of walk(join(ROOT, 'src'))) {
  const text = stripComments(readFileSync(file, 'utf8')).replace(/(^|[^:])\/\/[^\n]*/g, '$1');

  for (const [pattern, why] of MISUSE) {
    if (pattern.test(text)) {
      failures.push(`${relative(ROOT, file).split(sep).join('/')} ${why}`);
    }
  }
}

/*
 * ── colour is never the only signal ────────────────────────────────────────
 *
 * *"Status colours must remain distinguishable in greyscale — colour alone is never the signal."*
 *
 * The first version of this rule compared the **luminance of the status tints** and failed when two
 * were within 0.01. It was wrong, and worth recording why rather than quietly deleting.
 *
 * Six pale tints share a narrow luminance band by design — they are backgrounds. Separating them
 * enough to be told apart in greyscale would mean making some noticeably darker, redesigning the
 * palette to satisfy a rule stricter than WCAG, for no accessibility gain. WCAG 1.4.1 requires that
 * colour is not the **only** visual means of conveying information; it does not require every tint
 * to be a distinct shade of grey.
 *
 * And this console already satisfies the real requirement: `StatusBadge` renders `{{ label() }}`,
 * so every status is a word before it is a colour. The greyscale test is how you *demonstrate*
 * that, not the thing being demonstrated.
 *
 * So what is checked here is the thing that would actually break: a status badge that stopped
 * rendering its label, leaving the tint carrying the meaning alone.
 */
const badge = readFileSync(join(ROOT, 'src/app/shared/ui/status-badge/status-badge.ts'), 'utf8');

if (!/\{\{\s*label\(\)\s*\}\}/.test(badge)) {
  failures.push(
    'StatusBadge no longer renders its label.\n' +
      '    The tint would then be carrying the status alone — which fails WCAG 1.4.1, and fails a\n' +
      '    caseworker reading a monochrome print or working with colour vision deficiency.',
  );
}

if (failures.length > 0) {
  console.error('\nContrast check failed:\n');
  for (const failure of failures) console.error(`  ${failure}\n`);
  process.exit(1);
}

console.log(`Contrast check passed (${checked} pairs at WCAG 2.2 AA, status carried in words).`);
