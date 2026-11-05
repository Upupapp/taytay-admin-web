import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';

import { ApiClient } from './api.client';

const BASE = 'https://api.example.gov.ph/api/v1';

/**
 * `everyPage` exists because twenty rows is what this API gives a request that did not ask, and for
 * a **picker** that is not a missing page — it is a wrong answer. An intake officer who cannot see a
 * programme in a dropdown concludes the office does not run it (`DL-161`).
 */
describe('reading every cursor page of a list somebody picks from', () => {
  let api: ApiClient;
  let http: HttpTestingController;

  const answer = (items: readonly unknown[], next: string | null) => ({
    data: items,
    meta: { pagination: { has_more: next !== null, next_cursor: next } },
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

  it('asks for the largest page the server allows, and nothing it would ignore', async () => {
    const rows = firstValueFrom(api.everyPage<string>('offices'));

    const request = http.expectOne((candidate) => candidate.url === `${BASE}/offices`);
    expect(request.request.params.get('limit')).toBe('50');
    expect(request.request.params.keys()).toEqual(['limit']);
    request.flush(answer(['a', 'b'], null));

    expect(await rows).toEqual(['a', 'b']);
  });

  it('follows next_cursor exactly as received and hands back every row in order', async () => {
    const rows = firstValueFrom(api.everyPage<string>('offices'));

    http.expectOne((c) => !c.params.has('cursor')).flush(answer(['a'], 'c2'));
    http.expectOne((c) => c.params.get('cursor') === 'c2').flush(answer(['b'], 'c3'));
    http.expectOne((c) => c.params.get('cursor') === 'c3').flush(answer(['c'], null));

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
    const rows = firstValueFrom(api.everyPage<string>('offices'));

    http.expectOne((c) => !c.params.has('cursor')).flush(answer(['x'], 'p2'));
    for (let page = 2; page <= 20; page++) {
      http
        .expectOne((c) => c.params.get('cursor') === `p${page}`)
        .flush(answer(['x'], `p${page + 1}`));
    }

    await expect(rows).rejects.toThrow(/longer than this screen can read/);
  });

  it('stops on an empty page rather than asking for the next one for ever', async () => {
    const rows = firstValueFrom(api.everyPage<string>('offices'));

    http.expectOne((c) => !c.params.has('cursor')).flush(answer([], 'still-more'));

    expect(await rows).toEqual([]);
  });

  it('passes a filter through to every page', async () => {
    const rows = firstValueFrom(api.everyPage<string>('offices', { q: 'health' }));

    const first = http.expectOne((c) => !c.params.has('cursor'));
    expect(first.request.params.get('q')).toBe('health');
    first.flush(answer(['a'], 'c2'));

    const second = http.expectOne((c) => c.params.get('cursor') === 'c2');
    expect(second.request.params.get('q')).toBe('health');
    second.flush(answer(['b'], null));

    expect(await rows).toEqual(['a', 'b']);
  });
});
