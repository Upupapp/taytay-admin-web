import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import { AuthTokenHolder } from '@core/auth/auth-token.holder';
import { apiHeadersInterceptor } from '@core/http/api.interceptors';
import {
  AUDIT_DETAIL_RATIONALE,
  AUDIT_SENSITIVE_FILTER_UNAVAILABLE,
  NO_OFFICE_ROLE_LABEL,
  asId,
  asIsoDate,
  describeAuditRows,
  type AuditEntryId,
  type StaffUserId,
} from '@domain/index';

import OFFICE_AUDIT_DETAIL from './fixtures/office-audit-detail.json';
import OFFICE_AUDIT_PAGE from './fixtures/office-audit-page.json';
import OFFICE_CLASSIFICATIONS from './fixtures/office-governance-classifications.json';
import OFFICE_CORRECTIONS from './fixtures/office-governance-corrections.json';
import OFFICE_RETENTION from './fixtures/office-governance-retention.json';
import OFFICE_STAFF from './fixtures/office-staff.json';
import OFFICE_STAFF_SWITCHED from './fixtures/office-staff-switched.json';
import { HttpGovernanceRepository } from './http-repositories';

const BASE = 'https://api.example.gov.ph/api/v1';
const DOLORES_API = '0b1c2d3e-4f50-4a61-8b72-3c4d5e6f7a01';
/** `GET barangays`: the API knows each barangay by its own id, joined to the console’s by name. */
const BARANGAYS = {
  data: [
    { id: DOLORES_API, code: 'dolores', name: 'Dolores' },
    { id: '0b1c2d3e-4f50-4a61-8b72-3c4d5e6f7a02', code: 'muzon', name: 'Muzon' },
  ],
  meta: {},
};
const LEAVER = asId<StaffUserId>('9a0b1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c05');
const ENTRY = asId<AuditEntryId>('3c4d5e6f-7a8b-4c9d-8e0f-1a2b3c4d5e01');

const providers = [
  provideHttpClient(withInterceptors([apiHeadersInterceptor])),
  provideHttpClientTesting(),
  {
    provide: APP_ENVIRONMENT,
    useValue: { apiBaseUrl: BASE, dataSource: 'http', firebaseWebApiKey: 'test-web-api-key' },
  },
  HttpGovernanceRepository,
];

/** A deep copy of a fixture, to plant one thing in. */
const copy = <T>(value: T): T => structuredClone(value);

/**
 * Governance over the API (`DL-191`). The server holds the accounts, ends a switched-off session and
 * keeps the trail; the adapter asks with named keys, refuses "only sensitive" without a request, and
 * the mapper says what the server does not record rather than filling it in.
 */
