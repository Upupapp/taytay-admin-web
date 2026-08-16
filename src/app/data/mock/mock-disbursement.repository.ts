import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  DISBURSEMENT_STATUS_TRANSITIONS,
  asId,
  asIsoDateTime,
  batchProblems,
  canTransition,
  composeManifest,
  disbursementProblems,
  discloseResident,
  isReleaseOpen,
  isWithinBarangayScope,
  paginate,
  PermissionDeniedError,
  todayAsIsoDate,
  userHasPermission,
  type AuthenticatedUser,
  type DeferralReason,
  type Disbursement,
  type DisbursementFilter,
  type DisbursementId,
  type DisbursementRepository,
  type DisbursementSortField,
  type DisbursementStatus,
  type Page,
  type PageRequest,
  type Permission,
  type ReleaseAcknowledgementDraft,
  type ReleaseBatch,
  type ReleaseBatchDraft,
  type ReleaseBatchId,
  type ReleaseManifest,
  type Resident,
  type StaffUserId,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';
import { matchesSearch, sortItems } from './mock-query';
import {
  MOCK_DISBURSEMENTS,
  MOCK_RELEASE_APPROVERS,
  MOCK_RELEASE_BATCHES,
} from './seed/disbursements.seed';

/**
 * The release adapter.
 *
 * **This file gained its permission checks in TAB 17.** Before that it had
 * none: `list`, `getById` and `listForRequest` returned seeded payouts to any
 * caller, unauthenticated included, with no barangay scoping. That is the
 * second adapter found in this state — both had placeholder routes, so nothing
 * reachable exercised them and the access detector had no surface to inspect
 * (`DL-84`, and now `DL-95`).
 *
 * Payout records are not low-value: they name a person, an amount and a date
 * and place they can be found collecting money.
 *
 * Four rules, re-checked here rather than only in the UI (`DL-30`):
 *
 *  - **Permission.** `disbursement.view` to read, `disbursement.schedule` to
 *    batch, `disbursement.release` to hand over, `disbursement.void` to cancel.
 *  - **Scope.** A release is reachable only if its beneficiary is.
 *  - **Nothing posts.** No ledger, no journal, no account code. This tracks
 *    release operations; the treasury system is elsewhere (`DL-89`).
 *  - **Every move takes a reason**, and a deferral takes one from the fixed
 *    list of things the office got wrong.
 */
