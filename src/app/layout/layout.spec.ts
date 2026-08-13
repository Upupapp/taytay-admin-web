import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { ViewportService, FakeViewportService } from '@core/layout/viewport.service';
import { SessionStore } from '@core/auth/session.store';
import { NAVIGATION } from '@core/navigation/navigation';
import {
  asId,
  emptyPage,
  NOTIFICATION_REPOSITORY,
  STAFF_REPOSITORY,
  toAuthenticatedUser,
  type AppNotification,
  type AuthenticatedUser,
  type NotificationRepository,
  type Page,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
} from '@domain/index';

import { AppNav } from './navigation/app-nav';
import { AppTopbar } from './topbar/app-topbar';
import { buildCrumbs, AppBreadcrumb } from './breadcrumb/app-breadcrumb';
import { GlobalSearchTrigger } from './search/global-search-trigger';
import { LAYOUT_COPY } from './layout.copy';
import { Shell } from './shell/shell';

/* ── fixtures ─────────────────────────────────────────────────────────────── */

function staffUser(role: StaffRole): StaffUser {
  return {
    id: asId<StaffUserId>('staff-test'),
    name: { first: 'Grace', middle: null, last: 'Ocampo', suffix: null },
    email: 'grace@example.gov.ph',
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

function staffRepository(user: StaffUser | null): StaffRepository {
  const authenticated = user ? toAuthenticatedUser(user) : null;
  return {
    list: (): Observable<Page<StaffUser>> => of(emptyPage<StaffUser>()),
    getById: (): Observable<StaffUser | null> => of(user),
    currentUser: (): Observable<AuthenticatedUser | null> => of(authenticated),
    signInAs: (): Observable<AuthenticatedUser> => of(authenticated as AuthenticatedUser),
    signOut: (): Observable<void> => of(undefined),
  };
}

const notificationRepository: NotificationRepository = {
  listForCurrentUser: (): Observable<readonly AppNotification[]> => of([]),
  create: (): Observable<AppNotification> => {
    throw new Error('not used');
  },
  markRead: (): Observable<AppNotification> => {
    throw new Error('not used');
  },
  markAllRead: (): Observable<readonly AppNotification[]> => of([]),
};

@Component({ template: 'stub' })
class StubPage {}

async function configure(role: StaffRole | null = 'system-administrator') {
  TestBed.resetTestingModule();
  const viewport = new FakeViewportService();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'dashboard', component: StubPage },
        { path: 'residents', component: StubPage },
        { path: '**', component: StubPage },
      ]),
      { provide: STAFF_REPOSITORY, useValue: staffRepository(role ? staffUser(role) : null) },
      { provide: NOTIFICATION_REPOSITORY, useValue: notificationRepository },
      { provide: ViewportService, useValue: viewport },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
  return viewport;
}

/* ── navigation reachability ──────────────────────────────────────────────── */

describe('navigation reachability', () => {
  it('exposes every permitted module as a direct link', async () => {
    await configure('system-administrator');
    const fixture = TestBed.createComponent(AppNav);
    await fixture.whenStable();

    const hrefs = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.nav__link'),
    ).map((a) => a.getAttribute('href'));

    const expected = NAVIGATION.flatMap((section) => section.items.map((item) => item.route));
    expect(expected.length).toBeGreaterThan(0);
    for (const route of expected) {
      expect(hrefs, `${route} must be a direct navigation link`).toContain(route);
    }
  });

  it('reaches every module in at most two navigation actions', async () => {
    // The navigation model is flat: one action on a wide viewport (click the
    // link), two on a compact one (open the drawer, then click). Nothing is
    // nested behind a sub-menu, so no module can exceed two.
    await configure('system-administrator');
    const fixture = TestBed.createComponent(AppNav);
    await fixture.whenStable();
    const links = (fixture.nativeElement as HTMLElement).querySelectorAll('a.nav__link');

    const modules = NAVIGATION.flatMap((s) => s.items);
    expect(links.length).toBe(modules.length);
    // No nested lists inside a nav item = no third level to traverse.
    expect(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.nav__list .nav__list'),
    ).toHaveLength(0);
  });

  it('hides modules the role may not open, matching the route guards', async () => {
    await configure('disbursement-officer');
    const fixture = TestBed.createComponent(AppNav);
    await fixture.whenStable();
    const hrefs = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.nav__link'),
    ).map((a) => a.getAttribute('href'));

    expect(hrefs).toContain('/disbursements');
    expect(hrefs).not.toContain('/administration/settings');
  });

  it('marks the active route for assistive technology', async () => {
    await configure('system-administrator');
    await TestBed.inject(Router).navigateByUrl('/residents');
    const fixture = TestBed.createComponent(AppNav);
    await fixture.whenStable();

    const current = (fixture.nativeElement as HTMLElement).querySelector(
      'a.nav__link[aria-current="page"]',
    );
    expect(current?.getAttribute('href')).toBe('/residents');
  });
});

