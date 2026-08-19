import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import { MockResidentRepository } from '@data/mock/mock-resident.repository';
import { MockSavedViewRepository } from '@data/mock/mock-saved-view.repository';
import {
  ACCESS_CONTEXT,
  asId,
  emptyPage,
  NOTIFICATION_REPOSITORY,
  RESIDENT_REPOSITORY,
  SAVED_VIEW_REPOSITORY,
  STAFF_REPOSITORY,
  toAuthenticatedUser,
  type AuthenticatedUser,
  type BarangayId,
  type Page,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
  type SignInOutcome,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { ResidentDetailPage } from './resident-detail-page';
import { ResidentFormPage } from './resident-form-page';
import { ResidentListPage } from './resident-list-page';
import { readResidentFilter, readResidentPage, residentFilterParams } from './resident-query';

const TEST_ENVIRONMENT: AppEnvironment = {
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
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

async function configure(role: StaffRole, barangayId: BarangayId | null = null): Promise<void> {
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
      { provide: RESIDENT_REPOSITORY, useClass: MockResidentRepository },
      { provide: SAVED_VIEW_REPOSITORY, useClass: MockSavedViewRepository },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function openList(
  role: StaffRole = 'intake-officer',
  url = '/residents',
): Promise<ComponentFixture<ResidentListPage>> {
  await configure(role);
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(ResidentListPage);
  await fixture.whenStable();
  return fixture;
}

async function openDetail(
  id: string,
  role: StaffRole = 'mswdo-head',
  barangayId: BarangayId | null = null,
): Promise<ComponentFixture<ResidentDetailPage>> {
  await configure(role, barangayId);
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

  it('falls back to a sane page and sort when the URL is nonsense', () => {
    const page = readResidentPage(params({ page: '-3', sort: 'shoeSize', direction: 'sideways' }));
    expect(page.page).toBe(1);
    expect(page.sort).toEqual({ field: 'name', direction: 'asc' });
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
  it('renders a page of rows rather than the whole registry', async () => {
    const element = html(await openList());
    const rows = element.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(20);
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
    const element = html(await openDetail('res-0005', 'social-worker'));
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
    const element = html(await openForm('social-worker', 'res-0005'));
    expect(element.querySelector('form')).not.toBeNull();
  });
});
