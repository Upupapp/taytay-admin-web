import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { defer, firstValueFrom, of, throwError, type Observable } from 'rxjs';

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

/*
 * The seed is anchored at 2026-08-01 and its upcoming events run to 2026-10-10. Read against the
 * real clock they all became past events, and on 2026-11-05 two tests here failed on a tree nobody
 * had changed — "has not happened" had quietly become false. The screens ask `new Date()`, so the
 * spec pins `Date` to the week these tests were written in. Only `Date` is faked: timers and
 * promises stay real, so TestBed and the mock latency behave as they always did.
 */
const SEED_PRESENT = new Date('2026-08-17T00:00:00.000Z');

/*
 * The first test here pays for compiling the event screens. Alone it takes about a second; inside
 * the full suite on a low-memory machine it took 5.8 s and failed the default 5 s limit on a tree
 * that was correct. A timeout is not an assertion, so it is raised for this file only.
 */
vi.setConfig({ testTimeout: 20_000 });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(SEED_PRESENT);
});

afterEach(() => {
  vi.useRealTimers();
});

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

async function openCorrection(
  eventId: string,
  role: StaffRole = 'mswdo-head',
  id = 'staff-head',
): Promise<ComponentFixture<EventComposerPage>> {
  await configure(staffUser(role, id));
  const fixture = TestBed.createComponent(EventComposerPage);
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
      expect.arrayContaining([
        'Reference',
        'Name',
        'Barangay',
        'Registered',
        'Status',
        'Attendance',
      ]),
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
      'identityVerified',
      'nameSource',
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

describe('the registrant export', () => {
  const made: string[] = [];
  const revoked: string[] = [];
  const originals = {
    create: Object.getOwnPropertyDescriptor(URL, 'createObjectURL'),
    revoke: Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL'),
  };

  beforeEach(() => {
    made.length = 0;
    revoked.length = 0;
    // jsdom has no object URLs; these stand in and record what the page makes and gives back.
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: () => {
        const url = `blob:test/${made.length + 1}`;
        made.push(url);
        return url;
      },
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: (url: string) => revoked.push(url),
    });
  });

  afterEach(() => {
    for (const [name, descriptor] of [
      ['createObjectURL', originals.create],
      ['revokeObjectURL', originals.revoke],
    ] as const) {
      if (descriptor === undefined) {
        Reflect.deleteProperty(URL, name);
      } else {
        Object.defineProperty(URL, name, descriptor);
      }
    }
  });

  it('hands over a file to save, named, and gives its address back when the page goes', async () => {
    const fixture = await openEvent('event-0003');
    const exportButton = [...html(fixture).querySelectorAll('button')].find(
      (b) => (b.textContent ?? '').trim() === 'Export the list',
    );
    exportButton?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const link = html(fixture).querySelector<HTMLAnchorElement>('a[download]');
    expect(link?.getAttribute('href')).toBe('blob:test/1');
    expect(link?.textContent?.trim()).toBe(`Save ${link?.getAttribute('download') ?? ''}`);
    expect(text(fixture)).toContain('The file is ready.');

    fixture.destroy();
    expect(revoked).toEqual(['blob:test/1']);
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
      startsAt: { set: (value: string) => void };
      endsAt: { set: (value: string) => void };
      canSave: () => boolean;
      publishProblems: () => readonly string[];
    };
    page.title.set('Medical mission — Dolores');
    // The dates are the one thing a draft is asked for: a saved event has them (`DL-192`).
    page.startsAt.set('2026-09-20T09:00');
    page.endsAt.set('2026-09-20T12:00');
    await fixture.whenStable();

    expect(page.canSave()).toBe(true);
    // …while still naming everything that would stop it going out.
    expect(page.publishProblems().length).toBeGreaterThan(0);
  });

  it('will not save a draft with no dates, and says which', async () => {
    const fixture = await openComposer();
    const page = fixture.componentInstance as unknown as {
      title: { set: (value: string) => void };
      canSave: () => boolean;
      blockingProblems: () => readonly string[];
    };
    page.title.set('Medical mission — Dolores');
    await fixture.whenStable();

    expect(page.canSave()).toBe(false);
    expect(page.blockingProblems().join(' ')).toContain('Choose when it starts.');
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

/* ── "Try again" re-reads (DL-186) ────────────────────────────────────────── */

describe('"Try again" on the event list', () => {
  it('reads the events again after a failure, though the page wires no reload of its own', async () => {
    await configure(staffUser('mswdo-head', 'staff-head'));
    const repository = TestBed.inject(EVENT_REPOSITORY);
    const real = repository.list.bind(repository);
    let reads = 0;
    // Counted when the read is made, as an HTTP request is, not when it is asked for.
    vi.spyOn(repository, 'list').mockImplementation((...args) =>
      defer(() => {
        reads += 1;
        return reads === 1
          ? throwError(() => new Error('The server did not answer.'))
          : real(...args);
      }),
    );
    await TestBed.inject(Router).navigateByUrl('/events');
    const fixture = TestBed.createComponent(EventListPage);
    await fixture.whenStable();
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).toContain('The server did not answer.');

    const again = [...element.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Try again'),
    );
    expect(again).toBeDefined();
    again?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(reads).toBe(2);
    expect(element.textContent).not.toContain('The server did not answer.');
  });
});

/* ── A cover is uploaded, and read through the data layer (DL-193) ────────── */

describe('an event’s cover', () => {
  const made: string[] = [];
  const revoked: string[] = [];
  const originals = {
    create: Object.getOwnPropertyDescriptor(URL, 'createObjectURL'),
    revoke: Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL'),
  };

  beforeEach(() => {
    made.length = 0;
    revoked.length = 0;
    // jsdom has no object URLs; these stand in and record what the page makes and gives back.
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: () => {
        const url = `blob:test/${made.length + 1}`;
        made.push(url);
        return url;
      },
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: (url: string) => revoked.push(url),
    });
  });

  afterEach(() => {
    for (const [name, descriptor] of [
      ['createObjectURL', originals.create],
      ['revokeObjectURL', originals.revoke],
    ] as const) {
      if (descriptor === undefined) {
        Reflect.deleteProperty(URL, name);
      } else {
        Object.defineProperty(URL, name, descriptor);
      }
    }
  });

  it('is a file taken by the field that refuses before sending, with its description beside it', async () => {
    const fixture = await openComposer();
    const section = html(fixture).querySelector('section[aria-labelledby="image-heading"]');

    expect(section?.querySelector('app-image-file-field input[type="file"]')).not.toBeNull();
    expect(section?.querySelector('input[type="url"]')).toBeNull();
    expect(section?.textContent).toContain('Describe the image');
    expect(section?.textContent).toContain('never a link to another site');
    // Nothing is said about storing an image nobody chose.
    expect(text(fixture)).not.toContain('Saving this draft with a cover image');
  });

  it('says what saving does to the image before the button, and hands the file to be stored', async () => {
    const fixture = await openComposer();
    const save = vi.spyOn(TestBed.inject(EVENT_REPOSITORY), 'saveDraft');
    const page = fixture.componentInstance as unknown as {
      title: { set: (value: string) => void };
      startsAt: { set: (value: string) => void };
      endsAt: { set: (value: string) => void };
      cover: { set: (value: Blob | null) => void };
      altText: { set: (value: string) => void };
      save: () => Promise<void>;
    };
    const file = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a])], {
      type: 'image/png',
    });
    page.title.set('Feeding programme');
    page.startsAt.set('2026-12-01T09:00');
    page.endsAt.set('2026-12-01T11:00');
    page.cover.set(file);
    page.altText.set('Volunteers handing out food packs.');
    await fixture.whenStable();
    fixture.detectChanges();

    const effects = html(fixture).querySelector('.composer__effects');
    const submit = html(fixture).querySelector('button[type="submit"]');
    expect(effects?.textContent).toContain('the image stays stored, unused');
    expect(effects?.textContent).toContain('not once it is cancelled');
    expect(
      effects !== null &&
        submit !== null &&
        (effects.compareDocumentPosition(submit) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
    ).toBe(true);

    await page.save();
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({
        image: { kind: 'chosen', file, altText: 'Volunteers handing out food packs.' },
      }),
      null,
    );
  });

  it('is read only when asked, shown with the office’s words, and given back when the page goes', async () => {
    const fixture = await openEvent('event-0001');
    const read = vi.spyOn(TestBed.inject(EVENT_REPOSITORY), 'coverImage');
    fixture.detectChanges();

    expect(html(fixture).querySelector('img')).toBeNull();
    expect(read).not.toHaveBeenCalled();

    const show = [...html(fixture).querySelectorAll('button')].find(
      (b) => (b.textContent ?? '').trim() === 'Show the cover image',
    );
    show?.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(read).toHaveBeenCalledTimes(1);
    const image = html(fixture).querySelector('img.event__image');
    expect(image?.getAttribute('src')).toBe('blob:test/1');
    expect(image?.getAttribute('alt')).toContain('Municipal Hall lobby');
    expect(html(fixture).querySelector('figcaption')?.textContent).toContain(
      'Municipal Hall lobby',
    );

    fixture.destroy();
    expect(revoked).toEqual(['blob:test/1']);
  });

  it('draws no picture on the list, where each would be a request of its own', async () => {
    const fixture = await openList();
    fixture.detectChanges();

    expect(html(fixture).querySelector('img')).toBeNull();
  });
});

