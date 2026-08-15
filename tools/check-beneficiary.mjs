#!/usr/bin/env node
/**
 * Beneficiary registry audit.
 *
 * TAB 13's three acceptance criteria are that one person keeps one canonical
 * resident identity across programmes, that assistance history is chronological
 * and traceable, and that potential duplicates can be reviewed without leaking
 * unnecessary PII. Each is a property of the shape of the code rather than of
 * any one screen, so each is enforced here:
 *
 *   1. **No second identity.** No `BeneficiaryId`, no beneficiary entity with
 *      its own id, and nothing in the registry keyed on anything but a
 *      `ResidentId`. The criterion holds by construction or not at all.
 *   2. **No merge.** Nothing in the domain, the adapters or the screens merges
 *      or deletes a person. Resolving an identity appends a finding with a
 *      reason; the superseded record survives with its history.
 *   3. **Comparison without disclosure.** `MatchSignal` carries an attribute,
 *      an outcome and a rule — never a value — and the review screens never
 *      render a compared field.
 *   4. **Every timeline entry cites its source.** An entry without a
 *      `sourceId`/`reference` is a claim nobody can check.
 *   5. **Standing stays derived.** No stored `isBeneficiary`-style flag: a flag
 *      can be wrong while the records say otherwise.
 *   6. **Resemblance decides nothing.** No numeric duplicate score, no
 *      threshold, and no auto-resolution.
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

const domainFiles = walk('src/app/domain/beneficiaries', new Set(['.ts'])).filter(
  (file) => !file.includes('.spec.'),
);
const dataFiles = [
  'src/app/data/mock/mock-beneficiary.repository.ts',
  'src/app/data/mock/mock-beneficiary.store.ts',
  'src/app/data/mock/mock-duplicate-matcher.ts',
].filter((file) => existsSync(join(root, file)));
const viewFiles = [
  ...walk('src/app/features/beneficiaries', new Set(['.ts', '.html'])),
  ...walk('src/app/shared/beneficiaries', new Set(['.ts', '.html'])),
].filter((file) => !file.includes('.spec.'));

if (domainFiles.length === 0) {
  problems.push('No beneficiary domain files found. The registry model has moved or been removed.');
}

/* ── 1. One identity, keyed on the resident ──────────────────────────────── */

const ids = read('src/app/domain/shared/ids.ts');
if (/export type BeneficiaryId\b/.test(ids)) {
  problems.push(
    'A `BeneficiaryId` has been introduced. A beneficiary is a standing a resident holds, not a ' +
      'second record about them (DL-71) — a separate id is exactly how one person becomes two.',
  );
}

for (const file of [...domainFiles, ...dataFiles]) {
  const text = read(file);
  if (/\breadonly\s+beneficiaryId\b/.test(text)) {
    problems.push(`${file} carries a beneficiaryId field. The registry keys on ResidentId (DL-71).`);
  }
}
notes.push(`identity: ${domainFiles.length} domain files, all keyed on ResidentId`);

/* ── 2. No merge, anywhere ───────────────────────────────────────────────── */

// `mergeMap` is an RxJS operator and has nothing to do with merging people, so
// it is excluded rather than making this check unusable in a data adapter.
const MERGE = /\b(mergeResidents?|mergeBeneficiar\w+|mergeInto|deleteResident|removeResident|purgeResident)\b/;

for (const file of [...domainFiles, ...dataFiles, ...viewFiles]) {
  const text = read(file);
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (line.trimStart().startsWith('*') || line.trimStart().startsWith('//')) continue;
    if (MERGE.test(line)) {
      problems.push(
        `${file}:${index + 1} performs a merge or deletion of a person. Resolving an identity is a ` +
          'recorded finding; both records survive (DL-74).',
      );
    }
  }
}

