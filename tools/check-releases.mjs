#!/usr/bin/env node
/**
 * Release and distribution audit.
 *
 * TAB 17's acceptance criteria are that a release can be scheduled, recorded
 * and acknowledged, that batch tools never hide individual status, and that the
 * module stays inside its remit. That last one is the reason most of this file
 * exists:
 *
 *   1. **This is not the treasury system** (`DL-89`). The master command
 *      supplies no accounting entries, no bank integration and no posting
 *      rules, so none may be invented. A ledger field is easy to add and
 *      impossible to walk back once an office reconciles against it.
 *   2. **A batch has no status** (`DL-90`). What a session amounts to is
 *      counted from its members, so it cannot read "released" while three
 *      people in it went home empty-handed.
 *   3. **Deferred is not unclaimed.** Every deferral reason belongs to the
 *      office; if the family did not come, that is `unclaimed`.
 *   4. **Goods are counted, never valued** (`DL-93`). An in-kind release
 *      carries a description and no amount, and no total invents one.
 *   5. **The manifest carries the minimum, masked** (`DL-92`), and is composed
 *      by the data layer rather than assembled by a screen.
 *   6. **Segregation of duties warns, never blocks** (`DL-91`).
 *   7. **The adapter checks permission and applies scope** (`DL-95`).
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

const domainFiles = walk('src/app/domain/disbursements', new Set(['.ts'])).filter(
  (file) => !file.includes('.spec.'),
);
const viewFiles = walk('src/app/features/releases', new Set(['.ts', '.html'])).filter(
  (file) => !file.includes('.spec.'),
);
const dataFiles = [
  'src/app/data/mock/mock-disbursement.repository.ts',
  'src/app/data/mock/seed/disbursements.seed.ts',
].filter((file) => existsSync(join(root, file)));

if (domainFiles.length === 0) {
  problems.push('No release domain files found. The model has moved or been removed.');
}
if (viewFiles.length === 0) {
  problems.push('No release screens found. The feature has moved or been removed.');
}

const disbursement = read('src/app/domain/disbursements/disbursement.ts');
const batch = read('src/app/domain/disbursements/release-batch.ts');
const manifest = read('src/app/domain/disbursements/release-manifest.ts');
const adapter = read('src/app/data/mock/mock-disbursement.repository.ts');
const port = read('src/app/domain/ports/repositories.ts');

const isComment = (line) => {
  const trimmed = line.trimStart();
  return trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*');
};

/** The declaration a rule is about, so a match elsewhere in the file cannot pass it. */
const block = (text, pattern, what) => {
  const found = pattern.exec(text)?.[0] ?? '';
  if (found === '') problems.push(`${what} has gone from the release domain.`);
  return found;
};

/* ── 1. This is not the treasury system ──────────────────────────────────── */

// Names an accounting feature arrives under. `bank-transfer` as a payout method
// and "posts nothing to an account" as screen copy are deliberately not among
// them: the method says how somebody was paid, not that this app posts anything.
const ACCOUNTING =
  /\b(ledger|generalLedger|journalEntr(y|ies)|accountCode|accountingCode|chartOfAccounts|glAccount|bankAccount\w*|debitAccount|creditAccount|postToLedger|postingDate|postingReference|voucherPosting|trialBalance|fundBalance)\b/i;

for (const file of [...domainFiles, ...viewFiles, ...dataFiles]) {
  const text = read(file);
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (isComment(line)) continue;
    if (ACCOUNTING.test(line)) {
      problems.push(
        `${file}:${index + 1} introduces an accounting concept. This module tracks release ` +
          'operations; the LGU supplied no accounting entries, banking integration or posting ' +
          'rules, so none may be invented here (DL-89).',
      );
    }
  }
}

const portBlock = block(
  port,
  /export interface DisbursementRepository\s*\{[\s\S]*?\n\}/,
  'DisbursementRepository',
);
if (portBlock !== '' && ACCOUNTING.test(portBlock)) {
  problems.push('DisbursementRepository exposes an accounting operation. It must not (DL-89).');
}

// The boundary is stated where an officer reads it, not only in a decision log.
const copy = existsSync(join(root, 'src/app/features/releases/releases.copy.ts'))
  ? read('src/app/features/releases/releases.copy.ts')
  : '';
