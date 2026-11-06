import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  isFamilyDraftInvalid,
  isRelationshipInvalid,
  isTransferRefused,
  PermissionDeniedError,
  ROLE_DEFINITIONS,
  type AccessContext,
  type AuthenticatedUser,
  type BarangayId,
  type CursorPage,
  type FamilyDraft,
  type FamilyId,
  type FamilySummary,
  type HouseholdId,
  type Permission,
  type RelationshipId,
  type ResidentId,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockFamilyRepository } from './mock-family.repository';
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

/** Two families at one address — hh-0001 holds both of these. */
const MERCADO = asId<FamilyId>('fam-0001');
const JOSELITO = asId<FamilyId>('fam-0002');
/** A family with three members, in Dolores. */
const BAUTISTA = asId<FamilyId>('fam-0003');
/** A family with no household at all. */
const UNHOUSED = asId<FamilyId>('fam-0004');
/** Dissolved, retained. */
const DISSOLVED = asId<FamilyId>('fam-0005');

const AURORA = asId<ResidentId>('res-0001');
const REYNALDO = asId<ResidentId>('res-0002');
const MARILOU = asId<ResidentId>('res-0009');
const ALDRIN = asId<ResidentId>('res-0010');
const JOSELITO_RES = asId<ResidentId>('res-0006');

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
      MockFamilyRepository,
      MockResidentRepository,
    ],
  });
}

/** Another reader of the same store: what one role recorded, another reads. */
function switchTo(user: AuthenticatedUser | null): void {
  currentUser = user;
}

const repo = () => TestBed.inject(MockFamilyRepository);
const residents = () => TestBed.inject(MockResidentRepository);

const REASON = 'Home visit on 12 August confirmed the arrangement';

const FIRST_PAGE = { limit: 20, cursor: null } as const;
const EVERYTHING = { limit: 50, cursor: null } as const;

/** res-0005 is the seeded protection case (RA 9262); res-0008 is unprotected, at 44 Del Pilar Street. */
const PROTECTED = asId<ResidentId>('res-0005');
const UNPROTECTED = asId<ResidentId>('res-0008');

/* ── Household is not family ──────────────────────────────────────────────── */

describe('a household is not a family', () => {
  it('lists two separate families at one address', async () => {
    signedInAs(authenticated('intake-officer'));
    const page = await firstValueFrom(repo().list({}, EVERYTHING));
    const atHh0001 = page.items.filter((summary) => summary.family.householdId === 'hh-0001');
    expect(atHh0001).toHaveLength(2);
    expect(atHh0001.map((summary) => summary.family.id).sort()).toEqual([MERCADO, JOSELITO]);
  });

  it('shows each of them the other, as a separate unit', async () => {
    signedInAs(authenticated('intake-officer'));
    const detail = await firstValueFrom(repo().getById(MERCADO));
    expect(detail?.othersInHousehold.map((other) => other.family.id)).toEqual([JOSELITO]);
  });

  it('records a family with no household without treating it as broken', async () => {
    signedInAs(authenticated('mswdo-head'));
    const detail = await firstValueFrom(repo().getById(UNHOUSED));
    expect(detail).not.toBeNull();
    expect(detail?.family.householdId).toBeNull();
    expect(detail?.othersInHousehold).toHaveLength(0);
  });

  it('finds unhoused families by filter, because they are a real category', async () => {
    signedInAs(authenticated('mswdo-head'));
    const page = await firstValueFrom(repo().list({ unhousedOnly: true }, FIRST_PAGE));
    expect(page.items.length).toBeGreaterThan(0);
    for (const summary of page.items) {
      expect(summary.family.householdId).toBeNull();
    }
  });

  it('lets one person belong to a family whose household they do not head', async () => {
    signedInAs(authenticated('intake-officer'));
    const families = await firstValueFrom(repo().familiesOf(JOSELITO_RES));
    expect(families.map((summary) => summary.family.id)).toEqual([JOSELITO]);
  });

  it('hides a dissolved family by default and finds it when asked', async () => {
    signedInAs(authenticated('mswdo-head'));
    const byDefault = await firstValueFrom(repo().list({}, EVERYTHING));
    expect(byDefault.items.some((summary) => summary.family.id === DISSOLVED)).toBe(false);

    const including = await firstValueFrom(
      repo().list({ includeDissolved: true }, EVERYTHING),
    );
    expect(including.items.some((summary) => summary.family.id === DISSOLVED)).toBe(true);
  });
});

