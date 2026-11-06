import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockFamilyRepository } from '@data/mock/mock-family.repository';
import { MockHouseholdRepository } from '@data/mock/mock-household.repository';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import { MockResidentRepository } from '@data/mock/mock-resident.repository';
import {
  ACCESS_CONTEXT,
  asId,
  emptyPage,
  FAMILY_REPOSITORY,
  HOUSEHOLD_REPOSITORY,
  NOTIFICATION_REPOSITORY,
  RESIDENT_REPOSITORY,
  STAFF_REPOSITORY,
  toAuthenticatedUser,
  type AuthenticatedUser,
  type BarangayId,
  type FamilyId,
  type Page,
  type ResidentId,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
  type SignInOutcome,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';
import { PersonPicker } from '@shared/residents/person-picker';
import { SEARCH_DEBOUNCE_MS } from '@shared/state/debounced';

import { FamilyDetailPage } from './family-detail-page';
import { FamilyFormPage } from './family-form-page';
import { FamilyListPage } from './family-list-page';
import { familyFilterParams, readFamilyFilter, readFamilyQuery } from './family-query';

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
const MERCADO = 'fam-0001';
const BAUTISTA = 'fam-0003';
const UNHOUSED = 'fam-0004';

function staffUser(role: StaffRole, barangayId: BarangayId | null = null): StaffUser {
  return {
    id: asId<StaffUserId>('staff-test'),
    name: { first: 'Test', middle: null, last: 'User', suffix: null },
    email: 'test@example.gov.ph',
    role,
    position: 'Tester',
    barangayId,
    additionalPermissions: [],
    isActive: true,
    lastSignInAt: null,
    audit: {
      createdAt: '2026-01-01T00:00:00.000Z' as StaffUser['audit']['createdAt'],
      createdBy: null,
      updatedAt: '2026-01-01T00:00:00.000Z' as StaffUser['audit']['updatedAt'],
      updatedBy: null,
    },
  };
}

function staffRepository(user: StaffUser): StaffRepository {
  const authenticated = toAuthenticatedUser(user);
  return {
    list: (): Observable<Page<StaffUser>> => of(emptyPage<StaffUser>()),
    getById: (): Observable<StaffUser | null> => of(user),
    currentUser: (): Observable<AuthenticatedUser | null> => of(authenticated),
    signIn: (): Observable<SignInOutcome> => of({ kind: 'authenticated', user: authenticated }),
    completeMfa: (): Observable<AuthenticatedUser> => of(authenticated),
    signOut: (): Observable<void> => of(undefined),
  };
}

@Component({ template: 'stub' })
class StubPage {}

async function configure(role: StaffRole, barangayId: BarangayId | null = null): Promise<void> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'families', component: FamilyListPage },
        { path: 'families/new', component: FamilyFormPage },
        { path: 'families/:id', component: FamilyDetailPage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(staffUser(role, barangayId)) },
      { provide: FAMILY_REPOSITORY, useClass: MockFamilyRepository },
      { provide: RESIDENT_REPOSITORY, useClass: MockResidentRepository },
      // The form chooses a household from the register.
      { provide: HOUSEHOLD_REPOSITORY, useClass: MockHouseholdRepository },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function openList(
  role: StaffRole = 'intake-officer',
  url = '/families',
): Promise<ComponentFixture<FamilyListPage>> {
  await configure(role);
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(FamilyListPage);
  await fixture.whenStable();
  return fixture;
}

