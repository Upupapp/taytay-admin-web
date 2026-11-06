import { inject, Injectable } from '@angular/core';
import { concat, filter, of, Observable, throwError } from 'rxjs';

import {
  ACCESS_CONTEXT,
  ASSIGNMENT_NEEDS_REASON,
  PROTECTED_FILE_REFUSAL,
  PROTECTED_WRITE_REFUSAL,
  refusalFor,
  REQUEST_NOTE_MAX_LENGTH,
  ASSISTANCE_STATUS_CATALOG,
  ASSISTANCE_STATUS_TRANSITIONS,
  asId,
  asIsoDateTime,
  byRequestUrgency,
  documentRequestProblems,
  documentVersionProblems,
  DocumentVersionInvalidError,
  assessIntake,
  assessmentProblems,
  acceptsAnswer,
  unansweredRequired,
  type AssessmentAnswers,
  type AssessmentTemplate,
  type OpenAssessment,
  canTransition,
  cautions,
  isOutstandingObligation,
  REASON_MIN_LENGTH,
  DOCUMENT_UPLOAD_POLICY,
  STATUS_MOVE_NEEDS_REASON,
  userHasPermission,
  WITHHELD_DRAFT_REFUSAL,
  type CursorPage,
  type CursorRequest,
  isCaseOpen,
  isTerminalAssistanceStatus,
  isValidAcknowledgement,
  isValidFindings,
  isWithinBarangayScope,
  lastFourOf,
  APPROVAL_IS_ITS_OWN_ACT,
  APPROVAL_NEEDS_WHAT,
  approvalProblem,
  holdsRequestOpen,
  openReleaseRefusal,
  type RequestApproval,
  PermissionDeniedError,
  permissionForTransition,
  todayAsIsoDate,
  type AdvisoryAcknowledgement,
  type AuthenticatedUser,
  type AssessmentDraft,
  type AssistanceRequest,
  type AssistanceRequestFilter,
  type AssistanceRequestId,
  type AssistanceRequestRepository,
  type AssistanceRequestStatus,
  type ConditionalApplicability,
  type DocumentAccessGrant,
  type DocumentRequest,
  type DocumentRequestDraft,
  type DocumentRequestId,
  type DocumentVersion,
  type DocumentVersionDraft,
  type DocumentVersionId,
  type IntakeAdvisory,
  type IntakeDraft,
  type IntakeRequirementEntry,
  type Money,
  type PriorRelease,
  type Permission,
  type PriorRequest,
  type ProgramId,
  type RequirementDocument,
  type RequirementDocumentId,
  type RequestAssignment,
  type RequestNote,
  type RequestNoteId,
  type RequestNoteDraft,
  type RequirementId,
  type SocialWorker,
  type RequirementStatus,
  type ResidentId,
  type StaffUserId,
  type StatusChange,
  type SubmittedRequirement,
  type DocumentUpload,
} from '@domain/index';

import { ASSESSMENT_TEMPLATE_SEED } from './seed/assessment-templates.seed';

import { MOCK_ASSISTANCE_REQUESTS, MOCK_REQUEST_NOTES } from './seed/assistance-requests.seed';
import { MOCK_DOCUMENT_REQUESTS } from './seed/document-requests.seed';
import { MOCK_DISBURSEMENTS } from './seed/releases.seed';
import { MOCK_PROGRAMS } from './seed/programs.seed';
import { MOCK_STAFF } from './seed/staff.seed';
import { denyUnless } from './mock-access';
import { MockAssistanceRequestStore, discloseRequest, inReach } from './mock-assistance-request.store';
import { MockCaseStore } from './mock-case.store';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';
import { sortItems } from './mock-query';

/**
 * In-memory assistance-request store.
 *
 * Writes mutate a private copy of the seed so a development session behaves
 * like a real backend within its lifetime, and reset on reload. The transition
 * rules enforced here are the same ones the HTTP adapter will rely on the API
 * to enforce — the domain owns them, not the adapter.
 */
