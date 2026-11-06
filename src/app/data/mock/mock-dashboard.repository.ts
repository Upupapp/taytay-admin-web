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
  userHasPermission,
  type AccountVerificationStatus,
  type AssistanceRequest,
  type AssistanceRequestStatus,
  type AttentionSignal,
  type AuthenticatedUser,
  type BarangayCount,
  type CategoryTotal,
  type DashboardFilter,
  type DashboardPayouts,
  type DashboardPeriod,
  type DashboardRepository,
  type DashboardSummary,
  type Release,
  type Money,
  type ProgramCategory,
  type ResidentAppFigures,
  type StatusCount,
} from '@domain/index';

import { MOCK_ASSISTANCE_REQUESTS } from './seed/assistance-requests.seed';
import { MOCK_APP_ACCOUNTS } from './seed/app-accounts.seed';
import { MOCK_DISBURSEMENTS } from './seed/releases.seed';
import { MOCK_PROGRAMS } from './seed/programs.seed';
import { MOCK_REFERRALS } from './seed/referrals.seed';
import { MOCK_VERIFICATION_REQUESTS } from './seed/verification-requests.seed';
import { MOCK_SEED_DIGITAL_IDS } from './mock-digital-id.repository';
import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';

const PERIOD_DAYS: Readonly<Record<DashboardPeriod, number | null>> = {
  'all-time': null,
  'last-30-days': 30,
  'last-90-days': 90,
};

/** A release handed over: the statuses that carry a release date, and that nothing goes back from. */
const HANDED_OVER: readonly Release['status'][] = ['released', 'claimed', 'completed'];

/**
 * The rule each signal applied, in the words the API states it (`DL-98`, `DL-182`), so the mock
 * reads the same as the server it stands in for.
 */
const BASIS: Readonly<Record<AttentionSignal['kind'], string>> = {
  'awaiting-approval':
    'Filed requests whose status is endorsed: a social worker has endorsed them and the decision is the head’s.',
  'returned-to-applicant':
    'Filed requests whose status is returned: the applicant was asked for more.',
  'missing-requirements':
    'Open filed requests with a required document, or a conditional one ruled to apply, that is ' +
    'neither verified nor waived. A conditional document nobody has ruled on yet is not counted ' +
    'against the applicant.',
  'payout-due': 'Releases scheduled into a payout session and not yet handed over.',
  'unclaimed-payout':
    'Releases marked unclaimed: scheduled, and nobody came to collect. The record does not say why.',
  'referral-unanswered':
    'Referrals sent to another organisation with no acknowledgement recorded. With a programme ' +
    'type chosen, only referrals made from a request of that type are counted.',
};

/**
 * Derives every dashboard figure from the same seed the list screens use, so
 * a headline number and the table behind it cannot disagree in a demo.
 *
 * Access is enforced here as in every other adapter (`DL-30`). Until TAB 06
 * this repository had **no** check at all, which meant an anonymous or
 * unprivileged caller could read municipality-wide counts — aggregate figures
 * are still information about residents. It requires `dashboard.view` and
 * narrows as the lists do (`DL-182`): a `barangay-link` counts its own
 * barangay, a caseload the filed requests assigned to it, and a reader the
 * release list refuses gets no payout figures at all rather than zeroes.
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
    const caseload = user?.scope === 'assigned-cases';

    // Filed requests only, as the request list reads them: a draft is somebody's unfinished form.
    const requests = MOCK_ASSISTANCE_REQUESTS.filter(
      (request) =>
        request.status !== 'draft' &&
        isWithinBarangayScope(user, request.barangayId) &&
        (!caseload || request.assignedTo === user.id) &&
        matchesBarangay(request.barangayId, filter) &&
        matchesCategory(request.programId, filter),
    );

    const requestIds = new Set(requests.map((request) => request.id));
    const payouts =
      userHasPermission(user, 'release.view') && !caseload
        ? payoutsOf(
            MOCK_DISBURSEMENTS.filter((d) => requestIds.has(d.requestId)),
            requests,
            since,
          )
        : null;
    const narrowed =
      caseload ||
      user?.scope === 'own-barangay' ||
      filter.barangayId !== undefined ||
      filter.category !== undefined;
    const unansweredReferrals = userHasPermission(user, 'referral.view')
      ? MOCK_REFERRALS.filter(
          (referral) =>
            referral.status === 'sent' &&
            referral.respondedAt === null &&
            // A referral naming no request carries no barangay or programme here, so it is
            // counted only when nothing narrows the figures.
            (referral.requestId === null ? !narrowed : requestIds.has(referral.requestId)),
        ).length
      : null;

    const summary: DashboardSummary = {
      generatedAt: asIsoDateTime(new Date()),
      appliedFilter: filter,
      attention: sortAttention(buildAttention(requests, payouts, unansweredReferrals)),

      openRequests: requests.filter((r) => !isTerminalAssistanceStatus(r.status)).length,
      awaitingApproval: countByStatus(requests, 'endorsed'),
      requestsByStatus: byStatus(requests),
      requestsByBarangay: byBarangay(requests),

      payouts,
      residentApp: residentAppFor(user, since),
    };

    return this.latency.respond(summary);
  }
}

/* ── payouts ──────────────────────────────────────────────────────────────── */

