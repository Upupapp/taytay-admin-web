#!/usr/bin/env node
/**
 * Programme catalog audit.
 *
 * TAB 12's three acceptance criteria are that programme rules are data-driven
 * rather than hardcoded into components, that a policy change can be
 * represented without rewriting the UI, and that national and LGU programme
 * responsibilities are not misrepresented. All three are properties of the
 * shape of the code, so all three are enforced:
 *
 *   1. No programme is hardcoded into a component. A feature or shared file
 *      that branches on a programme code or id has moved policy into markup,
 *      which is exactly what criterion 1 forbids.
 *   2. Every programme in the seed carries a responsibility record, and none of
 *      them claims a national programme as one the municipality runs.
 *   3. No programme still describes AICS as municipally funded — the specific
 *      misstatement this TAB was written to correct.
 *   4. Eligibility guidance stays advisory: no decision-shaped field, no
 *      blocking weight, no function that scores or decides, and no port method
 *      that answers whether a person qualifies.
 *   5. The responsibility notice still renders the statement and the
 *      "we do not decide this" sentence. A record held and never shown is the
 *      same misrepresentation by omission.
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

/* ── 1. No programme hardcoded into a view ───────────────────────────────── */

// A component that names a specific programme has taken policy out of the data
// and put it in markup, where the next policy change cannot reach it.
const HARDCODED_PROGRAMME = /['"]prog-[a-z-]+['"]|programId\s*===\s*['"]|code\s*===\s*['"](AICS|LOC)-/;

const viewFiles = [
  ...walk('src/app/features', new Set(['.ts', '.html'])),
  ...walk('src/app/shared', new Set(['.ts', '.html'])),
].filter((file) => !file.includes('.spec.'));

for (const file of viewFiles) {
  const text = read(file);
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!HARDCODED_PROGRAMME.test(line)) continue;
    problems.push(
      `${file}:${index + 1} names a specific programme in a view: ` +
        `"${line.trim().slice(0, 80)}". Programme rules are data (DL-66); a policy change must ` +
        'be an edit to a record, not to a component.',
    );
  }
}
notes.push(`views: ${viewFiles.length} files checked for hardcoded programmes`);

/* ── 2 & 3. Responsibility is recorded, and honest ───────────────────────── */

const seed = read('src/app/data/mock/seed/programs.seed.ts');
const policySeed = read('src/app/data/mock/seed/program-policy.seed.ts');

