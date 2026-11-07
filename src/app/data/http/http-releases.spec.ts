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
  WriteIntent,
  asId,
  asIsoDate,
  batchProgress,
  centavos,
  describeBatch,
  isSelfRelease,
  type AssistanceRequestId,
  type ReleaseBatchId,
  type ReleaseId,
  type ReleaseRepository,
  type StaffUserId,
} from '@domain/index';

import OFFICE_RELEASE from './fixtures/office-release.json';
import OFFICE_RELEASE_BATCHES from './fixtures/office-release-batches.json';
import OFFICE_RELEASE_INTENT_REFUSAL from './fixtures/office-release-intent-refusal.json';
import OFFICE_RELEASE_MANIFEST from './fixtures/office-release-manifest.json';
import OFFICE_RELEASES_PAGE from './fixtures/office-releases-page.json';
import { HttpReleaseRepository } from './http-repositories';

const BASE = 'https://api.example.gov.ph/api/v1';
const RELEASES = `${BASE}/office/releases`;
const SESSIONS = `${BASE}/office/release-batches`;
const RELEASE_ID = asId<ReleaseId>(OFFICE_RELEASE.data.id);
const BATCH_ID = asId<ReleaseBatchId>(OFFICE_RELEASE_BATCHES.data[0]?.id ?? '');
const REQUEST = asId<AssistanceRequestId>('8f1e2d3c-4b5a-4968-8776-1a2b3c4d5e02');
const ADMIN = asId<StaffUserId>('0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c01');

/**
 * Releases over the API (`DL-180`): money read and written as integer centavos, goods with no
 * amount, the session counted by the server, the payout list composed by it, and every money write
 * carrying the intent's key in its body — the same key on a retry.
 */
