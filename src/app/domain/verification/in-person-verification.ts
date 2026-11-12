import type { AppAccount } from '../accounts/app-account';
import type {
  AppAccountId,
  InPersonVerificationId,
  IsoDateTime,
  VerificationRequestId,
} from '../shared/ids';
import type { IdDocumentType } from './verification-request';

/**
 * A resident's account verified **in person**, against a government ID somebody at the office has
 * seen at the counter (`DL-219`).
 *
 * The other way to be verified, for a resident who declines the biometric (selfie) consent or meets
 * one not yet published. RA 10173 asks for consent that is freely given (s.3(b)), and the NPC holds
 * that a consent refused at the cost of the service is not (Advisory 2023-01, Circular 2023-04): so
 * declining the selfie must leave a way to be verified, and this is it.
 *
 * **Nothing biometric is taken.** No image, no selfie, no photograph of the ID: the server keeps the
 * kind of ID, the last four characters of its number (`DL-183`), the name it shows, who checked it
 * and when. The four characters go to the server and are not read back: nothing on screen needs them.
 */
export interface InPersonCheck {
  readonly idType: IdDocumentType;
  /** The last four characters of the ID's number, and nothing more (`DL-183`). */
  readonly idLastFour: string;
  /** The account's name as the screen showed it; the server compares it under a lock (`DL-197`). */
  readonly confirmedName: string;
  /** The name as the ID shows it, when it is not the account's (`DL-198`); `null` when it is. */
  readonly correctedName: string | null;
}

/**
 * What the server recorded. Not read: `id_last_four` (nothing here shows it again) and `verified_by`
 * (an account id nobody here can name; the server's audit trail records who).
 */
export interface InPersonVerification {
  readonly id: InPersonVerificationId;
  readonly accountId: AppAccountId;
  readonly idType: IdDocumentType;
  readonly nameCorrected: boolean;
  /** The waiting selfie request this closed as `superseded`, with its selfie erased, if any. */
  readonly supersededRequestId: VerificationRequestId | null;
  readonly verifiedAt: IsoDateTime;
}

/** A counter check the server recorded, with what was sent, so a screen can say what changed. */
export interface InPersonOutcome {
  readonly record: InPersonVerification;
  readonly check: InPersonCheck;
}

/**
 * Only a resident's account that is not yet verified is checked at the counter: the server refuses
 * a verified one, and a staff or administrator account, with a 409.
 */
export function takesInPersonCheck(account: AppAccount): boolean {
  return account.role === 'registered';
}

/**
 * The account as a recorded check leaves it, as the server's handler does (`5209f75`): a resident
 * account becomes a verified one, and a corrected name replaces the name. The list is read again
 * from the server all the same.
 */
export function afterInPersonCheck(account: AppAccount, outcome: InPersonOutcome): AppAccount {
  const corrected = outcome.record.nameCorrected ? outcome.check.correctedName : null;
  return { ...account, role: 'verified', name: corrected ?? account.name };
}

/** The account a counter check is about: its id, and the name it gives, as the screen shows it. */
export interface InPersonSubject {
  readonly accountId: AppAccountId;
  readonly name: string;
}

/**
 * The server's limits (`InPersonVerificationInput` at `taytay-backend` `5209f75`): one to four
 * letters or digits, stored upper-cased; a name of 1 to 120 characters, trimmed.
 */
export const ID_LAST_FOUR_PATTERN = /^[A-Za-z0-9]{1,4}$/;
export const IN_PERSON_NAME_MAX = 120;

/** The fields a counter check can be refused on, by the console or by the server. */
export type InPersonField = 'idType' | 'idLastFour' | 'correctedName' | 'idShowsName';

export interface InPersonDraft {
  readonly idType: IdDocumentType | null;
  readonly idLastFour: string;
  readonly correctedName: string;
}

