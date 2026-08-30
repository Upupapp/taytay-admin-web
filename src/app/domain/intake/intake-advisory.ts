import type { AssistanceRequestStatus } from '../assistance/assistance-request';
import { isTerminalAssistanceStatus } from '../assistance/assistance-request';
import { asIsoDateTime } from '../shared/ids';
import type {
  AssistanceRequestId,
  HouseholdId,
  IsoDate,
  IsoDateTime,
  ProgramId,
  ResidentId,
  StaffUserId,
} from '../shared/ids';
import { addMoney, ZERO_PESOS, type Money } from '../shared/money';

/**
 * Duplicate and previous-assistance signals.
 *
 * **Nothing here decides anything** (`DL-60`). TAB 11's third acceptance
 * criterion is that no client is automatically approved or denied by a
 * simplistic frontend score, and that is a property of this file rather than a
 * promise made about it: there is no total, no score, no rating, no
 * `eligible` and no `recommendation`. A signal states the rule it applied, what
 * it found, and which records it read — three facts a caseworker can check and
 * overrule — and then stops.
 *
 * `tools/check-intake.mjs` fails the build if a decision-shaped field, a
 * blocking tone or a scoring helper appears here, on the same argument that
 * keeps `VulnerabilitySnapshot` advisory (`DL-42`).
 */
export type IntakeSignalCode =
  | 'open-request-same-programme'
  | 'open-request-other-programme'
  | 'granted-same-programme-recently'
  | 'assistance-within-lookback'
  | 'household-assisted-recently'
  | 'open-case';

export const INTAKE_SIGNAL_CODES: readonly IntakeSignalCode[] = [
  'open-request-same-programme',
  'open-request-other-programme',
  'granted-same-programme-recently',
  'assistance-within-lookback',
  'household-assisted-recently',
  'open-case',
];

/**
 * How loudly a signal speaks. There are two levels and neither of them is
 * "blocked".
 *
 * `note` is context worth reading. `caution` is context the office should not
 * pass over silently, so submission asks for an acknowledgement and a reason —
 * which is a prompt to a person, not a refusal by the software. A third level
 * that stopped the submission would be an automatic denial wearing a different
 * word, and the criterion forbids it.
 */
export type IntakeSignalTone = 'note' | 'caution';

/**
 * Both tones, and there will never be a third that blocks.
 *
 * A caution asks the encoder for a sentence before filing and the sentence is kept; neither tone
 * refuses anybody (`DL-60`). `check:intake` fails the build on a blocking tone, and this list is
 * what a mapper checks an incoming tone against — an unrecognised one is dropped rather than
 * rendered, because a signal the console cannot explain is one it should not show.
 */
export const INTAKE_SIGNAL_TONES: readonly IntakeSignalTone[] = ['note', 'caution'];

export interface IntakeSignal {
  readonly code: IntakeSignalCode;
  readonly tone: IntakeSignalTone;
  /** The rule that was applied, in words the applicant could be shown. */
  readonly rule: string;
  /** What the rule found. Counts and dates, never a verdict. */
  readonly finding: string;
  /** The records read, so the finding can be checked rather than believed. */
  readonly references: readonly string[];
}

export interface IntakeAdvisory {
  readonly signals: readonly IntakeSignal[];
  readonly computedAt: IsoDateTime;
  /** How many records were examined, so silence can be told from ignorance. */
  readonly recordsRead: number;
}

/** Nothing read yet — distinct from "read everything and found nothing". */
export const EMPTY_ADVISORY: IntakeAdvisory = {
  signals: [],
  computedAt: asIsoDateTime('1970-01-01T00:00:00.000Z'),
  recordsRead: 0,
};

export function cautions(advisory: IntakeAdvisory): readonly IntakeSignal[] {
  return advisory.signals.filter((signal) => signal.tone === 'caution');
}

/**
 * Whether the encoder has to say something before submitting.
 *
 * The only thing a caution changes. It does not withhold the button; it asks
 * for a sentence, and the sentence is kept.
 */
export function needsAcknowledgement(advisory: IntakeAdvisory): boolean {
  return cautions(advisory).length > 0;
}

