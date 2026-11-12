import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  identityToConfirm,
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

/** For a refusal that comes before the name is compared. */
const ANY_NAME = { name: 'Any Name', birthDate: null } as const;

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
      new Set(['pending', 'approved', 'rejected', 'superseded']),
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
      firstValueFrom(repository.approve(waiting.id, 'Selfie matches the ID photo.', ANY_NAME)),
    ).rejects.toThrow(/no longer pending/);
  });

  it('refuses a decision without a sentence', async () => {
    const repository = signedInAs('system-administrator');
    const waiting = await firstPending(repository);

    await expect(firstValueFrom(repository.approve(waiting.id, 'ok', ANY_NAME))).rejects.toThrow(
      /needs a sentence/,
    );
  });

  it('refuses a request it does not hold', async () => {
    const repository = signedInAs('system-administrator');

    await expect(
      firstValueFrom(
        repository.approve(
          asId<VerificationRequestId>('vr-nowhere'),
          'Selfie matches the ID.',
          ANY_NAME,
        ),
      ),
    ).rejects.toThrow(/not found/);
  });

  it('approves only the name the account gives, as the API compares it (DL-197)', async () => {
    const repository = signedInAs('system-administrator');
    const waiting = await firstPending(repository);
    const identity = identityToConfirm(waiting);
    if (identity === null) throw new Error('the first waiting sample gives no name');

    await expect(
      firstValueFrom(
        repository.approve(waiting.id, 'Selfie matches the ID photo.', {
          ...identity,
          name: 'Somebody Else',
        }),
      ),
    ).rejects.toThrow(/not the one confirmed/);

    const approved = await firstValueFrom(
      repository.approve(waiting.id, 'Selfie matches the ID photo.', identity),
    );
    expect(approved.status).toBe('approved');
    expect(approved.account).toBeNull();
  });

  it('cannot approve an account that gives no name (DL-197)', async () => {
    const repository = signedInAs('system-administrator');
    const page = await firstValueFrom(repository.list({ status: 'pending' }, { limit: 50 }));
    const nameless = page.items.find((item) => identityToConfirm(item) === null);
    if (nameless === undefined) throw new Error('the samples hold no nameless request');

    await expect(
      firstValueFrom(repository.approve(nameless.id, 'Selfie matches the ID photo.', ANY_NAME)),
    ).rejects.toThrow(/gives no name/);
  });

  it('holds a superseded request and a waiting one whose selfie is gone (DL-218)', async () => {
    const repository = signedInAs('system-administrator');
    const superseded = await firstValueFrom(
      repository.list({ status: 'superseded' }, { limit: 50 }),
    );
    expect(superseded.items.length).toBeGreaterThan(0);
    expect(superseded.items.every((item) => item.selfieErasedAt !== null)).toBe(true);

    const page = await firstValueFrom(repository.list({ status: 'pending' }, { limit: 50 }));
    const erased = page.items.find((item) => item.selfieErasedAt !== null);
    if (erased === undefined) throw new Error('the samples hold no erased selfie');
    const identity = identityToConfirm(erased);
    if (identity === null) throw new Error('the erased sample gives no name');

    await expect(firstValueFrom(repository.openImage(erased, 'selfie'))).rejects.toThrow(
      /not found/,
    );
    await expect(
      firstValueFrom(repository.approve(erased.id, 'Selfie matches the ID photo.', identity)),
    ).rejects.toThrow(/withdrew their consent/);
    expect(await firstValueFrom(repository.openImage(erased, 'id-front'))).toBeInstanceOf(Blob);
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
