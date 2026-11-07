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
  bucketWork,
  describeLateness,
  describeWaiting,
  describeWithheld,
  type IsoDate,
} from '@domain/index';

import OFFICE_SEARCH_RESULTS from './fixtures/office-search-results.json';
import OFFICE_SEARCH_RESULTS_CASELOAD from './fixtures/office-search-results-caseload.json';
import OFFICE_WORK_ALERTS from './fixtures/office-work-alerts.json';
import OFFICE_WORK_MINE from './fixtures/office-work-mine.json';
import OFFICE_WORK_TEAM from './fixtures/office-work-team.json';
import { HttpSearchRepository, HttpWorkRepository } from './http-repositories';

const BASE = 'https://api.example.gov.ph/api/v1';
const DOLORES_API = '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01';
const BARANGAYS = {
  data: [{ id: DOLORES_API, code: 'dolores', name: 'Dolores' }],
  meta: {},
};
const TODAY = asId<IsoDate>('2026-11-07');
const SOCIAL_WORKER = '2b3c4d5e-6f7a-4b8c-9d0e-1f2a3b4c5d02';

const providers = [
  provideHttpClient(withInterceptors([apiHeadersInterceptor])),
  provideHttpClientTesting(),
  {
    provide: APP_ENVIRONMENT,
    useValue: { apiBaseUrl: BASE, dataSource: 'http', firebaseWebApiKey: 'test-web-api-key' },
  },
  HttpSearchRepository,
  HttpWorkRepository,
];

/**
 * Global search over the API (`DL-189`): one term and nothing else (`DL-109`), every type answered
 * for — searched, or named as not searched (`DL-112`) — and the answer read whole or refused.
 */
describe('search over the API (DL-189)', () => {
  let http: HttpTestingController;
  let repository: HttpSearchRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthTokenHolder).hold('fixture-token', null);
    repository = TestBed.inject(HttpSearchRepository);
  });

  afterEach(() => http.verify());

  const answer = async (term: string, body: object) => {
    const read = firstValueFrom(repository.search(term));
    http.expectOne({ method: 'GET', url: `${BASE}/barangays` }).flush(BARANGAYS);
    const sent = http.expectOne((request) => request.url === `${BASE}/office/search`);
    sent.flush(body);
    return { results: await read, params: sent.request.params };
  };

  it('asks nothing for a term too short to search, as the mock adapter answers it', async () => {
    const results = await firstValueFrom(repository.search(' m '));
    expect(results).toEqual({ term: 'm', groups: [], total: 0, withheldTypes: [] });
    http.expectNone(`${BASE}/office/search`);
    http.expectNone(`${BASE}/barangays`);
  });

  it('sends the trimmed term and nothing else, and reads every group the server searched', async () => {
    const { results, params } = await answer('  mercado ', OFFICE_SEARCH_RESULTS);

    expect(params.keys()).toEqual(['q']);
    expect(params.get('q')).toBe('mercado');
    expect(results.term).toBe('mercado');
    // A type searched with nothing found is not a group on screen; it is not withheld either.
    expect(results.groups.map((group) => group.type)).toEqual([
      'resident',
      'assistance-request',
      'case',
    ]);
    expect(results.total).toBe(10);
    expect(results.withheldTypes).toEqual(['family']);
    expect(describeWithheld(results)).toBe(
      'Your account does not cover families, so those were not searched.',
    );

    const [residents, requests] = results.groups;
    expect(residents?.label).toBe('Residents');
    expect(residents?.hits.map((hit) => [hit.title, hit.statusLabel, hit.barangayLabel])).toEqual([
      ['Mercado, Liza', 'Active', 'Dolores'],
      ['Mercado, R.', 'Inactive', 'Dolores'],
    ]);
    expect(residents?.isTruncated).toBe(false);
    expect(requests?.hits).toHaveLength(5);
    expect(requests?.total).toBe(7);
    expect(requests?.isTruncated).toBe(true);
    expect(requests?.seeAllLink).toEqual(['/assistance-requests']);
    expect(requests?.seeAllParams).toEqual({ search: 'mercado' });
    expect(requests?.hits[0]?.statusLabel).toBe('Assessment');
    expect(requests?.hits[0]?.reference).toBe('AICS-2026-000041');

    // The hit's closed shape (DL-109): what it shows, and no snippet of anything.
    for (const group of results.groups) {
      for (const hit of group.hits) {
        expect(Object.keys(hit).sort()).toEqual(
          [
            'barangayLabel',
            'key',
            'reference',
            'routerLink',
            'statusLabel',
            'title',
            'type',
          ].sort(),
        );
        expect(hit.key).toBe(`${hit.type}:${hit.routerLink[1] ?? ''}`);
      }
    }
    expect(results.groups[2]?.hits[0]?.routerLink).toEqual([
      '/cases',
      '8e9f0a1b-2c3d-4e4f-8a5b-6c7d8e9f0a21',
    ]);
  });

  it('names the registry’s types a caseload is not given, in the console’s order', async () => {
    const { results } = await answer('mercado', OFFICE_SEARCH_RESULTS_CASELOAD);
    expect(results.withheldTypes).toEqual(['resident', 'household', 'family']);
    expect(results.groups.map((group) => group.type)).toEqual(['case']);
    expect(results.groups[0]?.hits[0]?.barangayLabel).toBeNull();
  });

  it('refuses an answer that leaves a type unaccounted for, rather than reading it as nothing found', async () => {
    const body = structuredClone(OFFICE_SEARCH_RESULTS);
    body.data.not_searched = [];
    const read = firstValueFrom(repository.search('mercado')).catch((error: unknown) => error);
    http.expectOne(`${BASE}/barangays`).flush(BARANGAYS);
    http.expectOne((request) => request.url === `${BASE}/office/search`).flush(body);
    const refusal = await read;
    expect(refusal).toBeInstanceOf(Error);
    expect(refusal instanceof Error ? refusal.message : '').toMatch(/could not be read/);
  });

  it('refuses the whole answer when one hit cannot be read, rather than losing it quietly', async () => {
    const body = structuredClone(OFFICE_SEARCH_RESULTS);
    const first = body.data.groups[0]?.hits[0];
    if (first !== undefined) {
      first.title = '';
    }
    const read = firstValueFrom(repository.search('mercado')).catch((error: unknown) => error);
    http.expectOne(`${BASE}/barangays`).flush(BARANGAYS);
    http.expectOne((request) => request.url === `${BASE}/office/search`).flush(body);
    expect(await read).toBeInstanceOf(Error);
  });
});

