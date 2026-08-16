#!/usr/bin/env node
/**
 * Responsive, degraded-state, accessibility and performance audit.
 *
 * TAB 22's acceptance criteria are that core workflows are usable keyboard-only,
 * that 200% zoom does not hide critical controls, that no misleading "saved"
 * state appears during network failure, and that there is no major avoidable
 * layout shift or oversized payload.
 *
 * Most of those are properties of the whole application rather than of one
 * module, so this file checks the **rules that keep them true**:
 *
 *   1. **Nothing is queued offline, and nothing says it is** (`DL-118`).
 *   2. **A shared primitive is not redefined locally** (`DL-120`). Five feature
 *      stylesheets had quietly diverged from the global `.field`.
 *   3. **One debounce constant** (`DL-119`), not one per screen.
 *   4. **A placeholder is never the only label.**
 *   5. **Live regions stay rare and polite.**
 *   6. **Overlays trap focus**, so keyboard users cannot tab behind a dialog.
 *   7. **Reduced motion removes ambient animation**, rather than speeding it up.
 *   9. **The acceptance suite runs against the real adapters** (`DL-121`).
 *   8. **The build's component-style budget still exists** — not re-measured
 *      here, because two budgets with different numbers is its own drift.
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

const styleFiles = walk('src/app', new Set(['.scss']));
const templateFiles = walk('src/app', new Set(['.html']));
const sourceFiles = walk('src/app', new Set(['.ts'])).filter(
  (file) => !file.includes('.spec.'),
);

/** Joins adjacent string literals before searching prose. */
const prose = (text) => text.replace(/'\s*\+\s*'/g, '');

const block = (text, pattern, what) => {
  const found = pattern.exec(text)?.[0] ?? '';
  if (found === '') problems.push(`${what} has gone.`);
  return found;
};

/* ── 1. Nothing is queued offline, and nothing says it is ────────────────── */

const network = 'src/app/core/network/network-status.ts';
if (!existsSync(join(root, network))) {
  problems.push('NetworkStatus has gone. A degraded connection would pass unremarked.');
} else if (!/export class NetworkStatus/.test(read(network))) {
  // The file surviving is not the service surviving: a rename leaves every
  // other reference in place and an existence check reports clean.
  problems.push('NetworkStatus is no longer exported. Nothing observes the connection.');
} else {
  const text = read(network);

  // The promises this application must never make. Checked against the joined
  // prose so a sentence split across two literals cannot slip through.
  const PROMISES =
    /(will be (sent|saved|synced|uploaded)|we.ll retry|retry automatically|queued for later|sync when|saved locally)/i;
  for (const constant of ['OFFLINE_NOTICE', 'RECONNECTED_NOTICE', 'OFFLINE_ACTION_REFUSED']) {
    const declaration = block(
      text,
      new RegExp(`export const ${constant}\\s*=[\\s\\S]*?;[ \\t]*(?:\\r?\\n)`),
      constant,
    );
    if (PROMISES.test(prose(declaration))) {
      problems.push(
        `${constant} promises that work will be sent later. Nothing is queued, nothing is ` +
          'retried, and a submission that failed has failed — saying otherwise is how a ' +
          'caseworker closes a tab believing a request was filed (DL-118).',
      );
    }
  }

  // And no actual queue anywhere in the app.
  const QUEUE = /\b(offlineQueue|pendingSubmissions|retryQueue|backgroundSync|syncManager|serviceWorker\.register)\b/;
  for (const file of sourceFiles) {
    const source = read(file);
    for (const [index, line] of source.split(/\r?\n/).entries()) {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue;
      if (QUEUE.test(line)) {
        problems.push(
          `${file}:${index + 1} queues work for later. This is an admin system with no backend ` +
            'strategy for offline integrity, and a silent queue for a sensitive submission is ' +
            'exactly what the master command forbids (DL-118).',
        );
      }
    }
  }
}

// The banner has to be mounted, not merely written.
const shell = 'src/app/layout/shell/shell.html';
if (existsSync(join(root, shell)) && !/<app-connection-banner/.test(read(shell))) {
  problems.push(
    'The connection banner is not mounted in the shell. An officer who cannot save needs to know ' +
      'before they spend five minutes typing, not after.',
  );
}
notes.push('degraded state: warned about, never queued, banner mounted in the shell');

/* ── 2. A shared primitive is not redefined locally ──────────────────────── */

