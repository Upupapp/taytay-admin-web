import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  Component,
  Injectable,
  type EnvironmentProviders,
  type WritableSignal,
  type Provider,
  type Type,
} from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, map, of, throwError, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { httpErrorInterceptor } from '@core/http/api.interceptors';
import { NotificationStore } from '@core/notifications/notification.store';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import { MockResidentRepository } from '@data/mock/mock-resident.repository';
import { MockFamilyRepository } from '@data/mock/mock-family.repository';
import { MockFieldVisitRepository } from '@data/mock/mock-field-visit.repository';
import { MockSavedViewRepository } from '@data/mock/mock-saved-view.repository';
import OFFICE_RELATIONSHIP_HISTORY from '@data/http/fixtures/office-relationship-history.json';
import OFFICE_RESIDENT_FAMILIES from '@data/http/fixtures/office-resident-families.json';
import { HttpFamilyRepository, HttpResidentRepository } from '@data/http/http-repositories';
import {
  ACCESS_CONTEXT,
  asId,
  ASSISTANCE_HISTORY_NOT_YOURS,
  emptyPage,
  notConnectedSentence,
  NOTIFICATION_REPOSITORY,
  RESIDENT_REPOSITORY,
  SAVED_VIEW_REPOSITORY,
  STAFF_REPOSITORY,
  toAuthenticatedUser,
  UNSERVED_PORTS,
  type AuthenticatedUser,
  type BarangayId,
  type DataPort,
  type Page,
  type ResidentId,
  type ResidentProfile,
  type Resident,
  type ResidentRepository,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
  type SignInOutcome,
  FAMILY_REPOSITORY,
  FIELD_VISIT_REPOSITORY,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { ResidentDetailPage } from './resident-detail-page';
import { ResidentFormPage } from './resident-form-page';
import { ResidentListPage } from './resident-list-page';
import { readResidentFilter, readResidentQuery, residentFilterParams } from './resident-query';
import { RESIDENTS_COPY } from './residents.copy';

const TEST_ENVIRONMENT: AppEnvironment = {
  name: 'local-mock',
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  firebaseWebApiKey: null,
  mockLatencyMs: 0,
  enableDevTools: false,
};

const SAN_JUAN = asId<BarangayId>('brgy-san-juan');

function staffUser(role: StaffRole, barangayId: BarangayId | null = null): StaffUser {
  return {
    id: asId<StaffUserId>('staff-test'),
    name: { first: 'Test', middle: null, last: 'User', suffix: null },
    email: 'test@example.gov.ph',
    role,
    position: 'Tester',
    barangayId,
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
    signIn: (): Observable<SignInOutcome> => of({ kind: 'authenticated', user: authenticated as AuthenticatedUser }),
    completeMfa: (): Observable<AuthenticatedUser> => of(authenticated as AuthenticatedUser),
    signOut: (): Observable<void> => of(undefined),
  };
}

@Component({ template: 'stub' })
class StubPage {}

/** What the error interceptor rethrows when the API refuses (`ApiFailure`). */
const REFUSAL = {
  code: 'FORBIDDEN',
  status: 403,
  message: 'A barangay link records residents of their own barangay only.',
  details: null,
  requestId: null,
  retryAfterSeconds: null,
};

/** The registry as an API that refuses every save would answer it. */
@Injectable()
class RefusingResidentRepository extends MockResidentRepository {
  override create(): Observable<Resident> {
    return throwError(() => REFUSAL);
  }
}

/**
 * The registry as an API that serves residents and not their assistance history would answer it:
 * every profile arrives, and its history says it was not read (`DL-112`).
 */
@Injectable()
class HistoryNotConnectedRepository extends MockResidentRepository {
  override getProfile(id: ResidentId): Observable<ResidentProfile | null> {
    return super.getProfile(id).pipe(
      map((profile): ResidentProfile | null =>
        profile === null
          ? null
          : {
              ...profile,
              history: { kind: 'unavailable', because: ASSISTANCE_HISTORY_NOT_YOURS },
            },
      ),
    );
  }
}

/**
 * `unserved` stands in for what the bound adapter set declares. Spelled out per test rather than
 * read from the http list, whose secondary ports leave it as the API grows (`DL-175`).
 */
async function configure(
  role: StaffRole,
  barangayId: BarangayId | null = null,
  unserved: readonly DataPort[] = [],
  residents: Type<ResidentRepository> = MockResidentRepository,
  /** Appended last, so a binding here replaces the mock one above it. */
  overrides: readonly (Provider | EnvironmentProviders)[] = [],
): Promise<void> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'residents', component: ResidentListPage },
        { path: 'residents/new', component: ResidentFormPage },
        { path: 'residents/:id/edit', component: ResidentFormPage },
        { path: 'residents/:id', component: ResidentDetailPage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(staffUser(role, barangayId)) },
      { provide: RESIDENT_REPOSITORY, useClass: residents },
      { provide: UNSERVED_PORTS, useValue: unserved },
      /*
       * The record now shows which families this person belongs to, and how that changed.
       *
       * A household is an address and a family is a claim about who belongs to whom (`DL-47`), so
       * they come from different repositories — which is the distinction the panel exists to keep
       * visible rather than an incidental dependency.
       */
      { provide: FAMILY_REPOSITORY, useClass: MockFamilyRepository },
      /*
       * The record now lists home visits, which no composite carries — a visit is often the only
       * record of what the office actually saw, and it was reachable from no screen at all.
       */
      { provide: FIELD_VISIT_REPOSITORY, useClass: MockFieldVisitRepository },
      { provide: SAVED_VIEW_REPOSITORY, useClass: MockSavedViewRepository },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
      ...overrides,
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function openList(
  role: StaffRole = 'intake-officer',
  url = '/residents',
  unserved: readonly DataPort[] = [],
): Promise<ComponentFixture<ResidentListPage>> {
  await configure(role, null, unserved);
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(ResidentListPage);
  await fixture.whenStable();
  return fixture;
}

