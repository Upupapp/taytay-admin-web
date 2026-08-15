import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  ASSISTANCE_STATUS_CATALOG,
  CASE_QUEUE_IDS,
  CASE_STATUS_CATALOG,
  CASE_STATUS_TRANSITIONS,
  barangayName,
  byNewestEventFirst,
  canTransition,
  computeVulnerability,
  currentMembers,
  daysUntil,
  discloseCaseNote,
  discloseResident,
  discloseSnapshot,
  isInQueue,
  isValidCaseReason,
  isValidNoteBody,
  isWithinBarangayScope,
  nextAction,
  openTaskCount,
  paginate,
  permissionForCaseTransition,
  PermissionDeniedError,
  presentFactors,
  todayAsIsoDate,
  userHasPermission,
  type AssistanceRequest,
  type AuthenticatedUser,
  type CaseEvent,
  type CaseFilter,
  type CaseId,
  type CaseNoteSensitivity,
  type CaseNoteView,
  type CaseQueueCount,
  type CaseQueueFacts,
  type CaseRepository,
  type CaseSortField,
  type CaseStatus,
  type CaseSummary,
  type CaseTaskDraft,
  type CaseTaskId,
  type CaseTimelineEntry,
  type CaseWorkspace,
  type FamilySummary,
  type Household,
  type HouseholdSummary,
  type IsoDate,
  type IsoDateTime,
  type Page,
  type PageRequest,
  type Permission,
  type Resident,
  type ResidentId,
  type ResidentView,
  type SocialCase,
  type StaffUserId,
  type VulnerabilitySnapshot,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockCaseStore } from './mock-case.store';
import { MockFamilyStore } from './mock-family.store';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';
import { matchesSearch, sortItems } from './mock-query';
import { MOCK_ASSISTANCE_REQUESTS } from './seed/assistance-requests.seed';
import { MOCK_STAFF } from './seed/staff.seed';

/**
 * The case adapter.
 *
 * Four rules it enforces rather than assumes:
 *
 *  - **Refusals here, not only in the UI.** Every mutation re-checks the
 *    permission the control was hidden behind, and a lifecycle move re-checks
 *    the permission its *destination* requires, so a reachable button changes
 *    nothing it should not (`DL-30`).
 *  - **A note is redacted on the way out** (`DL-38`). Callers receive
 *    `CaseNoteView` with the body already gone, never a `CaseNote` they are
 *    trusted to mask.
 *  - **Every mutation returns the whole workspace**, so a screen can never show
 *    a status its own timeline does not explain.
 *  - **`assigned-cases` finally narrows something** (`DL-57`).
 */
