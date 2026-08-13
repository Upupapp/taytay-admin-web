import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, of, tap, type Observable } from 'rxjs';

import {
  STAFF_REPOSITORY,
  type AuthenticatedUser,
  type Permission,
  type StaffUserId,
} from '@domain/index';

export type SessionStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous' | 'error';

/**
 * The single source of truth for "who is signed in".
 *
 * Guards, the permission service and the shell all read these signals. Nothing
 * else talks to `STAFF_REPOSITORY` for session concerns.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly repository = inject(STAFF_REPOSITORY);

  private readonly currentUser = signal<AuthenticatedUser | null>(null);
  private readonly sessionStatus = signal<SessionStatus>('idle');
  private readonly lastError = signal<string | null>(null);

  readonly user = this.currentUser.asReadonly();
  readonly status = this.sessionStatus.asReadonly();
  readonly error = this.lastError.asReadonly();

  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isResolved = computed(() => {
    const status = this.sessionStatus();
    return status === 'authenticated' || status === 'anonymous' || status === 'error';
  });
  readonly permissions = computed<ReadonlySet<Permission>>(
    () => this.currentUser()?.permissions ?? new Set<Permission>(),
  );
  readonly displayName = computed(() => this.currentUser()?.displayName ?? 'Not signed in');

  /** Resolves the session once at bootstrap. Safe to call again to refresh. */
  load(): Observable<AuthenticatedUser | null> {
    this.sessionStatus.set('loading');
    this.lastError.set(null);
    return this.repository.currentUser().pipe(
      tap((user) => this.apply(user)),
      catchError((error: unknown) => {
        this.currentUser.set(null);
        this.sessionStatus.set('error');
        this.lastError.set(messageOf(error));
        return of(null);
      }),
    );
  }

  signInAs(id: StaffUserId): Observable<AuthenticatedUser | null> {
    this.sessionStatus.set('loading');
    this.lastError.set(null);
    return this.repository.signInAs(id).pipe(
      tap((user) => this.apply(user)),
      catchError((error: unknown) => {
        this.sessionStatus.set('error');
        this.lastError.set(messageOf(error));
        return of(null);
      }),
    );
  }

  signOut(): Observable<void> {
    return this.repository.signOut().pipe(tap(() => this.apply(null)));
  }

  private apply(user: AuthenticatedUser | null): void {
    this.currentUser.set(user);
    this.sessionStatus.set(user ? 'authenticated' : 'anonymous');
  }
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'The session could not be resolved.';
}
