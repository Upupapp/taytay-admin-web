import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  HttpAppAccountRepository,
  HttpAssistanceRequestRepository,
  HttpReleaseRepository,
} from '@data/http/http-repositories';
import { asId, type BarangayId, type DashboardFilter } from '@domain/index';
import { readAccountFilter } from '@features/accounts/accounts-page';
import { readReleaseQuery } from '@features/releases/release-list-page';
import { readRequestQuery } from '@features/requests/request-list-page';

import {
  attentionDrillDown,
  barangayDrillDown,
  categoryDrillDown,
  handedOverDrillDown,
  requestsDrillDown,
  statusDrillDown,
  verificationDrillDown,
  type DrillDown,
} from './dashboard-drill-down';

const BASE = 'https://api.example.gov.ph/api/v1';
const DOLORES_API = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01';
const SAN_JUAN_API = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c04';
const BARANGAYS = {
  data: [
    { id: DOLORES_API, code: 'dolores', name: 'Dolores' },
    { id: SAN_JUAN_API, code: 'san-juan', name: 'San Juan' },
  ],
  meta: {},
};
const EMPTY_PAGE = { data: [], meta: { pagination: { has_more: false, next_cursor: null } } };

/** What every dashboard figure is counted under, when somebody has narrowed it. */
const FILTER: DashboardFilter = {
  barangayId: asId<BarangayId>('brgy-dolores'),
  category: 'medical-assistance',
  period: 'last-30-days',
};

const reader = (drill: DrillDown) => ({
  get: (name: string): string | null => drill.queryParams[name] ?? null,
});

/**
 * Every dashboard figure opens a list filtered to exactly that figure (`DL-186`): the link's query
 * parameters, read by the list it opens, reach the request the list sends — the whole path from the
 * figure to the server, so a key renamed anywhere along it fails here rather than filtering nothing.
 */
describe('a dashboard figure’s narrowing reaches the request its list sends (DL-186)', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: APP_ENVIRONMENT,
          useValue: { apiBaseUrl: BASE, dataSource: 'http', firebaseWebApiKey: 'test-web-api-key' },
        },
        HttpAssistanceRequestRepository,
        HttpReleaseRepository,
        HttpAppAccountRepository,
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  /** The barangay list, read once per adapter and kept: answered when it is asked for. */
  function barangays(): void {
    for (const request of http.match(`${BASE}/barangays`)) {
      request.flush(BARANGAYS);
    }
  }

  /** Opens the request list as the link would, and returns the parameters it sent. */
  async function requestParams(drill: DrillDown): Promise<URLSearchParams> {
    expect(drill.route).toBe('/assistance-requests');
    const page = firstValueFrom(
      TestBed.inject(HttpAssistanceRequestRepository).list(readRequestQuery(reader(drill)).filter, {
        limit: 20,
        cursor: null,
      }),
    );
    barangays();
    const request = http.expectOne((r) => r.url === `${BASE}/office/assistance-requests`);
    const sent = new URLSearchParams(request.request.params.toString());
    request.flush(EMPTY_PAGE);
    await page;
    return sent;
  }

  /** Opens the release list as the link would, and returns the parameters it sent. */
  async function releaseParams(drill: DrillDown): Promise<URLSearchParams> {
    expect(drill.route).toBe('/releases');
    const filter = readReleaseQuery(reader(drill)).filter;
    const page = firstValueFrom(
      TestBed.inject(HttpReleaseRepository).list(filter, { limit: 50, cursor: null }),
    );
    barangays();
    const request = http.expectOne((r) => r.url === `${BASE}/office/releases`);
    const sent = new URLSearchParams(request.request.params.toString());
    request.flush(EMPTY_PAGE);
    await page;
    return sent;
  }

  it('sends the open-requests figure as open, in its barangay and programme type', async () => {
    const sent = await requestParams(requestsDrillDown(FILTER, { open: 'true' }));
    expect(sent.get('open_only')).toBe('true');
    expect(sent.get('barangay_id')).toBe(DOLORES_API);
    expect(sent.get('category')).toBe('medical-assistance');
    // Request figures are not counted by period: none is sent.
    expect(sent.has('period')).toBe(false);
  });

  it('sends "missing requirements" as owing a document, with the same narrowings', async () => {
    const sent = await requestParams(attentionDrillDown('missing-requirements', FILTER));
    expect(sent.get('owing_document')).toBe('true');
    expect(sent.get('open_only')).toBe('true');
    expect(sent.get('category')).toBe('medical-assistance');
    expect(sent.get('barangay_id')).toBe(DOLORES_API);
  });

  it('sends a status row and a barangay row with the row’s own value', async () => {
    const byStatus = await requestParams(statusDrillDown(FILTER, 'endorsed'));
    expect(byStatus.get('status')).toBe('endorsed');
    expect(byStatus.get('category')).toBe('medical-assistance');

    const byBarangay = await requestParams(
      barangayDrillDown(FILTER, asId<BarangayId>('brgy-san-juan')),
    );
    expect(byBarangay.get('barangay_id')).toBe(SAN_JUAN_API);
  });

  it('sends the released amount as handed over in the period, in its barangay and type', async () => {
    const sent = await releaseParams(handedOverDrillDown(FILTER));
    expect(sent.get('status_group')).toBe('handed-over');
    expect(sent.get('period')).toBe('last-30-days');
    expect(sent.get('barangay_id')).toBe(DOLORES_API);
    expect(sent.get('category')).toBe('medical-assistance');
    // Not `status=released`, which dropped what was claimed or completed.
    expect(sent.has('status')).toBe(false);
  });

  it('sends a programme row of the money table as that type, handed over in the period', async () => {
    const sent = await releaseParams(categoryDrillDown(FILTER, 'burial-assistance'));
    expect(sent.get('category')).toBe('burial-assistance');
    expect(sent.get('status_group')).toBe('handed-over');
    expect(sent.get('period')).toBe('last-30-days');
  });

  it('sends the payouts due and the unclaimed by status, with no period, as they are counted', async () => {
    const due = await releaseParams(attentionDrillDown('payout-due', FILTER));
    expect(due.get('status')).toBe('scheduled');
    expect(due.get('barangay_id')).toBe(DOLORES_API);
    expect(due.get('category')).toBe('medical-assistance');
    expect(due.has('period')).toBe(false);

    const unclaimed = await releaseParams(attentionDrillDown('unclaimed-payout', {}));
    expect(unclaimed.get('status')).toBe('unclaimed');
    expect(unclaimed.has('barangay_id')).toBe(false);
  });

  it('sends "all time" as nothing at all, because it narrows nothing', async () => {
    const sent = await releaseParams(handedOverDrillDown({ period: 'all-time' }));
    expect(sent.get('status_group')).toBe('handed-over');
    expect(sent.has('period')).toBe(false);
  });

  it('sends each verification row as its own status to the account list', async () => {
    for (const status of ['unverified', 'pending', 'verified', 'rejected'] as const) {
      const drill = verificationDrillDown(status);
      expect(drill.route).toBe('/users');
      const page = firstValueFrom(
        TestBed.inject(HttpAppAccountRepository).list(
          { limit: 20, cursor: null },
          readAccountFilter(reader(drill)),
        ),
      );
      const request = http.expectOne((r) => r.url === `${BASE}/admin/users`);
      expect(request.request.params.get('verification_status')).toBe(status);
      request.flush(EMPTY_PAGE);
      await page;
    }
  });
});
