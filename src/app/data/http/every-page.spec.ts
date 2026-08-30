import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';

import { ApiClient } from './api.client';

const BASE = 'https://api.example.gov.ph/api/v1';

/**
 * `everyPage` exists because 25 rows is what this API gives a request that did not ask, and for a
 * **picker** that is not a missing page — it is a wrong answer. An intake officer who cannot see a
 * programme in a dropdown concludes the office does not run it (`DL-161`).
 */
describe('reading every page of a list somebody picks from', () => {
  let api: ApiClient;
  let http: HttpTestingController;

  const answer = (page: number, totalPages: number, items: readonly unknown[]) => ({
    data: items,
    meta: {
      request_id: 'r',
      pagination: { page, per_page: 100, total: totalPages * 100, total_pages: totalPages, has_more: page < totalPages },
    },
  });

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: APP_ENVIRONMENT, useValue: { apiBaseUrl: BASE, dataSource: 'http' } },
      ],
    });

    api = TestBed.inject(ApiClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for the largest page the server allows, so one request usually suffices', async () => {
    const rows = firstValueFrom(api.everyPage<string>('programs'));

    const request = http.expectOne((candidate) => candidate.url === `${BASE}/programs`);
    expect(request.request.params.get('per_page')).toBe('100');
    request.flush(answer(1, 1, ['a', 'b']));

    expect(await rows).toEqual(['a', 'b']);
  });

  it('follows the pages and hands back every row in order', async () => {
    const rows = firstValueFrom(api.everyPage<string>('programs'));

    http.expectOne((c) => c.params.get('page') === '1').flush(answer(1, 3, ['a']));
    http.expectOne((c) => c.params.get('page') === '2').flush(answer(2, 3, ['b']));
    http.expectOne((c) => c.params.get('page') === '3').flush(answer(3, 3, ['c']));

    expect(await rows).toEqual(['a', 'b', 'c']);
  });

  /**
   * Past the ceiling it **throws**, and that is the decision rather than an oversight.
   *
   * Stopping quietly is the defect this method exists to remove, reintroduced at a higher number —
   * a partial catalogue rendered as the whole of it. Fetching without bound hangs the screen on a
   * registry-sized answer instead. Refusing says plainly that nothing is shown and why.
   */
  it('refuses rather than returning part of a list too long to read', async () => {
    const rows = firstValueFrom(api.everyPage<string>('programs'));

    for (let page = 1; page <= 20; page++) {
      http.expectOne((c) => c.params.get('page') === String(page)).flush(answer(page, 999, ['x']));
    }

    await expect(rows).rejects.toThrow(/longer than this screen can read/);
  });

  it('stops on an empty page rather than asking for the next one for ever', async () => {
    const rows = firstValueFrom(api.everyPage<string>('programs'));

    http.expectOne((c) => c.params.get('page') === '1').flush(answer(1, 9, []));

    expect(await rows).toEqual([]);
  });

  it('passes a filter through to every page', async () => {
    const rows = firstValueFrom(api.everyPage<string>('programs', { status: 'active' }));

    const first = http.expectOne((c) => c.params.get('page') === '1');
    expect(first.request.params.get('status')).toBe('active');
    first.flush(answer(1, 2, ['a']));

    const second = http.expectOne((c) => c.params.get('page') === '2');
    expect(second.request.params.get('status')).toBe('active');
    second.flush(answer(2, 2, ['b']));

    expect(await rows).toEqual(['a', 'b']);
  });
});
