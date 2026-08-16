import type { IsoDateTime, StaffUserId, VisitObservationId } from '../shared/ids';

/**
 * What was recorded on a visit, and **whose claim it is**.
 *
 * The master command asks for a clear distinction between factual observation,
 * client statement and caseworker assessment. That is not a formatting
 * preference. Consider three sentences a worker might write in one paragraph:
 *
 *   - "The roof is missing sheets over the sleeping area."
 *   - "She says her husband has not sent money since March."
 *   - "The household appears unable to meet its own food costs."
 *
 * The first is checkable. The second is a report the office is repeating, and
 * may be wrong without anybody lying. The third is a professional judgement
 * that a later reader may disagree with. Written as one block of prose they
 * become indistinguishable, and six months on a different worker reads all
 * three as established fact about the family.
 *
 * So an observation carries its **kind**, and the screens render it. Nothing
 * here prevents a worker from recording a judgement; it prevents a judgement
 * from being mistaken for something the family said.
 */

export type ObservationKind =
  | 'observed'
  | 'client-said'
  | 'third-party-said'
  | 'worker-assessed';

export const OBSERVATION_KINDS: readonly ObservationKind[] = [
  'observed',
  'client-said',
  'third-party-said',
  'worker-assessed',
];

export const OBSERVATION_KIND_LABELS: Readonly<Record<ObservationKind, string>> = {
  observed: 'Seen by the worker',
  'client-said': 'Said by the client',
  'third-party-said': 'Said by someone else',
  'worker-assessed': 'The worker’s assessment',
};

export const OBSERVATION_KIND_DESCRIPTIONS: Readonly<Record<ObservationKind, string>> = {
  observed: 'Something the worker saw or measured at the address. Checkable by another visit.',
  'client-said': 'What the household told the worker. Recorded as their account, not as verified.',
  'third-party-said':
    'What a neighbour, barangay official or relative said. Whose account it is must be named.',
  'worker-assessed':
    'The worker’s professional judgement, drawn from the above. A later reader may disagree with it.',
};

/**
 * Whether a kind carries somebody else's words.
 *
 * Used to require an attribution: "a neighbour said" with no neighbour named is
 * a rumour the office cannot check and cannot answer for.
 */
export function needsAttribution(kind: ObservationKind): boolean {
  return kind === 'third-party-said';
}

/** Whether a kind is the worker's own inference rather than a report of fact. */
export function isJudgement(kind: ObservationKind): boolean {
  return kind === 'worker-assessed';
}

export interface VisitObservation {
  readonly id: VisitObservationId;
  readonly kind: ObservationKind;
  readonly body: string;
  /** Who said it, for `third-party-said`. `null` for every other kind. */
  readonly attributedTo: string | null;
  readonly recordedBy: StaffUserId;
  readonly recordedAt: IsoDateTime;
}

export interface VisitObservationDraft {
  readonly kind: ObservationKind;
  readonly body: string;
  readonly attributedTo: string | null;
}

export type ObservationProblem =
  | 'body-required'
  | 'attribution-required'
  | 'attribution-not-applicable';

export const OBSERVATION_MIN_LENGTH = 8;

export function observationProblems(
  draft: VisitObservationDraft,
): readonly ObservationProblem[] {
  const problems: ObservationProblem[] = [];

  if (draft.body.trim().length < OBSERVATION_MIN_LENGTH) {
    problems.push('body-required');
  }
  if (needsAttribution(draft.kind) && (draft.attributedTo ?? '').trim().length === 0) {
    problems.push('attribution-required');
  }
  // An attribution on the worker's own observation would read as though
  // somebody else vouched for it.
  if (!needsAttribution(draft.kind) && (draft.attributedTo ?? '').trim().length > 0) {
    problems.push('attribution-not-applicable');
  }

  return problems;
}

/** Counts by kind, so a screen can say what a visit record actually consists of. */
export interface ObservationMix {
  readonly observed: number;
  readonly clientSaid: number;
  readonly thirdPartySaid: number;
  readonly workerAssessed: number;
}

export function observationMix(
  observations: readonly VisitObservation[],
): ObservationMix {
  return {
    observed: observations.filter((entry) => entry.kind === 'observed').length,
    clientSaid: observations.filter((entry) => entry.kind === 'client-said').length,
    thirdPartySaid: observations.filter((entry) => entry.kind === 'third-party-said').length,
    workerAssessed: observations.filter((entry) => entry.kind === 'worker-assessed').length,
  };
}

/**
 * A visit whose record is entirely the worker's own judgement, with nothing
 * observed and nothing the family said.
 *
 * Not an error, and not blocked — a short doorstep conversation can legitimately
 * produce one. It is surfaced because a file built only of assessments is the
 * shape that hardens into a label, and the office should be able to see when a
 * record has drifted that way.
 */
export function isAllJudgement(observations: readonly VisitObservation[]): boolean {
  return observations.length > 0 && observations.every((entry) => isJudgement(entry.kind));
}
