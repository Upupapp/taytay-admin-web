import { inject, Injectable } from '@angular/core';
import type { Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asIsoDateTime,
  isTerminalAssistanceStatus,
  isWithinBarangayScope,
  outstandingRequirements,
  sortAttention,
  sumMoney,
  ZERO_PESOS,
  type AssistanceRequest,
  type AssistanceRequestStatus,
  type AttentionSignal,
  type BarangayCount,
  type CategoryTotal,
  type DashboardFilter,
  type DashboardPeriod,
  type DashboardRepository,
  type DashboardSummary,
  type Release,
  type Money,
  type ProgramCategory,
  type StatusCount,
} from '@domain/index';

import { MOCK_ASSISTANCE_REQUESTS } from './seed/assistance-requests.seed';
import { MOCK_DISBURSEMENTS } from './seed/releases.seed';
import { MOCK_PROGRAMS } from './seed/programs.seed';
import { MOCK_REFERRALS } from './seed/referrals.seed';
import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';

const PERIOD_DAYS: Readonly<Record<DashboardPeriod, number | null>> = {
  'all-time': null,
  'last-30-days': 30,
  'last-90-days': 90,
};

/**
 * Derives every dashboard figure from the same seed the list screens use, so
 * a headline number and the table behind it cannot disagree in a demo.
 *
 * Access is enforced here as in every other adapter (`DL-30`). Until TAB 06
 * this repository had **no** check at all, which meant an anonymous or
 * unprivileged caller could read municipality-wide counts — aggregate figures
 * are still information about residents. It now requires `dashboard.view` and
 * respects barangay scope, so a `barangay-link` sees their own barangay's
 * numbers rather than the municipality's.
 */
@Injectable()
export class MockDashboardRepository implements DashboardRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  summary(filter: DashboardFilter): Observable<DashboardSummary> {
    const user = this.access.currentUser();
    const denied = denyUnless<DashboardSummary>(user, 'dashboard.view');
    if (denied) {
      return denied;
    }

    const period = filter.period ?? 'all-time';
    const since = periodStart(period);

    const requests = MOCK_ASSISTANCE_REQUESTS.filter(
      (request) =>
        isWithinBarangayScope(user, request.barangayId) &&
        matchesBarangay(request.barangayId, filter) &&
        matchesCategory(request.programId, filter),
    );

    const requestIds = new Set(requests.map((request) => request.id));
    const releases = MOCK_DISBURSEMENTS.filter((d) => requestIds.has(d.requestId));

    const released = releases.filter(
      (d) =>
        (d.status === 'released' || d.status === 'claimed') && withinPeriod(d.releasedAt, since),
    );

    const summary: DashboardSummary = {
      generatedAt: asIsoDateTime(new Date()),
      appliedFilter: filter,
      attention: sortAttention(buildAttention(requests, releases, requestIds)),

      openRequests: requests.filter((r) => !isTerminalAssistanceStatus(r.status)).length,
      awaitingApproval: countByStatus(requests, 'endorsed'),
      scheduledPayouts: releases.filter((d) => d.status === 'scheduled').length,
      residentsServedInPeriod: new Set(released.map((d) => d.residentId)).size,
      // Goods reached families too, but carry no peso figure. Left out of the
      // money total rather than counted as zero (`DL-93`).
      disbursedInPeriod: sumMoney(
        released.filter((d) => d.amount !== null).map((d) => d.amount as Money),
      ),

      requestsByStatus: byStatus(requests),
      requestsByBarangay: byBarangay(requests),
      disbursedByCategory: byCategory(released, requests),
    };

    return this.latency.respond(summary);
  }
}

/* ── attention signals ────────────────────────────────────────────────────── */

/**
 * The "what needs attention now?" list.
 *
 * Every signal is a count of records that exist under the current filter, so
 * each one can be traced by following its drill-down. Signals with a zero count
 * are dropped rather than shown as "0" — an empty list is a real answer, and a
 * wall of zeroes is noise.
 */
