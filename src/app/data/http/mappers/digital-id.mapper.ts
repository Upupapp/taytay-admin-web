import {
  DIGITAL_ID_STATUSES,
  type AppAccountId,
  type TakenCardPhoto,
  type CardPhotoConsent,
  CARD_PHOTO_SOURCES,
  type DigitalIdCard,
  type DigitalIdCardFacts,
  type DigitalIdCounts,
  type DigitalIdEvent,
  type DigitalIdFunnel,
  type DigitalIdHolder,
  type DigitalIdId,
  type DigitalIdListing,
  type MediaId,
} from '@domain/index';

import { bool, dateTime, field, id, int, oneOf, str } from './wire';

/**
 * `DigitalIdCard` → `DigitalIdCard` (`DL-171`).
 *
 * | wire             | domain      | if absent                 |
 * | ---------------- | ----------- | ------------------------- |
 * | `id`             | `id`        | the card is not readable  |
 * | `id_number`      | `number`    | the card is not readable  |
 * | `photo_media_id` | `photo`     | the card is not readable  |
 * | `status`         | `status`    | the card is not readable  |
 * | `issued_at`      | `issuedAt`  | the card is not readable  |
 * | `expires_at`     | `expiresAt` | the card is not readable  |
 *
 * Every field is required: a card shown with a guessed status or expiry is a card somebody acts on
 * wrongly. A `qr` — which only the resident's own read carries — is never read.
 *
 * @consumes GET admin/users/{id}/digital-id
 * @consumes POST admin/users/{id}/digital-id
 * @consumes POST admin/digital-ids/{id}/suspend
 * @consumes POST admin/digital-ids/{id}/revoke
 * @consumes POST admin/digital-ids/{id}/reissue
 */
export function toDigitalIdCard(wire: unknown): DigitalIdCard | null {
  const cardId = id<DigitalIdId>(field(wire, 'id'));
  const number = str(field(wire, 'id_number'));
  const photo = id<MediaId>(field(wire, 'photo_media_id'));
  const status = oneOf(field(wire, 'status'), DIGITAL_ID_STATUSES);
  const issuedAt = dateTime(field(wire, 'issued_at'));
  const expiresAt = dateTime(field(wire, 'expires_at'));

  if (
    cardId === null ||
    number === null ||
    photo === null ||
    status === null ||
    issuedAt === null ||
    expiresAt === null
  ) {
    return null;
  }

  return { id: cardId, number, photo, status, issuedAt, expiresAt };
}

/**
 * The card record's own read: the card with its facts (`DL-232`).
 *
 * | wire                     | domain                         | if absent or malformed     |
 * | ------------------------ | ------------------------------ | -------------------------- |
 * | the card's six fields    | as `toDigitalIdCard`           | the card is not readable   |
 * | `photo_source`           | `record.photoSource`           | the card is not readable   |
 * | `checks_count`           | `record.checksCount`           | the card is not readable   |
 * | `holder.purok_or_sitio`  | `record.holder.purokOrSitio`   | none recorded              |
 * | `holder.verified_at`     | `record.holder.verifiedAt`     | not verified, or not said  |
 * | `holder.id_type`         | `record.holder.idType`         | none recorded              |
 *
 * @consumes GET admin/users/{id}/digital-id
 */
export function toDigitalIdCardRecord(wire: unknown): DigitalIdCard | null {
  const card = toDigitalIdCard(wire);
  const rawSource = field(wire, 'photo_source');
  const photoSource = rawSource === null ? null : oneOf(rawSource, CARD_PHOTO_SOURCES);
  const checksCount = int(field(wire, 'checks_count'));
  const holder = field(wire, 'holder');
  const rawVerified = field(holder, 'verified_at');
  const verifiedAt = rawVerified === null ? null : dateTime(rawVerified);
  if (
    card === null ||
    (rawSource !== null && photoSource === null) ||
    checksCount === null ||
    checksCount < 0 ||
    (rawVerified !== null && verifiedAt === null)
  ) {
    return null;
  }
  const record: DigitalIdCardFacts = {
    photoSource,
    checksCount,
    holder: {
      purokOrSitio: str(field(holder, 'purok_or_sitio')),
      verifiedAt,
      idType: str(field(holder, 'id_type')),
    },
  };
  return { ...card, record };
}

