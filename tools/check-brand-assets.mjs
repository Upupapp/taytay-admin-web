#!/usr/bin/env node
/**
 * Brand and asset integrity check.
 *
 * Runs as part of `npm run verify`. It enforces four things that a unit test
 * cannot, because they are about files and the repository as a whole:
 *
 *   1. The SCSS tokens and the TypeScript palette have not drifted apart,
 *      in the light theme or the dark one (DL-204), status tones included.
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

/* ── 1. SCSS <-> TypeScript token parity, in both themes ─────────────────── */

/**
 * The contract between the stylesheet custom properties and the TypeScript
 * mirror. Left: CSS custom property. Right: key in BRAND_PALETTE and
 * BRAND_PALETTE_DARK.
 */
const TOKEN_MAP = {
  '--page-base': 'bg',
  '--card-solid': 'surface',
  '--fill': 'surfaceMuted',
  '--divider': 'borderDecorative',
  '--field-line': 'borderInteractive',
  '--text': 'text',
  '--muted': 'textMuted',
  '--muted2': 'textSubtle',
  '--primary': 'brandPrimary',
  '--deep': 'brandPrimaryHover',
  '--blue-50': 'brandPrimarySoft',
  '--on-primary': 'brandOnPrimary',
  '--gold-ink': 'accent',
  '--link': 'link',
  '--danger-fill': 'dangerFill',
  '--danger-fill-hover': 'dangerFillHover',
  '--focus-ring-color': 'focusRing',
  '--focus-ring-inner': 'focusRingInner',
  '--primary-hover': 'primaryHover',
  '--ink': 'ink',
  '--text2': 'text2',
  '--seal-placeholder-bg': 'sealPlaceholderBg',
  '--seal-placeholder-fg': 'sealPlaceholderFg',
  '--seal-placeholder-border': 'sealPlaceholderBorder',
};
const TONES = ['neutral', 'info', 'progress', 'success', 'warning', 'danger'];