@Injectable()
export class MockAssistanceRequestRepository implements AssistanceRequestRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private readonly residents = inject(MockResidentStore);
  private readonly cases = inject(MockCaseStore);
  private readonly store = inject(MockAssistanceRequestStore);
  /** The session's requests, held in a store the case adapter reads too (`DL-179`). */
  private get requests(): AssistanceRequest[] {
    return this.store.requests;
  }
  private set requests(value: AssistanceRequest[]) {
    this.store.requests = value;
  }
  private documentRequests: readonly DocumentRequest[] = [...MOCK_DOCUMENT_REQUESTS];
  private documentSequence = highestDocumentVersionSerial(MOCK_ASSISTANCE_REQUESTS);
  private documentIdSequence = highestDocumentSerial(MOCK_ASSISTANCE_REQUESTS);
  private documentRequestSequence = MOCK_DOCUMENT_REQUESTS.length;
  /** Ids for drafts created in this session. */
  private sequence = 0;
  /** Control numbers issued at filing. */
  private serial = 0;

  /**
   * One cursor page in the server's order (`DL-177`): filed requests newest filing first, or —
   * only when `status` is `'draft'` — unfinished intakes newest first. A draft is not a request,
   * and is never listed or counted among them (`DL-63`).
   */
  list(filter: AssistanceRequestFilter, page: CursorRequest): Observable<CursorPage<AssistanceRequest>> {
    const user = this.access.currentUser();
    const denied = denyUnless<CursorPage<AssistanceRequest>>(user, 'request.view');
    if (denied) {
      return denied;
    }

    // A filter can only narrow what scope allows. Asking for another barangay is refused, as the
    // API refuses it, rather than answered with an empty page that reads as "none there".
    if (filter.barangayId !== undefined && !isWithinBarangayScope(user, filter.barangayId)) {
      return throwError(() => new PermissionDeniedError('request.view'));
    }

    const drafts = filter.status === 'draft';
    const search = filter.search?.trim().toLowerCase() ?? '';
    // A caseload always reads its own assignments, whatever `assignedTo` it sends (`DL-178`).
    const assignedTo = user?.scope === 'assigned-cases' ? user.id : filter.assignedTo;
    const filtered = this.requests.filter((request) => {
      if (!inReach(user, request)) {
        return false;
      }
      if (drafts ? request.status !== 'draft' : request.referenceNumber === '') {
        return false;
      }
      if (filter.status && request.status !== filter.status) {
        return false;
      }
      if (filter.programId && request.programId !== filter.programId) {
        return false;
      }
      if (filter.residentId && request.residentId !== filter.residentId) {
        return false;
      }
      if (filter.barangayId && request.barangayId !== filter.barangayId) {
        return false;
      }
      if (assignedTo !== undefined && request.assignedTo !== assignedTo) {
        return false;
      }
      if (filter.openOnly && isTerminalAssistanceStatus(request.status)) {
        return false;
      }
      // Part of a control number and nothing else: a match on the reason would say what is in
      // somebody's file (`DL-109`). It used to match the reason and the decision remarks.
      return search === '' || request.referenceNumber.toLowerCase().includes(search);
    });

    const key = (request: AssistanceRequest): string =>
      (drafts ? request.audit.createdAt : request.submittedAt) ?? '';
    const sorted = [...filtered].sort(
      (a, b) => key(b).localeCompare(key(a)) || b.id.localeCompare(a.id),
    );
    // The id of the last row read stands in for the server's opaque cursor.
    const after = page.cursor ? sorted.findIndex((request) => request.id === page.cursor) : -1;
    const rest = sorted.slice(after + 1);
    const items = rest.slice(0, Math.max(1, page.limit));
    const hasMore = rest.length > items.length;
    const last = items[items.length - 1];
    return this.latency.respond({
      items: items.map((request) => this.disclose(request)),
      hasMore,
      nextCursor: hasMore && last !== undefined ? last.id : null,
    });
  }

  getById(id: AssistanceRequestId): Observable<AssistanceRequest | null> {
    const user = this.access.currentUser();
    const request = this.reachable(id);
    if (request === undefined || !userHasPermission(user, 'request.view')) {
      return this.latency.respond(null);
    }
    return this.latency.respond(this.disclose(request));
  }

  /** Whole, newest first, a withheld body `null` and the entry still listed (`DL-58`). */
  listNotes(id: AssistanceRequestId): Observable<readonly RequestNote[]> {
    const user = this.access.currentUser();
    const request = this.reachable(id);
    if (request === undefined || !userHasPermission(user, 'request.view')) {
      return throwError(() => new Error(REQUEST_NOT_FOUND));
    }
    return this.latency.respond(this.notesFor(request));
  }

  /**
   * Appends a note, and answers with the whole list as this reader may see it — as the server
   * does. Nobody writes what they may not read: a protected note needs the protected tier, and a
   * protected request's notes need `request.view-sensitive` (`DL-58`, `DL-178`).
   */
  addNote(id: AssistanceRequestId, note: RequestNoteDraft): Observable<readonly RequestNote[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly RequestNote[]>(user, 'case.note');
    if (denied) {
      return denied;
    }
    const request = this.reachable(id);
    if (request === undefined) {
      return throwError(() => new Error(REQUEST_NOT_FOUND));
    }
    if (this.disclose(request).withheld.includes('notes')) {
      return throwError(
        () =>
          new Error('Notes on this request are withheld from your account, so it cannot add one.'),
      );
    }
    if (note.sensitivity === 'protected' && !userHasPermission(user, 'case-note.view-protected')) {
      return throwError(() => new PermissionDeniedError('case-note.view-protected'));
    }
    const body = note.body.trim();
    if (body === '' || body.length > REQUEST_NOTE_MAX_LENGTH) {
      return throwError(
        () => new Error(`Write the note — between 1 and ${REQUEST_NOTE_MAX_LENGTH} characters.`),
      );
    }

    this.noteSequence += 1;
    const appended: RequestNote = {
      id: asId<RequestNoteId>(`note-s${String(this.noteSequence).padStart(4, '0')}`),
      requestId: id,
      authorId: user?.id ?? null,
      authorName: user?.displayName ?? UNKNOWN_ACTOR,
      body,
      isWithheld: false,
      sensitivity: note.sensitivity,
      createdAt: asIsoDateTime(new Date()),
    };
    this.notes = [...this.notes, appended];
    return this.latency.respond(this.notesFor(request));
  }

  /**
   * Withheld in the data layer, and the entry is still listed (`DL-58`, `DL-38`).
   *
   * Two tiers, as the API holds them: a protected note's body is withheld from a reader without
   * `case-note.view-protected`, and **every** note's body on a protected request from a reader
   * without `request.view-sensitive` (`DL-177`) — a routine note about a VAWC survivor's visit says
   * what happened to her as plainly as the reason does.
   */
  private notesFor(request: AssistanceRequest): readonly RequestNote[] {
    const mayReadProtected = userHasPermission(this.access.currentUser(), 'case-note.view-protected');
    const wordsWithheld = this.disclose(request).withheld.includes('notes');
    const notes = this.notes
      .filter((note) => note.requestId === request.id)
      .map((note): RequestNote => {
        const cleared = (note.sensitivity === 'routine' || mayReadProtected) && !wordsWithheld;
        return cleared ? note : { ...note, body: null, isWithheld: true };
      });
    return sortItems(notes, (note) => note.createdAt, 'desc');
  }

  private notes: readonly RequestNote[] = [...MOCK_REQUEST_NOTES];
  private noteSequence = 0;

  changeStatus(
    id: AssistanceRequestId,
    to: AssistanceRequestStatus,
    reason: string | null,
  ): Observable<AssistanceRequest> {
    // The action is refused here as well as hidden in the UI. Approving is
    // gated on `request.approve` and releasing on `release.release`, which
    // is what keeps DL-08 true even if a button is somehow reachable.
    const user = this.access.currentUser();
    const denied = denyUnless<AssistanceRequest>(user, permissionForTransition(to));
    if (denied) {
      return denied;
    }

    // Every move carries its words, as the API requires: a history that says a request was
    // returned and not why is one the next worker cannot act on (`DL-177`).
    const words = reason?.trim() ?? '';
    if (words === '') {
      return throwError(() => new Error(STATUS_MOVE_NEEDS_REASON));
    }
    if (to === 'submitted') {
      return throwError(
        () => new Error('Filing is its own act, and issues the control number. File the draft instead.'),
      );
    }
    // Approving says what was approved (`DL-183`): its own act, `approve`.
    if (to === 'approved') {
      return throwError(() => new Error(APPROVAL_IS_ITS_OWN_ACT));
    }
    return this.move(id, to, words, null);
  }

  /** The move to `approved`, with what was approved (`DL-183`), as the API records it. */
  approve(
    id: AssistanceRequestId,
    approval: RequestApproval,
    reason: string,
  ): Observable<AssistanceRequest> {
    const user = this.access.currentUser();
    const denied = denyUnless<AssistanceRequest>(user, permissionForTransition('approved'));
    if (denied) {
      return denied;
    }
    const words = reason.trim();
    if (words === '') {
      return throwError(() => new Error(STATUS_MOVE_NEEDS_REASON));
    }
    if (approvalProblem(approval) !== null) {
      return throwError(() => new Error(APPROVAL_NEEDS_WHAT));
    }
    return this.move(id, 'approved', words, approval);
  }

  private move(
    id: AssistanceRequestId,
    to: AssistanceRequestStatus,
    words: string,
    approval: RequestApproval | null,
  ): Observable<AssistanceRequest> {
    const user = this.access.currentUser();
    const current = this.reachable(id);
    if (current === undefined) {
      return throwError(() => new Error(REQUEST_NOT_FOUND));
    }
    // A move to where the request already is answers as it stands, as the API answers it.
    if (current.status === to) {
      return this.latency.respond(this.disclose(current));
    }

    if (!canTransition(ASSISTANCE_STATUS_TRANSITIONS, current.status, to)) {
      const from = ASSISTANCE_STATUS_CATALOG[current.status].label;
      return throwError(
        () =>
          new Error(
            `A request cannot move from ${from} to ${ASSISTANCE_STATUS_CATALOG[to].label}.`,
          ),
      );
    }

    // A payout still open is voided by its own act before the request is ended (`DL-183`), as the
    // server refuses it under the request's lock.
    if (to === 'cancelled' || to === 'expired') {
      const open = this.store.releases.find(
        (release) => release.requestId === id && holdsRequestOpen(release.status),
      );
      if (open !== undefined) {
        return throwError(() => new Error(openReleaseRefusal(open.referenceNumber, to)));
      }
    }

    const change: StatusChange = {
      from: current.status,
      to,
      reason: words,
      actorId: user?.id ?? null,
      actorName: user?.displayName ?? 'Unknown',
      occurredAt: asIsoDateTime(new Date()),
    };

    const updated: AssistanceRequest = {
      ...current,
      status: to,
      ...(approval === null
        ? {}
        : {
            approvedAmount: approval.kind === 'money' ? approval.amount : null,
            approvedInKindDescription: approval.kind === 'in-kind' ? approval.description.trim() : null,
          }),
      statusHistory: [...current.statusHistory, change],
      audit: { ...current.audit, updatedAt: change.occurredAt, updatedBy: user?.id ?? null },
    };

    this.requests = this.requests.map((request) => (request.id === id ? updated : request));
    return this.latency.respond(this.disclose(updated));
  }

  /* ── Intake ─────────────────────────────────────────────────────────────── */

  /**
   * The same check for a request already filed, which names its own person and programme. The
   * request itself is not counted: a filed request is open, and would flag itself (`DL-177`).
   */
  advisoryForCase(id: AssistanceRequestId): Observable<IntakeAdvisory> {
    const user = this.access.currentUser();
    const denied = denyUnless<IntakeAdvisory>(user, 'request.create');
    if (denied) {
      return denied;
    }
    // A caseload reads it for a request assigned to it — its own client's previous assistance —
    // and any other request is not found (`DL-183`), as the API answers.
    const request = this.reachable(id);
    if (request === undefined) {
      return throwError(() => new Error(REQUEST_NOT_FOUND));
    }
    return this.advisoryOver(request.residentId, request.programId, request.id);
  }

  /**
   * Duplicate and previous-assistance context.
   *
   * Gated on `request.create` rather than `request.view`: this reads one named
   * person's whole assistance history plus their household's, which is a
   * sharper disclosure than browsing the request list, and only the roles that
   * actually file a request need it (minimisation, `DL-60`).
   */
  advisoryFor(residentId: ResidentId, programId: ProgramId | null): Observable<IntakeAdvisory> {
    const user = this.access.currentUser();
    const denied = denyUnless<IntakeAdvisory>(user, 'request.create') ?? beyondCaseload(user);
    if (denied) {
      return denied;
    }
    return this.advisoryOver(residentId, programId, null);
  }

  /**
   * Creates a draft, or updates the one at `id`.
   *
   * Idempotent on the identifier the caller holds: two taps on a slow
   * connection update the same row rather than leaving a duplicate in the
   * registry (`DL-63`). A draft is never disclosed to anyone but the office —
   * it carries no reference number an applicant could quote, because nothing
   * has been filed yet.
   */
  saveDraft(draft: IntakeDraft, id: AssistanceRequestId | null): Observable<AssistanceRequest> {
    const user = this.access.currentUser();
    const denied = denyUnless<AssistanceRequest>(user, 'request.create') ?? beyondCaseload(user);
    if (denied) {
      return denied;
    }
    if (draft.residentId === null) {
      return throwError(() => new Error('A draft needs to name the person it is for.'));
    }

    const resident = this.residents.find(draft.residentId);
    if (!resident || !isWithinBarangayScope(user, resident.address.barangayId)) {
      return throwError(() => new PermissionDeniedError('request.create'));
    }

    const now = asIsoDateTime(new Date());
    const existing = id === null ? undefined : this.requests.find((request) => request.id === id);

    if (existing !== undefined) {
      if (existing.status !== 'draft') {
        return throwError(
          () => new Error('That request has already been filed, and is kept as it was filed.'),
        );
      }
      // Nobody writes over what they may not read: a draft saved from a redacted copy would erase
      // the reason that was withheld from its writer (`DL-177`).
      if (this.disclose(existing).withheld.length > 0) {
        return throwError(() => new Error(WITHHELD_DRAFT_REFUSAL));
      }
      const updated: AssistanceRequest = {
        ...existing,
        ...this.fieldsFrom(draft, resident.address.barangayId),
        requirements: mergeRequirements(existing.requirements, draft.requirements),
        audit: { ...existing.audit, updatedAt: now, updatedBy: user?.id ?? null },
      };
      this.requests = this.requests.map((request) =>
        request.id === existing.id ? updated : request,
      );
      return this.latency.respond(this.disclose(updated));
    }

    this.sequence += 1;
    const created: AssistanceRequest = {
      id: asId<AssistanceRequestId>(`req-d${String(this.sequence).padStart(4, '0')}`),
      // A draft has no control number: nothing has been filed, and handing an
      // applicant a reference for a record that may never exist is how an
      // office ends up honouring one.
      referenceNumber: '',
      ...this.fieldsFrom(draft, resident.address.barangayId),
      approvedAmount: null,
      approvedInKindDescription: null,
      assignedTo: null,
      assignments: [],
      requirements: requirementsFrom(draft.requirements),
      assessment: null,
      statusHistory: [],
      decisionRemarks: null,
      submittedAt: null,
      isProtected: false,
      withheld: [],
      audit: {
        createdAt: now,
        createdBy: user?.id ?? null,
        updatedAt: now,
        updatedBy: user?.id ?? null,
      },
    };
    this.requests = [...this.requests, created];
    return this.latency.respond(this.disclose(created));
  }

  /**
   * Files the draft, refusing an intake record that does not yet say what happened at the
   * counter — with the API's words, keyed as the API keys them (`DL-177`).
   *
   * The acknowledgement is demanded exactly when the advisory raised a caution, and an
   * acknowledgement against a check that has changed since it was read — a new caution, or none
   * where one was answered — is refused rather than kept: a stored "reason for proceeding" against
   * a request nothing was flagged on would make the record say something untrue. Nothing here
   * refuses the submission on the strength of a signal (`DL-60`).
   */
  submitIntake(
    id: AssistanceRequestId,
    acknowledgement: AdvisoryAcknowledgement | null,
  ): Observable<AssistanceRequest> {
    const user = this.access.currentUser();
    const denied = denyUnless<AssistanceRequest>(user, 'request.create') ?? beyondCaseload(user);
    if (denied) {
      return denied;
    }

    const current = this.requests.find((request) => request.id === id);
    if (current === undefined || !isWithinBarangayScope(user, current.barangayId)) {
      return throwError(() => new PermissionDeniedError('request.create'));
    }
    // Already filed is already done: a retried submit returns the request as it
    // stands rather than a refusal an encoder cannot act on (`DL-51` carried
    // forward).
    if (current.status !== 'draft') {
      return this.latency.respond(this.disclose(current));
    }
    const incomplete = filingProblems(current);
    if (incomplete.length > 0) {
      return throwError(() => new Error(incomplete.join(' ')));
    }

    const advisoryProblem = this.acknowledgementProblem(current, acknowledgement);
    if (advisoryProblem) {
      return advisoryProblem;
    }

    const now = asIsoDateTime(new Date());
    const change: StatusChange = {
      from: 'draft',
      to: 'submitted',
      reason: acknowledgement?.reason ?? null,
      actorId: user?.id ?? null,
      actorName: user?.displayName ?? 'Unknown',
      occurredAt: now,
    };

    this.serial += 1;
    const filed: AssistanceRequest = {
      ...current,
      status: 'submitted',
      // The control number is issued at filing, which is the moment the office
      // takes responsibility for the request.
      referenceNumber:
        current.referenceNumber === ''
          ? `TAY-${now.slice(0, 4)}-${String(900_000 + this.serial)}`
          : current.referenceNumber,
      submittedAt: now,
      statusHistory: [...current.statusHistory, change],
      audit: { ...current.audit, updatedAt: now, updatedBy: user?.id ?? null },
    };
    this.requests = this.requests.map((request) => (request.id === id ? filed : request));
    return this.latency.respond(this.disclose(filed));
  }

  /*
   * ── The assessment form ─────────────────────────────────────────────────────────────────
   *
   * The seed mirrors the server's templates, `placeholder-pending-lgu-approval` and all. Marking
   * them adopted here would be the more convenient mock — and a mock that is more convenient than
   * the thing it stands in for is one a screen gets built against, which is how the checklist came
   * to think an absent line meant an unticked one.
   */
  listAssessmentTemplates(): Observable<readonly AssessmentTemplate[]> {
    const denied = denyUnless<readonly AssessmentTemplate[]>(
      this.access.currentUser(),
      'request.assess',
    );

    return denied ?? of(ASSESSMENT_TEMPLATE_SEED);
  }

  /**
   * Opens an assessment, or returns the one already open — whichever form it was opened from, as
   * the server answers (`DL-178`).
   *
   * **Idempotent per request, like the server**, and for the server's stated reason: two open
   * assessments on one request are two competing sets of findings, and nothing says which the
   * approver should read. Only while the request is in `assessment`, as there.
   */
  openAssessment(id: AssistanceRequestId, templateCode: string): Observable<OpenAssessment> {
    const found = this.writable<OpenAssessment>(id, 'request.assess');
    if ('error' in found) {
      return found.error;
    }
    const outside = outsideAssessment<OpenAssessment>(found.request);
    if (outside) {
      return outside;
    }

    const existing = this.assessments.get(id);
    if (existing !== undefined && !existing.completed) {
      return of(existing);
    }

    const template = ASSESSMENT_TEMPLATE_SEED.find(
      (candidate) => candidate.code === templateCode,
    );
    if (template === undefined) {
      return throwError(() => new Error('No form the office publishes has that code.'));
    }

    const opened: OpenAssessment = {
      templateCode: template.code,
      // Pinned now, read once. A later change to the form must not appear to have altered what
      // this assessment asked.
      templateVersion: template.version,
      completed: false,
      answers: {},
    };
    this.assessments.set(id, opened);

    return of(opened);
  }

  /**
   * Records answers. A patch, never the whole set — saving one answer must not erase the others.
   */
  answerAssessment(
    id: AssistanceRequestId,
    answers: AssessmentAnswers,
  ): Observable<OpenAssessment> {
    const found = this.writable<OpenAssessment>(id, 'request.assess');
    if ('error' in found) {
      return found.error;
    }
    const outside = outsideAssessment<OpenAssessment>(found.request);
    if (outside) {
      return outside;
    }

    const existing = this.assessments.get(id);
    if (existing === undefined || existing.completed) {
      return throwError(() => new Error('No assessment is open on this request. Open one first.'));
    }

    const template = ASSESSMENT_TEMPLATE_SEED.find(
      (candidate) => candidate.code === existing.templateCode,
    );

    for (const [code, value] of Object.entries(answers)) {
      const question = template?.questions.find((candidate) => candidate.code === code);
      if (question === undefined || !acceptsAnswer(question, value)) {
        return throwError(
          () => new Error(`\`${code}\` is not a valid answer for this assessment template.`),
        );
      }
    }

    const updated: OpenAssessment = { ...existing, answers: { ...existing.answers, ...answers } };
    this.assessments.set(id, updated);

    return of(updated);
  }

  private readonly assessments = new Map<AssistanceRequestId, OpenAssessment>();

  /**
   * Completes the open assessment. Held apart from any status move, as the server holds it:
   * writing findings and endorsing on them are two acts, and the second one is what `DL-08` keeps
   * away from the person who did the first. **Completing moves the request nowhere.**
   */
  recordAssessment(
    id: AssistanceRequestId,
    assessment: AssessmentDraft,
  ): Observable<AssistanceRequest> {
    const user = this.access.currentUser();
    const found = this.writable<AssistanceRequest>(id, 'request.assess');
    if ('error' in found) {
      return found.error;
    }
    const outside = outsideAssessment<AssistanceRequest>(found.request);
    if (outside) {
      return outside;
    }

    /*
     * The server's preconditions, held here too.
     *
     * A mock that completes what the server would refuse is worse than no mock: every screen and
     * every spec is written against the permissive version, and the failure only appears against
     * a real API — which is exactly how `recordAssessment` came to be pointed at the wrong
     * endpoint for the whole programme without one test noticing.
     */
    const open = this.assessments.get(id);
    if (open === undefined || open.completed) {
      return throwError(() => new Error('No assessment is open on this request. Open one first.'));
    }

    const template = ASSESSMENT_TEMPLATE_SEED.find(
      (candidate) => candidate.code === open.templateCode,
    );
    const missing = template === undefined ? [] : unansweredRequired(template, open.answers);
    if (missing.length > 0) {
      return throwError(
        () =>
          new Error(
            `The form still needs an answer to: ${missing.map((question) => question.label).join(', ')}.`,
          ),
      );
    }
    if (!isValidFindings(assessment.findings)) {
      return throwError(() => new Error('A case study needs findings somebody else could act on.'));
    }

    const problems = assessmentProblems(assessment);
    if (problems.length > 0) {
      return throwError(() => new Error(problems[0]));
    }

    this.assessments.set(id, { ...open, completed: true });

    const now = asIsoDateTime(new Date());
    const reason = assessment.reason?.trim() ?? '';
    const updated: AssistanceRequest = {
      ...found.request,
      assessment: {
        templateCode: open.templateCode,
        templateVersion: open.templateVersion,
        assessedBy: user?.id ?? asId<StaffUserId>('staff-unknown'),
        assessedByName: user?.displayName ?? UNKNOWN_ACTOR,
        assessedAt: now,
        findings: assessment.findings.trim(),
        recommendedAmount: assessment.recommendedAmount,
        homeVisitConducted: assessment.homeVisitConducted,
        recommendation: assessment.recommendation,
        recommendationReason: reason === '' ? null : reason,
      },
      audit: { ...found.request.audit, updatedAt: now, updatedBy: user?.id ?? null },
    };
    this.requests = this.requests.map((request) => (request.id === id ? updated : request));
    return this.latency.respond(this.disclose(updated));
  }

  /**
   * A person's review of one document, by the server's rules (`DL-178`): the five verdicts a
   * person gives, words required where the applicant must be told why, and only a document that
   * was presented can be anything but excused.
   */
  reviewRequirement(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    status: RequirementStatus,
    remarks: string | null,
  ): Observable<AssistanceRequest> {
    const user = this.access.currentUser();
    const found = this.locateWritable<AssistanceRequest>(id, requirementId, 'request.intake');
    if ('error' in found) {
      return found.error;
    }
    const verdict = REVIEW_VERDICTS.find((candidate) => candidate === status);
    if (verdict === undefined) {
      return throwError(
        () =>
          new Error('A review records a verdict: verified, rejected, waived, expired or needs replacement.'),
      );
    }
    const words = remarks?.trim() ?? '';
    const needsWords = REVIEW_NEEDS_WORDS[verdict];
    if (words === '' && needsWords !== null) {
      return throwError(() => new Error(needsWords));
    }
    if (verdict !== 'waived' && found.requirement.submittedAt === null) {
      return throwError(
        () =>
          new Error(
            'Only a document that was presented can be checked. Record it first, or excuse it with a reason.',
          ),
      );
    }

    const now = asIsoDateTime(new Date());
    return this.latency.respond(
      this.disclose(
        this.saveRequirement(found.request, requirementId, (requirement) => ({
          ...requirement,
          status: verdict,
          reviewedBy: user?.id ?? null,
          reviewedAt: now,
          remarks: words === '' ? requirement.remarks : words,
        })),
      ),
    );
  }

  /* ── documents (TAB 14) ─────────────────────────────────────────────────── */

  recordDocument(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    draft: DocumentVersionDraft,
  ): Observable<DocumentUpload<AssistanceRequest>> {
    const user = this.access.currentUser();
    const found = this.locateWritable<DocumentUpload<AssistanceRequest>>(
      id,
      requirementId,
      'document.record',
    );
    if ('error' in found) {
      return found.error;
    }
    const { request, requirement } = found;

    const existing = requirement.document;
    const isReplacement = existing !== null && existing.versions.length > 0;
    const problems = documentVersionProblems(draft, isReplacement);
    if (problems.length > 0) {
      return throwError(() => new DocumentVersionInvalidError(problems));
    }
    // The server reads the bytes; the mock reads what it can — the size and the declared type,
    // against the policy the requirement publishes.
    const refused = draft.file === null ? null : refusalFor(draft.file, requirement.accepts);
    if (refused !== null) {
      return throwError(
        () =>
          new Error(
            refused.reason === 'too-large'
              ? 'That file is larger than 10 MB. Scan it again at a lower resolution, or in parts.'
              : 'The file must be a PDF, a JPEG or a PNG.',
          ),
      );
    }

    const now = asIsoDateTime(new Date());
    this.documentSequence += 1;
    const versionNumber = (existing?.versions.length ?? 0) + 1;
    const versionId = asId<DocumentVersionId>(`dv-${String(this.documentSequence).padStart(4, '0')}`);
    const version: DocumentVersion = {
      id: versionId,
      // Numbered from the length of the history, never from a count of the
      // live ones: version 3 stays version 3 forever.
      version: versionNumber,
      /*
       * The stored shape is derived from the file, not the file itself, and named as the server
       * names it — `<code>-v<n>.<ext>` — never by the uploader's own file name, which can say more
       * than the office needs to hold. `pageCount` stays null: nothing counts the pages of a PDF,
       * and a guess would appear on screen as though somebody had checked.
       */
      file:
        draft.file === null
          ? null
          : {
              fileName: `${requirement.code}-v${versionNumber}${extensionFor(draft.file.type)}`,
              mimeType: draft.file.type,
              byteSize: draft.file.size,
              pageCount: null,
            },
      source: draft.source,
      // Only the last four are kept, as the API keeps them (DL-183).
      documentNumber: lastFourOf(draft.documentNumber),
      documentNumberMasked: false,
      issuedOn: draft.issuedOn,
      expiresOn: draft.expiresOn,
      receivedBy: user?.id ?? asId<StaffUserId>('staff-unknown'),
      receivedByName: user?.displayName ?? UNKNOWN_ACTOR,
      receivedAt: now,
      supersededAt: null,
      supersededBy: null,
      supersededReason: null,
    };
    if (draft.file !== null) {
      // Held for the session so a grant for it can be exchanged for these bytes, as on the server.
      this.heldFiles.set(versionId, draft.file);
    }

    // The previous version is *marked* superseded, never removed. This is the
    // whole point of the model: what the office saw when it decided survives.
    const priorVersions = (existing?.versions ?? []).map((entry) =>
      entry.supersededAt === null
        ? {
            ...entry,
            supersededAt: now,
            supersededBy: user?.id ?? null,
            supersededReason: draft.replacesBecause?.trim() ?? null,
          }
        : entry,
    );

    this.documentIdSequence += existing === null ? 1 : 0;
    const document: RequirementDocument = {
      id:
        existing?.id ??
        asId<RequirementDocumentId>(`doc-${String(this.documentIdSequence).padStart(4, '0')}`),
      requirementId,
      versions: [...priorVersions, version],
    };

    const saved = this.saveRequirement(request, requirementId, (entry) => ({
      ...entry,
      document,
      // Presenting reads `submitted` again, whatever the last version's review was — a verified
      // certificate replaced by a new copy has a copy nobody has checked yet (`DL-178`). Checking
      // it is a separate act by a person.
      status: 'submitted',
      submittedAt: now,
    }));

    // What the applicant was asked to bring is answered by bringing it.
    this.documentRequests = this.documentRequests.map((entry) =>
      entry.assistanceRequestId === id &&
      entry.requirementId === requirementId &&
      entry.state === 'open'
        ? { ...entry, state: 'answered' as const, closedAt: now, closedBy: user?.id ?? null }
        : entry,
    );

    /*
     * A halfway emission before the result, so the progress state is reachable in development.
     *
     * The real transport reports bytes as they leave; a mock that only ever emitted `done` would
     * mean the bar was never seen by anybody building against the mock, and the first time it
     * rendered would be in front of a caseworker. Not an invented behaviour — a stand-in for one
     * the real adapter genuinely produces.
     */
    const bytes = draft.file?.size ?? 0;

    return concat(
      of<DocumentUpload<AssistanceRequest>>({
        kind: 'uploading',
        sentBytes: Math.round(bytes / 2),
        totalBytes: bytes,
      }).pipe(filter(() => bytes > 0)),
      this.latency.respond<DocumentUpload<AssistanceRequest>>({
        kind: 'done',
        result: this.disclose(saved),
      }),
    );
  }

  decideApplicability(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    applicability: ConditionalApplicability,
    reason: string,
  ): Observable<AssistanceRequest> {
    const user = this.access.currentUser();
    const found = this.locateWritable<AssistanceRequest>(id, requirementId, 'document.record');
    if ('error' in found) {
      return found.error;
    }
    if (applicability === 'undecided') {
      return throwError(
        () => new Error('Undecided is not a ruling. Say whether the document applies, and why.'),
      );
    }
    if (reason.trim().length === 0) {
      return throwError(() => new Error('Say why this document does or does not apply.'));
    }
    if (found.requirement.obligation !== 'conditional') {
      // Ruling on a required document would let staff quietly excuse one
      // without recording a waiver, which is the audited path for that.
      return throwError(
        () =>
          new Error(
            'Only a conditional document is ruled on. A required one is excused with a waiver and its reason.',
          ),
      );
    }

    return this.latency.respond(
      this.disclose(
        this.saveRequirement(found.request, requirementId, (entry) => ({
          ...entry,
          applicability,
          applicabilityDecidedBy: user?.id ?? null,
          applicabilityDecidedAt: asIsoDateTime(new Date()),
          applicabilityReason: reason.trim(),
        })),
      ),
    );
  }

  requestDocument(
    id: AssistanceRequestId,
    draft: DocumentRequestDraft,
  ): Observable<readonly DocumentRequest[]> {
    const user = this.access.currentUser();
    const found = this.locateWritable<readonly DocumentRequest[]>(
      id,
      draft.requirementId,
      'document.record',
    );
    if ('error' in found) {
      return found.error;
    }

    const problems = documentRequestProblems(draft, todayAsIsoDate());
    if (problems.length > 0) {
      return throwError(() => new Error('That document request needs correcting.'));
    }

    this.documentRequestSequence += 1;
    const record: DocumentRequest = {
      id: asId<DocumentRequestId>(`dr-${String(this.documentRequestSequence).padStart(4, '0')}`),
      assistanceRequestId: id,
      requirementId: draft.requirementId,
      state: 'open',
      channel: draft.channel,
      message: draft.message.trim(),
      neededBy: draft.neededBy,
      requestedBy: user?.id ?? asId<StaffUserId>('staff-unknown'),
      requestedByName: user?.displayName ?? UNKNOWN_ACTOR,
      requestedAt: asIsoDateTime(new Date()),
      closedAt: null,
      closedBy: null,
      withdrawnReason: null,
      isWithheld: false,
    };

    this.documentRequests = [...this.documentRequests, record];
    return this.latency.respond(this.documentRequestsFor(found.request));
  }

  listDocumentRequests(id: AssistanceRequestId): Observable<readonly DocumentRequest[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly DocumentRequest[]>(user, 'request.view');
    if (denied) {
      return denied;
    }
    const request = this.reachable(id);
    if (request === undefined) {
      return throwError(() => new Error(REQUEST_NOT_FOUND));
    }
    return this.latency.respond(this.documentRequestsFor(request));
  }

  /**
   * Withdrawing closes the row; it never removes it.
   *
   * The record stays so that "we no longer need this" is distinguishable from "we never asked" —
   * an applicant who is told the office has stopped asking should be able to see when and why.
   */
  withdrawDocumentRequest(
    id: AssistanceRequestId,
    documentRequestId: DocumentRequestId,
    reason: string,
  ): Observable<readonly DocumentRequest[]> {
    const user = this.access.currentUser();
    const found = this.writable<readonly DocumentRequest[]>(id, 'document.record');
    if ('error' in found) {
      return found.error;
    }

    if (reason.trim().length === 0) {
      return throwError(
        () => new Error('Withdrawing a request needs a reason. The applicant was told something.'),
      );
    }

    const existing = this.documentRequests.find(
      (entry) => entry.id === documentRequestId && entry.assistanceRequestId === id,
    );

    if (existing === undefined) {
      return throwError(() => new Error('That request for a document was not found.'));
    }
    if (existing.state !== 'open') {
      return throwError(
        () =>
          new Error('That request for a document is already closed, and is kept as it was closed.'),
      );
    }

    this.documentRequests = this.documentRequests.map((entry) =>
      entry === existing
        ? {
            ...entry,
            state: 'withdrawn' as const,
            withdrawnReason: reason.trim(),
            closedAt: asIsoDateTime(new Date()),
            closedBy: user?.id ?? null,
          }
        : entry,
    );

    return this.latency.respond(this.documentRequestsFor(found.request));
  }

  /**
   * A grant to open one version's file, with the server's warning (`DL-178`): what the file is,
   * how to handle it, that opening it is recorded, and that nothing in it was redacted — the
   * office keeps the copy it received and makes no other, so `redactedForSharing` is `false`.
   */
  openDocument(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    versionId: DocumentVersionId,
  ): Observable<DocumentAccessGrant> {
    const user = this.access.currentUser();
    // The narrow grant. Seeing that a certificate was verified is `request.view`;
    // pulling the scan itself is this.
    const denied = denyUnless<DocumentAccessGrant>(user, 'document.download');
    if (denied) {
      return denied;
    }

    const request = this.reachable(id);
    if (request === undefined) {
      return throwError(() => new Error(REQUEST_NOT_FOUND));
    }
    const isProtected = this.disclose(request).isProtected;
    if (isProtected && !userHasPermission(user, 'request.view-sensitive')) {
      return throwError(() => new Error(PROTECTED_FILE_REFUSAL));
    }
    const requirement = request.requirements.find((entry) => entry.id === requirementId);
    if (requirement === undefined) {
      return throwError(() => new Error('That document is not on this request.'));
    }
    const version = requirement.document?.versions.find((entry) => entry.id === versionId);
    if (version === undefined) {
      return throwError(() => new Error('That version is not on this document.'));
    }
    if (version.file === null) {
      return throwError(
        () =>
          new Error(
            'This version was recorded without a file — encoded from paper, or confirmed with the office that issued it — so there is nothing to open.',
          ),
      );
    }

    this.grantSequence += 1;
    // Opaque and short-lived, never a durable public URL: a link that keeps working is a link
    // that gets forwarded.
    const handle = `mock-grant-${String(this.grantSequence).padStart(6, '0')}-${versionId}`;
    const expiresAt = asIsoDateTime(new Date(Date.now() + GRANT_LIFETIME_MS));
    this.grants.set(handle, { versionId, userId: user?.id ?? null, expiresAt });

    const replaced =
      version.supersededAt === null
        ? ''
        : `, replaced on ${version.supersededAt.slice(0, 10)} and kept as evidence`;
    const handling = isProtected
      ? 'This request is held under a protected sector (RA 9262 or RA 9344). Open the file only for this request’s work, and do not save, print or forward it.'
      : 'It holds personal information about an applicant (RA 10173). Open it only for this request’s work, and do not save it outside office systems or forward it.';

    return this.latency.respond<DocumentAccessGrant>({
      versionId,
      fileName: version.file.fileName,
      mimeType: version.file.mimeType,
      handle,
      expiresAt,
      redactedForSharing: false,
      warning:
        `${version.file.fileName} is version ${version.version} of the ${requirement.label}${replaced}. ` +
        `${handling} Opening it is recorded against your account. The copy is the one the office ` +
        'holds: nothing in it has been redacted.',
    });
  }

  /**
   * Exchanges a grant for the bytes: once, within five minutes, by the account it was issued to,
   * as the server does. The seed describes files and holds none of their bytes, so a seeded
   * version says so rather than handing over a stand-in that would read as the real document.
   */
  readDocumentFile(grant: DocumentAccessGrant): Observable<Blob> {
    const user = this.access.currentUser();
    const denied = denyUnless<Blob>(user, 'document.download');
    if (denied) {
      return denied;
    }
    const issued = this.grants.get(grant.handle);
    this.grants.delete(grant.handle);
    if (
      issued === undefined ||
      issued.userId !== (user?.id ?? null) ||
      issued.expiresAt < asIsoDateTime(new Date())
    ) {
      return throwError(() => new Error(GRANT_GONE));
    }
    const held = this.heldFiles.get(issued.versionId);
    if (held === undefined) {
      return throwError(
        () =>
          new Error(
            'The development data describes this file but holds none of its bytes, so nothing was opened.',
          ),
      );
    }
    return this.latency.respond<Blob>(held);
  }

  private grantSequence = 0;
  private readonly grants = new Map<
    string,
    { readonly versionId: DocumentVersionId; readonly userId: StaffUserId | null; readonly expiresAt: string }
  >();
  private readonly heldFiles = new Map<DocumentVersionId, Blob>();

  /* ── assignment (DL-178) ────────────────────────────────────────────────── */

  /** The open social-worker accounts, by name. Refused to a caseload, as on the server. */
  listSocialWorkers(): Observable<readonly SocialWorker[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly SocialWorker[]>(user, 'request.assess');
    if (denied) {
      return denied;
    }
    if (user?.scope === 'assigned-cases') {
      return throwError(() => new Error(ASSIGNING_REFUSAL));
    }
    return this.latency.respond(socialWorkers());
  }

  assignForAssessment(
    id: AssistanceRequestId,
    assigneeId: StaffUserId,
    reason: string,
  ): Observable<AssistanceRequest> {
    const user = this.access.currentUser();
    if (user?.scope === 'assigned-cases' && userHasPermission(user, 'request.assess')) {
      return throwError(() => new Error(ASSIGNING_REFUSAL));
    }
    const found = this.writable<AssistanceRequest>(id, 'request.assess');
    if ('error' in found) {
      return found.error;
    }
    const words = reason.trim();
    if (words === '') {
      return throwError(() => new Error(ASSIGNMENT_NEEDS_REASON));
    }
    const ended = refuseUnfiledOrEnded<AssistanceRequest>(found.request);
    if (ended) {
      return ended;
    }
    const assignee = socialWorkers().find((worker) => worker.id === assigneeId);
    if (assignee === undefined) {
      return throwError(
        () =>
          new Error(
            'Not the open account of a social worker. A request is assigned to a social worker for assessment.',
          ),
      );
    }
    // Assigning to whoever holds it answers as it stands, as the server answers it.
    if (found.request.assignedTo === assigneeId) {
      return this.latency.respond(this.disclose(found.request));
    }

    const now = asIsoDateTime(new Date());
    const assignment: RequestAssignment = {
      assigneeId,
      assigneeName: assignee.name,
      reason: words,
      actorId: user?.id ?? null,
      actorName: user?.displayName ?? UNKNOWN_ACTOR,
      occurredAt: now,
    };
    const updated: AssistanceRequest = {
      ...found.request,
      assignedTo: assigneeId,
      assignments: [...found.request.assignments, assignment],
      audit: { ...found.request.audit, updatedAt: now, updatedBy: user?.id ?? null },
    };
    this.requests = this.requests.map((request) => (request.id === id ? updated : request));
    return this.latency.respond(this.disclose(updated));
  }

  /* ── document helpers ───────────────────────────────────────────────────── */

  /** Open first, newest first, and the words withheld as the request's own are (`DL-178`). */
  private documentRequestsFor(request: AssistanceRequest): readonly DocumentRequest[] {
    const withheld = this.disclose(request).withheld.includes('requirementRemarks');
    return this.documentRequests
      .filter((entry) => entry.assistanceRequestId === request.id)
      .map((entry): DocumentRequest =>
        withheld ? { ...entry, message: null, withdrawnReason: null, isWithheld: true } : entry,
      )
      .slice()
      .sort(byRequestUrgency);
  }

  /** The request as this reader may reach it, or `undefined` — answered as "not found" (`DL-31`). */
  private reachable(id: AssistanceRequestId): AssistanceRequest | undefined {
    const request = this.requests.find((entry) => entry.id === id);
    return request !== undefined && inReach(this.access.currentUser(), request) ? request : undefined;
  }

  /**
   * A request this reader may add to: the permission, the request in reach, and — on a protected
   * request — `request.view-sensitive`, because nobody adds to what they may not read (`DL-178`).
   */
  private writable<TValue>(
    id: AssistanceRequestId,
    permission: Permission,
  ): { readonly request: AssistanceRequest } | { readonly error: Observable<TValue> } {
    const user = this.access.currentUser();
    const denied = denyUnless<TValue>(user, permission);
    if (denied) {
      return { error: denied };
    }
    const request = this.reachable(id);
    if (request === undefined) {
      return { error: throwError(() => new Error(REQUEST_NOT_FOUND)) };
    }
    if (this.disclose(request).withheld.includes('reasonForRequest')) {
      return { error: throwError(() => new Error(PROTECTED_WRITE_REFUSAL)) };
    }
    return { request };
  }

  /**
   * A writable request and one of its requirements, for a request that is filed and not over.
   * Shared so every document act applies the same checks in the same order as the server.
   */
  private locateWritable<TValue>(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    permission: Permission,
  ):
    | { readonly request: AssistanceRequest; readonly requirement: SubmittedRequirement }
    | { readonly error: Observable<TValue> } {
    const found = this.writable<TValue>(id, permission);
    if ('error' in found) {
      return found;
    }
    const ended = refuseUnfiledOrEnded<TValue>(found.request);
    if (ended) {
      return { error: ended };
    }
    const requirement = found.request.requirements.find((entry) => entry.id === requirementId);
    if (requirement === undefined) {
      return { error: throwError(() => new Error('That document is not on this request.')) };
    }
    return { request: found.request, requirement };
  }

  private saveRequirement(
    request: AssistanceRequest,
    requirementId: RequirementId,
    change: (requirement: SubmittedRequirement) => SubmittedRequirement,
  ): AssistanceRequest {
    const user = this.access.currentUser();
    const updated: AssistanceRequest = {
      ...request,
      requirements: request.requirements.map((entry) =>
        entry.id === requirementId ? change(entry) : entry,
      ),
      audit: {
        ...request.audit,
        updatedAt: asIsoDateTime(new Date()),
        updatedBy: user?.id ?? null,
      },
    };
    this.requests = this.requests.map((entry) => (entry.id === request.id ? updated : entry));
    return updated;
  }

  /* ── assembly ───────────────────────────────────────────────────────────── */

  /**
   * The acknowledgement against the check as it stands now, by the API's rules (`DL-177`). The
   * screen's copy of the advisory is a convenience; this is the check, because a client that
   * decides for itself whether an acknowledgement was needed can be told not to need one.
   */
  private acknowledgementProblem(
    request: AssistanceRequest,
    acknowledgement: AdvisoryAcknowledgement | null,
  ): Observable<AssistanceRequest> | null {
    const raised = cautions(this.assess(request.residentId, request.programId, request.id)).map(
      (signal) => signal.code,
    );
    if (raised.length === 0 && acknowledgement === null) {
      return null;
    }
    if (acknowledgement === null) {
      return throwError(
        () => new Error('This request needs a note about the duplicate check before it can be filed.'),
      );
    }
    const answered = new Set(acknowledgement.codes);
    if (raised.length === 0 || raised.some((code) => !answered.has(code))) {
      return throwError(
        () =>
          new Error('The duplicate check has changed since it was read. Read it again before filing.'),
      );
    }
    if (!isValidAcknowledgement(acknowledgement.reason)) {
      return throwError(() => new Error('Say a little more about why this is going ahead.'));
    }
    return null;
  }

  private advisoryOver(
    residentId: ResidentId,
    programId: ProgramId | null,
    except: AssistanceRequestId | null,
  ): Observable<IntakeAdvisory> {
    const resident = this.residents.find(residentId);
    if (!resident || !isWithinBarangayScope(this.access.currentUser(), resident.address.barangayId)) {
      return throwError(() => new PermissionDeniedError('request.create'));
    }
    return this.latency.respond(this.assess(residentId, programId, except));
  }

  /**
   * The domain's check over this store. Reads releases and cases, which the mock holds, so it has
   * no gap to name; the API names two (`DL-177`).
   */
  private assess(
    residentId: ResidentId,
    programId: ProgramId | null,
    except: AssistanceRequestId | null,
  ): IntakeAdvisory {
    const resident = this.residents.find(residentId);
    const householdId = resident?.householdId ?? null;
    const household = householdId === null ? undefined : this.residents.findHousehold(householdId);

    return assessIntake({
      residentId,
      householdId,
      programId,
      requests: this.requests.filter((other) => other.id !== except).map(toPriorRequest),
      releases: MOCK_DISBURSEMENTS.filter(
        (payout) =>
          payout.releasedAt !== null && payout.status !== 'voided' && payout.amount !== null,
      ).map((payout): PriorRelease => ({
        requestId: payout.requestId,
        residentId: payout.residentId,
        // Narrowed by the filter above; the assertion is the type system's
        // price for not being able to see that.
        amount: payout.amount as Money,
        releasedAt: payout.releasedAt ?? payout.audit.updatedAt,
      })),
      cases: this.cases.casesForResident(residentId).map((record) => ({
        referenceNumber: record.referenceNumber,
        isOpen: isCaseOpen(record.status),
      })),
      householdResidentIds: (household?.members ?? []).map((member) => member.residentId),
      today: todayAsIsoDate(),
      now: asIsoDateTime(new Date()),
    });
  }

  /**
   * The request as this reader may see it, as the API discloses it (`DL-38`, `DL-177`, `DL-178`):
   * protected when its person is under a protected sector **today**, and then its words withheld
   * from a reader without `request.view-sensitive`; the case study's words withheld from a reader
   * without `case.view` whatever the request; and every document number said as its last four
   * characters, the only part of it held (`DL-183`).
   */
  private disclose(request: AssistanceRequest): AssistanceRequest {
    return discloseRequest(
      request,
      this.access.currentUser(),
      this.residents.find(request.residentId),
    );
  }

  private fieldsFrom(draft: IntakeDraft, barangayId: AssistanceRequest['barangayId']) {
    const referredBy = draft.referredBy?.trim() ?? '';
    return {
      residentId: draft.residentId ?? asId<ResidentId>(''),
      programId: draft.programId ?? asId<ProgramId>(''),
      barangayId,
      status: 'draft' as const,
      channel: draft.channel,
      referredBy: referredBy === '' ? null : referredBy,
      requestedAmount: draft.requestedAmount,
      reasonForRequest: draft.reasonForRequest.trim(),
    };
  }
}