const boundaryNotice = /boundaryNotice:\s*\n?\s*'([^']*)'/.exec(copy)?.[1] ?? '';
if (!/not the accounting system/i.test(boundaryNotice)) {
  problems.push(
    'The release screen no longer says it is not the accounting system. An office that believes ' +
      'this is the book of record will reconcile against the treasury and find out the hard way.',
  );
}
if (!viewFiles.some((file) => file.endsWith('.html') && /copy\.boundaryNotice/.test(read(file)))) {
  problems.push('No screen renders the boundary notice. Stated and never shown is not stated.');
}
notes.push(`treasury boundary: clean across ${domainFiles.length + viewFiles.length + dataFiles.length} files, and shown on screen`);

/* ── 2. A batch has no status ────────────────────────────────────────────── */

const batchBlock = block(batch, /export interface ReleaseBatch\s*\{[\s\S]*?\n\}/, 'ReleaseBatch');
if (/readonly status\s*[?:]/.test(batchBlock)) {
  problems.push(
    'A payout session carries its own status. A batch is a plan, not a unit: give it a status and ' +
      'it can read "released" while three people in it went home with nothing, and nobody can say ' +
      'which three (DL-90).',
  );
}

const progressBlock = block(batch, /export interface BatchProgress\s*\{[\s\S]*?\n\}/, 'BatchProgress');
for (const counted of ['released', 'deferred', 'needsCorrection', 'outstanding']) {
  if (!new RegExp(`readonly ${counted}: number;`).test(progressBlock)) {
    problems.push(
      `BatchProgress no longer counts ${counted}. Counts are what let a supervisor act; a single ` +
        'state does not (DL-90).',
    );
  }
}

const describeBody = block(
  batch,
  /export function describeBatch[\s\S]*?\n\}/,
  'describeBatch',
);
// Scoped to the function body: a completeness word surviving in a comment
// elsewhere in this file would pass a file-wide search while the sentence a
// supervisor reads had quietly become "Complete".
const VERDICT = /'(complete|completed|partially complete|all released|done|finished)[.']/i;
if (VERDICT.test(describeBody)) {
  problems.push(
    'describeBatch summarises a session as a single verdict. "38 of 41 released, 2 deferred" is a ' +
      'sentence somebody can act on; "Partially complete" is not (DL-90).',
  );
}
for (const counted of ['progress.deferred', 'progress.needsCorrection', 'progress.outstanding']) {
  if (!describeBody.includes(counted)) {
    problems.push(`describeBatch no longer reports ${counted}.`);
  }
}

// And the counts have to reach a screen.
if (!viewFiles.some((file) => /describeBatch|batchProgress/.test(read(file)))) {
  problems.push('No screen counts a session from its members. A batch would be read as a state.');
}
notes.push('batch: no status of its own, counted from its members, counts rendered');

/* ── 3. Deferred is not unclaimed ────────────────────────────────────────── */

const statusUnion = /DisbursementStatus =\s*([^;]+);/.exec(disbursement)?.[1] ?? '';
const statuses = [...statusUnion.matchAll(/'([a-z-]+)'/g)].map((match) => match[1]);
for (const required of ['deferred', 'unclaimed', 'needs-correction']) {
  if (!statuses.includes(required)) {
    problems.push(
      `DisbursementStatus no longer distinguishes '${required}'. Recording a payout the office ` +
        'could not make as "unclaimed" blames a family for the office’s missing signature.',
    );
  }
}

const reasonUnion = /DeferralReason =\s*([^;]+);/.exec(disbursement)?.[1] ?? '';
const reasons = [...reasonUnion.matchAll(/'([a-z-]+)'/g)].map((match) => match[1]);
if (reasons.length === 0) {
  problems.push('DeferralReason has gone. A deferral with no stated reason is an unexplained one.');
}
// Every reason on this list is the office's, which is the whole point of
// holding `deferred` apart from `unclaimed`.
const BLAMES_THE_FAMILY =
  /beneficiar|client|recipient|no-show|did-not-(come|appear|attend)|absent|failed-to-(appear|claim|collect)|refus/i;
