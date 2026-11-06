import { TestBed } from '@angular/core/testing';
import { provideRouter, type Route } from '@angular/router';
import { firstValueFrom, isObservable, of, type Observable } from 'rxjs';

import type { ServedGuard } from '@core/access/served-ports';
import { SessionStore } from '@core/auth/session.store';
import { NAVIGATION } from '@core/navigation/navigation';
import { provideDataAccess } from '@data/data-access.providers.mock';
import {
  UnservedBeneficiaryRepository,
  UnservedDashboardRepository,
  UnservedEventRepository,
  UnservedGovernanceRepository,
  UnservedNewsfeedRepository,
  UnservedReportRepository,
  UnservedSearchRepository,
  UnservedWorkRepository,
  UNSERVED_HTTP_PORTS,
} from '@data/http/unserved-repositories';
import {
  asId,
  DATA_PORT_HOLDINGS,
  emptyPage,
  NOTIFICATION_REPOSITORY,
  STAFF_REPOSITORY,
  toAuthenticatedUser,
  UNSERVED_PORTS,
  type AppNotification,
  type AuthenticatedUser,
  type DataPort,
  type NotificationRepository,
  type Page,
  type SignInOutcome,
  type StaffRepository,
  type StaffUser,
  type StaffUserId,
} from '@domain/index';
import { UnservedPage } from '@features/errors/unserved-page';

import { routes } from './app.routes';
import { AppNav } from './layout/navigation/app-nav';

/*
 * The two adapter sets, held to what `DL-167` promises: a module the bound API cannot serve leaves
 * the menu, its address leads to one page, and that page names it.
 *
 * The http set is read through `UNSERVED_HTTP_PORTS` rather than `provideDataAccess()`: the test
 * build swaps that file for the mock one, exactly as `local-mock` does. That the binding and the
 * list agree is `check:unserved`'s rule 1.
 */

