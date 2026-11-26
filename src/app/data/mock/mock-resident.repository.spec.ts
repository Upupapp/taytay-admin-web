import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  ASSISTANCE_HISTORY_NOT_YOURS,
  isReleased,
  membersOf,
  type HouseholdComposition,
  type HouseholdMemberView,
  asIsoDate,
  asIsoDateTime,
  isArchiveRefusal,
  isResidentDraftInvalid,
  PermissionDeniedError,
  pesos,
  ROLE_DEFINITIONS,
  SAVED_VIEW_CAP,
  type AccessContext,
  type AuthenticatedUser,
  type BarangayId,
  type Permission,
  type ResidentAssistanceHistory,
  type ResidentDraft,
  type ResidentId,
  type ResidentProfile,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockResidentRepository } from './mock-resident.repository';
import { MockSavedViewRepository } from './mock-saved-view.repository';

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

const SAN_JUAN = asId<BarangayId>('brgy-san-juan');
const DOLORES = asId<BarangayId>('brgy-dolores');
const SAN_ISIDRO = asId<BarangayId>('brgy-san-isidro');

/** res-0005 is the seeded protection case (RA 9262), in San Isidro. */
const PROTECTED = asId<ResidentId>('res-0005');
/** res-0002 heads a household with a spouse and a child, and has a case history. */
const FAMILY_HEAD = asId<ResidentId>('res-0002');

function authenticated(role: StaffRole, barangayId: BarangayId | null = null): AuthenticatedUser {
  const definition = ROLE_DEFINITIONS[role];
  return {
    id: asId<StaffUserId>('staff-x'),
    displayName: 'Test User',
    email: 'test@example.gov.ph',
    role,
    roleLabel: definition.label,
    position: 'Tester',
    barangayId,
    scope: definition.scope,
    permissions: new Set<Permission>(definition.permissions),
  };
}

function signedInAs(user: AuthenticatedUser | null): void {
  const context: AccessContext = { currentUser: () => user };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useValue: context },
      MockResidentRepository,
      MockSavedViewRepository,
    ],
  });
}

const repo = () => TestBed.inject(MockResidentRepository);

function draft(overrides: Partial<ResidentDraft> = {}): ResidentDraft {
  return {
    name: { first: 'Nena', middle: null, last: 'Villanueva', suffix: null },
    sex: 'female',
    birthDate: asIsoDate('1979-04-12'),
    civilStatus: 'married',
    address: { barangayId: SAN_JUAN, purokOrSitio: null, streetAddress: '4 Acacia Street' },
    contact: { mobile: '09175550199', email: null },
    sectors: [],
    philsysLastFour: '3311',
    monthlyIncome: pesos(5000),
    householdId: null,
    ...overrides,
  };
}

/*
 * The registry adapter is where the disclosure policy actually bites. These
 * drive it directly — no component, no template — so a passing test means the
 * redaction survives when the UI is bypassed entirely.
 */

describe('the registry redacts on the way out, not in the template', () => {
  it('hands an intake officer the identity tier they need', () => {
    signedInAs(authenticated('intake-officer'));
    return firstValueFrom(repo().getById(asId<ResidentId>('res-0001'))).then((view) => {
      expect(view?.resident.philsysLastFour).toBe('4471');
      expect(view?.withheld).toHaveLength(0);
    });
  });

  it('withholds the identity tier from a payout role', async () => {
    // A disbursing officer needs to know a person exists and what was paid.
    // They do not need the identity number to hand over an envelope.
    signedInAs(authenticated('release-officer'));
    const view = await firstValueFrom(repo().getById(asId<ResidentId>('res-0001')));
    expect(view?.resident.philsysLastFour).toBeNull();
    expect(view?.withheld).toContain('philsysLastFour');
  });

  it('never lets an uncleared role receive a protected record’s contact details', async () => {
    signedInAs(authenticated('intake-officer'));
    const view = await firstValueFrom(repo().getById(PROTECTED));
    expect(view?.isProtected).toBe(true);
    expect(view?.resident.contact.mobile).toBeNull();
    expect(view?.resident.sectors).not.toContain('vawc-survivor');
    expect(view?.listedName).toBe('Manalo, C.');
  });

  it('discloses the same record fully to the social worker whose client it is', async () => {
    // req-0006, about res-0005, is assigned to sw-1: the person is that worker's client (DL-183).
    signedInAs({ ...authenticated('social-worker'), id: asId<StaffUserId>('staff-sw-1') });
    const view = await firstValueFrom(repo().getById(PROTECTED));
    expect(view?.resident.sectors).toContain('vawc-survivor');
    expect(view?.resident.contact.mobile).not.toBeNull();
    expect(view?.withheld).toHaveLength(0);
  });

  it('redacts inside a paged list too, not only on the detail record', async () => {
    signedInAs(authenticated('intake-officer'));
    const page = await firstValueFrom(
      repo().list({ barangayId: SAN_ISIDRO }, { limit: 100, cursor: null }),
    );
    const found = page.items.find((view) => view.resident.id === PROTECTED);
    expect(found?.resident.sectors).not.toContain('vawc-survivor');
  });
});