function payoutsOf(
  releases: readonly Release[],
  requests: readonly AssistanceRequest[],
  since: Date | null,
): DashboardPayouts {
  const released = releases.filter(
    (d) => HANDED_OVER.includes(d.status) && withinPeriod(d.releasedAt, since),
  );
  return {
    scheduledPayouts: releases.filter((d) => d.status === 'scheduled').length,
    residentsServedInPeriod: new Set(released.map((d) => d.residentId)).size,
    // Goods reached families too, but carry no peso figure. Left out of the
    // money total rather than counted as zero, and counted beside it (`DL-93`).
    disbursedInPeriod: sumMoney(moneyOf(released)),
    goodsReleasedInPeriod: released.filter((d) => d.amount === null).length,
    disbursedByCategory: byCategory(released, requests),
  };
}

function moneyOf(releases: readonly Release[]): readonly Money[] {
  return releases.flatMap((d) => (d.amount === null ? [] : [d.amount]));
}

/* ── the residents' app ───────────────────────────────────────────────────── */

/**
 * The app's accounts, ID reviews and cards, each behind the key of the list it counts, and absent
 * for a reader who holds none of them (`DL-182`).
 *
 * The seed's accounts carry no registration date, so they are all taken as registered before any
 * recent period: "new in the last 30 days" reads zero in the demo rather than an invented figure.
 */
function residentAppFor(
  user: AuthenticatedUser | null,
  since: Date | null,
): ResidentAppFigures | null {
  const accounts = userHasPermission(user, 'user.view');
  const reviews = userHasPermission(user, 'verification.review');
  const cards = userHasPermission(user, 'digital-id.manage');
  if (!accounts && !reviews && !cards) {
    return null;
  }

  const residents = MOCK_APP_ACCOUNTS.filter(
    (account) => account.role === 'registered' || account.role === 'verified',
  );
  const byVerification: Record<AccountVerificationStatus, number> = {
    unverified: 0,
    pending: 0,
    verified: 0,
    rejected: 0,
  };
  for (const account of residents) {
    byVerification[verificationOf(account.id, account.role)] += 1;
  }
  const now = Date.now();

  return {
    accounts: accounts
      ? {
          registered: residents.length,
          registeredInPeriod: since === null ? residents.length : 0,
          byVerification,
        }
      : null,
    verificationsWaiting: reviews
      ? MOCK_VERIFICATION_REQUESTS.filter((request) => request.status === 'pending').length
      : null,
    digitalIdsActive: cards
      ? MOCK_SEED_DIGITAL_IDS.filter(
          (card) => card.status === 'active' && new Date(card.expiresAt).getTime() > now,
        ).length
      : null,
  };
}

/** A verified account is verified; otherwise its latest ID review says, and none means unverified. */
function verificationOf(
  accountId: (typeof MOCK_APP_ACCOUNTS)[number]['id'],
  role: (typeof MOCK_APP_ACCOUNTS)[number]['role'],
): AccountVerificationStatus {
  if (role === 'verified') {
    return 'verified';
  }
  const latest = MOCK_VERIFICATION_REQUESTS.filter((request) => request.accountId === accountId)
    .slice()
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0];
  switch (latest?.status) {
    case 'pending':
      return 'pending';
    case 'rejected':
      return 'rejected';
    case 'approved':
      return 'verified';
    case undefined:
      return 'unverified';
  }
}

/* ── attention signals ────────────────────────────────────────────────────── */

/**
 * The "what needs attention now?" list.
 *
 * Every signal is a count of records that exist under the current filter, so
 * each one can be traced by following its drill-down. Signals with a zero count
 * are dropped rather than shown as "0" — an empty list is a real answer, and a
 * wall of zeroes is noise. Payout and referral signals are counted only for a
 * reader who may read those lists.
 */
function buildAttention(
  requests: readonly AssistanceRequest[],
  payouts: DashboardPayouts | null,
  unansweredReferrals: number | null,
): readonly AttentionSignal[] {
  const signals: AttentionSignal[] = [];

  const push = (
    kind: AttentionSignal['kind'],
    severity: AttentionSignal['severity'],
    count: number,
    permission: AttentionSignal['permission'],
  ): void => {
    if (count > 0) {
      signals.push({ kind, severity, count, permission, basis: BASIS[kind] });
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

  if (payouts !== null) {
    // Money committed and dated, not yet handed over.
    push('payout-due', 'critical', payouts.scheduledPayouts, 'release.release');
  }

  // Scheduled, and nobody came. Acting on it means re-scheduling, so the
  // permission is `schedule`, not `view`: this list is a to-do, and a read
  // permission would put items on a read-only role's list that they cannot do
  // anything about.
  if (payouts !== null) {
    const unclaimed = MOCK_DISBURSEMENTS.filter(
      (d) => d.status === 'unclaimed' && requests.some((request) => request.id === d.requestId),
    ).length;
    push('unclaimed-payout', 'warning', unclaimed, 'release.schedule');
  }

  // Sent to a partner office with no acknowledgement. Chasing a referral is
  // `referral.manage`; merely being able to read one does not make it your job.
  if (unansweredReferrals !== null) {
    push('referral-unanswered', 'info', unansweredReferrals, 'referral.manage');
  }

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
  const counts = new Map<AssistanceRequest['barangayId'], number>();
  for (const request of requests) {
    counts.set(request.barangayId, (counts.get(request.barangayId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([barangayId, count]) => ({ barangayId, count }))
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
    const existing = totals.get(category) ?? {
      category,
      amount: sumMoney([]),
      count: 0,
      goodsCount: 0,
    };
    totals.set(
      category,
      release.amount === null
        ? { ...existing, goodsCount: existing.goodsCount + 1 }
        : {
            ...existing,
            amount: sumMoney([existing.amount, release.amount]),
            count: existing.count + 1,
          },
    );
  }

  return [...totals.values()].sort(
    (a, b) => b.amount.centavos - a.amount.centavos || b.goodsCount - a.goodsCount,
  );
}
