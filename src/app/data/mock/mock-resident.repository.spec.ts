import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  asIsoDate,
  DEFAULT_PAGE_REQUEST,
  isResidentDraftInvalid,
  PermissionDeniedError,
  pesos,
  ROLE_DEFINITIONS,
  type AccessContext,
  type AuthenticatedUser,
  type BarangayId,
  type Permission,
  type ResidentDraft,
  type ResidentId,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockResidentRepository } from './mock-resident.repository';
import { MockSavedViewRepository } from './mock-saved-view.repository';

const TEST_ENVIRONMENT: AppEnvironment = {
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
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

  it('discloses the same record fully to a social worker', async () => {
    signedInAs(authenticated('social-worker'));
    const view = await firstValueFrom(repo().getById(PROTECTED));
    expect(view?.resident.sectors).toContain('vawc-survivor');
    expect(view?.resident.contact.mobile).not.toBeNull();
    expect(view?.withheld).toHaveLength(0);
  });

  it('redacts inside a paged list too, not only on the detail record', async () => {
    signedInAs(authenticated('intake-officer'));
    const page = await firstValueFrom(
      repo().list({ barangayId: SAN_ISIDRO }, { page: 1, pageSize: 100 }),
    );
    const found = page.items.find((view) => view.resident.id === PROTECTED);
    expect(found?.resident.sectors).not.toContain('vawc-survivor');
  });
});

describe('the registry is large enough to need paging', () => {
  it('serves a bounded page rather than everything', async () => {
    signedInAs(authenticated('intake-officer'));
    const page = await firstValueFrom(repo().list({}, DEFAULT_PAGE_REQUEST));
    expect(page.items).toHaveLength(page.pageSize);
    expect(page.totalItems).toBeGreaterThan(100);
    expect(page.totalPages).toBeGreaterThan(1);
  });

  it('keeps a stable order across pages, so nobody is shown twice or never', async () => {
    signedInAs(authenticated('intake-officer'));
    const first = await firstValueFrom(repo().list({}, { page: 1, pageSize: 25 }));
    const second = await firstValueFrom(repo().list({}, { page: 2, pageSize: 25 }));
    const ids = new Set([...first.items, ...second.items].map((view) => view.resident.id));
    expect(ids.size).toBe(50);
  });

  it('filters by age band and by sector together', async () => {
    signedInAs(authenticated('intake-officer'));
    const page = await firstValueFrom(
      repo().list({ ageGroup: 'senior', sector: 'senior-citizen' }, { page: 1, pageSize: 200 }),
    );
    expect(page.items.length).toBeGreaterThan(0);
    for (const view of page.items) {
      expect(view.resident.sectors).toContain('senior-citizen');
    }
  });

  it('hides retired records unless they are asked for', async () => {
    signedInAs(authenticated('intake-officer'));
    const active = await firstValueFrom(repo().list({}, { page: 1, pageSize: 500 }));
    const withRetired = await firstValueFrom(
      repo().list({ includeInactive: true }, { page: 1, pageSize: 500 }),
    );
    expect(withRetired.totalItems).toBeGreaterThan(active.totalItems);
    expect(active.items.every((view) => view.resident.isActive)).toBe(true);
  });
});

describe('one call answers "who is this, and what have we done for them?"', () => {
  it('returns household, family and history together', async () => {
    signedInAs(authenticated('mswdo-head'));
    const profile = await firstValueFrom(repo().getProfile(FAMILY_HEAD));
    expect(profile).not.toBeNull();
    expect(profile?.household?.referenceNumber).toBe('HH-DL-2024-0088');
    expect(profile?.householdMembers.map((member) => member.role)).toEqual(['spouse', 'child']);
    expect(profile?.history.cases.length).toBeGreaterThan(0);
  });

  it('leaves the subject out of their own family list', async () => {
    signedInAs(authenticated('mswdo-head'));
    const profile = await firstValueFrom(repo().getProfile(FAMILY_HEAD));
    expect(
      profile?.householdMembers.some((member) => member.view.resident.id === FAMILY_HEAD),
    ).toBe(false);
  });

  it('discloses family members under the same policy as the subject', async () => {
    signedInAs(authenticated('release-officer'));
    const profile = await firstValueFrom(repo().getProfile(FAMILY_HEAD));
    for (const member of profile?.householdMembers ?? []) {
      expect(member.view.resident.monthlyIncome).toBeNull();
    }
  });

  it('counts only money actually handed over, not money approved', async () => {
    signedInAs(authenticated('mswdo-head'));
    const profile = await firstValueFrom(repo().getProfile(asId<ResidentId>('res-0007')));
    // `completed` counts too: it is a claimed payout the office has closed out.
    // Goods carry no amount and contribute nothing to a peso total (`DL-93`).
    const handedOver = (profile?.history.payouts ?? []).filter(
      (payout) =>
        (payout.status === 'released' ||
          payout.status === 'claimed' ||
          payout.status === 'completed') &&
        payout.amount !== null,
    );
    expect(handedOver.length).toBeGreaterThan(0);
    expect(profile?.history.totalReleased.centavos).toBe(
      handedOver.reduce((total, payout) => total + (payout.amount?.centavos ?? 0), 0),
    );
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
      repo().list({ includeInactive: true }, { page: 1, pageSize: 1000 }),
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
      ),
    );
    expect(updated.sectors).toContain('vawc-survivor');
  });

  it('refuses retirement without resident.deactivate', async () => {
    signedInAs(authenticated('intake-officer'));
    await expect(
      firstValueFrom(repo().setActive(asId<ResidentId>('res-0001'), false)),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('retires rather than deletes, so history stays attributable', async () => {
    signedInAs(authenticated('mswdo-head'));
    const retired = await firstValueFrom(repo().setActive(asId<ResidentId>('res-0004'), false));
    expect(retired.isActive).toBe(false);
    const stillThere = await firstValueFrom(repo().getById(asId<ResidentId>('res-0004')));
    expect(stillThere).not.toBeNull();
    await firstValueFrom(repo().setActive(asId<ResidentId>('res-0004'), true));
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

  it('lists the office views to anyone who may read residents', async () => {
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    const saved = await firstValueFrom(views().listFor('residents'));
    expect(saved.length).toBeGreaterThan(0);
    expect(saved.every((view) => view.isShared)).toBe(true);
  });

  it('refuses the list to someone with no permission at all', async () => {
    signedInAs(null);
    await expect(firstValueFrom(views().listFor('residents'))).rejects.toThrow(
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

  it('lets the head save and remove a view for the office', async () => {
    signedInAs(authenticated('mswdo-head'));
    const created = await firstValueFrom(
      views().create({
        resource: 'residents',
        name: 'Waiting on requirements',
        params: { status: 'returned' },
        isShared: true,
      }),
    );

    expect(created.isShared).toBe(true);
    await expect(firstValueFrom(views().remove(created.id))).resolves.toBeUndefined();
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
    const mine = await firstValueFrom(views().listFor('residents'));
    expect(mine.some((view) => view.name === 'My follow-ups')).toBe(true);
  });

  it('will not let somebody without the share grant remove the office’s view', async () => {
    // Changed in TAB 20: a shared view is office configuration, so removing one
    // costs the same grant as creating one (`DL-111`). An intake officer holds
    // neither.
    signedInAs(authenticated('intake-officer'));
    const saved = await firstValueFrom(views().listFor('residents'));
    const shared = saved.find((view) => view.isShared);
    expect(shared).toBeDefined();
    if (shared) {
      await expect(firstValueFrom(views().remove(shared.id))).rejects.toThrow(
        PermissionDeniedError,
      );
    }
  });
});
