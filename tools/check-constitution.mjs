#!/usr/bin/env node
/**
 * Constitution integrity check.
 *
 * Runs as part of `npm run verify`. It does two things a unit test does not:
 * it asserts that the rules in CLAUDE.md are still stated, and it ENFORCES the
 * one rule in that file which is mechanically checkable rather than merely
 * declared.
 *
 * ── WHY A GOVERNANCE DOCUMENT NEEDS A CHECK ──────────────────────────────
 *
 * A weakened safety line reads as a wording preference in review. On
 * 2026-08-28 the equivalent sentence in the sibling `taytay-mobile-app` was
 * edited from "a push is a publication" to "pushing is routine" — one clause,
 * no diff noise, a warning turned into a normalisation. It never reached a
 * commit, because that repository asserts its own constitution in a test.
 * `taytay-backend` had no equivalent and added one the same day. This file is
 * the third repository, and it was the last one that would have taken such an
 * edit silently.
 *
 * ── WHAT IS ASSERTED, AND WHAT DELIBERATELY IS NOT ───────────────────────
 *
 * The invariants, never the whole document. Asserting the full text would make
 * every legitimate amendment a failure, and a check that fails on correct work
 * is one people learn to edit rather than read.
 *
 * Note what is ABSENT from the list below: rule 9's authorisation of direct
 * pushes to `main`. That is the part the owner may change, and pinning it here
 * would turn a future decision into a build failure. What is pinned is what an
 * amendment must not quietly take with it.
 *
 * These phrases are this repository's own. They are NOT copied from the
 * backend's constitution — the two differ, and two agents wasted a day on
 * 2026-08-28 by inferring one repository's rules from another's.
 *
 * Exit code 0 = clean, 1 = at least one violation.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];
const notes = [];

/*
 * Whitespace-normalised before matching, and that is not a convenience.
 *
 * CLAUDE.md is hard-wrapped at ~76 columns, so rule 4 reads "never a security\n
 * boundary." on disk — a phrase that is one sentence to a reader and two lines
 * to `includes()`. Matching the raw text would make this check fail the day
 * somebody reflows a paragraph, which is a formatting change with no meaning,
 * and would teach the next person that the check is noise.
 */
const claudeMd = readFileSync(join(root, 'CLAUDE.md'), 'utf8')
  .replace(/\s+/g, ' ');

/* ── 1. The rules that must still be stated ──────────────────────────────── */

/**
 * Left: the phrase. Right: why losing it would matter, shown in the failure so
 * whoever hits this reads the consequence rather than just a missing string.
 */
const INVARIANTS = {
  'force-push':
    'rule 9 — force-push is forbidden however the push rule changes',
  'history rewriting':
    'rule 9 — rewriting published history is forbidden',
  deployment:
    'rule 9 — deployment is not an agent action',
  'production access':
    'rule 9 — production access and data operations stay forbidden',
  'stays out of every commit':
    'rule 9 — no CI workflow may be committed; the owner has no Actions credit',
  'never a security boundary':
    'rule 4 — client permission checks are usability, and the API re-checks everything',
  'Strict TypeScript stays on':
    'rule 2 — strict mode is the type safety this codebase is written against',
  'integer centavos':
    'rule 6 — money is never floating point',
  'Secrets and credentials are never read':
    'rule 5 — no token in localStorage, a cookie, a URL or a log',
};

for (const [phrase, why] of Object.entries(INVARIANTS)) {
  if (!claudeMd.includes(phrase)) {
    problems.push(`CLAUDE.md no longer says "${phrase}" (${why})`);
  }
}

/* ── 2. The rule this can actually ENFORCE ───────────────────────────────── */

/*
 * Rule 9 is explicit: ".github/workflows/ stays out of every commit" because
 * the owner has no Actions credit. Asserting the sentence is worth little next
 * to checking the thing it describes, so this checks the index rather than the
 * prose.
 *
 * Deliberately `git ls-files` and not the filesystem: an UNTRACKED .github/ is
 * fine and exists in this working tree today. The rule is about what is
 * committed, and a check that failed on an untracked directory would be
 * enforcing a rule nobody wrote.
 */
try {
  const tracked = execFileSync('git', ['ls-files', '.github/workflows'], {
    cwd: root,
    encoding: 'utf8',
  })
    .split('\n')
    .filter((line) => line.trim() !== '');

  if (tracked.length > 0) {
    for (const file of tracked) {
      problems.push(
        `${file} is COMMITTED — rule 9 keeps .github/workflows out of every commit ` +
          '(no Actions credit; the gates run locally)',
      );
    }
  } else {
    notes.push('No workflow file is committed (rule 9).');
  }
} catch (error) {
  problems.push(`Could not read the git index to check rule 9: ${error.message}`);
}

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) {
  console.log(`  ${note}`);
}

if (problems.length > 0) {
  console.error(`\nConstitution check FAILED (${problems.length}):`);
  for (const problem of problems) {
    console.error(`  - ${problem}`);
  }
  console.error(
    '\nIf a rule changed deliberately, update this check to the new invariant and say' +
      '\nwhy in its docblock. Do not edit CLAUDE.md to make the check pass — the file' +
      '\noutranks it.',
  );
  process.exit(1);
}

console.log('Constitution check passed.');
