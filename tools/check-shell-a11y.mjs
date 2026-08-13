#!/usr/bin/env node
/**
 * Shell accessibility and layout audit.
 *
 * jsdom performs no layout: it cannot report a computed pixel size, and it
 * cannot tell you whether a page scrolls sideways. Those properties therefore
 * cannot be asserted by a unit test, and claiming them without evidence would
 * be exactly the "unsupported claim" this project refuses to make.
 *
 * What *can* be checked deterministically is the CSS contract that produces
 * them. This script does that, so the guarantees survive future edits:
 *
 *   1. WCAG 2.5.8 Target Size (AA) — the 24px floor is declared and applied to
 *      the shared icon-button contract, and every icon-only control uses it.
 *   2. WCAG 2.4.11 Focus Not Obscured (AA) — focusable elements carry a
 *      scroll margin derived from the real sticky-topbar height.
 *   3. prefers-reduced-motion removes ambient animation outright, not merely
 *      shortens it.
 *   4. No shell rule can cause horizontal overflow: no viewport-width sizing,
 *      and the flex columns declare a zero minimum so they shrink.
 *
 * Exit 0 = clean, 1 = at least one violation.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const notes = [];
const read = (rel) => readFileSync(join(root, rel), 'utf8');

const walk = (dir, exts) => {
  const out = [];
  if (!existsSync(join(root, dir))) return out;
  for (const entry of readdirSync(join(root, dir))) {
    const rel = join(dir, entry);
    if (statSync(join(root, rel)).isDirectory()) out.push(...walk(rel, exts));
    else if (exts.has(extname(entry))) out.push(rel);
  }
  return out;
};

/* ── 1. Target size (WCAG 2.5.8, AA) ─────────────────────────────────────── */

const interaction = read('src/styles/_interaction.scss');

const targetMin = /--target-min:\s*(\d+)px/.exec(interaction);
if (!targetMin) {
  problems.push('src/styles/_interaction.scss does not declare --target-min.');
} else if (Number(targetMin[1]) < 24) {
  problems.push(
    `--target-min is ${targetMin[1]}px. WCAG 2.5.8 Level AA requires at least 24 CSS pixels.`,
  );
}

for (const property of ['min-inline-size', 'min-block-size']) {
  const applied = new RegExp(`\\.icon-button[^}]*${property}:\\s*var\\(--target-min\\)`, 's').test(
    interaction,
  );
  if (!applied) {
    problems.push(`.icon-button does not set ${property} from --target-min.`);
  }
}

/* Every icon-only control must opt into that contract. An icon-only button is
   one whose entire visible content is an aria-hidden glyph. */
const templates = [...walk('src/app', new Set(['.html'])), ...walk('src/app', new Set(['.ts']))];
let iconButtons = 0;
for (const file of templates) {
  const text = readFileSync(join(root, file), 'utf8');
  const buttons = text.match(/<button\b[\s\S]*?<\/button>/g) ?? [];
  for (const button of buttons) {
    const visibleText = button
      .replace(/<span[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, '')
      .replace(/<span[^>]*class="visually-hidden"[^>]*>[\s\S]*?<\/span>/g, '')
      .replace(/<[^>]+>/g, '')
      .trim();
    const hasGlyph = /aria-hidden="true"/.test(button);
    if (!hasGlyph || visibleText.length > 0) continue;

    iconButtons += 1;
    if (!/class="[^"]*icon-button/.test(button)) {
      problems.push(
        `${file}: an icon-only button does not carry the .icon-button class, so its 24x24 ` +
          `minimum target is unenforced: ${button.replace(/\s+/g, ' ').slice(0, 110)}…`,
      );
    }
  }
}
notes.push(
  `target size: --target-min=${targetMin?.[1] ?? '?'}px, ${iconButtons} icon-only buttons`,
);

/* ── 2. Focus not obscured (WCAG 2.4.11, AA) ─────────────────────────────── */

