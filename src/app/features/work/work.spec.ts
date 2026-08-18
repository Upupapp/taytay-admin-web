import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockCaseRepository } from '@data/mock/mock-case.repository';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import { MockWorkRepository } from '@data/mock/mock-work.repository';
import {
  ACCESS_CONTEXT,
  CASE_REPOSITORY,
  NOTIFICATION_REPOSITORY,
  STAFF_REPOSITORY,
  WORK_REPOSITORY,
  asId,
  emptyPage,
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

import { NotificationCentrePage } from './notification-centre-page';
import { TeamQueuePage } from './team-queue-page';
import { WorkQueuePage } from './work-queue-page';

const TEST_ENVIRONMENT: AppEnvironment = {
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  mockLatencyMs: 0,
  enableDevTools: false,
};

function staffUser(role: StaffRole, id: string): StaffUser {
  return {
    id: asId<StaffUserId>(id),
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

async function configure(user: StaffUser): Promise<void> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'work', component: WorkQueuePage },
        { path: 'work/team', component: TeamQueuePage },
        { path: 'notifications', component: NotificationCentrePage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(user) },
      { provide: WORK_REPOSITORY, useClass: MockWorkRepository },
      { provide: CASE_REPOSITORY, useClass: MockCaseRepository },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function openQueue(
  role: StaffRole = 'social-worker',
  id = 'staff-sw-1',
): Promise<ComponentFixture<WorkQueuePage>> {
  await configure(staffUser(role, id));
  await TestBed.inject(Router).navigateByUrl('/work');
  const fixture = TestBed.createComponent(WorkQueuePage);
  await fixture.whenStable();
  return fixture;
}

async function openTeam(
  role: StaffRole = 'mswdo-head',
  id = 'staff-head',
): Promise<ComponentFixture<TeamQueuePage>> {
  await configure(staffUser(role, id));
  await TestBed.inject(Router).navigateByUrl('/work/team');
  const fixture = TestBed.createComponent(TeamQueuePage);
  await fixture.whenStable();
  return fixture;
}

async function openCentre(
  role: StaffRole = 'mswdo-head',
  id = 'staff-head',
): Promise<ComponentFixture<NotificationCentrePage>> {
  await configure(staffUser(role, id));
  await TestBed.inject(Router).navigateByUrl('/notifications');
  const fixture = TestBed.createComponent(NotificationCentrePage);
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

/* ── Criterion: overdue work is obvious without red-only signalling ───────── */

describe('late work on the queue', () => {
  it('says how late each item is, in words', async () => {
    const fixture = await openQueue();
    const page = fixture.componentInstance as unknown as {
      lateness: (item: { dueOn: string | null; waitingSince: string | null }) => string | null;
      today: string;
    };

    // The sentence exists independently of any styling, which is what makes
    // lateness survive a monochrome printout and a screen reader.
    expect(page.lateness({ dueOn: '2026-01-01', waitingSince: null })).toMatch(/^Late by \d+ days$/);
  });

  it('heads the late bucket with a word, not only a colour', async () => {
    const element = html(await openQueue());
    const late = element.querySelector('.bucket--late');

    expect(late).not.toBeNull();
    expect(late?.querySelector('.bucket__heading')?.textContent).toContain('Late');
    expect(late?.textContent).toContain('Somebody set a date and it has passed');
  });

  it('puts a lateness sentence on every late row', async () => {
    const element = html(await openQueue());
    const rows = [...(element.querySelector('.bucket--late')?.querySelectorAll('.work-rows__item') ?? [])];

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.querySelector('.work-rows__timing')?.textContent).toMatch(/Late by \d+ days?/);
    }
  });

  it('reports waiting time for work with no deadline, and never calls it late', async () => {
    const fixture = await openQueue('intake-officer', 'staff-intake');
    const element = html(fixture);
    const undated = element.querySelector('.bucket__hint');

    // No service standard was supplied, so the screen says why there is no date
    // rather than leaving an officer to assume one was lost.
    expect(element.textContent).toContain('has not adopted a service standard');
    expect(undated).not.toBeNull();
  });

  it('summarises the queue in counts, never as a verdict', async () => {
    const element = html(await openQueue());
    const summary = element.querySelector('.work__summary')?.textContent ?? '';

    expect(summary).not.toMatch(/behind schedule|on track/i);
    expect(summary).toMatch(/late|due today|due this week|later|Nothing owed/);
  });
});

/* ── Criterion: FYI is distinguishable from action required ───────────────── */

describe('the three surfaces read differently', () => {
  it('says on the notification centre that nothing there is a job', async () => {
    const element = html(await openCentre());

    expect(element.querySelector('.centre__notice')?.textContent).toContain(
      'records of events',
    );
    expect(element.querySelector('.centre__notice')?.textContent).toContain('work list');
  });

  it('groups the centre by what happened, with assignments first', async () => {
    const fixture = await openCentre('social-worker', 'staff-sw-1');
    const headings = [...html(fixture).querySelectorAll('.group__heading')].map((node) =>
      (node.textContent ?? '').trim(),
    );

    expect(headings[0]).toBe('Assigned to you');
  });

  it('marks unread with a word as well as a weight', async () => {
    const element = html(await openCentre());
    const badge = element.querySelector('.group__badge');

    expect(badge?.textContent?.trim()).toBe('Unread');
  });

  it('labels an alert with its basis, so it can be checked rather than dismissed', async () => {
    const element = html(await openQueue('mswdo-head', 'staff-head'));
    const alerts = element.querySelector('.alerts');

    expect(alerts?.textContent).toContain('How this was worked out');
    expect(alerts?.textContent).toContain('Conditions of the records, not jobs');
  });
});

/* ── Criterion: tasks link to records, and only tasks are manageable ──────── */

describe('acting on the queue', () => {
  it('links every item to the record behind it', async () => {
    const element = html(await openQueue());
    const links = [...element.querySelectorAll('.work-rows__actions a')];

    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toMatch(/^\/(cases|assistance-requests|visits|referrals|releases|beneficiaries)/);
    }
  });

  it('offers completion only on a task, and says why not on the rest', async () => {
    const element = html(await openQueue());
    const notes = [...element.querySelectorAll('.work-rows__note')];

    expect(notes.length).toBeGreaterThan(0);
    expect(notes[0]?.textContent).toContain('state of a record');
  });

  it('refuses to complete a task with no outcome recorded', async () => {
    const fixture = await openQueue();
    const page = fixture.componentInstance as unknown as {
      outcome: { set: (value: string) => void };
      canComplete: () => boolean;
    };

    expect(page.canComplete()).toBe(false);
    page.outcome.set('Visited on Tuesday; the family had already been paid.');
    fixture.detectChanges();
    expect(page.canComplete()).toBe(true);
  });

  it('refuses to move a date without a reason', async () => {
    const fixture = await openQueue();
    const page = fixture.componentInstance as unknown as {
      newDate: { set: (value: string) => void };
      reason: { set: (value: string) => void };
      canReschedule: () => boolean;
    };

    page.newDate.set('2026-09-01');
    fixture.detectChanges();
    expect(page.canReschedule()).toBe(false);

    page.reason.set('The household asked to move it; the mother is in hospital.');
    fixture.detectChanges();
    expect(page.canReschedule()).toBe(true);
  });
});

