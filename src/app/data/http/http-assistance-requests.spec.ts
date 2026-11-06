import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import { SessionState } from '@core/auth/session-state';
import { isApiFailure, readApiError } from '@core/http/api-failure';
import { apiHeadersInterceptor, httpErrorInterceptor } from '@core/http/api.interceptors';
import {
  ACCESS_CONTEXT,
  NOTIFICATION_REPOSITORY,
  STAFF_REPOSITORY,
  asId,
  asIsoDateTime,
  ASSIGNMENT_NEEDS_REASON,
  centavos,
  DOCUMENT_UPLOAD_POLICY,
  DocumentVersionInvalidError,
  EMPTY_INTAKE_DRAFT,
  REQUEST_WITHHELD_FIELDS,
  APPROVAL_IS_ITS_OWN_ACT,
  APPROVAL_NEEDS_WHAT,
  STATUS_MOVE_NEEDS_REASON,
  type AssistanceRequestId,
  type AssistanceRequestRepository,
  type BarangayId,
  type DocumentRequestId,
  type DocumentVersionId,
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
import OFFICE_ASSESSMENT_TEMPLATES from './fixtures/office-assessment-templates.json';
import OFFICE_DOCUMENT_GRANT from './fixtures/office-document-grant.json';
import OFFICE_DOCUMENT_REQUESTS from './fixtures/office-document-requests.json';
import OFFICE_OPEN_ASSESSMENT from './fixtures/office-open-assessment.json';
import OFFICE_REQUEST_CASEWORK from './fixtures/office-request-casework.json';
import OFFICE_SOCIAL_WORKERS from './fixtures/office-social-workers.json';
import {
  HttpAssistanceRequestRepository,
  HttpNotificationRepository,
  HttpStaffRepository,
} from './http-repositories';

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
describe('assistance requests over the API (DL-177, DL-178)', () => {
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

    it('asks nothing for a one-character search', async () => {
      await expect(
        firstValueFrom(requests.list({ search: '7' }, { limit: 20, cursor: null })),
      ).rejects.toThrow(/two characters of a control number/);
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

  it('reads a draft cancelled before filing, and refuses any other status without a number', async () => {
    const cancelled = firstValueFrom(requests.getById(DRAFT_ID));
    barangays();
    http
      .expectOne({ method: 'GET', url: `${REQUESTS}/${DRAFT_ID}` })
      .flush({ ...OFFICE_REQUEST, data: { ...OFFICE_REQUEST.data, status: 'cancelled' } });
    // Only a draft can be cancelled before it is filed, and it never had a control number.
    expect((await cancelled)?.status).toBe('cancelled');

    const halfRead = firstValueFrom(requests.getById(DRAFT_ID));
    http
      .expectOne({ method: 'GET', url: `${REQUESTS}/${DRAFT_ID}` })
      .flush({ ...OFFICE_REQUEST, data: { ...OFFICE_REQUEST.data, status: 'approved' } });
    await expect(halfRead).rejects.toThrow();
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

    it('approves with the amount in integer centavos, and reads it back (DL-183)', async () => {
      const approved = firstValueFrom(
        requests.approve(DRAFT_ID, { kind: 'money', amount: centavos(250_050) }, ' Within the ceiling. '),
      );
      barangays();
      const request = http.expectOne({ method: 'POST', url: `${REQUESTS}/${DRAFT_ID}/status` });
      expect(request.request.body).toEqual({
        to: 'approved',
        reason: 'Within the ceiling.',
        approved_amount_centavos: 250_050,
        approved_in_kind_description: null,
      });
      request.flush({
        data: { ...OFFICE_REQUEST.data, approved_amount_centavos: 250_050 },
        meta: {},
      });
      expect((await approved).approvedAmount).toEqual(centavos(250_050));
    });

    it('approves goods described, with no amount', async () => {
      const approved = firstValueFrom(
        requests.approve(DRAFT_ID, { kind: 'in-kind', description: 'Two sacks of rice' }, 'Goods.'),
      );
      barangays();
      const request = http.expectOne({ method: 'POST', url: `${REQUESTS}/${DRAFT_ID}/status` });
      expect(request.request.body).toEqual({
        to: 'approved',
        reason: 'Goods.',
        approved_amount_centavos: null,
        approved_in_kind_description: 'Two sacks of rice',
      });
      request.flush({
        data: { ...OFFICE_REQUEST.data, approved_in_kind_description: 'Two sacks of rice' },
        meta: {},
      });
      const read = await approved;
      expect(read.approvedAmount).toBeNull();
      expect(read.approvedInKindDescription).toBe('Two sacks of rice');
    });

    it('refuses a bare move to approved, and an approval that says nothing, before anything is sent', async () => {
      await expect(
        firstValueFrom(requests.changeStatus(DRAFT_ID, 'approved', 'Within the ceiling.')),
      ).rejects.toThrow(APPROVAL_IS_ITS_OWN_ACT);
      await expect(
        firstValueFrom(requests.approve(DRAFT_ID, { kind: 'money', amount: centavos(0) }, 'Yes.')),
      ).rejects.toThrow(APPROVAL_NEEDS_WHAT);
      http.verify();
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

  describe('phase 2b (DL-178)', () => {
    const CASEWORK_ID = asId<AssistanceRequestId>(OFFICE_REQUEST_CASEWORK.data.id);
    const [CERTIFICATE, GUARDIANSHIP] = OFFICE_REQUEST_CASEWORK.data.requirements;
    const CERTIFICATE_ID = asId<RequirementId>(CERTIFICATE?.id ?? '');
    const WORKER = asId<StaffUserId>('0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c07');

    const casework = (overrides: Record<string, unknown> = {}): object => ({
      data: { ...OFFICE_REQUEST_CASEWORK.data, ...overrides },
      meta: {},
    });

    const read = async (wire: object) => {
      const request = firstValueFrom(requests.getById(CASEWORK_ID));
      barangays();
      http.expectOne(`${REQUESTS}/${CASEWORK_ID}`).flush(wire);
      return request;
    };

    it('reads the assignments, the case study and every document version as the server sent them', async () => {
      const request = await read(OFFICE_REQUEST_CASEWORK);
      expect(request?.assignedTo).toBe(WORKER);
      expect(request?.assignments).toEqual([
        expect.objectContaining({
          assigneeName: 'Grace Ocampo',
          reason: 'Home visit needed before endorsement.',
          actorName: 'Teodoro Lim',
        }),
      ]);
      expect(request?.assessment).toMatchObject({
        templateCode: 'aics-general',
        templateVersion: '2026.08.1',
        assessedByName: 'Grace Ocampo',
        recommendedAmount: centavos(800_000),
        homeVisitConducted: true,
        recommendation: 'recommend-approve',
      });

      const [certificate, guardianship] = request?.requirements ?? [];
      // One document per requirement, named by the requirement's id: the server holds no other.
      expect(certificate?.document?.id).toBe(CERTIFICATE_ID);
      expect(certificate?.accepts).toEqual(DOCUMENT_UPLOAD_POLICY);
      const [first, second] = certificate?.document?.versions ?? [];
      // Masked by the server, and passed through as it came.
      expect(first).toMatchObject({
        version: 1,
        documentNumber: '••••4471',
        documentNumberMasked: true,
        receivedByName: 'Liezl Padilla',
        supersededReason: 'The first scan was illegible.',
      });
      expect(first?.file?.fileName).toBe('death-certificate-v1.pdf');
      expect(second).toMatchObject({ version: 2, source: 'encoded', file: null, supersededAt: null });
      expect(guardianship).toMatchObject({
        applicability: 'does-not-apply',
        applicabilityDecidedAt: '2026-11-02T02:00:00.000Z',
        document: null,
      });
      expect(guardianship?.applicabilityReason).toContain('no minor');
    });

    it('says withheld words as withheld — the case study, the assignment reasons — and reads the rest', async () => {
      const request = await read(
        casework({
          is_protected: true,
          withheld: [
            'reason_for_request',
            'referred_by',
            'status_reasons',
            'requirement_remarks',
            'notes',
            'assignment_reasons',
            'assessment',
          ],
          reason_for_request: null,
          assignments: [{ ...OFFICE_REQUEST_CASEWORK.data.assignments[0], reason: null }],
          assessment: {
            ...OFFICE_REQUEST_CASEWORK.data.assessment,
            findings: null,
            recommendation_reason: null,
          },
        }),
      );
      expect(request?.withheld).toEqual(REQUEST_WITHHELD_FIELDS);
      expect(request?.assessment?.findings).toBeNull();
      expect(request?.assessment?.recommendation).toBe('recommend-approve');
      expect(request?.assignments[0]?.reason).toBeNull();
    });

    it('refuses a case study with no findings that nobody withheld, rather than show it as having found nothing', async () => {
      const failure = await read(
        casework({ assessment: { ...OFFICE_REQUEST_CASEWORK.data.assessment, findings: null } }),
      ).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(Error);
    });

    it.each([
      ['an unknown recommendation', { recommendation: 'approve' }],
      ['a case study with no form', { template_code: null }],
    ])('refuses the request for %s', async (_label, change) => {
      const failure = await read(
        casework({ assessment: { ...OFFICE_REQUEST_CASEWORK.data.assessment, ...change } }),
      ).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(Error);
    });

    it('refuses the request for a document version it cannot read, rather than drop it (DL-77)', async () => {
      const [, second] = CERTIFICATE?.document_versions ?? [];
      const failure = await read(
        casework({
          requirements: [
            { ...CERTIFICATE, document_versions: [{ ...second, source: 'faxed' }] },
            GUARDIANSHIP,
          ],
        }),
      ).catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(Error);
    });

    it('sends the assignee filter as the API names it', async () => {
      const page = firstValueFrom(requests.list({ assignedTo: WORKER }, { limit: 20, cursor: null }));
      barangays();
      const request = http.expectOne((r) => r.url === REQUESTS);
      expect(request.request.params.get('assigned_to')).toBe(WORKER);
      request.flush({ data: [], meta: { pagination: { has_more: false, next_cursor: null } } });
      expect((await page).items).toEqual([]);
    });

    it('lists the social workers by name, and says when a name is not on record', async () => {
      const workers = firstValueFrom(requests.listSocialWorkers());
      http.expectOne({ method: 'GET', url: `${BASE}/office/social-workers` }).flush(OFFICE_SOCIAL_WORKERS);
      expect(await workers).toEqual([
        { id: WORKER, name: 'Grace Ocampo' },
        {
          id: asId<StaffUserId>('0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c08'),
          name: 'A staff account with no name on record',
        },
      ]);
    });

    it('assigns with the reason, trimmed — and sends nothing without one', async () => {
      await expect(
        firstValueFrom(requests.assignForAssessment(CASEWORK_ID, WORKER, '   ')),
      ).rejects.toThrow(ASSIGNMENT_NEEDS_REASON);

      const saved = firstValueFrom(requests.assignForAssessment(CASEWORK_ID, WORKER, ' Home visit. '));
      barangays();
      const post = http.expectOne({ method: 'POST', url: `${REQUESTS}/${CASEWORK_ID}/assignment` });
      expect(post.request.body).toEqual({ assignee_id: WORKER, reason: 'Home visit.' });
      post.flush(OFFICE_REQUEST_CASEWORK);
      expect((await saved).assignedTo).toBe(WORKER);
    });

    it('adds a note and reads the list the server answers with', async () => {
      await expect(
        firstValueFrom(requests.addNote(CASEWORK_ID, { sensitivity: 'routine', body: '  ' })),
      ).rejects.toThrow(/Nothing was sent/);

      const notes = firstValueFrom(
        requests.addNote(CASEWORK_ID, { sensitivity: 'protected', body: ' Visited on Monday. ' }),
      );
      const post = http.expectOne({ method: 'POST', url: `${REQUESTS}/${CASEWORK_ID}/notes` });
      expect(post.request.body).toEqual({ sensitivity: 'protected', body: 'Visited on Monday.' });
      post.flush(OFFICE_REQUEST_NOTES, { status: 201, statusText: 'Created' });
      expect((await notes).length).toBe(OFFICE_REQUEST_NOTES.data.length);
    });

    it('reads the published forms, and refuses one with a question it cannot render', async () => {
      const forms = firstValueFrom(requests.listAssessmentTemplates());
      http.expectOne(`${BASE}/office/assessment-templates`).flush(OFFICE_ASSESSMENT_TEMPLATES);
      const [form] = await forms;
      expect(form?.status).toBe('placeholder-pending-lgu-approval');
      expect(form?.questions.map((question) => question.kind)).toEqual(['integer', 'choice', 'text']);

      const broken = firstValueFrom(requests.listAssessmentTemplates()).catch(
        (error: unknown) => error,
      );
      const [template] = OFFICE_ASSESSMENT_TEMPLATES.data;
      http.expectOne(`${BASE}/office/assessment-templates`).flush({
        data: [{ ...template, questions: [{ ...template?.questions[0], kind: 'slider' }] }],
        meta: {},
      });
      expect(await broken).toBeInstanceOf(Error);
    });

    it('opens an assessment from a form and patches its answers, blanks as null', async () => {
      const opened = firstValueFrom(requests.openAssessment(CASEWORK_ID, 'aics-general'));
      const open = http.expectOne({ method: 'POST', url: `${REQUESTS}/${CASEWORK_ID}/assessment` });
      expect(open.request.body).toEqual({ template_code: 'aics-general' });
      open.flush(OFFICE_OPEN_ASSESSMENT, { status: 201, statusText: 'Created' });
      expect(await opened).toEqual({
        templateCode: 'aics-general',
        templateVersion: '2026.08.1',
        completed: false,
        answers: { household_size: '5', remarks: null },
      });

      await expect(firstValueFrom(requests.answerAssessment(CASEWORK_ID, {}))).rejects.toThrow(
        /Nothing was sent/,
      );
      const answered = firstValueFrom(
        requests.answerAssessment(CASEWORK_ID, { household_size: ' 6 ', remarks: '  ' }),
      );
      const answers = http.expectOne(`${REQUESTS}/${CASEWORK_ID}/assessment/answers`);
      expect(answers.request.body).toEqual({ answers: { household_size: '6', remarks: null } });
      answers.flush(OFFICE_OPEN_ASSESSMENT);
      expect((await answered).templateCode).toBe('aics-general');
    });

    it('completes with all four facts the server keeps, the amount in integer centavos', async () => {
      const saved = firstValueFrom(
        requests.recordAssessment(CASEWORK_ID, {
          findings: ' Household of five in one rented room. ',
          recommendedAmount: centavos(800_000),
          homeVisitConducted: true,
          recommendation: 'recommend-approve',
          reason: '  ',
        }),
      );
      barangays();
      const post = http.expectOne(`${REQUESTS}/${CASEWORK_ID}/assessment/complete`);
      expect(post.request.body).toEqual({
        findings: 'Household of five in one rented room.',
        recommended_amount_centavos: 800_000,
        home_visit_conducted: true,
        recommendation: 'recommend-approve',
        reason: null,
      });
      post.flush(OFFICE_REQUEST_CASEWORK);
      // Completing moves the request nowhere: it is still in assessment.
      expect((await saved).status).toBe('assessment');
    });

    it('reviews with the verdict and its remarks, and sends nothing for a state that is no verdict', async () => {
      await expect(
        firstValueFrom(requests.reviewRequirement(CASEWORK_ID, CERTIFICATE_ID, 'pending', null)),
      ).rejects.toThrow(/Nothing was sent/);

      const saved = firstValueFrom(
        requests.reviewRequirement(CASEWORK_ID, CERTIFICATE_ID, 'needs-replacement', ' Torn. '),
      );
      barangays();
      const post = http.expectOne(`${REQUESTS}/${CASEWORK_ID}/requirements/${CERTIFICATE_ID}/review`);
      expect(post.request.body).toEqual({ status: 'needs-replacement', remarks: 'Torn.' });
      post.flush(OFFICE_REQUEST_CASEWORK);
      await saved;
    });

    it('rules on a conditional document with its reason; undecided is not a ruling', async () => {
      const guardianship = asId<RequirementId>(GUARDIANSHIP?.id ?? '');
      await expect(
        firstValueFrom(requests.decideApplicability(CASEWORK_ID, guardianship, 'undecided', 'Why.')),
      ).rejects.toThrow(/Nothing was sent/);

      const saved = firstValueFrom(
        requests.decideApplicability(CASEWORK_ID, guardianship, 'applies', ' A minor is involved. '),
      );
      barangays();
      const post = http.expectOne(
        `${REQUESTS}/${CASEWORK_ID}/requirements/${guardianship}/applicability`,
      );
      expect(post.request.body).toEqual({ applicability: 'applies', reason: 'A minor is involved.' });
      post.flush(OFFICE_REQUEST_CASEWORK);
      await saved;
    });

    it('records a version as form fields, leaving out what it has nothing to say for, and reports only done', async () => {
      const file = new File(['%PDF-1.4'], 'scan.pdf', { type: 'application/pdf' });
      const emissions: string[] = [];
      const done = new Promise<void>((resolve, reject) => {
        requests
          .recordDocument(CASEWORK_ID, CERTIFICATE_ID, {
            file,
            source: 'scanned',
            documentNumber: ' BC-2026-4471 ',
            issuedOn: null,
            expiresOn: null,
            replacesBecause: ' A clearer scan. ',
          })
          .subscribe({
            next: (progress) => emissions.push(progress.kind),
            error: reject,
            complete: resolve,
          });
      });
      barangays();
      const post = http.expectOne(`${REQUESTS}/${CASEWORK_ID}/requirements/${CERTIFICATE_ID}/documents`);
      const body: unknown = post.request.body;
      expect(body).toBeInstanceOf(FormData);
      const form = body instanceof FormData ? body : new FormData();
      expect(form.get('file')).toBeInstanceOf(Blob);
      expect(form.get('source')).toBe('scanned');
      // Only the last four characters leave the browser (DL-183).
      expect(form.get('document_number')).toBe('4471');
      expect(form.get('replaces_because')).toBe('A clearer scan.');
      // A form cannot say null: a field with nothing to say is not sent.
      expect(form.has('issued_on')).toBe(false);
      expect(form.has('expires_on')).toBe(false);
      post.flush(OFFICE_REQUEST_CASEWORK, { status: 201, statusText: 'Created' });
      await done;
      // No upload events are read, so no progress is invented.
      expect(emissions).toEqual(['done']);
    });

    it('refuses a file the office does not accept, and a file on a source that holds none, before sending', async () => {
      const draft = {
        source: 'uploaded' as const,
        documentNumber: null,
        issuedOn: null,
        expiresOn: null,
        replacesBecause: null,
      };
      await expect(
        firstValueFrom(
          requests.recordDocument(CASEWORK_ID, CERTIFICATE_ID, {
            ...draft,
            file: new File(['MZ'], 'setup.exe', { type: 'application/x-msdownload' }),
          }),
        ),
      ).rejects.toThrow(/PDF, a JPEG or a PNG/);
      await expect(
        firstValueFrom(
          requests.recordDocument(CASEWORK_ID, CERTIFICATE_ID, {
            ...draft,
            source: 'encoded',
            file: new File(['%PDF'], 'scan.pdf', { type: 'application/pdf' }),
          }),
        ),
      ).rejects.toBeInstanceOf(DocumentVersionInvalidError);
    });

    it('reads what the applicant was asked to bring, a withheld message said as withheld', async () => {
      const asked = firstValueFrom(requests.listDocumentRequests(CASEWORK_ID));
      http
        .expectOne({ method: 'GET', url: `${REQUESTS}/${CASEWORK_ID}/document-requests` })
        .flush(OFFICE_DOCUMENT_REQUESTS);
      const [open, withdrawn] = await asked;
      expect(open).toMatchObject({
        state: 'open',
        message: 'Please bring the original death certificate.',
        requestedByName: 'Liezl Padilla',
        isWithheld: false,
      });
      expect(withdrawn).toMatchObject({
        state: 'withdrawn',
        message: null,
        withdrawnReason: null,
        isWithheld: true,
        requestedByName: 'A staff account with no name on record',
      });
    });

    it('refuses the list for an entry whose message is missing without being withheld', async () => {
      const [first] = OFFICE_DOCUMENT_REQUESTS.data;
      const asked = firstValueFrom(requests.listDocumentRequests(CASEWORK_ID)).catch(
        (error: unknown) => error,
      );
      http
        .expectOne(`${REQUESTS}/${CASEWORK_ID}/document-requests`)
        .flush({ data: [{ ...first, message: null }], meta: {} });
      expect(await asked).toBeInstanceOf(Error);
    });

    it('asks the applicant for a document and withdraws a request, each with its words', async () => {
      const asked = firstValueFrom(
        requests.requestDocument(CASEWORK_ID, {
          requirementId: CERTIFICATE_ID,
          channel: 'sms',
          message: ' Please bring the original. ',
          neededBy: null,
        }),
      );
      const post = http.expectOne({ method: 'POST', url: `${REQUESTS}/${CASEWORK_ID}/document-requests` });
      expect(post.request.body).toEqual({
        requirement_id: CERTIFICATE_ID,
        channel: 'sms',
        message: 'Please bring the original.',
        needed_by: null,
      });
      post.flush(OFFICE_DOCUMENT_REQUESTS, { status: 201, statusText: 'Created' });
      expect((await asked).length).toBe(2);

      const asking = asId<DocumentRequestId>(OFFICE_DOCUMENT_REQUESTS.data[0]?.id ?? '');
      await expect(
        firstValueFrom(requests.withdrawDocumentRequest(CASEWORK_ID, asking, ' ')),
      ).rejects.toThrow(/Nothing was sent/);
      const withdrawn = firstValueFrom(
        requests.withdrawDocumentRequest(CASEWORK_ID, asking, ' Confirmed with the registrar. '),
      );
      const withdraw = http.expectOne(
        `${REQUESTS}/${CASEWORK_ID}/document-requests/${asking}/withdraw`,
      );
      expect(withdraw.request.body).toEqual({ reason: 'Confirmed with the registrar.' });
      withdraw.flush(OFFICE_DOCUMENT_REQUESTS);
      await withdrawn;
    });

    it('opens a file in two acts: a grant with the server’s warning, then the bytes for its handle in a body', async () => {
      const version = asId<DocumentVersionId>(OFFICE_DOCUMENT_GRANT.data.version_id);
      const granted = firstValueFrom(requests.openDocument(CASEWORK_ID, CERTIFICATE_ID, version));
      const access = http.expectOne({
        method: 'POST',
        url: `${REQUESTS}/${CASEWORK_ID}/requirements/${CERTIFICATE_ID}/documents/${version}/access`,
      });
      access.flush(OFFICE_DOCUMENT_GRANT, { status: 201, statusText: 'Created' });
      const grant = await granted;
      // The warning shown is the server's, word for word.
      expect(grant.warning).toBe(OFFICE_DOCUMENT_GRANT.data.warning);
      expect(grant.redactedForSharing).toBe(false);

      const bytes = firstValueFrom(requests.readDocumentFile(grant));
      const exchange = http.expectOne({ method: 'POST', url: `${BASE}/office/document-files` });
      // The handle travels in a body — never in a URL a request log keeps — with the bearer token.
      expect(exchange.request.url).not.toContain(grant.handle);
      expect(exchange.request.body).toEqual({ handle: grant.handle });
      expect(exchange.request.responseType).toBe('blob');
      expect(exchange.request.headers.get('Authorization')).toBe('Bearer fixture-token');
      exchange.flush(new Blob(['%PDF-1.4'], { type: 'application/pdf' }));
      expect(await bytes).toBeInstanceOf(Blob);
    });

    it('refuses a grant that carries no warning, rather than write one here', async () => {
      const version = asId<DocumentVersionId>(OFFICE_DOCUMENT_GRANT.data.version_id);
      const granted = firstValueFrom(
        requests.openDocument(CASEWORK_ID, CERTIFICATE_ID, version),
      ).catch((error: unknown) => error);
      http
        .expectOne(`${REQUESTS}/${CASEWORK_ID}/requirements/${CERTIFICATE_ID}/documents/${version}/access`)
        .flush({ data: { ...OFFICE_DOCUMENT_GRANT.data, warning: null }, meta: {} });
      expect(await granted).toBeInstanceOf(Error);
    });
  });
});

/**
 * A refusal of a request for bytes arrives as bytes too. The interceptor reads it back into the
 * server's envelope, so the sentence reaches the screen in the server's words (`DL-178`).
 */
describe('a refusal of the bytes, in the server’s words', () => {
  it('reads a JSON refusal that arrived as a Blob', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiHeadersInterceptor, httpErrorInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: APP_ENVIRONMENT,
          useValue: { apiBaseUrl: BASE, dataSource: 'http', firebaseWebApiKey: 'test-web-api-key' },
        },
        { provide: ACCESS_CONTEXT, useExisting: SessionState },
        { provide: STAFF_REPOSITORY, useClass: HttpStaffRepository },
        { provide: NOTIFICATION_REPOSITORY, useClass: HttpNotificationRepository },
        HttpAssistanceRequestRepository,
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    const requests = TestBed.inject(HttpAssistanceRequestRepository);
    const gone =
      'That file is not available to open. A grant is used once, within five minutes, by the account it was issued to. Ask to open the file again.';

    const bytes = firstValueFrom(
      requests.readDocumentFile({
        versionId: asId<DocumentVersionId>(OFFICE_DOCUMENT_GRANT.data.version_id),
        fileName: OFFICE_DOCUMENT_GRANT.data.file_name,
        mimeType: OFFICE_DOCUMENT_GRANT.data.mime_type,
        handle: OFFICE_DOCUMENT_GRANT.data.handle,
        expiresAt: asIsoDateTime(OFFICE_DOCUMENT_GRANT.data.expires_at),
        redactedForSharing: false,
        warning: OFFICE_DOCUMENT_GRANT.data.warning,
      }),
    ).catch((error: unknown) => error);
    http
      .expectOne(`${BASE}/office/document-files`)
      .flush(
        new Blob([JSON.stringify({ error: { code: 'NOT_FOUND', message: gone } })], {
          type: 'application/json',
        }),
        { status: 404, statusText: 'Not Found' },
      );

    const failure = await bytes;
    expect(isApiFailure(failure) ? failure.message : failure).toBe(gone);
    http.verify();
  });
});
