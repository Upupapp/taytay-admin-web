import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';

import {
  ASSISTANCE_STATUS_CATALOG,
  ASSISTANCE_STATUS_TRANSITIONS,
  asIsoDateTime,
  canTransition,
  isTerminalAssistanceStatus,
  paginate,
  type AssistanceRequest,
  type AssistanceRequestFilter,
  type AssistanceRequestId,
  type AssistanceRequestRepository,
  type AssistanceRequestSortField,
  type AssistanceRequestStatus,
  type CaseNote,
  type Page,
  type PageRequest,
  type StatusChange,
} from '@domain/index';

import { MOCK_ASSISTANCE_REQUESTS, MOCK_CASE_NOTES } from './seed/assistance-requests.seed';
import { MockLatency } from './mock-latency';
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
  private requests: AssistanceRequest[] = [...MOCK_ASSISTANCE_REQUESTS];

  list(
    filter: AssistanceRequestFilter,
    page: PageRequest<AssistanceRequestSortField>,
  ): Observable<Page<AssistanceRequest>> {
    const filtered = this.requests.filter((request) => {
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
    return this.latency.respond(this.requests.find((request) => request.id === id) ?? null);
  }

  listNotes(id: AssistanceRequestId): Observable<readonly CaseNote[]> {
    const notes = MOCK_CASE_NOTES.filter((note) => note.requestId === id);
    return this.latency.respond(sortItems(notes, (note) => note.createdAt, 'desc'));
  }

  changeStatus(
    id: AssistanceRequestId,
    to: AssistanceRequestStatus,
    reason: string | null,
  ): Observable<AssistanceRequest> {
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
