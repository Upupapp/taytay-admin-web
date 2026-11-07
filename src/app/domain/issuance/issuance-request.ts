import type {
  AppAccountId,
  IsoDateTime,
  IssuanceAttachmentId,
  IssuanceEventId,
  IssuanceRequestId,
  IssuanceTypeId,
} from '../shared/ids';
import type { Money } from '../shared/money';
import { nextStatuses, type StatusCatalog, type StatusTransitions } from '../shared/status';
import type { IssuanceOfficeRef, IssuanceRequirement } from './issuance-type';

/**
 * A resident's request, from the residents' app, for a document an office issues (`DL-184`).
 *
 * Shaped like the API's office view and nothing else. The resident is an **app account**, never a
 * registry `ResidentId` (`DL-164`): somebody with a phone who verified their identity, not somebody
 * the office recorded.
 *
 * ## What a row of the list carries, and what it does not
 *
 * The list row (`IssuanceRequestSummary`) has no `purpose`: the resident's own words are read on
 * the request, never on a list somebody scrolls past (the API leaves it out too).
 */
export interface IssuanceRequestSummary {
  readonly id: IssuanceRequestId;
  /** `DR-<year>-<six digits>`, the number the resident quotes at the counter. */
  readonly referenceNumber: string;
  readonly status: IssuanceStatus;
  readonly type: { readonly id: IssuanceTypeId; readonly name: string };
  readonly office: IssuanceOfficeRef;
  readonly resident: IssuanceResident;
  readonly filedAt: IsoDateTime;
  /** When the request entered its current status: the server moves it only with an event. */
  readonly statusSince: IsoDateTime;
}

export interface IssuanceResident {
  readonly accountId: AppAccountId;
  /** `null` when the account carries no name; the screen says so rather than leaving a blank. */
  readonly name: string | null;
}

/**
 * One request, as the issuing office reads it. The type is a **snapshot**: the name, requirements,
 * fee and working days it was filed with, whatever the catalogue says now.
 */
export interface IssuanceRequest extends IssuanceRequestSummary {
  /** The resident's own words. Never logged, searched or put in a notification. */
  readonly purpose: string;
  readonly fee: Money | null;
  readonly processingDays: number | null;
  readonly claimInstructions: string | null;
  readonly requirements: readonly IssuanceRequirement[];
  /** Every file sent, every version kept: a resubmission adds beside, never replaces. */
  readonly attachments: readonly IssuanceAttachment[];
  /** When and where to claim it, once the office has said. */
  readonly claimDetails: string | null;
  /** Oldest first, appended and never changed. */
  readonly history: readonly IssuanceEvent[];
  /** The moves the server says this office may make now. Empty once the request has ended. */
  readonly allowedMoves: readonly IssuanceStatus[];
}

export const ISSUANCE_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'] as const;
export type IssuanceMimeType = (typeof ISSUANCE_MIME_TYPES)[number];

export interface IssuanceAttachment {
  readonly id: IssuanceAttachmentId;
  readonly requirementCode: string;
  readonly version: number;
  readonly mimeType: IssuanceMimeType;
  readonly byteSize: number;
  /** False for a version a later one followed. Kept: it is what the office may have read. */
  readonly current: boolean;
  readonly sentAt: IsoDateTime;
}

export type IssuanceSide = 'resident' | 'office';

export interface IssuanceEvent {
  readonly id: IssuanceEventId;
  /** `null` for the filing itself. */
  readonly from: IssuanceStatus | null;
  readonly to: IssuanceStatus;
  readonly side: IssuanceSide;
  /** The account that acted, as the API gives it. Nothing is looked up about it here. */
  readonly actorId: string;
  /** For an office move, read by the resident in the app. */
  readonly reason: string | null;
  readonly claimDetails: string | null;
  readonly at: IsoDateTime;
}

/** The versions sent for one requirement, newest first. */
export function attachmentsFor(
  request: IssuanceRequest,
  code: string,
): readonly IssuanceAttachment[] {
  return request.attachments
    .filter((attachment) => attachment.requirementCode === code)
    .slice()
    .sort((a, b) => b.version - a.version);
}

