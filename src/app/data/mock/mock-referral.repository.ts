import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  DisclosurePlanInvalidError,
  PermissionDeniedError,
  ReferralDraftInvalidError,
  REFERRAL_STATUS_TRANSITIONS,
  asId,
  asIsoDateTime,
  byReferralUrgency,
  canTransition,
  composeReferralSummary,
  defaultFollowUpDate,
  disclosurePlanProblems,
  discloseResident,
  isReferralOpen,
  isReferralOverdue,
  isWithinBarangayScope,
  paginate,
  referralDraftProblems,
  todayAsIsoDate,
  userHasPermission,
  type AuthenticatedUser,
  type DisclosurePlan,
  type IsoDate,
  type Page,
  type PageRequest,
  type Permission,
  type Referral,
  type ReferralDraft,
  type ReferralFilter,
  type ReferralId,
  type ReferralNoteId,
  type ReferralRepository,
  type ReferralSortField,
  type ReferralStatus,
  type ReferralSummarySheet,
  type Resident,
  type ResidentId,
  type ServiceProvider,
  type ServiceProviderFilter,
  type ServiceProviderId,
  type StaffUserId,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';
import { matchesSearch, sortItems } from './mock-query';
import { MOCK_REFERRALS } from './seed/referrals.seed';
import { MOCK_SERVICE_PROVIDERS } from './seed/service-providers.seed';

/**
 * The referral adapter.
 *
 * **This file gained its permission checks in TAB 15.** Before that it had
 * none: `list` and `getById` returned seeded referrals to any caller, including
 * an unauthenticated one, and out-of-scope records were not filtered. That was a
 * real hole — a referral names a client, a receiving office and a reason, which
 * together disclose more than most single records here.
 *
 * Four rules, re-checked here rather than only in the UI (`DL-30`):
 *
 *  - **Permission.** `referral.view` to read, `referral.manage` to create, send,
 *    move or annotate.
 *  - **Scope.** A referral is reachable only if its client is, so a
 *    barangay-confined account cannot read one about a neighbour elsewhere.
 *  - **Disclosure.** `send` refuses without a lawful basis, and the summary is
 *    composed from the recorded plan — never from the whole record (`DL-81`).
 *  - **Append-only.** Notes are appended; outcomes and status moves take a
 *    reason. Nothing here edits or deletes what was recorded.
 */