/**
 * One row of a holder's card history (`DL-232`), as the audit trail recorded it: the action is kept
 * in the trail's own word, and a row missing its id, card or time is not readable.
 *
 * @consumes GET admin/users/{id}/digital-id/events
 */
export function toDigitalIdEvent(wire: unknown): DigitalIdEvent | null {
  const eventId = str(field(wire, 'id'));
  const action = str(field(wire, 'action'));
  const card = id<DigitalIdId>(field(wire, 'card_id'));
  const at = dateTime(field(wire, 'created_at'));
  if (eventId === null || action === null || card === null || at === null) {
    return null;
  }
  const actor = field(wire, 'actor');
  return {
    id: eventId,
    action,
    card,
    at,
    actorName: actor === null ? null : str(field(actor, 'name')),
  };
}

/**
 * The verify answer → `DigitalIdHolder` (`DL-171`).
 *
 * | wire             | domain         | if absent                   |
 * | ---------------- | -------------- | --------------------------- |
 * | `photo_media_id` | `photo`        | the answer is not readable  |
 * | `status`         | `status`       | the answer is not readable  |
 * | `expired`        | `expired`      | the answer is not readable  |
 * | `name`           | `name`         | no name given               |
 * | `barangay.name`  | `barangayName` | no barangay given           |
 *
 * **Not read**: the barangay's id, which a person checking a card has no use for. The answer holds
 * nothing else, and nothing is fetched beside it.
 *
 * @consumes POST digital-id/verify
 */
export function toDigitalIdHolder(wire: unknown): DigitalIdHolder | null {
  const photo = id<MediaId>(field(wire, 'photo_media_id'));
  const status = oneOf(field(wire, 'status'), DIGITAL_ID_STATUSES);
  const expired = field(wire, 'expired');

  if (photo === null || status === null || typeof expired !== 'boolean') {
    return null;
  }

  return {
    name: str(field(wire, 'name')),
    photo,
    status,
    expired: bool(expired),
    barangayName: str(field(field(wire, 'barangay'), 'name')),
  };
}

/** `DigitalIdVerify`: the code's contents, exactly as given. */
export interface DigitalIdVerifyWire {
  readonly token: string;
}

export function toWireDigitalIdVerify(payload: string): DigitalIdVerifyWire {
  return { token: payload.trim() };
}

/**
 * `DigitalIdListItem` → `DigitalIdListing` (`DL-212`).
 *
 * | wire                    | domain                 | if absent                 |
 * | ----------------------- | ---------------------- | ------------------------- |
 * | `id`                    | `id`                   | the row is not readable   |
 * | `id_number`             | `number`               | the row is not readable   |
 * | `status`                | `status`               | the row is not readable   |
 * | `expired`               | `expired`              | the row is not readable   |
 * | `issued_at`             | `issuedAt`             | the row is not readable   |
 * | `expires_at`            | `expiresAt`            | the row is not readable   |
 * | `holder.id`             | `holder.account`       | the row is not readable   |
 * | `holder.name`           | `holder.name`          | no name shown             |
 * | `holder.barangay.name`  | `holder.barangayName`  | no barangay given         |
 * | `holder.email`          | `holder.email`         | closed account: none      |
 * | `holder.verified_at`    | `holder.verifiedAt`    | closed account: none      |
 *
 * **Not read**: the barangay's id, which the list only filters by. The row carries no photo; the
 * card record reads it with the card.
 *
 * @consumes GET admin/digital-ids
 */
export function toDigitalIdListing(wire: unknown): DigitalIdListing | null {
  const cardId = id<DigitalIdId>(field(wire, 'id'));
  const number = str(field(wire, 'id_number'));
  const status = oneOf(field(wire, 'status'), DIGITAL_ID_STATUSES);
  const expired = field(wire, 'expired');
  const issuedAt = dateTime(field(wire, 'issued_at'));
  const expiresAt = dateTime(field(wire, 'expires_at'));
  const holder = field(wire, 'holder');
  const account = id<AppAccountId>(field(holder, 'id'));

  if (
    cardId === null ||
    number === null ||
    status === null ||
    typeof expired !== 'boolean' ||
    issuedAt === null ||
    expiresAt === null ||
    account === null
  ) {
    return null;
  }

  return {
    id: cardId,
    number,
    status,
    expired,
    issuedAt,
    expiresAt,
    holder: {
      account,
      name: str(field(holder, 'name')),
      barangayName: str(field(field(holder, 'barangay'), 'name')),
      email: str(field(holder, 'email')),
      verifiedAt: dateTime(field(holder, 'verified_at')),
    },
  };
}

