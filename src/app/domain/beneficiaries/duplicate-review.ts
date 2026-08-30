import type {
  DuplicatePairId,
  IdentityResolutionId,
  IsoDateTime,
  ResidentId,
  StaffUserId,
} from '../shared/ids';

/**
 * Reviewing whether two registry records are the same person.
 *
 * Two rules govern this module, and both come straight from the acceptance
 * criteria for the beneficiary registry.
 *
 * **1. Compare without disclosing** (`DL-73`). A duplicate queue is, structurally,
 * a machine for showing one person's details to somebody who came to look at
 * another person's record. So the comparison reports *agreement*, not values:
 * "both records carry the same birth date" rather than the birth date. A
 * reviewer can judge a likely duplicate from agreement alone, and the office
 * never has to disclose a survivor's address to somebody clearing a work queue.
 * Values appear only where the viewer already holds `resident.view-sensitive`,
 * and the screen asks for them deliberately.
 *
 * **2. Never merge** (`DL-74`). There is no destructive merge in this domain and
 * there must not be. Resolving a pair records a *judgement* — `same-person` or
 * `distinct-people` — with an actor and a reason. `same-person` designates a
 * canonical record and supersedes the other; both records survive, and so does
 * every request, payout and case attached to either. `distinct-people` matters
 * just as much: without it the same pair resurfaces in the queue forever, and a
 * reviewer who has already answered is asked again until they answer wrong.
 */

/* ── What was compared ────────────────────────────────────────────────────── */

/**
 * An attribute the matcher looked at. Names the *field*, never its content.
 *
 * `philsysLastFour` is included because four digits agreeing is strong evidence
 * when combined with a name; the digits themselves are still never emitted by
 * this module (RA 11055, and `CLAUDE.md` §6.2).
 */
export type MatchAttribute =
  | 'surname'
  | 'given-name'
  | 'birth-date'
  | 'sex'
  | 'barangay'
  | 'street-address'
  | 'mobile'
  | 'philsys-last-four'
  | 'household';

export const MATCH_ATTRIBUTE_LABELS: Readonly<Record<MatchAttribute, string>> = {
  surname: 'Surname',
  'given-name': 'Given name',
  'birth-date': 'Date of birth',
  sex: 'Sex',
  barangay: 'Barangay',
  'street-address': 'Street address',
  mobile: 'Mobile number',
  'philsys-last-four': 'PhilSys last four digits',
  household: 'Household',
};

/**
 * How the two records relate on one attribute.
 *
 * `not-comparable` is distinct from `differs` and the distinction is load-bearing:
 * one record simply not carrying a mobile number is not evidence that the two
 * people are different, and treating absence as disagreement would hide real
 * duplicates behind incomplete profiles.
 */
export type MatchOutcome = 'same' | 'similar' | 'differs' | 'not-comparable';

export const MATCH_OUTCOME_LABELS: Readonly<Record<MatchOutcome, string>> = {
  same: 'Identical',
  similar: 'Nearly the same',
  differs: 'Different',
  'not-comparable': 'Not recorded on one of them',
};

export interface MatchSignal {
  readonly attribute: MatchAttribute;
  readonly outcome: MatchOutcome;
  /**
   * The rule that produced the outcome, in plain language — e.g. "surnames
   * match exactly, ignoring case". Stated for the same reason the intake
   * advisory states its rules (`DL-60`): a reviewer must be able to disagree
   * with the machine, and they cannot disagree with a number.
   */
  readonly rule: string;
}

/* ── Strength, which is not a decision ────────────────────────────────────── */

/**
 * How strongly the signals point at one person.
 *
 * Three bands, and **none of them resolves anything**. This is the same doctrine
 * that governs vulnerability factors (`DL-42`), the intake advisory (`DL-60`)
 * and eligibility guidance (`DL-66`): the software orders the queue, a person
 * makes the finding. There is deliberately no numeric score and no threshold
 * above which anything happens automatically — merging two people's welfare
 * histories on a percentage is precisely the failure this shape prevents.
 */
export type DuplicateStrength = 'strong' | 'moderate' | 'weak';

export const DUPLICATE_STRENGTH_LABELS: Readonly<Record<DuplicateStrength, string>> = {
  strong: 'Very likely the same person',
  moderate: 'Possibly the same person',
  weak: 'Weak resemblance',
};

export interface DuplicateCandidate {
  /**
   * The pair the office is holding open, as the system of record names it.
   *
   * Every act on a pair — recording a finding, previewing what superseding would do — is addressed
   * by this id, because the pair is a row with a decision and a note rather than a resemblance
   * recomputed on each read. Without it the console can display a queue and act on nothing
   * (`DL-148`).
   */
  readonly pairId: DuplicatePairId;
  /** The record being reviewed. */
  readonly residentId: ResidentId;
  /** The record it resembles. */
  readonly otherResidentId: ResidentId;
  /**
   * Surname plus a given initial, both sides. The one disclosure this queue
   * makes by default, on the reasoning already settled in `formatProtectedName`:
   * a reviewer who cannot see any name cannot review anything.
   */
  readonly residentLabel: string;
  readonly otherLabel: string;
  readonly strength: DuplicateStrength;
  readonly signals: readonly MatchSignal[];
  /** Whether opening the full comparison needs `resident.view-sensitive`. */
  readonly holdsSensitiveRecord: boolean;
}

