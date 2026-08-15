import { ASSISTANCE_LOOKBACK_MONTHS, SAME_PROGRAMME_WINDOW_DAYS } from '../intake/intake-advisory';
import type { IsoDate } from '../shared/ids';

/**
 * The configuration seam for the intake review windows.
 *
 * TAB 11 shipped `ASSISTANCE_LOOKBACK_MONTHS` (12) and
 * `SAME_PROGRAMME_WINDOW_DAYS` (90) as module constants, and recorded in
 * `DL-60` that they are office review conventions rather than sourced
 * statistics: they decide **how much history a caseworker is shown** and
 * nothing else. TAB 12 was asked to give them a policy home if one existed
 * here, additively and without breaking TAB 11 (`DL-68`).
 *
 * This is that home. The move is deliberately expand-only:
 *
 *  - the constants stay exactly where they were and keep their values, so every
 *    TAB 11 call site and test is untouched;
 *  - `DEFAULT_REVIEW_WINDOW` is built **from** them, so there is one number,
 *    not two that can disagree;
 *  - a programme may carry its own window, and where it does not, the default
 *    applies.
 *
 * The status field is the point of the exercise. A window that has not been
 * confirmed against the office's own AICS guidelines says so on screen, and
 * says so until somebody records that they checked it. That is the measurable
 * retirement condition for the fallback: `provenance` moving off
 * `convention-pending-confirmation`.
 */
export type WindowProvenance =
  'convention-pending-confirmation' | 'office-confirmed' | 'issuance-based';

export const WINDOW_PROVENANCES: readonly WindowProvenance[] = [
  'convention-pending-confirmation',
  'office-confirmed',
  'issuance-based',
];

export interface ReviewWindowPolicy {
  /** How far back the advisory reports assistance already handed over. */
  readonly lookbackMonths: number;
  /** How recently a grant under the same programme is worth a second look. */
  readonly sameProgrammeDays: number;
  readonly provenance: WindowProvenance;
  /** The issuance or minute that settled it. `null` while unconfirmed. */
  readonly basis: string | null;
  readonly confirmedOn: IsoDate | null;
}

/**
 * Built from the TAB 11 constants rather than repeating their values, so the
 * two can never drift apart.
 */
export const DEFAULT_REVIEW_WINDOW: ReviewWindowPolicy = {
  lookbackMonths: ASSISTANCE_LOOKBACK_MONTHS,
  sameProgrammeDays: SAME_PROGRAMME_WINDOW_DAYS,
  provenance: 'convention-pending-confirmation',
  basis: null,
  confirmedOn: null,
};

export function reviewWindowFor(policy: ReviewWindowPolicy | null): ReviewWindowPolicy {
  return policy ?? DEFAULT_REVIEW_WINDOW;
}

/**
 * Whether the office still owes somebody a confirmation of this window.
 *
 * Rendered on the programme screen. An unconfirmed convention that nobody is
 * reminded about is a number that quietly becomes policy by age.
 */
export function awaitsConfirmation(policy: ReviewWindowPolicy): boolean {
  return policy.provenance === 'convention-pending-confirmation';
}

export type WindowProblemCode =
  'non-positive-window' | 'confirmed-without-basis' | 'confirmed-without-date';

export interface WindowProblem {
  readonly code: WindowProblemCode;
}

export function reviewWindowProblems(policy: ReviewWindowPolicy): readonly WindowProblem[] {
  const problems: WindowProblem[] = [];
  if (policy.lookbackMonths <= 0 || policy.sameProgrammeDays <= 0) {
    problems.push({ code: 'non-positive-window' });
  }
  // A window claiming to be settled has to say by what, and when. Otherwise
  // "confirmed" is just an assertion that ages into an unchallengeable fact.
  if (policy.provenance !== 'convention-pending-confirmation') {
    if (policy.basis === null || policy.basis.trim().length === 0) {
      problems.push({ code: 'confirmed-without-basis' });
    }
    if (policy.confirmedOn === null) {
      problems.push({ code: 'confirmed-without-date' });
    }
  }
  return problems;
}
