import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asId,
  asIsoDateTime,
  catalogueReasonProblem,
  ISSUANCE_OPEN_STATUSES,
  ISSUANCE_REFERENCE_INCOMPLETE,
  ISSUANCE_STATUS_CATALOG,
  issuanceMoveProblem,
  issuanceTypeProblems,
  officeMovesFrom,
  wholeIssuanceReference,
  type CursorPage,
  type CursorRequest,
  type IssuanceAttachmentId,
  type IssuanceEventId,
  type IssuanceFileGrant,
  type IssuanceListFilter,
  type IssuanceMove,
  type IssuanceQueueFilter,
  type IssuanceRepository,
  type IssuanceRequest,
  type IssuanceRequestId,
  type IssuanceRequestSummary,
  type IssuanceType,
  type IssuanceTypeChanges,
  type IssuanceTypeDraft,
  type IssuanceTypeFields,
  type IssuanceTypeId,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { MOCK_OFFICE_MSWDO, MOCK_OFFICES } from './seed/offices.seed';
import { MOCK_ISSUANCE_REQUESTS, MOCK_ISSUANCE_TYPES, sampleFile } from './seed/issuance.seed';

/** The API's ceiling on a page (`limit` maximum 50), kept so the mock pages like the server. */
const LARGEST_PAGE = 50;

/** The API's limit on an office's active types. */
const ACTIVE_TYPES_PER_OFFICE = 50;

/**
 * In-memory residents' document requests (`DL-184`), refusing the way the API does.
 *
 * - Every act re-checks its key: `issuance-type.manage` for the catalogue, `issuance-request.manage`
 *   for the requests. Hiding the screen is not protection (rule 4).
 * - A move the office does not make from the current status is refused, as the API answers 409 —
 *   two members of staff on one queue is the ordinary case.
 * - Every move appends to the history; nothing is changed or removed.
 * - The mock has no offices on its accounts, so it answers every office's records, as the API
 *   answers an administrator; a new type with no office chosen is the MSWDO's.
 */
