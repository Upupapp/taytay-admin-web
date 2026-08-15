import type { ProgramRequirement } from '../programs/program';
import type {
  ConditionalApplicability,
  RequirementObligation,
} from '../requirements/requirement-obligation';
import { isOutstandingObligation } from '../requirements/requirement-obligation';
import type { ProgramId, ResidentId } from '../shared/ids';
import type { Money } from '../shared/money';
import type { AdvisoryAcknowledgement, IntakeAdvisory } from './intake-advisory';
import { needsAcknowledgement } from './intake-advisory';

/**
 * How the request reached the office.
 *
 * Recorded because it is the honest measure of how much the office already
 * knows: a walk-in was seen at the counter, a barangay referral arrived with a
 * covering note, an encoded batch was typed from paper afterwards, and an
 * online submission was never seen by staff at all. AICS reporting asks for the
 * split, and a later triage rule will want it.
 */
export type IntakeChannel = 'walk-in' | 'barangay-referral' | 'encoded' | 'online';

export const INTAKE_CHANNELS: readonly IntakeChannel[] = [
  'walk-in',
  'barangay-referral',
  'encoded',
  'online',
];

/**
 * What the counter may choose today.
 *
 * `online` exists in the model and is deliberately **not** offered: the
 * resident-facing app is a separate repository, and a channel a member of staff
 * can select by hand is not an online submission — it is an encoded one
 * mislabelled. Modelling it now and withholding it from the picker is the
 * additive half of expand–migrate–contract; the day the mobile app posts a
 * request, nothing here has to change (`DL-61`).
 */
export const OFFERED_INTAKE_CHANNELS: readonly IntakeChannel[] = [
  'walk-in',
  'barangay-referral',
  'encoded',
];

export function isOfferedChannel(channel: IntakeChannel): boolean {
  return OFFERED_INTAKE_CHANNELS.includes(channel);
}

/** One requirement as the counter has dealt with it, before the request exists. */
export interface IntakeRequirementEntry {
  readonly code: string;
  readonly label: string;
  readonly obligation: RequirementObligation;
  /** Stated for a `conditional` document so the encoder can judge it (`DL-76`). */
  readonly appliesWhen: string | null;
  /**
   * Whether a conditional document applies to this applicant. Starts
   * `undecided` and stays there until somebody at the counter says otherwise —
   * intake never assumes, in either direction.
   */
  readonly applicability: ConditionalApplicability;
  readonly presented: boolean;
  /** Excused, with the reason recorded. Never silently skipped. */
  readonly waivedReason: string | null;
}

export function requirementEntriesFor(
  requirements: readonly ProgramRequirement[],
): readonly IntakeRequirementEntry[] {
  return requirements.map((requirement) => ({
    code: requirement.code,
    label: requirement.label,
    obligation: requirement.obligation,
    appliesWhen: requirement.appliesWhen,
    applicability: 'undecided',
    presented: false,
    waivedReason: null,
  }));
}

/**
 * The working document behind the intake flow.
 *
 * Every field is optional-shaped rather than required, because a draft is
 * something an encoder puts down halfway through when the applicant goes to
 * fetch a document. Completeness is asked for at submission, by
 * `problemsForStep`, and never by the type.
 */
export interface IntakeDraft {
  readonly residentId: ResidentId | null;
  readonly programId: ProgramId | null;
  readonly channel: IntakeChannel;
  readonly referredBy: string | null;
  readonly reasonForRequest: string;
  readonly requestedAmount: Money | null;
  readonly requirements: readonly IntakeRequirementEntry[];
}

export const EMPTY_INTAKE_DRAFT: IntakeDraft = {
  residentId: null,
  programId: null,
  channel: 'walk-in',
  referredBy: null,
  reasonForRequest: '',
  requestedAmount: null,
  requirements: [],
};

export const REASON_MIN_LENGTH = 12;

/* ── Steps ─────────────────────────────────────────────────────────────────── */

