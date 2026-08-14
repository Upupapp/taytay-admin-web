import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, map, of, tap, type Observable } from 'rxjs';

import {
  SignInError,
  STAFF_REPOSITORY,
  type AuthenticatedUser,
  type Permission,
  type SignInCredentials,
} from '@domain/index';

import { SessionState } from './session-state';

export type SessionStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous' | 'error';

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

  readonly user = this.state.user;
  readonly status = this.sessionStatus.asReadonly();
  readonly error = this.lastError.asReadonly();

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
    this.sessionStatus.set('loading');
    this.lastError.set(null);
    return this.repository.signIn(credentials).pipe(
      tap((user) => this.apply(user)),
      map(() => true),
      catchError((error: unknown) => {
        this.apply(null);
        this.sessionStatus.set('anonymous');
        this.lastError.set(messageOf(error));
        return of(false);
      }),
    );
  }

  signOut(): Observable<void> {
    return this.repository.signOut().pipe(tap(() => this.apply(null)));
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
