import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockHouseholdRepository } from '@data/mock/mock-household.repository';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import { MockResidentRepository } from '@data/mock/mock-resident.repository';
import {
  ACCESS_CONTEXT,
  asId,
  emptyPage,
  HOUSEHOLD_REPOSITORY,
  NOTIFICATION_REPOSITORY,
  RESIDENT_REPOSITORY,
  STAFF_REPOSITORY,
  toAuthenticatedUser,
  type AuthenticatedUser,
  type BarangayId,
  type HouseholdId,
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

import { HouseholdDetailPage } from './household-detail-page';
import { HouseholdFormPage } from './household-form-page';
import { HouseholdListPage } from './household-list-page';
import {
  householdFilterParams,
  isHouseholdFilterActive,
  readHouseholdFilter,
} from './household-query';

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
const BAUTISTA = 'hh-0002';
const PROTECTED_HOUSEHOLD = 'hh-0005';

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
        { path: 'households', component: HouseholdListPage },
        { path: 'households/new', component: HouseholdFormPage },
        { path: 'households/:id', component: HouseholdDetailPage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(staffUser(role, barangayId)) },
      { provide: HOUSEHOLD_REPOSITORY, useClass: MockHouseholdRepository },
      { provide: RESIDENT_REPOSITORY, useClass: MockResidentRepository },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function openList(
  role: StaffRole = 'intake-officer',
  url = '/households',
): Promise<ComponentFixture<HouseholdListPage>> {
  await configure(role);
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(HouseholdListPage);
  await fixture.whenStable();
  return fixture;
}

async function openDetail(
  id: string,
  role: StaffRole = 'social-worker',
  barangayId: BarangayId | null = null,
): Promise<ComponentFixture<HouseholdDetailPage>> {
  await configure(role, barangayId);
  await TestBed.inject(Router).navigateByUrl(`/households/${id}`);
  const fixture = TestBed.createComponent(HouseholdDetailPage);
  fixture.componentRef.setInput('id', id);
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

/* ── The URL is the query ─────────────────────────────────────────────────── */

describe('the household filter lives in the URL', () => {
  const params = (values: Record<string, string>) => ({
    get: (name: string) => values[name] ?? null,
  });

  it('reads a barangay-level snapshot back out of query parameters', () => {
    expect(
      readHouseholdFilter(
        params({ barangay: 'brgy-san-juan', band: 'elevated', indigent: 'true' }),
      ),
    ).toEqual({ barangayId: SAN_JUAN, minimumBand: 'elevated', indigentOnly: true });
  });

  it('refuses "none" as a band filter, since every household meets it', () => {
    expect(readHouseholdFilter(params({ band: 'none' }))).toEqual({});
  });

  it('degrades junk to no filter', () => {
    expect(
      readHouseholdFilter(params({ barangay: 'brgy-atlantis', band: 'catastrophic' })),
    ).toEqual({});
  });

  it('round-trips a filter through its parameters', () => {
    const filter = { barangayId: SAN_JUAN, minimumBand: 'high' } as const;
    expect(readHouseholdFilter(params(householdFilterParams(filter)))).toEqual(filter);
  });

  it('knows when nothing is filtered', () => {
    expect(isHouseholdFilterActive({})).toBe(false);
    expect(isHouseholdFilterActive({ indigentOnly: true })).toBe(true);
  });
});

/* ── The list ─────────────────────────────────────────────────────────────── */

describe('the household list', () => {
  it('says in words that the indicator column decides nothing', async () => {
    // The most likely misreading on the screen, answered before the table.
    const element = html(await openList());
    expect(element.querySelector('.households__advisory')?.textContent).toContain(
      'does not decide who is helped',
    );
  });

  it('lists households with their head and size', async () => {
    const element = html(await openList());
    const rows = element.querySelectorAll('tbody tr');
    expect(rows.length).toBeGreaterThan(0);
    expect(element.textContent).toContain('HH-DL-2024-0088');
  });

  it('names each band in words, not only by colour', async () => {
    const element = html(await openList());
    const bands = Array.from(element.querySelectorAll('.households__band')).map((node) =>
      node.textContent?.trim(),
    );
    expect(bands.length).toBeGreaterThan(0);
    for (const band of bands) {
      expect(['No indicators', 'Worth watching', 'Elevated', 'High']).toContain(band);
    }
  });

  it('makes every household reference a link into the record', async () => {
    const element = html(await openList());
    const links = element.querySelectorAll<HTMLAnchorElement>('.households__reference');
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')).toContain('/households/hh-');
    }
  });

  it('says how many are shown and whether more follow, never a page count', async () => {
    const element = html(await openList());
    const status = element.querySelector('.households__more [role="status"]')?.textContent ?? '';
    expect(status).toMatch(/\d+ shown\./);
    expect(status).toContain('every household matching these filters');
    expect(element.textContent).not.toMatch(/page \d+ of/i);
  });

  it('says what the search reads, and that it needs two characters', async () => {
    const element = html(await openList());
    const hint = element.querySelector('#household-search-hint')?.textContent ?? '';
    expect(hint).toContain('at least two characters');
    expect(element.querySelector('input[type="search"]')?.getAttribute('aria-describedby')).toBe(
      'household-search-hint',
    );
  });

  it('offers registration only to a role that may manage households', async () => {
    const intake = html(await openList('intake-officer'));
    expect(intake.querySelector('a[href="/households/new"]')?.textContent).toContain(
      'Register a household',
    );
    const auditor = html(await openList('auditor'));
    expect(auditor.querySelector('a[href="/households/new"]')).toBeNull();
  });

  it('marks a protected household in the list', async () => {
    const element = html(await openList());
    expect(element.querySelector('.households__protected')?.textContent).toContain('Restricted');
  });

  it('confines a barangay link to its own barangay', async () => {
    const element = html(await openList('barangay-link'));
    // The seeded barangay-link account covers San Juan; hh-0002 is in Dolores.
    expect(element.textContent).not.toContain('HH-DL-2024-0088');
  });
});

/* ── The detail ───────────────────────────────────────────────────────────── */

describe('the household record', () => {
  it('shows the family, the indicators and the trail on one screen', async () => {
    const element = html(await openDetail(BAUTISTA));
    expect(element.querySelector('#household-heading')).not.toBeNull();
    expect(element.querySelector('#members-heading')).not.toBeNull();
    expect(element.querySelector('#vulnerability-heading')).not.toBeNull();
    expect(element.querySelector('#audit-heading')).not.toBeNull();
  });

  it('links every member to their own resident record', async () => {
    const element = html(await openDetail(BAUTISTA));
    const links = element.querySelectorAll<HTMLAnchorElement>('.members a.rsc__name');
    expect(links.length).toBe(3);
    for (const link of links) {
      expect(link.getAttribute('href')).toMatch(/\/residents\/res-\d+/);
    }
  });

  it('names each member’s role in the family', async () => {
    const element = html(await openDetail(BAUTISTA));
    const text = element.querySelector('.members')?.textContent ?? '';
    expect(text).toContain('Household head');
    expect(text).toContain('Spouse');
    expect(text).toContain('Child');
  });

  it('says the indigency classification is recorded by a person', async () => {
    // The nearest thing on this screen to a decision, so it says who made it.
    const element = html(await openDetail(BAUTISTA));
    expect(element.querySelector('.panel__note')?.textContent).toContain('never set from the');
  });

  it('carries the advisory statement on the snapshot itself', async () => {
    const element = html(await openDetail(BAUTISTA));
    expect(element.querySelector('.vuln__advisory')?.textContent).toContain(
      'do not decide eligibility',
    );
  });

  it('says "withheld" where the server withheld the address, never a blank', async () => {
    const element = html(await openDetail(PROTECTED_HOUSEHOLD, 'intake-officer'));
    const facts = element.querySelector('.facts')?.textContent ?? '';
    expect(facts).toContain('Withheld from your role');
    expect(element.querySelector('.household__protected')?.textContent).toContain(
      'protected sector',
    );
  });

  it('reports an out-of-scope household as unavailable, disclosing nothing', async () => {
    const outOfScope = html(await openDetail(BAUTISTA, 'barangay-link', SAN_JUAN));
    const missing = html(await openDetail('hh-9999', 'barangay-link', SAN_JUAN));
    expect(outOfScope.textContent).toContain('not available');
    expect(missing.textContent).toContain('not available');
    expect(outOfScope.textContent).not.toContain('HH-DL-2024-0088');
  });
});

/* ── Who may change what ──────────────────────────────────────────────────── */

describe('the two authorities are offered separately', () => {
  it('offers the member editor to a role that may manage composition', async () => {
    const element = html(await openDetail(BAUTISTA, 'intake-officer'));
    expect(element.textContent).toContain('Edit members');
  });

  it('hides the member editor from a read-only role', async () => {
    const element = html(await openDetail(BAUTISTA, 'auditor'));
    expect(element.textContent).not.toContain('Edit members');
  });

  it('offers corrections only to a role that may make a judgement', async () => {
    const intake = html(await openDetail(BAUTISTA, 'intake-officer'));
    expect(intake.querySelectorAll('.vuln__action')).toHaveLength(0);

    const worker = html(await openDetail(BAUTISTA, 'social-worker'));
    expect(worker.querySelectorAll('.vuln__action').length).toBeGreaterThan(0);
  });
});

describe('the membership editor', () => {
  async function openEditor(): Promise<ComponentFixture<HouseholdDetailPage>> {
    const fixture = await openDetail(BAUTISTA, 'intake-officer');
    const toggle = Array.from(html(fixture).querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Edit members'),
    );
    toggle?.click();
    await fixture.whenStable();
    return fixture;
  }

  it('opens with nothing pending', async () => {
    const element = html(await openEditor());
    expect(element.querySelector('.editor__idle')?.textContent).toContain('Nothing has changed');
  });

  it('lists a queued change in words before anything is saved', async () => {
    const fixture = await openEditor();
    const makeHead = Array.from(html(fixture).querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Make head' && !button.disabled,
    );
    makeHead?.click();
    await fixture.whenStable();

    expect(html(fixture).querySelector('.editor__pending')?.textContent).toContain(
      'the household head',
    );
  });

  it('will not save without a reason', async () => {
    const fixture = await openEditor();
    const makeHead = Array.from(html(fixture).querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Make head' && !button.disabled,
    );
    makeHead?.click();
    await fixture.whenStable();

    const save = Array.from(html(fixture).querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Save changes'),
    );
    expect(save?.disabled).toBe(true);
  });

  it('makes the "no head" invariant unreachable rather than merely refused', async () => {
    // The head's own remove, demote and make-head controls are disabled, so the
    // household cannot be left headless from this screen at all. The domain
    // validator still enforces it — this is the affordance, not the guarantee.
    const fixture = await openEditor();
    const headRow = html(fixture).querySelector('.editor__row');
    expect(headRow?.querySelectorAll('button[disabled]')).toHaveLength(2);
    expect(headRow?.querySelector('select[disabled]')).not.toBeNull();

    // Every other member keeps working controls.
    const otherRow = html(fixture).querySelectorAll('.editor__row')[1];
    expect(otherRow?.querySelectorAll('button[disabled]')).toHaveLength(0);
  });
});

describe('correcting an indicator', () => {
  it('asks for a reason before it will save', async () => {
    const fixture = await openDetail(BAUTISTA, 'social-worker');
    html(fixture).querySelector<HTMLButtonElement>('.vuln__action')?.click();
    await fixture.whenStable();

    const element = html(fixture);
    expect(element.querySelector('[role="dialog"]')).not.toBeNull();
    const confirm = Array.from(element.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Save correction'),
    );
    expect(confirm?.disabled).toBe(true);
  });

  it('accepts a reason long enough to mean something', async () => {
    const fixture = await openDetail(BAUTISTA, 'social-worker');
    html(fixture).querySelector<HTMLButtonElement>('.vuln__action')?.click();
    await fixture.whenStable();

    const inputs = html(fixture).querySelectorAll<HTMLInputElement>('.dialogue__input');
    const reason = inputs[inputs.length - 1];
    if (reason) {
      reason.value = 'Home visit on 12 August confirmed this';
      reason.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();

    const confirm = Array.from(html(fixture).querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Save correction'),
    );
    expect(confirm?.disabled).toBe(false);
  });

  it('never offers to correct an indicator it did not disclose', async () => {
    // The protected factor is withheld from intake, and intake cannot correct
    // anything anyway — but the panel must not offer it even to a role that can.
    const element = html(await openDetail(PROTECTED_HOUSEHOLD, 'social-worker'));
    expect(element.querySelector('.vuln__withheld')).toBeNull();
  });
});

/* ── Registering a household ──────────────────────────────────────────────── */

describe('registering a household', () => {
  /** res-0008 belongs to no household; res-0004 already heads one. */
  const UNATTACHED = asId<ResidentId>('res-0008');
  const ANOTHER_HOUSEHOLDS_HEAD = asId<ResidentId>('res-0004');

  async function openForm(
    role: StaffRole = 'intake-officer',
  ): Promise<ComponentFixture<HouseholdFormPage>> {
    await configure(role);
    await TestBed.inject(Router).navigateByUrl('/households/new');
    const fixture = TestBed.createComponent(HouseholdFormPage);
    await fixture.whenStable();
    return fixture;
  }

  async function fill(
    fixture: ComponentFixture<HouseholdFormPage>,
    head: ResidentId,
    income = '',
  ): Promise<void> {
    const view = await firstValueFrom(TestBed.inject(RESIDENT_REPOSITORY).getById(head));
    const picker = fixture.debugElement.query(By.directive(PersonPicker))
      .componentInstance as PersonPicker;
    picker.selected.set(view);
    const element = html(fixture);
    const barangay = element.querySelector<HTMLSelectElement>('select');
    if (barangay !== null) {
      barangay.value = 'brgy-dolores';
      barangay.dispatchEvent(new Event('change'));
    }
    const street = element.querySelector<HTMLInputElement>('input[autocomplete="street-address"]');
    if (street !== null) {
      street.value = '8 Bonifacio St.';
      street.dispatchEvent(new Event('input'));
    }
    const amount = element.querySelector<HTMLInputElement>('input[inputmode="decimal"]');
    if (amount !== null) {
      amount.value = income;
      amount.dispatchEvent(new Event('input'));
    }
    await fixture.whenStable();
  }

  async function submit(fixture: ComponentFixture<HouseholdFormPage>): Promise<void> {
    html(fixture).querySelector<HTMLButtonElement>('button[type="submit"]')?.click();
    await fixture.whenStable();
  }

  it('says, before the button, that the head is the one member and others join later', async () => {
    const element = html(await openForm());
    const note = element.querySelector('#household-membership-note');
    expect(note?.textContent).toContain('one member');
    expect(note?.textContent).toContain('with a reason');
    const button = element.querySelector('button[type="submit"]');
    expect(button?.getAttribute('aria-describedby')).toBe('household-membership-note');
    // Before it in the document, where somebody deciding reads it.
    expect(
      note !== null && button !== null
        ? note.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING
        : 0,
    ).toBeTruthy();
  });

  it('says what is missing rather than sending an incomplete household', async () => {
    const fixture = await openForm();
    await submit(fixture);
    const missing = html(fixture).querySelector('.household-form__missing')?.textContent ?? '';
    expect(missing).toContain('barangay');
    expect(missing).toContain('street address');
    expect(missing).toContain('head of the household');
  });

  it('refuses an amount that is not pesos rather than rounding it', async () => {
    const fixture = await openForm();
    await fill(fixture, UNATTACHED, '8,500.505');
    await submit(fixture);
    expect(html(fixture).querySelector('.household-form__missing')?.textContent).toContain(
      'at most two decimal places',
    );
  });

  it('registers the household and opens it', async () => {
    const fixture = await openForm();
    await fill(fixture, UNATTACHED, '8,500.50');
    await submit(fixture);
    const router = TestBed.inject(Router);
    expect(router.url).toMatch(/^\/households\/hh-\d+$/);
    const id = router.url.split('/').at(-1) ?? '';
    const detail = await firstValueFrom(
      TestBed.inject(HOUSEHOLD_REPOSITORY).getById(asId<HouseholdId>(id)),
    );
    expect(detail?.household.headResidentId).toBe(UNATTACHED);
    // Typed as pesos, kept as whole centavos.
    expect(detail?.household.monthlyIncome?.centavos).toBe(850_050);
  });

  it('shows a refusal in words when the head already lives under another roof', async () => {
    const fixture = await openForm();
    await fill(fixture, ANOTHER_HOUSEHOLDS_HEAD);
    await submit(fixture);
    expect(html(fixture).querySelector('.household-form__problems')?.textContent).toContain(
      'already belongs to another household',
    );
  });
});