@Injectable()
export class MockIssuanceRepository implements IssuanceRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  private types: readonly IssuanceType[] = MOCK_ISSUANCE_TYPES;
  private requests: readonly IssuanceRequest[] = MOCK_ISSUANCE_REQUESTS;
  private grants = 0;

  catalogue(): Observable<readonly IssuanceType[]> {
    return this.latency.respond(
      this.types
        .filter((type) => type.active)
        .slice()
        .sort((a, b) => a.office.name.localeCompare(b.office.name) || a.name.localeCompare(b.name)),
    );
  }

  officeTypes(): Observable<readonly IssuanceType[]> {
    const denied = this.deny<readonly IssuanceType[]>('type');
    if (denied) {
      return denied;
    }
    return this.latency.respond(
      this.types
        .slice()
        .sort(
          (a, b) =>
            a.office.name.localeCompare(b.office.name) ||
            Number(b.active) - Number(a.active) ||
            a.name.localeCompare(b.name),
        ),
    );
  }

  createType(draft: IssuanceTypeDraft): Observable<IssuanceType> {
    const denied = this.deny<IssuanceType>('type');
    if (denied) {
      return denied;
    }
    const refused = this.refuseFields(draft, draft.reason);
    if (refused) {
      return refused;
    }
    const officeId = draft.officeId ?? MOCK_OFFICE_MSWDO;
    const office = MOCK_OFFICES.find((candidate) => candidate.id === officeId);
    if (office === undefined) {
      return throwError(() => new Error('That office was not found.'));
    }
    const active = this.types.filter((type) => type.office.id === officeId && type.active);
    if (active.some((type) => sameName(type.name, draft.name))) {
      return throwError(() => new Error('The office already offers a document of that name.'));
    }
    if (active.length >= ACTIVE_TYPES_PER_OFFICE) {
      return throwError(() => new Error('An office offers at most 50 documents at once.'));
    }
    const now = asIsoDateTime(new Date());
    const created: IssuanceType = {
      id: asId<IssuanceTypeId>(`issuance-type-${this.types.length + 1}-${Date.now()}`),
      office: { id: office.id, name: office.name },
      name: draft.name.trim(),
      description: draft.description,
      requirements: draft.requirements,
      fee: draft.fee,
      processingDays: draft.processingDays,
      claimInstructions: draft.claimInstructions,
      active: true,
      retiredAt: null,
      updatedAt: now,
    };
    this.types = [...this.types, created];
    return this.latency.respond(created);
  }

  updateType(id: IssuanceTypeId, changes: IssuanceTypeChanges): Observable<IssuanceType> {
    const denied = this.deny<IssuanceType>('type');
    if (denied) {
      return denied;
    }
    const current = this.types.find((type) => type.id === id);
    if (current === undefined) {
      return throwError(() => new Error('That document type was not found.'));
    }
    if (!current.active) {
      return throwError(() => new Error('A retired document type cannot be changed.'));
    }
    const next: IssuanceTypeFields = {
      name: changes.name?.trim() ?? current.name,
      description: changes.description === undefined ? current.description : changes.description,
      requirements: changes.requirements ?? current.requirements,
      fee: changes.fee === undefined ? current.fee : changes.fee,
      processingDays:
        changes.processingDays === undefined ? current.processingDays : changes.processingDays,
      claimInstructions:
        changes.claimInstructions === undefined
          ? current.claimInstructions
          : changes.claimInstructions,
    };
    const refused = this.refuseFields(next, changes.reason);
    if (refused) {
      return refused;
    }
    if (
      !sameName(next.name, current.name) &&
      this.types.some(
        (type) =>
          type.id !== id &&
          type.active &&
          type.office.id === current.office.id &&
          sameName(type.name, next.name),
      )
    ) {
      return throwError(() => new Error('The office already offers a document of that name.'));
    }
    const updated: IssuanceType = { ...current, ...next, updatedAt: asIsoDateTime(new Date()) };
    this.types = this.types.map((type) => (type.id === id ? updated : type));
    return this.latency.respond(updated);
  }

  retireType(id: IssuanceTypeId, reason: string): Observable<IssuanceType> {
    const denied = this.deny<IssuanceType>('type');
    if (denied) {
      return denied;
    }
    const problem = catalogueReasonProblem(reason);
    if (problem !== null) {
      return throwError(() => new Error(problem));
    }
    const current = this.types.find((type) => type.id === id);
    if (current === undefined) {
      return throwError(() => new Error('That document type was not found.'));
    }
    if (!current.active) {
      return this.latency.respond(current);
    }
    const now = asIsoDateTime(new Date());
    const retired: IssuanceType = { ...current, active: false, retiredAt: now, updatedAt: now };
    this.types = this.types.map((type) => (type.id === id ? retired : type));
    return this.latency.respond(retired);
  }

  waiting(filter: IssuanceQueueFilter): Observable<readonly IssuanceRequestSummary[]> {
    const denied = this.deny<readonly IssuanceRequestSummary[]>('request');
    if (denied) {
      return denied;
    }
    const statuses = filter.status === null ? ISSUANCE_OPEN_STATUSES : [filter.status];
    return this.latency.respond(
      this.requests
        .filter(
          (request) =>
            statuses.includes(request.status) &&
            (filter.typeId === null || request.type.id === filter.typeId) &&
            (filter.residentAccountId === undefined ||
              request.resident.accountId === filter.residentAccountId),
        )
        .map(summaryOf),
    );
  }

  list(
    filter: IssuanceListFilter,
    page: CursorRequest,
  ): Observable<CursorPage<IssuanceRequestSummary>> {
    const denied = this.deny<CursorPage<IssuanceRequestSummary>>('request');
    if (denied) {
      return denied;
    }
    // The whole number or nothing, as the API answers part of one with a 422 (`DL-186`).
    const reference =
      filter.reference === undefined ? undefined : wholeIssuanceReference(filter.reference);
    if (reference === null) {
      return throwError(() => new Error(ISSUANCE_REFERENCE_INCOMPLETE));
    }
    const matching = this.requests
      .filter(
        (request) =>
          (filter.status === null || request.status === filter.status) &&
          (filter.typeId === null || request.type.id === filter.typeId) &&
          (reference === undefined || request.referenceNumber === reference) &&
          (filter.residentAccountId === undefined ||
            request.resident.accountId === filter.residentAccountId),
      )
      .slice()
      .sort((a, b) => b.filedAt.localeCompare(a.filedAt));
    const start = page.cursor ? Number.parseInt(page.cursor, 10) || 0 : 0;
    const limit = Math.min(Math.max(1, page.limit), LARGEST_PAGE);
    const end = start + limit;
    const hasMore = end < matching.length;
    return this.latency.respond({
      items: matching.slice(start, end).map(summaryOf),
      hasMore,
      nextCursor: hasMore ? String(end) : null,
    });
  }

  request(id: IssuanceRequestId): Observable<IssuanceRequest> {
    const denied = this.deny<IssuanceRequest>('request');
    if (denied) {
      return denied;
    }
    const found = this.requests.find((request) => request.id === id);
    return found === undefined
      ? throwError(() => new Error('No document request with that ID that you can open.'))
      : this.latency.respond(found);
  }

  move(id: IssuanceRequestId, move: IssuanceMove): Observable<IssuanceRequest> {
    const denied = this.deny<IssuanceRequest>('request');
    if (denied) {
      return denied;
    }
    const problem = issuanceMoveProblem(move);
    if (problem !== null) {
      return throwError(() => new Error(problem));
    }
    const current = this.requests.find((request) => request.id === id);
    if (current === undefined) {
      return throwError(() => new Error('No document request with that ID that you can open.'));
    }
    if (!officeMovesFrom(current.status).includes(move.to)) {
      return throwError(
        () =>
          new Error(
            `The office cannot move a request that is ${ISSUANCE_STATUS_CATALOG[current.status].label.toLowerCase()} ` +
              `to ${ISSUANCE_STATUS_CATALOG[move.to].label.toLowerCase()}. It may have moved meanwhile.`,
          ),
      );
    }
    const now = asIsoDateTime(new Date());
    const claimDetails = move.claimDetails?.trim() ?? null;
    const moved: IssuanceRequest = {
      ...current,
      status: move.to,
      statusSince: now,
      claimDetails: claimDetails ?? current.claimDetails,
      allowedMoves: officeMovesFrom(move.to),
      history: [
        ...current.history,
        {
          id: asId<IssuanceEventId>(`${current.id}-event-${current.history.length}`),
          from: current.status,
          to: move.to,
          side: 'office',
          actorId: this.access.currentUser()?.id ?? 'unknown',
          reason: move.reason.trim(),
          claimDetails,
          at: now,
        },
      ],
    };
    this.requests = this.requests.map((request) => (request.id === id ? moved : request));
    return this.latency.respond(moved);
  }

  grantAttachment(
    id: IssuanceRequestId,
    attachmentId: IssuanceAttachmentId,
  ): Observable<IssuanceFileGrant> {
    const denied = this.deny<IssuanceFileGrant>('request');
    if (denied) {
      return denied;
    }
    const request = this.requests.find((candidate) => candidate.id === id);
    const file = request?.attachments.find((attachment) => attachment.id === attachmentId);
    if (request === undefined || file === undefined) {
      return throwError(() => new Error('That file was not found on this request.'));
    }
    const label =
      request.requirements.find((requirement) => requirement.code === file.requirementCode)
        ?.label ?? file.requirementCode;
    const extension =
      file.mimeType === 'application/pdf' ? 'pdf' : file.mimeType === 'image/png' ? 'png' : 'jpg';
    const fileName = `${file.requirementCode}-v${file.version}.${extension}`;
    this.grants += 1;
    return this.latency.respond({
      attachmentId: file.id,
      fileName,
      mimeType: file.mimeType,
      handle: `sample-handle-${this.grants}-${file.id}`,
      expiresAt: asIsoDateTime(new Date(Date.now() + 5 * 60_000)),
      warning:
        `${fileName} is version ${file.version} of the ${label} the resident sent with ` +
        `${request.referenceNumber}. It holds personal information about a resident (RA 10173). ` +
        'Open it only to act on this request, and do not save it outside office systems or ' +
        'forward it. Opening it is recorded against your account.',
    });
  }

  readAttachment(grant: IssuanceFileGrant): Observable<Blob> {
    const denied = this.deny<Blob>('request');
    if (denied) {
      return denied;
    }
    return this.latency.respond(sampleFile(grant.mimeType, grant.fileName));
  }

  private deny<T>(what: 'type' | 'request'): Observable<T> | null {
    return denyUnless<T>(
      this.access.currentUser(),
      what === 'type' ? 'issuance-type.manage' : 'issuance-request.manage',
    );
  }

  private refuseFields(fields: IssuanceTypeFields, reason: string): Observable<never> | null {
    const problems = issuanceTypeProblems(fields);
    const reasonProblem = catalogueReasonProblem(reason);
    const all = reasonProblem === null ? problems : [...problems, reasonProblem];
    return all.length === 0 ? null : throwError(() => new Error(all.join(' ')));
  }
}

function sameName(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/** A list row: the request without its purpose, history or files, as the API lists it. */
function summaryOf(request: IssuanceRequest): IssuanceRequestSummary {
  return {
    id: request.id,
    referenceNumber: request.referenceNumber,
    status: request.status,
    type: request.type,
    office: request.office,
    resident: request.resident,
    filedAt: request.filedAt,
    statusSince: request.statusSince,
  };
}
