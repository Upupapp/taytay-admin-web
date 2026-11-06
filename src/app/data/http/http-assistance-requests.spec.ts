import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, type Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import { readApiError } from '@core/http/api-failure';
import { apiHeadersInterceptor } from '@core/http/api.interceptors';
import {
  asId,
  asIsoDateTime,
  centavos,
  EMPTY_INTAKE_DRAFT,
  REQUEST_WITHHELD_FIELDS,
  STATUS_MOVE_NEEDS_REASON,
  type AssistanceRequestId,
  type AssistanceRequestRepository,
  type BarangayId,
  type DocumentRequestId,
  type IntakeDraft,
  type ProgramId,
  type RequirementId,
  type ResidentId,
  type StaffUserId,
} from '@domain/index';

import OFFICE_REQUEST from './fixtures/office-request.json';
import OFFICE_REQUEST_ADVISORY from './fixtures/office-request-advisory.json';
import OFFICE_REQUEST_NOTES from './fixtures/office-request-notes.json';
import OFFICE_REQUEST_REFUSAL from './fixtures/office-request-refusal.json';
import OFFICE_REQUESTS_PAGE from './fixtures/office-requests-page.json';
import { HttpAssistanceRequestRepository } from './http-repositories';
import { UnservedError } from './unserved-repositories';

const BASE = 'https://api.example.gov.ph/api/v1';
const REQUESTS = `${BASE}/office/assistance-requests`;
const DOLORES_API = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01';
const SAN_JUAN_API = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c04';
const BARANGAYS = {
  data: [
    { id: DOLORES_API, code: 'dolores', name: 'Dolores' },
    { id: SAN_JUAN_API, code: 'san-juan', name: 'San Juan' },
  ],
  meta: {},
};

const PROGRAM = asId<ProgramId>('5b0e7c1e-2f4a-4c3e-9a51-0d6c1f2a7b10');
const RESIDENT = asId<ResidentId>('3c2b1a09-8f7e-4d6c-9b5a-1f2e3d4c5b02');
const DRAFT_ID = asId<AssistanceRequestId>(OFFICE_REQUEST.data.id);

/**
 * Assistance requests over the API (casework phase 2a, `DL-177`), against fixtures composed from the
 * vendored spec — `fixtures/fixtures.spec.ts` holds each one to its schema.
 */
