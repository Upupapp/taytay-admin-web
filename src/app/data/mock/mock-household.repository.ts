import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asIsoDateTime,
  barangayName,
  canReadRecord,
  computeVulnerability,
  discloseResident,
  discloseSnapshot,
  isAtLeastBand,
  isValidCorrectionReason,
  isWithinBarangayScope,
  orderMembers,
  paginate,
  PermissionDeniedError,
  presentFactors,
  userHasPermission,
  type AuthenticatedUser,
  type FactorCorrection,
  type FactorState,
  type Household,
  type HouseholdDetail,
  type HouseholdFilter,
  type HouseholdId,
  type HouseholdMemberView,
  type HouseholdRepository,
  type HouseholdSortField,
  type HouseholdSummary,
  type MembershipChange,
  type Page,
  type PageRequest,
  type Permission,
  type Resident,
  type ResidentView,
  type VulnerabilityFactorCode,
  type VulnerabilitySnapshot,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';
import { matchesSearch, sortItems } from './mock-query';

/**
 * The household adapter.
 *
 * It computes the vulnerability snapshot from **unredacted** member records and
 * then discloses the result, exactly as the resident adapter does for a person
 * (`DL-38`, `DL-44`). Computing from a redacted copy would quietly change the
 * answer depending on who was looking, and the role with the least access would
 * be the one told a family is fine.
 *
 * Nothing here returns an eligibility, an entitlement or an amount. The snapshot
 * is evidence a caseworker reads; the decision stays with the person who signs
 * it (`DL-42`).
 */
