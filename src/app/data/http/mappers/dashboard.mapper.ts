import {
  ASSISTANCE_STATUS_CATALOG,
  DASHBOARD_PERIODS,
  PERMISSIONS,
  PROGRAM_CATEGORY_LABELS,
  centavos,
  sortAttention,
  type AccountVerificationStatus,
  type AssistanceRequestStatus,
  type AttentionKind,
  type AttentionSeverity,
  type AttentionSignal,
  type BarangayCount,
  type CategoryTotal,
  type DashboardFilter,
  type DashboardPayouts,
  type DashboardSummary,
  type ProgramCategory,
  type ResidentAppAccounts,
  type ResidentAppFigures,
  type StatusCount,
} from '@domain/index';

import type { BarangayIndex } from './resident.mapper';
import { dateTime, field, int, oneOf, str } from './wire';

/**
 * The dashboard, from `GET office/dashboard` (`DL-182`).
 *
 * | Wire                                      | Domain                                  | Absent or wrong means                 |
 * | ----------------------------------------- | --------------------------------------- | ------------------------------------- |
 * | `generated_at`                            | `generatedAt`                           | nothing is shown                      |
 * | `applied_filter{barangay_id,category,…}`  | `appliedFilter`, the barangay joined    | nothing is shown                      |
 * | `attention[]{kind,…,permission,basis}`    | `attention`, re-sorted                  | nothing is shown                      |
 * | `requests{open,awaiting_approval,by_*}`   | `openRequests`, `awaitingApproval`, …   | nothing is shown                      |
 * | `payouts` — null for a reader the release list refuses | `payouts` (`null` kept)    | nothing is shown                      |
 * | `resident_app` — null without an app key  | `residentApp` (`null` kept)             | nothing is shown                      |
 *
 * **Whole or not at all.** Every other mapper drops a row it cannot read; an aggregate cannot,
 * because a dropped row is a figure silently understated — a barangay missing from the breakdown
 * reads as "no requests there". So one unreadable value anywhere refuses the summary, and the
 * screen says it could not load rather than showing a total that does not add up.
 *
 * Money arrives as integer centavos and stays integer centavos; goods arrive as a count and are
 * never given a value (`DL-93`). A `null` group is kept `null` — absent, never turned into zero.
 */

const STATUSES: readonly AssistanceRequestStatus[] = Object.values(ASSISTANCE_STATUS_CATALOG).map(
  (entry) => entry.value,
);

const CATEGORIES = Object.keys(PROGRAM_CATEGORY_LABELS) as readonly ProgramCategory[];

const KINDS: readonly AttentionKind[] = [
  'awaiting-approval',
  'returned-to-applicant',
  'missing-requirements',
  'payout-due',
  'unclaimed-payout',
  'referral-unanswered',
];

const SEVERITIES: readonly AttentionSeverity[] = ['critical', 'warning', 'info'];

/** A count: a whole number, never negative. */
function count(value: unknown): number | null {
  const n = int(value);
  return n !== null && n >= 0 ? n : null;
}

/** Every element read, or `null` if any one cannot be — never a shorter list. */
function whole<T>(value: unknown, read: (item: unknown) => T | null): readonly T[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value.map(read);
  return items.every((item): item is T => item !== null) ? items : null;
}

/**
 * The summary, under the filter the server says it applied.
 *
 * @consumes GET office/dashboard
 */
export function toDashboardSummary(
  wire: unknown,
  barangays: BarangayIndex,
): DashboardSummary | null {
  const generatedAt = dateTime(field(wire, 'generated_at'));
  const appliedFilter = filterOf(field(wire, 'applied_filter'), barangays);
  const attention = whole(field(wire, 'attention'), attentionOf);
  const requests = field(wire, 'requests');
  const payoutsWire = field(wire, 'payouts');
  const residentAppWire = field(wire, 'resident_app');

  const openRequests = count(field(requests, 'open'));
  const awaitingApproval = count(field(requests, 'awaiting_approval'));
  const requestsByStatus = whole(field(requests, 'by_status'), statusCountOf);
  const requestsByBarangay = whole(field(requests, 'by_barangay'), (row) =>
    barangayCountOf(row, barangays),
  );
  const payouts = payoutsWire === null ? null : payoutsOf(payoutsWire);
  const residentApp = residentAppWire === null ? null : residentAppOf(residentAppWire);

  if (
    generatedAt === null ||
    appliedFilter === null ||
    attention === null ||
    openRequests === null ||
    awaitingApproval === null ||
    requestsByStatus === null ||
    requestsByBarangay === null ||
    payouts === undefined ||
    residentApp === undefined
  ) {
    return null;
  }

  return {
    generatedAt,
    appliedFilter,
    attention: sortAttention(attention),
    openRequests,
    awaitingApproval,
    requestsByStatus,
    requestsByBarangay,
    payouts,
    residentApp,
  };
}

