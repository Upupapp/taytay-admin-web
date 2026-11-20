import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { apiHeadersInterceptor } from '@core/http/api.interceptors';
import { asId, type AssistanceImportId, type ResidentId } from '@domain/index';

import ASSISTANCE_IMPORT from './fixtures/assistance-import.json';
import ASSISTANCE_IMPORT_WITHDRAWN from './fixtures/assistance-import-withdrawn.json';
import ASSISTANCE_IMPORTS_PAGE from './fixtures/assistance-imports-page.json';
import IMPORT_TEMPLATE from './fixtures/import-template.json';
import { HttpAssistanceImportRepository } from './http-assistance-imports';
import { HttpResidentImportRepository } from './http-repositories';

const BASE = 'https://api.example.gov.ph/api/v1';
const IMPORTS = `${BASE}/office/assistance-imports`;
const ID = asId<AssistanceImportId>(ASSISTANCE_IMPORT.data.id);

/**
 * Imports of past assistance over the API (`DL-228`): the file as a form, the whole mapping by PUT,
 * a finding and a withdrawal by POST with the reason trimmed, a cursor page with no total, and the
 * template read as text — for this import and the citizen import alike.
 */
describe('past-assistance imports over the API (DL-228)', () => {
  let http: HttpTestingController;
  let imports: HttpAssistanceImportRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiHeadersInterceptor])),
        provideHttpClientTesting(),
        {
          provide: APP_ENVIRONMENT,
          useValue: { apiBaseUrl: BASE, dataSource: 'http', firebaseWebApiKey: 'test-web-api-key' },
        },
        HttpAssistanceImportRepository,
        HttpResidentImportRepository,
      ],
    });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthTokenHolder).hold('fixture-token', null);
    imports = TestBed.inject(HttpAssistanceImportRepository);
  });

  afterEach(() => http.verify());

  it('reads a cursor page newest first, says more exist, and sends no page or sort', async () => {
    const page = firstValueFrom(imports.list({ limit: 20, cursor: null }));
    const request = http.expectOne((r) => r.url === IMPORTS);
    expect(request.request.method).toBe('GET');
    expect(request.request.params.has('page')).toBe(false);
    expect(request.request.params.has('sort')).toBe(false);
    request.flush(ASSISTANCE_IMPORTS_PAGE);
    const answer = await page;
    expect(answer.hasMore).toBe(true);
    expect(answer.items[0]?.result?.residentsCreated).toBe(1);
    expect(answer.items[0]?.committedBy).toBeNull();
  });

  it('uploads the file as a form, and nothing else', async () => {
    const file = new File(['Pangalan\nReyes, Ana'], 'tulong-2024.csv', { type: 'text/csv' });
    const done = firstValueFrom(imports.upload(file));
    const request = http.expectOne({ method: 'POST', url: IMPORTS });
    expect(request.request.body).toBeInstanceOf(FormData);
    expect([...(request.request.body as FormData).keys()]).toEqual(['file']);
    request.flush({ data: { ...ASSISTANCE_IMPORT.data }, meta: {} });
    expect((await done).fileName).toBe('tulong-2024.csv');
  });

  it('reads one import, and answers null for a 404', async () => {
    const found = firstValueFrom(imports.get(ID));
    http.expectOne({ method: 'GET', url: `${IMPORTS}/${ID}` }).flush(ASSISTANCE_IMPORT);
    expect((await found)?.counts['needs-review']).toBe(1);

    const missing = firstValueFrom(imports.get(ID));
    http
      .expectOne({ method: 'GET', url: `${IMPORTS}/${ID}` })
      .flush(
        { error: { code: 'NOT_FOUND', message: 'That import was not found.' } },
        { status: 404, statusText: 'Not Found' },
      );
    expect(await missing).toBeNull();
  });

  it('sends the whole mapping by PUT, every field named', async () => {
    const mapped = firstValueFrom(imports.map(ID, { fullName: 0, barangay: 1 }));
    const put = http.expectOne({ method: 'PUT', url: `${IMPORTS}/${ID}/mapping` });
    expect(put.request.body.mapping.full_name).toBe(0);
    expect(put.request.body.mapping.barangay).toBe(1);
    expect(put.request.body.mapping.received_by).toBeNull();
    expect(Object.keys(put.request.body.mapping)).toHaveLength(20);
    put.flush(ASSISTANCE_IMPORT);
    expect((await mapped).rows).toHaveLength(5);
  });

  it('sends a link with its record, a create with only what was given, a skip with neither', async () => {
    const linked = firstValueFrom(
      imports.resolve(ID, 2, {
        action: 'link',
        residentId: asId<ResidentId>('1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c02'),
        reason: ' Same mother on file. ',
      }),
    );
    const link = http.expectOne({ method: 'POST', url: `${IMPORTS}/${ID}/rows/2/resolve` });
    expect(link.request.body).toEqual({
      action: 'link',
      reason: 'Same mother on file.',
      resident_id: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c02',
    });
    link.flush(ASSISTANCE_IMPORT);
    await linked;

    const created = firstValueFrom(
      imports.resolve(ID, 2, {
        action: 'create',
        record: { civilStatus: 'widowed', streetAddress: ' 12 Rizal St. ', purokOrSitio: '  ' },
        reason: 'Not on the registry.',
      }),
    );
    const create = http.expectOne({ method: 'POST', url: `${IMPORTS}/${ID}/rows/2/resolve` });
    expect(create.request.body).toEqual({
      action: 'create',
      reason: 'Not on the registry.',
      record: { civil_status: 'widowed', street_address: '12 Rizal St.' },
    });
    create.flush(ASSISTANCE_IMPORT);
    await created;

    const skipped = firstValueFrom(imports.resolve(ID, 3, { action: 'skip', reason: 'Twice.' }));
    const skip = http.expectOne({ method: 'POST', url: `${IMPORTS}/${ID}/rows/3/resolve` });
    expect(skip.request.body).toEqual({ action: 'skip', reason: 'Twice.' });
    skip.flush(ASSISTANCE_IMPORT);
    await skipped;
  });

  it('commits with an empty body and withdraws with the reason trimmed', async () => {
    const committed = firstValueFrom(imports.commit(ID));
    const commit = http.expectOne({ method: 'POST', url: `${IMPORTS}/${ID}/commit` });
    expect(commit.request.body).toEqual({});
    commit.flush({ data: { ...ASSISTANCE_IMPORTS_PAGE.data[0] }, meta: {} });
    expect((await committed).status).toBe('committed');

    const withdrawn = firstValueFrom(imports.withdraw(ID, '  Wrong year.  '));
    const withdraw = http.expectOne({ method: 'POST', url: `${IMPORTS}/${ID}/withdraw` });
    expect(withdraw.request.body).toEqual({ reason: 'Wrong year.' });
    withdraw.flush(ASSISTANCE_IMPORT_WITHDRAWN);
    const answer = await withdrawn;
    expect(answer.status).toBe('withdrawn');
    expect(answer.withdrawal?.reason).toBe('The report of the wrong year was imported.');
  });

  it('reads either template as text, for the browser to save', async () => {
    const own = firstValueFrom(imports.template());
    http.expectOne({ method: 'GET', url: `${IMPORTS}/template` }).flush(IMPORT_TEMPLATE);
    expect((await own).content.startsWith('\uFEFFSurname')).toBe(true);

    const citizens = firstValueFrom(TestBed.inject(HttpResidentImportRepository).template());
    http
      .expectOne({ method: 'GET', url: `${BASE}/office/imports/template` })
      .flush(IMPORT_TEMPLATE);
    expect((await citizens).fileName).toBe('taytay-past-assistance-template.csv');
  });

  it('refuses an unreadable answer rather than showing part of it', async () => {
    const found = firstValueFrom(imports.get(ID));
    http
      .expectOne({ method: 'GET', url: `${IMPORTS}/${ID}` })
      .flush({ data: { ...ASSISTANCE_IMPORT.data, rows: [{ row: 1 }] }, meta: {} });
    await expect(found).rejects.toThrow(/could not be read whole/);
  });
});
