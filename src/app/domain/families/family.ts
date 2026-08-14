import type { AuditStamp } from '../shared/audit';
import type { BarangayId, FamilyId, HouseholdId, IsoDate, ResidentId } from '../shared/ids';

/**
 * A family unit.
 *
 * **A household is not a family.** A household is who sleeps under one roof; a
 * family is who belongs to whom. One roof routinely holds several families —
 * a widowed mother, her married son's family and a boarder cousin's — and one
 * family routinely spans two roofs, when work or care splits it.
 *
 * So a family names its own members and points at the household it *currently
 * lives in*, and neither cardinality is assumed:
 *
 *  - a household may hold **many** families, or none recorded yet;
 *  - a family may be linked to **one** household or, when it has split across
 *    addresses, to none — `householdId` is nullable and that is not an error.
 *
 * Everything else in the application already treats the household as the unit
 * of service delivery (`DL-42` onward). This does not change that. It adds the
 * unit of *relationship*, which is a different question with different answers
 * (`DL-47`).
 */
export type FamilyRole = 'head' | 'partner' | 'child' | 'dependant' | 'elder' | 'other-member';

export const FAMILY_ROLES: readonly FamilyRole[] = [
  'head',
  'partner',
  'child',
  'dependant',
  'elder',
  'other-member',
];

export const FAMILY_ROLE_LABELS: Readonly<Record<FamilyRole, string>> = {
  head: 'Family head',
  partner: 'Partner',
  child: 'Child',
  dependant: 'Dependant',
  elder: 'Elder',
  'other-member': 'Other member',
};

export interface FamilyMember {
  readonly residentId: ResidentId;
  readonly role: FamilyRole;
  readonly joinedOn: IsoDate | null;
  /** Set when the person left this family. The record stays (`DL-48`). */
  readonly leftOn: IsoDate | null;
}

export interface Family {
  readonly id: FamilyId;
  readonly referenceNumber: string;
  /** How the office refers to this family, e.g. "Bautista family". */
  readonly name: string;
  /**
   * Where the family currently lives. `null` when it is split across addresses
   * or between them — an ordinary situation, not a missing value.
   */
  readonly householdId: HouseholdId | null;
  readonly members: readonly FamilyMember[];
  readonly formedOn: IsoDate | null;
  /** A dissolved family is retained, never deleted: its history is still real. */
  readonly dissolvedOn: IsoDate | null;
  readonly audit: AuditStamp;
}

export function currentMembers(family: Family): readonly FamilyMember[] {
  return family.members.filter((member) => member.leftOn === null);
}

export function formerMembers(family: Family): readonly FamilyMember[] {
  return family.members.filter((member) => member.leftOn !== null);
}

export function isDissolved(family: Family): boolean {
  return family.dissolvedOn !== null;
}

export function includesResident(family: Family, residentId: ResidentId): boolean {
  return currentMembers(family).some((member) => member.residentId === residentId);
}

export function familyRoleOf(family: Family, residentId: ResidentId): FamilyRole | null {
  return currentMembers(family).find((member) => member.residentId === residentId)?.role ?? null;
}

/* ── Filtering ────────────────────────────────────────────────────────────── */

export interface FamilyFilter {
  readonly search?: string;
  readonly barangayId?: BarangayId;
  readonly householdId?: HouseholdId;
  /** Families with no household link — split, or between addresses. */
  readonly unhousedOnly?: boolean;
  readonly includeDissolved?: boolean;
}

export type FamilySortField = 'reference' | 'name' | 'size' | 'updatedAt';

export function isFamilyFilterActive(filter: FamilyFilter): boolean {
  return (
    Boolean(filter.search) ||
    filter.barangayId !== undefined ||
    filter.householdId !== undefined ||
    filter.unhousedOnly === true ||
    filter.includeDissolved === true
  );
}

/* ── Membership changes ───────────────────────────────────────────────────── */

