import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';

import { ApiClient } from './api.client';

const BASE = 'https://api.example.gov.ph/api/v1';

describe('ApiClient against the Node envelope', () => {
  let api: ApiClient;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: `${BASE}/`, dataSource: 'http' } },
      ],
    });

    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads one cursor page with no total, because the server sends none', async () => {
    const page = firstValueFrom(api.cursorPage<string>('news', { limit: 10, cursor: 'c1' }));

    const request = http.expectOne((r) => r.url === `${BASE}/news`);
    expect(request.request.params.get('limit')).toBe('10');
    expect(request.request.params.get('cursor')).toBe('c1');
    request.flush({ data: ['a'], meta: { pagination: { has_more: false, next_cursor: null } } });

    expect(await page).toEqual({ items: ['a'], hasMore: false, nextCursor: null });
  });

  it('reads a whole unpaged list from data', async () => {
    const rows = firstValueFrom(api.list<string>('barangays'));

    http.expectOne(`${BASE}/barangays`).flush({ data: ['x', 'y'], meta: {} });

    expect(await rows).toEqual(['x', 'y']);
  });

  /**
   * A transport failure and a genuine absence are opposite conclusions for a caseworker, and only
   * one of them is safe to act on. Only a 404 is the server saying "not there".
   */
  it('turns only a 404 into an absence', async () => {
    const absent = firstValueFrom(api.optionalItem('offices/missing'));
    http.expectOne(`${BASE}/offices/missing`).flush(null, { status: 404, statusText: 'Not Found' });
    expect(await absent).toBeNull();

    const failed = firstValueFrom(api.optionalItem('offices/broken'));
    http
      .expectOne(`${BASE}/offices/broken`)
      .flush(null, { status: 500, statusText: 'Server Error' });
    await expect(failed).rejects.toBeTruthy();
  });

  /**
   * The API's CORS policy allows four request headers. `Idempotency-Key` is not one of them, so a
   * write carrying it would fail its preflight before reaching the server — and the API does not
   * implement it anyway.
   */
  it('sends a write with no Idempotency-Key', async () => {
    const written = firstValueFrom(api.post<{ ok: boolean }>('notifications/read', {}));

    const request = http.expectOne({ method: 'POST', url: `${BASE}/notifications/read` });
    expect(request.request.headers.has('Idempotency-Key')).toBe(false);
    request.flush({ data: { ok: true }, meta: {} });

    expect(await written).toEqual({ ok: true });
  });
});
