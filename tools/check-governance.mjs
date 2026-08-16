#!/usr/bin/env node
/**
 * User management, audit trail and data governance audit.
 *
 * TAB 21's acceptance criteria are that sensitive actions have distinct
 * permissions, that a deactivated user loses their affordances, and that the
 * audit UI is readable and filterable without displaying excessive PII.
 *
 *   1. **An audit row cannot quote what changed** (`DL-114`). The values are
 *      not on the row, so no template can render one; they are a separate read
 *      behind `audit.view-detail`.
 *   2. **Deactivation ends a live session** (`DL-116`), not merely the next
 *      sign-in.
 *   3. **There is no invite or reset flow** (`DL-32` restated), and the screens
 *      say so rather than offering a form that goes nowhere.
 *   4. **Retention invents nothing** (`DL-113`). No schedule was supplied, so
 *      every period is null and the screen says "no schedule recorded".
 *   5. **A correction is answered with a reason**, and answers are terminal
 *      (`DL-117`).
 *   6. **The matrix is readable without sight** — every cell says holds or does
 *      not hold in words.
 *   7. **The adapter checks permission**, per act.
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

const domainFiles = walk('src/app/domain/governance', new Set(['.ts'])).filter(
  (file) => !file.includes('.spec.'),
);
const viewFiles = walk('src/app/features/administration', new Set(['.ts', '.html'])).filter(
  (file) => !file.includes('.spec.'),
);

if (domainFiles.length === 0) {
  problems.push('No governance domain files found. The model has moved or been removed.');
}
if (viewFiles.length === 0) {
  problems.push('No administration screens found. The feature has moved or been removed.');
}

const auditView = read('src/app/domain/governance/audit-view.ts');
const retention = read('src/app/domain/governance/retention.ts');
const correction = read('src/app/domain/governance/correction-request.ts');
const profile = read('src/app/domain/governance/staff-profile.ts');
const classification = read('src/app/domain/governance/data-classification.ts');
const adapter = read('src/app/data/mock/mock-governance.repository.ts');
const staffAdapter = read('src/app/data/mock/mock-staff.repository.ts');
const port = read('src/app/domain/ports/repositories.ts');
const permissions = read('src/app/domain/access/permission.ts');
const matrix = read('src/app/domain/access/permission-matrix.ts');

/** Joins adjacent string literals before searching prose. */
const prose = (text) => text.replace(/'\s*\+\s*'/g, '');

/** The declaration a rule is about, so a match elsewhere in the file cannot pass it. */
const block = (text, pattern, what) => {
  const found = pattern.exec(text)?.[0] ?? '';
  if (found === '') problems.push(`${what} has gone.`);
  return found;
};

/* ── 1. An audit row cannot quote what changed ───────────────────────────── */

const rowBlock = block(auditView, /export interface AuditRow\s*\{[\s\S]*?\n\}/, 'AuditRow');
const VALUE_FIELDS = ['before', 'after', 'oldValue', 'newValue', 'values', 'changes', 'detail'];
for (const field of VALUE_FIELDS) {
  if (new RegExp(`readonly ${field}[?]?:`).test(rowBlock)) {
    problems.push(
      `AuditRow gained ${field}. An audit list is the one screen designed to be scrolled and ` +
        'filtered by somebody reviewing other people’s work; a row that quotes what changed ' +
        'discloses it to every reviewer who filters by date (DL-114).',
    );
  }
}
if (!/readonly changedFields: readonly AuditFieldChange\[\];/.test(rowBlock)) {
  problems.push('AuditRow no longer names the fields that moved.');
}

// The field-change shape must name without quoting.
const fieldBlock = block(
  auditView,
  /export interface AuditFieldChange\s*\{[\s\S]*?\n\}/,
  'AuditFieldChange',
);
for (const field of ['before', 'after', 'value']) {
  if (new RegExp(`readonly ${field}[?]?:`).test(fieldBlock)) {
    problems.push(`AuditFieldChange gained ${field}. It names a field; it does not quote one.`);
  }
}

// The conversion has no parameter that could carry a value.
const toRowBody = block(auditView, /export function toAuditRow[\s\S]*?\n\}/, 'toAuditRow');
for (const field of ['before', 'after', 'values']) {
  if (new RegExp(`\\b${field}\\b`).test(toRowBody)) {
    problems.push(`toAuditRow handles ${field}. The row is composed without values (DL-114).`);
  }
}

