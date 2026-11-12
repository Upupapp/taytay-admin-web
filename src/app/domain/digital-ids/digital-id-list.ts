import type { CursorPage } from '../shared/pagination';
import type { AppAccountId, BarangayId, DigitalIdId, IsoDateTime } from '../shared/ids';

import type { DigitalIdStatus } from './digital-id';

/**
 * The office's list of the cards it has issued (`DL-212`), read from `GET admin/digital-ids`
 * (`digital-id.manage`). Revoked cards are in it: the list is the municipality's record of every card,
 * where an account's own read returns only its current one.
 */
export interface DigitalIdListing {
  readonly id: DigitalIdId;
  readonly number: string;
  /** The stored status. An active card past its date is still `active`, with `expired` said beside it. */
  readonly status: DigitalIdStatus;
  /** The server's reading of the expiry when it answered — a card past its date cannot be presented. */
  readonly expired: boolean;
  readonly issuedAt: IsoDateTime;
  readonly expiresAt: IsoDateTime;
  readonly holder: DigitalIdListHolder;
}

export interface DigitalIdListHolder {
  /** The app account holding the card: the key the card record is read by. */
  readonly account: AppAccountId;
  /** `null` once the account is closed: the API stops showing a closed account's name. */
  readonly name: string | null;
  /** The barangay's name as the API gives it, or `null` when the account names none. */
  readonly barangayName: string | null;
}

/**
 * The list's status filter, as the API reads it. `expired` and `expiring` are both **active** cards,
 * told apart by their date; a suspended or revoked card is never "expired" here.
 */
export const DIGITAL_ID_LIST_STATUSES = [
  'active',
  'expiring',
  'expired',
  'suspended',
  'revoked',
] as const;

export type DigitalIdListStatus = (typeof DIGITAL_ID_LIST_STATUSES)[number];

/** How far ahead `expiring` looks: `EXPIRING_WINDOW_DAYS` in the backend's repository. */
export const DIGITAL_ID_EXPIRING_DAYS = 30;

export interface DigitalIdListFilter {
  readonly status?: DigitalIdListStatus;
  /** Words matched against the holder's name and the card number; two characters at least. */
  readonly term?: string;
  readonly barangayId?: BarangayId;
}

/**
 * The lifecycle strip: how many cards stand at each status **under the list's other filters** — the
 * status filter itself aside, so choosing a tab never empties the strip. `active` counts only cards
 * still in date; `expired` the active ones past it; `expiring` the active ones within
 * `DIGITAL_ID_EXPIRING_DAYS` (and so also counted in `active`).
 */
export interface DigitalIdCounts {
  readonly active: number;
  readonly expiring: number;
  readonly expired: number;
  readonly suspended: number;
  readonly revoked: number;
}

export interface DigitalIdListPage extends CursorPage<DigitalIdListing> {
  readonly counts: DigitalIdCounts;
}

/** The shortest search the API accepts; a shorter one is refused before it is sent. */
export const DIGITAL_ID_SEARCH_MIN_LENGTH = 2;

/** True when anything narrows the list beyond its status tab. */
export function isDigitalIdListNarrowed(filter: DigitalIdListFilter): boolean {
  return (filter.term ?? '').trim() !== '' || filter.barangayId !== undefined;
}
