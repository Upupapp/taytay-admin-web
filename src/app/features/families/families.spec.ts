import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockFamilyRepository } from '@data/mock/mock-family.repository';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import { MockResidentRepository } from '@data/mock/mock-resident.repository';
import {
  ACCESS_CONTEXT,
  asId,
  emptyPage,
  FAMILY_REPOSITORY,
  NOTIFICATION_REPOSITORY,
  RESIDENT_REPOSITORY,
  STAFF_REPOSITORY,
  toAuthenticatedUser,
  type AuthenticatedUser,
  type BarangayId,
  type Page,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
  type SignInOutcome,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { FamilyDetailPage } from './family-detail-page';
import { FamilyListPage } from './family-list-page';
import { familyFilterParams, readFamilyFilter, readFamilyPage } from './family-query';

const TEST_ENVIRONMENT: AppEnvironment = {
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
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
        { path: 'families/:id', component: FamilyDetailPage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(staffUser(role, barangayId)) },
      { provide: FAMILY_REPOSITORY, useClass: MockFamilyRepository },
      { provide: RESIDENT_REPOSITORY, useClass: MockResidentRepository },
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

  it('falls back to a sane page and sort', () => {
    const page = readFamilyPage(params({ page: '-2', sort: 'vibes' }));
    expect(page.page).toBe(1);
    expect(page.sort).toEqual({ field: 'reference', direction: 'asc' });
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
