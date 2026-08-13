import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import {
  paginate,
  type Page,
  type PageRequest,
  type Referral,
  type ReferralFilter,
  type ReferralId,
  type ReferralRepository,
} from '@domain/index';

import { MOCK_REFERRALS } from './seed/referrals.seed';
import { MockLatency } from './mock-latency';
import { matchesSearch, sortItems } from './mock-query';

@Injectable()
export class MockReferralRepository implements ReferralRepository {
  private readonly latency = inject(MockLatency);

  list(filter: ReferralFilter, page: PageRequest): Observable<Page<Referral>> {
    const filtered = MOCK_REFERRALS.filter((referral) => {
      if (filter.status && referral.status !== filter.status) {
        return false;
      }
      if (filter.destination && referral.destination !== filter.destination) {
        return false;
      }
      return matchesSearch(
        [referral.referenceNumber, referral.destinationName, referral.reason],
        filter.search,
      );
    });

    const sorted = sortItems(
      filtered,
      (referral) => referral.referredAt,
      page.sort?.direction ?? 'desc',
    );
    return this.latency.respond(paginate(sorted, page));
  }

  getById(id: ReferralId): Observable<Referral | null> {
    return this.latency.respond(MOCK_REFERRALS.find((referral) => referral.id === id) ?? null);
  }
}