describe('assistance requests over the API (DL-177)', () => {
  let http: HttpTestingController;
  // Typed as the port: the screens hold it so, and the phase 2b methods take its parameters.
  let requests: AssistanceRequestRepository;

  const barangays = (): void => {
    http.expectOne({ method: 'GET', url: `${BASE}/barangays` }).flush(BARANGAYS);
  };

  const draft = (): IntakeDraft => ({
    ...EMPTY_INTAKE_DRAFT,
    residentId: RESIDENT,
    programId: PROGRAM,
    channel: 'barangay-referral',
    referredBy: '  Brgy. San Juan — Kagawad Santos ',
    reasonForRequest: ' Burial costs for a deceased parent. ',
    requestedAmount: centavos(1_000_000),
    requirements: [
      {
        code: 'death-certificate',
        label: 'Death certificate',
        obligation: 'required',
        appliesWhen: null,
        applicability: 'undecided',
        presented: true,
        waivedReason: null,
      },
      {
        code: 'funeral-contract',
        label: 'Funeral contract',
        obligation: 'required',
        appliesWhen: null,
        applicability: 'undecided',
        presented: false,
        waivedReason: '',
      },
    ],
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiHeadersInterceptor])),
        provideHttpClientTesting(),
        {
          provide: APP_ENVIRONMENT,
          useValue: { apiBaseUrl: BASE, dataSource: 'http', firebaseWebApiKey: 'test-web-api-key' },
        },
        HttpAssistanceRequestRepository,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthTokenHolder).hold('fixture-token', null);
    requests = TestBed.inject(HttpAssistanceRequestRepository);
  });

  afterEach(() => http.verify());

  describe('the list', () => {
    it('reads a cursor page as the server redacted it, naming barangays as this console does', async () => {
      const page = firstValueFrom(requests.list({}, { limit: 20, cursor: null }));
      barangays();
      const request = http.expectOne((r) => r.url === REQUESTS);
      expect(request.request.params.keys()).toEqual(['limit']);
      request.flush(OFFICE_REQUESTS_PAGE);

      const answer = await page;
      expect(answer.hasMore).toBe(true);
      expect(answer.nextCursor).toBe(OFFICE_REQUESTS_PAGE.meta.pagination.next_cursor);
      const [protectedOne, plain] = answer.items;

      // What the server held back, said as withheld — and nothing here holds it back again.
      expect(protectedOne?.isProtected).toBe(true);
      expect(protectedOne?.withheld).toEqual(REQUEST_WITHHELD_FIELDS);
      expect(protectedOne?.reasonForRequest).toBe('');
      expect(protectedOne?.referredBy).toBeNull();
      expect(protectedOne?.barangayId).toBe('brgy-dolores');
      expect(protectedOne?.statusHistory.at(-1)?.actorName).toBe(
        'A staff account with no name on record',
      );

      expect(plain?.referenceNumber).toBe('TAY-2026-000106');
      expect(plain?.barangayId).toBe('brgy-san-juan');
      expect(plain?.channel).toBe('walk-in');
      expect(plain?.withheld).toEqual([]);
      expect(plain?.requestedAmount).toBeNull();
      expect(plain?.statusHistory.map((change) => change.to)).toEqual(['submitted', 'endorsed']);
      expect(plain?.requirements[1]).toMatchObject({
        obligation: 'conditional',
        applicability: 'does-not-apply',
        appliesWhen: 'When the applicant claims for a minor in their care.',
        remarks: 'The applicant claims for herself.',
        document: null,
      });
      // Not sent, because nothing on the server records them yet — "none recorded" is true.
      expect(plain?.approvedAmount).toBeNull();
      expect(plain?.assignedTo).toBeNull();
      expect(plain?.assessment).toBeNull();
      expect(plain?.decisionRemarks).toBeNull();
    });

    it('sends the filter as the API names it, the barangay as the API keys it', async () => {
      const page = firstValueFrom(
        requests.list(
          {
            search: ' 2026-0001 ',
            status: 'draft',
            programId: PROGRAM,
            barangayId: asId<BarangayId>('brgy-san-juan'),
            openOnly: true,
          },
          { limit: 50, cursor: 'abc' },
        ),
      );
      barangays();
      const request = http.expectOne((r) => r.url === REQUESTS);
      const params = request.request.params;
      expect(params.keys().sort()).toEqual(
        ['barangay_id', 'cursor', 'limit', 'open_only', 'program_id', 'q', 'status'].sort(),
      );
      expect(params.get('q')).toBe('2026-0001');
      expect(params.get('status')).toBe('draft');
      expect(params.get('barangay_id')).toBe(SAN_JUAN_API);
      expect(params.get('open_only')).toBe('true');
      request.flush({ data: [], meta: { pagination: { has_more: false, next_cursor: null } } });
      expect((await page).items).toEqual([]);
    });

    it('asks nothing for a one-character search or an assignee it cannot filter by', async () => {
      await expect(
        firstValueFrom(requests.list({ search: '7' }, { limit: 20, cursor: null })),
      ).rejects.toThrow(/two characters of a control number/);
      await expect(
        firstValueFrom(
          requests.list({ assignedTo: asId<StaffUserId>('staff-sw-1') }, { limit: 20, cursor: null }),
        ),
      ).rejects.toThrow(/holds no assignee yet/);
    });

    it('refuses a request it cannot read rather than leave it out', async () => {
      const page = firstValueFrom(requests.list({}, { limit: 20, cursor: null }));
      barangays();
      const [first, second] = OFFICE_REQUESTS_PAGE.data;
      http
        .expectOne((r) => r.url === REQUESTS)
        .flush({ ...OFFICE_REQUESTS_PAGE, data: [first, { ...second, status: 'pondering' }] });
      await expect(page).rejects.toThrow(/never filed/);
    });

    it('refuses a withheld field it has no word for, rather than show a blank', async () => {
      const page = firstValueFrom(requests.list({}, { limit: 20, cursor: null }));
      barangays();
      const [first] = OFFICE_REQUESTS_PAGE.data;
      http
        .expectOne((r) => r.url === REQUESTS)
        .flush({ ...OFFICE_REQUESTS_PAGE, data: [{ ...first, withheld: ['diagnosis'] }] });
      await expect(page).rejects.toThrow(/could not be read/);
    });
  });

  it('reads one request, and answers null for "not found or not yours" (DL-31)', async () => {
    const found = firstValueFrom(requests.getById(DRAFT_ID));
    barangays();
    http.expectOne({ method: 'GET', url: `${REQUESTS}/${DRAFT_ID}` }).flush(OFFICE_REQUEST);
    const draftRead = await found;
    // A draft has no control number, and says so in the console's own word for it.
    expect(draftRead?.referenceNumber).toBe('');
    expect(draftRead?.status).toBe('draft');
    expect(draftRead?.referredBy).toBe('Brgy. San Juan — Kagawad Santos');

    const missing = firstValueFrom(requests.getById(asId<AssistanceRequestId>('nobody')));
    http
      .expectOne({ method: 'GET', url: `${REQUESTS}/nobody` })
      .flush({ error: { code: 'NOT_FOUND' } }, { status: 404, statusText: 'Not Found' });
    expect(await missing).toBeNull();
  });

  describe('intake', () => {
    it('creates a draft with the whole body, flat and in centavos, and no control number', async () => {
      const saved = firstValueFrom(requests.saveDraft(draft(), null));
      barangays();
      const request = http.expectOne({ method: 'POST', url: REQUESTS });
      expect(request.request.body).toEqual({
        resident_id: RESIDENT,
        program_id: PROGRAM,
        channel: 'barangay-referral',
        referred_by: 'Brgy. San Juan — Kagawad Santos',
        reason_for_request: 'Burial costs for a deceased parent.',
        requested_amount_centavos: 1_000_000,
        requirements: [
          {
            code: 'death-certificate',
            presented: true,
            waived_reason: null,
            applicability: 'undecided',
          },
          { code: 'funeral-contract', presented: false, waived_reason: '', applicability: 'undecided' },
        ],
      });
      request.flush(OFFICE_REQUEST, { status: 201, statusText: 'Created' });
      expect((await saved).id).toBe(DRAFT_ID);
    });

    it('replaces the draft at its id whole, rather than creating a second', async () => {
      const saved = firstValueFrom(requests.saveDraft(draft(), DRAFT_ID));
      barangays();
      const request = http.expectOne({ method: 'PATCH', url: `${REQUESTS}/${DRAFT_ID}` });
      expect(request.request.body).toMatchObject({ resident_id: RESIDENT, channel: 'barangay-referral' });
      request.flush(OFFICE_REQUEST);
      expect((await saved).status).toBe('draft');
    });

    it('sends nothing for a draft that names nobody', async () => {
      await expect(firstValueFrom(requests.saveDraft(EMPTY_INTAKE_DRAFT, null))).rejects.toThrow(
        /name the person/,
      );
    });

    it('files with the encoder’s sentence and the cautions it answers — never who or when', async () => {
      const filed = firstValueFrom(
        requests.submitIntake(DRAFT_ID, {
          codes: ['open-request-same-programme'],
          reason: ' Second admission for the same condition. ',
          actorId: asId<StaffUserId>('staff-intake'),
          actorName: 'Liezl Padilla',
          acknowledgedAt: asIsoDateTime('2026-11-06T02:00:00.000Z'),
        }),
      );
      barangays();
      const request = http.expectOne({ method: 'POST', url: `${REQUESTS}/${DRAFT_ID}/file` });
      expect(request.request.body).toEqual({
        acknowledgement: {
          codes: ['open-request-same-programme'],
          reason: 'Second admission for the same condition.',
        },
      });
      const [, filedRequest] = OFFICE_REQUESTS_PAGE.data;
      request.flush({ data: filedRequest, meta: {} });
      expect((await filed).referenceNumber).toBe('TAY-2026-000106');
    });

    it('files with no acknowledgement as null, not as an empty one', async () => {
      const filed = firstValueFrom(requests.submitIntake(DRAFT_ID, null));
      barangays();
      const request = http.expectOne({ method: 'POST', url: `${REQUESTS}/${DRAFT_ID}/file` });
      expect(request.request.body).toEqual({ acknowledgement: null });
      const [, filedRequest] = OFFICE_REQUESTS_PAGE.data;
      request.flush({ data: filedRequest, meta: {} });
      await filed;
    });

    it('hands the screen the refusal keyed by the console’s own intake problem codes', async () => {
      const filed = firstValueFrom(requests.submitIntake(DRAFT_ID, null));
      barangays();
      http
        .expectOne({ method: 'POST', url: `${REQUESTS}/${DRAFT_ID}/file` })
        .flush(OFFICE_REQUEST_REFUSAL, { status: 422, statusText: 'Unprocessable Content' });
      const failure: unknown = await filed.catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(HttpErrorResponse);
      const details = failure instanceof HttpErrorResponse ? readApiError(failure).details : null;
      expect(Object.keys(details ?? {})).toEqual([
        'reason-too-short',
        'missing-mandatory-requirement',
      ]);
    });
  });

  describe('the lifecycle', () => {
    it('moves a request with its reason', async () => {
      const moved = firstValueFrom(requests.changeStatus(DRAFT_ID, 'endorsed', ' Assessed. '));
      barangays();
      const request = http.expectOne({ method: 'POST', url: `${REQUESTS}/${DRAFT_ID}/status` });
      expect(request.request.body).toEqual({ to: 'endorsed', reason: 'Assessed.' });
      const [, endorsed] = OFFICE_REQUESTS_PAGE.data;
      request.flush({ data: endorsed, meta: {} });
      expect((await moved).status).toBe('endorsed');
    });

    it('refuses a move without words before anything is sent', async () => {
      await expect(firstValueFrom(requests.changeStatus(DRAFT_ID, 'endorsed', null))).rejects.toThrow(
        STATUS_MOVE_NEEDS_REASON,
      );
      await expect(firstValueFrom(requests.changeStatus(DRAFT_ID, 'endorsed', '  '))).rejects.toThrow(
        STATUS_MOVE_NEEDS_REASON,
      );
    });
  });

  describe('the duplicate check', () => {
    it('asks for a person, and a programme once one is chosen', async () => {
      const without = firstValueFrom(requests.advisoryFor(RESIDENT, null));
      const first = http.expectOne((r) => r.url === `${REQUESTS}/advisory`);
      expect(first.request.params.keys()).toEqual(['resident_id']);
      first.flush(OFFICE_REQUEST_ADVISORY);
      await without;

      const withProgramme = firstValueFrom(requests.advisoryFor(RESIDENT, PROGRAM));
      const second = http.expectOne((r) => r.url === `${REQUESTS}/advisory`);
      expect(second.request.params.get('program_id')).toBe(PROGRAM);
      second.flush(OFFICE_REQUEST_ADVISORY);
      const advisory = await withProgramme;

      expect(advisory.signals.map((signal) => signal.code)).toEqual(['open-request-same-programme']);
      expect(advisory.recordsRead).toBe(1);
      // What it could not read is named, so its silence is not read as "never helped".
      expect(advisory.unread.map((gap) => gap.source)).toEqual(['releases', 'cases']);
      expect(advisory.unread[0]?.because).toContain('not a finding that none was');
    });

    it('reads the check for a filed request at its own path', async () => {
      const advisory = firstValueFrom(requests.advisoryForCase(DRAFT_ID));
      http
        .expectOne({ method: 'GET', url: `${REQUESTS}/${DRAFT_ID}/advisory` })
        .flush(OFFICE_REQUEST_ADVISORY);
      expect((await advisory).signals).toHaveLength(1);
    });

    it('drops a signal it cannot explain, and keeps the rest', async () => {
      const advisory = firstValueFrom(requests.advisoryForCase(DRAFT_ID));
      const [known] = OFFICE_REQUEST_ADVISORY.data.signals;
      http.expectOne({ method: 'GET', url: `${REQUESTS}/${DRAFT_ID}/advisory` }).flush({
        ...OFFICE_REQUEST_ADVISORY,
        data: {
          ...OFFICE_REQUEST_ADVISORY.data,
          signals: [known, { ...known, code: 'risk-score' }, { ...known, tone: 'blocked' }],
        },
      });
      expect((await advisory).signals.map((signal) => signal.code)).toEqual([
        'open-request-same-programme',
      ]);
    });

    it('refuses the whole check rather than drop a source it could not read', async () => {
      const advisory = firstValueFrom(requests.advisoryForCase(DRAFT_ID));
      http.expectOne({ method: 'GET', url: `${REQUESTS}/${DRAFT_ID}/advisory` }).flush({
        ...OFFICE_REQUEST_ADVISORY,
        data: {
          ...OFFICE_REQUEST_ADVISORY.data,
          not_read: [{ source: 'referrals', because: 'Not held yet.' }],
        },
      });
      await expect(advisory).rejects.toThrow(/nothing found/);
    });
  });

  it('reads the notes whole, a withheld body null and the entry still listed (DL-58)', async () => {
    const notes = firstValueFrom(requests.listNotes(DRAFT_ID));
    http.expectOne({ method: 'GET', url: `${REQUESTS}/${DRAFT_ID}/notes` }).flush(OFFICE_REQUEST_NOTES);
    const [withheld, routine] = await notes;
    expect(withheld).toMatchObject({ body: null, isWithheld: true, sensitivity: 'protected' });
    expect(routine?.body).toBe('Applicant will bring the pharmacy receipts on Monday.');
    expect(routine?.authorName).toBe('A staff account with no name on record');
  });

  describe('phase 2b is not connected yet, and asks the API nothing', () => {
    const id = DRAFT_ID;
    const requirement = asId<RequirementId>('rq-1');

    const calls: readonly (readonly [string, () => Observable<unknown>])[] = [
      ['listAssessmentTemplates', () => requests.listAssessmentTemplates()],
      ['openAssessment', () => requests.openAssessment(id, 'aics-standard')],
      ['answerAssessment', () => requests.answerAssessment(id, {})],
      [
        'recordAssessment',
        () =>
          requests.recordAssessment(id, {
            findings: 'Home visit made.',
            recommendedAmount: null,
            homeVisitConducted: true,
            recommendation: 'insufficient-information',
            reason: null,
          }),
      ],
      ['reviewRequirement', () => requests.reviewRequirement(id, requirement, 'verified', null)],
      ['decideApplicability', () => requests.decideApplicability(id, requirement, 'applies', 'Yes.')],
      ['listDocumentRequests', () => requests.listDocumentRequests(id)],
      ['withdrawDocumentRequest', () => requests.withdrawDocumentRequest(id, asId<DocumentRequestId>('dr-1'), 'Done.')],
    ];

    it('refuses all eleven without a request — the verify after each test holds that', async () => {
      const adapter = TestBed.inject(HttpAssistanceRequestRepository);
      const methods = [
        'listAssessmentTemplates',
        'openAssessment',
        'answerAssessment',
        'recordAssessment',
        'reviewRequirement',
        'recordDocument',
        'decideApplicability',
        'requestDocument',
        'listDocumentRequests',
        'withdrawDocumentRequest',
        'openDocument',
      ] as const;
      for (const method of methods) {
        const failure: unknown = await firstValueFrom(adapter[method]()).catch(
          (error: unknown) => error,
        );
        expect(failure, method).toBeInstanceOf(UnservedError);
      }
    });

    it.each(calls)('%s answers that it is not connected', async (_name, call) => {
      const failure: unknown = await firstValueFrom(call()).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(UnservedError);
      expect(failure instanceof Error ? failure.message : '').toContain(
        'does not serve a request’s assessment or the review of its documents yet',
      );
    });
  });
});
