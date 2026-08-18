import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, of, tap, type Observable } from 'rxjs';

import {
  SignInError,
  STAFF_REPOSITORY,
  type AuthenticatedUser,
  type MfaChallenge,
  type Permission,
  type SignInCredentials,
} from '@domain/index';

import { SessionState } from './session-state';

export type SessionStatus =
  | 'idle'
  | 'loading'
  | 'authenticated'
  | 'anonymous'
  /** Password accepted; a second factor is outstanding. Not signed in. */
  | 'second-factor-required'
  | 'error';

/**
 * The single source of truth for "who is signed in".
 *
 * Guards, the permission service and the shell all read these signals. Nothing
 * else talks to `STAFF_REPOSITORY` for session concerns.
 *
 * The identity itself lives in `SessionState`; this class owns the transitions.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly repository = inject(STAFF_REPOSITORY);
  private readonly state = inject(SessionState);

  private readonly sessionStatus = signal<SessionStatus>('idle');
  private readonly lastError = signal<string | null>(null);
  private readonly challenge = signal<MfaChallenge | null>(null);
  private readonly retryAfter = signal<number | null>(null);

  readonly user = this.state.user;
  readonly status = this.sessionStatus.asReadonly();
  readonly error = this.lastError.asReadonly();
  /** The outstanding second-factor challenge, if the password was accepted. */
  readonly pendingChallenge = this.challenge.asReadonly();
  /** Seconds to wait after a throttled attempt. Never a guess. */
  readonly retryAfterSeconds = this.retryAfter.asReadonly();

  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isResolved = computed(() => {
    const status = this.sessionStatus();
    return status === 'authenticated' || status === 'anonymous' || status === 'error';
  });
  readonly permissions = computed<ReadonlySet<Permission>>(
    () => this.user()?.permissions ?? new Set<Permission>(),
  );
  readonly displayName = computed(() => this.user()?.displayName ?? 'Not signed in');

  /** Resolves the session once at bootstrap. Safe to call again to refresh. */
  load(): Observable<AuthenticatedUser | null> {
    this.sessionStatus.set('loading');
    this.lastError.set(null);
    return this.repository.currentUser().pipe(
      tap((user) => this.apply(user)),
      catchError((error: unknown) => {
        this.apply(null);
        this.sessionStatus.set('error');
        this.lastError.set(messageOf(error));
        return of(null);
      }),
    );
  }

  /**
   * Credential sign-in.
   *
   * Emits `true` on success and `false` on refusal, with the reason left in
   * `error()`. The message comes from the adapter and is deliberately the same
   * for every kind of failure, so the form cannot be used to discover which
   * staff addresses exist.
   */
  signIn(credentials: SignInCredentials): Observable<boolean> {
    this.beginAttempt();

    return this.repository.signIn(credentials).pipe(
      tap((outcome) => {
        if (outcome.kind === 'mfa-required') {
          // Not signed in. The identity stays null and the status says exactly
          // what is true: the password was accepted and a second factor is
          // outstanding. Anything that treated this as a session would give a
          // guard something to let through.
          this.challenge.set(outcome.challenge);
          this.sessionStatus.set('second-factor-required');
          return;
        }
        this.apply(outcome.user);
      }),
      map((outcome) => outcome.kind === 'authenticated'),
      catchError((error: unknown) => this.refuse(error)),
    );
  }

  /**
   * The second step. Emits `true` once a token exists and the identity is
   * resolved.
   */
  completeSecondFactor(code: string): Observable<boolean> {
    const outstanding = this.challenge();

    if (outstanding === null) {
      this.lastError.set('That sign-in attempt has expired. Please start again.');
      this.sessionStatus.set('anonymous');
      return of(false);
    }

    this.sessionStatus.set('loading');
    this.lastError.set(null);

    return this.repository.completeMfa({ challenge: outstanding.challenge, code }).pipe(
      tap((user) => {
        this.challenge.set(null);
        this.apply(user);
      }),
      map(() => true),
      catchError((error: unknown) => {
        // The challenge is single-use: whether the code was wrong or the
        // challenge had lapsed, it is spent, and offering the code field again
        // would invite somebody to retype against something already dead.
        this.challenge.set(null);
        return this.refuse(error);
      }),
    );
  }

  /** Abandons an outstanding second factor and returns to the password step. */
  cancelSecondFactor(): void {
    this.challenge.set(null);
    this.lastError.set(null);
    this.sessionStatus.set('anonymous');
  }

  /**
   * Sign-out.
   *
   * The adapter revokes server-side and only then drops the token, so a failure
   * here leaves the user signed in — which is the truth, and better than a
   * signed-out screen over a credential that still works.
   */
  signOut(): Observable<void> {
    return this.repository.signOut().pipe(tap(() => this.apply(null)));
  }

  /**
   * Ends the local session because the server refused the token.
   *
   * There is nothing to revoke — the token is already invalid — so this drops
   * the identity without a round-trip that would only 401 again.
   */
  endExpiredSession(): void {
    this.challenge.set(null);
    this.apply(null);
  }

  private beginAttempt(): void {
    this.sessionStatus.set('loading');
    this.lastError.set(null);
    this.retryAfter.set(null);
    this.challenge.set(null);
  }

  private refuse(error: unknown): Observable<boolean> {
    this.apply(null);
    this.sessionStatus.set('anonymous');
    this.lastError.set(messageOf(error));
    this.retryAfter.set(error instanceof SignInError ? error.retryAfterSeconds : null);
    return of(false);
  }

  /** Clears a stale failure so a message does not outlive the attempt. */
  clearError(): void {
    this.lastError.set(null);
  }

  private apply(user: AuthenticatedUser | null): void {
    this.state.set(user);
    this.sessionStatus.set(user ? 'authenticated' : 'anonymous');
  }
}

function messageOf(error: unknown): string {
  if (error instanceof SignInError) {
    return error.message;
  }
  // Never surface a raw transport error to a sign-in form: it can disclose
  // infrastructure detail and means nothing to an intake officer.
  return 'Sign-in is unavailable right now. Please try again shortly.';
}
