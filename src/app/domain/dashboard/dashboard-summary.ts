import type { AssistanceRequestStatus } from '../assistance/assistance-request';
import type { Permission } from '../access/permission';
import type { BarangayId } from '../shared/ids';
import type { Money } from '../shared/money';
import type { ProgramCategory } from '../programs/program';

/* ── Drill-down filter ────────────────────────────────────────────────────── */

/**
 * How long a window the money figures cover.
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
  readonly amount: Money;
  readonly count: number;
}

/* ── Summary ──────────────────────────────────────────────────────────────── */

export interface DashboardSummary {
  readonly generatedAt: string;
  /** Echoed back so the view can prove which filter produced these figures. */
  readonly appliedFilter: DashboardFilter;

  /** Ordered by urgency. Empty means genuinely nothing needs attention. */
  readonly attention: readonly AttentionSignal[];

  readonly openRequests: number;
  readonly awaitingApproval: number;
  readonly scheduledPayouts: number;
  readonly residentsServedInPeriod: number;
  /**
   * Renamed from `disbursedThisMonth` in TAB 06. The old name was inaccurate:
   * it summed every released release regardless of date, so the label
   * claimed a window the number never respected. It now means exactly what the
   * `period` filter says.
   */
  readonly disbursedInPeriod: Money;

  readonly requestsByStatus: readonly StatusCount[];
  readonly requestsByBarangay: readonly BarangayCount[];
  readonly disbursedByCategory: readonly CategoryTotal[];
}
