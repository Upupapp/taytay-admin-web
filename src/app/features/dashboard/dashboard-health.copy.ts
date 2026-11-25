import {
  WITHHOLDS_SMALL_COUNTS,
  type AssistanceRequestStatus,
  type DashboardPeriod,
  type WaitsOn,
} from '@domain/index';

const PERIOD_WORDS: Readonly<Record<DashboardPeriod, string>> = {
  'all-time': 'at any time',
  'last-30-days': 'in the last 30 days',
  'last-90-days': 'in the last 90 days',
};

/**
 * The words of the dashboard's "waiting longest", "outcomes", "recent activity" and definitions
 * panels (`DL-248`). The API sends kinds and counts; the sentences are here (`DL-23`).
 */
export const DASHBOARD_HEALTH_COPY = {
  // Waiting longest
  waitingHeading: 'Waiting longest',
  waitingLead:
    'Open requests that have stood longest at their current stage. No service standard has been set, so a wait is counted in days, never as late.',
  waitingTabs: 'Whose move it is',
  waitsOn: { office: 'On the office', resident: 'On the resident' } satisfies Record<
    WaitsOn,
    string
  >,
  waitingEmpty: {
    office: 'No open request is waiting on the office.',
    resident: 'No open request is waiting on a resident.',
  } satisfies Record<WaitsOn, string>,
  waitingDays: (days: number) =>
    days === 0 ? 'Since today' : days === 1 ? 'Waiting 1 day' : `Waiting ${days} days`,
  waitingSince: (date: string) => `At this stage since ${date}`,
  /** Why a request at this stage is waiting, and on whom. A terminal status is never listed. */
  reason: {
    draft: 'Not yet filed.',
    submitted: 'Filed; intake has not begun its review.',
    'intake-review': 'In intake review.',
    assessment: 'With a social worker for assessment.',
    endorsed: 'Endorsed; the head’s decision is awaited.',
    approved: 'Approved; no payout has been scheduled yet.',
    scheduled: 'Scheduled for a payout the applicant is to attend.',
    released: 'Released; not yet closed as completed.',
    returned: 'Returned; the applicant was asked for more.',
    rejected: 'Rejected.',
    completed: 'Completed.',
    cancelled: 'Cancelled.',
    expired: 'Expired.',
  } satisfies Record<AssistanceRequestStatus, string>,
  documentsOwed: 'A required document is not yet verified.',
  waitingShown: (shown: number, total: number) =>
    total === 0 ? '' : `${shown} of ${total} shown, longest first.`,
  waitingAll: (open: number) =>
    open === 1 ? 'View the 1 open request' : `View all ${open} open requests`,

  // Outcomes
  outcomesHeading: 'Outcomes',
  outcomesLead: (period: DashboardPeriod) => `Decisions and hand-overs ${PERIOD_WORDS[period]}.`,
  approvals: 'Approvals',
  approvalsValue: (approved: number, decided: number) =>
    decided === 0 ? 'None decided' : `${approved} of ${decided}`,
  approvalsHint: (approved: number, rejected: number) =>
    approved + rejected === 0
      ? 'No request was approved or rejected in this period.'
      : `${approved} approved, ${rejected} rejected. Each request counted once.`,
  returned: 'Returned for more',
  returnedHint: 'Requests sent back to the applicant for more. Each request counted once.',
  handOver: 'Filing to hand-over',
  handOverValue: (days: number | null) =>
    days === null ? 'None handed over' : `${days} ${days === 1 ? 'day' : 'days'}`,
  handOverHint:
    'Average calendar days over the releases handed over in this period, as the summary report counts it. Imported past assistance is not counted.',

  // Recent activity
  activityHeading: 'Recent activity',
  activityLead: 'The latest acts in the office’s audit trail.',
  activityLink: 'Open the audit trail',
  activityEmpty: 'Nothing has been recorded yet.',
  activityError: 'Could not load recent activity',
  activityRetry: 'Try again',

  // Definitions
  definitionsHeading: 'How these figures are counted',
  /** `payouts`: said only beside the payout figures, for a reader they are shown to. */
  definitions: [
    {
      payouts: false,
      term: 'Open requests',
      text: 'Filed requests not completed, rejected, cancelled or expired. A draft is not counted.',
    },
    { payouts: false, term: 'Awaiting approval', text: 'Filed requests whose status is endorsed.' },
    {
      payouts: true,
      term: 'Scheduled payouts',
      text: 'Releases scheduled into a payout session and not yet handed over.',
    },
    {
      payouts: true,
      term: 'Released',
      text: 'Money handed over in the period, in pesos. Goods are counted beside it, never valued.',
    },
    {
      payouts: false,
      term: 'Received and handed over',
      text: 'Filed requests by the week they were filed, and releases by the week they were handed over: Manila weeks from Monday, the current one to date. The period filter does not apply.',
    },
    {
      payouts: false,
      term: 'Waiting longest',
      text: 'Days since a request’s latest status change, or its filing. A returned request or a scheduled payout waits on the resident; every other open request waits on the office. The period filter does not apply.',
    },
    {
      payouts: false,
      term: 'Outcomes',
      text: 'Requests that reached approved, rejected or returned in the period, each once; and, beside the payout figures, the average days from filing to hand-over.',
    },
    {
      payouts: false,
      term: 'Withheld figures',
      // Follows the small-cell switch (`DL-252`).
      text: WITHHOLDS_SMALL_COUNTS
        ? 'Requests and releases are records, not people, so none of these is withheld. Counts of people elsewhere in the console are withheld below the small-cell threshold.'
        : 'None. Every figure here and elsewhere in the console is its real number; only the two protected sectors are left uncounted for staff not cleared for them.',
    },
  ],
} as const;