/* ── DL-195: corrections, the safe limit, check-in and who may register ──── */

describe('correcting a published event (DL-195)', () => {
  interface CorrectionPage {
    title: () => string;
    venueName: { set: (value: string) => void };
    reminders: { set: (value: string) => void };
    reason: { set: (value: string) => void };
    tellRegistrants: () => boolean;
    canCorrect: () => boolean;
    correctionEffects: () => readonly string[];
    correctionBlocks: () => readonly string[];
    saveCorrection: () => Promise<void>;
  }

  it('is offered on a published event that has not started, to somebody who may publish', async () => {
    const head = await openEvent('event-0002');
    expect(text(head)).toContain('Correct this event');
    const started = await openEvent('event-0006');
    expect(text(started)).not.toContain('Correct this event');
    const cancelled = await openEvent('event-0007');
    expect(text(cancelled)).not.toContain('Correct this event');
    const auditor = await openEvent('event-0002', 'auditor', 'staff-auditor');
    expect(text(auditor)).not.toContain('Correct this event');
  });

  it('starts from the event, asks why, and leaves residents untold unless asked', async () => {
    const fixture = await openCorrection('event-0002');
    const page = fixture.componentInstance as unknown as CorrectionPage;
    expect(page.title()).toContain('Medical mission');
    expect(page.tellRegistrants()).toBe(false);
    expect(page.correctionEffects()).toEqual([
      'Changes nothing yet. Nothing is recorded and nobody is told.',
    ]);
    page.reminders.set('Bring a valid ID and your own water.');
    await fixture.whenStable();
    expect(page.correctionEffects().join(' ')).toContain('Sends residents no notice.');
    expect(page.canCorrect()).toBe(false);
    expect(page.correctionBlocks().join(' ')).toContain('Say why it is corrected');
  });

  it('says before its button that a new venue tells everybody holding a place', async () => {
    const fixture = await openCorrection('event-0002');
    const page = fixture.componentInstance as unknown as CorrectionPage;
    page.venueName.set('Taytay municipal gym');
    page.reason.set('The covered court is under repair.');
    await fixture.whenStable();

    const said = page.correctionEffects().join(' ');
    expect(said).toContain('Changes the venue.');
    expect(said).toContain('with the old and the new date, time and venue');
    expect(page.canCorrect()).toBe(true);
    const effectsAt = text(fixture).indexOf('Saving this correction:');
    const buttonAt = text(fixture).indexOf('Save the correction');
    expect(effectsAt).toBeGreaterThan(-1);
    expect(effectsAt).toBeLessThan(buttonAt);

    await page.saveCorrection();
    const repository = TestBed.inject(EVENT_REPOSITORY);
    const corrected = await firstValueFrom(repository.getById(asId('event-0002')));
    expect(corrected?.venue.name).toBe('Taytay municipal gym');
    const history = await firstValueFrom(repository.history(asId('event-0002')));
    expect(history[0]?.summary).toContain('Corrected after publication: the venue.');
    expect(history[0]?.reason).toBe('The covered court is under repair.');
  });

  it('says the event cannot be corrected once it has started', async () => {
    const fixture = await openCorrection('event-0006');
    expect(text(fixture)).toContain('only a published event that has not started can be');
    expect(buttons(fixture)).not.toContain('Save the correction');
  });
});

