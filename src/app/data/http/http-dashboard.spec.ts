import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import { apiHeadersInterceptor } from '@core/http/api.interceptors';
import { asId, type BarangayId, type DashboardRepository } from '@domain/index';

import OFFICE_DASHBOARD from './fixtures/office-dashboard.json';
import OFFICE_DASHBOARD_INTAKE from './fixtures/office-dashboard-intake.json';
import { HttpDashboardRepository } from './http-repositories';

const BASE = 'https://api.example.gov.ph/api/v1';
const DASHBOARD = `${BASE}/office/dashboard`;
const DOLORES_API = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01';
const SAN_JUAN_API = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c04';
const BARANGAYS = {
  data: [
    { id: DOLORES_API, code: 'dolores', name: 'Dolores' },
    { id: SAN_JUAN_API, code: 'san-juan', name: 'San Juan' },
  ],
  meta: {},
};
const DOLORES = asId<BarangayId>('brgy-dolores');
const SAN_JUAN = asId<BarangayId>('brgy-san-juan');

/**
 * The dashboard over the API (`DL-182`): the filter goes out joined to the API's barangay ids, the
 * figures come back whole or not at all, and a group the reader's lists refuse stays absent.
 */
describe('the dashboard over the API (DL-182)', () => {
  let http: HttpTestingController;
  let dashboard: DashboardRepository;

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
        HttpDashboardRepository,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthTokenHolder).hold('fixture-token', null);
    dashboard = TestBed.inject(HttpDashboardRepository);
  });

  afterEach(() => http.verify());

  it('sends the filter in the API’s words, its barangay joined to the API’s id', async () => {
    const read = firstValueFrom(
      dashboard.summary({
        barangayId: SAN_JUAN,
        category: 'medical-assistance',
        period: 'last-30-days',
      }),
    );
    barangays();
    const request = http.expectOne((r) => r.url === DASHBOARD);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('barangay_id')).toBe(SAN_JUAN_API);
    expect(request.request.params.get('category')).toBe('medical-assistance');
    expect(request.request.params.get('period')).toBe('last-30-days');
    request.flush(OFFICE_DASHBOARD);
    await read;
  });

  it('sends nothing it was not given', async () => {
    const read = firstValueFrom(dashboard.summary({}));
    barangays();
    const request = http.expectOne((r) => r.url === DASHBOARD);
    expect(request.request.params.keys()).toEqual([]);
    request.flush(OFFICE_DASHBOARD);
    await read;
  });

  it('reads every figure: centavos as centavos, goods as a count, barangays as the console’s', async () => {
    const read = firstValueFrom(dashboard.summary({}));
    barangays();
    http.expectOne((r) => r.url === DASHBOARD).flush(OFFICE_DASHBOARD);
    const summary = await read;

    expect(summary.appliedFilter).toEqual({ period: 'last-30-days' });
    expect(summary.openRequests).toBe(3);
    expect(summary.awaitingApproval).toBe(1);
    expect(summary.requestsByBarangay).toEqual([
      { barangayId: SAN_JUAN, count: 2 },
      { barangayId: DOLORES, count: 1 },
    ]);
    expect(summary.attention.map((signal) => signal.kind)).toEqual([
      'awaiting-approval',
      'missing-requirements',
    ]);
    expect(summary.attention.every((signal) => signal.basis.length > 0)).toBe(true);

    expect(summary.payouts?.disbursedInPeriod).toEqual({ centavos: 373_457, currency: 'PHP' });
    expect(summary.payouts?.goodsReleasedInPeriod).toBe(1);
    expect(summary.payouts?.residentsServedInPeriod).toBe(3);
    expect(summary.payouts?.disbursedByCategory).toContainEqual({
      category: 'food-and-relief',
      amount: { centavos: 0, currency: 'PHP' },
      count: 0,
      goodsCount: 1,
    });

    expect(summary.residentApp).toEqual({
      accounts: {
        registered: 4,
        registeredInPeriod: 2,
        byVerification: { unverified: 1, pending: 1, verified: 1, rejected: 1 },
      },
      verificationsWaiting: 1,
      digitalIdsActive: 1,
    });
  });

  it('keeps an absent group absent, never zero', async () => {
    const read = firstValueFrom(dashboard.summary({ barangayId: DOLORES }));
    barangays();
    http.expectOne((r) => r.url === DASHBOARD).flush(OFFICE_DASHBOARD_INTAKE);
    const summary = await read;

    expect(summary.payouts).toBeNull();
    expect(summary.residentApp).toBeNull();
    expect(summary.appliedFilter).toEqual({
      barangayId: DOLORES,
      category: 'medical-assistance',
      period: 'all-time',
    });
  });

  it('refuses a barangay the API does not know, before anything is sent', async () => {
    const read = firstValueFrom(dashboard.summary({ barangayId: asId<BarangayId>('brgy-muzon') }));
    barangays();
    http.expectNone((r) => r.url === DASHBOARD);
    await expect(read).rejects.toThrow(/barangay/);
  });

  it('refuses the whole summary rather than a total missing what it could not read', async () => {
    const unplaced = structuredClone(OFFICE_DASHBOARD);
    unplaced.data.requests.by_barangay.push({
      barangay_id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c99',
      count: 4,
    });
    const bare = structuredClone(OFFICE_DASHBOARD);
    const [first] = bare.data.attention;
    if (first !== undefined) {
      first.basis = '';
    }
    const valued = structuredClone(OFFICE_DASHBOARD);
    const [category] = valued.data.payouts.by_category;
    if (category !== undefined) {
      category.amount_centavos = 1234.5;
    }

    for (const answer of [unplaced, bare, valued]) {
      const read = firstValueFrom(dashboard.summary({}));
      // The barangay join is read once per adapter.
      if (answer === unplaced) {
        barangays();
      }
      http.expectOne((r) => r.url === DASHBOARD).flush(answer);
      await expect(read).rejects.toThrow(/could not be read/);
    }
  });
});