/* ── The list, as the API pages it ────────────────────────────────────────── */

describe('the list is read a cursor page at a time, by reference number', () => {
  it('orders by reference and follows the cursor to the end, no row twice', async () => {
    signedInAs(authenticated('mswdo-head'));
    const everything = await firstValueFrom(repo().list({ includeDissolved: true }, EVERYTHING));
    const references = everything.items.map((summary) => summary.family.referenceNumber);
    expect(references).toEqual([...references].sort());
    expect(everything.hasMore).toBe(false);
    expect(everything.nextCursor).toBeNull();

    const read: string[] = [];
    let cursor: string | null = null;
    do {
      const page: CursorPage<FamilySummary> = await firstValueFrom(
        repo().list({ includeDissolved: true }, { limit: 2, cursor }),
      );
      read.push(...page.items.map((summary) => summary.family.id));
      cursor = page.nextCursor;
      expect(page.hasMore).toBe(cursor !== null);
    } while (cursor !== null);
    expect(read).toEqual(everything.items.map((summary) => summary.family.id));
  });

  it('searches the reference, the name and the head’s surname — every word', async () => {
    signedInAs(authenticated('mswdo-head'));
    const ids = async (search: string) =>
      (await firstValueFrom(repo().list({ search }, EVERYTHING))).items.map(
        (summary) => summary.family.id,
      );
    expect(await ids('bautista')).toEqual([BAUTISTA]);
    expect(await ids('FAM-DL-2024')).toEqual([BAUTISTA]);
    expect(await ids('bautista dl')).toEqual([BAUTISTA]);
    // Every word must match: one that matches nothing empties the list.
    expect(await ids('bautista zzz')).toEqual([]);
  });

  it('refuses a barangay outside the reader’s scope rather than answering "none"', async () => {
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    await expect(
      firstValueFrom(
        repo().list({ barangayId: asId<BarangayId>('brgy-dolores') }, FIRST_PAGE),
      ),
    ).rejects.toThrow(PermissionDeniedError);
  });
});

/* ── Recording a family ───────────────────────────────────────────────────── */

describe('recording a family', () => {
  const draft = (overrides: Partial<FamilyDraft> = {}): FamilyDraft => ({
    name: '  Gonzales–Manalo family ',
    householdId: null,
    formedOn: null,
    members: [
      { residentId: PROTECTED, role: 'head' },
      { residentId: UNPROTECTED, role: 'other-member' },
    ],
    ...overrides,
  });

  it('records the family with its founding members, and the reason with each', async () => {
    signedInAs(authenticated('intake-officer'));
    const created = await firstValueFrom(repo().create(draft(), REASON));
    expect(created.family.name).toBe('Gonzales–Manalo family');
    expect(created.family.referenceNumber).toMatch(/^FAM-\d{4}-\d{6}$/);
    // Between addresses is a recordable state, not a missing value (DL-47).
    expect(created.family.householdId).toBeNull();
    expect(created.family.members.map((member) => [member.residentId, member.role])).toEqual([
      [PROTECTED, 'head'],
      [UNPROTECTED, 'other-member'],
    ]);
    expect(created.history.map((event) => event.kind).sort()).toEqual([
      'family-formed',
      'member-joined',
      'member-joined',
    ]);
    expect(created.history.every((event) => event.reason === REASON)).toBe(true);

    const listed = await firstValueFrom(repo().list({ unhousedOnly: true }, EVERYTHING));
    expect(listed.items.some((summary) => summary.family.id === created.family.id)).toBe(true);
  });

  it('places the family in a household when one is named', async () => {
    signedInAs(authenticated('intake-officer'));
    const created = await firstValueFrom(
      repo().create(draft({ householdId: asId<HouseholdId>('hh-0005') }), REASON),
    );
    expect(created.family.householdId).toBe('hh-0005');
  });

  it('refuses a draft the registry cannot hold, naming every problem, and records nothing', async () => {
    signedInAs(authenticated('intake-officer'));
    const before = (await firstValueFrom(repo().list({}, EVERYTHING))).items.length;
    const refused: unknown = await firstValueFrom(
      repo().create(
        draft({
          name: '  ',
          householdId: asId<HouseholdId>('hh-nowhere'),
          members: [
            { residentId: UNPROTECTED, role: 'head' },
            { residentId: UNPROTECTED, role: 'child' },
            { residentId: asId<ResidentId>('res-nobody'), role: 'child' },
          ],
        }),
        '   ',
      ),
    ).catch((error: unknown) => error);

    expect(isFamilyDraftInvalid(refused)).toBe(true);
    if (isFamilyDraftInvalid(refused)) {
      expect(refused.problems.map((problem) => problem.code).sort()).toEqual([
        'duplicate-member',
        'household-not-found',
        'no-name',
        'no-reason',
        'resident-not-found',
      ]);
    }
    expect((await firstValueFrom(repo().list({}, EVERYTHING))).items).toHaveLength(before);
  });

  it('refuses without family.manage', async () => {
    signedInAs(authenticated('auditor'));
    await expect(firstValueFrom(repo().create(draft(), REASON))).rejects.toThrow(
      PermissionDeniedError,
    );
  });
});

