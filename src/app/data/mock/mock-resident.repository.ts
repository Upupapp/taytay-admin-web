import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  canReadRecord,
  discloseHousehold,
  discloseMember,
  discloseResident,
  hasSensitiveSector,
  householdClearance,
  isInAgeGroup,
  isWithinBarangayScope,
  PermissionDeniedError,
  ResidentDraftInvalidError,
  userHasPermission,
  validateResidentDraft,
  type AuthenticatedUser,
  type HouseholdMemberView,
  type Household,
  type CursorPage,
  type CursorRequest,
  type Permission,
  type Resident,
  type ResidentDraft,
  type ResidentFilter,
  type ResidentId,
  type ResidentProfile,
  type ResidentRepository,
  type ResidentView,

  isSensitiveSector,
  type VulnerabilitySector,
} from '@domain/index';

import { historySummaryFor } from './mock-assistance-history';
import { denyUnless } from './mock-access';
import { MockAssistanceRequestStore } from './mock-assistance-request.store';
import { MockCaseStore } from './mock-case.store';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';

/**
 * The registry adapter.
 *
 * Three rules it exists to keep, all of them re-checked here rather than only in
 * the UI (`DL-30`):
 *
 *  - **Permission.** Every method opens with `denyUnless`, and refusals travel
 *    as stream errors so `toViewState` turns them into an error panel instead of
 *    an uncaught exception.
 *  - **Scope.** A `barangay-link` cannot reach, create or edit a record outside
 *    their barangay by editing a filter or a URL.
 *  - **Disclosure.** Reads return `ResidentView`, already redacted. A screen
 *    cannot leak an attribute it was never handed (`DL-38`).
 */
