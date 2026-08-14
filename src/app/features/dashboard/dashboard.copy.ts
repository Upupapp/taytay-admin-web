import type { AttentionKind } from '@domain/index';

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
  disbursedHint: (people: number) =>
    people === 1 ? 'Across 1 beneficiary.' : `Across ${people} beneficiaries.`,
  viewRecords: 'View the records behind this figure',

  // Breakdowns
  byStatusCaption: 'Requests by status',
  byStatusSummary: 'Select a row to open the requests with that status.',
  byBarangayCaption: 'Requests by barangay',
  byBarangaySummary: 'Select a row to open that barangay’s requests.',
  byCategoryCaption: 'Released by programme type',
  byCategorySummary: 'Amount released per programme type under the current filter.',
  statusHeader: 'Status',
  barangayHeader: 'Barangay',
  categoryHeader: 'Programme type',
  requestsHeader: 'Requests',
  amountHeader: 'Amount',

  // Filter
  filterHeading: 'Filter',
  filterBarangay: 'Barangay',
  filterCategory: 'Programme type',
  filterPeriod: 'Released within',
  filterAll: 'All',
  clearFilter: 'Clear filter',
  filterAppliedNotice: 'Every figure below is calculated under this filter.',
  period: {
    'all-time': 'Any time',
    'last-30-days': 'Last 30 days',
    'last-90-days': 'Last 90 days',
  },

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
