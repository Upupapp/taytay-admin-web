import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockCaseRepository } from '@data/mock/mock-case.repository';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import { MockResidentRepository } from '@data/mock/mock-resident.repository';
import {
  ACCESS_CONTEXT,
  CASE_REPOSITORY,
  NOTIFICATION_REPOSITORY,
  RESIDENT_REPOSITORY,
  STAFF_REPOSITORY,
  asId,
  emptyPage,
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

import { CaseListPage } from './case-list-page';
import { CaseWorkspacePage } from './case-workspace-page';
import { caseFilterParams, readCaseFilter, readCasePage } from './case-query';

const TEST_ENVIRONMENT: AppEnvironment = {
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  mockLatencyMs: 0,
  enableDevTools: false,
};

const DOLORES = asId<BarangayId>('brgy-dolores');
const MERCADO = 'case-0001';
const SURVIVOR = 'case-0003';
const CLOSED = 'case-0005';

function staffUser(role: StaffRole, id: string, barangayId: BarangayId | null = null): StaffUser {
  return {
    id: asId<StaffUserId>(id),
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

@Component({ template: 'stub' })
class StubPage {}

async function configure(role: StaffRole, id = 'staff-sw-1'): Promise<void> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'cases', component: CaseListPage },
        { path: 'cases/:id', component: CaseWorkspacePage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(staffUser(role, id)) },
      { provide: CASE_REPOSITORY, useClass: MockCaseRepository },
      { provide: RESIDENT_REPOSITORY, useClass: MockResidentRepository },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function openList(
  role: StaffRole = 'mswdo-head',
  url = '/cases',
): Promise<ComponentFixture<CaseListPage>> {
  await configure(role);
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(CaseListPage);
  await fixture.whenStable();
  return fixture;
}

async function openWorkspace(
  id: string,
  role: StaffRole = 'mswdo-head',
  staffId = 'staff-sw-1',
): Promise<ComponentFixture<CaseWorkspacePage>> {
  await configure(role, staffId);
  await TestBed.inject(Router).navigateByUrl(`/cases/${id}`);
  const fixture = TestBed.createComponent(CaseWorkspacePage);
  fixture.componentRef.setInput('id', id);
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

/* ── The URL is the queue ─────────────────────────────────────────────────── */

describe('the queue and the filters live in the URL', () => {
  const params = (values: Record<string, string>) => ({
    get: (name: string) => values[name] ?? null,
  });

  it('reads a complete filter back out of query parameters', () => {
    expect(
      readCaseFilter(
        params({ q: 'bautista', status: 'assessment', barangay: 'brgy-dolores', queue: 'overdue' }),
      ),
    ).toEqual({
      search: 'bautista',
      status: 'assessment',
      barangayId: DOLORES,
      queue: 'overdue',
    });
  });

  it('degrades junk to no filter rather than to an error', () => {
    expect(readCaseFilter(params({ queue: 'urgent-ish', status: 'pondering' }))).toEqual({});
  });

  it('defaults the sort to what falls due soonest, because that is what a queue is', () => {
    const page = readCasePage(params({ page: '-3', sort: 'vibes' }));
    expect(page.page).toBe(1);
    expect(page.sort).toEqual({ field: 'nextAction', direction: 'asc' });
  });

  it('round-trips a queue through its parameters, so it can be sent to a colleague', () => {
    const filter = { queue: 'overdue', barangayId: DOLORES } as const;
    expect(readCaseFilter(params(caseFilterParams(filter)))).toEqual(filter);
  });
});

/* ── The list ─────────────────────────────────────────────────────────────── */

describe('the case list', () => {
  it('says a case is not an assistance request, above the table', async () => {
    const element = html(await openList());
    expect(element.querySelector('.cases__banner')?.textContent).toContain(
      'An assistance request is one intervention inside it',
    );
  });

  it('offers every queue as a control, with a count beside it', async () => {
    const element = html(await openList());
    const buttons = element.querySelectorAll('.queues__item');
    expect(buttons.length).toBe(6);
    expect(element.textContent).toContain('Unassigned');
    expect(element.textContent).toContain('Overdue');
  });

  it('marks the active queue for a screen reader, not only by shading it', async () => {
    const element = html(await openList('mswdo-head', '/cases?queue=overdue'));
    const active = element.querySelector('.queues__item[aria-current="true"]');
    expect(active?.textContent).toContain('Overdue');
  });

  it('states lateness in words rather than by colour', async () => {
    const element = html(await openList('mswdo-head', '/cases?queue=overdue'));
    expect(element.querySelector('tbody')?.textContent).toMatch(/\d+ days? overdue/);
  });

  it('says who owns a case, and says so when nobody does', async () => {
    const element = html(await openList('mswdo-head', '/cases?queue=unassigned'));
    expect(element.querySelector('tbody')?.textContent).toContain('Nobody assigned');
  });

  it('makes every case reference a link into the workspace', async () => {
    const element = html(await openList());
    const links = element.querySelectorAll<HTMLAnchorElement>('.cases__reference');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toContain('/cases/case-');
    }
  });
});

/* ── The workspace ────────────────────────────────────────────────────────── */

describe('the workspace answers without opening another module', () => {
  it('leads with what happens next', async () => {
    const element = html(await openWorkspace(MERCADO));
    const next = element.querySelector('.workspace__next');
    expect(next?.textContent).toContain('What happens next');
    expect(next?.textContent).toContain('Confirm the pharmacy accepts the purchase order');
  });

  it('shows the person, the address, the family and the money on one screen', async () => {
    const text = html(await openWorkspace(MERCADO)).textContent ?? '';
    // The person, the address, the family and the money, all from one read.
    expect(text).toContain('Mercado, Aurora');
    expect(text).toContain('HH-SJ-2024-0011');
    expect(text).toContain('Mercado family');
    expect(text).toContain('TAY-2026-000841');
    expect(text).toContain('₱9,000.00');
  });

  it('explains a missing household instead of leaving a blank', async () => {
    const text = html(await openWorkspace('case-0006')).textContent ?? '';
    expect(text).toContain('Not linked to a household');
    expect(text).toContain('recordable state, not missing data');
  });

  it('renders the timeline as a real ordered list with real times', async () => {
    const element = html(await openWorkspace(MERCADO));
    const list = element.querySelector('.timeline__list');
    expect(list?.tagName).toBe('OL');
    expect(element.querySelectorAll('.timeline__entry').length).toBeGreaterThan(1);
    expect(element.querySelector('.timeline__when')?.getAttribute('datetime')).toBeTruthy();
  });

  it('draws no connectors and no diagram — the timeline is the list', async () => {
    const element = html(await openWorkspace(MERCADO));
    expect(element.querySelector('canvas')).toBeNull();
    expect(element.querySelector('svg')).toBeNull();
  });

  it('says a closed case is kept rather than hiding it', async () => {
    const text = html(await openWorkspace(CLOSED)).textContent ?? '';
    expect(text).toContain('This case is closed');
    expect(text).toContain('opened as a new case');
  });

  it('says so plainly when the case is not available', async () => {
    const text = html(await openWorkspace('case-nope')).textContent ?? '';
    expect(text).toContain('That case is not available');
  });
});

/* ── Protected notes on screen ────────────────────────────────────────────── */

describe('a protected note never reaches the screen', () => {
  it('shows the restriction, and not one word of the note', async () => {
    const element = html(await openWorkspace(SURVIVOR, 'intake-officer', 'staff-intake'));
    const text = element.textContent ?? '';

    expect(text).not.toContain('Safety plan agreed');
    expect(text).not.toContain('Disclosure given in confidence');
    expect(text).toContain('Restricted');
    // Counted in words, so the reader knows the file is not complete.
    expect(text).toContain('2 notes are restricted');
  });

  it('still shows the routine note on the same case', async () => {
    const text =
      html(await openWorkspace(SURVIVOR, 'intake-officer', 'staff-intake')).textContent ?? '';
    expect(text).toContain('Relocation completed');
  });

  it('shows the whole record to the worker cleared for the tier', async () => {
    const text =
      html(await openWorkspace(SURVIVOR, 'social-worker', 'staff-sw-2')).textContent ?? '';
    expect(text).toContain('Safety plan agreed');
    expect(text).not.toContain('notes are restricted');
  });
});

/* ── The status transition control ────────────────────────────────────────── */

describe('moving a case requires a reason', () => {
  it('offers the moves the lifecycle allows', async () => {
    const element = html(await openWorkspace(MERCADO));
    const options = [...element.querySelectorAll('.transition__select option')].map((option) =>
      option.textContent?.trim(),
    );
    expect(options).toContain('Monitoring');
    expect(options).toContain('On hold');
    // Nothing that would skip the lifecycle.
    expect(options).not.toContain('Intake');
  });

  it('does not offer closure to a role that may not close', async () => {
    const element = html(await openWorkspace(MERCADO, 'social-worker', 'staff-sw-1'));
    const options = [...element.querySelectorAll('.transition__select option')].map((option) =>
      option.textContent?.trim(),
    );
    expect(options).not.toContain('Closed');
  });

  it('keeps the confirm button disabled until a destination and a reason are given', async () => {
    const fixture = await openWorkspace(MERCADO);
    const element = html(fixture);
    const button = element.querySelector<HTMLButtonElement>('.transition__actions .btn');
    expect(button?.disabled).toBe(true);

    const select = element.querySelector<HTMLSelectElement>('.transition__select');
    if (select) {
      select.value = 'monitoring';
      select.dispatchEvent(new Event('change'));
    }
    await fixture.whenStable();
    expect(element.querySelector<HTMLButtonElement>('.transition__actions .btn')?.disabled).toBe(
      true,
    );

    const reason = element.querySelector<HTMLTextAreaElement>('.transition__reason');
    if (reason) {
      reason.value = 'Assistance delivered; moving to follow-up for one month';
      reason.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    expect(element.querySelector<HTMLButtonElement>('.transition__actions .btn')?.disabled).toBe(
      false,
    );
  });

  it('says why a short reason is not enough, in a live region', async () => {
    const fixture = await openWorkspace(MERCADO);
    const element = html(fixture);
    const reason = element.querySelector<HTMLTextAreaElement>('.transition__reason');
    if (reason) {
      reason.value = 'ok';
      reason.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();

    const problem = element.querySelector('.transition__problem');
    expect(problem?.getAttribute('role')).toBe('alert');
    expect(problem?.textContent).toContain('Say a little more');
  });

  it('records the move and shows it on the timeline', async () => {
    const fixture = await openWorkspace(MERCADO);
    const element = html(fixture);

    const select = element.querySelector<HTMLSelectElement>('.transition__select');
    if (select) {
      select.value = 'monitoring';
      select.dispatchEvent(new Event('change'));
    }
    const reason = element.querySelector<HTMLTextAreaElement>('.transition__reason');
    if (reason) {
      reason.value = 'Medicines delivered; moving to follow-up for one month';
      reason.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();

    element.querySelector<HTMLButtonElement>('.transition__actions .btn')?.click();
    await fixture.whenStable();

    const text = html(fixture).textContent ?? '';
    expect(text).toContain('Monitoring');
    expect(text).toContain('Medicines delivered');
    expect(text).toContain('Reason given');
  });

  it('tells a reader with no case.manage that the control is simply absent', async () => {
    // The auditor may read the file and move nothing.
    const element = html(await openWorkspace(MERCADO, 'auditor', 'staff-auditor'));
    expect(element.querySelector('.transition')).toBeNull();
    expect(element.textContent).toContain('What has happened');
  });
});
