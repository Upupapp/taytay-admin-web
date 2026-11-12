import type { StatusCatalog, StatusTransitions } from '../shared/status';
import type { DigitalIdId, IsoDateTime, MediaId } from '../shared/ids';

/**
 * A resident's digital ID in the Taytay app (`DL-171`), read from the Node API at `2736e28`
 * (`src/modules/digital-id`).
 *
 * **A municipal card, not a government identifier.** `number` is the municipality's own card number;
 * the spec says it is not a national government identifier, and nothing here treats it as one.
 *
 * **No QR here.** The administrator's read of a card carries no QR, and this console never asks for
 * one: a QR is what the resident shows, not something the office keeps.
 */
export interface DigitalIdCard {
  readonly id: DigitalIdId;
  readonly number: string;
  /** The photo printed on the card, read as bytes on request and never as a URL. */
  readonly photo: MediaId;
  readonly status: DigitalIdStatus;
  readonly issuedAt: IsoDateTime;
  readonly expiresAt: IsoDateTime;
}

/**
 * What the API answers when staff check a resident's QR code — exactly its five fields, of which
 * this holds four and the barangay's name rather than its id. Nothing else about the resident is
 * returned, and nothing is looked up beside it.
 */
export interface DigitalIdHolder {
  /** `null` when the account has no name on it; said, never guessed. */
  readonly name: string | null;
  readonly photo: MediaId;
  readonly status: DigitalIdStatus;
  /** The server's own reading of the card's expiry at the moment it answered. */
  readonly expired: boolean;
  readonly barangayName: string | null;
}

export const DIGITAL_ID_STATUSES = ['active', 'suspended', 'revoked'] as const;

export type DigitalIdStatus = (typeof DIGITAL_ID_STATUSES)[number];

export const DIGITAL_ID_STATUS_CATALOG: StatusCatalog<DigitalIdStatus> = {
  active: {
    value: 'active',
    label: 'Active',
    tone: 'success',
    description: 'The app shows the card with a QR code while it has not expired.',
  },
  suspended: {
    value: 'suspended',
    label: 'Suspended',
    tone: 'warning',
    description: 'The app shows no QR code. No route makes a suspended card active again.',
  },
  revoked: {
    value: 'revoked',
    label: 'Revoked',
    tone: 'danger',
    description: 'Ended for good. The administrator’s read no longer returns it.',
  },
};

/**
 * The API's own moves (`setStatus`): only an active card is suspended; an active or suspended card
 * is revoked; nothing leaves `revoked`, and **nothing returns a suspended card to active**.
 */
export const DIGITAL_ID_STATUS_TRANSITIONS: StatusTransitions<DigitalIdStatus> = {
  active: ['suspended', 'revoked'],
  suspended: ['revoked'],
  revoked: [],
};

/** The four acts an administrator has on a resident's card. */
export type DigitalIdAct = 'issue' | 'suspend' | 'revoke' | 'reissue';

/**
 * The acts a current card offers, in the order the screen offers them. Suspending and revoking follow
 * `DIGITAL_ID_STATUS_TRANSITIONS`; replacing is open to any current card, because the API revokes
 * the old one inside the same act.
 */
export function actsOn(card: DigitalIdCard): readonly Exclude<DigitalIdAct, 'issue'>[] {
  const moves = DIGITAL_ID_STATUS_TRANSITIONS[card.status];
  const acts: Exclude<DigitalIdAct, 'issue'>[] = [];

  if (moves.includes('suspended')) acts.push('suspend');
  if (moves.includes('revoked')) acts.push('revoke');
  if (card.status !== 'revoked') acts.push('reissue');
  return acts;
}

/** True once the card's printed expiry has passed, by the reader's clock. */
export function isPastExpiry(card: DigitalIdCard, now: Date = new Date()): boolean {
  return new Date(card.expiresAt).getTime() <= now.getTime();
}

/** How long a QR code shown in the app can be checked: `QR_TTL_MS` in the backend's signer. */
export const QR_LIFETIME_MINUTES = 2;

/** How long a card lasts from issue: `CARD_VALIDITY_MS` in the backend's repository. */
export const CARD_VALIDITY_DAYS = 365;

/** The API's limit on a pasted code is not stated; this console's field stops well past any real one. */
export const QR_PAYLOAD_MAX_LENGTH = 4000;

/**
 * What each act does, read from the backend's handlers at `2736e28` (`digital-id/routes.ts`,
 * `repository.ts`) rather than assumed, and shown **before** the button that does it.
 *
 * Every act is recorded in the API's audit trail under the administrator's account, and none takes a
 * reason: the routes accept no body that could carry one (`DIGITAL_ID_ALWAYS`).
 */
export const DIGITAL_ID_EFFECTS: Readonly<Record<DigitalIdAct, readonly string[]>> = {
  issue: [
    `Issues a card valid for ${CARD_VALIDITY_DAYS} days, with a new card number.`,
    'The photo on the card is the one chosen: a card photo taken at the counter, or, by the API’s choice, the resident’s latest reviewed ID selfie, failing which the newest card photo (`DL-221`).',
    'Refused if the account is not a verified resident, is closed, or already holds a current card.',
    'The resident sees the card in the app, with a QR code, straight away.',
  ],
  suspend: [
    'The resident’s card stops working in the app: the app shows no QR code while it is suspended.',
    `A QR code the app already showed stops being accepted within ${QR_LIFETIME_MINUTES} minutes, when it expires; until then a check shows the card as suspended.`,
    'No route makes a suspended card active again. Afterwards it can only be revoked or replaced by a new card.',
  ],
  revoke: [
    'The resident’s card stops working in the app for good: the app shows no QR code.',
    'The card is not shown on the resident’s record again: the administrator’s read returns only a current card. The list of cards keeps it, as revoked.',
    'A new card can then be issued to the resident, with a new number.',
  ],
  reissue: [
    'This card is revoked and a new one is issued in the same act, with a new number and the same photo.',
    `The new card is valid for ${CARD_VALIDITY_DAYS} days from today. The old number stops working in the app.`,
    'Refused if the account is no longer a verified resident or is closed — and then the old card is not revoked either.',
  ],
};

/** True of every act, said once beneath the act's own effects. */
export const DIGITAL_ID_ALWAYS: readonly string[] = [
  'The API records the act in its audit trail under your account. It keeps no reason: none is asked for.',
  'Nothing is sent to the resident by this console; they see the change the next time the app reads the card.',
];

/**
 * What checking a code does, said beside the field before anything is sent. The API records every
 * successful check (`digital_id.scanned`) under the checker's account; this console keeps nothing.
 */
export const DIGITAL_ID_CHECK_EFFECTS: readonly string[] = [
  `A code is accepted for ${QR_LIFETIME_MINUTES} minutes after the app shows it; an older one is refused as not valid.`,
  'The API records that you checked this card, under your account. This console keeps nothing: the answer is gone when you check another code or leave the page.',
  'The answer is the holder’s name, the card’s status, whether it has expired and the barangay — what the API returns, and nothing looked up beside it.',
];
