import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  CASE_QUEUE_IDS,
  CASE_SEARCH_MAX_LENGTH,
  CASE_SEARCH_MIN_LENGTH,
  CASE_STATUS_CATALOG,
  CASE_STATUS_TRANSITIONS,
  PROTECTED_CASE_WITHHELD,
  assignsCases,
  byNewestEventFirst,
  canTransition,
  caseOpenProblems,
  caseQueueFacts,
  caseTimeline,
  computeVulnerability,
  currentMembers,
  discloseCaseNote,
  discloseHousehold,
  discloseResident,
  discloseSnapshot,
  hasSensitiveSector,
  householdClearance,
  isAllowedTaskAssignee,
  isInQueue,
  isTaskOpen,
  isTerminalAssistanceStatus,
  isValidCaseReason,
  isValidNoteBody,
  isWithinBarangayScope,
  lastActivityAt,
  nextAction,
  openTaskCount,
  permissionForCaseTransition,
  PermissionDeniedError,
  presentFactors,
  userHasPermission,
  type AssistanceRequest,
  type AssistanceRequestId,
  type AuthenticatedUser,
  type CaseFilter,
  type CaseId,
  type CaseNoteSensitivity,
  type CaseNoteView,
  type CaseOpenDraft,
  type CaseQueueCount,
  type CaseRepository,
  type CaseStatus,
  type CaseSummary,
  type CaseTask,
  type CaseTaskDraft,
  type CaseTaskId,
  type CaseTimelineEntry,
  type CaseWithheldField,
  type CaseWorkspace,
  type CursorPage,
  type CursorRequest,
  type FamilySummary,
  type Household,
  type HouseholdClearance,
  type HouseholdSummary,
  type IsoDate,
  type Permission,
  type Resident,
  type ResidentId,
  type ResidentView,
  type SocialCase,
  type SocialWorker,
  type StaffUserId,
  type VulnerabilitySnapshot,
} from '@domain/index';

import { denyUnless } from './mock-access';
import {
  MockAssistanceRequestStore,
  discloseRequest,
  inReach,
} from './mock-assistance-request.store';
import { MockCaseStore, type StoredCase } from './mock-case.store';
import { MockFamilyStore } from './mock-family.store';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';
import { MOCK_STAFF } from './seed/staff.seed';

/** The words the server answers a refused write with, so a screen reads the same either way. */
const CLOSED =
  'This case is closed. A closed case is kept as it ended; a situation that recurs is opened as a new case continuing this one.';
const WITHHELD_WRITE =
  'This case is about a person under a protected sector, and its words are withheld from your account, so nothing can be added to it from here.';
const ONE_CASE_PER_REQUEST =
  'That request already belongs to another case. A request is one intervention in one case.';

/**
 * The case adapter, brought to the office server's rules (`DL-179`).
 *
 * What it enforces rather than assumes:
 *
 *  - **Refusals here, not only in the UI.** Every mutation re-checks the
 *    permission the control was hidden behind, and a lifecycle move re-checks
 *    the permission its *destination* requires (`DL-30`).
 *  - **A caseload is the cases assigned to it**, and nothing else — not the
 *    unassigned pool (`DL-179`, superseding `DL-57`). Opening and assigning a
 *    case are refused to one; its household and family are not named to it.
 *  - **Words are withheld on the way out** (`DL-38`): a protected note's body,
 *    and on a protected subject's case every word, from a reader not cleared for
 *    them. That reader cannot add to the case.
 *  - **`closed` is terminal** (`DL-53`): every write on a closed case is refused,
 *    and closing is refused while a task is open.
 *  - **Every mutation returns the whole workspace**, so a screen can never show
 *    a status its own timeline does not explain.
 */