const programmeCount = [...seed.matchAll(/id: asId<ProgramId>\(/g)].length;
const responsibilityCount = [...seed.matchAll(/^\s{4}responsibility:/gm)].length;

if (programmeCount === 0) {
  problems.push('No programmes found in the seed — this check is blind.');
} else if (responsibilityCount !== programmeCount) {
  problems.push(
    `${programmeCount} programmes but ${responsibilityCount} responsibility records. A programme ` +
      'without one is a programme the office is implicitly claiming (DL-65).',
  );
}

// The specific misstatement TAB 12 exists to correct.
if (/fundingSource: 'Municipal social welfare fund'/.test(seed)) {
  problems.push(
    'A programme is still described as funded by the "Municipal social welfare fund". AICS is a ' +
      'DSWD programme with agency-disbursed funds; that wording claims a national programme as ' +
      'municipal work (DL-65).',
  );
}

// The AICS record must not claim municipal ownership, whatever else it says.
const aicsBlock = policySeed.slice(
  policySeed.indexOf('AICS_RESPONSIBILITY'),
  policySeed.indexOf('MUNICIPAL_RESPONSIBILITY'),
);
if (aicsBlock.length === 0) {
  problems.push('AICS_RESPONSIBILITY could not be found — this check is blind.');
} else {
  if (!/administeredBy: 'dswd'/.test(aicsBlock)) {
    problems.push('AICS is no longer recorded as administered by DSWD.');
  }
  if (/lguRole: 'owner'/.test(aicsBlock)) {
    problems.push(
      'AICS is recorded with the municipality as owner. It is a DSWD programme; the LGU refers ' +
        'into it (DL-65).',
    );
  }
  if (!/sources: \[/.test(aicsBlock) || aicsBlock.indexOf('https://') === -1) {
    problems.push('The AICS responsibility record carries no source.');
  }
}
notes.push(`seed: ${programmeCount} programmes, each with a responsibility record`);

/* ── 4. Guidance stays advisory ──────────────────────────────────────────── */

const guidanceText = read('src/app/domain/programs/eligibility-guidance.ts');

const DECISION_FIELD =
  /^\s*readonly\s+(eligible|isEligible|qualifies|qualified|approved|denied|blocks|isBlocking|decision|verdict|score|points|rating)\b/;
for (const [index, line] of guidanceText.split(/\r?\n/).entries()) {
  if (DECISION_FIELD.test(line)) {
    problems.push(
      `eligibility-guidance.ts:${index + 1} declares a decision-shaped field: ` +
        `"${line.trim().slice(0, 70)}". Guidance is read by a person; it decides nothing (DL-66).`,
    );
  }
}

const weightMatch = /export type GuidanceWeight =([^;]+);/.exec(guidanceText);
if (weightMatch === null) {
  problems.push('Could not parse `GuidanceWeight` — the blocking-weight check is blind.');
} else {
  const weights = [...weightMatch[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
  for (const forbidden of ['required', 'blocking', 'mandatory', 'disqualifying', 'refuse']) {
    if (weights.includes(forbidden)) {
      problems.push(
        `\`GuidanceWeight\` includes '${forbidden}'. A weight that refuses an applicant turns the ` +
          'catalog into a decision engine (DL-66).',
      );
    }
  }
  notes.push(`guidance weights: ${weights.join(', ')} — none of them refuses`);
}

// Exact names, not prefixes: `decidesElsewhere` is a read-only predicate about
// who decides, which is the opposite of deciding.
const SCORING =
  /export function\s+(score|scoreProgram|rank|rankPrograms|rate|decide|decideProgram|approve|deny|qualifies|isEligibleFor|evaluateEligibility)\s*\(/;
for (const file of walk('src/app/domain/programs', new Set(['.ts'])).filter(
  (file) => !file.includes('.spec.'),
)) {
  const match = SCORING.exec(read(file));
  if (match) {
    problems.push(`${file} exports \`${match[1]}\`, which scores or decides.`);
  }
}

const portsText = read('src/app/domain/ports/repositories.ts');
const portStart = portsText.indexOf('export interface ProgramRepository');
const port = portsText.slice(portStart, portsText.indexOf('\n}', portStart));
for (const forbidden of ['checkEligibility', 'isEligible', 'qualifies', 'evaluate', 'screen']) {
  if (new RegExp(`\\b${forbidden}\\s*\\(`).test(port)) {
    problems.push(
      `ProgramRepository declares \`${forbidden}\`. A port that answers whether a person qualifies ` +
        'is the decision engine this TAB forbids (DL-66).',
    );
  }
}
notes.push('port: catalog reads and writes only, no eligibility verdict');

/* ── 5. The notice still says it ─────────────────────────────────────────── */

const noticeText = read('src/app/shared/programs/responsibility-notice.ts');
for (const marker of ['record.statement', 'copy.decidedElsewhere', 'record.sources']) {
  if (!noticeText.includes(marker)) {
    problems.push(
      `responsibility-notice.ts no longer renders \`${marker}\`. A responsibility record held and ` +
        'never shown misrepresents the office by omission.',
    );
  }
}

const copyText = read('src/app/shared/programs/program.copy.ts');
if (!/decidedElsewhere:\s*\n?\s*'[^']*does not decide/i.test(copyText)) {
  problems.push(
    'program.copy.ts no longer states that the MSWDO does not decide a referred programme. That ' +
      'sentence is what stops staff promising an outcome they cannot deliver.',
  );
}
notes.push('notice: statement, referral warning and sources all rendered');

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nProgramme check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Programme check passed.');
