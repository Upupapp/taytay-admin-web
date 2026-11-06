import { Component } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom, of, throwError, type Observable } from 'rxjs';

import { SessionState } from '@core/auth/session-state';
import { SessionStore } from '@core/auth/session.store';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { MockNotificationRepository } from '@data/mock/mock-notification.repository';
import { MockProgramRepository } from '@data/mock/mock-program.repository';
import {
  ACCESS_CONTEXT,
  NOTIFICATION_REPOSITORY,
  PROGRAM_REPOSITORY,
  PROGRAM_UTILIZATION_NOT_CONNECTED,
  STAFF_REPOSITORY,
  asId,
  emptyPage,
  toAuthenticatedUser,
  toProgramDraft,
  type AssistanceProgram,
  type AuthenticatedUser,
  type Page,
  type ProgramDraft,
  type ProgramId,
  type ProgramUtilizationReading,
  type ProgramUtilizationSummary,
  type StaffRepository,
  type StaffRole,
  type StaffUser,
  type StaffUserId,
  type SignInOutcome,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { ProgramDetailPage } from './program-detail-page';
import { ProgramFormPage } from './program-form-page';
import { ProgramListPage, readCatalogQuery } from './program-list-page';
import { PROGRAMS_COPY } from './programs.copy';
import { RequirementTemplatesPage } from './requirement-templates-page';

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

/** The catalogue as the API serves it: programmes read, utilization not (`DL-176`). */
class UnconnectedUtilization extends MockProgramRepository {
  override utilizationFor(): Observable<ProgramUtilizationReading> {
    return of({ kind: 'unavailable', because: PROGRAM_UTILIZATION_NOT_CONNECTED });
  }

  override utilizationSummary(): Observable<ProgramUtilizationSummary> {
    return of({ kind: 'unavailable', because: PROGRAM_UTILIZATION_NOT_CONNECTED });
  }
}

async function configure(
  role: StaffRole,
  programs: typeof MockProgramRepository = MockProgramRepository,
): Promise<void> {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: 'programs', component: ProgramListPage },
        { path: 'programs/new', component: ProgramFormPage },
        { path: 'programs/templates', component: RequirementTemplatesPage },
        { path: 'programs/:id', component: ProgramDetailPage },
        { path: '**', component: StubPage },
      ]),
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useExisting: SessionState },
      { provide: STAFF_REPOSITORY, useValue: staffRepository(staffUser(role)) },
      { provide: PROGRAM_REPOSITORY, useClass: programs },
      { provide: NOTIFICATION_REPOSITORY, useClass: MockNotificationRepository },
    ],
  });
  await firstValueFrom(TestBed.inject(SessionStore).load());
}

async function openList(
  role: StaffRole = 'mswdo-head',
  programs: typeof MockProgramRepository = MockProgramRepository,
): Promise<ComponentFixture<ProgramListPage>> {
  await configure(role, programs);
  await TestBed.inject(Router).navigateByUrl('/programs');
  const fixture = TestBed.createComponent(ProgramListPage);
  await fixture.whenStable();
  return fixture;
}

