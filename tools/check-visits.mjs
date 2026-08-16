#!/usr/bin/env node
/**
 * Field visit audit.
 *
 * TAB 16's acceptance criteria are that field work can be recorded without
 * exposing unnecessary location or sensitive data, that overdue follow-ups are
 * visible, and that notes distinguish source and type. The first is the one
 * that cannot be walked back once it is in a database, so most of this file is
 * about it:
 *
 *   1. **No location, anywhere.** No coordinate, no check-in, no route, no
 *      geofence, and no browser geolocation call. The master command forbids
 *      continuous tracking, covert tracking and geofencing of clients — all
 *      easy to refuse as features and easy to acquire as an innocuous field.
 *   2. **An observation says whose claim it is** (`DL-85`), and a third-party
 *      account names who said it.
 *   3. **Observations are append-only.** No edit, no delete.
 *   4. **Overdue is derived** from the scheduled date, never stored.
 *   5. **Every outcome is terminal.** A second attempt is a second visit.
 *   6. **A capture state never means "probably saved"** (`DL-87`), and a failed
 *      send says plainly that nothing was queued in the background.
 *   7. **The adapter checks permission and applies scope.**
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

const domainFiles = walk('src/app/domain/visits', new Set(['.ts'])).filter(
  (file) => !file.includes('.spec.'),
);
const viewFiles = walk('src/app/features/visits', new Set(['.ts', '.html'])).filter(
  (file) => !file.includes('.spec.'),
);
const dataFiles = [
  'src/app/data/mock/mock-field-visit.repository.ts',
  'src/app/data/mock/seed/field-visits.seed.ts',
].filter((file) => existsSync(join(root, file)));

if (domainFiles.length === 0) {
  problems.push('No visit domain files found. The model has moved or been removed.');
}

const visit = read('src/app/domain/visits/field-visit.ts');
const observation = read('src/app/domain/visits/visit-observation.ts');
const capture = read('src/app/domain/visits/visit-capture.ts');
const adapter = read('src/app/data/mock/mock-field-visit.repository.ts');
const port = read('src/app/domain/ports/repositories.ts');

const isComment = (line) => {
  const trimmed = line.trimStart();
  return trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*');
};

/* ── 1. No location, anywhere ────────────────────────────────────────────── */

// The field names a tracking feature arrives under. `addressVisited` is
// deliberately not among them: it is where the office went, which the household
// registry already holds, not where a worker was at a moment in time.
const LOCATION_FIELD =
  /\breadonly\s+(latitude|longitude|coordinates?|geo\w*|gpsAccuracy|checkedInAt|checkInAt|arrivedAt|departedAt|route|trackPoint\w*)\s*[?:]/i;

// Browser APIs that acquire a position, and the names a geofence goes by.
const LOCATION_CALL =
  /navigator\s*\.\s*geolocation|getCurrentPosition|watchPosition|\bgeofenc\w*|\btrackWorker\b|\bbreadcrumb\w*Location/i;

for (const file of [...domainFiles, ...viewFiles, ...dataFiles]) {
  const text = read(file);
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (isComment(line)) continue;
    if (LOCATION_FIELD.test(line) || LOCATION_CALL.test(line)) {
      problems.push(
        `${file}:${index + 1} captures a location. Field visits record what was found, not where a ` +
          'worker was. Continuous tracking, covert tracking and geofencing are forbidden (DL-86).',
      );
    }
  }
}

// The port must not grow one either.
const visitPortBlock =
  /export interface FieldVisitRepository\s*\{[\s\S]*?\n\}/.exec(port)?.[0] ?? '';
if (visitPortBlock === '') {
  problems.push('FieldVisitRepository has gone from the ports file.');
} else if (LOCATION_FIELD.test(visitPortBlock) || /location|position|coords/i.test(visitPortBlock)) {
  problems.push('FieldVisitRepository exposes a location. There must be no such method (DL-86).');
}
notes.push(`location: none in ${domainFiles.length + viewFiles.length + dataFiles.length} files`);

/* ── 2. An observation says whose claim it is ────────────────────────────── */

const kindUnion = /ObservationKind =\s*([^;]+);/.exec(observation)?.[1] ?? '';
const kinds = [...kindUnion.matchAll(/'([a-z-]+)'/g)].map((match) => match[1]);
for (const required of ['observed', 'client-said', 'third-party-said', 'worker-assessed']) {
  if (!kinds.includes(required)) {
    problems.push(
      `ObservationKind no longer distinguishes '${required}'. A fact, a report and a judgement ` +
        'written as one paragraph become indistinguishable, and are then read as established ' +
        'fact about a family (DL-85).',
    );
  }
}

const observationBlock =
  /export interface VisitObservation\s*\{[\s\S]*?\n\}/.exec(observation)?.[0] ?? '';
if (!/readonly kind: ObservationKind;/.test(observationBlock)) {
  problems.push('A visit observation no longer carries its kind.');
}

