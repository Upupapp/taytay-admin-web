import { inject } from '@angular/core';
import { Router, type CanActivateFn, type UrlTree } from '@angular/router';

import type { Permission, PermissionMatch } from '@domain/index';

import { SessionStore } from '../auth/session.store';
import { PermissionService } from './permission.service';

/**
 * Blocks routes for anonymous visitors. The session is resolved once at
 * bootstrap (see `provideSessionInitializer`), so this guard is synchronous.
 */
export const authenticatedGuard: CanActivateFn = (): boolean | UrlTree => {
  const session = inject(SessionStore);
  const router = inject(Router);
  return session.isAuthenticated() ? true : router.createUrlTree(['/sign-in']);
};

/**
 * Route-level permission gate.
 *
 *   { path: 'disbursements', canActivate: [permissionGuard('disbursement.view')] }
 */
export function permissionGuard(...permissions: readonly Permission[]): CanActivateFn {
  return permissionGuardWith('some', permissions);
}

export function permissionGuardWith(
  match: PermissionMatch,
  permissions: readonly Permission[],
): CanActivateFn {
  return (): boolean | UrlTree => {
    const session = inject(SessionStore);
    const router = inject(Router);
    const permissionService = inject(PermissionService);

    if (!session.isAuthenticated()) {
      return router.createUrlTree(['/sign-in']);
    }

    const granted =
      match === 'every'
        ? permissionService.hasAll(permissions)
        : permissionService.hasAny(permissions);

    return granted ? true : router.createUrlTree(['/forbidden']);
  };
}
