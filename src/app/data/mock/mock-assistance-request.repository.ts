import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';

import {
  ACCESS_CONTEXT,
  canReadRecord,
  ASSISTANCE_STATUS_CATALOG,
  ASSISTANCE_STATUS_TRANSITIONS,
  asId,
  asIsoDateTime,
  assessIntake,
  canTransition,
  isCaseOpen,
  isTerminalAssistanceStatus,
  isValidAcknowledgement,
  isValidFindings,
  isWithinBarangayScope,
  needsAcknowledgement,
  paginate,
  PermissionDeniedError,
  permissionForTransition,
  todayAsIsoDate,
  type AdvisoryAcknowledgement,
  type AssessmentDraft,
  type AssistanceRequest,
  type AssistanceRequestFilter,
  type AssistanceRequestId,
  type AssistanceRequestRepository,
  type AssistanceRequestSortField,
  type AssistanceRequestStatus,
  type IntakeAdvisory,
  type IntakeDraft,
  type IntakeRequirementEntry,
  type Page,
  type PageRequest,
  type PriorRelease,
  type PriorRequest,
  type ProgramId,
  type RequestNote,
  type RequirementId,
  type RequirementStatus,
  type ResidentId,
  type StatusChange,
  type SubmittedRequirement,
} from '@domain/index';

