import type { AssistanceRequestStatus } from '../assistance/assistance-request';
import type { DisbursementStatus } from '../disbursements/disbursement';
import type { ProgramEnrollment } from './program-enrollment';
import { isCurrentEnrollment } from './program-enrollment';

/**
 * What a person currently *is* to this office.
 *
 * The master command's requirement, stated plainly: a resident, an applicant, a
 * beneficiary and a programme enrollee are **roles a person holds, not separate
 * person records**. So this module derives them; it does not store them.
 *
 * That is why there is no `Beneficiary` entity and no `BeneficiaryId` anywhere
 * in the domain (`DL-71`). The beneficiary registry is a *projection over the
 * resident registry*, keyed on `ResidentId`. One person keeps one canonical
 * identity across every programme they ever touch, because there is physically
 * no second record for them to drift into.
 *
 * Standing is computed from what the office actually did — a filed request, a
 * released payout, a live enrollment — never from a flag somebody set. A flag
 * can be wrong while the records say otherwise; a derivation cannot.
 */

export type BeneficiaryRole = 'constituent' | 'applicant' | 'beneficiary' | 'enrollee';

export const BENEFICIARY_ROLES: readonly BeneficiaryRole[] = [
  'constituent',
  'applicant',
  'beneficiary',
  'enrollee',
];

export const BENEFICIARY_ROLE_LABELS: Readonly<Record<BeneficiaryRole, string>> = {
  constituent: 'Resident',
  applicant: 'Applicant',
  beneficiary: 'Recipient',
  enrollee: 'Programme member',
};

export const BENEFICIARY_ROLE_DESCRIPTIONS: Readonly<Record<BeneficiaryRole, string>> = {
  constituent: 'On the registry. Every person here holds this standing.',
  applicant: 'Has a request with the office that has not been settled.',
  beneficiary: 'Has been handed assistance at least once.',
  enrollee: 'On the list of a continuing programme.',
};

/**
 * A request that is still live — the office owes this person an answer.
 *
 * Terminal states are excluded on purpose: somebody whose request was rejected
 * two years ago is not an applicant today, and showing them as one would put
 * settled business back into a queue somebody works from.
 */
const OPEN_REQUEST_STATUSES: readonly AssistanceRequestStatus[] = [
  'submitted',
  'intake-review',
  'assessment',
  'endorsed',
  'approved',
  'scheduled',
  'returned',
];

/**
 * Payout states that mean something actually reached the person.
 *
 * `released`, `claimed` and `completed` only. Not `scheduled` — a payout on a
 * calendar is a plan, and calling somebody a recipient before they have
 * received anything overstates what the office has done. Not `unclaimed`, where
 * the money went back in the drawer, and not `deferred`, where the family came
 * and the office could not pay.
 */
const RECEIVED_DISBURSEMENT_STATUSES: readonly DisbursementStatus[] = [
  'released',
  'claimed',
  'completed',
];

export function isOpenRequestStatus(status: AssistanceRequestStatus): boolean {
  return OPEN_REQUEST_STATUSES.includes(status);
}

export function isReceivedDisbursementStatus(status: DisbursementStatus): boolean {
  return RECEIVED_DISBURSEMENT_STATUSES.includes(status);
}

/** The evidence a standing is derived from. Counts, so the screen can cite them. */
export interface StandingEvidence {
  readonly openRequestCount: number;
  readonly settledRequestCount: number;
  readonly receivedDisbursementCount: number;
  readonly currentEnrollmentCount: number;
  readonly pastEnrollmentCount: number;
}

export interface BeneficiaryStanding {
  /** Every role this person currently holds, in the order of `BENEFICIARY_ROLES`. */
  readonly roles: readonly BeneficiaryRole[];
  readonly evidence: StandingEvidence;
}

export interface StandingInput {
  readonly requestStatuses: readonly AssistanceRequestStatus[];
  readonly disbursementStatuses: readonly DisbursementStatus[];
  readonly enrollments: readonly ProgramEnrollment[];
}

/**
 * Derives every standing a person holds, together with the counts behind it.
 *
 * The roles are **not exclusive**, and that is the substance of the decision.
 * A senior citizen may be enrolled on the pension list, have received a burial
 * grant last year and have a medical request open this morning — all three at
 * once. A model that made these mutually exclusive would force the office to
 * pick one and would lose the other two.
 *
 * `constituent` is always present: being on the registry is the floor.
 */
export function deriveStanding(input: StandingInput): BeneficiaryStanding {
  const openRequestCount = input.requestStatuses.filter(isOpenRequestStatus).length;
  const settledRequestCount = input.requestStatuses.length - openRequestCount;
  const receivedDisbursementCount = input.disbursementStatuses.filter(
    isReceivedDisbursementStatus,
  ).length;
  const currentEnrollmentCount = input.enrollments.filter(isCurrentEnrollment).length;
  const pastEnrollmentCount = input.enrollments.length - currentEnrollmentCount;

  const roles: BeneficiaryRole[] = ['constituent'];
  if (openRequestCount > 0) {
    roles.push('applicant');
  }
  if (receivedDisbursementCount > 0) {
    roles.push('beneficiary');
  }
  if (currentEnrollmentCount > 0) {
    roles.push('enrollee');
  }

  return {
    roles,
    evidence: {
      openRequestCount,
      settledRequestCount,
      receivedDisbursementCount,
      currentEnrollmentCount,
      pastEnrollmentCount,
    },
  };
}

export function hasStanding(standing: BeneficiaryStanding, role: BeneficiaryRole): boolean {
  return standing.roles.includes(role);
}

/**
 * The sentence a screen shows beside a person, e.g.
 * "Resident · Applicant · Recipient".
 *
 * Every role is listed rather than the "highest" one. There is no highest: they
 * answer different questions, and collapsing them is how an office ends up
 * unable to see that the person in front of them is already on a programme.
 */
export function describeStanding(standing: BeneficiaryStanding): string {
  return standing.roles.map((role) => BENEFICIARY_ROLE_LABELS[role]).join(' · ');
}
