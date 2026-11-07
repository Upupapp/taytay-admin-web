import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import { apiHeadersInterceptor } from '@core/http/api.interceptors';
import {
  ASSISTANCE_HISTORY_NOT_YOURS,
  PROGRAMME_MEMBERSHIP_NOT_RECORDED,
  PROGRAM_UTILIZATION_NOT_YOURS,
  asId,
  isResolutionInvalid,
  type BarangayId,
  type DuplicatePairId,
  type IsoDate,
  type ProgramId,
  type ResidentId,
} from '@domain/index';

import OFFICE_ASSISTANCE_HISTORY from './fixtures/office-assistance-history.json';
import OFFICE_ASSISTANCE_HISTORY_WITHHELD from './fixtures/office-assistance-history-withheld.json';
import OFFICE_BENEFICIARIES_PAGE from './fixtures/office-beneficiaries-page.json';
import OFFICE_BENEFICIARY from './fixtures/office-beneficiary.json';
import OFFICE_DUPLICATE_PAIRS_PAGE from './fixtures/office-duplicate-pairs-page.json';
import OFFICE_HOUSEHOLD from './fixtures/office-household.json';
import OFFICE_IDENTITY_FINDING from './fixtures/office-identity-finding.json';
import OFFICE_IDENTITY_PREVIEW from './fixtures/office-identity-preview.json';
import OFFICE_PROGRAM_UTILIZATION from './fixtures/office-program-utilization.json';
import OFFICE_PROGRAM_UTILIZATION_WITHHELD from './fixtures/office-program-utilization-withheld.json';
import OFFICE_RESIDENT from './fixtures/office-resident.json';
import OFFICE_RESIDENT_FAMILIES from './fixtures/office-resident-families.json';
import {
  HttpBeneficiaryRepository,
  HttpProgramRepository,
  HttpResidentRepository,
} from './http-repositories';

const BASE = 'https://api.example.gov.ph/api/v1';
const DOLORES_API = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01';
const BARANGAYS = {
  data: [{ id: DOLORES_API, code: 'dolores', name: 'Dolores' }],
  meta: {},
};
const DOLORES = asId<BarangayId>('brgy-dolores');
const MARIA = asId<ResidentId>('7d1c2b3a-4e5f-4a6b-8c7d-8e9f0a1b2c03');
const MARIE = asId<ResidentId>('7d1c2b3a-4e5f-4a6b-8c7d-8e9f0a1b2c09');
const PAIR = asId<DuplicatePairId>('9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c01');
const HOUSEHOLD_ID = '3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e01';
const day = (value: string): IsoDate => asId<IsoDate>(value);
const MEDICAL = asId<ProgramId>('4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f01');

/**
 * The beneficiary registry over the API (`DL-187`): a projection keyed on the resident's id, the
 * history read whole or not at all, nothing the API cannot answer asked of it, and no merge.
 */
