import { throwError, type Observable } from 'rxjs';

import {
  PermissionDeniedError,
  userHasPermission,
  type AuthenticatedUser,
  type Permission,
} from '@domain/index';

/**
 * Turns a failed permission check into a **stream** error rather than a thrown
 * one.
 *
 * A repository method returns an `Observable`, so its failures have to arrive
 * through the stream. Throwing synchronously would escape every `catchError`
 * the callers already have — including the `toViewState` wrapper that turns a
 * failure into an error panel — and surface as an uncaught exception instead.
 *
 *   const denied = denyUnless<Page<Resident>>(user, 'resident.view');
 *   if (denied) return denied;
 */
export function denyUnless<TValue>(
  user: AuthenticatedUser | null,
  permission: Permission,
): Observable<TValue> | null {
  if (userHasPermission(user, permission)) {
    return null;
  }
  return throwError(() => new PermissionDeniedError(permission));
}
