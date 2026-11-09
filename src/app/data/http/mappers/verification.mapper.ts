import {
  VERIFICATION_STATUSES,
  type AppAccountId,
  type IdDocumentType,
  type MediaId,
  type VerificationRequest,
  type VerificationRequestId,
} from '@domain/index';

import { date, dateTime, field, id, oneOf, str } from './wire';

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
 * | `status`             | `status`            | the record is not readable     |
 * | `submitted_at`       | `submittedAt`       | the record is not readable     |
 * | `reviewed_at`        | `reviewedAt`        | not reviewed                   |
 * | `message`            | `residentMessage`   | the resident wrote nothing     |
 * | `notes`              | `reviewNote`        | no note                        |
 * | `account_name`       | `account.name`      | the account gives no name      |
 * | `account_birthdate`  | `account.birthDate` | the account holds no birth date |
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
