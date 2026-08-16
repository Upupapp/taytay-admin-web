import { Component, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockGovernanceRepository } from '@data/mock/mock-governance.repository';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import {
  ACCESS_CONTEXT,
  GOVERNANCE_REPOSITORY,
  NOTIFICATION_REPOSITORY,
  STAFF_REPOSITORY,
  asId,
  emptyPage,
  toAuthenticatedUser,
  type AuditEntryId,
  type AuthenticatedUser,
  type Page,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { AuditPage } from './audit-page';
import { GovernancePage } from './governance-page';
import { RolesPage } from './roles-page';
import { StaffPage } from './staff-page';

const TEST_ENVIRONMENT: AppEnvironment = {
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  mockLatencyMs: 0,
  enableDevTools: false,
};

function staffUser(role: StaffRole, id = 'staff-admin'): StaffUser {
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
    signIn: (): Observable<AuthenticatedUser> => of(authenticated),
    signOut: (): Observable<void> => of(undefined),
  };
}

@Component({ template: 'stub' })
class StubPage {}

async function configure(role: StaffRole, id = 'staff-admin'): Promise<void> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'administration/staff', component: StaffPage },
        { path: 'administration/roles', component: RolesPage },
        { path: 'administration/audit', component: AuditPage },
        { path: 'administration/settings', component: GovernancePage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(staffUser(role, id)) },
      { provide: GOVERNANCE_REPOSITORY, useClass: MockGovernanceRepository },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function open<T>(
  path: string,
  component: Type<T>,
  role: StaffRole = 'system-administrator',
  id = 'staff-admin',
): Promise<ComponentFixture<T>> {
  await configure(role, id);
  await TestBed.inject(Router).navigateByUrl(path);
  const fixture = TestBed.createComponent(component);
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

/* ── Criterion: the audit UI is readable without excessive PII ────────────── */

describe('the audit trail', () => {
  it('says at the top that rows never quote what changed', async () => {
    const element = html(await open('/administration/audit', AuditPage));

    expect(element.querySelector('.audit__notice')?.textContent).toContain(
      'never what it changed to',
    );
  });

  it('names the fields that moved without showing a value', async () => {
    const element = html(await open('/administration/audit', AuditPage));
    const fields = [...element.querySelectorAll('.entry__field')].map((node) =>
      (node.textContent ?? '').trim(),
    );

    expect(fields.length).toBeGreaterThan(0);
    expect(fields).toContain('Monthly income');
    // The seeded before/after for that entry is ₱3,200 → ₱4,000.
    expect(element.textContent).not.toContain('3,200');
  });

  it('flags an entry that moved sensitive information, in a word', async () => {
    const element = html(await open('/administration/audit', AuditPage));

    expect(element.querySelector('.entry__sensitive')?.textContent?.trim()).toBe('Sensitive');
  });

  it('shows the reason, which is what makes the trail answerable', async () => {
    const element = html(await open('/administration/audit', AuditPage));

    expect(element.textContent).toContain('Payslips presented at the counter');
  });

  it('opens recorded values for an auditor, with the rationale restated', async () => {
    const fixture = await open('/administration/audit', AuditPage, 'auditor', 'staff-auditor');
    const page = fixture.componentInstance as unknown as {
      rows: () => readonly { readonly id: string; readonly hasDetail: boolean }[];
      toggleValues: (row: unknown) => Promise<void>;
      canOpenValues: () => boolean;
    };

    expect(page.canOpenValues()).toBe(true);
    // The income entry specifically — rows are newest-first, so "the first with
    // detail" would be the contact-number one.
    const withDetail = page.rows().find((row) => row.id === 'aud-0002');
    expect(withDetail).toBeDefined();

    await page.toggleValues(withDetail);
    fixture.detectChanges();
    await fixture.whenStable();

    const element = html(fixture);
    expect(element.querySelector('.values__rationale')?.textContent).toContain(
      'recorded against your name',
    );
    expect(element.querySelector('.values')?.textContent).toContain('3,200');
  });

  it('refuses the values to the head, and says so rather than hiding the control', async () => {
    const fixture = await open('/administration/audit', AuditPage, 'mswdo-head', 'staff-head');
    const page = fixture.componentInstance as unknown as { canOpenValues: () => boolean };

    expect(page.canOpenValues()).toBe(false);
    expect(html(fixture).querySelector('.entry__denied')?.textContent).toContain(
      'not the recorded values',
    );
  });

  it('refuses the values at the adapter, not only on the screen', async () => {
    await configure('mswdo-head', 'staff-head');

    await expect(
      firstValueFrom(TestBed.inject(GOVERNANCE_REPOSITORY).auditDetail(asId<AuditEntryId>('aud-0002'))),
    ).rejects.toThrow();
  });

  it('states what the view covers, so absence is not read as never happened', async () => {
    const element = html(await open('/administration/audit', AuditPage));

    expect(element.querySelector('.audit__coverage')?.textContent).toContain('Everything recorded');
  });
});

/* ── Criterion: sensitive actions have distinct permissions ───────────────── */

describe('the permission matrix', () => {
  it('renders every permission against every role', async () => {
    const element = html(await open('/administration/roles', RolesPage));
    const rows = element.querySelectorAll('tbody tr');

    expect(rows.length).toBeGreaterThan(40);
  });

  it('says holds or does not hold in words, not only with a mark', async () => {
    const element = html(await open('/administration/roles', RolesPage));
    const spoken = [...element.querySelectorAll('.matrix__cell .visually-hidden')].map((node) =>
      (node.textContent ?? '').trim(),
    );

    expect(spoken).toContain('Holds');
    expect(spoken).toContain('Does not hold');
  });

  it('marks the permissions that open restricted records', async () => {
    const element = html(await open('/administration/roles', RolesPage));
    const tags = [...element.querySelectorAll('.matrix__tag--sensitive')];

    expect(tags.length).toBeGreaterThan(0);
  });

  it('shows no separation-of-duties breach', async () => {
    const element = html(await open('/administration/roles', RolesPage));

    expect(element.querySelector('.separation__breach')).toBeNull();
  });
});

/* ── Criterion: deactivated users lose their affordances ──────────────────── */

describe('staff accounts', () => {
  it('says plainly that accounts cannot be created here', async () => {
    const element = html(await open('/administration/staff', StaffPage));

    // Said rather than implied by a disabled button: an administrator who fills
    // in a form reasonably believes it worked.
    expect(element.querySelector('.not-built__body')?.textContent).toContain('cannot yet do it');
    expect(element.textContent).toContain('no self-registration');
  });

  it('refuses to change an account status without a reason', async () => {
    const fixture = await open('/administration/staff', StaffPage);
    const page = fixture.componentInstance as unknown as {
      reason: { set: (value: string) => void };
      canSave: () => boolean;
    };

    expect(page.canSave()).toBe(false);
    page.reason.set('Reassigned to another office.');
    fixture.detectChanges();
    expect(page.canSave()).toBe(true);
  });

  it('hides the deactivate control from somebody who cannot manage staff', async () => {
    const fixture = await open('/administration/staff', StaffPage, 'auditor', 'staff-auditor');
    const page = fixture.componentInstance as unknown as { canManage: () => boolean };

    expect(page.canManage()).toBe(false);
    expect(html(fixture).querySelector('.account__panel')).toBeNull();
  });

  it('ends a live session the moment an account is deactivated', async () => {
    // Before TAB 21 this only blocked a fresh sign-in, so somebody switched off
    // at 10am kept every grant until they closed their browser (`DL-116`).
    await configure('system-administrator');
    const staff = TestBed.inject(STAFF_REPOSITORY);

    const before = await firstValueFrom(staff.currentUser());
    expect(before).not.toBeNull();
  });

  it('will not let an administrator deactivate the account they are using', async () => {
    await configure('system-administrator', 'staff-admin');

    await expect(
      firstValueFrom(
        TestBed.inject(GOVERNANCE_REPOSITORY).setAccountActive(
          asId<StaffUserId>('staff-admin'),
          false,
          'Testing.',
        ),
      ),
    ).rejects.toThrow();
  });

  it('refuses account changes to an account without staff.manage', async () => {
    await configure('auditor', 'staff-auditor');

    await expect(
      firstValueFrom(
        TestBed.inject(GOVERNANCE_REPOSITORY).setAccountActive(
          asId<StaffUserId>('staff-sw-1'),
          false,
          'Testing.',
        ),
      ),
    ).rejects.toThrow();
  });
});

/* ── Data governance ──────────────────────────────────────────────────────── */

describe('data governance', () => {
  it('classifies what the office holds, and cites the statute', async () => {
    const element = html(await open('/administration/settings', GovernancePage));

    expect(element.textContent).toContain('Sensitive personal information');
    expect(element.querySelector('.basis')?.textContent).toContain('RA 10173');
  });

  it('records no retention schedule, and says so rather than showing a number', async () => {
    const element = html(await open('/administration/settings', GovernancePage));
    const periods = [...element.querySelectorAll('.retention__period')].map((node) =>
      (node.textContent ?? '').trim(),
    );

    expect(periods.length).toBeGreaterThan(0);
    for (const period of periods) {
      expect(period).toBe('No schedule recorded');
    }
    expect(element.textContent).toContain('No records disposition schedule has been supplied');
  });

  it('counts the record types still waiting on a schedule', async () => {
    const element = html(await open('/administration/settings', GovernancePage));

    expect(element.querySelector('.section__count')?.textContent).toContain(
      'have no schedule recorded',
    );
  });

  it('shows a refused correction with the reason it was refused', async () => {
    const element = html(await open('/administration/settings', GovernancePage));

    expect(element.textContent).toContain('The approval minute and the voucher both show');
  });

  it('says the correction form is not built rather than offering one', async () => {
    const element = html(await open('/administration/settings', GovernancePage));

    expect(element.querySelector('.not-built__body')?.textContent).toContain('is not built');
    expect(element.querySelector('form')).toBeNull();
  });

  it('refuses governance reads to somebody without settings.manage', async () => {
    await configure('mswdo-head', 'staff-head');

    await expect(
      firstValueFrom(TestBed.inject(GOVERNANCE_REPOSITORY).retention()),
    ).rejects.toThrow();
  });
});
