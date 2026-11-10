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
 * background token it is named for; a screen that puts `--tone-danger-fg` on `--c-brand` is a
 * combination no static rule anticipated, and only a person looking at the screen will see it.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

const TEXT_MINIMUM = 4.5;
const COMPONENT_MINIMUM = 3;

const source = readFileSync(join(ROOT, 'src/styles.scss'), 'utf8');

/*
 * Each token is followed through its `var()` aliases to the colour it lands on. Since the
 * redesign (DL-200) the pre-redesign names (`--c-text`, `--c-brand`, …) point at the design
 * tokens instead of repeating their hex; reading only literal hex would have skipped them, and a
 * skipped pair is a pair nobody measured.
 */
/** @type {Map<string, string>} */
const declared = new Map();

for (const [, name, value] of source
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .matchAll(/(--[a-z0-9-]+):\s*([^;{}]+);/g)) {
  declared.set(name, value.trim());
}

function resolve(name, seen = new Set()) {
  const value = declared.get(name);

  if (value === undefined || seen.has(name)) {
    return undefined;
  }

  seen.add(name);
  const alias = /^var\((--[a-z0-9-]+)\)$/.exec(value);

  return alias ? resolve(alias[1], seen) : value;
}

/** @type {Record<string, string>} */
const tokens = {};

for (const name of declared.keys()) {
  const value = resolve(name);

  if (value !== undefined && /^#[0-9a-fA-F]{3,8}$/.test(value)) {
    tokens[name] = value;
  }
}

function channel(value) {
  const c = value / 255;

  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const full = hex.length === 4
    ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
    : hex;

  const r = parseInt(full.slice(1, 3), 16);
  const g = parseInt(full.slice(3, 5), 16);
  const b = parseInt(full.slice(5, 7), 16);

  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function ratio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);

  return (light + 0.05) / (dark + 0.05);
}

const failures = [];
let checked = 0;

function require(foreground, background, minimum, what) {
  // A pair whose colour cannot be found used to be skipped in silence. It fails now: a rename
  // that left a token behind would otherwise turn this check green by measuring less.
  if (tokens[foreground] === undefined || tokens[background] === undefined) {
    failures.push(
      `${what}: ${foreground} on ${background} does not resolve to a hex colour in ` +
        'src/styles.scss, so it cannot be measured.',
    );

    return;
  }

  checked++;

  const value = ratio(tokens[foreground], tokens[background]);

  if (value < minimum) {
    failures.push(
      `${what}: ${foreground} on ${background} is ${value.toFixed(2)}:1, below ${minimum}:1.\n` +
        `    ${tokens[foreground]} on ${tokens[background]}. A caseworker reads this screen forty\n` +
        `    times a day, on an older monitor in a bright office.`,
    );
  }
}

// ── body text ──────────────────────────────────────────────────────────────
for (const background of ['--c-bg', '--c-surface', '--c-surface-muted']) {
  require('--c-text', background, TEXT_MINIMUM, 'body text');
  require('--c-text-muted', background, TEXT_MINIMUM, 'muted text');
  require('--c-text-subtle', background, TEXT_MINIMUM, 'subtle text');
  require('--ink', background, TEXT_MINIMUM, 'heading ink');
  require('--text2', background, TEXT_MINIMUM, 'secondary text');
}

// ── white text on the filled buttons (DL-200) ──────────────────────────────
require('--on-primary', '--primary', TEXT_MINIMUM, 'primary button label');
require('--on-primary', '--primary-hover', TEXT_MINIMUM, 'primary button label on hover');
require('--on-primary', '--red-ink', TEXT_MINIMUM, 'danger button label');
require('--on-primary', '--red-ink2', TEXT_MINIMUM, 'danger button label on hover');

// ── text on the deep panel (sign-in artwork, the dashboard's dark card) ────
require('--on-deep', '--deep', TEXT_MINIMUM, 'text on the deep panel');
require('--on-deep-muted', '--deep', TEXT_MINIMUM, 'muted text on the deep panel');

// ── brand, which carries links and primary buttons ─────────────────────────
require('--c-brand', '--c-surface', TEXT_MINIMUM, 'brand text');
require('--c-brand', '--c-bg', TEXT_MINIMUM, 'brand text');
require('--c-accent', '--c-surface', TEXT_MINIMUM, 'accent text');

// ── status tones, each on its own background ───────────────────────────────
for (const tone of ['neutral', 'info', 'progress', 'success', 'warning', 'danger']) {
  require(`--tone-${tone}-fg`, `--tone-${tone}-bg`, TEXT_MINIMUM, `${tone} status text`);
}

// ── interface components: borders must be visible against what they enclose ─
require('--c-border-strong', '--c-surface', COMPONENT_MINIMUM, 'strong border');
require('--c-border-strong', '--c-bg', COMPONENT_MINIMUM, 'strong border');

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