/* ── breadcrumb ───────────────────────────────────────────────────────────── */

describe('buildCrumbs', () => {
  it('collapses the dashboard to a single crumb', () => {
    expect(buildCrumbs('/dashboard').map((c) => c.label)).toEqual([LAYOUT_COPY.breadcrumbHome]);
  });

  it('builds home, section and page', () => {
    expect(buildCrumbs('/residents').map((c) => c.label)).toEqual([
      LAYOUT_COPY.breadcrumbHome,
      'Casework',
      'Residents',
    ]);
  });

  it('prefers the longest matching route so nested modules resolve correctly', () => {
    const crumbs = buildCrumbs('/administration/audit');
    expect(crumbs[crumbs.length - 1]?.label).toBe('Audit trail');
  });

  it('keeps matching when a detail segment is appended', () => {
    const crumbs = buildCrumbs('/residents/res-0001');
    expect(crumbs[crumbs.length - 1]?.label).toBe('Residents');
  });

  it('ignores query strings and fragments', () => {
    expect(buildCrumbs('/residents?page=2#top').map((c) => c.label)).toContain('Residents');
  });

  it('falls back to home for an unknown route', () => {
    expect(buildCrumbs('/nowhere').map((c) => c.label)).toEqual([LAYOUT_COPY.breadcrumbHome]);
  });

  it('never makes the section grouping a link', () => {
    const section = buildCrumbs('/residents')[1];
    expect(section?.route).toBeNull();
  });

  it('renders nothing when there is only one crumb', async () => {
    await configure();
    await TestBed.inject(Router).navigateByUrl('/dashboard');
    const fixture = TestBed.createComponent(AppBreadcrumb);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('nav')).toBeNull();
  });
});

/* ── global search trigger ────────────────────────────────────────────────── */

describe('GlobalSearchTrigger', () => {
  async function render() {
    await configure();
    const fixture = TestBed.createComponent(GlobalSearchTrigger);
    const emitted: number[] = [];
    fixture.componentInstance.activated.subscribe(() => emitted.push(1));
    await fixture.whenStable();
    return { fixture, emitted, element: fixture.nativeElement as HTMLElement };
  }

  it('is a real button with an accessible name and a published shortcut', async () => {
    const { element } = await render();
    const button = element.querySelector('button');
    expect(button?.getAttribute('aria-label')).toBe(LAYOUT_COPY.searchLabel);
    expect(button?.getAttribute('aria-keyshortcuts')).toContain('Control+K');
  });

  it('activates on click', async () => {
    const { fixture, emitted, element } = await render();
    element.querySelector('button')?.click();
    await fixture.whenStable();
    expect(emitted).toHaveLength(1);
  });

  it('activates on Ctrl+K and Cmd+K, and suppresses the browser default', async () => {
    const { fixture, emitted } = await render();

    for (const init of [{ ctrlKey: true }, { metaKey: true }]) {
      const event = new KeyboardEvent('keydown', { key: 'k', cancelable: true, ...init });
      document.dispatchEvent(event);
      await fixture.whenStable();
      expect(event.defaultPrevented).toBe(true);
    }
    expect(emitted).toHaveLength(2);
  });

  it('ignores a bare k, so typing in a field is unaffected', async () => {
    const { fixture, emitted } = await render();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', cancelable: true }));
    await fixture.whenStable();
    expect(emitted).toHaveLength(0);
  });
});

/* ── topbar ───────────────────────────────────────────────────────────────── */

describe('AppTopbar', () => {
  it('gives the nav toggle an expanded state and a target-sized hit area', async () => {
    await configure();
    const fixture = TestBed.createComponent(AppTopbar);
    await fixture.whenStable();
    const toggle = (fixture.nativeElement as HTMLElement).querySelector('.topbar__nav-toggle');

    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle?.getAttribute('aria-controls')).toBe('app-sidebar');
    // WCAG 2.5.8 is met through the shared .icon-button contract.
    expect(toggle?.classList.contains('icon-button')).toBe(true);
  });

  it('carries the unread count in the accessible name, not only in the badge', async () => {
    await configure();
    const fixture = TestBed.createComponent(AppTopbar);
    await fixture.whenStable();
    const inbox = (fixture.nativeElement as HTMLElement).querySelector('.topbar__inbox');
    expect(inbox?.getAttribute('aria-label')).toBe(LAYOUT_COPY.notificationsLabel);
  });
});

/* ── shell ────────────────────────────────────────────────────────────────── */