/** The filter as the server echoes it, its barangay joined back to this console's id. */
function filterOf(value: unknown, barangays: BarangayIndex): DashboardFilter | null {
  const period = oneOf(field(value, 'period'), DASHBOARD_PERIODS);
  const rawBarangay = field(value, 'barangay_id');
  const rawCategory = field(value, 'category');
  const barangayId = rawBarangay === null ? null : barangays.toConsole(str(rawBarangay));
  const category = rawCategory === null ? null : oneOf(rawCategory, CATEGORIES);

  if (
    period === null ||
    (rawBarangay !== null && barangayId === null) ||
    (rawCategory !== null && category === null)
  ) {
    return null;
  }

  return {
    ...(barangayId === null ? {} : { barangayId }),
    ...(category === null ? {} : { category }),
    period,
  };
}

function attentionOf(value: unknown): AttentionSignal | null {
  const kind = oneOf(field(value, 'kind'), KINDS);
  const severity = oneOf(field(value, 'severity'), SEVERITIES);
  const signalCount = count(field(value, 'count'));
  const permission = oneOf(field(value, 'permission'), PERMISSIONS);
  const basis = str(field(value, 'basis'))?.trim() ?? '';

  // A signal without its basis is one nobody can check (`DL-98`): refused, not shown bare.
  if (
    kind === null ||
    severity === null ||
    signalCount === null ||
    permission === null ||
    basis === ''
  ) {
    return null;
  }

  return { kind, severity, count: signalCount, permission, basis };
}

function statusCountOf(value: unknown): StatusCount | null {
  const status = oneOf(field(value, 'status'), STATUSES);
  const n = count(field(value, 'count'));
  return status === null || n === null ? null : { status, count: n };
}

/** A barangay the console cannot place refuses the breakdown rather than vanishing from it. */
function barangayCountOf(value: unknown, barangays: BarangayIndex): BarangayCount | null {
  const barangayId = barangays.toConsole(str(field(value, 'barangay_id')));
  const n = count(field(value, 'count'));
  return barangayId === null || n === null ? null : { barangayId, count: n };
}

/** `undefined` when unreadable, so a readable `null` on the wire stays a deliberate absence. */
function payoutsOf(value: unknown): DashboardPayouts | undefined {
  const scheduledPayouts = count(field(value, 'scheduled'));
  const released = count(field(value, 'released_amount_centavos'));
  const goodsReleasedInPeriod = count(field(value, 'goods_released'));
  const residentsServedInPeriod = count(field(value, 'residents_served'));
  const disbursedByCategory = whole(field(value, 'by_category'), categoryTotalOf);

  if (
    scheduledPayouts === null ||
    released === null ||
    goodsReleasedInPeriod === null ||
    residentsServedInPeriod === null ||
    disbursedByCategory === null
  ) {
    return undefined;
  }

  return {
    scheduledPayouts,
    residentsServedInPeriod,
    disbursedInPeriod: centavos(released),
    goodsReleasedInPeriod,
    disbursedByCategory,
  };
}

function categoryTotalOf(value: unknown): CategoryTotal | null {
  const category = oneOf(field(value, 'category'), CATEGORIES);
  const amount = count(field(value, 'amount_centavos'));
  const moneyCount = count(field(value, 'money_count'));
  const goodsCount = count(field(value, 'goods_count'));

  if (category === null || amount === null || moneyCount === null || goodsCount === null) {
    return null;
  }

  return { category, amount: centavos(amount), count: moneyCount, goodsCount };
}

/** Each figure keeps its own `null`: a key the reader does not hold, not a zero. */
function residentAppOf(value: unknown): ResidentAppFigures | undefined {
  if (value === null || typeof value !== 'object') {
    return undefined;
  }
  const accountsWire = field(value, 'accounts');
  const waitingWire = field(value, 'verification_requests_waiting');
  const cardsWire = field(value, 'digital_ids_active');

  const accounts = accountsWire === null ? null : accountsOf(accountsWire);
  const verificationsWaiting = waitingWire === null ? null : count(waitingWire);
  const digitalIdsActive = cardsWire === null ? null : count(cardsWire);

  if (
    accounts === undefined ||
    (waitingWire !== null && verificationsWaiting === null) ||
    (cardsWire !== null && digitalIdsActive === null)
  ) {
    return undefined;
  }

  return { accounts, verificationsWaiting, digitalIdsActive };
}

function accountsOf(value: unknown): ResidentAppAccounts | undefined {
  const registered = count(field(value, 'registered'));
  const registeredInPeriod = count(field(value, 'registered_in_period'));
  const statuses = field(value, 'by_verification');
  const tally = (status: AccountVerificationStatus): number | null =>
    count(field(statuses, status));
  const unverified = tally('unverified');
  const pending = tally('pending');
  const verified = tally('verified');
  const rejected = tally('rejected');

  if (
    registered === null ||
    registeredInPeriod === null ||
    unverified === null ||
    pending === null ||
    verified === null ||
    rejected === null
  ) {
    return undefined;
  }

  return {
    registered,
    registeredInPeriod,
    byVerification: { unverified, pending, verified, rejected },
  };
}