/**
 * Grades a candidate from its signals.
 *
 * Strong requires an identifier-grade agreement — the PhilSys digits or a birth
 * date — *plus* a surname, and no outright contradiction. Two people sharing a
 * surname and a barangay are common enough in a Philippine municipality that
 * treating it as strong would fill the queue with siblings and cousins.
 */
export function gradeDuplicate(signals: readonly MatchSignal[]): DuplicateStrength {
  const agreeing = signals.filter((s) => s.outcome === 'same' || s.outcome === 'similar');
  const contradicting = signals.filter((s) => s.outcome === 'differs');

  const agreesOn = (attribute: MatchAttribute): boolean =>
    agreeing.some((s) => s.attribute === attribute);
  const contradictsOn = (attribute: MatchAttribute): boolean =>
    contradicting.some((s) => s.attribute === attribute);

  const identifierAgrees = agreesOn('philsys-last-four') || agreesOn('birth-date');
  const identifierContradicts =
    contradictsOn('philsys-last-four') || contradictsOn('birth-date') || contradictsOn('sex');

  if (identifierAgrees && agreesOn('surname') && !identifierContradicts) {
    return 'strong';
  }
  if (agreesOn('surname') && agreeing.length >= 3 && !identifierContradicts) {
    return 'moderate';
  }
  return 'weak';
}

/* ── The finding ──────────────────────────────────────────────────────────── */

export type IdentityVerdict = 'same-person' | 'distinct-people';

export const IDENTITY_VERDICT_LABELS: Readonly<Record<IdentityVerdict, string>> = {
  'same-person': 'The same person',
  'distinct-people': 'Two different people',
};

/**
 * A reviewer's recorded finding about one pair. Append-only, like every other
 * judgement in this application (`DL-48`, `DL-54`).
 */
export interface IdentityResolution {
  readonly id: IdentityResolutionId;
  readonly verdict: IdentityVerdict;
  /**
   * The record kept as canonical, and the one that now points at it. Both are
   * set for `same-person` and both are `null` for `distinct-people`, where
   * neither record supersedes anything.
   */
  readonly canonicalResidentId: ResidentId | null;
  readonly supersededResidentId: ResidentId | null;
  /** The pair, ordered, so the same two records resolve only once. */
  readonly pair: readonly [ResidentId, ResidentId];
  readonly reason: string;
  readonly decidedBy: StaffUserId;
  readonly decidedAt: IsoDateTime;
}

/**
 * What a reviewer submits. The repository supplies actor and time; a client
 * that could state who decided something could state the wrong name.
 */
export interface IdentityResolutionDraft {
  /** Which open pair this finding is about. The API accepts a finding no other way. */
  readonly pairId: DuplicatePairId;
  readonly verdict: IdentityVerdict;
  readonly pair: readonly [ResidentId, ResidentId];
  /** Which record survives as canonical. Required for `same-person` only. */
  readonly canonicalResidentId: ResidentId | null;
  readonly reason: string;
}

export type ResolutionProblem =
  | 'reason-required'
  | 'same-record-twice'
  | 'canonical-required'
  | 'canonical-not-in-pair'
  | 'canonical-on-distinct-verdict';

/**
 * Validates a finding before it is recorded. Pure, so the same rules run in the
 * form, in the adapter and in a test.
 */
export function resolutionProblems(
  draft: IdentityResolutionDraft,
): readonly ResolutionProblem[] {
  const problems: ResolutionProblem[] = [];
  const [first, second] = draft.pair;

  if (draft.reason.trim().length === 0) {
    problems.push('reason-required');
  }
  if (first === second) {
    problems.push('same-record-twice');
  }

  if (draft.verdict === 'same-person') {
    if (draft.canonicalResidentId === null) {
      problems.push('canonical-required');
    } else if (draft.canonicalResidentId !== first && draft.canonicalResidentId !== second) {
      problems.push('canonical-not-in-pair');
    }
  } else if (draft.canonicalResidentId !== null) {
    // Declaring two people distinct and simultaneously naming one of them the
    // survivor of the other is incoherent, and would leave a record superseded
    // by somebody it was just found unrelated to.
    problems.push('canonical-on-distinct-verdict');
  }

  return problems;
}

/**
 * Orders a pair so that the same two records always produce the same key,
 * whichever side the reviewer opened first.
 */
export function pairKey(a: ResidentId, b: ResidentId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * What a `same-person` finding will change, shown before it is recorded.
 *
 * A preview, not a plan the system then executes: nothing here is deleted, and
 * the counts exist so a reviewer understands the weight of what they are about
 * to say. Superseding a record with eleven payouts behind it deserves a pause.
 */
export interface MergePreview {
  readonly canonicalResidentId: ResidentId;
  readonly supersededResidentId: ResidentId;
  readonly movingRequestCount: number;
  readonly movingReleaseCount: number;
  readonly movingCaseCount: number;
  readonly movingEnrollmentCount: number;
  /**
   * Records that would end up attached to the canonical person twice — the same
   * assistance counted once under each identity. Named rather than resolved:
   * deciding which of two payouts was the real one is an office judgement.
   */
  readonly overlappingProgramNames: readonly string[];
}

export class ResolutionInvalidError extends Error {
  readonly problems: readonly ResolutionProblem[];

  constructor(problems: readonly ResolutionProblem[]) {
    super('That finding needs correcting before it can be recorded.');
    this.name = 'ResolutionInvalidError';
    this.problems = problems;
  }
}

export function isResolutionInvalid(error: unknown): error is ResolutionInvalidError {
  return error instanceof ResolutionInvalidError;
}
