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
});