/* ── the lifecycle, defined once (rule 7) ────────────────────────────────── */

export const ISSUANCE_STATUSES = [
  'submitted',
  'under-review',
  'needs-info',
  'approved',
  'ready-for-pickup',
  'released',
  'rejected',
  'cancelled',
] as const;

export type IssuanceStatus = (typeof ISSUANCE_STATUSES)[number];

export const ISSUANCE_STATUS_CATALOG: StatusCatalog<IssuanceStatus> = {
  submitted: {
    value: 'submitted',
    label: 'Submitted',
    tone: 'info',
    description: 'The resident sent the request, and nobody at the office has started on it.',
  },
  'under-review': {
    value: 'under-review',
    label: 'Under review',
    tone: 'progress',
    description: 'The office is reviewing the request and what the resident sent.',
  },
  'needs-info': {
    value: 'needs-info',
    label: 'Needs more information',
    tone: 'warning',
    description:
      'The office asked the resident for more. It returns to review when the resident sends it, ' +
      'or ends if they cancel.',
  },
  approved: {
    value: 'approved',
    label: 'Approved',
    tone: 'success',
    description: 'The office approved it and is preparing the document.',
  },
  'ready-for-pickup': {
    value: 'ready-for-pickup',
    label: 'Ready for pickup',
    tone: 'success',
    description:
      'The document is ready, and the resident has been told when and where to claim it.',
  },
  released: {
    value: 'released',
    label: 'Released',
    tone: 'neutral',
    description: 'The office handed the document to the resident. The request has ended.',
  },
  rejected: {
    value: 'rejected',
    label: 'Rejected',
    tone: 'danger',
    description: 'The office could not issue it, and told the resident why. The request has ended.',
  },
  cancelled: {
    value: 'cancelled',
    label: 'Cancelled',
    tone: 'neutral',
    description: 'The resident withdrew it in the app. The request has ended.',
  },
};

/**
 * Every move a request can make, whoever makes it — the backend's one table
 * (`src/modules/issuance/lifecycle.ts` at `2fd0566`), row for row.
 *
 * Three of them are the **resident's**, made in the app (`ISSUANCE_RESIDENT_MOVES`): cancelling,
 * and answering a request for more, which puts it back under review. They are in the map because
 * they happen; they are never offered here.
 */
export const ISSUANCE_STATUS_TRANSITIONS: StatusTransitions<IssuanceStatus> = {
  submitted: ['under-review', 'cancelled'],
  'under-review': ['needs-info', 'approved', 'rejected'],
  'needs-info': ['under-review', 'cancelled'],
  approved: ['ready-for-pickup'],
  'ready-for-pickup': ['released'],
  released: [],
  rejected: [],
  cancelled: [],
};

/** The moves only the resident makes, in the app. */
export const ISSUANCE_RESIDENT_MOVES: readonly (readonly [IssuanceStatus, IssuanceStatus])[] = [
  ['submitted', 'cancelled'],
  ['needs-info', 'under-review'],
  ['needs-info', 'cancelled'],
];

/** The moves the office may make from `status`, in the table's order. */
export function officeMovesFrom(status: IssuanceStatus): readonly IssuanceStatus[] {
  return nextStatuses(ISSUANCE_STATUS_TRANSITIONS, status).filter(
    (to) => !ISSUANCE_RESIDENT_MOVES.some(([from, move]) => from === status && move === to),
  );
}

/** `released`, `rejected` and `cancelled`: nothing moves a request on from them. */
export const ISSUANCE_TERMINAL_STATUSES: readonly IssuanceStatus[] = ISSUANCE_STATUSES.filter(
  (status) => nextStatuses(ISSUANCE_STATUS_TRANSITIONS, status).length === 0,
);

/** Statuses a request is still being worked in — the queue. */
export const ISSUANCE_OPEN_STATUSES: readonly IssuanceStatus[] = ISSUANCE_STATUSES.filter(
  (status) => !ISSUANCE_TERMINAL_STATUSES.includes(status),
);

export function isOpenIssuanceStatus(status: IssuanceStatus): boolean {
  return ISSUANCE_OPEN_STATUSES.includes(status);
}

