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
  isAllJudgement,
  isReferralOverdue,
  referralWordsWithheld,
  visitWordsWithheld,
  type CaseId,
  type FieldVisitId,
  type FieldVisitRepository,
  type ReferralId,
  type ReferralRepository,
  type ResidentId,
  type StaffUserId,
} from '@domain/index';

import OFFICE_REFERRAL from './fixtures/office-referral.json';
import OFFICE_REFERRAL_NO_BASIS_REFUSAL from './fixtures/office-referral-no-basis-refusal.json';
import OFFICE_REFERRAL_SUMMARY from './fixtures/office-referral-summary.json';
import OFFICE_REFERRALS_PAGE from './fixtures/office-referrals-page.json';
import OFFICE_SERVICE_PROVIDERS from './fixtures/office-service-providers.json';
import OFFICE_VISIT from './fixtures/office-visit.json';
import OFFICE_VISITS_PAGE from './fixtures/office-visits-page.json';
import { HttpFieldVisitRepository, HttpReferralRepository } from './http-repositories';

const BASE = 'https://api.example.gov.ph/api/v1';
const BARANGAYS = {
  data: [{ id: '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c10', code: 'dolores', name: 'Dolores' }],
  meta: {},
};
const REFERRALS = `${BASE}/office/referrals`;
const PROVIDERS = `${BASE}/office/service-providers`;
const VISITS = `${BASE}/office/visits`;
const REFERRAL_ID = asId<ReferralId>(OFFICE_REFERRAL.data.id);
const VISIT_ID = asId<FieldVisitId>(OFFICE_VISIT.data.id);

/**
 * Referrals and field visits over the API (`DL-181`): the basis and each shared field are their own
 * acts, `send` carries no body, the sheet is the server's, a protected client's words arrive withheld
 * and are said to be, and a visit carries its observations with whose claim each is — and nothing
 * about where anybody was.
 */
