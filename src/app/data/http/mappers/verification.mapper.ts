import {
  VERIFICATION_STATUSES,
  type AppAccountId,
  type IdDocumentType,
  type InPersonCheck,
  type InPersonField,
  type InPersonVerification,
  type InPersonVerificationId,
  type MediaId,
  type VerificationRequest,
  type VerificationRequestId,
  type WriteIntent,
} from '@domain/index';

import { date, dateTime, field, flag, id, oneOf, str } from './wire';

/** The API's ID types are `snake_case`; the domain's are kebab case, like every other union. */
const ID_TYPE_BY_WIRE: Readonly<Record<string, IdDocumentType>> = {
  philid: 'philid',
  drivers_license: 'drivers-license',
  passport: 'passport',
  umid: 'umid',
  postal: 'postal',
  voters: 'voters',
  sss: 'sss',
  other: 'other',
};

/**
 * `VerificationRequestStaff` → `VerificationRequest` (`DL-167`).
 *
 * The staff view of the resource: the citizen fields plus `notes`, which the API omits from a
 * resident's own copy. Read by name, against the vendored spec:
 *
 * | wire                 | domain              | if absent                      |
 * | -------------------- | ------------------- | ------------------------------ |
 * | `id`                 | `id`                | the record is not readable     |
 * | `user_id`            | `accountId`         | the record is not readable     |
 * | `id_type`            | `idType`            | the record is not readable     |
 * | `id_front_media_id`  | `images.idFront`    | the record is not readable     |
 * | `id_back_media_id`   | `images.idBack`     | no back image                  |
 * | `selfie_media_id`    | `images.selfie`     | the record is not readable     |
 * | `selfie_erased_at`   | `selfieErasedAt`    | not erased                     |
 * | `status`             | `status`            | the record is not readable     |
 * | `submitted_at`       | `submittedAt`       | the record is not readable     |
 * | `reviewed_at`        | `reviewedAt`        | not reviewed                   |
 * | `message`            | `residentMessage`   | the resident wrote nothing     |
 * | `notes`              | `reviewNote`        | no note                        |
 * | `account_name`       | `account.name`      | the account gives no name      |
 * | `account_birthdate`  | `account.birthDate` | the account holds no birth date |
 *
 * `selfie_erased_at` (`44cae1b`, `DL-218`) is required by the spec, but an API older than it sends
 * nothing, and that API erased nothing: so an absent or unreadable value reads as not erased, and
 * the record stays readable: the console and the API deploy separately, and the console tolerates the
 * previous server. An unknown **status** stays unreadable, because `superseded` read as
 * anything else would offer a decision on a closed request.
 *
 * The two `account_` fields come only while the request is `pending` (`DL-197`): the API sends what
 * the account says about its holder for the reviewer to check against the ID, and stops once a
 * decision is made. So `account` is read on a pending request and is `null` on any other.
 *
 * **Not read**: `reviewer_id` (an account id nobody here can name — see the domain model),
 * `can_edit` (the resident's affordance, not the office's), `submitted_categories` (derivable from
 * the images) and `issues` (the resident's copy of `notes` on a rejection, so reading both would be
 * reading one sentence twice). `created_at` only orders the server's cursor.
 *
 * Every field the record cannot be read without is one the spec marks required, so a `null` here
 * is the API breaking its own contract — and the adapter refuses the page rather than quietly
 * showing one fewer resident waiting for an answer.
 *
 * @consumes GET admin/verification-requests
 * @consumes POST admin/verification-requests/{id}/approve
 * @consumes POST admin/verification-requests/{id}/reject
 */
export function toVerificationRequest(wire: unknown): VerificationRequest | null {
  const requestId = id<VerificationRequestId>(field(wire, 'id'));
  const accountId = id<AppAccountId>(field(wire, 'user_id'));
  const idType = ID_TYPE_BY_WIRE[str(field(wire, 'id_type')) ?? ''] ?? null;
  const idFront = id<MediaId>(field(wire, 'id_front_media_id'));
  const selfie = id<MediaId>(field(wire, 'selfie_media_id'));
  const status = oneOf(field(wire, 'status'), VERIFICATION_STATUSES);
  const submittedAt = dateTime(field(wire, 'submitted_at'));

  if (
    requestId === null ||
    accountId === null ||
    idType === null ||
    idFront === null ||
    selfie === null ||
    status === null ||
    submittedAt === null
  ) {
    return null;
  }

  return {
    id: requestId,
    accountId,
    idType,
    images: {
      idFront,
      idBack: id<MediaId>(field(wire, 'id_back_media_id')),
      selfie,
    },
    selfieErasedAt: dateTime(field(wire, 'selfie_erased_at')),
    status,
    submittedAt,
    reviewedAt: dateTime(field(wire, 'reviewed_at')),
    residentMessage: str(field(wire, 'message')),
    reviewNote: str(field(wire, 'notes')),
    account:
      status === 'pending'
        ? {
            name: str(field(wire, 'account_name')),
            birthDate: date(field(wire, 'account_birthdate')),
          }
        : null,
  };
}