const ADMINISTRATOR: StaffUser = {
  id: asId<StaffUserId>('staff-admin'),
  name: { first: 'Grace', middle: null, last: 'Ocampo', suffix: null },
  email: 'grace@example.gov.ph',
  role: 'system-administrator',
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

const signedInAdministrator: StaffRepository = {
  list: (): Observable<Page<StaffUser>> => of(emptyPage<StaffUser>()),
  getById: (): Observable<StaffUser | null> => of(ADMINISTRATOR),
  currentUser: (): Observable<AuthenticatedUser | null> => of(toAuthenticatedUser(ADMINISTRATOR)),
  signIn: (): Observable<SignInOutcome> =>
    of({ kind: 'authenticated', user: toAuthenticatedUser(ADMINISTRATOR) }),
  completeMfa: (): Observable<AuthenticatedUser> => of(toAuthenticatedUser(ADMINISTRATOR)),
  signOut: (): Observable<void> => of(undefined),
};

const emptyInbox: NotificationRepository = {
  listForCurrentUser: (): Observable<readonly AppNotification[]> => of([]),
  markRead: (): Observable<AppNotification> => {
    throw new Error('not used');
  },
  markAllRead: (): Observable<readonly AppNotification[]> => of([]),
};

/**
 * What the Node API makes of a staff account no office is linked to (`DL-168`): no office-bound key,
 * and the console told why.
 */
const UNASSIGNED_STAFF: AuthenticatedUser = {
  id: asId<StaffUserId>('staff-unassigned'),
  displayName: 'Unassigned staff',
  email: 'unassigned@example.gov.ph',
  role: null,
  roleLabel: 'Staff',
  position: '',
  barangayId: null,
  scope: 'assigned-cases',
  permissions: new Set(),
  awaitingOffice: true,
};

const signedInUnassignedStaff: StaffRepository = {
  ...signedInAdministrator,
  currentUser: (): Observable<AuthenticatedUser | null> => of(UNASSIGNED_STAFF),
};

/** An administrator, so that nothing withheld below is withheld for want of a permission. */
async function signIn(
  unserved: readonly DataPort[] | 'mock-set',
  account: StaffRepository = signedInAdministrator,
): Promise<void> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      ...(unserved === 'mock-set'
        ? [provideDataAccess()]
        : [{ provide: UNSERVED_PORTS, useValue: unserved }]),
      { provide: STAFF_REPOSITORY, useValue: account },
      { provide: NOTIFICATION_REPOSITORY, useValue: emptyInbox },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function menuLinks(): Promise<readonly (string | null)[]> {
  const fixture = TestBed.createComponent(AppNav);
  await fixture.whenStable();
  return Array.from(
    (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.nav__link'),
  ).map((a) => a.getAttribute('href'));
}

const MENU = NAVIGATION.flatMap((section) => section.items);

/**
 * The menu entries the http set withholds: every one whose primary port it does not serve. A
 * secondary panel's port is not in `reads` (`DL-175`), so it withholds nothing.
 */
const WITHHELD = MENU.filter((item) =>
  item.reads.some((port) => UNSERVED_HTTP_PORTS.includes(port)),
);

/**
 * What the http set offers. Derived rather than spelled out, so a port the Node API comes to serve
 * moves its module into the menu without this list being edited to match.
 */
const OFFERED = MENU.filter((item) => !WITHHELD.includes(item)).map((item) => item.route);

describe('the http adapter set', () => {
  const adapters = [
    UnservedBeneficiaryRepository,
          UnservedWorkRepository,
    UnservedReportRepository,
    UnservedSearchRepository,
    UnservedGovernanceRepository,
    UnservedNewsfeedRepository,
    UnservedEventRepository,
    UnservedDashboardRepository,
  ] as const;

  it('declares exactly the ports its unserved adapters stand in for, once each', () => {
    expect(UNSERVED_HTTP_PORTS).toHaveLength(adapters.length);
    expect(new Set(UNSERVED_HTTP_PORTS)).toEqual(new Set(adapters.map((adapter) => adapter.port)));
  });

  it.each(adapters.map((adapter) => [adapter.name, adapter] as const))(
    '%s refuses in the words the unserved page uses for its port',
    async (_name, Adapter) => {
      const instance = new Adapter();
      const prototype: unknown = Object.getPrototypeOf(instance);
      const first =
        prototype !== null && typeof prototype === 'object'
          ? Object.getOwnPropertyNames(prototype).find((name) => name !== 'constructor')
          : undefined;
      const method: unknown = first === undefined ? undefined : Reflect.get(instance, first);
      const result: unknown = typeof method === 'function' ? method.call(instance) : undefined;

      expect(isObservable(result)).toBe(true);
      if (isObservable(result)) {
        const refusal: unknown = await firstValueFrom(result).catch((error: unknown) => error);
        expect(refusal instanceof Error ? refusal.message : '').toContain(
          `does not serve ${DATA_PORT_HOLDINGS[Adapter.port]}.`,
        );
      }
    },
  );

  it('leaves no casework module in the menu, keeps what it serves, and links the page', async () => {
    await signIn(UNSERVED_HTTP_PORTS);
    const links = await menuLinks();

    for (const item of WITHHELD) {
      expect(links, `${item.route} reads a port this API does not serve`).not.toContain(item.route);
    }
    expect(links).toEqual([...OFFERED, '/unavailable']);
    // The resident registry (DL-174), the household register and families (phase 1c), ID verification
    // (DL-167), the office inbox and users and roles (DL-168), the app directory and its home screen
    // and settings (DL-170) and digital IDs, Balita and the audit trail (DL-171) are what the Node API
    // serves, as are assistance requests (DL-177) and cases (DL-179); the rest of the casework is not.
    for (const route of [
      '/residents',
      '/households',
      '/families',
      '/verification',
      '/inbox',
      '/users',
      '/directory',
      '/home-screen',
      '/app-settings',
      '/digital-ids',
      '/balita',
      '/app-audit',
      '/cases',
    ]) {
      expect(links, `${route} is served`).toContain(route);
    }
    // The work queue (phase 6) stays unserved and out of the menu: it is not half-served.
    expect(links).not.toContain('/work');
  });

  it('offers the resident registry when only its secondary panels are unserved (DL-175)', async () => {
    // Named here rather than read from the http list: those ports leave it as the API grows, and
    // this is about what a secondary panel may not do whichever of them is still missing.
    await signIn(['saved-view', 'family', 'field-visit', 'household']);
    const links = await menuLinks();

    expect(links).toContain('/residents');
    expect(links).not.toContain('/families');
    expect(links).not.toContain('/visits');
  });

  it('tells a staff account with no office why it has no inbox, and who can fix it (DL-168)', async () => {
    await signIn(UNSERVED_HTTP_PORTS, signedInUnassignedStaff);

    expect(await menuLinks()).not.toContain('/inbox');

    const fixture = TestBed.createComponent(UnservedPage);
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('is not assigned to an office');
    expect(text).toContain('An administrator assigns staff accounts to offices');
  });

  it('says nothing about an office to an account that is not waiting for one', async () => {
    await signIn(UNSERVED_HTTP_PORTS);
    const fixture = TestBed.createComponent(UnservedPage);
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'not assigned to an office',
    );
  });

  it('names every withheld module, and every port it lacks, on that page', async () => {
    await signIn(UNSERVED_HTTP_PORTS);
    const fixture = TestBed.createComponent(UnservedPage);
    await fixture.whenStable();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    for (const item of WITHHELD) {
      expect(text, item.label).toContain(`${item.label}.`);
    }
    // A served module is offered under "What you can open", never listed as withheld.
    expect(text).not.toContain('ID verification.');
    expect(text).toContain('ID verification —');
    expect(text).not.toContain('Office inbox.');
    expect(text).toContain('Office inbox —');
    expect(text).not.toContain('Users and roles.');
    expect(text).toContain('Users and roles —');
    expect(text).not.toContain('App directory.');
    expect(text).toContain('App directory —');
    expect(text).toContain('Home screen —');
    expect(text).toContain('App settings —');
    expect(text).toContain('Digital IDs —');
    expect(text).toContain('Balita —');
    expect(text).toContain('App audit trail —');
    expect(text).not.toContain('Residents.');
    expect(text).toContain('Residents —');
    for (const port of UNSERVED_HTTP_PORTS) {
      expect(text.toLowerCase(), port).toContain(DATA_PORT_HOLDINGS[port].toLowerCase());
    }
    // It never claims the records are empty: the absence is a server's, not the office's.
    expect(text).not.toMatch(/no records|none found/i);
  });
});

describe('the mock adapter set', () => {
  it('declares nothing unserved', async () => {
    await signIn('mock-set');
    expect(TestBed.inject(UNSERVED_PORTS)).toEqual([]);
  });

  it('keeps every menu entry, and offers no page about withheld ones', async () => {
    await signIn('mock-set');
    const links = await menuLinks();

    expect(links).toEqual(MENU.map((item) => item.route));
  });

  it('says so on the page, rather than listing nothing', async () => {
    await signIn('mock-set');
    const fixture = TestBed.createComponent(UnservedPage);
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Every part of this console is served',
    );
  });
});