async function openDetail(
  id: string,
  role: StaffRole = 'intake-officer',
  barangayId: BarangayId | null = null,
): Promise<ComponentFixture<FamilyDetailPage>> {
  await configure(role, barangayId);
  await TestBed.inject(Router).navigateByUrl(`/families/${id}`);
  const fixture = TestBed.createComponent(FamilyDetailPage);
  fixture.componentRef.setInput('id', id);
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

/* ── The URL is the query ─────────────────────────────────────────────────── */

describe('the family filter lives in the URL', () => {
  const params = (values: Record<string, string>) => ({
    get: (name: string) => values[name] ?? null,
  });

  it('reads a complete filter back out of query parameters', () => {
    expect(
      readFamilyFilter(params({ q: 'bautista', barangay: 'brgy-san-juan', unhoused: 'true' })),
    ).toEqual({ search: 'bautista', barangayId: SAN_JUAN, unhousedOnly: true });
  });

  it('degrades junk to no filter', () => {
    expect(readFamilyFilter(params({ barangay: 'brgy-atlantis' }))).toEqual({});
  });

  it('reads no page or sort from the URL: the order is the server’s', () => {
    expect(readFamilyQuery(params({ page: '3', sort: 'name', direction: 'desc' }))).toEqual({
      filter: {},
    });
  });

  it('round-trips a filter through its parameters', () => {
    const filter = { search: 'cruz', unhousedOnly: true, includeDissolved: true } as const;
    expect(readFamilyFilter(params(familyFilterParams(filter)))).toEqual(filter);
  });
});

/* ── Household is not family, on screen ───────────────────────────────────── */

describe('the family list says a household is not a family', () => {
  it('states it in words above the table', async () => {
    // The correction every reader arrives needing.
    const element = html(await openList());
    expect(element.querySelector('.families__banner')?.textContent).toContain(
      'One address often holds several families',
    );
  });

  it('shows two families at the same address', async () => {
    const element = html(await openList());
    const text = element.querySelector('tbody')?.textContent ?? '';
    expect(text).toContain('Mercado family');
    expect(text).toContain('Mercado (Joselito) family');
  });

  it('says "None recorded" for a family with no household rather than leaving a blank', async () => {
    const element = html(await openList());
    expect(element.textContent).toContain('None recorded');
  });

  it('says how many are shown and whether more follow, never a page count', async () => {
    const element = html(await openList());
    const status = element.querySelector('.families__more [role="status"]')?.textContent ?? '';
    expect(status).toMatch(/\d+ shown\./);
    expect(status).toContain('That is every family');
    expect(element.textContent).not.toMatch(/page \d+ of/i);
  });

  it('says what the search reads, and that it needs two characters', async () => {
    const element = html(await openList());
    const input = element.querySelector('input[type="search"]');
    const hint = element.querySelector(`#${input?.getAttribute('aria-describedby') ?? 'none'}`);
    expect(hint?.textContent).toContain('at least two characters');
    expect(hint?.textContent).toContain('In order of family number');
  });

  it('offers recording a family only to a role that may manage families', async () => {
    const intake = html(await openList('intake-officer'));
    expect(intake.querySelector('a[href="/families/new"]')?.textContent).toContain(
      'Record a family',
    );
    const auditor = html(await openList('auditor'));
    expect(auditor.querySelector('a[href="/families/new"]')).toBeNull();
  });

  it('makes every family reference a link into the record', async () => {
    const element = html(await openList());
    const links = element.querySelectorAll<HTMLAnchorElement>('.families__reference');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toContain('/families/fam-');
    }
  });
});

describe('the family record', () => {
  it('lists the other family at the same address as a separate unit', async () => {
    const element = html(await openDetail(MERCADO));
    const sharing = element.querySelector('.sharing')?.textContent ?? '';
    expect(sharing).toContain('Mercado (Joselito) family');
    expect(element.querySelector('#sharing-heading')?.textContent).toContain(
      'Other families at this address',
    );
  });

  it('explains a missing household instead of showing an empty field', async () => {
    const element = html(await openDetail(UNHOUSED, 'mswdo-head'));
    expect(element.querySelector('.family__none')?.textContent).toContain(
      'Not linked to a household',
    );
    expect(element.querySelector('.family__note')?.textContent).toContain('not missing data');
  });

  it('renders the relationship graph and its history side by side', async () => {
    const element = html(await openDetail(BAUTISTA, 'mswdo-head'));
    expect(element.querySelector('#relationship-graph-heading')).not.toBeNull();
    expect(element.querySelector('#history-heading')).not.toBeNull();
  });

  it('says the history is added to and never edited', async () => {
    const element = html(await openDetail(BAUTISTA, 'mswdo-head'));
    expect(element.textContent).toContain('added to, never edited');
  });

  it('reports an out-of-scope family as unavailable, disclosing nothing', async () => {
    const outOfScope = html(await openDetail(BAUTISTA, 'barangay-link', SAN_JUAN));
    const missing = html(await openDetail('fam-9999', 'barangay-link', SAN_JUAN));
    expect(outOfScope.textContent).toContain('not available');
    expect(missing.textContent).toContain('not available');
    expect(outOfScope.textContent).not.toContain('Bautista family');
  });
});

