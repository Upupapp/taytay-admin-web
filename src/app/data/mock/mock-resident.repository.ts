import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  barangayName,
  canReadRecord,
  isWithinBarangayScope,
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
import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';
import { matchesSearch, sortItems } from './mock-query';

@Injectable()
export class MockResidentRepository implements ResidentRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  list(filter: ResidentFilter, page: PageRequest<ResidentSortField>): Observable<Page<Resident>> {
    // Re-checked in the adapter, not only in the UI. A `barangay-link` account
    // must not be able to reach another barangay's residents by editing a
    // filter, and the list *silently omits* what is out of scope rather than
    // failing — an error would itself disclose that something was withheld.
    const user = this.access.currentUser();
    const denied = denyUnless<Page<Resident>>(user, 'resident.view');
    if (denied) {
      return denied;
    }

    const filtered = MOCK_RESIDENTS.filter((resident) => {
      if (!isWithinBarangayScope(user, resident.address.barangayId)) {
        return false;
      }
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
    const resident = MOCK_RESIDENTS.find((candidate) => candidate.id === id);

    // Out of scope is reported exactly like "does not exist". Returning a
    // distinguishable refusal would confirm that this resident is on file,
    // which is the disclosure the scope rule exists to prevent.
    if (
      !resident ||
      !canReadRecord(this.access.currentUser(), 'resident.view', resident.address.barangayId)
    ) {
      return this.latency.respond(null);
    }
    return this.latency.respond(resident);
  }

  getHousehold(id: HouseholdId): Observable<Household | null> {
    const household = MOCK_HOUSEHOLDS.find((candidate) => candidate.id === id);
    if (
      !household ||
      !canReadRecord(this.access.currentUser(), 'resident.view', household.address.barangayId)
    ) {
      return this.latency.respond(null);
    }
    return this.latency.respond(household);
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
