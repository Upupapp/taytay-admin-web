import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import { apiHeadersInterceptor } from '@core/http/api.interceptors';
import {
  asId,
  ISSUANCE_OPEN_STATUSES,
  type IssuanceAttachmentId,
  type IssuanceRepository,
  type IssuanceRequestId,
  type IssuanceTypeId,
} from '@domain/index';

import ISSUANCE_FILE_GRANT from './fixtures/issuance-file-grant.json';
import ISSUANCE_TYPES from './fixtures/issuance-types.json';
import OFFICE_ISSUANCE_REQUEST from './fixtures/office-issuance-request.json';
import OFFICE_ISSUANCE_REQUESTS_PAGE from './fixtures/office-issuance-requests-page.json';
import OFFICE_ISSUANCE_TYPE_RETIRED from './fixtures/office-issuance-type-retired.json';
import { HttpIssuanceRepository } from './http-repositories';

const BASE = 'https://api.example.gov.ph/api/v1';
const REQUESTS = `${BASE}/office/issuance-requests`;
const TYPES = `${BASE}/office/issuance-types`;
const REQUEST_ID = asId<IssuanceRequestId>(OFFICE_ISSUANCE_REQUEST.data.id);
const TYPE_ID = asId<IssuanceTypeId>('7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e02');
const LAST_PAGE = {
  ...OFFICE_ISSUANCE_REQUESTS_PAGE,
  meta: { pagination: { has_more: false, next_cursor: null } },
};

/**
 * Residents' document requests over the API (`DL-184`): the queue read whole across the open
 * statuses, an ended status a page at a time, every write through its mapper, and a file opened in
 * two acts with the handle in a body.
 */
