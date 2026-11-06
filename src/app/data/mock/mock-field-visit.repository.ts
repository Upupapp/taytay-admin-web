import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  PermissionDeniedError,
  VISIT_STATUS_TRANSITIONS,
  VisitInvalidError,
  asId,
  asIsoDateTime,
  byVisitDate,
  canTransition,
  isVisitOverdue,
  discloseResident,
  isWithinBarangayScope,
  observationProblems,
  todayAsIsoDate,
  userHasPermission,
  visitDraftProblems,
  visitOutcomeProblems,
  type AuthenticatedUser,
  type CursorPage,
  type CursorRequest,
  type FieldVisit,
  type FieldVisitDraft,
  type FieldVisitFilter,
  type FieldVisitId,
  type FieldVisitRepository,
  type IsoDate,
  type Permission,
  type ResidentId,
  type StaffUserId,
  type VisitObservation,
  type VisitObservationDraft,
  type VisitObservationId,
  type VisitOutcomeDraft,
  type VisitChecklistSelection,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';
import { matchesSearch } from './mock-query';
import { MOCK_FIELD_VISITS } from './seed/field-visits.seed';

/**
 * The field visit adapter.
 *
 * Three rules re-checked here rather than only in the UI (`DL-30`):
 *
 *  - **Permission.** `visit.view` to read a visit and `visit.manage` to schedule, record or close
 *    one — the keys the server checks (TAB 03, `DL-181`).
 *  - **Scope.** A visit is reachable only if its client is, so a
 *    barangay-confined account cannot read one about a neighbour elsewhere.
 *  - **Append-only observations.** `recordObservations` adds; there is no path
 *    that edits or removes one. A worker correcting an earlier observation
 *    records another saying so (`DL-85`).
 *
 * And one absence: nothing in this file reads, stores or returns a location.
 */