@Injectable()
export class MockReferralRepository implements ReferralRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly residents = inject(MockResidentStore);

  private referrals: readonly Referral[] = [...MOCK_REFERRALS];
  private readonly providers: readonly ServiceProvider[] = [...MOCK_SERVICE_PROVIDERS];
  private sequence = MOCK_REFERRALS.length;
  private noteSequence = MOCK_REFERRALS.reduce(
    (total, referral) => total + referral.handoffNotes.length,
    0,
  );

  list(
    filter: ReferralFilter,
    page: PageRequest<ReferralSortField>,
  ): Observable<Page<Referral>> {
    const user = this.access.currentUser();
    const denied = denyUnless<Page<Referral>>(user, 'referral.view');
    if (denied) {
      return denied;
    }

    const today = todayAsIsoDate();
    const visible = this.referrals.filter(
      (referral) => this.isReadable(referral, user) && matchesFilter(referral, filter, today),
    );

    const sort = page.sort ?? { field: 'referredAt' as const, direction: 'desc' as const };
    const sorted = sortItems(visible, (referral) => sortKey(referral, sort.field), sort.direction);
    return this.latency.respond(paginate(sorted, page));
  }

  getById(id: ReferralId): Observable<Referral | null> {
    const user = this.access.currentUser();
    const referral = this.referrals.find((entry) => entry.id === id);

    // Not found and not yours read identically (`DL-31`).
    if (
      referral === undefined ||
      !userHasPermission(user, 'referral.view') ||
      !this.isReadable(referral, user)
    ) {
      return this.latency.respond(null);
    }
    return this.latency.respond(referral);
  }

  forResident(id: ResidentId): Observable<readonly Referral[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly Referral[]>(user, 'referral.view');
    if (denied) {
      return denied;
    }
    const visible = this.referrals
      .filter((referral) => referral.residentId === id && this.isReadable(referral, user))
      .slice()
      .sort((a, b) => (a.referredAt < b.referredAt ? 1 : -1));
    return this.latency.respond(visible);
  }

  queue(filter: ReferralFilter): Observable<readonly Referral[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly Referral[]>(user, 'referral.view');
    if (denied) {
      return denied;
    }

    const today = todayAsIsoDate();
    const open = this.referrals.filter(
      (referral) =>
        this.isReadable(referral, user) &&
        isReferralOpen(referral.status) &&
        matchesFilter(referral, filter, today),
    );

    // Overdue first, then most urgent, then oldest — the order the work is
    // actually done in, computed rather than left to a sort dropdown.
    return this.latency.respond([...open].sort((a, b) => byReferralUrgency(a, b, today)));
  }

  createDraft(draft: ReferralDraft): Observable<Referral> {
    const user = this.access.currentUser();
    const denied = denyUnless<Referral>(user, 'referral.manage');
    if (denied) {
      return denied;
    }

    const client = this.residents.find(draft.residentId);
    if (client === undefined || !isWithinBarangayScope(user, client.address.barangayId)) {
      return throwError(() => new PermissionDeniedError('referral.manage'));
    }

    const today = todayAsIsoDate();
    const problems = referralDraftProblems(draft, today);
    if (problems.length > 0) {
      return throwError(() => new ReferralDraftInvalidError(problems));
    }

    this.sequence += 1;
    const now = asIsoDateTime(new Date());
    const referral: Referral = {
      id: asId<ReferralId>(`ref-${String(this.sequence).padStart(4, '0')}`),
      referenceNumber: `RF-${today.slice(0, 4)}-${String(this.sequence).padStart(4, '0')}`,
      residentId: draft.residentId,
      requestId: draft.requestId,
      caseId: draft.caseId,
      destination: draft.destination,
      destinationName: draft.destinationName.trim(),
      providerId: draft.providerId,
      status: 'draft',
      urgency: draft.urgency,
      serviceRequested: draft.serviceRequested.trim(),
      reason: draft.reason.trim(),
      destinationContact: draft.destinationContact,
      // A draft discloses nothing. The plan is recorded in the same act as the
      // sending, so there is no window in which a referral is sendable without
      // a lawful basis (`DL-81`).
      disclosure: null,
      referredBy: user?.id ?? asId<StaffUserId>('staff-unknown'),
      referredAt: now,
      followUpOn: draft.followUpOn ?? defaultFollowUpDate(today, draft.urgency),
      respondedAt: null,
      outcome: null,
      handoffNotes: [],
      audit: { createdAt: now, createdBy: user?.id ?? null, updatedAt: now, updatedBy: user?.id ?? null },
    };

    this.referrals = [...this.referrals, referral];
    return this.latency.respond(referral);
  }

  send(id: ReferralId, plan: DisclosurePlan): Observable<Referral> {
    const user = this.access.currentUser();
    const denied = denyUnless<Referral>(user, 'referral.manage');
    if (denied) {
      return denied;
    }

    const found = this.locate<Referral>(id, 'referral.manage');
    if ('error' in found) {
      return found.error;
    }

    const problems = disclosurePlanProblems(plan);
    if (problems.length > 0) {
      return throwError(() => new DisclosurePlanInvalidError(problems));
    }

    if (!canTransition(REFERRAL_STATUS_TRANSITIONS, found.referral.status, 'sent')) {
      return throwError(() => new Error('That referral has already been sent.'));
    }

    // A field the sender could not themselves read must not be shared onward.
    // Enforced here rather than trusted to the form: the composing screen shows
    // only what the user may see, but the request is what actually arrives.
    const client = this.residents.find(found.referral.residentId);
    if (client === undefined) {
      return throwError(() => new PermissionDeniedError('referral.manage'));
    }
    const withheld = this.disclose(client, user).withheld;
    if (withheld.length > 0 && plan.extraFields.length > 0) {
      return throwError(() => new PermissionDeniedError('referral.manage'));
    }

    return this.latency.respond(
      this.save(found.referral, {
        status: 'sent',
        disclosure: plan,
        referredAt: asIsoDateTime(new Date()),
      }),
    );
  }

  summaryFor(id: ReferralId): Observable<ReferralSummarySheet | null> {
    const user = this.access.currentUser();
    const denied = denyUnless<ReferralSummarySheet | null>(user, 'referral.view');
    if (denied) {
      return denied;
    }

    const referral = this.referrals.find((entry) => entry.id === id);
    if (referral === undefined || !this.isReadable(referral, user)) {
      return this.latency.respond(null);
    }
    // No plan, no sheet. A summary composed from a referral nobody authorised
    // would be a disclosure the office cannot account for.
    if (referral.disclosure === null) {
      return this.latency.respond(null);
    }

    const client = this.residents.find(referral.residentId);
    if (client === undefined) {
      return this.latency.respond(null);
    }

    return this.latency.respond(
      composeReferralSummary({
        referral,
        client: this.disclose(client, user),
        plan: referral.disclosure,
        serviceRequested: referral.serviceRequested,
      }),
    );
  }

  changeStatus(id: ReferralId, to: ReferralStatus, reason: string): Observable<Referral> {
    const user = this.access.currentUser();
    const denied = denyUnless<Referral>(user, 'referral.manage');
    if (denied) {
      return denied;
    }
    if (reason.trim().length === 0) {
      return throwError(() => new Error('Say why the referral is moving.'));
    }

    const found = this.locate<Referral>(id, 'referral.manage');
    if ('error' in found) {
      return found.error;
    }
    if (!canTransition(REFERRAL_STATUS_TRANSITIONS, found.referral.status, to)) {
      return throwError(() => new Error('A referral cannot move that way.'));
    }
    // Sending is not an ordinary move: it discloses, so it goes through `send`
    // and carries a plan. Allowing it here would route around that.
    if (to === 'sent') {
      return throwError(() => new Error('Send the referral from the summary, with its disclosure.'));
    }

    return this.latency.respond(
      this.save(found.referral, {
        status: to,
        respondedAt: found.referral.respondedAt ?? asIsoDateTime(new Date()),
        handoffNotes: [...found.referral.handoffNotes, this.note(reason, user)],
      }),
    );
  }

  recordOutcome(id: ReferralId, outcome: string, status: ReferralStatus): Observable<Referral> {
    const user = this.access.currentUser();
    const denied = denyUnless<Referral>(user, 'referral.manage');
    if (denied) {
      return denied;
    }
    if (outcome.trim().length === 0) {
      return throwError(() => new Error('Say what the receiving office did.'));
    }

    const found = this.locate<Referral>(id, 'referral.manage');
    if ('error' in found) {
      return found.error;
    }
    if (!canTransition(REFERRAL_STATUS_TRANSITIONS, found.referral.status, status)) {
      return throwError(() => new Error('A referral cannot move that way.'));
    }

    return this.latency.respond(
      this.save(found.referral, {
        status,
        outcome: outcome.trim(),
        respondedAt: found.referral.respondedAt ?? asIsoDateTime(new Date()),
      }),
    );
  }

  reschedule(id: ReferralId, followUpOn: IsoDate, reason: string): Observable<Referral> {
    const user = this.access.currentUser();
    const denied = denyUnless<Referral>(user, 'referral.manage');
    if (denied) {
      return denied;
    }
    if (reason.trim().length === 0) {
      return throwError(() => new Error('Say why the follow-up is moving.'));
    }

    const found = this.locate<Referral>(id, 'referral.manage');
    if ('error' in found) {
      return found.error;
    }

    // Moving a chase date quietly is how an overdue referral stops being
    // overdue without anybody acting on it, so the reason is appended as a note.
    return this.latency.respond(
      this.save(found.referral, {
        followUpOn,
        handoffNotes: [...found.referral.handoffNotes, this.note(reason, user)],
      }),
    );
  }

  addNote(id: ReferralId, body: string): Observable<Referral> {
    const user = this.access.currentUser();
    const denied = denyUnless<Referral>(user, 'referral.manage');
    if (denied) {
      return denied;
    }
    if (body.trim().length === 0) {
      return throwError(() => new Error('A note needs something in it.'));
    }

    const found = this.locate<Referral>(id, 'referral.manage');
    if ('error' in found) {
      return found.error;
    }

    return this.latency.respond(
      this.save(found.referral, {
        handoffNotes: [...found.referral.handoffNotes, this.note(body, user)],
      }),
    );
  }

  listProviders(filter: ServiceProviderFilter): Observable<readonly ServiceProvider[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly ServiceProvider[]>(user, 'referral.view');
    if (denied) {
      return denied;
    }

    const matched = this.providers.filter((provider) => {
      if (filter.destination && provider.destination !== filter.destination) {
        return false;
      }
      if (filter.status && provider.status !== filter.status) {
        return false;
      }
      return matchesSearch(
        [provider.name, provider.address, ...provider.servicesOffered],
        filter.search,
      );
    });

    return this.latency.respond(sortItems(matched, (provider) => provider.name, 'asc'));
  }

  getProvider(id: ServiceProviderId): Observable<ServiceProvider | null> {
    const user = this.access.currentUser();
    if (!userHasPermission(user, 'referral.view')) {
      return this.latency.respond(null);
    }
    return this.latency.respond(this.providers.find((provider) => provider.id === id) ?? null);
  }

  /* ── internals ──────────────────────────────────────────────────────────── */

  /**
   * A referral is readable when its client is. Scope is inherited from the
   * person rather than stored on the referral, so the two cannot disagree after
   * a household moves.
   */
  private isReadable(referral: Referral, user: AuthenticatedUser | null): boolean {
    const client = this.residents.find(referral.residentId);
    return client !== undefined && isWithinBarangayScope(user, client.address.barangayId);
  }

  private locate<TValue>(
    id: ReferralId,
    permission: Permission,
  ): { readonly referral: Referral } | { readonly error: Observable<TValue> } {
    const user = this.access.currentUser();
    const referral = this.referrals.find((entry) => entry.id === id);
    if (referral === undefined || !this.isReadable(referral, user)) {
      return { error: throwError(() => new PermissionDeniedError(permission)) };
    }
    return { referral };
  }

  private save(referral: Referral, changes: Partial<Referral>): Referral {
    const user = this.access.currentUser();
    const updated: Referral = {
      ...referral,
      ...changes,
      audit: {
        ...referral.audit,
        updatedAt: asIsoDateTime(new Date()),
        updatedBy: user?.id ?? null,
      },
    };
    this.referrals = this.referrals.map((entry) => (entry.id === referral.id ? updated : entry));
    return updated;
  }

  private note(body: string, user: AuthenticatedUser | null) {
    this.noteSequence += 1;
    return {
      id: asId<ReferralNoteId>(`rfn-${String(this.noteSequence).padStart(4, '0')}`),
      body: body.trim(),
      authorId: user?.id ?? asId<StaffUserId>('staff-unknown'),
      authorName: user?.displayName ?? 'Unknown',
      recordedAt: asIsoDateTime(new Date()),
    };
  }

  private disclose(resident: Resident, user: AuthenticatedUser | null) {
    return discloseResident(resident, (permission: Permission) =>
      userHasPermission(user, permission),
    );
  }
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

