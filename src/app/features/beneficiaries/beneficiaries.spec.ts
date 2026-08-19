import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockBeneficiaryRepository } from '@data/mock/mock-beneficiary.repository';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import { MockProgramRepository } from '@data/mock/mock-program.repository';
import { MockSavedViewRepository } from '@data/mock/mock-saved-view.repository';
import {
  ACCESS_CONTEXT,
  BENEFICIARY_REPOSITORY,
  NOTIFICATION_REPOSITORY,
  PROGRAM_REPOSITORY,
  SAVED_VIEW_REPOSITORY,
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

import { BeneficiaryDetailPage } from './beneficiary-detail-page';
import { BeneficiaryListPage } from './beneficiary-list-page';
import { DuplicateReviewPage } from './duplicate-review-page';
import { readBeneficiaryQuery } from './beneficiary-query';

const TEST_ENVIRONMENT: AppEnvironment = {
  name: 'local-mock',
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  mockLatencyMs: 0,
  enableDevTools: false,
};

/** Aurora Mercado — enrolled, with history, and registered twice (res-0011). */
const AURORA = 'res-0001';

function staffUser(role: StaffRole): StaffUser {
  return {
    id: asId<StaffUserId>('staff-head'),
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
        { path: 'beneficiaries', component: BeneficiaryListPage },
        { path: 'beneficiaries/duplicates', component: DuplicateReviewPage },
        { path: 'beneficiaries/:id', component: BeneficiaryDetailPage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(staffUser(role)) },
      { provide: BENEFICIARY_REPOSITORY, useClass: MockBeneficiaryRepository },
      { provide: PROGRAM_REPOSITORY, useClass: MockProgramRepository },
      { provide: SAVED_VIEW_REPOSITORY, useClass: MockSavedViewRepository },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function openList(
  role: StaffRole = 'mswdo-head',
): Promise<ComponentFixture<BeneficiaryListPage>> {
  await configure(role);
  await TestBed.inject(Router).navigateByUrl('/beneficiaries');
  const fixture = TestBed.createComponent(BeneficiaryListPage);
  await fixture.whenStable();
  return fixture;
}

async function openDetail(
  id: string,
  role: StaffRole = 'mswdo-head',
): Promise<ComponentFixture<BeneficiaryDetailPage>> {
  await configure(role);
  await TestBed.inject(Router).navigateByUrl(`/beneficiaries/${id}`);
  const fixture = TestBed.createComponent(BeneficiaryDetailPage);
  fixture.componentRef.setInput('id', id);
  await fixture.whenStable();
  return fixture;
}

async function openQueue(
  role: StaffRole = 'mswdo-head',
): Promise<ComponentFixture<DuplicateReviewPage>> {
  await configure(role);
  await TestBed.inject(Router).navigateByUrl('/beneficiaries/duplicates');
  const fixture = TestBed.createComponent(DuplicateReviewPage);
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

/* ── The URL is the filter ────────────────────────────────────────────────── */

describe('the beneficiary filter lives in the URL', () => {
  const params = (values: Record<string, string>) => ({
    get: (name: string) => values[name] ?? null,
  });

  it('reads a filter back out of query parameters', () => {
    const query = readBeneficiaryQuery(
      params({ q: 'mercado', standing: 'beneficiary', from: '2026-01-01' }),
    );

    expect(query.filter.search).toBe('mercado');
    expect(query.filter.role).toBe('beneficiary');
    expect(query.filter.receivedFrom).toBe('2026-01-01');
  });

  it('degrades junk to no filter rather than guessing', () => {
    const filter = readBeneficiaryQuery(
      params({ standing: 'vibes', barangay: 'atlantis', from: 'last tuesday' }),
    ).filter;

    expect(filter).toEqual({});
  });

  it('discards a date that parses but is not a real day', () => {
    // 31 February reads as a valid shape and would otherwise roll forward into
    // March, quietly shortening the history the screen reports.
    expect(readBeneficiaryQuery(params({ from: '2026-02-31' })).filter.receivedFrom).toBeUndefined();
  });
});

/* ── Criterion: one person, one canonical identity ────────────────────────── */

describe('the registry is a view over the resident record', () => {
  it('keys the record on the resident id, and links back to it', async () => {
    const element = html(await openDetail(AURORA));

    expect(element.querySelector(`a[href="/residents/${AURORA}"]`)).not.toBeNull();
  });

  it('lists standing with the evidence it was derived from', async () => {
    const element = html(await openDetail(AURORA));
    const text = element.textContent ?? '';

    expect(text).toContain('Resident');
    expect(text).toContain('Programme member');
    // The description beside each standing is what makes it checkable.
    expect(text).toContain('On the list of a continuing programme.');
  });

  it('shows what was received and says it counts only what was handed over', async () => {
    const element = html(await openDetail(AURORA));

    expect(element.textContent).toContain(
      'Counts only assistance actually handed over — never what was merely approved.',
    );
  });
});

/* ── Criterion: the history is chronological and traceable ────────────────── */

describe('the assistance history', () => {
  it('renders newest first, under year headings', async () => {
    const element = html(await openDetail(AURORA));
    const years = [...element.querySelectorAll('.history__year')].map((node) =>
      (node.textContent ?? '').trim(),
    );

    expect(years.length).toBeGreaterThan(0);
    expect([...years].sort((a, b) => b.localeCompare(a))).toEqual(years);
  });

  it('names the record behind every line, so a row can be checked', async () => {
    const element = html(await openDetail(AURORA));
    const references = element.querySelectorAll('.history__reference');

    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect((reference.textContent ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('keeps an exited enrollment on the record rather than dropping it', async () => {
    // res-0008 left the livelihood programme and later returned.
    const element = html(await openDetail('res-0008'));
    const text = element.textContent ?? '';

    expect(text).toContain('Left');
    expect(text).toContain('Resumes an earlier enrollment');
  });
});

/* ── Criterion: duplicates reviewable without leaking PII ─────────────────── */

describe('the duplicate queue', () => {
  it('shows which details agree and never what they are', async () => {
    const element = html(await openQueue());
    const text = element.textContent ?? '';

    expect(text).toContain('Mercado');
    // The seeded values behind the match. None may reach the queue.
    expect(text).not.toContain('1956-03-14');
    expect(text).not.toContain('4471');
    expect(text).not.toContain('0917-555-0101');
  });

  it('offers no way to merge two people', async () => {
    const element = html(await openQueue());
    const labels = [...element.querySelectorAll('button, a')].map((node) =>
      (node.textContent ?? '').toLowerCase(),
    );

    expect(labels.some((label) => label.includes('merge'))).toBe(false);
    expect(labels.some((label) => label.includes('delete'))).toBe(false);
  });

  it('states that resemblance decides nothing', async () => {
    const element = html(await openQueue());

    expect(element.textContent).toContain(
      'It decides nothing — a person makes the finding, and records why.',
    );
  });

  it('will not record a finding until a reason is given', async () => {
    const fixture = await openQueue();
    const page = fixture.componentInstance as unknown as {
      rows: () => readonly { residentId: string }[];
      open: (candidate: never) => Promise<void>;
      canSubmit: () => boolean;
      reason: { set: (value: string) => void };
    };

    const first = page.rows()[0];
    expect(first).toBeDefined();

    await page.open(first as never);
    fixture.detectChanges();
    expect(page.canSubmit()).toBe(false);

    page.reason.set('Confirmed with her at the counter; one person, registered twice.');
    fixture.detectChanges();
    expect(page.canSubmit()).toBe(true);
  });
});

/* ── Permission ───────────────────────────────────────────────────────────── */

describe('permission-aware surfaces', () => {
  it('offers the review queue to a role that may adjudicate', async () => {
    const element = html(await openList('mswdo-head'));

    expect(element.querySelector('a[href="/beneficiaries/duplicates"]')).not.toBeNull();
  });

  it('withholds the review queue from intake, who create the duplicates', async () => {
    const element = html(await openList('intake-officer'));

    expect(element.querySelector('a[href="/beneficiaries/duplicates"]')).toBeNull();
  });

  it('does not put a duplicate flag in front of a reader who cannot act on it', async () => {
    const element = html(await openList('intake-officer'));

    expect(element.textContent).not.toContain('Possible duplicate');
  });
});