async function openDetail(
  id: string,
  role: StaffRole = 'mswdo-head',
  barangayId: BarangayId | null = null,
  unserved: readonly DataPort[] = [],
  residents: Type<ResidentRepository> = MockResidentRepository,
): Promise<ComponentFixture<ResidentDetailPage>> {
  await configure(role, barangayId, unserved, residents);
  await TestBed.inject(Router).navigateByUrl(`/residents/${id}`);
  const fixture = TestBed.createComponent(ResidentDetailPage);
  fixture.componentRef.setInput('id', id);
  await fixture.whenStable();
  return fixture;
}

async function openForm(
  role: StaffRole = 'intake-officer',
  id?: string,
): Promise<ComponentFixture<ResidentFormPage>> {
  await configure(role);
  await TestBed.inject(Router).navigateByUrl(id ? `/residents/${id}/edit` : '/residents/new');
  const fixture = TestBed.createComponent(ResidentFormPage);
  if (id !== undefined) {
    fixture.componentRef.setInput('id', id);
  }
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

/** The form's barangay choice, found by its label. */
const barangaySelect = (element: HTMLElement) =>
  [...element.querySelectorAll('label.field')]
    .find((label) => label.textContent?.includes(RESIDENTS_COPY.form.barangay))
    ?.querySelector('select');

/* ── The URL is the query ─────────────────────────────────────────────────── */

describe('the resident filter lives in the URL', () => {
  const params = (values: Record<string, string>) => ({
    get: (name: string) => values[name] ?? null,
  });

  it('reads a complete filter back out of query parameters', () => {
    const filter = readResidentFilter(
      params({ q: 'mercado', barangay: 'brgy-san-juan', sector: 'pwd', ageGroup: 'senior' }),
    );
    expect(filter).toEqual({
      search: 'mercado',
      barangayId: 'brgy-san-juan',
      sector: 'pwd',
      ageGroup: 'senior',
    });
  });

  it('degrades junk to no filter rather than guessing or throwing', () => {
    // A page showing everything is recoverable. A page silently showing the
    // wrong subset is not.
    expect(
      readResidentFilter(params({ barangay: 'brgy-atlantis', sector: 'wizard', ageGroup: '42' })),
    ).toEqual({});
  });

  it('reads no page or sort from the URL: the order is the server’s', () => {
    // DL-174: a cursor is a position in one reading, not an address anybody could return to.
    expect(readResidentQuery(params({ page: '3', sort: 'birthDate', direction: 'desc' }))).toEqual({
      filter: {},
    });
  });

  it('round-trips a filter through the parameters a saved view would store', () => {
    const filter = { search: 'cruz', barangayId: SAN_JUAN, includeInactive: true } as const;
    expect(readResidentFilter(params(residentFilterParams(filter)))).toEqual(filter);
  });

  it('leaves page and sort out of the saved parameters', () => {
    // "Seniors in San Juan" is a population, not a scroll position.
    expect(residentFilterParams({ ageGroup: 'senior', barangayId: SAN_JUAN })).toEqual({
      ageGroup: 'senior',
      barangay: 'brgy-san-juan',
    });
  });
});

describe('the resident list', () => {
  it('renders a page of rows rather than the whole registry, and says more are available', async () => {
    const element = html(await openList());
    const rows = element.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(20);
    const status = element.querySelector('.residents__more [role="status"]');
    expect(status?.textContent).toContain('20 shown.');
    expect(status?.textContent).toContain('More are available.');
    expect(element.textContent).not.toMatch(/page \d+ of/i);
  });

  it('follows the cursor when asked for more, keeping the rows already shown', async () => {
    const fixture = await openList();
    const element = html(fixture);
    const before = element.querySelectorAll('tbody tr').length;
    const more = Array.from(element.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Show more',
    );
    more?.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(element.querySelectorAll('tbody tr').length).toBeGreaterThan(before);
  });

  it('offers a protected sector as a filter only to a role cleared for it', async () => {
    const options = (element: HTMLElement) =>
      Array.from(element.querySelectorAll('option')).map((option) => option.textContent?.trim());
    expect(options(html(await openList('intake-officer')))).not.toContain('VAWC survivor');
    expect(options(html(await openList('social-worker')))).toContain('VAWC survivor');
  });

  it('applies the filter that arrived in the URL', async () => {
    const element = html(await openList('intake-officer', '/residents?barangay=brgy-san-juan'));
    const cells = Array.from(element.querySelectorAll('tbody tr td')).map((cell) =>
      cell.textContent?.trim(),
    );
    expect(cells.filter((text) => text === 'San Juan').length).toBeGreaterThan(0);
    expect(cells).not.toContain('Dolores');
  });

  it('makes every resident name a link into their record', async () => {
    const element = html(await openList());
    const links = element.querySelectorAll<HTMLAnchorElement>('.residents__name');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toContain('/residents/res-');
    }
  });

  it('offers the office saved views as chips', async () => {
    const element = html(await openList());
    const chips = Array.from(element.querySelectorAll('.views__chip')).map(
      (chip) => chip.textContent?.trim() ?? '',
    );
    // The chip also carries a visually-hidden note for shared views, so match
    // the leading name rather than the whole string.
    expect(chips.some((chip) => chip.startsWith('Senior citizens'))).toBe(true);
    expect(chips.some((chip) => chip.startsWith('Solo parents'))).toBe(true);
  });

  it('marks the applied saved view for more than just its colour', async () => {
    const element = html(await openList('intake-officer', '/residents?ageGroup=senior'));
    const active = element.querySelector('.views__chip[aria-current="true"]');
    expect(active?.textContent).toContain('Senior citizens');
  });

  it('says saved views are not connected, in their place, and still lists the registry', async () => {
    const element = html(await openList('intake-officer', '/residents', ['saved-view']));

    // The bar is never created, so nothing asks the saved-view repository for anything.
    expect(element.querySelector('.views')).toBeNull();
    const note = element.querySelector('app-not-connected [role="note"]');
    expect(note?.textContent?.trim()).toBe(notConnectedSentence('saved-view'));
    expect(element.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
  });

  it('shows no such note when saved views are served', async () => {
    const element = html(await openList());
    expect(element.querySelector('app-not-connected')).toBeNull();
    expect(element.querySelector('.views')).not.toBeNull();
  });

  it('hides the create action from a role that cannot register anyone', async () => {
    const auditor = html(await openList('auditor'));
    expect(auditor.textContent).not.toContain('Register a resident');

    const intake = html(await openList('intake-officer'));
    expect(intake.textContent).toContain('Register a resident');
  });

  it('masks a protected record in the list and says that it did', async () => {
    const element = html(await openList('intake-officer', '/residents?q=Manalo'));
    const text = element.querySelector('tbody')?.textContent ?? '';
    expect(text).toContain('Manalo, C.');
    expect(text).not.toContain('Cristina');
    expect(element.querySelector('.residents__protected')?.textContent).toContain('Restricted');
  });
});

/* ── Traceability ─────────────────────────────────────────────────────────── */

describe('a resident can be traced without searching four more lists', () => {
  it('shows household, family, requests, payouts and referrals on one screen', async () => {
    const element = html(await openDetail('res-0002'));
    expect(element.textContent).toContain('HH-DL-2024-0088');
    expect(element.querySelectorAll('.family > li').length).toBe(2);
    expect(element.querySelector('#cases-heading')).not.toBeNull();
    expect(element.querySelector('#payouts-heading')).not.toBeNull();
    expect(element.querySelector('#referrals-heading')).not.toBeNull();
  });

  it('links every linked record back to the list it came from', async () => {
    const element = html(await openDetail('res-0001'));
    const references = Array.from(
      element.querySelectorAll<HTMLAnchorElement>('.history tbody th a'),
    );
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference.getAttribute('href')).toBeTruthy();
    }
  });

  it('links a family member to their own record', async () => {
    const element = html(await openDetail('res-0002'));
    const member = element.querySelector<HTMLAnchorElement>('.family a.rsc__name');
    expect(member?.getAttribute('href')).toMatch(/\/residents\/res-\d+/);
  });

  it('states what its own role could not see', async () => {
    const element = html(await openDetail('res-0001', 'release-officer'));
    expect(element.querySelector('.notice__heading')?.textContent).toContain('Hidden by your role');
    expect(element.querySelector('.notice__list')?.textContent).toContain('PhilSys');
  });

  it('says nothing about hiding when the role saw everything', async () => {
    const element = html(await openDetail('res-0001', 'mswdo-head'));
    expect(element.textContent).not.toContain('Hidden by your role');
  });

  it('warns that a protected record needs careful handling', async () => {
    // A cleared role that reads the registry: a caseload reads only its own clients (DL-183).
    const element = html(await openDetail('res-0005', 'mswdo-head'));
    expect(element.textContent).toContain('Protected record');
    expect(element.textContent).toContain('RA 9262');
  });

  it('reports an out-of-scope resident as unavailable, disclosing nothing', async () => {
    // res-0002 is in Dolores; this account covers San Juan only. The wording
    // must be identical to a resident who does not exist.
    const outOfScope = html(await openDetail('res-0002', 'barangay-link', SAN_JUAN));
    const missing = html(await openDetail('res-9999', 'barangay-link', SAN_JUAN));
    expect(outOfScope.textContent).toContain('not available');
    expect(missing.textContent).toContain('not available');
    expect(outOfScope.textContent).not.toContain('Bautista');
  });

  it('offers retiring only to a role that may deactivate', async () => {
    const intake = html(await openDetail('res-0001', 'intake-officer'));
    expect(intake.textContent).not.toContain('Retire record');

    const head = html(await openDetail('res-0001', 'mswdo-head'));
    expect(head.textContent).toContain('Retire record');
  });
});