@Injectable()
export class MockResidentRepository implements ResidentRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly store = inject(MockResidentStore);
  private readonly requests = inject(MockAssistanceRequestStore);
  private readonly cases = inject(MockCaseStore);

  /**
   * Whether this reader may read this person, as the API decides it (`DL-183`): their barangay for
   * everybody but a caseload, and for a caseload its own clients — the subject of a filed request
   * or a case assigned to it — and nobody else.
   */
  private readable(user: AuthenticatedUser | null, resident: Resident): boolean {
    if (!canReadRecord(user, 'resident.view', resident.address.barangayId)) {
      return false;
    }
    if (user === null || user.scope !== 'assigned-cases') {
      return true;
    }
    return (
      this.requests.requests.some(
        (request) =>
          request.residentId === resident.id &&
          request.referenceNumber !== '' &&
          request.assignedTo === user.id,
      ) ||
      this.cases
        .allCases()
        .some((record) => record.subjectResidentId === resident.id && record.assignedTo === user.id)
    );
  }

  list(filter: ResidentFilter, page: CursorRequest): Observable<CursorPage<ResidentView>> {
    const user = this.access.currentUser();
    const denied = denyUnless<CursorPage<ResidentView>>(user, 'resident.view');
    if (denied) {
      return denied;
    }
    // The registry's list is not a caseload's: it reads its own clients one at a time (`DL-183`).
    if (user?.scope === 'assigned-cases') {
      return throwError(() => new PermissionDeniedError('resident.view'));
    }

    // A filter can only narrow what scope allows. Asking for another barangay is refused, as the
    // API refuses it, rather than answered with an empty page that reads as "nobody there".
    if (filter.barangayId !== undefined && !isWithinBarangayScope(user, filter.barangayId)) {
      return throwError(() => new PermissionDeniedError('resident.view'));
    }

    // Listing who is in a protected sector is the disclosure itself, masked names or not; the API
    // refuses the filter without the grant, and so does this (`DL-174`).
    const cleared = userHasPermission(user, 'request.view-sensitive');
    if (filter.sector !== undefined && isSensitiveSector(filter.sector) && !cleared) {
      return throwError(() => new PermissionDeniedError('request.view-sensitive'));
    }

    // Out-of-scope records are *silently omitted* rather than refused: an error
    // that emptied the page would itself disclose that something was withheld.
    const filtered = this.store
      .all()
      .filter(
        (resident) =>
          isWithinBarangayScope(user, resident.address.barangayId) &&
          matchesFilter(resident, filter, cleared),
      );

    // The server's order, which a caller does not choose (`DL-174`): surname, given name, id.
    const sorted = [...filtered].sort(byRegistryOrder);
    // An offset stands in for the server's opaque cursor; it is never parsed outside this adapter.
    const start = page.cursor ? Number.parseInt(page.cursor, 10) || 0 : 0;
    const end = start + page.limit;
    const hasMore = end < sorted.length;
    return this.latency.respond({
      // Only the page in hand is disclosed — the policy runs over 20 records,
      // not over the whole registry, so a large result set stays cheap.
      items: sorted.slice(start, end).map((resident) => this.disclose(resident, user)),
      hasMore,
      nextCursor: hasMore ? String(end) : null,
    });
  }

  getById(id: ResidentId): Observable<ResidentView | null> {
    const user = this.access.currentUser();
    const resident = this.store.find(id);

    // Out of scope is reported exactly like "does not exist". A distinguishable
    // refusal would confirm that this resident is on file, which is precisely
    // what the scope rule exists to withhold (`DL-31`).
    if (!resident || !this.readable(user, resident)) {
      return this.latency.respond(null);
    }
    return this.latency.respond(this.disclose(resident, user));
  }


  getProfile(id: ResidentId): Observable<ResidentProfile | null> {
    const user = this.access.currentUser();
    const resident = this.store.find(id);
    if (!resident || !this.readable(user, resident)) {
      return this.latency.respond(null);
    }

    const household =
      resident.householdId !== null
        ? (this.store.findHousehold(resident.householdId) ?? null)
        : null;
    // As the API answers it: the household disclosed for this reader, and everyone else under the
    // roof without their own street beside a protected member (`DL-38`).
    const isProtected =
      household !== null &&
      household.members.some((member) => {
        const person = this.store.find(member.residentId);
        return person !== undefined && hasSensitiveSector(person);
      });
    const clearance = householdClearance((permission) => userHasPermission(user, permission));

    return this.latency.respond({
      view: this.disclose(resident, user),
      household:
        household === null ? null : discloseHousehold(household, isProtected, clearance).household,
      // The mock holds a role for every membership, so it can always answer.
      householdMembers: {
        kind: 'read',
        members: this.householdMembersOf(resident, household, user, isProtected),
      },
      // The mock holds every request, payout and referral, so it can always answer.
      history: { kind: 'read', history: historySummaryFor(resident.id) },
    });
  }

  create(draft: ResidentDraft): Observable<Resident> {
    const user = this.access.currentUser();
    const denied = denyUnless<Resident>(user, 'resident.create');
    if (denied) {
      return denied;
    }
    // A write to another barangay is an *action*, not a lookup, so refusing it
    // discloses nothing about who is on file there.
    if (!isWithinBarangayScope(user, draft.address.barangayId)) {
      return throwError(() => new PermissionDeniedError('resident.create'));
    }
    const unreadable = refuseUnreadableWrites<Resident>(user, draft);
    if (unreadable) {
      return unreadable;
    }
    const invalid = rejectIfInvalid<Resident>(draft);
    if (invalid) {
      return invalid;
    }
    return this.latency.respond(this.store.add(draft, user?.id ?? null));
  }

  update(id: ResidentId, draft: ResidentDraft): Observable<Resident> {
    const user = this.access.currentUser();
    const denied = denyUnless<Resident>(user, 'resident.update');
    if (denied) {
      return denied;
    }

    const existing = this.store.find(id);
    // Both the record as it stands and the record as proposed must be in scope,
    // or an edit becomes a way to move someone out of your reach — or into it.
    if (
      !existing ||
      !isWithinBarangayScope(user, existing.address.barangayId) ||
      !isWithinBarangayScope(user, draft.address.barangayId)
    ) {
      return throwError(() => new PermissionDeniedError('resident.update'));
    }

    // You may not edit a record you cannot fully see. A draft is a *replacement*,
    // so saving one built from a redacted copy would quietly delete the very
    // attributes that were withheld — a protection case's contact details among
    // them. Enforced here, not only by hiding the form (`DL-39`).
    const disclosed = this.disclose(existing, user);
    if (disclosed.withheld.length > 0) {
      return throwError(() => new PermissionDeniedError('resident.update'));
    }

    const invalid = rejectIfInvalid<Resident>(draft);
    if (invalid) {
      return invalid;
    }
    return this.latency.respond(this.store.replace(existing, draft, user?.id ?? null));
  }

  /**
   * The reason is required here as on the server, and **not kept** — `MockResidentStore` has no
   * history to hold it, the same thinness as the sectors' reasons below.
   */
  setActive(id: ResidentId, isActive: boolean, reason: string): Observable<Resident> {
    const user = this.access.currentUser();
    const denied = denyUnless<Resident>(user, 'resident.deactivate');
    if (denied) {
      return denied;
    }
    if (reason.trim().length === 0) {
      return throwError(() => new Error('A reason is required to retire or restore a record.'));
    }
    const existing = this.store.find(id);
    if (!existing || !isWithinBarangayScope(user, existing.address.barangayId)) {
      return throwError(() => new PermissionDeniedError('resident.deactivate'));
    }
    return this.latency.respond(this.store.setActive(existing, isActive, user?.id ?? null));
  }

  /**
   * Recording a sector needs `resident.manage`, and a safeguarding one needs the sensitive grant.
   *
   * The mock refuses the same combination the API does. A stand-in that were more permissive would
   * let a screen be built against a boundary the real server enforces — which is the failure the
   * whole mock/HTTP seam exists to avoid.
   */
  recordSector(id: ResidentId, sector: VulnerabilitySector): Observable<void> {
    return this.writeSector(id, sector, true);
  }

  /**
   * The port's `reason` is **not accepted here**, and that is a real limitation of the mock rather
   * than a tidy-up: `Resident.sectors` is a list of codes with nowhere to hold why each was
   * recorded. The server keeps it on the audit trail, so this seam is thinner than the real one —
   * worth knowing before trusting a screen built only against the mock.
   */
  endSector(id: ResidentId, sector: VulnerabilitySector): Observable<void> {
    return this.writeSector(id, sector, false);
  }

  private writeSector(
    id: ResidentId,
    sector: VulnerabilitySector,
    present: boolean,
  ): Observable<void> {
    const user = this.access.currentUser();
    const denied = denyUnless<void>(user, 'resident.update');
    if (denied) {
      return denied;
    }

    if (isSensitiveSector(sector) && !userHasPermission(user, 'request.view-sensitive')) {
      return throwError(() => new PermissionDeniedError('request.view-sensitive'));
    }

    const existing = this.store.find(id);
    if (!existing || !isWithinBarangayScope(user, existing.address.barangayId)) {
      return throwError(() => new PermissionDeniedError('resident.update'));
    }

    this.store.setSector(existing, sector, present, user?.id ?? null);

    return this.latency.respond(undefined);
  }

  private disclose(resident: Resident, user: AuthenticatedUser | null): ResidentView {
    return discloseResident(resident, (permission: Permission) =>
      userHasPermission(user, permission),
    );
  }

  /** Household members other than the subject, head first, each disclosed in turn. */
  private householdMembersOf(
    subject: Resident,
    household: Household | null,
    user: AuthenticatedUser | null,
    sharesProtectedAddress: boolean,
  ): readonly HouseholdMemberView[] {
    if (household === null) {
      return [];
    }
    return household.members
      .filter((member) => member.residentId !== subject.id)
      .map((member) => {
        const resident = this.store.find(member.residentId);
        return resident === undefined
          ? null
          : {
              view: discloseMember(
                resident,
                (permission: Permission) => userHasPermission(user, permission),
                sharesProtectedAddress,
              ),
              role: member.role,
              isHead: household.headResidentId === resident.id,
            };
      })
      .filter((member): member is HouseholdMemberView => member !== null)
      .sort((a, b) => Number(b.isHead) - Number(a.isHead));
  }
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

