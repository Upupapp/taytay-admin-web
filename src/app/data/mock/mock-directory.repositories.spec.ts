import { TestBed } from '@angular/core/testing';
import { firstValueFrom, type Observable } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  HOTLINE_LIST_CAP,
  isArchiveRefusal,
  isCommandCenterTaken,
  isPermissionDenied,
  PERMISSIONS,
  ROLE_DEFINITIONS,
  type AccessContext,
  type AppAccountId,
  type ArchiveRefusalKind,
  type AuthenticatedUser,
  type HotlineDraft,
  type OfficeDraft,
  type OfficeId,
  type Permission,
  type ServiceDraft,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockAppAccountRepository } from './mock-app-account.repository';
import { MockBalitaRepository } from './mock-balita.repository';
import {
  MockDirectoryOfficeRepository,
  MockHotlineRepository,
  MockTulongServiceRepository,
} from './mock-directory.repositories';
import { MockIssuanceRepository } from './mock-issuance.repository';
import { MockOfficeRepository } from './mock-office.repository';
import { MOCK_APP_ACCOUNTS } from './seed/app-accounts.seed';
import { MOCK_ISSUANCE_TYPES } from './seed/issuance.seed';
import { MOCK_TULONG_SERVICES } from './seed/directory.seed';
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

const SERVICE_DRAFT: ServiceDraft = {
  name: 'Tourism permits',
  slug: 'tourism-permits',
  category: null,
  summary: 'How to apply for a tourism permit.',
  details: 'Apply at the counter.',
  eligibility: null,
  requirements: [],
  contacts: [],
  locations: [],
  officeId: null,
  programId: null,
  acceptsOnlineApplications: false,
  iconKey: null,
  tileColor: null,
  badge: null,
  legalBasis: null,
  claimSteps: [],
  featuredHeadline: null,
  schedule: null,
  hiddenFromList: false,
};

const LINE: HotlineDraft = {
  name: 'Rescue',
  number: '911',
  category: 'Emergency',
  kind: 'emergency',
  sortOrder: 0,
  active: true,
};

/** Seeded offices nothing uses: no staff account, Tulong page or document type names either. */
const PDAO = asId<OfficeId>('office-pdao');
const MCR = asId<OfficeId>('office-mcr');
/** A staff account seeded with no office, so it can be linked to one. */
const UNLINKED_STAFF = asId<AppAccountId>('app-account-0002');

function signedInAs(role: StaffRole, permissions?: readonly Permission[]): void {
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
    permissions: new Set<Permission>(permissions ?? definition.permissions),
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
      MockOfficeRepository,
      MockAppAccountRepository,
      MockIssuanceRepository,
      MockBalitaRepository,
    ],
  });
}

/** Every grant, so a test of the archive's rules across four mocks is not a test of one role. */
const signedInWithEveryGrant = () => signedInAs('system-administrator', PERMISSIONS);

const png = (size = 16) => new Blob([new Uint8Array(size)], { type: 'image/png' });

/** The failure an act ended in, or a test failure if it succeeded. */
async function refusalOf(act: Observable<unknown>): Promise<unknown> {
  return firstValueFrom(act).then(
    () => {
      throw new Error('The act was expected to be refused.');
    },
    (failure: unknown) => failure,
  );
}

async function archiveRefusalOf(act: Observable<unknown>): Promise<ArchiveRefusalKind | null> {
  const failure = await refusalOf(act);
  return isArchiveRefusal(failure) ? failure.kind : null;
}