/* ── What a reader is shown ───────────────────────────────────────────────── */

describe('a family withholds what the API withholds', () => {
  it('withholds every member’s own street beside a protected member', async () => {
    signedInAs(authenticated('intake-officer'));
    const created = await firstValueFrom(repo().create({
      name: 'Shared roof family',
      householdId: null,
      formedOn: null,
      members: [
        { residentId: PROTECTED, role: 'head' },
        { residentId: UNPROTECTED, role: 'other-member' },
      ],
    }, REASON));

    const unprotected = created.graph.nodes.find((node) => node.view.resident.id === UNPROTECTED);
    expect(unprotected?.view.isProtected).toBe(false);
    expect(unprotected?.view.resident.address.streetAddress).toBeNull();
    // Named as withheld, never a blank that reads as "no address on file" (DL-38).
    expect(unprotected?.view.withheld).toContain('exactAddress');

    const summary = (await firstValueFrom(repo().familiesOf(UNPROTECTED))).find(
      (candidate) => candidate.family.id === created.family.id,
    );
    expect(summary?.headName).toBe('Manalo, C.');

    // The same record, read by somebody cleared for the protected tier.
    switchTo(authenticated('mswdo-head'));
    const cleared = await firstValueFrom(repo().getById(created.family.id));
    const shown = cleared?.graph.nodes.find((node) => node.view.resident.id === UNPROTECTED);
    expect(shown?.view.resident.address.streetAddress).toBe('44 Del Pilar Street');
    expect(shown?.view.withheld).not.toContain('exactAddress');
  });

  it('withholds the streets of a second family living at a protected person’s address', async () => {
    signedInAs(authenticated('intake-officer'));
    // hh-0005 is headed by a protected resident; nobody in this new family is protected.
    const created = await firstValueFrom(repo().create({
      name: 'Lodger family',
      householdId: asId<HouseholdId>('hh-0005'),
      formedOn: null,
      members: [{ residentId: UNPROTECTED, role: 'head' }],
    }, REASON));

    const lodger = created.graph.nodes.find((node) => node.view.resident.id === UNPROTECTED);
    expect(lodger?.view.isProtected).toBe(false);
    expect(lodger?.view.resident.address.streetAddress).toBeNull();
    expect(lodger?.view.withheld).toContain('exactAddress');
  });

  it('leaves members’ streets alone in a family with nobody protected', async () => {
    signedInAs(authenticated('intake-officer'));
    const detail = await firstValueFrom(repo().getById(BAUTISTA));
    for (const node of detail?.graph.nodes ?? []) {
      expect(node.view.withheld).not.toContain('exactAddress');
    }
  });
});

/* ── Access ───────────────────────────────────────────────────────────────── */

