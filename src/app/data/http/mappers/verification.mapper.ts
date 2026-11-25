import {
  ACCOUNT_LINK_DECISIONS,
  REGISTRY_MATCH_ATTRIBUTES,
  REGISTRY_MATCH_OUTCOMES,
  REGISTRY_MATCH_STRENGTHS,
  VERIFICATION_STATUSES,
  type AccountLinkCorrections,
  type AccountLinkDecision,
  type AccountLinkOutcome,
  type AppAccountId,
  type LinkCorrectedField,
  type ConfirmedIdentity,
  type IdDocumentType,
  type InPersonCheck,
  type InPersonField,
  type InPersonVerification,
  type InPersonVerificationId,
  type LaterLinkOutcome,
  type MediaId,
  type RegistryMatch,
  type RegistryMatches,
  type RegistryMatchSignal,
  type ResidentId,
  type VerificationQueueStats,
  type VerificationRequest,
  type VerificationRequestId,
  type WriteIntent,
} from '@domain/index';

import { date, dateTime, field, flag, id, int, oneOf, str } from './wire';

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
    registryOutcome: toAccountLinkOutcome(field(wire, 'account_link')),
  };
}

/**
 * `AccountLinkOutcome` → the domain's (`DL-228`): what an approval or a counter check decided about
 * the account's registry record. Absent, `null` or unreadable is "no decision recorded", which is
 * what every request decided before the API asked reads as. A part of the request and of the counter
 * check, read by their mappers, so it names no operation of its own.
 */
/**
 * `meta.stats` beside the queue's page (`DL-232`): every figure required, because a KPI row with a
 * guessed figure is worse than none. Never the number of rows in this page.
 *
 * @consumes GET admin/verification-requests
 */
export function toVerificationQueueStats(meta: unknown): VerificationQueueStats | null {
  const stats = field(meta, 'stats');
  const pending = int(field(stats, 'pending'));
  const rawOldest = field(stats, 'oldest_pending_at');
  const oldestPendingAt = rawOldest === null ? null : dateTime(rawOldest);
  const decided = field(stats, 'decided_7d');
  const approved = int(field(decided, 'approved'));
  const rejected = int(field(decided, 'rejected'));
  const daysWire = field(stats, 'sent_by_day');
  const days = Array.isArray(daysWire)
    ? daysWire.map((entry) => {
        const day = date(field(entry, 'date'));
        const count = int(field(entry, 'count'));
        return day === null || count === null || count < 0 ? null : { date: day, count };
      })
    : null;
  if (
    pending === null ||
    (rawOldest !== null && oldestPendingAt === null) ||
    approved === null ||
    rejected === null ||
    days === null ||
    days.some((day) => day === null)
  ) {
    return null;
  }
  return {
    pending,
    oldestPendingAt,
    decided7d: { approved, rejected },
    sentByDay: days.filter((day): day is NonNullable<typeof day> => day !== null),
  };
}

export function toAccountLinkOutcome(wire: unknown): AccountLinkOutcome | null {
  const decision = oneOf(field(wire, 'decision'), ACCOUNT_LINK_DECISIONS);
  if (decision === null) {
    return null;
  }
  return { decision, residentId: id<ResidentId>(field(wire, 'resident_id')) };
}

/** `AccountLinkInput`, strict on the server: one of three shapes, nothing else. */
export type AccountLinkWire =
  | {
      readonly decision: 'link';
      readonly resident_id: string;
      readonly reason: string;
      readonly corrections?: AccountLinkCorrectionsWire;
    }
  | {
      readonly decision: 'create';
      readonly record: AccountLinkRecordWire;
      readonly reason?: string;
    }
  | { readonly decision: 'leave-unlinked'; readonly reason: string };

