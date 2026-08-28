#!/usr/bin/env node
/**
 * Referral disclosure audit.
 *
 * TAB 15's three acceptance criteria are that every referral is traceable to a
 * case or client, that overdue referrals surface in work queues, and that
 * referral views minimise unnecessary disclosure. The third is the one that
 * cannot be recovered from if it fails — a summary that has left the building
 * cannot be taken back — so most of this file is about it:
 *
 *   1. **A referral cannot be sent without a lawful basis.** `send` takes a
 *      disclosure plan, the plan requires a basis and a note, and the adapter
 *      refuses an invalid one.
 *   2. **Every shared field states a need.** No bulk "share everything" switch,
 *      and each choice carries a `because`.
 *   3. **The sheet is composed, not laid out.** No screen assembles a summary
 *      from a fuller record, and no template renders a raw resident field on a
 *      referral page.
 *   4. **Traceable.** A referral carries a client, and a case or request link.
 *   5. **Overdue is derived**, not stored, so it cannot be stale.
 *   6. **The adapter checks permission.** This file exists partly because the
 *      referral adapter shipped without any until TAB 15.
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

const domainFiles = walk('src/app/domain/referrals', new Set(['.ts'])).filter(
  (file) => !file.includes('.spec.'),
);
const viewFiles = walk('src/app/features/referrals', new Set(['.ts', '.html'])).filter(
  (file) => !file.includes('.spec.'),
);

if (domainFiles.length === 0) {
  problems.push('No referral domain files found. The model has moved or been removed.');
}

const disclosure = read('src/app/domain/referrals/referral-disclosure.ts');
const referral = read('src/app/domain/referrals/referral.ts');
const port = read('src/app/domain/ports/repositories.ts');
const adapter = read('src/app/data/mock/mock-referral.repository.ts');

/* ── 1. A referral cannot be sent without a lawful basis ─────────────────── */

/*
 * ── SUPERSEDED MECHANISM, SAME DOCTRINE (`DL-140`) ───────────────────────────
 *
 * This used to assert `send(id: ReferralId, plan: DisclosurePlan)` — the basis travelling in the
 * same call as the sending, so that no window could exist in which a referral was sendable without
 * one.
 *
 * **That mechanism guaranteed the mock and nothing else.** `POST admin/referrals/{referral}/send`
 * accepts **no body at all**: the plan was being posted to an endpoint that never read it. The
 * basis is recorded by `POST .../authority`, and the server checks it in `ReferralService::send`
 * **inside the row lock**, before the transition, with its own note that *"a check that lives only
 * in a request validator is a check the next write path will not have."*
 *
 * So the doctrine holds more strongly than the old signature could deliver — a referral without a
 * basis cannot be sent because the server refuses the transition, not because a TypeScript
 * parameter was mandatory. What this rule asserts now is the shape that actually carries it: the
 * basis is its own recorded act, and both the port and the mock refuse a send without one.
 */