/**
 * `meta.counts` → `DigitalIdCounts` (`DL-212`). Every count is required: a lifecycle strip with a
 * guessed figure in it is worse than none, so a missing one makes the whole answer unreadable.
 *
 * | wire           | domain      |
 * | -------------- | ----------- |
 * | `active`       | `active`    |
 * | `expiring_30d` | `expiring`  |
 * | `expired`      | `expired`   |
 * | `suspended`    | `suspended` |
 * | `revoked`      | `revoked`   |
 *
 * @consumes GET admin/digital-ids
 */
export function toDigitalIdCounts(meta: unknown): DigitalIdCounts | null {
  const counts = field(meta, 'counts');
  const active = int(field(counts, 'active'));
  const expiring = int(field(counts, 'expiring_30d'));
  const expired = int(field(counts, 'expired'));
  const suspended = int(field(counts, 'suspended'));
  const revoked = int(field(counts, 'revoked'));

  if (
    active === null ||
    expiring === null ||
    expired === null ||
    suspended === null ||
    revoked === null
  ) {
    return null;
  }

  return { active, expiring, expired, suspended, revoked };
}

/**
 * `meta.funnel` to `DigitalIdFunnel` (`DL-232`): municipality-wide, never narrowed by the list's
 * filter. Every figure is required, like the counts.
 *
 * @consumes GET admin/digital-ids
 */
export function toDigitalIdFunnel(meta: unknown): DigitalIdFunnel | null {
  const funnel = field(meta, 'funnel');
  const appAccounts = int(field(funnel, 'app_accounts'));
  const pendingVerification = int(field(funnel, 'pending_verification'));
  const rawOldest = field(funnel, 'oldest_pending_at');
  const oldestPendingAt = rawOldest === null ? null : dateTime(rawOldest);
  const verified = int(field(funnel, 'verified'));
  const verifiedWithoutCard = int(field(funnel, 'verified_without_card'));
  if (
    appAccounts === null ||
    pendingVerification === null ||
    (rawOldest !== null && oldestPendingAt === null) ||
    verified === null ||
    verifiedWithoutCard === null
  ) {
    return null;
  }
  return { appAccounts, pendingVerification, oldestPendingAt, verified, verifiedWithoutCard };
}

/**
 * `CardPhotoEnvelope.data` → `TakenCardPhoto` (`DL-221`).
 *
 * | wire         | domain    | if absent or malformed        |
 * | ------------ | --------- | ----------------------------- |
 * | `media_id`   | `media`   | the answer is not readable    |
 * | `kind`       | —         | not `card-photo`: not readable |
 * | `created_at` | `takenAt` | the answer is not readable    |
 *
 * @consumes POST admin/users/{id}/card-photos
 */
export function toCardPhoto(wire: unknown): TakenCardPhoto | null {
  const media = id<MediaId>(field(wire, 'media_id'));
  const takenAt = dateTime(field(wire, 'created_at'));
  if (media === null || takenAt === null || field(wire, 'kind') !== 'card-photo') return null;
  return { media, takenAt };
}

/**
 * The card photo's form: the file, and the staff member's confirmation that the resident agreed,
 * which the API requires as the literal `true` (`DL-221`). The consent is a parameter so that no
 * caller can send a photo without having stated it.
 */
export interface CardPhotoWire {
  readonly file: Blob;
  readonly consent_confirmed: 'true';
}

export function toWireCardPhoto(photo: Blob, consent: CardPhotoConsent): CardPhotoWire {
  // `consent` is `{ confirmed: true }` by its type, so the field can only read 'true'.
  return { file: photo, consent_confirmed: `${consent.confirmed}` };
}

/** `DigitalIdIssue`: the photo named only when one was chosen; none, and the API chooses. */
export interface DigitalIdIssueWire {
  readonly photo_media_id?: string;
}

export function toWireDigitalIdIssue(photo: MediaId | undefined): DigitalIdIssueWire {
  return photo === undefined ? {} : { photo_media_id: photo };
}
