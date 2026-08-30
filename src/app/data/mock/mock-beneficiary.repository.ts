import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asId,
  barangayName,
  buildAssistanceTimeline,
  canReadRecord,
  deriveStanding,
  discloseResident,
  isCurrentEnrollment,
  isWithinBarangayScope,
  paginate,
  PermissionDeniedError,
  ResolutionInvalidError,
  resolutionProblems,
  userHasPermission,
  type AuthenticatedUser,
  type BeneficiaryDetail,
  type BeneficiaryFilter,
  type BeneficiaryRepository,
  type BeneficiarySortField,
  type BeneficiarySummary,
  type DuplicateCandidate,
  type Family,
  type Household,
  type IdentityResolution,
  type IdentityResolutionDraft,
  type MergePreview,
  type Page,
  type PageRequest,
  type Permission,
  type Resident,
  type DuplicatePairId,
  type ResidentId,
  type ResidentView,
  type StaffUserId,
} from '@domain/index';

import { candidatesFor } from './mock-duplicate-matcher';
import { denyUnless } from './mock-access';
import { MockBeneficiaryStore } from './mock-beneficiary.store';
import { MockFamilyStore } from './mock-family.store';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';
import { matchesSearch, sortItems } from './mock-query';
import { MOCK_PROGRAMS } from './seed/programs.seed';
import { historySummaryFor } from './mock-assistance-history';

/**
 * The beneficiary registry adapter.
 *
 * It reads the same records every other adapter reads and adds no person store
 * of its own — which is what makes "one canonical identity" structural rather
 * than aspirational (`DL-71`).
 *
 * Four rules re-checked here, not only in the UI (`DL-30`):
 *
 *  - **Permission.** `beneficiary.view` to read the registry;
 *    `beneficiary.review-duplicates` to see or record a finding about identity.
 *  - **Scope.** A barangay-confined account sees its own barangay, and
 *    out-of-scope records are omitted rather than refused.
 *  - **Disclosure.** Residents arrive as `ResidentView`, already redacted; a
 *    caller without duplicate-review permission receives **no candidates at
 *    all**, rather than candidates it is trusted to hide.
 *  - **No merge.** `resolveIdentity` appends a finding. Nothing in this file
 *    deletes a resident, and nothing resolves a pair without a person saying so.
 */
