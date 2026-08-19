import type { AssistanceRequestStatus } from '../assistance/assistance-request';
import type { ReleaseStatus } from '../releases/release';
import type { ReferralStatus } from '../referrals/referral';
import type {
  ResidentCaseSummary,
  ResidentPayoutSummary,
  ResidentReferralSummary,
} from '../residents/resident-profile';
import type { IsoDateTime, ProgramId } from '../shared/ids';
import type { Money } from '../shared/money';
import type { ProgramEnrollment } from './program-enrollment';
import { ENROLLMENT_EXIT_REASON_LABELS } from './program-enrollment';

/**
 * One person's assistance history as a single ordered sequence.
 *
 * The office's history of a family is spread across four record types that grew
 * up separately — requests, payouts, referrals and enrollments. Read as four
 * lists side by side, the one question a caseworker actually asks ("what has
 * this office done for these people, and when?") cannot be answered without
 * mentally interleaving them, which is exactly the work software should do.
 *
 * Two rules hold this together and are enforced by the tests:
 *
 *  - **Every entry names the record it came from.** `sourceId` and `sourceKind`
 *    are required, so any row on screen can be opened and checked. A timeline
 *    that summarises without citing is a story, not a history.
 *  - **Nothing is invented.** Each entry corresponds to a record that exists.
 *    There are no derived milestones, no "expected next step", no gaps filled
 *    in. The timeline reports; it does not narrate.
 */

export type TimelineSourceKind = 'request' | 'release' | 'referral' | 'enrollment';

/**
 * What kind of thing happened, for grouping and filtering. Deliberately coarse:
 * the precise status is carried in `status` and rendered by the same catalog the
 * source record uses, so this never becomes a second status vocabulary.
 */
export type TimelineEventKind =
  | 'request-filed'
  | 'request-settled'
  | 'assistance-released'
  | 'referral-made'
  | 'referral-answered'
  | 'enrollment-started'
  | 'enrollment-ended';

export const TIMELINE_EVENT_KIND_LABELS: Readonly<Record<TimelineEventKind, string>> = {
  'request-filed': 'Request filed',
  'request-settled': 'Request settled',
  'assistance-released': 'Assistance released',
  'referral-made': 'Referred out',
  'referral-answered': 'Referral answered',
  'enrollment-started': 'Enrolled',
  'enrollment-ended': 'Left the programme',
};

export interface AssistanceTimelineEntry {
  /** Stable within one timeline; `${sourceKind}:${sourceId}:${kind}`. */
  readonly key: string;
  readonly occurredAt: IsoDateTime;
  readonly kind: TimelineEventKind;
  readonly sourceKind: TimelineSourceKind;
  readonly sourceId: string;
  /** The control, payout or referral number a person can quote at a counter. */
  readonly reference: string;
  readonly programId: ProgramId | null;
  readonly programName: string | null;
  /** One line of plain language. Never a judgement about the person. */
  readonly summary: string;
  readonly amount: Money | null;
  readonly status: TimelineEntryStatus;
}

/**
 * The source record's own status, tagged with which catalog reads it.
 *
 * A discriminated union rather than a stringly-typed label, so the view renders
 * each with the catalog that already defines its wording and tone. Four status
 * vocabularies stay four; the timeline does not flatten them into a fifth.
 */
export type TimelineEntryStatus =
  | { readonly catalog: 'request'; readonly value: AssistanceRequestStatus }
  | { readonly catalog: 'release'; readonly value: ReleaseStatus }
  | { readonly catalog: 'referral'; readonly value: ReferralStatus }
  | { readonly catalog: 'enrollment'; readonly value: 'active' | 'suspended' | 'exited' };

export interface TimelineInput {
  readonly requests: readonly ResidentCaseSummary[];
  readonly payouts: readonly ResidentPayoutSummary[];
  readonly referrals: readonly ResidentReferralSummary[];
  readonly enrollments: readonly ProgramEnrollment[];
}

const SETTLED_REQUEST_STATUSES: readonly AssistanceRequestStatus[] = [
  'rejected',
  'completed',
  'cancelled',
  'expired',
];

/**
 * Builds the timeline, newest first.
 *
 * Records with no usable date are **dropped rather than dated to now**. A draft
 * that was never filed has no `submittedAt`, and placing it at the top of a
 * history under today's date would assert something that did not happen. It is
 * still listed on the drafts section of the requests screen (`DL-63`); it is
 * simply not history yet.
 */
