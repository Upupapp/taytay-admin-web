import type { AssistanceRequestStatus } from '../assistance/assistance-request';
import type { Permission } from '../access/permission';
import type { AssistanceRequestId, BarangayId, IsoDate, IsoDateTime } from '../shared/ids';
import type { Money } from '../shared/money';
import type { ProgramCategory } from '../programs/program';

/* ── Drill-down filter ────────────────────────────────────────────────────── */

/**
 * How long a window the released figures, and the app accounts counted as new, cover.
 *
 * `all-time` is the default because a municipal office's first question is
 * usually "what is outstanding", not "what happened in the last 30 days".
 */
export type DashboardPeriod = 'all-time' | 'last-30-days' | 'last-90-days';

export const DASHBOARD_PERIODS: readonly DashboardPeriod[] = [
  'all-time',
  'last-30-days',
  'last-90-days',
];

/** How many days back each period reaches; `null` reaches every record. */
export const DASHBOARD_PERIOD_DAYS: Readonly<Record<DashboardPeriod, number | null>> = {
  'all-time': null,
  'last-30-days': 30,
  'last-90-days': 90,
};

/**
 * The dashboard's drill-down state.
 *
 * Every figure on the screen is computed under this filter, which is what makes
 * "the number traces back to the records" true rather than aspirational: the
 * same filter that produced the number is handed to the list the number links
 * to.
 */
export interface DashboardFilter {
  readonly barangayId?: BarangayId;
  readonly category?: ProgramCategory;
  readonly period?: DashboardPeriod;
}

export const EMPTY_DASHBOARD_FILTER: DashboardFilter = {};

/** True when the filter narrows anything, used to offer a "clear" affordance. */
export function isFilterActive(filter: DashboardFilter): boolean {
  return (
    filter.barangayId !== undefined ||
    filter.category !== undefined ||
    (filter.period !== undefined && filter.period !== 'all-time')
  );
}

/* ── "What needs attention now?" ──────────────────────────────────────────── */

/**
 * The kinds of thing that can require action.
 *
 * A *kind*, not a sentence: the domain says what the situation is, and the
 * feature's copy module says how to word it (`DL-23`). That also keeps this
 * file free of English, so localisation later changes one module.
 */
export type AttentionKind =
  | 'awaiting-approval'
  | 'returned-to-applicant'
  | 'missing-requirements'
  | 'payout-due'
  | 'unclaimed-payout'
  | 'referral-unanswered';

/**
 * How loudly to say it. Drives ordering and tone, never colour alone — the
 * signal always carries a count and a label as text.
 */
export type AttentionSeverity = 'critical' | 'warning' | 'info';

const SEVERITY_ORDER: Readonly<Record<AttentionSeverity, number>> = {
  critical: 0,
  warning: 1,
  info: 2,
};

export interface AttentionSignal {
  readonly kind: AttentionKind;
  readonly severity: AttentionSeverity;
  readonly count: number;
  /**
   * The permission needed to *act* on this. The dashboard shows a signal only
   * to someone who can do something about it — an intake officer does not need
   * to be told about payouts they cannot release.
   */
  readonly permission: Permission;
  /**
   * The rule the count applied, in words, as whoever counted it states it — "filed requests
   * whose status is endorsed". A signal nobody can check is one an office learns to dismiss
   * (`DL-98`), and the counter is the only party that knows the rule it actually ran, so the
   * sentence comes with the count rather than being guessed here (`DL-182`).
   */
  readonly basis: string;
}

/**
 * Most urgent first, then largest.
 *
 * Deterministic ordering matters more than it sounds: the whole claim of this
 * screen is that the top of the list is what to do next, so the order cannot
 * depend on object-key iteration.
 */
export function sortAttention(signals: readonly AttentionSignal[]): readonly AttentionSignal[] {
  return [...signals].sort((a, b) => {
    const bySeverity = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    return bySeverity !== 0 ? bySeverity : b.count - a.count;
  });
}