@Injectable()
export class MockBeneficiaryRepository implements BeneficiaryRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly residents = inject(MockResidentStore);
  private readonly families = inject(MockFamilyStore);
  private readonly store = inject(MockBeneficiaryStore);

  list(
    filter: BeneficiaryFilter,
    page: PageRequest<BeneficiarySortField>,
  ): Observable<Page<BeneficiarySummary>> {
    const user = this.access.currentUser();
    const denied = denyUnless<Page<BeneficiarySummary>>(user, 'beneficiary.view');
    if (denied) {
      return denied;
    }

    const rows = this.residents
      .all()
      .filter(
        (resident) =>
          resident.isActive &&
          isWithinBarangayScope(user, resident.address.barangayId) &&
          // A superseded record is not a second person to be listed. It still
          // exists and is still reachable by id; it simply stops appearing as
          // its own entry once a reviewer has said whose record it is.
          !this.store.isSuperseded(resident.id),
      )
      .map((resident) => this.summarise(resident, user))
      .filter((summary) => matchesFilter(summary, filter));

    const sort = page.sort ?? { field: 'name' as const, direction: 'asc' as const };
    const sorted = sortItems(rows, (row) => summarySortKey(row, sort.field), sort.direction);

    return this.latency.respond(paginate(sorted, page));
  }

  getByResidentId(id: ResidentId): Observable<BeneficiaryDetail | null> {
    const user = this.access.currentUser();
    const resident = this.residents.find(id);

    // Not found and not yours are reported identically (`DL-31`).
    if (
      !resident ||
      !userHasPermission(user, 'beneficiary.view') ||
      !canReadRecord(user, 'resident.view', resident.address.barangayId)
    ) {
      return this.latency.respond(null);
    }

    const history = historySummaryFor(resident.id);
    const enrollments = this.store.enrollmentsFor(resident.id);

    return this.latency.respond({
      residentId: resident.id,
      resident: this.disclose(resident, user),
      household: this.householdFor(resident),
      householdHeadName: this.headNameOf(this.householdFor(resident), user),
      families: this.familiesOf(resident.id),
      standing: deriveStanding({
        requestStatuses: history.cases.map((entry) => entry.status),
        releaseStatuses: history.payouts.map((payout) => payout.status),
        enrollments,
      }),
      enrollments,
      timeline: buildAssistanceTimeline({
        requests: history.cases,
        payouts: history.payouts,
        referrals: history.referrals,
        enrollments,
      }),
      requests: history.cases,
      payouts: history.payouts,
      referrals: history.referrals,
      totalReleased: history.totalReleased,
      // Withheld in the data layer: a screen cannot leak a candidate it was
      // never handed.
      duplicateCandidates: userHasPermission(user, 'beneficiary.review-duplicates')
        ? this.openCandidatesFor(resident, user)
        : [],
    });
  }


  duplicateQueue(page: PageRequest): Observable<Page<DuplicateCandidate>> {
    const user = this.access.currentUser();
    const denied = denyUnless<Page<DuplicateCandidate>>(user, 'beneficiary.review-duplicates');
    if (denied) {
      return denied;
    }

    return this.latency.respond(paginate(this.openPairs(user), page));
  }

  /** Every open pair once, ordered so A-against-B and B-against-A are one row. */
  private openPairs(user: AuthenticatedUser | null): DuplicateCandidate[] {
    const seen = new Set<string>();
    const queue: DuplicateCandidate[] = [];

    for (const resident of this.residents.all()) {
      if (!resident.isActive || !isWithinBarangayScope(user, resident.address.barangayId)) {
        continue;
      }
      for (const candidate of this.openCandidatesFor(resident, user)) {
        // One row per pair, not two. A queue that lists A-against-B and
        // B-against-A asks the same reviewer the same question twice.
        const key = orderedKey(candidate.residentId, candidate.otherResidentId);
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        queue.push(candidate);
      }
    }

    return queue;
  }

  duplicatesFor(id: ResidentId): Observable<readonly DuplicateCandidate[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly DuplicateCandidate[]>(user, 'beneficiary.review-duplicates');
    if (denied) {
      return denied;
    }
    const resident = this.residents.find(id);
    if (!resident || !canReadRecord(user, 'resident.view', resident.address.barangayId)) {
      return this.latency.respond([]);
    }
    return this.latency.respond(this.openCandidatesFor(resident, user));
  }

  /**
   * The mock recomputes the queue on every read, so a detection pass has nothing to persist.
   *
   * It reports the count it can already see rather than pretending to have done work. Returning a
   * fabricated number of "new" pairs would let a screen be built around an event the mock invents
   * and the server measures.
   */
  detectDuplicates(): Observable<number> {
    const user = this.access.currentUser();
    const denied = denyUnless<number>(user, 'beneficiary.review-duplicates');

    return denied ?? this.latency.respond(this.openPairs(user).length);
  }

  previewResolution(
    pairId: DuplicatePairId,
    canonicalResidentId: ResidentId,
    supersededResidentId: ResidentId,
  ): Observable<MergePreview> {
    // The mock computes a pair rather than storing one, so the id identifies nothing here. It is
    // still in the signature because the API accepts a preview no other way, and a port that
    // omitted it would let a screen be written that cannot call the real thing.
    void pairId;

    const user = this.access.currentUser();
    const denied = denyUnless<MergePreview>(user, 'beneficiary.review-duplicates');
    if (denied) {
      return denied;
    }

    const superseded = historySummaryFor(supersededResidentId);
    const canonical = historySummaryFor(canonicalResidentId);
    const canonicalPrograms = new Set(canonical.cases.map((entry) => entry.programName));

    return this.latency.respond({
      canonicalResidentId,
      supersededResidentId,
      movingRequestCount: superseded.cases.length,
      movingReleaseCount: superseded.payouts.length,
      movingCaseCount: superseded.openCaseCount,
      movingEnrollmentCount: this.store.enrollmentsFor(supersededResidentId).length,
      // Named, never resolved: which of two payouts under one programme was the
      // real one is an office judgement, and guessing it here would quietly
      // rewrite what a family was given.
      overlappingProgramNames: [
        ...new Set(
          superseded.cases
            .map((entry) => entry.programName)
            .filter((name) => canonicalPrograms.has(name)),
        ),
      ],
    });
  }

  resolveIdentity(draft: IdentityResolutionDraft): Observable<IdentityResolution> {
    const user = this.access.currentUser();
    const denied = denyUnless<IdentityResolution>(user, 'beneficiary.review-duplicates');
    if (denied) {
      return denied;
    }

    const problems = resolutionProblems(draft);
    if (problems.length > 0) {
      return throwError(() => new ResolutionInvalidError(problems));
    }

    // Both records must be readable by this reviewer. Otherwise resolving a
    // pair becomes a way to learn that somebody outside your barangay exists.
    for (const residentId of draft.pair) {
      const resident = this.residents.find(residentId);
      if (!resident || !isWithinBarangayScope(user, resident.address.barangayId)) {
        return throwError(() => new PermissionDeniedError('beneficiary.review-duplicates'));
      }
    }

    const existing = this.store.findForPair(draft.pair[0], draft.pair[1]);
    if (existing !== undefined && existing.verdict !== draft.verdict) {
      // Answering a pair a second time, differently, would overwrite a finding
      // somebody made about a person's identity. A correction is a new act with
      // its own reason, not a silent replacement — and there is no screen for it
      // yet, which is a stated gap rather than an accident.
      return throwError(() => new PermissionDeniedError('beneficiary.review-duplicates'));
    }

    const actor: StaffUserId = user?.id ?? asId<StaffUserId>('staff-unknown');
    return this.latency.respond(this.store.record(draft, actor));
  }

  resolutionsFor(id: ResidentId): Observable<readonly IdentityResolution[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly IdentityResolution[]>(user, 'beneficiary.view');
    if (denied) {
      return denied;
    }
    return this.latency.respond(this.store.resolutionsFor(id));
  }

  /* ── internals ──────────────────────────────────────────────────────────── */

  private summarise(resident: Resident, user: AuthenticatedUser | null): BeneficiarySummary {
    const history = historySummaryFor(resident.id);
    const enrollments = this.store.enrollmentsFor(resident.id);
    const timeline = buildAssistanceTimeline({
      requests: history.cases,
      payouts: history.payouts,
      referrals: history.referrals,
      enrollments,
    });

    return {
      residentId: resident.id,
      resident: this.disclose(resident, user),
      householdId: resident.householdId,
      barangayId: resident.address.barangayId,
      standing: deriveStanding({
        requestStatuses: history.cases.map((entry) => entry.status),
        releaseStatuses: history.payouts.map((payout) => payout.status),
        enrollments,
      }),
      currentProgramNames: enrollments
        .filter(isCurrentEnrollment)
        .map((enrollment) => enrollment.programName),
      assistanceEventCount: timeline.length,
      lastAssistanceAt: timeline[0]?.occurredAt ?? null,
      totalReleased: history.totalReleased,
      openCaseCount: history.openCaseCount,
      // A flag, never the candidate. The list must not disclose one person to
      // everybody scrolling past another (`DL-73`).
      hasOpenDuplicateReview:
        userHasPermission(user, 'beneficiary.review-duplicates') &&
        this.openCandidatesFor(resident, user).length > 0,
    };
  }

  /** Candidates a reviewer has not already answered, in or out of scope. */
  private openCandidatesFor(
    resident: Resident,
    user: AuthenticatedUser | null,
  ): readonly DuplicateCandidate[] {
    const population = this.residents
      .all()
      .filter((other) => isWithinBarangayScope(user, other.address.barangayId));

    return candidatesFor(resident, population).filter(
      (candidate) => !this.store.isPairResolved(candidate.residentId, candidate.otherResidentId),
    );
  }

  private householdFor(resident: Resident): Household | null {
    if (resident.householdId === null) {
      return null;
    }
    return this.residents.findHousehold(resident.householdId) ?? null;
  }

  /** Masked when the head is a protection case, exactly as elsewhere (`DL-38`). */
  private headNameOf(
    household: Household | null,
    user: AuthenticatedUser | null,
  ): string | null {
    if (household === null) {
      return null;
    }
    const head = this.residents.find(household.headResidentId);
    return head === undefined ? null : this.disclose(head, user).fullName;
  }

  private familiesOf(id: ResidentId): readonly Family[] {
    return this.families.familiesOfResident(id);
  }

  private disclose(resident: Resident, user: AuthenticatedUser | null): ResidentView {
    return discloseResident(resident, (permission: Permission) =>
      userHasPermission(user, permission),
    );
  }
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