@Injectable()
export class MockCaseRepository implements CaseRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly cases = inject(MockCaseStore);
  private readonly residents = inject(MockResidentStore);
  private readonly families = inject(MockFamilyStore);

  list(filter: CaseFilter, page: PageRequest<CaseSortField>): Observable<Page<CaseSummary>> {
    const user = this.access.currentUser();
    const denied = denyUnless<Page<CaseSummary>>(user, 'case.view');
    if (denied) {
      return denied;
    }

    const summaries = this.summaries(user).filter((summary) => this.matches(summary, filter, user));
    const sort = page.sort ?? { field: 'nextAction' as const, direction: 'asc' as const };
    const sorted = sortItems(summaries, (summary) => sortKey(summary, sort.field), sort.direction);
    return this.latency.respond(paginate(sorted, page));
  }

  /**
   * Counts every queue under the *same* scope and the same filters the list
   * uses, minus the queue itself. A badge that counts differently from the list
   * it opens is worse than no badge.
   */
  queueCounts(filter: CaseFilter): Observable<readonly CaseQueueCount[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly CaseQueueCount[]>(user, 'case.view');
    if (denied) {
      return denied;
    }

    const summaries = this.summaries(user).filter((summary) =>
      this.matches(summary, { ...filter, queue: undefined }, user),
    );
    return this.latency.respond(
      CASE_QUEUE_IDS.map((queue) => ({
        queue,
        count: summaries.filter((summary) => isInQueue(queue, summary.facts, user?.id ?? null))
          .length,
      })),
    );
  }

  getById(id: CaseId): Observable<CaseWorkspace | null> {
    const user = this.access.currentUser();
    const record = this.cases.findCase(id);

    // Out of scope reads exactly like "does not exist" (`DL-31`).
    if (!record || !userHasPermission(user, 'case.view') || !this.inScope(record, user)) {
      return this.latency.respond(null);
    }
    const workspace = this.workspace(record, user);
    return this.latency.respond(workspace);
  }

  casesForResident(residentId: ResidentId): Observable<readonly CaseSummary[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly CaseSummary[]>(user, 'case.view');
    if (denied) {
      return denied;
    }
    return this.latency.respond(
      this.cases
        .casesForResident(residentId)
        .filter((record) => this.inScope(record, user))
        .map((record) => this.summarise(record, user))
        .filter((summary): summary is CaseSummary => summary !== null),
    );
  }

  /* ── Mutations ──────────────────────────────────────────────────────────── */

  changeStatus(id: CaseId, to: CaseStatus, reason: string): Observable<CaseWorkspace> {
    const user = this.access.currentUser();
    // The permission the *destination* requires, not a blanket one: closing a
    // case is a different authority from moving it along.
    const required = permissionForCaseTransition(to);
    const denied = denyUnless<CaseWorkspace>(user, required);
    if (denied) {
      return denied;
    }
    const badReason = this.reasonProblem<CaseWorkspace>(reason);
    if (badReason) {
      return badReason;
    }

    const record = this.mutable(id, user);
    if (record === null) {
      return throwError(() => new PermissionDeniedError(required));
    }
    // Already there is already done: a retried move returns the current state
    // rather than a true-but-useless refusal (`DL-51`).
    if (record.status !== to && !canTransition(CASE_STATUS_TRANSITIONS, record.status, to)) {
      const from = CASE_STATUS_CATALOG[record.status].label;
      return throwError(
        () => new Error(`A case cannot move from ${from} to ${CASE_STATUS_CATALOG[to].label}.`),
      );
    }

    const updated = this.cases.changeStatus(record, to, reason, actorOf(user));
    return this.respondWith(updated, user);
  }

  assign(id: CaseId, staffUserId: StaffUserId | null, reason: string): Observable<CaseWorkspace> {
    const user = this.access.currentUser();
    const denied = denyUnless<CaseWorkspace>(user, 'case.manage');
    if (denied) {
      return denied;
    }
    const badReason = this.reasonProblem<CaseWorkspace>(reason);
    if (badReason) {
      return badReason;
    }

    const record = this.mutable(id, user);
    if (record === null) {
      return throwError(() => new PermissionDeniedError('case.manage'));
    }
    if (staffUserId !== null && !MOCK_STAFF.some((member) => member.id === staffUserId)) {
      return throwError(() => new Error('That member of staff is not on the register.'));
    }

    const updated = this.cases.assign(record, staffUserId, reason, actorOf(user));
    return this.respondWith(updated, user);
  }

  addNote(
    id: CaseId,
    body: string,
    sensitivity: CaseNoteSensitivity,
    reason: string,
  ): Observable<CaseWorkspace> {
    const user = this.access.currentUser();
    const denied = denyUnless<CaseWorkspace>(user, 'case.note');
    if (denied) {
      return denied;
    }
    // Writing into the protected tier requires the clearance to read it. A note
    // its own author cannot re-open is a note that gets written somewhere else.
    if (sensitivity === 'protected' && !userHasPermission(user, 'case.view-protected-note')) {
      return throwError(() => new PermissionDeniedError('case.view-protected-note'));
    }
    if (!isValidNoteBody(body)) {
      return throwError(() => new Error('A note needs enough words to be worth keeping.'));
    }
    const badReason = this.reasonProblem<CaseWorkspace>(reason);
    if (badReason) {
      return badReason;
    }

    const record = this.mutable(id, user);
    if (record === null) {
      return throwError(() => new PermissionDeniedError('case.note'));
    }

    this.cases.addNote(id, body, sensitivity, reason, actorOf(user));
    return this.respondWith(record, user);
  }

  addTask(id: CaseId, draft: CaseTaskDraft, reason: string): Observable<CaseWorkspace> {
    const user = this.access.currentUser();
    const denied = denyUnless<CaseWorkspace>(user, 'case.manage');
    if (denied) {
      return denied;
    }
    if (draft.title.trim().length === 0) {
      return throwError(() => new Error('Say what has to be done.'));
    }
    const badReason = this.reasonProblem<CaseWorkspace>(reason);
    if (badReason) {
      return badReason;
    }

    const record = this.mutable(id, user);
    if (record === null) {
      return throwError(() => new PermissionDeniedError('case.manage'));
    }

    this.cases.addTask(id, draft, reason, actorOf(user));
    return this.respondWith(record, user);
  }

  completeTask(id: CaseId, taskId: CaseTaskId, reason: string): Observable<CaseWorkspace> {
    const user = this.access.currentUser();
    const denied = denyUnless<CaseWorkspace>(user, 'case.manage');
    if (denied) {
      return denied;
    }
    const badReason = this.reasonProblem<CaseWorkspace>(reason);
    if (badReason) {
      return badReason;
    }

    const record = this.mutable(id, user);
    const task = this.cases.findTask(taskId);
    if (record === null || task === undefined || task.caseId !== id) {
      return throwError(() => new PermissionDeniedError('case.manage'));
    }

    this.cases.completeTask(task, reason, actorOf(user));
    return this.respondWith(record, user);
  }

  /* ── Scope ──────────────────────────────────────────────────────────────── */

  /**
   * `assigned-cases` narrows to the viewer's own caseload **plus the unassigned
   * pool** (`DL-57`).
   *
   * An unassigned case is not somebody else's file; it is the office's, and
   * seeing it is how work gets picked up. A colleague's caseload is the thing
   * the scope exists to withhold, and it stays withheld.
   */
  private inScope(record: SocialCase, user: AuthenticatedUser | null): boolean {
    if (user === null || !isWithinBarangayScope(user, record.barangayId)) {
      return false;
    }
    if (user.scope !== 'assigned-cases') {
      return true;
    }
    return record.assignedTo === null || record.assignedTo === user.id;
  }

  /** The case a mutation may touch, or `null` for "not yours, not here". */
  private mutable(id: CaseId, user: AuthenticatedUser | null): SocialCase | null {
    const record = this.cases.findCase(id);
    return !record || !this.inScope(record, user) ? null : record;
  }

  /** Every mutation answers with the whole workspace, read after the change. */
  private respondWith(
    record: SocialCase,
    user: AuthenticatedUser | null,
  ): Observable<CaseWorkspace> {
    const workspace = this.workspace(record, user);
    return workspace === null
      ? throwError(() => new Error('That case record is incomplete and could not be loaded.'))
      : this.latency.respond(workspace);
  }

  private reasonProblem<TValue>(reason: string): Observable<TValue> | null {
    return isValidCaseReason(reason)
      ? null
      : throwError(
          () => new Error('Say why, in enough words that a colleague reading this can follow it.'),
        );
  }

  /* ── Assembly ───────────────────────────────────────────────────────────── */

  private summaries(user: AuthenticatedUser | null): readonly CaseSummary[] {
    return this.cases
      .allCases()
      .filter((record) => this.inScope(record, user))
      .map((record) => this.summarise(record, user))
      .filter((summary): summary is CaseSummary => summary !== null);
  }

  /**
   * `null` when the subject is not on the registry. That cannot happen with the
   * seed as written, and a case whose subject does not exist is a broken record
   * rather than one to render half of.
   */
  private summarise(record: SocialCase, user: AuthenticatedUser | null): CaseSummary | null {
    const subject = this.residents.find(record.subjectResidentId);
    if (subject === undefined) {
      return null;
    }

    const tasks = this.cases.tasksFor(record.id);
    const action = nextAction(tasks);
    const lastActivity = this.timeline(record, user)[0]?.occurredAt ?? null;
    const today = todayAsIsoDate();

    const facts: CaseQueueFacts = {
      status: record.status,
      assignedTo: record.assignedTo,
      daysUntilNextAction: action === null ? null : daysUntil(action.dueOn, today),
      daysSinceLastActivity: lastActivity === null ? null : daysUntil(today, dayOf(lastActivity)),
    };

    return {
      record,
      subject: this.disclose(subject, user),
      assignedToName: staffName(record.assignedTo),
      openTaskCount: openTaskCount(tasks),
      nextAction: action,
      facts,
      lastActivityAt: lastActivity,
      openRequestCount: this.requestsFor(record).filter((request) => isRequestOpen(request)).length,
    };
  }

  private workspace(record: SocialCase, user: AuthenticatedUser | null): CaseWorkspace | null {
    const summary = this.summarise(record, user);
    if (summary === null) {
      return null;
    }

    const household =
      record.householdId === null ? undefined : this.residents.findHousehold(record.householdId);
    const members = (household?.members ?? [])
      .map((member) => this.residents.find(member.residentId))
      .filter((resident): resident is Resident => resident !== undefined);
    const snapshot = household === undefined ? null : this.snapshot(household, members, user);

    const householdSummary: HouseholdSummary | null =
      household === undefined || snapshot === null
        ? null
        : {
            household,
            headName: this.nameOf(this.residents.find(household.headResidentId), user),
            memberCount: household.members.length,
            // Counted from what the viewer can see, so the number and the list agree.
            band: snapshot.band,
            presentFactorCount: presentFactors(snapshot).length,
          };

    return {
      record,
      subject: summary.subject,
      household: householdSummary,
      vulnerability: snapshot,
      family: this.familySummary(record, household, user),
      householdMembers: members.map((member) => this.disclose(member, user)),
      requests: this.requestsFor(record),
      notes: this.notesFor(record, user),
      tasks: [...this.cases.tasksFor(record.id)].sort((a, b) => (a.dueOn < b.dueOn ? -1 : 1)),
      timeline: this.timeline(record, user),
      nextAction: summary.nextAction,
      assignedToName: summary.assignedToName,
    };
  }

  private snapshot(
    household: Household,
    members: readonly Resident[],
    user: AuthenticatedUser | null,
  ): VulnerabilitySnapshot {
    return discloseSnapshot(
      computeVulnerability({
        household,
        members,
        corrections: this.residents.correctionsFor(household.id),
        now: new Date(),
      }),
      userHasPermission(user, 'request.view-sensitive'),
    );
  }

  private familySummary(
    record: SocialCase,
    household: Household | undefined,
    user: AuthenticatedUser | null,
  ): FamilySummary | null {
    if (record.familyId === null) {
      return null;
    }
    const family = this.families.findFamily(record.familyId);
    if (family === undefined) {
      return null;
    }
    const memberIds = this.families.memberIds(family);
    const head = memberIds[0] === undefined ? undefined : this.residents.find(memberIds[0]);

    return {
      family,
      headName: head === undefined ? 'No head recorded' : this.disclose(head, user).listedName,
      memberCount: currentMembers(family).length,
      householdReference: household?.referenceNumber ?? null,
      barangayId: household?.address.barangayId ?? null,
      relationshipCount: this.families
        .relationshipsFor(memberIds)
        .filter((relationship) => relationship.until === null).length,
    };
  }

  private notesFor(record: SocialCase, user: AuthenticatedUser | null): readonly CaseNoteView[] {
    return [...this.cases.notesFor(record.id)]
      .sort((a, b) => byNewestEventFirst({ occurredAt: a.createdAt }, { occurredAt: b.createdAt }))
      .map((note) =>
        discloseCaseNote(note, (permission: Permission) => userHasPermission(user, permission)),
      );
  }

  private requestsFor(record: SocialCase): readonly AssistanceRequest[] {
    return MOCK_ASSISTANCE_REQUESTS.filter((request) =>
      record.linkedRequestIds.includes(request.id),
    );
  }

  /**
   * The case's own events, its notes, its completed tasks and the status
   * history of every assistance request attached to it — merged, newest first.
   *
   * Merging here rather than on the screen is what makes the first acceptance
   * criterion true: a caseworker sees that the grant was endorsed on the 4th
   * and the home visit happened on the 6th in one column, without opening the
   * requests module to find out (`DL-56`).
   */
  private timeline(
    record: SocialCase,
    user: AuthenticatedUser | null,
  ): readonly CaseTimelineEntry[] {
    // Reversed before merging: the store appends in order, and two events
    // recorded in the same millisecond must still read newest-first once a
    // stable descending sort has left them where it found them.
    const entries: CaseTimelineEntry[] = [...this.cases.eventsFor(record.id)]
      .reverse()
      .map(fromEvent);

    for (const note of this.notesFor(record, user)) {
      entries.push({
        ...BLANK_ENTRY,
        id: `note:${note.id}`,
        source: 'note',
        kind: 'note-added',
        occurredAt: note.createdAt,
        actorName: note.authorName,
        detail: note.body,
        isWithheld: note.isWithheld,
      });
    }

    for (const task of this.cases.tasksFor(record.id)) {
      if (task.completedAt === null) {
        continue;
      }
      entries.push({
        ...BLANK_ENTRY,
        id: `task:${task.id}`,
        source: 'task',
        kind: 'task-completed',
        occurredAt: task.completedAt,
        actorName: staffName(task.completedBy) ?? 'Unknown',
        reason: task.outcome,
        reference: task.title,
      });
    }

    for (const request of this.requestsFor(record)) {
      for (const [index, change] of request.statusHistory.entries()) {
        entries.push({
          ...BLANK_ENTRY,
          id: `req:${request.id}:${index}`,
          source: 'assistance-request',
          kind: 'request-status-changed',
          occurredAt: change.occurredAt,
          actorName: change.actorName,
          reason: change.reason,
          fromRequestStatus: change.from,
          toRequestStatus: change.to,
          reference: request.referenceNumber,
          detail: ASSISTANCE_STATUS_CATALOG[change.to].label,
        });
      }
    }

    return entries.sort(byNewestEventFirst);
  }

  private disclose(resident: Resident, user: AuthenticatedUser | null): ResidentView {
    return discloseResident(resident, (permission: Permission) =>
      userHasPermission(user, permission),
    );
  }

  /** A name for someone who may not be on the registry, disclosed either way. */
  private nameOf(resident: Resident | undefined, user: AuthenticatedUser | null): string {
    return resident === undefined ? 'Not recorded' : this.disclose(resident, user).listedName;
  }

  private matches(
    summary: CaseSummary,
    filter: CaseFilter,
    user: AuthenticatedUser | null,
  ): boolean {
    if (filter.status && summary.record.status !== filter.status) {
      return false;
    }
    if (filter.category && summary.record.category !== filter.category) {
      return false;
    }
    if (filter.barangayId && summary.record.barangayId !== filter.barangayId) {
      return false;
    }
    if (filter.assignedTo && summary.record.assignedTo !== filter.assignedTo) {
      return false;
    }
    if (filter.queue && !isInQueue(filter.queue, summary.facts, user?.id ?? null)) {
      return false;
    }
    return matchesSearch(
      [
        summary.record.referenceNumber,
        summary.record.summary,
        summary.subject.listedName,
        summary.assignedToName,
        barangayName(summary.record.barangayId),
      ],
      filter.search,
    );
  }
}