const labelsBlock = block(
  disbursement,
  /export const DEFERRAL_REASON_LABELS[\s\S]*?\n\};/,
  'DEFERRAL_REASON_LABELS',
);
for (const reason of reasons) {
  if (BLAMES_THE_FAMILY.test(reason)) {
    problems.push(
      `DeferralReason '${reason}' is about the beneficiary. A deferral is the office’s; if the ` +
        'family did not come, that is unclaimed.',
    );
  }
}
for (const [, label] of labelsBlock.matchAll(/:\s*\n?\s*'([^']*)'/g)) {
  if (BLAMES_THE_FAMILY.test(label)) {
    problems.push(
      `The deferral reason "${label}" blames the beneficiary. Every reason on that list is the ` +
        'office’s own.',
    );
  }
}

const problemsBody = block(
  disbursement,
  /export function disbursementProblems[\s\S]*?\n\}/,
  'disbursementProblems',
);
if (!/'deferred-without-a-reason'/.test(problemsBody)) {
  problems.push('A deferral no longer has to state a reason.');
}
if (!/'representative-without-authority'/.test(problemsBody)) {
  problems.push(
    'A representative may now collect with no authority recorded. That is how a payout is signed ' +
      'for by somebody the beneficiary never sent.',
  );
}
notes.push(`deferral: ${reasons.length} reasons, all the office’s own; deferred ≠ unclaimed`);

/* ── 4. Goods are counted, never valued ──────────────────────────────────── */

const disbursementBlock = block(
  disbursement,
  /export interface Disbursement\s*\{[\s\S]*?\n\}/,
  'Disbursement',
);
if (!/readonly amount: Money \| null;/.test(disbursementBlock)) {
  problems.push(
    'A release amount is no longer nullable. Forcing a peso figure onto a sack of rice invents a ' +
      'number that then appears in reports as though somebody counted it (DL-93).',
  );
}
for (const rule of ['in-kind-release-with-an-amount', 'money-release-without-an-amount']) {
  if (!problemsBody.includes(rule)) {
    problems.push(`disbursementProblems no longer rejects '${rule}'.`);
  }
}

const sumBody = block(disbursement, /export function sumReleased[\s\S]*?\n\}/, 'sumReleased');
if (!/amount !== null/.test(sumBody)) {
  problems.push(
    'sumReleased no longer excludes in-kind releases. Coercing goods to zero and summing them is ' +
      'how an invented figure enters a total nobody can see is wrong (DL-93).',
  );
}

const composeBody = block(manifest, /export function composeManifest[\s\S]*?\n^\}/m, 'composeManifest');
if (!/moneyLines/.test(composeBody)) {
  problems.push('The manifest total no longer separates money lines from goods.');
}
notes.push('in-kind: carries a description and no amount; no total values goods');

/* ── 5. The manifest carries the minimum, masked, composed by the data layer ─ */

