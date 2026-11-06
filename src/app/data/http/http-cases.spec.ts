import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import { readApiError } from '@core/http/api-failure';
import { apiHeadersInterceptor } from '@core/http/api.interceptors';
import {
  asId,
  asIsoDate,
  type AssistanceRequestId,
  type BarangayId,
  type CaseId,
  type CaseRepository,
  type CaseTaskId,
  type ResidentId,
  type StaffUserId,
} from '@domain/index';

import OFFICE_CASE from './fixtures/office-case.json';
import OFFICE_CASE_ASSIGNEES from './fixtures/office-case-assignees.json';
import OFFICE_CASE_CASELOAD from './fixtures/office-case-caseload.json';
import OFFICE_CASE_CLOSED_REFUSAL from './fixtures/office-case-closed-refusal.json';
import OFFICE_CASE_QUEUE_COUNTS from './fixtures/office-case-queue-counts.json';
import OFFICE_CASES_PAGE from './fixtures/office-cases-page.json';
import OFFICE_HOUSEHOLD from './fixtures/office-household.json';
import OFFICE_RESIDENT_FAMILIES from './fixtures/office-resident-families.json';
import { HttpCaseRepository } from './http-repositories';

const BASE = 'https://api.example.gov.ph/api/v1';
const CASES = `${BASE}/office/cases`;
const DOLORES_API = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01';
const SAN_JUAN_API = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c04';
const BARANGAYS = {
  data: [
    { id: DOLORES_API, code: 'dolores', name: 'Dolores' },
    { id: SAN_JUAN_API, code: 'san-juan', name: 'San Juan' },
  ],
  meta: {},
};

const CASE_ID = asId<CaseId>(OFFICE_CASE.data.id);
const SUBJECT = OFFICE_CASE.data.subject_resident_id;
const HOUSEHOLD = `${BASE}/office/households/${OFFICE_CASE.data.household_id ?? ''}`;
const FAMILIES = `${BASE}/office/residents/${SUBJECT}/families`;
const CASELOAD_FAMILIES = `${BASE}/office/residents/${OFFICE_CASE_CASELOAD.data.subject_resident_id}/families`;
const SW_1 = asId<StaffUserId>('0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c07');
const TASK = asId<CaseTaskId>('b1c2d3e4-f5a6-4b7c-8d9e-0f1a2b3c4d01');
const REQUEST = asId<AssistanceRequestId>('8f1e2d3c-4b5a-4968-8776-1a2b3c4d5e02');
const REASON = 'Household confirmed displaced by the fire';

/**
 * Cases over the API (casework phase 3, `DL-179`), against fixtures composed from the vendored spec —
 * `fixtures/fixtures.spec.ts` holds each one to its schema.
 */