describe('families are read under the same access rules as everything else', () => {
  it('refuses the list without family.view', async () => {
    signedInAs(null);
    await expect(firstValueFrom(repo().list({}, FIRST_PAGE))).rejects.toThrow(
      PermissionDeniedError,
    );
  });

  it('confines a barangay link to families at addresses in its barangay', async () => {
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    const page = await firstValueFrom(repo().list({}, EVERYTHING));
    const housed = page.items.filter((summary) => summary.family.householdId !== null);
    expect(housed.length).toBeGreaterThan(0);
    for (const summary of housed) {
      expect(summary.barangayId).toBe(SAN_JUAN);
    }
  });

  it('still shows a family with no address to a scoped account', async () => {
    // A family between addresses belongs to no barangay yet. Hiding it from
    // everyone is how a family in transit stops being followed up.
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    const detail = await firstValueFrom(repo().getById(UNHOUSED));
    expect(detail).not.toBeNull();
  });

  it('reports an out-of-scope family as absent, exactly like a missing one', async () => {
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    await expect(firstValueFrom(repo().getById(BAUTISTA))).resolves.toBeNull();
    await expect(firstValueFrom(repo().getById(asId<FamilyId>('fam-nope')))).resolves.toBeNull();
  });

  it('masks a protected member in the graph, as everywhere else', async () => {
    signedInAs(authenticated('intake-officer'));
    const detail = await firstValueFrom(repo().getById(DISSOLVED));
    const node = detail?.graph.nodes[0];
    expect(node?.view.isProtected).toBe(true);
    expect(node?.view.listedName).toBe('Manalo, C.');
  });
});

/* ── The graph ────────────────────────────────────────────────────────────── */

describe('the graph states relationships from each person’s own side', () => {
  it('gives each member their edges in words', async () => {
    signedInAs(authenticated('mswdo-head'));
    const detail = await firstValueFrom(repo().getById(BAUTISTA));
    const child = detail?.graph.nodes.find((node) => node.view.resident.id === ALDRIN);
    expect(child?.edges.map((edge) => edge.kind).sort()).toEqual(['child-of', 'child-of']);
    expect(child?.edges.every((edge) => edge.otherName.length > 0)).toBe(true);
  });

  it('reads the same relationship as parent from the other side', async () => {
    signedInAs(authenticated('mswdo-head'));
    const detail = await firstValueFrom(repo().getById(BAUTISTA));
    const parent = detail?.graph.nodes.find((node) => node.view.resident.id === REYNALDO);
    expect(parent?.edges.some((edge) => edge.kind === 'parent-of')).toBe(true);
    expect(parent?.edges.some((edge) => edge.kind === 'spouse-of')).toBe(true);
  });

  it('places the child a generation below the parents', async () => {
    signedInAs(authenticated('mswdo-head'));
    const detail = await firstValueFrom(repo().getById(BAUTISTA));
    const head = detail?.graph.nodes.find((node) => node.view.resident.id === REYNALDO);
    const child = detail?.graph.nodes.find((node) => node.view.resident.id === ALDRIN);
    expect((child?.generation ?? 0) - (head?.generation ?? 0)).toBe(1);
  });

  it('carries a relationship that crosses two families', async () => {
    // Aurora is in fam-0001 and Joselito in fam-0002. A graph confined to one
    // family could not record that they are grandmother and grandson.
    signedInAs(authenticated('mswdo-head'));
    const detail = await firstValueFrom(repo().getById(MERCADO));
    const aurora = detail?.graph.nodes.find((node) => node.view.resident.id === AURORA);
    expect(aurora?.edges.some((edge) => edge.otherResidentId === JOSELITO_RES)).toBe(true);
  });

  it('keeps an ended relationship, marked as ended', async () => {
    signedInAs(authenticated('mswdo-head'));
    const detail = await firstValueFrom(repo().getById(MERCADO));
    const ended = detail?.graph.edges.find((edge) => edge.kind === 'guardian-of');
    expect(ended?.until).not.toBeNull();
  });
});

/* ── Recording and ending ─────────────────────────────────────────────────── */