async function openDetail(
  id: string,
  role: StaffRole = 'mswdo-head',
  programs: typeof MockProgramRepository = MockProgramRepository,
): Promise<ComponentFixture<ProgramDetailPage>> {
  await configure(role, programs);
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
          'Recorded as ours.',
        ),
      ),
    ).rejects.toThrow(/cannot be saved/);
  });

  it('accepts an honest edit', async () => {
    await configure('mswdo-head');
    const program = await firstValueFrom(repo().getById(asId<ProgramId>(AICS_MEDICAL)));
    const draft = toProgramDraft(program!);
    const saved = await firstValueFrom(
      repo().save(
        { ...draft, description: 'Updated wording.' },
        asId<ProgramId>(AICS_MEDICAL),
        'The description was out of date.',
      ),
    );
    expect(saved.description).toBe('Updated wording.');
    expect(saved.responsibility.administeredBy).toBe('dswd');
  });

  it('refuses a save from a role that may not manage the catalog', async () => {
    await configure('intake-officer');
    const program = await firstValueFrom(repo().getById(asId<ProgramId>(AICS_MEDICAL)));
    await expect(
      firstValueFrom(
        repo().save(toProgramDraft(program!), asId<ProgramId>(AICS_MEDICAL), 'A change.'),
      ),
    ).rejects.toThrow();
  });

  it('reports utilization for the programme it was asked about', async () => {
    await configure('mswdo-head');
    const usage = await firstValueFrom(repo().utilizationFor(asId<ProgramId>(AICS_MEDICAL)));

    const read = usage.kind === 'read' ? usage.utilization : null;
    expect(read?.programId).toBe(AICS_MEDICAL);
    expect(read?.isWithheld).toBe(false);
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

    const rows = summary.kind === 'read' ? summary.rows : [];
    expect(rows.some((row) => (row.releaseCount ?? 0) > 0)).toBe(true);
  });
});

/* ── Utilization the API cannot count (`DL-176`) ─────────────────────────── */

describe('where releases are not served, utilization says so and shows no figure', () => {
  it('drops the two utilization columns from the list and says why above it', async () => {
    const fixture = await openList('mswdo-head', UnconnectedUtilization);
    const element = html(fixture);
    expect(element.textContent).toContain('not connected yet');
    expect(element.textContent).toContain('not a statement that the programme was never used');
    const headers = [...element.querySelectorAll('th')].map((cell) => cell.textContent?.trim());
    expect(headers).not.toContain('Releases');
    expect(headers).not.toContain('Handed over');
    // The catalogue itself is still read.
    expect(element.textContent).toContain('Medical Assistance');
  });

  it('shows the sentence on the record in place of the figures, and no zero', async () => {
    const element = html(await openDetail(AICS_MEDICAL, 'mswdo-head', UnconnectedUtilization));
    const usage = element.querySelector('[aria-labelledby="usage-heading"]');
    expect(usage?.textContent).toContain(PROGRAM_UTILIZATION_NOT_CONNECTED);
    expect(usage?.querySelector('dl')).toBeNull();
    expect(usage?.textContent).not.toContain('Nothing has been handed over');
  });
});

/* ── The list is read a cursor page at a time ─────────────────────────────── */

describe('the catalogue pages as the office record does', () => {
  it('answers by name, one page at a time, and follows its cursor to the end', async () => {
    await configure('mswdo-head');
    const first = await firstValueFrom(repo().list({}, { limit: 2, cursor: null }));
    expect(first.items).toHaveLength(2);
    expect(first.hasMore).toBe(true);
    const names = first.items.map((program) => program.name.toLowerCase());
    expect([...names].sort()).toEqual(names);
    const rest = await firstValueFrom(repo().list({}, { limit: 50, cursor: first.nextCursor }));
    expect(rest.items.some((program) => first.items.includes(program))).toBe(false);
    expect(rest.hasMore).toBe(false);
    expect(rest.nextCursor).toBeNull();
  });

  it('says how many are shown, never a page count', async () => {
    const text = html(await openList()).textContent ?? '';
    expect(text).toMatch(/\d+ shown\./);
    expect(text).not.toMatch(/page \d+ of/i);
  });
});

/* ── Writing the catalogue, with a reason (`DL-177`) ───────────────────────── */

type Control = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

/** The control a visible label names — the `index`th one, where a label repeats. */
function control(root: HTMLElement, label: string, index = 0): Control {
  const labels = [...root.querySelectorAll('label')].filter(
    (entry) => entry.querySelector('.field__label')?.textContent?.trim() === label,
  );
  const found = labels[index]?.querySelector<Control>('input, textarea, select');
  if (!found) {
    throw new Error(`No control labelled “${label}”.`);
  }
  return found;
}