describe('a caseload reads its own clients and nobody else (DL-183)', () => {
  const worker = (slug: string): AuthenticatedUser => ({
    ...authenticated('social-worker'),
    id: asId<StaffUserId>(`staff-${slug}`),
  });

  it('reads a client of a request assigned to it, and of a case assigned to it', async () => {
    signedInAs(worker('sw-1'));
    // res-0001: req-0001 is assigned to sw-1; res-0002: a case about them is assigned to sw-1.
    expect(await firstValueFrom(repo().getById(asId<ResidentId>('res-0001')))).not.toBeNull();
    const profile = await firstValueFrom(repo().getProfile(asId<ResidentId>('res-0002')));
    expect(profile?.view.resident.id).toBe('res-0002');
  });

  it('answers anybody else as absent, exactly like a missing record', async () => {
    signedInAs(worker('sw-1'));
    // res-0003's request is sw-2's, and no case about them is sw-1's.
    expect(await firstValueFrom(repo().getById(asId<ResidentId>('res-0003')))).toBeNull();
    expect(await firstValueFrom(repo().getProfile(asId<ResidentId>('res-0003')))).toBeNull();
  });

  it('refuses the registry list to a caseload', async () => {
    signedInAs(worker('sw-1'));
    await expect(firstValueFrom(repo().list({}, { limit: 20, cursor: null }))).rejects.toThrow();
  });
});

