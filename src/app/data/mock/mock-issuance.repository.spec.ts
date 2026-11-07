import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  isPermissionDenied,
  ISSUANCE_TERMINAL_STATUSES,
  officeMovesFrom,
  ROLE_DEFINITIONS,
  type AccessContext,
  type AuthenticatedUser,
  type IssuanceRequestId,
  type Permission,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockIssuanceRepository } from './mock-issuance.repository';

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

function signedInAs(role: StaffRole): MockIssuanceRepository {
  const definition = ROLE_DEFINITIONS[role];
  const user: AuthenticatedUser = {
    id: asId<StaffUserId>('staff-x'),
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
      MockIssuanceRepository,
    ],
  });
  return TestBed.inject(MockIssuanceRepository);
}

/** The in-memory document requests refuse what the API refuses (`DL-184`). */
describe('MockIssuanceRepository (DL-184)', () => {
  it('refuses the auditor and the barangay link, as the server does', async () => {
    for (const role of ['auditor', 'barangay-link'] as const) {
      const repository = signedInAs(role);
      const refusal = await firstValueFrom(
        repository.waiting({ status: null, typeId: null }),
      ).catch((error: unknown) => error);
      expect(isPermissionDenied(refusal), role).toBe(true);
    }
  });

  it('keeps the catalogue to the head; the intake officer works requests only', async () => {
    const intake = signedInAs('intake-officer');
    expect(
      (await firstValueFrom(intake.waiting({ status: null, typeId: null }))).length,
    ).toBeGreaterThan(0);
    const refusal = await firstValueFrom(intake.officeTypes()).catch((error: unknown) => error);
    expect(isPermissionDenied(refusal)).toBe(true);
    expect((await firstValueFrom(signedInAs('mswdo-head').officeTypes())).length).toBeGreaterThan(
      0,
    );
  });

  it('lists only open requests in the queue, and pages an ended status', async () => {
    const repository = signedInAs('social-worker');
    const waiting = await firstValueFrom(repository.waiting({ status: null, typeId: null }));
    expect(waiting.some((row) => ISSUANCE_TERMINAL_STATUSES.includes(row.status))).toBe(false);
    expect(waiting.some((row) => 'purpose' in row)).toBe(false);

    const page = await firstValueFrom(
      repository.list({ status: 'released', typeId: null }, { limit: 20, cursor: null }),
    );
    expect(page.items).toHaveLength(20);
    expect(page.hasMore).toBe(true);
  });

  it('moves a request only as the office may, appending to its history', async () => {
    const repository = signedInAs('intake-officer');
    const id = asId<IssuanceRequestId>('issuance-request-0001');
    const before = await firstValueFrom(repository.request(id));
    expect(before.status).toBe('submitted');

    const skipped = await firstValueFrom(
      repository.move(id, { to: 'approved', reason: 'Skipping review.', claimDetails: null }),
    ).catch((error: unknown) => error);
    expect(skipped).toBeInstanceOf(Error);

    const moved = await firstValueFrom(
      repository.move(id, {
        to: 'under-review',
        reason: 'We are reviewing it.',
        claimDetails: null,
      }),
    );
    expect(moved.status).toBe('under-review');
    expect(moved.history).toHaveLength(before.history.length + 1);
    expect(moved.history.at(-1)).toMatchObject({ side: 'office', actorId: 'staff-x' });
    expect(moved.allowedMoves).toEqual(officeMovesFrom('under-review'));
  });

  it('refuses to mark a request ready without saying when and where to claim it', async () => {
    const repository = signedInAs('release-officer');
    const id = asId<IssuanceRequestId>('issuance-request-0005');
    const refusal = await firstValueFrom(
      repository.move(id, { to: 'ready-for-pickup', reason: 'It is ready.', claimDetails: null }),
    ).catch((error: unknown) => error);
    expect(String(refusal)).toMatch(/when and where/);
  });

  it('retires a type one way, and refuses to change it afterwards', async () => {
    const repository = signedInAs('mswdo-head');
    const [type] = await firstValueFrom(repository.catalogue());
    if (type === undefined) throw new Error('no type');
    const retired = await firstValueFrom(repository.retireType(type.id, 'Replaced by a new form.'));
    expect(retired.active).toBe(false);
    expect((await firstValueFrom(repository.catalogue())).some((t) => t.id === type.id)).toBe(
      false,
    );
    const refusal = await firstValueFrom(
      repository.updateType(type.id, { name: 'Again', reason: 'Bringing it back.' }),
    ).catch((error: unknown) => error);
    expect(String(refusal)).toMatch(/retired/);
  });
});
