#!/usr/bin/env node
/**
 * Work queue, alert and notification audit.
 *
 * TAB 18's acceptance criteria are that a user can tell "FYI" from "action
 * required", that overdue work is obvious **without red-only signalling**, and
 * that tasks link to records. Each of those is a modelling rule before it is a
 * styling one, so this file checks the model:
 *
 *   1. **No delivery channel the LGU did not supply** (`DL-96`). No email, SMS,
 *      push or webhook. A channel that silently no-ops leaves an office
 *      believing a family was told to come on Tuesday.
 *   2. **Three surfaces, kept apart.** A work item has an owner and a due date;
 *      a notification has neither; an alert has no completion at all. Blur them
 *      and "is anything owed?" stops being answerable at a glance.
 *   3. **There is no second task system** (`DL-55`, `DL-97`). The work port is
 *      read-only; acting on an item goes to the repository that owns it.
 *   4. **Nothing about urgency is stored** (`DL-83`, `DL-88` restated). Urgency
 *      and lateness are derived from an explicit `asOf`.
 *   5. **Lateness is available as a sentence**, and the screens render it.
 *   6. **An alert gates nothing** — the fifth surface where a signal could
 *      quietly become a decision engine (`DL-42`, `DL-60`, `DL-78`, `DL-98`).
 *   7. **A queue is counted, never verdicted** (`DL-90` restated).
 *   8. **Every item names the permission to act**, and the adapter filters on
 *      it and on scope.
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

const domainFiles = walk('src/app/domain/work', new Set(['.ts'])).filter(
  (file) => !file.includes('.spec.'),
);
const viewFiles = walk('src/app/features/work', new Set(['.ts', '.html'])).filter(
  (file) => !file.includes('.spec.'),
);
const notificationFiles = [
  'src/app/domain/notifications/notification.ts',
  'src/app/core/notifications/notification.store.ts',
  'src/app/data/mock/mock-notification.repository.ts',
  'src/app/data/mock/seed/notifications.seed.ts',
].filter((file) => existsSync(join(root, file)));
const dataFiles = ['src/app/data/mock/mock-work.repository.ts'].filter((file) =>
  existsSync(join(root, file)),
);

if (domainFiles.length === 0) {
  problems.push('No work domain files found. The model has moved or been removed.');
}
if (viewFiles.length === 0) {
  problems.push('No work screens found. The feature has moved or been removed.');
}

const workItem = read('src/app/domain/work/work-item.ts');
const workQueue = read('src/app/domain/work/work-queue.ts');
const alert = read('src/app/domain/work/office-alert.ts');
const notification = read('src/app/domain/notifications/notification.ts');
const adapter = read('src/app/data/mock/mock-work.repository.ts');
const port = read('src/app/domain/ports/repositories.ts');

const isComment = (line) => {
  const trimmed = line.trimStart();
  return trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*');
};

/** The declaration a rule is about, so a match elsewhere in the file cannot pass it. */
const block = (text, pattern, what) => {
  const found = pattern.exec(text)?.[0] ?? '';
  if (found === '') problems.push(`${what} has gone.`);
  return found;
};

/* ── 1. No delivery channel the LGU did not supply ───────────────────────── */

// Names a send arrives under. `notify`/`notification` are deliberately absent:
// this application has an in-app inbox, and that is not a delivery channel.
const DELIVERY =
  /\b(sendEmail|mailer|smtp|sendgrid|mailgun|sendSms|smsGateway|twilio|semaphore|pushNotification|webPush|firebaseMessaging|messagingToken|fcmToken|apnsToken|serviceWorkerRegistration|webhookUrl)\b/i;

for (const file of [...domainFiles, ...viewFiles, ...notificationFiles, ...dataFiles]) {
  const text = read(file);
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (isComment(line)) continue;
    if (DELIVERY.test(line)) {
      problems.push(
        `${file}:${index + 1} introduces a delivery channel. The LGU supplied no mail relay, SMS ` +
          'gateway or push credentials, so this application cannot send anything and must not ' +
          'appear to. A channel that silently no-ops leaves an office believing a family was ' +
          'told to come on Tuesday (DL-96).',
      );
    }
  }
}

// Scoped to the union, not the file: the doc comment above it names every
// channel this application refuses, and a file-wide search would match those.
const channelUnion = /export type NotificationChannel =\s*([^;]+);/.exec(notification)?.[1] ?? '';
const channels = [...channelUnion.matchAll(/'([a-z-]+)'/g)].map((match) => match[1]);
if (channels.length === 0) {
  problems.push('NotificationChannel has gone.');
}
for (const channel of channels) {
  if (!['toast', 'inbox', 'both'].includes(channel)) {
    problems.push(
      `NotificationChannel gained '${channel}'. The only two surfaces are the toast stack and ` +
        'the in-app inbox (DL-96).',
    );
  }
}
notes.push(`channels: ${channels.join(', ')} — nothing is sent anywhere`);