/* ── helpers ───────────────────────────────────────────────────────────────── */

/**
 * What the API refuses at filing, in its words (`DL-177`): a programme, a reason somebody could
 * act on, and every document owed either presented or excused with a reason. Excusing is always
 * open to the encoder, so this refuses an intake record, never an applicant.
 */
function filingProblems(request: AssistanceRequest): readonly string[] {
  const problems: string[] = [];
  if (request.programId.length === 0) {
    problems.push('Choose the programme before filing.');
  }
  const reason = request.reasonForRequest.trim();
  if (reason === '') {
    problems.push('Say why the applicant came.');
  } else if (reason.length < REASON_MIN_LENGTH) {
    problems.push(
      `Say a little more about why the applicant came — ${REASON_MIN_LENGTH} characters or more.`,
    );
  }
  const owed = request.requirements.filter(
    (requirement) =>
      isOutstandingObligation(requirement.obligation, requirement.applicability) &&
      requirement.status === 'pending',
  );
  if (owed.length > 0) {
    problems.push(
      `Record each owed document as presented, or excuse it with a reason: ${owed
        .map((entry) => entry.label)
        .join(', ')}.`,
    );
  }
  return problems;
}

function toPriorRequest(request: AssistanceRequest): PriorRequest {
  return {
    id: request.id,
    referenceNumber: request.referenceNumber === '' ? 'Unfiled draft' : request.referenceNumber,
    residentId: request.residentId,
    programId: request.programId,
    programName:
      MOCK_PROGRAMS.find((program) => program.id === request.programId)?.name ??
      'Unknown programme',
    status: request.status,
    submittedAt: request.submittedAt,
    approvedAmount: request.approvedAmount,
  };
}

