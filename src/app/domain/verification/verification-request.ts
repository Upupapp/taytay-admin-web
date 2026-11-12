import type {
  AppAccountId,
  IsoDate,
  IsoDateTime,
  MediaId,
  VerificationRequestId,
} from '../shared/ids';
import { nextStatuses, type StatusCatalog, type StatusTransitions } from '../shared/status';

/**
 * A resident's request, from the residents' app, to have their account verified against a
 * government ID and a selfie (`DL-167`).
 *
 * Shaped like the API's resource and nothing else. It is **not** a case, an assistance request or a
 * registry record: the account is somebody with a phone, the office's registry is somebody the
 * office served, and treating one as the other is the mistake `DL-164` was written to stop.
 *
 * ## What it deliberately does not carry
 *
 * - **No verdict of the software's own.** No match score, no confidence, no "looks valid", no
 *   suggested decision. Whether the selfie is the person on the ID is a person's judgement, recorded
 *   with a reason against their name; a number beside the button would become the decision the day
 *   somebody is busy (`DL-42`, `DL-60`, `DL-78`). `check:verification` fails the build on one.
 * - **No ID number and no image address.** The API sends neither a number nor a URL, and the model
 *   keeps it that way: images are read as bytes through `VerificationRepository.openImage`, after a
 *   warning, and a URL on the model is how a government ID ends up in a log or a pasted link.
 * - **No reviewer identity.** The API sends the reviewer's account id, which this console cannot
 *   resolve to a name (the staff directory is not served, `DL-165`). A bare identifier on screen
 *   would look like accountability and provide none; the server's audit trail records who decided.
 */
export interface VerificationRequest {
  readonly id: VerificationRequestId;
  /** The residents' app account that asked. Never a `ResidentId` (`DL-164`). */
  readonly accountId: AppAccountId;
  readonly idType: IdDocumentType;
  readonly images: VerificationImages;
  /**
   * When the selfie was erased (`DL-218`): the resident withdrew the biometric consent, or the office
   * verified the account in person and the request was superseded. The image then reads 404, so it
   * is never asked for, and the server refuses to approve the request. `null` when it was not — and
   * when an API older than `44cae1b` sends no such field, because that API erased nothing.
   */
  readonly selfieErasedAt: IsoDateTime | null;
  readonly status: VerificationStatus;
  readonly submittedAt: IsoDateTime;
  readonly reviewedAt: IsoDateTime | null;
  /** What the resident wrote when they sent a correction after a rejection. */
  readonly residentMessage: string | null;
  /**
   * The reviewer's words. On a **rejection** the resident reads them in the app as what was wrong;
   * on an approval only staff see them. One field on the wire, two audiences — which is why the
   * decision form names the reader before anybody types.
   */
  readonly reviewNote: string | null;
  /**
   * What the account says about its holder, for the reviewer to check against the ID (`DL-197`).
   * The API sends it only while the request awaits a decision; `null` on a decided request.
   */
  readonly account: AccountIdentity | null;
}

/**
 * The name and birth date an app account gives (`DL-197`): the resident's own words, which an
 * approval says somebody checked against the ID.
 */
export interface AccountIdentity {
  /** `null` when the account gives none: then there is nothing to check, and no approval. */
  readonly name: string | null;
  /** `null` when the account holds none. The residents' app does not ask for one. */
  readonly birthDate: IsoDate | null;
}

/**
 * What a reviewer confirms they checked against the ID, sent back with an approval exactly as the
 * request showed it. The API compares it with the account under a lock and refuses a difference, so
 * the name an approval keeps is one somebody looked at (`DL-197`).
 */
export interface ConfirmedIdentity {
  readonly name: string;
  readonly birthDate: IsoDate | null;
}

/** What approving this request would confirm, or `null` when the account gives no name to check. */
export function identityToConfirm(request: VerificationRequest): ConfirmedIdentity | null {
  const account = request.account;
  return account === null || account.name === null
    ? null
    : { name: account.name, birthDate: account.birthDate };
}

export interface VerificationImages {
  readonly idFront: MediaId;
  /** Absent for an ID with nothing on the back, or when the resident did not send it. */
  readonly idBack: MediaId | null;
  readonly selfie: MediaId;
}

export type VerificationImageKind = 'id-front' | 'id-back' | 'selfie';