describe('the beneficiary registry over the API (DL-187)', () => {
  let http: HttpTestingController;
  let registry: HttpBeneficiaryRepository;

  const barangays = (): void => {
    http.expectOne({ method: 'GET', url: `${BASE}/barangays` }).flush(BARANGAYS);
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
        HttpBeneficiaryRepository,
        HttpResidentRepository,
        HttpProgramRepository,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthTokenHolder).hold('fixture-token', null);
    registry = TestBed.inject(HttpBeneficiaryRepository);
  });

  afterEach(() => http.verify());

  it('sends the filter in the API’s words and reads each row as the server derived it', async () => {
    const read = firstValueFrom(
      registry.list(
        {
          search: 'dela',
          barangayId: DOLORES,
          role: 'beneficiary',
          receivedFrom: day('2026-10-01'),
          receivedTo: day('2026-10-31'),
          withOpenDuplicateReview: true,
        },
        { limit: 20, cursor: null },
      ),
    );
    barangays();
    const request = http.expectOne((r) => r.url === `${BASE}/office/beneficiaries`);
    const params = request.request.params;
    expect(params.get('q')).toBe('dela');
    expect(params.get('barangay_id')).toBe(DOLORES_API);
    expect(params.get('role')).toBe('beneficiary');
    expect(params.get('received_from')).toBe('2026-10-01');
    expect(params.get('received_to')).toBe('2026-10-31');
    expect(params.get('with_open_duplicate_review')).toBe('true');
    // No sort and no page number: the registry is alphabetical, a cursor at a time (DL-161).
    expect(params.has('sort')).toBe(false);
    expect(params.has('page')).toBe(false);
    request.flush(OFFICE_BENEFICIARIES_PAGE);

    const page = await read;
    expect(page.hasMore).toBe(true);
    const [row] = page.items;
    expect(row?.residentId).toBe(MARIA);
    expect(row?.barangayId).toBe(DOLORES);
    expect(row?.standing.roles).toEqual(['constituent', 'beneficiary']);
    expect(row?.standing.evidence.currentEnrollmentCount).toBeNull();
    // Not recorded is null, never an empty list that says "on no programme".
    expect(row?.currentProgramNames).toBeNull();
    expect(row?.totalReleased).toEqual({ centavos: 250000, currency: 'PHP' });
    expect(row?.goodsReceivedCount).toBe(1);
    expect(row?.hasOpenDuplicateReview).toBe(true);
  });

  it('refuses in words, and sends nothing, what the API cannot answer', async () => {
    await expect(
      firstValueFrom(registry.list({ programId: MEDICAL }, { limit: 20, cursor: null })),
    ).rejects.toThrow(PROGRAMME_MEMBERSHIP_NOT_RECORDED);
    await expect(
      firstValueFrom(registry.list({ role: 'enrollee' }, { limit: 20, cursor: null })),
    ).rejects.toThrow(PROGRAMME_MEMBERSHIP_NOT_RECORDED);
    await expect(
      firstValueFrom(
        registry.list(
          { receivedFrom: day('2026-10-31'), receivedTo: day('2026-10-01') },
          { limit: 20, cursor: null },
        ),
      ),
    ).rejects.toThrow(/after the "to" date/);
  });

  it('refuses the whole page when one row cannot be read, rather than leaving a person out', async () => {
    const read = firstValueFrom(registry.list({}, { limit: 20, cursor: null }));
    barangays();
    const [row] = OFFICE_BENEFICIARIES_PAGE.data;
    http
      .expectOne((r) => r.url === `${BASE}/office/beneficiaries`)
      .flush({ ...OFFICE_BENEFICIARIES_PAGE, data: [{ ...row, released_centavos: 2500.5 }] });
    await expect(read).rejects.toThrow(/none is shown rather than some/);
  });

  it('reads one record, its household and families from their own registers, and keeps membership null', async () => {
    const read = firstValueFrom(registry.getByResidentId(MARIA));
    barangays();
    http.expectOne(`${BASE}/office/beneficiaries/${MARIA}`).flush(OFFICE_BENEFICIARY);
    http.expectOne(`${BASE}/office/households/${HOUSEHOLD_ID}`).flush(OFFICE_HOUSEHOLD);
    http.expectOne(`${BASE}/office/residents/${MARIA}/families`).flush(OFFICE_RESIDENT_FAMILIES);

    const record = await read;
    expect(record?.enrollments).toBeNull();
    expect(record?.household?.id).toBe(HOUSEHOLD_ID);
    expect(record?.householdHeadName).toBe('Maria S. Dela Cruz');
    expect(record?.families.map((family) => family.name)).toEqual(['Dela Cruz family']);
    expect(record?.requests).toHaveLength(2);
    expect(record?.payouts.map((payout) => payout.amount)).toEqual([
      { centavos: 250000, currency: 'PHP' },
      null,
    ]);
    expect(record?.totalReleased).toEqual({ centavos: 250000, currency: 'PHP' });
    expect(record?.goodsReceivedCount).toBe(1);
    // Two filings, two releases handed over, a referral made and answered.
    expect(record?.timeline).toHaveLength(6);
    const [candidate] = record?.duplicateCandidates ?? [];
    expect(candidate?.pairId).toBe(PAIR);
    expect(candidate?.signals.every((signal) => Object.keys(signal).length === 3)).toBe(true);
  });

  it('answers "not found or not yours" as null', async () => {
    const read = firstValueFrom(registry.getByResidentId(MARIE));
    barangays();
    http
      .expectOne(`${BASE}/office/beneficiaries/${MARIE}`)
      .flush(
        {
          error: {
            code: 'NOT_FOUND',
            message: 'That record was not found.',
            details: {},
            request_id: 'r',
          },
        },
        { status: 404, statusText: 'Not Found' },
      );
    expect(await read).toBeNull();
  });

  it('pages the queue, runs a detection with no body, and previews the record it was asked about', async () => {
    const queue = firstValueFrom(registry.duplicateQueue({ limit: 20, cursor: null }));
    http
      .expectOne((r) => r.url === `${BASE}/office/duplicate-pairs`)
      .flush(OFFICE_DUPLICATE_PAIRS_PAGE);
    const page = await queue;
    expect(page.hasMore).toBe(false);
    expect(page.items[0]?.strength).toBe('strong');

    const detect = firstValueFrom(registry.detectDuplicates());
    const run = http.expectOne(`${BASE}/office/duplicate-pairs/detect`);
    expect(run.request.method).toBe('POST');
    expect(run.request.body).toEqual({});
    run.flush({ data: { open_pairs: 3, new_pairs: 1 }, meta: {} });
    expect(await detect).toBe(3);

    const preview = firstValueFrom(registry.previewResolution(PAIR, MARIA, MARIE));
    const asked = http.expectOne((r) => r.url === `${BASE}/office/duplicate-pairs/${PAIR}/preview`);
    expect(asked.request.params.get('canonical_resident_id')).toBe(MARIA);
    asked.flush(OFFICE_IDENTITY_PREVIEW);
    expect((await preview).movingEnrollmentCount).toBeNull();

    const wrong = firstValueFrom(registry.previewResolution(PAIR, MARIA, MARIA));
    http
      .expectOne((r) => r.url === `${BASE}/office/duplicate-pairs/${PAIR}/preview`)
      .flush(OFFICE_IDENTITY_PREVIEW);
    await expect(wrong).rejects.toThrow(/not the other one of this pair/);
  });

  it('records a finding with its reason, and refuses an incoherent one before sending it', async () => {
    const distinct = firstValueFrom(
      registry.resolveIdentity({
        pairId: PAIR,
        verdict: 'same-person',
        pair: [MARIA, MARIE],
        canonicalResidentId: MARIA,
        reason: '  Same birth date and barangay.  ',
      }),
    );
    const decide = http.expectOne(`${BASE}/office/duplicate-pairs/${PAIR}/decide`);
    expect(decide.request.body).toEqual({
      verdict: 'same-person',
      canonical_resident_id: MARIA,
      reason: 'Same birth date and barangay.',
    });
    decide.flush(OFFICE_IDENTITY_FINDING, { status: 201, statusText: 'Created' });
    const finding = await distinct;
    expect(finding.supersededResidentId).toBe(MARIE);
    expect(finding.pair).toEqual([MARIA, MARIE]);

    const refused = firstValueFrom(
      registry.resolveIdentity({
        pairId: PAIR,
        verdict: 'same-person',
        pair: [MARIA, MARIE],
        canonicalResidentId: null,
        reason: '',
      }),
    );
    await expect(refused).rejects.toSatisfy(isResolutionInvalid);
  });

  it('reads a resident’s history from the server’s one assembly, and keeps its sentence when withheld', async () => {
    const residents = TestBed.inject(HttpResidentRepository);
    const empty = { data: [], meta: { pagination: { has_more: false, next_cursor: null } } };

    const read = firstValueFrom(residents.getProfile(MARIA));
    barangays();
    http.expectOne(`${BASE}/office/residents/${MARIA}`).flush(OFFICE_RESIDENT);
    http.expectOne((r) => r.url === `${BASE}/office/households`).flush(empty);
    http
      .expectOne(`${BASE}/office/residents/${MARIA}/assistance-history`)
      .flush(OFFICE_ASSISTANCE_HISTORY);
    const profile = await read;
    expect(profile?.history.kind).toBe('read');
    if (profile?.history.kind === 'read') {
      expect(profile.history.history.goodsReceivedCount).toBe(1);
      expect(profile.history.history.payouts).toHaveLength(2);
    }

    const withheld = firstValueFrom(residents.getProfile(MARIA));
    http.expectOne(`${BASE}/office/residents/${MARIA}`).flush(OFFICE_RESIDENT);
    http.expectOne((r) => r.url === `${BASE}/office/households`).flush(empty);
    http
      .expectOne(`${BASE}/office/residents/${MARIA}/assistance-history`)
      .flush(OFFICE_ASSISTANCE_HISTORY_WITHHELD);
    expect((await withheld)?.history).toEqual({
      kind: 'unavailable',
      because: ASSISTANCE_HISTORY_NOT_YOURS,
    });
  });

  it('reads utilization counted from releases, goods apart, and keeps the sentence for a reader not shown it', async () => {
    const programs = TestBed.inject(HttpProgramRepository);
    const all = firstValueFrom(programs.utilizationSummary());
    http.expectOne(`${BASE}/office/program-utilization`).flush(OFFICE_PROGRAM_UTILIZATION);
    const summary = await all;
    expect(summary.kind).toBe('read');
    if (summary.kind === 'read') {
      expect(summary.rows[1]).toEqual({
        programId: '4d5e6f7a-8b9c-4d0e-8f1a-2b3c4d5e6f02',
        releaseCount: 40,
        releasedTotal: { centavos: 0, currency: 'PHP' },
        goodsCount: 40,
        isWithheld: false,
      });
    }

    const one = firstValueFrom(programs.utilizationFor(MEDICAL));
    http
      .expectOne(`${BASE}/office/program-utilization/${MEDICAL}`)
      .flush({
        data: { readable: true, utilization: OFFICE_PROGRAM_UTILIZATION.data.rows[0] },
        meta: {},
      });
    expect((await one).kind).toBe('read');

    const refused = firstValueFrom(programs.utilizationSummary());
    http.expectOne(`${BASE}/office/program-utilization`).flush(OFFICE_PROGRAM_UTILIZATION_WITHHELD);
    expect(await refused).toEqual({ kind: 'unavailable', because: PROGRAM_UTILIZATION_NOT_YOURS });
  });
});
