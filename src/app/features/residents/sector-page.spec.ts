import { Component, Injectable } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import { MockResidentRepository } from '@data/mock/mock-resident.repository';
import {
  ACCESS_CONTEXT,
  asId,
  emptyPage,
  NOTIFICATION_REPOSITORY,
  notSentSentence,
  RESIDENT_REPOSITORY,
  STAFF_REPOSITORY,
  toAuthenticatedUser,
  UNSERVED_PORTS,
  type AuthenticatedUser,
  type CursorPage,
  type CursorRequest,
  type Page,
  type ResidentFilter,
  type ResidentId,
  type ResidentView,
  type SignInOutcome,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
  type VulnerabilitySector,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { SECTOR_PAGES } from './residents.copy';
import { SectorPage } from './sector-page';

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

const STAMP = '2026-01-01T00:00:00.000Z';

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
      createdAt: STAMP as StaffUser['audit']['createdAt'],
      createdBy: null,
      updatedAt: STAMP as StaffUser['audit']['updatedAt'],
      updatedBy: null,
    },
  };
}

function staffRepository(user: StaffUser): StaffRepository {
  const authenticated = toAuthenticatedUser(user);
  return {
    list: (): Observable<Page<StaffUser>> => of(emptyPage<StaffUser>()),
    getById: (): Observable<StaffUser | null> => of(user),
    currentUser: (): Observable<AuthenticatedUser | null> => of(authenticated),
    signIn: (): Observable<SignInOutcome> => of({ kind: 'authenticated', user: authenticated }),
    completeMfa: (): Observable<AuthenticatedUser> => of(authenticated),
    signOut: (): Observable<void> => of(undefined),
  };
}

/**
 * The mock registry with its answers recorded and its failures switchable: the screen sees real
 * `ResidentView`s, and each test reads what was asked of it. `empty` answers every list with none.
 */
@Injectable()
class StubResidents extends MockResidentRepository {
  fail = false;
  empty = false;
  readonly filters: ResidentFilter[] = [];
  readonly recorded: [ResidentId, VulnerabilitySector, string][] = [];
  readonly ended: [ResidentId, VulnerabilitySector, string][] = [];

  override list(filter: ResidentFilter, page: CursorRequest): Observable<CursorPage<ResidentView>> {
    this.filters.push(filter);
    if (this.fail) {
      return throwError(() => new Error('down'));
    }
    return this.empty
      ? of({ items: [], hasMore: false, nextCursor: null })
      : super.list(filter, page);
  }
  override recordSector(
    id: ResidentId,
    sector: VulnerabilitySector,
    reason = '',
  ): Observable<void> {
    this.recorded.push([id, sector, reason]);
    return of(undefined);
  }
  override endSector(
    id: ResidentId,
    sector: VulnerabilitySector,
    reason = '',
  ): Observable<void> {
    this.ended.push([id, sector, reason]);
    return of(undefined);
  }
}

@Component({ template: 'stub' })
class StubPage {}

async function open(
  role: StaffRole,
  sector: 'senior-citizen' | 'pwd' | 'solo-parent',
  prepare: (residents: StubResidents) => void = () => undefined,
): Promise<{ fixture: ComponentFixture<SectorPage>; residents: StubResidents }> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: '**', component: StubPage }]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(staffUser(role)) },
      StubResidents,
      { provide: RESIDENT_REPOSITORY, useExisting: StubResidents },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
      { provide: UNSERVED_PORTS, useValue: [] },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
  const residents = TestBed.inject(StubResidents);
  prepare(residents);
  await TestBed.inject(Router).navigateByUrl(`/residents/sectors/${sector}`);
  const fixture = TestBed.createComponent(SectorPage);
  fixture.componentRef.setInput('sector', sector);
  await fixture.whenStable();
  return { fixture, residents };
}

const html = (fixture: ComponentFixture<SectorPage>): HTMLElement =>
  fixture.nativeElement as HTMLElement;

function button(element: HTMLElement, text: string): HTMLButtonElement | undefined {
  return Array.from(element.querySelectorAll('button')).find(
    (candidate) => candidate.textContent?.trim() === text,
  );
}