/** Labels for the images, used as their text alternative: what the image is, not what it shows. */
export const VERIFICATION_IMAGE_LABELS: Readonly<Record<VerificationImageKind, string>> = {
  'id-front': 'Front of the ID',
  'id-back': 'Back of the ID',
  selfie: 'Selfie',
};

/** True when the request's selfie is gone (`DL-218`): withdrawn consent, or superseded. */
export function selfieErased(request: VerificationRequest): boolean {
  return request.selfieErasedAt !== null;
}

/**
 * The images a request can still be read for, in the order a reviewer compares them. An erased
 * selfie is not among them: its bytes are gone, and asking for them would only fetch a 404.
 */
export function imagesOf(request: VerificationRequest): readonly VerificationImageKind[] {
  const ids: readonly VerificationImageKind[] =
    request.images.idBack === null ? ['id-front'] : ['id-front', 'id-back'];
  return selfieErased(request) ? ids : [...ids, 'selfie'];
}

export function mediaFor(
  request: VerificationRequest,
  kind: VerificationImageKind,
): MediaId | null {
  switch (kind) {
    case 'id-front':
      return request.images.idFront;
    case 'id-back':
      return request.images.idBack;
    case 'selfie':
      return request.images.selfie;
  }
}

/* ── the kinds of ID the app accepts ─────────────────────────────────────── */

export const ID_DOCUMENT_TYPES = [
  'philid',
  'drivers-license',
  'passport',
  'umid',
  'postal',
  'voters',
  'sss',
  'other',
] as const;

export type IdDocumentType = (typeof ID_DOCUMENT_TYPES)[number];

export const ID_DOCUMENT_TYPE_LABELS: Readonly<Record<IdDocumentType, string>> = {
  philid: 'PhilSys national ID (PhilID)',
  'drivers-license': 'Driver’s licence',
  passport: 'Passport',
  umid: 'UMID',
  postal: 'Postal ID',
  voters: 'Voter’s ID',
  sss: 'SSS ID',
  other: 'Another government ID',
};

/* ── the lifecycle, defined once (rule 7) ────────────────────────────────── */

export const VERIFICATION_STATUSES = ['pending', 'approved', 'rejected', 'superseded'] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

/** The two outcomes an office reviewer records on a request. */
export type VerificationDecision = Extract<VerificationStatus, 'approved' | 'rejected'>;

export const VERIFICATION_STATUS_CATALOG: StatusCatalog<VerificationStatus> = {
  pending: {
    value: 'pending',
    label: 'Awaiting review',
    tone: 'warning',
    description: 'The resident sent an ID and a selfie, and nobody in the office has decided yet.',
  },
  approved: {
    value: 'approved',
    label: 'Approved',
    tone: 'success',
    description: 'An administrator approved it, and the account was marked verified.',
  },
  rejected: {
    value: 'rejected',
    label: 'Rejected',
    tone: 'danger',
    description:
      'An administrator rejected it with a reason the resident reads in the app. The resident ' +
      'may correct it and send it again.',
  },
  superseded: {
    value: 'superseded',
    label: 'Replaced by an in-person check',
    tone: 'neutral',
    description:
      'Closed without a decision: the office verified the account in person, against a ' +
      'government ID shown at the counter. Its selfie was erased.',
  },
};

/**
 * Every move the record can make, whoever makes it.
 *
 * `rejected → pending` is the **resident's** move: correcting a rejected request in the app puts
 * it back in the queue. It is in the map because it happens; it is never offered here, because the
 * office cannot make it (`VERIFICATION_REVIEW_MOVES`). `approved` is terminal: the API has no route
 * that un-verifies an account through this resource.
 *
 * `pending → superseded` is made by verifying the account **in person** (`DL-218`), an act on the
 * account rather than a decision on this request: nobody checked the selfie, and nothing was wrong
 * with it. So it is not a review move either. `superseded` is final, like `approved`; a rejected
 * request is never superseded — it stays rejected.
 */
export const VERIFICATION_STATUS_TRANSITIONS: StatusTransitions<VerificationStatus> = {
  pending: ['approved', 'rejected', 'superseded'],
  approved: [],
  rejected: ['pending'],
  superseded: [],
};

/** The moves an office reviewer makes. Resubmitting is the resident's, in the app. */
export const VERIFICATION_REVIEW_MOVES: readonly VerificationDecision[] = ['approved', 'rejected'];