/* ── what a move needs, and what it does ─────────────────────────────────── */

/**
 * How long the office's words may be. The API's maximum; the minimum is the console's floor for
 * every recorded move (`DL-54`), and the API's own for a refusal and a request for more.
 */
export const ISSUANCE_REASON_LIMITS = { minimum: 8, maximum: 1000 } as const;

/** When and where to claim it: required to mark a request ready, refused on any other move. */
export const CLAIM_DETAILS_LIMITS = { minimum: 8, maximum: 500 } as const;

export interface IssuanceMove {
  readonly to: IssuanceStatus;
  /** Read by the resident in the app. */
  readonly reason: string;
  /** Only for `ready-for-pickup`; `null` on every other move. */
  readonly claimDetails: string | null;
}

/** True when the move needs claim details beside its reason. */
export function needsClaimDetails(to: IssuanceStatus): boolean {
  return to === 'ready-for-pickup';
}

/** Why the API would refuse this move's words, or `null`. The server decides the move itself. */
export function issuanceMoveProblem(move: IssuanceMove): string | null {
  const reason = move.reason.trim().length;
  if (reason < ISSUANCE_REASON_LIMITS.minimum || reason > ISSUANCE_REASON_LIMITS.maximum) {
    return (
      `Write ${ISSUANCE_REASON_LIMITS.minimum} to ${ISSUANCE_REASON_LIMITS.maximum} characters ` +
      'for the resident.'
    );
  }
  const details = move.claimDetails?.trim().length ?? 0;
  if (needsClaimDetails(move.to)) {
    if (details < CLAIM_DETAILS_LIMITS.minimum || details > CLAIM_DETAILS_LIMITS.maximum) {
      return (
        `Say when and where to claim it in ${CLAIM_DETAILS_LIMITS.minimum} to ` +
        `${CLAIM_DETAILS_LIMITS.maximum} characters.`
      );
    }
  } else if (move.claimDetails !== null) {
    return 'Claim details go only with marking a request ready for pickup.';
  }
  return null;
}

/** Said beside every reason field: every word the office writes here reaches the resident. */
export const ISSUANCE_REASON_AUDIENCE =
  'The resident reads this in the app, word for word. Write it for them.';

/**
 * What each office move does, shown **before** the button (`DL-167`'s pattern). Read from the
 * backend at `2fd0566` — `moveOfficeIssuanceRequest` and `notificationBody` in
 * `src/modules/issuance/lifecycle.ts`: every move appends to the history, is audited and notifies
 * the resident in the app, with a label naming the reference and never the office's words.
 */
export const ISSUANCE_MOVE_EFFECTS: Readonly<Partial<Record<IssuanceStatus, readonly string[]>>> = {
  'under-review': [
    'The resident sees that the office started reviewing the request, with your words.',
    'The resident is told in the app; the notice names the reference number only.',
  ],
  'needs-info': [
    'The resident reads your words in the app as what the office needs. Say exactly what to send.',
    'The request waits for the resident: it returns to review only when they send it, and they may cancel instead.',
    'The resident is told in the app; the notice names the reference number only.',
  ],
  approved: [
    'The resident sees that the request was approved and that the office is preparing the document.',
    'Nothing is generated or signed by the system: the office prepares the document itself.',
    'The resident is told in the app; the notice names the reference number only.',
  ],
  rejected: [
    'The resident reads your words in the app as the reason the office could not issue it.',
    'The request ends. Nothing in this console or the API reopens it; the resident may file a new one.',
    'The resident is told in the app; the notice names the reference number only.',
  ],
  'ready-for-pickup': [
    'The resident reads the claim details in the app: when and where to collect the document.',
    'Any fee is paid at the office. Nothing is collected online.',
    'The resident is told in the app; the notice names the reference number only.',
  ],
  released: [
    'The request ends as released. Record it only once the document is in the resident’s hands.',
    'The resident is told in the app; the notice names the reference number only.',
  ],
};

/* ── the queue ───────────────────────────────────────────────────────────── */

/** Who owes the next act on a request in this status, or `null` once it has ended. */
export function waitingOn(status: IssuanceStatus): IssuanceSide | null {
  if (!isOpenIssuanceStatus(status)) {
    return null;
  }
  return officeMovesFrom(status).length > 0 ? 'office' : 'resident';
}