/* ── 2. Three surfaces, kept apart ───────────────────────────────────────── */

const itemBlock = block(workItem, /export interface WorkItem\s*\{[\s\S]*?\n\}/, 'WorkItem');
for (const required of ['assignedTo', 'dueOn', 'permission']) {
  if (!new RegExp(`readonly ${required}\\??:`).test(itemBlock)) {
    problems.push(
      `WorkItem no longer carries ${required}. What separates work from a notification is that ` +
        'somebody owes it, by a date, and needs a grant to do it (DL-96).',
    );
  }
}

const alertBlock = block(alert, /export interface OfficeAlert\s*\{[\s\S]*?\n\}/, 'OfficeAlert');
for (const forbidden of ['dueOn', 'assignedTo', 'completedAt', 'resolvedAt', 'status', 'isDone']) {
  if (new RegExp(`readonly ${forbidden}\\??:`).test(alertBlock)) {
    problems.push(
      `OfficeAlert gained ${forbidden}. Nobody completes a data-quality alert — somebody fixes ` +
        'the record and it stops being true. Giving it a done state is how a data problem gets ' +
        'closed without being fixed (DL-98).',
    );
  }
}
if (!/readonly basis: string;/.test(alertBlock)) {
  problems.push(
    'OfficeAlert no longer states its basis. An alert nobody can check is one an office learns ' +
      'to dismiss.',
  );
}

// A notification is something that happened: it must not grow an owner or a date.
const notificationBlock = block(
  notification,
  /export interface AppNotification\s*\{[\s\S]*?\n\}/,
  'AppNotification',
);
for (const forbidden of ['dueOn', 'assignedTo', 'completedAt']) {
  if (new RegExp(`readonly ${forbidden}\\??:`).test(notificationBlock)) {
    problems.push(
      `AppNotification gained ${forbidden}. A notification is something that happened; something ` +
        'owed is a WorkItem. Blurring them is how a centre becomes noise (DL-96).',
    );
  }
}

// And the distinction has to be said on screen, not merely modelled.
const centreTemplate = 'src/app/features/work/notification-centre-page.html';
if (existsSync(join(root, centreTemplate))) {
  if (!/copy\.fyiNotice/.test(read(centreTemplate))) {
    problems.push(
      'The notification centre no longer says that nothing on it is a job. A user who has learnt ' +
        'to ignore a colour has not learnt to ignore a sentence.',
    );
  }
}

// A possible duplicate is a condition of the data, not somebody's job (`DL-103`).
const sourceUnion = /export type WorkSource =\s*([^;]+);/.exec(workItem)?.[1] ?? '';
if (/duplicate/i.test(sourceUnion)) {
  problems.push(
    'WorkSource lists duplicate review as work. It has no assignee and no date, and one row per ' +
      'candidate pair put 182 items in front of seven genuinely late ones. It is an alert with a ' +
      'count (DL-103).',
  );
}
notes.push('surfaces: work owes, notifications inform, alerts describe the data — all three apart');

/* ── 3. No second task system ────────────────────────────────────────────── */

