import type { Household } from '../households/household';
import type { Family } from '../families/family';
import type { ResidentView } from '../residents/resident-disclosure';
import type {
  ResidentCaseSummary,
  ResidentPayoutSummary,
  ResidentReferralSummary,
} from '../residents/resident-profile';
import type {
  BarangayId,
  HouseholdId,
  IsoDate,
  IsoDateTime,
  ProgramId,
  ResidentId,
} from '../shared/ids';
import type { Money } from '../shared/money';
import type { AssistanceTimelineEntry } from './assistance-timeline';
import type { DuplicateCandidate } from './duplicate-review';
import type { BeneficiaryRole, BeneficiaryStanding } from './beneficiary-standing';
import type { ProgramEnrollment } from './program-enrollment';

/**
 * The beneficiary registry.
 *
 * A **view over the resident registry**, not a second registry (`DL-71`). Every
 * type here is keyed on `ResidentId`; none of them introduces a person record,
 * and the acceptance criterion — one canonical identity across every programme —
 * holds by construction rather than by discipline.
 *
 * The registry answers a question the resident list cannot: *what has this
 * office actually done for this person, over time, across everything?*
 */

export interface BeneficiarySummary {
  readonly residentId: ResidentId;
  /** Already redacted by the data layer for this viewer (`DL-38`). */
  readonly resident: ResidentView;
  readonly householdId: HouseholdId | null;
  readonly barangayId: BarangayId;
  readonly standing: BeneficiaryStanding;
  /** Programmes the person is currently on, name only, for the list column. */
  readonly currentProgramNames: readonly string[];
  /** Every timeline event ever recorded for them. The "total events" column. */
  readonly assistanceEventCount: number;
  readonly lastAssistanceAt: IsoDateTime | null;
  /** Actually handed over — released or claimed, never merely approved. */
  readonly totalReleased: Money;
  readonly openCaseCount: number;
  /**
   * Whether a duplicate candidate is waiting on this record. A flag, not the
   * candidate: the list must not disclose the other person to everyone scrolling
   * past (`DL-73`).
   */
  readonly hasOpenDuplicateReview: boolean;
}

export interface BeneficiaryDetail {
  readonly residentId: ResidentId;
  readonly resident: ResidentView;
  /**
   * The address, not a vulnerability reading of it.
   *
   * Deliberately a `Household` rather than a `HouseholdSummary`: the summary
   * carries a vulnerability band, and a band belongs to the household screen
   * that computes it from the factors it can also show. Reproducing the number
   * here without its workings would put an unexplained judgement about a family
   * on a page that cannot justify it (`DL-42`).
   */
  readonly household: Household | null;
  readonly householdHeadName: string | null;
  /** Every family this person belongs to. Plural: people overlap (`DL-47`). */
  readonly families: readonly Family[];
  readonly standing: BeneficiaryStanding;
  readonly enrollments: readonly ProgramEnrollment[];
  readonly timeline: readonly AssistanceTimelineEntry[];
  readonly requests: readonly ResidentCaseSummary[];
  readonly payouts: readonly ResidentPayoutSummary[];
  readonly referrals: readonly ResidentReferralSummary[];
  readonly totalReleased: Money;
  /**
   * Duplicate candidates for this person. Empty for a viewer without
   * `beneficiary.review-duplicates` — withheld in the data layer, so a screen
   * cannot leak a candidate it never received.
   */
  readonly duplicateCandidates: readonly DuplicateCandidate[];
}

/* ── Filtering ────────────────────────────────────────────────────────────── */

export interface BeneficiaryFilter {
  readonly search?: string;
  readonly barangayId?: BarangayId;
  readonly programId?: ProgramId;
  /** Standing to filter by, e.g. only people who have actually received something. */
  readonly role?: BeneficiaryRole;
  /** Assistance received on or after this date. */
  readonly receivedFrom?: IsoDate;
  readonly receivedTo?: IsoDate;
  readonly withOpenDuplicateReview?: boolean;
}

export const EMPTY_BENEFICIARY_FILTER: BeneficiaryFilter = {};

export function isBeneficiaryFilterActive(filter: BeneficiaryFilter): boolean {
  return (
    Boolean(filter.search) ||
    filter.barangayId !== undefined ||
    filter.programId !== undefined ||
    filter.role !== undefined ||
    filter.receivedFrom !== undefined ||
    filter.receivedTo !== undefined ||
    filter.withOpenDuplicateReview === true
  );
}

export type BeneficiarySortField =
  | 'name'
  | 'barangay'
  | 'lastAssistanceAt'
  | 'totalReleased'
  | 'assistanceEventCount';

/**
 * A period bounded on both sides, or on neither, is coherent. One bound alone is
 * fine too. This only catches the reversed pair, which silently returns nothing
 * and reads as "no assistance on record" — a dangerous thing to believe.
 */
export function isPeriodReversed(filter: BeneficiaryFilter): boolean {
  return (
    filter.receivedFrom !== undefined &&
    filter.receivedTo !== undefined &&
    filter.receivedFrom > filter.receivedTo
  );
}