/* ── Breakdowns ───────────────────────────────────────────────────────────── */

export interface StatusCount {
  readonly status: AssistanceRequestStatus;
  readonly count: number;
}

export interface BarangayCount {
  readonly barangayId: BarangayId;
  readonly count: number;
}

export interface CategoryTotal {
  readonly category: ProgramCategory;
  /** Money releases only. Goods are never valued, so they add nothing here (`DL-93`). */
  readonly amount: Money;
  /** The money releases summed into `amount`. */
  readonly count: number;
  /** In-kind releases, counted beside the amount rather than valued at zero (`DL-93`). */
  readonly goodsCount: number;
}

/* ── Payouts ──────────────────────────────────────────────────────────────── */

/**
 * What was scheduled and handed over, under the filter.
 *
 * Held apart from the request figures because not every reader of the dashboard may read the
 * releases behind them: the release list is `release.view`'s and is refused to a caseload. A
 * reader it refuses gets `null` — no payout figures at all — rather than zeroes the list would
 * contradict, or a link to a list that would bounce them (`CLAUDE.md` rule 8, `DL-182`).
 */
export interface DashboardPayouts {
  readonly scheduledPayouts: number;
  /** Everybody handed money **or** goods in the period — not the people the money went to. */
  readonly residentsServedInPeriod: number;
  /**
   * Renamed from `disbursedThisMonth` in TAB 06. The old name was inaccurate:
   * it summed every released release regardless of date, so the label
   * claimed a window the number never respected. It now means exactly what the
   * `period` filter says. Money releases only (`DL-93`).
   */
  readonly disbursedInPeriod: Money;
  /** In-kind releases handed over in the period: counted, never valued (`DL-93`). */
  readonly goodsReleasedInPeriod: number;
  readonly disbursedByCategory: readonly CategoryTotal[];
  /**
   * Releases handed over (released, claimed or completed) per Asia/Manila day: today and the six
   * days before, oldest first, every day present. Money and goods alike, counted and never valued
   * (`DL-93`). The `period` filter does not narrow it; the barangay and programme filters do.
   */
  readonly handedOverByDay: readonly DayCount[];
  /**
   * The same handovers by Asia/Manila week, over the eight weeks of `requestsReceivedByWeek`, so the
   * two lines share an axis. The `period` filter does not narrow it.
   */
  readonly handedOverByWeek: readonly WeekCount[];
  /**
   * Calendar days from filing to handing over, averaged over the releases handed over in the
   * period, one decimal — the summary report's rule, so the two never disagree. Imported past
   * assistance is left out. `null` when nothing was handed over: absent, never a zero.
   */
  readonly averageDaysToHandOver: number | null;
}

/* ── What waits, and on whom ──────────────────────────────────────────────── */

/**
 * Who an open request's next step belongs to: the resident when the office returned it or
 * scheduled her payout, the office for every other open status. The API decides the split; the
 * console words it.
 */
export type WaitsOn = 'office' | 'resident';

export const WAITS_ON: readonly WaitsOn[] = ['office', 'resident'];

/**
 * One open request, by how long it has stood at its current stage. A record, not a person: no
 * name and no programme — the reference opens it for whoever may read it.
 */
export interface WaitingRequest {
  readonly id: AssistanceRequestId;
  readonly referenceNumber: string;
  readonly status: AssistanceRequestStatus;
  readonly barangayId: BarangayId;
  /** Its latest status change, or its filing when it has none. */
  readonly since: IsoDateTime;
  /**
   * Whole Asia/Manila days since then. A wait, never lateness: no service standard has been set,
   * so nothing here is "overdue" (`DL-101`).
   */
  readonly days: number;
  readonly documentsOwed: boolean;
}

export interface WaitingSide {
  /** Every open request on this side, not only the ones listed. */
  readonly count: number;
  /** The five that have waited longest, longest first. */
  readonly longest: readonly WaitingRequest[];
}

