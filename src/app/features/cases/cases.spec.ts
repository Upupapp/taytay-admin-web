import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { throwError, firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockAssistanceRequestRepository } from '@data/mock/mock-assistance-request.repository';
import { MockCaseRepository } from '@data/mock/mock-case.repository';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import { MockResidentRepository } from '@data/mock/mock-resident.repository';
import {
  ACCESS_CONTEXT,
  ASSISTANCE_REQUEST_REPOSITORY,
  CASE_REPOSITORY,
  NOTIFICATION_REPOSITORY,
  RESIDENT_REPOSITORY,
  STAFF_REPOSITORY,
  UNSERVED_PORTS,
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
import { CaseOpenPage } from './case-open-page';
import { CaseWorkspacePage } from './case-workspace-page';
import { caseFilterParams, readCaseFilter, readCaseQuery } from './case-query';

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
        { path: 'cases/new', component: CaseOpenPage },
        { path: 'cases/:id', component: CaseWorkspacePage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(staffUser(role, id)) },
      { provide: CASE_REPOSITORY, useClass: MockCaseRepository },
      { provide: ASSISTANCE_REQUEST_REPOSITORY, useClass: MockAssistanceRequestRepository },
      { provide: UNSERVED_PORTS, useValue: [] },
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

  it('holds the filter and nothing else — no sort and no page the server could not honour', () => {
    // DL-179: the office record answers newest opened first, a cursor page at a time.
    expect(readCaseQuery(params({ page: '3', sort: 'reference', status: 'closed' }))).toEqual({
      filter: { status: 'closed' },
    });
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
    expect(text).toContain('3 notes are restricted');
  });

  it('withholds every word of a protected person’s case, says so, and offers no write', async () => {
    // DL-179: the rule and the key of a protected request.
    const element = html(await openWorkspace(SURVIVOR, 'intake-officer', 'staff-intake'));
    const text = element.textContent ?? '';
    expect(text).not.toContain('Relocation completed');
    expect(text).not.toContain('Survivor and two children');
    expect(element.querySelector('.workspace__protected')?.textContent).toContain(
      'protected sector',
    );
    expect(text).toContain('Withheld from your account');
    expect(text).toContain('Reason withheld from your account.');
    expect(element.querySelector('.workspace__actions')).toBeNull();
    expect(element.querySelector('.transition')).toBeNull();
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

/* ── Casework phase 3: what the office record accepts (DL-179) ────────────── */

const buttonNamed = (element: HTMLElement, label: string): HTMLButtonElement | undefined =>
  [...element.querySelectorAll<HTMLButtonElement>('button')].find((button) =>
    button.textContent?.includes(label),
  );

const optionsOf = (select: Element | null | undefined): readonly string[] =>
  [...(select?.querySelectorAll('option') ?? [])].map((option) => option.textContent?.trim() ?? '');

describe('the list pages by cursor, and offers what the reader may do', () => {
  it('says how many are shown and whether more exist — never "page 1 of N"', async () => {
    const element = html(await openList());
    expect(element.querySelector('.cases__hint')?.textContent).toMatch(/\d+ shown/);
    expect(element.textContent).not.toMatch(/page \d+ of/i);
  });

  it('offers no sortable header the server cannot honour', async () => {
    const element = html(await openList());
    expect(element.querySelector('th[aria-sort]')).toBeNull();
  });

  it('offers "Open a case" to those who give cases out', async () => {
    const element = html(await openList('intake-officer'));
    expect(element.querySelector('a[href="/cases/new"]')?.textContent).toContain('Open a case');
  });

  it('offers a caseload neither the pool nor the opening, and says what its list is', async () => {
    const element = html(await openList('social-worker'));
    expect(element.querySelector('a[href="/cases/new"]')).toBeNull();
    expect(element.textContent).toContain('These are the cases assigned to you');
    expect(element.querySelectorAll('.queues__item').length).toBe(5);
  });
});

describe('the workspace offers only what the office record accepts', () => {
  it('links a holder of visit.manage to scheduling a home visit on the case, and nobody else', async () => {
    const link = (element: HTMLElement) =>
      [...element.querySelectorAll('a')].find((anchor) =>
        anchor.textContent?.includes('Schedule a home visit'),
      );
    const worker = html(await openWorkspace(MERCADO, 'social-worker', 'staff-sw-1'));
    expect(link(worker)?.getAttribute('href')).toBe(`/visits/schedule?case=${MERCADO}`);
    // Intake reads visits but does not make them.
    expect(
      link(html(await openWorkspace(MERCADO, 'intake-officer', 'staff-intake'))),
    ).toBeUndefined();
  });

  it('gives the case to a named social worker, or to nobody, from the office’s list', async () => {
    const fixture = await openWorkspace(MERCADO, 'mswdo-head', 'staff-head');
    const element = html(fixture);
    buttonNamed(element, 'Assign this case')?.click();
    await fixture.whenStable();

    const options = optionsOf(element.querySelector('.modal select'));
    expect(options).toEqual([
      'Nobody — take it off any caseload',
      'Grace Ocampo',
      'Jomar Villanueva',
    ]);
  });

  it('offers a caseload no assignment, and shows its own client’s household (DL-183)', async () => {
    const element = html(await openWorkspace(MERCADO, 'social-worker', 'staff-sw-1'));
    const text = element.textContent ?? '';
    expect(buttonNamed(element, 'Assign this case')).toBeUndefined();
    expect(text).not.toContain('Not shown to your account');
    expect(text).not.toContain('Not linked to a household');
    expect(element.querySelector('a[href^="/households/"]')).not.toBeNull();
    // Its own case is still worked.
    expect(buttonNamed(element, 'Add a note')).toBeDefined();
  });

  it('says how many named requests are outside what the account reads', async () => {
    const element = html(await openWorkspace('case-0002', 'social-worker', 'staff-sw-1'));
    expect(element.textContent).toContain('1 more request is named in this case');
    expect(element.textContent).not.toContain('No assistance request has been named');
  });

  it('holds closing back while a task is open, and says why before anybody tries', async () => {
    const element = html(await openWorkspace(MERCADO, 'mswdo-head', 'staff-head'));
    expect(optionsOf(element.querySelector('.transition__select'))).not.toContain('Closed');
    expect(element.querySelector('.workspace__close-blocked')?.textContent).toContain(
      'Closing is not offered while a task is open',
    );
  });

  it('lists the open tasks where closing is held back, and cancels one with a reason (DL-183)', async () => {
    const fixture = await openWorkspace(MERCADO, 'mswdo-head', 'staff-head');
    const element = html(fixture);
    const listed = element.querySelector('.workspace__close-tasks');
    expect(listed?.textContent).toContain('Confirm the pharmacy accepts the purchase order');

    [...(listed?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
      .find((button) => button.textContent?.includes('Cancel task'))
      ?.click();
    await fixture.whenStable();
    const modal = element.querySelector('.modal');
    expect(modal?.textContent).toContain('kept on the case, marked cancelled');
    const confirm = buttonNamed(element, 'Cancel the task');
    expect(confirm?.disabled).toBe(true);

    const reason = element.querySelector<HTMLTextAreaElement>('.modal textarea');
    if (reason) {
      reason.value = 'The pharmacy closed; the purchase order went to the hospital instead';
      reason.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    buttonNamed(element, 'Cancel the task')?.click();
    await fixture.whenStable();

    expect(element.querySelector('.workspace__close-blocked')).toBeNull();
    expect(optionsOf(element.querySelector('.transition__select'))).toContain('Closed');
    expect(element.textContent).toContain('Task cancelled');
  });

  it('says before the assignment that the holder’s open task goes with the case (DL-183)', async () => {
    const fixture = await openWorkspace(MERCADO, 'mswdo-head', 'staff-head');
    const element = html(fixture);
    buttonNamed(element, 'Assign this case')?.click();
    await fixture.whenStable();
    expect(element.querySelector('.modal')?.textContent).not.toContain('goes with it');

    const select = element.querySelector<HTMLSelectElement>('.modal select');
    const jomar = [...(select?.options ?? [])].find((option) =>
      option.textContent?.includes('Jomar Villanueva'),
    );
    if (select && jomar) {
      select.value = jomar.value;
      select.dispatchEvent(new Event('change'));
    }
    await fixture.whenStable();
    expect(element.querySelector('.modal')?.textContent).toContain(
      'The open task Grace Ocampo owes on this case goes with it — to Jomar Villanueva',
    );
  });

  it('ends a request’s link with a reason, saying first that it stays in the history (DL-183)', async () => {
    const fixture = await openWorkspace(MERCADO, 'mswdo-head', 'staff-head');
    const element = html(fixture);
    const end = buttonNamed(element, 'End link');
    expect(end?.getAttribute('aria-label')).toContain('End the link to');
    end?.click();
    await fixture.whenStable();
    expect(element.querySelector('.modal')?.textContent).toContain('kept in the case’s history');

    const reason = element.querySelector<HTMLTextAreaElement>('.modal textarea');
    if (reason) {
      reason.value = 'Named here by mistake; it belongs to the household case';
      reason.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    buttonNamed(element, 'End the link')?.click();
    await fixture.whenStable();

    expect(buttonNamed(element, 'End link')).toBeUndefined();
    expect(element.textContent).toContain('no longer part of this case');
  });

  it('offers no write on a closed case, and a new case continuing it instead', async () => {
    const element = html(await openWorkspace(CLOSED, 'mswdo-head', 'staff-head'));
    expect(element.querySelector('.workspace__actions')).toBeNull();
    expect(element.querySelector('.transition')).toBeNull();
    expect(buttonNamed(element, 'Name a request')).toBeUndefined();
    const link = [...element.querySelectorAll<HTMLAnchorElement>('a')].find((anchor) =>
      anchor.textContent?.includes('Open a new case continuing this one'),
    );
    expect(link?.getAttribute('href')).toBe('/cases/new?continues=case-0005&subject=res-0004');
  });

  it('offers a task only to the writer, whoever holds the case, or nobody', async () => {
    const fixture = await openWorkspace(MERCADO, 'mswdo-head', 'staff-head');
    const element = html(fixture);
    buttonNamed(element, 'Add a task')?.click();
    await fixture.whenStable();

    const selects = [...element.querySelectorAll('.modal select')];
    const owers = optionsOf(selects.at(-1));
    expect(owers).toEqual(['Nobody yet', 'Test User (you)', 'Grace Ocampo (holds the case)']);
  });

  it('offers the person’s filed requests the case does not already name', async () => {
    const fixture = await openWorkspace(MERCADO, 'mswdo-head', 'staff-head');
    const element = html(fixture);
    buttonNamed(element, 'Name a request')?.click();
    await fixture.whenStable();
    // Mercado's one filed request is already named here.
    expect(element.querySelector('.modal')?.textContent).toContain(
      'no filed request that is not already named in this case',
    );
  });
});

describe('opening a case', () => {
  async function openForm(
    role: StaffRole,
    staffId: string,
    inputs: { readonly continues?: string; readonly subject?: string } = {},
  ): Promise<ComponentFixture<CaseOpenPage>> {
    await configure(role, staffId);
    await TestBed.inject(Router).navigateByUrl('/cases/new');
    const fixture = TestBed.createComponent(CaseOpenPage);
    if (inputs.continues !== undefined) {
      fixture.componentRef.setInput('continues', inputs.continues);
    }
    if (inputs.subject !== undefined) {
      fixture.componentRef.setInput('subject', inputs.subject);
    }
    await fixture.whenStable();
    return fixture;
  }

  it('tells a caseload that intake and the head open cases, and shows no form', async () => {
    const element = html(await openForm('social-worker', 'staff-sw-1'));
    expect(element.textContent).toContain('Cases are opened by intake and the head');
    expect(element.querySelector('form')).toBeNull();
  });

  it('continues a closed case with its person already chosen, and opens it', async () => {
    const fixture = await openForm('mswdo-head', 'staff-head', {
      continues: 'case-0005',
      subject: 'res-0004',
    });
    const element = html(fixture);
    expect(element.textContent).toContain('This case continues CASE-2026-0033');
    expect(element.textContent).toContain('Requests this case covers');

    const submit = element.querySelector<HTMLButtonElement>('button[type="submit"]');
    expect(submit?.disabled).toBe(true);

    const category = element.querySelector<HTMLSelectElement>('form select');
    if (category) {
      category.value = 'crisis-intervention';
      category.dispatchEvent(new Event('change'));
    }
    const [summary, reason] = [...element.querySelectorAll<HTMLTextAreaElement>('form textarea')];
    if (summary && reason) {
      summary.value = 'Lost work again after the second factory closure this year.';
      summary.dispatchEvent(new Event('input'));
      reason.value = 'Walk-in; the earlier file was closed in June';
      reason.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);

    element.querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await fixture.whenStable();
    expect(TestBed.inject(Router).url).toMatch(/^\/cases\/case-\d+$/);
  });

  it('says a presenting problem that is too short in a live region', async () => {
    const fixture = await openForm('intake-officer', 'staff-intake');
    const element = html(fixture);
    const [summary] = [...element.querySelectorAll<HTMLTextAreaElement>('form textarea')];
    if (summary) {
      summary.value = 'fire';
      summary.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    const problems = [...element.querySelectorAll('.open-case__problem[role="alert"]')];
    expect(problems.some((problem) => problem.textContent?.includes('at least 8'))).toBe(true);
  });
});

describe('"Try again" reads again (DL-185)', () => {
  it('re-runs the load after a failed read, and shows the record', async () => {
    await configure('social-worker');
    const repository = TestBed.inject(CASE_REPOSITORY);
    const read = vi
      .spyOn(repository, 'getById')
      .mockReturnValueOnce(throwError(() => new Error('The connection dropped.')));
    await TestBed.inject(Router).navigateByUrl(`/cases/${MERCADO}`);
    const fixture = TestBed.createComponent(CaseWorkspacePage);
    fixture.componentRef.setInput('id', MERCADO);
    await fixture.whenStable();
    fixture.detectChanges();

    const again = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((button) => button.textContent?.trim() === 'Try again');
    expect(again).toBeDefined();
    again?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(read).toHaveBeenCalledTimes(2);
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain(
      'The connection dropped.',
    );
  });
});
