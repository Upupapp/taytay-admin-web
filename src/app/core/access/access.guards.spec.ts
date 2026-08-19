import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '../auth/session-state';
import { SessionStore } from '../auth/session.store';
import { APP_ENVIRONMENT } from '../config/app-environment.token';
import {
  anonymousOnlyGuard,
  authenticatedGuard,
  permissionGuard,
  RETURN_URL_PARAM,
} from './access.guards';
import { DisableWithoutPermissionDirective } from './disable-without-permission.directive';
import {
  ACCESS_CONTEXT,
  asId,
  emptyPage,
  STAFF_REPOSITORY,
  toAuthenticatedUser,
  type AuthenticatedUser,
  type Page,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
  type SignInOutcome,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

const TEST_ENVIRONMENT: AppEnvironment = {
  name: 'local-mock',
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  mockLatencyMs: 0,
  enableDevTools: false,
};

function staffUser(role: StaffRole): StaffUser {
  return {
    id: asId<StaffUserId>('staff-test'),
    name: { first: 'Test', middle: null, last: 'User', suffix: null },
    email: 'test@example.gov.ph',
    role,
    position: 'Tester',
    barangayId: null,
    additionalPermissions: [],
    isActive: true,
    lastSignInAt: null,
    audit: {
      createdAt: '2026-01-01T00:00:00.000Z' as StaffUser['audit']['createdAt'],
      createdBy: null,
      updatedAt: '2026-01-01T00:00:00.000Z' as StaffUser['audit']['updatedAt'],
      updatedBy: null,
    },
  };
}

function repository(user: StaffUser | null): StaffRepository {
  const authenticated = user ? toAuthenticatedUser(user) : null;
  return {
    list: (): Observable<Page<StaffUser>> => of(emptyPage<StaffUser>()),
    getById: (): Observable<StaffUser | null> => of(user),
    currentUser: (): Observable<AuthenticatedUser | null> => of(authenticated),
    signIn: (): Observable<SignInOutcome> => of({ kind: 'authenticated', user: authenticated as AuthenticatedUser }),
    completeMfa: (): Observable<AuthenticatedUser> => of(authenticated as AuthenticatedUser),
    signOut: (): Observable<void> => of(undefined),
  };
}

@Component({ template: 'protected' })
class ProtectedPage {}

@Component({ template: 'public' })
class PublicPage {}

async function routerFor(role: StaffRole | null): Promise<Router> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'sign-in', component: PublicPage, canActivate: [anonymousOnlyGuard] },
        { path: 'dashboard', component: ProtectedPage, canActivate: [authenticatedGuard] },
        {
          path: 'administration/settings',
          component: ProtectedPage,
          canActivate: [authenticatedGuard, permissionGuard('settings.manage')],
        },
        { path: 'forbidden', component: PublicPage },
        { path: '**', component: PublicPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: repository(role ? staffUser(role) : null) },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
  return TestBed.inject(Router);
}

describe('authenticatedGuard', () => {
  it('lets a signed-in user through', async () => {
    const router = await routerFor('mswdo-head');
    await router.navigateByUrl('/dashboard');
    expect(router.url).toBe('/dashboard');
  });

  it('sends an anonymous visitor to sign-in and remembers the destination', async () => {
    const router = await routerFor(null);
    await router.navigateByUrl('/dashboard');
    expect(router.url).toContain('/sign-in');
    expect(router.url).toContain(`${RETURN_URL_PARAM}=%2Fdashboard`);
  });
});

describe('anonymousOnlyGuard', () => {
  it('keeps a signed-in user off the sign-in form', async () => {
    const router = await routerFor('intake-officer');
    await router.navigateByUrl('/sign-in');
    expect(router.url).toBe('/dashboard');
  });

  it('lets an anonymous visitor reach it', async () => {
    const router = await routerFor(null);
    await router.navigateByUrl('/sign-in');
    expect(router.url).toBe('/sign-in');
  });
});

describe('permissionGuard', () => {
  it('admits a role that holds the permission', async () => {
    const router = await routerFor('system-administrator');
    await router.navigateByUrl('/administration/settings');
    expect(router.url).toBe('/administration/settings');
  });

  it('redirects a role that does not', async () => {
    const router = await routerFor('social-worker');
    await router.navigateByUrl('/administration/settings');
    expect(router.url).toBe('/forbidden');
  });

  it('leaks nothing about the refused route in the resulting URL', async () => {
    // A returnUrl here would preserve — and possibly log — a path that can
    // contain a record identifier the user was not allowed to see.
    const router = await routerFor('social-worker');
    await router.navigateByUrl('/administration/settings');

    expect(router.url).toBe('/forbidden');
    expect(router.url).not.toContain(RETURN_URL_PARAM);
    expect(router.url).not.toContain('settings');
  });

  it('sends an anonymous visitor to sign-in rather than to forbidden', async () => {
    // "You must sign in" and "you may not" are different answers, and giving
    // the wrong one strands the user.
    const router = await routerFor(null);
    await router.navigateByUrl('/administration/settings');
    expect(router.url).toContain('/sign-in');
  });
});

/* ── role-aware action utility ────────────────────────────────────────────── */

@Component({
  imports: [DisableWithoutPermissionDirective],
  template: `
    <button
      id="approve"
      appDisableWithoutPermission="request.approve"
      appDisableWithoutPermissionReason="Only the MSWDO head may approve."
    >
      Approve
    </button>
    <button id="view" appDisableWithoutPermission="request.view">Open</button>
  `,
})
class ActionHost {}

describe('DisableWithoutPermissionDirective', () => {
  async function render(role: StaffRole | null) {
    await routerFor(role);
    const fixture = TestBed.createComponent(ActionHost);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('leaves a permitted control enabled', async () => {
    const element = await render('mswdo-head');
    const approve = element.querySelector('#approve');
    expect(approve?.hasAttribute('disabled')).toBe(false);
    expect(approve?.hasAttribute('title')).toBe(false);
  });

  it('disables a control the role may not use, and says why', async () => {
    const element = await render('social-worker');
    const approve = element.querySelector('#approve');
    expect(approve?.hasAttribute('disabled')).toBe(true);
    expect(approve?.getAttribute('aria-disabled')).toBe('true');
    expect(approve?.getAttribute('title')).toBe('Only the MSWDO head may approve.');
  });

  it('keeps the control visible, unlike *appHasPermission', async () => {
    // The point of this directive: the workflow still reads correctly, the
    // step is simply not this user's to take.
    const element = await render('social-worker');
    expect(element.querySelector('#approve')).not.toBeNull();
    expect(element.querySelector('#approve')?.textContent).toContain('Approve');
  });

  it('disables everything for an anonymous user', async () => {
    const element = await render(null);
    expect(element.querySelector('#approve')?.hasAttribute('disabled')).toBe(true);
    expect(element.querySelector('#view')?.hasAttribute('disabled')).toBe(true);
  });
});
