import { Component, type Type } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { unserved } from '@data/http/unserved-repositories';
import { MockAssistanceRequestRepository } from '@data/mock/mock-assistance-request.repository';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import { MockProgramRepository } from '@data/mock/mock-program.repository';
import { MockResidentRepository } from '@data/mock/mock-resident.repository';
import {
  ACCESS_CONTEXT,
  ASSISTANCE_REQUEST_REPOSITORY,
  NOTIFICATION_REPOSITORY,
  PROGRAM_REPOSITORY,
  RESIDENT_REPOSITORY,
  STAFF_REPOSITORY,
  asId,
  asIsoDateTime,
  EMPTY_ADVISORY,
  EMPTY_INTAKE_DRAFT,
  emptyPage,
  toAuthenticatedUser,
  type AuthenticatedUser,
  type Page,
  type ProgramId,
  type ResidentId,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
  type SignInOutcome,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { AdvisoryPanel } from '@shared/intake/advisory-panel';

import { AssessmentPage } from './assessment-page';
import { IntakePage } from './intake-page';
import { RequestListPage, readRequestQuery } from './request-list-page';

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

const ENDORSED = 'req-0001';

function staffUser(role: StaffRole, id: string): StaffUser {
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

async function configure(
  role: StaffRole,
  id = 'staff-intake',
  requests: Type<unknown> = MockAssistanceRequestRepository,
): Promise<void> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'assistance-requests', component: RequestListPage },
        { path: 'assistance-requests/new', component: IntakePage },
        { path: 'assistance-requests/:id/edit', component: IntakePage },
        { path: 'assistance-requests/:id', component: AssessmentPage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(staffUser(role, id)) },
      { provide: ASSISTANCE_REQUEST_REPOSITORY, useClass: requests },
      { provide: RESIDENT_REPOSITORY, useClass: MockResidentRepository },
      { provide: PROGRAM_REPOSITORY, useClass: MockProgramRepository },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function openIntake(
  role: StaffRole = 'intake-officer',
  url = '/assistance-requests/new',
): Promise<ComponentFixture<IntakePage>> {
  await configure(role);
  await TestBed.inject(Router).navigateByUrl(url);
  const fixture = TestBed.createComponent(IntakePage);
  await fixture.whenStable();
  return fixture;
}

async function resumeIntake(id: string, query = ''): Promise<ComponentFixture<IntakePage>> {
  await TestBed.inject(Router).navigateByUrl(`/assistance-requests/${id}/edit${query}`);
  const fixture = TestBed.createComponent(IntakePage);
  fixture.componentRef.setInput('id', id);
  await fixture.whenStable();
  return fixture;
}

async function openAssessment(
  id: string,
  role: StaffRole = 'social-worker',
  requests: Type<unknown> = MockAssistanceRequestRepository,
): Promise<ComponentFixture<AssessmentPage>> {
  await configure(role, 'staff-sw-1', requests);
  await TestBed.inject(Router).navigateByUrl(`/assistance-requests/${id}`);
  const fixture = TestBed.createComponent(AssessmentPage);
  fixture.componentRef.setInput('id', id);
  await fixture.whenStable();
  return fixture;
}

async function openList(
  role: StaffRole = 'intake-officer',
): Promise<ComponentFixture<RequestListPage>> {
  await configure(role);
  await TestBed.inject(Router).navigateByUrl('/assistance-requests');
  const fixture = TestBed.createComponent(RequestListPage);
  await fixture.whenStable();
  return fixture;
}

const html = (fixture: ComponentFixture<unknown>) => fixture.nativeElement as HTMLElement;

/* ── The URL is the filter ────────────────────────────────────────────────── */

describe('the request list filter lives in the URL', () => {
  const params = (values: Record<string, string>) => ({
    get: (name: string) => values[name] ?? null,
  });

  it('reads a filter back out of query parameters', () => {
    const query = readRequestQuery(params({ q: 'medical', status: 'endorsed', open: 'true' }));
    expect(query.filter).toEqual({ search: 'medical', status: 'endorsed', openOnly: true });
  });

  it('degrades junk rather than failing', () => {
    expect(readRequestQuery(params({ status: 'pondering' })).filter).toEqual({});
  });

  it('keeps the filter and nothing else — the server orders and pages the list (DL-36)', () => {
    expect(readRequestQuery(params({ page: '2', sort: 'status', direction: 'asc' }))).toEqual({
      filter: {},
    });
  });

  it('never filters the table to drafts, which are read above it', () => {
    expect(readRequestQuery(params({ status: 'draft' })).filter).toEqual({});
  });
});

/* ── Drafts are not requests ──────────────────────────────────────────────── */

describe('the request list', () => {
  it('holds unfinished intakes apart from the office’s workload', async () => {
    const element = html(await openList());
    const drafts = element.querySelector('.drafts');
    expect(drafts?.textContent).toContain('A draft is not a request');
    expect(drafts?.textContent).toContain('nobody has been given a control number');
  });

  it('offers a way to start an intake', async () => {
    const element = html(await openList());
    const start = element.querySelector<HTMLAnchorElement>('.btn--primary');
    expect(start?.getAttribute('href')).toBe('/assistance-requests/new');
  });

  it('offers no intake to a role that cannot file one, rather than a link that bounces', async () => {
    const element = html(await openList('auditor'));
    expect(element.querySelector('a[href="/assistance-requests/new"]')).toBeNull();
  });

  it('says how many are shown, never a page count', async () => {
    const element = html(await openList());
    const hint = element.querySelector('.requests__more [role="status"]');
    expect(hint?.textContent).toMatch(/\d+ shown\./);
    expect(element.textContent).not.toMatch(/page \d+ of \d+/i);
  });

  it('says a protected request’s reason is withheld, never a blank', async () => {
    // The intake officer is not cleared for protected records; req-0006 is a VAWC survivor's.
    const element = html(await openList('intake-officer'));
    expect(element.querySelector('app-data-table')?.textContent).toContain(
      'Withheld — protected record',
    );
  });

  it('searches control numbers only, and says so', async () => {
    const element = html(await openList());
    const search = element.querySelector<HTMLInputElement>('input[type="search"]');
    expect(search?.placeholder).toContain('control number');
    expect(element.textContent).toContain('never what a request is for');
  });
});

/* ── One page, four steps ─────────────────────────────────────────────────── */

describe('the intake flow', () => {
  it('shows four steps and says which one you are on', async () => {
    const element = html(await openIntake());
    expect(element.querySelectorAll('.stepper__button').length).toBe(4);
    expect(element.querySelector('.stepper__position')?.textContent).toContain('Step 1 of 4');
  });

  it('marks the current step for a screen reader, not only by shading', async () => {
    const element = html(
      await openIntake('intake-officer', '/assistance-requests/new?step=checks'),
    );
    const current = element.querySelector('.stepper__button[aria-current="step"]');
    expect(current?.textContent).toContain('Checks');
  });

  it('starts on the person step, and degrades an unknown step to it', async () => {
    const element = html(
      await openIntake('intake-officer', '/assistance-requests/new?step=nowhere'),
    );
    expect(element.querySelector('#person-heading')).not.toBeNull();
  });

  it('keeps the context panel outside the steps, so it never has to be retyped', async () => {
    // The same panel is present on the checks step as on the first one.
    const element = html(
      await openIntake('intake-officer', '/assistance-requests/new?step=checks'),
    );
    expect(element.querySelector('#context-heading')).not.toBeNull();
  });

  it('tells the encoder what is still outstanding, per step', async () => {
    const element = html(
      await openIntake('intake-officer', '/assistance-requests/new?step=review'),
    );
    const outstanding = element.querySelector('.intake__problems');
    expect(outstanding?.textContent).toContain('Choose the person this request is for');
    expect(outstanding?.textContent).toContain('Choose the programme');
  });

  it('offers the three channels a counter uses and withholds the online one', async () => {
    const element = html(
      await openIntake('intake-officer', '/assistance-requests/new?step=request'),
    );
    const options = [...element.querySelectorAll('select option')].map((o) =>
      o.textContent?.trim(),
    );
    expect(options).toContain('Walk-in');
    expect(options).toContain('Barangay referral');
    expect(options).not.toContain('Online submission');
    // And says why, rather than leaving a gap the reader has to wonder about.
    expect(element.textContent).toContain('cannot be selected here');
  });

  it('says the duplicate check decides nothing', async () => {
    const element = html(
      await openIntake('intake-officer', '/assistance-requests/new?step=checks'),
    );
    expect(element.querySelector('.advisory__statement')?.textContent).toContain(
      'does not approve, refuse, score or rank anybody',
    );
  });

  it('does not disable the file button on the strength of the check', async () => {
    // The button is gated on the draft being complete, never on a signal
    // (DL-60). `tools/check-intake.mjs` asserts the same thing structurally.
    const element = html(
      await openIntake('intake-officer', '/assistance-requests/new?step=review'),
    );
    const buttons = [...element.querySelectorAll('button')].filter((button) =>
      button.textContent?.includes('File the request'),
    );
    expect(buttons.length).toBe(1);
  });

  it('restores how the request reached the office when a draft is resumed', async () => {
    // It used to reset to a walk-in, and a server that keeps what it is sent would have kept that.
    await configure('intake-officer');
    const saved = await firstValueFrom(
      TestBed.inject(ASSISTANCE_REQUEST_REPOSITORY).saveDraft(
        {
          ...EMPTY_INTAKE_DRAFT,
          residentId: asId<ResidentId>('res-0006'),
          channel: 'barangay-referral',
          referredBy: 'Brgy. Dolores — Kagawad Santos',
          reasonForRequest: 'Burial costs for a deceased parent',
        },
        null,
      ),
    );
    const element = html(await resumeIntake(saved.id, '?step=review'));
    expect(element.textContent).toContain('Brgy. Dolores — Kagawad Santos');
    expect(element.querySelector('.review')?.textContent).toContain('Barangay referral');
  });

  it('says a protected draft is withheld instead of offering a form the server would refuse', async () => {
    // The intake officer is not cleared for protected records; res-0005 is a VAWC survivor.
    await configure('intake-officer');
    const saved = await firstValueFrom(
      TestBed.inject(ASSISTANCE_REQUEST_REPOSITORY).saveDraft(
        {
          ...EMPTY_INTAKE_DRAFT,
          residentId: asId<ResidentId>('res-0005'),
          reasonForRequest: 'Support while the protection order is processed',
        },
        null,
      ),
    );
    expect(saved.withheld.length).toBeGreaterThan(0);

    const element = html(await resumeIntake(saved.id));
    expect(element.querySelector('#withheld-heading')).not.toBeNull();
    expect(element.textContent).toContain('A colleague cleared for protected records');
    const save = [...element.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Save and finish later'),
    );
    expect(save).toBeUndefined();
  });

  it('puts the refusal on the screen in the record’s own words', async () => {
    await configure('intake-officer');
    const requests = TestBed.inject(ASSISTANCE_REQUEST_REPOSITORY);
    const saved = await firstValueFrom(
      requests.saveDraft(
        {
          ...EMPTY_INTAKE_DRAFT,
          residentId: asId<ResidentId>('res-0006'),
          programId: asId<ProgramId>('prog-aics-burial'),
          reasonForRequest: 'Burial costs for a deceased parent',
        },
        null,
      ),
    );
    const fixture = await resumeIntake(saved.id, '?step=review');
    // Filed by a colleague while this screen was open: saving over it is now refused.
    await firstValueFrom(requests.submitIntake(saved.id, null));

    const save = [...html(fixture).querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.includes('Save and finish later'),
    );
    save?.click();
    await fixture.whenStable();
    expect(html(fixture).querySelector('.intake__refusal')?.textContent).toContain(
      'already been filed',
    );
  });
});

/* ── The duplicate check names what it could not read ─────────────────────── */

describe('the advisory panel', () => {
  it('renders every source the check could not read, beside the signals', async () => {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(AdvisoryPanel);
    fixture.componentRef.setInput('advisory', {
      ...EMPTY_ADVISORY,
      computedAt: asIsoDateTime('2026-11-06T00:00:00.000Z'),
      unread: [
        { source: 'releases', because: 'Payouts are not held by this system yet.' },
        { source: 'cases', because: 'Cases are not held by this system yet.' },
      ],
    });
    await fixture.whenStable();
    const element = html(fixture);
    const unread = element.querySelector('.advisory__unread');
    expect(unread?.getAttribute('role')).toBe('note');
    expect(unread?.textContent).toContain('Payouts are not held by this system yet.');
    expect(unread?.textContent).toContain('Cases are not held by this system yet.');
    // Ran and found nothing in what it read — not "choose a person", which is the empty check.
    expect(element.querySelector('.advisory__clear')?.textContent).toContain('Nothing found');
  });

  it('says a check has not run yet only for the empty advisory', async () => {
    TestBed.resetTestingModule();
    const fixture = TestBed.createComponent(AdvisoryPanel);
    fixture.componentRef.setInput('advisory', EMPTY_ADVISORY);
    await fixture.whenStable();
    expect(html(fixture).querySelector('.advisory__clear')?.textContent).toContain(
      'Choose a person',
    );
    expect(html(fixture).querySelector('.advisory__unread')).toBeNull();
  });
});

/* ── The assessment workspace ─────────────────────────────────────────────── */

describe('the assessment workspace', () => {
  it('shows the applicant’s picture beside the request, read fresh', async () => {
    const element = html(await openAssessment(ENDORSED));
    expect(element.querySelector('#applicant-heading')).not.toBeNull();
    expect(element.textContent).toContain('Mercado');
    expect(element.textContent).toContain('TAY-2026-000841');
  });

  it('states that a recommendation is not an approval', async () => {
    const element = html(await openAssessment(ENDORSED));
    expect(element.textContent).toContain('A recommendation is not an approval');
  });

  it('lists what is outstanding and says plainly that none of it blocks', async () => {
    const element = html(await openAssessment(ENDORSED));
    const readiness = element.querySelector('#readiness-heading')?.parentElement;
    expect(readiness?.textContent).toContain('None of them stops you');
  });

  it('reuses the shared transition control, so the reason is captured', async () => {
    const fixture = await openAssessment(ENDORSED);
    const element = html(fixture);
    expect(element.querySelector('.transition')).not.toBeNull();

    const button = element.querySelector<HTMLButtonElement>('.transition__actions .btn');
    expect(button?.disabled).toBe(true);
  });

  it('does not offer a move the role cannot make', async () => {
    // A social worker endorses; approving belongs to the head (DL-08).
    const element = html(await openAssessment(ENDORSED));
    const options = [...element.querySelectorAll('.transition__select option')].map((option) =>
      option.textContent?.trim(),
    );
    expect(options).not.toContain('Approved');
  });

  it('hides the case-study form from a role that cannot assess', async () => {
    const element = html(await openAssessment(ENDORSED, 'intake-officer'));
    expect(element.querySelector('#study-heading')).toBeNull();
    // …but still shows the request and the advisory.
    expect(element.querySelector('#request-heading')).not.toBeNull();
  });

  it('says so plainly when the request is not available', async () => {
    const element = html(await openAssessment('req-nope'));
    expect(element.textContent).toContain('That request is not available');
  });

  it('lists every move with its reason, oldest first', async () => {
    const element = html(await openAssessment(ENDORSED));
    const history = element.querySelector('#history-heading')?.parentElement;
    const moves = [...(history?.querySelectorAll('.history__move') ?? [])].map((node) =>
      node.textContent?.trim(),
    );
    expect(moves.length).toBeGreaterThan(0);
    expect(moves.at(-1)).toContain('Endorsed');
  });

  it('says a protected request’s words are withheld, never a blank', async () => {
    // req-0006 is a VAWC survivor's; the intake officer is not cleared for protected records.
    const element = html(await openAssessment('req-0006', 'intake-officer'));
    const facts = element.querySelector('#request-heading')?.parentElement;
    expect(facts?.textContent).toContain('Withheld — protected record');
    expect(facts?.textContent).toContain('under a protected sector');
    const history = element.querySelector('#history-heading')?.parentElement;
    expect(history?.querySelector('.history__reason')?.textContent).toContain('Withheld');
  });

  it('does not ask for the duplicate check on behalf of a role that does not file', async () => {
    const element = html(await openAssessment(ENDORSED, 'auditor'));
    expect(element.querySelector('app-advisory-panel')).toBeNull();
    expect(element.textContent).toContain('read by the staff who file requests');
  });
});

/* ── Phase 2b not connected: said in place, and nothing else breaks (DL-177) ── */

const NOT_YET = 'a request’s assessment or the review of its documents yet';

/** The served port with its phase 2b reads unserved, as the http adapter answers them. */
class PhaseTwoBNotConnected extends MockAssistanceRequestRepository {
  override listAssessmentTemplates(): Observable<never> {
    return unserved(NOT_YET);
  }

  override listDocumentRequests(): Observable<never> {
    return unserved(NOT_YET);
  }
}

describe('the request record where the assessment is not connected yet', () => {
  it('says so in place of the case study, and offers no form whose save goes nowhere', async () => {
    const element = html(await openAssessment(ENDORSED, 'social-worker', PhaseTwoBNotConnected));
    const study = element.querySelector('#study-heading')?.parentElement;
    expect(study?.querySelector('[role="note"]')?.textContent).toContain(NOT_YET);
    expect(study?.querySelector('textarea')).toBeNull();
    expect(element.textContent).not.toContain('Save the case study');
  });

  it('says so once in the documents, and offers none of the acts on them', async () => {
    const element = html(await openAssessment(ENDORSED, 'social-worker', PhaseTwoBNotConnected));
    const documents = element.querySelector('#documents-heading')?.parentElement;
    expect(documents?.querySelector('.assessment__notconnected')?.textContent).toContain(NOT_YET);
    // The checklist itself is the request's, and still read.
    expect(documents?.querySelectorAll('.documents__item').length).toBeGreaterThan(0);
    expect(documents?.querySelector('app-document-panel')).toBeNull();
    const buttons = [...(documents?.querySelectorAll('button') ?? [])].map((button) =>
      button.textContent?.trim(),
    );
    expect(buttons).not.toContain('Verify');
  });

  it('still shows the request, its history, the check and the move', async () => {
    const element = html(await openAssessment(ENDORSED, 'social-worker', PhaseTwoBNotConnected));
    expect(element.textContent).toContain('TAY-2026-000841');
    expect(element.querySelector('#history-heading')).not.toBeNull();
    expect(element.querySelector('app-advisory-panel')).not.toBeNull();
    expect(element.querySelector('.transition')).not.toBeNull();
  });
});

/* ── Documents and verification (TAB 14) ──────────────────────────────────── */

describe('the document checklist', () => {
  it('shows the version history rather than only the current file', async () => {
    // req-0001's indigency certificate was replaced once. A reader who cannot
    // see that will read the current copy as the only one there has ever been.
    const element = html(await openAssessment(ENDORSED));
    expect(element.textContent).toContain('1 earlier version, kept on file');
    expect(element.textContent).toContain('household size corrected from 4 to 6');
  });

  it('masks a document number rather than printing it', async () => {
    const element = html(await openAssessment(ENDORSED));
    const text = element.textContent ?? '';

    expect(text).toContain('••••0964');
    // The full numbers seeded on this request must not appear anywhere.
    expect(text).not.toContain('BC-2026-00964');
    expect(text).not.toContain('PN-2019-448271');
  });

  it('counts completion and refuses to call it a decision', async () => {
    const element = html(await openAssessment(ENDORSED));
    expect(element.querySelector('.completion__hint')?.textContent).toContain(
      'eligibility is assessed by a caseworker',
    );
  });

  it('never renders the word complete as a verdict on its own', async () => {
    const element = html(await openAssessment(ENDORSED));
    const counts = element.querySelector('.completion__counts')?.textContent?.trim() ?? '';

    expect(counts).not.toBe('Complete');
    expect(counts.length).toBeGreaterThan(0);
  });

  it('offers no way to open a file to a role without the download grant', async () => {
    // An intake officer records documents but does not pull the scans.
    const element = html(await openAssessment(ENDORSED, 'intake-officer'));
    const labels = [...element.querySelectorAll('button')].map((node) =>
      (node.textContent ?? '').trim(),
    );

    expect(labels).not.toContain('Open document');
  });

  it('offers the open to a social worker, behind a warning', async () => {
    const fixture = await openAssessment(ENDORSED);
    const element = html(fixture);
    const open = [...element.querySelectorAll('button')].find(
      (node) => (node.textContent ?? '').trim() === 'Open document',
    );

    expect(open).toBeDefined();

    open?.click();
    await fixture.whenStable();

    // The warning is shown before anything opens, and names the file.
    // The first requirement on this request is the government ID, so that is
    // the file the first Open button belongs to.
    const modal = html(fixture).querySelector('.access');
    expect(modal?.textContent).toContain('valid-id-mercado.pdf');
    expect(modal?.textContent).toContain('personal information');
  });

  it('marks an expired document expired rather than rejected', async () => {
    const element = html(await openAssessment(ENDORSED));
    const labels = [...element.querySelectorAll('button')].map((node) =>
      (node.textContent ?? '').trim(),
    );

    expect(labels).toContain('Mark expired');
  });
});
