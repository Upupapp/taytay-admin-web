#!/usr/bin/env node
/**
 * Case audit-trail and protected-note audit.
 *
 * TAB 10's second acceptance criterion is that **every material status change
 * produces an audit-event seam**, and its third is that **protected notes are
 * not exposed outside authorized contexts**. Both are properties of the shape
 * of the code rather than of any one running component, so unit tests cannot
 * see them and a comment saying "always append an event" does not survive the
 * third hurried change. They are enforced here:
 *
 *   1. Every mutating method on `CaseRepository` declares a `reason` parameter.
 *      A change nobody had to justify is a change nobody can review.
 *   2. `MockCaseStore` never edits or deletes history: `this.events` is only
 *      ever assigned by appending, and no method deletes, edits or reopens.
 *   3. Every mutator on the store calls `append`, so no path changes a case
 *      without writing the event beside it.
 *   4. Every `CaseStatus` is worded and reachable: present in the catalog, the
 *      transition map, the permission map and the shared copy. Each map is
 *      sliced and searched on its own — searching the whole file lets a status
 *      deleted from one map pass because it survives in another, which is what
 *      a planted regression proved before this was tightened (TAB 08's lesson).
 *   5. The protected tier is redacted in the data layer, not the template: the
 *      workspace exposes `CaseNoteView`, the disclosure function exists, the
 *      adapter calls it, and no feature or shared file touches the unredacted
 *      `CaseNote` type.
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

/** Slices `export const NAME ... \n};` so each map is searched on its own. */
const constBlock = (text, name) => {
  const start = text.indexOf(`export const ${name}`);
  if (start === -1) return null;
  const end = text.indexOf('\n};', start);
  return end === -1 ? null : text.slice(start, end);
};

/* ── 1. Every mutation carries a reason ──────────────────────────────────── */

const portsText = read('src/app/domain/ports/repositories.ts');
const portStart = portsText.indexOf('export interface CaseRepository');
const portEnd = portsText.indexOf('\n}', portStart);

if (portStart === -1 || portEnd === -1) {
  problems.push('Could not find `CaseRepository` in ports/repositories.ts — this check is blind.');
} else {
  const port = portsText.slice(portStart, portEnd);
  // Reads answer questions; mutations change the record and must justify it.
  const READ_ONLY = new Set(['list', 'queueCounts', 'getById', 'casesForResident']);
  const methods = [...port.matchAll(/^\s{2}([a-zA-Z]+)\(([\s\S]*?)\):/gm)];

  if (methods.length === 0) {
    problems.push('Parsed no methods on `CaseRepository` — this check is blind.');
  }
  let mutations = 0;
  for (const [, name, params] of methods) {
    if (READ_ONLY.has(name)) continue;
    mutations += 1;
    if (!/\breason:\s*string\b/.test(params)) {
      problems.push(
        `CaseRepository.${name}() takes no \`reason: string\`. Every material change to a case ` +
          'must record why it happened; that reason is what the audit event is written from.',
      );
    }
  }
  notes.push(`port: ${mutations} mutating methods, each requiring a reason`);

  for (const forbidden of ['deleteNote', 'removeNote', 'editNote', 'updateNote', 'reopen']) {
    if (new RegExp(`\\b${forbidden}\\s*\\(`).test(port)) {
      problems.push(
        `CaseRepository declares \`${forbidden}\`. Case history is append-only (DL-54): a case ` +
          'that recurs is opened as a new case, and a note that was wrong is corrected by a ' +
          'further note.',
      );
    }
  }
}

/* ── 2 & 3. The store appends, and never rewrites ────────────────────────── */

const storeText = read('src/app/data/mock/mock-case.store.ts');