/** Why the form would be refused before it is sent, field by field; empty when it would not. */
export function inPersonProblems(
  subject: InPersonSubject,
  draft: InPersonDraft,
): Partial<Record<InPersonField, string>> {
  const problems: Partial<Record<InPersonField, string>> = {};
  if (draft.idType === null) {
    problems.idType = 'Choose the kind of ID the resident showed.';
  }
  const four = draft.idLastFour.trim();
  if (four === '') {
    problems.idLastFour = 'Type the last four characters of the ID’s number.';
  } else if (four.length > 4) {
    problems.idLastFour =
      'Only the last four characters are recorded. Type just those, never the whole number.';
  } else if (!ID_LAST_FOUR_PATTERN.test(four)) {
    problems.idLastFour = 'Letters and digits only, as printed: no spaces, dashes or other marks.';
  }
  const corrected = draft.correctedName.trim();
  if (corrected.length > IN_PERSON_NAME_MAX) {
    problems.correctedName = `A name is at most ${IN_PERSON_NAME_MAX} characters.`;
  } else if (corrected !== '' && corrected === subject.name.trim()) {
    problems.correctedName = 'That is already the account’s name. Leave this empty.';
  }
  return problems;
}

/** The check to send, or `null` while the draft has a problem. */
export function toInPersonCheck(
  subject: InPersonSubject,
  draft: InPersonDraft,
): InPersonCheck | null {
  if (Object.keys(inPersonProblems(subject, draft)).length > 0 || draft.idType === null) {
    return null;
  }
  const corrected = draft.correctedName.trim();
  return {
    idType: draft.idType,
    idLastFour: draft.idLastFour.trim().toUpperCase(),
    confirmedName: subject.name,
    correctedName: corrected === '' ? null : corrected,
  };
}

/**
 * What the server does when an account is verified in person, said **before** the button
 * (`DL-219`). Read from `taytay-backend` `5209f75`: `verifyUserInPerson` in `openapi/openapi.json`,
 * `verifyInPerson` in `src/modules/verification/repository.ts` (the account verified as an approval
 * leaves it; a pending selfie request closed as `superseded` with its selfie erased; a rejected one
 * left alone; a corrected name appended to the `DL-198` history), its route (audits with ids and the
 * code only; the resident's notification "Your identity was verified in person at the office."; no
 * digital ID, because a card needs a photo), and `PATCH /me`, which refuses a verified account's
 * change of name or birth date. If the backend changes, this list is wrong until somebody reads it
 * again.
 */
export const IN_PERSON_EFFECTS: readonly string[] = [
  'The account is marked verified, as an approved ID review marks it. From then on the resident ' +
    'cannot change their name or birth date in the app; the office corrects a name here, against ' +
    'an ID.',
  'If the resident has an ID review waiting, it is closed as replaced by this check, and its ' +
    'selfie is erased. A rejected review stays as it is.',
  'What is kept: the kind of ID, the last four characters of its number, the name it shows, and ' +
    'who checked it and when. No photo or biometric data is taken here.',
  'No digital ID is issued by this check. A card photo, if the resident wants a digital ID, is a ' +
    'separate step with its own consent, when the card is issued.',
  'The resident is told in the app: “Your identity was verified in person at the office.”',
  'The audit trail records that the account was verified in person, with ids only: never the ' +
    'four characters.',
];

/** Said with the effects when a name is corrected in the same act (`DL-198`). */
export const IN_PERSON_CORRECTION_EFFECT =
  'The account’s name becomes the one you typed, as the ID shows it. The earlier name is kept in ' +
  'the account’s name history, with who corrected it and when.';

/**
 * The server refused a counter check (`DL-219`), in its own words, with the field it is about when
 * it named one. `forbidden` is a 403 (not the reader's to make, or their own account), `invalid` a
 * 422 with the fields the data layer has already translated, and `conflict` a 404 or 409: the
 * account is gone, closed, already verified, not a resident's, gives no name, or no longer gives the
 * name shown.
 */
export class InPersonRefusedError extends Error {
  constructor(
    message: string,
    readonly kind: 'forbidden' | 'invalid' | 'conflict',
    readonly fields: Readonly<Partial<Record<InPersonField, string>>> = {},
  ) {
    super(message);
    this.name = 'InPersonRefusedError';
  }
}

export function isInPersonRefused(error: unknown): error is InPersonRefusedError {
  return error instanceof InPersonRefusedError;
}
