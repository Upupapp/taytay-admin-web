import {
  DIGITAL_ID_STATUSES,
  type AppAccountId,
  type DigitalIdCard,
  type DigitalIdCounts,
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