// And the port keeps them apart.
const govPortBlock = block(
  port,
  /export interface GovernanceRepository\s*\{[\s\S]*?\n\}/,
  'GovernanceRepository',
);
if (!/auditDetail\(/.test(govPortBlock)) {
  problems.push('GovernanceRepository no longer separates the recorded values from the rows.');
}
if (/auditRows\([^)]*(include|expand|withValues|detail)/i.test(govPortBlock)) {
  problems.push(
    'auditRows takes a parameter that could inline the values. The split is in the shape, not in ' +
      'what a caller remembers to ask for (DL-114).',
  );
}
notes.push('audit rows: fields named, values held apart behind their own read');

/* ── 2. Sensitive actions have distinct permissions ──────────────────────── */

// Scoped to the union, not the file: the auditor's role grant names the same
// permission, and a file-wide search passes while the permission itself is gone.
const permissionUnion = block(
  permissions,
  /export const PERMISSIONS = \[[\s\S]*?\n\] as const;/,
  'PERMISSIONS',
);
if (!/'audit\.view-detail'/.test(permissionUnion)) {
  problems.push(
    'audit.view-detail has gone from PERMISSIONS. Reading that a record changed is oversight; ' +
      'reading what it changed to is access to the record (DL-114).',
  );
}
const readOnlyBlock = block(
  matrix,
  /export const READ_ONLY_PERMISSIONS[\s\S]*?\n\);/,
  'READ_ONLY_PERMISSIONS',
);
if (!/audit\.view-detail/.test(readOnlyBlock)) {
  problems.push(
    'audit.view-detail is no longer classified read-only, so the auditor stops being a read-only ' +
      'role. Same catch as document.download in TAB 14.',
  );
}

const detailBody = /\n  auditDetail\(([\s\S]*?)\n  \}/.exec(adapter)?.[1] ?? '';
if (detailBody === '') {
  problems.push('MockGovernanceRepository.auditDetail has gone.');
} else if (!/'audit\.view-detail'/.test(detailBody)) {
  problems.push('Opening recorded values no longer requires audit.view-detail.');
}
notes.push('permissions: reading the trail and reading its values are separate grants');

/* ── 3. Deactivation ends a live session ─────────────────────────────────── */

if (!/export function canHoldSession/.test(profile)) {
  problems.push('canHoldSession has gone. Both adapters would answer deactivation differently.');
}
const currentUserBody =
  /currentUser\(\): Observable<AuthenticatedUser \| null> \{[\s\S]*?\n  \}/.exec(
    staffAdapter,
  )?.[0] ?? '';
if (currentUserBody === '') {
  problems.push('MockStaffRepository.currentUser has gone.');
} else if (!/canHoldSession\(/.test(currentUserBody)) {
  problems.push(
    'currentUser no longer checks whether the account may hold a session. Before TAB 21 a ' +
      'deactivated account kept every grant until the person happened to sign out, while signIn ' +
      'refused them — the office believed the account was off (DL-116).',
  );
}
const signInBody = /signIn\(credentials: SignInCredentials\)[\s\S]*?\n  \}/.exec(staffAdapter)?.[0] ?? '';
if (signInBody !== '' && !/canHoldSession\(/.test(signInBody)) {
  problems.push('signIn no longer uses the shared rule, so the two paths can drift.');
}
notes.push('deactivation: takes effect on the next request, not at next sign-in');

/* ── 4. There is no invite or reset flow ─────────────────────────────────── */

if (/\b(invite|provision|resetAccess|resetPassword|register)\w*\s*\(/i.test(govPortBlock)) {
  problems.push(
    'GovernanceRepository gained a provisioning method. Accounts are created by an administrator ' +
      'outside this console, and a half-built invite flow is worse than none — an administrator ' +
      'who fills one in reasonably believes an account now exists (DL-32).',
  );
}
for (const file of viewFiles) {
  if (!file.endsWith('.html')) continue;
  const text = read(file);
  if (/<form/.test(text)) {
    problems.push(
      `${file} contains a form. The administration screens capture a reason inline; a form here ` +
        'would be a provisioning or correction flow that goes nowhere.',
    );
  }
}
if (!/PROVISIONING_IS_NOT_BUILT/.test(prose(profile))) {
  problems.push('The screens no longer say that accounts cannot be created here.');
}
const saysNotBuilt = viewFiles.some(
  (file) => file.endsWith('.html') && /provisioningNotice/.test(read(file)),
);
if (!saysNotBuilt) {
  problems.push(
    'No screen states that provisioning is not built. A disabled button implies "later"; a ' +
      'sentence says "not here".',
  );
}
notes.push('provisioning: absent, and said to be absent');

/* ── 5. Retention invents nothing ────────────────────────────────────────── */

const rulesBlock = block(
  retention,
  /export const RETENTION_RULES: readonly RetentionRule\[\][\s\S]*?\n\}\)\);/,
  'RETENTION_RULES',
);
if (!/periodInYears: null/.test(rulesBlock)) {
  problems.push(
    'A retention period was invented. No records disposition schedule was supplied, and an office ' +
      'that believes it may delete after five years, and does, cannot undo it (DL-113).',
  );
}
if (!/awaiting-office-policy/.test(rulesBlock)) {
  problems.push('Retention rules no longer record that they are awaiting an office schedule.');
}
const describeBody = block(
  retention,
  /export function describeRetention[\s\S]*?\n\}/,
  'describeRetention',
);
if (!/RETENTION_UNSET_DISPLAY/.test(describeBody)) {
  problems.push('An unset retention period is no longer said in words.');
}
const retentionNoticeBlock = block(
  retention,
  /export const RETENTION_NOTICE[\s\S]*?;[ \t]*(?:\r?\n)/,
  'RETENTION_NOTICE',
);
if (!/RA 9470/.test(prose(retentionNoticeBlock))) {
  problems.push(
    'The retention notice no longer cites RA 9470, the statute that governs disposition ' +
      'schedules. The module doc comment says it too, which is why this is scoped to the notice ' +
      'an officer actually reads.',
  );
}
notes.push('retention: every period null, awaiting an office schedule, said on screen');