describe('the registry is large enough to need paging', () => {
  it('serves a bounded cursor page rather than everything, and says more are available', async () => {
    signedInAs(authenticated('intake-officer'));
    const page = await firstValueFrom(repo().list({}, { limit: 20, cursor: null }));
    expect(page.items).toHaveLength(20);
    expect(page.hasMore).toBe(true);
    expect(page.nextCursor).not.toBeNull();
  });

  it('keeps a stable order across pages, so nobody is shown twice or never', async () => {
    signedInAs(authenticated('intake-officer'));
    const first = await firstValueFrom(repo().list({}, { limit: 25, cursor: null }));
    const second = await firstValueFrom(repo().list({}, { limit: 25, cursor: first.nextCursor }));
    const ids = new Set([...first.items, ...second.items].map((view) => view.resident.id));
    expect(ids.size).toBe(50);
  });

  it('orders the registry as the API does: surname, then given name', async () => {
    signedInAs(authenticated('intake-officer'));
    const page = await firstValueFrom(repo().list({}, { limit: 60, cursor: null }));
    const surnames = page.items.map((view) => view.resident.name.last.toLowerCase());
    expect(surnames).toEqual([...surnames].sort((a, b) => a.localeCompare(b)));
  });

  it('searches names only, never a protected given name it does not show (DL-174)', async () => {
    signedInAs(authenticated('intake-officer'));
    const protectedRecord = await firstValueFrom(
      repo().list({ barangayId: SAN_ISIDRO }, { limit: 200, cursor: null }),
    );
    const masked = protectedRecord.items.find((view) => view.resident.id === PROTECTED);
    expect(masked?.isProtected).toBe(true);

    // The worker whose client res-0005 is (req-0006 is assigned to sw-1, DL-183).
    signedInAs({ ...authenticated('social-worker'), id: asId<StaffUserId>('staff-sw-1') });
    const cleared = await firstValueFrom(repo().getById(PROTECTED));
    const firstName = cleared?.resident.name.first ?? '';
    expect(firstName.length).toBeGreaterThan(1);

    signedInAs(authenticated('intake-officer'));
    const byGiven = await firstValueFrom(
      repo().list({ search: firstName }, { limit: 500, cursor: null }),
    );
    expect(byGiven.items.some((view) => view.resident.id === PROTECTED)).toBe(false);
  });

  it('refuses a protected-sector filter without request.view-sensitive', async () => {
    signedInAs(authenticated('intake-officer'));
    await expect(
      firstValueFrom(repo().list({ sector: 'vawc-survivor' }, { limit: 20, cursor: null })),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('filters by age band and by sector together', async () => {
    signedInAs(authenticated('intake-officer'));
    const page = await firstValueFrom(
      repo().list({ ageGroup: 'senior', sector: 'senior-citizen' }, { limit: 200, cursor: null }),
    );
    expect(page.items.length).toBeGreaterThan(0);
    for (const view of page.items) {
      expect(view.resident.sectors).toContain('senior-citizen');
    }
  });

  it('hides retired records unless they are asked for', async () => {
    signedInAs(authenticated('intake-officer'));
    const active = await firstValueFrom(repo().list({}, { limit: 1000, cursor: null }));
    const withRetired = await firstValueFrom(
      repo().list({ includeInactive: true }, { limit: 1000, cursor: null }),
    );
    expect(withRetired.items.length).toBeGreaterThan(active.items.length);
    expect(active.items.every((view) => view.resident.isActive)).toBe(true);
  });
});

/*
 * A stand-in for a profile that was not returned, so a null profile fails an *assertion* rather
 * than the call. `!` is forbidden here (`CLAUDE.md` §2.2) and `?? []` would not typecheck against
 * a union — this keeps the narrowing honest and the failure legible.
 */
const EMPTY_COMPOSITION: HouseholdComposition = { kind: 'read', members: [] };

/** The mock holds every record, so a `beneficiary.view` reader always reads the history. */
function historyOf(profile: ResidentProfile | null): ResidentAssistanceHistory | null {
  if (profile === null) {
    return null;
  }
  const reading = profile.history;
  return reading.kind === 'read' ? reading.history : null;
}

describe('one call answers "who is this, and what have we done for them?"', () => {
  it('returns household, family and history together', async () => {
    signedInAs(authenticated('mswdo-head'));
    const profile = await firstValueFrom(repo().getProfile(FAMILY_HEAD));
    expect(profile).not.toBeNull();
    expect(profile?.household?.referenceNumber).toBe('HH-DL-2024-0088');
    expect(
      membersOf(profile?.householdMembers ?? EMPTY_COMPOSITION).map(
        (m: HouseholdMemberView) => m.role,
      ),
    ).toEqual(['spouse', 'child']);
    expect(profile?.history.kind).toBe('read');
    expect(historyOf(profile)?.cases.length).toBeGreaterThan(0);
  });

  it('leaves the subject out of their own family list', async () => {
    signedInAs(authenticated('mswdo-head'));
    const profile = await firstValueFrom(repo().getProfile(FAMILY_HEAD));
    expect(
      membersOf(profile?.householdMembers ?? EMPTY_COMPOSITION).some(
        (member: HouseholdMemberView) => member.view.resident.id === FAMILY_HEAD,
      ),
    ).toBe(false);
  });

  it('discloses family members under the same policy as the subject', async () => {
    signedInAs(authenticated('release-officer'));
    const profile = await firstValueFrom(repo().getProfile(FAMILY_HEAD));
    for (const member of membersOf(profile?.householdMembers ?? EMPTY_COMPOSITION)) {
      expect(member.view.resident.monthlyIncome).toBeNull();
    }
  });

  it('counts only money actually handed over, not money approved', async () => {
    signedInAs(authenticated('mswdo-head'));
    const profile = await firstValueFrom(repo().getProfile(asId<ResidentId>('res-0007')));
    // `completed` counts too: it is a claimed payout the office has closed out.
    // Goods carry no amount and contribute nothing to a peso total (`DL-93`).
    const handedOver = (historyOf(profile)?.payouts ?? []).filter(
      (payout) =>
        (payout.status === 'released' ||
          payout.status === 'claimed' ||
          payout.status === 'completed') &&
        payout.amount !== null,
    );
    expect(handedOver.length).toBeGreaterThan(0);
    expect(historyOf(profile)?.totalReleased.centavos).toBe(
      handedOver.reduce((total, payout) => total + (payout.amount?.centavos ?? 0), 0),
    );
    // Goods reached the family too: counted beside the total, never valued into it.
    expect(historyOf(profile)?.goodsReceivedCount).toBe(
      (historyOf(profile)?.payouts ?? []).filter(
        (payout) => isReleased(payout.status) && payout.amount === null,
      ).length,
    );
  });

  it('tells a reader without the registry that the history is not theirs, rather than empty', async () => {
    signedInAs(authenticated('release-officer'));
    const profile = await firstValueFrom(repo().getProfile(FAMILY_HEAD));
    expect(profile?.history).toEqual({
      kind: 'unavailable',
      because: ASSISTANCE_HISTORY_NOT_YOURS,
    });
  });

  it('reports an out-of-scope profile as absent, exactly like a missing one', async () => {
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    await expect(firstValueFrom(repo().getProfile(FAMILY_HEAD))).resolves.toBeNull();
    await expect(
      firstValueFrom(repo().getProfile(asId<ResidentId>('res-nope'))),
    ).resolves.toBeNull();
  });
});

describe('writes are permission- and scope-checked in the adapter', () => {
  it('refuses creation without resident.create', async () => {
    signedInAs(authenticated('auditor'));
    await expect(firstValueFrom(repo().create(draft()))).rejects.toThrow(PermissionDeniedError);
  });

  it('refuses a barangay link creating a record in another barangay', async () => {
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    await expect(
      firstValueFrom(
        repo().create(
          draft({ address: { barangayId: DOLORES, purokOrSitio: null, streetAddress: '1 Road' } }),
        ),
      ),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('accepts a valid record and makes it findable straight away', async () => {
    signedInAs(authenticated('intake-officer'));
    const created = await firstValueFrom(repo().create(draft()));
    const found = await firstValueFrom(repo().getById(created.id));
    expect(found?.resident.name.last).toBe('Villanueva');
    expect(created.isActive).toBe(true);
  });

  it('never issues an id that already belongs to someone', async () => {
    signedInAs(authenticated('intake-officer'));
    const created = await firstValueFrom(repo().create(draft()));
    const page = await firstValueFrom(
      repo().list({ includeInactive: true }, { limit: 1000, cursor: null }),
    );
    const matches = page.items.filter((view) => view.resident.id === created.id);
    expect(matches).toHaveLength(1);
  });

  it('rejects an invalid draft with the failing rules attached', async () => {
    signedInAs(authenticated('intake-officer'));
    try {
      await firstValueFrom(repo().create(draft({ philsysLastFour: '99' })));
      throw new Error('should have been refused');
    } catch (error) {
      expect(isResidentDraftInvalid(error)).toBe(true);
      if (isResidentDraftInvalid(error)) {
        expect(error.problems).toContainEqual({
          field: 'philsysLastFour',
          rule: 'must-be-four-digits',
        });
      }
    }
  });

  it('refuses to let a role edit a record it cannot fully see', async () => {
    // An intake officer may update residents, but not this one: the draft would
    // replace the very contact details that were withheld from them.
    signedInAs(authenticated('intake-officer'));
    await expect(
      firstValueFrom(
        repo().update(
          PROTECTED,
          draft({
            address: {
              barangayId: SAN_ISIDRO,
              purokOrSitio: null,
              streetAddress: '12 Sampaguita Street',
            },
          }),
        ),
      ),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('lets a cleared role edit the same record', async () => {
    signedInAs(authenticated('mswdo-head'));
    const updated = await firstValueFrom(
      repo().update(
        PROTECTED,
        draft({
          name: { first: 'Cristina', middle: 'Yap', last: 'Manalo', suffix: null },
          sectors: ['vawc-survivor', 'solo-parent'],
          address: {
            barangayId: SAN_ISIDRO,
            purokOrSitio: 'Purok 1',
            streetAddress: '12 Sampaguita Street',
          },
        }),
        // A name that differs from the record's moves only with a reason (DL-260).
        { expectedUpdatedAt: null, reason: 'Name as the PSA certificate shows it.', idChecked: true },
      ),
    );
    expect(updated.sectors).toContain('vawc-survivor');
  });

  it('refuses retirement without resident.deactivate', async () => {
    signedInAs(authenticated('intake-officer'));
    await expect(
      firstValueFrom(repo().setActive(asId<ResidentId>('res-0001'), false, 'Moved away.')),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('refuses to retire or restore without a reason', async () => {
    signedInAs(authenticated('mswdo-head'));
    await expect(
      firstValueFrom(repo().setActive(asId<ResidentId>('res-0004'), false, '   ')),
    ).rejects.toThrow(/reason/);
  });

  it('retires rather than deletes, so history stays attributable', async () => {
    signedInAs(authenticated('mswdo-head'));
    const retired = await firstValueFrom(
      repo().setActive(asId<ResidentId>('res-0004'), false, 'Moved to Antipolo.'),
    );
    expect(retired.isActive).toBe(false);
    const stillThere = await firstValueFrom(repo().getById(asId<ResidentId>('res-0004')));
    expect(stillThere).not.toBeNull();
    await firstValueFrom(repo().setActive(asId<ResidentId>('res-0004'), true, 'Returned.'));
  });

  it('refuses every write when anonymous', async () => {
    signedInAs(null);
    await expect(firstValueFrom(repo().create(draft()))).rejects.toThrow(PermissionDeniedError);
    await expect(
      firstValueFrom(repo().update(asId<ResidentId>('res-0001'), draft())),
    ).rejects.toThrow(PermissionDeniedError);
  });
});

describe('saved views cost the same permission as the list they describe', () => {
  const views = () => TestBed.inject(MockSavedViewRepository);
  const ids = (list: readonly { readonly id: string }[]) => list.map((view) => view.id);

  it('lists the office views to anyone who may read residents', async () => {
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    const saved = await firstValueFrom(views().listFor('residents', false));
    expect(saved.length).toBeGreaterThan(0);
    expect(saved.every((view) => view.isShared && view.archived === null)).toBe(true);
  });

  it('refuses the list to someone with no permission at all', async () => {
    signedInAs(null);
    await expect(firstValueFrom(views().listFor('residents', false))).rejects.toThrow(
      PermissionDeniedError,
    );
  });

  it('refuses to save a view for the whole office without the share grant', async () => {
    signedInAs(authenticated('intake-officer'));

    // A personal view is a preference; an office-wide one appears for every
    // colleague and outlives whoever wrote it (`DL-111`).
    await expect(
      firstValueFrom(
        views().create({
          resource: 'residents',
          name: 'Everyone should see this',
          params: {},
          isShared: true,
        }),
      ),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('lets the head save, archive and restore a view for the office (DL-225)', async () => {
    signedInAs(authenticated('mswdo-head'));
    const created = await firstValueFrom(
      views().create({
        resource: 'residents',
        name: 'Waiting on requirements',
        params: { status: 'returned' },
        isShared: true,
      }),
    );
    expect(created).toMatchObject({ isShared: true, archived: null });

    const archived = await firstValueFrom(views().archive(created.id));
    // A view's archive names nobody and keeps no reason: it is a filter, not a public record.
    expect(archived.archived).toMatchObject({ byName: null, reason: null });
    expect(ids(await firstValueFrom(views().listFor('residents', false)))).not.toContain(
      created.id,
    );
    expect(ids(await firstValueFrom(views().listFor('residents', true)))).toContain(created.id);

    expect((await firstValueFrom(views().restore(created.id))).archived).toBeNull();
    expect(ids(await firstValueFrom(views().listFor('residents', false)))).toContain(created.id);
  });

  it('keeps a personal view out of everyone else’s list', async () => {
    signedInAs(authenticated('intake-officer'));
    await firstValueFrom(
      views().create({
        resource: 'residents',
        name: 'My follow-ups',
        params: { sector: 'pwd' },
        isShared: false,
      }),
    );
    const mine = await firstValueFrom(views().listFor('residents', false));
    expect(mine.some((view) => view.name === 'My follow-ups')).toBe(true);
  });

  it('will not let somebody without the share grant archive the office’s view', async () => {
    // Changed in TAB 20: a shared view is office configuration, so putting one
    // away costs the same grant as creating one (`DL-111`). An intake officer
    // holds neither.
    signedInAs(authenticated('intake-officer'));
    const saved = await firstValueFrom(views().listFor('residents', false));
    const shared = saved.find((view) => view.isShared);
    expect(shared).toBeDefined();
    if (shared) {
      await expect(firstValueFrom(views().archive(shared.id))).rejects.toThrow(
        PermissionDeniedError,
      );
    }
  });

  it('lets anybody put their own view away, and lists only the archived views they could restore (DL-225)', async () => {
    // Two people at one office, one after the other, so the head's archive is there for the next.
    let current = authenticated('mswdo-head');
    const context: AccessContext = { currentUser: () => current };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
        { provide: ACCESS_CONTEXT, useValue: context },
        MockSavedViewRepository,
      ],
    });
    const office = (await firstValueFrom(views().listFor('residents', false))).find(
      (view) => view.isShared,
    );
    if (office === undefined) throw new Error('The seed has no shared residents view.');
    await firstValueFrom(views().archive(office.id));

    current = authenticated('intake-officer');
    const own = await firstValueFrom(
      views().create({ resource: 'residents', name: 'Mine', params: {}, isShared: false }),
    );
    await firstValueFrom(views().archive(own.id));

    // The office's archived view is one the intake officer could not restore, so it is not offered.
    expect(ids(await firstValueFrom(views().listFor('residents', true)))).toEqual([own.id]);
    expect(await firstValueFrom(views().restore(own.id))).toMatchObject({ archived: null });
  });

  it('refuses what somebody already did, in the domain’s words', async () => {
    signedInAs(authenticated('intake-officer'));
    const own = await firstValueFrom(
      views().create({ resource: 'residents', name: 'Mine', params: {}, isShared: false }),
    );

    const notArchived: unknown = await firstValueFrom(views().restore(own.id)).catch(
      (failure: unknown) => failure,
    );
    expect(isArchiveRefusal(notArchived) ? notArchived.kind : null).toBe('not-archived');
    await firstValueFrom(views().archive(own.id));
    const already: unknown = await firstValueFrom(views().archive(own.id)).catch(
      (failure: unknown) => failure,
    );
    expect(isArchiveRefusal(already) ? already.kind : null).toBe('already-archived');
  });

  it('refuses a restore past the list’s cap, and says to archive one first (DL-225)', async () => {
    signedInAs(authenticated('intake-officer'));
    const kept = await firstValueFrom(
      views().create({ resource: 'residents', name: 'Kept aside', params: {}, isShared: false }),
    );
    await firstValueFrom(views().archive(kept.id));
    for (let index = 0; index < SAVED_VIEW_CAP; index++) {
      await firstValueFrom(
        views().create({
          resource: 'residents',
          name: `View ${index}`,
          params: {},
          isShared: false,
        }),
      );
    }

    await expect(firstValueFrom(views().restore(kept.id))).rejects.toThrow(
      `You already keep ${SAVED_VIEW_CAP} views of this list. Archive one first.`,
    );
    await expect(
      firstValueFrom(
        views().create({ resource: 'residents', name: 'One more', params: {}, isShared: false }),
      ),
    ).rejects.toThrow('Archive one first.');
  });
});

describe('the Citizens overview shows every count of people as it is (DL-213, DL-252)', () => {
  it('withholds no count for being small, and totals what it counts', async () => {
    signedInAs(authenticated('intake-officer'));
    const summary = await firstValueFrom(repo().summary({}));
    const rows = [...summary.byBarangay.rows, ...summary.bySector.rows, ...summary.byAgeSex.rows];

    // Only a protected sector is withheld for this reader, and that is a permission (DL-38).
    for (const row of rows.filter((entry) => entry.isWithheld === true)) {
      expect(['vawc-survivor', 'cicl']).toContain(row.key);
    }
    expect(summary.disclosure.threshold).toBe(0);
    expect(summary.byBarangay.total).toBe(summary.residents.current);
  });

  it('does not count a protected sector for a reader without request.view-sensitive', async () => {
    signedInAs(authenticated('intake-officer'));
    const summary = await firstValueFrom(repo().summary({}));
    const vawc = summary.bySector.rows.find((row) => row.key === 'vawc-survivor');

    expect(vawc?.isWithheld).toBe(true);
  });

  it('refuses a caseload, as the API does', async () => {
    signedInAs(authenticated('social-worker'));
    await expect(firstValueFrom(repo().summary({}))).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe('an edit names the version it was made on, and why an identity field moved (DL-260)', () => {
  it('refuses a stale edit and a name change with no reason, and answers a repeat as done', async () => {
    signedInAs(authenticated('system-administrator'));
    const created = await firstValueFrom(repo().create(draft()));
    const read = created.audit.updatedAt;

    const moved = draft({ address: { ...draft().address, streetAddress: '6 Acacia Street' } });
    const first = await firstValueFrom(
      repo().update(created.id, moved, { expectedUpdatedAt: read, reason: null, idChecked: false }),
    );
    expect(first.address.streetAddress).toBe('6 Acacia Street');

    // The same save again is not a conflict.
    await firstValueFrom(
      repo().update(created.id, moved, { expectedUpdatedAt: read, reason: null, idChecked: false }),
    );
    // A second clerk who opened the record before the first saved is refused, and nothing changes.
    const stale = await firstValueFrom(
      repo().update(
        created.id,
        draft({ address: { ...draft().address, streetAddress: '9 Other St' } }),
        {
          expectedUpdatedAt: asIsoDateTime('2000-01-01T00:00:00.000Z'),
          reason: null,
          idChecked: false,
        },
      ),
    ).catch((error: unknown) => error);
    expect(String(stale)).toMatch(/changed this record after you opened it/);

    const renamed = draft({ ...moved, name: { ...draft().name, last: 'Villanueva-Cruz' } });
    const unexplained = await firstValueFrom(
      repo().update(created.id, renamed, {
        expectedUpdatedAt: null,
        reason: null,
        idChecked: false,
      }),
    ).catch((error: unknown) => error);
    expect(String(unexplained)).toMatch(/needs a reason/);
    const explained = await firstValueFrom(
      repo().update(created.id, renamed, {
        expectedUpdatedAt: null,
        reason: 'Marriage certificate seen.',
        idChecked: true,
      }),
    );
    expect(explained.name.last).toBe('Villanueva-Cruz');
  });
});

describe('a record keeps its identity history, and its values behind a grant (DL-264)', () => {
  it('lists each change without a value, and opens the values to the auditor alone', async () => {
    // One registry, three readers in turn: the context answers whoever is signed in now.
    let current: AuthenticatedUser = authenticated('system-administrator');
    signedInAs(current);
    TestBed.overrideProvider(ACCESS_CONTEXT, { useValue: { currentUser: () => current } });
    const created = await firstValueFrom(repo().create(draft()));
    const renamed = draft({ name: { ...draft().name, last: 'Villanueva-Cruz' } });
    await firstValueFrom(
      repo().update(created.id, renamed, {
        expectedUpdatedAt: null,
        reason: 'Marriage certificate seen.',
        idChecked: true,
      }),
    );

    current = authenticated('intake-officer');
    const listed = await firstValueFrom(repo().identityHistory(created.id));
    expect(listed.map((change) => [change.field, change.reason, change.idChecked])).toEqual([
      ['lastName', 'Marriage certificate seen.', true],
    ]);
    expect(listed[0]?.valuesReadable).toBe(false);
    expect(listed[0]).not.toHaveProperty('previous');
    const refused = await firstValueFrom(
      repo().identityChangeValues(created.id, listed[0]?.id ?? ''),
    ).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(PermissionDeniedError);

    current = authenticated('auditor');
    const audited = await firstValueFrom(repo().identityHistory(created.id));
    expect(audited[0]?.valuesReadable).toBe(true);
    const values = await firstValueFrom(
      repo().identityChangeValues(created.id, audited[0]?.id ?? ''),
    );
    expect(values.previous).toBe(draft().name.last);
    expect(values.next).toBe('Villanueva-Cruz');
  });
});