/**
 * Four steps, one page.
 *
 * The acceptance criterion is that a trained encoder completes a common intake
 * **without excessive page changes**, so the steps are sections of one route
 * rather than four navigations: the applicant's context is fetched once and
 * stays on screen, and moving between steps costs nothing and loses nothing.
 * The step is still held in the URL so a refresh, a browser Back and a link
 * shared with a colleague all land where the encoder was (`DL-62`).
 */
export type IntakeStep = 'person' | 'request' | 'checks' | 'review';

export const INTAKE_STEPS: readonly IntakeStep[] = ['person', 'request', 'checks', 'review'];

export function stepIndex(step: IntakeStep): number {
  return INTAKE_STEPS.indexOf(step);
}

export function nextStep(step: IntakeStep): IntakeStep | null {
  return INTAKE_STEPS[stepIndex(step) + 1] ?? null;
}

export function previousStep(step: IntakeStep): IntakeStep | null {
  const index = stepIndex(step);
  return index <= 0 ? null : (INTAKE_STEPS[index - 1] ?? null);
}

export function isIntakeStep(value: string): value is IntakeStep {
  return (INTAKE_STEPS as readonly string[]).includes(value);
}

/* ── What is missing ───────────────────────────────────────────────────────── */

export type IntakeProblemCode =
  | 'no-resident'
  | 'no-programme'
  | 'no-reason'
  | 'reason-too-short'
  | 'missing-mandatory-requirement'
  | 'waiver-without-reason'
  | 'unacknowledged-caution';

export interface IntakeProblem {
  readonly code: IntakeProblemCode;
  readonly step: IntakeStep;
}

/**
 * What still has to happen before the request can be filed.
 *
 * Returned as codes against steps rather than as sentences, so the flow can
 * both mark the step in the stepper and word the message once in copy. A
 * missing mandatory document is a **problem to resolve or waive**, never a
 * refusal: waiving it with a recorded reason is a legitimate answer, which is
 * why `waivedReason` exists at all.
 */
export function intakeProblems(
  draft: IntakeDraft,
  advisory: IntakeAdvisory,
  acknowledgement: AdvisoryAcknowledgement | null,
): readonly IntakeProblem[] {
  const problems: IntakeProblem[] = [];

  if (draft.residentId === null) {
    problems.push({ code: 'no-resident', step: 'person' });
  }
  if (draft.programId === null) {
    problems.push({ code: 'no-programme', step: 'request' });
  }

  const reason = draft.reasonForRequest.trim();
  if (reason.length === 0) {
    problems.push({ code: 'no-reason', step: 'request' });
  } else if (reason.length < REASON_MIN_LENGTH) {
    problems.push({ code: 'reason-too-short', step: 'request' });
  }

  for (const entry of draft.requirements) {
    if (entry.waivedReason !== null && entry.waivedReason.trim().length === 0) {
      problems.push({ code: 'waiver-without-reason', step: 'checks' });
      break;
    }
  }
  if (draft.requirements.some(isOutstanding)) {
    problems.push({ code: 'missing-mandatory-requirement', step: 'checks' });
  }

  // The only thing a caution changes: a sentence is required, the button is not
  // withheld. Nothing here refuses a request on the strength of a signal.
  if (needsAcknowledgement(advisory) && acknowledgement === null) {
    problems.push({ code: 'unacknowledged-caution', step: 'checks' });
  }

  return problems;
}

export function isOutstanding(entry: IntakeRequirementEntry): boolean {
  return (
    isOutstandingObligation(entry.obligation, entry.applicability) &&
    !entry.presented &&
    entry.waivedReason === null
  );
}

export function problemsForStep(
  problems: readonly IntakeProblem[],
  step: IntakeStep,
): readonly IntakeProblem[] {
  return problems.filter((problem) => problem.step === step);
}

export function canSubmitIntake(
  draft: IntakeDraft,
  advisory: IntakeAdvisory,
  acknowledgement: AdvisoryAcknowledgement | null,
): boolean {
  return intakeProblems(draft, advisory, acknowledgement).length === 0;
}

/**
 * A draft is worth keeping as soon as it names a person. Before that there is
 * nothing to come back to, and saving would leave empty rows in the registry.
 */
export function isSaveableDraft(draft: IntakeDraft): boolean {
  return draft.residentId !== null;
}
