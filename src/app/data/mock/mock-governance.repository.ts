import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  AUDIT_ACTION_LABELS,
  AUDIT_DETAIL_RATIONALE,
  CLASSIFIED_RECORD_TYPES,
  PermissionDeniedError,
  RETENTION_RULES,
  ROLE_DEFINITIONS,
  asIsoDateTime,
  barangayName,
  classificationOf,
  formatPersonName,
  toAuditRow,
  userHasPermission,
  type AuditEntryDetail,
  type AuditEntryId,
  type AuditFilter,
  type AuditRow,
  type AuditSource,
  type ClassifiedRecordType,
  type CorrectionRequest,
  type GovernanceRepository,
  type RetentionRule,
  type StaffAccount,
  type StaffUser,
  type StaffUserId,
} from '@domain/index';

import { denyUnless } from './mock-access';
import { matchesSearch } from './mock-query';
import { MockLatency } from './mock-latency';
import { MOCK_STAFF } from './seed/staff.seed';
import {
  MOCK_AUDIT_DETAILS,
  MOCK_AUDIT_ENTRIES,
  MOCK_AUDIT_FIELDS,
  MOCK_AUDIT_SOURCES,
  MOCK_CORRECTION_REQUESTS,
  MOCK_STAFF_PROFILES,
} from './seed/governance.seed';

/**
 * The governance adapter.
 *
 * **The audit split is the point of this file.** `auditRows` composes rows
 * through `toAuditRow`, which has no parameter that could carry a recorded
 * value; the values live in a separate map keyed by entry id and are reachable
 * only through `auditDetail`, behind `audit.view-detail`. A list designed to be
 * scrolled and filtered by somebody reviewing other people's work cannot quote
 * what changed, because the rows do not hold it (`DL-114`).
 *
 * What is deliberately absent: no `create`, no `invite`, no `resetAccess`.
 * Accounts are provisioned by an administrator outside this console (`DL-32`),
 * and a half-built invite flow is worse than none.
 */
