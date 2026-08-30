import type { AuditStamp } from '../shared/audit';
import type { IsoDateTime, ResidentId, StaffUserId } from '../shared/ids';
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

/**
 * Four states, and `under-review` is deliberately not one of them.
 *
 * The console modelled five — `raised`, `under-review`, `applied`, `refused`, `withdrawn` — and the
 * system of record has four: `pending`, `approved`, `rejected`, `withdrawn`. There is no state for
 * "somebody is looking at it", and no endpoint that could produce one (`DL-155`).
 *
 * The wording here stays the office's, because it is more precise than the API's and describes what
 * actually happened to the record: `applied` says the record was corrected and the previous value
 * stayed in the trail, where "approved" says only that somebody agreed. The transport carries the
 * translation, as it does for a duplicate verdict (`DL-148`).
 *
 * `under-review` was removed rather than kept as a state nothing can reach. Modelling a state no
 * act produces is the defect `DL-151` found on a document request's `withdrawn`, and keeping it for
 * symmetry would have meant a badge no request can ever wear.
 */
export type CorrectionStatus = 'raised' | 'applied' | 'refused' | 'withdrawn';

export const CORRECTION_STATUS_CATALOG: StatusCatalog<CorrectionStatus> = {
  raised: {
    value: 'raised',
    label: 'Raised',
    tone: 'neutral',
    description: 'Somebody has said a record is wrong. Nobody has looked yet.',
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
    raised: ['applied', 'refused', 'withdrawn'],
    applied: [],
    refused: [],
    withdrawn: [],
  };

/**
 * One field somebody says is wrong, and what they say it should be.
 *
 * ## The values are here and the list must not show them
 *
 * `birth_date`, `mobile_number` and `street_address` are all correctable, so a corrections list
 * rendering `currentValue` and `proposedValue` on every row hands a reviewer a birth date for every
 * pending request — without opening a single record. That is exactly the disclosure `DL-114` splits
 * an audit row from its values to prevent: *"an audit list is the one screen designed to be scrolled
 * and filtered by somebody reviewing other people's work"*.
 *
 * A correction is not an audit row, though, and the difference matters: **the reviewer's job is to
 * decide whether the proposed value is right**, which cannot be done without seeing both. So the
 * rule is the same split rather than the same refusal — the list names the fields, and the values
 * are read when somebody opens the one they are deciding.
 *
 * They are nullable because a field can be corrected *into* existence, and because the office may
 * hold nothing where a resident says something belongs.
 */
/**
 * The attributes a resident may ask to have corrected.
 *
 * A closed union rather than a string, and in the console's own casing rather than the wire's.
 * `check:contract` refused the first draft for carrying `birth_date` into the domain, and it was
 * right for a reason beyond the seam: a screen rendering a column name tells a caseworker
 * `street_address` where a person would say "Street address". The union buys the label as well as
 * the boundary.
 *
 * Twelve, matching the office record exactly. **Nothing about means or sector is correctable** —
 * `monthlyIncome`, `philsysLastFour` and the sensitive sectors are absent from both sides, which is
 * the right answer: those are assessed or evidenced rather than asserted, and a correction request
 * is not the route to change one.
 */
export type CorrectableField =
  | 'firstName'
  | 'middleName'
  | 'lastName'
  | 'suffix'
  | 'birthDate'
  | 'sex'
  | 'civilStatus'
  | 'barangayId'
  | 'streetAddress'
  | 'purokOrSitio'
  | 'mobileNumber'
  | 'email';

export const CORRECTABLE_FIELD_LABELS: Readonly<Record<CorrectableField, string>> = {
  firstName: 'First name',
  middleName: 'Middle name',
  lastName: 'Last name',
  suffix: 'Suffix',
  birthDate: 'Birth date',
  sex: 'Sex',
  civilStatus: 'Civil status',
  barangayId: 'Barangay',
  streetAddress: 'Street address',
  purokOrSitio: 'Purok or sitio',
  mobileNumber: 'Mobile number',
  email: 'Email address',
};

export interface CorrectionChange {
  /** Named, not quoted, wherever a list shows it. */
  readonly field: CorrectableField;
  readonly currentValue: string | null;
  readonly proposedValue: string | null;
}

export interface CorrectionRequest {
  readonly id: string;
  /**
   * The record said to be wrong. Always a resident: the API publishes corrections for residents and
   * nothing else, and the console's old `entityType`/`entityId` pair described a generality that
   * does not exist (`DL-155`).
   */
  readonly residentId: ResidentId | null;
  /** Already disclosed by the data layer, under the same policy as everywhere else (`DL-38`). */
  readonly residentName: string;
  /**
   * Every field this request would change. **One request, many fields** — the console modelled a
   * single `field` and the office record carries a set, so a resident correcting their name and
   * their address in one visit was three separate requests to this console and one to the office.
   */
  readonly changes: readonly CorrectionChange[];
  /** What the requester says is wrong, in their words. */
  readonly claim: string;
  readonly status: CorrectionStatus;
  /** Who raised it — a member of staff acting on somebody's behalf, or on their own. */
  readonly raisedBy: StaffUserId | null;
  readonly raisedByName: string;
  readonly raisedAt: IsoDateTime;
  /** The office's answer. Required before `refused`, optional on `applied`. */
  readonly outcome: string | null;
  readonly decidedBy: StaffUserId | null;
  readonly decidedAt: IsoDateTime | null;
  readonly audit: AuditStamp;
}

/**
 * The fields a request would change, **labelled** and never valued. What a list may show.
 *
 * Labels rather than identifiers, because the person reading this list is deciding whether to
 * correct somebody's record and "Birth date" is what they would call it.
 */
export function fieldsNamed(request: CorrectionRequest): readonly string[] {
  return request.changes.map((change) => CORRECTABLE_FIELD_LABELS[change.field]);
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