const validatorBody =
  /export function observationProblems[\s\S]*?\n\}/.exec(observation)?.[0] ?? '';
if (!/problems\.push\('attribution-required'\)/.test(validatorBody)) {
  problems.push(
    'observationProblems no longer requires an attribution on a third-party account. "A neighbour ' +
      'said" with no neighbour named is a rumour the office cannot check.',
  );
}

// The kind has to reach a screen, not merely exist.
const rendersKind = viewFiles.some(
  (file) => file.endsWith('.html') && /observationLabel|observations__kind/.test(read(file)),
);
if (!rendersKind) {
  problems.push(
    'No screen renders the observation kind. A distinction held and never shown is the same ' +
      'collapse it was written to prevent.',
  );
}
notes.push(`observation kinds: ${kinds.join(', ')} — rendered, and attribution enforced`);

/* ── 3. Observations are append-only ─────────────────────────────────────── */

const MUTATES = /\b(editObservation|updateObservation|deleteObservation|removeObservation)\b/;
for (const file of [...domainFiles, ...viewFiles, ...dataFiles]) {
  const text = read(file);
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (isComment(line)) continue;
    if (MUTATES.test(line)) {
      problems.push(
        `${file}:${index + 1} edits or removes an observation. A worker correcting an earlier one ` +
          'records another saying so (DL-85).',
      );
    }
  }
}
if (!/recordObservations\s*\(/.test(port)) {
  problems.push('The port no longer exposes recordObservations.');
}
notes.push('observations: appended, never edited or removed');

/* ── 4. Overdue is derived ───────────────────────────────────────────────── */

if (!/export function isVisitOverdue/.test(visit)) {
  problems.push('isVisitOverdue has gone. Overdue is derived from the scheduled date.');
}
const visitBlock = /export interface FieldVisit\s*\{[\s\S]*?\n\}/.exec(visit)?.[0] ?? '';
if (/readonly isOverdue\s*[?:]/.test(visitBlock)) {
  problems.push('A visit stores an overdue flag. It would be stale until a nightly job ran.');
}
notes.push('overdue: derived from the scheduled date, never stored');

/* ── 5. Every outcome is terminal ────────────────────────────────────────── */

const transitions = /VISIT_STATUS_TRANSITIONS[\s\S]*?\n\};/.exec(visit)?.[0] ?? '';
for (const terminal of ['completed', 'not-found', 'refused', 'cancelled']) {
  const key = terminal.includes('-') ? `'${terminal}'` : terminal;
  if (!new RegExp(`${key}:\\s*\\[\\]`).test(transitions)) {
    problems.push(
      `A ${terminal} visit can transition onward. A second attempt is a second visit, so ` +
        '"how many times did we go?" keeps one answer.',
    );
  }
}
notes.push('lifecycle: every outcome terminal');

/* ── 6. No capture state means "probably saved" ──────────────────────────── */

const captureUnion = /CaptureState =\s*([^;]+);/.exec(capture)?.[1] ?? '';
const states = [...captureUnion.matchAll(/'([a-z-]+)'/g)].map((match) => match[1]);
if (!states.includes('sent') || !states.includes('send-failed')) {
  problems.push('CaptureState no longer distinguishes sent from failed.');
}

// Scoped to the descriptions map. `CAPTURE_STATE_LABELS` has a `'send-failed'`
// key too, and it matches first — the check read the short label and reported
// the long description missing.
const descriptionsBlock =
  /export const CAPTURE_STATE_DESCRIPTIONS[\s\S]*?\n\};/.exec(capture)?.[0] ?? '';
const failedDescription =
  /'send-failed':\s*\n?\s*'([^']*)'/.exec(descriptionsBlock)?.[1] ?? '';
if (!/queued in the background/i.test(failedDescription)) {
  problems.push(
    'The failed-send description no longer says nothing was queued in the background. A worker ' +
      'who believes a visit was filed and returns to find it was not has been failed twice.',
  );
}
if (!/export function unsentWarning/.test(capture)) {
  problems.push('unsentWarning has gone. The warning must come from the domain, not a template.');
}
notes.push(`capture: ${states.join(', ')} — exactly one means the office record has it`);

/* ── 7. The adapter checks permission and scope ──────────────────────────── */

for (const method of ['list', 'mine', 'forResident', 'schedule', 'recordObservations', 'close']) {
  const body = new RegExp(`\\n  ${method}\\(([\\s\\S]*?)\\n  \\}`).exec(adapter)?.[1] ?? '';
  if (body === '') {
    problems.push(`MockFieldVisitRepository.${method} has gone.`);
    continue;
  }
  if (!/denyUnless|userHasPermission/.test(body)) {
    problems.push(`MockFieldVisitRepository.${method} does not check permission.`);
  }
}
if (!/isWithinBarangayScope/.test(adapter)) {
  problems.push('The visit adapter no longer applies barangay scope.');
}
notes.push('access: every read and write gated, scope applied');

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nVisit check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Visit check passed.');