@Injectable()
export class MockGovernanceRepository implements GovernanceRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  private accountState: readonly StaffUser[] = [...MOCK_STAFF];

  /* ── Accounts ───────────────────────────────────────────────────────────── */

  accounts(): Observable<readonly StaffAccount[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly StaffAccount[]>(user, 'staff.view');
    if (denied) {
      return denied;
    }
    return this.latency.respond(
      [...this.accountState]
        .sort((a, b) => `${a.name.last} ${a.name.first}`.localeCompare(`${b.name.last} ${b.name.first}`))
        .map((staff) => this.toAccount(staff)),
    );
  }

  accountById(id: StaffUserId): Observable<StaffAccount | null> {
    const user = this.access.currentUser();
    if (!userHasPermission(user, 'staff.view')) {
      // Not found and not yours read identically (`DL-31`).
      return this.latency.respond(null);
    }
    const staff = this.accountState.find((candidate) => candidate.id === id);
    return this.latency.respond(staff === undefined ? null : this.toAccount(staff));
  }

  setAccountActive(
    id: StaffUserId,
    isActive: boolean,
    reason: string,
  ): Observable<StaffAccount> {
    const user = this.access.currentUser();
    const denied = denyUnless<StaffAccount>(user, 'staff.manage');
    if (denied) {
      return denied;
    }
    if (reason.trim().length === 0) {
      return throwError(() => new Error('Turning an account on or off needs a reason.'));
    }

    const staff = this.accountState.find((candidate) => candidate.id === id);
    if (staff === undefined) {
      return throwError(() => new PermissionDeniedError('staff.manage'));
    }
    // An administrator locking themselves out cannot undo it from here.
    if (!isActive && staff.id === user?.id) {
      return throwError(() => new Error('You cannot deactivate the account you are signed in as.'));
    }

    const updated: StaffUser = {
      ...staff,
      isActive,
      audit: { ...staff.audit, updatedAt: asIsoDateTime(new Date()), updatedBy: user?.id ?? null },
    };
    this.accountState = this.accountState.map((candidate) =>
      candidate.id === id ? updated : candidate,
    );
    return this.latency.respond(this.toAccount(updated));
  }

  private toAccount(staff: StaffUser): StaffAccount {
    const profile = MOCK_STAFF_PROFILES.find((entry) => entry.staffId === staff.id) ?? null;
    return {
      staffId: staff.id,
      displayName: formatPersonName(staff.name),
      role: staff.role,
      roleLabel: ROLE_DEFINITIONS[staff.role].label,
      position: staff.position,
      barangayId: staff.barangayId,
      barangayLabel: staff.barangayId === null ? null : barangayName(staff.barangayId),
      isActive: staff.isActive,
      lastSignInAt: staff.lastSignInAt,
      profile,
      additionalPermissionCount: staff.additionalPermissions.length,
    };
  }

  /* ── The trail ──────────────────────────────────────────────────────────── */

  auditRows(filter: AuditFilter): Observable<readonly AuditRow[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly AuditRow[]>(user, 'audit.view');
    if (denied) {
      return denied;
    }

    const rows = MOCK_AUDIT_ENTRIES.map((entry) =>
      toAuditRow(
        entry,
        entityLabelFor(entry.entityType),
        (MOCK_AUDIT_SOURCES[entry.id] ?? 'web') as AuditSource,
        MOCK_AUDIT_FIELDS[entry.id] ?? [],
        Object.prototype.hasOwnProperty.call(MOCK_AUDIT_DETAILS, entry.id),
      ),
    ).filter((row) => matchesFilter(row, filter));

    return this.latency.respond(
      [...rows].sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1)),
    );
  }

  auditDetail(id: AuditEntryId): Observable<AuditEntryDetail | null> {
    const user = this.access.currentUser();
    // A second grant, deliberately: reading that a record was updated is
    // oversight; reading what it was updated *to* is access to the record.
    const denied = denyUnless<AuditEntryDetail | null>(user, 'audit.view-detail');
    if (denied) {
      return denied;
    }

    const changes = MOCK_AUDIT_DETAILS[id];
    if (changes === undefined) {
      return this.latency.respond(null);
    }
    return this.latency.respond({
      id,
      changes,
      // Restated where it is used, so a reader knows their own view is recorded.
      accessRationale: AUDIT_DETAIL_RATIONALE,
    });
  }

  /* ── What the office says about its own data ────────────────────────────── */

  classifications(): Observable<readonly ClassifiedRecordType[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly ClassifiedRecordType[]>(user, 'settings.manage');
    if (denied) {
      return denied;
    }
    return this.latency.respond(CLASSIFIED_RECORD_TYPES);
  }

  retention(): Observable<readonly RetentionRule[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly RetentionRule[]>(user, 'settings.manage');
    if (denied) {
      return denied;
    }
    // Labels and classifications come from the classification catalogue rather
    // than being restated here, so the two cannot drift.
    return this.latency.respond(
      RETENTION_RULES.map((rule) => {
        const type = CLASSIFIED_RECORD_TYPES.find(
          (entry) => entry.key === rule.recordTypeKey,
        );
        return {
          ...rule,
          label: type?.label ?? rule.recordTypeKey,
          classification: classificationOf(rule.recordTypeKey) ?? rule.classification,
        };
      }),
    );
  }

  corrections(): Observable<readonly CorrectionRequest[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly CorrectionRequest[]>(user, 'settings.manage');
    if (denied) {
      return denied;
    }
    return this.latency.respond(
      [...MOCK_CORRECTION_REQUESTS].sort((a, b) => (a.raisedAt < b.raisedAt ? 1 : -1)),
    );
  }
}

function matchesFilter(row: AuditRow, filter: AuditFilter): boolean {
  if (filter.actorId !== undefined && row.actorId !== filter.actorId) {
    return false;
  }
  if (filter.action !== undefined && row.action !== filter.action) {
    return false;
  }
  if (filter.entityType !== undefined && row.entityType !== filter.entityType) {
    return false;
  }
  if (filter.sensitiveOnly === true && !row.touchesSensitive) {
    return false;
  }
  if (filter.from !== undefined && row.occurredAt.slice(0, 10) < filter.from) {
    return false;
  }
  if (filter.to !== undefined && row.occurredAt.slice(0, 10) > filter.to) {
    return false;
  }
  // Searched over the summary, the actor and the action label — never over a
  // recorded value, because the row does not hold one.
  return matchesSearch(
    [row.summary, row.actorName, AUDIT_ACTION_LABELS[row.action], row.entityLabel],
    filter.search,
  );
}

function entityLabelFor(entityType: string): string {
  const type = CLASSIFIED_RECORD_TYPES.find((entry) => entry.key === entityType);
  if (type !== undefined) {
    return type.label;
  }
  return entityType === 'staff' ? 'Staff account' : entityType;
}