/** `AccountLinkInput.corrections` (`DL-260`): only what the reviewer chose to correct. */
export interface AccountLinkCorrectionsWire {
  readonly name?: {
    readonly first_name: string;
    readonly middle_name: string | null;
    readonly last_name: string;
    readonly suffix: string | null;
  };
  readonly sex?: 'female' | 'male';
  readonly birth_date?: string;
}

function toWireLinkCorrections(corrections: AccountLinkCorrections): AccountLinkCorrectionsWire {
  const name = corrections.name;
  return {
    ...(name === undefined
      ? {}
      : {
          name: {
            first_name: name.firstName,
            middle_name: name.middleName,
            last_name: name.lastName,
            suffix: name.suffix,
          },
        }),
    ...(corrections.sex === undefined ? {} : { sex: corrections.sex }),
    ...(corrections.birthDate === undefined ? {} : { birth_date: corrections.birthDate }),
  };
}

export interface AccountLinkRecordWire {
  readonly first_name: string;
  readonly middle_name: string | null;
  readonly last_name: string;
  readonly suffix: string | null;
  readonly sex?: 'female' | 'male';
  readonly birth_date?: string;
  readonly civil_status: string;
  readonly street_address?: string;
}

/**
 * The reviewer's decision → `AccountLinkInput`. A sex, birth date or street left to the account is
 * left out rather than sent `null` — the schema takes none — and so is an empty reason on `create`.
 */
export function toWireAccountLink(link: AccountLinkDecision): AccountLinkWire {
  switch (link.decision) {
    case 'link':
      return link.corrections === undefined
        ? { decision: 'link', resident_id: link.residentId, reason: link.reason }
        : {
            decision: 'link',
            resident_id: link.residentId,
            reason: link.reason,
            corrections: toWireLinkCorrections(link.corrections),
          };
    case 'leave-unlinked':
      return { decision: 'leave-unlinked', reason: link.reason };
    case 'create': {
      const record = link.record;
      const wire: AccountLinkRecordWire = {
        first_name: record.firstName,
        middle_name: record.middleName,
        last_name: record.lastName,
        suffix: record.suffix,
        civil_status: record.civilStatus,
        ...(record.sex === null ? {} : { sex: record.sex }),
        ...(record.birthDate === null ? {} : { birth_date: record.birthDate }),
        ...(record.streetAddress === null ? {} : { street_address: record.streetAddress }),
      };
      return link.reason === null
        ? { decision: 'create', record: wire }
        : { decision: 'create', record: wire, reason: link.reason };
    }
  }
}

/** `AccountRegistryLinkBody` (`DL-260`): a link made after the account was verified. */
export interface LaterLinkWire {
  readonly account_link: AccountLinkWire;
  readonly id_checked: true;
}

export function toWireLaterLink(link: AccountLinkDecision): LaterLinkWire {
  return { account_link: toWireAccountLink(link), id_checked: true };
}

/** The record's columns as the API names them in `corrected`, in the domain's words. */
const CORRECTED_FIELD_BY_WIRE: Readonly<Record<string, LinkCorrectedField>> = {
  first_name: 'firstName',
  middle_name: 'middleName',
  last_name: 'lastName',
  suffix: 'suffix',
  sex: 'sex',
  birth_date: 'birthDate',
};

/** `AccountRegistryLinkEnvelope.data`: the link, and the record fields it corrected. */
export function toLaterLinkOutcome(wire: unknown): LaterLinkOutcome | null {
  const link = toAccountLinkOutcome(field(wire, 'account_link'));
  const corrected = field(wire, 'corrected');
  if (link === null || !Array.isArray(corrected)) {
    return null;
  }
  const fields = corrected.map((entry: unknown) =>
    typeof entry === 'string' ? (CORRECTED_FIELD_BY_WIRE[entry] ?? null) : null,
  );
  if (fields.some((entry) => entry === null)) {
    return null;
  }
  return { link, corrected: fields.filter((entry): entry is LinkCorrectedField => entry !== null) };
}