function buildAttention(
  requests: readonly AssistanceRequest[],
  releases: readonly Release[],
  requestIds: ReadonlySet<AssistanceRequest['id']>,
): readonly AttentionSignal[] {
  const signals: AttentionSignal[] = [];

  const push = (
    kind: AttentionSignal['kind'],
    severity: AttentionSignal['severity'],
    count: number,
    permission: AttentionSignal['permission'],
  ): void => {
    if (count > 0) {
      signals.push({ kind, severity, count, permission });
    }
  };

  // Someone has endorsed these and is waiting on a decision.
  push('awaiting-approval', 'critical', countByStatus(requests, 'endorsed'), 'request.approve');

  // The applicant has been asked for something and the clock is running.
  push('returned-to-applicant', 'warning', countByStatus(requests, 'returned'), 'request.intake');

  // Open requests still missing a mandatory document.
  const missing = requests.filter(
    (request) =>
      !isTerminalAssistanceStatus(request.status) && outstandingRequirements(request).length > 0,
  ).length;
  push('missing-requirements', 'warning', missing, 'request.intake');

  // Money committed and dated, not yet handed over.
  push(
    'payout-due',
    'critical',
    releases.filter((d) => d.status === 'scheduled').length,
    'release.release',
  );

  // Released but never collected — the grant may lapse. Acting on it means
  // re-scheduling, so the permission is `schedule`, not `view`: this list is a
  // to-do, and a read permission would put items on a read-only role's list
  // that they cannot do anything about.
  push(
    'unclaimed-payout',
    'warning',
    releases.filter((d) => d.status === 'unclaimed').length,
    'release.schedule',
  );

  // Sent to a partner office with no acknowledgement.
  const unanswered = MOCK_REFERRALS.filter(
    (referral) =>
      referral.status === 'sent' &&
      referral.respondedAt === null &&
      (referral.requestId === null || requestIds.has(referral.requestId)),
  ).length;
  // Chasing a referral is `referral.manage`; merely being able to read one
  // does not make it your job.
  push('referral-unanswered', 'info', unanswered, 'referral.manage');

  return signals;
}

/* ── helpers ──────────────────────────────────────────────────────────────── */

function periodStart(period: DashboardPeriod): Date | null {
  const days = PERIOD_DAYS[period];
  if (days === null) {
    return null;
  }
  const start = new Date();
  start.setUTCDate(start.getUTCDate() - days);
  return start;
}

function withinPeriod(timestamp: string | null, since: Date | null): boolean {
  if (since === null) {
    return true;
  }
  return timestamp !== null && new Date(timestamp).getTime() >= since.getTime();
}

function matchesBarangay(barangayId: AssistanceRequest['barangayId'], filter: DashboardFilter) {
  return filter.barangayId === undefined || filter.barangayId === barangayId;
}

function matchesCategory(programId: AssistanceRequest['programId'], filter: DashboardFilter) {
  if (filter.category === undefined) {
    return true;
  }
  return categoryOf(programId) === filter.category;
}

function categoryOf(programId: AssistanceRequest['programId']): ProgramCategory | null {
  return MOCK_PROGRAMS.find((program) => program.id === programId)?.category ?? null;
}

function countByStatus(
  requests: readonly AssistanceRequest[],
  status: AssistanceRequestStatus,
): number {
  return requests.filter((request) => request.status === status).length;
}

function byStatus(requests: readonly AssistanceRequest[]): readonly StatusCount[] {
  const counts = new Map<AssistanceRequestStatus, number>();
  for (const request of requests) {
    counts.set(request.status, (counts.get(request.status) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([status, count]) => ({ status, count }))
    .sort((a, b) => b.count - a.count);
}

function byBarangay(requests: readonly AssistanceRequest[]): readonly BarangayCount[] {
  const counts = new Map<string, number>();
  for (const request of requests) {
    counts.set(request.barangayId, (counts.get(request.barangayId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([barangayId, count]) => ({
      barangayId: barangayId as BarangayCount['barangayId'],
      count,
    }))
    .sort((a, b) => b.count - a.count);
}

function byCategory(
  released: readonly Release[],
  requests: readonly AssistanceRequest[],
): readonly CategoryTotal[] {
  const totals = new Map<ProgramCategory, CategoryTotal>();

  for (const release of released) {
    const request = requests.find((candidate) => candidate.id === release.requestId);
    const category = request ? categoryOf(request.programId) : null;
    if (category === null) {
      continue;
    }
    const existing = totals.get(category);
    totals.set(category, {
      category,
      amount: sumMoney([existing?.amount ?? ZERO_PESOS, release.amount ?? ZERO_PESOS]),
      count: (existing?.count ?? 0) + 1,
    });
  }

  return [...totals.values()].sort((a, b) => b.amount.centavos - a.amount.centavos);
}
