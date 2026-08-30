#!/usr/bin/env node
/**
 * Requirements and documents audit.
 *
 * TAB 14's three acceptance criteria are that document status is visually and
 * semantically clear, that **replacing a file does not erase history**, and that
 * sensitive file actions are permission-aware. Each is a property of the shape
 * of the code, so each is enforced here:
 *
 *   1. **Nothing removes a version.** No delete, no splice, no overwrite of a
 *      document's `versions` anywhere in the domain, the adapters or the views.
 *      The superseded copy is the evidence of what the office saw when it
 *      decided, and an overwriting model makes that permanently unanswerable.
 *   2. **A replacement carries a reason**, and the domain refuses one without.
 *   3. **Completion is never a verdict.** No decision-shaped field on the
 *      completion summary, and the sentence stating the boundary is still
 *      rendered — TAB 14 is the fourth surface where a checklist could quietly
 *      become an eligibility engine (`DL-42`, `DL-60`, `DL-66`, `DL-78`).
 *   4. **Document numbers are masked by default.** No template renders a raw
 *      `documentNumber`; `maskDocumentNumber` is the sanctioned path.
 *   5. **Opening a file is permission-gated and warned.** The port exposes an
 *      access grant rather than a URL, and the adapter checks
 *      `document.download`.
 *   6. **A conditional document is ruled on by a person** (`DL-76`). No
 *      automatic evaluation of `appliesWhen`, and the ruling takes a reason.
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

const domainFiles = walk('src/app/domain/requirements', new Set(['.ts'])).filter(
  (file) => !file.includes('.spec.'),
);
const dataFiles = [
  'src/app/data/mock/mock-assistance-request.repository.ts',
  'src/app/data/http/http-repositories.ts',
].filter((file) => existsSync(join(root, file)));
const viewFiles = [
  ...walk('src/app/features/requests', new Set(['.ts', '.html'])),
  ...walk('src/app/shared/requirements', new Set(['.ts', '.html'])),
].filter((file) => !file.includes('.spec.'));

if (domainFiles.length === 0) {
  problems.push('No requirement domain files found. The document model has moved or been removed.');
}

const isComment = (line) => {
  const trimmed = line.trimStart();
  return trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*');
};

/* ── 1. Nothing removes a version ────────────────────────────────────────── */

// `filter` on versions is how an overwrite disguises itself: keep the ones you
// like, drop the rest. `supersededVersions` legitimately filters for display,
// so it is named and excluded rather than the rule being weakened.
const REMOVES_A_VERSION =
  /versions\s*\.\s*(splice|pop|shift)\b|versions\s*=\s*\[\s*[^.\]]*\]\s*;|\.versions\s*\.\s*filter\(/;

for (const file of [...domainFiles, ...dataFiles, ...viewFiles]) {
  const text = read(file);
  // `supersededVersions` filters for display and removes nothing. Excluded by
  // *scope* rather than by line: the first version of this check skipped only
  // the `export function` line and then flagged the filter on the line below it.
  let inReadOnlyHelper = false;

  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (/^export function supersededVersions/.test(line)) {
      inReadOnlyHelper = true;
    } else if (inReadOnlyHelper && /^\}/.test(line)) {
      inReadOnlyHelper = false;
    }
    if (isComment(line) || inReadOnlyHelper) continue;
    if (REMOVES_A_VERSION.test(line)) {
      problems.push(
        `${file}:${index + 1} drops or replaces a document's versions. Replacing a document appends; ` +
          'the superseded copy is what the office actually read when it decided (DL-77).',
      );
    }
  }
}

const DELETES = /\b(deleteDocument|removeDocument|purgeDocument|replaceVersion|deleteVersion)\b/;
for (const file of [...domainFiles, ...dataFiles, ...viewFiles]) {
  const text = read(file);
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (isComment(line)) continue;
    if (DELETES.test(line)) {
      problems.push(`${file}:${index + 1} deletes or replaces a document version (DL-77).`);
    }
  }
}