/** What the encoder said when they went ahead anyway. Kept with the request. */
export interface AdvisoryAcknowledgement {
  readonly codes: readonly IntakeSignalCode[];
  readonly reason: string;
  readonly actorId: StaffUserId | null;
  readonly actorName: string;
  readonly acknowledgedAt: IsoDateTime;
}

export const ACKNOWLEDGEMENT_MIN_LENGTH = 8;

export function isValidAcknowledgement(reason: string): boolean {
  return reason.trim().length >= ACKNOWLEDGEMENT_MIN_LENGTH;
}

/* ── Review windows ────────────────────────────────────────────────────────── */

/**
 * How far back the advisory looks.
 *
 * These are **review windows for surfacing context, not entitlement rules**.
 * Nothing is granted, refused, capped or scored by them; changing either one
 * changes how much history a caseworker is shown and changes no outcome.
 *
 * They are stated here as office review conventions rather than as sourced
 * statistics, because no published DSWD issuance was verified in this offline
 * run that fixes a numeric re-application interval for AICS. That is a
 * deliberate distinction from `POVERTY_THRESHOLD`, which carries a full PSA
 * citation because a decision boundary depends on it (`DL-46`). **The office
 * should confirm both figures against its own AICS guidelines before the first
 * pilot** — and if either ever starts to gate an outcome, it needs the
 * threshold's treatment, not this one.
 */
export const ASSISTANCE_LOOKBACK_MONTHS = 12;
export const SAME_PROGRAMME_WINDOW_DAYS = 90;

/* ── Computation ───────────────────────────────────────────────────────────── */

/** One earlier request, reduced to what the advisory needs to read. */
export interface PriorRequest {
  readonly id: AssistanceRequestId;
  readonly referenceNumber: string;
  readonly residentId: ResidentId;
  readonly programId: ProgramId;
  readonly programName: string;
  readonly status: AssistanceRequestStatus;
  readonly submittedAt: IsoDateTime | null;
  readonly approvedAmount: Money | null;
}

/** One payout that actually reached somebody. */
export interface PriorRelease {
  readonly requestId: AssistanceRequestId;
  readonly residentId: ResidentId;
  readonly amount: Money;
  readonly releasedAt: IsoDateTime;
}

export interface PriorCase {
  readonly referenceNumber: string;
  readonly isOpen: boolean;
}

export interface AdvisoryInput {
  readonly residentId: ResidentId;
  readonly householdId: HouseholdId | null;
  /** `null` while the encoder has not chosen a programme yet. */
  readonly programId: ProgramId | null;
  readonly requests: readonly PriorRequest[];
  readonly releases: readonly PriorRelease[];
  readonly cases: readonly PriorCase[];
  /** Everyone at the same address, the subject included. */
  readonly householdResidentIds: readonly ResidentId[];
  readonly today: IsoDate;
  readonly now: IsoDateTime;
}

/**
 * Derives the advisory. Pure and total, so the adapter, a test and the API
 * contract all agree on what the office is being told.
 */