let requirementSequence = 0;

function requirementsFrom(
  entries: readonly IntakeRequirementEntry[],
): readonly SubmittedRequirement[] {
  return entries.map((entry) => {
    requirementSequence += 1;
    return {
      id: asId<RequirementId>(`rq-i${String(requirementSequence).padStart(4, '0')}`),
      code: entry.code,
      label: entry.label,
      status: statusOf(entry),
      obligation: entry.obligation,
      applicability: entry.applicability,
      appliesWhen: entry.appliesWhen,
      applicabilityDecidedBy: null,
      applicabilityDecidedAt: null,
      applicabilityReason: null,
      accepts: DOCUMENT_UPLOAD_POLICY,
      submittedAt: entry.presented ? asIsoDateTime(new Date()) : null,
      reviewedBy: null,
      reviewedAt: null,
      remarks: entry.waivedReason,
      // Intake records that a document was *presented*; capturing the file
      // itself is the assessment workspace's job (`DL-77`).
      document: null,
    };
  });
}

/**
 * Merges the counter's answers into the requirements already on a draft,
 * matching on `code` so re-saving does not renumber anything the assessment
 * workspace may already have reviewed.
 */
function mergeRequirements(
  existing: readonly SubmittedRequirement[],
  entries: readonly IntakeRequirementEntry[],
): readonly SubmittedRequirement[] {
  const byCode = new Map(existing.map((requirement) => [requirement.code, requirement]));
  const merged = entries.map((entry) => {
    const previous = byCode.get(entry.code);
    if (previous === undefined) {
      return requirementsFrom([entry])[0];
    }
    return {
      ...previous,
      obligation: entry.obligation,
      appliesWhen: entry.appliesWhen,
      // The counter's ruling wins only while nobody has ruled already: a
      // re-save must not quietly undo an applicability decision somebody made.
      applicability:
        previous.applicability === 'undecided' ? entry.applicability : previous.applicability,
      label: entry.label,
      status: previous.status === 'verified' ? previous.status : statusOf(entry),
      submittedAt: entry.presented ? (previous.submittedAt ?? asIsoDateTime(new Date())) : null,
      remarks: entry.waivedReason ?? previous.remarks,
    } satisfies SubmittedRequirement;
  });
  return merged.filter(
    (requirement): requirement is SubmittedRequirement => requirement !== undefined,
  );
}

