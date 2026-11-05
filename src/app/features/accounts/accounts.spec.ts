import { signal } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { PermissionService } from '@core/access/permission.service';
import { SessionStore } from '@core/auth/session.store';
import {
  APP_ACCOUNT_REPOSITORY,
  asId,
  OFFICE_ASSIGNMENT_EFFECTS,
  OFFICE_REPOSITORY,
  ROLE_CHANGE_ALWAYS,
  ROLE_CHANGE_EFFECTS,
  type AccountRole,
  type AppAccount,
  type AppAccountId,
  type AppAccountRepository,
  type CursorPage,
  type CursorRequest,
  type Office,
  type OfficeId,
  type OfficeRepository,
  type Permission,
} from '@domain/index';
import { ready } from '@shared/state/view-state';

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

function account(key: string, role: AccountRole, officeId: OfficeId | null = null): AppAccount {
  return {
    id: asId<AppAccountId>(key),
    name: `Person ${key}`,
    email: `${key}@accounts.example.test`,
    role,
    officeId,
  };
}

/** Records every call, so a test can say what was — and was not — asked of the data layer. */
class RecordingAccounts implements AppAccountRepository {
  readonly listed: CursorRequest[] = [];
  readonly roleChanges: { id: string; role: AccountRole }[] = [];
  readonly assignments: { id: string; office: OfficeId | null }[] = [];
  failWith: unknown = null;

  list(page: CursorRequest): Observable<CursorPage<AppAccount>> {
    this.listed.push(page);
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