describe('referrals and visits over the API (DL-181)', () => {
  let http: HttpTestingController;
  let referrals: ReferralRepository;
  let visits: FieldVisitRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiHeadersInterceptor])),
        provideHttpClientTesting(),
        {
          provide: APP_ENVIRONMENT,
          useValue: { apiBaseUrl: BASE, dataSource: 'http', firebaseWebApiKey: 'test-web-api-key' },
        },
        HttpReferralRepository,
        HttpFieldVisitRepository,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthTokenHolder).hold('fixture-token', null);
    referrals = TestBed.inject(HttpReferralRepository);
    visits = TestBed.inject(HttpFieldVisitRepository);
  });

  afterEach(() => http.verify());

  it('reads a cursor page, and says when a protected client’s words were withheld', async () => {
    const page = firstValueFrom(
      referrals.list({ overdueOnly: true, search: 'RF-2026' }, { limit: 20, cursor: null }),
    );
    const request = http.expectOne((r) => r.url === REFERRALS);
    expect(request.request.params.get('overdue_only')).toBe('true');
    expect(request.request.params.get('q')).toBe('RF-2026');
    expect(request.request.params.has('page')).toBe(false);
    expect(request.request.params.has('sort')).toBe(false);
    request.flush(OFFICE_REFERRALS_PAGE);

    const answer = await page;
    expect(answer.hasMore).toBe(true);
    const [sent, protectedOne] = answer.items;
    expect(sent?.disclosure?.authority.basis).toBe('client-consent');
    expect(sent?.disclosure?.extraFields.map((choice) => choice.field)).toEqual(['birth-date', 'income']);
    expect(sent?.followUpOn).toBe('2026-11-09');
    expect(sent !== undefined && isReferralOverdue(sent, asIsoDate('2026-11-10'))).toBe(true);
    expect(sent?.handoffNotes[0]?.body).toBe('Called the MSS; they have the file.');

    expect(protectedOne !== undefined && referralWordsWithheld(protectedOne)).toBe(true);
    expect(protectedOne?.reason).toBe('');
    expect(protectedOne?.disclosure?.authority.note).toBe('');
    expect(protectedOne?.handoffNotes[0]?.body).toBe('');
    // Answered, so not overdue, even with its chase date passed.
    expect(protectedOne !== undefined && isReferralOverdue(protectedOne, asIsoDate('2026-11-10'))).toBe(false);
  });

  it('refuses a referral whose words are missing without being withheld, rather than showing a hole', async () => {
    const broken = { ...OFFICE_REFERRAL, data: { ...OFFICE_REFERRAL.data, reason: null } };
    const read = firstValueFrom(referrals.getById(REFERRAL_ID));
    http.expectOne(`${REFERRALS}/${REFERRAL_ID}`).flush(broken);
    await expect(read).rejects.toThrow(/could not be read/);
  });

  it('drafts with nothing disclosed, then records the basis and one field as their own acts', async () => {
    const drafted = firstValueFrom(
      referrals.createDraft({
        residentId: asId<ResidentId>(OFFICE_REFERRAL.data.resident_id),
        requestId: null,
        caseId: asId<CaseId>('7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c02'),
        providerId: null,
        destination: 'hospital-msw',
        destinationName: '  Rizal Provincial Hospital  ',
        destinationContact: '  ',
        urgency: 'priority',
        serviceRequested: 'Assessment for a hospital bill discount.',
        reason: 'Admitted after a fall.',
        followUpOn: null,
      }),
    );
    const draft = http.expectOne(REFERRALS);
    expect(draft.request.method).toBe('POST');
    expect(draft.request.body).toEqual({
      resident_id: OFFICE_REFERRAL.data.resident_id,
      request_id: null,
      case_id: '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c02',
      provider_id: null,
      destination: 'hospital-msw',
      destination_name: 'Rizal Provincial Hospital',
      destination_contact: null,
      urgency: 'priority',
      service_requested: 'Assessment for a hospital bill discount.',
      reason: 'Admitted after a fall.',
      follow_up_on: null,
    });
    draft.flush(OFFICE_REFERRAL, { status: 201, statusText: 'Created' });
    await drafted;

    const based = firstValueFrom(referrals.recordDisclosureBasis(REFERRAL_ID, 'client-consent', ' Agreed. '));
    const basis = http.expectOne(`${REFERRALS}/${REFERRAL_ID}/basis`);
    expect(basis.request.body).toEqual({ basis: 'client-consent', note: 'Agreed.' });
    basis.flush(OFFICE_REFERRAL);
    await based;

    const shared = firstValueFrom(referrals.shareField(REFERRAL_ID, 'income', 'For the discount bracket.'));
    const field = http.expectOne(`${REFERRALS}/${REFERRAL_ID}/shared-fields`);
    expect(field.request.body).toEqual({ field: 'income', because: 'For the discount bracket.' });
    field.flush(OFFICE_REFERRAL);
    await shared;

    // A field with no stated need is not sent at all.
    await expect(firstValueFrom(referrals.shareField(REFERRAL_ID, 'address', '  '))).rejects.toThrow(
      /stated need/,
    );
  });

  it('sends with no body, and reports the server’s refusal when no basis is on record (DL-140)', async () => {
    const sending = firstValueFrom(referrals.send(REFERRAL_ID));
    const send = http.expectOne(`${REFERRALS}/${REFERRAL_ID}/send`);
    expect(send.request.method).toBe('POST');
    expect(send.request.body).toEqual({});
    send.flush(OFFICE_REFERRAL_NO_BASIS_REFUSAL, { status: 409, statusText: 'Conflict' });

    const failure = await sending.catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(HttpErrorResponse);
    expect(failure instanceof HttpErrorResponse && readApiError(failure).message).toMatch(
      /lawful basis/,
    );
  });

  it('reads the sheet the server composed, and null when there is none to print', async () => {
    const sheet = firstValueFrom(referrals.summaryFor(REFERRAL_ID));
    http.expectOne(`${REFERRALS}/${REFERRAL_ID}/summary`).flush(OFFICE_REFERRAL_SUMMARY);
    const composed = await sheet;
    expect(composed?.lines.map((line) => line.label)).toEqual([
      'Client',
      'Referred by',
      'Date of birth',
      'Household income',
    ]);
    expect(composed?.handlingNotice).toContain('RA 10173');

    const none = firstValueFrom(referrals.summaryFor(REFERRAL_ID));
    http.expectOne(`${REFERRALS}/${REFERRAL_ID}/summary`).flush({ data: null, meta: {} });
    expect(await none).toBeNull();
  });

  it('moves, records an outcome, moves the chase date and adds a note, each with its words', async () => {
    const moved = firstValueFrom(referrals.changeStatus(REFERRAL_ID, 'acknowledged', ' Phoned. '));
    const move = http.expectOne(`${REFERRALS}/${REFERRAL_ID}/status`);
    expect(move.request.body).toEqual({ to: 'acknowledged', reason: 'Phoned.' });
    move.flush(OFFICE_REFERRAL);
    await moved;

    const recorded = firstValueFrom(referrals.recordOutcome(REFERRAL_ID, 'Served at the MSS.', 'served'));
    const outcome = http.expectOne(`${REFERRALS}/${REFERRAL_ID}/outcome`);
    expect(outcome.request.body).toEqual({ outcome: 'Served at the MSS.', status: 'served' });
    outcome.flush(OFFICE_REFERRAL);
    await recorded;

    const rescheduled = firstValueFrom(
      referrals.reschedule(REFERRAL_ID, asIsoDate('2026-11-20'), 'They asked for a week.'),
    );
    const followUp = http.expectOne(`${REFERRALS}/${REFERRAL_ID}/follow-up`);
    expect(followUp.request.body).toEqual({ follow_up_on: '2026-11-20', reason: 'They asked for a week.' });
    followUp.flush(OFFICE_REFERRAL);
    await rescheduled;

    const noted = firstValueFrom(referrals.addNote(REFERRAL_ID, 'Left a message.'));
    const note = http.expectOne(`${REFERRALS}/${REFERRAL_ID}/notes`);
    expect(note.request.body).toEqual({ body: 'Left a message.' });
    note.flush(OFFICE_REFERRAL);
    await noted;
  });

  it('reads the provider directory whole, joined to the console’s barangays', async () => {
    const listed = firstValueFrom(referrals.listProviders({ destination: 'hospital-msw' }));
    http.expectOne((r) => r.url === `${BASE}/barangays`).flush(BARANGAYS);
    const request = http.expectOne((r) => r.url === PROVIDERS);
    expect(request.request.params.get('destination')).toBe('hospital-msw');
    request.flush(OFFICE_SERVICE_PROVIDERS);
    const [provider] = await listed;
    expect(provider?.servicesOffered).toContain('Bill discount assessment');
    expect(provider?.contact.phone).toBe('(02) 8000 0000');
  });

  it('reads visits with whose claim each line is, and a withheld household said to be withheld', async () => {
    const page = firstValueFrom(visits.list({ overdueOnly: true }, { limit: 50, cursor: null }));
    const request = http.expectOne((r) => r.url === VISITS);
    expect(request.request.params.get('overdue_only')).toBe('true');
    request.flush(OFFICE_VISITS_PAGE);
    const [withheld, completed] = (await page).items;

    expect(withheld !== undefined && visitWordsWithheld(withheld)).toBe(true);
    expect(withheld?.addressVisited).toBe('');
    expect(withheld?.observations[0]?.body).toBe('');
    expect(completed?.observations.map((entry) => [entry.kind, entry.attributedTo])).toEqual([
      ['observed', null],
      ['third-party-said', 'Kagawad Reyes'],
    ]);
    expect(completed !== undefined && isAllJudgement(completed.observations)).toBe(false);
    expect(completed?.checklist.map((item) => item.checked)).toEqual([true, false]);
    expect(Object.keys(completed ?? {})).not.toContain('location');
  });

  it('refuses a third-party line with nobody named, rather than reading a rumour as a report', async () => {
    const [, second] = OFFICE_VISIT.data.observations;
    const broken = {
      ...OFFICE_VISIT,
      data: { ...OFFICE_VISIT.data, observations: [{ ...second, attributed_to: null }] },
    };
    const read = firstValueFrom(visits.getById(VISIT_ID));
    http.expectOne(`${VISITS}/${VISIT_ID}`).flush(broken);
    await expect(read).rejects.toThrow(/could not be read/);
  });

  it('reads my visits whole, with mine said to the server', async () => {
    const mine = firstValueFrom(visits.mine({}));
    const request = http.expectOne((r) => r.url === VISITS);
    expect(request.request.params.get('mine')).toBe('true');
    request.flush(OFFICE_VISITS_PAGE);
    expect(await mine).toHaveLength(2);
  });

  it('schedules to an address with prompts, appends lines, sets the checklist and closes once', async () => {
    const scheduled = firstValueFrom(
      visits.schedule({
        caseId: asId<CaseId>('7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c02'),
        residentId: asId<ResidentId>(OFFICE_VISIT.data.resident_id),
        householdId: null,
        purpose: 'verification',
        assignedTo: asId<StaffUserId>(OFFICE_VISIT.data.assigned_to),
        scheduledFor: asIsoDate('2099-01-05'),
        scheduledWindow: ' ',
        addressVisited: ' 7 Sampaguita St ',
        checklist: [{ code: 'dwelling', label: 'Dwelling condition and tenure', checked: false, note: null }],
      }),
    );
    const schedule = http.expectOne(VISITS);
    expect(schedule.request.body).toEqual({
      resident_id: OFFICE_VISIT.data.resident_id,
      case_id: '7a6b5c4d-3e2f-4a1b-9c8d-7e6f5a4b3c02',
      household_id: null,
      purpose: 'verification',
      assigned_to: OFFICE_VISIT.data.assigned_to,
      scheduled_for: '2099-01-05',
      scheduled_window: null,
      address_visited: '7 Sampaguita St',
      checklist: [{ code: 'dwelling', label: 'Dwelling condition and tenure' }],
    });
    schedule.flush(OFFICE_VISIT, { status: 201, statusText: 'Created' });
    await scheduled;

    const written = firstValueFrom(
      visits.recordObservations(VISIT_ID, [
        { kind: 'third-party-said', body: 'He has not sent money since March.', attributedTo: ' Kagawad Reyes ' },
      ]),
    );
    const observations = http.expectOne(`${VISITS}/${VISIT_ID}/observations`);
    expect(observations.request.body).toEqual({
      observations: [
        { kind: 'third-party-said', body: 'He has not sent money since March.', attributed_to: 'Kagawad Reyes' },
      ],
    });
    observations.flush(OFFICE_VISIT);
    await written;

    // Nobody named: refused here, and nothing is sent.
    await expect(
      firstValueFrom(
        visits.recordObservations(VISIT_ID, [
          { kind: 'third-party-said', body: 'A neighbour said something.', attributedTo: null },
        ]),
      ),
    ).rejects.toThrow();

    const ticked = firstValueFrom(
      visits.setChecklist(VISIT_ID, [
        { code: 'dwelling', checked: true },
        { code: 'water-sanitation', checked: false },
      ]),
    );
    const checklist = http.expectOne(`${VISITS}/${VISIT_ID}/checklist`);
    expect(checklist.request.body).toEqual({
      items: [
        { code: 'dwelling', checked: true },
        { code: 'water-sanitation', checked: false },
      ],
    });
    checklist.flush(OFFICE_VISIT);
    await ticked;

    const closed = firstValueFrom(
      visits.close(VISIT_ID, {
        status: 'completed',
        outcome: 'Visited; needs met in part.',
        serviceNeeds: ' Roofing materials. ',
        declinedReason: null,
      }),
    );
    const close = http.expectOne(`${VISITS}/${VISIT_ID}/close`);
    expect(close.request.body).toEqual({
      status: 'completed',
      outcome: 'Visited; needs met in part.',
      service_needs: 'Roofing materials.',
      declined_reason: null,
    });
    close.flush(OFFICE_VISIT);
    expect((await closed).status).toBe('completed');
  });

  it('says plainly that a failed write left nothing behind to send later (DL-87)', async () => {
    const written = firstValueFrom(
      visits.recordObservations(VISIT_ID, [
        { kind: 'observed', body: 'The roof is missing sheets.', attributedTo: null },
      ]),
    );
    http
      .expectOne(`${VISITS}/${VISIT_ID}/observations`)
      .flush(null, { status: 0, statusText: 'Unknown Error' });
    const failure = await written.catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(HttpErrorResponse);
    // No second request: nothing was queued or retried in the background.
    http.expectNone(`${VISITS}/${VISIT_ID}/observations`);
  });
});