describe('a sector page', () => {
  it('lists the registry narrowed to its own sector, with the registry’s columns', async () => {
    const { fixture, residents } = await open('intake-officer', 'senior-citizen');
    const element = html(fixture);

    expect(residents.filters.at(-1)?.sector).toBe('senior-citizen');
    expect(element.querySelector('h1')?.textContent).toContain(
      SECTOR_PAGES['senior-citizen'].title,
    );
    expect(element.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
    const headers = Array.from(element.querySelectorAll('thead th')).map((th) =>
      th.textContent?.trim(),
    );
    expect(headers.slice(0, 5)).toEqual(['Resident', 'Barangay', 'Age', 'Sectors', 'Status']);
    for (const row of Array.from(element.querySelectorAll('tbody tr'))) {
      expect(row.textContent).toContain('Senior citizen');
    }
  });

  it('never lets a URL parameter change the sector it reads', async () => {
    const { fixture, residents } = await open('intake-officer', 'pwd');
    await TestBed.inject(Router).navigateByUrl('/residents/sectors/pwd?sector=vawc-survivor');
    await fixture.whenStable();
    expect(residents.filters.length).toBeGreaterThan(0);
    expect(residents.filters.every((filter) => filter.sector === 'pwd')).toBe(true);
  });

  it('marks the current sector page among the three', async () => {
    const element = html((await open('intake-officer', 'solo-parent')).fixture);
    const tabs = Array.from(element.querySelectorAll<HTMLAnchorElement>('nav .tab'));
    expect(tabs.map((tab) => tab.textContent?.trim())).toEqual([
      'Senior citizens',
      'PWD',
      'Solo parents',
    ]);
    const current = tabs.filter((tab) => tab.getAttribute('aria-current') === 'page');
    expect(current.map((tab) => tab.textContent?.trim())).toEqual(['Solo parents']);
  });

  it('names the figures the API does not send, in their own panels', async () => {
    const element = html((await open('intake-officer', 'senior-citizen')).fixture);
    const notes = Array.from(element.querySelectorAll('app-not-connected [role="note"]')).map(
      (note) => note.textContent?.trim(),
    );
    expect(notes).toEqual([
      notSentSentence('sector-counts'),
      notSentSentence('sector-attention'),
      notSentSentence('sector-fields'),
    ]);
  });

  it('says the sector is empty, apart from a search with no match', async () => {
    const element = html(
      (await open('intake-officer', 'pwd', (residents) => (residents.empty = true))).fixture,
    );
    expect(element.textContent).toContain(SECTOR_PAGES.pwd.emptyHeading);
    expect(element.textContent).not.toContain('No residents match those filters');
  });

  it('offers Try again when the list could not be read, and reads again', async () => {
    const { fixture, residents } = await open(
      'intake-officer',
      'pwd',
      (stub) => (stub.fail = true),
    );
    const element = html(fixture);
    expect(element.querySelector('.residents__problem[role="alert"]')).not.toBeNull();
    residents.fail = false;
    const before = residents.filters.length;
    button(element, 'Try again')?.click();
    await fixture.whenStable();
    expect(residents.filters.length).toBe(before + 1);
    expect(element.querySelector('.residents__problem[role="alert"]')).toBeNull();
  });

  it('hides Add and End from a reader who cannot change the registry', async () => {
    const element = html((await open('auditor', 'senior-citizen')).fixture);
    expect(element.querySelectorAll('tbody tr').length).toBeGreaterThan(0);
    expect(element.textContent).not.toContain(SECTOR_PAGES['senior-citizen'].add);
    expect(button(element, 'End')).toBeUndefined();
  });

  it('ends a membership only from the confirmation, with a reason, after its effects', async () => {
    const { fixture, residents } = await open('intake-officer', 'senior-citizen');
    const element = html(fixture);

    button(element, 'End')?.click();
    await fixture.whenStable();
    const dialog = element.querySelector('app-modal') as HTMLElement;
    expect(dialog.querySelector('.effects')).not.toBeNull();

    button(dialog, 'End membership')?.click();
    await fixture.whenStable();
    expect(residents.ended).toHaveLength(0);
    expect(dialog.querySelector('[role="alert"]')).not.toBeNull();

    const reason = dialog.querySelector('textarea') as HTMLTextAreaElement;
    reason.value = 'Moved out of Taytay.';
    reason.dispatchEvent(new Event('input'));
    button(dialog, 'End membership')?.click();
    await fixture.whenStable();
    expect(residents.ended).toHaveLength(1);
    expect(residents.ended[0]?.slice(1)).toEqual(['senior-citizen', 'Moved out of Taytay.']);
    expect(element.querySelector('app-modal')).toBeNull();
  });

  it('adds nobody until a person is chosen', async () => {
    const { fixture, residents } = await open('intake-officer', 'pwd');
    const element = html(fixture);
    button(element, SECTOR_PAGES.pwd.add)?.click();
    await fixture.whenStable();
    const dialog = element.querySelector('app-modal') as HTMLElement;
    expect(dialog.querySelector('app-person-picker')).not.toBeNull();
    const reason = dialog.querySelector('textarea') as HTMLTextAreaElement;
    reason.value = 'PWD ID seen.';
    reason.dispatchEvent(new Event('input'));
    button(dialog, 'Add to the sector')?.click();
    await fixture.whenStable();
    expect(residents.recorded).toHaveLength(0);
    expect(dialog.querySelector('[role="alert"]')?.textContent).toContain('Choose the person');
  });
});
