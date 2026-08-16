import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import { MockReferralRepository } from '@data/mock/mock-referral.repository';
import {
  ACCESS_CONTEXT,
  NOTIFICATION_REPOSITORY,
  REFERRAL_REPOSITORY,
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
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { ProviderDirectoryPage } from './provider-directory-page';
import { ReferralDetailPage } from './referral-detail-page';
import { ReferralListPage } from './referral-list-page';
import { readReferralQuery } from './referral-query';

const TEST_ENVIRONMENT: AppEnvironment = {
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  mockLatencyMs: 0,
  enableDevTools: false,
};

/** Sent, answered, and the disclosure narrow — a protection case. */
const PROTECTION = 'ref-0001';
/** Overdue on the seed anchor and never answered. */
const OVERDUE = 'ref-0003';
/** Still a draft: no lawful basis recorded, so no sheet. */
const DRAFT = 'ref-0005';

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
    signIn: (): Observable<AuthenticatedUser> => of(authenticated),
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
        { path: 'referrals', component: ReferralListPage },
        { path: 'referrals/providers', component: ProviderDirectoryPage },
        { path: 'referrals/:id', component: ReferralDetailPage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(staffUser(role)) },
      { provide: REFERRAL_REPOSITORY, useClass: MockReferralRepository },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function openList(role: StaffRole = 'social-worker'): Promise<ComponentFixture<ReferralListPage>> {
  await configure(role);
  await TestBed.inject(Router).navigateByUrl('/referrals');
  const fixture = TestBed.createComponent(ReferralListPage);
  await fixture.whenStable();
  return fixture;
}

async function openDetail(
  id: string,
  role: StaffRole = 'social-worker',
): Promise<ComponentFixture<ReferralDetailPage>> {
  await configure(role);
  await TestBed.inject(Router).navigateByUrl(`/referrals/${id}`);
  const fixture = TestBed.createComponent(ReferralDetailPage);
  fixture.componentRef.setInput('id', id);
  await fixture.whenStable();
  return fixture;
}

async function openDirectory(): Promise<ComponentFixture<ProviderDirectoryPage>> {
  await configure('social-worker');
  await TestBed.inject(Router).navigateByUrl('/referrals/providers');
  const fixture = TestBed.createComponent(ProviderDirectoryPage);
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

/* ── The URL is the filter ────────────────────────────────────────────────── */

describe('the referral filter lives in the URL', () => {
  const params = (values: Record<string, string>) => ({
    get: (name: string) => values[name] ?? null,
  });

  it('reads a filter back out of query parameters', () => {
    const query = readReferralQuery(params({ status: 'sent', urgency: 'urgent', overdue: 'true' }));

    expect(query.filter.status).toBe('sent');
    expect(query.filter.urgency).toBe('urgent');
    expect(query.filter.overdueOnly).toBe(true);
  });

  it('degrades junk rather than guessing', () => {
    expect(readReferralQuery(params({ status: 'pondering', urgency: 'immediate' })).filter).toEqual(
      {},
    );
  });
});

/* ── Criterion: overdue referrals surface ─────────────────────────────────── */

describe('the referral queue', () => {
  it('marks an unanswered referral past its chase date, in words', async () => {
    const element = html(await openList());
    const overdue = element.querySelector('.referrals__overdue');

    expect(overdue?.textContent?.trim()).toBe('Overdue');
  });

  it('does not mark one the office has heard back about', async () => {
    const element = html(await openList());
    const rows = [...element.querySelectorAll('tbody tr')];
    const answered = rows.find((row) => row.textContent?.includes('RF-2026-0039'));

    expect(answered?.querySelector('.referrals__overdue')).toBeNull();
  });

  it('says a draft has not been sent rather than showing it as due', async () => {
    const element = html(await openList());
    expect(element.textContent).toContain('Not sent yet');
  });
});

/* ── Criterion: minimum necessary disclosure ──────────────────────────────── */

describe('the summary sheet', () => {
  it('carries only what was authorised', async () => {
    const element = html(await openDetail(PROTECTION));
    const sheet = element.querySelector('.sheet');

    expect(sheet).not.toBeNull();
    // The plan shares her contact number and nothing else. Her address and
    // sector membership are on file and must not reach the sheet.
    expect(sheet?.textContent).toContain('Contact number');
    expect(sheet?.textContent).not.toContain('Purok');
    expect(sheet?.textContent).not.toContain('vawc-survivor');
  });

  it('prints the handling notice with the statute on it', async () => {
    const element = html(await openDetail(PROTECTION));
    expect(element.querySelector('.sheet__notice')?.textContent).toContain('RA 10173');
  });

  it('offers no sheet at all until a lawful basis is recorded', async () => {
    const element = html(await openDetail(DRAFT));

    expect(element.querySelector('.sheet')).toBeNull();
    expect(element.textContent).toContain('There is no sheet until the referral is sent');
  });

  it('says why a draft has disclosed nothing', async () => {
    const element = html(await openDetail(DRAFT));
    expect(element.textContent).toContain('recording a lawful basis is part of sending it');
  });

  it('shows staff what was shared and on whose authority', async () => {
    const element = html(await openDetail(PROTECTION));
    const text = element.textContent ?? '';

    expect(text).toContain('Basis for sharing');
    expect(text).toContain('Urgent');
    // Every shared field states the need it was shared for.
    expect(text).toContain('Because');
  });
});

/* ── Criterion: traceable, and recorded acts ──────────────────────────────── */

describe('working a referral', () => {
  it('will not record an outcome with nothing in it', async () => {
    const fixture = await openDetail(OVERDUE);
    const page = fixture.componentInstance as unknown as {
      canRecordOutcome: () => boolean;
      outcomeText: { set: (value: string) => void };
    };

    expect(page.canRecordOutcome()).toBe(false);
    page.outcomeText.set('PESO matched him to a plant in Angono; interview next week.');
    fixture.detectChanges();
    expect(page.canRecordOutcome()).toBe(true);
  });

  it('will not move a follow-up date without a reason', async () => {
    const fixture = await openDetail(OVERDUE);
    const page = fixture.componentInstance as unknown as {
      canReschedule: () => boolean;
      rescheduleDate: { set: (value: string) => void };
      rescheduleReason: { set: (value: string) => void };
    };

    page.rescheduleDate.set('2026-09-01');
    fixture.detectChanges();
    // A date alone is not enough: moving it quietly is how an overdue referral
    // stops being overdue without anybody acting on it.
    expect(page.canReschedule()).toBe(false);

    page.rescheduleReason.set('Spoke to PESO; they are waiting on the employer.');
    fixture.detectChanges();
    expect(page.canReschedule()).toBe(true);
  });

  it('shows the inter-office notes already recorded', async () => {
    const element = html(await openDetail(PROTECTION));
    expect(element.querySelector('.notes__body')?.textContent).toContain('Desk confirmed receipt');
  });

  it('hides the recording controls from a role that may only read', async () => {
    const element = html(await openDetail(PROTECTION, 'auditor'));

    expect(element.querySelector('#reschedule-heading')).toBeNull();
    // …but the referral itself is still readable.
    expect(element.querySelector('#about-heading')).not.toBeNull();
  });
});

/* ── The directory ────────────────────────────────────────────────────────── */

describe('the provider directory', () => {
  it('lists what each office actually does', async () => {
    const element = html(await openDirectory());
    expect(element.textContent).toContain('Job matching and referral to local employers');
  });

  it('says plainly when an office is not taking referrals', async () => {
    const element = html(await openDirectory());
    expect(element.querySelector('.providers__closed')?.textContent).toContain('Not accepting');
  });

  it('keeps a retired entry listed, so past referrals still make sense', async () => {
    const element = html(await openDirectory());
    expect(element.textContent).toContain('Rizal Provincial Social Welfare');
    expect(element.textContent).toContain('No longer used');
  });
});