const workPortBlock = block(
  port,
  /export interface WorkRepository\s*\{[\s\S]*?\n\}/,
  'WorkRepository',
);
const MUTATOR = /\b(complete|create|update|delete|assign|snooze|reschedule|dismiss|resolve)\w*\s*\(/i;
if (MUTATOR.test(workPortBlock)) {
  problems.push(
    'WorkRepository gained a mutator. A queue is a view of records that live elsewhere; a write ' +
      'here would be a second task system with a second audit trail, and "what does this office ' +
      'owe this family?" would have two answers again (DL-55, DL-97).',
  );
}
for (const method of ['myQueue', 'teamQueue', 'alerts']) {
  if (!new RegExp(`\\b${method}\\(`).test(workPortBlock)) {
    problems.push(`WorkRepository.${method} has gone.`);
  }
}

// The adapter must not grow one either.
const adapterMethods = [...adapter.matchAll(/\n  (?:private |protected )?(\w+)\s*\(/g)].map(
  (match) => match[1],
);
for (const method of adapterMethods) {
  if (/^(complete|createTask|updateTask|deleteWork|assignWork|snooze|resolveAlert|dismissAlert)/i.test(method)) {
    problems.push(`MockWorkRepository.${method} writes. The work adapter is read-only (DL-97).`);
  }
}

// And a screen acting on a task must go through the case repository.
const queuePage = 'src/app/features/work/work-queue-page.ts';
if (existsSync(join(root, queuePage))) {
  const text = read(queuePage);
  // Scoped to the calls, not to the token: renaming the import leaves the
  // identifier elsewhere in the file and a name-search reports clean.
  for (const call of ['completeTask', 'rescheduleTask']) {
    if (!text.includes(`this.cases.${call}(`)) {
      problems.push(
        `The work queue no longer calls CaseRepository.${call}. Every task mutation must carry a ` +
          'reason and append a case event in the same act (DL-54).',
      );
    }
  }
}
for (const required of ['assignTask', 'rescheduleTask', 'completeTask']) {
  const signature = new RegExp(`${required}\\([\\s\\S]{0,320}?reason: string`).test(port);
  if (!signature) {
    problems.push(`CaseRepository.${required} no longer requires a reason (DL-54, DL-99).`);
  }
}
notes.push('one task system: the port is read-only, and every task act carries a reason');

/* ── 4. Nothing about urgency is stored ──────────────────────────────────── */

for (const forbidden of ['urgency', 'isOverdue', 'isLate', 'daysLate']) {
  if (new RegExp(`readonly ${forbidden}\\??:`).test(itemBlock)) {
    problems.push(
      `WorkItem stores ${forbidden}. A stored flag needs a nightly job to stay true and is wrong ` +
        'every morning until it runs (DL-83, DL-88).',
    );
  }
}
const urgencyBody = block(workItem, /export function workUrgency[\s\S]*?\n\}/, 'workUrgency');
if (!/today/.test(urgencyBody)) {
  problems.push('workUrgency no longer computes against a supplied date.');
}
if (!/DUE_SOON_DAYS/.test(workItem)) {
  problems.push(
    'The due-soon window is no longer the case module’s. Two constants meaning "due soon" is ' +
      'precisely how two screens come to disagree.',
  );
}
if (/const DUE_SOON_DAYS\s*=/.test(workItem)) {
  problems.push('The work module declares its own due-soon window instead of importing one.');
}
notes.push('urgency: derived from an explicit asOf, sharing the case module’s window');

/* ── 5. Lateness is a sentence, and it reaches the screen ────────────────── */

const latenessBody = block(
  workItem,
  /export function describeLateness[\s\S]*?\n\}/,
  'describeLateness',
);
if (!/Late by/.test(latenessBody)) {
  problems.push(
    'describeLateness no longer says how late in words. Colour is not information: it fails a ' +
      'colour-blind officer, a monochrome printout and a screen reader alike, and the master ' +
      'command asks for overdue work to be obvious without red-only signalling (DL-102).',
  );
}
const waitingBody = block(workItem, /export function describeWaiting[\s\S]*?\n\}/, 'describeWaiting');
if (/late/i.test(waitingBody.replace(/^\s*[/*].*$/gm, ''))) {
  problems.push(
    'describeWaiting calls something late. Nothing can miss a target the office never set — the ' +
      'LGU supplied no service standards (DL-101).',
  );
}

// Checked per template, not across the set. `some()` passes while one screen
// still renders it and another has quietly stopped — the seventh instance of
// this suite's recurring false clean.
for (const file of viewFiles) {
  if (!file.endsWith('.html')) continue;
  const text = read(file);
  // Only templates that actually list work items are subject to the rule.
  if (!/work-rows__item|member__item/.test(text)) continue;
  if (!/\{\{ late \}\}/.test(text)) {
    problems.push(
      `${file} lists work without rendering the lateness sentence. Colour is not information: it ` +
        'fails a colour-blind officer, a monochrome printout and a screen reader alike (DL-102).',
    );
  }
}
// The heading has to be a word too, not a colour class alone.
const queueTemplate = 'src/app/features/work/work-queue-page.html';
if (existsSync(join(root, queueTemplate))) {
  const text = read(queueTemplate);
  if (!/\{\{ copy\.overdue \}\}/.test(text)) {
    problems.push(
      'The late bucket has no worded heading. A bucket identified only by a colour rule is one a ' +
        'screen reader cannot announce (DL-102).',
    );
  }
  if (!/\{\{ copy\.undatedHint \}\}/.test(text)) {
    problems.push(
      'The screen no longer says why undated work has no date. An officer would assume the ' +
        'system lost one (DL-101).',
    );
  }
}
notes.push('lateness: a sentence per row, a worded bucket heading, and a rule that is not colour');

/* ── 6. An alert gates nothing ───────────────────────────────────────────── */

const DECIDES = /\b(eligible|ineligible|approved|denied|blocking|mustResolve|preventsRelease|disqualif\w*|score)\b/i;
if (DECIDES.test(alertBlock)) {
  problems.push(
    'OfficeAlert carries a decision-shaped field. An alert surfaces evidence and refuses nobody — ' +
      'the fifth surface where a signal could quietly become a decision engine (DL-42, DL-60, ' +
      'DL-78, DL-98).',
  );
}
for (const file of viewFiles) {
  if (!file.endsWith('.html')) continue;
  const text = read(file);
  if (/\[disabled\]="[^"]*alert/i.test(text)) {
    problems.push(`${file} disables a control on an alert. An alert gates nothing (DL-98).`);
  }
}
notes.push('alerts: evidence with a stated basis, gating nothing');

/* ── 7. A queue is counted, never verdicted ──────────────────────────────── */

const describeBody = block(workQueue, /export function describeQueue[\s\S]*?\n\}/, 'describeQueue');
const VERDICT = /'(behind schedule|on track|complete|completed|healthy|at risk|good)[.']/i;
if (VERDICT.test(describeBody)) {
  problems.push(
    'describeQueue summarises a queue as a verdict. "3 late, 2 due today" is a sentence somebody ' +
      'can act on; "behind schedule" names nothing and hides how much (DL-90).',
  );
}
for (const counted of ['overdue', 'dueToday', 'dueSoon']) {
  if (!describeBody.includes(`buckets.${counted}`)) {
    problems.push(`describeQueue no longer reports ${counted}.`);
  }
}

const teamBody = block(workQueue, /export function buildTeamQueue[\s\S]*?\n^\}/m, 'buildTeamQueue');
if (!/export function buildTeamQueue\([\s\S]{0,400}?unassignedLabel: string,/.test(workQueue)) {
  problems.push(
    'buildTeamQueue no longer takes a label for unassigned work. Work nobody picked up is the ' +
      'office’s most common failure, and pooling it is how it stays that way.',
  );
}
if (!/staffId: key === '' \? null/.test(teamBody)) {
  problems.push('The team queue no longer separates unassigned work into its own group.');
}
notes.push('queues: counted, grouped by person, with unassigned as a column');

/* ── 8. Permission and scope ─────────────────────────────────────────────── */

for (const method of ['myQueue', 'teamQueue', 'alerts']) {
  const body = new RegExp(`\\n  ${method}\\(([\\s\\S]*?)\\n  \\}`).exec(adapter)?.[1] ?? '';
  if (body === '') {
    problems.push(`MockWorkRepository.${method} has gone.`);
    continue;
  }
  if (!/denyUnless|userHasPermission/.test(body)) {
    problems.push(`MockWorkRepository.${method} does not check permission.`);
  }
}
if (!/'staff\.view'/.test(adapter)) {
  problems.push(
    'The team queue is no longer behind staff.view. Seeing a colleague’s caseload is supervision, ' +
      'not a default.',
  );
}

const visibleBody =
  /private visibleWork\([\s\S]*?\n  \}/.exec(adapter)?.[0] ?? '';
if (visibleBody === '') {
  problems.push('MockWorkRepository.visibleWork has gone.');
} else if (!/userHasPermission\s*\(user, item\s*\.\s*permission\)/.test(visibleBody)) {
  problems.push(
    'The queue no longer drops work this user could not act on. Showing an intake officer a ' +
      'payout is how a queue becomes something people scroll past.',
  );
}
// One producer per source, each of which must scope. A file-wide search for
// the helper passes on the surviving import alone — the same false clean this
// suite has now produced six times.
for (const producer of ['caseTaskWork', 'requestWork', 'visitWork', 'referralWork', 'releaseWork']) {
  const body =
    new RegExp('private ' + producer + '\\([\\s\\S]*?\\n  \\}').exec(adapter)?.[0] ?? '';
  if (body === '') {
    problems.push(`MockWorkRepository.${producer} has gone.`);
  } else if (!/isWithinBarangayScope\(/.test(body)) {
    problems.push(
      `MockWorkRepository.${producer} no longer applies barangay scope. A barangay-link account ` +
        'would read work across the whole municipality.',
    );
  }
}

// The notification adapter had none of this before TAB 18 (`DL-100`).
const notificationAdapter = read('src/app/data/mock/mock-notification.repository.ts');
const listBody =
  /listForCurrentUser\(\)[\s\S]*?\n  \}/.exec(notificationAdapter)?.[0] ?? '';
if (listBody === '') {
  problems.push('MockNotificationRepository.listForCurrentUser has gone.');
} else if (!/isForRecipient/.test(listBody)) {
  problems.push(
    'listForCurrentUser does not filter by recipient. It is named for the current user and for a ' +
      'long time did not know who that was, so every account read the MSWDO head’s inbox ' +
      '(DL-100).',
  );
}
notes.push('access: queues filtered by permission and scope, notifications by recipient');

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nWork check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Work check passed.');
