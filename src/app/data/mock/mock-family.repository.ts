import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  assignGenerations,
  byNewestFirst,
  currentMembers,
  discloseMember,
  eventsAbout,
  eventsForFamily,
  FamilyDraftInvalidError,
  familyRoleOf,
  findSameLink,
  fromPerspectiveOf,
  hasSensitiveSector,
  headOfFamily,
  isTransferAlreadyApplied,
  isWithinBarangayScope,
  PermissionDeniedError,
  RelationshipInvalidError,
  TransferRefusedError,
  userHasPermission,
  validateFamilyDraft,
  validateRelationship,
  validateTransfer,
  type AuthenticatedUser,
  type BarangayId,
  type CursorPage,
  type CursorRequest,
  type Family,
  type FamilyDetail,
  type FamilyDraft,
  type FamilyDraftProblem,
  type FamilyFilter,
  type FamilyId,
  type FamilyRepository,
  type FamilyRole,
  type FamilySummary,
  type GraphEdge,
  type GraphNode,
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
 *
 * The list answers as the API does: a page by reference number with a cursor and
 * no total, searched by reference, name and the head's surname. In a family with
 * a protected member, every member's own street is withheld from a reader not
 * cleared for the protected tier, as the API withholds it.
 */
@Injectable()
export class MockFamilyRepository implements FamilyRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly families = inject(MockFamilyStore);
  private readonly residents = inject(MockResidentStore);

  list(filter: FamilyFilter, page: CursorRequest): Observable<CursorPage<FamilySummary>> {
    const user = this.access.currentUser();
    const denied = denyUnless<CursorPage<FamilySummary>>(user, 'family.view');
    if (denied) {
      return denied;
    }
    // Asking for another barangay is refused, as the API refuses it, rather than answered with an
    // empty page that reads as "no families there".
    if (filter.barangayId !== undefined && !isWithinBarangayScope(user, filter.barangayId)) {
      return throwError(() => new PermissionDeniedError('family.view'));
    }

    const matching = this.families
      .allFamilies()
      .filter((family) => this.inScope(family, user))
      .filter((family) => this.matches(family, filter))
      // The API's order: reference number, then id — a total order, as a cursor needs.
      .sort(byReference);

    // The cursor is the id of the last row read, as the API's is; nothing outside this adapter reads it.
    const after = page.cursor ? matching.findIndex((family) => family.id === page.cursor) : -1;
    const rest = matching.slice(after + 1);
    const items = rest.slice(0, page.limit).map((family) => this.summarise(family, user));
    const hasMore = rest.length > page.limit;
    return this.latency.respond({
      items,
      hasMore,
      nextCursor: hasMore ? (items.at(-1)?.family.id ?? null) : null,
    });
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

  create(draft: FamilyDraft, reason: string): Observable<FamilyDetail> {
    const user = this.access.currentUser();
    const denied = denyUnless<FamilyDetail>(user, 'family.manage');
    if (denied) {
      return denied;
    }

    const problems: FamilyDraftProblem[] = [...validateFamilyDraft(draft, reason)];
    // A household or a person outside the writer's scope is "not on file", as the API answers it.
    if (draft.householdId !== null) {
      const household = this.residents.findHousehold(draft.householdId);
      if (household === undefined || !isWithinBarangayScope(user, household.address.barangayId)) {
        problems.push({ code: 'household-not-found', residentId: null });
      }
    }
    for (const residentId of new Set(draft.members.map((member) => member.residentId))) {
      const resident = this.residents.find(residentId);
      if (resident === undefined || !isWithinBarangayScope(user, resident.address.barangayId)) {
        problems.push({ code: 'resident-not-found', residentId });
      }
    }
    if (problems.length > 0) {
      return throwError(() => new FamilyDraftInvalidError(problems));
    }

    const created = this.families.createFamily(draft, reason.trim(), actorOf(user));
    return this.latency.respond(this.detail(created, user));
  }

  familiesOf(residentId: ResidentId): Observable<readonly FamilySummary[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly FamilySummary[]>(user, 'family.view');
    if (denied) {
      return denied;
    }
    return this.latency.respond(
      [...this.families.familiesOfResident(residentId)]
        .filter((family) => this.inScope(family, user))
        .sort(byReference)
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

  /**
   * Whether somebody currently in the family, or anybody in the household it lives in, is under a
   * protected sector — the API's test for withholding every member's own street from a reader not
   * cleared for it. A second family at a protected person's address lives on her street too.
   */
  private sharesProtectedAddress(family: Family): boolean {
    const household =
      family.householdId === null ? undefined : this.residents.findHousehold(family.householdId);
    const people = [
      ...this.families.memberIds(family),
      ...(household?.members.map((member) => member.residentId) ?? []),
    ];
    return people.some((residentId) => {
      const resident = this.residents.find(residentId);
      return resident !== undefined && hasSensitiveSector(resident);
    });
  }

  private summarise(family: Family, user: AuthenticatedUser | null): FamilySummary {
    const members = this.families.memberIds(family);
    const headId = headOfFamily(family);
    const head = headId === null ? undefined : this.residents.find(headId);
    const household =
      family.householdId === null ? undefined : this.residents.findHousehold(family.householdId);

    return {
      family,
      headName: head
        ? this.disclose(head, user, this.sharesProtectedAddress(family)).listedName
        : 'No head recorded',
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
    const generations = assignGenerations(everyone, headOfFamily(family), relationships);
    const sharesProtected = this.sharesProtectedAddress(family);

    const nodes: readonly GraphNode[] = everyone
      .map((residentId) => {
        const resident = this.residents.find(residentId);
        if (resident === undefined) {
          return null;
        }
        const view = this.disclose(resident, user, sharesProtected);
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
          // A name only: no address is read off it, so only the name's own rule applies.
          otherName: other ? this.disclose(other, user, false).listedName : 'Unknown resident',
          isCurrent: perspective.isCurrent,
          since: relationship.since,
          until: relationship.until,
        };
      })
      .filter((edge): edge is GraphEdge => edge !== null);
  }

  private disclose(
    resident: Resident,
    user: AuthenticatedUser | null,
    sharesProtectedAddress: boolean,
  ): ResidentView {
    return discloseMember(
      resident,
      (permission: Permission) => userHasPermission(user, permission),
      sharesProtectedAddress,
    );
  }

  /**
   * The API's filter: dissolved families only on request, and every word of the search — five at
   * most — matching the reference number, the name or the surname of the member recorded as head.
   */
  private matches(family: Family, filter: FamilyFilter): boolean {
    if (!filter.includeDissolved && family.dissolvedOn !== null) {
      return false;
    }
    if (filter.barangayId !== undefined && this.barangayOf(family) !== filter.barangayId) {
      return false;
    }
    if (filter.householdId !== undefined && family.householdId !== filter.householdId) {
      return false;
    }
    if (filter.unhousedOnly && family.householdId !== null) {
      return false;
    }
    const words = (filter.search ?? '')
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word !== '');
    if (words.length === 0) {
      return true;
    }
    const heads = currentMembers(family)
      .filter((member) => member.role === 'head')
      .map((member) => this.residents.find(member.residentId)?.name.last.toLowerCase() ?? '');
    const reference = family.referenceNumber.toLowerCase();
    const name = family.name.toLowerCase();
    return words
      .slice(0, 5)
      .every(
        (word) =>
          reference.includes(word) ||
          name.includes(word) ||
          heads.some((surname) => surname.includes(word)),
      );
  }

  /** The barangay of the household a family lives in; `null` between addresses. */
  private barangayOf(family: Family): BarangayId | null {
    return family.householdId === null
      ? null
      : (this.residents.findHousehold(family.householdId)?.address.barangayId ?? null);
  }
}

function actorOf(user: AuthenticatedUser | null) {
  return { id: user?.id ?? null, name: user?.displayName ?? 'Unknown' };
}

function byReference(a: Family, b: Family): number {
  if (a.referenceNumber !== b.referenceNumber) {
    return a.referenceNumber < b.referenceNumber ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