const globalStyles = read('src/styles.scss');
const SHARED_SELECTORS = ['.field', '.field__label', '.field__input', '.field__hint', '.card', '.btn'];
const declaredGlobally = SHARED_SELECTORS.filter((selector) =>
  new RegExp(`^\\${selector}\\s*\\{`, 'm').test(globalStyles),
);

for (const file of styleFiles) {
  const text = read(file);
  for (const selector of declaredGlobally) {
    if (new RegExp(`^\\${selector}\\s*\\{`, 'm').test(text)) {
      problems.push(
        `${file} redefines ${selector}, which is already a shared primitive. A local copy does ` +
          'not extend the shared control, it replaces it with something that looks slightly ' +
          'different on that one screen — and an encoder learns to distrust a field that ' +
          'behaves differently everywhere (DL-120).',
      );
    }
  }
}
notes.push(`shared styles: ${declaredGlobally.length} primitives defined once`);

/* ── 3. One debounce constant ────────────────────────────────────────────── */

const debounceModule = 'src/app/shared/state/debounced.ts';
if (!existsSync(join(root, debounceModule))) {
  problems.push('The shared debounce helper has gone.');
} else if (!/export const SEARCH_DEBOUNCE_MS/.test(read(debounceModule))) {
  problems.push('SEARCH_DEBOUNCE_MS is no longer exported from the shared helper.');
}

for (const file of sourceFiles) {
  if (file.endsWith(join('shared', 'state', 'debounced.ts'))) continue;
  if (/^\s*const SEARCH_DEBOUNCE_MS\s*=/m.test(read(file))) {
    problems.push(
      `${file} declares its own debounce window. Seven list screens each held a private copy of ` +
        'the same 250ms before TAB 22, which is how two screens come to feel different for no ' +
        'stated reason (DL-119).',
    );
  }
}

