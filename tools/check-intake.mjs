#!/usr/bin/env node
/**
 * Intake advisory audit.
 *
 * TAB 11's third acceptance criterion is that **no client is automatically
 * approved or denied by a simplistic frontend score**. That is a property of
 * the shape of the code, not something a comment can hold in place, so it is
 * enforced:
 *
 *   1. No decision-shaped field on the intake types — `eligible`, `score`,
 *      `decision`, `verdict`, `approved`, `denied`, `risk`, `rating`,
 *      `points`, `recommendation`. A field named like a decision becomes one.
 *   2. No blocking tone. `IntakeSignalTone` has exactly two values and neither
 *      of them stops a submission; a `block`, `blocked`, `refuse` or `deny`
 *      tone is an automatic denial wearing a different word.
 *   3. No scoring or deciding helper anywhere in `domain/intake/`.
 *   4. No auto-decision method on `AssistanceRequestRepository`.
 *   5. Every signal code is worded in the shared copy. Each map is sliced and
 *      searched on its own — searching the whole file lets a code deleted from
 *      one map pass because it survives in another (TAB 08's lesson).
 *   6. Every signal states its rule, its finding and the records it read, and
 *      the panel still renders all three plus the advisory sentence.
 *   7. Nothing disables a control from the readiness list or the advisory. A
 *      checklist that withholds the endorsement button is refusing an applicant
 *      by software.
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

const intakeFiles = walk('src/app/domain/intake', new Set(['.ts'])).filter(
  (file) => !file.includes('.spec.'),
);

if (intakeFiles.length === 0) {
  problems.push('No files found under domain/intake — this check is blind.');
}

/* ── 1. No decision-shaped field ─────────────────────────────────────────── */

const DECISION_FIELD =
  /^\s*readonly\s+(eligible|isEligible|entitled|qualifies|qualified|approved|isApproved|denied|isDenied|decision|verdict|score|points|rating|risk|riskLevel|recommendation|autoApproved)\b/;

/*
 * The one field a person is allowed to record.
 *
 * `AssessmentDraft.recommendation` is what the **social worker** advises, typed into a form by
 * them, and the API requires it: `POST .../assessment/complete` validates
 * `recommendation` as `required, in:Recommendation::values()`. Omitting it does not hold the
 * `DL-60` line — it drops the assessor's professional judgement from the office record while the
 * decision still gets made somewhere else.
 *
 * The doctrine this rule enforces is that **software** must not decide. A field a human fills in
 * is not that, and the backend's own enum says so in as many words: "A RECOMMENDATION IS NOT A
 * DECISION… A human with approval authority decides." Completing an assessment reaches `endorsed`
 * at most.
 *
 * So the carve-out is exactly one type and exactly one field, and rule 1b below closes the hole it
 * would otherwise open: nothing may *derive* a recommendation. A human may record one; no function
 * may return one.
 */
const RECORDED_BY_A_PERSON = new Map([
  ['src/app/domain/intake/assessment.ts', new Set(['recommendation'])],
]);

for (const file of intakeFiles) {
  const text = read(file);
  const allowed = RECORDED_BY_A_PERSON.get(file) ?? new Set();
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const found = DECISION_FIELD.exec(line);
    if (found !== null && !allowed.has(found[1])) {
      problems.push(
        `${file}:${index + 1} declares a decision-shaped field on an advisory type: ` +
          `"${line.trim().slice(0, 80)}". The duplicate check reports evidence; it decides nothing.`,
      );
    }
  }
}
notes.push(`advisory types: ${intakeFiles.length} files scanned for decision fields`);

/* ── 1b. Nothing derives a recommendation ────────────────────────────────── */

/*
 * The carve-out above says a person may record one. This says nothing may compute one.
 *
 * A function returning `AssessmentRecommendation` — from an advisory, a readiness list, a
 * vulnerability snapshot, an amount — is the frontend scoring engine TAB 11's third acceptance
 * criterion forbids, wearing the one field name that is now permitted to exist.
 */
const DERIVES_RECOMMENDATION = /\)\s*:\s*AssessmentRecommendation\b/;

for (const file of intakeFiles) {
  for (const [index, line] of read(file).split(/\r?\n/).entries()) {
    if (DERIVES_RECOMMENDATION.test(line)) {
      problems.push(
        `${file}:${index + 1} derives a recommendation: "${line.trim().slice(0, 80)}". ` +
          'An assessor records one; nothing computes one.',
      );
    }
  }
}
notes.push('derivation: no function returns a recommendation');

/* ── 2. No blocking tone ─────────────────────────────────────────────────── */

const advisoryText = read('src/app/domain/intake/intake-advisory.ts');
const toneMatch = /export type IntakeSignalTone =([^;]+);/.exec(advisoryText);

