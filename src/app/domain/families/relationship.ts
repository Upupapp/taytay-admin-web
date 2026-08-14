import type { AuditStamp } from '../shared/audit';
import type { IsoDate, RelationshipId, ResidentId } from '../shared/ids';

/**
 * A relationship between two people.
 *
 * Relationships are recorded **between residents**, not between a resident and
 * a household. That is the whole point of this module: a household is an
 * address, a family is a unit of care, and a relationship is a fact about two
 * people that survives both of them moving out (`DL-47`).
 *
 * Every kind is stored in one canonical direction and read in either. `parent-of`
 * from A to B *is* `child-of` from B to A — the same fact, not two records that
 * can disagree.
 */
export type RelationshipKind =
  | 'parent-of'
  | 'spouse-of'
  | 'sibling-of'
  | 'grandparent-of'
  | 'guardian-of'
  | 'step-parent-of'
  | 'foster-parent-of'
  | 'other-relative-of';

export const RELATIONSHIP_KINDS: readonly RelationshipKind[] = [
  'parent-of',
  'spouse-of',
  'sibling-of',
  'grandparent-of',
  'guardian-of',
  'step-parent-of',
  'foster-parent-of',
  'other-relative-of',
];

/**
 * Kinds that read the same in both directions. A spouse's spouse is a spouse;
 * a parent's parent is not a parent.
 */
export const SYMMETRIC_KINDS: readonly RelationshipKind[] = ['spouse-of', 'sibling-of'];

export function isSymmetric(kind: RelationshipKind): boolean {
  return SYMMETRIC_KINDS.includes(kind);
}

/**
 * What the *other* end of the relationship is called.
 *
 * Held as data rather than derived by string surgery, because "the inverse of
 * `guardian-of` is `ward-of`" is a fact about the vocabulary and not about the
 * spelling.
 */
export type InverseKind =
  RelationshipKind | 'child-of' | 'grandchild-of' | 'ward-of' | 'step-child-of' | 'foster-child-of';

export const INVERSE_KINDS: Readonly<Record<RelationshipKind, InverseKind>> = {
  'parent-of': 'child-of',
  'spouse-of': 'spouse-of',
  'sibling-of': 'sibling-of',
  'grandparent-of': 'grandchild-of',
  'guardian-of': 'ward-of',
  'step-parent-of': 'step-child-of',
  'foster-parent-of': 'foster-child-of',
  'other-relative-of': 'other-relative-of',
};

export interface Relationship {
  readonly id: RelationshipId;
  /** The subject of the canonical direction: the parent, the guardian. */
  readonly fromResidentId: ResidentId;
  readonly toResidentId: ResidentId;
  readonly kind: RelationshipKind;
  readonly since: IsoDate | null;
  /**
   * When the relationship stopped being current. **Ending is not deleting**: a
   * former guardian is still who was responsible in 2024, and a case study
   * written then must still make sense (`DL-48`).
   */
  readonly until: IsoDate | null;
  readonly audit: AuditStamp;
}

export function isCurrent(relationship: Relationship): boolean {
  return relationship.until === null;
}

/** Both people in a relationship, in canonical order. */
export function participants(relationship: Relationship): readonly ResidentId[] {
  return [relationship.fromResidentId, relationship.toResidentId];
}

export function involves(relationship: Relationship, residentId: ResidentId): boolean {
  return relationship.fromResidentId === residentId || relationship.toResidentId === residentId;
}

/**
 * How this relationship reads *from the point of view of* one participant.
 *
 * Returns the kind to show and the other person. A screen never has to work out
 * which end it is looking at, which is where "Aldrin is the parent of Marilou"
 * comes from.
 */
export interface RelationshipFromPerspective {
  readonly relationship: Relationship;
  readonly otherResidentId: ResidentId;
  readonly kind: InverseKind;
  readonly isCurrent: boolean;
}

export function fromPerspectiveOf(
  relationship: Relationship,
  residentId: ResidentId,
): RelationshipFromPerspective | null {
  if (relationship.fromResidentId === residentId) {
    return {
      relationship,
      otherResidentId: relationship.toResidentId,
      kind: relationship.kind,
      isCurrent: isCurrent(relationship),
    };
  }
  if (relationship.toResidentId === residentId) {
    return {
      relationship,
      otherResidentId: relationship.fromResidentId,
      kind: INVERSE_KINDS[relationship.kind],
      isCurrent: isCurrent(relationship),
    };
  }
  return null;
}

