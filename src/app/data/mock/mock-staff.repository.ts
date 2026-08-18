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
  type MfaCredentials,
  type SignInOutcome,
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
  /** Who is midway through the second factor. Cleared on success or refusal. */
  private pendingChallenge: StaffUserId | null = null;

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

  signIn(credentials: SignInCredentials): Observable<SignInOutcome> {
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

    /*
     * THE MOCK ISSUES A SECOND-FACTOR CHALLENGE TOO.
     *
     * The API enforces MFA for every staff account, so a mock that signed
     * people straight in would be an offline path that skips a control the real
     * one applies — and the second-factor screen would go unexercised until
     * somebody pointed the console at staging. The challenge is a fixed
     * development handle; the code is checked against MOCK_MFA_CODE below.
     */
    this.pendingChallenge = staff.id;

    return this.latency.respond({
      kind: 'mfa-required' as const,
      challenge: { challenge: MOCK_CHALLENGE, expiresInMinutes: MOCK_CHALLENGE_TTL_MINUTES },
    });
  }

  completeMfa(credentials: MfaCredentials): Observable<AuthenticatedUser> {
    const pending = this.pendingChallenge;

    // A wrong code and a challenge that was never issued fail identically, and
    // both burn the challenge: separating them tells an attacker which half
    // they got right, and leaving it alive turns a six-digit code into
    // something worth guessing at.
    if (pending === null || credentials.challenge !== MOCK_CHALLENGE) {
      this.pendingChallenge = null;
      return throwError(() => secondFactorRefused());
    }

    if (credentials.code.trim() !== MOCK_MFA_CODE) {
      this.pendingChallenge = null;
      return throwError(() => secondFactorRefused());
    }

    const staff = MOCK_STAFF.find((candidate) => candidate.id === pending);

    if (staff === undefined || !canHoldSession(staff)) {
      this.pendingChallenge = null;
      return throwError(() => secondFactorRefused());
    }

    this.pendingChallenge = null;
    this.signedInId = staff.id;

    return this.latency.respond(toAuthenticatedUser(staff));
  }

  signOut(): Observable<void> {
    this.signedInId = null;
    this.pendingChallenge = null;
    return this.latency.respond(undefined);
  }
}

/**
 * The development second factor.
 *
 * Not a credential: it authenticates nobody, guards nothing, and exists only so
 * the offline path exercises the same two screens the real one does.
 *
 * Deliberately **not** surfaced on the sign-in screen. A view importing from
 * `data/mock` is the one thing CLAUDE.md §2.3 forbids outright, and a
 * convenience hint is not worth a hole in the seam — a developer reads it here.
 */
export const MOCK_MFA_CODE = '000000';
const MOCK_CHALLENGE = 'mock-challenge';
const MOCK_CHALLENGE_TTL_MINUTES = 5;

function secondFactorRefused(): SignInError {
  return new SignInError(
    'second-factor-refused',
    'That code was not accepted. Ask for a new one and try again.',
  );
}

function invalidCredentials(): SignInError {
  return new SignInError(
    'invalid-credentials',
    'Those sign-in details were not recognised. Check the email address and password, then try again.',
  );
}
