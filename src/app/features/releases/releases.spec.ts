import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockReleaseRepository } from '@data/mock/mock-release.repository';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import {
  ACCESS_CONTEXT,
  RELEASE_REPOSITORY,
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

import { PayoutSessionPage } from './payout-session-page';
import { ReleaseDetailPage } from './release-detail-page';
import { ReleaseListPage } from './release-list-page';

const TEST_ENVIRONMENT: AppEnvironment = {
  name: 'local-mock',
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  mockLatencyMs: 0,
  enableDevTools: false,
};

/** Scheduled into the August payout session. */
const SCHEDULED = 'dsb-0001';
/** The family came and the office could not pay. */
const DEFERRED = 'dsb-0005';
/** A food pack — goods, so no peso figure anywhere. */
const IN_KIND = 'dsb-0006';
/** Nobody came within the window. */
const UNCLAIMED = 'dsb-0007';
/** Handed over, receipt not yet recorded — the only state that can acknowledge. */
const RELEASED = 'dsb-0009';
/** Approved by `staff-head`, so signing in as that person is a self-release. */
const APPROVED_BY_HEAD = 'dsb-0001';

function staffUser(role: StaffRole, id = 'staff-release'): StaffUser {
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
        { path: 'releases', component: ReleaseListPage },
        { path: 'releases/sessions', component: PayoutSessionPage },
        { path: 'releases/:id', component: ReleaseDetailPage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(user) },
      { provide: RELEASE_REPOSITORY, useClass: MockReleaseRepository },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function openList(
  role: StaffRole = 'release-officer',
): Promise<ComponentFixture<ReleaseListPage>> {
  await configure(staffUser(role));
  await TestBed.inject(Router).navigateByUrl('/releases');
  const fixture = TestBed.createComponent(ReleaseListPage);
  await fixture.whenStable();
  return fixture;
}

async function openDetail(
  id: string,
  user: StaffUser = staffUser('release-officer'),
): Promise<ComponentFixture<ReleaseDetailPage>> {
  await configure(user);
  await TestBed.inject(Router).navigateByUrl(`/releases/${id}`);
  const fixture = TestBed.createComponent(ReleaseDetailPage);
  fixture.componentRef.setInput('id', id);
  await fixture.whenStable();
  return fixture;
}

async function openSessions(
  role: StaffRole = 'release-officer',
): Promise<ComponentFixture<PayoutSessionPage>> {
  await configure(staffUser(role));
  await TestBed.inject(Router).navigateByUrl('/releases/sessions');
  const fixture = TestBed.createComponent(PayoutSessionPage);
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

/* ── Criterion: the queue surfaces what the office owes ───────────────────── */

describe('the release queue', () => {
  it('puts what the office must fix ahead of everything else', async () => {
    const element = html(await openList());
    const buckets = [...element.querySelectorAll('.bucket')];

    expect(buckets[0]?.classList.contains('bucket--office')).toBe(true);
    expect(buckets[0]?.textContent).toContain('The office must act on these');
  });

  it('collects the deferred and the miskeyed into that first bucket', async () => {
    const element = html(await openList());
    const office = element.querySelector('.bucket--office');

    expect(office?.textContent).toContain('DV-2026-00372');
    expect(office?.textContent).toContain('DV-2026-00395');
  });

  it('does not put an unclaimed payout among the office’s own failures', async () => {
    const element = html(await openList());
    expect(element.querySelector('.bucket--office')?.textContent).not.toContain('DV-2026-00391');
  });

  it('names goods rather than valuing them', async () => {
    const element = html(await openList());
    const goods = element.querySelector('.release-rows__goods');

    expect(goods?.textContent).toContain('food pack');
    expect(goods?.textContent).not.toContain('₱');
  });
});

/* ── Criterion: deferred and unclaimed are told apart on screen ───────────── */

describe('a deferral and an unclaimed payout read differently', () => {
  it('records the office’s account of a deferral, not the family’s absence', async () => {
    const element = html(await openDetail(DEFERRED));
    const text = (element.textContent ?? '').toLowerCase();

    expect(text).toContain('countersignature');
    expect(text).not.toContain('unclaimed');
    expect(text).not.toContain('failed to claim');
    expect(text).not.toContain('refused');
  });

  it('says on the badge that the reason sits with the office', async () => {
    const element = html(await openDetail(DEFERRED));
    expect(element.querySelector('.badge')?.getAttribute('title')).toContain(
      'recorded against the office',
    );
  });

  it('offers only reasons the office owns when deferring', async () => {
    const fixture = await openDetail(SCHEDULED);
    const panel = html(fixture).querySelector('[aria-labelledby="defer-heading"]');
    const reasons = [...(panel?.querySelectorAll('option') ?? [])].map((node) =>
      (node.textContent ?? '').trim().toLowerCase(),
    );

    expect(reasons).toContain('funds had not reached the office');
    expect(reasons).toContain('an approving signature was missing');
    // Not one of them may be about the beneficiary.
    expect(reasons.length).toBeGreaterThan(0);
    for (const reason of reasons) {
      expect(reason).not.toContain('beneficiar');
      expect(reason).not.toContain('did not come');
      expect(reason).not.toContain('did not appear');
    }
  });

  it('requires an account of what happened before a deferral can be saved', async () => {
    const fixture = await openDetail(SCHEDULED);
    const page = fixture.componentInstance as unknown as {
      deferRemarks: { set: (value: string) => void };
      canSaveDeferral: () => boolean;
    };

    expect(page.canSaveDeferral()).toBe(false);
    page.deferRemarks.set('He came at 9am. The countersignature was missing.');
    fixture.detectChanges();
    expect(page.canSaveDeferral()).toBe(true);
  });
});

/* ── Criterion: this is not the accounting system ─────────────────────────── */

describe('the release screen states its boundary', () => {
  it('says on screen that nothing here posts to the books', async () => {
    const element = html(await openDetail(SCHEDULED));
    expect(element.querySelector('.release__boundary')?.textContent).toContain(
      'not the accounting system',
    );
  });

  it('labels the funding source as a label, not an account', async () => {
    const element = html(await openDetail(SCHEDULED));
    const text = element.textContent ?? '';

    expect(text).toContain('Municipal social welfare fund');
    expect(text).toContain('Nothing here posts to an account');
  });

  it('shows no peso figure at all for a release in kind', async () => {
    const element = html(await openDetail(IN_KIND));
    const about = element.querySelector('.release__panel');

    expect(about?.textContent).toContain('food pack');
    expect(about?.querySelector('.release__amount')).toBeNull();
  });
});

/* ── Criterion: separation of approval from release ───────────────────────── */

describe('releasing what you approved', () => {
  it('warns the account that approved this release before it hands the money over', async () => {
    const fixture = await openDetail(
      APPROVED_BY_HEAD,
      staffUser('system-administrator', 'staff-head'),
    );
    const warning = html(fixture).querySelector('.release__warning');

    expect(warning?.textContent).toContain('You approved this request');
  });

  it('does not warn a disbursing officer who approved nothing', async () => {
    const fixture = await openDetail(APPROVED_BY_HEAD);
    expect(html(fixture).querySelector('.release__warning')).toBeNull();
  });

  it('warns rather than blocks, so one available officer can still pay', async () => {
    const fixture = await openDetail(
      APPROVED_BY_HEAD,
      staffUser('system-administrator', 'staff-head'),
    );
    const page = fixture.componentInstance as unknown as {
      wouldSelfRelease: () => boolean;
      canRecordRelease: () => boolean;
    };

    expect(page.wouldSelfRelease()).toBe(true);
    expect(page.canRecordRelease()).toBe(true);
  });
});

/* ── Criterion: a representative must present authority ───────────────────── */

describe('recording who collected', () => {
  it('refuses a representative’s receipt with no authority named', async () => {
    const fixture = await openDetail(RELEASED);
    const page = fixture.componentInstance as unknown as {
      ackKind: { set: (value: string) => void };
      authority: { set: (value: string) => void };
      canSaveAcknowledgement: () => boolean;
    };

    page.ackKind.set('representative');
    fixture.detectChanges();
    expect(page.canSaveAcknowledgement()).toBe(false);

    page.authority.set('Handwritten authorisation with a photocopy of his ID.');
    fixture.detectChanges();
    expect(page.canSaveAcknowledgement()).toBe(true);
  });
});

/* ── Criterion: a session is counted, not stated ──────────────────────────── */

describe('a payout session', () => {
  it('reports counts rather than one state for the whole table', async () => {
    const fixture = await openSessions();
    const progress = html(fixture).querySelector('.facts__item:last-child dd');

    expect(progress?.textContent).toContain('released');
    expect(progress?.textContent).toContain('deferred');
    expect(progress?.textContent).not.toContain('Complete');
  });

  it('keeps a deferred member visible in a session that has releases in it', async () => {
    const fixture = await openSessions();
    const page = fixture.componentInstance as unknown as {
      batches: () => readonly { readonly title: string }[];
      progressFor: (batch: unknown) => string;
    };
    const batch = page.batches()[0];

    expect(batch).toBeDefined();
    expect(page.progressFor(batch)).toContain('1 deferred');
  });
});

/* ── Criterion: the manifest carries the minimum ──────────────────────────── */

describe('the payout list carried to the table', () => {
  it('masks the voucher rather than printing it whole', async () => {
    const fixture = await openSessions();
    const page = fixture.componentInstance as unknown as {
      batches: () => readonly unknown[];
      openManifest: (batch: unknown) => void;
    };

    page.openManifest(page.batches()[0]);
    await fixture.whenStable();
    const element = html(fixture);

    expect(element.querySelector('.manifest__voucher')?.textContent).toContain('0311');
    expect(element.querySelector('.manifest__voucher')?.textContent).not.toContain(
      'DV-2026-00311',
    );
  });

  it('carries a name and a voucher, and nothing else about anybody', async () => {
    const fixture = await openSessions();
    const page = fixture.componentInstance as unknown as {
      batches: () => readonly unknown[];
      openManifest: (batch: unknown) => void;
    };

    page.openManifest(page.batches()[0]);
    await fixture.whenStable();
    const sheet = html(fixture).querySelector('.manifest');
    const text = (sheet?.textContent ?? '').toLowerCase();

    for (const leak of ['barangay', 'birth', 'income', 'philsys', 'contact', 'address']) {
      expect(text).not.toContain(leak);
    }
  });

  it('leaves the signature column blank for the person to fill', async () => {
    const fixture = await openSessions();
    const page = fixture.componentInstance as unknown as {
      batches: () => readonly unknown[];
      openManifest: (batch: unknown) => void;
    };

    page.openManifest(page.batches()[0]);
    await fixture.whenStable();
    const cells = [...html(fixture).querySelectorAll('.manifest__signature')];

    expect(cells.length).toBeGreaterThan(0);
    expect(cells.every((cell) => (cell.textContent ?? '').trim() === '')).toBe(true);
  });

  it('states the handling rule on the sheet that leaves the building', async () => {
    const fixture = await openSessions();
    const page = fixture.componentInstance as unknown as {
      batches: () => readonly unknown[];
      openManifest: (batch: unknown) => void;
    };

    page.openManifest(page.batches()[0]);
    await fixture.whenStable();

    expect(html(fixture).querySelector('.manifest__notice')?.textContent).toContain('RA 10173');
  });
});

/* ── Criterion: an unclaimed payout is followed up, not closed ────────────── */

describe('an unclaimed payout', () => {
  it('stays open so somebody follows it up', async () => {
    const element = html(await openDetail(UNCLAIMED));
    expect(element.textContent).toContain('Social worker to follow up');
  });
});
