import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';

import {
  canHoldSession,
  formatPersonName,
  isPlausibleEmail,
  isPlausiblePassword,
  paginate,
  SignInError,
  toAuthenticatedUser,
  ACCESS_CONTEXT,
  type AuthenticatedUser,
  type Page,
  type PageRequest,
  type SignInCredentials,
  type StaffFilter,
  type StaffRepository,
  type StaffUser,
  type StaffUserId,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MOCK_STAFF } from './seed/staff.seed';
import { MockLatency } from './mock-latency';
import { matchesSearch, sortItems } from './mock-query';

/**
 * Mock identity provider.
 *
 * **This repository stores no password.** A front end has nothing to verify a
 * password against, so inventing a fixture one would mean committing a
 * credential for no benefit (`CLAUDE.md` §2 rule 5). The mock therefore checks
 * that the email belongs to an active staff account and that the supplied
 * password is well-formed, and treats that as a successful sign-in.
 *
 * What it *does* model faithfully is the security-relevant shape:
 *
 *  - every failure returns the same `invalid-credentials` reason, so the page
 *    cannot be used to discover which municipal addresses exist, or which
 *    accounts have been deactivated;
 *  - there is no `register` method, because staff accounts are provisioned by
 *    an administrator and never self-created (`DL-32`);
 *  - the session starts anonymous. Nothing is signed in until someone signs in.
 */
@Injectable()
export class MockStaffRepository implements StaffRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);
  private signedInId: StaffUserId | null = null;

  list(filter: StaffFilter, page: PageRequest): Observable<Page<StaffUser>> {
    // Re-checked here, not only in the UI: a hidden screen is not protection.
    const denied = denyUnless<Page<StaffUser>>(this.access.currentUser(), 'staff.view');
    if (denied) {
      return denied;
    }

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
    const denied = denyUnless<StaffUser | null>(this.access.currentUser(), 'staff.view');
    if (denied) {
      return denied;
    }
    return this.latency.respond(MOCK_STAFF.find((staff) => staff.id === id) ?? null);
  }

  currentUser(): Observable<AuthenticatedUser | null> {
    const signedInId = this.signedInId;
    if (signedInId === null) {
      return this.latency.respond(null);
    }
    const staff = MOCK_STAFF.find((candidate) => candidate.id === signedInId);

    // **Deactivation takes effect now, not at next sign-in** (`DL-116`).
    // Before TAB 21 this resolved a deactivated account into a fully
    // permissioned identity, so somebody switched off at 10am kept every grant
    // until they happened to close their browser. `signIn` refused them and
    // this did not, which is the worst of both: the office believed the account
    // was off.
    if (staff === undefined || !canHoldSession(staff)) {
      return this.latency.respond(null);
    }
    return this.latency.respond(toAuthenticatedUser(staff));
  }

  signIn(credentials: SignInCredentials): Observable<AuthenticatedUser> {
    const email = credentials.email.trim().toLowerCase();

    // Shape is checked before any lookup, so a malformed submission never
    // reaches the account list and cannot be timed against one.
    if (!isPlausibleEmail(email) || !isPlausiblePassword(credentials.password)) {
      return throwError(() => invalidCredentials());
    }

    const staff = MOCK_STAFF.find((candidate) => candidate.email.toLowerCase() === email);

    // Unknown address and deactivated account produce the identical failure.
    if (!staff || !canHoldSession(staff)) {
      return throwError(() => invalidCredentials());
    }

    this.signedInId = staff.id;
    return this.latency.respond(toAuthenticatedUser(staff));
  }

  signOut(): Observable<void> {
    this.signedInId = null;
    return this.latency.respond(undefined);
  }
}

function invalidCredentials(): SignInError {
  return new SignInError(
    'invalid-credentials',
    'Those sign-in details were not recognised. Check the email address and password, then try again.',
  );
}