function statusOf(entry: IntakeRequirementEntry): RequirementStatus {
  if (entry.waivedReason !== null && entry.waivedReason.trim().length > 0) {
    return 'waived';
  }
  return entry.presented ? 'submitted' : 'pending';
}

/**
 * Highest serial already used by a seeded id, so a session-created document
 * cannot be handed an id that already belongs to one. Counting records would
 * do exactly that the moment a seed id skips a number.
 */
function highestSerialIn(values: readonly string[]): number {
  let highest = 0;
  for (const value of values) {
    const digits = /(\d+)$/.exec(value)?.[1];
    const serial = digits === undefined ? 0 : Number.parseInt(digits, 10);
    if (serial > highest) {
      highest = serial;
    }
  }
  return highest;
}

function highestDocumentSerial(requests: readonly AssistanceRequest[]): number {
  return highestSerialIn(
    requests.flatMap((request) =>
      request.requirements
        .map((requirement) => requirement.document?.id)
        .filter((id): id is NonNullable<typeof id> => id !== undefined && id !== null),
    ),
  );
}

function highestDocumentVersionSerial(requests: readonly AssistanceRequest[]): number {
  return highestSerialIn(
    requests.flatMap((request) =>
      request.requirements.flatMap((requirement) =>
        (requirement.document?.versions ?? []).map((version) => version.id),
      ),
    ),
  );
}

