import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  RELEASE_STATUS_TRANSITIONS,
  asId,
  batchProgress,
  asIsoDateTime,
  batchProblems,
  canTransition,
  composeManifest,
  releaseProblems,
  discloseResident,
  isReleaseOpen,
  isWithinBarangayScope,
  PermissionDeniedError,
  releaseDraftProblems,
  todayAsIsoDate,
  userHasPermission,
  type AuthenticatedUser,
  type DeferralReason,
  type Release,
  type ReleaseFilter,
  type ReleaseId,
  type ReleaseRepository,
  type ReleaseStatus,
  type CursorPage,
  type CursorRequest,
  type Permission,
  type ReleaseDraft,
  type ReleaseKind,
  type ReleaseAcknowledgementDraft,
  type ReleaseBatch,
  type ReleaseBatchDraft,
  type ReleaseBatchId,
  type ReleaseManifest,
  type Resident,
  type StaffUserId,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockAssistanceRequestStore } from './mock-assistance-request.store';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';
import { matchesSearch } from './mock-query';
import {
  MOCK_DISBURSEMENTS,
  MOCK_RELEASE_APPROVERS,
  MOCK_RELEASE_BATCHES,
} from './seed/releases.seed';

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
 *  - **Permission.** `release.view` to read, `release.schedule` to
 *    batch, `release.release` to hand over, `release.void` to cancel.
 *  - **Scope.** A release is reachable only if its beneficiary is.
 *  - **Nothing posts.** No ledger, no journal, no account code. This tracks
 *    release operations; the treasury system is elsewhere (`DL-89`).
 *  - **Every move takes a reason**, and a deferral takes one from the fixed
 *    list of things the office got wrong.
 */
