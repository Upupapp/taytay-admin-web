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
  readonly householdMembers: HouseholdComposition;
  readonly history: ResidentAssistanceHistory;
}

/**
 * What the office could establish about who else lives at this address.
 *
 * ## Why this is a union and not an array
 *
 * An empty array says "nobody else lives here", which is a positive claim about a family. The
 * console cannot always make it: the household detail payload carries membership rows with
 * `effective_from` and **no role**, so a member's relationship to the head — the thing the profile
 * prints beside their name — has no wire counterpart at all (`DL-145`). Typed as an array, that
 * arrives as rows whose every domain property is `undefined`, and the panel renders a list of blank
 * cards on a screen that names a family.
 *
 * Rendering nothing instead only swaps one wrong answer for another. `L-14` settled the principle
 * for the vulnerability band and `DL-112` for an unsearched record type: **never render an empty
 * record where the truth is "we could not ask"**, and name what was not read rather than omitting
 * it silently.
 *
 * So the absence is a state a screen has to handle rather than a value it can mistake for an
 * answer, in the same way `ViewState` makes "still loading" unmistakable for "no results" and
 * `CaseNoteView.body: null` keeps a withheld note listed (`DL-58`).
 */
export type HouseholdComposition =
  | { readonly kind: 'read'; readonly members: readonly HouseholdMemberView[] }
  /** `because` is shown to the reader, so it says what is missing rather than naming a defect. */
  | { readonly kind: 'unavailable'; readonly because: string };

/**
 * Why the composition could not be read, in words a caseworker can act on.
 *
 * It lives in the domain rather than in feature copy because the **data layer** decides that the
 * answer is unavailable, and it is the same reason a payout manifest and an export notice are
 * composed there (`DL-92`, `DL-106`): the sentence and the fact have to travel together, or a
 * second screen states the absence differently from the first.
 *
 * It names what is missing, not the defect. "The API omits household roles" is a sentence about
 * this office's software; "who else lives at this address could not be read" is a sentence about
 * the record in front of them.
 */
export const HOUSEHOLD_COMPOSITION_UNREADABLE =
  'Who else lives at this address could not be read from the office record. This is not a ' +
  'statement that nobody does — the household register is there, but it does not yet say how each ' +
  'person is related to the head, and this console will not guess. Open the household record for ' +
  'the address itself.';

/** The members, or none — for callers that only count. Never mistakes unavailable for empty. */
export function membersOf(composition: HouseholdComposition): readonly HouseholdMemberView[] {
  return composition.kind === 'read' ? composition.members : [];
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