describe('cases over the API (DL-179)', () => {
  let http: HttpTestingController;
  let cases: CaseRepository;

  const barangays = (): void => {
    http.expectOne({ method: 'GET', url: `${BASE}/barangays` }).flush(BARANGAYS);
  };

  /** The household and the families read beside a case the reader may see them for. */
  const context = (): void => {
    http.expectOne({ method: 'GET', url: HOUSEHOLD }).flush(OFFICE_HOUSEHOLD);
    http.expectOne({ method: 'GET', url: FAMILIES }).flush(OFFICE_RESIDENT_FAMILIES);
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiHeadersInterceptor])),
        provideHttpClientTesting(),
        {
          provide: APP_ENVIRONMENT,
          useValue: { apiBaseUrl: BASE, dataSource: 'http', firebaseWebApiKey: 'test-web-api-key' },
        },
        HttpCaseRepository,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthTokenHolder).hold('fixture-token', null);
    cases = TestBed.inject(HttpCaseRepository);
  });

  afterEach(() => http.verify());

  describe('the list', () => {
    it('reads a cursor page as the server redacted it, with the queue facts derived', async () => {
      const page = firstValueFrom(cases.list({}, { limit: 20, cursor: null }));
      barangays();
      const request = http.expectOne((r) => r.url === CASES);
      expect(request.request.params.keys()).toEqual(['limit']);
      request.flush(OFFICE_CASES_PAGE);

      const answer = await page;
      expect(answer.hasMore).toBe(true);
      expect(answer.nextCursor).toBe(OFFICE_CASES_PAGE.meta.pagination.next_cursor);
      const [protectedOne, plain] = answer.items;

      // What the server held back, said as withheld — and nothing here holds it back again.
      expect(protectedOne?.record.isProtected).toBe(true);
      expect(protectedOne?.record.withheld).toEqual(['summary', 'reasons', 'taskWords', 'notes']);
      expect(protectedOne?.record.summary).toBeNull();
      expect(protectedOne?.nextAction?.title).toBeNull();
      expect(protectedOne?.subject.isProtected).toBe(true);
      // Held by somebody the server has no name for is still held — never "nobody".
      expect(protectedOne?.assignedToName).toBe('A staff account with no name on record');
      expect(protectedOne?.facts.daysUntilNextAction).not.toBeNull();

      expect(plain?.record.referenceNumber).toBe('CASE-2026-000012');
      expect(plain?.record.barangayId).toBe('brgy-dolores');
      expect(plain?.record.linkedRequestIds).toEqual([REQUEST]);
      expect(plain?.nextAction?.assignedToName).toBe('Grace Ocampo');
      expect(plain?.openTaskCount).toBe(1);
      expect(plain?.lastActivityAt).toBe('2026-11-05T03:00:00.000Z');
    });

    it('sends the filter in the server’s words, and never a sort or a page number', async () => {
      const page = firstValueFrom(
        cases.list(
          {
            search: ' 2026-0001 ',
            queue: 'overdue',
            status: 'assessment',
            category: 'crisis-intervention',
            barangayId: asId<BarangayId>('brgy-san-juan'),
            residentId: asId<ResidentId>(SUBJECT),
          },
          { limit: 20, cursor: 'next' },
        ),
      );
      barangays();
      const request = http.expectOne((r) => r.url === CASES);
      const params = request.request.params;
      expect(params.get('q')).toBe('2026-0001');
      expect(params.get('queue')).toBe('overdue');
      expect(params.get('status')).toBe('assessment');
      expect(params.get('category')).toBe('crisis-intervention');
      expect(params.get('barangay_id')).toBe(SAN_JUAN_API);
      expect(params.get('resident_id')).toBe(SUBJECT);
      expect(params.get('cursor')).toBe('next');
      for (const key of ['sort', 'page', 'per_page']) {
        expect(params.has(key)).toBe(false);
      }
      request.flush({ data: [], meta: { pagination: { has_more: false, next_cursor: null } } });
      await expect(page).resolves.toEqual({ items: [], hasMore: false, nextCursor: null });
    });

    it('refuses a one-character search before anything is sent', async () => {
      await expect(firstValueFrom(cases.list({ search: 'C' }, { limit: 20 }))).rejects.toThrow(
        /between 2 and 40/,
      );
    });

    it('counts the queues under the same filters, the queue itself left out', async () => {
      const counts = firstValueFrom(cases.queueCounts({ status: 'assessment', queue: 'mine' }));
      barangays();
      const request = http.expectOne((r) => r.url === `${CASES}/queue-counts`);
      expect(request.request.params.keys()).toEqual(['status']);
      request.flush(OFFICE_CASE_QUEUE_COUNTS);
      expect((await counts).find((entry) => entry.queue === 'all')?.count).toBe(12);
    });

    it('lists the social workers a case can be given to, a nameless one still named', async () => {
      const assignees = firstValueFrom(cases.listAssignees());
      http.expectOne(`${CASES}/assignees`).flush(OFFICE_CASE_ASSIGNEES);
      expect(await assignees).toEqual([
        { id: SW_1, name: 'Grace Ocampo' },
        {
          id: '0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c08',
          name: 'A staff account with no name on record',
        },
      ]);
    });
  });

  describe('the workspace', () => {
    it('reads the file whole and composes the household and families beside it', async () => {
      const read = firstValueFrom(cases.getById(CASE_ID));
      barangays();
      http.expectOne(`${CASES}/${CASE_ID}`).flush(OFFICE_CASE);
      context();

      const workspace = await read;
      expect(workspace?.subject.listedName).toContain('Dela Cruz');
      expect(workspace?.household?.household.referenceNumber).toBe('HH-2026-000014');
      expect(workspace?.householdMembers.length).toBeGreaterThan(0);
      expect(workspace?.vulnerability).not.toBeNull();
      expect(workspace?.families.map((family) => family.family.name)).toEqual(['Dela Cruz family']);
      expect(workspace?.householdContextUnread).toBe(false);
      expect(workspace?.tasks.map((task) => task.status)).toEqual(['open', 'done']);

      // A protected note is listed with no body (DL-58).
      const withheld = workspace?.notes.find((note) => note.sensitivity === 'protected');
      expect(withheld?.body).toBeNull();
      expect(withheld?.isWithheld).toBe(true);
    });

    it('assembles the timeline once: a note on its event’s line, the request’s moves merged in', async () => {
      const read = firstValueFrom(cases.getById(CASE_ID));
      barangays();
      http.expectOne(`${CASES}/${CASE_ID}`).flush(OFFICE_CASE);
      context();
      const timeline = (await read)?.timeline ?? [];

      const routine = timeline.filter((entry) => entry.detail?.startsWith('Spoke with the mother'));
      expect(routine).toHaveLength(1);
      expect(routine[0]?.reason).toBe('First contact after the fire');
      expect(timeline.filter((entry) => entry.kind === 'task-completed')).toHaveLength(1);
      expect(timeline.find((entry) => entry.kind === 'request-linked')?.reference).toBe(
        'TAY-2026-000106',
      );
      expect(timeline.some((entry) => entry.kind === 'request-status-changed')).toBe(true);
      const times = timeline.map((entry) => entry.occurredAt);
      expect([...times].sort().reverse()).toEqual(times);
    });

    it('reads a caseload’s own client’s families too, and counts the requests it cannot read', async () => {
      const read = firstValueFrom(cases.getById(CASE_ID));
      barangays();
      http.expectOne(`${CASES}/${CASE_ID}`).flush(OFFICE_CASE_CASELOAD);
      // The client's families are read for a caseload like anybody else (DL-183); this one has no
      // household on record, so no household is asked for.
      http.expectOne({ method: 'GET', url: CASELOAD_FAMILIES }).flush(OFFICE_RESIDENT_FAMILIES);

      const workspace = await read;
      expect(workspace?.record.withheld).toEqual([]);
      expect(workspace?.household).toBeNull();
      expect(workspace?.householdContextUnread).toBe(false);
      expect(workspace?.record.linkedRequestIds).toHaveLength(2);
      expect(workspace?.requests).toHaveLength(1);
      expect(
        workspace?.timeline.find((entry) => entry.kind === 'request-linked')?.reference,
      ).toBeNull();
    });

    it('says the household could not be read rather than that there is none', async () => {
      const read = firstValueFrom(cases.getById(CASE_ID));
      barangays();
      http.expectOne(`${CASES}/${CASE_ID}`).flush(OFFICE_CASE);
      http
        .expectOne(HOUSEHOLD)
        .flush({ error: { code: 'FORBIDDEN' } }, { status: 403, statusText: 'Forbidden' });
      const families = http.match(FAMILIES);
      for (const pending of families) {
        if (!pending.cancelled) {
          pending.flush(OFFICE_RESIDENT_FAMILIES);
        }
      }

      const workspace = await read;
      expect(workspace?.householdContextUnread).toBe(true);
      expect(workspace?.household).toBeNull();
    });

    it('reads "not found or not yours" as absent, and asks nothing more', async () => {
      const read = firstValueFrom(cases.getById(CASE_ID));
      barangays();
      http
        .expectOne(`${CASES}/${CASE_ID}`)
        .flush({ error: { code: 'NOT_FOUND' } }, { status: 404, statusText: 'Not Found' });
      await expect(read).resolves.toBeNull();
    });

    it('refuses the whole file when one line of it cannot be read', async () => {
      const read = firstValueFrom(cases.getById(CASE_ID));
      barangays();
      http.expectOne(`${CASES}/${CASE_ID}`).flush({
        ...OFFICE_CASE,
        data: {
          ...OFFICE_CASE.data,
          events: [{ ...OFFICE_CASE.data.events[0], kind: 'case-reopened' }],
        },
      });
      await expect(read).rejects.toThrow(/could not be read/);
    });
  });

  describe('every write takes a reason and answers with the whole workspace', () => {
    it('opens a case with exactly the body the server reads', async () => {
      const opened = firstValueFrom(
        cases.open(
          {
            subjectResidentId: asId<ResidentId>(SUBJECT),
            category: 'crisis-intervention',
            summary: '  Family displaced by the fire on 1 November.  ',
            continuesCaseId: null,
            linkedRequestIds: [REQUEST, REQUEST],
          },
          '  Walk-in after the fire on 1 November ',
        ),
      );
      barangays();
      const request = http.expectOne({ method: 'POST', url: CASES });
      expect(request.request.body).toEqual({
        subject_resident_id: SUBJECT,
        category: 'crisis-intervention',
        summary: 'Family displaced by the fire on 1 November.',
        continues_case_id: null,
        linked_request_ids: [REQUEST],
        reason: 'Walk-in after the fire on 1 November',
      });
      request.flush(OFFICE_CASE, { status: 201, statusText: 'Created' });
      context();
      expect((await opened).record.id).toBe(CASE_ID);
    });

    it.each([
      [
        'names a request',
        (repository: CaseRepository) => repository.linkRequest(CASE_ID, REQUEST, REASON),
        'requests',
        { request_id: REQUEST, reason: REASON },
      ],
      [
        'moves the status',
        (repository: CaseRepository) => repository.changeStatus(CASE_ID, 'intervention', REASON),
        'status',
        { to: 'intervention', reason: REASON },
      ],
      [
        'gives the case to nobody',
        (repository: CaseRepository) => repository.assign(CASE_ID, null, REASON),
        'assignment',
        { assignee_id: null, reason: REASON },
      ],
      [
        'adds a note',
        (repository: CaseRepository) =>
          repository.addNote(CASE_ID, 'Visited the evacuation centre.', 'routine', REASON),
        'notes',
        { body: 'Visited the evacuation centre.', sensitivity: 'routine', reason: REASON },
      ],
      [
        'adds a task',
        (repository: CaseRepository) =>
          repository.addTask(
            CASE_ID,
            {
              title: 'Home visit',
              kind: 'home-visit',
              dueOn: asIsoDate('2026-11-12'),
              assignedTo: SW_1,
            },
            REASON,
          ),
        'tasks',
        {
          title: 'Home visit',
          kind: 'home-visit',
          due_on: '2026-11-12',
          assignee_id: SW_1,
          reason: REASON,
        },
      ],
      [
        'completes a task, the reason its outcome',
        (repository: CaseRepository) => repository.completeTask(CASE_ID, TASK, REASON),
        `tasks/${TASK}/complete`,
        { reason: REASON },
      ],
      [
        'cancels a task no longer needed, the reason its outcome',
        (repository: CaseRepository) => repository.cancelTask(CASE_ID, TASK, REASON),
        `tasks/${TASK}/cancel`,
        { reason: REASON },
      ],
      [
        'ends a request’s link, the reason kept',
        (repository: CaseRepository) => repository.endRequestLink(CASE_ID, REQUEST, REASON),
        `requests/${REQUEST}/end`,
        { reason: REASON },
      ],
      [
        'hands a task over',
        (repository: CaseRepository) => repository.assignTask(CASE_ID, TASK, SW_1, REASON),
        `tasks/${TASK}/assignment`,
        { assignee_id: SW_1, reason: REASON },
      ],
      [
        'moves a task’s date',
        (repository: CaseRepository) =>
          repository.rescheduleTask(CASE_ID, TASK, asIsoDate('2026-11-20'), REASON),
        `tasks/${TASK}/reschedule`,
        { due_on: '2026-11-20', reason: REASON },
      ],
    ] as const)('%s', async (_name, act, path, body) => {
      const written = firstValueFrom(act(cases));
      barangays();
      const request = http.expectOne({ method: 'POST', url: `${CASES}/${CASE_ID}/${path}` });
      expect(request.request.body).toEqual(body);
      // A caseload's answer: its client's families are read beside it (DL-183).
      request.flush(OFFICE_CASE_CASELOAD);
      http.expectOne({ method: 'GET', url: CASELOAD_FAMILIES }).flush(OFFICE_RESIDENT_FAMILIES);
      expect((await written).record.id).toBe(CASE_ID);
    });

    it('refuses a reason too short to read before anything is sent', async () => {
      await expect(firstValueFrom(cases.changeStatus(CASE_ID, 'monitoring', 'ok'))).rejects.toThrow(
        /Nothing was sent/,
      );
    });

    it('passes on the server’s refusal of a write on a closed case, in its words', async () => {
      const written = firstValueFrom(
        cases.addNote(CASE_ID, 'The household called again.', 'routine', REASON),
      );
      barangays();
      http
        .expectOne(`${CASES}/${CASE_ID}/notes`)
        .flush(OFFICE_CASE_CLOSED_REFUSAL, { status: 409, statusText: 'Conflict' });
      const failure: unknown = await written.catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(HttpErrorResponse);
      const message = failure instanceof HttpErrorResponse ? readApiError(failure).message : null;
      expect(message).toContain('This case is closed');
    });
  });
});
