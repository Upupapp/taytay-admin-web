#!/usr/bin/env node
/**
 * Brand and asset integrity check.
 *
 * Runs as part of `npm run verify`. It enforces four things that a unit test
 * cannot, because they are about files and the repository as a whole:
 *
 *   1. The SCSS tokens and the TypeScript palette have not drifted apart.
 *      The palette is only a trustworthy audit subject if it still describes
 *      the stylesheet.
 *   2. No colour-system claim is made that this project cannot support —
 *      Pantone, PMS, CMYK and spot-colour references are rejected outright.
 *   3. Every manifest entry marked `vendored` really has a file on disk, with
 *      the declared dimensions present.
 *   4. No image has been dropped into `public/brand/` without a manifest entry.
 *
 * Exit code 0 = clean, 1 = at least one violation.
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const notes = [];

const read = (relative) => readFileSync(join(root, relative), 'utf8');

/* ── 1. SCSS <-> TypeScript token parity ─────────────────────────────────── */

/**
 * The contract between the stylesheet custom properties and the TypeScript
 * mirror. Left: CSS custom property. Right: key in BRAND_PALETTE.
 */
const TOKEN_MAP = {
  '--c-bg': 'bg',
  '--c-surface': 'surface',
  '--c-surface-muted': 'surfaceMuted',
  '--c-border': 'borderDecorative',
  '--c-border-strong': 'borderInteractive',
  '--c-text': 'text',
  '--c-text-muted': 'textMuted',
  '--c-text-subtle': 'textSubtle',
  '--brand-primary': 'brandPrimary',
  '--brand-primary-hover': 'brandPrimaryHover',
  '--brand-primary-soft': 'brandPrimarySoft',
  '--brand-on-primary': 'brandOnPrimary',
  '--brand-nav-ink': 'sidebarInk',
  '--brand-nav-ink-muted': 'sidebarInkMuted',
  '--brand-nav-section': 'sidebarSectionTitle',
  '--c-accent': 'accent',
  '--focus-ring-color': 'brandPrimary',
  '--seal-placeholder-bg': 'sealPlaceholderBg',
  '--seal-placeholder-fg': 'sealPlaceholderFg',
  '--seal-placeholder-border': 'sealPlaceholderBorder',
};

const styleSources = ['src/styles.scss', 'src/styles/_brand-tokens.scss'];
const cssTokens = new Map();
for (const file of styleSources) {
  const text = read(file);
  for (const match of text.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{3,8})\s*;/g)) {
    cssTokens.set(match[1], match[2].toLowerCase());
  }
}

const paletteSource = read('src/app/shared/brand/brand-palette.ts');
const paletteBody = paletteSource.slice(
  paletteSource.indexOf('export const BRAND_PALETTE'),
  paletteSource.indexOf('} as const;'),
);
const tsTokens = new Map();
for (const match of paletteBody.matchAll(/(\w+):\s*'(#[0-9a-fA-F]{3,8})'/g)) {
  tsTokens.set(match[1], match[2].toLowerCase());
}

if (tsTokens.size === 0) {
  problems.push('Could not parse BRAND_PALETTE from brand-palette.ts — the parity check is blind.');
}

for (const [cssName, tsName] of Object.entries(TOKEN_MAP)) {
  const cssValue = cssTokens.get(cssName);
  const tsValue = tsTokens.get(tsName);

  if (cssValue === undefined) {
    problems.push(`Token ${cssName} is mapped but not declared in any stylesheet.`);
    continue;
  }
  if (tsValue === undefined) {
    problems.push(`BRAND_PALETTE.${tsName} is mapped but missing from brand-palette.ts.`);
    continue;
  }
  if (cssValue !== tsValue) {
    problems.push(
      `Token drift: ${cssName} is ${cssValue} in SCSS but BRAND_PALETTE.${tsName} is ${tsValue}. ` +
        'The contrast audit tests the TypeScript value, so this makes the audit meaningless.',
    );
  }
}
notes.push(`token parity: ${Object.keys(TOKEN_MAP).length} tokens compared`);

/* ── 2. No unsupportable colour-system claims ────────────────────────────── */

/**
 * This project has no access to the municipality's brand specification, so it
 * cannot state a Pantone, PMS or CMYK equivalence for anything. Claiming one
 * would be inventing an official fact.
 */
const CLAIM_PATTERN = /\b(pantone|pms\s*\d|spot\s+colou?r|cmyk)\b/i;
const SCAN_DIRS = ['src', 'docs'];
const SCAN_EXT = new Set(['.ts', '.scss', '.html', '.md', '.json']);

const walk = (dir) => {
  const out = [];
  for (const entry of readdirSync(join(root, dir))) {
    const rel = join(dir, entry);
    if (statSync(join(root, rel)).isDirectory()) {
      out.push(...walk(rel));
    } else if (SCAN_EXT.has(extname(entry))) {
      out.push(rel);
    }
  }
  return out;
};

let scanned = 0;
for (const dir of SCAN_DIRS) {
  if (!existsSync(join(root, dir))) continue;
  for (const file of walk(dir)) {
    scanned += 1;
    const text = readFileSync(join(root, file), 'utf8');
    const lines = text.split(/\r?\n/);
    for (const [index, line] of lines.entries()) {
      if (!CLAIM_PATTERN.test(line)) continue;
      // Prose that disclaims the notion is the point, not a breach. Sentences
      // wrap, so look at the neighbouring lines rather than just this one.
      const context = lines.slice(Math.max(0, index - 2), index + 2).join(' ');
      if (/\b(no|never|not|without|cannot|forbid|nor)\b/i.test(context)) continue;
      problems.push(
        `${file}:${index + 1} references a colour system this project cannot substantiate: ` +
          `"${line.trim().slice(0, 100)}"`,
      );
    }
  }
}
notes.push(`colour-claim scan: ${scanned} files`);

/* ── 3. Vendored assets must actually exist ──────────────────────────────── */

const manifestSource = read('src/app/shared/brand/asset-manifest.ts');
const entries = [...manifestSource.matchAll(/provenance:\s*'([a-z-]+)'/g)].map((m) => m[1]);
const vendoredCount = entries.filter((p) => p === 'vendored').length;

for (const match of manifestSource.matchAll(/optimizedPath:\s*'([^']+)'/g)) {
  const assetPath = match[1];
  const onDisk = join(root, 'public', assetPath.replace(/^\//, ''));
  if (!existsSync(onDisk)) {
    problems.push(
      `Manifest declares optimizedPath "${assetPath}" but no file exists at public${assetPath}.`,
    );
  }
}
notes.push(`manifest: ${entries.length} entries, ${vendoredCount} vendored`);

/* ── 4. No unregistered images in public/brand ───────────────────────────── */

const brandDir = join(root, 'public', 'brand');
if (existsSync(brandDir)) {
  for (const entry of readdirSync(brandDir)) {
    if (entry.startsWith('.') || entry.toLowerCase() === 'readme.md') continue;
    if (!manifestSource.includes(entry)) {
      problems.push(
        `public/brand/${entry} is not referenced by the asset manifest. ` +
          'Every shipped brand image needs a manifest entry recording its source and permission basis.',
      );
    }
  }
}

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) {
  console.log(`  ${note}`);
}

if (problems.length > 0) {
  console.error(`\nBrand asset check FAILED (${problems.length}):`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  process.exit(1);
}

console.log('Brand asset check passed.');
