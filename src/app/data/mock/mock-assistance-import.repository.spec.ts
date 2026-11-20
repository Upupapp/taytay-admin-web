import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  isPermissionDenied,
  ROLE_DEFINITIONS,
  type AccessContext,
  type AuthenticatedUser,
  type Permission,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockAssistanceImportRepository } from './mock-assistance-import.repository';

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

function signedInAs(role: StaffRole): MockAssistanceImportRepository {
  const definition = ROLE_DEFINITIONS[role];
  const user: AuthenticatedUser = {
    id: asId<StaffUserId>('staff-test'),
    displayName: 'Test Officer',
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
      MockAssistanceImportRepository,
    ],
  });
  return TestBed.inject(MockAssistanceImportRepository);
}

/** Sample rows only: a seeded resident named once, a stranger, a repeated control number and a bad row. */
const REPORT = [
  'Surname,Given name,Barangay,Type of assistance,Date given,Control no.',
  'Mercado,Joselito,San Juan,AICS,2024-03-04,C-1',
  'Zapanta,Juan,Dolores,AICS,2024-04-01,C-2',
  'Mercado,Joselito,San Juan,AICS,2024-03-05,C-1',
  'Lim,Rosa,San Juan,,2024-01-01,C-3',
].join('\n');

describe('MockAssistanceImportRepository (DL-228)', () => {
  it('refuses anybody without request.import', async () => {
    const refusal: unknown = await firstValueFrom(
      signedInAs('social-worker').list({ limit: 20, cursor: null }),
    ).catch((e: unknown) => e);
    expect(isPermissionDenied(refusal)).toBe(true);
  });

  it('groups the rows, holds the commit while a row waits, and files nothing before it', async () => {
    const imports = signedInAs('intake-officer');
    const uploaded = await firstValueFrom(
      imports.upload(new File([REPORT], 'tulong.csv', { type: 'text/csv' })),
    );
    const record = await firstValueFrom(imports.get(uploaded.id));
    expect(record?.missingFields).toEqual([]);
    expect(record?.rows.map((row) => row.group)).toEqual([
      'ready',
      'needs-review',
      'duplicate',
      'error',
    ]);
    expect(record?.rows[0]?.match?.how).toBe('proposed');
    expect(record?.rows[0]?.candidates[0]?.signals.length).toBeGreaterThan(0);
    expect(record?.rows[2]?.duplicate?.ofRow).toBe(1);

    await expect(firstValueFrom(imports.commit(uploaded.id))).rejects.toThrow(/decision/);
  });

  it('refuses a create the registry would refuse, takes one it would not, and commits', async () => {
    const imports = signedInAs('intake-officer');
    const { id } = await firstValueFrom(
      imports.upload(new File([REPORT], 'tulong.csv', { type: 'text/csv' })),
    );
    await expect(
      firstValueFrom(imports.resolve(id, 2, { action: 'create', record: {}, reason: 'New.' })),
    ).rejects.toThrow(/registry needs more/);
    await expect(
      firstValueFrom(imports.resolve(id, 4, { action: 'skip', reason: 'Bad.' })),
    ).rejects.toThrow(/errors/);

    const resolved = await firstValueFrom(
      imports.resolve(id, 2, {
        action: 'create',
        record: {
          sex: 'male',
          birthDate: '1960-02-03',
          civilStatus: 'married',
          streetAddress: '1 Sample St.',
        },
        reason: 'Not on the registry.',
      }),
    );
    expect(resolved.rows[1]?.group).toBe('ready');
    expect(resolved.rows[1]?.willCreate).toBe(true);
    expect(resolved.rows[1]?.resolution?.by).toBe('Test Officer');

    const committed = await firstValueFrom(imports.commit(id));
    expect(committed.result).toEqual({
      imported: 2,
      skipped: 0,
      duplicates: 1,
      errors: 1,
      residentsCreated: 1,
    });
    const after = await firstValueFrom(imports.get(id));
    expect(after?.rows).toEqual([]);
    expect(after?.outcomes.map((outcome) => outcome.outcome)).toEqual([
      'imported',
      'imported',
      'duplicate',
      'error',
    ]);
  });

  it('withdraws a committed import once, with a reason, and lists it newest first', async () => {
    const imports = signedInAs('mswdo-head');
    const { id } = await firstValueFrom(
      imports.upload(new File([REPORT], 'tulong.csv', { type: 'text/csv' })),
    );
    await expect(firstValueFrom(imports.withdraw(id, 'Too early.'))).rejects.toThrow(/committed/);
    await firstValueFrom(imports.resolve(id, 2, { action: 'skip', reason: 'Not ours.' }));
    await firstValueFrom(imports.commit(id));

    const withdrawn = await firstValueFrom(imports.withdraw(id, '  Wrong year. '));
    expect(withdrawn.status).toBe('withdrawn');
    expect(withdrawn.withdrawal?.reason).toBe('Wrong year.');
    await expect(firstValueFrom(imports.withdraw(id, 'Again.'))).rejects.toThrow(/only once/);

    const page = await firstValueFrom(imports.list({ limit: 20, cursor: null }));
    expect(page.items[0]?.id).toBe(id);
  });

  it('hands out a header-only template, with no sample row', async () => {
    const template = await firstValueFrom(signedInAs('intake-officer').template());
    expect(template.contentType).toBe('text/csv');
    expect(template.content.trim().split('\n')).toHaveLength(1);
  });
});
