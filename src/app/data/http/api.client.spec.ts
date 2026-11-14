import { HttpEventType, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { QUIET_FAILURE } from '@core/http/quiet-failure';

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

  /**
   * The change feed (`DL-222`). The backend reports each piece of the body as a progress event
   * whose `partialText` is everything so far; the stream passes on only what is new.
   */
  describe('stream', () => {
    it('passes on only the new text of each progress event, and the rest at the end', () => {
      const seen: string[] = [];
      let completed = false;
      api.stream('changes').subscribe({
        next: (chunk) => seen.push(chunk),
        complete: () => (completed = true),
      });

      const first = 'retry: 5000\n';
      const second = `${first}: connected\n\n`;
      const whole = `${second}: ping\n`;
      const request = http.expectOne(`${BASE}/changes`);
      request.event({ type: HttpEventType.DownloadProgress, loaded: 12, partialText: first });
      request.event({ type: HttpEventType.DownloadProgress, loaded: 12, partialText: first });
      request.event({ type: HttpEventType.DownloadProgress, loaded: 26, partialText: second });
      // The end of the body: the whole text, and the stream completes.
      request.flush(whole);

      expect(seen).toEqual([first, ': connected\n\n', ': ping\n']);
      expect(completed).toBe(true);
    });

    it('asks for an event stream by path alone, quietly, with no query string', () => {
      api.stream('changes').subscribe();

      const { request } = http.expectOne(`${BASE}/changes`);
      expect(request.method).toBe('GET');
      expect(request.headers.get('Accept')).toBe('text/event-stream');
      expect(request.params.keys()).toEqual([]);
      expect(request.urlWithParams).toBe(`${BASE}/changes`);
      expect(request.responseType).toBe('text');
      expect(request.reportProgress).toBe(true);
      expect(request.context.get(QUIET_FAILURE)).toBe(true);
    });

    it('starts counting afresh for each subscription', () => {
      const first: string[] = [];
      const second: string[] = [];
      api.stream('changes').subscribe((chunk) => first.push(chunk));
      api.stream('changes').subscribe((chunk) => second.push(chunk));

      const [one, two] = http.match(`${BASE}/changes`);
      one?.event({ type: HttpEventType.DownloadProgress, loaded: 3, partialText: 'abc' });
      two?.event({ type: HttpEventType.DownloadProgress, loaded: 2, partialText: 'ab' });

      expect(first).toEqual(['abc']);
      expect(second).toEqual(['ab']);
    });
  });
});