function orderedKey(a: ResidentId, b: ResidentId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

function matchesFilter(summary: BeneficiarySummary, filter: BeneficiaryFilter): boolean {
  if (filter.barangayId && summary.barangayId !== filter.barangayId) {
    return false;
  }
  if (filter.role && !summary.standing.roles.includes(filter.role)) {
    return false;
  }
  if (filter.withOpenDuplicateReview && !summary.hasOpenDuplicateReview) {
    return false;
  }
  if (filter.programId) {
    const programName = MOCK_PROGRAMS.find((program) => program.id === filter.programId)?.name;
    if (programName === undefined || !summary.currentProgramNames.includes(programName)) {
      return false;
    }
  }
  if (filter.receivedFrom && (summary.lastAssistanceAt ?? '') < filter.receivedFrom) {
    return false;
  }
  // Compared against the date only, so a `to` bound includes the whole day
  // rather than cutting it off at midnight.
  if (filter.receivedTo && (summary.lastAssistanceAt ?? '').slice(0, 10) > filter.receivedTo) {
    return false;
  }

  return matchesSearch(
    [
      summary.resident.listedName,
      barangayName(summary.barangayId),
      ...summary.currentProgramNames,
    ],
    filter.search,
  );
}

function summarySortKey(summary: BeneficiarySummary, field: BeneficiarySortField): string {
  switch (field) {
    case 'name':
      return summary.resident.listedName;
    case 'barangay':
      return barangayName(summary.barangayId);
    case 'lastAssistanceAt':
      return summary.lastAssistanceAt ?? '';
    case 'totalReleased':
      // Padded so string ordering matches numeric ordering — the shared sort
      // helper compares strings, and 900 must not sort above 1000.
      return String(summary.totalReleased.centavos).padStart(12, '0');
    case 'assistanceEventCount':
      return String(summary.assistanceEventCount).padStart(6, '0');
  }
}