/* ── Secondary panels the API does not serve (DL-175) ─────────────────────── */

describe('a record whose secondary panels are not connected', () => {
  const UNSERVED_PANELS: readonly DataPort[] = ['family', 'field-visit'];

  it('opens, and names each missing panel in its own place', async () => {
    const element = html(await openDetail('res-0002', 'mswdo-head', null, UNSERVED_PANELS));

    expect(element.textContent).toContain('HH-DL-2024-0088');
    const visits = element.querySelector('#visits-heading')?.closest('section');
    const families = element.querySelector('#families-heading')?.closest('section');
    expect(visits?.querySelector('[role="note"]')?.textContent?.trim()).toBe(
      notConnectedSentence('field-visit'),
    );
    expect(families?.querySelector('[role="note"]')?.textContent?.trim()).toBe(
      notConnectedSentence('family'),
    );
  });

  it('never reads an unread panel as an empty one (DL-112)', async () => {
    const element = html(await openDetail('res-0002', 'mswdo-head', null, UNSERVED_PANELS));

    expect(element.textContent).not.toContain(RESIDENTS_COPY.detail.noVisits);
    expect(element.textContent).not.toContain(RESIDENTS_COPY.detail.noFamilies);
    expect(element.textContent).not.toContain(RESIDENTS_COPY.detail.noKinshipHistory);
  });

  it('makes no call to the field-visit or family repository it was told is not served', async () => {
    await configure('mswdo-head', null, UNSERVED_PANELS);
    const forResident = vi.spyOn(TestBed.inject(FIELD_VISIT_REPOSITORY), 'forResident');
    const familiesOf = vi.spyOn(TestBed.inject(FAMILY_REPOSITORY), 'familiesOf');
    const kinship = vi.spyOn(TestBed.inject(FAMILY_REPOSITORY), 'historyForResident');

    const fixture = TestBed.createComponent(ResidentDetailPage);
    fixture.componentRef.setInput('id', 'res-0002');
    await fixture.whenStable();

    expect(forResident).not.toHaveBeenCalled();
    expect(familiesOf).not.toHaveBeenCalled();
    expect(kinship).not.toHaveBeenCalled();
  });

  it('does call them when they are served, so the test above is not vacuous', async () => {
    await configure('mswdo-head');
    const forResident = vi.spyOn(TestBed.inject(FIELD_VISIT_REPOSITORY), 'forResident');
    const familiesOf = vi.spyOn(TestBed.inject(FAMILY_REPOSITORY), 'familiesOf');

    const fixture = TestBed.createComponent(ResidentDetailPage);
    fixture.componentRef.setInput('id', 'res-0002');
    await fixture.whenStable();

    expect(forResident).toHaveBeenCalled();
    expect(familiesOf).toHaveBeenCalled();
    expect(html(fixture).querySelector('app-not-connected')).toBeNull();
  });

  it('says the assistance history was not read, rather than that there is none', async () => {
    const element = html(
      await openDetail('res-0001', 'mswdo-head', null, [], HistoryNotConnectedRepository),
    );

    const section = element.querySelector('#history-heading')?.closest('section');
    expect(section?.querySelector('[role="note"]')?.textContent?.trim()).toBe(
      ASSISTANCE_HISTORY_NOT_YOURS,
    );
    expect(element.querySelector('#cases-heading')).toBeNull();
    expect(element.querySelectorAll('table.history')).toHaveLength(0);
    expect(element.textContent).not.toContain(RESIDENTS_COPY.detail.noCases);
    expect(element.textContent).not.toContain(RESIDENTS_COPY.detail.noPayouts);
    expect(element.textContent).not.toContain(RESIDENTS_COPY.detail.noReferrals);
  });
});

