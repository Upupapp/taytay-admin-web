import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

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
  type VerificationRequest,
  type VerificationRequestId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockVerificationRepository } from './mock-verification.repository';
import { SAMPLE_IMAGE_MARKER } from './seed/verification-requests.seed';

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

function signedInAs(role: StaffRole): MockVerificationRepository {
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
      MockVerificationRepository,
    ],
  });
  return TestBed.inject(MockVerificationRepository);
}

async function firstPending(repository: MockVerificationRepository): Promise<VerificationRequest> {
  const page = await firstValueFrom(repository.list({ status: 'pending' }, { limit: 1 }));
  const first = page.items[0];
  if (first === undefined) {
    throw new Error('the seed has no pending request');
  }
  return first;
}

describe('MockVerificationRepository', () => {
  it('pages the queue by cursor, newest first, with no total', async () => {
    const repository = signedInAs('system-administrator');

    const first = await firstValueFrom(repository.list({ status: 'pending' }, { limit: 20 }));
    expect(first.items).toHaveLength(20);
    expect(first.hasMore).toBe(true);
    expect(Object.keys(first).sort()).toEqual(['hasMore', 'items', 'nextCursor']);

    const sent = first.items.map((item) => item.submittedAt);
    expect([...sent].sort().reverse()).toEqual(sent);

    const second = await firstValueFrom(
      repository.list({ status: 'pending' }, { limit: 20, cursor: first.nextCursor }),
    );
    expect(second.hasMore).toBe(false);
    expect(second.nextCursor).toBeNull();
    expect(second.items.every((item) => item.status === 'pending')).toBe(true);
    expect(new Set([...first.items, ...second.items].map((item) => item.id)).size).toBe(
      first.items.length + second.items.length,
    );
  });

  it('lists every status when asked for none', async () => {
    const repository = signedInAs('system-administrator');
    const page = await firstValueFrom(repository.list({ status: null }, { limit: 50 }));

    expect(new Set(page.items.map((item) => item.status))).toEqual(
      new Set(['pending', 'approved', 'rejected']),
    );
  });

  it('records a decision with its words, and refuses a second one as the API does', async () => {
    const repository = signedInAs('system-administrator');
    const waiting = await firstPending(repository);

    const decided = await firstValueFrom(
      repository.reject(waiting.id, 'The photo is too blurred to read the name.'),
    );
    expect(decided.status).toBe('rejected');
    expect(decided.reviewNote).toBe('The photo is too blurred to read the name.');
    expect(decided.reviewedAt).not.toBeNull();

    await expect(
      firstValueFrom(repository.approve(waiting.id, 'Selfie matches the ID photo.')),
    ).rejects.toThrow(/no longer pending/);
  });

  it('refuses a decision without a sentence', async () => {
    const repository = signedInAs('system-administrator');
    const waiting = await firstPending(repository);

    await expect(firstValueFrom(repository.approve(waiting.id, 'ok'))).rejects.toThrow(
      /needs a sentence/,
    );
  });

  it('refuses a request it does not hold', async () => {
    const repository = signedInAs('system-administrator');

    await expect(
      firstValueFrom(
        repository.approve(asId<VerificationRequestId>('vr-nowhere'), 'Selfie matches the ID.'),
      ),
    ).rejects.toThrow(/not found/);
  });

  it('hands over a drawn placeholder that says it is a sample, never a photograph', async () => {
    const repository = signedInAs('system-administrator');
    const waiting = await firstPending(repository);

    const image = await firstValueFrom(repository.openImage(waiting, 'selfie'));
    expect(image.type).toBe('image/svg+xml');
    expect(await image.text()).toContain(SAMPLE_IMAGE_MARKER);
  });

  it.each(['mswdo-head', 'social-worker', 'auditor'] as const)(
    're-checks the grant for %s, because hiding the screen is not protection',
    async (role) => {
      const repository = signedInAs(role);

      const refusal: unknown = await firstValueFrom(
        repository.list({ status: 'pending' }, { limit: 20 }),
      ).catch((error: unknown) => error);
      expect(isPermissionDenied(refusal)).toBe(true);
    },
  );
});