@Injectable()
export class MockHouseholdRepository implements HouseholdRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly store = inject(MockResidentStore);

  list(
    filter: HouseholdFilter,
    page: PageRequest<HouseholdSortField>,
  ): Observable<Page<HouseholdSummary>> {
    const user = this.access.currentUser();
    const denied = denyUnless<Page<HouseholdSummary>>(user, 'household.view');
    if (denied) {
      return denied;
    }

    const summaries = this.store
      .allHouseholds()
      .filter((household) => isWithinBarangayScope(user, household.address.barangayId))
      .map((household) => this.summarise(household, user))
      .filter((summary) => matchesFilter(summary, filter));

    const sort = page.sort ?? { field: 'reference' as const, direction: 'asc' as const };
    const sorted = sortItems(summaries, (summary) => sortKey(summary, sort.field), sort.direction);

    return this.latency.respond(paginate(sorted, page));
  }

  getById(id: HouseholdId): Observable<HouseholdDetail | null> {
    const user = this.access.currentUser();
    const household = this.store.findHousehold(id);

    // Out of scope reads exactly like "does not exist" (`DL-31`).
    if (!household || !canReadRecord(user, 'household.view', household.address.barangayId)) {
      return this.latency.respond(null);
    }
    return this.latency.respond(this.detail(household, user));
  }

  changeMembership(
    id: HouseholdId,
    changes: readonly MembershipChange[],
    reason: string,
  ): Observable<HouseholdDetail> {
    const user = this.access.currentUser();
    const denied = denyUnless<HouseholdDetail>(user, 'household.manage');
    if (denied) {
      return denied;
    }

    const household = this.store.findHousehold(id);
    if (!household || !isWithinBarangayScope(user, household.address.barangayId)) {
      return throwError(() => new PermissionDeniedError('household.manage'));
    }
    if (changes.length === 0) {
      return this.latency.respond(this.detail(household, user));
    }
    if (reason.trim().length === 0) {
      return throwError(() => new Error('Say why the household composition changed.'));
    }

    try {
      const updated = this.store.commitMembership(household, changes, reason.trim(), actorOf(user));
      return this.latency.respond(this.detail(updated, user));
    } catch (failure) {
      // The store threw before writing anything, so the refusal is total.
      return throwError(() => failure);
    }
  }

  correctFactor(
    id: HouseholdId,
    code: VulnerabilityFactorCode,
    state: FactorState,
    reason: string,
  ): Observable<HouseholdDetail> {
    const user = this.access.currentUser();
    const denied = denyUnless<HouseholdDetail>(user, 'household.correct-vulnerability');
    if (denied) {
      return denied;
    }

    const household = this.store.findHousehold(id);
    if (!household || !isWithinBarangayScope(user, household.address.barangayId)) {
      return throwError(() => new PermissionDeniedError('household.correct-vulnerability'));
    }
    if (!isValidCorrectionReason(reason)) {
      return throwError(() => new Error('A correction needs a reason someone else can read.'));
    }
    // Correcting the protected-sector factor while unable to see it would be
    // overriding a judgement you were never shown (`DL-39`, applied here).
    if (code === 'protected-member' && !userHasPermission(user, 'request.view-sensitive')) {
      return throwError(() => new PermissionDeniedError('request.view-sensitive'));
    }

    const correction: FactorCorrection = {
      code,
      state,
      reason: reason.trim(),
      actorId: user?.id ?? null,
      actorName: user?.displayName ?? 'Unknown',
      correctedAt: asIsoDateTime(new Date()),
    };
    this.store.recordCorrection(id, correction, `set ${code} to ${state}`);
    return this.latency.respond(this.detail(household, user));
  }

  clearCorrection(
    id: HouseholdId,
    code: VulnerabilityFactorCode,
    reason: string,
  ): Observable<HouseholdDetail> {
    const user = this.access.currentUser();
    const denied = denyUnless<HouseholdDetail>(user, 'household.correct-vulnerability');
    if (denied) {
      return denied;
    }

    const household = this.store.findHousehold(id);
    if (!household || !isWithinBarangayScope(user, household.address.barangayId)) {
      return throwError(() => new PermissionDeniedError('household.correct-vulnerability'));
    }
    if (!isValidCorrectionReason(reason)) {
      return throwError(() => new Error('Withdrawing a correction needs a reason too.'));
    }

    this.store.dropCorrection(id, code, `restored ${code} to the computed value`, reason.trim(), {
      id: user?.id ?? null,
      name: user?.displayName ?? 'Unknown',
    });
    return this.latency.respond(this.detail(household, user));
  }

  /* ── assembly ───────────────────────────────────────────────────────────── */

  private members(household: Household): readonly Resident[] {
    return orderMembers(household.members, this.store.all());
  }

  private snapshot(household: Household, user: AuthenticatedUser | null): VulnerabilitySnapshot {
    const computed = computeVulnerability({
      household,
      members: this.members(household),
      corrections: this.store.correctionsFor(household.id),
      now: new Date(),
    });
    return discloseSnapshot(computed, userHasPermission(user, 'request.view-sensitive'));
  }

  private summarise(household: Household, user: AuthenticatedUser | null): HouseholdSummary {
    const snapshot = this.snapshot(household, user);
    const head = this.store.find(household.headResidentId);
    return {
      household,
      headName: head ? this.disclose(head, user).listedName : 'No head recorded',
      memberCount: household.members.length,
      band: snapshot.band,
      // Counted from what the viewer can see, so the number and the list agree.
      presentFactorCount: presentFactors(snapshot).length,
    };
  }

  private detail(household: Household, user: AuthenticatedUser | null): HouseholdDetail {
    const members: readonly HouseholdMemberView[] = household.members
      .map((member) => {
        const resident = this.store.find(member.residentId);
        return resident === undefined
          ? null
          : {
              view: this.disclose(resident, user),
              role: member.role,
              isHead: resident.id === household.headResidentId,
            };
      })
      .filter((member): member is HouseholdMemberView => member !== null)
      .sort((a, b) => Number(b.isHead) - Number(a.isHead));

    return {
      household,
      members,
      snapshot: this.snapshot(household, user),
      audit: this.store.auditFor(household.id),
    };
  }

  private disclose(resident: Resident, user: AuthenticatedUser | null): ResidentView {
    return discloseResident(resident, (permission: Permission) =>
      userHasPermission(user, permission),
    );
  }
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

function actorOf(user: AuthenticatedUser | null) {
  return { id: user?.id ?? null, name: user?.displayName ?? 'Unknown' };
}

function matchesFilter(summary: HouseholdSummary, filter: HouseholdFilter): boolean {
  const household = summary.household;
  if (filter.barangayId && household.address.barangayId !== filter.barangayId) {
    return false;
  }
  if (filter.indigentOnly && !household.isIndigent) {
    return false;
  }
  if (filter.minimumBand && !isAtLeastBand(summary.band, filter.minimumBand)) {
    return false;
  }
  return matchesSearch(
    [
      household.referenceNumber,
      summary.headName,
      household.address.streetAddress,
      barangayName(household.address.barangayId),
    ],
    filter.search,
  );
}

function sortKey(summary: HouseholdSummary, field: HouseholdSortField): string | number {
  switch (field) {
    case 'reference':
      return summary.household.referenceNumber;
    case 'barangay':
      return barangayName(summary.household.address.barangayId);
    case 'size':
      return summary.memberCount;
    case 'updatedAt':
      return summary.household.audit.updatedAt;
  }
}
