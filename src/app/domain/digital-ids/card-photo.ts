import type { IsoDateTime, MediaId } from '../shared/ids';

/**
 * A photo taken of a resident at the counter, for their Citizen ID only (`DL-221`), from backend B6
 * (`POST admin/users/{id}/card-photos`, `digital-id.manage`).
 *
 * **For the card, and nothing else.** A card always shows a face, and a resident verified in person
 * sent no selfie. The card photo's basis is the resident's agreement to a photo for their card,
 * which the staff member confirms; it is ordinary personal information, not biometric processing:
 * the API never compares it with anything, never offers it to the ID review, and does not erase it
 * when the biometric consent is withdrawn.
 */
export interface TakenCardPhoto {
  /** Named as the card's photo when the card is issued. */
  readonly media: MediaId;
  readonly takenAt: IsoDateTime;
}

/**
 * The staff member's confirmation, required by the API (`consent_confirmed=true`, 422 without it)
 * and by this type: a photo cannot be sent without it.
 */
export interface CardPhotoConsent {
  readonly confirmed: true;
}

/** Said beside the tick, before the button that sends the photo. */
export const CARD_PHOTO_CONSENT_STATEMENT =
  'The resident agreed to have a photo taken for their card. It is used on the card only, never for face matching.';

/** What taking the photo does, read from the backend at `98a4f19` and said before its button. */
export const CARD_PHOTO_EFFECTS: readonly string[] = [
  'The photo is kept for this resident’s card only: the API never compares it with anything, never shows it to the ID review, and does not erase it if the resident withdraws the selfie consent.',
  'The API records that you took it, under your account. No image is logged.',
  'Nothing is issued yet. Issue the card next, with this photo chosen for it.',
];
