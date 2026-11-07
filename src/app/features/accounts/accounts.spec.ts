import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { PermissionService } from '@core/access/permission.service';
import { SessionStore } from '@core/auth/session.store';
import {
  APP_ACCOUNT_REPOSITORY,
  asId,
  OFFICE_ASSIGNMENT_EFFECTS,
  OFFICE_REPOSITORY,
  OFFICE_ROLE_ALWAYS,
  OFFICE_ROLE_EFFECTS,
  ROLE_DEFINITIONS,
  ROLE_CHANGE_ALWAYS,
  ROLE_CHANGE_EFFECTS,
  type AccountBarangay,
  type AccountRole,
  type AppAccount,
  type AppAccountFilter,
  type AppAccountId,
  type AppAccountRepository,
  type BarangayId,
  type CursorPage,
  type CursorRequest,
  type Office,
  type OfficeId,
  type OfficeRepository,
  type OfficeRoleChange,
  type Permission,
  type StaffRole,
} from '@domain/index';
import { ready } from '@shared/state/view-state';

import { AccountOfficeRole } from './account-office-role';
import { AccountPanel } from './account-panel';
import { AccountsPage } from './accounts-page';
import { ACCOUNTS_COPY } from './accounts.copy';

const MSWDO = asId<OfficeId>('office-mswdo');
const HEALTH = asId<OfficeId>('office-mho');
const OFFICES: readonly Office[] = [
  {
    id: MSWDO,
    name: 'Municipal Social Welfare and Development Office',
    slug: 'mswdo',
    shortName: 'MSWDO',
  },
  { id: HEALTH, name: 'Municipal Health Office', slug: 'mho', shortName: null },
];
const READER = 'account-reader';

const SAN_JUAN = asId<BarangayId>('barangay-san-juan');
const BARANGAYS: readonly AccountBarangay[] = [
  { id: asId<BarangayId>('barangay-dolores'), name: 'Dolores' },
  { id: SAN_JUAN, name: 'San Juan' },
];

function account(
  key: string,
  role: AccountRole,
  officeId: OfficeId | null = null,
  officeRole: StaffRole | null = role === 'admin' ? 'system-administrator' : null,
): AppAccount {
  return {
    id: asId<AppAccountId>(key),
    name: `Person ${key}`,
    email: `${key}@accounts.example.test`,
    role,
    officeId,
    officeRole,
    scopeBarangayId: null,
  };
}

/** Records every call, so a test can say what was — and was not — asked of the data layer. */
class RecordingAccounts implements AppAccountRepository {
  readonly listed: CursorRequest[] = [];
  readonly filters: (AppAccountFilter | undefined)[] = [];
  readonly roleChanges: { id: string; role: AccountRole }[] = [];
  readonly assignments: { id: string; office: OfficeId | null }[] = [];
  readonly officeRoles: { id: string; change: OfficeRoleChange }[] = [];
  barangayReads = 0;
  failWith: unknown = null;

  list(page: CursorRequest, filter?: AppAccountFilter): Observable<CursorPage<AppAccount>> {
    this.listed.push(page);
    this.filters.push(filter);
    return of(
      page.cursor
        ? { items: [account('c', 'registered')], hasMore: false, nextCursor: null }
        : {
            items: [
              account(READER, 'admin'),
              account('a', 'staff', MSWDO),
              account('b', 'verified', HEALTH),
            ],
            hasMore: true,
            nextCursor: 'cursor-2',
          },
    );
  }

  changeRole(id: AppAccountId, role: AccountRole): Observable<AppAccount> {
    if (this.failWith !== null) {
      const failure = this.failWith;
      return throwError(() => failure);
    }
    this.roleChanges.push({ id, role });
    return of({ ...account(id, role) });
  }

  assignOffice(id: AppAccountId, office: OfficeId | null): Observable<AppAccount> {
    this.assignments.push({ id, office });
    return of({ ...account(id, 'staff', office) });
  }

  assignOfficeRole(id: AppAccountId, change: OfficeRoleChange): Observable<AppAccount> {
    this.officeRoles.push({ id, change });
    return of({
      ...account(id, 'staff', null, change.role),
      scopeBarangayId: change.barangayId,
    });
  }

  barangays(): Observable<readonly AccountBarangay[]> {
    this.barangayReads += 1;
    return of(BARANGAYS);
  }
}