/**
 * The decisions open on this request. An account that gives no name has nothing to check against
 * the ID, so it can only be rejected — with a reason that asks the resident for the name (`DL-197`).
 * Nor can a request whose selfie was erased be approved: the server refuses it with a 409, because
 * nobody can now see the face the approval would vouch for (`DL-218`).
 */
export function reviewMovesFor(request: VerificationRequest): readonly VerificationDecision[] {
  return approvalBar(request) === null
    ? VERIFICATION_REVIEW_MOVES
    : VERIFICATION_REVIEW_MOVES.filter((move) => move !== 'approved');
}

/** Why this request cannot be approved, or `null` when it can be. Said on screen, never implied. */
export function approvalBar(request: VerificationRequest): 'no-name' | 'selfie-erased' | null {
  if (selfieErased(request)) {
    return 'selfie-erased';
  }
  return identityToConfirm(request) === null ? 'no-name' : null;
}

/** True when the office can decide this request now. */
export function awaitsReview(request: VerificationRequest): boolean {
  return nextStatuses(VERIFICATION_STATUS_TRANSITIONS, request.status).some((to) =>
    (VERIFICATION_REVIEW_MOVES as readonly VerificationStatus[]).includes(to),
  );
}

/* ── what a decision does, as the API says ───────────────────────────────── */

/**
 * What the API does on each decision, shown **before** the button (`DL-167`).
 *
 * Read from the backend, not assumed: `taytay-backend` `2736e28` — the `approveVerification` and
 * `rejectVerification` operations in `openapi/openapi.json` ("Sets the resident to verified. A
 * registered role becomes verified. Staff and admin roles are left unchanged." / "Notes are
 * required. The account stays registered and may submit again."), and the handlers behind them in
 * `src/modules/verification/routes.ts` and `repository.ts`, which notify the resident, issue the
 * digital ID and put a rejection's notes in front of the resident as the reason; and, since
 * `DL-197`, the `VerificationApproval` body that keeps the confirmed name and the `PATCH /me` rule
 * that then refuses a change of name or birth date. If the backend
 * changes what a decision does, this list is wrong until somebody reads it again.
 */
export const VERIFICATION_DECISION_EFFECTS: Readonly<
  Record<VerificationDecision, readonly string[]>
> = {
  approved: [
    'The name you confirmed is kept as the name this ID was approved under. From now on the ' +
      'resident cannot change their name or birth date in the app.',
    'The account is marked verified. A resident account becomes a verified resident account; a ' +
      'staff or administrator account keeps its role.',
    'If it is then a verified resident account that is not closed, a digital ID is issued with ' +
      'this selfie as its photo, unless the account already has one.',
    'The resident is told in the app: “Your identity review was approved.”',
    'Your note stays with the request for the office. The resident does not see it.',
    'Nothing in this console can undo an approval.',
  ],
  rejected: [
    'The resident reads your reason in the app, as what was wrong with what they sent. Write it ' +
      'for them, in words they can act on.',
    'The resident is told in the app: “Your identity review was rejected.”',
    'The account stays registered. The resident may correct the request and send it again, and it ' +
      'returns to this queue.',
  ],
};

/**
 * How long a decision's words may be. The maximum is the API's (`VerificationApproval`, `RejectNotes`:
 * 1,000 characters, trimmed). The minimum is this console's: a decision about somebody's identity
 * carries a sentence, the same floor every other recorded move here has (`DL-54`).
 */
export const REVIEW_NOTE_LIMITS = { minimum: 8, maximum: 1000 } as const;

/** Why a decision's words would be refused, or `null` when they would not. */
export function reviewNoteProblem(note: string): 'too-short' | 'too-long' | null {
  const length = note.trim().length;
  if (length < REVIEW_NOTE_LIMITS.minimum) {
    return 'too-short';
  }
  return length > REVIEW_NOTE_LIMITS.maximum ? 'too-long' : null;
}

/* ── the queue ───────────────────────────────────────────────────────────── */

/** `null` is every status, newest first as the server orders them. */
export interface VerificationFilter {
  readonly status: VerificationStatus | null;
}

export const DEFAULT_VERIFICATION_FILTER: VerificationFilter = { status: 'pending' };