/**
 * Nobody records what they may not read: a PhilSys number or an income needs
 * `resident.view-sensitive`, as on the API (`DL-174`). An edit is already refused whenever anything
 * is withheld from the editor, so this bites on a create.
 */
function refuseUnreadableWrites<TValue>(
  user: AuthenticatedUser | null,
  draft: ResidentDraft,
): Observable<TValue> | null {
  if (userHasPermission(user, 'resident.view-sensitive')) {
    return null;
  }
  return draft.philsysLastFour !== null || draft.monthlyIncome !== null
    ? throwError(() => new PermissionDeniedError('resident.view-sensitive'))
    : null;
}

function rejectIfInvalid<TValue>(draft: ResidentDraft): Observable<TValue> | null {
  const problems = validateResidentDraft(draft);
  if (problems.length === 0) {
    return null;
  }
  return throwError(() => new ResidentDraftInvalidError(problems));
}

function matchesFilter(resident: Resident, filter: ResidentFilter, cleared: boolean): boolean {
  if (!filter.includeInactive && !resident.isActive) {
    return false;
  }
  if (filter.barangayId && resident.address.barangayId !== filter.barangayId) {
    return false;
  }
  if (filter.sector && !resident.sectors.includes(filter.sector)) {
    return false;
  }
  if (filter.ageGroup && !isInAgeGroup(resident.birthDate, filter.ageGroup)) {
    return false;
  }
  if (filter.householdId && resident.householdId !== filter.householdId) {
    return false;
  }
  return matchesNames(resident, filter.search, cleared);
}

/**
 * The API's search (`DL-174`, `DL-109`): every word must be in the surname, or in a given or middle
 * name the reader is shown. Not the street, the mobile number or the barangay — matching on a field
 * discloses it even with no snippet shown — and not a protected record's given names for a reader
 * who sees only "Mercado, M.".
 */
function matchesNames(resident: Resident, search: string | undefined, cleared: boolean): boolean {
  const words = (search ?? '').trim().toLowerCase().split(/\s+/).filter((word) => word !== '');
  const givenShown = cleared || !hasSensitiveSector(resident);
  const given = givenShown ? [resident.name.first, resident.name.middle ?? ''] : [];
  return words.every(
    (word) =>
      resident.name.last.toLowerCase().includes(word) ||
      given.some((name) => name.toLowerCase().includes(word)),
  );
}

/** The API's order: surname, then given name, case-folded, then id — a total order, as a cursor needs. */
function byRegistryOrder(a: Resident, b: Resident): number {
  return (
    a.name.last.toLowerCase().localeCompare(b.name.last.toLowerCase()) ||
    a.name.first.toLowerCase().localeCompare(b.name.first.toLowerCase()) ||
    (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  );
}