/* ── Validation ───────────────────────────────────────────────────────────── */

export type RelationshipProblemCode =
  'same-person' | 'already-recorded' | 'contradicts-existing' | 'resident-not-found';

export interface RelationshipProblem {
  readonly code: RelationshipProblemCode;
  readonly residentId: ResidentId | null;
}

export class RelationshipInvalidError extends Error {
  readonly problems: readonly RelationshipProblem[];

  constructor(problems: readonly RelationshipProblem[]) {
    super('That relationship cannot be recorded as stated.');
    this.name = 'RelationshipInvalidError';
    this.problems = problems;
  }
}

export function isRelationshipInvalid(error: unknown): error is RelationshipInvalidError {
  return error instanceof RelationshipInvalidError;
}

/**
 * Whether two records describe the same link between the same two people.
 *
 * Symmetric kinds match in either direction — recording "A is the spouse of B"
 * when "B is the spouse of A" already exists is a duplicate, not a second
 * marriage.
 */
export function isSameLink(
  a: Pick<Relationship, 'fromResidentId' | 'toResidentId' | 'kind'>,
  b: Pick<Relationship, 'fromResidentId' | 'toResidentId' | 'kind'>,
): boolean {
  if (a.kind !== b.kind) {
    return false;
  }
  if (a.fromResidentId === b.fromResidentId && a.toResidentId === b.toResidentId) {
    return true;
  }
  return (
    isSymmetric(a.kind) &&
    a.fromResidentId === b.toResidentId &&
    a.toResidentId === b.fromResidentId
  );
}

/**
 * The current relationship describing the same link, if there is one.
 *
 * This is what makes recording idempotent: a retried request finds the record
 * it would have created and returns it, rather than creating a second marriage
 * or failing with "already recorded" (`DL-51`).
 */
export function findSameLink(
  existing: readonly Relationship[],
  proposed: Pick<Relationship, 'fromResidentId' | 'toResidentId' | 'kind'>,
): Relationship | null {
  return (
    existing.find((candidate) => isCurrent(candidate) && isSameLink(candidate, proposed)) ?? null
  );
}

/**
 * Rules that hold whatever else is on file.
 *
 * Deliberately few. Real families are stranger than a validator expects, and a
 * registry that refuses an unusual but true arrangement teaches staff to record
 * a false one instead (`DL-49`).
 *
 * Two of the three codes are hard refusals — a relationship from a person to
 * themselves, and one that reverses a parent link already on file. The third,
 * `already-recorded`, is *reported for a form to warn with* rather than
 * enforced: the adapter treats a duplicate as a no-op (`DL-51`).
 */
export function validateRelationship(
  proposed: Pick<Relationship, 'fromResidentId' | 'toResidentId' | 'kind'>,
  existing: readonly Relationship[],
): readonly RelationshipProblem[] {
  const problems: RelationshipProblem[] = [];

  if (proposed.fromResidentId === proposed.toResidentId) {
    problems.push({ code: 'same-person', residentId: proposed.fromResidentId });
  }

  // `already-recorded` is reported so a *form* can warn before submitting. The
  // adapter does not treat it as a failure: recording a relationship that is
  // already recorded is a no-op, not an error (`DL-51`). See `findSameLink`.
  const duplicate = findSameLink(existing, proposed);
  if (duplicate !== null) {
    problems.push({ code: 'already-recorded', residentId: proposed.toResidentId });
  }

  // A person cannot be their own ancestor. Checked one hop, because the deep
  // case needs the whole graph and belongs to the adapter that holds it.
  const reversedParent = existing.some(
    (candidate) =>
      isCurrent(candidate) &&
      candidate.kind === 'parent-of' &&
      proposed.kind === 'parent-of' &&
      candidate.fromResidentId === proposed.toResidentId &&
      candidate.toResidentId === proposed.fromResidentId,
  );
  if (reversedParent) {
    problems.push({ code: 'contradicts-existing', residentId: proposed.toResidentId });
  }

  return problems;
}
