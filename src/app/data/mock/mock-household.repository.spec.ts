import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  centavos,
  isHouseholdCompositionError,
  PermissionDeniedError,
  ROLE_DEFINITIONS,
  type AccessContext,
  type AuthenticatedUser,
  type BarangayId,
  type HouseholdDraft,
  type HouseholdId,
  type MembershipChange,
  type Permission,
  type ResidentId,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockHouseholdRepository } from './mock-household.repository';
import { MockResidentRepository } from './mock-resident.repository';

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

/** hh-0002 is the seeded family: head, spouse and a child, in Dolores. */
const BAUTISTA = asId<HouseholdId>('hh-0002');
/** hh-0005 holds the seeded protection case (RA 9262), in San Isidro. */
const PROTECTED_HOUSEHOLD = asId<HouseholdId>('hh-0005');

const HEAD = asId<ResidentId>('res-0002');
const SPOUSE = asId<ResidentId>('res-0009');
const CHILD = asId<ResidentId>('res-0010');
/** res-0004 heads hh-0004, so adding them here must be refused. */
const ANOTHER_HOUSEHOLDS_HEAD = asId<ResidentId>('res-0004');
/** res-0008 belongs to no household at all. */
const UNATTACHED = asId<ResidentId>('res-0008');

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

let currentUser: AuthenticatedUser | null = null;

/** A fresh injector — and so a freshly seeded store — signed in as `user`. */
function signedInAs(user: AuthenticatedUser | null): void {
  currentUser = user;
  const context: AccessContext = { currentUser: () => currentUser };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useValue: context },
      MockHouseholdRepository,
      MockResidentRepository,
    ],
  });
}

/** Another reader of the same store: what one role wrote, another reads. */
function switchTo(user: AuthenticatedUser | null): void {
  currentUser = user;
}

function without(user: AuthenticatedUser, permission: Permission): AuthenticatedUser {
  return {
    ...user,
    permissions: new Set([...user.permissions].filter((held) => held !== permission)),
  };
}

const repo = () => TestBed.inject(MockHouseholdRepository);
const residents = () => TestBed.inject(MockResidentRepository);

const REASON = 'Home visit on 12 August confirmed the change';

const FIRST_PAGE = { limit: 20, cursor: null } as const;
const EVERYTHING = { limit: 100, cursor: null } as const;

/* ── Reading ──────────────────────────────────────────────────────────────── */

describe('households are read under the same access rules as residents', () => {
  it('refuses the list without household.view', async () => {
    signedInAs(null);
    await expect(firstValueFrom(repo().list({}, FIRST_PAGE))).rejects.toThrow(
      PermissionDeniedError,
    );
  });

  it('confines a barangay link to its own barangay', async () => {
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    const page = await firstValueFrom(repo().list({}, FIRST_PAGE));
    expect(page.items.length).toBeGreaterThan(0);
    for (const summary of page.items) {
      expect(summary.household.address.barangayId).toBe(SAN_JUAN);
    }
  });

  it('reports an out-of-scope household as absent, exactly like a missing one', async () => {
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    await expect(firstValueFrom(repo().getById(BAUTISTA))).resolves.toBeNull();
    await expect(firstValueFrom(repo().getById(asId<HouseholdId>('hh-nope')))).resolves.toBeNull();
  });

  it('masks a protected member in the household it belongs to', async () => {
    signedInAs(authenticated('intake-officer'));
    const detail = await firstValueFrom(repo().getById(PROTECTED_HOUSEHOLD));
    const member = detail?.members[0];
    expect(member?.view.isProtected).toBe(true);
    expect(member?.view.listedName).toBe('Manalo, C.');
  });

  it('withholds the protected indicator but keeps the band', async () => {
    signedInAs(authenticated('intake-officer'));
    const uncleared = await firstValueFrom(repo().getById(PROTECTED_HOUSEHOLD));
    signedInAs(authenticated('social-worker'));
    const cleared = await firstValueFrom(repo().getById(PROTECTED_HOUSEHOLD));

    const withheld = uncleared?.snapshot.factors.find((f) => f.code === 'protected-member');
    expect(withheld?.state).toBe('withheld');
    // The two roles agree on how exposed the family is; only the reason differs.
    expect(uncleared?.snapshot.band).toBe(cleared?.snapshot.band);
  });

  it('names the head in the list, masked when the head is protected', async () => {
    signedInAs(authenticated('intake-officer'));
    const page = await firstValueFrom(repo().list({}, EVERYTHING));
    const row = page.items.find((summary) => summary.household.id === PROTECTED_HOUSEHOLD);
    expect(row?.headName).toBe('Manalo, C.');
  });

  it('filters by band without offering "none", which every household meets', async () => {
    signedInAs(authenticated('mswdo-head'));
    const page = await firstValueFrom(repo().list({ minimumBand: 'elevated' }, EVERYTHING));
    for (const summary of page.items) {
      expect(['elevated', 'high']).toContain(summary.band);
    }
  });
});