function configure(
  granted: readonly Permission[] = ['user.view', 'user.change-role', 'user.assign-office'],
): RecordingAccounts {
  const repository = new RecordingAccounts();
  const offices: OfficeRepository = { list: () => of(OFFICES) };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: APP_ACCOUNT_REPOSITORY, useValue: repository },
      { provide: OFFICE_REPOSITORY, useValue: offices },
      { provide: SessionStore, useValue: { user: signal({ id: READER }) } },
      {
        provide: PermissionService,
        useValue: { can: (permission: Permission) => signal(granted.includes(permission)) },
      },
    ],
  });
  return repository;
}

function buttonNamed(root: ParentNode, name: string): HTMLButtonElement | null {
  return (
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === name,
    ) ?? null
  );
}

async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

/* ── the list ────────────────────────────────────────────────────────────── */

describe('AccountsPage (DL-168)', () => {
  it('reads one cursor page and says more are available, never "page 1 of N"', async () => {
    const repository = configure();
    const element = await settle(TestBed.createComponent(AccountsPage));

    expect(repository.listed[0]).toEqual({ limit: 20, cursor: null });
    expect(element.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(element.textContent).toContain('Showing 3 accounts. More are available.');
    expect(element.textContent).not.toMatch(/page \d+ of|of \d+ accounts/i);
  });

  it('shows name, email, role and office — and says what it leaves out', async () => {
    configure();
    const element = await settle(TestBed.createComponent(AccountsPage));

    expect([...element.querySelectorAll('thead th')].map((th) => th.textContent?.trim())).toEqual([
      'Name',
      'Email',
      'Role',
      'Office',
      'Manage',
    ]);
    expect(element.textContent).toContain(
      'Municipal Social Welfare and Development Office (MSWDO)',
    );
    expect(element.textContent).toContain('Municipal Health Office (unused while not staff)');
    expect(element.textContent).toContain('does not show');
  });

  it('marks the reader’s own account', async () => {
    configure();
    const element = await settle(TestBed.createComponent(AccountsPage));

    expect(element.querySelector('tbody tr')?.textContent).toContain('(You)');
  });

  it('opens an account beside the list, named for whose it is', async () => {
    configure();
    const fixture = TestBed.createComponent(AccountsPage);
    const element = await settle(fixture);

    element.querySelector<HTMLButtonElement>('button[aria-label="Manage Person a"]')?.click();
    await settle(fixture);

    expect(document.body.textContent).toContain(ACCOUNTS_COPY.list.drawerHeading);
    expect(document.body.querySelector('app-account-panel')).not.toBeNull();
  });
});

/* ── one account ─────────────────────────────────────────────────────────── */

function panel(subject: AppAccount, own = false, granted?: readonly Permission[]) {
  const repository = configure(granted);
  const fixture = TestBed.createComponent(AccountPanel);
  fixture.componentRef.setInput('account', subject);
  fixture.componentRef.setInput('offices', ready(OFFICES));
  fixture.componentRef.setInput('own', own);
  return { repository, fixture };
}

function chooseRole(element: HTMLElement, role: AccountRole): void {
  const radio = element.querySelector<HTMLInputElement>(`input[type="radio"][value="${role}"]`);
  if (radio === null) throw new Error(`no ${role} choice`);
  radio.checked = true;
  radio.dispatchEvent(new Event('change'));
}

function liveRegion(element: HTMLElement): string {
  return element.querySelector('[role="status"][aria-live="polite"]')?.textContent?.trim() ?? '';
}

describe('AccountsPage — narrowed to one verification, as a dashboard row opens it (DL-186)', () => {
  it('reads the accounts with the status the address names, and says what that list holds', async () => {
    const repository = configure();
    await TestBed.inject(Router).navigateByUrl('/?verification=pending');
    const fixture = TestBed.createComponent(AccountsPage);
    const element = await settle(fixture);

    expect(repository.filters[0]).toEqual({ verificationStatus: 'pending' });
    expect(element.querySelector<HTMLSelectElement>('#accounts-verification')?.value).toBe(
      'pending',
    );
    expect(element.textContent).toContain(
      'Staff accounts are not listed while a verification is chosen.',
    );
    // A narrowing, not a column: the rows still show the minimum.
    expect(element.querySelectorAll('thead th')).toHaveLength(5);

    buttonNamed(element, 'Show more')?.click();
    await settle(fixture);
    expect(repository.filters[1]).toEqual({ verificationStatus: 'pending' });
  });

  it('reads every account when the address names no status, or one it does not know', async () => {
    const repository = configure();
    await TestBed.inject(Router).navigateByUrl('/?verification=maybe');
    await settle(TestBed.createComponent(AccountsPage));
    expect(repository.filters[0]).toEqual({});
  });
});

describe('AccountPanel (DL-168)', () => {
  it('offers no button until a role is chosen, then says what the server does before it', async () => {
    const { fixture } = panel(account('b', 'verified'));
    const element = await settle(fixture);

    expect(buttonNamed(element, 'Change the role to Staff')).toBeNull();

    chooseRole(element, 'staff');
    const after = await settle(fixture);
    const text = after.textContent ?? '';
    for (const effect of [...ROLE_CHANGE_EFFECTS.staff, ...ROLE_CHANGE_ALWAYS]) {
      expect(text).toContain(effect);
    }
    const button = buttonNamed(after, 'Change the role to Staff');
    const effects = after.querySelector('.panel__effects');
    expect(button).not.toBeNull();
    expect(
      effects !== null &&
        button !== null &&
        effects.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('says a demotion revokes the digital ID, and asks for no reason the server cannot keep', async () => {
    const { fixture } = panel(account('a', 'staff', MSWDO));
    const element = await settle(fixture);

    chooseRole(element, 'registered');
    const after = await settle(fixture);

    expect(after.textContent).toContain('Any digital ID the account holds is revoked.');
    expect(after.textContent).toContain('It keeps no reason, so none is asked for.');
    expect(after.querySelector('textarea')).toBeNull();
  });

  it('does not offer the current role as a change', async () => {
    const { fixture } = panel(account('a', 'staff', MSWDO));
    const element = await settle(fixture);

    expect(element.querySelector<HTMLInputElement>('input[value="staff"]')?.disabled).toBe(true);
  });

  it('changes the role, says so in a live region, and hands the answer back', async () => {
    const { fixture, repository } = panel(account('b', 'verified'));
    const changed: AppAccount[] = [];
    fixture.componentInstance.changed.subscribe((value) => changed.push(value));
    const element = await settle(fixture);

    chooseRole(element, 'staff');
    await settle(fixture);
    buttonNamed(element, 'Change the role to Staff')?.click();
    await settle(fixture);

    expect(repository.roleChanges).toEqual([{ id: 'b', role: 'staff' }]);
    expect(liveRegion(element)).toBe('Role changed to Staff.');
    expect(changed.map((value) => value.role)).toEqual(['staff']);
  });

  it('says what the server said when it refuses', async () => {
    const { fixture, repository } = panel(account('b', 'verified'));
    repository.failWith = { message: 'You cannot change your own role.' };
    const element = await settle(fixture);

    chooseRole(element, 'admin');
    await settle(fixture);
    buttonNamed(element, 'Change the role to Administrator')?.click();
    await settle(fixture);

    expect(liveRegion(element)).toBe('That was not done. You cannot change your own role.');
  });

  it('offers no role change on the reader’s own account, and says who can', async () => {
    const { fixture } = panel(account(READER, 'admin'), true);
    const element = await settle(fixture);

    expect(element.querySelector('input[type="radio"]')).toBeNull();
    expect(element.textContent).toContain(ACCOUNTS_COPY.panel.ownAccount);
  });

  it('offers no change to an account without the grant', async () => {
    const { fixture } = panel(account('a', 'staff', MSWDO), false, ['user.view']);
    const element = await settle(fixture);

    expect(element.querySelector('input[type="radio"]')).toBeNull();
    expect(element.querySelector('select')).toBeNull();
    expect(element.textContent).toContain(ACCOUNTS_COPY.panel.noRoleGrant);
  });

  it('assigns a staff account an office, saying what that does before the button', async () => {
    const { fixture, repository } = panel(account('a', 'staff', MSWDO));
    const element = await settle(fixture);

    const select = element.querySelector<HTMLSelectElement>('#account-office-choice');
    if (select === null) throw new Error('no office picker');
    select.value = HEALTH;
    select.dispatchEvent(new Event('change'));
    await settle(fixture);

    for (const effect of OFFICE_ASSIGNMENT_EFFECTS.assign) {
      expect(element.textContent).toContain(effect);
    }
    buttonNamed(element, 'Assign to Municipal Health Office')?.click();
    await settle(fixture);

    expect(repository.assignments).toEqual([{ id: 'a', office: HEALTH }]);
    expect(liveRegion(element)).toBe('Assigned to Municipal Health Office.');
  });

  it('removes an office link, saying the inbox closes to the account', async () => {
    const { fixture, repository } = panel(account('a', 'staff', MSWDO));
    const element = await settle(fixture);

    const select = element.querySelector<HTMLSelectElement>('#account-office-choice');
    if (select === null) throw new Error('no office picker');
    select.value = '';
    select.dispatchEvent(new Event('change'));
    await settle(fixture);

    for (const effect of OFFICE_ASSIGNMENT_EFFECTS.clear) {
      expect(element.textContent).toContain(effect);
    }
    buttonNamed(element, ACCOUNTS_COPY.panel.officeConfirmClear)?.click();
    await settle(fixture);

    expect(repository.assignments).toEqual([{ id: 'a', office: null }]);
  });

  it('offers no office to an account that is not staff, and says why', async () => {
    const { fixture } = panel(account('b', 'verified', HEALTH));
    const element = await settle(fixture);

    expect(element.querySelector('#account-office-choice')).toBeNull();
    expect(element.textContent).toContain(ACCOUNTS_COPY.panel.officeNotStaff);
    expect(element.textContent).toContain('unused while the account is not staff');
  });
});

/* ── the office role (DL-173) ────────────────────────────────────────────── */

function officeRole(subject: AppAccount, own = false, granted?: readonly Permission[]) {
  const repository = configure(granted);
  const fixture = TestBed.createComponent(AccountOfficeRole);
  fixture.componentRef.setInput('account', subject);
  fixture.componentRef.setInput('own', own);
  return { repository, fixture };
}

function officeRoleChoices(element: HTMLElement): string[] {
  return [
    ...element.querySelectorAll<HTMLInputElement>('input[type="radio"][name="account-office-role"]'),
  ].map((radio) => radio.value);
}

function chooseOfficeRole(element: HTMLElement, value: string): void {
  const radio = element.querySelector<HTMLInputElement>(
    `input[type="radio"][name="account-office-role"][value="${value}"]`,
  );
  if (radio === null) throw new Error(`no ${value} office role`);
  radio.checked = true;
  radio.dispatchEvent(new Event('change'));
}

function typeReason(element: HTMLElement, reason: string): void {
  const box = element.querySelector<HTMLTextAreaElement>('#account-office-role-reason');
  if (box === null) throw new Error('no reason box');
  box.value = reason;
  box.dispatchEvent(new Event('input'));
}

const OFFICE_ROLE = ACCOUNTS_COPY.officeRole;

describe('AccountOfficeRole (DL-173)', () => {
  it('offers every office role but the system administrator, and nothing to press before a choice', async () => {
    const { fixture } = officeRole(account('a', 'staff', MSWDO));
    const element = await settle(fixture);

    expect(officeRoleChoices(element)).toEqual([
      'mswdo-head',
      'social-worker',
      'intake-officer',
      'release-officer',
      'barangay-link',
      'auditor',
      'none',
    ]);
    expect(element.textContent).toContain(OFFICE_ROLE.nowNone);
    expect(element.querySelector('button')).toBeNull();
    expect(element.querySelector('textarea')).toBeNull();
  });

  it('says what the server does, then asks why, and only then offers the one button', async () => {
    const { fixture, repository } = officeRole(account('a', 'staff', MSWDO));
    const element = await settle(fixture);
    chooseOfficeRole(element, 'intake-officer');
    await settle(fixture);

    const effects = element.querySelector('.panel__effects');
    const reason = element.querySelector('#account-office-role-reason');
    const button = buttonNamed(element, OFFICE_ROLE.confirm('Intake officer'));
    if (effects === null || reason === null || button === null) throw new Error('incomplete form');
    for (const effect of [...OFFICE_ROLE_EFFECTS.assign, ...OFFICE_ROLE_ALWAYS]) {
      expect(effects.textContent).toContain(effect);
    }
    expect(effects.textContent).toContain(ROLE_DEFINITIONS['intake-officer'].description);
    expect(effects.compareDocumentPosition(reason) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(reason.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Not a barangay link, so the barangays are not asked for.
    expect(repository.barangayReads).toBe(0);
  });

  it('refuses to send without a reason, and says why', async () => {
    const { fixture, repository } = officeRole(account('a', 'staff', MSWDO));
    const element = await settle(fixture);
    chooseOfficeRole(element, 'auditor');
    await settle(fixture);

    buttonNamed(element, OFFICE_ROLE.confirm('Auditor'))?.click();
    await settle(fixture);

    expect(repository.officeRoles).toEqual([]);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Say why');
  });

  it('sends the role with the reason, and says so in the panel’s live region', async () => {
    const { fixture, repository } = panel(account('a', 'staff', MSWDO));
    const element = await settle(fixture);
    chooseOfficeRole(element, 'intake-officer');
    await settle(fixture);
    typeReason(element, 'Joined the intake counter.');
    await settle(fixture);

    buttonNamed(element, OFFICE_ROLE.confirm('Intake officer'))?.click();
    await settle(fixture);

    expect(repository.officeRoles).toEqual([
      {
        id: 'a',
        change: { role: 'intake-officer', barangayId: null, reason: 'Joined the intake counter.' },
      },
    ]);
    expect(liveRegion(element)).toBe(OFFICE_ROLE.saved('Intake officer'));
  });

  it('asks a barangay link for its barangay, from the API’s own list', async () => {
    const { fixture, repository } = officeRole(account('a', 'staff', MSWDO));
    const element = await settle(fixture);
    chooseOfficeRole(element, 'barangay-link');
    await settle(fixture);
    typeReason(element, 'Encodes for San Juan.');
    await settle(fixture);

    expect(repository.barangayReads).toBe(1);
    buttonNamed(element, OFFICE_ROLE.confirm('Barangay link'))?.click();
    await settle(fixture);
    expect(repository.officeRoles).toEqual([]);
    expect(element.querySelector('[role="alert"]')?.textContent).toContain('Choose the barangay');

    const select = element.querySelector<HTMLSelectElement>('#account-office-role-barangay');
    if (select === null) throw new Error('no barangay picker');
    select.value = SAN_JUAN;
    select.dispatchEvent(new Event('change'));
    await settle(fixture);
    buttonNamed(element, OFFICE_ROLE.confirm('Barangay link'))?.click();
    await settle(fixture);

    expect(repository.officeRoles).toEqual([
      {
        id: 'a',
        change: { role: 'barangay-link', barangayId: SAN_JUAN, reason: 'Encodes for San Juan.' },
      },
    ]);
  });

  it('takes an office role away, saying every casework permission goes', async () => {
    const { fixture, repository } = officeRole(account('a', 'staff', MSWDO, 'auditor'));
    const element = await settle(fixture);
    expect(element.textContent).toContain(OFFICE_ROLE.now('Auditor'));

    chooseOfficeRole(element, 'none');
    await settle(fixture);
    for (const effect of OFFICE_ROLE_EFFECTS.clear) {
      expect(element.textContent).toContain(effect);
    }
    typeReason(element, 'Left the audit team.');
    await settle(fixture);
    buttonNamed(element, OFFICE_ROLE.confirmNone)?.click();
    await settle(fixture);

    expect(repository.officeRoles).toEqual([
      { id: 'a', change: { role: null, barangayId: null, reason: 'Left the audit team.' } },
    ]);
  });

  it('offers nothing to a resident, an administrator, the reader’s own account, or without the grant', async () => {
    const cases: [AppAccount, boolean, readonly Permission[] | undefined, string][] = [
      [account('b', 'verified'), false, undefined, OFFICE_ROLE.notStaff],
      [account(READER, 'admin'), false, undefined, OFFICE_ROLE.administrator],
      [account('a', 'staff', MSWDO), true, undefined, OFFICE_ROLE.ownAccount],
      [account('a', 'staff', MSWDO), false, ['user.view'], OFFICE_ROLE.noGrant],
    ];
    for (const [subject, own, granted, said] of cases) {
      const { fixture } = officeRole(subject, own, granted);
      const element = await settle(fixture);

      expect(officeRoleChoices(element)).toEqual([]);
      expect(element.textContent).toContain(said);
    }
  });
});