/**
 * Moving a person between families.
 *
 * Modelled as one intent rather than a leave-then-join pair, because the two
 * halves must not be separable: a transfer that recorded the leaving and failed
 * the joining would drop a person out of every family in the registry, and the
 * screen that did it would look like it had worked.
 */
export interface ResidentTransfer {
  readonly residentId: ResidentId;
  /** `null` means "out of this family and into none" — a real destination. */
  readonly toFamilyId: FamilyId | null;
  readonly fromFamilyId: FamilyId | null;
  readonly role: FamilyRole;
  /** Whether the household should follow. Often it does not: a child boards away. */
  readonly moveHousehold: boolean;
  readonly reason: string;
}

export type TransferProblemCode =
  | 'resident-not-found'
  | 'family-not-found'
  | 'already-in-family'
  | 'not-in-source-family'
  | 'family-dissolved'
  | 'outside-your-barangay'
  | 'no-reason'
  | 'would-orphan-head';

export interface TransferProblem {
  readonly code: TransferProblemCode;
  readonly residentId: ResidentId | null;
}

export class TransferRefusedError extends Error {
  readonly problems: readonly TransferProblem[];

  constructor(problems: readonly TransferProblem[]) {
    super('That transfer would leave the registry inconsistent.');
    this.name = 'TransferRefusedError';
    this.problems = problems;
  }
}

export function isTransferRefused(error: unknown): error is TransferRefusedError {
  return error instanceof TransferRefusedError;
}

export const TRANSFER_REASON_MIN_LENGTH = 8;

export function isValidTransferReason(reason: string): boolean {
  return reason.trim().length >= TRANSFER_REASON_MIN_LENGTH;
}

/**
 * Whether this exact move has already landed.
 *
 * Checked **before** validation, not after, because the two answer different
 * questions. Validation asks "may this happen?"; this asks "has it?" — and a
 * transfer that has already happened must succeed quietly rather than fail with
 * "that person is not in this family", which is true but useless. A retry after
 * a dropped response is the ordinary case, not an error (`DL-51`).
 */
export function isTransferAlreadyApplied(
  transfer: ResidentTransfer,
  from: Family | null,
  to: Family | null,
): boolean {
  const outOfSource = from === null || !includesResident(from, transfer.residentId);
  const inDestination = to === null ? true : includesResident(to, transfer.residentId);
  // Moving somebody out of everything is only "already applied" when there was
  // a source to leave; otherwise the request never described a change at all.
  return transfer.toFamilyId === null ? from !== null && outOfSource : outOfSource && inDestination;
}

/**
 * Rules a transfer must satisfy that need only the two families to answer.
 * Existence and scope are the adapter's, since only it holds the registry.
 */
export function validateTransfer(
  transfer: ResidentTransfer,
  from: Family | null,
  to: Family | null,
): readonly TransferProblem[] {
  const problems: TransferProblem[] = [];

  if (!isValidTransferReason(transfer.reason)) {
    problems.push({ code: 'no-reason', residentId: transfer.residentId });
  }

  if (from !== null && !includesResident(from, transfer.residentId)) {
    problems.push({ code: 'not-in-source-family', residentId: transfer.residentId });
  }

  if (to !== null) {
    if (isDissolved(to)) {
      problems.push({ code: 'family-dissolved', residentId: null });
    }
    if (includesResident(to, transfer.residentId)) {
      problems.push({ code: 'already-in-family', residentId: transfer.residentId });
    }
  }

  // Moving the last head out leaves a family nobody is answerable for. It is
  // allowed only when the family is being emptied entirely, which the caller
  // expresses by transferring every member.
  if (
    from !== null &&
    familyRoleOf(from, transfer.residentId) === 'head' &&
    currentMembers(from).length > 1
  ) {
    problems.push({ code: 'would-orphan-head', residentId: transfer.residentId });
  }

  return problems;
}
