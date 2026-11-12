import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  isPermissionDenied,
  ROLE_DEFINITIONS,
  type AppAccountId,
  type AuthenticatedUser,
  type DigitalIdId,
  type Permission,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockDigitalIdRepository, SAMPLE_QR_PREFIX } from './mock-digital-id.repository';

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

function signedInAs(role: StaffRole): MockDigitalIdRepository {
  const definition = ROLE_DEFINITIONS[role];
  const user: AuthenticatedUser = {
    id: asId<StaffUserId>('staff-test'),
    displayName: 'Test User',
    email: 'test@example.gov.ph',
    role,
    roleLabel: definition.label,
    position: 'Tester',
    barangayId: null,
    scope: definition.scope,
    permissions: new Set<Permission>(definition.permissions),
  };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useValue: { currentUser: () => user } },
      MockDigitalIdRepository,
    ],
  });
  return TestBed.inject(MockDigitalIdRepository);
}

const ACTIVE = asId<DigitalIdId>('card-0001');
const SUSPENDED = asId<DigitalIdId>('card-0002');
const DANILO = asId<AppAccountId>('app-account-0004');

async function refusal(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected a refusal');
}

describe('MockDigitalIdRepository (DL-171)', () => {
  it('lets every staff role check a card, as the server does, and refuses a code it cannot read', async () => {
    for (const role of ['auditor', 'barangay-link', 'intake-officer'] as const) {
      const holder = await firstValueFrom(signedInAs(role).check(`${SAMPLE_QR_PREFIX}${ACTIVE}`));
      expect(holder.status).toBe('active');
    }
    const error = await refusal(firstValueFrom(signedInAs('auditor').check('not-a-code')));
    expect((error as Error).message).toBe('That QR code is not valid.');
  });

  it('keeps cards for the administrator alone', async () => {
    const error = await refusal(firstValueFrom(signedInAs('mswdo-head').cardOf(DANILO)));
    expect(isPermissionDenied(error)).toBe(true);
  });

  it('suspends only an active card, and never makes a suspended one active again', async () => {
    const cards = signedInAs('system-administrator');
    expect((await firstValueFrom(cards.suspend(ACTIVE))).status).toBe('suspended');
    const again = await refusal(firstValueFrom(cards.suspend(SUSPENDED)));
    expect((again as Error).message).toBe('That digital ID cannot be suspended.');
  });

  it('revokes a card so that it is nobody’s current card, and then issues a new one', async () => {
    const cards = signedInAs('system-administrator');
    await firstValueFrom(cards.revoke(ACTIVE));
    expect(await firstValueFrom(cards.cardOf(DANILO))).toBeNull();

    const issued = await firstValueFrom(cards.issue(DANILO));
    expect(issued.status).toBe('active');
    expect(issued.id).not.toBe(ACTIVE);
  });

  it('replaces a card with a new number and the same photo', async () => {
    const cards = signedInAs('system-administrator');
    const before = await firstValueFrom(cards.cardOf(DANILO));
    const after = await firstValueFrom(cards.reissue(ACTIVE));
    expect(after.number).not.toBe(before?.number);
    expect(after.photo).toBe(before?.photo);
    expect((await firstValueFrom(cards.cardOf(DANILO)))?.id).toBe(after.id);
  });

  it('issues only to a verified resident with no current card', async () => {
    const cards = signedInAs('system-administrator');
    const held = await refusal(firstValueFrom(cards.issue(DANILO)));
    expect((held as Error).message).toBe('That resident already has a digital ID.');
    const resident = await refusal(
      firstValueFrom(cards.issue(asId<AppAccountId>('app-account-0005'))),
    );
    expect((resident as Error).message).toBe('Only a verified resident can hold a digital ID.');
  });

  it('lists every card with counts under the filter less its status (DL-212)', async () => {
    const cards = signedInAs('system-administrator');
    const all = await firstValueFrom(cards.list({ limit: 50, cursor: null }, {}));
    const revoked = await firstValueFrom(
      cards.list({ limit: 50, cursor: null }, { status: 'revoked' }),
    );

    expect(all.items.length).toBeGreaterThan(revoked.items.length);
    expect(revoked.items.every((item) => item.status === 'revoked')).toBe(true);
    expect(revoked.counts).toEqual(all.counts);
    expect(all.counts.expiring).toBeLessThanOrEqual(all.counts.active);
    expect(all.items.some((item) => item.expired)).toBe(true);
  });

  it('refuses the list without digital-id.manage (DL-212)', async () => {
    const error = await refusal(
      firstValueFrom(signedInAs('mswdo-head').list({ limit: 20, cursor: null }, {})),
    );
    expect(isPermissionDenied(error)).toBe(true);
  });
});