for (const [index, line] of storeText.split(/\r?\n/).entries()) {
  if (!/this\.events\s*=/.test(line)) continue;
  // The only sanctioned assignment is an append; the array literal opens on
  // this line or the next, so both are inspected.
  const window = storeText
    .split(/\r?\n/)
    .slice(index, index + 3)
    .join(' ');
  if (!/this\s*\.\s*events\s*=\s*\[\s*(\.\.\.this\s*\.\s*events|\.\.\.MOCK_CASE_EVENTS)/.test(window)) {
    problems.push(
      `mock-case.store.ts:${index + 1} assigns \`this.events\` without appending to it. The only ` +
        'way a case history may change is by growing (DL-54).',
    );
  }
}

const FORBIDDEN_STORE =
  /\b(deleteEvent|removeEvent|clearEvents|editEvent|deleteNote|removeNote|editNote|deleteTask|removeTask)\s*\(/;
if (FORBIDDEN_STORE.test(storeText)) {
  problems.push(
    'mock-case.store.ts declares a method that deletes or edits history. There is deliberately ' +
      'no update or delete counterpart to `append`.',
  );
}

// Every method that assigns to a record collection must also write the event.
const MUTATORS = ['changeStatus', 'assign', 'addNote', 'addTask', 'completeTask'];
for (const mutator of MUTATORS) {
  const start = storeText.indexOf(`  ${mutator}(`);
  if (start === -1) {
    problems.push(`mock-case.store.ts no longer defines \`${mutator}\`.`);
    continue;
  }
  const end = storeText.indexOf('\n  }', start);
  const body = end === -1 ? storeText.slice(start) : storeText.slice(start, end);
  if (!/this\s*\.\s*append\s*\(/.test(body)) {
    problems.push(
      `mock-case.store.ts \`${mutator}\` changes a case without calling \`append\`. The change ` +
        'and the event it produces are one act, not two (DL-54).',
    );
  }
}
notes.push(`store: ${MUTATORS.length} mutators, each appending an event, no delete or edit path`);

/* ── 4. Every status is reachable and worded ─────────────────────────────── */

const caseText = read('src/app/domain/cases/social-case.ts');
const unionStart = caseText.indexOf('export type CaseStatus');
const unionEnd = caseText.indexOf(';', unionStart);
const statuses =
  unionStart === -1
    ? []
    : [...caseText.slice(unionStart, unionEnd).matchAll(/'([a-z][a-z-]*)'/g)].map((m) => m[1]);

if (statuses.length === 0) {
  problems.push('Could not parse the `CaseStatus` union — the status checks are blind.');
}

const copyText = read('src/app/shared/cases/case.copy.ts');
const statusLabelStart = copyText.indexOf('statusLabel: {');
const statusLabelBlock =
  statusLabelStart === -1
    ? null
    : copyText.slice(statusLabelStart, copyText.indexOf('} satisfies', statusLabelStart));

const statusMaps = [
  ['CASE_STATUS_CATALOG', constBlock(caseText, 'CASE_STATUS_CATALOG')],
  ['CASE_STATUS_TRANSITIONS', constBlock(caseText, 'CASE_STATUS_TRANSITIONS')],
  ['CASE_TRANSITION_PERMISSIONS', constBlock(caseText, 'CASE_TRANSITION_PERMISSIONS')],
  ['case.copy.ts statusLabel', statusLabelBlock],
];

for (const [name, block] of statusMaps) {
  if (block === null) {
    problems.push(`\`${name}\` could not be found. A status map missing means silent drift.`);
    continue;
  }
  for (const status of statuses) {
    if (!new RegExp(`(^|[\\s{,])'?${status}'?\\s*:`, 'm').test(block)) {
      problems.push(
        `The case status \`${status}\` is missing from \`${name}\`. A status without a label, a ` +
          'legal move or a permission is a state the office can reach and nobody can explain.',
      );
    }
  }
}

// Closure stays terminal: reopening would make "when did this case end?" a
// question with several answers (DL-53).
const transitions = constBlock(caseText, 'CASE_STATUS_TRANSITIONS');
if (transitions !== null && !/closed:\s*\[\]/.test(transitions)) {
  problems.push(
    '`closed` is no longer terminal in CASE_STATUS_TRANSITIONS. A recurring situation is a new ' +
      'case that names the old one, not a revived file (DL-53).',
  );
}
notes.push(`statuses: ${statuses.length} states, each in 4 maps, closure still terminal`);

/* ── 5. Protected notes are withheld by the data layer ───────────────────── */

const noteText = read('src/app/domain/cases/case-note.ts');
if (!/export function discloseCaseNote/.test(noteText)) {
  problems.push(
    'case-note.ts no longer exports `discloseCaseNote`. Redaction happens in the data layer, not ' +
      'in a template: a screen must not be trusted to mask a field it was handed (DL-38).',
  );
}
if (!/readonly body:\s*string \| null/.test(noteText)) {
  problems.push(
    '`CaseNoteView.body` is no longer nullable. A withheld note has no body at all; a masked ' +
      'string still travels to the browser.',
  );
}

const workspaceText = read('src/app/domain/cases/case-workspace.ts');
if (!/readonly notes:\s*readonly CaseNoteView\[\]/.test(workspaceText)) {
  problems.push(
    '`CaseWorkspace.notes` no longer holds `CaseNoteView`. Handing a screen the unredacted ' +
      '`CaseNote` puts the protected tier one forgotten binding away from disclosure.',
  );
}

const adapterText = read('src/app/data/mock/mock-case.repository.ts');
if (!/discloseCaseNote\(/.test(adapterText)) {
  problems.push('mock-case.repository.ts no longer applies `discloseCaseNote` to case notes.');
}

// The unredacted type must not reach a screen. `CaseNoteView`, `CaseNoteId` and
// `CaseNoteSensitivity` are all fine; a bare `CaseNote` is not.
const BARE_CASE_NOTE = /\bCaseNote\b(?!View|Id|Sensitivity)/;
let scanned = 0;
for (const file of [
  ...walk('src/app/features', new Set(['.ts', '.html'])),
  ...walk('src/app/shared', new Set(['.ts', '.html'])),
]) {
  if (file.includes('.spec.')) continue;
  scanned += 1;
  const text = readFileSync(join(root, file), 'utf8');
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!BARE_CASE_NOTE.test(line)) continue;
    problems.push(
      `${file}:${index + 1} refers to the unredacted \`CaseNote\` type. Screens receive ` +
        '`CaseNoteView`, whose body is already gone when it is withheld (DL-38).',
    );
  }
}
notes.push(`disclosure: ${scanned} view files checked; none holds an unredacted case note`);

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nCase audit check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Case audit check passed.');
