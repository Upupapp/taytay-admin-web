import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { APP_ENVIRONMENT } from '@core/config/app-environment.token';
import {
  ACCESS_CONTEXT,
  asId,
  PermissionDeniedError,
  ROLE_DEFINITIONS,
  type AccessContext,
  type AssistanceRequestId,
  type AuthenticatedUser,
  type DocumentRequestId,
  type Permission,
  type StaffRole,
  type StaffUserId,
} from '@domain/index';

import { MockAssistanceRequestRepository } from './mock-assistance-request.repository';

const REQ = asId<AssistanceRequestId>('req-0003');
const OPEN_REQUEST = asId<DocumentRequestId>('dr-0001');

let user: AuthenticatedUser | null = null;

function authenticated(role: StaffRole): AuthenticatedUser {
  const definition = ROLE_DEFINITIONS[role];
  return {
    id: asId<StaffUserId>('staff-intake'),
    displayName: 'Liezl Padilla',
    email: 'test@example.gov.ph',
    role,
    roleLabel: definition.label,
    position: 'Tester',
    barangayId: null,
    scope: definition.scope,
    permissions: new Set<Permission>(definition.permissions),
  };
}

const context: AccessContext = { currentUser: () => user };

const repo = (): MockAssistanceRequestRepository =>
  TestBed.inject(MockAssistanceRequestRepository);

beforeEach(() => {
  user = null;
  TestBed.configureTestingModule({
    providers: [
      MockAssistanceRequestRepository,
      { provide: ACCESS_CONTEXT, useValue: context },
      { provide: APP_ENVIRONMENT, useValue: { latencyMs: 0, dataSource: 'mock' } },
    ],
  });
});

describe('withdrawing a request for a document', () => {
  /**
   * The row is closed, never removed.
   *
   * "We no longer need this" has to stay distinguishable from "we never asked". An applicant told
   * the office has stopped asking should be able to see when it stopped and why, and a deleted row
   * makes the office's own follow-up unprovable — the failure the whole record exists to prevent.
   */
  it('keeps the record and marks it withdrawn, with the reason', async () => {
    user = authenticated('intake-officer');

    const after = await firstValueFrom(
      repo().withdrawDocumentRequest(REQ, OPEN_REQUEST, 'The barangay sent it directly.'),
    );
    const row = after.find((entry) => entry.id === OPEN_REQUEST);

    expect(row).toBeDefined();
    expect(row?.state).toBe('withdrawn');
    expect(row?.withdrawnReason).toBe('The barangay sent it directly.');
    expect(row?.closedAt).not.toBeNull();
    // The message is what the applicant was told. Withdrawing does not rewrite it.
    expect(row?.message).toContain('barangay certificate of indigency');
  });

  it('refuses a withdrawal with no reason', async () => {
    user = authenticated('intake-officer');

    await expect(
      firstValueFrom(repo().withdrawDocumentRequest(REQ, OPEN_REQUEST, '   ')),
    ).rejects.toThrow(/reason/i);
  });

  /** Twice is a conflict, not a no-op: the second reason would overwrite the first. */
  it('refuses to withdraw a request that is already closed', async () => {
    user = authenticated('intake-officer');
    await firstValueFrom(repo().withdrawDocumentRequest(REQ, OPEN_REQUEST, 'Received.'));

    await expect(
      firstValueFrom(repo().withdrawDocumentRequest(REQ, OPEN_REQUEST, 'Again.')),
    ).rejects.toThrow(/already closed/i);
  });

  it('refuses a request that belongs to another case', async () => {
    user = authenticated('intake-officer');

    await expect(
      firstValueFrom(
        repo().withdrawDocumentRequest(asId<AssistanceRequestId>('req-0001'), OPEN_REQUEST, 'x'),
      ),
    ).rejects.toThrow(/not found/i);
  });

  it('is refused to a role that cannot record documents', async () => {
    user = authenticated('auditor');

    await expect(
      firstValueFrom(repo().withdrawDocumentRequest(REQ, OPEN_REQUEST, 'Received.')),
    ).rejects.toThrow(PermissionDeniedError);
  });
});
