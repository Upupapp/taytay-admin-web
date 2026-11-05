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

import { MockHomeScreenRepository } from './mock-home-screen.repository';

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

function signedInAs(role: StaffRole): MockHomeScreenRepository {
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
      MockHomeScreenRepository,
    ],
  });
  return TestBed.inject(MockHomeScreenRepository);
}

const png = (size = 16) => new Blob([new Uint8Array(size)], { type: 'image/png' });
const DRAFT = { title: 'New banner', href: null, sortOrder: 0, active: true };

describe('MockHomeScreenRepository (DL-170)', () => {
  it('refuses the lists and every change to anybody without home.manage', async () => {
    const home = signedInAs('mswdo-head');

    for (const refusal of [
      await firstValueFrom(home.banners()).catch((e: unknown) => e),
      await firstValueFrom(home.links()).catch((e: unknown) => e),
      await firstValueFrom(home.createBanner(DRAFT, null)).catch((e: unknown) => e),
    ]) {
      expect(isPermissionDenied(refusal)).toBe(true);
    }
  });

  it('previews only shown banners, by order, and every link — for anybody, as GET home does', async () => {
    const preview = await firstValueFrom(signedInAs('intake-officer').preview());

    expect(preview.banners.every((banner) => banner.active)).toBe(true);
    expect(preview.banners.map((banner) => banner.sortOrder)).toEqual([1, 2]);
    expect(preview.links).toHaveLength(2);
  });

  it('stores an image with a new banner, replaces and removes it, and refuses one too large', async () => {
    const home = signedInAs('system-administrator');

    const banner = await firstValueFrom(home.createBanner(DRAFT, png()));
    expect(banner.mediaId).not.toBeNull();
    expect((await firstValueFrom(home.bannerImage(banner))).size).toBeGreaterThan(0);

    const replaced = await firstValueFrom(
      home.updateBanner(banner.id, DRAFT, { kind: 'replace', image: png() }),
    );
    expect(replaced.mediaId).not.toBe(banner.mediaId);
    const removed = await firstValueFrom(home.updateBanner(banner.id, DRAFT, { kind: 'remove' }));
    expect(removed.mediaId).toBeNull();

    await expect(
      firstValueFrom(home.createBanner(DRAFT, png(5 * 1024 * 1024 + 1))),
    ).rejects.toThrow('larger than 5 MB');
  });

  it('hides a banner from the preview, and deletes a link from it', async () => {
    const home = signedInAs('system-administrator');
    const [first] = await firstValueFrom(home.banners());
    const [link] = await firstValueFrom(home.links());
    if (first === undefined || link === undefined) throw new Error('The seed is empty.');

    await firstValueFrom(
      home.updateBanner(first.id, { ...first, active: false }, { kind: 'keep' }),
    );
    await firstValueFrom(home.removeLink(link.id));
    const preview = await firstValueFrom(home.preview());

    expect(preview.banners.map((banner) => banner.id)).not.toContain(first.id);
    expect(preview.links.map((candidate) => candidate.id)).not.toContain(link.id);
  });
});
