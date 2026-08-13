import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';

import {
  formatPersonName,
  paginate,
  toAuthenticatedUser,
  type AuthenticatedUser,
  type Page,
  type PageRequest,
  type StaffFilter,
  type StaffRepository,
  type StaffUser,
  type StaffUserId,
} from '@domain/index';

import { DEFAULT_MOCK_USER_ID, MOCK_STAFF } from './seed/staff.seed';
import { MockLatency } from './mock-latency';
import { matchesSearch, sortItems } from './mock-query';

/**
 * Mock identity provider. It starts an authenticated session automatically so
 * the shell is usable before the real sign-in flow exists, and `signInAs` lets
 * a developer switch roles to exercise permission-gated UI.
 */
@Injectable()
export class MockStaffRepository implements StaffRepository {
  private readonly latency = inject(MockLatency);
  private signedInId: StaffUserId | null = DEFAULT_MOCK_USER_ID;

  list(filter: StaffFilter, page: PageRequest): Observable<Page<StaffUser>> {
    const filtered = MOCK_STAFF.filter((staff) => {
      if (!filter.includeInactive && !staff.isActive) {
        return false;
      }
      if (filter.role && staff.role !== filter.role) {
        return false;
      }
      return matchesSearch(
        [formatPersonName(staff.name), staff.email, staff.position],
        filter.search,
      );
    });

    const sorted = sortItems(
      filtered,
      (staff) => `${staff.name.last} ${staff.name.first}`,
      page.sort?.direction ?? 'asc',
    );
    return this.latency.respond(paginate(sorted, page));
  }

  getById(id: StaffUserId): Observable<StaffUser | null> {
    return this.latency.respond(MOCK_STAFF.find((staff) => staff.id === id) ?? null);
  }

  currentUser(): Observable<AuthenticatedUser | null> {
    const signedInId = this.signedInId;
    if (signedInId === null) {
      return this.latency.respond(null);
    }
    const staff = MOCK_STAFF.find((candidate) => candidate.id === signedInId);
    return this.latency.respond(staff ? toAuthenticatedUser(staff) : null);
  }

  signInAs(id: StaffUserId): Observable<AuthenticatedUser> {
    const staff = MOCK_STAFF.find((candidate) => candidate.id === id);
    if (!staff) {
      return throwError(() => new Error(`No staff account exists for ${id}.`));
    }
    if (!staff.isActive) {
      return throwError(() => new Error('That account is deactivated.'));
    }
    this.signedInId = staff.id;
    return this.latency.respond(toAuthenticatedUser(staff));
  }

  signOut(): Observable<void> {
    this.signedInId = null;
    return this.latency.respond(undefined);
  }
}
