import { TestBed } from '@angular/core/testing';
import { of, throwError, type Observable } from 'rxjs';

import {
  emptyPage,
  SignInError,
  STAFF_REPOSITORY,
  toAuthenticatedUser,
  type AuthenticatedUser,
  type MfaCredentials,
  type Page,
  type SignInCredentials,
  type SignInOutcome,
  type StaffRepository,
  type StaffUser,
  type StaffUserId,
} from '@domain/index';

import { SessionStore } from './session.store';

const STAFF = {
  id: 'staff-1' as StaffUserId,
  name: { first: 'Ana', last: 'Reyes' },
  email: 'ana.reyes@taytay.gov.ph',
  role: 'social-worker',
  position: 'Social Welfare Officer II',
  barangayId: null,
  additionalPermissions: [],
  isActive: true,
  lastSignInAt: null,
  audit: { createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z' },
} as unknown as StaffUser;

const USER: AuthenticatedUser = toAuthenticatedUser(STAFF);

function repository(overrides: Partial<StaffRepository> = {}): StaffRepository {
  return {
    list: (): Observable<Page<StaffUser>> => of(emptyPage<StaffUser>()),
    getById: (): Observable<StaffUser | null> => of(STAFF),
    currentUser: (): Observable<AuthenticatedUser | null> => of(null),
    signIn: (): Observable<SignInOutcome> => of({ kind: 'authenticated', user: USER }),
    completeMfa: (): Observable<AuthenticatedUser> => of(USER),
    signOut: (): Observable<void> => of(undefined),
    ...overrides,
  };
}

function storeWith(repo: StaffRepository): SessionStore {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: STAFF_REPOSITORY, useValue: repo }] });
  return TestBed.inject(SessionStore);
}

/**
 * Not a credential: the mock verifies no password and none is stored anywhere in
 * this repository (CLAUDE.md §2.5). It only has to be long enough to pass the
 * shape check the form applies before any lookup.
 */
const ANY_PASSWORD = 'a-password-of-sufficient-length';

const CREDENTIALS: SignInCredentials = {
  email: 'ana.reyes@taytay.gov.ph',
  password: ANY_PASSWORD,
};

describe('SessionStore — the second factor', () => {
  it('does not treat an outstanding challenge as a session', () => {
    // The most important assertion here. If `mfa-required` set a user, every
    // guard in the application would let that half-authenticated caller
    // through, and the second factor would be decorative.
    const store = storeWith(
      repository({
        signIn: (): Observable<SignInOutcome> =>
          of({ kind: 'mfa-required', challenge: { challenge: 'c-1', expiresInMinutes: 5 } }),
      }),
    );

    let signedIn: boolean | undefined;
    store.signIn(CREDENTIALS).subscribe((result) => (signedIn = result));

    expect(signedIn).toBe(false);
    expect(store.isAuthenticated()).toBe(false);
    expect(store.user()).toBeNull();
    expect(store.status()).toBe('second-factor-required');
    expect(store.pendingChallenge()?.expiresInMinutes).toBe(5);
  });

  it('signs in once the second factor is accepted', () => {
    const store = storeWith(
      repository({
        signIn: (): Observable<SignInOutcome> =>
          of({ kind: 'mfa-required', challenge: { challenge: 'c-1', expiresInMinutes: 5 } }),
      }),
    );

    store.signIn(CREDENTIALS).subscribe();

    let signedIn: boolean | undefined;
    store.completeSecondFactor('000000').subscribe((result) => (signedIn = result));

    expect(signedIn).toBe(true);
    expect(store.isAuthenticated()).toBe(true);
    expect(store.pendingChallenge()).toBeNull();
  });

  it('passes the server-issued challenge back, not anything the user typed', () => {
    let seen: MfaCredentials | null = null;
    const store = storeWith(
      repository({
        signIn: (): Observable<SignInOutcome> =>
          of({ kind: 'mfa-required', challenge: { challenge: 'c-42', expiresInMinutes: 5 } }),
        completeMfa: (credentials: MfaCredentials): Observable<AuthenticatedUser> => {
          seen = credentials;
          return of(USER);
        },
      }),
    );

    store.signIn(CREDENTIALS).subscribe();
    store.completeSecondFactor('123456').subscribe();

    expect(seen).toEqual({ challenge: 'c-42', code: '123456' });
  });

  it('burns the challenge when the code is refused', () => {
    // Single use. Leaving it alive would let somebody retype against a
    // challenge the server has already spent, and turn a six-digit code into
    // something worth guessing at.
    const store = storeWith(
      repository({
        signIn: (): Observable<SignInOutcome> =>
          of({ kind: 'mfa-required', challenge: { challenge: 'c-1', expiresInMinutes: 5 } }),
        completeMfa: (): Observable<AuthenticatedUser> =>
          throwError(() => new SignInError('second-factor-refused', 'That code was not accepted.')),
      }),
    );

    store.signIn(CREDENTIALS).subscribe();

    let signedIn: boolean | undefined;
    store.completeSecondFactor('999999').subscribe((result) => (signedIn = result));

    expect(signedIn).toBe(false);
    expect(store.pendingChallenge()).toBeNull();
    expect(store.isAuthenticated()).toBe(false);
    expect(store.error()).toBe('That code was not accepted.');
  });

  it('refuses a code when no challenge is outstanding', () => {
    const store = storeWith(repository());

    let signedIn: boolean | undefined;
    store.completeSecondFactor('000000').subscribe((result) => (signedIn = result));

    expect(signedIn).toBe(false);
    expect(store.isAuthenticated()).toBe(false);
  });

  it('returns to the password step when the user starts again', () => {
    const store = storeWith(
      repository({
        signIn: (): Observable<SignInOutcome> =>
          of({ kind: 'mfa-required', challenge: { challenge: 'c-1', expiresInMinutes: 5 } }),
      }),
    );

    store.signIn(CREDENTIALS).subscribe();
    store.cancelSecondFactor();

    expect(store.status()).toBe('anonymous');
    expect(store.pendingChallenge()).toBeNull();
  });
});

