import { inject, Injectable } from '@angular/core';

import {
  asId,
  asIsoDate,
  asIsoDateTime,
  currentMembers,
  EMPTY_SUBJECT,
  includesResident,
  isSameLink,
  type Family,
  type FamilyId,
  type FamilyRole,
  type Relationship,
  type RelationshipEvent,
  type RelationshipEventId,
  type RelationshipEventKind,
  type RelationshipEventSubject,
  type RelationshipId,
  type RelationshipKind,
  type ResidentId,
  type ResidentTransfer,
  type StaffUserId,
} from '@domain/index';

import { MOCK_FAMILIES, MOCK_RELATIONSHIPS } from './seed/families.seed';
import { MockResidentStore } from './mock-resident.store';

export interface Actor {
  readonly id: StaffUserId | null;
  readonly name: string;
}

/**
 * Mutable mock state for families, relationships and their history.
 *
 * Two properties this store exists to guarantee:
 *
 *  - **History is append-only** (`DL-48`). Ending a relationship sets `until`
 *    and appends an event; it never removes the record. Leaving a family sets
 *    `leftOn` and appends an event; the membership row stays. Nothing here
 *    deletes.
 *  - **A transfer is one act.** The whole next state — both families, the
 *    resident's household pointer, the household member lists and the event —
 *    is computed and validated before anything is assigned, then committed with
 *    no suspension point between the assignments.
 */
@Injectable({ providedIn: 'root' })
export class MockFamilyStore {
  private readonly residents = inject(MockResidentStore);

  private families: readonly Family[] = [...MOCK_FAMILIES];
  private relationships: readonly Relationship[] = [...MOCK_RELATIONSHIPS];
  private events: readonly RelationshipEvent[] = [];
  private sequence = 0;

  allFamilies(): readonly Family[] {
    return this.families;
  }

  findFamily(id: FamilyId): Family | undefined {
    return this.families.find((family) => family.id === id);
  }

  /** Every family a person currently belongs to. Plural on purpose. */
  familiesOfResident(residentId: ResidentId): readonly Family[] {
    return this.families.filter((family) => includesResident(family, residentId));
  }

  /** Families sharing a household. A household routinely holds more than one. */
  familiesInHousehold(householdId: Family['householdId']): readonly Family[] {
    return householdId === null
      ? []
      : this.families.filter((family) => family.householdId === householdId);
  }

  allRelationships(): readonly Relationship[] {
    return this.relationships;
  }

  findRelationship(id: RelationshipId): Relationship | undefined {
    return this.relationships.find((relationship) => relationship.id === id);
  }

  relationshipsFor(residentIds: readonly ResidentId[]): readonly Relationship[] {
    const wanted = new Set(residentIds);
    return this.relationships.filter(
      (relationship) =>
        wanted.has(relationship.fromResidentId) || wanted.has(relationship.toResidentId),
    );
  }

  allEvents(): readonly RelationshipEvent[] {
    return this.events;
  }

  /* ── Relationships ──────────────────────────────────────────────────────── */

  /**
   * Records a relationship, or returns the existing one unchanged.
   *
   * Idempotent by the link rather than by an id: submitting "A is the spouse of
   * B" twice records one marriage. A retry after a dropped response must not
   * double the record.
   */
  recordRelationship(
    fromResidentId: ResidentId,
    toResidentId: ResidentId,
    kind: RelationshipKind,
    reason: string,
    actor: Actor,
  ): Relationship {
    const proposed = { fromResidentId, toResidentId, kind };
    const existing = this.relationships.find(
      (candidate) => candidate.until === null && isSameLink(candidate, proposed),
    );
    if (existing !== undefined) {
      return existing;
    }

    this.sequence += 1;
    const now = asIsoDateTime(new Date());
    const created: Relationship = {
      id: asId<RelationshipId>(`rel-${String(1000 + this.sequence)}`),
      fromResidentId,
      toResidentId,
      kind,
      since: asIsoDate(now.slice(0, 10)),
      until: null,
      audit: { createdAt: now, createdBy: actor.id, updatedAt: now, updatedBy: actor.id },
    };

    this.relationships = [...this.relationships, created];
    this.append('relationship-recorded', reason, actor, {
      ...EMPTY_SUBJECT,
      residentId: fromResidentId,
      otherResidentId: toResidentId,
      relationshipKind: kind,
    });
    return created;
  }