describe('every menu entry and its route', () => {
  /** The route a menu link lands on, with the guards of every route above it. */
  function landing(url: string): readonly Route[] | null {
    const segments = url.split('/').filter((segment) => segment !== '');

    function search(
      level: readonly Route[],
      rest: readonly string[],
      trail: readonly Route[],
    ): readonly Route[] | null {
      for (const route of level) {
        const own = (route.path ?? '').split('/').filter((segment) => segment !== '');
        if (!own.every((segment, index) => segment === rest[index])) continue;
        const remaining = rest.slice(own.length);
        const path = [...trail, route];
        if (remaining.length === 0 && route.loadComponent !== undefined) return path;
        const found: readonly Route[] | null = search(route.children ?? [], remaining, path);
        if (found !== null) return found;
      }
      return null;
    }

    return search(routes, segments, []);
  }

  const servedGuardOf = (path: readonly Route[]): readonly DataPort[] =>
    path
      .flatMap((route) => route.canActivate ?? [])
      .filter((guard): guard is ServedGuard => typeof guard === 'function' && 'ports' in guard)
      .flatMap((guard) => guard.ports);

  it.each(MENU.map((item) => [item.route, item] as const))(
    '%s guards exactly the ports its menu entry reads',
    (_route, item) => {
      const path = landing(item.route);

      expect(path, `${item.route} is routed`).not.toBeNull();
      expect([...servedGuardOf(path ?? [])].sort()).toEqual([...item.reads].sort());
    },
  );
});