describe('MockDirectoryOfficeRepository (DL-170, DL-225)', () => {
  it('reads the offices in use whole and by name, for office.manage only, as GET admin/offices does', async () => {
    signedInAs('system-administrator');
    const offices = TestBed.inject(MockDirectoryOfficeRepository);

    const inUse = await firstValueFrom(offices.list(false));
    const names = inUse.map((office) => office.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    expect(inUse.every((office) => office.archived === null)).toBe(true);
    expect(await firstValueFrom(offices.list(true))).toEqual([]);

    signedInAs('intake-officer');
    const refusal = await refusalOf(TestBed.inject(MockDirectoryOfficeRepository).list(false));
    expect(isPermissionDenied(refusal)).toBe(true);
  });

  it('refuses every change to anybody without office.manage', async () => {
    signedInAs('mswdo-head');
    const offices = TestBed.inject(MockDirectoryOfficeRepository);

    expect(isPermissionDenied(await refusalOf(offices.create(DRAFT, null)))).toBe(true);
    expect(isPermissionDenied(await refusalOf(offices.archive(PDAO, 'Merged.')))).toBe(true);
    expect(isPermissionDenied(await refusalOf(offices.restore(PDAO, 'Reopened.')))).toBe(true);
    expect(isPermissionDenied(await refusalOf(offices.history(PDAO)))).toBe(true);
  });

  it('creates an office, refuses a taken address and an image the API would not take', async () => {
    signedInAs('system-administrator');
    const offices = TestBed.inject(MockDirectoryOfficeRepository);

    const created = await firstValueFrom(offices.create(DRAFT, png()));
    expect(created).toMatchObject({ slug: 'tourism', hasBanner: true, archived: null });
    await expect(firstValueFrom(offices.create(DRAFT, null))).rejects.toThrow(
      'slug already exists',
    );
    await expect(
      firstValueFrom(offices.create({ ...DRAFT, slug: 'other' }, png(5 * 1024 * 1024 + 1))),
    ).rejects.toThrow('larger than 5 MB');
  });

  it('archives and restores with a reason, each recorded in its history newest first', async () => {
    signedInAs('system-administrator');
    const offices = TestBed.inject(MockDirectoryOfficeRepository);
    expect(await firstValueFrom(offices.history(PDAO))).toEqual([]);

    const archived = await firstValueFrom(offices.archive(PDAO, '  Merged into the MSWDO.  '));
    expect(archived.archived).toMatchObject({
      byName: 'Test User',
      reason: 'Merged into the MSWDO.',
    });
    expect((await firstValueFrom(offices.list(false))).map((office) => office.id)).not.toContain(
      PDAO,
    );
    expect((await firstValueFrom(offices.list(true))).map((office) => office.id)).toEqual([PDAO]);

    const restored = await firstValueFrom(offices.restore(PDAO, 'The merger was called off.'));
    expect(restored.archived).toBeNull();
    expect((await firstValueFrom(offices.list(false))).map((office) => office.id)).toContain(PDAO);

    const history = await firstValueFrom(offices.history(PDAO));
    expect(history.map((event) => [event.act, event.reason, event.actorName])).toEqual([
      ['restored', 'The merger was called off.', 'Test User'],
      ['archived', 'Merged into the MSWDO.', 'Test User'],
    ]);
  });

  it('refuses an archive somebody already did, a restore of one in use, and a bad reason', async () => {
    signedInAs('system-administrator');
    const offices = TestBed.inject(MockDirectoryOfficeRepository);

    expect(await archiveRefusalOf(offices.restore(PDAO, 'Reopened.'))).toBe('not-archived');
    await firstValueFrom(offices.archive(PDAO, 'Merged.'));
    expect(await archiveRefusalOf(offices.archive(PDAO, 'Merged again.'))).toBe('already-archived');

    await expect(firstValueFrom(offices.archive(MCR, '   '))).rejects.toThrow('reason of 1 to 500');
    await expect(firstValueFrom(offices.archive(MCR, 'x'.repeat(501)))).rejects.toThrow(
      'reason of 1 to 500',
    );
    expect((await firstValueFrom(offices.list(true))).map((office) => office.id)).toEqual([PDAO]);
  });

  it('takes no change to an archived office, and keeps its address reserved', async () => {
    signedInAs('system-administrator');
    const offices = TestBed.inject(MockDirectoryOfficeRepository);
    const archived = await firstValueFrom(offices.archive(PDAO, 'Merged.'));

    expect(await archiveRefusalOf(offices.update(PDAO, { name: 'Renamed' }, null))).toBe(
      'read-only',
    );
    await expect(
      firstValueFrom(offices.create({ ...DRAFT, slug: archived.slug }, null)),
    ).rejects.toThrow('An archived office holds that slug');
  });

  it('refuses to archive an office still used, with the counts, as the server does', async () => {
    signedInAs('system-administrator');
    const refusal = await refusalOf(
      TestBed.inject(MockDirectoryOfficeRepository).archive(MOCK_OFFICE_MSWDO, 'Merged.'),
    );

    expect(isArchiveRefusal(refusal) ? refusal.kind : null).toBe('office-in-use');
    expect(isArchiveRefusal(refusal) ? refusal.inUse : null).toEqual({
      staffAccounts: MOCK_APP_ACCOUNTS.filter((account) => account.officeId === MOCK_OFFICE_MSWDO)
        .length,
      services: MOCK_TULONG_SERVICES.filter(
        (service) => service.officeId === MOCK_OFFICE_MSWDO && service.archived === null,
      ).length,
      issuanceTypes: MOCK_ISSUANCE_TYPES.filter(
        (type) => type.office.id === MOCK_OFFICE_MSWDO && type.active,
      ).length,
    });
  });

  it('counts each use as it comes and goes, and archives once nothing uses the office', async () => {
    signedInWithEveryGrant();
    const offices = TestBed.inject(MockDirectoryOfficeRepository);
    const services = TestBed.inject(MockTulongServiceRepository);
    const accounts = TestBed.inject(MockAppAccountRepository);
    const issuance = TestBed.inject(MockIssuanceRepository);

    await firstValueFrom(accounts.assignOffice(UNLINKED_STAFF, PDAO));
    const page = await firstValueFrom(services.create({ ...SERVICE_DRAFT, officeId: PDAO }));
    const type = await firstValueFrom(
      issuance.createType({
        name: 'Certificate of disability',
        description: null,
        requirements: [],
        fee: null,
        processingDays: null,
        claimInstructions: null,
        officeId: PDAO,
        reason: 'The office now issues this certificate.',
      }),
    );

    const refusal = await refusalOf(offices.archive(PDAO, 'Merged.'));
    expect(isArchiveRefusal(refusal) ? refusal.inUse : null).toEqual({
      staffAccounts: 1,
      services: 1,
      issuanceTypes: 1,
    });

    await firstValueFrom(accounts.assignOffice(UNLINKED_STAFF, null));
    await firstValueFrom(services.archive(page.id, 'Moved to the MSWDO’s page.'));
    await firstValueFrom(issuance.retireType(type.id, 'Issued by the MSWDO from now on.'));

    expect((await firstValueFrom(offices.archive(PDAO, 'Merged.'))).archived).not.toBeNull();
  });

  it('puts nothing new under an archived office, and leaves it out of the public directory', async () => {
    signedInWithEveryGrant();
    const offices = TestBed.inject(MockDirectoryOfficeRepository);
    await firstValueFrom(offices.archive(PDAO, 'Merged.'));

    expect(
      await archiveRefusalOf(
        TestBed.inject(MockTulongServiceRepository).create({ ...SERVICE_DRAFT, officeId: PDAO }),
      ),
    ).toBe('office-archived');
    expect(
      await archiveRefusalOf(
        TestBed.inject(MockAppAccountRepository).assignOffice(UNLINKED_STAFF, PDAO),
      ),
    ).toBe('office-archived');
    expect(
      await archiveRefusalOf(
        TestBed.inject(MockIssuanceRepository).createType({
          name: 'Certificate of disability',
          description: null,
          requirements: [],
          fee: null,
          processingDays: null,
          claimInstructions: null,
          officeId: PDAO,
          reason: 'The office now issues this certificate.',
        }),
      ),
    ).toBe('office-archived');
    expect(
      await archiveRefusalOf(
        TestBed.inject(MockBalitaRepository).create(
          { title: 'Advisory', body: 'Words.', category: null, officeId: PDAO, status: 'draft' },
          null,
        ),
      ),
    ).toBe('office-archived');

    const publicList = TestBed.inject(MockOfficeRepository);
    expect((await firstValueFrom(publicList.list())).map((office) => office.id)).not.toContain(
      PDAO,
    );
    await firstValueFrom(offices.restore(PDAO, 'Reopened.'));
    expect((await firstValueFrom(publicList.list())).map((office) => office.id)).toContain(PDAO);
    expect(
      (
        await firstValueFrom(
          TestBed.inject(MockAppAccountRepository).assignOffice(UNLINKED_STAFF, PDAO),
        )
      ).officeId,
    ).toBe(PDAO);
  });
});

describe('MockTulongServiceRepository (DL-170, DL-225)', () => {
  it('lists every page in use — hidden ones included — and the archived ones apart', async () => {
    signedInAs('system-administrator');
    const services = TestBed.inject(MockTulongServiceRepository);

    const inUse = await firstValueFrom(services.list(false));
    const archived = await firstValueFrom(services.list(true));
    expect(inUse.every((service) => service.archived === null)).toBe(true);
    expect(archived.map((service) => service.slug)).toEqual(['typhoon-relief-2025']);
    expect(archived[0]?.archived?.byName).toBe('Sample administrator');
  });

  it('hides a page, which stays in the administrator’s list', async () => {
    signedInAs('system-administrator');
    const services = TestBed.inject(MockTulongServiceRepository);
    const [first] = await firstValueFrom(services.list(false));
    if (first === undefined) throw new Error('The seed lists no page.');

    await firstValueFrom(services.update(first.id, { hiddenFromList: true }));
    const after = await firstValueFrom(services.list(false));
    expect(after.find((service) => service.id === first.id)?.hiddenFromList).toBe(true);
  });

  it('sets a picture, and refuses changes without service.manage', async () => {
    signedInAs('system-administrator');
    const services = TestBed.inject(MockTulongServiceRepository);
    const page = (await firstValueFrom(services.list(false))).find(
      (service) => service.slug === 'pwd-id',
    );
    if (page === undefined) throw new Error('The seed has no PWD ID page.');

    expect((await firstValueFrom(services.replaceImage(page.id, png()))).hasImage).toBe(true);

    signedInAs('social-worker');
    const refusal = await refusalOf(
      TestBed.inject(MockTulongServiceRepository).archive(page.id, 'Replaced.'),
    );
    expect(isPermissionDenied(refusal)).toBe(true);
  });

  it('archives and restores a page with its history, and takes no change while archived', async () => {
    signedInAs('system-administrator');
    const services = TestBed.inject(MockTulongServiceRepository);
    const [page] = await firstValueFrom(services.list(false));
    if (page === undefined) throw new Error('The seed lists no page.');

    const archived = await firstValueFrom(services.archive(page.id, 'The programme has ended.'));
    expect(archived.archived).toMatchObject({
      byName: 'Test User',
      reason: 'The programme has ended.',
    });
    expect(await archiveRefusalOf(services.archive(page.id, 'Again.'))).toBe('already-archived');
    expect(await archiveRefusalOf(services.update(page.id, { badge: 'New' }))).toBe('read-only');
    expect(await archiveRefusalOf(services.replaceImage(page.id, png()))).toBe('read-only');

    expect((await firstValueFrom(services.restore(page.id, 'It runs again.'))).archived).toBeNull();
    expect(await archiveRefusalOf(services.restore(page.id, 'Again.'))).toBe('not-archived');
    expect((await firstValueFrom(services.history(page.id))).map((event) => event.act)).toEqual([
      'restored',
      'archived',
    ]);
    await expect(firstValueFrom(services.archive(page.id, ''))).rejects.toThrow(
      'reason of 1 to 500',
    );
  });

  it('refuses a restore while the page’s office is archived, until the office is restored', async () => {
    signedInAs('system-administrator');
    const offices = TestBed.inject(MockDirectoryOfficeRepository);
    const services = TestBed.inject(MockTulongServiceRepository);
    const page = await firstValueFrom(services.create({ ...SERVICE_DRAFT, officeId: PDAO }));
    await firstValueFrom(services.archive(page.id, 'Moving it.'));
    await firstValueFrom(offices.archive(PDAO, 'Merged.'));

    expect(await archiveRefusalOf(services.restore(page.id, 'Back.'))).toBe('office-archived');
    await firstValueFrom(offices.restore(PDAO, 'Reopened.'));
    expect((await firstValueFrom(services.restore(page.id, 'Back.'))).archived).toBeNull();
  });
});

describe('MockHotlineRepository (DL-170, DL-225)', () => {
  it('lists every line in use, shown and hidden, by order then name — the archived ones apart', async () => {
    signedInAs('system-administrator');
    const hotlines = TestBed.inject(MockHotlineRepository);

    const lines = await firstValueFrom(hotlines.list(false));
    const orders = lines.map((hotline) => hotline.sortOrder);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(lines.some((hotline) => !hotline.active)).toBe(true);
    expect(lines.every((hotline) => hotline.archived === null)).toBe(true);
    const archived = await firstValueFrom(hotlines.list(true));
    expect(archived.map((hotline) => hotline.name)).toEqual(['Relief hotline, 2025 (sample)']);
  });

  it('refuses the list itself to anybody without hotline.manage, as GET admin/hotlines does', async () => {
    signedInAs('mswdo-head');
    const refusal = await refusalOf(TestBed.inject(MockHotlineRepository).list(false));
    expect(isPermissionDenied(refusal)).toBe(true);
  });

  it('refuses a list past the cap rather than cutting it short, as the API’s 503 does', async () => {
    signedInAs('system-administrator');
    const hotlines = TestBed.inject(MockHotlineRepository);
    const inUse = (await firstValueFrom(hotlines.list(false))).length;
    for (let added = inUse; added < HOTLINE_LIST_CAP; added++) {
      await firstValueFrom(hotlines.create({ ...LINE, kind: 'other', name: `Line ${added}` }));
    }
    expect(await firstValueFrom(hotlines.list(false))).toHaveLength(HOTLINE_LIST_CAP);

    await firstValueFrom(hotlines.create({ ...LINE, kind: 'other', name: 'One too many' }));
    await expect(firstValueFrom(hotlines.list(false))).rejects.toThrow(
      'more hotlines than this read returns whole',
    );
  });

  it('adds, changes, archives and restores a line, and takes no change while it is archived', async () => {
    signedInAs('system-administrator');
    const hotlines = TestBed.inject(MockHotlineRepository);

    const line = await firstValueFrom(hotlines.create(LINE));
    expect((await firstValueFrom(hotlines.update(line.id, { active: false }))).active).toBe(false);
    const archived = await firstValueFrom(hotlines.archive(line.id, 'Replaced by 911.'));
    expect(archived).toMatchObject({ active: false, archived: { reason: 'Replaced by 911.' } });
    expect((await firstValueFrom(hotlines.list(false))).map((h) => h.id)).not.toContain(line.id);
    expect(await archiveRefusalOf(hotlines.update(line.id, { name: 'Renamed' }))).toBe('read-only');
    expect(await archiveRefusalOf(hotlines.archive(line.id, 'Again.'))).toBe('already-archived');

    // Restored as it was: still inactive.
    expect(await firstValueFrom(hotlines.restore(line.id, 'Back in use.'))).toMatchObject({
      active: false,
      archived: null,
    });
    expect(await archiveRefusalOf(hotlines.restore(line.id, 'Again.'))).toBe('not-archived');
    expect((await firstValueFrom(hotlines.history(line.id))).map((e) => e.reason)).toEqual([
      'Back in use.',
      'Replaced by 911.',
    ]);
  });

  it('starts as the API’s backfill leaves it: no command center, until the office marks one (DL-217)', async () => {
    signedInAs('system-administrator');
    const lines = await firstValueFrom(TestBed.inject(MockHotlineRepository).list(false));
    expect(lines.every((line) => line.kind === 'other')).toBe(true);
  });

  it('refuses a second active command center, as the server does, and takes a hand-over (DL-217)', async () => {
    signedInAs('system-administrator');
    const hotlines = TestBed.inject(MockHotlineRepository);
    const [first, second] = await firstValueFrom(hotlines.list(false));
    if (first === undefined || second === undefined) throw new Error('No seeded lines.');

    await firstValueFrom(hotlines.update(first.id, { kind: 'command-center' }));
    expect(
      isCommandCenterTaken(await refusalOf(hotlines.update(second.id, { kind: 'command-center' }))),
    ).toBe(true);
    expect(
      isCommandCenterTaken(
        await refusalOf(hotlines.create({ ...LINE, kind: 'command-center', name: 'Center' })),
      ),
    ).toBe(true);
    // An inactive one is no second, and a hand-over works once the first is changed.
    expect(
      (await firstValueFrom(hotlines.update(second.id, { kind: 'command-center', active: false })))
        .kind,
    ).toBe('command-center');
    await firstValueFrom(hotlines.update(first.id, { kind: 'other' }));
    expect((await firstValueFrom(hotlines.update(second.id, { active: true }))).active).toBe(true);
  });

  it('leaves an archived line out of the one-command-center rule, and refuses a restore that would make two', async () => {
    signedInAs('system-administrator');
    const hotlines = TestBed.inject(MockHotlineRepository);
    const center = await firstValueFrom(
      hotlines.create({ ...LINE, kind: 'command-center', name: 'Old center' }),
    );
    await firstValueFrom(hotlines.archive(center.id, 'The center moved.'));

    // The archived one holds no role, so a new center is no second.
    const next = await firstValueFrom(
      hotlines.create({ ...LINE, kind: 'command-center', name: 'New center' }),
    );
    const refusal = await refusalOf(hotlines.restore(center.id, 'Back.'));
    expect(isCommandCenterTaken(refusal)).toBe(true);
    expect(isArchiveRefusal(refusal)).toBe(false);
    expect((await firstValueFrom(hotlines.list(true))).map((line) => line.id)).toContain(center.id);

    await firstValueFrom(hotlines.update(next.id, { kind: 'other' }));
    expect((await firstValueFrom(hotlines.restore(center.id, 'Back.'))).kind).toBe(
      'command-center',
    );
  });
});
