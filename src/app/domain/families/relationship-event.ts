import type {
  FamilyId,
  HouseholdId,
  IsoDateTime,
  RelationshipEventId,
  ResidentId,
  StaffUserId,
} from '../shared/ids';
import type { FamilyRole } from './family';
import type { RelationshipKind } from './relationship';

/**
 * The history of how a family came to look the way it does.
 *
 * **Append-only, and never replaced** (`DL-48`). A relationship that ends is
 * not deleted and a transfer does not overwrite what was true before it: both
 * append an event, and the event is what a case study written last year is
 * still describing.
 *
 * Every event carries the same four things, because a change nobody can be
 * named for is a change nobody is answerable for:
 *
 *  - **what** happened, as a typed kind rather than a sentence;
 *  - **who** it happened to, as ids;
 *  - **who did it and when**, as actor and timestamp;
 *  - **why**, in the person's own words.
 *
 * The wording is copy, built from the kind and the subjects at render time, so
 * an event recorded today still reads correctly after the copy is rewritten.
 */
export type RelationshipEventKind =
  | 'family-formed'
  | 'family-dissolved'
  | 'member-joined'
  | 'member-left'
  | 'member-role-changed'
  | 'resident-transferred'
  | 'relationship-recorded'
  | 'relationship-ended'
  | 'family-household-changed';

export const RELATIONSHIP_EVENT_KINDS: readonly RelationshipEventKind[] = [
  'family-formed',
  'family-dissolved',
  'member-joined',
  'member-left',
  'member-role-changed',
  'resident-transferred',
  'relationship-recorded',
  'relationship-ended',
  'family-household-changed',
];

/**
 * The facts an event carries, beyond who did it and why.
 *
 * Optional because the kinds differ, but never free text: a screen renders
 * these through the copy module, and an export reads the same fields.
 */
export interface RelationshipEventSubject {
  readonly residentId: ResidentId | null;
  /** The other person, for an event about a pair. */
  readonly otherResidentId: ResidentId | null;
  readonly familyId: FamilyId | null;
  /** Where the person or family went, for a transfer. */
  readonly toFamilyId: FamilyId | null;
  readonly householdId: HouseholdId | null;
  readonly relationshipKind: RelationshipKind | null;
  readonly role: FamilyRole | null;
}

export const EMPTY_SUBJECT: RelationshipEventSubject = {
  residentId: null,
  otherResidentId: null,
  familyId: null,
  toFamilyId: null,
  householdId: null,
  relationshipKind: null,
  role: null,
};

export interface RelationshipEvent {
  readonly id: RelationshipEventId;
  readonly kind: RelationshipEventKind;
  readonly subject: RelationshipEventSubject;
  /** Required. An event without a reason is a change nobody can account for. */
  readonly reason: string;
  readonly actorId: StaffUserId | null;
  readonly actorName: string;
  readonly occurredAt: IsoDateTime;
}

/** Newest first. History is read from the top. */
export function byNewestFirst(a: RelationshipEvent, b: RelationshipEvent): number {
  if (a.occurredAt === b.occurredAt) {
    return 0;
  }
  return a.occurredAt < b.occurredAt ? 1 : -1;
}

export function eventsAbout(
  events: readonly RelationshipEvent[],
  residentId: ResidentId,
): readonly RelationshipEvent[] {
  return events.filter(
    (event) =>
      event.subject.residentId === residentId || event.subject.otherResidentId === residentId,
  );
}

export function eventsForFamily(
  events: readonly RelationshipEvent[],
  familyId: FamilyId,
): readonly RelationshipEvent[] {
  return events.filter(
    (event) => event.subject.familyId === familyId || event.subject.toFamilyId === familyId,
  );
}