if (toneMatch === null) {
  problems.push('Could not parse `IntakeSignalTone` — the blocking-tone check is blind.');
} else {
  const tones = [...toneMatch[1].matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
  const FORBIDDEN = [
    'block',
    'blocked',
    'blocking',
    'refuse',
    'refused',
    'deny',
    'denied',
    'reject',
  ];
  for (const tone of tones) {
    if (FORBIDDEN.includes(tone)) {
      problems.push(
        `\`IntakeSignalTone\` includes '${tone}'. A tone that stops a submission is an automatic ` +
          'denial by another name, which TAB 11 forbids (DL-60). A caution asks for a sentence; ' +
          'it does not withhold the button.',
      );
    }
  }
  notes.push(`tones: ${tones.join(', ')} — none of them blocks`);
}

/* ── 3 & 4. No scoring, no auto-decision ─────────────────────────────────── */

const SCORING_FUNCTION =
  /export function\s+(score|rank|rate|decide|approve|deny|refuse|evaluateEligibility|autoApprove|screen)\w*/;

for (const file of intakeFiles) {
  const text = read(file);
  const match = SCORING_FUNCTION.exec(text);
  if (match) {
    problems.push(
      `${file} exports \`${match[1]}\`, which scores or decides. The advisory states what the ` +
        'records say and stops there.',
    );
  }
}

const portsText = read('src/app/domain/ports/repositories.ts');
const portStart = portsText.indexOf('export interface AssistanceRequestRepository');
const portEnd = portsText.indexOf('\n}', portStart);
if (portStart === -1 || portEnd === -1) {
  problems.push('Could not find `AssistanceRequestRepository` — this check is blind.');
} else {
  const port = portsText.slice(portStart, portEnd);
  for (const forbidden of [
    'autoApprove',
    'autoDecide',
    'decide',
    'scoreRequest',
    'screenRequest',
  ]) {
    if (new RegExp(`\\b${forbidden}\\s*\\(`).test(port)) {
      problems.push(
        `AssistanceRequestRepository declares \`${forbidden}\`. Approval is an act by a person ` +
          'holding `request.approve`, never a call the intake screen can make (DL-60).',
      );
    }
  }
  if (!/advisoryFor\s*\(/.test(port)) {
    problems.push('AssistanceRequestRepository no longer exposes `advisoryFor`.');
  }
  notes.push('port: advisory present, no auto-decision counterpart');
}

/* ── 5. Every signal code is worded ──────────────────────────────────────── */

const codesBlock = advisoryText.slice(
  advisoryText.indexOf('export const INTAKE_SIGNAL_CODES'),
  advisoryText.indexOf('];', advisoryText.indexOf('export const INTAKE_SIGNAL_CODES')),
);
const codes = [...codesBlock.matchAll(/'([a-z][a-z-]+)'/g)].map((m) => m[1]);

if (codes.length === 0) {
  problems.push('Could not parse INTAKE_SIGNAL_CODES — the wording check is blind.');
}

const copyText = read('src/app/shared/intake/intake.copy.ts');
const mapBlock = (name) => {
  const start = copyText.indexOf(`${name}: {`);
  if (start === -1) return null;
  const end = copyText.indexOf('} satisfies', start);
  return end === -1 ? null : copyText.slice(start, end);
};

const signalLabels = mapBlock('signalLabel');
if (signalLabels === null) {
  problems.push('intake.copy.ts no longer defines `signalLabel`.');
} else {
  for (const code of codes) {
    if (!new RegExp(`'${code}'\\s*:`).test(signalLabels)) {
      problems.push(
        `The signal \`${code}\` is missing from \`signalLabel\`. A duplicate warning shown as a ` +
          'bare identifier cannot be checked by the person it is about.',
      );
    }
  }
}
notes.push(`wording: ${codes.length} signal codes, each labelled`);

/* ── 6. Rule, finding, records — and the advisory sentence ───────────────── */

for (const field of ['rule', 'finding', 'references']) {
  if (!new RegExp(`readonly ${field}:`).test(advisoryText)) {
    problems.push(
      `\`IntakeSignal\` no longer declares \`${field}\`. A finding without its rule and its ` +
        'records is a verdict the reader has to take on trust.',
    );
  }
}

// Every constructed signal supplies all three, so none can ship half-stated.
const constructions = [...advisoryText.matchAll(/signals\.push\(\{([\s\S]*?)\}\);/g)];
if (constructions.length === 0) {
  problems.push('No signal constructions found in intake-advisory.ts — this check is blind.');
}
for (const [index, construction] of constructions.entries()) {
  for (const field of ['rule:', 'finding:', 'references:']) {
    if (!construction[1].includes(field)) {
      problems.push(`Signal construction ${index + 1} in intake-advisory.ts omits \`${field}\`.`);
    }
  }
}

if (!/advisory:\s*\n?\s*'[^']*does not approve, refuse, score or rank/i.test(copyText)) {
  problems.push(
    'intake.copy.ts no longer states that the check decides nothing. That sentence is the one a ' +
      'caseworker repeats when challenged; it must stay true and present.',
  );
}

const panelText = read('src/app/shared/intake/advisory-panel.ts');
for (const marker of ['copy.advisory', 'signal.rule', 'signal.finding', 'signal.references']) {
  if (!panelText.includes(marker)) {
    problems.push(
      `advisory-panel.ts no longer renders \`${marker}\`. Evidence held in a model and never ` +
        'shown is indistinguishable from a verdict.',
    );
  }
}
notes.push(
  `constructions: ${constructions.length} signals, each stating rule, finding and records`,
);

/* ── 7. Nothing is disabled by the advisory or the readiness list ────────── */

const templates = walk('src/app/features/requests', new Set(['.html']));
const DISABLED_BY_ADVICE =
  /\[disabled\]="[^"]*(advisory|readiness|cautionList|mustAcknowledge|signals)[^"]*"/;

for (const file of templates) {
  const text = read(file);
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (DISABLED_BY_ADVICE.test(line)) {
      problems.push(
        `${file}:${index + 1} disables a control from the advisory or the readiness list: ` +
          `"${line.trim().slice(0, 90)}". A checklist that withholds the button is refusing an ` +
          'applicant by software (DL-60). Ask for a reason instead.',
      );
    }
  }
}
notes.push(`templates: ${templates.length} checked; no control gated on advice`);

/* ── Report ──────────────────────────────────────────────────────────────── */

for (const note of notes) console.log(`  ${note}`);

if (problems.length > 0) {
  console.error(`\nIntake check FAILED (${problems.length}):`);
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exit(1);
}

console.log('Intake check passed.');
