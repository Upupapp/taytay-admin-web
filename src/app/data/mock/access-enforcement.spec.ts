import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  DEFAULT_PAGE_REQUEST,
  isPermissionDenied,
  PermissionDeniedError,
  ROLE_DEFINITIONS,
  type AccessContext,
  type AssistanceRequestId,
  type AuthenticatedUser,
  type BarangayId,
  type Permission,
  type ResidentId,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';
import type { AppEnvironment } from '@env/environment.model';

import { MockAssistanceRequestRepository } from './mock-assistance-request.repository';
import { MockResidentRepository } from './mock-resident.repository';
import { MockStaffRepository } from './mock-staff.repository';

const TEST_ENVIRONMENT: AppEnvironment = {
  name: 'local-mock',
  production: false,
  appName: 'Test',
  apiBaseUrl: '/api',
  dataSource: 'mock',
  mockLatencyMs: 0,
  enableDevTools: false,
};

const SAN_JUAN = asId<BarangayId>('brgy-san-juan');

function authenticated(role: StaffRole, barangayId: BarangayId | null = null): AuthenticatedUser {
  const definition = ROLE_DEFINITIONS[role];
  return {
    id: asId<StaffUserId>('staff-x'),
    displayName: 'Test User',
    email: 'test@example.gov.ph',
    role,
    roleLabel: definition.label,
    position: 'Tester',
    barangayId,
    scope: definition.scope,
    permissions: new Set<Permission>(definition.permissions),
  };
}

/** Signs the injector in as a given role for the duration of one test. */
function signedInAs(user: AuthenticatedUser | null) {
  const context: AccessContext = { currentUser: () => user };
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      { provide: APP_ENVIRONMENT, useValue: TEST_ENVIRONMENT },
      { provide: ACCESS_CONTEXT, useValue: context },
      MockResidentRepository,
      MockAssistanceRequestRepository,
      MockStaffRepository,
    ],
  });
}

/*
 * These tests are the evidence for the TAB 05 acceptance rule that a hidden
 * action is also refused at the logic level. Every case below drives the
 * repository directly — no component, no template, no hidden button — so a
 * passing test means the refusal survives even when the UI is bypassed.
 */

describe('data-scope enforcement', () => {
  it('lets a municipality-wide role list residents across barangays', async () => {
    signedInAs(authenticated('intake-officer'));
    const page = await firstValueFrom(
      TestBed.inject(MockResidentRepository).list({}, DEFAULT_PAGE_REQUEST),
    );
    const barangays = new Set(page.items.map((r) => r.resident.address.barangayId));
    expect(barangays.size).toBeGreaterThan(1);
  });

  it('confines a barangay link to its own barangay', async () => {
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    const page = await firstValueFrom(
      TestBed.inject(MockResidentRepository).list({}, DEFAULT_PAGE_REQUEST),
    );
    expect(page.items.length).toBeGreaterThan(0);
    for (const view of page.items) {
      expect(view.resident.address.barangayId).toBe(SAN_JUAN);
    }
  });

  it('cannot be widened by asking for another barangay explicitly', async () => {
    // The obvious bypass: edit the filter. The adapter re-checks scope, so the
    // filter can only ever narrow what scope already allows.
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    const page = await firstValueFrom(
      TestBed.inject(MockResidentRepository).list(
        { barangayId: asId<BarangayId>('brgy-dolores') },
        DEFAULT_PAGE_REQUEST,
      ),
    );
    expect(page.items).toHaveLength(0);
  });

  it('reports an out-of-scope record as absent, not as forbidden', async () => {
    // res-0002 is in Dolores. A distinguishable refusal would confirm the
    // record exists, which is the disclosure scope is meant to prevent.
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    const found = await firstValueFrom(
      TestBed.inject(MockResidentRepository).getById(asId<ResidentId>('res-0002')),
    );
    expect(found).toBeNull();
  });

  it('returns the same null for a record that genuinely does not exist', async () => {
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    const missing = await firstValueFrom(
      TestBed.inject(MockResidentRepository).getById(asId<ResidentId>('res-nope')),
    );
    expect(missing).toBeNull();
  });

  it('still serves an in-scope record', async () => {
    signedInAs(authenticated('barangay-link', SAN_JUAN));
    const found = await firstValueFrom(
      TestBed.inject(MockResidentRepository).getById(asId<ResidentId>('res-0001')),
    );
    expect(found?.resident.address.barangayId).toBe(SAN_JUAN);
  });
});