/**
 * The work queues over the API (`DL-189`): three reads and no write (`DL-97`), a queue read whole,
 * undated work waiting rather than late (`DL-101`), and alerts that state their basis (`DL-98`).
 */
describe('the work queues over the API (DL-189)', () => {
  let http: HttpTestingController;
  let repository: HttpWorkRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthTokenHolder).hold('fixture-token', null);
    repository = TestBed.inject(HttpWorkRepository);
  });

  afterEach(() => http.verify());

  it('is read-only: the adapter declares the three reads and nothing that writes', () => {
    const prototype: unknown = Object.getPrototypeOf(repository);
    const methods =
      prototype !== null && typeof prototype === 'object'
        ? Object.getOwnPropertyNames(prototype).filter((name) => name !== 'constructor')
        : [];
    expect(methods.sort()).toEqual(['alerts', 'myQueue', 'teamQueue']);
  });

  it('reads my queue as of the date asked, with a task manageable through its case and nothing else', async () => {
    const read = firstValueFrom(repository.myQueue(TODAY));
    const sent = http.expectOne((request) => request.url === `${BASE}/office/work/mine`);
    expect(sent.request.method).toBe('GET');
    expect(sent.request.params.keys()).toEqual(['as_of']);
    expect(sent.request.params.get('as_of')).toBe('2026-11-07');
    sent.flush(OFFICE_WORK_MINE);
    const queue = await read;

    expect(queue.asOf).toBe('2026-11-07');
    expect(queue.ownerId).toBe(SOCIAL_WORKER);
    expect(queue.ownerName).toBe('Joy Social Worker');
    const [task, assessment, visit] = queue.items;
    expect(task?.isManageable).toBe(true);
    expect(task?.link).toEqual({
      routerLink: ['/cases', '8e9f0a1b-2c3d-4e4f-8a5b-6c7d8e9f0a23'],
      label: 'Open the case',
    });
    expect(task?.permission).toBe('case.manage');
    expect(task === undefined ? null : describeLateness(task, TODAY)).toBe('Late by 2 days');

    // No service standard was adopted: no due date, and the wait in its place.
    expect(assessment?.dueOn).toBeNull();
    expect(assessment?.isManageable).toBe(false);
    expect(assessment?.link.routerLink).toEqual([
      '/assistance-requests',
      '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a11',
    ]);
    expect(assessment === undefined ? null : describeLateness(assessment, TODAY)).toBeNull();
    expect(assessment === undefined ? null : describeWaiting(assessment, TODAY)).toBe(
      'Waiting 9 days',
    );
    expect(visit?.link.routerLink[0]).toBe('/visits');

    const buckets = bucketWork(queue.items, TODAY);
    expect(buckets.overdue.map((item) => item.source)).toEqual(['case-task']);
    expect(buckets.undated.map((item) => item.source)).toEqual(['assistance-request']);
  });

  it('groups the team’s work by person, with nobody’s as its own column', async () => {
    const read = firstValueFrom(repository.teamQueue(TODAY));
    const sent = http.expectOne((request) => request.url === `${BASE}/office/work/team`);
    expect(sent.request.params.get('as_of')).toBe('2026-11-07');
    sent.flush(OFFICE_WORK_TEAM);
    const team = await read;

    expect(team.asOf).toBe('2026-11-07');
    expect(team.unassignedCount).toBe(2);
    expect(team.members.map((member) => [member.name, member.total, member.overdueCount])).toEqual([
      ['Joy Social Worker', 3, 1],
      ['Head of Office', 1, 1],
      ['Nobody yet', 2, 0],
    ]);
  });

  it('reads the alerts with their basis, each linked to the list it concerns, and none completable', async () => {
    const read = firstValueFrom(repository.alerts());
    const sent = http.expectOne(`${BASE}/office/work/alerts`);
    expect(sent.request.params.keys()).toEqual([]);
    sent.flush(OFFICE_WORK_ALERTS);
    const alerts = await read;

    expect(alerts.map((alert) => [alert.kind, alert.severity, alert.detectedFrom])).toEqual([
      ['voucher-mismatch', 'risk', 1],
      ['possible-duplicate', 'attention', 3],
      ['stalled-request', 'notice', 2],
    ]);
    expect(alerts[1]?.link).toEqual({
      routerLink: ['/beneficiaries', 'duplicates'],
      label: 'Open the review queue',
    });
    expect(alerts.every((alert) => alert.basis.length > 0)).toBe(true);
  });

  it('refuses a queue with an item it cannot read, rather than showing it one row short', async () => {
    const body = structuredClone(OFFICE_WORK_MINE);
    const first = body.data.items[0];
    if (first !== undefined) {
      first.permission = 'queue.snooze';
    }
    const read = firstValueFrom(repository.myQueue(TODAY)).catch((error: unknown) => error);
    http.expectOne((request) => request.url === `${BASE}/office/work/mine`).flush(body);
    const refusal = await read;
    expect(refusal).toBeInstanceOf(Error);
    expect(refusal instanceof Error ? refusal.message : '').toMatch(/one row short/);
  });

  it('refuses a case task that does not say which case it is on', async () => {
    const body = structuredClone(OFFICE_WORK_MINE);
    const first = body.data.items[0];
    if (first !== undefined) {
      first.case_id = null;
    }
    const read = firstValueFrom(repository.myQueue(TODAY)).catch((error: unknown) => error);
    http.expectOne((request) => request.url === `${BASE}/office/work/mine`).flush(body);
    expect(await read).toBeInstanceOf(Error);
  });

  it('refuses an alert that does not state its basis (DL-98)', async () => {
    const body = structuredClone(OFFICE_WORK_ALERTS);
    const first = body.data[0];
    if (first !== undefined) {
      first.basis = ' ';
    }
    const read = firstValueFrom(repository.alerts()).catch((error: unknown) => error);
    http.expectOne(`${BASE}/office/work/alerts`).flush(body);
    expect(await read).toBeInstanceOf(Error);
  });
});
