import type { AuditStamp } from '../shared/audit';
import type { IsoDateTime, StaffUserId } from '../shared/ids';
import type { StatusCatalog } from '../shared/status';

/**
 * A request to correct a record — **raised, considered and answered; never
 * applied silently**.
 *
 * RA 10173 gives a data subject the right to have inaccurate personal
 * information corrected. This application already holds two rules that shape
 * how: relationship and family history is append-only (`DL-48`), and replacing
 * a document supersedes rather than overwrites (`DL-77`).
 *
 * A correction request is the third face of the same doctrine. Somebody says a
 * record is wrong; the office decides; and **whichever way it goes, the request
 * and its answer stay on file**. A correction applied with no trace leaves a
 * record that silently disagrees with the decision made on the old one — and a
 * request refused with no trace leaves a resident with no evidence they ever
 * asked (`DL-117`).
 *
 * This TAB builds the record and the workflow states. **The screen that
 * captures one is not built**, and the governance page says so rather than
 * offering a form that goes nowhere.
 */

export type CorrectionStatus = 'raised' | 'under-review' | 'applied' | 'refused' | 'withdrawn';

export const CORRECTION_STATUS_CATALOG: StatusCatalog<CorrectionStatus> = {
  raised: {
    value: 'raised',
    label: 'Raised',
    tone: 'neutral',
    description: 'Somebody has said a record is wrong. Nobody has looked yet.',
  },
  'under-review': {
    value: 'under-review',
    label: 'Under review',
    tone: 'progress',
    description: 'The office is checking the record against what was presented.',
  },
  applied: {
    value: 'applied',
    label: 'Applied',
    tone: 'success',
    description: 'The record was corrected. The previous value stays in the trail.',
  },
  refused: {
    value: 'refused',
    label: 'Refused',
    tone: 'warning',
    description: 'The office did not agree, and the reason is recorded and disclosable.',
  },
  withdrawn: {
    value: 'withdrawn',
    label: 'Withdrawn',
    tone: 'neutral',
    description: 'The person who raised it no longer wants it pursued.',
  },
};

/**
 * `applied`, `refused` and `withdrawn` are terminal.
 *
 * A request that has been answered stays answered. Somebody who disagrees with
 * the answer raises a new request naming the old one — the same shape as a case
 * that recurs (`DL-53`), and for the same reason: reopening rewrites what the
 * office decided and when.
 */
export const CORRECTION_TRANSITIONS: Readonly<Record<CorrectionStatus, readonly CorrectionStatus[]>> =
  {
    raised: ['under-review', 'withdrawn'],
    'under-review': ['applied', 'refused', 'withdrawn'],
    applied: [],
    refused: [],
    withdrawn: [],
  };

export interface CorrectionRequest {
  readonly id: string;
  /** Which record is said to be wrong. */
  readonly entityType: string;
  readonly entityId: string;
  /** The field in question, named rather than quoted. */
  readonly field: string;
  /** What the requester says is wrong, in their words. */
  readonly claim: string;
  readonly status: CorrectionStatus;
  /** Who raised it — a member of staff acting on somebody's behalf, or on their own. */
  readonly raisedBy: StaffUserId | null;
  readonly raisedByName: string;
  readonly raisedAt: IsoDateTime;
  /** The office's answer. Required before `applied` or `refused`. */
  readonly outcome: string | null;
  readonly decidedBy: StaffUserId | null;
  readonly decidedAt: IsoDateTime | null;
  readonly audit: AuditStamp;
}

export type CorrectionProblem =
  | 'claim-required'
  | 'outcome-required'
  | 'not-a-permitted-move';

export function correctionProblems(
  request: CorrectionRequest,
  moveTo: CorrectionStatus,
): readonly CorrectionProblem[] {
  const problems: CorrectionProblem[] = [];

  if (request.claim.trim().length === 0) {
    problems.push('claim-required');
  }
  if (!CORRECTION_TRANSITIONS[request.status].includes(moveTo)) {
    problems.push('not-a-permitted-move');
  }
  // A refusal without a reason is the one a resident cannot challenge.
  if (
    (moveTo === 'applied' || moveTo === 'refused') &&
    (request.outcome ?? '').trim().length === 0
  ) {
    problems.push('outcome-required');
  }

  return problems;
}

export const CORRECTION_CAPTURE_IS_NOT_BUILT =
  'The form for raising a correction request is not built. The record, its states and the rule ' +
  'that an answer must carry a reason are in place; capturing one from a screen is the next ' +
  'step. Until then, record the request as a case note and correct the record in the usual way — ' +
  'the previous value stays in the audit trail either way.';