describe('permission enforcement on reads', () => {
  it('refuses a resident list without resident.view', async () => {
    // release-officer holds resident.view, so use a user with none.
    signedInAs(null);
    await expect(
      firstValueFrom(TestBed.inject(MockResidentRepository).list({}, DEFAULT_PAGE_REQUEST)),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('refuses the staff directory without staff.view', async () => {
    signedInAs(authenticated('intake-officer'));
    await expect(
      firstValueFrom(TestBed.inject(MockStaffRepository).list({}, DEFAULT_PAGE_REQUEST)),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('allows the staff directory for a role that holds staff.view', async () => {
    signedInAs(authenticated('auditor'));
    const page = await firstValueFrom(
      TestBed.inject(MockStaffRepository).list({}, DEFAULT_PAGE_REQUEST),
    );
    expect(page.items.length).toBeGreaterThan(0);
  });
});

describe('permission enforcement on lifecycle transitions', () => {
  const REQ_ENDORSED = asId<AssistanceRequestId>('req-0001');

  it('lets the MSWDO head approve an endorsed request', async () => {
    signedInAs(authenticated('mswdo-head'));
    const updated = await firstValueFrom(
      TestBed.inject(MockAssistanceRequestRepository).changeStatus(REQ_ENDORSED, 'approved', null),
    );
    expect(updated.status).toBe('approved');
  });

  it('refuses approval from a social worker even though the move is legal', async () => {
    // The lifecycle permits endorsed -> approved. The *permission* is what
    // stops the person who endorsed it also approving it (DL-08).
    signedInAs(authenticated('social-worker'));
    await expect(
      firstValueFrom(
        TestBed.inject(MockAssistanceRequestRepository).changeStatus(
          REQ_ENDORSED,
          'approved',
          null,
        ),
      ),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('refuses release from the head, who may approve but not pay out', async () => {
    signedInAs(authenticated('mswdo-head'));
    await expect(
      firstValueFrom(
        TestBed.inject(MockAssistanceRequestRepository).changeStatus(
          asId<AssistanceRequestId>('req-0003'),
          'released',
          null,
        ),
      ),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('names the missing permission without naming the record', async () => {
    signedInAs(authenticated('auditor'));
    try {
      await firstValueFrom(
        TestBed.inject(MockAssistanceRequestRepository).changeStatus(
          REQ_ENDORSED,
          'approved',
          null,
        ),
      );
      throw new Error('should have been refused');
    } catch (error) {
      expect(isPermissionDenied(error)).toBe(true);
      const denial = error as PermissionDeniedError;
      expect(denial.requiredPermission).toBe('request.approve');
      expect(denial.message).not.toContain('req-0001');
    }
  });

  it('checks permission before the record is even looked up', async () => {
    // A refused caller must not be able to probe which ids exist by comparing
    // "not found" against "not permitted".
    signedInAs(authenticated('auditor'));
    await expect(
      firstValueFrom(
        TestBed.inject(MockAssistanceRequestRepository).changeStatus(
          asId<AssistanceRequestId>('req-does-not-exist'),
          'approved',
          null,
        ),
      ),
    ).rejects.toThrow(PermissionDeniedError);
  });

  it('refuses everything when anonymous', async () => {
    signedInAs(null);
    await expect(
      firstValueFrom(
        TestBed.inject(MockAssistanceRequestRepository).changeStatus(
          REQ_ENDORSED,
          'approved',
          null,
        ),
      ),
    ).rejects.toThrow(PermissionDeniedError);
  });
});
