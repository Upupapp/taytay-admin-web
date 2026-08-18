import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockEventRepository } from '@data/mock/mock-event.repository';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import {
  ACCESS_CONTEXT,
  EVENT_REPOSITORY,
  NOTIFICATION_REPOSITORY,
  STAFF_REPOSITORY,
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

import { EventComposerPage } from './event-composer-page';
import { EventDetailPage } from './event-detail-page';
import { EventListPage } from './event-list-page';

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
        { path: 'events', component: EventListPage },
        { path: 'events/new', component: EventComposerPage },
        { path: 'events/:id', component: EventDetailPage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(user) },
      { provide: EVENT_REPOSITORY, useClass: MockEventRepository },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function openList(
  role: StaffRole = 'mswdo-head',
  id = 'staff-head',
): Promise<ComponentFixture<EventListPage>> {
  await configure(staffUser(role, id));
  await TestBed.inject(Router).navigateByUrl('/events');
  const fixture = TestBed.createComponent(EventListPage);
  await fixture.whenStable();
  return fixture;
}

async function openComposer(): Promise<ComponentFixture<EventComposerPage>> {
  await configure(staffUser('mswdo-head', 'staff-head'));
  await TestBed.inject(Router).navigateByUrl('/events/new');
  const fixture = TestBed.createComponent(EventComposerPage);
  await fixture.whenStable();
  return fixture;
}

async function openEvent(
  eventId: string,
  role: StaffRole = 'mswdo-head',
  id = 'staff-head',
): Promise<ComponentFixture<EventDetailPage>> {
  await configure(staffUser(role, id));
  await TestBed.inject(Router).navigateByUrl(`/events/${eventId}`);
  const fixture = TestBed.createComponent(EventDetailPage);
  fixture.componentRef.setInput('id', eventId);
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
const text = (fixture: ComponentFixture<unknown>) => html(fixture).textContent ?? '';
const buttons = (fixture: ComponentFixture<unknown>) =>
  [...html(fixture).querySelectorAll('button')].map((b) => (b.textContent ?? '').trim());

/* ── Criterion: the capacity UI does not pretend to be the backend ────────── */

describe('what the office is told about capacity', () => {
  it('prints the moment the numbers were taken', async () => {
    const fixture = await openEvent('event-0003');

    expect(text(fixture)).toContain('Counted at');
  });

  it('says in words that the count can already be stale', async () => {
    const fixture = await openEvent('event-0003');

    expect(text(fixture)).toContain('were true when this screen last asked');
    expect(text(fixture)).toContain('decides who gets the last place');
  });

  it('still offers promotion on a waitlisted row when its own figures say full', async () => {
    // The livelihood training is seeded at capacity with a waitlist behind it.
    const fixture = await openEvent('event-0003');
    const page = fixture.componentInstance as unknown as {
      overCapacity: () => boolean;
      registrants: () => readonly { status: string }[];
      canPromote: (row: { status: string }) => boolean;
    };
    const waitlisted = page.registrants().find((row) => row.status === 'waitlisted');

    expect(waitlisted).toBeDefined();
    expect(page.overCapacity()).toBe(true);
    // Warned, never blocked (`DL-129`).
    expect(page.canPromote(waitlisted as { status: string })).toBe(true);
    expect(text(fixture)).toContain('The backend decides');
  });
});

/* ── Criterion: nobody becomes a no-show by the calendar ──────────────────── */

describe('an event that has happened but is not closed', () => {
  it('is offered a completion, and says what completing does first', async () => {
    // The assembly was held nine days ago and is still `published`.
    const fixture = await openEvent('event-0006');

    expect(buttons(fixture)).toContain('Mark completed');
    expect(text(fixture)).toContain('Anybody still unmarked stays unmarked');
  });

  it('reports the unmarked as unmarked rather than as no-shows', async () => {
    const fixture = await openEvent('event-0006');
    const page = fixture.componentInstance as unknown as { attendanceLine: () => string };

    expect(page.attendanceLine()).toContain('not yet marked');
  });

  it('does not offer a completion on an event that has not happened', async () => {
    const fixture = await openEvent('event-0002');

    expect(buttons(fixture)).not.toContain('Mark completed');
  });
});

/* ── Criterion: cancelling reaches everybody and cannot be undone ─────────── */

describe('cancelling an event', () => {
  it('warns before the button, not after it', async () => {
    const fixture = await openEvent('event-0002');

    expect(text(fixture)).toContain('cannot be undone');
    expect(text(fixture)).toContain('it is a new event');
  });

  it('asks twice, and offers keeping it as the alternative', async () => {
    const fixture = await openEvent('event-0002');
    const page = fixture.componentInstance as unknown as {
      reason: { set: (value: string) => void };
      cancelling: () => unknown;
    };
    page.reason.set('Partner clinic withdrew.');
    await fixture.whenStable();
    const cancel = [...html(fixture).querySelectorAll('button')].find(
      (b) => (b.textContent ?? '').trim() === 'Cancel event',
    );
    cancel?.click();
    await fixture.whenStable();

    expect(page.cancelling()).not.toBeNull();
    expect(text(fixture)).toContain('cannot be reversed');
  });

  it('offers no way back on an already cancelled event', async () => {
    const fixture = await openEvent('event-0007');
    const labels = buttons(fixture);

    for (const forbidden of ['Publish', 'Cancel event', 'Mark completed']) {
      expect(labels).not.toContain(forbidden);
    }
    expect(labels).toContain('Archive');
  });

  it('refuses to act without a recorded reason', async () => {
    const fixture = await openEvent('event-0002');
    const cancel = [...html(fixture).querySelectorAll('button')].find(
      (b) => (b.textContent ?? '').trim() === 'Cancel event',
    );

    expect(cancel?.disabled).toBe(true);
  });
});

/* ── Criterion: no unnecessary resident PII in the list ───────────────────── */

describe('the registrant table', () => {
  it('shows the reference, name, barangay, date and two statuses, and nothing else', async () => {
    const fixture = await openEvent('event-0003');
    const headers = [...html(fixture).querySelectorAll('.registrants th')].map((n) =>
      (n.textContent ?? '').trim(),
    );

    expect(headers).toEqual(
      expect.arrayContaining(['Reference', 'Name', 'Barangay', 'Registered', 'Status', 'Attendance']),
    );
    for (const forbidden of ['Address', 'Birth date', 'PhilSys', 'Income', 'Sector', 'Household']) {
      expect(headers).not.toContain(forbidden);
    }
  });

  it('hands the screen rows that have no other field to leak', async () => {
    const fixture = await openEvent('event-0003');
    const page = fixture.componentInstance as unknown as {
      registrants: () => readonly Record<string, unknown>[];
    };
    const row = page.registrants()[0];

    expect(row).toBeDefined();
    expect(Object.keys(row as Record<string, unknown>).sort()).toEqual([
      'attendance',
      'barangayId',
      'displayName',
      'id',
      'notes',
      'reference',
      'registeredAt',
      'status',
    ]);
  });

  it('says plainly that nobody is registered from this console', async () => {
    const fixture = await openEvent('event-0003');

    // The one capability the resident contract reserves (`DL-123`).
    expect(text(fixture)).toContain('Nobody is added from here');
  });
});

/* ── Criterion: only authorised users act ─────────────────────────────────── */

describe('the read-only executive', () => {
  it('is offered no publish, cancel, archive or attendance control', async () => {
    const fixture = await openEvent('event-0002', 'auditor', 'staff-auditor');
    const labels = buttons(fixture);

    for (const forbidden of ['Publish', 'Cancel event', 'Archive', 'Attended', 'No-show']) {
      expect(labels).not.toContain(forbidden);
    }
  });

  it('is offered no export of the registrant list', async () => {
    const fixture = await openEvent('event-0002', 'auditor', 'staff-auditor');

    expect(buttons(fixture)).not.toContain('Export the list');
  });

  it('is not offered the composer', async () => {
    const fixture = await openList('auditor', 'staff-auditor');
    const links = [...html(fixture).querySelectorAll('a')].map((a) => (a.textContent ?? '').trim());

    expect(links).not.toContain('Create an event');
  });

  it('can still read the event and its registration summary', async () => {
    const fixture = await openEvent('event-0002', 'auditor', 'staff-auditor');

    expect(text(fixture)).toContain('What residents see');
    expect(text(fixture)).toContain('Registration');
  });
});

/* ── Criterion: the flow stays simple ─────────────────────────────────────── */

describe('what the composer deliberately does not offer', () => {
  it('has no ticketing, pricing, seat map or promo field', async () => {
    const fixture = await openComposer();
    const labels = [...html(fixture).querySelectorAll('.field__label')].map((n) =>
      (n.textContent ?? '').trim(),
    );

    for (const forbidden of ['Price', 'Ticket', 'Seat', 'Promo code', 'Payment', 'Fee']) {
      expect(labels).not.toContain(forbidden);
    }
  });

  it('has no recurrence field', async () => {
    const fixture = await openComposer();

    expect(text(fixture)).not.toMatch(/recurring|repeats|every week/i);
  });

  it('states the timezone on the form', async () => {
    const fixture = await openComposer();

    expect(text(fixture)).toContain('Asia/Manila');
  });

  it('says registration comes from the mobile app, not from here', async () => {
    const fixture = await openComposer();

    expect(text(fixture)).toContain('Residents register in the mobile app');
  });
});

describe('what the composer refuses', () => {
  it('will not save an event that ends before it starts', async () => {
    const fixture = await openComposer();
    const page = fixture.componentInstance as unknown as {
      title: { set: (value: string) => void };
      startsAt: { set: (value: string) => void };
      endsAt: { set: (value: string) => void };
      canSave: () => boolean;
      blockingProblems: () => readonly string[];
    };
    page.title.set('Medical mission');
    page.startsAt.set('2026-09-20T09:00');
    page.endsAt.set('2026-09-20T08:00');
    await fixture.whenStable();

    // Not an incomplete form — a wrong one.
    expect(page.canSave()).toBe(false);
    expect(page.blockingProblems().join(' ')).toContain('cannot end before it starts');
  });

  it('will not save a waitlist with no capacity', async () => {
    const fixture = await openComposer();
    const page = fixture.componentInstance as unknown as {
      title: { set: (value: string) => void };
      registrationRequired: { set: (value: boolean) => void };
      waitlist: { set: (value: boolean) => void };
      canSave: () => boolean;
    };
    page.title.set('Livelihood training');
    page.registrationRequired.set(true);
    page.waitlist.set(true);
    await fixture.whenStable();

    expect(page.canSave()).toBe(false);
  });

  it('saves a half-filled draft, because that is somebody working', async () => {
    const fixture = await openComposer();
    const page = fixture.componentInstance as unknown as {
      title: { set: (value: string) => void };
      canSave: () => boolean;
      publishProblems: () => readonly string[];
    };
    page.title.set('Medical mission — Dolores');
    await fixture.whenStable();

    expect(page.canSave()).toBe(true);
    // …while still naming everything that would stop it going out.
    expect(page.publishProblems().length).toBeGreaterThan(0);
  });
});

/* ── The list ─────────────────────────────────────────────────────────────── */

describe('the events list', () => {
  it('opens on what is coming, soonest first', async () => {
    const fixture = await openList();
    const page = fixture.componentInstance as unknown as {
      view: () => string;
      events: () => readonly { startsAt: string }[];
    };
    const dates = page.events().map((row) => row.startsAt);

    expect(page.view()).toBe('upcoming');
    expect([...dates]).toEqual([...dates].sort());
  });

  it('shows registration state and the count against capacity on every row', async () => {
    const fixture = await openList();

    expect(text(fixture)).toContain('Registration');
    expect(text(fixture)).toContain('Registered');
  });

  it('tells an empty filter result apart from an empty calendar', async () => {
    const fixture = await openList();
    const page = fixture.componentInstance as unknown as {
      hasFilters: () => boolean;
      category: { set: (value: string) => void };
    };
    expect(page.hasFilters()).toBe(false);
    page.category.set('seminar');
    await fixture.whenStable();

    expect(page.hasFilters()).toBe(true);
  });

  it('keeps a cancelled event out of Past', async () => {
    const fixture = await openList();
    const page = fixture.componentInstance as unknown as {
      onView: (view: string) => void;
      events: () => readonly { status: string }[];
    };
    page.onView('past');
    await fixture.whenStable();

    expect(page.events().every((row) => row.status !== 'cancelled')).toBe(true);
  });
});