describe('Shell', () => {
  async function render(compact = false) {
    const viewport = await configure();
    viewport.setCompact(compact);
    const fixture = TestBed.createComponent(Shell);
    await fixture.whenStable();
    return { fixture, viewport, element: fixture.nativeElement as HTMLElement };
  }

  it('renders the landmarks a keyboard user relies on', async () => {
    const { element } = await render();
    expect(element.querySelector('a.skip-link')?.getAttribute('href')).toBe('#main-content');
    expect(element.querySelector('main#main-content')).not.toBeNull();
    expect(element.querySelector('#app-sidebar')).not.toBeNull();
    expect(element.querySelector('app-nav')).not.toBeNull();
  });

  it('keeps identity and sign-out inside the sidebar so they survive a narrow viewport', async () => {
    const { element } = await render(true);
    const account = element.querySelector('#app-sidebar .shell__account');
    expect(account).not.toBeNull();
    expect(account?.querySelector('.shell__sign-out')?.textContent).toContain(LAYOUT_COPY.signOut);
  });

  it('is a plain landmark on a wide viewport, not a dialog', async () => {
    const { element } = await render(false);
    const sidebar = element.querySelector('#app-sidebar');
    expect(sidebar?.getAttribute('role')).toBeNull();
    expect(sidebar?.getAttribute('aria-modal')).toBeNull();
    // Always reachable, so never inert.
    expect(sidebar?.hasAttribute('inert')).toBe(false);
  });

  it('becomes a modal dialog when compact and open', async () => {
    const { fixture, element } = await render(true);
    // Closed: hidden from the tab order rather than left as a focus trap.
    expect(element.querySelector('#app-sidebar')?.hasAttribute('inert')).toBe(true);

    element.querySelector<HTMLElement>('.topbar__nav-toggle')?.click();
    await fixture.whenStable();

    const sidebar = element.querySelector('#app-sidebar');
    expect(sidebar?.getAttribute('role')).toBe('dialog');
    expect(sidebar?.getAttribute('aria-modal')).toBe('true');
    expect(sidebar?.hasAttribute('inert')).toBe(false);
    expect(element.querySelector('.topbar__nav-toggle')?.getAttribute('aria-expanded')).toBe(
      'true',
    );
  });

  it('closes the compact drawer on Escape and returns focus to the toggle', async () => {
    const { fixture, element } = await render(true);
    element.querySelector<HTMLElement>('.topbar__nav-toggle')?.click();
    await fixture.whenStable();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();

    expect(element.querySelector('#app-sidebar')?.hasAttribute('inert')).toBe(true);
    expect(document.activeElement).toBe(element.querySelector('.topbar__nav-toggle'));
  });

  it('does not let Escape remove the only navigation on a wide viewport', async () => {
    const { fixture, element } = await render(false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(element.querySelector('#app-sidebar')).not.toBeNull();
    expect(element.querySelector('#app-sidebar')?.hasAttribute('inert')).toBe(false);
  });

  it('shows a scrim only while the compact drawer is open', async () => {
    const { fixture, element } = await render(true);
    expect(element.querySelector('.shell__scrim')).toBeNull();

    element.querySelector<HTMLElement>('.topbar__nav-toggle')?.click();
    await fixture.whenStable();
    expect(element.querySelector('.shell__scrim')).not.toBeNull();

    element.querySelector<HTMLElement>('.shell__scrim')?.click();
    await fixture.whenStable();
    expect(element.querySelector('.shell__scrim')).toBeNull();
  });

  it('closes the drawer after navigating, so the destination is not hidden behind it', async () => {
    const { fixture, element } = await render(true);
    element.querySelector<HTMLElement>('.topbar__nav-toggle')?.click();
    await fixture.whenStable();
    expect(element.querySelector('.shell__scrim')).not.toBeNull();

    await TestBed.inject(Router).navigateByUrl('/residents');
    await fixture.whenStable();

    expect(element.querySelector('.shell__scrim')).toBeNull();
  });

  it('collapses the drawer state when the viewport widens again', async () => {
    const { fixture, viewport, element } = await render(true);
    element.querySelector<HTMLElement>('.topbar__nav-toggle')?.click();
    await fixture.whenStable();

    viewport.setCompact(false);
    await fixture.whenStable();

    expect(element.querySelector('.shell__scrim')).toBeNull();
    expect(element.querySelector('#app-sidebar')?.getAttribute('aria-modal')).toBeNull();
  });

  it('answers the search trigger honestly instead of dead-clicking', async () => {
    const { fixture, element } = await render();
    element.querySelector<HTMLElement>('.search-trigger')?.click();
    await fixture.whenStable();
    expect(element.textContent).toContain(LAYOUT_COPY.searchUnavailableTitle);
  });
});