export function assessIntake(input: AdvisoryInput): IntakeAdvisory {
  const signals: IntakeSignal[] = [];
  const mine = input.requests.filter((request) => request.residentId === input.residentId);

  const open = mine.filter((request) => !isTerminalAssistanceStatus(request.status));
  const openSame = open.filter((request) => request.programId === input.programId);
  const openOther = open.filter((request) => request.programId !== input.programId);

  // The strongest duplicate signal there is: the same person, the same
  // programme, still in flight. Still not a refusal — a second request during a
  // prolonged hospital stay is a real thing that happens.
  if (openSame.length > 0) {
    signals.push({
      code: 'open-request-same-programme',
      tone: 'caution',
      rule: 'An unfinished request already exists for this person under this programme.',
      finding: `${countPhrase(openSame.length, 'open request')} under the same programme.`,
      references: openSame.map(describeRequest),
    });
  }

  if (openOther.length > 0) {
    signals.push({
      code: 'open-request-other-programme',
      tone: 'note',
      rule: 'Unfinished requests exist for this person under other programmes.',
      finding: `${countPhrase(openOther.length, 'open request')} elsewhere in the office.`,
      references: openOther.map(describeRequest),
    });
  }

  const grantedSame = mine.filter(
    (request) =>
      request.programId === input.programId &&
      request.submittedAt !== null &&
      withinDays(request.submittedAt, input.now, SAME_PROGRAMME_WINDOW_DAYS) &&
      isGranted(request.status),
  );
  if (grantedSame.length > 0) {
    signals.push({
      code: 'granted-same-programme-recently',
      tone: 'caution',
      rule: `Assistance under this programme was already granted within ${SAME_PROGRAMME_WINDOW_DAYS} days.`,
      finding: `${countPhrase(grantedSame.length, 'earlier grant')} inside the review window.`,
      references: grantedSame.map(describeRequest),
    });
  }

  const releasedToSubject = input.releases.filter(
    (release) =>
      release.residentId === input.residentId &&
      withinMonths(release.releasedAt, input.now, ASSISTANCE_LOOKBACK_MONTHS),
  );
  if (releasedToSubject.length > 0) {
    signals.push({
      code: 'assistance-within-lookback',
      tone: 'note',
      rule: `Assistance handed over to this person in the last ${ASSISTANCE_LOOKBACK_MONTHS} months.`,
      finding: `${countPhrase(releasedToSubject.length, 'payout')} totalling ${formatTotal(
        totalOf(releasedToSubject),
      )}.`,
      references: releasedToSubject.map(
        (release) => `${release.requestId} · released ${dayOf(release.releasedAt)}`,
      ),
    });
  }

  // Household-level duplication is the one an office actually gets caught by:
  // two members of one household applying separately for the same event.
  const others = new Set(
    input.householdResidentIds.filter((residentId) => residentId !== input.residentId),
  );
  const releasedToHousehold = input.releases.filter(
    (release) =>
      others.has(release.residentId) &&
      withinMonths(release.releasedAt, input.now, ASSISTANCE_LOOKBACK_MONTHS),
  );
  if (input.householdId !== null && releasedToHousehold.length > 0) {
    signals.push({
      code: 'household-assisted-recently',
      tone: 'caution',
      rule: `Someone else at this address received assistance in the last ${ASSISTANCE_LOOKBACK_MONTHS} months.`,
      finding: `${countPhrase(releasedToHousehold.length, 'payout')} to ${countPhrase(
        new Set(releasedToHousehold.map((release) => release.residentId)).size,
        'other household member',
      )}, totalling ${formatTotal(totalOf(releasedToHousehold))}.`,
      references: releasedToHousehold.map(
        (release) => `${release.requestId} · released ${dayOf(release.releasedAt)}`,
      ),
    });
  }

  const openCases = input.cases.filter((record) => record.isOpen);
  if (openCases.length > 0) {
    signals.push({
      code: 'open-case',
      tone: 'note',
      rule: 'The office already has an open case about this person.',
      finding: `${countPhrase(openCases.length, 'open case')}. This request may belong inside it.`,
      references: openCases.map((record) => record.referenceNumber),
    });
  }

  return {
    signals,
    computedAt: input.now,
    recordsRead: input.requests.length + input.releases.length + input.cases.length,
  };
}

/* ── helpers ───────────────────────────────────────────────────────────────── */

/**
 * "Granted" means the office committed to it, whether or not the money has
 * moved yet. A request approved last week and not yet released is exactly the
 * duplicate an encoder needs to see.
 */
function isGranted(status: AssistanceRequestStatus): boolean {
  return ['approved', 'scheduled', 'released', 'completed'].includes(status);
}

function describeRequest(request: PriorRequest): string {
  return `${request.referenceNumber} · ${request.programName}`;
}

function countPhrase(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

function totalOf(releases: readonly PriorRelease[]): Money {
  return releases.reduce((running, release) => addMoney(running, release.amount), ZERO_PESOS);
}

/** Whole pesos, because an advisory line is read aloud, not reconciled. */
function formatTotal(total: Money): string {
  return `₱${Math.round(total.centavos / 100).toLocaleString('en-PH')}`;
}

function dayOf(moment: IsoDateTime): string {
  return moment.slice(0, 10);
}

function withinDays(moment: IsoDateTime, now: IsoDateTime, days: number): boolean {
  const elapsed = Date.parse(now) - Date.parse(moment);
  return Number.isFinite(elapsed) && elapsed >= 0 && elapsed <= days * 86_400_000;
}

function withinMonths(moment: IsoDateTime, now: IsoDateTime, months: number): boolean {
  return withinDays(moment, now, months * 30);
}
