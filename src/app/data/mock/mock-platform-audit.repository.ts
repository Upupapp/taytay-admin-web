import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asId,
  asIsoDateTime,
  type CursorPage,
  type CursorRequest,
  type PlatformAuditEntry,
  type PlatformAuditEntryId,
  type PlatformAuditRepository,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';

/** The prefix of every sample row's id, and a `check:bundle` seed marker: it must never ship. */
export const SAMPLE_AUDIT_PREFIX = 'audit-sample-';

const LARGEST_PAGE = 50;

const ACTS: readonly (readonly [string, string])[] = [
  ['verification.approved', 'verification_request'],
  ['digital_id.issued', 'digital_id'],
  ['digital_id.scanned', 'digital_id'],
  ['news.created', 'news'],
  ['news.pinned', 'news'],
  ['user.role_changed', 'user'],
  ['banner.updated', 'banner'],
  ['app.config_updated', 'app_config'],
  ['thread.closed', 'thread'],
  ['session.revoked', 'user'],
];

/** Fictional rows, newest first, enough for a second page; the ids name nobody. */
const SEED: readonly PlatformAuditEntry[] = Array.from({ length: 64 }, (_, index) => {
  const [action, subjectType] = ACTS[index % ACTS.length] ?? ['news.updated', 'news'];
  return {
    id: asId<PlatformAuditEntryId>(`${SAMPLE_AUDIT_PREFIX}${String(index + 1).padStart(4, '0')}`),
    actorId: index % 9 === 8 ? null : `staff-sample-${(index % 3) + 1}`,
    action,
    subjectType,
    subjectId: subjectType === 'app_config' ? null : `record-sample-${index + 1}`,
    at: asIsoDateTime(new Date(Date.UTC(2026, 10, 5, 9) - index * 37 * 60 * 1000)),
  };
});

/** The API's trail for the `local-mock` configuration (`DL-171`): read-only, newest first. */
@Injectable()
export class MockPlatformAuditRepository implements PlatformAuditRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  list(page: CursorRequest): Observable<CursorPage<PlatformAuditEntry>> {
    const denied = denyUnless<CursorPage<PlatformAuditEntry>>(
      this.access.currentUser(),
      'audit.view',
    );
    if (denied) return denied;

    const start = page.cursor ? Number.parseInt(page.cursor, 10) || 0 : 0;
    const end = start + Math.min(Math.max(1, page.limit), LARGEST_PAGE);
    const hasMore = end < SEED.length;
    return this.latency.respond({
      items: SEED.slice(start, end),
      hasMore,
      nextCursor: hasMore ? String(end) : null,
    });
  }
}