function matchesFilter(referral: Referral, filter: ReferralFilter, today: IsoDate): boolean {
  if (filter.status && referral.status !== filter.status) {
    return false;
  }
  if (filter.destination && referral.destination !== filter.destination) {
    return false;
  }
  if (filter.urgency && referral.urgency !== filter.urgency) {
    return false;
  }
  if (filter.residentId && referral.residentId !== filter.residentId) {
    return false;
  }
  if (filter.caseId && referral.caseId !== filter.caseId) {
    return false;
  }
  if (filter.openOnly && !isReferralOpen(referral.status)) {
    return false;
  }
  if (filter.overdueOnly && !isReferralOverdue(referral, today)) {
    return false;
  }
  return matchesSearch(
    [referral.referenceNumber, referral.destinationName, referral.reason, referral.serviceRequested],
    filter.search,
  );
}

function sortKey(referral: Referral, field: ReferralSortField): string {
  switch (field) {
    case 'referredAt':
      return referral.referredAt;
    case 'urgency':
      // Ordered by rank rather than alphabetically, so "urgent" does not sort
      // after "routine" for no reason a reader could guess.
      return { urgent: '0', priority: '1', routine: '2' }[referral.urgency];
    case 'status':
      return referral.status;
    case 'followUpOn':
      // A referral with no chase date sorts last rather than first: it is not
      // more urgent than one that is due, it is simply unscheduled.
      return referral.followUpOn ?? '9999-12-31';
  }
}