/* ── helpers ───────────────────────────────────────────────────────────────── */

const BLANK_ENTRY: Omit<CaseTimelineEntry, 'id' | 'source' | 'kind' | 'occurredAt' | 'actorName'> =
  {
    reason: null,
    fromCaseStatus: null,
    toCaseStatus: null,
    fromRequestStatus: null,
    toRequestStatus: null,
    reference: null,
    detail: null,
    isWithheld: false,
  };

function fromEvent(event: CaseEvent): CaseTimelineEntry {
  return {
    ...BLANK_ENTRY,
    id: `case:${event.id}`,
    source: 'case',
    kind: event.kind,
    occurredAt: event.occurredAt,
    actorName: event.actorName,
    reason: event.reason,
    fromCaseStatus: event.fromStatus,
    toCaseStatus: event.toStatus,
  };
}

function isRequestOpen(request: AssistanceRequest): boolean {
  return !['completed', 'rejected', 'cancelled', 'expired'].includes(request.status);
}

function actorOf(user: AuthenticatedUser | null): { id: StaffUserId | null; name: string } {
  return { id: user?.id ?? null, name: user?.displayName ?? 'Unknown' };
}

function staffName(id: StaffUserId | null): string | null {
  if (id === null) {
    return null;
  }
  const member = MOCK_STAFF.find((candidate) => candidate.id === id);
  return member === undefined ? null : `${member.name.first} ${member.name.last}`;
}

function dayOf(moment: IsoDateTime): IsoDate {
  return todayAsIsoDate(new Date(moment));
}

function sortKey(summary: CaseSummary, field: CaseSortField): string | number {
  switch (field) {
    case 'reference':
      return summary.record.referenceNumber;
    case 'opened':
      return summary.record.openedOn;
    case 'status':
      return CASE_STATUS_CATALOG[summary.record.status].label;
    case 'nextAction':
      // Cases with nothing owed sort last: a queue is read from the top.
      return summary.nextAction?.dueOn ?? '9999-12-31';
    case 'updatedAt':
      return summary.record.audit.updatedAt;
  }
}