// Every screen that searches must settle the term before querying.
for (const file of sourceFiles) {
  const text = read(file);
  if (!/protected readonly search = signal\(''\)/.test(text)) continue;
  if (!/debouncedTerm\(|SEARCH_DEBOUNCE_MS/.test(text)) {
    problems.push(
      `${file} queries on every keystroke. Typing a surname fires one read per character, and ` +
        'the discarded ones cost exactly as much as the kept one (DL-119).',
    );
  }
}
notes.push('search: one debounce window, settled before every query');

/* ── 4. A placeholder is never the only label ────────────────────────────── */

let placeholderInputs = 0;
for (const file of templateFiles) {
  const text = read(file);
  for (const match of text.matchAll(/<input[\s\S]*?>/g)) {
    // Both the plain attribute and Angular's `[placeholder]` binding, which is
    // what these templates actually use — searching for `placeholder=` alone
    // reported zero while every search box had one.
    if (!/\[?placeholder\]?=/.test(match[0])) continue;
    placeholderInputs += 1;
    const tag = match[0];
    const before = text.slice(Math.max(0, match.index - 400), match.index);
    const insideLabel = before.includes('<label') && !before.split('<label').pop()?.includes('</label>');
    if (!insideLabel && !/aria-label|aria-labelledby/.test(tag)) {
      problems.push(
        `${file} has an input whose only label is its placeholder. A placeholder disappears the ` +
          'moment somebody types, leaving them with no way to check what the box was for.',
      );
    }
  }
}
notes.push(`labels: ${placeholderInputs} placeholders, every one with a real label`);

/* ── 5. Live regions stay rare and polite ────────────────────────────────── */

let liveRegions = 0;
for (const file of templateFiles.concat(sourceFiles)) {
  const text = read(file);
  liveRegions += [...text.matchAll(/aria-live=/g)].length;
  if (/aria-live="assertive"/.test(text)) {
    problems.push(
      `${file} announces assertively. An assertive region interrupts a screen reader mid-sentence; ` +
        'almost nothing in a case-management console earns that.',
    );
  }
}
// A cap rather than an exact count: over-announcing is its own failure, and a
// console that announces everything is one where nothing is heard.
if (liveRegions > 12) {
  problems.push(
    `${liveRegions} live regions. Announcing every change is its own accessibility failure — ` +
      'aria-live is for meaningful asynchronous updates, not for decoration.',
  );
}
notes.push(`live regions: ${liveRegions}, all polite`);

/* ── 6. Overlays trap focus ──────────────────────────────────────────────── */

const overlayBehaviour = 'src/app/shared/ui/overlay/overlay.behavior.ts';
if (!existsSync(join(root, overlayBehaviour))) {
  problems.push('The shared overlay behaviour has gone; focus trapping would be per-component.');
} else {
  const text = read(overlayBehaviour);
  // Scoped to the call that restores focus. The identifier appears four times;
  // three of them are the variable, not the behaviour.
  for (const required of ["'Tab'", "'Escape'", 'previouslyFocused?.focus()']) {
    if (!text.includes(required)) {
      problems.push(
        `The overlay behaviour no longer handles ${required}. A dialog a keyboard user can tab ` +
          'behind is a dialog that is lying to assistive technology.',
      );
    }
  }
}
for (const component of ['modal/modal.ts', 'drawer/drawer.ts']) {
  const file = `src/app/shared/ui/${component}`;
  if (existsSync(join(root, file)) && !/overlay\.behavior|useOverlay|overlayBehavior/i.test(read(file))) {
    problems.push(`${file} no longer uses the shared overlay behaviour, so it may not trap focus.`);
  }
}
notes.push('overlays: focus trapped, Escape handled, focus restored on close');

/* ── 7. Reduced motion removes ambient animation ─────────────────────────── */

const motion = read('src/styles/_motion.scss');
const reducedBlock = block(
  motion,
  /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}/,
  'the reduced-motion block',
);
// The block's own comment says `animation: none`, so a plain search passes
// while the rule beneath it has become a fast loop.
const reducedRules = reducedBlock.replace(/\/\*[\s\S]*?\*\//g, '');
if (!/animation: none !important;/.test(reducedRules)) {
  problems.push(
    'Reduced motion no longer removes animation outright. A 0.01ms loop spins furiously instead ' +
      'of stopping, which is worse than the original (DL-15).',
  );
}
if (!/transition-duration: 0\.01ms !important;/.test(reducedRules)) {
  problems.push('Reduced motion no longer collapses transitional motion.');
}
notes.push('motion: ambient removed, transitional collapsed, end states still applied');

/* ── 8. Component styles stay inside the budget ──────────────────────────── */

// **Not re-measured here.** `ng build` already enforces a component-style
// budget, against the *compiled* CSS; measuring the raw source would be a
// second budget with a different number, and two budgets that disagree is the
// drift this project keeps refusing elsewhere. What this checks is that the
// build's guard still exists, so it cannot be quietly removed.
const angularJson = JSON.parse(read('angular.json'));
const budgets =
  angularJson.projects?.['taytay-social-welfare']?.architect?.build?.configurations?.production
    ?.budgets ?? [];
const componentBudget = budgets.find((entry) => entry.type === 'anyComponentStyle');

if (componentBudget === undefined) {
  problems.push(
    'The component-style budget has gone from angular.json. It is what catches a shared primitive ' +
      'being copied into a feature stylesheet, which is how five of them came to define `.field` ' +
      'slightly differently (DL-120).',
  );
} else if (!/^\d+kB$/.test(componentBudget.maximumWarning ?? '')) {
  problems.push('The component-style budget no longer sets a warning threshold.');
}
notes.push(
  `style budget: enforced by ng build at ${componentBudget?.maximumWarning ?? 'no threshold'} ` +
    `across ${styleFiles.length} stylesheets`,
);

/* ── 9. The acceptance suite runs against the real adapters ──────────────── */

const acceptance = 'src/app/acceptance/acceptance.spec.ts';
if (!existsSync(join(root, acceptance))) {
  problems.push(
    'The acceptance suite has gone. It is the only thing that checks a whole path holds together ' +
      'across modules rather than one rule inside it.',
  );
} else {
  const text = read(acceptance);
  if (!/provideDataAccess\(/.test(text)) {
    problems.push(
      'The acceptance suite no longer wires the real adapter set. A test double that matches the ' +
        'shape of a call proves the call was shaped correctly; it cannot prove the seed is ' +
        'coherent, which is the entire point of this suite (DL-121).',
    );
  }
  // Every repository token but the identity one must come from the real set.
  if (/provide: (RESIDENT|CASE|DISBURSEMENT|REFERRAL|REPORT|SEARCH|WORK|GOVERNANCE)_REPOSITORY/.test(text)) {
    problems.push(
      'The acceptance suite overrides a repository with a double. Overriding one is how a suite ' +
        'stops testing the thing it was written for (DL-121).',
    );
  }
}
notes.push('acceptance: whole paths, real adapters, seeded data');

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nHardening check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Hardening check passed.');