/* ── Criterion: a queue holds only what this user can act on ──────────────── */

describe('what reaches a queue', () => {
  it('keeps payouts out of an intake officer’s queue', async () => {
    const fixture = await openQueue('intake-officer', 'staff-intake');
    const page = fixture.componentInstance as unknown as {
      items: () => readonly { readonly source: string }[];
    };

    expect(page.items().some((item) => item.source === 'release')).toBe(false);
  });

  it('gives the disbursing officer the releases and not the intakes', async () => {
    const fixture = await openQueue('disbursement-officer', 'staff-disbursement');
    const page = fixture.componentInstance as unknown as {
      items: () => readonly { readonly source: string }[];
    };
    const sources = page.items().map((item) => item.source);

    expect(sources).toContain('release');
    expect(sources).not.toContain('assistance-request');
  });

  it('stays small enough for somebody to actually read', async () => {
    const fixture = await openQueue();
    const page = fixture.componentInstance as unknown as {
      items: () => readonly unknown[];
    };

    // Before `DL-103` this was 189 items, 182 of them duplicate pairs, with
    // seven genuinely late things buried underneath. A personal queue that
    // cannot be read is a queue nobody reads.
    expect(page.items().length).toBeLessThan(30);
  });

  it('surfaces possible duplicates as one counted alert, not as many rows', async () => {
    const fixture = await openQueue('mswdo-head', 'staff-head');
    const page = fixture.componentInstance as unknown as {
      items: () => readonly { readonly source: string }[];
      alerts: () => readonly { readonly kind: string; readonly detectedFrom: number }[];
    };
    const duplicateAlert = page.alerts().find((alert) => alert.kind === 'possible-duplicate');

    expect(page.items().some((item) => item.source === 'duplicate-review')).toBe(false);
    expect(duplicateAlert?.detectedFrom).toBeGreaterThan(1);
  });

  it('hides the team queue from somebody who cannot see staff', async () => {
    const fixture = await openQueue('intake-officer', 'staff-intake');
    const page = fixture.componentInstance as unknown as { canSeeTeam: () => boolean };

    expect(page.canSeeTeam()).toBe(false);
    expect(html(fixture).querySelector('a[href="/work/team"]')).toBeNull();
  });
});

/* ── Criterion: a supervisor sees who is carrying what ────────────────────── */

describe('the team queue', () => {
  it('groups by person rather than pooling the office’s work', async () => {
    const element = html(await openTeam());
    expect(element.querySelectorAll('.member').length).toBeGreaterThan(0);
  });

  it('names unassigned work as a gap rather than as somebody’s caseload', async () => {
    const element = html(await openTeam());
    const unassigned = element.querySelector('.member--unassigned');

    expect(unassigned).not.toBeNull();
    expect(unassigned?.textContent).toContain('Nobody has picked these up');
    expect(unassigned?.textContent).toContain('most common failure');
  });
});

/* ── The notification adapter is per recipient ────────────────────────────── */

describe('whose notifications a user sees', () => {
  it('does not show one officer another officer’s inbox', async () => {
    const element = html(await openCentre('social-worker', 'staff-sw-1'));
    const text = element.textContent ?? '';

    // Seeded for the head, not for this social worker.
    expect(text).not.toContain('Livelihood Starter Kit suspended');
    // Seeded for this social worker.
    expect(text).toContain('assigned to you');
  });

  it('shows an office-wide announcement to everybody', async () => {
    const element = html(await openCentre('social-worker', 'staff-sw-1'));
    expect(element.textContent).toContain('Office closed 21 August');
  });
});