const port = read('src/app/domain/ports/repositories.ts');
if (/\bmerge\s*\(/.test(port)) {
  problems.push('BeneficiaryRepository has grown a merge method. There must not be one (DL-74).');
}
if (!/resolveIdentity\s*\(/.test(port)) {
  problems.push('BeneficiaryRepository no longer exposes resolveIdentity — the only sanctioned way ' +
    'to answer a duplicate pair.');
}
notes.push('merge: no merge or delete of a person in domain, data or views');

/* ── 3. A finding needs a reason ─────────────────────────────────────────── */

const duplicateReview = read('src/app/domain/beneficiaries/duplicate-review.ts');

// Checked per interface, not across the file. Both the recorded finding and the
// draft a reviewer submits carry a reason, and one of them still being required
// must not excuse the other — the first version of this check looked for the
// string anywhere and passed while `IdentityResolution.reason` was optional.
const interfaceBlock = (name) =>
  new RegExp(`export interface ${name}\\s*\\{[\\s\\S]*?\\n\\}`).exec(duplicateReview)?.[0] ?? '';

for (const name of ['IdentityResolution', 'IdentityResolutionDraft']) {
  const block = interfaceBlock(name);
  if (block === '') {
    problems.push(`${name} has gone from duplicate-review.ts.`);
    continue;
  }
  if (!/readonly reason:\s*string;/.test(block)) {
    problems.push(
      `${name} no longer requires a reason. A finding about somebody’s identity that nobody had to ` +
        'justify is a finding nobody can review (DL-74).',
    );
  }
}
if (!/'reason-required'/.test(duplicateReview)) {
  problems.push('resolutionProblems no longer refuses an unexplained finding.');
}
notes.push('reason: every identity finding carries one, and an empty one is refused');

/* ── 4. Comparison discloses agreement, never values ─────────────────────── */

// A signal that carried a value would put one person's details in front of
// whoever is clearing the queue about another.
const VALUE_FIELD = /interface MatchSignal[\s\S]*?\n}/;
const signalBlock = VALUE_FIELD.exec(duplicateReview)?.[0] ?? '';
if (/readonly\s+(value|values|left|right|theirs|ours|a|b)\s*[?:]/.test(signalBlock)) {
  problems.push(
    'MatchSignal has grown a value-bearing field. The duplicate queue reports which details agree, ' +
      'never what they are (DL-73).',
  );
}

// The review screens must not render a compared field directly.
const DISCLOSING_BINDING =
  /\{\{[^}]*\.(birthDate|philsysLastFour|monthlyIncome|streetAddress|contact\.mobile)/;
for (const file of viewFiles.filter((file) => file.endsWith('.html'))) {
  const text = read(file);
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (DISCLOSING_BINDING.test(line)) {
      problems.push(
        `${file}:${index + 1} renders a compared personal field. The comparison is agreement-only ` +
          '(DL-73).',
      );
    }
  }
}
notes.push('disclosure: signals carry attribute, outcome and rule — no values');

/* ── 5. Timeline entries cite their source ───────────────────────────────── */

const timeline = read('src/app/domain/beneficiaries/assistance-timeline.ts');
for (const field of ['sourceKind', 'sourceId', 'reference', 'occurredAt']) {
  if (!new RegExp(`readonly ${field}:`).test(timeline)) {
    problems.push(
      `AssistanceTimelineEntry no longer carries ${field}. An entry that cannot be traced back to a ` +
        'record is a story, not a history.',
    );
  }
}
if (/readonly (sourceId|reference)\s*\?:/.test(timeline) || /readonly (sourceId|reference):[^;]*\|\s*null/.test(timeline)) {
  problems.push('A timeline entry may now omit its source. Every line must name a checkable record.');
}
notes.push('timeline: every entry names the record it came from');

/* ── 6. Standing is derived, never stored ────────────────────────────────── */

const standing = read('src/app/domain/beneficiaries/beneficiary-standing.ts');
if (!/export function deriveStanding/.test(standing)) {
  problems.push('deriveStanding has gone. Standing must be computed from records, not stored.');
}
for (const file of [...domainFiles, ...dataFiles]) {
  const text = read(file);
  if (/readonly\s+(isBeneficiary|isEnrollee|isApplicant|beneficiaryFlag)\b/.test(text)) {
    problems.push(
      `${file} stores a standing as a flag. A flag can be wrong while the records say otherwise; ` +
        'standing is derived (DL-71).',
    );
  }
}
notes.push('standing: derived from requests, payouts and enrollments');

/* ── 7. Resemblance orders the queue; it decides nothing ─────────────────── */

if (/readonly\s+(score|confidence|probability|matchPercent)\s*[?:]/.test(duplicateReview)) {
  problems.push(
    'A duplicate candidate has grown a numeric score. Merging two people’s welfare histories on a ' +
      'percentage is what the three-band shape exists to prevent (DL-73).',
  );
}
const AUTO = /\b(autoMerge|autoResolve|resolveAutomatically|AUTO_MERGE_THRESHOLD)\b/;
for (const file of [...domainFiles, ...dataFiles]) {
  if (AUTO.test(read(file))) {
    problems.push(`${file} resolves a duplicate automatically. A person makes the finding (DL-74).`);
  }
}

const strengths = /DuplicateStrength =\s*([^;]+);/.exec(duplicateReview)?.[1] ?? '';
const bands = [...strengths.matchAll(/'([a-z-]+)'/g)].map((match) => match[1]);
if (bands.length !== 3) {
  problems.push(
    `DuplicateStrength has ${bands.length} bands rather than three (${bands.join(', ')}). A fourth ` +
      'band is usually a disposition in disguise.',
  );
}
notes.push(`resemblance: ${bands.join(', ')} — ordering only, no score, no threshold`);

/* ── 8. Enrollment exits are kept ────────────────────────────────────────── */

const enrollment = read('src/app/domain/beneficiaries/program-enrollment.ts');
if (!/exited:\s*\[\]/.test(enrollment)) {
  problems.push(
    'An exited enrollment can now transition onward. Exit is terminal; somebody who returns is ' +
      'enrolled afresh and the new record names the old one.',
  );
}
if (!/'exit-without-a-note'/.test(enrollment)) {
  problems.push('An enrollment exit no longer requires a note.');
}
notes.push('enrollment: exit is terminal, explained, and kept');

/* ── 9. The permission exists and is not implied by reading ──────────────── */

const permissions = read('src/app/domain/access/permission.ts');
for (const permission of ['beneficiary.view', 'beneficiary.review-duplicates']) {
  if (!permissions.includes(`'${permission}'`)) {
    problems.push(`The permission ${permission} has gone from the vocabulary.`);
  }
}

// Reading the registry must not carry the right to adjudicate somebody's
// identity. The intake officer is the check: they read, and do not decide.
const intakeBlock = /const INTAKE_PERMISSIONS[\s\S]*?\n\];/.exec(permissions)?.[0] ?? '';
if (intakeBlock.includes("'beneficiary.review-duplicates'")) {
  problems.push(
    'Intake now holds beneficiary.review-duplicates. Whoever typed the second record should not be ' +
      'the one who rules on whether it is a duplicate.',
  );
}
notes.push('permission: reading the registry does not imply ruling on identity');

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nBeneficiary check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Beneficiary check passed.');