describe('residents’ document requests over the API (DL-184)', () => {
  let http: HttpTestingController;
  let repository: IssuanceRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiHeadersInterceptor])),
        provideHttpClientTesting(),
        {
          provide: APP_ENVIRONMENT,
          useValue: { apiBaseUrl: BASE, dataSource: 'http', firebaseWebApiKey: 'test-web-api-key' },
        },
        HttpIssuanceRepository,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthTokenHolder).hold('fixture-token', null);
    repository = TestBed.inject(HttpIssuanceRepository);
  });

  afterEach(() => http.verify());

  it('reads the queue whole: every open status, every page, never a partial list', async () => {
    const answer = firstValueFrom(repository.waiting({ status: null, typeId: TYPE_ID }));
    const first = http.match((r) => r.url === REQUESTS);
    expect(first.map((r) => r.request.params.get('status'))).toEqual([...ISSUANCE_OPEN_STATUSES]);
    for (const request of first) {
      expect(request.request.params.get('type_id')).toBe(TYPE_ID);
      expect(request.request.params.get('limit')).toBe('50');
      expect(request.request.params.has('page')).toBe(false);
    }
    // The first status has a second page; the cursor is followed rather than the list cut short.
    first[0]?.flush(OFFICE_ISSUANCE_REQUESTS_PAGE);
    for (const request of first.slice(1)) {
      request.flush({ data: [], meta: { pagination: { has_more: false, next_cursor: null } } });
    }
    const next = http.expectOne((r) => r.url === REQUESTS);
    expect(next.request.params.get('cursor')).toBe('eyJjIjoiMjAyNi0xMS0wMiJ9');
    next.flush(LAST_PAGE);

    expect((await answer).map((row) => row.referenceNumber)).toEqual([
      'DR-2026-000012',
      'DR-2026-000009',
      'DR-2026-000012',
      'DR-2026-000009',
    ]);
  });

  it('browses an ended status a page at a time, and says more exist', async () => {
    const page = firstValueFrom(
      repository.list({ status: 'released', typeId: null }, { limit: 20, cursor: null }),
    );
    const request = http.expectOne((r) => r.url === REQUESTS);
    expect(request.request.params.get('status')).toBe('released');
    expect(request.request.params.has('type_id')).toBe(false);
    expect(request.request.params.has('sort')).toBe(false);
    request.flush(OFFICE_ISSUANCE_REQUESTS_PAGE);

    const answer = await page;
    expect(answer.items).toHaveLength(2);
    expect(answer.hasMore).toBe(true);
  });

  it('moves a request with the words the resident reads, and claim details only to mark it ready', async () => {
    const moved = firstValueFrom(
      repository.move(REQUEST_ID, {
        to: 'ready-for-pickup',
        reason: 'Your certificate is ready.',
        claimDetails: 'MSWDO counter, weekdays 8:00 to 17:00.',
      }),
    );
    const request = http.expectOne(`${REQUESTS}/${REQUEST_ID}/status`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      to: 'ready-for-pickup',
      reason: 'Your certificate is ready.',
      claim_details: 'MSWDO counter, weekdays 8:00 to 17:00.',
    });
    request.flush(OFFICE_ISSUANCE_REQUEST);
    expect((await moved).referenceNumber).toBe('DR-2026-000007');
  });

  it('opens a file in two acts: a grant with its warning, then the bytes for its handle', async () => {
    const attachment = asId<IssuanceAttachmentId>(ISSUANCE_FILE_GRANT.data.attachment_id);
    const granted = firstValueFrom(repository.grantAttachment(REQUEST_ID, attachment));
    const access = http.expectOne(`${REQUESTS}/${REQUEST_ID}/attachments/${attachment}/access`);
    expect(access.request.method).toBe('POST');
    expect(access.request.body).toEqual({});
    access.flush(ISSUANCE_FILE_GRANT, { status: 201, statusText: 'Created' });
    const grant = await granted;
    expect(grant.warning).toMatch(/RA 10173/);

    const bytes = firstValueFrom(repository.readAttachment(grant));
    const file = http.expectOne(`${BASE}/office/issuance-files`);
    expect(file.request.body).toEqual({ handle: ISSUANCE_FILE_GRANT.data.handle });
    expect(file.request.urlWithParams).not.toContain(ISSUANCE_FILE_GRANT.data.handle);
    expect(file.request.responseType).toBe('blob');
    file.flush(new Blob(['%PDF'], { type: 'application/pdf' }));
    expect((await bytes).type).toBe('application/pdf');
  });

  it('keeps the catalogue: the public list, and the office’s writes each with a reason', async () => {
    const catalogue = firstValueFrom(repository.catalogue());
    http.expectOne(`${BASE}/issuance-types`).flush(ISSUANCE_TYPES);
    expect((await catalogue).map((type) => type.name)).toEqual([
      'Certificate of residency for assistance',
      'Solo parent certification',
    ]);

    const changed = firstValueFrom(
      repository.updateType(TYPE_ID, { processingDays: 5, reason: 'The charter was revised.' }),
    );
    const patch = http.expectOne(`${TYPES}/${TYPE_ID}`);
    expect(patch.request.method).toBe('PATCH');
    expect(JSON.parse(JSON.stringify(patch.request.body))).toEqual({
      processing_days: 5,
      reason: 'The charter was revised.',
    });
    patch.flush(OFFICE_ISSUANCE_TYPE_RETIRED);
    await changed;

    const retired = firstValueFrom(repository.retireType(TYPE_ID, 'Replaced by a new form.'));
    const retire = http.expectOne(`${TYPES}/${TYPE_ID}/retire`);
    expect(retire.request.body).toEqual({ reason: 'Replaced by a new form.' });
    retire.flush(OFFICE_ISSUANCE_TYPE_RETIRED);
    expect((await retired).active).toBe(false);
  });

  it('refuses a request it cannot read in full rather than show part of its history', async () => {
    const read = firstValueFrom(repository.request(REQUEST_ID));
    http
      .expectOne(`${REQUESTS}/${REQUEST_ID}`)
      .flush({ data: { ...OFFICE_ISSUANCE_REQUEST.data, history: [{}] }, meta: {} });
    await expect(read).rejects.toThrow(/could not be read in full/);
  });
});