/* ── the server's rules, held here too (DL-178) ────────────────────────────── */

const REQUEST_NOT_FOUND = 'That request was not found.';

/** Who wrote something, when the session holds no name for them. */
const UNKNOWN_ACTOR = 'A staff account with no name on record';

/** The server's refusal of assigning to a caseload: it reads the office's whole list. */
const ASSIGNING_REFUSAL =
  'Assigning a request for assessment is done from the office’s whole list, and your account works ' +
  'the requests assigned to it. Ask whoever assigns them.';

const GRANT_GONE =
  'That file is not available to open. A grant is used once, within five minutes, by the account it ' +
  'was issued to. Ask to open the file again.';

/** How long a grant to open a file lasts, as on the server: long enough to confirm, too short to forward. */
const GRANT_LIFETIME_MS = 5 * 60_000;

/** The verdicts a person gives a document. `pending` and `submitted` are states, never a review. */
const REVIEW_VERDICTS = ['verified', 'rejected', 'waived', 'expired', 'needs-replacement'] as const;

type ReviewVerdict = (typeof REVIEW_VERDICTS)[number];

/** Where the applicant must be told why, the words are required — in the server's sentences. */
const REVIEW_NEEDS_WORDS: Readonly<Record<ReviewVerdict, string | null>> = {
  verified: null,
  expired: null,
  waived:
    'Say why the document is being excused. An excuse nobody gave a reason for reads as an oversight.',
  rejected:
    'Say why the document was not accepted. The applicant has to be told what to bring instead.',
  'needs-replacement': 'Say why a fresh copy is needed — damaged, illegible, or out of date.',
};