const DAY_MS = 86_400_000;

/** Whole days between two instants, never negative. */
function wholeDaysBetween(since: IsoDateTime, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - Date.parse(since)) / DAY_MS));
}

/**
 * How long a request has waited in its status, and on whom — in words, never as lateness. No
 * service standard turns into a due date here (`DL-101`): the office's standard is in working
 * days, and this console holds no calendar of holidays to count them.
 */
export function describeIssuanceWait(request: IssuanceRequestSummary, now: Date): string {
  const owner = waitingOn(request.status);
  const days = wholeDaysBetween(request.statusSince, now);
  const span = days === 0 ? 'since today' : days === 1 ? 'for 1 day' : `for ${days} days`;
  if (owner === 'office') {
    return `With the office ${span}`;
  }
  if (owner === 'resident') {
    return `With the resident ${span}`;
  }
  return days === 0 ? 'Ended today' : days === 1 ? 'Ended 1 day ago' : `Ended ${days} days ago`;
}

/** Oldest waiting first: the request that entered its status longest ago leads. */
export function oldestWaitingFirst(
  requests: readonly IssuanceRequestSummary[],
): readonly IssuanceRequestSummary[] {
  return requests
    .slice()
    .sort(
      (a, b) =>
        Date.parse(a.statusSince) - Date.parse(b.statusSince) ||
        Date.parse(a.filedAt) - Date.parse(b.filedAt) ||
        a.referenceNumber.localeCompare(b.referenceNumber),
    );
}

/**
 * The queue's filter. `status: null` is every open status. `typeId: null` is every type.
 */
export interface IssuanceQueueFilter {
  readonly status: IssuanceStatus | null;
  readonly typeId: IssuanceTypeId | null;
  /** One resident's requests — the app account that filed them (`resident_id`, `DL-186`). */
  readonly residentAccountId?: AppAccountId;
}

/**
 * A browse a page at a time, newest filed first as the server orders it: one ended status, or —
 * with `status: null` — every status, which is how a request is found by its whole reference.
 */
export interface IssuanceListFilter {
  readonly status: IssuanceStatus | null;
  readonly typeId: IssuanceTypeId | null;
  /** The whole reference number, as `wholeIssuanceReference` gives it (`DL-186`). */
  readonly reference?: string;
  readonly residentAccountId?: AppAccountId;
}

/** Said instead of a search, when what was typed is not a whole reference. */
export const ISSUANCE_REFERENCE_INCOMPLETE =
  'Type the whole reference number, such as DR-2026-000123. Part of one finds nothing, so nothing ' +
  'was searched.';

/** `DR-<year>-<six or more digits>`, as the API matches it. */
const ISSUANCE_REFERENCE = /^DR-[0-9]{4}-[0-9]{6,}$/;

/**
 * A reference as typed, made whole — trimmed and upper-cased, as the server reads it — or `null`
 * when it is not a whole one. The API finds a request only by its whole number and refuses part of
 * one (`DL-186`), so part of one is said on the screen and never sent: a search that matched
 * fragments of a number would be a search of every resident's requests by guesswork.
 */
export function wholeIssuanceReference(typed: string): string | null {
  const reference = typed.trim().toUpperCase();
  return ISSUANCE_REFERENCE.test(reference) ? reference : null;
}

/**
 * Permission to read one file, once — the server's grant, with the warning it composed. Never a
 * URL: the handle travels in a request body, and the bytes become an address only this tab holds.
 */
export interface IssuanceFileGrant {
  readonly attachmentId: IssuanceAttachmentId;
  readonly fileName: string;
  readonly mimeType: IssuanceMimeType;
  readonly handle: string;
  readonly expiresAt: IsoDateTime;
  /** Shown first, word for word. */
  readonly warning: string;
}

/** The two things the office must never be left to assume, said on every screen of the module. */
export const ISSUANCE_BOUNDARIES: readonly string[] = [
  'No online payment: the fee is paid at the office.',
  'The system tracks the request; the office prepares and signs the document itself.',
];
