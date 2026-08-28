import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  assignGenerations,
  barangayName,
  byNewestFirst,
  currentMembers,
  discloseResident,
  eventsAbout,
  eventsForFamily,
  familyRoleOf,
  findSameLink,
  fromPerspectiveOf,
  isFamilyFilterActive,
  isTransferAlreadyApplied,
  isWithinBarangayScope,
  paginate,
  PermissionDeniedError,
  RelationshipInvalidError,
  TransferRefusedError,
  userHasPermission,
  validateRelationship,
  validateTransfer,
  type AuthenticatedUser,
  type Family,
  type FamilyDetail,
  type FamilyFilter,
  type FamilyId,
  type FamilyRepository,
  type FamilyRole,
  type FamilySortField,
  type FamilySummary,
  type GraphEdge,
  type GraphNode,
  type Page,
  type PageRequest,
  type Permission,
  type Relationship,
  type RelationshipEvent,
  type RelationshipId,
  type RelationshipKind,
  type Resident,
  type ResidentId,
  type ResidentTransfer,
  type ResidentView,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockFamilyStore } from './mock-family.store';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';
import { matchesSearch, sortItems } from './mock-query';

/**
 * The family adapter.
 *
 * Scope is answered through the household a family currently lives in, and a
 * family with no household is visible municipality-wide — because a family
 * between addresses belongs to nobody's barangay yet, and hiding it from
 * everyone is how a family in transit stops being followed up.
 *
 * Reads disclose members through the same policy as everywhere else (`DL-38`),
 * and every mutation appends an immutable event rather than replacing what was
 * there (`DL-48`).
 */
