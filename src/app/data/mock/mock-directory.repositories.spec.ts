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
  type OfficeDraft,
  type Permission,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import {
  MockDirectoryOfficeRepository,
  MockHotlineRepository,
  MockTulongServiceRepository,
} from './mock-directory.repositories';
import { MOCK_OFFICE_MSWDO } from './seed/offices.seed';

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

const DRAFT: OfficeDraft = {
  name: 'Tourism Office',
  slug: 'tourism',
  shortName: null,
  category: null,
  description: null,
  head: null,
  hours: null,
  phone: null,
  email: null,
  address: null,
  latitude: null,
  longitude: null,
};

function signedInAs(role: StaffRole): void {
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
      MockDirectoryOfficeRepository,
      MockTulongServiceRepository,
      MockHotlineRepository,
    ],
  });
}

const png = (size = 16) => new Blob([new Uint8Array(size)], { type: 'image/png' });

describe('MockDirectoryOfficeRepository (DL-170)', () => {
  it('reads the directory for anybody, a page at a time, as the public list does', async () => {
    signedInAs('intake-officer');
    const offices = TestBed.inject(MockDirectoryOfficeRepository);

    const page = await firstValueFrom(offices.list({ limit: 2, cursor: null }));
    expect(page.items).toHaveLength(2);
    expect(page.hasMore).toBe(true);
  });

  it('refuses every change to anybody without office.manage', async () => {
    signedInAs('mswdo-head');
    const offices = TestBed.inject(MockDirectoryOfficeRepository);

    const refusal: unknown = await firstValueFrom(offices.create(DRAFT, null)).catch(
      (e: unknown) => e,
    );
    expect(isPermissionDenied(refusal)).toBe(true);
  });

  it('creates an office, refuses a taken address and an image the API would not take', async () => {
    signedInAs('system-administrator');
    const offices = TestBed.inject(MockDirectoryOfficeRepository);

    const created = await firstValueFrom(offices.create(DRAFT, png()));
    expect(created).toMatchObject({ slug: 'tourism', hasBanner: true });
    await expect(firstValueFrom(offices.create(DRAFT, null))).rejects.toThrow(
      'slug already exists',
    );
    await expect(
      firstValueFrom(offices.create({ ...DRAFT, slug: 'other' }, png(5 * 1024 * 1024 + 1))),
    ).rejects.toThrow('larger than 5 MB');
  });

  it('refuses to delete an office still named by staff or a conversation, as the server does', async () => {
    signedInAs('system-administrator');
    const offices = TestBed.inject(MockDirectoryOfficeRepository);

    await expect(firstValueFrom(offices.remove(MOCK_OFFICE_MSWDO))).rejects.toThrow(
      'still has staff or other records',
    );
    const created = await firstValueFrom(offices.create(DRAFT, null));
    await expect(firstValueFrom(offices.remove(created.id))).resolves.toBeUndefined();
  });
});

describe('MockTulongServiceRepository (DL-170)', () => {
  it('leaves a hidden page out of the list, and finds it by its address', async () => {
    signedInAs('system-administrator');
    const services = TestBed.inject(MockTulongServiceRepository);

    const page = await firstValueFrom(services.list({ limit: 50, cursor: null }));
    expect(page.items.some((service) => service.hiddenFromList)).toBe(false);
    expect((await firstValueFrom(services.find('typhoon-relief-2025')))?.hiddenFromList).toBe(true);
    expect(await firstValueFrom(services.find('nothing-here'))).toBeNull();
  });

  it('hides a page, which then leaves the list too', async () => {
    signedInAs('system-administrator');
    const services = TestBed.inject(MockTulongServiceRepository);
    const [first] = (await firstValueFrom(services.list({ limit: 50, cursor: null }))).items;
    if (first === undefined) throw new Error('The seed lists no page.');

    await firstValueFrom(services.update(first.id, { hiddenFromList: true }));
    const after = await firstValueFrom(services.list({ limit: 50, cursor: null }));
    expect(after.items.map((service) => service.id)).not.toContain(first.id);
  });

  it('sets a picture, and refuses changes without service.manage', async () => {
    signedInAs('system-administrator');
    const services = TestBed.inject(MockTulongServiceRepository);
    const page = await firstValueFrom(services.find('pwd-id'));
    if (page === null) throw new Error('The seed has no PWD ID page.');

    expect((await firstValueFrom(services.replaceImage(page.id, png()))).hasImage).toBe(true);

    signedInAs('social-worker');
    const refusal: unknown = await firstValueFrom(
      TestBed.inject(MockTulongServiceRepository).remove(page.id),
    ).catch((e: unknown) => e);
    expect(isPermissionDenied(refusal)).toBe(true);
  });
});

describe('MockHotlineRepository (DL-170)', () => {
  it('lists every line, shown and hidden, by order then name', async () => {
    signedInAs('system-administrator');
    const hotlines = TestBed.inject(MockHotlineRepository);

    const listing = await firstValueFrom(hotlines.list());
    const orders = listing.hotlines.map((hotline) => hotline.sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(listing.hotlines.some((hotline) => !hotline.active)).toBe(true);
    expect(listing.mayBeIncomplete).toBe(false);
  });

  it('refuses the list itself to anybody without hotline.manage, as GET admin/hotlines does', async () => {
    signedInAs('mswdo-head');
    const refusal: unknown = await firstValueFrom(
      TestBed.inject(MockHotlineRepository).list(),
    ).catch((e: unknown) => e);
    expect(isPermissionDenied(refusal)).toBe(true);
  });

  it('adds, changes and deletes a line', async () => {
    signedInAs('system-administrator');
    const hotlines = TestBed.inject(MockHotlineRepository);

    const line = await firstValueFrom(
      hotlines.create({
        name: 'Rescue',
        number: '911',
        category: 'Emergency',
        sortOrder: 0,
        active: true,
      }),
    );
    expect((await firstValueFrom(hotlines.update(line.id, { active: false }))).active).toBe(false);
    await firstValueFrom(hotlines.remove(line.id));
    const listing = await firstValueFrom(hotlines.list());
    expect(listing.hotlines.map((hotline) => hotline.id)).not.toContain(line.id);
  });
});