  /**
   * Ends a relationship. **Sets `until`; never removes the row.** A former
   * guardian is still who was responsible at the time, and a case study written
   * then must keep making sense (`DL-48`).
   */
  endRelationship(existing: Relationship, reason: string, actor: Actor): Relationship {
    if (existing.until !== null) {
      return existing;
    }
    const now = asIsoDateTime(new Date());
    const ended: Relationship = {
      ...existing,
      until: asIsoDate(now.slice(0, 10)),
      audit: { ...existing.audit, updatedAt: now, updatedBy: actor.id },
    };
    this.relationships = this.relationships.map((candidate) =>
      candidate.id === existing.id ? ended : candidate,
    );
    this.append('relationship-ended', reason, actor, {
      ...EMPTY_SUBJECT,
      residentId: existing.fromResidentId,
      otherResidentId: existing.toResidentId,
      relationshipKind: existing.kind,
    });
    return ended;
  }

  /* ── Transfers ──────────────────────────────────────────────────────────── */

  /**
   * Moves a resident between families in one act.
   *
   * Idempotent: if the person is already in the destination and out of the
   * source, the state is returned untouched and no second event is written. A
   * retried transfer must not appear twice in a family's history.
   */
  commitTransfer(transfer: ResidentTransfer, actor: Actor): void {
    const from =
      transfer.fromFamilyId === null ? null : (this.findFamily(transfer.fromFamilyId) ?? null);
    const to = transfer.toFamilyId === null ? null : (this.findFamily(transfer.toFamilyId) ?? null);

    const alreadyThere = to !== null && includesResident(to, transfer.residentId);
    const alreadyGone = from === null || !includesResident(from, transfer.residentId);
    if (alreadyThere && alreadyGone) {
      return;
    }

    const today = asIsoDate(new Date().toISOString().slice(0, 10));
    const now = asIsoDateTime(new Date());

    let next = this.families;

    if (from !== null && includesResident(from, transfer.residentId)) {
      const left: Family = {
        ...from,
        members: from.members.map((member) =>
          member.residentId === transfer.residentId && member.leftOn === null
            ? { ...member, leftOn: today }
            : member,
        ),
        audit: { ...from.audit, updatedAt: now, updatedBy: actor.id },
      };
      next = next.map((family) => (family.id === from.id ? left : family));
    }

    if (to !== null && !includesResident(to, transfer.residentId)) {
      const joined: Family = {
        ...to,
        members: [
          ...to.members,
          {
            residentId: transfer.residentId,
            role: transfer.role,
            joinedOn: today,
            leftOn: null,
          },
        ],
        audit: { ...to.audit, updatedAt: now, updatedBy: actor.id },
      };
      next = next.map((family) => (family.id === to.id ? joined : family));
    }

    // Commit. No suspension point between these, so nothing observes a person
    // who has left one family and not yet joined the other.
    this.families = next;

    if (transfer.moveHousehold && to?.householdId != null) {
      this.residents.setHousehold(transfer.residentId, to.householdId, actor.id);
    }

    this.append('resident-transferred', transfer.reason, actor, {
      ...EMPTY_SUBJECT,
      residentId: transfer.residentId,
      familyId: transfer.fromFamilyId,
      toFamilyId: transfer.toFamilyId,
      householdId: transfer.moveHousehold ? (to?.householdId ?? null) : null,
      role: transfer.role,
    });
  }

  changeRole(
    family: Family,
    residentId: ResidentId,
    role: FamilyRole,
    reason: string,
    actor: Actor,
  ): Family {
    const now = asIsoDateTime(new Date());
    const updated: Family = {
      ...family,
      members: family.members.map((member) =>
        member.residentId === residentId && member.leftOn === null ? { ...member, role } : member,
      ),
      audit: { ...family.audit, updatedAt: now, updatedBy: actor.id },
    };
    this.families = this.families.map((candidate) =>
      candidate.id === family.id ? updated : candidate,
    );
    this.append('member-role-changed', reason, actor, {
      ...EMPTY_SUBJECT,
      residentId,
      familyId: family.id,
      role,
    });
    return updated;
  }

  /* ── History ────────────────────────────────────────────────────────────── */

  /**
   * Appends one immutable event. There is deliberately no update or delete
   * counterpart: the only way the history changes is by growing.
   */
  private append(
    kind: RelationshipEventKind,
    reason: string,
    actor: Actor,
    subject: RelationshipEventSubject,
  ): void {
    this.sequence += 1;
    this.events = [
      ...this.events,
      {
        id: asId<RelationshipEventId>(`evt-${String(this.sequence).padStart(5, '0')}`),
        kind,
        subject,
        reason: reason.trim(),
        actorId: actor.id,
        actorName: actor.name,
        occurredAt: asIsoDateTime(new Date()),
      },
    ];
  }

  /** Current members of a family, as resident ids, head first. */
  memberIds(family: Family): readonly ResidentId[] {
    return [...currentMembers(family)]
      .sort((a, b) => Number(b.role === 'head') - Number(a.role === 'head'))
      .map((member) => member.residentId);
  }
}
