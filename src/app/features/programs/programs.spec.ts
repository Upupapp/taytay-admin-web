import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import { MockProgramRepository } from '@data/mock/mock-program.repository';
import {
  ACCESS_CONTEXT,
  NOTIFICATION_REPOSITORY,
  PROGRAM_REPOSITORY,
  STAFF_REPOSITORY,
  asId,
  emptyPage,
  toAuthenticatedUser,
  toProgramDraft,
  type AuthenticatedUser,
  type Page,
  type ProgramId,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
  type SignInOutcome,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { ProgramDetailPage } from './program-detail-page';
import { ProgramListPage, readCatalogQuery } from './program-list-page';

const TEST_ENVIRONMENT: AppEnvironment = {
  name: 'local-mock',
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  mockLatencyMs: 0,
  enableDevTools: false,
};

/** A DSWD programme the municipality refers into. */
const AICS_MEDICAL = 'prog-aics-medical';
/** A programme the municipality genuinely runs. */
const EDUCATIONAL = 'prog-educational';

function staffUser(role: StaffRole): StaffUser {
  return {
    id: asId<StaffUserId>('staff-head'),
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

async function configure(role: StaffRole): Promise<void> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'programs', component: ProgramListPage },
        { path: 'programs/:id', component: ProgramDetailPage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(staffUser(role)) },
      { provide: PROGRAM_REPOSITORY, useClass: MockProgramRepository },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function openList(role: StaffRole = 'mswdo-head'): Promise<ComponentFixture<ProgramListPage>> {
  await configure(role);
  await TestBed.inject(Router).navigateByUrl('/programs');
  const fixture = TestBed.createComponent(ProgramListPage);
  await fixture.whenStable();
  return fixture;
}

async function openDetail(
  id: string,
  role: StaffRole = 'mswdo-head',
): Promise<ComponentFixture<ProgramDetailPage>> {
  await configure(role);
  await TestBed.inject(Router).navigateByUrl(`/programs/${id}`);
  const fixture = TestBed.createComponent(ProgramDetailPage);
  fixture.componentRef.setInput('id', id);
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;
const repo = () => TestBed.inject(PROGRAM_REPOSITORY);

/* ── The URL is the filter ────────────────────────────────────────────────── */

describe('the catalog filter lives in the URL', () => {
  const params = (values: Record<string, string>) => ({
    get: (name: string) => values[name] ?? null,
  });

  it('reads a filter back out of query parameters', () => {
    const query = readCatalogQuery(params({ q: 'medical', status: 'active' }));
    expect(query.filter).toEqual({ search: 'medical', status: 'active' });
  });

  it('degrades junk rather than failing', () => {
    expect(readCatalogQuery(params({ status: 'pondering', category: 'vibes' })).filter).toEqual({});
  });
});

/* ── Criterion 3: responsibilities are not misrepresented ─────────────────── */

describe('the catalog says whose programme each one is', () => {
  it('states the correction above the table', async () => {
    const element = html(await openList());
    expect(element.querySelector('.catalog__banner')?.textContent).toContain(
      'Not everything the office hands out is the office’s to decide',
    );
  });

  it('marks a DSWD programme as DSWD’s, in the list', async () => {
    const element = html(await openList());
    const body = element.querySelector('tbody')?.textContent ?? '';
    expect(body).toContain('DSWD');
    expect(body).toContain('The municipality refers into this');
  });

  it('tells a worker plainly that the office does not decide a referred programme', async () => {
    const text = html(await openDetail(AICS_MEDICAL)).textContent ?? '';
    expect(text).toContain('The MSWDO does not decide this one');
    expect(text).toContain('do not promise an outcome');
  });

  it('does not say that about a programme the municipality runs', async () => {
    const text = html(await openDetail(EDUCATIONAL)).textContent ?? '';
    expect(text).toContain('Municipality of Taytay');
    expect(text).not.toContain('The MSWDO does not decide this one');
  });

  it('no longer describes AICS as municipally funded', async () => {
    const text = html(await openDetail(AICS_MEDICAL)).textContent ?? '';
    expect(text).not.toContain('Municipal social welfare fund');
    expect(text).toContain('DSWD (AICS)');
  });

  it('says which sources have actually been checked', async () => {
    // Every URL here was supplied, not retrieved (CLAUDE.md §6).
    const text = html(await openDetail(AICS_MEDICAL)).textContent ?? '';
    expect(text).toContain('recorded, not yet checked against the source');
  });
});

/* ── Criteria 1 and 2: the rules are data ─────────────────────────────────── */

describe('programme rules are rendered from the record', () => {
  it('shows each guideline with its weight and where it comes from', async () => {
    const text = html(await openDetail(AICS_MEDICAL)).textContent ?? '';
    expect(text).toContain('Residency');
    expect(text).toContain('Office convention');
    expect(text).toContain('resident of Taytay for at least 6 months');
  });

  it('says the guidance decides nothing', async () => {
    const text = html(await openDetail(AICS_MEDICAL)).textContent ?? '';
    expect(text).toContain('Nothing here approves or refuses anybody');
  });

  it('shows the shared documents and says which came from the template', async () => {
    const text = html(await openDetail(AICS_MEDICAL)).textContent ?? '';
    expect(text).toContain('AICS standard set');
    expect(text).toContain('From template');
  });

  it('shows the review window and that it is not yet confirmed', async () => {
    const text = html(await openDetail(AICS_MEDICAL)).textContent ?? '';
    expect(text).toContain('Convention — not yet confirmed');
    expect(text).toContain('Not yet confirmed against Taytay');
  });

  it('shows utilization without implying a budget position', async () => {
    const text = html(await openDetail(AICS_MEDICAL)).textContent ?? '';
    expect(text).toContain('not a budget position');
    expect(text).not.toContain('Remaining');
  });
});

/* ── Editing ──────────────────────────────────────────────────────────────── */

describe('editing a programme', () => {
  it('is offered to a role that may manage the catalog', async () => {
    const element = html(await openDetail(AICS_MEDICAL));
    expect(element.textContent).toContain('Edit this programme');
  });

  it('is withheld from a role that may only read it', async () => {
    const element = html(await openDetail(AICS_MEDICAL, 'intake-officer'));
    expect(element.textContent).not.toContain('Edit this programme');
    // …but the programme itself still reads normally.
    expect(element.textContent).toContain('Whose programme this is');
  });

  it('does not offer "the municipality runs this" for a DSWD programme', async () => {
    const fixture = await openDetail(AICS_MEDICAL);
    const element = html(fixture);
    [...element.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('Edit this programme'))
      ?.click();
    await fixture.whenStable();

    const options = [...html(fixture).querySelectorAll('select option')].map((option) =>
      option.textContent?.trim(),
    );
    expect(options).toContain('The municipality refers into this');
    expect(options).not.toContain('The municipality runs and funds this');
  });
});

/* ── The adapter refuses regardless of the form ───────────────────────────── */

describe('the data layer refuses a misrepresentation the form hid', () => {
  it('rejects a DSWD programme saved as municipally owned', async () => {
    await configure('mswdo-head');
    const program = await firstValueFrom(repo().getById(asId<ProgramId>(AICS_MEDICAL)));
    expect(program).not.toBeNull();

    const draft = toProgramDraft(program!);
    await expect(
      firstValueFrom(
        repo().save(
          { ...draft, responsibility: { ...draft.responsibility, lguRole: 'owner' } },
          asId<ProgramId>(AICS_MEDICAL),
        ),
      ),
    ).rejects.toThrow(/cannot be saved/);
  });

  it('accepts an honest edit', async () => {
    await configure('mswdo-head');
    const program = await firstValueFrom(repo().getById(asId<ProgramId>(AICS_MEDICAL)));
    const draft = toProgramDraft(program!);
    const saved = await firstValueFrom(
      repo().save({ ...draft, description: 'Updated wording.' }, asId<ProgramId>(AICS_MEDICAL)),
    );
    expect(saved.description).toBe('Updated wording.');
    expect(saved.responsibility.administeredBy).toBe('dswd');
  });

  it('refuses a save from a role that may not manage the catalog', async () => {
    await configure('intake-officer');
    const program = await firstValueFrom(repo().getById(asId<ProgramId>(AICS_MEDICAL)));
    await expect(
      firstValueFrom(repo().save(toProgramDraft(program!), asId<ProgramId>(AICS_MEDICAL))),
    ).rejects.toThrow();
  });

  it('reports utilization for the programme it was asked about', async () => {
    await configure('mswdo-head');
    const usage = await firstValueFrom(repo().utilizationFor(asId<ProgramId>(AICS_MEDICAL)));

    expect(usage.programId).toBe(AICS_MEDICAL);
    expect(usage.isWithheld).toBe(false);
  });

  /**
   * "Used" now means money handed over, not requests filed.
   *
   * The office record reports what a programme **delivered** and carries no count of what was
   * asked of it (`DL-159`), so a programme with forty pending requests and no payout reads as
   * unused — which is a narrower claim than the console used to make, and a true one.
   *
   * The assertion finds a programme with a payout rather than naming one, so a change to which
   * seeded household was paid does not fail a test about whether the figure is reported at all.
   */
  it('counts what a programme handed over, somewhere in the catalogue', async () => {
    await configure('mswdo-head');
    const summary = await firstValueFrom(repo().utilizationSummary());

    expect(summary.some((row) => (row.releaseCount ?? 0) > 0)).toBe(true);
  });
});