describe('the safe limit and who may register (DL-195)', () => {
  it('explains the safe limit in plain words on the composer', async () => {
    const fixture = await openComposer();
    const page = fixture.componentInstance as unknown as {
      registrationRequired: { set: (value: boolean) => void };
    };
    page.registrationRequired.set(true);
    await fixture.whenStable();
    expect(text(fixture)).toContain('occupant load posted at the venue');
    expect(text(fixture)).toContain('Who may register');
  });

  it('ticks and fixes "gives out cash, goods or a benefit" for a payout', async () => {
    const fixture = await openComposer();
    const page = fixture.componentInstance as unknown as {
      category: { set: (value: string) => void };
      registrationRequired: { set: (value: boolean) => void };
      draft: () => { registration: { givesOutBenefit: boolean } };
    };
    page.registrationRequired.set(true);
    page.category.set('payout');
    await fixture.whenStable();
    expect(page.draft().registration.givesOutBenefit).toBe(true);
    expect(text(fixture)).toContain('This kind of event always gives something out');
  });

  it('shows the safe limit beside the counts, and who may register in the preview', async () => {
    const fixture = await openEvent('event-0002');
    expect(text(fixture)).toContain('Safe limit: 230.');
    expect(text(fixture)).toContain('Residents whose ID the office has verified');
  });
});

describe('check-in mode (DL-195)', () => {
  it('finds one registrant and never puts the list on the screen', async () => {
    const fixture = await openEvent('event-0003');
    expect(html(fixture).querySelector('table.registrants')).not.toBeNull();
    const page = fixture.componentInstance as unknown as { toggleCheckIn: () => void };
    page.toggleCheckIn();
    await fixture.whenStable();

    expect(html(fixture).querySelector('table.registrants')).toBeNull();
    expect(html(fixture).querySelector('app-event-check-in')).not.toBeNull();
    expect(text(fixture)).toContain('never shows the list');
    expect(buttons(fixture)).toContain('Leave check-in mode');
  });

  it('is not offered to a reader who cannot mark attendance', async () => {
    const fixture = await openEvent('event-0003', 'auditor', 'staff-auditor');
    expect(buttons(fixture)).not.toContain('Check-in mode');
  });
});