describe('governance over the API (DL-191)', () => {
  let http: HttpTestingController;
  let repository: HttpGovernanceRepository;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers });
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthTokenHolder).hold('fixture-token', null);
    repository = TestBed.inject(HttpGovernanceRepository);
  });

  afterEach(() => http.verify());

  const barangays = () => {
    for (const pending of http.match(`${BASE}/barangays`)) {
      pending.flush(BARANGAYS);
    }
  };

  describe('the staff directory', () => {
    it('says who may act, and that the rest is not recorded', async () => {
      const read = firstValueFrom(repository.accounts());
      barangays();
      http.expectOne(`${BASE}/office/staff`).flush(OFFICE_STAFF);
      const accounts = await read;

      expect(accounts).toHaveLength(6);
      for (const account of accounts) {
        // Nothing the API does not hold is filled in: no profile, no position, no sign-in.
        expect(account.profile).toBeNull();
        expect(account.position).toBeNull();
        expect(account.lastSignInAt).toBeNull();
        expect(account.lastSignInRecorded).toBe(false);
        expect(account.additionalPermissionCount).toBe(0);
      }
      const newcomer = accounts.find((account) => account.role === null);
      expect(newcomer?.roleLabel).toBe(NO_OFFICE_ROLE_LABEL);
      expect(newcomer?.displayName).toBe('No name recorded');
      const link = accounts.find((account) => account.role === 'barangay-link');
      expect(link?.barangayId).toBe('brgy-dolores');
      expect(link?.barangayLabel).toBe('Dolores');
      expect(accounts.find((account) => account.staffId === LEAVER)?.isActive).toBe(false);
      expect(accounts.find((account) => account.role === 'system-administrator')?.roleLabel).toBe(
        'System administrator',
      );
    });

    it('refuses the whole list rather than one row it cannot place', async () => {
      const planted = copy(OFFICE_STAFF);
      const first = planted.data[0];
      if (first !== undefined) {
        // A staff account claiming the administrator's role is not one this console can read.
        first.office_role = 'system-administrator';
      }
      const read = firstValueFrom(repository.accounts());
      barangays();
      http.expectOne(`${BASE}/office/staff`).flush(planted);
      await expect(read).rejects.toThrow(/could not be read whole/);
    });

    it('reads a missing account as none', async () => {
      const read = firstValueFrom(repository.accountById(LEAVER));
      barangays();
      http
        .expectOne(`${BASE}/office/staff/${LEAVER}`)
        .flush(
          { error: { code: 'NOT_FOUND', message: 'No.' } },
          { status: 404, statusText: 'Not Found' },
        );
      expect(await read).toBeNull();
    });

    it('switches an account off with the reason alone, and asks nothing without one', async () => {
      await expect(
        firstValueFrom(repository.setAccountActive(LEAVER, false, '   ')),
      ).rejects.toThrow(/needs a reason/);

      const off = firstValueFrom(
        repository.setAccountActive(LEAVER, false, '  Left the office.  '),
      );
      barangays();
      const request = http.expectOne(`${BASE}/office/staff/${LEAVER}/deactivate`);
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ reason: 'Left the office.' });
      request.flush(OFFICE_STAFF_SWITCHED);
      expect((await off).isActive).toBe(false);

      const on = firstValueFrom(repository.setAccountActive(LEAVER, true, 'Returned.'));
      barangays();
      http
        .expectOne(`${BASE}/office/staff/${LEAVER}/reactivate`)
        .flush({
          data: { ...OFFICE_STAFF_SWITCHED.data, is_active: true, deactivated_at: null },
          meta: {},
        });
      expect((await on).isActive).toBe(true);
    });
  });

  describe('the office’s audit trail', () => {
    it('asks with named keys a page at a time, and says the fields were not recorded', async () => {
      const read = firstValueFrom(
        repository.auditRows(
          {
            search: 'switched',
            action: 'status-changed',
            entityType: 'staff',
            from: asIsoDate('2026-11-01'),
            to: asIsoDate('2026-11-07'),
          },
          { limit: 50, cursor: 'abc' },
        ),
      );
      const request = http.expectOne((candidate) => candidate.url === `${BASE}/office/audit`);
      const params = request.request.params;
      expect(params.keys().sort()).toEqual(
        ['action', 'cursor', 'from', 'limit', 'q', 'record_type', 'to'].sort(),
      );
      expect(params.get('q')).toBe('switched');
      expect(params.get('record_type')).toBe('staff');
      request.flush(OFFICE_AUDIT_PAGE);
      const page = await read;

      expect(page.hasMore).toBe(true);
      expect(page.nextCursor).toBe(OFFICE_AUDIT_PAGE.meta.pagination.next_cursor);
      expect(page.items).toHaveLength(4);
      for (const row of page.items) {
        expect(row.fieldsRecorded).toBe(false);
        expect(row.changedFields).toEqual([]);
        // Not known to touch sensitive information is not known not to: it is simply not counted.
        expect(row.touchesSensitive).toBe(false);
        expect(row.hasDetail).toBe(false);
        expect(row.reason).toBeNull();
        for (const field of ['before', 'after', 'values', 'changes', 'oldValue', 'newValue']) {
          expect(row as unknown as Record<string, unknown>).not.toHaveProperty(field);
        }
      }
      const system = page.items.find((row) => row.actorId === null);
      expect(system?.source).toBe('system');
      expect(page.items[0]?.entityLabel).toBe('Staff account');
      expect(page.items[0]?.summary).toMatch(/Switched a staff account off/);
      expect(describeAuditRows(page.items)).toBe(
        '4 events. Which fields each changed was not recorded.',
      );
    });

    it('refuses "only sensitive" without a request, because an empty answer would mean "none"', async () => {
      await expect(
        firstValueFrom(repository.auditRows({ sensitiveOnly: true }, { limit: 50, cursor: null })),
      ).rejects.toThrow(AUDIT_SENSITIVE_FILTER_UNAVAILABLE);
    });

    it('refuses a page with a row that claims its fields were recorded', async () => {
      const planted = copy(OFFICE_AUDIT_PAGE);
      const first = planted.data[0] as { fields_recorded: boolean } | undefined;
      if (first !== undefined) {
        first.fields_recorded = true;
      }
      const read = firstValueFrom(repository.auditRows({}, { limit: 50, cursor: null }));
      http.expectOne((candidate) => candidate.url === `${BASE}/office/audit`).flush(planted);
      await expect(read).rejects.toThrow(/could not be read whole/);
    });

    it('opens an entry to say no values were stored, and refuses one that carries any', async () => {
      const read = firstValueFrom(repository.auditDetail(ENTRY));
      http.expectOne(`${BASE}/office/audit/${ENTRY}`).flush(OFFICE_AUDIT_DETAIL);
      const detail = await read;
      expect(detail?.valuesRecorded).toBe(false);
      expect(detail?.changes).toEqual([]);
      expect(detail?.notRecorded).toBe(OFFICE_AUDIT_DETAIL.data.notice);
      expect(detail?.accessRationale).toBe(AUDIT_DETAIL_RATIONALE);

      const planted = firstValueFrom(repository.auditDetail(ENTRY));
      http.expectOne(`${BASE}/office/audit/${ENTRY}`).flush({
        data: {
          ...OFFICE_AUDIT_DETAIL.data,
          values_recorded: true,
          changes: [{ field: 'monthly_income', before: '3200', after: '18000' }],
        },
        meta: {},
      });
      await expect(planted).rejects.toThrow(/could not be read whole/);

      const missing = firstValueFrom(repository.auditDetail(ENTRY));
      http
        .expectOne(`${BASE}/office/audit/${ENTRY}`)
        .flush(
          { error: { code: 'NOT_FOUND', message: 'No.' } },
          { status: 404, statusText: 'Not Found' },
        );
      expect(await missing).toBeNull();
    });
  });

  describe('what the office says about its own data', () => {
    it('reads the classifications and a retention schedule with nothing recorded', async () => {
      const types = firstValueFrom(repository.classifications());
      http.expectOne(`${BASE}/office/governance/classifications`).flush(OFFICE_CLASSIFICATIONS);
      expect((await types).map((type) => type.key)).toContain('case-note');

      const rules = firstValueFrom(repository.retention());
      http.expectOne(`${BASE}/office/governance/retention`).flush(OFFICE_RETENTION);
      for (const rule of await rules) {
        expect(rule.periodInYears).toBeNull();
        expect(rule.provenance).toBe('awaiting-office-policy');
      }
    });

    it('refuses a retention period with no office schedule behind it', async () => {
      const planted = copy(OFFICE_RETENTION) as { data: Record<string, unknown>[] };
      const first = planted.data[0];
      if (first !== undefined) {
        first['period_in_years'] = 5;
      }
      const read = firstValueFrom(repository.retention());
      http.expectOne(`${BASE}/office/governance/retention`).flush(planted);
      await expect(read).rejects.toThrow(/could not be read whole/);
    });

    it('reads correction requests in the console’s words, and refuses an answer without its words', async () => {
      const read = firstValueFrom(repository.corrections());
      http.expectOne(`${BASE}/office/governance/corrections`).flush(OFFICE_CORRECTIONS);
      const requests = await read;
      expect(requests.map((request) => request.status)).toEqual(['raised', 'refused']);
      expect(requests[0]?.changes[0]?.field).toBe('mobileNumber');
      expect(requests[1]?.changes[0]?.field).toBe('birthDate');
      expect(requests[1]?.outcome).toMatch(/5 April/);

      const planted = copy(OFFICE_CORRECTIONS) as { data: Record<string, unknown>[] };
      const refused = planted.data[1];
      if (refused !== undefined) {
        refused['outcome'] = null;
      }
      const again = firstValueFrom(repository.corrections());
      http.expectOne(`${BASE}/office/governance/corrections`).flush(planted);
      await expect(again).rejects.toThrow(/could not be read whole/);
    });
  });
});