@Injectable()
export class MockFieldVisitRepository implements FieldVisitRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly residents = inject(MockResidentStore);

  private visits: readonly FieldVisit[] = [...MOCK_FIELD_VISITS];
  private sequence = MOCK_FIELD_VISITS.length;
  private observationSequence = MOCK_FIELD_VISITS.reduce(
    (total, visit) => total + visit.observations.length,
    0,
  );

  /**
   * A cursor page in the server's order: what is still owed first, soonest first, then what is
   * over, latest first (`DL-181`).
   */
  list(filter: FieldVisitFilter, page: CursorRequest): Observable<CursorPage<FieldVisit>> {
    const user = this.access.currentUser();
    const denied = denyUnless<CursorPage<FieldVisit>>(user, 'visit.view');
    if (denied) {
      return denied;
    }

    const today = todayAsIsoDate();
    const sorted = this.visits
      .filter((visit) => this.isReadable(visit, user) && matchesFilter(visit, filter, today))
      .sort(byWhatIsOwed);
    // The id of the last row read stands in for the server's opaque cursor.
    const after = page.cursor ? sorted.findIndex((visit) => visit.id === page.cursor) : -1;
    const rest = sorted.slice(after + 1);
    const items = rest.slice(0, Math.max(1, page.limit));
    const hasMore = rest.length > items.length;
    const last = items[items.length - 1];
    return this.latency.respond({
      items: items.map((visit) => this.present(visit, user)),
      hasMore,
      nextCursor: hasMore && last !== undefined ? last.id : null,
    });
  }

  getById(id: FieldVisitId): Observable<FieldVisit | null> {
    const user = this.access.currentUser();
    const visit = this.visits.find((entry) => entry.id === id);

    // Not found and not yours read identically (`DL-31`).
    if (
      visit === undefined ||
      !userHasPermission(user, 'visit.view') ||
      !this.isReadable(visit, user)
    ) {
      return this.latency.respond(null);
    }
    return this.latency.respond(this.present(visit, user));
  }

  mine(filter: FieldVisitFilter): Observable<readonly FieldVisit[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly FieldVisit[]>(user, 'visit.view');
    if (denied) {
      return denied;
    }

    const today = todayAsIsoDate();
    const own = this.visits.filter(
      (visit) =>
        visit.assignedTo === user?.id &&
        this.isReadable(visit, user) &&
        matchesFilter(visit, filter, today),
    );
    return this.latency.respond([...own].sort(byVisitDate).map((visit) => this.present(visit, user)));
  }

  forResident(id: ResidentId): Observable<readonly FieldVisit[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly FieldVisit[]>(user, 'visit.view');
    if (denied) {
      return denied;
    }
    const visible = this.visits.filter(
      (visit) => visit.residentId === id && this.isReadable(visit, user),
    );
    return this.latency.respond(
      [...visible].sort(byVisitDate).map((visit) => this.present(visit, user)),
    );
  }

  schedule(draft: FieldVisitDraft): Observable<FieldVisit> {
    const user = this.access.currentUser();
    const denied = denyUnless<FieldVisit>(user, 'visit.manage');
    if (denied) {
      return denied;
    }

    const client = this.residents.find(draft.residentId);
    if (client === undefined || !isWithinBarangayScope(user, client.address.barangayId)) {
      return throwError(() => new PermissionDeniedError('visit.manage'));
    }

    const today = todayAsIsoDate();
    const problems = visitDraftProblems(draft, today);
    if (problems.length > 0) {
      return throwError(() => new VisitInvalidError(problems));
    }

    this.sequence += 1;
    const now = asIsoDateTime(new Date());
    const visit: FieldVisit = {
      id: asId<FieldVisitId>(`fv-${String(this.sequence).padStart(4, '0')}`),
      referenceNumber: `HV-${today.slice(0, 4)}-${String(this.sequence).padStart(4, '0')}`,
      caseId: draft.caseId,
      residentId: draft.residentId,
      householdId: draft.householdId,
      status: 'scheduled',
      purpose: draft.purpose,
      assignedTo: draft.assignedTo,
      scheduledFor: draft.scheduledFor,
      scheduledWindow: draft.scheduledWindow,
      // Copied, not referenced: a household that later moves must not rewrite
      // where a past visit was made.
      addressVisited: draft.addressVisited.trim(),
      checklist: draft.checklist,
      observations: [],
      serviceNeeds: null,
      declinedReason: null,
      outcome: null,
      completedAt: null,
      withheld: [],
      audit: {
        createdAt: now,
        createdBy: user?.id ?? null,
        updatedAt: now,
        updatedBy: user?.id ?? null,
      },
    };

    this.visits = [...this.visits, visit];
    return this.latency.respond(visit);
  }

  recordObservations(
    id: FieldVisitId,
    observations: readonly VisitObservationDraft[],
  ): Observable<FieldVisit> {
    const user = this.access.currentUser();
    const denied = denyUnless<FieldVisit>(user, 'visit.manage');
    if (denied) {
      return denied;
    }

    const found = this.locate<FieldVisit>(id);
    if ('error' in found) {
      return found.error;
    }

    const problems = observations.flatMap((draft) => observationProblems(draft));
    if (problems.length > 0) {
      return throwError(() => new VisitInvalidError(problems));
    }
    // A visit cancelled before it was made was never attended: nothing was observed on it.
    if (found.visit.status === 'cancelled') {
      return throwError(() => new Error('This visit was cancelled before it was made.'));
    }

    const now = asIsoDateTime(new Date());
    const appended: VisitObservation[] = observations.map((draft) => {
      this.observationSequence += 1;
      return {
        id: asId<VisitObservationId>(`vob-${String(this.observationSequence).padStart(4, '0')}`),
        kind: draft.kind,
        body: draft.body.trim(),
        attributedTo: draft.attributedTo?.trim() ?? null,
        recordedBy: user?.id ?? asId<StaffUserId>('staff-unknown'),
        recordedAt: now,
      };
    });

    // Appended. There is no path here that edits or removes an observation.
    return this.latency.respond(
      this.save(found.visit, { observations: [...found.visit.observations, ...appended] }),
    );
  }

  setChecklist(
    id: FieldVisitId,
    items: readonly VisitChecklistSelection[],
  ): Observable<FieldVisit> {
    const user = this.access.currentUser();
    const denied = denyUnless<FieldVisit>(user, 'visit.manage');
    if (denied) {
      return denied;
    }

    const found = this.locate<FieldVisit>(id);
    if ('error' in found) {
      return found.error;
    }
    // The checklist is what was checked on the visit: kept as it stood when the visit closed.
    if (found.visit.status !== 'scheduled') {
      return throwError(() => new Error('That visit has already been closed.'));
    }

    /*
     * Applies each line's stated value, and leaves alone any line the caller did not mention.
     *
     * The old shape took only the ticked codes and rebuilt the whole list from them, so anything
     * absent became unticked. That is a different rule from the API's, which records one line at a
     * time and touches nothing else — and a mock that silently clears lines nobody named would
     * hide the difference until a worker lost a tick against the real server.
     */
    const stated = new Map(items.map((item) => [item.code, item.checked]));

    return this.latency.respond(
      this.save(found.visit, {
        checklist: found.visit.checklist.map((item) => ({
          ...item,
          checked: stated.get(item.code) ?? item.checked,
        })),
      }),
    );
  }

  close(id: FieldVisitId, outcome: VisitOutcomeDraft): Observable<FieldVisit> {
    const user = this.access.currentUser();
    const denied = denyUnless<FieldVisit>(user, 'visit.manage');
    if (denied) {
      return denied;
    }

    const found = this.locate<FieldVisit>(id);
    if ('error' in found) {
      return found.error;
    }

    const problems = visitOutcomeProblems(outcome);
    if (problems.length > 0) {
      return throwError(() => new VisitInvalidError(problems));
    }
    if (!canTransition(VISIT_STATUS_TRANSITIONS, found.visit.status, outcome.status)) {
      // Every outcome is terminal, so this is the check that stops a completed
      // visit being re-closed differently a week later.
      return throwError(() => new Error('That visit has already been closed.'));
    }

    return this.latency.respond(
      this.save(found.visit, {
        status: outcome.status,
        outcome: outcome.outcome.trim(),
        serviceNeeds: outcome.serviceNeeds?.trim() ?? null,
        declinedReason: outcome.declinedReason?.trim() ?? null,
        completedAt: asIsoDateTime(new Date()),
      }),
    );
  }

  /* ── internals ──────────────────────────────────────────────────────────── */

  /** Scope is inherited from the client, so the two cannot drift apart. */
  private isReadable(visit: FieldVisit, user: AuthenticatedUser | null): boolean {
    const client = this.residents.find(visit.residentId);
    return client !== undefined && isWithinBarangayScope(user, client.address.barangayId);
  }

  private locate<TValue>(
    id: FieldVisitId,
  ): { readonly visit: FieldVisit } | { readonly error: Observable<TValue> } {
    const user = this.access.currentUser();
    const visit = this.visits.find((entry) => entry.id === id);
    if (visit === undefined || !this.isReadable(visit, user)) {
      return { error: throwError(() => new PermissionDeniedError('visit.manage' as Permission)) };
    }
    return { visit };
  }

  /**
   * The visit as this reader may see it: a protected household's words and address are withheld
   * from a reader without `request.view-sensitive`, in the data layer, as the server withholds them.
   */
  private present(visit: FieldVisit, user: AuthenticatedUser | null): FieldVisit {
    const client = this.residents.find(visit.residentId);
    const isProtected =
      client !== undefined &&
      discloseResident(client, (permission: Permission) => userHasPermission(user, permission))
        .isProtected;
    if (!isProtected || userHasPermission(user, 'request.view-sensitive')) {
      return visit;
    }
    return {
      ...visit,
      addressVisited: '',
      observations: visit.observations.map((entry) => ({ ...entry, body: '', attributedTo: null })),
      serviceNeeds: null,
      declinedReason: null,
      outcome: null,
      withheld: ['words', 'address'],
    };
  }

  private save(visit: FieldVisit, changes: Partial<FieldVisit>): FieldVisit {
    const user = this.access.currentUser();
    const updated: FieldVisit = {
      ...visit,
      ...changes,
      audit: {
        ...visit.audit,
        updatedAt: asIsoDateTime(new Date()),
        updatedBy: user?.id ?? null,
      },
    };
    this.visits = this.visits.map((entry) => (entry.id === visit.id ? updated : entry));
    return updated;
  }
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

