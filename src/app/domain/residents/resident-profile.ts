import type { AssistanceRequestStatus } from '../assistance/assistance-request';
import type { ReleaseStatus, PayoutMethod } from '../releases/release';
import type { ReferralDestination, ReferralStatus } from '../referrals/referral';
import type {
  AssistanceRequestId,
  ReleaseId,
  IsoDate,
  IsoDateTime,
  ProgramId,
  ReferralId,
} from '../shared/ids';
import type { Money } from '../shared/money';
import type { ResidentView } from './resident-disclosure';
import type { Household } from '../households/household';
import type { HouseholdMemberView } from '../households/household-profile';

/**
 * Everything linked to one person, assembled once.
 *
 * The reason this exists as a single aggregate rather than four repository
 * calls stitched together in a component: the acceptance criterion for the
 * registry is that a resident can be traced to family, household, cases and
 * assistance history **without duplicate manual searches**. If the screen has
 * to ask four times, so does every other screen that needs the same picture,
 * and they will each get it slightly wrong.
 */

export interface ResidentCaseSummary {
  readonly id: AssistanceRequestId;
  readonly referenceNumber: string;
  readonly programId: ProgramId;
  readonly programName: string;
  readonly status: AssistanceRequestStatus;
  readonly requestedAmount: Money | null;
  readonly approvedAmount: Money | null;
  readonly submittedAt: IsoDateTime | null;
  readonly updatedAt: IsoDateTime;
}

export interface ResidentPayoutSummary {
  readonly id: ReleaseId;
  readonly requestId: AssistanceRequestId;
  readonly referenceNumber: string;
  readonly status: ReleaseStatus;
  readonly method: PayoutMethod;
  /** `null` for an in-kind release: goods are counted, never valued (`DL-93`). */
  readonly amount: Money | null;
  readonly scheduledFor: IsoDate | null;
  readonly releasedAt: IsoDateTime | null;
}

export interface ResidentReferralSummary {
  readonly id: ReferralId;
  readonly referenceNumber: string;
  readonly destination: ReferralDestination;
  readonly destinationName: string;
  readonly status: ReferralStatus;
  readonly referredAt: IsoDateTime;
  readonly respondedAt: IsoDateTime | null;
}

export interface ResidentAssistanceHistory {
  readonly cases: readonly ResidentCaseSummary[];
  readonly payouts: readonly ResidentPayoutSummary[];
  readonly referrals: readonly ResidentReferralSummary[];
  /** Sum of what was actually handed over — released or claimed, never merely approved. */
  readonly totalReleased: Money;
  readonly openCaseCount: number;
  readonly lastActivityAt: IsoDateTime | null;
}

export interface ResidentProfile {
  readonly view: ResidentView;
  readonly household: Household | null;
  /**
   * Household members other than the subject, head first.
   *
   * Renamed from `family` in TAB 09. Sharing an address is not the same as
   * belonging to a family, and a field called `family` on a household list was
   * the assumption `DL-47` exists to remove. Which families a person belongs to
   * is `FamilyRepository.familiesOf`, and the answer can be more than one.
   */
  readonly householdMembers: readonly HouseholdMemberView[];
  readonly history: ResidentAssistanceHistory;
}

/** Latest first, with an unknown date sorted last rather than treated as old. */
export function byMostRecent(a: IsoDateTime | null, b: IsoDateTime | null): number {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return a < b ? 1 : -1;
}