function enter(target: Control, value: string): void {
  target.value = value;
  target.dispatchEvent(new Event(target instanceof HTMLSelectElement ? 'change' : 'input'));
}

function press(root: HTMLElement, text: string, index = 0): void {
  const button = [...root.querySelectorAll('button')].filter(
    (entry) => entry.textContent?.trim() === text,
  )[index];
  if (!button) {
    throw new Error(`No button “${text}”.`);
  }
  button.click();
}

async function openForm(
  programs: typeof MockProgramRepository = MockProgramRepository,
): Promise<ComponentFixture<ProgramFormPage>> {
  await configure('mswdo-head', programs);
  await TestBed.inject(Router).navigateByUrl('/programs/new');
  const fixture = TestBed.createComponent(ProgramFormPage);
  await fixture.whenStable();
  return fixture;
}

async function openTemplates(): Promise<ComponentFixture<RequirementTemplatesPage>> {
  await configure('mswdo-head');
  await TestBed.inject(Router).navigateByUrl('/programs/templates');
  const fixture = TestBed.createComponent(RequirementTemplatesPage);
  await fixture.whenStable();
  return fixture;
}

/** A municipal programme every rule accepts, typed into the form. */
async function fillHonestProgramme(fixture: ComponentFixture<ProgramFormPage>): Promise<void> {
  const root = html(fixture);
  enter(control(root, 'Name'), 'Barangay Health Volunteers Stipend');
  enter(control(root, 'Funding source'), 'Municipal general fund');
  enter(control(root, 'Maximum grant (₱)'), '1,500.50');
  enter(
    control(root, 'What staff may tell an applicant'),
    'The municipality decides and pays this stipend.',
  );
  press(root, 'Add a guideline');
  await fixture.whenStable();
  enter(control(root, 'What the office looks for'), 'An active volunteer for six months.');
  enter(control(root, 'The issuance, ordinance or convention'), 'Office practice');
  press(root, 'Add a document');
  await fixture.whenStable();
  enter(control(root, 'Code'), 'volunteer-certification');
  enter(control(root, 'Document'), 'Certification from the barangay health station');
  await fixture.whenStable();
}

