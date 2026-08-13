import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import {
  paginate,
  type AssistanceRequestId,
  type Disbursement,
  type DisbursementFilter,
  type DisbursementId,
  type DisbursementRepository,
  type Page,
  type PageRequest,
} from '@domain/index';

import { MOCK_DISBURSEMENTS } from './seed/disbursements.seed';
import { MockLatency } from './mock-latency';
import { matchesSearch, sortItems } from './mock-query';

@Injectable()
export class MockDisbursementRepository implements DisbursementRepository {
  private readonly latency = inject(MockLatency);

  list(filter: DisbursementFilter, page: PageRequest): Observable<Page<Disbursement>> {
    const filtered = MOCK_DISBURSEMENTS.filter((disbursement) => {
      if (filter.status && disbursement.status !== filter.status) {
        return false;
      }
      if (filter.method && disbursement.method !== filter.method) {
        return false;
      }
      const scheduled = disbursement.scheduledFor;
      if (filter.scheduledFrom && (scheduled === null || scheduled < filter.scheduledFrom)) {
        return false;
      }
      if (filter.scheduledTo && (scheduled === null || scheduled > filter.scheduledTo)) {
        return false;
      }
      return matchesSearch(
        [disbursement.referenceNumber, disbursement.instrumentReference, disbursement.remarks],
        filter.search,
      );
    });

    const sorted = sortItems(
      filtered,
      (disbursement) => disbursement.scheduledFor,
      page.sort?.direction ?? 'desc',
    );
    return this.latency.respond(paginate(sorted, page));
  }

  getById(id: DisbursementId): Observable<Disbursement | null> {
    return this.latency.respond(
      MOCK_DISBURSEMENTS.find((disbursement) => disbursement.id === id) ?? null,
    );
  }

  listForRequest(id: AssistanceRequestId): Observable<readonly Disbursement[]> {
    return this.latency.respond(
      MOCK_DISBURSEMENTS.filter((disbursement) => disbursement.requestId === id),
    );
  }
}