if (!/--focus-scroll-margin:[^;]*--shell-topbar-height/.test(interaction)) {
  problems.push(
    '--focus-scroll-margin must be derived from --shell-topbar-height, otherwise the offset ' +
      'drifts from the real sticky header and 2.4.11 silently regresses.',
  );
}
if (!/scroll-margin-block-start:\s*var\(--focus-scroll-margin\)/.test(interaction)) {
  problems.push('No scroll-margin-block-start rule applies --focus-scroll-margin to focusables.');
}
for (const selector of ['button', 'input', 'a']) {
  if (!new RegExp(`:where\\([^)]*\\b${selector}\\b`).test(interaction)) {
    problems.push(`The focus scroll-margin rule does not cover <${selector}>.`);
  }
}
notes.push('focus not obscured: scroll margin tied to --shell-topbar-height');

/* ── 3. Reduced motion ───────────────────────────────────────────────────── */

const motion = read('src/styles/_motion.scss');
if (!/@media \(prefers-reduced-motion: reduce\)/.test(motion)) {
  problems.push('src/styles/_motion.scss has no prefers-reduced-motion block.');
}
if (!/animation:\s*none\s*!important/.test(motion)) {
  problems.push(
    'Reduced motion must set `animation: none`. Shortening the duration makes a looping ' +
      'animation spin faster rather than stop (DL-15).',
  );
}
if (!/transform:\s*none\s*!important/.test(motion)) {
  problems.push('Reduced motion must drop non-essential transforms (.motion-transform).');
}

/* The suppression must be universal. A per-component escape is optional — and
   several components do add one, because stopping the animation is not enough
   and they need to restore a sensible static state — but the global rule is
   what makes the guarantee hold for animation nobody remembered to audit. */
const reducedBlock = /@media \(prefers-reduced-motion: reduce\) \{([\s\S]*)\}\s*$/.exec(motion);
if (!reducedBlock || !/\*,\s*\*::before,\s*\*::after/.test(reducedBlock[1] ?? '')) {
  problems.push(
    'The prefers-reduced-motion block must use a universal selector, otherwise animation in a ' +
      'component that was never audited keeps running.',
  );
}

const styleFiles = walk('src/app', new Set(['.scss']));
const looping = styleFiles.filter((file) =>
  /animation:\s*[^;]*\binfinite\b/.test(readFileSync(join(root, file), 'utf8')),
);
const withLocalEscape = looping.filter((file) =>
  /prefers-reduced-motion/.test(readFileSync(join(root, file), 'utf8')),
);
notes.push(
  `reduced motion: universal suppression present; ${looping.length} looping animations, ` +
    `${withLocalEscape.length} with a local static fallback`,
);

/* ── 4. Horizontal overflow ──────────────────────────────────────────────── */

const layoutStyles = walk('src/app/layout', new Set(['.scss']));
for (const file of layoutStyles) {
  const text = readFileSync(join(root, file), 'utf8');
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (/(?:inline-size|width):\s*100vw/.test(line)) {
      problems.push(
        `${file}:${index + 1} sizes to 100vw. That includes the scrollbar and is a classic ` +
          `source of horizontal overflow: "${line.trim()}"`,
      );
    }
  }
}

const shell = read('src/app/layout/shell/shell.scss');
if (!/overflow-x:\s*(clip|hidden)/.test(shell)) {
  problems.push('.shell does not clip horizontal overflow.');
}
// A flex child defaults to min-width:auto and refuses to shrink below its
// content, which is what actually pushes a page sideways.
if (!/\.shell__main[^}]*min-inline-size:\s*0/s.test(shell)) {
  problems.push('.shell__main must declare min-inline-size: 0 so wide content cannot widen it.');
}
if (!/\.shell__content[^}]*min-inline-size:\s*0/s.test(shell)) {
  problems.push('.shell__content must declare min-inline-size: 0.');
}
const topbar = read('src/app/layout/topbar/app-topbar.scss');
if (!/\.topbar\b[^}]*min-inline-size:\s*0/s.test(topbar)) {
  problems.push('.topbar must declare min-inline-size: 0.');
}
notes.push(`overflow: ${layoutStyles.length} layout stylesheets checked`);

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nShell accessibility check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Shell accessibility check passed.');