function matchesFilter(visit: FieldVisit, filter: FieldVisitFilter, today: IsoDate): boolean {
  if (filter.status && visit.status !== filter.status) {
    return false;
  }
  if (filter.purpose && visit.purpose !== filter.purpose) {
    return false;
  }
  if (filter.assignedTo && visit.assignedTo !== filter.assignedTo) {
    return false;
  }
  if (filter.residentId && visit.residentId !== filter.residentId) {
    return false;
  }
  if (filter.caseId && visit.caseId !== filter.caseId) {
    return false;
  }
  if (filter.from && visit.scheduledFor < filter.from) {
    return false;
  }
  if (filter.to && visit.scheduledFor > filter.to) {
    return false;
  }
  if (filter.overdueOnly && !isVisitOverdue(visit, today)) {
    return false;
  }
  // The reference number only, as the server searches: not the address, nothing a household said
  // (`DL-109`).
  return matchesSearch([visit.referenceNumber], filter.search);
}

/** What is still owed first, soonest first; then what is over, latest first — the server's order. */
function byWhatIsOwed(a: FieldVisit, b: FieldVisit): number {
  const aOpen = a.status === 'scheduled';
  const bOpen = b.status === 'scheduled';
  if (aOpen !== bOpen) {
    return aOpen ? -1 : 1;
  }
  const byDate = aOpen
    ? a.scheduledFor.localeCompare(b.scheduledFor)
    : b.scheduledFor.localeCompare(a.scheduledFor);
  return byDate || a.id.localeCompare(b.id);
}