/** The domain's ID types back to the API's `snake_case`: `ID_TYPE_BY_WIRE`, the other way. */
const ID_TYPE_TO_WIRE: Readonly<Record<IdDocumentType, string>> = {
  philid: 'philid',
  'drivers-license': 'drivers_license',
  passport: 'passport',
  umid: 'umid',
  postal: 'postal',
  voters: 'voters',
  sss: 'sss',
  other: 'other',
};

/** `InPersonVerificationInput` at `5209f75`. Strict on the server: nothing else is accepted. */
export interface InPersonCheckWire {
  readonly idempotency_key: string;
  readonly id_type: string;
  readonly id_last_four: string;
  readonly confirmed_name: string;
  readonly id_shows_name: true;
  readonly corrected_name?: string;
}

/**
 * `InPersonCheck` → its wire body (`DL-219`). `id_shows_name` is the literal the API demands: the
 * button that sends it waited for the reviewer's tick. `corrected_name` is left out, never sent
 * empty, when the ID shows the account's name — the schema refuses an empty one. No image field
 * exists to fill: the operation takes none.
 */
export function toWireInPersonCheck(check: InPersonCheck, intent: WriteIntent): InPersonCheckWire {
  const body: InPersonCheckWire = {
    idempotency_key: intent.key,
    id_type: ID_TYPE_TO_WIRE[check.idType],
    id_last_four: check.idLastFour,
    confirmed_name: check.confirmedName,
    id_shows_name: true,
  };
  return check.correctedName === null ? body : { ...body, corrected_name: check.correctedName };
}

/**
 * `InPersonVerification` → the domain's (`DL-219`). Every field the screen uses is one the spec
 * requires, so a missing one is the API breaking its contract and the record is not readable.
 *
 * **Not read**: `id_last_four` (nothing here shows it again, and a screen that cannot receive it
 * cannot leak it) and `verified_by` (an account id nobody here can name; the server's audit trail
 * records who). `method` is checked to be `in-person` and otherwise not kept.
 *
 * @consumes POST admin/users/{id}/in-person-verifications
 */
export function toInPersonVerification(wire: unknown): InPersonVerification | null {
  const recordId = id<InPersonVerificationId>(field(wire, 'id'));
  const accountId = id<AppAccountId>(field(wire, 'user_id'));
  const idType = ID_TYPE_BY_WIRE[str(field(wire, 'id_type')) ?? ''] ?? null;
  const nameCorrected = flag(field(wire, 'name_corrected'));
  const verifiedAt = dateTime(field(wire, 'verified_at'));

  if (
    recordId === null ||
    accountId === null ||
    str(field(wire, 'method')) !== 'in-person' ||
    idType === null ||
    nameCorrected === null ||
    verifiedAt === null
  ) {
    return null;
  }

  return {
    id: recordId,
    accountId,
    idType,
    nameCorrected,
    supersededRequestId: id<VerificationRequestId>(field(wire, 'superseded_request_id')),
    verifiedAt,
  };
}

/** The API's names for the fields a counter check can be refused on, in the domain's terms. */
const IN_PERSON_FIELD_BY_WIRE: Readonly<Record<string, InPersonField>> = {
  id_type: 'idType',
  id_last_four: 'idLastFour',
  corrected_name: 'correctedName',
  id_shows_name: 'idShowsName',
};

/**
 * A 422's `details`, read as the form's fields: the first sentence the server gave for each field
 * the form has. A key the form has no field for is left out, and the refusal's message says it.
 */
export function toInPersonFieldErrors(
  details: Readonly<Record<string, readonly string[]>> | null,
): Partial<Record<InPersonField, string>> {
  const fields: Partial<Record<InPersonField, string>> = {};
  for (const [key, sentences] of Object.entries(details ?? {})) {
    const named = IN_PERSON_FIELD_BY_WIRE[key];
    const sentence = sentences[0];
    if (named !== undefined && sentence !== undefined) {
      fields[named] = sentence;
    }
  }
  return fields;
}
