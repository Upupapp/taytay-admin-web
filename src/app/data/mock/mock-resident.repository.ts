import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  barangayName,
  canReadRecord,
  discloseResident,
  isInAgeGroup,
  isWithinBarangayScope,
  formatPersonName,
  paginate,
  PermissionDeniedError,
  ResidentDraftInvalidError,
  userHasPermission,
  validateResidentDraft,
  type AuthenticatedUser,
  type HouseholdMemberView,
  type Household,
  type HouseholdId,
  type Page,
  type PageRequest,
  type Permission,
  type Resident,
  type ResidentDraft,
  type ResidentFilter,
  type ResidentId,
  type ResidentProfile,
  type ResidentRepository,
  type ResidentSortField,
  type ResidentView,
} from '@domain/index';

import { historySummaryFor } from './mock-assistance-history';
import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';
import { matchesSearch, sortItems } from './mock-query';

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

  list(
    filter: ResidentFilter,
    page: PageRequest<ResidentSortField>,
  ): Observable<Page<ResidentView>> {
    const user = this.access.currentUser();
    const denied = denyUnless<Page<ResidentView>>(user, 'resident.view');
    if (denied) {
      return denied;
    }

    // Out-of-scope records are *silently omitted* rather than refused: an error
    // that emptied the page would itself disclose that something was withheld.
    const filtered = this.store
      .all()
      .filter(
        (resident) =>
          isWithinBarangayScope(user, resident.address.barangayId) &&
          matchesFilter(resident, filter),
      );

    const sort = page.sort ?? { field: 'name' as const, direction: 'asc' as const };
    const sorted = sortItems(
      filtered,
      (resident) => residentSortKey(resident, sort.field),
      sort.direction,
    );

    const paged = paginate(sorted, page);
    return this.latency.respond({
      ...paged,
      // Only the page in hand is disclosed — the policy runs over 20 records,
      // not over the whole registry, so a large result set stays cheap.
      items: paged.items.map((resident) => this.disclose(resident, user)),
    });
  }

  getById(id: ResidentId): Observable<ResidentView | null> {
    const user = this.access.currentUser();
    const resident = this.store.find(id);

    // Out of scope is reported exactly like "does not exist". A distinguishable
    // refusal would confirm that this resident is on file, which is precisely
    // what the scope rule exists to withhold (`DL-31`).
    if (!resident || !canReadRecord(user, 'resident.view', resident.address.barangayId)) {
      return this.latency.respond(null);
    }
    return this.latency.respond(this.disclose(resident, user));
  }

  getHousehold(id: HouseholdId): Observable<Household | null> {
    const household = this.store.findHousehold(id);
    if (
      !household ||
      !canReadRecord(this.access.currentUser(), 'resident.view', household.address.barangayId)
    ) {
      return this.latency.respond(null);
    }
    return this.latency.respond(household);
  }

  getProfile(id: ResidentId): Observable<ResidentProfile | null> {
    const user = this.access.currentUser();
    const resident = this.store.find(id);
    if (!resident || !canReadRecord(user, 'resident.view', resident.address.barangayId)) {
      return this.latency.respond(null);
    }

    const household =
      resident.householdId !== null
        ? (this.store.findHousehold(resident.householdId) ?? null)
        : null;

    return this.latency.respond({
      view: this.disclose(resident, user),
      household,
      householdMembers: this.householdMembersOf(resident, household, user),
      history: historySummaryFor(resident.id),
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

  setActive(id: ResidentId, isActive: boolean): Observable<Resident> {
    const user = this.access.currentUser();
    const denied = denyUnless<Resident>(user, 'resident.deactivate');
    if (denied) {
      return denied;
    }
    const existing = this.store.find(id);
    if (!existing || !isWithinBarangayScope(user, existing.address.barangayId)) {
      return throwError(() => new PermissionDeniedError('resident.deactivate'));
    }
    return this.latency.respond(this.store.setActive(existing, isActive, user?.id ?? null));
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
              view: this.disclose(resident, user),
              role: member.role,
              isHead: household.headResidentId === resident.id,
            };
      })
      .filter((member): member is HouseholdMemberView => member !== null)
      .sort((a, b) => Number(b.isHead) - Number(a.isHead));
  }
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

function rejectIfInvalid<TValue>(draft: ResidentDraft): Observable<TValue> | null {
  const problems = validateResidentDraft(draft);
  if (problems.length === 0) {
    return null;
  }
  return throwError(() => new ResidentDraftInvalidError(problems));
}

function matchesFilter(resident: Resident, filter: ResidentFilter): boolean {
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
  return matchesSearch(
    [
      formatPersonName(resident.name),
      resident.address.streetAddress,
      barangayName(resident.address.barangayId),
      resident.contact.mobile,
    ],
    filter.search,
  );
}

function residentSortKey(resident: Resident, field: ResidentSortField): string {
  switch (field) {
    case 'name':
      return `${resident.name.last} ${resident.name.first}`;
    case 'barangay':
      return barangayName(resident.address.barangayId);
    case 'birthDate':
      return resident.birthDate;
    case 'updatedAt':
      return resident.audit.updatedAt;
  }
}