/* ── The family panel, over the API ───────────────────────────────────────── */

describe('a record whose family panel reads the API (casework phase 1c)', () => {
  /** The barangay the fixtures name, as `GET barangays` keys it. */
  const BARANGAYS = {
    data: [{ id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01', code: 'dolores', name: 'Dolores' }],
    meta: {},
  };

  async function openOverHttp(id: string): Promise<ComponentFixture<ResidentDetailPage>> {
    await configure('mswdo-head', null, [], MockResidentRepository, [
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: FAMILY_REPOSITORY, useClass: HttpFamilyRepository },
    ]);
    const http = TestBed.inject(HttpTestingController);
    const fixture = TestBed.createComponent(ResidentDetailPage);
    fixture.componentRef.setInput('id', id);
    TestBed.tick();

    http.expectOne({ method: 'GET', url: '/api/barangays' }).flush(BARANGAYS);
    http
      .expectOne({ method: 'GET', url: `/api/office/residents/${id}/families` })
      .flush(OFFICE_RESIDENT_FAMILIES);
    http
      .expectOne({ method: 'GET', url: `/api/office/residents/${id}/relationship-history` })
      .flush(OFFICE_RELATIONSHIP_HISTORY);
    await fixture.whenStable();
    http.verify();
    return fixture;
  }

  it('lists the families the API names, each a link into its record', async () => {
    const element = html(await openOverHttp('res-0002'));
    const section = element.querySelector('#families-heading')?.closest('section');

    expect(section?.querySelector('app-not-connected')).toBeNull();
    const link = section?.querySelector<HTMLAnchorElement>('.panel__list a');
    expect(link?.textContent).toContain('Dela Cruz family');
    expect(link?.getAttribute('href')).toBe(
      `/families/${OFFICE_RESIDENT_FAMILIES.data[0]?.family.id ?? ''}`,
    );
    expect(section?.querySelector('.panel__list')?.textContent).toContain(
      'Dela Cruz, Maria Santos',
    );
    expect(section?.textContent).not.toContain(RESIDENTS_COPY.detail.noFamilies);
  });

  it('shows the history the API keeps, each line with its reason and its author', async () => {
    const element = html(await openOverHttp('res-0002'));
    const events = element.querySelectorAll('#families-heading ~ .panel__timeline .panel__event');

    expect(events).toHaveLength(OFFICE_RELATIONSHIP_HISTORY.data.length);
    expect(events[0]?.querySelector('.panel__event-reason')?.textContent).toContain(
      'She heads the family since he left.',
    );
    // An act the server could name nobody for says so, rather than showing a blank author.
    expect(events[2]?.querySelector('.panel__event-actor')?.textContent).toContain(
      'no name on record',
    );
    expect(element.textContent).not.toContain(RESIDENTS_COPY.detail.noKinshipHistory);
  });
});

/* ── DL-196: a refusal is said in place, and a not-found is the screen's own ── */

describe('a panel the reader does not open, or that the server refuses (DL-196)', () => {
  // Dry run 2026-11-09, defect 1: the record asked for the home visits, the API refused a barangay
  // link, and the interceptor sent the whole app to "You do not have access to that section".
  it('opens a barangay link record without asking for the home visits the role does not open', async () => {
    await configure('barangay-link', SAN_JUAN);
    const forResident = vi.spyOn(TestBed.inject(FIELD_VISIT_REPOSITORY), 'forResident');
    const familiesOf = vi.spyOn(TestBed.inject(FAMILY_REPOSITORY), 'familiesOf');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    const fixture = TestBed.createComponent(ResidentDetailPage);
    fixture.componentRef.setInput('id', 'res-0001');
    await fixture.whenStable();
    const element = html(fixture);

    expect(forResident).not.toHaveBeenCalled();
    // The families panel is the barangay link's to read, so it is still asked for.
    expect(familiesOf).toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Mercado');
    const visits = element.querySelector('#visits-heading')?.closest('section');
    expect(visits?.textContent).toContain(RESIDENTS_COPY.detail.visitsNotOpen);
    expect(visits?.textContent).not.toContain(RESIDENTS_COPY.detail.noVisits);
  });

  it('says a refused panel in its place, never as "none recorded", and keeps the record', async () => {
    await configure('mswdo-head', null, [], MockResidentRepository, [
      {
        provide: FIELD_VISIT_REPOSITORY,
        useValue: { forResident: () => throwError(() => REFUSAL) },
      },
    ]);
    const fixture = TestBed.createComponent(ResidentDetailPage);
    fixture.componentRef.setInput('id', 'res-0001');
    await fixture.whenStable();
    const element = html(fixture);

    const visits = element.querySelector('#visits-heading')?.closest('section');
    expect(visits?.querySelector('[role="status"]')?.textContent?.trim()).toBe(
      RESIDENTS_COPY.detail.panelRefused(REFUSAL.message),
    );
    expect(visits?.textContent).not.toContain(RESIDENTS_COPY.detail.noVisits);
    expect(element.textContent).toContain('Mercado');
  });
});

describe('a resident the API does not have (DL-196)', () => {
  // Dry run 2026-11-09, defect 4: the 404 arrived as the interceptor's failure, the adapter looked
  // for the raw response, and the page said "Could not load this section" under three notices.
  it('says the record is not available, through the real interceptor, with no notice', async () => {
    await configure('mswdo-head', null, ['family', 'field-visit'], HttpResidentRepository, [
      provideHttpClient(withInterceptors([httpErrorInterceptor])),
      provideHttpClientTesting(),
    ]);
    const http = TestBed.inject(HttpTestingController);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    const fixture = TestBed.createComponent(ResidentDetailPage);
    fixture.componentRef.setInput('id', 'res-9999');
    TestBed.tick();

    http.expectOne({ method: 'GET', url: '/api/barangays' }).flush({
      data: [{ id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01', code: 'dolores', name: 'Dolores' }],
      meta: {},
    });
    http
      .expectOne({ method: 'GET', url: '/api/office/residents/res-9999' })
      .flush(
        { error: { code: 'NOT_FOUND', message: 'That resident was not found.' } },
        { status: 404, statusText: 'Not Found' },
      );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await fixture.whenStable();
    http.verify();

    expect(html(fixture).textContent).toContain(RESIDENTS_COPY.detail.notFoundHeading);
    expect(html(fixture).textContent).not.toContain('Could not load');
    expect(TestBed.inject(NotificationStore).toasts()).toEqual([]);
    expect(navigate).not.toHaveBeenCalled();
  });
});

/* ── Create and edit ──────────────────────────────────────────────────────── */

describe('registering and correcting a record', () => {
  it('opens the create form empty', async () => {
    const element = html(await openForm('intake-officer'));
    expect(element.querySelector('h1')?.textContent).toContain('Register a resident');
    expect(element.querySelector<HTMLInputElement>('input[autocomplete="given-name"]')?.value).toBe(
      '',
    );
  });

  it('seeds the edit form from the existing record', async () => {
    const element = html(await openForm('mswdo-head', 'res-0001'));
    expect(
      element.querySelector<HTMLInputElement>('input[autocomplete="family-name"]')?.value,
    ).toBe('Mercado');
  });

  // Dry run 2026-11-09, defect 2: all five barangays were offered to a barangay link, the API
  // refused the other four, and the refusal sent the app away with the form.
  it('offers a barangay link their own barangay only, and starts the record there', async () => {
    await configure('barangay-link', SAN_JUAN);
    await TestBed.inject(Router).navigateByUrl('/residents/new');
    const fixture = TestBed.createComponent(ResidentFormPage);
    await fixture.whenStable();

    const select = barangaySelect(html(fixture));
    const named = [...(select?.querySelectorAll('option') ?? [])]
      .map((option) => option.textContent?.trim())
      .filter((name) => name !== '—');
    expect(named).toEqual(['San Juan']);
    expect(select?.value).toBe('brgy-san-juan');
  });

  it('offers every barangay to a municipality-wide writer', async () => {
    const select = barangaySelect(html(await openForm('intake-officer')));
    // The five, and the empty choice a new record starts on.
    expect(select?.querySelectorAll('option')).toHaveLength(6);
  });

  it('keeps what was typed when the save is refused, and says nothing was saved', async () => {
    await configure('intake-officer', null, [], RefusingResidentRepository);
    await TestBed.inject(Router).navigateByUrl('/residents/new');
    const fixture = TestBed.createComponent(ResidentFormPage);
    await fixture.whenStable();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    const form = fixture.componentInstance as unknown as { model: WritableSignal<object> };
    form.model.update((model) => ({
      ...model,
      first: 'Ana',
      last: 'Halimbawa',
      birthDate: '1990-01-01',
      barangayId: 'brgy-dolores',
      streetAddress: '1 Test Street',
    }));
    await fixture.whenStable();

    const element = html(fixture);
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();

    expect(navigate).not.toHaveBeenCalled();
    const alert = element.querySelector('.form__problems[role="alert"]');
    expect(alert?.textContent).toContain(RESIDENTS_COPY.form.saveFailedHeading);
    expect(alert?.textContent).toContain('The save was refused, and nothing was saved.');
    expect(alert?.textContent).toContain(REFUSAL.message);
    expect(alert?.textContent).toContain('What you typed is still on the form.');
    expect(element.querySelector<HTMLInputElement>('input[autocomplete="given-name"]')?.value).toBe(
      'Ana',
    );
    expect(
      element.querySelector<HTMLInputElement>('input[autocomplete="family-name"]')?.value,
    ).toBe('Halimbawa');
  });

  it('names what is wrong instead of failing silently', async () => {
    const fixture = await openForm('intake-officer');
    const element = html(fixture);
    (element.querySelector('form') as HTMLFormElement).dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await fixture.whenStable();

    const problems = element.querySelector('.form__problems');
    expect(problems?.getAttribute('role')).toBe('alert');
    expect(problems?.textContent).toContain('First name is required.');
    expect(problems?.textContent).toContain('Street address is required.');
  });

  it('does not offer a protected sector to a role that may not see one', async () => {
    const intake = html(await openForm('intake-officer'));
    expect(intake.querySelector('.form__sectors')?.textContent).not.toContain('VAWC survivor');
    expect(intake.textContent).toContain('Protected sectors are not offered here');

    const worker = html(await openForm('social-worker'));
    expect(worker.querySelector('.form__sectors')?.textContent).toContain('VAWC survivor');
  });

  it('refuses to edit a record that arrived redacted, and says why', async () => {
    // Saving a draft replaces the record, so editing from a redacted copy would
    // erase what was hidden. The adapter refuses it too.
    const element = html(await openForm('intake-officer', 'res-0005'));
    expect(element.querySelector('.form__blocked-heading')?.textContent).toContain(
      'cannot be edited by your role',
    );
    expect(element.querySelector('form')).toBeNull();
  });

  it('lets a cleared role edit that same record', async () => {
    const element = html(await openForm('mswdo-head', 'res-0005'));
    expect(element.querySelector('form')).not.toBeNull();
  });
});
