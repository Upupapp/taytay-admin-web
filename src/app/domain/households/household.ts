import type { AuditStamp } from '../shared/audit';
import type { BarangayId, HouseholdId, ResidentId } from '../shared/ids';
import type { Money } from '../shared/money';
import type { ResidentAddress } from '../residents/resident';

/**
 * The household as a unit of service delivery.
 *
 * The MSWDO assists people, but it assesses families: an income figure, an
 * indigency classification and most vulnerability judgements are properties of
 * the roof, not of any one person under it. So the household is modelled here
 * in its own right rather than as an attribute hanging off a resident.
 *
 * A resident still points at a household by id, and that pointer is the only
 * thing a resident record knows about the household. Membership is owned by the
 * household — which is what makes the two sides keepable in step (`DL-43`).
 */
export type HouseholdRole = 'head' | 'spouse' | 'child' | 'parent' | 'relative' | 'non-relative';

export const HOUSEHOLD_ROLES: readonly HouseholdRole[] = [
  'head',
  'spouse',
  'child',
  'parent',
  'relative',
  'non-relative',
];

export const HOUSEHOLD_ROLE_LABELS: Readonly<Record<HouseholdRole, string>> = {
  head: 'Household head',
  spouse: 'Spouse',
  child: 'Child',
  parent: 'Parent',
  relative: 'Relative',
  'non-relative': 'Other member',
};

export interface HouseholdMember {
  readonly residentId: ResidentId;
  readonly role: HouseholdRole;
}

export interface Household {
  readonly id: HouseholdId;
  readonly referenceNumber: string;
  readonly headResidentId: ResidentId;
  readonly address: ResidentAddress;
  readonly members: readonly HouseholdMember[];
  readonly monthlyIncome: Money | null;
  /**
   * A recorded classification, made by a person. Never derived from the
   * vulnerability snapshot: an advisory indicator that quietly set a
   * classification would be an automated eligibility decision by another name
   * (`DL-42`).
   */
  readonly isIndigent: boolean;
  readonly audit: AuditStamp;
}

/* ── Filtering ────────────────────────────────────────────────────────────── */

export interface HouseholdFilter {
  readonly search?: string;
  readonly barangayId?: BarangayId;
  readonly indigentOnly?: boolean;
  /** Households carrying at least one vulnerability factor at this band or above. */
  readonly minimumBand?: HouseholdBand;
}

export type HouseholdSortField = 'reference' | 'barangay' | 'size' | 'updatedAt';

/**
 * A coarse, advisory grouping used only to sort and filter a list — never to
 * decide anything. Named "band" rather than "score" or "level" on purpose: a
 * number invites arithmetic, and arithmetic on a family's circumstances is how
 * an advisory indicator turns into a decision nobody signed (`DL-42`).
 */
export type HouseholdBand = 'none' | 'watch' | 'elevated' | 'high';

export const HOUSEHOLD_BANDS: readonly HouseholdBand[] = ['none', 'watch', 'elevated', 'high'];

const BAND_ORDER: Readonly<Record<HouseholdBand, number>> = {
  none: 0,
  watch: 1,
  elevated: 2,
  high: 3,
};

export function isAtLeastBand(band: HouseholdBand, minimum: HouseholdBand): boolean {
  return BAND_ORDER[band] >= BAND_ORDER[minimum];
}

export function compareBands(a: HouseholdBand, b: HouseholdBand): number {
  return BAND_ORDER[a] - BAND_ORDER[b];
}

/* ── Membership changes ───────────────────────────────────────────────────── */

/**
 * One edit to a household's composition.
 *
 * Expressed as intents rather than as a replacement member list, for two
 * reasons. The audit trail has to say *what a person did* ("made Marilou the
 * head"), not "the member list changed from A to B". And a replacement list
 * from a stale screen silently discards a member somebody else added in the
 * meantime; an intent that no longer applies can be refused instead.
 */
export type MembershipChange =
  | { readonly kind: 'add-member'; readonly residentId: ResidentId; readonly role: HouseholdRole }
  | { readonly kind: 'remove-member'; readonly residentId: ResidentId }
  | { readonly kind: 'change-role'; readonly residentId: ResidentId; readonly role: HouseholdRole }
  | { readonly kind: 'set-head'; readonly residentId: ResidentId };