@Injectable()
export class MockReleaseRepository implements ReleaseRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly residents = inject(MockResidentStore);
  private readonly requests = inject(MockAssistanceRequestStore);

  private releases: readonly Release[] = [...MOCK_DISBURSEMENTS];
  private batches: readonly Omit<ReleaseBatch, 'progress'>[] = [...MOCK_RELEASE_BATCHES];
  private batchSequence = MOCK_RELEASE_BATCHES.length;
  private releaseSequence = MOCK_DISBURSEMENTS.length;

  /** Newest prepared first, a cursor page at a time, as the API pages it. */
  list(filter: ReleaseFilter, page: CursorRequest): Observable<CursorPage<Release>> {
    const user = this.access.currentUser();
    const denied = denyUnless<CursorPage<Release>>(user, 'release.view');
    if (denied) {
      return denied;
    }

    const sorted = this.releases
      .filter((release) => this.isReadable(release, user) && matchesFilter(release, filter))
      .sort(
        (a, b) =>
          b.audit.createdAt.localeCompare(a.audit.createdAt) || b.id.localeCompare(a.id),
      );
    // The id of the last row read stands in for the server's opaque cursor.
    const after = page.cursor ? sorted.findIndex((release) => release.id === page.cursor) : -1;
    const rest = sorted.slice(after + 1);
    const items = rest.slice(0, Math.max(1, page.limit));
    const hasMore = rest.length > items.length;
    const last = items[items.length - 1];
    return this.latency.respond({
      items,
      hasMore,
      nextCursor: hasMore && last !== undefined ? last.id : null,
    });
  }

  getById(id: ReleaseId): Observable<Release | null> {
    const user = this.access.currentUser();
    const release = this.releases.find((entry) => entry.id === id);

    // Not found and not yours read identically (`DL-31`).
    if (
      release === undefined ||
      !userHasPermission(user, 'release.view') ||
      !this.isReadable(release, user)
    ) {
      return this.latency.respond(null);
    }
    return this.latency.respond(release);
  }

  listForRequest(id: Release['requestId']): Observable<readonly Release[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly Release[]>(user, 'release.view');
    if (denied) {
      return denied;
    }
    return this.latency.respond(
      this.releases.filter((entry) => entry.requestId === id && this.isReadable(entry, user)),
    );
  }

  queue(filter: ReleaseFilter): Observable<readonly Release[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly Release[]>(user, 'release.view');
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

  approverFor(id: ReleaseId): Observable<StaffUserId | null> {
    const user = this.access.currentUser();
    const denied = denyUnless<StaffUserId | null>(user, 'release.view');
    if (denied) {
      return denied;
    }
    return this.latency.respond(MOCK_RELEASE_APPROVERS[id] ?? null);
  }

  /* ── batches ────────────────────────────────────────────────────────────── */

  listBatches(): Observable<readonly ReleaseBatch[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly ReleaseBatch[]>(user, 'release.view');
    if (denied) {
      return denied;
    }
    return this.latency.respond(
      [...this.batches]
        .sort((a, b) => (a.scheduledFor < b.scheduledFor ? 1 : -1))
        .map((batch) => this.counted(batch, user)),
    );
  }

  getBatch(id: ReleaseBatchId): Observable<ReleaseBatch | null> {
    const user = this.access.currentUser();
    if (!userHasPermission(user, 'release.view')) {
      return this.latency.respond(null);
    }
    const batch = this.batches.find((entry) => entry.id === id);
    return this.latency.respond(batch === undefined ? null : this.counted(batch, user));
  }

  createBatch(draft: ReleaseBatchDraft): Observable<ReleaseBatch> {
    const user = this.access.currentUser();
    const denied = denyUnless<ReleaseBatch>(user, 'release.schedule');
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
    const batch: Omit<ReleaseBatch, 'progress'> = {
      id: asId<ReleaseBatchId>(`rbt-${String(this.batchSequence).padStart(4, '0')}`),
      referenceNumber: `RB-${today.slice(0, 4)}-${String(this.batchSequence).padStart(4, '0')}`,
      title: draft.title.trim(),
      scheduledFor: draft.scheduledFor,
      venue: draft.venue.trim(),
      officerId: draft.officerId,
      releaseIds: draft.releaseIds,
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
      draft.releaseIds.includes(release.id)
        ? { ...release, batchId: batch.id, status: 'scheduled', scheduledFor: draft.scheduledFor }
        : release,
    );

    return this.latency.respond(this.counted(batch, user));
  }

  prepare(draft: ReleaseDraft): Observable<Release> {
    const user = this.access.currentUser();
    const denied = denyUnless<Release>(user, 'release.schedule');
    if (denied) {
      return denied;
    }
    if (releaseDraftProblems(draft).length > 0) {
      return throwError(() => new Error('That release needs correcting. Nothing was recorded.'));
    }
    // One payout per request at a time, as on the server.
    if (
      this.releases.some(
        (release) => release.requestId === draft.requestId && release.status !== 'voided',
      )
    ) {
      return throwError(
        () => new Error('This request already has a release. Void it before preparing another.'),
      );
    }
    const request = this.requests.requests.find((entry) => entry.id === draft.requestId);
    const beneficiary =
      request === undefined ? undefined : this.residents.find(request.residentId);
    if (
      request === undefined ||
      beneficiary === undefined ||
      !isWithinBarangayScope(user, beneficiary.address.barangayId)
    ) {
      return throwError(() => new PermissionDeniedError('release.schedule'));
    }
    if (request.status !== 'approved' && request.status !== 'scheduled') {
      return throwError(() => new Error('A release is prepared for an approved request.'));
    }
    // Who approved, read from the request's own history: the last move into `approved` (`DL-91`).
    const approval = [...request.statusHistory].reverse().find((change) => change.to === 'approved');

    this.releaseSequence += 1;
    const now = asIsoDateTime(new Date());
    const kind: ReleaseKind = draft.kind;
    const release: Release = {
      id: asId<ReleaseId>(`rel-${String(this.releaseSequence).padStart(4, '0')}`),
      requestId: draft.requestId,
      residentId: beneficiary.id,
      referenceNumber: `RL-${todayAsIsoDate().slice(0, 4)}-${String(this.releaseSequence).padStart(6, '0')}`,
      status: 'for-release',
      method: draft.method,
      kind,
      amount: draft.amount,
      inKindDescription: draft.inKindDescription,
      fundingSourceLabel: draft.fundingSourceLabel,
      approvingReference: draft.approvingReference,
      approvedBy: approval?.actorId ?? null,
      batchId: null,
      scheduledFor: null,
      releasedAt: null,
      releasedBy: null,
      acknowledgedAt: null,
      acknowledgement: null,
      deferralReason: null,
      instrumentReference: null,
      remarks: draft.remarks,
      audit: { createdAt: now, createdBy: user?.id ?? null, updatedAt: now, updatedBy: user?.id ?? null },
    };
    this.releases = [...this.releases, release];
    return this.latency.respond(release);
  }

  manifestFor(id: ReleaseBatchId): Observable<ReleaseManifest | null> {
    const user = this.access.currentUser();
    if (!userHasPermission(user, 'release.view')) {
      return this.latency.respond(null);
    }

    const batch = this.batches.find((entry) => entry.id === id);
    if (batch === undefined) {
      return this.latency.respond(null);
    }

    const entries = batch.releaseIds
      .map((releaseId) => this.releases.find((release) => release.id === releaseId))
      .filter((release): release is Release => release !== undefined)
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
    id: ReleaseId,
    instrumentReference: string | null,
    remarks: string | null,
  ): Observable<Release> {
    const user = this.access.currentUser();
    const denied = denyUnless<Release>(user, 'release.release');
    if (denied) {
      return denied;
    }

    const found = this.locate<Release>(id, 'release.release');
    if ('error' in found) {
      return found.error;
    }
    if (!canTransition(RELEASE_STATUS_TRANSITIONS, found.release.status, 'released')) {
      return throwError(() => new Error('That release cannot be handed over from its state.'));
    }

    return this.latency.respond(
      this.save(found.release, {
        status: 'released',
        releasedAt: asIsoDateTime(new Date()),
        // Recorded against a named officer, never left null: `releaseProblems`
        // reports a release nobody is accountable for.
        releasedBy: user?.id ?? asId<StaffUserId>('staff-unknown'),
        instrumentReference,
        remarks: remarks ?? found.release.remarks,
      }),
    );
  }

  acknowledge(
    id: ReleaseId,
    acknowledgement: ReleaseAcknowledgementDraft,
  ): Observable<Release> {
    const user = this.access.currentUser();
    const denied = denyUnless<Release>(user, 'release.release');
    if (denied) {
      return denied;
    }

    const found = this.locate<Release>(id, 'release.release');
    if ('error' in found) {
      return found.error;
    }
    if (!canTransition(RELEASE_STATUS_TRANSITIONS, found.release.status, 'claimed')) {
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
    const problems = releaseProblems(updated);
    if (problems.length > 0) {
      this.releases = this.releases.map((entry) =>
        entry.id === found.release.id ? found.release : entry,
      );
      return throwError(() => new Error('That acknowledgement is incomplete.'));
    }

    return this.latency.respond(updated);
  }

  deferRelease(
    id: ReleaseId,
    reason: DeferralReason,
    remarks: string,
  ): Observable<Release> {
    const user = this.access.currentUser();
    const denied = denyUnless<Release>(user, 'release.release');
    if (denied) {
      return denied;
    }
    if (remarks.trim().length === 0) {
      return throwError(() => new Error('Say what happened when they came.'));
    }

    const found = this.locate<Release>(id, 'release.release');
    if ('error' in found) {
      return found.error;
    }
    if (!canTransition(RELEASE_STATUS_TRANSITIONS, found.release.status, 'deferred')) {
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
    id: ReleaseId,
    to: ReleaseStatus,
    reason: string,
  ): Observable<Release> {
    const user = this.access.currentUser();
    // Voiding is its own grant: cancelling an approved payout is not the same
    // authority as scheduling one.
    const permission: Permission = to === 'voided' ? 'release.void' : 'release.schedule';
    const denied = denyUnless<Release>(user, permission);
    if (denied) {
      return denied;
    }
    if (reason.trim().length === 0) {
      return throwError(() => new Error('Say why the release is moving.'));
    }

    const found = this.locate<Release>(id, permission);
    if ('error' in found) {
      return found.error;
    }
    if (!canTransition(RELEASE_STATUS_TRANSITIONS, found.release.status, to)) {
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

  /** A session as planned, with its members counted as they stand (`DL-90`). */
  private counted(
    batch: Omit<ReleaseBatch, 'progress'>,
    user: AuthenticatedUser | null,
  ): ReleaseBatch {
    const members = this.releases.filter(
      (release) => batch.releaseIds.includes(release.id) && this.isReadable(release, user),
    );
    return { ...batch, progress: batchProgress(members) };
  }

  private isReadable(release: Release, user: AuthenticatedUser | null): boolean {
    const beneficiary = this.residents.find(release.residentId);
    return (
      beneficiary !== undefined && isWithinBarangayScope(user, beneficiary.address.barangayId)
    );
  }

  private locate<TValue>(
    id: ReleaseId,
    permission: Permission,
  ): { readonly release: Release } | { readonly error: Observable<TValue> } {
    const user = this.access.currentUser();
    const release = this.releases.find((entry) => entry.id === id);
    if (release === undefined || !this.isReadable(release, user)) {
      return { error: throwError(() => new PermissionDeniedError(permission)) };
    }
    return { release };
  }

  private save(release: Release, changes: Partial<Release>): Release {
    const user = this.access.currentUser();
    const updated: Release = {
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

function byQueueOrder(a: Release, b: Release): number {
  const rank = (QUEUE_RANK[a.status] ?? 9) - (QUEUE_RANK[b.status] ?? 9);
  if (rank !== 0) {
    return rank;
  }
  return (a.scheduledFor ?? '9999-12-31') < (b.scheduledFor ?? '9999-12-31') ? -1 : 1;
}

function matchesFilter(release: Release, filter: ReleaseFilter): boolean {
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