describe('releases over the API (DL-180)', () => {
  let http: HttpTestingController;
  let releases: ReleaseRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiHeadersInterceptor])),
        provideHttpClientTesting(),
        {
          provide: APP_ENVIRONMENT,
          useValue: { apiBaseUrl: BASE, dataSource: 'http', firebaseWebApiKey: 'test-web-api-key' },
        },
        HttpReleaseRepository,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthTokenHolder).hold('fixture-token', null);
    releases = TestBed.inject(HttpReleaseRepository);
  });

  afterEach(() => http.verify());

  it('reads a cursor page: money in centavos, goods with no amount, more said to exist', async () => {
    const page = firstValueFrom(
      releases.list({ status: 'scheduled', openOnly: true }, { limit: 50, cursor: null }),
    );
    const request = http.expectOne((r) => r.url === RELEASES);
    expect(request.request.params.get('status')).toBe('scheduled');
    expect(request.request.params.get('open_only')).toBe('true');
    expect(request.request.params.has('page')).toBe(false);
    expect(request.request.params.has('sort')).toBe(false);
    request.flush(OFFICE_RELEASES_PAGE);

    const answer = await page;
    expect(answer.hasMore).toBe(true);
    const [cash, pack] = answer.items;
    expect(cash?.amount).toEqual(centavos(250_000));
    expect(cash?.inKindDescription).toBeNull();
    expect(cash?.approvedBy).toBe('0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c02');
    expect(pack?.kind).toBe('in-kind');
    expect(pack?.amount).toBeNull();
    expect(pack?.inKindDescription).toContain('rice');
  });

  it('refuses a one-character search before anything is sent', async () => {
    await expect(
      firstValueFrom(releases.list({ search: 'R' }, { limit: 50, cursor: null })),
    ).rejects.toThrow(/2 and 40/);
  });

  it('reads who approved from the server’s record, so the self-release cue compares with it', async () => {
    const approver = firstValueFrom(releases.approverFor(RELEASE_ID));
    http.expectOne(`${RELEASES}/${RELEASE_ID}`).flush(OFFICE_RELEASE);
    expect(await approver).toBe(ADMIN);
    expect(isSelfRelease(await approver, ADMIN)).toBe(true);
  });

  it('reads the queue whole, and every release of a request across its pages', async () => {
    const queue = firstValueFrom(releases.queue({}));
    http.expectOne(`${RELEASES}/queue`).flush({ data: OFFICE_RELEASES_PAGE.data, meta: {} });
    expect((await queue).length).toBe(2);

    const forRequest = firstValueFrom(releases.listForRequest(REQUEST));
    const first = http.expectOne((r) => r.url === RELEASES);
    expect(first.request.params.get('request_id')).toBe(REQUEST);
    first.flush(OFFICE_RELEASES_PAGE);
    const second = http.expectOne((r) => r.url === RELEASES && r.params.has('cursor'));
    second.flush({ data: [], meta: { pagination: { has_more: false, next_cursor: null } } });
    expect((await forRequest).length).toBe(2);
  });

  it('reads a session as counted by the server: no status, only counts', async () => {
    const batches = firstValueFrom(releases.listBatches());
    http.expectOne(SESSIONS).flush(OFFICE_RELEASE_BATCHES);
    const [session] = await batches;
    expect(session?.progress.total).toBe(3);
    expect(session?.progress.totalReleased).toEqual(centavos(250_000));
    // `deferred_only` and `unclaimed`, never the folded `deferred` the wire keeps for old clients
    // (`DL-94`, `DL-186`): the fixture's one deferral-or-no-show is a family that never came.
    expect(session?.progress.deferred).toBe(0);
    expect(session?.progress.unclaimed).toBe(1);
    expect(describeBatch(session?.progress ?? batchProgress([]))).toBe(
      '1 of 3 released, 1 unclaimed, 1 still to release.',
    );
    expect(Object.keys(session ?? {})).not.toContain('status');
  });

  it('reads the payout list the server composed, the acknowledgement column blank', async () => {
    const manifest = firstValueFrom(releases.manifestFor(BATCH_ID));
    http.expectOne(`${SESSIONS}/${BATCH_ID}/manifest`).flush(OFFICE_RELEASE_MANIFEST);
    const sheet = await manifest;
    expect(sheet?.lines.map((line) => line.maskedReference)).toEqual(['••••0014', '••••0016']);
    expect(sheet?.lines.every((line) => line.acknowledgementKind === null)).toBe(true);
    expect(sheet?.moneyTotal).toEqual(centavos(250_000));
    expect(sheet?.inKindLineCount).toBe(1);
  });

  it('prepares with the amount in centavos and the intent’s key in the body', async () => {
    const intent = new WriteIntent();
    const prepared = firstValueFrom(
      releases.prepare(
        {
          requestId: REQUEST,
          kind: 'money',
          method: 'cash',
          amount: centavos(250_050),
          inKindDescription: null,
          fundingSourceLabel: '  AICS augmentation (municipal) ',
          approvingReference: null,
          remarks: '',
        },
        intent,
      ),
    );
    const request = http.expectOne({ method: 'POST', url: RELEASES });
    expect(request.request.body).toEqual({
      request_id: REQUEST,
      kind: 'money',
      method: 'cash',
      amount_centavos: 250_050,
      in_kind_description: null,
      funding_source_label: 'AICS augmentation (municipal)',
      approving_reference: null,
      remarks: null,
      idempotency_key: intent.key,
    });
    // No header carries the key: the CORS policy allows four, and is not widened for it.
    expect(request.request.headers.has('Idempotency-Key')).toBe(false);
    request.flush(OFFICE_RELEASE);
    expect((await prepared).id).toBe(RELEASE_ID);
  });

  it('refuses goods with an amount before anything is sent', async () => {
    await expect(
      firstValueFrom(
        releases.prepare(
          {
            requestId: REQUEST,
            kind: 'in-kind',
            method: 'in-kind',
            amount: centavos(100),
            inKindDescription: 'Rice',
            fundingSourceLabel: null,
            approvingReference: null,
            remarks: null,
          },
          new WriteIntent(),
        ),
      ),
    ).rejects.toThrow(/Nothing was sent/);
  });

  it('sends the same key on a retry of the same act, and reads a reused key’s refusal', async () => {
    const intent = new WriteIntent();
    const draft = {
      title: 'Tuesday payout',
      scheduledFor: asIsoDate('2026-11-10'),
      venue: 'Municipal hall',
      officerId: ADMIN,
      releaseIds: [RELEASE_ID],
      notes: null,
    };
    const first = firstValueFrom(releases.createBatch(draft, intent)).catch((error: unknown) => error);
    http.expectOne({ method: 'POST', url: SESSIONS }).flush(OFFICE_RELEASE_INTENT_REFUSAL, {
      status: 409,
      statusText: 'Conflict',
    });
    const failure = await first;
    expect(failure).toBeInstanceOf(HttpErrorResponse);
    const code = failure instanceof HttpErrorResponse ? readApiError(failure).code : null;
    expect(code).toBe('CONFLICT');

    const retry = firstValueFrom(releases.createBatch(draft, intent));
    const again = http.expectOne({ method: 'POST', url: SESSIONS });
    expect(again.request.body.idempotency_key).toBe(intent.key);
    expect(again.request.body.release_ids).toEqual([RELEASE_ID]);
    expect(Object.keys(again.request.body)).not.toContain('officer_id');
    again.flush({ data: OFFICE_RELEASE_BATCHES.data[0], meta: {} });
    expect((await retry).referenceNumber).toBe('RB-2026-0003');
  });

  it('records the hand-over, the receipt, a deferral and a move, each with its key', async () => {
    const intent = new WriteIntent();
    const acts: [Promise<unknown>, string, Record<string, unknown>][] = [
      [
        firstValueFrom(releases.markReleased(RELEASE_ID, ' AR-000123 ', null, intent)),
        'release',
        { instrument_reference: 'AR-000123', remarks: null },
      ],
      [
        firstValueFrom(
          releases.acknowledge(
            RELEASE_ID,
            { kind: 'representative', collectedBy: 'Ana', authority: 'Letter' },
            intent,
          ),
        ),
        'acknowledgement',
        { kind: 'representative', collected_by: 'Ana', authority: 'Letter' },
      ],
      [
        firstValueFrom(
          releases.deferRelease(RELEASE_ID, 'voucher-error', 'Wrong amount on it.', intent),
        ),
        'deferral',
        { reason: 'voucher-error', remarks: 'Wrong amount on it.' },
      ],
      [
        firstValueFrom(
          releases.changeStatus(RELEASE_ID, 'unclaimed', 'Nobody came before closing.', intent),
        ),
        'status',
        { to: 'unclaimed', reason: 'Nobody came before closing.' },
      ],
    ];
    for (const [, path, body] of acts) {
      const request = http.expectOne({ method: 'POST', url: `${RELEASES}/${RELEASE_ID}/${path}` });
      expect(request.request.body).toEqual({ ...body, idempotency_key: intent.key });
      request.flush(OFFICE_RELEASE);
    }
    await Promise.all(acts.map(([pending]) => pending));
  });

  it('refuses a status move with no reason before anything is sent', async () => {
    await expect(
      firstValueFrom(releases.changeStatus(RELEASE_ID, 'voided', 'no', new WriteIntent())),
    ).rejects.toThrow(/8 characters/);
  });
});
