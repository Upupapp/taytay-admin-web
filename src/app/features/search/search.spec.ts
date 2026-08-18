import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockSearchRepository } from '@data/mock/mock-search.repository';
import {
  ACCESS_CONTEXT,
  MIN_SEARCH_LENGTH,
  NEVER_SEARCHED,
  RECENT_SEARCH_LIMIT,
  SEARCH_REPOSITORY,
  STAFF_REPOSITORY,
  addRecentSearch,
  asId,
  describeWithheld,
  emptyPage,
  isSearchable,
  matchesTerm,
  normaliseForSearch,
  toAuthenticatedUser,
  type AuthenticatedUser,
  type Page,
  type SearchResults,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
  type SignInOutcome,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { SearchPage } from './search-page';

const TEST_ENVIRONMENT: AppEnvironment = {
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  mockLatencyMs: 0,
  enableDevTools: false,
};

function staffUser(role: StaffRole, id = 'staff-head'): StaffUser {
  return {
    id: asId<StaffUserId>(id),
    name: { first: 'Test', middle: null, last: 'User', suffix: null },
    email: 'test@example.gov.ph',
    role,
    position: 'Tester',
    barangayId: null,
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

async function configure(role: StaffRole, id = 'staff-head'): Promise<void> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'search', component: SearchPage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(staffUser(role, id)) },
      { provide: SEARCH_REPOSITORY, useClass: MockSearchRepository },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function openSearch(
  term: string,
  role: StaffRole = 'mswdo-head',
  id = 'staff-head',
): Promise<ComponentFixture<SearchPage>> {
  await configure(role, id);
  await TestBed.inject(Router).navigateByUrl(term === '' ? '/search' : `/search?q=${term}`);
  const fixture = TestBed.createComponent(SearchPage);
  await fixture.whenStable();
  return fixture;
}

async function run(term: string, role: StaffRole = 'mswdo-head'): Promise<SearchResults> {
  await configure(role);
  return firstValueFrom(TestBed.inject(SEARCH_REPOSITORY).search(term));
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

/* ── Criterion: results reveal only role-appropriate data ─────────────────── */

describe('what search may read', () => {
  it('never matches a case note, an assessment or a reason for a request', async () => {
    // Matching on free text discloses it even with no snippet: type a
    // condition, get back one resident, and the office has said what is in
    // that person's file (`DL-109`).
    const results = await run('countersignature');

    expect(results.total).toBe(0);
  });

  it('returns nothing for a phrase that only exists inside a case note', async () => {
    const results = await run('managing alone');

    expect(results.total).toBe(0);
  });

  it('carries no free-text field on a hit at all', async () => {
    const results = await run('mercado');
    const hit = results.groups.flatMap((group) => group.hits)[0];

    expect(hit).toBeDefined();
    for (const field of ['snippet', 'body', 'notes', 'context', 'matchedText', 'excerpt']) {
      expect(hit as unknown as Record<string, unknown>).not.toHaveProperty(field);
    }
  });

  it('lists the field names that must never be read, so the checker has a source', () => {
    expect(NEVER_SEARCHED).toContain('body');
    expect(NEVER_SEARCHED).toContain('reasonForRequest');
    expect(NEVER_SEARCHED).toContain('philsysLastFour');
  });
});

describe('who may search what', () => {
  it('gives a disbursement officer requests and residents but no case file', async () => {
    const results = await run('mercado', 'disbursement-officer');
    const types = results.groups.map((group) => group.type);

    expect(types).not.toContain('case');
    expect(results.withheldTypes).toContain('case');
  });

  it('names the types it did not search rather than hiding them', async () => {
    const results = await run('mercado', 'disbursement-officer');
    const notice = describeWithheld(results);

    // "You cannot see cases" and "no cases matched" are different answers.
    expect(notice).toContain('does not cover');
    expect(notice).toContain('cases');
  });

  it('says nothing about withheld types when an account covers everything', async () => {
    const results = await run('mercado', 'system-administrator');

    expect(results.withheldTypes).toHaveLength(0);
    expect(describeWithheld(results)).toBeNull();
  });
});

/* ── Criterion: common records found in a few keystrokes ──────────────────── */

describe('finding a record', () => {
  it('refuses a term shorter than two characters rather than dumping the registry', async () => {
    expect(isSearchable('a')).toBe(false);
    expect(isSearchable('ab')).toBe(true);
    expect(MIN_SEARCH_LENGTH).toBe(2);

    const results = await run('a');
    expect(results.total).toBe(0);
  });

  it('matches a surname regardless of case or accent', () => {
    expect(matchesTerm('Peña, Rosalinda', 'pena')).toBe(true);
    expect(normaliseForSearch('Peña')).toBe('pena');
  });

  it('groups results by record type', async () => {
    const results = await run('mercado');

    expect(results.groups.length).toBeGreaterThan(0);
    for (const group of results.groups) {
      expect(group.total).toBeGreaterThan(0);
      expect(group.hits.length).toBeLessThanOrEqual(group.total);
    }
  });

  it('offers the full list when a group is truncated', async () => {
    const results = await run('a');
    void results;

    const wide = await run('res');
    for (const group of wide.groups) {
      if (group.isTruncated) {
        expect(group.seeAllLink.length).toBeGreaterThan(0);
        expect(group.seeAllParams['search']).toBe('res');
      }
    }
  });

  it('echoes the term back with the results', async () => {
    const results = await run('mercado');
    expect(results.term).toBe('mercado');
  });
});

/* ── Criterion: recent searches are not written to the device ─────────────── */

describe('recent searches', () => {
  it('keeps the most recent first, without duplicates', () => {
    let recent = addRecentSearch([], 'dela cruz');
    recent = addRecentSearch(recent, 'santos');
    recent = addRecentSearch(recent, 'Dela Cruz');

    expect(recent[0]).toBe('Dela Cruz');
    expect(recent).toHaveLength(2);
  });

  it('caps the list so it stays readable', () => {
    let recent: readonly string[] = [];
    for (let index = 0; index < RECENT_SEARCH_LIMIT + 4; index += 1) {
      recent = addRecentSearch(recent, `term-${index}`);
    }
    expect(recent).toHaveLength(RECENT_SEARCH_LIMIT);
  });

  it('ignores an empty term', () => {
    expect(addRecentSearch(['a'], '   ')).toEqual(['a']);
  });

  it('says on screen that nothing is saved to the device', async () => {
    const fixture = await openSearch('mercado');
    const page = fixture.componentInstance as unknown as { run: (term: string) => void };

    page.run('mercado');
    fixture.detectChanges();
    await fixture.whenStable();

    expect(html(fixture).querySelector('.recent__notice')?.textContent).toContain(
      'never saved to this device',
    );
  });
});

/* ── The screen ───────────────────────────────────────────────────────────── */

describe('the search screen', () => {
  it('says up front that case notes are never searched', async () => {
    const element = html(await openSearch(''));

    expect(element.querySelector('.search__notice')?.textContent).toContain(
      'never searched and never shown',
    );
  });

  it('invites a search rather than showing an empty result set', async () => {
    const element = html(await openSearch(''));

    expect(element.querySelector('.search__idle-heading')).not.toBeNull();
    expect(element.querySelector('.search__empty-heading')).toBeNull();
  });

  it('summarises the results in counts', async () => {
    const element = html(await openSearch('mercado'));
    const summary = element.querySelector('.search__summary')?.textContent ?? '';

    expect(summary).toContain('Results for');
    expect(summary).toMatch(/\d/);
  });

  it('keeps the term in the URL so a search can be sent to a colleague', async () => {
    await openSearch('mercado');
    expect(TestBed.inject(Router).url).toContain('q=mercado');
  });

  it('shows a hit as a name, a reference, a barangay and a status — nothing more', async () => {
    const element = html(await openSearch('mercado'));
    const item = element.querySelector('.group__item');

    expect(item).not.toBeNull();
    const classes = [...(item?.querySelectorAll('[class^="group__"]') ?? [])].map(
      (node) => node.className,
    );
    for (const className of classes) {
      expect(className).toMatch(
        /group__(title|meta|reference|barangay|status)/,
      );
    }
  });

  it('says plainly when nothing matched', async () => {
    const element = html(await openSearch('zzzzzznothing'));

    expect(element.querySelector('.search__empty-heading')?.textContent).toContain(
      'Nothing matched',
    );
  });
});