/**
 * Requests that reached each decision in the period, one request once per decision. Counts, said
 * as "38 of 50"; never a rate, a score or anybody's figure (`DL-107`).
 */
export interface DecisionCounts {
  readonly approved: number;
  readonly rejected: number;
  readonly returned: number;
}

/** One Asia/Manila calendar day and how many records fell on it. Records, not people. */
export interface DayCount {
  readonly date: IsoDate;
  readonly count: number;
}

/** One Asia/Manila week, named by the Monday it starts on, and how many records fell in it. */
export interface WeekCount {
  readonly weekStart: IsoDate;
  readonly count: number;
}

/* ── The residents' app ───────────────────────────────────────────────────── */

/** An app account's verification standing, as the API keeps it on the account. */
export type AccountVerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export const ACCOUNT_VERIFICATION_STATUSES: readonly AccountVerificationStatus[] = [
  'unverified',
  'pending',
  'verified',
  'rejected',
];

/** Open resident accounts: a resident's, not closed. Staff accounts are not citizens. */
export interface ResidentAppAccounts {
  readonly registered: number;
  /** Of those, created within the dashboard's period. */
  readonly registeredInPeriod: number;
  readonly byVerification: Readonly<Record<AccountVerificationStatus, number>>;
}

/**
 * The residents' app, in counts, for whoever administers it (`DL-182`).
 *
 * **Operational need.** The owner's deliverable is a citizen roster and an administrative
 * dashboard. The administrator who reviews IDs and keeps the app's accounts has nowhere else that
 * says how many residents use the app, how many are waiting on an ID review and how many cards are
 * in force — the figures that say whether the review queue is keeping up. Counts only: no name, no
 * barangay, nothing about any one resident (`CLAUDE.md` §6.1).
 *
 * Each figure is `null` when the reader does not hold the key of the list it counts —
 * `user.view`, `verification.review`, `digital-id.manage` — and the whole block is `null` on the
 * summary, **absent rather than zero**, for a reader who holds none of them. These figures are the
 * whole app's: the barangay and programme filters do not narrow them.
 */
export interface ResidentAppFigures {
  readonly accounts: ResidentAppAccounts | null;
  readonly verificationsWaiting: number | null;
  readonly digitalIdsActive: number | null;
}

/* ── Summary ──────────────────────────────────────────────────────────────── */

export interface DashboardSummary {
  readonly generatedAt: string;
  /** Echoed back so the view can prove which filter produced these figures. */
  readonly appliedFilter: DashboardFilter;

  /** Ordered by urgency. Empty means genuinely nothing needs attention. */
  readonly attention: readonly AttentionSignal[];

  /** Filed requests: a draft is somebody's unfinished form, and is not counted. */
  readonly openRequests: number;
  readonly awaitingApproval: number;
  readonly requestsByStatus: readonly StatusCount[];
  /**
   * Requests, not people. `DL-105`'s small-cell rule is for counts of people or households, and
   * every row opens records the reader may already read, so nothing here is withheld.
   */
  readonly requestsByBarangay: readonly BarangayCount[];
  /**
   * Filed requests per Asia/Manila week, Monday first: the current week to date and the seven
   * before it whole, oldest first, every week present (a zero is a zero). Requests are records, so
   * nothing is withheld. The `period` filter does not narrow it; the barangay and programme do.
   */
  readonly requestsReceivedByWeek: readonly WeekCount[];
  /** Open requests by who they wait on. The `period` filter does not narrow it. */
  readonly waiting: Readonly<Record<WaitsOn, WaitingSide>>;
  /** Decisions in the period. */
  readonly decidedInPeriod: DecisionCounts;

  /** `null` for a reader the release list refuses. */
  readonly payouts: DashboardPayouts | null;
  /** `null` — absent, not zero — for a reader who holds none of the app's keys. */
  readonly residentApp: ResidentAppFigures | null;
}