describe('a new programme is recorded whole, and refused while any rule stands', () => {
  it('refuses a DSWD programme recorded as the municipality’s, and says so before the button', async () => {
    const fixture = await openForm();
    const root = html(fixture);
    const save = vi.spyOn(repo(), 'save');
    enter(control(root, 'Name'), 'AICS referral');
    enter(control(root, 'Funding source'), 'DSWD field office');
    enter(control(root, 'Administered by'), 'dswd');
    enter(
      control(root, 'What staff may tell an applicant'),
      'DSWD decides; we refer the applicant.',
    );
    enter(control(root, 'Why — kept with this version'), 'Recording the referral route.');
    await fixture.whenStable();

    const text = root.textContent ?? '';
    expect(text).toContain(PROGRAMS_COPY.detail.ownerWarning);
    expect(text).toContain(PROGRAMS_COPY.problem['national-programme-claimed-as-owned']);
    expect(text).toContain(PROGRAMS_COPY.problem['claim-without-source']);

    press(root, 'Record the programme');
    await fixture.whenStable();
    expect(save).not.toHaveBeenCalled();
  });

  it('records a programme with a reason, in centavos, and opens it', async () => {
    const fixture = await openForm();
    const root = html(fixture);
    await fillHonestProgramme(fixture);
    enter(control(root, 'Start from a requirement template'), 'municipal-standard');
    enter(control(root, 'Why — kept with this version'), 'Approved in the 2026 budget.');
    await fixture.whenStable();
    // What saving does is said above the button, not after it (DL-124).
    expect(root.textContent).toContain(PROGRAMS_COPY.detail.keptForever);
    expect(root.textContent).toContain('Municipal programme set');

    const save = vi.spyOn(repo(), 'save');
    press(root, 'Record the programme');
    await fixture.whenStable();

    expect(save).toHaveBeenCalledTimes(1);
    const [draft, id, reason] = save.mock.calls[0] ?? [];
    expect(id).toBeNull();
    expect(reason).toBe('Approved in the 2026 budget.');
    expect(draft?.maximumGrant).toEqual({ centavos: 150050, currency: 'PHP' });
    expect(draft?.requirementTemplateCode).toBe('municipal-standard');
    expect(TestBed.inject(Router).url).toMatch(/^\/programs\/prog-new-/);
  });

  it('does nothing until a reason is given, and says so', async () => {
    const fixture = await openForm();
    const root = html(fixture);
    await fillHonestProgramme(fixture);
    const save = vi.spyOn(repo(), 'save');
    press(root, 'Record the programme');
    await fixture.whenStable();
    expect(root.textContent).toContain(PROGRAMS_COPY.reason.missing);
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses a conditional document that does not say when it is needed', async () => {
    const fixture = await openForm();
    const root = html(fixture);
    await fillHonestProgramme(fixture);
    enter(control(root, 'Asked for as'), 'conditional');
    await fixture.whenStable();
    expect(root.textContent).toContain(PROGRAMS_COPY.problem['condition-without-circumstances']);
    enter(control(root, 'Needed when'), 'When the volunteer moved barangays this year.');
    await fixture.whenStable();
    expect(root.textContent).not.toContain(
      PROGRAMS_COPY.problem['condition-without-circumstances'],
    );
  });

  it('offers no retired template', async () => {
    await configure('mswdo-head');
    await firstValueFrom(repo().retireTemplate('aics-standard', 'Superseded.'));
    await TestBed.inject(Router).navigateByUrl('/programs/new');
    const fixture = TestBed.createComponent(ProgramFormPage);
    await fixture.whenStable();
    const options = [
      ...control(html(fixture), 'Start from a requirement template').querySelectorAll('option'),
    ].map((option) => option.textContent?.trim());
    expect(options).toContain('Municipal programme set');
    expect(options).not.toContain('AICS standard set');
  });

  it('shows the server’s refusal in its own words', async () => {
    const fixture = await openForm(ServerRefuses);
    const root = html(fixture);
    await fillHonestProgramme(fixture);
    enter(control(root, 'Why — kept with this version'), 'Approved in the 2026 budget.');
    press(root, 'Record the programme');
    await fixture.whenStable();
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(SERVER_SENTENCE);
  });
});

const SERVER_SENTENCE = 'A requirement template that is retired cannot be adopted.';

/** The API's refusal, as the error interceptor hands it on. */
class ServerRefuses extends MockProgramRepository {
  override save(): Observable<AssistanceProgram> {
    return throwError(() => ({
      code: 'VALIDATION_FAILED',
      status: 422,
      message: 'That programme entry cannot be saved as it stands.',
      details: { requirement_template_code: [SERVER_SENTENCE] },
      requestId: 'req-1',
      retryAfterSeconds: null,
    }));
  }
}

describe('a change to a programme says why', () => {
  it('asks for a reason before the button acts, and sends it with the change', async () => {
    const fixture = await openDetail(AICS_MEDICAL);
    const root = html(fixture);
    press(root, 'Edit this programme');
    await fixture.whenStable();
    expect(root.textContent).toContain(PROGRAMS_COPY.detail.keptForever);

    const save = vi.spyOn(repo(), 'save');
    press(root, 'Save the programme');
    await fixture.whenStable();
    expect(root.textContent).toContain(PROGRAMS_COPY.reason.missing);
    expect(save).not.toHaveBeenCalled();

    enter(control(root, 'Why — kept with this version'), 'The DSWD ceiling changed.');
    press(root, 'Save the programme');
    await fixture.whenStable();
    expect(save.mock.calls[0]?.[2]).toBe('The DSWD ceiling changed.');
  });

  it('says that closing dates the end before it is saved', async () => {
    const fixture = await openDetail(EDUCATIONAL);
    const root = html(fixture);
    press(root, 'Edit this programme');
    await fixture.whenStable();
    expect(root.textContent).not.toContain(PROGRAMS_COPY.detail.closing);
    enter(control(root, 'Status'), 'closed');
    await fixture.whenStable();
    expect(root.textContent).toContain(PROGRAMS_COPY.detail.closing);
  });
});

