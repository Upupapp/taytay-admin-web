import type { AccountVerificationStatus, AttentionKind } from '@domain/index';

/** Goods are counted, never valued (`DL-93`), so they are said as a number of releases. */
function goodsCount(goods: number): string {
  return goods === 1 ? '1 release of goods' : `${goods} releases of goods`;
}

/**
 * Dashboard copy (`DL-23`).
 *
 * The attention wording is the most important text on the screen: it is what
 * turns a number into a decision. Each line names **what to do**, not what the
 * status is called — "3 waiting for your approval" rather than "3 endorsed".
 */
export const DASHBOARD_COPY = {
  title: 'Dashboard',
  subtitle: 'Caseload and payout position for the Municipal Social Welfare and Development Office.',

  attentionHeading: 'What needs attention now',
  attentionEmptyHeading: 'Nothing is waiting on you',
  attentionEmptyBody:
    'No approvals, payouts or returned requests need action under the current filter.',
  attentionNothingForRole:
    'Nothing here needs action from your role. Other staff may still have work outstanding.',

  /** `count` is always rendered as text, so meaning never rests on colour. */
  attention: {
    'awaiting-approval': (n: number) =>
      n === 1 ? '1 request waiting for approval' : `${n} requests waiting for approval`,
    'returned-to-applicant': (n: number) =>
      n === 1 ? '1 request returned to the applicant' : `${n} requests returned to the applicant`,
    'missing-requirements': (n: number) =>
      n === 1
        ? '1 open request missing a required document'
        : `${n} open requests missing a required document`,
    'payout-due': (n: number) =>
      n === 1
        ? '1 payout scheduled and not yet released'
        : `${n} payouts scheduled and not yet released`,
    'unclaimed-payout': (n: number) =>
      n === 1 ? '1 released payout not collected' : `${n} released payouts not collected`,
    'referral-unanswered': (n: number) =>
      n === 1
        ? '1 referral sent with no acknowledgement'
        : `${n} referrals sent with no acknowledgement`,
  } satisfies Record<AttentionKind, (count: number) => string>,

  attentionAction: 'Review',
  /** Prefixes the server's own statement of the rule it counted by (`DL-98`, `DL-182`). */
  attentionBasis: 'Counted:',
  severityLabel: {
    critical: 'Needs action',
    warning: 'Follow up',
    info: 'For information',
  },

  // Headline figures
  openRequests: 'Open requests',
  openRequestsHint: 'Not yet completed, rejected, cancelled or expired.',
  awaitingApproval: 'Awaiting approval',
  awaitingApprovalHint: "Endorsed by a social worker, pending the head's decision.",
  scheduledPayouts: 'Scheduled payouts',
  scheduledPayoutsHint: 'Vouchers with a confirmed release date.',
  disbursed: 'Released',
  disbursedHint: (people: number, goods: number) =>
    (people === 1 ? 'Across 1 beneficiary.' : `Across ${people} beneficiaries.`) +
    (goods === 0 ? '' : ` Also ${goodsCount(goods)}, counted and not valued.`),
  /** Said where payout figures would be, so their absence is not read as "nothing paid out". */
  payoutsNotShown: 'Payout figures are not shown: your role does not open the releases they count.',
  viewRecords: 'View the records behind this figure',

  // Breakdowns
  byStatusCaption: 'Requests by status',
  byStatusSummary: 'Select a row to open the requests with that status.',
  byBarangayCaption: 'Requests by barangay',
  byBarangaySummary: 'Select a row to open that barangay’s requests.',
  byCategoryCaption: 'Released by programme type',
  byCategorySummary:
    'Money released per programme type under the current filter. Goods are counted beside it, never given a peso value.',
  /** A category's figure: money in pesos, and goods as a count — never a peso zero for goods. */
  categoryDisplay: (pesos: string, money: number, goods: number) =>
    goods === 0 ? pesos : money === 0 ? goodsCount(goods) : `${pesos} and ${goodsCount(goods)}`,
  statusHeader: 'Status',
  barangayHeader: 'Barangay',
  categoryHeader: 'Programme type',
  requestsHeader: 'Requests',
  amountHeader: 'Amount',

  // Filter
  filterHeading: 'Filter',
  filterBarangay: 'Barangay',
  filterCategory: 'Programme type',
  filterPeriod: 'Period',
  filterAll: 'All',
  clearFilter: 'Clear filter',
  filterAppliedNotice: 'Every figure below is calculated under this filter.',
  period: {
    'all-time': 'Any time',
    'last-30-days': 'Last 30 days',
    'last-90-days': 'Last 90 days',
  },

  // The residents' app (`DL-182`)
  residentAppHeading: 'The residents’ app',
  residentAppNotice:
    'Counts for the whole app, shown to whoever administers it. The barangay and programme filters do not narrow them.',
  accounts: 'Resident accounts',
  accountsHint: 'Open accounts of residents. Staff accounts are not counted.',
  accountsNew: (count: number, period: string) => `${count} new in the ${period.toLowerCase()}.`,
  byVerificationCaption: 'Resident accounts by verification',
  byVerificationSummary: 'Every account counted once, by where its ID verification stands.',
  verificationHeader: 'Verification',
  accountsHeader: 'Accounts',
  verificationStatus: {
    unverified: 'Not verified',
    pending: 'Waiting for an ID review',
    verified: 'Verified',
    rejected: 'Not accepted',
  } satisfies Record<AccountVerificationStatus, string>,
  verificationsWaiting: 'ID reviews waiting',
  verificationsWaitingHint: 'Submitted by residents and not yet reviewed.',
  digitalIdsActive: 'Digital IDs in force',
  digitalIdsActiveHint: 'Active, and not past their expiry.',

  // Quick actions
  quickActionsHeading: 'Quick actions',
  recordRequest: 'Record a request',
  schedulePayouts: 'Schedule payouts',
  exportReport: 'Export report',
  exportUnavailable: 'Report export arrives with the reporting TAB.',

  refresh: 'Refresh',
  generatedAt: 'Figures generated',
  errorHeading: 'Could not load the dashboard',
} as const;
