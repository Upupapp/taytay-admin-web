import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import {
  barangayName,
  formatPersonName,
  paginate,
  type Household,
  type HouseholdId,
  type Page,
  type PageRequest,
  type Resident,
  type ResidentFilter,
  type ResidentId,
  type ResidentRepository,
  type ResidentSortField,
} from '@domain/index';

import { MOCK_HOUSEHOLDS, MOCK_RESIDENTS } from './seed/residents.seed';
import { MockLatency } from './mock-latency';
import { matchesSearch, sortItems } from './mock-query';

@Injectable()
export class MockResidentRepository implements ResidentRepository {
  private readonly latency = inject(MockLatency);

  list(filter: ResidentFilter, page: PageRequest<ResidentSortField>): Observable<Page<Resident>> {
    const filtered = MOCK_RESIDENTS.filter((resident) => {
      if (!filter.includeInactive && !resident.isActive) {
        return false;
      }
      if (filter.barangayId && resident.address.barangayId !== filter.barangayId) {
        return false;
      }
      if (filter.sector && !resident.sectors.includes(filter.sector)) {
        return false;
      }
      return matchesSearch(
        [
          formatPersonName(resident.name),
          resident.address.streetAddress,
          barangayName(resident.address.barangayId),
          resident.contact.mobile,
        ],
        filter.search,
      );
    });

    const sort = page.sort ?? { field: 'name' as const, direction: 'asc' as const };
    const sorted = sortItems(
      filtered,
      (resident) => residentSortKey(resident, sort.field),
      sort.direction,
    );

    return this.latency.respond(paginate(sorted, page));
  }

  getById(id: ResidentId): Observable<Resident | null> {
    return this.latency.respond(MOCK_RESIDENTS.find((resident) => resident.id === id) ?? null);
  }

  getHousehold(id: HouseholdId): Observable<Household | null> {
    return this.latency.respond(MOCK_HOUSEHOLDS.find((household) => household.id === id) ?? null);
  }
}

function residentSortKey(resident: Resident, field: ResidentSortField): string {
  switch (field) {
    case 'name':
      return `${resident.name.last} ${resident.name.first}`;
    case 'barangay':
      return barangayName(resident.address.barangayId);
    case 'birthDate':
      return resident.birthDate;
    case 'updatedAt':
      return resident.audit.updatedAt;
  }
}
