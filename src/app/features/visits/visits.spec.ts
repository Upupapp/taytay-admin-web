import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockFieldVisitRepository } from '@data/mock/mock-field-visit.repository';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import {
  ACCESS_CONTEXT,
  FIELD_VISIT_REPOSITORY,
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

import { VisitDetailPage } from './visit-detail-page';
import { VisitListPage } from './visit-list-page';

const TEST_ENVIRONMENT: AppEnvironment = {
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  mockLatencyMs: 0,
  enableDevTools: false,
};

/** Completed, with all four observation kinds recorded. */
const COMPLETED = 'fv-0001';
/** Still scheduled, and its date has passed on the seed anchor. */
const OVERDUE = 'fv-0004';
/** Declined by the household, with their reason kept. */
const REFUSED = 'fv-0003';

function staffUser(role: StaffRole): StaffUser {
  return {
    id: asId<StaffUserId>('staff-sw-1'),
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

async function configure(role: StaffRole): Promise<void> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'visits', component: VisitListPage },
        { path: 'visits/:id', component: VisitDetailPage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(staffUser(role)) },
      { provide: FIELD_VISIT_REPOSITORY, useClass: MockFieldVisitRepository },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function openList(
  role: StaffRole = 'social-worker',
): Promise<ComponentFixture<VisitListPage>> {
  await configure(role);
  await TestBed.inject(Router).navigateByUrl('/visits');
  const fixture = TestBed.createComponent(VisitListPage);
  await fixture.whenStable();
  return fixture;
}

async function openDetail(
  id: string,
  role: StaffRole = 'social-worker',
): Promise<ComponentFixture<VisitDetailPage>> {
  await configure(role);
  await TestBed.inject(Router).navigateByUrl(`/visits/${id}`);
  const fixture = TestBed.createComponent(VisitDetailPage);
  fixture.componentRef.setInput('id', id);
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

/* ── Criterion: overdue follow-ups are visible ────────────────────────────── */

describe('the visit list', () => {
  it('surfaces a visit past its date, and says the office owes it', async () => {
    const element = html(await openList());
    const overdue = element.querySelector('.bucket--overdue');

    expect(overdue?.textContent).toContain('Past its date');
    expect(overdue?.textContent).toContain('The office owes this visit, not the family');
  });

  it('groups into buckets rather than paging', async () => {
    const element = html(await openList());
    expect(element.querySelectorAll('.bucket').length).toBeGreaterThan(1);
  });
});

/* ── Criterion: notes distinguish source and type ─────────────────────────── */

describe('what was found', () => {
  it('labels each entry with whose claim it is', async () => {
    const element = html(await openDetail(COMPLETED));
    const kinds = [...element.querySelectorAll('.observations__kind')].map((node) =>
      (node.textContent ?? '').trim(),
    );

    expect(kinds).toContain('Seen by the worker');
    expect(kinds).toContain('Said by the client');
    expect(kinds).toContain('Said by someone else');
    expect(kinds).toContain('The worker’s assessment');
  });

  it('names who a third-party account came from', async () => {
    const element = html(await openDetail(COMPLETED));
    expect(element.querySelector('.observations__who')?.textContent).toContain('kagawad');
  });

  it('asks for the kind before the words', async () => {
    const fixture = await openDetail(OVERDUE);
    const element = html(fixture);
    const form = element.querySelector('.kinds');
    const textarea = element.querySelector('.field textarea');

    expect(form).not.toBeNull();
    // The radio group precedes the body field in document order, so a worker
    // chooses the kind before writing rather than reclassifying afterwards.
    expect(form?.compareDocumentPosition(textarea as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('requires an attribution before a third-party entry can be added', async () => {
    const fixture = await openDetail(OVERDUE);
    const page = fixture.componentInstance as unknown as {
      onKind: (kind: string) => void;
      body: { set: (value: string) => void };
      attribution: { set: (value: string) => void };
      canAddObservation: () => boolean;
    };

    page.onKind('third-party-said');
    page.body.set('Said she has been managing alone since March.');
    fixture.detectChanges();
    expect(page.canAddObservation()).toBe(false);

    page.attribution.set('Barangay kagawad, Purok 5');
    fixture.detectChanges();
    expect(page.canAddObservation()).toBe(true);
  });
});

/* ── Criterion: no unnecessary location or sensitive data ─────────────────── */

describe('the visit record holds no location', () => {
  it('shows the address visited and nothing about where the worker was', async () => {
    const element = html(await openDetail(COMPLETED));
    const text = (element.textContent ?? '').toLowerCase();

    expect(text).toContain('address visited');
    for (const word of ['coordinates', 'latitude', 'longitude', 'gps', 'checked in']) {
      expect(text).not.toContain(word);
    }
  });
});

/* ── Closing ──────────────────────────────────────────────────────────────── */

describe('closing a visit', () => {
  it('keeps a household’s words to a declined visit', async () => {
    const element = html(await openDetail(REFUSED));
    expect(element.textContent).toContain('does not want a monitoring visit');
  });

  it('says a closed visit cannot be changed', async () => {
    const element = html(await openDetail(REFUSED));
    expect(element.textContent).toContain('This visit is closed');
  });

  it('will not close without an outcome', async () => {
    const fixture = await openDetail(OVERDUE);
    const page = fixture.componentInstance as unknown as {
      canClose: () => boolean;
      outcomeText: { set: (value: string) => void };
    };

    expect(page.canClose()).toBe(false);
    page.outcomeText.set('Household seen; solo parent support recommended.');
    fixture.detectChanges();
    expect(page.canClose()).toBe(true);
  });

  it('hides the recording controls from a role that may only read', async () => {
    const element = html(await openDetail(OVERDUE, 'auditor'));

    expect(element.querySelector('#close-heading')).toBeNull();
    expect(element.querySelector('.kinds')).toBeNull();
    // …but the visit itself is still readable.
    expect(element.querySelector('#about-heading')).not.toBeNull();
  });
});