@Injectable()
export class MockDisbursementRepository implements DisbursementRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly residents = inject(MockResidentStore);

  private releases: readonly Disbursement[] = [...MOCK_DISBURSEMENTS];
  private batches: readonly ReleaseBatch[] = [...MOCK_RELEASE_BATCHES];
  private batchSequence = MOCK_RELEASE_BATCHES.length;

  list(
    filter: DisbursementFilter,
    page: PageRequest<DisbursementSortField>,
  ): Observable<Page<Disbursement>> {
    const user = this.access.currentUser();
    const denied = denyUnless<Page<Disbursement>>(user, 'disbursement.view');
    if (denied) {
      return denied;
    }

    const visible = this.releases.filter(
      (release) => this.isReadable(release, user) && matchesFilter(release, filter),
    );
    const sort = page.sort ?? { field: 'scheduledFor' as const, direction: 'desc' as const };
    const sorted = sortItems(visible, (release) => sortKey(release, sort.field), sort.direction);
    return this.latency.respond(paginate(sorted, page));
  }

  getById(id: DisbursementId): Observable<Disbursement | null> {
    const user = this.access.currentUser();
    const release = this.releases.find((entry) => entry.id === id);

    // Not found and not yours read identically (`DL-31`).
    if (
      release === undefined ||
      !userHasPermission(user, 'disbursement.view') ||
      !this.isReadable(release, user)
    ) {
      return this.latency.respond(null);
    }
    return this.latency.respond(release);
  }

  listForRequest(id: Disbursement['requestId']): Observable<readonly Disbursement[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly Disbursement[]>(user, 'disbursement.view');
    if (denied) {
      return denied;
    }
    return this.latency.respond(
      this.releases.filter((entry) => entry.requestId === id && this.isReadable(entry, user)),
    );
  }

  queue(filter: DisbursementFilter): Observable<readonly Disbursement[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly Disbursement[]>(user, 'disbursement.view');
    if (denied) {
      return denied;
    }

    const open = this.releases.filter(
      (release) =>
        this.isReadable(release, user) &&
        isReleaseOpen(release.status) &&
        matchesFilter(release, filter),
    );

    // Ordered by what the office must act on first: things it got wrong, then
    // what is scheduled soonest.
    return this.latency.respond([...open].sort(byQueueOrder));
  }

  approverFor(id: DisbursementId): Observable<StaffUserId | null> {
    const user = this.access.currentUser();
    const denied = denyUnless<StaffUserId | null>(user, 'disbursement.view');
    if (denied) {
      return denied;
    }
    return this.latency.respond(MOCK_RELEASE_APPROVERS[id] ?? null);
  }

  /* ── batches ────────────────────────────────────────────────────────────── */

  listBatches(): Observable<readonly ReleaseBatch[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly ReleaseBatch[]>(user, 'disbursement.view');
    if (denied) {
      return denied;
    }
    return this.latency.respond(
      [...this.batches].sort((a, b) => (a.scheduledFor < b.scheduledFor ? 1 : -1)),
    );
  }

  getBatch(id: ReleaseBatchId): Observable<ReleaseBatch | null> {
    const user = this.access.currentUser();
    if (!userHasPermission(user, 'disbursement.view')) {
      return this.latency.respond(null);
    }
    return this.latency.respond(this.batches.find((batch) => batch.id === id) ?? null);
  }

  createBatch(draft: ReleaseBatchDraft): Observable<ReleaseBatch> {
    const user = this.access.currentUser();
    const denied = denyUnless<ReleaseBatch>(user, 'disbursement.schedule');
    if (denied) {
      return denied;
    }

    const today = todayAsIsoDate();
    const problems = batchProblems(draft, today);
    if (problems.length > 0) {
      return throwError(() => new Error('That payout session needs correcting.'));
    }

    this.batchSequence += 1;
    const now = asIsoDateTime(new Date());
    const batch: ReleaseBatch = {
      id: asId<ReleaseBatchId>(`rbt-${String(this.batchSequence).padStart(4, '0')}`),
      referenceNumber: `RB-${today.slice(0, 4)}-${String(this.batchSequence).padStart(4, '0')}`,
      title: draft.title.trim(),
      scheduledFor: draft.scheduledFor,
      venue: draft.venue.trim(),
      officerId: draft.officerId,
      disbursementIds: draft.disbursementIds,
      notes: draft.notes,
      closedAt: null,
      audit: {
        createdAt: now,
        createdBy: user?.id ?? null,
        updatedAt: now,
        updatedBy: user?.id ?? null,
      },
    };

    this.batches = [...this.batches, batch];
    // Each member is scheduled individually and keeps its own status: the batch
    // never becomes the thing that is "released" (`DL-90`).
    this.releases = this.releases.map((release) =>
      draft.disbursementIds.includes(release.id)
        ? { ...release, batchId: batch.id, status: 'scheduled', scheduledFor: draft.scheduledFor }
        : release,
    );

    return this.latency.respond(batch);
  }

  manifestFor(id: ReleaseBatchId): Observable<ReleaseManifest | null> {
    const user = this.access.currentUser();
    if (!userHasPermission(user, 'disbursement.view')) {
      return this.latency.respond(null);
    }

    const batch = this.batches.find((entry) => entry.id === id);
    if (batch === undefined) {
      return this.latency.respond(null);
    }

    const entries = batch.disbursementIds
      .map((releaseId) => this.releases.find((release) => release.id === releaseId))
      .filter((release): release is Disbursement => release !== undefined)
      .filter((release) => this.isReadable(release, user))
      .map((release) => {
        const resident = this.residents.find(release.residentId);
        return resident === undefined
          ? null
          : { release, beneficiary: this.disclose(resident, user) };
      })
      .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

    return this.latency.respond(
      composeManifest({
        batchReference: batch.referenceNumber,
        title: batch.title,
        scheduledFor: batch.scheduledFor,
        venue: batch.venue,
        officerName: user?.displayName ?? 'Releasing officer',
        preparedAt: asIsoDateTime(new Date()),
        entries,
      }),
    );
  }

  /* ── the release itself ─────────────────────────────────────────────────── */

  markReleased(
    id: DisbursementId,
    instrumentReference: string | null,
    remarks: string | null,
  ): Observable<Disbursement> {
    const user = this.access.currentUser();
    const denied = denyUnless<Disbursement>(user, 'disbursement.release');
    if (denied) {
      return denied;
    }

    const found = this.locate<Disbursement>(id, 'disbursement.release');
    if ('error' in found) {
      return found.error;
    }
    if (!canTransition(DISBURSEMENT_STATUS_TRANSITIONS, found.release.status, 'released')) {
      return throwError(() => new Error('That release cannot be handed over from its state.'));
    }

    return this.latency.respond(
      this.save(found.release, {
        status: 'released',
        releasedAt: asIsoDateTime(new Date()),
        // Recorded against a named officer, never left null: `disbursementProblems`
        // reports a release nobody is accountable for.
        releasedBy: user?.id ?? asId<StaffUserId>('staff-unknown'),
        instrumentReference,
        remarks: remarks ?? found.release.remarks,
      }),
    );
  }

  acknowledge(
    id: DisbursementId,
    acknowledgement: ReleaseAcknowledgementDraft,
  ): Observable<Disbursement> {
    const user = this.access.currentUser();
    const denied = denyUnless<Disbursement>(user, 'disbursement.release');
    if (denied) {
      return denied;
    }

    const found = this.locate<Disbursement>(id, 'disbursement.release');
    if ('error' in found) {
      return found.error;
    }
    if (!canTransition(DISBURSEMENT_STATUS_TRANSITIONS, found.release.status, 'claimed')) {
      return throwError(() => new Error('Nothing has been released to acknowledge.'));
    }

    const now = asIsoDateTime(new Date());
    const updated = this.save(found.release, {
      status: 'claimed',
      acknowledgedAt: now,
      acknowledgement: {
        kind: acknowledgement.kind,
        acknowledgedAt: now,
        collectedBy: acknowledgement.collectedBy?.trim() || null,
        authority: acknowledgement.authority?.trim() || null,
      },
    });

    // A representative collecting on somebody's behalf must present authority.
    // Checked after assembly so the rule lives in one place, in the domain.
    const problems = disbursementProblems(updated);
    if (problems.length > 0) {
      this.releases = this.releases.map((entry) =>
        entry.id === found.release.id ? found.release : entry,
      );
      return throwError(() => new Error('That acknowledgement is incomplete.'));
    }

    return this.latency.respond(updated);
  }

  deferRelease(
    id: DisbursementId,
    reason: DeferralReason,
    remarks: string,
  ): Observable<Disbursement> {
    const user = this.access.currentUser();
    const denied = denyUnless<Disbursement>(user, 'disbursement.release');
    if (denied) {
      return denied;
    }
    if (remarks.trim().length === 0) {
      return throwError(() => new Error('Say what happened when they came.'));
    }

    const found = this.locate<Disbursement>(id, 'disbursement.release');
    if ('error' in found) {
      return found.error;
    }
    if (!canTransition(DISBURSEMENT_STATUS_TRANSITIONS, found.release.status, 'deferred')) {
      return throwError(() => new Error('That release cannot be deferred from its state.'));
    }

    return this.latency.respond(
      this.save(found.release, {
        status: 'deferred',
        deferralReason: reason,
        remarks: remarks.trim(),
      }),
    );
  }

  changeStatus(
    id: DisbursementId,
    to: DisbursementStatus,
    reason: string,
  ): Observable<Disbursement> {
    const user = this.access.currentUser();
    // Voiding is its own grant: cancelling an approved payout is not the same
    // authority as scheduling one.
    const permission: Permission = to === 'voided' ? 'disbursement.void' : 'disbursement.schedule';
    const denied = denyUnless<Disbursement>(user, permission);
    if (denied) {
      return denied;
    }
    if (reason.trim().length === 0) {
      return throwError(() => new Error('Say why the release is moving.'));
    }

    const found = this.locate<Disbursement>(id, permission);
    if ('error' in found) {
      return found.error;
    }
    if (!canTransition(DISBURSEMENT_STATUS_TRANSITIONS, found.release.status, to)) {
      return throwError(() => new Error('A release cannot move that way.'));
    }
    // Handing something over goes through `markReleased`, which records the
    // officer. Allowing it here would let a release happen with nobody named.
    if (to === 'released') {
      return throwError(() => new Error('Record the release itself, not a status change.'));
    }

    return this.latency.respond(
      this.save(found.release, { status: to, remarks: reason.trim() }),
    );
  }

  /* ── internals ──────────────────────────────────────────────────────────── */

  private isReadable(release: Disbursement, user: AuthenticatedUser | null): boolean {
    const beneficiary = this.residents.find(release.residentId);
    return (
      beneficiary !== undefined && isWithinBarangayScope(user, beneficiary.address.barangayId)
    );
  }

  private locate<TValue>(
    id: DisbursementId,
    permission: Permission,
  ): { readonly release: Disbursement } | { readonly error: Observable<TValue> } {
    const user = this.access.currentUser();
    const release = this.releases.find((entry) => entry.id === id);
    if (release === undefined || !this.isReadable(release, user)) {
      return { error: throwError(() => new PermissionDeniedError(permission)) };
    }
    return { release };
  }

  private save(release: Disbursement, changes: Partial<Disbursement>): Disbursement {
    const user = this.access.currentUser();
    const updated: Disbursement = {
      ...release,
      ...changes,
      audit: {
        ...release.audit,
        updatedAt: asIsoDateTime(new Date()),
        updatedBy: user?.id ?? null,
      },
    };
    this.releases = this.releases.map((entry) => (entry.id === release.id ? updated : entry));
    return updated;
  }

  private disclose(resident: Resident, user: AuthenticatedUser | null) {
    return discloseResident(resident, (permission: Permission) =>
      userHasPermission(user, permission),
    );
  }
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

