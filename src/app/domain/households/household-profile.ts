import type { AuditEntry } from '../shared/audit';
import type { ResidentView } from '../residents/resident-disclosure';
import type { Household, HouseholdBand, HouseholdRole } from './household';
import type { VulnerabilitySnapshot } from './household-vulnerability';

/**
 * One member of a household, as a particular viewer may see them.
 *
 * The member is a `ResidentView`, not a `Resident`: a household screen is a
 * resident screen with more people on it, and the disclosure policy does not
 * relax because the context changed (`DL-38`).
 */
export interface HouseholdMemberView {
  readonly view: ResidentView;
  readonly role: HouseholdRole;
  readonly isHead: boolean;
}

/** A row in the household list. Enough to decide which household to open. */
export interface HouseholdSummary {
  readonly household: Household;
  /** Already disclosed — a protected head is masked here as everywhere else. */
  readonly headName: string;
  readonly memberCount: number;
  readonly band: HouseholdBand;
  readonly presentFactorCount: number;
}

/**
 * A household, everyone in it, why it looks exposed, and everything anyone has
 * done to the record.
 *
 * Assembled in one call for the same reason `ResidentProfile` is: a screen that
 * has to ask four times will be re-implemented four ways, and the composition
 * and the snapshot must be read from the same moment or the explanation will
 * not match the membership it claims to explain.
 */
export interface HouseholdDetail {
  readonly household: Household;
  readonly members: readonly HouseholdMemberView[];
  readonly snapshot: VulnerabilitySnapshot;
  /** Newest first. Membership changes and factor corrections, with reasons. */
  readonly audit: readonly AuditEntry[];
}

export function headOf(detail: HouseholdDetail): HouseholdMemberView | null {
  return detail.members.find((member) => member.isHead) ?? null;
}
