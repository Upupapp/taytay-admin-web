import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  isPermissionDenied,
  ROLE_DEFINITIONS,
  type AccessContext,
  type AppAccount,
  type AppAccountId,
  type AuthenticatedUser,
  type OfficeId,
  type Permission,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockAppAccountRepository } from './mock-app-account.repository';
import { SAMPLE_ACCOUNT_DOMAIN } from './seed/app-accounts.seed';
import { MOCK_OFFICE_MSWDO } from './seed/offices.seed';

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

function signedInAs(role: StaffRole): MockAppAccountRepository {
  const definition = ROLE_DEFINITIONS[role];
  const user: AuthenticatedUser = {
    id: asId<StaffUserId>('staff-admin'),
    displayName: 'Test User',
    email: 'test@example.gov.ph',
    role,
    roleLabel: definition.label,
    position: 'Tester',
    barangayId: null,
    scope: definition.scope,
    permissions: new Set<Permission>(definition.permissions),
  };
  const context: AccessContext = { currentUser: () => user };

  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useValue: context },
      MockAppAccountRepository,
    ],
  });
  return TestBed.inject(MockAppAccountRepository);
}

async function find(
  repository: MockAppAccountRepository,
  match: (account: AppAccount) => boolean,
): Promise<AppAccount> {
  const page = await firstValueFrom(repository.list({ limit: 50 }));
  const found = page.items.find(match);
  if (found === undefined) throw new Error('the seed has no such account');
  return found;
}

describe('MockAppAccountRepository (DL-168)', () => {
  it.each(['mswdo-head', 'social-worker', 'auditor'] as const)(
    're-checks the grant for %s, because hiding the screen is not protection',
    async (role) => {
      const refusal: unknown = await firstValueFrom(signedInAs(role).list({ limit: 20 })).catch(
        (error: unknown) => error,
      );
      expect(isPermissionDenied(refusal)).toBe(true);
    },
  );

  it('pages with a cursor and no total, every address at the reserved sample name', async () => {
    const repository = signedInAs('system-administrator');
    const first = await firstValueFrom(repository.list({ limit: 20 }));

    expect(first.hasMore).toBe(true);
    expect(Object.keys(first)).not.toContain('total');
    for (const account of first.items) {
      expect(account.email?.endsWith(`@${SAMPLE_ACCOUNT_DOMAIN}`)).toBe(true);
    }
  });

  it('refuses a change to the reader’s own role, as the API does', async () => {
    const repository = signedInAs('system-administrator');

    await expect(
      firstValueFrom(repository.changeRole(asId<AppAccountId>('staff-admin'), 'registered')),
    ).rejects.toThrow(/your own role/);
  });

  it('changes another account’s role, keeping its office link', async () => {
    const repository = signedInAs('system-administrator');
    const staff = await find(
      repository,
      (account) => account.officeId !== null && account.role === 'staff',
    );

    const changed = await firstValueFrom(repository.changeRole(staff.id, 'verified'));
    expect(changed.role).toBe('verified');
    expect(changed.officeId).toBe(staff.officeId);
  });

  it('links only a staff account to an office that exists', async () => {
    const repository = signedInAs('system-administrator');
    const resident = await find(repository, (account) => account.role === 'registered');
    const staff = await find(repository, (account) => account.role === 'staff');

    await expect(
      firstValueFrom(repository.assignOffice(resident.id, MOCK_OFFICE_MSWDO)),
    ).rejects.toThrow(/Only a staff account/);
    await expect(
      firstValueFrom(repository.assignOffice(staff.id, asId<OfficeId>('office-nowhere'))),
    ).rejects.toThrow(/not found/);
    expect((await firstValueFrom(repository.assignOffice(staff.id, null))).officeId).toBeNull();
  });

  it('gives a staff account an office role, and clears it when the account leaves staff (DL-173)', async () => {
    const repository = signedInAs('system-administrator');
    const resident = await find(repository, (account) => account.role === 'registered');
    const staff = await find(repository, (account) => account.role === 'staff');

    await expect(
      firstValueFrom(repository.assignOfficeRole(resident.id, { role: 'auditor', barangayId: null, reason: 'x' })),
    ).rejects.toThrow(/Only a staff account/);
    await expect(
      firstValueFrom(repository.assignOfficeRole(staff.id, { role: 'auditor', barangayId: null, reason: ' ' })),
    ).rejects.toThrow(/Say why/);

    const given = await firstValueFrom(
      repository.assignOfficeRole(staff.id, { role: 'auditor', barangayId: null, reason: 'Oversight.' }),
    );
    expect(given.officeRole).toBe('auditor');

    const demoted = await firstValueFrom(repository.changeRole(staff.id, 'verified'));
    expect(demoted.officeRole).toBeNull();
    const promoted = await firstValueFrom(repository.changeRole(staff.id, 'staff'));
    expect(promoted.officeRole).toBeNull();
  });

  it('corrects only a verified account’s name, against the name shown, as the API does (DL-198)', async () => {
    const repository = signedInAs('system-administrator');
    const verified = await find(
      repository,
      (account) => account.role === 'verified' && account.name !== null,
    );
    const resident = await find(
      repository,
      (account) => account.role === 'registered' && account.name !== null,
    );
    const shown = verified.name ?? '';

    await expect(
      firstValueFrom(
        repository.correctName(resident.id, { name: 'New Name', previousName: resident.name ?? '' }),
      ),
    ).rejects.toThrow(/Only a verified account/);
    await expect(
      firstValueFrom(repository.correctName(verified.id, { name: 'New Name', previousName: 'Other' })),
    ).rejects.toThrow(/not the one shown/);
    await expect(
      firstValueFrom(repository.correctName(verified.id, { name: shown, previousName: shown })),
    ).rejects.toThrow(/already the account/);

    const corrected = await firstValueFrom(
      repository.correctName(verified.id, { name: ' New Name ', previousName: shown }),
    );
    expect(corrected.name).toBe('New Name');
  });

  it('lets only a reader who reviews IDs correct a name', async () => {
    const verified = await find(
      signedInAs('system-administrator'),
      (account) => account.role === 'verified',
    );
    const refusal: unknown = await firstValueFrom(
      signedInAs('mswdo-head').correctName(verified.id, {
        name: 'New Name',
        previousName: verified.name ?? '',
      }),
    ).catch((error: unknown) => error);

    expect(isPermissionDenied(refusal)).toBe(true);
  });
});