describe('SessionStore — refusals', () => {
  it('reports how long to wait when throttled, and nothing about the account', () => {
    const store = storeWith(
      repository({
        signIn: (): Observable<SignInOutcome> =>
          throwError(() => new SignInError('throttled', 'Too many sign-in attempts.', 45)),
      }),
    );

    store.signIn(CREDENTIALS).subscribe();

    expect(store.retryAfterSeconds()).toBe(45);
    expect(store.error()).toBe('Too many sign-in attempts.');
    expect(store.isAuthenticated()).toBe(false);
  });

  it('says nothing specific about a rejected credential', () => {
    // One message for a wrong password, an unknown address and a deactivated
    // account. Any difference turns this form into a directory of which
    // municipal staff addresses exist.
    const store = storeWith(
      repository({
        signIn: (): Observable<SignInOutcome> =>
          throwError(() => new SignInError('invalid-credentials', 'Those sign-in details were not recognised.')),
      }),
    );

    store.signIn(CREDENTIALS).subscribe();

    expect(store.error()).toBe('Those sign-in details were not recognised.');
    expect(store.retryAfterSeconds()).toBeNull();
  });

  it('never leaks a transport error to the sign-in form', () => {
    const store = storeWith(
      repository({ signIn: (): Observable<SignInOutcome> => throwError(() => new Error('ECONNREFUSED 10.0.0.4:5432')) }),
    );

    store.signIn(CREDENTIALS).subscribe();

    expect(store.error()).not.toContain('ECONNREFUSED');
    expect(store.error()).toContain('unavailable');
  });
});

describe('SessionStore — an expired session', () => {
  it('drops the identity without asking the server to revoke a dead token', () => {
    let revocations = 0;
    const store = storeWith(
      repository({
        signOut: (): Observable<void> => {
          revocations += 1;
          return of(undefined);
        },
      }),
    );

    store.signIn(CREDENTIALS).subscribe();
    expect(store.isAuthenticated()).toBe(true);

    store.endExpiredSession();

    expect(store.isAuthenticated()).toBe(false);
    // The token was already refused; calling DELETE with it would 401 again.
    expect(revocations).toBe(0);
  });

  it('signs out through the server when the session is still valid', () => {
    let revocations = 0;
    const store = storeWith(
      repository({
        signOut: (): Observable<void> => {
          revocations += 1;
          return of(undefined);
        },
      }),
    );

    store.signIn(CREDENTIALS).subscribe();
    store.signOut().subscribe();

    expect(revocations).toBe(1);
    expect(store.isAuthenticated()).toBe(false);
  });
});