export type HouseholdProblemCode =
  | 'no-members'
  | 'no-head'
  | 'several-heads'
  | 'head-not-a-member'
  | 'duplicate-member'
  | 'member-not-found'
  | 'already-a-member'
  | 'member-in-another-household'
  | 'head-cannot-be-removed'
  | 'outside-your-barangay';

export interface HouseholdProblem {
  readonly code: HouseholdProblemCode;
  /** The resident the problem is about, when it is about one. */
  readonly residentId: ResidentId | null;
}

/**
 * A rejected composition change. Carries the failing rules and no other record's
 * detail, in the same shape as `ResidentDraftInvalidError`.
 */
export class HouseholdCompositionError extends Error {
  readonly problems: readonly HouseholdProblem[];

  constructor(problems: readonly HouseholdProblem[]) {
    super('That change would leave the household inconsistent.');
    this.name = 'HouseholdCompositionError';
    this.problems = problems;
  }
}

export function isHouseholdCompositionError(error: unknown): error is HouseholdCompositionError {
  return error instanceof HouseholdCompositionError;
}

/**
 * Applies changes in order and returns the proposed membership.
 *
 * Pure: it computes a *candidate*, and answers nothing about whether the
 * candidate may be saved. Validation is separate (`validateComposition`) so the
 * editor can show the outcome of an edit and its problems at the same time,
 * rather than refusing keystroke by keystroke.
 */
export function applyMembershipChanges(
  members: readonly HouseholdMember[],
  headResidentId: ResidentId,
  changes: readonly MembershipChange[],
): { readonly members: readonly HouseholdMember[]; readonly headResidentId: ResidentId } {
  let next = [...members];
  let head = headResidentId;

  for (const change of changes) {
    switch (change.kind) {
      case 'add-member':
        if (!next.some((member) => member.residentId === change.residentId)) {
          next = [...next, { residentId: change.residentId, role: change.role }];
        }
        break;
      case 'remove-member':
        next = next.filter((member) => member.residentId !== change.residentId);
        break;
      case 'change-role':
        next = next.map((member) =>
          member.residentId === change.residentId ? { ...member, role: change.role } : member,
        );
        break;
      case 'set-head':
        // The outgoing head keeps a place in the household; demoting them to
        // "relative" is the least wrong default and is visible in the audit
        // entry, so a person can correct it if it is wrong.
        next = next.map((member) => {
          if (member.residentId === change.residentId) {
            return { ...member, role: 'head' as const };
          }
          return member.role === 'head' ? { ...member, role: 'relative' as const } : member;
        });
        head = change.residentId;
        break;
    }
  }

  return { members: next, headResidentId: head };
}

/**
 * The invariants that make "household → family → person" mean something.
 *
 * A household with two heads, or a head who is not a member, is not a slightly
 * imperfect record — it is a record that different screens will read
 * differently, which is how a family ends up counted twice in one report and
 * not at all in another.
 */
export function validateComposition(
  members: readonly HouseholdMember[],
  headResidentId: ResidentId,
): readonly HouseholdProblem[] {
  const problems: HouseholdProblem[] = [];

  if (members.length === 0) {
    problems.push({ code: 'no-members', residentId: null });
  }

  const seen = new Set<ResidentId>();
  for (const member of members) {
    if (seen.has(member.residentId)) {
      problems.push({ code: 'duplicate-member', residentId: member.residentId });
    }
    seen.add(member.residentId);
  }

  const heads = members.filter((member) => member.role === 'head');
  if (heads.length === 0 && members.length > 0) {
    problems.push({ code: 'no-head', residentId: null });
  }
  if (heads.length > 1) {
    problems.push({ code: 'several-heads', residentId: null });
  }
  if (members.length > 0 && !seen.has(headResidentId)) {
    problems.push({ code: 'head-not-a-member', residentId: headResidentId });
  }
  if (heads.length === 1 && heads[0] !== undefined && heads[0].residentId !== headResidentId) {
    problems.push({ code: 'head-not-a-member', residentId: headResidentId });
  }

  return problems;
}

export function householdSize(household: Household): number {
  return household.members.length;
}

export function memberRole(household: Household, residentId: ResidentId): HouseholdRole | null {
  return household.members.find((member) => member.residentId === residentId)?.role ?? null;
}
