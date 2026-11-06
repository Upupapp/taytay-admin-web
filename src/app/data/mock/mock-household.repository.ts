import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asIsoDateTime,
  canReadRecord,
  computeVulnerability,
  describeCorrectionWithdrawn,
  describeFactorCorrection,
  discloseHousehold,
  discloseMember,
  discloseSnapshot,
  hasSensitiveSector,
  HouseholdCompositionError,
  householdClearance,
  isAtLeastBand,
  isFactorDisclosed,
  isValidCorrectionReason,
  isWithinBarangayScope,
  orderMembers,
  PermissionDeniedError,
  presentFactors,
  userHasPermission,
  type AuthenticatedUser,
  type CursorPage,
  type CursorRequest,
  type FactorCorrection,
  type FactorState,
  type Household,
  type HouseholdClearance,
  type HouseholdDetail,
  type HouseholdDraft,
  type HouseholdFilter,
  type HouseholdId,
  type HouseholdMemberView,
  type HouseholdRepository,
  type HouseholdSummary,
  type MembershipChange,
  type Permission,
  type Resident,
  type ResidentView,
  type VulnerabilityFactorCode,
  type VulnerabilitySnapshot,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';

/**
 * The household adapter.
 *
 * It computes the vulnerability snapshot from **unredacted** member records and
 * then discloses the result, exactly as the resident adapter does for a person
 * (`DL-38`, `DL-44`). Computing from a redacted copy would quietly change the
 * answer depending on who was looking, and the role with the least access would
 * be the one told a family is fine.
 *
 * It answers as the API does: a page by reference number with a cursor and no
 * total, a protected household's street — and every member's own — withheld
 * from a reader without `request.view-sensitive`, its income from one without
 * `resident.view-sensitive`, and the same two tiers on the indicators and the
 * trail.
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

  list(filter: HouseholdFilter, page: CursorRequest): Observable<CursorPage<HouseholdSummary>> {
    const user = this.access.currentUser();
    const denied = denyUnless<CursorPage<HouseholdSummary>>(user, 'household.view');
    if (denied) {
      return denied;
    }
    // Asking for another barangay is refused, as the API refuses it, rather than answered with an
    // empty page that reads as "nobody lives there".
    if (filter.barangayId !== undefined && !isWithinBarangayScope(user, filter.barangayId)) {
      return throwError(() => new PermissionDeniedError('household.view'));
    }

    const clearance = this.clearanceOf(user);
    const matching = this.store
      .allHouseholds()
      .filter((household) => isWithinBarangayScope(user, household.address.barangayId))
      .filter((household) => this.matches(household, filter, clearance))
      // The API's order: reference number, then id — a total order, as a cursor needs.
      .sort(byReference);

    // The cursor is the id of the last row read, as the API's is; nothing outside this adapter reads it.
    const after = page.cursor
      ? matching.findIndex((household) => household.id === page.cursor)
      : -1;
    const rest = matching.slice(after + 1);
    const summaries: HouseholdSummary[] = [];
    let hasMore = false;
    for (const household of rest) {
      const summary = this.summarise(household, user);
      if (filter.minimumBand !== undefined && !isAtLeastBand(summary.band, filter.minimumBand)) {
        continue;
      }
      if (summaries.length === page.limit) {
        hasMore = true;
        break;
      }
      summaries.push(summary);
    }

    return this.latency.respond({
      items: summaries,
      hasMore,
      nextCursor: hasMore ? (summaries.at(-1)?.household.id ?? null) : null,
    });
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

  create(draft: HouseholdDraft): Observable<HouseholdDetail> {
    const user = this.access.currentUser();
    const denied = denyUnless<HouseholdDetail>(user, 'household.manage');
    if (denied) {
      return denied;
    }
    // A registration in another barangay is an act, not a lookup, so refusing it discloses nothing.
    if (!isWithinBarangayScope(user, draft.barangayId)) {
      return throwError(() => new PermissionDeniedError('household.manage'));
    }
    // Nobody records what they may not read: an income is means, as on a resident.
    if (draft.monthlyIncome !== null && !userHasPermission(user, 'resident.view-sensitive')) {
      return throwError(() => new PermissionDeniedError('resident.view-sensitive'));
    }
    if (draft.streetAddress.trim().length === 0) {
      return throwError(() => new Error('A household needs a street address.'));
    }
    // A head outside the reader's scope is "not on file", as the API answers it.
    const head = this.store.find(draft.headResidentId);
    if (head !== undefined && !isWithinBarangayScope(user, head.address.barangayId)) {
      return throwError(
        () =>
          new HouseholdCompositionError([
            { code: 'member-not-found', residentId: draft.headResidentId },
          ]),
      );
    }
    try {
      const created = this.store.registerHousehold(draft, actorOf(user));
      return this.latency.respond(this.detail(created, user));
    } catch (failure) {
      // The store threw before writing anything, so the refusal is total.
      return throwError(() => failure);
    }
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
    // `withheld` is a reading, never something a person records.
    if (state === 'withheld') {
      return throwError(
        () => new Error('An indicator can be corrected to present, absent or unknown.'),
      );
    }
    const unseen = refuseUnseenFactor(user, code);
    if (unseen) {
      return unseen;
    }

    const correction: FactorCorrection = {
      code,
      state,
      reason: reason.trim(),
      actorId: user?.id ?? null,
      actorName: user?.displayName ?? 'Unknown',
      correctedAt: asIsoDateTime(new Date()),
    };
    this.store.recordCorrection(id, correction, describeFactorCorrection(code, state));
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
    const unseen = refuseUnseenFactor(user, code);
    if (unseen) {
      return unseen;
    }
    if (!this.store.correctionsFor(id).some((correction) => correction.code === code)) {
      return throwError(() => new Error('No correction of that factor stands to withdraw.'));
    }

    this.store.dropCorrection(id, code, describeCorrectionWithdrawn(code), reason.trim(), {
      id: user?.id ?? null,
      name: user?.displayName ?? 'Unknown',
    });
    return this.latency.respond(this.detail(household, user));
  }

  /* ── assembly ───────────────────────────────────────────────────────────── */

  private members(household: Household): readonly Resident[] {
    return orderMembers(household.members, this.store.all());
  }

  private clearanceOf(user: AuthenticatedUser | null): HouseholdClearance {
    return householdClearance((permission: Permission) => userHasPermission(user, permission));
  }

  private isProtected(household: Household): boolean {
    return this.members(household).some(hasSensitiveSector);
  }

  /**
   * The API's search: every word must match the reference number, the head's surname, or the
   * street — except a protected household's street for a reader not shown it, which is not
   * matched either, because a match is itself the disclosure.
   */
  private matches(
    household: Household,
    filter: HouseholdFilter,
    clearance: HouseholdClearance,
  ): boolean {
    if (filter.barangayId && household.address.barangayId !== filter.barangayId) {
      return false;
    }
    if (filter.indigentOnly && !household.isIndigent) {
      return false;
    }
    const words = (filter.search ?? '')
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word !== '');
    if (words.length === 0) {
      return true;
    }
    const surname = this.store.find(household.headResidentId)?.name.last.toLowerCase() ?? '';
    const street =
      clearance.protected || !this.isProtected(household)
        ? (household.address.streetAddress ?? '').toLowerCase()
        : '';
    const reference = household.referenceNumber.toLowerCase();
    return words
      .slice(0, 5)
      .every((word) => reference.includes(word) || surname.includes(word) || street.includes(word));
  }

  private snapshot(household: Household, user: AuthenticatedUser | null): VulnerabilitySnapshot {
    const computed = computeVulnerability({
      household,
      members: this.members(household),
      corrections: this.store.correctionsFor(household.id),
      now: new Date(),
    });
    return discloseSnapshot(computed, this.clearanceOf(user));
  }

  private summarise(household: Household, user: AuthenticatedUser | null): HouseholdSummary {
    const snapshot = this.snapshot(household, user);
    const head = this.store.find(household.headResidentId);
    const isProtected = this.isProtected(household);
    const disclosed = discloseHousehold(household, isProtected, this.clearanceOf(user));
    return {
      household: disclosed.household,
      withheld: disclosed.withheld,
      isProtected: disclosed.isProtected,
      headName: head ? this.disclose(head, user, isProtected).listedName : 'No head recorded',
      memberCount: household.members.length,
      band: snapshot.band,
      // Counted from what the viewer can see, so the number and the list agree.
      presentFactorCount: presentFactors(snapshot).length,
    };
  }

  private detail(household: Household, user: AuthenticatedUser | null): HouseholdDetail {
    const isProtected = this.isProtected(household);
    const members: readonly HouseholdMemberView[] = household.members
      .map((member) => {
        const resident = this.store.find(member.residentId);
        return resident === undefined
          ? null
          : {
              view: this.disclose(resident, user, isProtected),
              role: member.role,
              isHead: resident.id === household.headResidentId,
            };
      })
      .filter((member): member is HouseholdMemberView => member !== null)
      .sort((a, b) => Number(b.isHead) - Number(a.isHead));

    const clearance = this.clearanceOf(user);
    const disclosed = discloseHousehold(household, isProtected, clearance);
    return {
      household: disclosed.household,
      withheld: disclosed.withheld,
      isProtected: disclosed.isProtected,
      members,
      snapshot: this.snapshot(household, user),
      // A correction of an indicator the reader is not shown says why in words, and those words
      // are the disclosure — so its line goes with it, as on the API.
      audit: this.store
        .trailFor(household.id)
        .filter((line) => line.factorCode === null || isFactorDisclosed(line.factorCode, clearance))
        .map((line) => line.entry),
    };
  }

  /**
   * A member as the API sends one: in a household with a protected member, everyone's own street
   * and purok are withheld from a reader not cleared for the protected tier, because beside the
   * masked member they would say where she lives.
   */
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
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

function actorOf(user: AuthenticatedUser | null) {
  return { id: user?.id ?? null, name: user?.displayName ?? 'Unknown' };
}

function byReference(a: Household, b: Household): number {
  if (a.referenceNumber !== b.referenceNumber) {
    return a.referenceNumber < b.referenceNumber ? -1 : 1;
  }
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Overriding an indicator the writer was never shown would be overriding a judgement they could
 * not read (`DL-39`): the protected-sector factor needs `request.view-sensitive`, the income
 * factors `resident.view-sensitive` — the API's two refusals.
 */
function refuseUnseenFactor(
  user: AuthenticatedUser | null,
  code: VulnerabilityFactorCode,
): Observable<HouseholdDetail> | null {
  const clearance = householdClearance((permission) => userHasPermission(user, permission));
  if (isFactorDisclosed(code, clearance)) {
    return null;
  }
  return throwError(
    () =>
      new PermissionDeniedError(
        code === 'protected-member' ? 'request.view-sensitive' : 'resident.view-sensitive',
      ),
  );
}
