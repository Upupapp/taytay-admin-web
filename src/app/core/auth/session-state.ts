import { Injectable, signal } from '@angular/core';

import type { AccessContext, AuthenticatedUser } from '@domain/index';

/**
 * Holds *who is signed in*, and nothing else.
 *
 * Split out from `SessionStore` (which knows how to load and change a session)
 * to break a dependency cycle: the data adapters must read the current identity
 * to enforce permission, and `SessionStore` reads the data adapters to resolve
 * it. This class depends on nothing, so both can depend on it.
 *
 * It is the `AccessContext` implementation bound to `ACCESS_CONTEXT`.
 */
@Injectable({ providedIn: 'root' })
export class SessionState implements AccessContext {
  private readonly current = signal<AuthenticatedUser | null>(null);

  readonly user = this.current.asReadonly();

  currentUser(): AuthenticatedUser | null {
    return this.current();
  }

  set(user: AuthenticatedUser | null): void {
    this.current.set(user);
  }
}
