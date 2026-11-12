import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  identityToConfirm,
  isInPersonRefused,
  isPermissionDenied,
  WriteIntent,
  ROLE_DEFINITIONS,
  type AccessContext,
  type AuthenticatedUser,
  type Permission,
  type StaffRole,
  type StaffUserId,
  type AppAccountId,
  type InPersonCheck,
  type VerificationRequest,
  type VerificationRequestId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockAppAccountStore } from './mock-app-account.store';
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

function signedInAs(role: StaffRole, id = 'staff-x'): MockVerificationRepository {
  const definition = ROLE_DEFINITIONS[role];
  const user: AuthenticatedUser = {
    id: asId<StaffUserId>(id),
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

  describe('verifying an account in person (DL-219)', () => {
    /** Rowena Samonte: a resident's account with a selfie request waiting, in both seeds. */
    const ROWENA = asId<AppAccountId>('app-account-0012');
    const check = (over: Partial<InPersonCheck> = {}): InPersonCheck => ({
      idType: 'sss',
      idLastFour: '4C7K',
      confirmedName: 'Rowena Samonte',
      correctedName: null,
      ...over,
    });
    const refusalOf = (work: Promise<unknown>): Promise<unknown> =>
      work.catch((error: unknown) => error);

    it('verifies the account and supersedes its waiting request, erasing the selfie', async () => {
      const repository = signedInAs('system-administrator');
      const record = await firstValueFrom(
        repository.verifyInPerson(ROWENA, check(), new WriteIntent()),
      );

      expect(record.supersededRequestId).toBe('vr-0008');
      expect(record.nameCorrected).toBe(false);
      expect(TestBed.inject(MockAppAccountStore).find(ROWENA)?.role).toBe('verified');
      const closed = await firstValueFrom(repository.list({ status: 'superseded' }, { limit: 50 }));
      const superseded = closed.items.find((item) => item.id === 'vr-0008');
      expect(superseded?.selfieErasedAt).not.toBeNull();
      expect(superseded?.reviewNote).toMatch(/verified this account in person/);
    });

    it('answers a retry under the same key with the first record, and refuses the key reused', async () => {
      const repository = signedInAs('system-administrator');
      const intent = new WriteIntent();
      const first = await firstValueFrom(repository.verifyInPerson(ROWENA, check(), intent));
      const again = await firstValueFrom(repository.verifyInPerson(ROWENA, check(), intent));
      expect(again).toEqual(first);

      const reused = await refusalOf(
        firstValueFrom(repository.verifyInPerson(ROWENA, check({ idLastFour: '9999' }), intent)),
      );
      expect(reused).toMatchObject({ kind: 'conflict', message: expect.stringMatching(/key/) });
    });

    it('corrects the name in the same act when the ID shows another', async () => {
      const repository = signedInAs('system-administrator');
      const record = await firstValueFrom(
        repository.verifyInPerson(
          ROWENA,
          check({ correctedName: 'Rowena Samonte Cruz' }),
          new WriteIntent(),
        ),
      );
      expect(record.nameCorrected).toBe(true);
      expect(TestBed.inject(MockAppAccountStore).find(ROWENA)?.name).toBe('Rowena Samonte Cruz');
    });

    it.each([
      ['app-account-0004', 'Danilo Ferrer', /already verified/],
      ['app-account-0001', 'Teresita Valdez', /Only a resident’s account/],
      ['app-account-0006', 'Anybody', /gives no name/],
      ['app-account-0012', 'Somebody Else', /not the one confirmed/],
      ['app-account-9999', 'Nobody', /not found/],
    ])('refuses %s as the API does, changing nothing', async (key, name, words) => {
      const repository = signedInAs('system-administrator');
      const refusal = await refusalOf(
        firstValueFrom(
          repository.verifyInPerson(
            asId<AppAccountId>(key),
            check({ confirmedName: name }),
            new WriteIntent(),
          ),
        ),
      );
      expect(isInPersonRefused(refusal)).toBe(true);
      expect(refusal).toMatchObject({ kind: 'conflict', message: expect.stringMatching(words) });
      expect(TestBed.inject(MockAppAccountStore).find(ROWENA)?.role).toBe('registered');
    });

    it('refuses more than four characters on the field, and the reader’s own account', async () => {
      const repository = signedInAs('system-administrator');
      const long = await refusalOf(
        firstValueFrom(
          repository.verifyInPerson(ROWENA, check({ idLastFour: '12345' }), new WriteIntent()),
        ),
      );
      expect(long).toMatchObject({ kind: 'invalid', fields: { idLastFour: expect.any(String) } });

      const own = await refusalOf(
        firstValueFrom(
          signedInAs('system-administrator', 'app-account-0012').verifyInPerson(
            ROWENA,
            check(),
            new WriteIntent(),
          ),
        ),
      );
      expect(own).toMatchObject({ kind: 'forbidden' });
    });

    it('re-checks the grant, because hiding the button is not protection', async () => {
      const refusal = await refusalOf(
        firstValueFrom(signedInAs('mswdo-head').verifyInPerson(ROWENA, check(), new WriteIntent())),
      );
      expect(isPermissionDenied(refusal)).toBe(true);
    });
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