/* ── 6. A correction is answered with a reason, and answers are terminal ─── */

const correctionProblemsBody = block(
  correction,
  /export function correctionProblems[\s\S]*?\n\}/,
  'correctionProblems',
);
if (!/'outcome-required'/.test(correctionProblemsBody)) {
  problems.push(
    'A correction can be answered without a reason. A refusal with no reason is the one a ' +
      'resident cannot challenge (DL-117).',
  );
}
const transitionsBlock = block(
  correction,
  /export const CORRECTION_TRANSITIONS[\s\S]*?\n  \};/,
  'CORRECTION_TRANSITIONS',
);
for (const terminal of ['applied', 'refused', 'withdrawn']) {
  if (!new RegExp(`${terminal}: \\[\\]`).test(transitionsBlock)) {
    problems.push(
      `A ${terminal} correction can move on. An answered request stays answered; a disagreement ` +
        'is a new request naming the old one (DL-53 restated).',
    );
  }
}
notes.push('corrections: answered with a reason, and terminal once answered');

/* ── 7. The matrix is readable without sight ─────────────────────────────── */

const rolesTemplate = 'src/app/features/administration/roles-page.html';
if (existsSync(join(root, rolesTemplate))) {
  const text = read(rolesTemplate);
  if (!/visually-hidden/.test(text) || !/copy\.holds/.test(text)) {
    problems.push(
      'The permission matrix conveys a grant with a mark alone. This is the reference an office ' +
        'consults when somebody asks why they cannot do something, and a tick with no text is ' +
        'unreadable to assistive technology.',
    );
  }
  if (!/<table/.test(text)) {
    problems.push('The permission matrix is no longer a real table.');
  }
}

// Classification labels are cited, not asserted.
const basisBlock = block(
  classification,
  /export const CLASSIFICATION_BASIS[\s\S]*?\n\};/,
  'CLASSIFICATION_BASIS',
);
for (const [, label, text] of prose(basisBlock).matchAll(
  /'?([a-z-]+)'?:\s*\n?\s*'([^']*)'/g,
)) {
  // Checked per entry. Four siblings keeping the citation while one loses it is
  // exactly what a block-wide search reports as clean.
  if (!/RA \d+/.test(text)) {
    problems.push(
      `The '${label}' classification no longer cites a statute. A label an office cannot point ` +
        'at a section for is one it cannot defend to a data protection officer.',
    );
  }
}
notes.push('matrix: a real table, every cell spoken; classifications cited');

/* ── 8. The adapter checks permission ────────────────────────────────────── */

for (const method of [
  'accounts',
  'accountById',
  'setAccountActive',
  'auditRows',
  'auditDetail',
  'classifications',
  'retention',
  'corrections',
]) {
  const body =
    new RegExp('\\n  ' + method + '\\(([\\s\\S]*?)\\n  \\}').exec(adapter)?.[1] ?? '';
  if (body === '') {
    problems.push(`MockGovernanceRepository.${method} has gone.`);
    continue;
  }
  if (!/denyUnless|userHasPermission/.test(body)) {
    problems.push(`MockGovernanceRepository.${method} does not check permission.`);
  }
}
const setActiveBody =
  new RegExp('\\n  setAccountActive\\(([\\s\\S]*?)\\n  \\}').exec(adapter)?.[1] ?? '';
if (setActiveBody !== '') {
  if (!/reason\.trim\(\)\.length === 0/.test(setActiveBody)) {
    problems.push(
      'Turning an account on or off no longer requires a reason. Every mutation in this ' +
        'application carries one (DL-54).',
    );
  }
  if (!/staff\.id === user\?\.id/.test(setActiveBody)) {
    problems.push(
      'An administrator can deactivate the account they are signed in as, and cannot undo it ' +
        'from here.',
    );
  }
}
notes.push('access: every governance read and the one write are gated');

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nGovernance check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Governance check passed.');