/**
 * Whether this reader reaches the request at all. A caseload (`assigned-cases`) reads the filed
 * requests assigned to it and nothing else; everything else answers as not found (`DL-178`).
 */

/**
 * Starting, saving and filing a request, and the duplicate check, read beyond a caseload — the
 * person's whole history, the office's whole register — so they are refused to one (`DL-178`).
 */
function beyondCaseload<TValue>(user: AuthenticatedUser | null): Observable<TValue> | null {
  return user?.scope === 'assigned-cases'
    ? throwError(
        () =>
          new Error(
            'Starting, saving and filing a request read beyond the requests assigned to your account. An intake officer does this.',
          ),
      )
    : null;
}

/** A draft's checklist is the counter's, and a request that is over is kept as it ended. */
function refuseUnfiledOrEnded<TValue>(request: AssistanceRequest): Observable<TValue> | null {
  if (request.referenceNumber === '') {
    return throwError(
      () => new Error('This request is still a draft. Its checklist is saved with the draft.'),
    );
  }
  if (isTerminalAssistanceStatus(request.status)) {
    const label = ASSISTANCE_STATUS_CATALOG[request.status].label.toLowerCase();
    return throwError(() => new Error(`This request is ${label}, and is kept as it ended.`));
  }
  return null;
}

/** An assessment is opened, answered and completed while the request is in `assessment`. */
function outsideAssessment<TValue>(request: AssistanceRequest): Observable<TValue> | null {
  if (request.status === 'assessment') {
    return null;
  }
  const label = ASSISTANCE_STATUS_CATALOG[request.status].label.toLowerCase();
  return throwError(
    () =>
      new Error(
        `An assessment is opened, answered and completed while the request is in assessment, and this one is ${label}.`,
      ),
  );
}

/** The open accounts in the social-worker role, by name — nothing more, as the server lists them. */
function socialWorkers(): readonly SocialWorker[] {
  return MOCK_STAFF.filter((staff) => staff.role === 'social-worker' && staff.isActive).map(
    (staff) => ({ id: staff.id, name: `${staff.name.first} ${staff.name.last}` }),
  );
}

/** The extension the server gives a stored file, from its type. */
function extensionFor(mimeType: string): string {
  return mimeType === 'application/pdf'
    ? '.pdf'
    : mimeType === 'image/jpeg'
      ? '.jpg'
      : mimeType === 'image/png'
        ? '.png'
        : '';
}
