import { inject } from '@angular/core';
import {
  Router,
  type ActivatedRouteSnapshot,
  type CanActivateFn,
  type RouterStateSnapshot,
  type UrlTree,
} from '@angular/router';

import type { Permission, PermissionMatch } from '@domain/index';

import { SessionStore } from '../auth/session.store';
import { PermissionService } from './permission.service';

/** Query parameter carrying where the user was heading before sign-in. */
export const RETURN_URL_PARAM = 'returnUrl';

export const SIGN_IN_ROUTE = '/sign-in';
export const FORBIDDEN_ROUTE = '/forbidden';

/**
 * Blocks routes for anonymous visitors and remembers where they were going.
 *
 * The session is resolved once at bootstrap (see `provideCore`), so this guard
 * is synchronous.
 */
export const authenticatedGuard: CanActivateFn = (
  _route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot,
): boolean | UrlTree => {
  const session = inject(SessionStore);
  const router = inject(Router);

  if (session.isAuthenticated()) {
    return true;
  }
  return router.createUrlTree([SIGN_IN_ROUTE], {
    queryParams: { [RETURN_URL_PARAM]: state.url },
  });
};

/**
 * Keeps a signed-in user off the sign-in screen.
 *
 * Without it, a stale bookmark drops an authenticated officer onto a form that
 * asks them to prove who they already are.
 */
export const anonymousOnlyGuard: CanActivateFn = (): boolean | UrlTree => {
  const session = inject(SessionStore);
  const router = inject(Router);
  return session.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true;
};

/**
 * Route-level permission gate.
 *
 *   { path: 'releases', canActivate: [permissionGuard('release.view')] }
 *
 * A denial redirects to `/forbidden`, which is a fixed page carrying **no**
 * detail about the route that was refused — see `DL-31`.
 */
export function permissionGuard(...permissions: readonly Permission[]): CanActivateFn {
  return permissionGuardWith('some', permissions);
}

export function permissionGuardWith(
  match: PermissionMatch,
  permissions: readonly Permission[],
): CanActivateFn {
  return (_route: ActivatedRouteSnapshot, state: RouterStateSnapshot): boolean | UrlTree => {
    const session = inject(SessionStore);
    const router = inject(Router);
    const permissionService = inject(PermissionService);

    if (!session.isAuthenticated()) {
      return router.createUrlTree([SIGN_IN_ROUTE], {
        queryParams: { [RETURN_URL_PARAM]: state.url },
      });
    }

    const granted =
      match === 'every'
        ? permissionService.hasAll(permissions)
        : permissionService.hasAny(permissions);

    // Deliberately no returnUrl and no route detail on the forbidden redirect.
    // Echoing the refused path back into the URL would preserve, and possibly
    // log, a record identifier the user was not allowed to see.
    return granted ? true : router.createUrlTree([FORBIDDEN_ROUTE]);
  };
}

/**
 * Sanitises a `returnUrl` before navigating to it.
 *
 * Only same-origin, absolute-path URLs are honoured. An attacker-supplied
 * `returnUrl=https://elsewhere.example` would otherwise turn our sign-in page
 * into an open redirect.
 */
export function safeReturnUrl(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return null;
  }
  if (trimmed.startsWith(SIGN_IN_ROUTE)) {
    return null;
  }
  return trimmed;
}