/** Things the office got wrong first, then soonest scheduled. */
const QUEUE_RANK: Readonly<Record<string, number>> = {
  'needs-correction': 0,
  deferred: 1,
  'for-release': 2,
  scheduled: 3,
  unclaimed: 4,
  released: 5,
  claimed: 6,
};

function byQueueOrder(a: Disbursement, b: Disbursement): number {
  const rank = (QUEUE_RANK[a.status] ?? 9) - (QUEUE_RANK[b.status] ?? 9);
  if (rank !== 0) {
    return rank;
  }
  return (a.scheduledFor ?? '9999-12-31') < (b.scheduledFor ?? '9999-12-31') ? -1 : 1;
}

function matchesFilter(release: Disbursement, filter: DisbursementFilter): boolean {
  if (filter.status && release.status !== filter.status) {
    return false;
  }
  if (filter.method && release.method !== filter.method) {
    return false;
  }
  if (filter.kind && release.kind !== filter.kind) {
    return false;
  }
  if (filter.batchId && release.batchId !== filter.batchId) {
    return false;
  }
  if (filter.residentId && release.residentId !== filter.residentId) {
    return false;
  }
  if (filter.openOnly && !isReleaseOpen(release.status)) {
    return false;
  }
  const scheduled = release.scheduledFor;
  if (filter.scheduledFrom && (scheduled === null || scheduled < filter.scheduledFrom)) {
    return false;
  }
  if (filter.scheduledTo && (scheduled === null || scheduled > filter.scheduledTo)) {
    return false;
  }
  return matchesSearch(
    [release.referenceNumber, release.instrumentReference, release.remarks, release.inKindDescription],
    filter.search,
  );
}

function sortKey(release: Disbursement, field: DisbursementSortField): string {
  switch (field) {
    case 'scheduledFor':
      // Unscheduled sorts last rather than first: it is not more urgent than
      // something with a date, it simply has none.
      return release.scheduledFor ?? '9999-12-31';
    case 'status':
      return release.status;
    case 'amount':
      // Padded so string ordering matches numeric ordering, and goods sort
      // together at the bottom rather than as zero-value money.
      return String(release.amount?.centavos ?? 0).padStart(12, '0');
    case 'referenceNumber':
      return release.referenceNumber;
  }
}