if (!/export function maskReference/.test(manifest)) {
  problems.push('maskReference has gone. A printed voucher series is one somebody can guess at.');
}
if (!/maskReference\(/.test(composeBody)) {
  problems.push(
    'composeManifest no longer masks the voucher reference. The sheet leaves the building (DL-92).',
  );
}

const noticeBlock = /export const MANIFEST_NOTICE\s*=[\s\S]*?;/.exec(manifest)?.[0] ?? '';
if (!/RA 10173/.test(noticeBlock)) {
  problems.push(
    'The manifest no longer cites RA 10173. It is handled at a barangay hall with no lockable ' +
      'drawer, and the notice is the only thing travelling with it.',
  );
}

// Nothing on the sheet beyond a name, a masked voucher and what is being handed
// over. A payout list naming which of your neighbours is a VAWC survivor is a
// disclosure the office cannot recall once it is on a clipboard.
const LEAKS = /\b(birthDate|dateOfBirth|address|barangayId|philsys\w*|sector\w*|monthlyIncome|contactNumber|householdId|caseId|reasonForAssistance)\b/i;
for (const shape of ['ManifestLine', 'ReleaseManifest']) {
  const shapeBlock = block(manifest, new RegExp(`export interface ${shape}\\s*\\{[\\s\\S]*?\\n\\}`), shape);
  if (LEAKS.test(shapeBlock)) {
    problems.push(
      `${shape} carries an attribute that has no use at a payout table. The sheet is printed and ` +
        'handled outside the office (DL-92).',
    );
  }
}
if (!/acknowledgementKind: null/.test(composeBody)) {
  problems.push(
    'The manifest pre-fills how somebody will acknowledge. That is how a sheet comes back signed ' +
      'for a person who was never there.',
  );
}

// Composed, never laid out: a screen holding fuller records is one binding away
// from printing a birth date onto a sheet that leaves the building (DL-82).
for (const file of viewFiles) {
  const text = read(file);
  if (/\bcomposeManifest\b/.test(text)) {
    problems.push(
      `${file} composes its own manifest. The sheet comes from the data layer, which holds the ` +
        'disclosed record, not from a screen assembling one (DL-92).',
    );
  }
  if (/from '@data\//.test(text)) {
    problems.push(`${file} imports from the data layer. Features depend on domain tokens only.`);
  }
}
if (!/manifestFor\s*\(/.test(portBlock)) {
  problems.push('The port no longer composes a manifest. A screen would be forced to.');
}
notes.push('manifest: masked, minimal, RA 10173 notice, composed by the data layer');

/* ── 6. Segregation of duties warns, never blocks ────────────────────────── */

if (!/export function isSelfRelease/.test(manifest)) {
  problems.push('isSelfRelease has gone. The one-person-both-sides case would go unremarked.');
}
if (!/export const SELF_RELEASE_WARNING/.test(manifest)) {
  problems.push('SELF_RELEASE_WARNING has gone.');
}

const detailPage = existsSync(join(root, 'src/app/features/releases/release-detail-page.ts'))
  ? read('src/app/features/releases/release-detail-page.ts')
  : '';
const canRecordBody =
  /canRecordRelease = computed\(\(\) => \{[\s\S]*?\n  \}\);/.exec(detailPage)?.[0] ?? '';
if (canRecordBody !== '' && /wouldSelfRelease/.test(canRecordBody)) {
  problems.push(
    'Self-release blocks the payout. A small office on a bad day may genuinely have one person ' +
      'available, and refusing punishes the family for the office’s staffing (DL-91).',
  );
}
const detailTemplate = existsSync(join(root, 'src/app/features/releases/release-detail-page.html'))
  ? read('src/app/features/releases/release-detail-page.html')
  : '';
if (/\[disabled\]="[^"]*wouldSelfRelease/.test(detailTemplate)) {
  problems.push('The template disables the release control on a self-release. It warns (DL-91).');
}
if (!/wouldSelfRelease\(\)/.test(detailTemplate)) {
  problems.push('The self-release warning never reaches the screen.');
}
notes.push('segregation of duties: warned against who approved, never blocked');

/* ── 7. The adapter checks permission and scope ──────────────────────────── */

for (const method of [
  'list',
  'getById',
  'listForRequest',
  'queue',
  'approverFor',
  'listBatches',
  'getBatch',
  'createBatch',
  'manifestFor',
  'markReleased',
  'acknowledge',
  'deferRelease',
  'changeStatus',
]) {
  const body = new RegExp(`\\n  ${method}\\(([\\s\\S]*?)\\n  \\}`).exec(adapter)?.[1] ?? '';
  if (body === '') {
    problems.push(`MockDisbursementRepository.${method} has gone.`);
    continue;
  }
  if (!/denyUnless|userHasPermission/.test(body)) {
    problems.push(
      `MockDisbursementRepository.${method} does not check permission. A payout record names a ` +
        'person, an amount, and a date and place they can be found collecting money (DL-95).',
    );
  }
}
// Scoped to the method that applies it. A file-wide search for the identifier
// passes on the surviving import alone, which is how a checker reports clean on
// an adapter that has stopped scoping anything at all.
const readableBody =
  /private isReadable\([\s\S]*?\n  \}/.exec(adapter)?.[0] ?? '';
if (readableBody === '') {
  problems.push('MockDisbursementRepository.isReadable has gone. Nothing applies scope.');
} else if (!/isWithinBarangayScope\(/.test(readableBody)) {
  problems.push(
    'The release adapter no longer applies barangay scope. A barangay-link account would read ' +
      'payouts across the municipality.',
  );
}
if (!/discloseResident|disclose\(/.test(adapter)) {
  problems.push(
    'The release adapter no longer discloses the beneficiary through the resident rules. The ' +
      'manifest would be built from an undisclosed record (DL-38).',
  );
}
notes.push('access: every read and write gated, scope applied, beneficiary disclosed');

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nRelease check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Release check passed.');