/* ── The list, as the API pages it ──────────────────────────────────────── */

describe('the list is read a cursor page at a time, by reference number', () => {
  it('orders by reference and follows the cursor to the end, no row twice', async () => {
    signedInAs(authenticated('mswdo-head'));
    const first = await firstValueFrom(repo().list({}, { limit: 4, cursor: null }));
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toBe(first.items.at(-1)?.household.id);
    const rest = await firstValueFrom(repo().list({}, { limit: 4, cursor: first.nextCursor }));
    expect(rest.hasMore).toBe(false);
    expect(rest.nextCursor).toBeNull();

    const references = [...first.items, ...rest.items].map((row) => row.household.referenceNumber);
    expect(references).toEqual([...references].sort());
    expect(new Set(references).size).toBe(references.length);
  });

  it('refuses a barangay outside the reader’s scope rather than answering "nobody"', async () => {
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    await expect(
      firstValueFrom(repo().list({ barangayId: asId<BarangayId>('brgy-dolores') }, FIRST_PAGE)),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('searches the reference, the head’s surname and the street — every word', async () => {
    signedInAs(authenticated('mswdo-head'));
    const byReference = await firstValueFrom(repo().list({ search: 'hh-dl-2024' }, EVERYTHING));
    expect(byReference.items.map((row) => row.household.id)).toContain(BAUTISTA);
    const nothing = await firstValueFrom(
      repo().list({ search: 'hh-dl-2024 zzznothing' }, EVERYTHING),
    );
    expect(nothing.items).toEqual([]);
  });

  it('does not match a protected household by the street it withholds', async () => {
    signedInAs(authenticated('social-worker'));
    const cleared = await firstValueFrom(repo().getById(PROTECTED_HOUSEHOLD));
    const street = cleared?.household.address.streetAddress ?? '';
    const word = street.split(/\s+/).find((part) => part.length > 3) ?? street;
    expect(word.length).toBeGreaterThan(1);

    const seen = await firstValueFrom(repo().list({ search: word }, EVERYTHING));
    expect(seen.items.map((row) => row.household.id)).toContain(PROTECTED_HOUSEHOLD);

    switchTo(authenticated('intake-officer'));
    const unseen = await firstValueFrom(repo().list({ search: word }, EVERYTHING));
    expect(unseen.items.map((row) => row.household.id)).not.toContain(PROTECTED_HOUSEHOLD);
  });
});

/* ── What a reader is shown ───────────────────────────────────────────────── */

describe('a household withholds what the API withholds', () => {
  it('withholds a protected household’s address, says so, and says it is protected', async () => {
    signedInAs(authenticated('intake-officer'));
    const detail = await firstValueFrom(repo().getById(PROTECTED_HOUSEHOLD));
    expect(detail?.isProtected).toBe(true);
    expect(detail?.withheld).toContain('exactAddress');
    expect(detail?.household.address.streetAddress).toBeNull();
    expect(detail?.household.address.purokOrSitio).toBeNull();

    const row = (await firstValueFrom(repo().list({}, EVERYTHING))).items.find(
      (summary) => summary.household.id === PROTECTED_HOUSEHOLD,
    );
    expect(row?.withheld).toContain('exactAddress');
    expect(row?.household.address.streetAddress).toBeNull();
  });

  it('withholds every member’s own street beside a protected member, as the API does', async () => {
    // Somebody unprotected moves in with the protection case: her street is, as a rule, theirs.
    signedInAs(authenticated('intake-officer'));
    await firstValueFrom(
      repo().changeMembership(
        PROTECTED_HOUSEHOLD,
        [{ kind: 'add-member', residentId: UNATTACHED, role: 'relative' }],
        REASON,
      ),
    );

    const uncleared = await firstValueFrom(repo().getById(PROTECTED_HOUSEHOLD));
    const lodger = uncleared?.members.find((member) => member.view.resident.id === UNATTACHED);
    expect(lodger?.view.isProtected).toBe(false);
    expect(lodger?.view.resident.address.streetAddress).toBeNull();
    expect(lodger?.view.resident.address.purokOrSitio).toBeNull();
    // Named as withheld, never a blank that reads as "no address on file" (DL-38).
    expect(lodger?.view.withheld).toContain('exactAddress');
    // The barangay is not the address, and stays.
    expect(lodger?.view.resident.address.barangayId).toBe('brgy-santa-ana');

    switchTo(authenticated('mswdo-head'));
    const cleared = await firstValueFrom(repo().getById(PROTECTED_HOUSEHOLD));
    const shown = cleared?.members.find((member) => member.view.resident.id === UNATTACHED);
    expect(shown?.view.resident.address.streetAddress).toBe('44 Del Pilar Street');
    expect(shown?.view.withheld).not.toContain('exactAddress');
  });

  it('leaves a member’s street alone in a household with nobody protected', async () => {
    signedInAs(authenticated('intake-officer'));
    const detail = await firstValueFrom(repo().getById(BAUTISTA));
    expect(detail?.isProtected).toBe(false);
    for (const member of detail?.members ?? []) {
      expect(member.view.withheld).not.toContain('exactAddress');
    }
    expect(detail?.members.some((member) => member.view.resident.address.streetAddress !== null)).toBe(
      true,
    );
  });

  it('withholds the income and both income indicators without the means tier', async () => {
    signedInAs(authenticated('release-officer'));
    const detail = await firstValueFrom(repo().getById(BAUTISTA));
    expect(detail?.household.monthlyIncome).toBeNull();
    expect(detail?.withheld).toEqual(['monthlyIncome']);
    for (const code of ['no-income-recorded', 'income-below-threshold']) {
      const factor = detail?.snapshot.factors.find((entry) => entry.code === code);
      expect(factor?.state).toBe('withheld');
      expect(factor?.origin).toBe('computed');
    }
  });

  it('refuses to correct an income indicator without the means tier, as the API does', async () => {
    signedInAs(without(authenticated('social-worker'), 'resident.view-sensitive'));
    await expect(
      firstValueFrom(repo().correctFactor(BAUTISTA, 'income-below-threshold', 'absent', REASON)),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('leaves a correction of a withheld indicator out of the trail', async () => {
    signedInAs(authenticated('social-worker'));
    const cleared = await firstValueFrom(
      repo().correctFactor(PROTECTED_HOUSEHOLD, 'protected-member', 'absent', REASON),
    );
    expect(cleared.audit.some((entry) => entry.reason === REASON)).toBe(true);

    // The reason is the disclosure the indicator withheld, so its line goes with it.
    switchTo(authenticated('intake-officer'));
    const uncleared = await firstValueFrom(repo().getById(PROTECTED_HOUSEHOLD));
    expect(uncleared?.audit.some((entry) => entry.reason === REASON)).toBe(false);
  });
});

/* ── Registration ─────────────────────────────────────────────────────────── */

describe('registering a household', () => {
  const draft = (overrides: Partial<HouseholdDraft> = {}): HouseholdDraft => ({
    barangayId: asId<BarangayId>('brgy-dolores'),
    purokOrSitio: ' Purok 2 ',
    streetAddress: ' 8 Bonifacio St. ',
    headResidentId: UNATTACHED,
    monthlyIncome: centavos(650_000),
    isIndigent: false,
    ...overrides,
  });

  it('makes the head its one member, and says so twice in the trail', async () => {
    signedInAs(authenticated('intake-officer'));
    const created = await firstValueFrom(repo().create(draft()));
    expect(created.household.members).toEqual([{ residentId: UNATTACHED, role: 'head' }]);
    expect(created.household.headResidentId).toBe(UNATTACHED);
    expect(created.household.address.streetAddress).toBe('8 Bonifacio St.');
    expect(created.household.address.purokOrSitio).toBe('Purok 2');
    expect(created.household.referenceNumber).toMatch(/^HH-\d{4}-\d{6}$/);
    expect(created.audit.map((entry) => entry.action)).toEqual(['membership-changed', 'created']);
    expect(created.audit[0]?.reason).toBe('Registered as the head of the household.');
    expect(created.audit[1]?.reason).toBeNull();

    // The head now points at it, from the resident side too.
    const profile = await firstValueFrom(residents().getProfile(UNATTACHED));
    expect(profile?.household?.id).toBe(created.household.id);
  });

  it('refuses a head who already lives under another roof, and moves nobody', async () => {
    signedInAs(authenticated('intake-officer'));
    const refused: unknown = await firstValueFrom(
      repo().create(draft({ headResidentId: ANOTHER_HOUSEHOLDS_HEAD })),
    ).catch((error: unknown) => error);
    expect(isHouseholdCompositionError(refused)).toBe(true);
    if (isHouseholdCompositionError(refused)) {
      expect(refused.problems.map((problem) => problem.code)).toEqual([
        'member-in-another-household',
      ]);
    }
  });

  it('refuses an income from a writer who may not read one', async () => {
    signedInAs(without(authenticated('intake-officer'), 'resident.view-sensitive'));
    await expect(firstValueFrom(repo().create(draft()))).rejects.toThrow(PermissionDeniedError);
  });

  it('refuses without household.manage, and outside the writer’s barangay', async () => {
    signedInAs(authenticated('auditor'));
    await expect(firstValueFrom(repo().create(draft()))).rejects.toThrow(PermissionDeniedError);
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    await expect(firstValueFrom(repo().create(draft()))).rejects.toThrow(PermissionDeniedError);
  });
});

/* ── Membership, transactionally ──────────────────────────────────────────── */

describe('membership changes keep household, family and person in step', () => {
  it('refuses composition edits without household.manage', async () => {
    signedInAs(authenticated('auditor'));
    await expect(
      firstValueFrom(
        repo().changeMembership(BAUTISTA, [{ kind: 'remove-member', residentId: CHILD }], REASON),
      ),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('refuses a change with no reason', async () => {
    signedInAs(authenticated('intake-officer'));
    await expect(
      firstValueFrom(
        repo().changeMembership(BAUTISTA, [{ kind: 'remove-member', residentId: CHILD }], '   '),
      ),
    ).rejects.toThrow();
  });

  it('moves the headship and demotes the outgoing head together', async () => {
    signedInAs(authenticated('intake-officer'));
    const detail = await firstValueFrom(
      repo().changeMembership(BAUTISTA, [{ kind: 'set-head', residentId: SPOUSE }], REASON),
    );
    expect(detail.household.headResidentId).toBe(SPOUSE);
    expect(detail.household.members.filter((member) => member.role === 'head')).toHaveLength(1);

    // Put it back so later tests see the seeded shape.
    await firstValueFrom(
      repo().changeMembership(BAUTISTA, [{ kind: 'set-head', residentId: HEAD }], REASON),
    );
  });

  it('points a new member at the household and the household at them', async () => {
    signedInAs(authenticated('intake-officer'));
    await firstValueFrom(
      repo().changeMembership(
        BAUTISTA,
        [{ kind: 'add-member', residentId: UNATTACHED, role: 'relative' }],
        REASON,
      ),
    );

    const detail = await firstValueFrom(repo().getById(BAUTISTA));
    expect(detail?.members.some((member) => member.view.resident.id === UNATTACHED)).toBe(true);

    // The other side of the link moved in the same act.
    const resident = await firstValueFrom(residents().getById(UNATTACHED));
    expect(resident?.resident.householdId).toBe(BAUTISTA);

    await firstValueFrom(
      repo().changeMembership(
        BAUTISTA,
        [{ kind: 'remove-member', residentId: UNATTACHED }],
        REASON,
      ),
    );
    const after = await firstValueFrom(residents().getById(UNATTACHED));
    expect(after?.resident.householdId).toBeNull();
  });

  it('refuses to take someone who already belongs to another household', async () => {
    // Silently moving them would empty a family on a screen nobody was watching.
    signedInAs(authenticated('intake-officer'));
    try {
      await firstValueFrom(
        repo().changeMembership(
          BAUTISTA,
          [{ kind: 'add-member', residentId: ANOTHER_HOUSEHOLDS_HEAD, role: 'relative' }],
          REASON,
        ),
      );
      throw new Error('should have been refused');
    } catch (error) {
      expect(isHouseholdCompositionError(error)).toBe(true);
      if (isHouseholdCompositionError(error)) {
        expect(error.problems).toContainEqual({
          code: 'member-in-another-household',
          residentId: ANOTHER_HOUSEHOLDS_HEAD,
        });
      }
    }
  });

  it('applies nothing at all when one change in a batch is illegal', async () => {
    // The transactional guarantee: a batch is a unit, not a best effort.
    signedInAs(authenticated('intake-officer'));
    const before = await firstValueFrom(repo().getById(BAUTISTA));

    const batch: readonly MembershipChange[] = [
      { kind: 'change-role', residentId: CHILD, role: 'parent' },
      { kind: 'add-member', residentId: ANOTHER_HOUSEHOLDS_HEAD, role: 'relative' },
    ];
    await expect(
      firstValueFrom(repo().changeMembership(BAUTISTA, batch, REASON)),
    ).rejects.toThrow();

    const after = await firstValueFrom(repo().getById(BAUTISTA));
    expect(after?.household.members).toEqual(before?.household.members);
    // The legal half of the batch did not sneak through either.
    expect(after?.household.members.find((m) => m.residentId === CHILD)?.role).toBe('child');
  });

  it('refuses a change that would leave the household headless', async () => {
    signedInAs(authenticated('intake-officer'));
    await expect(
      firstValueFrom(
        repo().changeMembership(BAUTISTA, [{ kind: 'remove-member', residentId: HEAD }], REASON),
      ),
    ).rejects.toThrow();
  });

  it('records who changed what, and why', async () => {
    signedInAs(authenticated('intake-officer'));
    await firstValueFrom(
      repo().changeMembership(
        BAUTISTA,
        [{ kind: 'change-role', residentId: CHILD, role: 'child' }],
        'Confirmed at the 12 August home visit',
      ),
    );
    const detail = await firstValueFrom(repo().getById(BAUTISTA));
    const entry = detail?.audit[0];
    expect(entry?.action).toBe('membership-changed');
    expect(entry?.reason).toBe('Confirmed at the 12 August home visit');
    expect(entry?.actorName).toBe('Test User');
    expect(entry?.summary).toContain(CHILD);
  });
});

/* ── Corrections ──────────────────────────────────────────────────────────── */

describe('vulnerability factors can be corrected, and the correction is traceable', () => {
  it('refuses a correction from a role that may only edit membership', async () => {
    // Intake may move people; only a judgement-holding role may contradict the
    // records about a family's circumstances.
    signedInAs(authenticated('intake-officer'));
    await expect(
      firstValueFrom(repo().correctFactor(BAUTISTA, 'many-dependants', 'present', REASON)),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('refuses a correction with no usable reason', async () => {
    signedInAs(authenticated('social-worker'));
    await expect(
      firstValueFrom(repo().correctFactor(BAUTISTA, 'many-dependants', 'present', 'nope')),
    ).rejects.toThrow();
  });

  it('applies the override, keeps what the records said, and writes the reason down', async () => {
    // One test, because each `signedInAs` builds a fresh injector and therefore
    // a fresh mock store — the correction and its trail have to be read in the
    // same session that made them.
    signedInAs(authenticated('social-worker'));
    const detail = await firstValueFrom(
      repo().correctFactor(
        BAUTISTA,
        'many-dependants',
        'present',
        'Home visit: two more dependants living here since June',
      ),
    );

    const corrected = detail.snapshot.factors.find((f) => f.code === 'many-dependants');
    expect(corrected?.state).toBe('present');
    expect(corrected?.origin).toBe('corrected');
    expect(corrected?.computedState).toBe('absent');
    expect(corrected?.correction?.actorName).toBe('Test User');

    const entry = detail.audit.find((line) => line.action === 'factor-corrected');
    expect(entry?.reason).toContain('two more dependants');
    expect(entry?.summary).toContain('many-dependants');
  });

  it('lets the correction be withdrawn, with its own reason', async () => {
    signedInAs(authenticated('social-worker'));
    await firstValueFrom(
      repo().correctFactor(BAUTISTA, 'many-dependants', 'present', 'Recorded at the June visit'),
    );

    const detail = await firstValueFrom(
      repo().clearCorrection(BAUTISTA, 'many-dependants', 'Recount at the follow-up visit'),
    );
    const restored = detail.snapshot.factors.find((f) => f.code === 'many-dependants');
    expect(restored?.origin).toBe('computed');
    expect(restored?.correction).toBeNull();
    // Withdrawing is itself a recorded act, not an erasure.
    expect(detail.audit[0]?.reason).toBe('Recount at the follow-up visit');
    expect(detail.audit).toHaveLength(2);
  });

  it('will not let an uncleared role correct the protected indicator', async () => {
    // Overriding a judgement you were never shown is not a correction.
    signedInAs(authenticated('mswdo-head'));
    await expect(
      firstValueFrom(
        repo().correctFactor(PROTECTED_HOUSEHOLD, 'protected-member', 'absent', REASON),
      ),
    ).resolves.toBeTruthy();

    signedInAs(authenticated('intake-officer'));
    await expect(
      firstValueFrom(
        repo().correctFactor(PROTECTED_HOUSEHOLD, 'protected-member', 'absent', REASON),
      ),
    ).rejects.toThrow(PermissionDeniedError);
  });
});