const port = read('src/app/domain/ports/repositories.ts');
if (!/recordDocument\s*\(/.test(port)) {
  problems.push('AssistanceRequestRepository no longer exposes recordDocument.');
}
if (/\b(deleteDocument|replaceDocument)\s*\(/.test(port)) {
  problems.push('The port has grown a delete or replace for documents. There must not be one.');
}
notes.push('history: nothing removes a version in domain, data or views');

/* ── 2. A replacement carries a reason ───────────────────────────────────── */

const documentModel = read('src/app/domain/requirements/requirement-document.ts');

// Scoped to the validator's body, not the file. The problem code also appears
// in the `DocumentProblem` union, and an earlier version of this check passed
// while the rule that raises it had been commented out.
const validatorBody =
  /export function documentVersionProblems[\s\S]*?\n\}/.exec(documentModel)?.[0] ?? '';
if (validatorBody === '') {
  problems.push('documentVersionProblems has gone from requirement-document.ts.');
}
if (!/problems\s*\.\s*push\s*\('replacement-needs-a-reason'\)/.test(validatorBody)) {
  problems.push(
    'documentVersionProblems no longer refuses an unexplained replacement. A superseded version ' +
      'nobody accounted for is a gap in the record of a decision (DL-77).',
  );
}
if (!/readonly supersededReason: string \| null;/.test(documentModel)) {
  problems.push('A document version no longer records why it was replaced.');
}
notes.push('replacement: refused without a reason, and the reason is kept on the version');

/* ── 3. Completion counts; it never decides ──────────────────────────────── */

const completion = read('src/app/domain/requirements/requirement-completion.ts');
const DECISION_SHAPED =
  /readonly\s+(isComplete|isEligible|canApprove|approved|passed|qualifies|score|percentage)\s*[?:]/;
if (DECISION_SHAPED.test(completion)) {
  problems.push(
    'RequirementCompletion has grown a decision-shaped field. A complete checklist looks like a ' +
      'green light, which is exactly why it must not carry one (DL-78).',
  );
}
if (!/still a caseworker/.test(completion)) {
  problems.push(
    'describeCompletion no longer says eligibility remains a caseworker’s decision. That sentence ' +
      'is the boundary; without it the counts read as approval.',
  );
}

// The sentence has to reach a screen, not merely exist.
const rendersHint = viewFiles.some(
  (file) => file.endsWith('.html') && /completionHint|completion__hint/.test(read(file)),
);
if (!rendersHint) {
  problems.push(
    'No screen renders the completion boundary sentence. A rule held and never shown is the same ' +
      'omission it was written to prevent.',
  );
}
notes.push('completion: counts only, and the boundary sentence is rendered');

/* ── 4. Document numbers are masked ──────────────────────────────────────── */

if (!/export function maskDocumentNumber/.test(documentModel)) {
  problems.push('maskDocumentNumber has gone. It is the sanctioned way to show a number.');
}

const RAW_NUMBER = /\{\{[^}]*\.documentNumber(?!\s*\|)/;
for (const file of viewFiles.filter((file) => file.endsWith('.html'))) {
  const text = read(file);
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (RAW_NUMBER.test(line)) {
      problems.push(
        `${file}:${index + 1} renders a raw document number. Mask it — four characters is enough to ` +
          'confirm the right paper, and not enough to reconstruct an identifier.',
      );
    }
  }
}

// The panel component is the one place a number reaches a screen.
const panel = read('src/app/shared/requirements/document-panel.ts');
if (!/maskDocumentNumber/.test(panel)) {
  problems.push('The document panel no longer masks the number it displays.');
}
if (/\{\{\s*version\.documentNumber\s*\}\}/.test(panel)) {
  problems.push('The document panel renders the number unmasked.');
}
notes.push('masking: no raw document number reaches a template');

/* ── 5. Opening a file is gated and warned ───────────────────────────────── */

if (!/openDocument\s*\(/.test(port)) {
  problems.push('The port no longer exposes openDocument.');
}
if (/readonly (url|downloadUrl|href)\s*[?:]/.test(documentModel)) {
  problems.push(
    'A document version carries a URL. Opening a file is a request the data layer can refuse; a ' +
      'model holding a link is one copy-paste from an unauthorised download.',
  );
}

const adapter = read('src/app/data/mock/mock-assistance-request.repository.ts');
if (!/denyUnless<DocumentAccessGrant>\(user, 'document\.download'\)/.test(adapter)) {
  problems.push('openDocument is not gated on document.download in the mock adapter.');
}
if (!/warning:/.test(adapter)) {
  problems.push('The access grant carries no warning for the screen to show before opening.');
}

const permissions = read('src/app/domain/access/permission.ts');
for (const permission of ['document.record', 'document.download', 'document.view-full-number']) {
  if (!permissions.includes(`'${permission}'`)) {
    problems.push(`The permission ${permission} has gone from the vocabulary.`);
  }
}

// Reading the checklist must not carry the right to pull the scans.
const intakeBlock = /const INTAKE_PERMISSIONS[\s\S]*?\n\];/.exec(permissions)?.[0] ?? '';
if (intakeBlock.includes("'document.download'")) {
  problems.push(
    'Intake now holds document.download. Recording what was presented and pulling the file itself ' +
      'are different disclosures, and the counter needs only the first.',
  );
}
notes.push('access: a grant not a URL, gated on document.download, warned before opening');

/* ── 6. A person rules on a conditional document ─────────────────────────── */

const obligation = read('src/app/domain/requirements/requirement-obligation.ts');

// Scoped to the union. `'undecided'` also appears in comparisons further down,
// so a file-wide search would pass with the state removed from the type.
const applicabilityUnion =
  /ConditionalApplicability =\s*([^;]+);/.exec(obligation)?.[1] ?? '';
if (!/'undecided'/.test(applicabilityUnion)) {
  problems.push(
    'ConditionalApplicability no longer has an undecided state. Assuming a conditional document ' +
      'does or does not apply is the software deciding somebody’s circumstances (DL-76).',
  );
}

// Evaluating the stated condition is exactly what this must never do.
const EVALUATES = /\b(evaluateAppliesWhen|matchesCondition|autoApplicability|inferApplicability)\b/;
for (const file of [...domainFiles, ...dataFiles]) {
  if (EVALUATES.test(read(file))) {
    problems.push(`${file} evaluates a stated condition. The office states it; a person rules on it.`);
  }
}
if (!/decideApplicability\s*\(\s*\n?[^)]*reason: string/s.test(port)) {
  problems.push('decideApplicability no longer requires a reason.');
}

const obligations = /RequirementObligation =\s*([^;]+);/.exec(obligation)?.[1] ?? '';
const kinds = [...obligations.matchAll(/'([a-z-]+)'/g)].map((match) => match[1]);
if (kinds.length !== 3) {
  problems.push(
    `RequirementObligation has ${kinds.length} kinds rather than three (${kinds.join(', ')}).`,
  );
}
notes.push(`obligation: ${kinds.join(', ')} — the condition is stated, never evaluated`);

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nDocument check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Document check passed.');