import { MOCK_ASSISTANCE_REQUESTS, MOCK_REQUEST_NOTES } from './seed/assistance-requests.seed';
import { MOCK_DISBURSEMENTS } from './seed/disbursements.seed';
import { MOCK_PROGRAMS } from './seed/programs.seed';
import { denyUnless } from './mock-access';
import { MockCaseStore } from './mock-case.store';
import { MockLatency } from './mock-latency';
import { MockResidentStore } from './mock-resident.store';
import { matchesSearch, sortItems } from './mock-query';

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
  private requests: AssistanceRequest[] = [...MOCK_ASSISTANCE_REQUESTS];
  /** Ids for drafts created in this session. */
  private sequence = 0;
  /** Control numbers issued at filing. */
  private serial = 0;

  list(
    filter: AssistanceRequestFilter,
    page: PageRequest<AssistanceRequestSortField>,
  ): Observable<Page<AssistanceRequest>> {
    const user = this.access.currentUser();
    const denied = denyUnless<Page<AssistanceRequest>>(user, 'request.view');
    if (denied) {
      return denied;
    }

    const filtered = this.requests.filter((request) => {
      if (!isWithinBarangayScope(user, request.barangayId)) {
        return false;
      }
      if (filter.status && request.status !== filter.status) {
        return false;
      }
      if (filter.programId && request.programId !== filter.programId) {
        return false;
      }
      if (filter.barangayId && request.barangayId !== filter.barangayId) {
        return false;
      }
      if (filter.assignedTo && request.assignedTo !== filter.assignedTo) {
        return false;
      }
      if (filter.openOnly && isTerminalAssistanceStatus(request.status)) {
        return false;
      }
      return matchesSearch(
        [request.referenceNumber, request.reasonForRequest, request.decisionRemarks],
        filter.search,
      );
    });

    const sort = page.sort ?? { field: 'submittedAt' as const, direction: 'desc' as const };
    const sorted = sortItems(
      filtered,
      (request) => requestSortKey(request, sort.field),
      sort.direction,
    );

    return this.latency.respond(paginate(sorted, page));
  }

  getById(id: AssistanceRequestId): Observable<AssistanceRequest | null> {
    const request = this.requests.find((candidate) => candidate.id === id);
    if (!request || !canReadRecord(this.access.currentUser(), 'request.view', request.barangayId)) {
      return this.latency.respond(null);
    }
    return this.latency.respond(request);
  }

  listNotes(id: AssistanceRequestId): Observable<readonly RequestNote[]> {
    const notes = MOCK_REQUEST_NOTES.filter((note) => note.requestId === id);
    return this.latency.respond(sortItems(notes, (note) => note.createdAt, 'desc'));
  }

  changeStatus(
    id: AssistanceRequestId,
    to: AssistanceRequestStatus,
    reason: string | null,
  ): Observable<AssistanceRequest> {
    // The action is refused here as well as hidden in the UI. Approving is
    // gated on `request.approve` and releasing on `disbursement.release`, which
    // is what keeps DL-08 true even if a button is somehow reachable.
    const denied = denyUnless<AssistanceRequest>(
      this.access.currentUser(),
      permissionForTransition(to),
    );
    if (denied) {
      return denied;
    }

    const index = this.requests.findIndex((request) => request.id === id);
    const current = this.requests[index];

    if (index < 0 || current === undefined) {
      return throwError(() => new Error(`Assistance request ${id} was not found.`));
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

    const change: StatusChange = {
      from: current.status,
      to,
      reason,
      actorId: current.assignedTo,
      actorName: 'Mock session user',
      occurredAt: asIsoDateTime(new Date()),
    };

    const updated: AssistanceRequest = {
      ...current,
      status: to,
      statusHistory: [...current.statusHistory, change],
      audit: { ...current.audit, updatedAt: change.occurredAt },
    };

    this.requests = this.requests.map((request) => (request.id === id ? updated : request));
    return this.latency.respond(updated);
  }

  /* ── Intake ─────────────────────────────────────────────────────────────── */

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
    const denied = denyUnless<IntakeAdvisory>(user, 'request.create');
    if (denied) {
      return denied;
    }

    const resident = this.residents.find(residentId);
    if (!resident || !isWithinBarangayScope(user, resident.address.barangayId)) {
      return throwError(() => new PermissionDeniedError('request.create'));
    }

    const household =
      resident.householdId === null
        ? undefined
        : this.residents.findHousehold(resident.householdId);
    const householdResidentIds = (household?.members ?? []).map((member) => member.residentId);

    return this.latency.respond(
      assessIntake({
        residentId,
        householdId: resident.householdId,
        programId,
        requests: this.requests.map(toPriorRequest),
        releases: MOCK_DISBURSEMENTS.filter(
          (payout) => payout.releasedAt !== null && payout.status !== 'voided',
        ).map((payout): PriorRelease => ({
          requestId: payout.requestId,
          residentId: payout.residentId,
          amount: payout.amount,
          // Narrowed above; the filter is the guarantee, the fallback is the
          // type system's price for not being able to see that.
          releasedAt: payout.releasedAt ?? payout.audit.updatedAt,
        })),
        cases: this.cases.casesForResident(residentId).map((record) => ({
          referenceNumber: record.referenceNumber,
          isOpen: isCaseOpen(record.status),
        })),
        householdResidentIds,
        today: todayAsIsoDate(),
        now: asIsoDateTime(new Date()),
      }),
    );
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
    const denied = denyUnless<AssistanceRequest>(user, 'request.create');
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
        return throwError(() => new Error('That request has already been filed.'));
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
      return this.latency.respond(updated);
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
      assignedTo: null,
      requirements: requirementsFrom(draft.requirements),
      assessment: null,
      statusHistory: [],
      decisionRemarks: null,
      submittedAt: null,
      audit: {
        createdAt: now,
        createdBy: user?.id ?? null,
        updatedAt: now,
        updatedBy: user?.id ?? null,
      },
    };
    this.requests = [...this.requests, created];
    return this.latency.respond(created);
  }

  /**
   * Files the draft.
   *
   * The acknowledgement is demanded exactly when the advisory raised a caution,
   * and refused when it did not — a stored "reason for proceeding" against a
   * request nothing was flagged on would make the record say something untrue.
   * Nothing here refuses the submission on the strength of a signal (`DL-60`).
   */
  submitIntake(
    id: AssistanceRequestId,
    acknowledgement: AdvisoryAcknowledgement | null,
  ): Observable<AssistanceRequest> {
    const user = this.access.currentUser();
    const denied = denyUnless<AssistanceRequest>(user, 'request.create');
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
      return this.latency.respond(current);
    }
    if (current.programId === null || current.reasonForRequest.trim().length === 0) {
      return throwError(() => new Error('The request is not complete enough to file.'));
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
    return this.latency.respond(filed);
  }

  /**
   * Records the case study. Held apart from any status move: writing findings
   * and endorsing on them are two acts, and the second one is what `DL-08`
   * keeps away from the person who did the first.
   */
  recordAssessment(
    id: AssistanceRequestId,
    assessment: AssessmentDraft,
  ): Observable<AssistanceRequest> {
    const user = this.access.currentUser();
    const denied = denyUnless<AssistanceRequest>(user, 'request.assess');
    if (denied) {
      return denied;
    }
    if (!isValidFindings(assessment.findings)) {
      return throwError(() => new Error('A case study needs findings somebody else could act on.'));
    }

    const current = this.requests.find((request) => request.id === id);
    if (current === undefined || !isWithinBarangayScope(user, current.barangayId)) {
      return throwError(() => new PermissionDeniedError('request.assess'));
    }

    const now = asIsoDateTime(new Date());
    const updated: AssistanceRequest = {
      ...current,
      assessment: {
        assessedBy: user?.id ?? current.assignedTo ?? asId('staff-unknown'),
        assessedAt: now,
        findings: assessment.findings.trim(),
        recommendedAmount: assessment.recommendedAmount,
        homeVisitConducted: assessment.homeVisitConducted,
      },
      audit: { ...current.audit, updatedAt: now, updatedBy: user?.id ?? null },
    };
    this.requests = this.requests.map((request) => (request.id === id ? updated : request));
    return this.latency.respond(updated);
  }

  reviewRequirement(
    id: AssistanceRequestId,
    requirementId: RequirementId,
    status: RequirementStatus,
    remarks: string | null,
  ): Observable<AssistanceRequest> {
    const user = this.access.currentUser();
    const denied = denyUnless<AssistanceRequest>(user, 'request.intake');
    if (denied) {
      return denied;
    }
    // A waiver is an excuse for a missing document, and an excuse nobody signed
    // is indistinguishable from an oversight.
    if (status === 'waived' && (remarks === null || remarks.trim().length === 0)) {
      return throwError(() => new Error('Say why the requirement is being waived.'));
    }

    const current = this.requests.find((request) => request.id === id);
    if (current === undefined || !isWithinBarangayScope(user, current.barangayId)) {
      return throwError(() => new PermissionDeniedError('request.intake'));
    }
    if (!current.requirements.some((requirement) => requirement.id === requirementId)) {
      return throwError(() => new Error('That requirement is not on this request.'));
    }

    const now = asIsoDateTime(new Date());
    const updated: AssistanceRequest = {
      ...current,
      requirements: current.requirements.map((requirement) =>
        requirement.id === requirementId
          ? {
              ...requirement,
              status,
              reviewedBy: user?.id ?? null,
              remarks: remarks === null ? requirement.remarks : remarks.trim(),
            }
          : requirement,
      ),
      audit: { ...current.audit, updatedAt: now, updatedBy: user?.id ?? null },
    };
    this.requests = this.requests.map((request) => (request.id === id ? updated : request));
    return this.latency.respond(updated);
  }

  /* ── assembly ───────────────────────────────────────────────────────────── */

  /**
   * Recomputes the advisory server-side at submission and compares it with what
   * the encoder answered. The screen's copy is a convenience; this is the
   * check, because a client that decides for itself whether an acknowledgement
   * was needed can be told not to need one.
   */
  private acknowledgementProblem(
    request: AssistanceRequest,
    acknowledgement: AdvisoryAcknowledgement | null,
  ): Observable<AssistanceRequest> | null {
    const resident = this.residents.find(request.residentId);
    const household =
      resident?.householdId == null
        ? undefined
        : this.residents.findHousehold(resident.householdId);

    const advisory = assessIntake({
      residentId: request.residentId,
      householdId: resident?.householdId ?? null,
      programId: request.programId,
      requests: this.requests.filter((other) => other.id !== request.id).map(toPriorRequest),
      releases: MOCK_DISBURSEMENTS.filter(
        (payout) => payout.releasedAt !== null && payout.status !== 'voided',
      ).map((payout) => ({
        requestId: payout.requestId,
        residentId: payout.residentId,
        amount: payout.amount,
        releasedAt: payout.releasedAt ?? payout.audit.updatedAt,
      })),
      cases: this.cases.casesForResident(request.residentId).map((record) => ({
        referenceNumber: record.referenceNumber,
        isOpen: isCaseOpen(record.status),
      })),
      householdResidentIds: (household?.members ?? []).map((member) => member.residentId),
      today: todayAsIsoDate(),
      now: asIsoDateTime(new Date()),
    });

    if (needsAcknowledgement(advisory)) {
      if (acknowledgement === null) {
        return throwError(
          () =>
            new Error(
              'This request needs a note about the duplicate check before it can be filed.',
            ),
        );
      }
      if (!isValidAcknowledgement(acknowledgement.reason)) {
        return throwError(() => new Error('Say a little more about why this is going ahead.'));
      }
    } else if (acknowledgement !== null) {
      return throwError(
        () => new Error('Nothing was flagged on this request, so there is nothing to acknowledge.'),
      );
    }
    return null;
  }

  private fieldsFrom(draft: IntakeDraft, barangayId: AssistanceRequest['barangayId']) {
    return {
      residentId: draft.residentId ?? asId<ResidentId>(''),
      programId: draft.programId ?? asId<ProgramId>(''),
      barangayId,
      status: 'draft' as const,
      requestedAmount: draft.requestedAmount,
      reasonForRequest: draft.reasonForRequest.trim(),
    };
  }
}

/* ── helpers ───────────────────────────────────────────────────────────────── */

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
      isMandatory: entry.isMandatory,
      submittedAt: entry.presented ? asIsoDateTime(new Date()) : null,
      reviewedBy: null,
      remarks: entry.waivedReason,
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
      isMandatory: entry.isMandatory,
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

function requestSortKey(
  request: AssistanceRequest,
  field: AssistanceRequestSortField,
): string | null {
  switch (field) {
    case 'referenceNumber':
      return request.referenceNumber;
    case 'status':
      return request.status;
    case 'submittedAt':
      return request.submittedAt;
    case 'updatedAt':
      return request.audit.updatedAt;
  }
}