if (!/recordDisclosureBasis\(/.test(port)) {
  problems.push(
    'ReferralRepository has no recordDisclosureBasis. The lawful basis must be its own recorded ' +
      'act before a referral can be sent (DL-81, DL-140).',
  );
}

if (!/shareField\(/.test(port)) {
  problems.push(
    'ReferralRepository has no shareField. Every field beyond the minimum is chosen one at a ' +
      'time with a stated need (DL-82).',
  );
}

if (/send\(id: ReferralId, plan/.test(port)) {
  problems.push(
    'ReferralRepository.send takes a disclosure plan again. The endpoint accepts no body; a plan ' +
      'sent there is read by nothing (DL-140).',
  );
}

/*
 * The mock must refuse the send, not merely offer the methods.
 *
 * A stand-in that sent without a basis would let a screen be built against a boundary only the
 * real server enforces — which is the failure the whole mock/HTTP seam exists to avoid.
 */
if (!/authority-required/.test(adapter)) {
  problems.push(
    'The mock referral adapter does not refuse a send with no lawful basis recorded. The server ' +
      'refuses it inside its row lock; a more permissive mock hides that boundary (DL-81).',
  );
}

/* ── 2. Every shared field states a need ─────────────────────────────────── */

const choiceBlock = /export interface SharedFieldChoice\s*\{[\s\S]*?\n\}/.exec(disclosure)?.[0] ?? '';
if (!/readonly because: string;/.test(choiceBlock)) {
  problems.push(
    'A shared field no longer states why the receiving office needs it. "Include everything, they ' +
      'can ignore the rest" is how a survivor’s address reaches a desk with no reason to hold it.',
  );
}

const attachmentBlock =
  /export interface SharedAttachment\s*\{[\s\S]*?\n\}/.exec(disclosure)?.[0] ?? '';
if (!/readonly because: string;/.test(attachmentBlock)) {
  problems.push('An attachment no longer states why it is being shared (DL-82).');
}

// A single switch would be ticked once and forgotten.
const BULK = /\b(shareAll|shareEverything|includeFullProfile|shareWholeRecord)\b/;
for (const file of [...domainFiles, ...viewFiles]) {
  if (BULK.test(read(file))) {
    problems.push(`${file} offers a bulk share. Each field is a separate decision (DL-82).`);
  }
}
notes.push('fields: opt-in one at a time, each with a stated need');

/* ── 3. The sheet is composed, not laid out ──────────────────────────────── */

if (!/export function composeReferralSummary/.test(disclosure)) {
  problems.push('composeReferralSummary has gone. The sheet must be composed from the plan.');
}
if (!/summaryFor\(id: ReferralId\)/.test(port)) {
  problems.push('The port no longer exposes summaryFor; a screen would have to compose the sheet.');
}

// No referral screen may reach into a resident record: the sheet is handed to
// it already reduced, and a page holding a fuller record is a page that will
// eventually print from it.
const RESIDENT_FIELD =
  /\{\{[^}]*\.(philsysLastFour|monthlyIncome|birthDate|streetAddress|purokOrSitio)/;
for (const file of viewFiles.filter((file) => file.endsWith('.html'))) {
  const text = read(file);
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (RESIDENT_FIELD.test(line)) {
      problems.push(
        `${file}:${index + 1} renders a resident field directly on a referral screen. The sheet is ` +
          'composed by the data layer from the authorised plan (DL-81).',
      );
    }
  }
}

// Scoped to the constant, not the file. `RA 10173` also appears in this
// module's doc comment, and a file-wide search passed with the statute removed
// from the notice actually printed on the sheet.
const noticeText = /export const HANDLING_NOTICE\s*=\s*([\s\S]*?);/.exec(disclosure)?.[1] ?? '';
if (noticeText === '') {
  problems.push(
    'The handling notice has gone. It is what tells the receiving office the purpose limitation ' +
      'it holds the information under.',
  );
} else if (!/RA 10173/.test(noticeText)) {
  problems.push('The handling notice no longer names the statute it relies on.');
}
const printsNotice = viewFiles.some(
  (file) => file.endsWith('.html') && /handlingNotice/.test(read(file)),
);
if (!printsNotice) {
  problems.push('No screen prints the handling notice. A notice never shown is not a notice.');
}
notes.push('sheet: composed by the data layer, printed with its handling notice');

/* ── 4. Traceable to a client, and to a case or request ──────────────────── */

// Scoped to the `Referral` interface. `ReferralFilter` legitimately has an
// optional `residentId` — it is a filter — and a file-wide search read that as
// a referral without a client.
const referralBlock = /export interface Referral\s*\{[\s\S]*?\n\}/.exec(referral)?.[0] ?? '';
if (referralBlock === '') {
  problems.push('The Referral interface has gone from referral.ts.');
}

for (const field of ['residentId', 'caseId', 'requestId']) {
  if (!new RegExp(`readonly ${field}:`).test(referralBlock)) {
    problems.push(`A referral no longer carries ${field}; it would not be traceable.`);
  }
}
if (
  /readonly residentId\?:/.test(referralBlock) ||
  /readonly residentId: [^;]*\| null/.test(referralBlock)
) {
  problems.push('A referral may now exist without a client. Every referral is about somebody.');
}
notes.push('traceable: a client always, and a case or request where there is one');

/* ── 5. Overdue is derived ───────────────────────────────────────────────── */

if (!/export function isReferralOverdue/.test(referral)) {
  problems.push('isReferralOverdue has gone. Overdue is derived from the record.');
}
if (/readonly isOverdue\s*[?:]/.test(referral)) {
  problems.push(
    'A referral stores an overdue flag. It would need a nightly job to stay true, and would be ' +
      'wrong every morning until it ran.',
  );
}
if (!/queue\(filter: ReferralFilter\)/.test(port)) {
  problems.push('The port no longer exposes the work queue; overdue referrals would not surface.');
}
notes.push('overdue: derived from the follow-up date, never stored');

/* ── 6. The adapter checks permission ────────────────────────────────────── */

// This check exists because the referral adapter shipped with no permission
// checks at all until TAB 15: list and getById returned seeded records to any
// caller, unauthenticated included.
for (const method of ['list', 'forResident', 'queue', 'listProviders']) {
  const body = new RegExp(`\\n  ${method}\\(([\\s\\S]*?)\\n  \\}`).exec(adapter)?.[1] ?? '';
  if (body === '') {
    problems.push(`MockReferralRepository.${method} has gone.`);
    continue;
  }
  if (!/denyUnless|userHasPermission/.test(body)) {
    problems.push(`MockReferralRepository.${method} does not check permission.`);
  }
}
if (!/isWithinBarangayScope/.test(adapter)) {
  problems.push('The referral adapter no longer applies barangay scope.');
}

const permissions = read('src/app/domain/access/permission.ts');
for (const permission of ['referral.view', 'referral.manage']) {
  if (!permissions.includes(`'${permission}'`)) {
    problems.push(`The permission ${permission} has gone from the vocabulary.`);
  }
}
notes.push('access: every read gated, every write gated, scope applied');

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nReferral check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Referral check passed.');
