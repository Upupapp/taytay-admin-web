import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asIsoDateTime,
  awaitsReview,
  mediaFor,
  reviewNoteProblem,
  type CursorPage,
  type CursorRequest,
  type VerificationDecision,
  type VerificationFilter,
  type VerificationImageKind,
  type VerificationRepository,
  type VerificationRequest,
  type VerificationRequestId,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { MOCK_VERIFICATION_REQUESTS, samplePlaceholder } from './seed/verification-requests.seed';

/** The API's own ceiling on a page (`limit` maximum 50), kept so the mock pages like the server. */
const LARGEST_PAGE = 50;

/**
 * In-memory ID verification review (`DL-167`), paging and refusing the way the API does.
 *
 * - Cursor-paged, newest first, with no total — the same shape `HttpVerificationRepository`
 *   answers, so a screen built here meets no surprise against the server.
 * - A decision on a request that is no longer pending is refused, as the API refuses it with
 *   `CONFLICT`: two reviewers on one queue is the ordinary case, not the exotic one.
 * - Every act re-checks `verification.review`. Hiding the screen is not protection (rule 4).
 */
@Injectable()
export class MockVerificationRepository implements VerificationRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  private requests: readonly VerificationRequest[] = MOCK_VERIFICATION_REQUESTS;

  list(
    filter: VerificationFilter,
    page: CursorRequest,
  ): Observable<CursorPage<VerificationRequest>> {
    const denied = denyUnless<CursorPage<VerificationRequest>>(
      this.access.currentUser(),
      'verification.review',
    );
    if (denied) {
      return denied;
    }

    const matching = this.requests
      .filter((request) => filter.status === null || request.status === filter.status)
      .slice()
      .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
    const start = page.cursor ? Number.parseInt(page.cursor, 10) || 0 : 0;
    const limit = Math.min(Math.max(1, page.limit), LARGEST_PAGE);
    const end = start + limit;
    const hasMore = end < matching.length;

    return this.latency.respond({
      items: matching.slice(start, end),
      hasMore,
      nextCursor: hasMore ? String(end) : null,
    });
  }

  approve(id: VerificationRequestId, note: string): Observable<VerificationRequest> {
    return this.decide(id, 'approved', note);
  }

  reject(id: VerificationRequestId, reason: string): Observable<VerificationRequest> {
    return this.decide(id, 'rejected', reason);
  }

  openImage(request: VerificationRequest, kind: VerificationImageKind): Observable<Blob> {
    const denied = denyUnless<Blob>(this.access.currentUser(), 'verification.review');
    if (denied) {
      return denied;
    }
    if (mediaFor(request, kind) === null) {
      return throwError(() => new Error('This request carries no such image.'));
    }

    return this.latency.respond(samplePlaceholder(kind));
  }

  private decide(
    id: VerificationRequestId,
    decision: VerificationDecision,
    note: string,
  ): Observable<VerificationRequest> {
    const denied = denyUnless<VerificationRequest>(
      this.access.currentUser(),
      'verification.review',
    );
    if (denied) {
      return denied;
    }
    if (reviewNoteProblem(note) !== null) {
      return throwError(() => new Error('A decision needs a sentence saying why.'));
    }

    const current = this.requests.find((request) => request.id === id);
    if (current === undefined) {
      return throwError(() => new Error('That verification request was not found.'));
    }
    if (!awaitsReview(current)) {
      return throwError(() => new Error('That verification request is no longer pending.'));
    }

    const decided: VerificationRequest = {
      ...current,
      status: decision,
      reviewedAt: asIsoDateTime(new Date()),
      reviewNote: note.trim(),
    };
    this.requests = this.requests.map((request) => (request.id === id ? decided : request));

    return this.latency.respond(decided);
  }
}