describe('recording a relationship', () => {
  it('refuses without family.manage', async () => {
    signedInAs(authenticated('auditor'));
    await expect(
      firstValueFrom(repo().recordRelationship(REYNALDO, MARILOU, 'sibling-of', REASON)),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('refuses without a reason', async () => {
    signedInAs(authenticated('intake-officer'));
    await expect(
      firstValueFrom(repo().recordRelationship(REYNALDO, ALDRIN, 'sibling-of', '  ')),
    ).rejects.toThrow();
  });

  it('records a new relationship and shows it from both sides', async () => {
    signedInAs(authenticated('intake-officer'));
    const created = await firstValueFrom(
      repo().recordRelationship(AURORA, REYNALDO, 'other-relative-of', REASON),
    );
    expect(created.until).toBeNull();

    const detail = await firstValueFrom(repo().getById(MERCADO));
    const aurora = detail?.graph.nodes.find((node) => node.view.resident.id === AURORA);
    expect(aurora?.edges.some((edge) => edge.otherResidentId === REYNALDO)).toBe(true);
  });

  it('is idempotent: recording the same link twice records one relationship', async () => {
    // A retry after a dropped response must not marry anyone twice.
    signedInAs(authenticated('intake-officer'));
    const first = await firstValueFrom(
      repo().recordRelationship(AURORA, MARILOU, 'other-relative-of', REASON),
    );
    const second = await firstValueFrom(
      repo().recordRelationship(AURORA, MARILOU, 'other-relative-of', REASON),
    );
    expect(second.id).toBe(first.id);
  });

  it('resolves a symmetric duplicate stated backwards to the same record', async () => {
    // "Marilou is the spouse of Reynaldo" is the marriage already on file
    // stated from the other side, not a second one.
    signedInAs(authenticated('intake-officer'));
    const same = await firstValueFrom(
      repo().recordRelationship(MARILOU, REYNALDO, 'spouse-of', REASON),
    );
    expect(same.id).toBe('rel-0001');
  });

  it('still refuses a relationship from a person to themselves', async () => {
    signedInAs(authenticated('intake-officer'));
    try {
      await firstValueFrom(repo().recordRelationship(REYNALDO, REYNALDO, 'sibling-of', REASON));
      throw new Error('should have been refused');
    } catch (error) {
      expect(isRelationshipInvalid(error)).toBe(true);
      if (isRelationshipInvalid(error)) {
        expect(error.problems).toContainEqual({ code: 'same-person', residentId: REYNALDO });
      }
    }
  });

  it('ends a relationship without deleting it, and writes the reason down', async () => {
    signedInAs(authenticated('social-worker'));
    const ended = await firstValueFrom(
      repo().endRelationship(
        // The subject the relationship is about; the API scopes it under them (`DL-47`).
        asId<ResidentId>('res-0001'),
        asId<RelationshipId>('rel-0004'),
        'Recorded in error at intake',
      ),
    );
    expect(ended.until).not.toBeNull();

    const detail = await firstValueFrom(repo().getById(MERCADO));
    // Still present — ended, not gone.
    expect(detail?.graph.edges.some((edge) => edge.id === 'rel-0004')).toBe(true);
    expect(detail?.history.some((event) => event.kind === 'relationship-ended')).toBe(false);

    const history = await firstValueFrom(repo().historyForResident(AURORA));
    const event = history.find((entry) => entry.kind === 'relationship-ended');
    expect(event?.reason).toBe('Recorded in error at intake');
    expect(event?.actorName).toBe('Test User');
  });
});

/* ── Transfers ────────────────────────────────────────────────────────────── */

describe('transferring a resident between families', () => {
  it('refuses without family.manage', async () => {
    signedInAs(authenticated('auditor'));
    await expect(
      firstValueFrom(
        repo().transferResident({
          residentId: ALDRIN,
          fromFamilyId: BAUTISTA,
          toFamilyId: null,
          role: 'other-member',
          moveHousehold: false,
          reason: REASON,
        }),
      ),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('refuses a move with no usable reason', async () => {
    signedInAs(authenticated('intake-officer'));
    try {
      await firstValueFrom(
        repo().transferResident({
          residentId: ALDRIN,
          fromFamilyId: BAUTISTA,
          toFamilyId: null,
          role: 'other-member',
          moveHousehold: false,
          reason: 'moved',
        }),
      );
      throw new Error('should have been refused');
    } catch (error) {
      expect(isTransferRefused(error)).toBe(true);
      if (isTransferRefused(error)) {
        expect(error.problems.some((problem) => problem.code === 'no-reason')).toBe(true);
      }
    }
  });

  it('refuses to move the head out of a family that still has members', async () => {
    signedInAs(authenticated('intake-officer'));
    try {
      await firstValueFrom(
        repo().transferResident({
          residentId: REYNALDO,
          fromFamilyId: BAUTISTA,
          toFamilyId: null,
          role: 'other-member',
          moveHousehold: false,
          reason: REASON,
        }),
      );
      throw new Error('should have been refused');
    } catch (error) {
      expect(isTransferRefused(error)).toBe(true);
      if (isTransferRefused(error)) {
        expect(error.problems.some((problem) => problem.code === 'would-orphan-head')).toBe(true);
      }
    }
  });

  it('moves a member out and records why', async () => {
    signedInAs(authenticated('intake-officer'));
    const detail = await firstValueFrom(
      repo().transferResident({
        residentId: ALDRIN,
        fromFamilyId: BAUTISTA,
        toFamilyId: null,
        role: 'other-member',
        moveHousehold: false,
        reason: 'Home visit 12 August: now boarding with an aunt',
      }),
    );

    expect(
      detail.graph.nodes.find((node) => node.view.resident.id === ALDRIN)?.isCurrentMember,
    ).toBe(false);
    const event = detail.history.find((entry) => entry.kind === 'resident-transferred');
    expect(event?.reason).toContain('boarding with an aunt');
    expect(event?.actorName).toBe('Test User');
  });

  it('keeps the former member in the graph rather than dropping them', async () => {
    // A person who left is still part of how this family came to look this way.
    signedInAs(authenticated('intake-officer'));
    await firstValueFrom(
      repo().transferResident({
        residentId: ALDRIN,
        fromFamilyId: BAUTISTA,
        toFamilyId: null,
        role: 'other-member',
        moveHousehold: false,
        reason: 'Home visit 12 August: now boarding with an aunt',
      }),
    );
    const detail = await firstValueFrom(repo().getById(BAUTISTA));
    expect(detail?.graph.nodes.some((node) => node.view.resident.id === ALDRIN)).toBe(true);
  });

  it('leaves the household alone unless asked to move it', async () => {
    signedInAs(authenticated('intake-officer'));
    await firstValueFrom(
      repo().transferResident({
        residentId: ALDRIN,
        fromFamilyId: BAUTISTA,
        toFamilyId: MERCADO,
        role: 'child',
        moveHousehold: false,
        reason: 'Recorded as living with grandmother from August',
      }),
    );
    const resident = await firstValueFrom(residents().getById(ALDRIN));
    // Family changed; address did not. A child can board away from their family.
    expect(resident?.resident.householdId).toBe('hh-0002');
  });

  it('moves the household too when asked', async () => {
    signedInAs(authenticated('intake-officer'));
    await firstValueFrom(
      repo().transferResident({
        residentId: ALDRIN,
        fromFamilyId: BAUTISTA,
        toFamilyId: MERCADO,
        role: 'child',
        moveHousehold: true,
        reason: 'Recorded as living with grandmother from August',
      }),
    );
    const resident = await firstValueFrom(residents().getById(ALDRIN));
    expect(resident?.resident.householdId).toBe('hh-0001');
  });

  it('is idempotent: repeating a completed move changes nothing and adds no event', async () => {
    signedInAs(authenticated('intake-officer'));
    const transfer = {
      residentId: ALDRIN,
      fromFamilyId: BAUTISTA,
      toFamilyId: MERCADO,
      role: 'child' as const,
      moveHousehold: false,
      reason: 'Recorded as living with grandmother from August',
    };
    const first = await firstValueFrom(repo().transferResident(transfer));
    const second = await firstValueFrom(repo().transferResident(transfer));
    expect(second.history).toHaveLength(first.history.length);
  });
});

/* ── History ──────────────────────────────────────────────────────────────── */

describe('history is appended to, never replaced', () => {
  it('accumulates one event per act, newest first', async () => {
    signedInAs(authenticated('intake-officer'));
    await firstValueFrom(repo().recordRelationship(AURORA, REYNALDO, 'other-relative-of', REASON));
    await firstValueFrom(
      repo().transferResident({
        residentId: ALDRIN,
        fromFamilyId: BAUTISTA,
        toFamilyId: null,
        role: 'other-member',
        moveHousehold: false,
        reason: 'Home visit: now boarding away',
      }),
    );

    const history = await firstValueFrom(repo().historyForResident(ALDRIN));
    expect(history.length).toBeGreaterThan(0);
    for (const event of history) {
      expect(event.reason.length).toBeGreaterThan(0);
      expect(event.actorName).toBe('Test User');
      expect(event.occurredAt).toBeTruthy();
    }
  });

  it('returns nothing for a resident outside your scope, without saying so', async () => {
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    await expect(firstValueFrom(repo().historyForResident(REYNALDO))).resolves.toEqual([]);
  });
});