@Injectable()
export class MockCaseRepository implements CaseRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly cases = inject(MockCaseStore);
  private readonly residents = inject(MockResidentStore);
  private readonly families = inject(MockFamilyStore);
  private readonly requestStore = inject(MockAssistanceRequestStore);

  /** Newest opened first, a cursor page at a time, as the server pages it (`DL-161`). */
  list(filter: CaseFilter, page: CursorRequest): Observable<CursorPage<CaseSummary>> {
    const user = this.access.currentUser();
    const denied =
      denyUnless<CursorPage<CaseSummary>>(user, 'case.view') ?? this.filterProblem(filter, user);
    if (denied) {
      return denied;
    }

    const sorted = this.summaries(user)
      .filter((summary) => this.matches(summary, filter, user))
      .sort(
        (a, b) =>
          b.record.openedOn.localeCompare(a.record.openedOn) ||
          b.record.id.localeCompare(a.record.id),
      );
    // The id of the last row read stands in for the server's opaque cursor.
    const after = page.cursor
      ? sorted.findIndex((summary) => summary.record.id === page.cursor)
      : -1;
    const rest = sorted.slice(after + 1);
    const items = rest.slice(0, Math.max(1, page.limit));
    const hasMore = rest.length > items.length;
    const last = items[items.length - 1];
    return this.latency.respond({
      items,
      hasMore,
      nextCursor: hasMore && last !== undefined ? last.record.id : null,
    });
  }

  /**
   * Counts every queue under the *same* scope and the same filters the list
   * uses, minus the queue itself. A badge that counts differently from the list
   * it opens is worse than no badge.
   */
  queueCounts(filter: CaseFilter): Observable<readonly CaseQueueCount[]> {
    const user = this.access.currentUser();
    const denied =
      denyUnless<readonly CaseQueueCount[]>(user, 'case.view') ?? this.filterProblem(filter, user);
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
    return this.latency.respond(this.workspace(record, user));
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
        .filter((summary): summary is CaseSummary => summary !== null)
        .sort((a, b) => b.record.openedOn.localeCompare(a.record.openedOn)),
    );
  }

  /** The open social workers, by name — refused to a caseload, as assigning is (`DL-179`). */
  listAssignees(): Observable<readonly SocialWorker[]> {
    const user = this.access.currentUser();
    const denied = this.assignerProblem<readonly SocialWorker[]>(user);
    if (denied) {
      return denied;
    }
    return this.latency.respond(socialWorkers());
  }

  /* ── Mutations ──────────────────────────────────────────────────────────── */

  open(draft: CaseOpenDraft, reason: string): Observable<CaseWorkspace> {
    const user = this.access.currentUser();
    const denied =
      this.assignerProblem<CaseWorkspace>(user) ?? this.reasonProblem<CaseWorkspace>(reason);
    if (denied) {
      return denied;
    }
    if (caseOpenProblems(draft).length > 0) {
      return throwError(
        () =>
          new Error(
            'Say what the presenting problem is, in 8 to 500 characters. Nothing was sent.',
          ),
      );
    }
    const subject = this.residents.find(draft.subjectResidentId);
    if (
      subject === undefined ||
      user === null ||
      !isWithinBarangayScope(user, subject.address.barangayId)
    ) {
      return throwError(() => new Error('No resident on file has that id.'));
    }
    if (draft.continuesCaseId !== null) {
      const prior = this.cases.findCase(draft.continuesCaseId);
      if (prior === undefined || !this.inScope(prior, user)) {
        return throwError(() => new Error('No case you can read has that id.'));
      }
      if (prior.status !== 'closed') {
        return throwError(
          () =>
            new Error(
              'That case is still open. An open case is worked, not continued; a new case continues one that is closed.',
            ),
        );
      }
    }
    const linked = [...new Set(draft.linkedRequestIds)];
    for (const requestId of linked) {
      const problem = this.linkProblem(requestId, subject.id, null, user);
      if (problem !== null) {
        return throwError(() => new Error(problem));
      }
    }

    const opened = this.cases.open(
      { ...draft, linkedRequestIds: linked },
      subject.address.barangayId,
      this.residents.householdOfResident(subject.id)?.id ?? null,
      reason,
      actorOf(user),
    );
    return this.respondWith(opened, user);
  }

  linkRequest(
    id: CaseId,
    requestId: AssistanceRequestId,
    reason: string,
  ): Observable<CaseWorkspace> {
    const outcome = this.writable(id, 'case.manage', reason);
    if ('error' in outcome) {
      return outcome.error;
    }
    const problem = this.linkProblem(
      requestId,
      outcome.record.subjectResidentId,
      outcome.record.id,
      outcome.user,
    );
    if (problem !== null) {
      return throwError(() => new Error(problem));
    }
    const updated = this.cases.linkRequest(
      outcome.record,
      requestId,
      reason,
      actorOf(outcome.user),
    );
    return this.respondWith(updated, outcome.user);
  }

  changeStatus(id: CaseId, to: CaseStatus, reason: string): Observable<CaseWorkspace> {
    // The permission the *destination* requires, not a blanket one: closing a
    // case is a different authority from moving it along.
    const outcome = this.writable(id, permissionForCaseTransition(to), reason);
    if ('error' in outcome) {
      return outcome.error;
    }
    const { record, user } = outcome;
    // Already there is already done: a retried move returns the current state
    // rather than a true-but-useless refusal (`DL-51`).
    if (record.status !== to && !canTransition(CASE_STATUS_TRANSITIONS, record.status, to)) {
      const from = CASE_STATUS_CATALOG[record.status].label;
      return throwError(
        () => new Error(`A case cannot move from ${from} to ${CASE_STATUS_CATALOG[to].label}.`),
      );
    }
    const open = openTaskCount(this.cases.tasksFor(record.id));
    if (to === 'closed' && open > 0) {
      return throwError(() => new Error(openTasksAtClosure(open)));
    }

    const updated = this.cases.changeStatus(record, to, reason, actorOf(user));
    return this.respondWith(updated, user);
  }

  assign(id: CaseId, staffUserId: StaffUserId | null, reason: string): Observable<CaseWorkspace> {
    const refused = this.assignerProblem<CaseWorkspace>(this.access.currentUser());
    if (refused) {
      return refused;
    }
    const outcome = this.writable(id, 'case.manage', reason);
    if ('error' in outcome) {
      return outcome.error;
    }
    if (staffUserId !== null && !socialWorkers().some((worker) => worker.id === staffUserId)) {
      return throwError(() => new Error('A case is given to an active social worker.'));
    }
    const updated = this.cases.assign(outcome.record, staffUserId, reason, actorOf(outcome.user));
    return this.respondWith(updated, outcome.user);
  }

  addNote(
    id: CaseId,
    body: string,
    sensitivity: CaseNoteSensitivity,
    reason: string,
  ): Observable<CaseWorkspace> {
    const user = this.access.currentUser();
    // Writing into the protected tier requires the clearance to read it. A note
    // its own author cannot re-open is a note that gets written somewhere else.
    if (
      userHasPermission(user, 'case.note') &&
      sensitivity === 'protected' &&
      !userHasPermission(user, 'case-note.view-protected')
    ) {
      return throwError(() => new PermissionDeniedError('case-note.view-protected'));
    }
    if (!isValidNoteBody(body)) {
      return throwError(() => new Error('A note needs enough words to be worth keeping.'));
    }
    const outcome = this.writable(id, 'case.note', reason);
    if ('error' in outcome) {
      return outcome.error;
    }
    this.cases.addNote(id, body, sensitivity, reason, actorOf(outcome.user));
    return this.respondWith(outcome.record, outcome.user);
  }

  addTask(id: CaseId, draft: CaseTaskDraft, reason: string): Observable<CaseWorkspace> {
    if (draft.title.trim().length === 0) {
      return throwError(() => new Error('Say what has to be done.'));
    }
    const outcome = this.writable(id, 'case.manage', reason);
    if ('error' in outcome) {
      return outcome.error;
    }
    const owed = this.owable(draft.assignedTo, outcome.record, outcome.user);
    if (owed) {
      return owed;
    }
    this.cases.addTask(id, draft, staffName(draft.assignedTo), reason, actorOf(outcome.user));
    return this.respondWith(outcome.record, outcome.user);
  }

  completeTask(id: CaseId, taskId: CaseTaskId, reason: string): Observable<CaseWorkspace> {
    const outcome = this.taskFor(id, taskId, reason);
    if ('error' in outcome) {
      return outcome.error;
    }
    this.cases.completeTask(outcome.task, reason, actorOf(outcome.user));
    return this.respondWith(outcome.record, outcome.user);
  }

  assignTask(
    id: CaseId,
    taskId: CaseTaskId,
    staffUserId: StaffUserId | null,
    reason: string,
  ): Observable<CaseWorkspace> {
    const outcome = this.taskFor(id, taskId, reason);
    if ('error' in outcome) {
      return outcome.error;
    }
    const owed = this.owable(staffUserId, outcome.record, outcome.user);
    if (owed) {
      return owed;
    }
    this.cases.assignTask(
      outcome.task,
      staffUserId,
      staffName(staffUserId),
      reason,
      actorOf(outcome.user),
    );
    return this.respondWith(outcome.record, outcome.user);
  }

  rescheduleTask(
    id: CaseId,
    taskId: CaseTaskId,
    dueOn: IsoDate,
    reason: string,
  ): Observable<CaseWorkspace> {
    const outcome = this.taskFor(id, taskId, reason);
    if ('error' in outcome) {
      return outcome.error;
    }
    this.cases.rescheduleTask(outcome.task, dueOn, reason, actorOf(outcome.user));
    return this.respondWith(outcome.record, outcome.user);
  }

  /* ── The checks every write shares ──────────────────────────────────────── */

  /**
   * The permission, the reason, the scope, and the two refusals a case adds: words withheld from
   * the writer, and a closed case (`DL-53`, `DL-179`). Written once, because three copies of a guard
   * is how the third one comes to be missing a clause nobody notices (`DL-30`).
   */
  private writable(
    id: CaseId,
    permission: Permission,
    reason: string,
  ):
    | { readonly record: StoredCase; readonly user: AuthenticatedUser | null }
    | { readonly error: Observable<CaseWorkspace> } {
    const user = this.access.currentUser();
    const denied =
      denyUnless<CaseWorkspace>(user, permission) ?? this.reasonProblem<CaseWorkspace>(reason);
    if (denied) {
      return { error: denied };
    }
    const record = this.cases.findCase(id);
    if (record === undefined || !this.inScope(record, user)) {
      return { error: throwError(() => new PermissionDeniedError(permission)) };
    }
    if (this.wordsWithheld(record, user)) {
      return { error: throwError(() => new Error(WITHHELD_WRITE)) };
    }
    if (record.status === 'closed') {
      return { error: throwError(() => new Error(CLOSED)) };
    }
    return { record, user };
  }

  /** The three task acts: an open task on this case, under the write checks. */
  private taskFor(
    id: CaseId,
    taskId: CaseTaskId,
    reason: string,
  ):
    | {
        readonly record: StoredCase;
        readonly task: CaseTask;
        readonly user: AuthenticatedUser | null;
      }
    | { readonly error: Observable<CaseWorkspace> } {
    const outcome = this.writable(id, 'case.manage', reason);
    if ('error' in outcome) {
      return outcome;
    }
    const task = this.cases.findTask(taskId);
    if (task === undefined || task.caseId !== id) {
      return { error: throwError(() => new Error('That task was not found on this case.')) };
    }
    if (!isTaskOpen(task)) {
      return {
        error: throwError(
          () =>
            new Error(
              `That task is ${task.status === 'done' ? 'done' : 'cancelled'}, and is kept as it ended.`,
            ),
        ),
      };
    }
    return { record: outcome.record, task, user: outcome.user };
  }

  /** A task is owed by the writer, whoever holds the case, or nobody yet (`DL-179`). */
  private owable(
    assignee: StaffUserId | null,
    record: StoredCase,
    user: AuthenticatedUser | null,
  ): Observable<CaseWorkspace> | null {
    return isAllowedTaskAssignee(assignee, user?.id ?? null, record.assignedTo)
      ? null
      : throwError(
          () =>
            new Error(
              'A task is owed by somebody who can see the case: yourself, whoever holds the case, or nobody yet.',
            ),
        );
  }

  /** Opening, assigning and the list of assignees are an assigner's, never a caseload's. */
  private assignerProblem<TValue>(user: AuthenticatedUser | null): Observable<TValue> | null {
    const denied = denyUnless<TValue>(user, 'case.manage');
    if (denied) {
      return denied;
    }
    return assignsCases(user?.scope ?? null, true)
      ? null
      : throwError(
          () =>
            new Error(
              'Cases are opened and given to social workers by intake and the head. An account that works its own caseload does neither.',
            ),
        );
  }

  /**
   * A filed request the writer may read, about the subject or somebody in the subject's household
   * today, and in no other case. `null` when it may be named.
   */
  private linkProblem(
    requestId: AssistanceRequestId,
    subjectId: ResidentId,
    caseId: CaseId | null,
    user: AuthenticatedUser | null,
  ): string | null {
    const request = this.requestStore.requests.find((entry) => entry.id === requestId);
    if (request === undefined || request.referenceNumber === '' || !inReach(user, request)) {
      return 'No filed request you can read has that id.';
    }
    if (request.residentId !== subjectId) {
      const home = this.residents.householdOfResident(subjectId);
      if (
        home === undefined ||
        this.residents.householdOfResident(request.residentId)?.id !== home.id
      ) {
        return 'That request is about somebody outside this person’s household. A case names the interventions for its own household.';
      }
    }
    const owner = this.cases.caseOfRequest(requestId);
    return owner !== undefined && owner.id !== caseId ? ONE_CASE_PER_REQUEST : null;
  }

  /** The server's 422 and 403 on a filter, said before anything is read. */
  private filterProblem<TValue>(
    filter: CaseFilter,
    user: AuthenticatedUser | null,
  ): Observable<TValue> | null {
    const search = filter.search?.trim() ?? '';
    if (
      search !== '' &&
      (search.length < CASE_SEARCH_MIN_LENGTH || search.length > CASE_SEARCH_MAX_LENGTH)
    ) {
      return throwError(
        () => new Error('Type between 2 and 40 characters of a case number to search the cases.'),
      );
    }
    if (
      user !== null &&
      user.scope !== 'assigned-cases' &&
      filter.barangayId !== undefined &&
      !isWithinBarangayScope(user, filter.barangayId)
    ) {
      return throwError(() => new PermissionDeniedError('case.view'));
    }
    return null;
  }

  private reasonProblem<TValue>(reason: string): Observable<TValue> | null {
    return isValidCaseReason(reason)
      ? null
      : throwError(
          () => new Error('Say why, in enough words that a colleague reading this can follow it.'),
        );
  }

  /* ── Scope and disclosure ───────────────────────────────────────────────── */

  /**
   * `assigned-cases` reads **only the cases assigned to it** (`DL-179`, superseding `DL-57`'s
   * "mine and nobody's"). A case reaches a social worker by being given to them; the unassigned
   * pool is the office's, worked by those who give cases out.
   */
  private inScope(record: StoredCase, user: AuthenticatedUser | null): boolean {
    if (user === null) {
      return false;
    }
    if (user.scope === 'assigned-cases') {
      return record.assignedTo === user.id;
    }
    return isWithinBarangayScope(user, record.barangayId);
  }

  private isProtected(record: StoredCase): boolean {
    const subject = this.residents.find(record.subjectResidentId);
    return subject !== undefined && hasSensitiveSector(subject);
  }

  /** The words of a protected subject's case, read without `request.view-sensitive`. */
  private wordsWithheld(record: StoredCase, user: AuthenticatedUser | null): boolean {
    return this.isProtected(record) && !userHasPermission(user, 'request.view-sensitive');
  }

  private withheldFrom(record: StoredCase, user: AuthenticatedUser | null): CaseWithheldField[] {
    const withheld: CaseWithheldField[] = this.wordsWithheld(record, user)
      ? [...PROTECTED_CASE_WITHHELD]
      : [];
    if (user?.scope === 'assigned-cases') {
      withheld.push('householdContext');
    }
    return withheld;
  }

  /** The record as this reader may see it: the summary withheld, the household not named. */
  private discloseRecord(record: StoredCase, user: AuthenticatedUser | null): SocialCase {
    const withheld = this.withheldFrom(record, user);
    return {
      ...record,
      householdId: withheld.includes('householdContext')
        ? null
        : (this.residents.householdOfResident(record.subjectResidentId)?.id ?? null),
      summary: withheld.includes('summary') ? null : record.summary,
      isProtected: this.isProtected(record),
      withheld,
    };
  }

  private discloseTask(task: CaseTask, masked: boolean): CaseTask {
    return masked ? { ...task, title: null, outcome: null } : task;
  }

  /** Every mutation answers with the whole workspace, read after the change. */
  private respondWith(
    record: StoredCase,
    user: AuthenticatedUser | null,
  ): Observable<CaseWorkspace> {
    const workspace = this.workspace(record, user);
    return workspace === null
      ? throwError(() => new Error('That case record is incomplete and could not be loaded.'))
      : this.latency.respond(workspace);
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
  private summarise(record: StoredCase, user: AuthenticatedUser | null): CaseSummary | null {
    const subject = this.residents.find(record.subjectResidentId);
    if (subject === undefined) {
      return null;
    }

    const disclosed = this.discloseRecord(record, user);
    const masked = disclosed.withheld.includes('taskWords');
    const tasks = this.cases.tasksFor(record.id);
    const action = nextAction(tasks);
    const lastActivity = lastActivityAt(this.timeline(record, disclosed, user));
    const requests = this.requestsFor(record, user);

    return {
      record: disclosed,
      subject: this.disclose(subject, user),
      assignedToName: staffName(record.assignedTo),
      openTaskCount: openTaskCount(tasks),
      nextAction: action === null ? null : this.discloseTask(action, masked),
      facts: caseQueueFacts(record, action?.dueOn ?? null, lastActivity),
      lastActivityAt: lastActivity,
      openRequestCount: requests.filter((request) => !isTerminalAssistanceStatus(request.status))
        .length,
    };
  }

  private workspace(record: StoredCase, user: AuthenticatedUser | null): CaseWorkspace | null {
    const summary = this.summarise(record, user);
    if (summary === null) {
      return null;
    }
    const disclosed = summary.record;
    const masked = disclosed.withheld.includes('taskWords');
    // A caseload is admitted to the case, not to the registry around it (`DL-179`).
    const household =
      disclosed.householdId === null
        ? undefined
        : this.residents.findHousehold(disclosed.householdId);
    const members = (household?.members ?? [])
      .map((member) => this.residents.find(member.residentId))
      .filter((resident): resident is Resident => resident !== undefined);
    const snapshot = household === undefined ? null : this.snapshot(household, members, user);

    return {
      record: disclosed,
      subject: summary.subject,
      household:
        household === undefined || snapshot === null
          ? null
          : this.householdSummary(household, members, snapshot, user),
      vulnerability: snapshot,
      families: disclosed.withheld.includes('householdContext')
        ? []
        : this.familiesOf(record.subjectResidentId, household, user),
      householdMembers: members.map((member) => this.disclose(member, user)),
      householdContextUnread: false,
      requests: this.requestsFor(record, user),
      notes: this.notesFor(record, user),
      tasks: [...this.cases.tasksFor(record.id)]
        .sort((a, b) => (a.dueOn < b.dueOn ? -1 : 1))
        .map((task) => this.discloseTask(task, masked)),
      timeline: this.timeline(record, disclosed, user),
      nextAction: summary.nextAction,
      assignedToName: summary.assignedToName,
    };
  }

  private householdSummary(
    household: Household,
    members: readonly Resident[],
    snapshot: VulnerabilitySnapshot,
    user: AuthenticatedUser | null,
  ): HouseholdSummary {
    const disclosed = discloseHousehold(
      household,
      members.some(hasSensitiveSector),
      this.clearanceOf(user),
    );
    return {
      household: disclosed.household,
      withheld: disclosed.withheld,
      isProtected: disclosed.isProtected,
      headName: this.nameOf(this.residents.find(disclosed.household.headResidentId), user),
      memberCount: disclosed.household.members.length,
      // Counted from what the viewer can see, so the number and the list agree.
      band: snapshot.band,
      presentFactorCount: presentFactors(snapshot).length,
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
      this.clearanceOf(user),
    );
  }

  private clearanceOf(user: AuthenticatedUser | null): HouseholdClearance {
    return householdClearance((permission) => userHasPermission(user, permission));
  }

  /** The families the subject is in today — the server reads them the same way. */
  private familiesOf(
    residentId: ResidentId,
    household: Household | undefined,
    user: AuthenticatedUser | null,
  ): readonly FamilySummary[] {
    return this.families.familiesOfResident(residentId).map((family) => {
      const memberIds = this.families.memberIds(family);
      const head = memberIds[0] === undefined ? undefined : this.residents.find(memberIds[0]);
      const home =
        family.householdId === null ? undefined : this.residents.findHousehold(family.householdId);
      return {
        family,
        headName: head === undefined ? 'No head recorded' : this.disclose(head, user).listedName,
        memberCount: currentMembers(family).length,
        householdReference: (home ?? household)?.referenceNumber ?? null,
        barangayId: (home ?? household)?.address.barangayId ?? null,
        relationshipCount: this.families
          .relationshipsFor(memberIds)
          .filter((relationship) => relationship.until === null).length,
      };
    });
  }

  private notesFor(record: StoredCase, user: AuthenticatedUser | null): readonly CaseNoteView[] {
    const masked = this.wordsWithheld(record, user);
    return [...this.cases.notesFor(record.id)]
      .sort((a, b) => byNewestEventFirst({ occurredAt: a.createdAt }, { occurredAt: b.createdAt }))
      .map((note) =>
        discloseCaseNote(
          note,
          (permission: Permission) => userHasPermission(user, permission),
          masked,
        ),
      );
  }

  /**
   * The linked requests this reader may read, each disclosed by its own rules — a case is never a
   * way round a request's scope (`DL-179`). Newest filing first, as the server answers them.
   */
  private requestsFor(
    record: StoredCase,
    user: AuthenticatedUser | null,
  ): readonly AssistanceRequest[] {
    return this.requestStore.requests
      .filter((request) => record.linkedRequestIds.includes(request.id) && inReach(user, request))
      .sort((a, b) => (b.submittedAt ?? '').localeCompare(a.submittedAt ?? ''))
      .map((request) => discloseRequest(request, user, this.residents.find(request.residentId)));
  }

  /** The domain's one assembly (`DL-56`), from the events newest first as the server sends them. */
  private timeline(
    record: StoredCase,
    disclosed: SocialCase,
    user: AuthenticatedUser | null,
  ): readonly CaseTimelineEntry[] {
    const masked = disclosed.withheld.includes('reasons');
    return caseTimeline({
      // Reversed: the store appends in order, and the server answers newest first.
      events: [...this.cases.eventsFor(record.id)]
        .reverse()
        .map((event) => (masked ? { ...event, reason: null } : event)),
      notes: this.notesFor(record, user),
      tasks: this.cases
        .tasksFor(record.id)
        .map((task) => this.discloseTask(task, disclosed.withheld.includes('taskWords'))),
      requests: this.requestsFor(record, user),
      withheld: disclosed.withheld,
    });
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
    // A caseload always reads its own, whatever it asks for (`DL-179`).
    if (
      user?.scope !== 'assigned-cases' &&
      filter.assignedTo &&
      summary.record.assignedTo !== filter.assignedTo
    ) {
      return false;
    }
    if (filter.residentId && summary.record.subjectResidentId !== filter.residentId) {
      return false;
    }
    if (filter.queue && !isInQueue(filter.queue, summary.facts, user?.id ?? null)) {
      return false;
    }
    // Part of a case reference and nothing else: the summary is free text, and matching on it
    // would say what is in somebody's file (`DL-109`).
    const search = filter.search?.trim().toLowerCase() ?? '';
    return search === '' || summary.record.referenceNumber.toLowerCase().includes(search);
  }
}

/* ── helpers ───────────────────────────────────────────────────────────────── */

function openTasksAtClosure(count: number): string {
  return (
    `This case still has ${String(count)} open task${count === 1 ? '' : 's'}. ` +
    'Record what happened to each before closing it: a closed case is kept as it ended, and a task left open on it would be owed by nobody.'
  );
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

/** The open accounts in the social-worker role, by name — nothing more, as the server lists them. */
function socialWorkers(): readonly SocialWorker[] {
  return MOCK_STAFF.filter((staff) => staff.role === 'social-worker' && staff.isActive).map(
    (staff) => ({ id: staff.id, name: `${staff.name.first} ${staff.name.last}` }),
  );
}
