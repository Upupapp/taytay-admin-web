import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  isAppConfigRefusal,
  isPermissionDenied,
  ROLE_DEFINITIONS,
  type AccessContext,
  type AuthenticatedUser,
  type Permission,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockAppConfigRepository } from './mock-app-config.repository';

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

function signedInAs(role: StaffRole): MockAppConfigRepository {
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
      MockAppConfigRepository,
    ],
  });
  return TestBed.inject(MockAppConfigRepository);
}

describe('MockAppConfigRepository (DL-170)', () => {
  it('reads the settings for anybody, as the public read does', async () => {
    const config = await firstValueFrom(signedInAs('auditor').read());
    expect(config.minimumAppVersion).toBe('1.0.0');
  });

  it('refuses a change to anybody without app-config.manage', async () => {
    const refusal: unknown = await firstValueFrom(
      signedInAs('mswdo-head').change({ contactLine: null }),
    ).catch((e: unknown) => e);
    expect(isPermissionDenied(refusal)).toBe(true);
  });

  it('changes only what it is given: null clears a setting and deletes a flag', async () => {
    const settings = signedInAs('system-administrator');

    const changed = await firstValueFrom(
      settings.change({
        supportEmail: null,
        featureFlags: [
          { key: 'show_digital_id', value: null },
          { key: 'new_flag', value: 'on' },
        ],
      }),
    );

    expect(changed.supportEmail).toBeNull();
    expect(changed.contactLine).toBe('(02) 8000 0100');
    expect(changed.featureFlags).toEqual([
      { key: 'new_flag', value: 'on' },
      { key: 'tulong_catalogue', value: 'on' },
    ]);
  });

  describe('the review time (DL-205)', () => {
    it('starts from the range the API’s migration stores, and is kept by any other change', async () => {
      const settings = signedInAs('system-administrator');
      expect((await firstValueFrom(settings.read())).verificationReviewWorkingDays).toEqual({
        min: 1,
        max: 3,
      });
      const changed = await firstValueFrom(settings.change({ contactLine: null }));
      expect(changed.verificationReviewWorkingDays).toEqual({ min: 1, max: 3 });
    });

    it('stores a new range, and null for the app to state none', async () => {
      const settings = signedInAs('system-administrator');
      const ranged = await firstValueFrom(
        settings.change({ verificationReviewWorkingDays: { min: 2, max: 5 } }),
      );
      expect(ranged.verificationReviewWorkingDays).toEqual({ min: 2, max: 5 });

      const cleared = await firstValueFrom(
        settings.change({ verificationReviewWorkingDays: null }),
      );
      expect(cleared.verificationReviewWorkingDays).toBeNull();
    });

    it('refuses what the API refuses, each sentence by the end it is about', async () => {
      const settings = signedInAs('system-administrator');
      const refusal: unknown = await firstValueFrom(
        settings.change({ verificationReviewWorkingDays: { min: 5, max: 2 } }),
      ).catch((e: unknown) => e);

      expect(isAppConfigRefusal(refusal)).toBe(true);
      if (isAppConfigRefusal(refusal)) {
        expect(refusal.reviewTime).toEqual([
          { field: 'max', message: 'The fewest working days cannot be more than the most.' },
        ]);
      }
      const tooMany: unknown = await firstValueFrom(
        settings.change({ verificationReviewWorkingDays: { min: 0, max: 31 } }),
      ).catch((e: unknown) => e);
      expect(isAppConfigRefusal(tooMany) ? tooMany.reviewTime : null).toEqual([
        { field: 'min', message: 'At least 1 working day.' },
        { field: 'max', message: 'At most 30 working days.' },
      ]);
      expect((await firstValueFrom(settings.read())).verificationReviewWorkingDays).toEqual({
        min: 1,
        max: 3,
      });
    });
  });

  describe('the biometric consent (DL-216)', () => {
    it('starts as the API’s placeholder, so every selfie is refused, and keeps it through other changes', async () => {
      const settings = signedInAs('system-administrator');
      expect((await firstValueFrom(settings.read())).biometricConsent?.version).toBe('placeholder');
      const changed = await firstValueFrom(settings.change({ contactLine: null }));
      expect(changed.biometricConsent?.version).toBe('placeholder');
    });

    it('publishes the text with its version, and refuses the placeholder’s version', async () => {
      const settings = signedInAs('system-administrator');
      const refusal: unknown = await firstValueFrom(
        settings.change({ biometricConsent: { version: 'placeholder', bodyMarkdown: 'Text.' } }),
      ).catch((e: unknown) => e);
      expect(refusal).toBeInstanceOf(Error);

      const published = await firstValueFrom(
        settings.change({
          biometricConsent: { version: ' 2026-11 ', bodyMarkdown: ' The approved consent. ' },
        }),
      );
      expect(published.biometricConsent).toMatchObject({
        version: '2026-11',
        bodyMarkdown: 'The approved consent.',
      });
      // It has no version setting of its own beside it, and touches none of the others.
      expect(published.termsVersion).toBe('2026-01');
      expect(published.privacyVersion).toBe('placeholder');
    });
  });
});