/** `VerificationApproval`: what the reviewer checked, sent back as read (`DL-197`), and the link. */
export interface VerificationApprovalWire {
  readonly notes: string;
  readonly confirmed_name: string;
  readonly confirmed_birthdate: string | null;
  readonly account_link?: AccountLinkWire;
}

export function toWireVerificationApproval(
  note: string,
  confirmed: ConfirmedIdentity,
  accountLink: AccountLinkDecision | null,
): VerificationApprovalWire {
  const body: VerificationApprovalWire = {
    notes: note,
    confirmed_name: confirmed.name,
    confirmed_birthdate: confirmed.birthDate,
  };
  return accountLink === null ? body : { ...body, account_link: toWireAccountLink(accountLink) };
}

function toRegistrySignal(wire: unknown): RegistryMatchSignal | null {
  const attribute = oneOf(field(wire, 'attribute'), REGISTRY_MATCH_ATTRIBUTES);
  const outcome = oneOf(field(wire, 'outcome'), REGISTRY_MATCH_OUTCOMES);
  const rule = str(field(wire, 'rule'));
  return attribute === null || outcome === null || rule === null
    ? null
    : { attribute, outcome, rule };
}

function toRegistryMatch(wire: unknown): RegistryMatch | null {
  const residentId = id<ResidentId>(field(wire, 'resident_id'));
  const label = str(field(wire, 'label'));
  const strength = oneOf(field(wire, 'strength'), REGISTRY_MATCH_STRENGTHS);
  const held = flag(field(wire, 'linked_to_other_account'));
  const signalsWire = field(wire, 'signals');
  if (
    residentId === null ||
    label === null ||
    strength === null ||
    held === null ||
    !Array.isArray(signalsWire)
  ) {
    return null;
  }
  const signals: RegistryMatchSignal[] = [];
  for (const item of signalsWire) {
    const signal = toRegistrySignal(item);
    if (signal === null) {
      return null;
    }
    signals.push(signal);
  }
  return { residentId, label, strength, signals, linkedToOtherAccount: held };
}

/**
 * `GET admin/users/{id}/registry-matches` → the domain's (`DL-228`). Read **whole or not at all**:
 * a proposal quietly dropped is a record the reviewer never weighed, so one unreadable match refuses
 * the answer. Nothing here carries a value — the server sends none (`DL-73`).
 *
 * @consumes GET admin/users/{id}/registry-matches
 */
export function toRegistryProposals(wire: unknown): RegistryMatches | null {
  const accountId = id<AppAccountId>(field(wire, 'user_id'));
  const matchesWire = field(wire, 'matches');
  const linked = field(wire, 'linked_resident_id');
  const linkedResidentId = id<ResidentId>(linked);
  if (
    accountId === null ||
    !Array.isArray(matchesWire) ||
    (linked !== null && linkedResidentId === null)
  ) {
    return null;
  }
  const matches: RegistryMatch[] = [];
  for (const item of matchesWire) {
    const match = toRegistryMatch(item);
    if (match === null) {
      return null;
    }
    matches.push(match);
  }
  return { accountId, linkedResidentId, matches };
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
  readonly account_link?: AccountLinkWire;
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
  const named =
    check.correctedName === null ? body : { ...body, corrected_name: check.correctedName };
  return check.accountLink === null
    ? named
    : { ...named, account_link: toWireAccountLink(check.accountLink) };
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
    registryOutcome: toAccountLinkOutcome(field(wire, 'account_link')),
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

/** The server's sentences for fields the counter form does not have, such as the link's (DL-260). */
export function inPersonUnplacedErrors(
  details: Readonly<Record<string, readonly string[]>> | null,
): readonly string[] {
  return Object.entries(details ?? {})
    .filter(([key]) => IN_PERSON_FIELD_BY_WIRE[key] === undefined)
    .flatMap(([, sentences]) => sentences.slice(0, 1));
}