describe('changing who heads a family', () => {
  // The API keeps the reason in the family's history for good (`DL-48`): a sentence the console
  // supplied itself would read there as somebody's account of why.
  it('asks for a reason before it changes anything, and sends the words typed', async () => {
    const fixture = await openDetail(BAUTISTA, 'intake-officer');
    const repository = TestBed.inject(FAMILY_REPOSITORY);
    const change = vi.spyOn(repository, 'changeMemberRole');

    const makeHead = Array.from(html(fixture).querySelectorAll('button')).find((button) =>
      button.textContent?.trim().startsWith('Make head'),
    );
    expect(makeHead).toBeDefined();
    makeHead?.click();
    await fixture.whenStable();
    expect(change).not.toHaveBeenCalled();

    const confirm = () =>
      Array.from(html(fixture).querySelectorAll('button')).filter((button) =>
        button.textContent?.trim().startsWith('Make head'),
      ).at(-1);
    expect(confirm()?.disabled).toBe(true);

    const reason = html(fixture).querySelector<HTMLInputElement>(
      'input[placeholder^="e.g. Her husband"]',
    );
    expect(reason).not.toBeNull();
    if (reason !== null) {
      reason.value = 'Her husband works in Qatar now.';
      reason.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    confirm()?.click();
    await fixture.whenStable();

    expect(change).toHaveBeenCalledTimes(1);
    expect(change.mock.calls[0]?.[3]).toBe('Her husband works in Qatar now.');
  });
});

describe('the transfer workflow', () => {
  it('is offered to a role that may manage families', async () => {
    const element = html(await openDetail(BAUTISTA, 'intake-officer'));
    expect(element.textContent).toContain('Move someone');
  });

  it('is hidden from a read-only role', async () => {
    const element = html(await openDetail(BAUTISTA, 'auditor'));
    expect(element.textContent).not.toContain('Move someone');
  });

  async function openTransfer(): Promise<ComponentFixture<FamilyDetailPage>> {
    const fixture = await openDetail(BAUTISTA, 'intake-officer');
    const button = Array.from(html(fixture).querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes('Move someone'),
    );
    button?.click();
    await fixture.whenStable();
    return fixture;
  }

  it('will not record a move without a person and a reason', async () => {
    const fixture = await openTransfer();
    const confirm = Array.from(html(fixture).querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Record the move'),
    );
    expect(confirm?.disabled).toBe(true);
  });

  it('offers the household to follow, and says it often should not', async () => {
    // The assumption this whole TAB removes, restated where it would otherwise
    // be made silently by a checkbox that defaults to on.
    const element = html(await openTransfer());
    expect(element.textContent).toContain('Move their household address too');
    expect(element.textContent).toContain('Often the address does not follow');
    const checkbox = element.querySelector<HTMLInputElement>('.dialogue__check input');
    expect(checkbox?.checked).toBe(false);
  });

  it('enables the move once a person and a real reason are given', async () => {
    const fixture = await openTransfer();
    const select = html(fixture).querySelector<HTMLSelectElement>('.dialogue__input');
    if (select) {
      select.value = 'res-0010';
      select.dispatchEvent(new Event('change'));
    }
    const inputs = html(fixture).querySelectorAll<HTMLInputElement>('input.dialogue__input');
    const reason = inputs[inputs.length - 1];
    if (reason) {
      reason.value = 'Home visit 12 August: now boarding with an aunt';
      reason.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();

    const confirm = Array.from(html(fixture).querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Record the move'),
    );
    expect(confirm?.disabled).toBe(false);
  });
});

/* ── Recording a family ───────────────────────────────────────────────────── */

describe('recording a family', () => {
  /** res-0008 lives at no household; res-0002 heads the Bautista household. */
  const UNATTACHED = asId<ResidentId>('res-0008');
  const BAUTISTA_HEAD = asId<ResidentId>('res-0002');

  async function openForm(
    role: StaffRole = 'intake-officer',
  ): Promise<ComponentFixture<FamilyFormPage>> {
    await configure(role);
    await TestBed.inject(Router).navigateByUrl('/families/new');
    const fixture = TestBed.createComponent(FamilyFormPage);
    await fixture.whenStable();
    return fixture;
  }

  async function add(fixture: ComponentFixture<FamilyFormPage>, id: ResidentId): Promise<void> {
    const view = await firstValueFrom(TestBed.inject(RESIDENT_REPOSITORY).getById(id));
    const picker = fixture.debugElement.query(By.directive(PersonPicker))
      .componentInstance as PersonPicker;
    if (view !== null) {
      picker.chosen.emit(view);
    }
    await fixture.whenStable();
  }

  function type(fixture: ComponentFixture<FamilyFormPage>, selector: string, value: string): void {
    const field = html(fixture).querySelector<HTMLInputElement | HTMLTextAreaElement>(selector);
    if (field !== null) {
      field.value = value;
      field.dispatchEvent(new Event('input'));
    }
  }

  async function submit(fixture: ComponentFixture<FamilyFormPage>): Promise<void> {
    html(fixture).querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await fixture.whenStable();
  }

  it('says a family between addresses is ordinary, and starts with no household', async () => {
    const element = html(await openForm());
    expect(element.textContent).toContain('No household — between addresses');
    expect(element.textContent).toContain('is an ordinary thing to record');
    expect(element.textContent).toContain('It is not missing information');
  });

  it('asks for the reason, and says it is kept against the writer’s name', async () => {
    const element = html(await openForm());
    const reason = element.querySelector('textarea');
    expect(reason?.hasAttribute('required')).toBe(true);
    const hint = element.querySelector(`#${reason?.getAttribute('aria-describedby') ?? 'none'}`);
    expect(hint?.textContent).toContain('against your name');
  });

  it('says what is missing rather than sending an incomplete family', async () => {
    const fixture = await openForm();
    await submit(fixture);
    const missing = html(fixture).querySelector('.family-form__missing')?.textContent ?? '';
    expect(missing).toContain('Give the family a name');
    expect(missing).toContain('Add at least one member');
    expect(missing).toContain('Say why');
    expect(TestBed.inject(Router).url).toBe('/families/new');
  });

  it('gives each member a labelled role, the first as head, and lists nobody twice', async () => {
    const fixture = await openForm();
    await add(fixture, UNATTACHED);
    await add(fixture, BAUTISTA_HEAD);
    await add(fixture, UNATTACHED);

    const element = html(fixture);
    const rows = element.querySelectorAll('.family-form__member');
    expect(rows).toHaveLength(2);
    const roles = element.querySelectorAll<HTMLSelectElement>('.family-form__member select');
    expect(roles[0]?.value).toBe('head');
    expect(roles[1]?.value).toBe('other-member');
    // Each select is named for the person it is about, not "Role" twice.
    expect(rows[0]?.querySelector('.family-form__role')?.textContent).toContain('Role of');
    expect(element.querySelector('.family-form__notice')?.textContent).toContain('already listed');
  });

  it('records the family with its members and no household, and opens it', async () => {
    const fixture = await openForm();
    type(fixture, 'input[type="text"]', 'Gonzales family');
    await add(fixture, UNATTACHED);
    type(fixture, 'textarea', 'Intake interview: she lives alone, between addresses.');
    await fixture.whenStable();
    await submit(fixture);

    const router = TestBed.inject(Router);
    expect(router.url).toMatch(/^\/families\/fam-\d+$/);
    const id = router.url.split('/').at(-1) ?? '';
    const detail = await firstValueFrom(
      TestBed.inject(FAMILY_REPOSITORY).getById(asId<FamilyId>(id)),
    );
    expect(detail?.family.name).toBe('Gonzales family');
    expect(detail?.family.householdId).toBeNull();
    expect(detail?.family.members.map((member) => member.residentId)).toEqual([UNATTACHED]);
    expect(detail?.history.every((event) => event.reason.startsWith('Intake interview'))).toBe(
      true,
    );
  });

  it('places the family in a household chosen from the register', async () => {
    const fixture = await openForm();
    type(fixture, 'input[type="text"]', 'Bautista (extended) family');
    await add(fixture, UNATTACHED);
    type(fixture, 'textarea', 'Home visit: she now lives with the Bautistas.');
    type(fixture, 'input[type="search"]', 'bautista');
    await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 50));
    await fixture.whenStable();

    const choose = Array.from(
      html(fixture).querySelectorAll<HTMLButtonElement>('.family-form__household button'),
    );
    expect(choose.length).toBeGreaterThan(0);
    choose[0]?.click();
    await fixture.whenStable();
    expect(html(fixture).querySelector('.family-form__chosen')?.textContent).toContain('Lives in:');

    await submit(fixture);
    const id = TestBed.inject(Router).url.split('/').at(-1) ?? '';
    const detail = await firstValueFrom(
      TestBed.inject(FAMILY_REPOSITORY).getById(asId<FamilyId>(id)),
    );
    expect(detail?.family.householdId).toBe('hh-0002');
  });
});