export function buildAssistanceTimeline(input: TimelineInput): readonly AssistanceTimelineEntry[] {
  const entries: AssistanceTimelineEntry[] = [];

  for (const request of input.requests) {
    if (request.submittedAt !== null) {
      entries.push({
        key: `request:${request.id}:request-filed`,
        occurredAt: request.submittedAt,
        kind: 'request-filed',
        sourceKind: 'request',
        sourceId: request.id,
        reference: request.referenceNumber,
        programId: request.programId,
        programName: request.programName,
        summary: `Applied to ${request.programName}.`,
        amount: request.requestedAmount,
        status: { catalog: 'request', value: request.status },
      });
    }

    // A settled request gets a second entry only when the settlement is a
    // distinct fact from the filing. `updatedAt` is when it settled.
    if (SETTLED_REQUEST_STATUSES.includes(request.status)) {
      entries.push({
        key: `request:${request.id}:request-settled`,
        occurredAt: request.updatedAt,
        kind: 'request-settled',
        sourceKind: 'request',
        sourceId: request.id,
        reference: request.referenceNumber,
        programId: request.programId,
        programName: request.programName,
        summary: `${request.programName} request closed.`,
        amount: request.approvedAmount,
        status: { catalog: 'request', value: request.status },
      });
    }
  }

  for (const payout of input.payouts) {
    // Only a payout that actually happened is history. A scheduled one is a
    // plan, and it belongs on the release queue, not in a record of what
    // this family has received.
    if (payout.releasedAt === null) {
      continue;
    }
    entries.push({
      key: `release:${payout.id}:assistance-released`,
      occurredAt: payout.releasedAt,
      kind: 'assistance-released',
      sourceKind: 'release',
      sourceId: payout.id,
      reference: payout.referenceNumber,
      programId: null,
      programName: null,
      summary: 'Assistance released.',
      amount: payout.amount,
      status: { catalog: 'release', value: payout.status },
    });
  }

  for (const referral of input.referrals) {
    entries.push({
      key: `referral:${referral.id}:referral-made`,
      occurredAt: referral.referredAt,
      kind: 'referral-made',
      sourceKind: 'referral',
      sourceId: referral.id,
      reference: referral.referenceNumber,
      programId: null,
      programName: null,
      summary: `Referred to ${referral.destinationName}.`,
      amount: null,
      status: { catalog: 'referral', value: referral.status },
    });

    if (referral.respondedAt !== null) {
      entries.push({
        key: `referral:${referral.id}:referral-answered`,
        occurredAt: referral.respondedAt,
        kind: 'referral-answered',
        sourceKind: 'referral',
        sourceId: referral.id,
        reference: referral.referenceNumber,
        programId: null,
        programName: null,
        summary: `${referral.destinationName} answered the referral.`,
        amount: null,
        status: { catalog: 'referral', value: referral.status },
      });
    }
  }

  for (const enrollment of input.enrollments) {
    entries.push({
      key: `enrollment:${enrollment.id}:enrollment-started`,
      occurredAt: enrollment.audit.createdAt,
      kind: 'enrollment-started',
      sourceKind: 'enrollment',
      sourceId: enrollment.id,
      reference: enrollment.programName,
      programId: enrollment.programId,
      programName: enrollment.programName,
      summary: `Enrolled in ${enrollment.programName}.`,
      amount: null,
      status: { catalog: 'enrollment', value: enrollment.status },
    });

    if (enrollment.exit !== null) {
      entries.push({
        key: `enrollment:${enrollment.id}:enrollment-ended`,
        occurredAt: enrollment.audit.updatedAt,
        kind: 'enrollment-ended',
        sourceKind: 'enrollment',
        sourceId: enrollment.id,
        reference: enrollment.programName,
        programId: enrollment.programId,
        programName: enrollment.programName,
        summary: `Left ${enrollment.programName} — ${ENROLLMENT_EXIT_REASON_LABELS[
          enrollment.exit.reason
        ].toLowerCase()}.`,
        amount: null,
        status: { catalog: 'enrollment', value: enrollment.status },
      });
    }
  }

  return entries.sort(byOccurrence);
}

/**
 * Newest first, with `key` as the tie-break.
 *
 * The tie-break is not cosmetic. Seeded and imported records routinely share a
 * timestamp to the millisecond, and without a total order the same history
 * renders in a different sequence on each read — which makes a screenshot
 * useless as evidence and a test flaky for reasons nobody can reproduce.
 */
function byOccurrence(a: AssistanceTimelineEntry, b: AssistanceTimelineEntry): number {
  if (a.occurredAt !== b.occurredAt) {
    return a.occurredAt < b.occurredAt ? 1 : -1;
  }
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

/** Calendar-year buckets, newest first, for the year headings on the timeline. */
export interface TimelineYear {
  readonly year: string;
  readonly entries: readonly AssistanceTimelineEntry[];
}

export function groupTimelineByYear(
  entries: readonly AssistanceTimelineEntry[],
): readonly TimelineYear[] {
  const years: TimelineYear[] = [];

  for (const entry of entries) {
    const year = entry.occurredAt.slice(0, 4);
    const current = years.at(-1);
    if (current !== undefined && current.year === year) {
      years[years.length - 1] = { year, entries: [...current.entries, entry] };
      continue;
    }
    years.push({ year, entries: [entry] });
  }

  return years;
}