@Injectable()
export class MockFamilyRepository implements FamilyRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly families = inject(MockFamilyStore);
  private readonly residents = inject(MockResidentStore);

  list(filter: FamilyFilter, page: PageRequest<FamilySortField>): Observable<Page<FamilySummary>> {
    const user = this.access.currentUser();
    const denied = denyUnless<Page<FamilySummary>>(user, 'family.view');
    if (denied) {
      return denied;
    }

    const summaries = this.families
      .allFamilies()
      .filter((family) => this.inScope(family, user))
      .map((family) => this.summarise(family, user))
      .filter((summary) => this.matches(summary, filter));

    const sort = page.sort ?? { field: 'reference' as const, direction: 'asc' as const };
    const sorted = sortItems(summaries, (summary) => sortKey(summary, sort.field), sort.direction);
    return this.latency.respond(paginate(sorted, page));
  }

  getById(id: FamilyId): Observable<FamilyDetail | null> {
    const user = this.access.currentUser();
    const family = this.families.findFamily(id);

    // Out of scope reads exactly like "does not exist" (`DL-31`).
    if (!family || !userHasPermission(user, 'family.view') || !this.inScope(family, user)) {
      return this.latency.respond(null);
    }
    return this.latency.respond(this.detail(family, user));
  }

  familiesOf(residentId: ResidentId): Observable<readonly FamilySummary[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly FamilySummary[]>(user, 'family.view');
    if (denied) {
      return denied;
    }
    return this.latency.respond(
      this.families
        .familiesOfResident(residentId)
        .filter((family) => this.inScope(family, user))
        .map((family) => this.summarise(family, user)),
    );
  }

  recordRelationship(
    fromResidentId: ResidentId,
    toResidentId: ResidentId,
    kind: RelationshipKind,
    reason: string,
  ): Observable<Relationship> {
    const user = this.access.currentUser();
    const denied = denyUnless<Relationship>(user, 'family.manage');
    if (denied) {
      return denied;
    }
    if (reason.trim().length === 0) {
      return throwError(() => new Error('Say why this relationship is being recorded.'));
    }

    for (const residentId of [fromResidentId, toResidentId]) {
      const resident = this.residents.find(residentId);
      if (!resident || !isWithinBarangayScope(user, resident.address.barangayId)) {
        return throwError(() => new PermissionDeniedError('family.manage'));
      }
    }

    // Already recorded is already done. Answering "here is that relationship"
    // is a complete and correct response to "record this relationship", and a
    // retried request must not create a second one (`DL-51`).
    const existing = findSameLink(this.families.allRelationships(), {
      fromResidentId,
      toResidentId,
      kind,
    });
    if (existing !== null) {
      return this.latency.respond(existing);
    }

    const problems = validateRelationship(
      { fromResidentId, toResidentId, kind },
      this.families.allRelationships(),
    ).filter((problem) => problem.code !== 'already-recorded');
    if (problems.length > 0) {
      return throwError(() => new RelationshipInvalidError(problems));
    }

    return this.latency.respond(
      this.families.recordRelationship(fromResidentId, toResidentId, kind, reason, actorOf(user)),
    );
  }

  endRelationship(
    _residentId: ResidentId,
    id: RelationshipId,
    reason: string,
  ): Observable<Relationship> {
    const user = this.access.currentUser();
    const denied = denyUnless<Relationship>(user, 'family.manage');
    if (denied) {
      return denied;
    }
    if (reason.trim().length === 0) {
      return throwError(() => new Error('Say why this relationship has ended.'));
    }

    const existing = this.families.findRelationship(id);
    if (existing === undefined) {
      return throwError(() => new PermissionDeniedError('family.manage'));
    }
    const subject = this.residents.find(existing.fromResidentId);
    if (!subject || !isWithinBarangayScope(user, subject.address.barangayId)) {
      return throwError(() => new PermissionDeniedError('family.manage'));
    }

    return this.latency.respond(this.families.endRelationship(existing, reason, actorOf(user)));
  }

  transferResident(transfer: ResidentTransfer): Observable<FamilyDetail> {
    const user = this.access.currentUser();
    const denied = denyUnless<FamilyDetail>(user, 'family.manage');
    if (denied) {
      return denied;
    }

    const resident = this.residents.find(transfer.residentId);
    if (!resident || !isWithinBarangayScope(user, resident.address.barangayId)) {
      return throwError(() => new PermissionDeniedError('family.manage'));
    }

    const from =
      transfer.fromFamilyId === null
        ? null
        : (this.families.findFamily(transfer.fromFamilyId) ?? null);
    const to =
      transfer.toFamilyId === null ? null : (this.families.findFamily(transfer.toFamilyId) ?? null);

    if (
      (transfer.fromFamilyId !== null && from === null) ||
      (transfer.toFamilyId !== null && to === null)
    ) {
      return throwError(
        () =>
          new TransferRefusedError([{ code: 'family-not-found', residentId: transfer.residentId }]),
      );
    }
    for (const family of [from, to]) {
      if (family !== null && !this.inScope(family, user)) {
        return throwError(
          () =>
            new TransferRefusedError([
              { code: 'outside-your-barangay', residentId: transfer.residentId },
            ]),
        );
      }
    }

    // Asked before "may this happen?", because a transfer that has already
    // landed must succeed quietly rather than fail with a true but useless
    // "that person is not in this family" (`DL-51`).
    if (!isTransferAlreadyApplied(transfer, from, to)) {
      const problems = validateTransfer(transfer, from, to);
      if (problems.length > 0) {
        return throwError(() => new TransferRefusedError(problems));
      }
      this.families.commitTransfer(transfer, actorOf(user));
    }

    // The destination is what the caller wants to look at next; when there is
    // none, the source still exists and still explains where the person went.
    const landing = transfer.toFamilyId ?? transfer.fromFamilyId;
    const family = landing === null ? null : (this.families.findFamily(landing) ?? null);
    if (family === null) {
      return throwError(
        () =>
          new TransferRefusedError([{ code: 'family-not-found', residentId: transfer.residentId }]),
      );
    }
    return this.latency.respond(this.detail(family, user));
  }

  changeMemberRole(
    familyId: FamilyId,
    residentId: ResidentId,
    role: FamilyRole,
    reason: string,
  ): Observable<Family> {
    const user = this.access.currentUser();
    const denied = denyUnless<Family>(user, 'family.manage');
    if (denied) {
      return denied;
    }
    if (reason.trim().length === 0) {
      return throwError(() => new Error('Say why the role is changing.'));
    }
    const family = this.families.findFamily(familyId);
    if (!family || !this.inScope(family, user)) {
      return throwError(() => new PermissionDeniedError('family.manage'));
    }
    if (familyRoleOf(family, residentId) === null) {
      return throwError(
        () => new TransferRefusedError([{ code: 'not-in-source-family', residentId }]),
      );
    }
    return this.latency.respond(
      this.families.changeRole(family, residentId, role, reason, actorOf(user)),
    );
  }

  historyForResident(residentId: ResidentId): Observable<readonly RelationshipEvent[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly RelationshipEvent[]>(user, 'family.view');
    if (denied) {
      return denied;
    }
    const resident = this.residents.find(residentId);
    if (!resident || !isWithinBarangayScope(user, resident.address.barangayId)) {
      // Absent, not forbidden — the same non-leaking answer as everywhere else.
      return this.latency.respond([]);
    }
    return this.latency.respond(
      [...eventsAbout(this.families.allEvents(), residentId)].sort(byNewestFirst),
    );
  }

  /* ── assembly ───────────────────────────────────────────────────────────── */

  /**
   * A family is in scope when the household it lives in is. A family with no
   * household is in scope for everyone: it belongs to no barangay yet, and
   * hiding it from all of them is how a family in transit is lost.
   */
  private inScope(family: Family, user: AuthenticatedUser | null): boolean {
    if (family.householdId === null) {
      return user !== null;
    }
    const household = this.residents.findHousehold(family.householdId);
    return household === undefined
      ? user !== null
      : isWithinBarangayScope(user, household.address.barangayId);
  }

  private summarise(family: Family, user: AuthenticatedUser | null): FamilySummary {
    const members = this.families.memberIds(family);
    const head = members[0] === undefined ? undefined : this.residents.find(members[0]);
    const household =
      family.householdId === null ? undefined : this.residents.findHousehold(family.householdId);

    return {
      family,
      headName: head ? this.disclose(head, user).listedName : 'No head recorded',
      memberCount: currentMembers(family).length,
      householdReference: household?.referenceNumber ?? null,
      barangayId: household?.address.barangayId ?? null,
      relationshipCount: this.families
        .relationshipsFor(members)
        .filter((relationship) => relationship.until === null).length,
    };
  }

  private detail(family: Family, user: AuthenticatedUser | null): FamilyDetail {
    const memberIds = this.families.memberIds(family);
    // Former members stay in the graph, marked as former. A person who left is
    // still part of how this family came to look the way it does (`DL-48`).
    const everyone = [...new Set([...memberIds, ...family.members.map((m) => m.residentId)])];
    const relationships = this.families.relationshipsFor(everyone);
    const generations = assignGenerations(everyone, memberIds[0] ?? null, relationships);

    const nodes: readonly GraphNode[] = everyone
      .map((residentId) => {
        const resident = this.residents.find(residentId);
        if (resident === undefined) {
          return null;
        }
        const view = this.disclose(resident, user);
        return {
          view,
          role: familyRoleOf(family, residentId),
          isCurrentMember: memberIds.includes(residentId),
          generation: generations.get(residentId) ?? 0,
          edges: this.edgesFor(residentId, relationships, user),
        };
      })
      .filter((node): node is GraphNode => node !== null)
      .sort((a, b) => a.generation - b.generation);

    const others = this.families
      .familiesInHousehold(family.householdId)
      .filter((candidate) => candidate.id !== family.id)
      .map((candidate) => this.summarise(candidate, user));

    return {
      family,
      graph: { nodes, edges: relationships },
      othersInHousehold: others,
      history: [...eventsForFamily(this.families.allEvents(), family.id)].sort(byNewestFirst),
      audit: [],
    };
  }

  private edgesFor(
    residentId: ResidentId,
    relationships: readonly Relationship[],
    user: AuthenticatedUser | null,
  ): readonly GraphEdge[] {
    return relationships
      .map((relationship) => {
        const perspective = fromPerspectiveOf(relationship, residentId);
        if (perspective === null) {
          return null;
        }
        const other = this.residents.find(perspective.otherResidentId);
        return {
          relationshipId: relationship.id,
          kind: perspective.kind,
          otherResidentId: perspective.otherResidentId,
          otherName: other ? this.disclose(other, user).listedName : 'Unknown resident',
          isCurrent: perspective.isCurrent,
          since: relationship.since,
          until: relationship.until,
        };
      })
      .filter((edge): edge is GraphEdge => edge !== null);
  }

  private disclose(resident: Resident, user: AuthenticatedUser | null): ResidentView {
    return discloseResident(resident, (permission: Permission) =>
      userHasPermission(user, permission),
    );
  }

  private matches(summary: FamilySummary, filter: FamilyFilter): boolean {
    if (!isFamilyFilterActive(filter)) {
      return summary.family.dissolvedOn === null;
    }
    if (!filter.includeDissolved && summary.family.dissolvedOn !== null) {
      return false;
    }
    if (filter.barangayId && summary.barangayId !== filter.barangayId) {
      return false;
    }
    if (filter.householdId && summary.family.householdId !== filter.householdId) {
      return false;
    }
    if (filter.unhousedOnly && summary.family.householdId !== null) {
      return false;
    }
    return matchesSearch(
      [
        summary.family.referenceNumber,
        summary.family.name,
        summary.headName,
        summary.householdReference,
        summary.barangayId === null ? null : barangayName(summary.barangayId),
      ],
      filter.search,
    );
  }
}

function actorOf(user: AuthenticatedUser | null) {
  return { id: user?.id ?? null, name: user?.displayName ?? 'Unknown' };
}

function sortKey(summary: FamilySummary, field: FamilySortField): string | number {
  switch (field) {
    case 'reference':
      return summary.family.referenceNumber;
    case 'name':
      return summary.family.name;
    case 'size':
      return summary.memberCount;
    case 'updatedAt':
      return summary.family.audit.updatedAt;
  }
}