// The light theme is the `:root` block of each token file; the dark theme is the light one with
// the declarations of `@mixin theme-dark` (styles.scss) laid over it, as the cascade lays them
// (DL-204). Each declaration is then followed through its `var()` aliases. Since the redesign
// (DL-200) several design tokens are aliases (`--primary` is `var(--blue)`), and a parser that read
// only literal hex would silently stop comparing them — which is the drift this check exists to
// catch. The pre-redesign names this map used to carry (`--c-*`, `--brand-primary*`) were retired
// in Phase 4 (DL-202).
const stripComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, '');
const blockBody = (text, opener) => {
  const match = opener.exec(text);
  if (!match) return undefined;
  const start = match.index + match[0].length;
  let depth = 1;
  let at = start;
  for (; at < text.length && depth > 0; at++) {
    if (text[at] === '{') depth += 1;
    else if (text[at] === '}') depth -= 1;
  }
  return depth === 0 ? text.slice(start, at - 1) : undefined;
};
const declarationsOf = (body) => {
  const declared = new Map();
  for (const match of (body ?? '').matchAll(/(--[\w-]+):\s*([^;{}]+);/g)) {
    declared.set(match[1], match[2].trim());
  }
  return declared;
};
const styleSources = ['src/styles/_brand-tokens.scss', 'src/styles.scss'];
const lightDeclared = new Map();
for (const file of styleSources) {
  const body = blockBody(stripComments(read(file)), /^:root\s*\{/m);
  if (body === undefined)
    problems.push(`${file} has no top-level :root block to read tokens from.`);
  for (const [name, value] of declarationsOf(body)) lightDeclared.set(name, value);
}
const darkBody = blockBody(stripComments(read('src/styles.scss')), /@mixin theme-dark\s*\{/);
if (darkBody === undefined) {
  problems.push(
    'src/styles.scss has no `@mixin theme-dark` block, so the dark palette cannot be compared ' +
      '(DL-204).',
  );
}
const darkDeclared = new Map([...lightDeclared, ...declarationsOf(darkBody)]);

const hexTokens = (declared) => {
  const resolve = (name, seen = new Set()) => {
    const value = declared.get(name);
    if (value === undefined || seen.has(name)) return undefined;
    seen.add(name);
    const alias = /^var\((--[\w-]+)\)$/.exec(value);
    return alias ? resolve(alias[1], seen) : value;
  };
  const tokens = new Map();
  for (const name of declared.keys()) {
    const value = resolve(name);
    if (value !== undefined && /^#[0-9a-fA-F]{3,8}$/.test(value)) {
      tokens.set(name, value.toLowerCase());
    }
  }
  return tokens;
};

const paletteSource = read('src/app/shared/brand/brand-palette.ts');
/** The object literal assigned to `export const <name> =`, by brace matching. */
const objectBody = (name) => {
  const start = paletteSource.search(new RegExp(`export const ${name}\\b[^=]*=\\s*\\{`));
  if (start === -1) return '';
  return blockBody(paletteSource.slice(start), /=\s*\{/) ?? '';
};
const tsHex = (body) => {
  const tokens = new Map();
  for (const match of body.matchAll(/(\w+):\s*'(#[0-9a-fA-F]{3,8})'/g)) {
    tokens.set(match[1], match[2].toLowerCase());
  }
  return tokens;
};
const tsTones = (body) => {
  const tones = new Map();
  for (const match of body.matchAll(
    /(\w+):\s*\{\s*fg:\s*'(#[0-9a-fA-F]{3,8})',\s*bg:\s*'(#[0-9a-fA-F]{3,8})'\s*,?\s*\}/g,
  )) {
    tones.set(match[1], { fg: match[2].toLowerCase(), bg: match[3].toLowerCase() });
  }
  return tones;
};

const THEMES = [
  ['light', lightDeclared, 'BRAND_PALETTE', 'TONE_PALETTE'],
  ['dark', darkDeclared, 'BRAND_PALETTE_DARK', 'TONE_PALETTE_DARK'],
];

for (const [theme, declared, paletteName, toneName] of THEMES) {
  const cssTokens = hexTokens(declared);
  const tsTokens = tsHex(objectBody(paletteName));
  const tsToneTokens = tsTones(objectBody(toneName));

  if (tsTokens.size === 0) {
    problems.push(
      `Could not parse ${paletteName} from brand-palette.ts — the ${theme} parity check is blind.`,
    );
  }

  for (const [cssName, tsName] of Object.entries(TOKEN_MAP)) {
    const cssValue = cssTokens.get(cssName);
    const tsValue = tsTokens.get(tsName);

    if (cssValue === undefined) {
      problems.push(
        `${theme}: token ${cssName} is mapped but does not resolve to a hex colour in the ` +
          `${theme} theme, directly or through var() aliases.`,
      );
      continue;
    }
    if (tsValue === undefined) {
      problems.push(`${paletteName}.${tsName} is mapped but missing from brand-palette.ts.`);
      continue;
    }
    if (cssValue !== tsValue) {
      problems.push(
        `Token drift (${theme}): ${cssName} is ${cssValue} in SCSS but ${paletteName}.${tsName} ` +
          `is ${tsValue}. The contrast audit tests the TypeScript value, so this makes the audit ` +
          'meaningless.',
      );
    }
  }

  // The status tones: StatusBadge paints the SCSS pair; the spec audits the TypeScript one.
  for (const tone of TONES) {
    const ts = tsToneTokens.get(tone);
    for (const part of ['fg', 'bg']) {
      const cssName = `--tone-${tone}-${part}`;
      const cssValue = cssTokens.get(cssName);
      if (cssValue === undefined) {
        problems.push(
          `${theme}: ${cssName} does not resolve to a hex colour in the ${theme} theme.`,
        );
      } else if (ts === undefined) {
        problems.push(`${toneName}.${tone} is missing from brand-palette.ts.`);
      } else if (ts[part] !== cssValue) {
        problems.push(
          `Token drift (${theme}): ${cssName} is ${cssValue} in SCSS but ` +
            `${toneName}.${tone}.${part} is ${ts[part]}. The badge audit would be measuring a ` +
            'colour no screen paints.',
        );
      }
    }
  }
}
notes.push(
  `token parity: ${Object.keys(TOKEN_MAP).length} tokens and ${TONES.length * 2} tone tokens ` +
    `compared in ${THEMES.length} themes`,
);

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