describe('the catalogue’s list offers the writes only to those who may make them', () => {
  it('links the new-programme form and the templates for a manager', async () => {
    const text = html(await openList()).textContent ?? '';
    expect(text).toContain('New programme');
    expect(text).toContain('Requirement templates');
  });

  it('offers neither to a role that may only read the catalogue', async () => {
    const text = html(await openList('intake-officer')).textContent ?? '';
    expect(text).not.toContain('New programme');
    expect(text).not.toContain('Requirement templates');
  });
});

describe('the requirement-template editor', () => {
  it('lists every template with its status and how many programmes name it', async () => {
    const text = html(await openTemplates()).textContent ?? '';
    expect(text).toContain('AICS standard set');
    expect(text).toContain('2 programmes not closed');
    expect(text).toContain('5 programmes not closed');
    expect(text).toContain('In use');
  });

  it('says what a change reaches before the button, and asks why first', async () => {
    const fixture = await openTemplates();
    const root = html(fixture);
    press(root, 'Change', 0);
    await fixture.whenStable();
    const consequence = [...root.querySelectorAll('li')].find((item) =>
      item.textContent?.includes('reaches the 2 programmes'),
    );
    const button = [...root.querySelectorAll('button')].find(
      (entry) => entry.textContent?.trim() === 'Save the change',
    );
    expect(consequence).toBeDefined();
    expect(button).toBeDefined();
    if (consequence && button) {
      // Said before the button, not after it (DL-124).
      expect(
        consequence.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }

    const save = vi.spyOn(repo(), 'saveTemplate');
    press(root, 'Save the change');
    await fixture.whenStable();
    expect(root.textContent).toContain(PROGRAMS_COPY.reason.missing);
    expect(save).not.toHaveBeenCalled();

    enter(control(root, 'Why — kept with this version'), 'The ID may be any government ID.');
    press(root, 'Save the change');
    await fixture.whenStable();
    expect(save).toHaveBeenCalledTimes(1);
    expect(save.mock.calls[0]?.[1]).toBe('aics-standard');
  });

  it('records a new template, refusing a conditional document without its circumstances', async () => {
    const fixture = await openTemplates();
    const root = html(fixture);
    press(root, 'New template');
    await fixture.whenStable();
    enter(control(root, 'Code', 0), 'medical-set');
    enter(control(root, 'Name'), 'Medical documents');
    press(root, 'Add a document');
    await fixture.whenStable();
    enter(control(root, 'Code', 1), 'medical-abstract');
    enter(control(root, 'Document'), 'Medical abstract');
    enter(control(root, 'Asked for as'), 'conditional');
    enter(control(root, 'Why — kept with this version'), 'A set for the medical window.');
    await fixture.whenStable();
    expect(root.textContent).toContain(PROGRAMS_COPY.problem['condition-without-circumstances']);
    expect(root.textContent).toContain('Programmes will name it “medical-set”');

    const save = vi.spyOn(repo(), 'saveTemplate');
    press(root, 'Record the template');
    await fixture.whenStable();
    expect(save).not.toHaveBeenCalled();

    enter(control(root, 'Needed when'), 'When the patient is confined.');
    press(root, 'Record the template');
    await fixture.whenStable();
    expect(save).toHaveBeenCalledTimes(1);
    expect(root.textContent).toContain('Medical documents');
  });

  it('retires one way, saying first that programmes naming it keep its documents', async () => {
    const fixture = await openTemplates();
    const root = html(fixture);
    press(root, 'Retire', 0);
    await fixture.whenStable();
    expect(root.textContent).toContain(PROGRAMS_COPY.templates.retireOneWay);
    expect(root.textContent).toContain('The 2 programmes that already name it keep asking');

    enter(control(root, 'Why — kept with this version'), 'Superseded by the 2026 set.');
    press(root, 'Retire the template');
    await fixture.whenStable();
    await fixture.whenStable();
    expect(root.textContent).toContain('Retired');
    expect(
      [...root.querySelectorAll('button')].filter((b) => b.textContent?.trim() === 'Retire'),
    ).toHaveLength(1);
  });
});

describe('the mock holds the catalogue to the server’s rules', () => {
  async function aics(): Promise<ProgramDraft> {
    const program = await firstValueFrom(repo().getById(asId<ProgramId>(AICS_MEDICAL)));
    if (program === null) {
      throw new Error('The AICS sample is missing.');
    }
    return toProgramDraft(program);
  }

  it('refuses a change without a reason', async () => {
    await configure('mswdo-head');
    const draft = await aics();
    await expect(
      firstValueFrom(repo().save(draft, asId<ProgramId>(AICS_MEDICAL), '   ')),
    ).rejects.toThrow(/Say why/);
  });

  it('lets no new programme adopt a retired template, and lets one already naming it keep it', async () => {
    await configure('mswdo-head');
    await firstValueFrom(repo().retireTemplate('aics-standard', 'Superseded.'));
    const draft = await aics();
    await expect(
      firstValueFrom(repo().save({ ...draft, name: 'A second AICS window' }, null, 'New.')),
    ).rejects.toThrow(/retired/);
    const kept = await firstValueFrom(
      repo().save(draft, asId<ProgramId>(AICS_MEDICAL), 'Wording only.'),
    );
    expect(kept.requirementTemplateCode).toBe('aics-standard');
  });

  it('dates the end of a closed programme and clears it when it is moved back', async () => {
    await configure('mswdo-head');
    const draft = await aics();
    const id = asId<ProgramId>(AICS_MEDICAL);
    const closed = await firstValueFrom(repo().save({ ...draft, status: 'closed' }, id, 'Ended.'));
    expect(closed.effectiveTo).not.toBeNull();
    const reopened = await firstValueFrom(
      repo().save({ ...draft, status: 'active' }, id, 'Funds arrived.'),
    );
    expect(reopened.effectiveTo).toBeNull();
  });

  it('never reuses a code, refuses a document problem, and does not change a retired template', async () => {
    await configure('mswdo-head');
    const requirement = {
      code: 'valid-id',
      label: 'Valid ID',
      obligation: 'required' as const,
      appliesWhen: null,
      notes: null,
    };
    const draft = {
      code: 'aics-standard',
      name: 'Again',
      description: '',
      requirements: [requirement],
    };
    await expect(firstValueFrom(repo().saveTemplate(draft, null, 'Again.'))).rejects.toThrow(
      /never reused/,
    );
    await expect(
      firstValueFrom(
        repo().saveTemplate(
          {
            ...draft,
            code: 'conditional-set',
            requirements: [{ ...requirement, obligation: 'conditional' }],
          },
          null,
          'Conditional.',
        ),
      ),
    ).rejects.toThrow(/cannot be saved/);

    const retired = await firstValueFrom(repo().retireTemplate('aics-standard', 'Superseded.'));
    expect(retired.status).toBe('retired');
    expect(retired.programCount).toBe(2);
    // Once is enough: retiring again answers the template as it stands.
    const again = await firstValueFrom(repo().retireTemplate('aics-standard', 'Twice.'));
    expect(again.retiredAt).toBe(retired.retiredAt);
    await expect(
      firstValueFrom(repo().saveTemplate(draft, 'aics-standard', 'A change.')),
    ).rejects.toThrow(/not changed/);
  });

  it('refuses every template write from a role that may only read the catalogue', async () => {
    await configure('intake-officer');
    await expect(
      firstValueFrom(repo().retireTemplate('aics-standard', 'Not mine to retire.')),
    ).rejects.toThrow();
  });
});