describe('ending a relationship (DL-185)', () => {
  it('asks why first, then ends the one chosen — kept, never deleted', async () => {
    const fixture = await openDetail(BAUTISTA, 'intake-officer');
    const end = vi.spyOn(TestBed.inject(FAMILY_REPOSITORY), 'endRelationship');

    const offered = html(fixture).querySelector<HTMLButtonElement>('.graph__end');
    expect(offered).not.toBeNull();
    offered?.click();
    await fixture.whenStable();
    expect(end).not.toHaveBeenCalled();
    expect(html(fixture).textContent).toContain('never deleted');

    const confirm = () =>
      Array.from(html(fixture).querySelectorAll('button')).find(
        (button) => button.textContent?.trim() === 'Mark as ended',
      );
    expect(confirm()?.disabled).toBe(true);

    const reason = html(fixture).querySelector<HTMLInputElement>(
      'input[placeholder^="e.g. Annulment"]',
    );
    expect(reason).not.toBeNull();
    if (reason !== null) {
      reason.value = 'Annulment decree presented at the counter.';
      reason.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
    confirm()?.click();
    await fixture.whenStable();

    expect(end).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      'Annulment decree presented at the counter.',
    );
  });

  it('offers no end to a reader who may not manage families', async () => {
    const element = html(await openDetail(BAUTISTA, 'auditor'));
    expect(element.querySelector('.graph__end')).toBeNull();
  });
});
