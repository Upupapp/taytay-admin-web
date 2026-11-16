import { TestBed } from '@angular/core/testing';
import { firstValueFrom, type Observable } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  isArchiveRefusal,
  isPermissionDenied,
  ROLE_DEFINITIONS,
  type AccessContext,
  type ArchiveRefusalKind,
  type AuthenticatedUser,
  type Permission,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockHomeScreenRepository } from './mock-home-screen.repository';
import { MOCK_HOTLINES } from './seed/directory.seed';
import { MOCK_HOME_BANNERS } from './seed/home.seed';

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
const LINK = { label: 'Hotlines', href: 'https://home.example.test/hotlines', sortOrder: 5 };

/** The kind of archive refusal an act ended in, or `null` for any other outcome. */
async function archiveRefusalOf(act: Observable<unknown>): Promise<ArchiveRefusalKind | null> {
  const failure: unknown = await firstValueFrom(act).then(
    () => null,
    (error: unknown) => error,
  );
  return isArchiveRefusal(failure) ? failure.kind : null;
}

describe('MockHomeScreenRepository (DL-170)', () => {
  it('refuses the lists and every change to anybody without home.manage', async () => {
    const home = signedInAs('mswdo-head');
    const [banner] = MOCK_HOME_BANNERS;
    if (banner === undefined) throw new Error('The seed is empty.');

    for (const refusal of [
      await firstValueFrom(home.banners(false)).catch((e: unknown) => e),
      await firstValueFrom(home.links(true)).catch((e: unknown) => e),
      await firstValueFrom(home.createBanner(DRAFT, null)).catch((e: unknown) => e),
      await firstValueFrom(home.archiveBanner(banner.id, 'Ended.')).catch((e: unknown) => e),
      await firstValueFrom(home.bannerHistory(banner.id)).catch((e: unknown) => e),
    ]) {
      expect(isPermissionDenied(refusal)).toBe(true);
    }
  });

  it('previews only shown banners in use, by order, and every link in use — for anybody, as GET home does', async () => {
    const preview = await firstValueFrom(signedInAs('intake-officer').preview());

    expect(preview.banners.every((banner) => banner.active && banner.archived === null)).toBe(true);
    expect(preview.banners.map((banner) => banner.sortOrder)).toEqual([1, 2]);
    expect(preview.links).toHaveLength(2);
    expect(preview.links.every((link) => link.archived === null)).toBe(true);
    // An archived line is in no list the app reads, whatever `active` says (DL-225).
    expect(preview.hotlines).toBe(
      MOCK_HOTLINES.filter((line) => line.active && line.archived === null).length,
    );
  });

  it('stores an image with a new banner, replaces and removes it, and refuses one too large', async () => {
    const home = signedInAs('system-administrator');

    const banner = await firstValueFrom(home.createBanner(DRAFT, png()));
    expect(banner.mediaId).not.toBeNull();
    expect(banner.archived).toBeNull();
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

  it('hides a banner from the preview, and keeps it in the list in use', async () => {
    const home = signedInAs('system-administrator');
    const [first] = await firstValueFrom(home.banners(false));
    if (first === undefined) throw new Error('The seed is empty.');

    await firstValueFrom(
      home.updateBanner(first.id, { ...first, active: false }, { kind: 'keep' }),
    );
    const preview = await firstValueFrom(home.preview());

    expect(preview.banners.map((banner) => banner.id)).not.toContain(first.id);
    expect((await firstValueFrom(home.banners(false))).map((banner) => banner.id)).toContain(
      first.id,
    );
  });
});

describe('MockHomeScreenRepository: archive, never delete (DL-225)', () => {
  it('lists the banners and links in use apart from the archived ones', async () => {
    const home = signedInAs('system-administrator');

    expect((await firstValueFrom(home.banners(false))).every((b) => b.archived === null)).toBe(
      true,
    );
    expect((await firstValueFrom(home.banners(true))).map((banner) => banner.title)).toEqual([
      'Vaccination week, 2025 (sample)',
    ]);
    expect((await firstValueFrom(home.links(true))).map((link) => link.label)).toEqual([
      'Relief sign-up, 2025 (sample)',
    ]);
    expect((await firstValueFrom(home.links(false))).every((l) => l.archived === null)).toBe(true);
  });

  it('archives a banner with its image kept, restores it as it was, and keeps both acts', async () => {
    const home = signedInAs('system-administrator');
    const banner = await firstValueFrom(home.createBanner(DRAFT, png()));

    const archived = await firstValueFrom(home.archiveBanner(banner.id, '  The campaign ended. '));
    expect(archived).toMatchObject({
      mediaId: banner.mediaId,
      active: true,
      archived: { byName: 'Test User', reason: 'The campaign ended.' },
    });
    expect((await firstValueFrom(home.preview())).banners.map((b) => b.id)).not.toContain(
      banner.id,
    );
    expect((await firstValueFrom(home.banners(true))).map((b) => b.id)).toContain(banner.id);

    const restored = await firstValueFrom(home.restoreBanner(banner.id, 'It runs again.'));
    expect(restored).toMatchObject({ mediaId: banner.mediaId, active: true, archived: null });
    expect((await firstValueFrom(home.preview())).banners.map((b) => b.id)).toContain(banner.id);

    const history = await firstValueFrom(home.bannerHistory(banner.id));
    expect(history.map((event) => [event.act, event.reason, event.actorName])).toEqual([
      ['restored', 'It runs again.', 'Test User'],
      ['archived', 'The campaign ended.', 'Test User'],
    ]);
  });

  it('takes no change to an archived banner, and refuses what somebody already did', async () => {
    const home = signedInAs('system-administrator');
    const [archived] = await firstValueFrom(home.banners(true));
    const [inUse] = await firstValueFrom(home.banners(false));
    if (archived === undefined || inUse === undefined) throw new Error('The seed is empty.');

    expect(await archiveRefusalOf(home.updateBanner(archived.id, DRAFT, { kind: 'keep' }))).toBe(
      'read-only',
    );
    expect(await archiveRefusalOf(home.archiveBanner(archived.id, 'Again.'))).toBe(
      'already-archived',
    );
    expect(await archiveRefusalOf(home.restoreBanner(inUse.id, 'Again.'))).toBe('not-archived');
    await expect(firstValueFrom(home.archiveBanner(inUse.id, ' '))).rejects.toThrow(
      'reason of 1 to 500',
    );
    await expect(firstValueFrom(home.archiveBanner(inUse.id, 'x'.repeat(501)))).rejects.toThrow(
      'reason of 1 to 500',
    );
  });

  it('archives and restores a link in the same way, out of and back into the preview', async () => {
    const home = signedInAs('system-administrator');
    const link = await firstValueFrom(home.createLink(LINK));
    expect(link.archived).toBeNull();

    await firstValueFrom(home.archiveLink(link.id, 'Replaced by the hotlines tile.'));
    expect((await firstValueFrom(home.preview())).links.map((l) => l.id)).not.toContain(link.id);
    expect(await archiveRefusalOf(home.updateLink(link.id, LINK))).toBe('read-only');
    expect(await archiveRefusalOf(home.archiveLink(link.id, 'Again.'))).toBe('already-archived');

    expect((await firstValueFrom(home.restoreLink(link.id, 'Back.'))).archived).toBeNull();
    expect(await archiveRefusalOf(home.restoreLink(link.id, 'Again.'))).toBe('not-archived');
    expect((await firstValueFrom(home.preview())).links.map((l) => l.id)).toContain(link.id);
    expect((await firstValueFrom(home.linkHistory(link.id))).map((event) => event.act)).toEqual([
      'restored',
      'archived',
    ]);
    await expect(firstValueFrom(home.restoreLink(link.id, ''))).rejects.toThrow(
      'reason of 1 to 500',
    );
  });
});
