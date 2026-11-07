import {
  ISSUANCE_MIME_TYPES,
  ISSUANCE_STATUSES,
  type AppAccountId,
  type IsoDateTime,
  type IssuanceAttachment,
  type IssuanceAttachmentId,
  type IssuanceEvent,
  type IssuanceEventId,
  type IssuanceFileGrant,
  type IssuanceMove,
  type IssuanceOfficeRef,
  type IssuanceRequest,
  type IssuanceRequestId,
  type IssuanceRequestSummary,
  type IssuanceRequirement,
  type IssuanceType,
  type IssuanceTypeChanges,
  type IssuanceTypeDraft,
  type IssuanceTypeId,
  type Money,
  type OfficeId,
} from '@domain/index';

import { bool, dateTime, field, flag, id, int, list, oneOf, str } from './wire';

/*
 * Residents' document requests (`DL-184`), read by name against the vendored spec at
 * `taytay-backend` `2fd0566`. "Issuance" on the wire and in code; "document request" on screen.
 *
 * Every field a record cannot be read without is one the spec marks required, so a `null` here is
 * the API breaking its own contract — and the adapter refuses the answer rather than quietly showing
 * one fewer request somebody is waiting on.
 *
 * Not read anywhere: `status_label` (the console's catalogue names every status, rule 7),
 * `accepts` (what the residents' app may upload — this console uploads nothing), `office.slug`,
 * `created_at` on a type, and the resident view's `needs_info_message`, `can_cancel`,
 * `can_resubmit`, which the office view does not carry.
 */

/**
 * `IssuanceType` → `IssuanceType`.
 *
 * | wire                 | domain              | if absent                      |
 * | -------------------- | ------------------- | ------------------------------ |
 * | `id`                 | `id`                | the type is not readable       |
 * | `office.id`, `.name` | `office`            | the type is not readable       |
 * | `name`               | `name`              | the type is not readable       |
 * | `description`        | `description`       | none                           |
 * | `requirements`       | `requirements`      | none asked for                 |
 * | `fee_centavos`       | `fee` (centavos)    | no fee stated                  |
 * | `processing_days`    | `processingDays`    | not stated                     |
 * | `claim_instructions` | `claimInstructions` | none                           |
 * | `active`             | `active`            | the type is not readable       |
 * | `retired_at`         | `retiredAt`         | not retired                    |
 * | `updated_at`         | `updatedAt`         | the type is not readable       |
 *
 * @consumes GET issuance-types
 * @consumes GET office/issuance-types
 * @consumes POST office/issuance-types
 * @consumes PATCH office/issuance-types/{id}
 * @consumes POST office/issuance-types/{id}/retire
 */
export function toIssuanceType(wire: unknown): IssuanceType | null {
  const typeId = id<IssuanceTypeId>(field(wire, 'id'));
  const office = officeRef(field(wire, 'office'));
  const name = str(field(wire, 'name'));
  const active = flag(field(wire, 'active'));
  const updatedAt = dateTime(field(wire, 'updated_at'));

  if (
    typeId === null ||
    office === null ||
    name === null ||
    active === null ||
    updatedAt === null
  ) {
    return null;
  }

  return {
    id: typeId,
    office,
    name,
    description: str(field(wire, 'description')),
    requirements: list(field(wire, 'requirements'), requirement),
    fee: fee(field(wire, 'fee_centavos')),
    processingDays: int(field(wire, 'processing_days')),
    claimInstructions: str(field(wire, 'claim_instructions')),
    active,
    retiredAt: dateTime(field(wire, 'retired_at')),
    updatedAt,
  };
}

/**
 * `OfficeIssuanceRequestSummary` → `IssuanceRequestSummary`: a list row. It carries no `purpose`,
 * and the console would not read one if it did.
 *
 * | wire                    | domain           | if absent                    |
 * | ----------------------- | ---------------- | ---------------------------- |
 * | `id`                    | `id`             | the row is not readable      |
 * | `reference_number`      | `referenceNumber`| the row is not readable      |
 * | `status`                | `status`         | the row is not readable      |
 * | `type.id`, `.name`      | `type`           | the row is not readable      |
 * | `office.id`, `.name`    | `office`         | the row is not readable      |
 * | `resident.id`           | `resident`       | the row is not readable      |
 * | `resident.name`         | `resident.name`  | no name given                |
 * | `created_at`            | `filedAt`        | the row is not readable      |
 * | `updated_at`            | `statusSince`    | the row is not readable      |
 *
 * `updated_at` is the time of the request's last event: the database moves a request only by
 * appending one, and sets `updated_at` from it (`0035_issuance.sql`), so it is when the request
 * entered its current status.
 *
 * @consumes GET office/issuance-requests
 */
export function toIssuanceRequestSummary(wire: unknown): IssuanceRequestSummary | null {
  const requestId = id<IssuanceRequestId>(field(wire, 'id'));
  const referenceNumber = str(field(wire, 'reference_number'));
  const status = oneOf(field(wire, 'status'), ISSUANCE_STATUSES);
  const type = typeRef(field(wire, 'type'));
  const office = officeRef(field(wire, 'office'));
  const resident = field(wire, 'resident');
  const accountId = id<AppAccountId>(field(resident, 'id'));
  const filedAt = dateTime(field(wire, 'created_at'));
  const statusSince = dateTime(field(wire, 'updated_at'));

  if (
    requestId === null ||
    referenceNumber === null ||
    status === null ||
    type === null ||
    office === null ||
    accountId === null ||
    filedAt === null ||
    statusSince === null
  ) {
    return null;
  }

  return {
    id: requestId,
    referenceNumber,
    status,
    type,
    office,
    resident: { accountId, name: str(field(resident, 'name')) },
    filedAt,
    statusSince,
  };
}

/**
 * `OfficeIssuanceRequest` → `IssuanceRequest`: the row's fields, and
 *
 * | wire                 | domain              | if absent                      |
 * | -------------------- | ------------------- | ------------------------------ |
 * | `purpose`            | `purpose`           | the request is not readable    |
 * | `fee_centavos`       | `fee` (centavos)    | no fee stated                  |
 * | `processing_days`    | `processingDays`    | not stated                     |
 * | `claim_instructions` | `claimInstructions` | none                           |
 * | `requirements`       | `requirements`      | none asked for                 |
 * | `attachments`        | `attachments`       | none sent                      |
 * | `claim_details`      | `claimDetails`      | not yet said                   |
 * | `history`            | `history`           | the request is not readable    |
 * | `allowed_moves`      | `allowedMoves`      | none                           |
 *
 * A history line the console cannot read refuses the request: a history missing a move is a
 * record that tells the office something untrue about what happened.
 *
 * @consumes GET office/issuance-requests/{id}
 * @consumes POST office/issuance-requests/{id}/status
 */
export function toIssuanceRequest(wire: unknown): IssuanceRequest | null {
  const summary = toIssuanceRequestSummary(wire);
  const purpose = str(field(wire, 'purpose'));
  const history = wholeHistory(field(wire, 'history'));

  if (summary === null || purpose === null || history === null) {
    return null;
  }

  return {
    ...summary,
    purpose,
    fee: fee(field(wire, 'fee_centavos')),
    processingDays: int(field(wire, 'processing_days')),
    claimInstructions: str(field(wire, 'claim_instructions')),
    requirements: list(field(wire, 'requirements'), requirement),
    attachments: list(field(wire, 'attachments'), attachment),
    claimDetails: str(field(wire, 'claim_details')),
    history,
    allowedMoves: list(field(wire, 'allowed_moves'), (move) => oneOf(move, ISSUANCE_STATUSES)),
  };
}

/**
 * `IssuanceFileGrant` → `IssuanceFileGrant`. The handle is held in memory for the minutes it
 * lives, and sent back in a body.
 *
 * @consumes POST office/issuance-requests/{id}/attachments/{attachmentId}/access
 */
export function toIssuanceFileGrant(wire: unknown): IssuanceFileGrant | null {
  const attachmentId = id<IssuanceAttachmentId>(field(wire, 'attachment_id'));
  const fileName = str(field(wire, 'file_name'));
  const mimeType = oneOf(field(wire, 'mime_type'), ISSUANCE_MIME_TYPES);
  const handle = str(field(wire, 'handle'));
  const expiresAt = dateTime(field(wire, 'expires_at'));
  const warning = str(field(wire, 'warning'));

  if (
    attachmentId === null ||
    fileName === null ||
    mimeType === null ||
    handle === null ||
    expiresAt === null ||
    warning === null
  ) {
    return null;
  }

  return { attachmentId, fileName, mimeType, handle, expiresAt, warning };
}

/* ── what the console sends ───────────────────────────────────────────────── */

/** `IssuanceRequirementInput`. */
export interface IssuanceRequirementWire {
  readonly code: string;
  readonly label: string;
  readonly required: boolean;
  readonly hint: string | null;
}

/** `IssuanceTypeCreate`: `office_id` only when an administrator chose one; staff send their own. */
export interface IssuanceTypeCreateWire {
  readonly office_id: string | undefined;
  readonly name: string;
  readonly description: string | null;
  readonly requirements: readonly IssuanceRequirementWire[];
  readonly fee_centavos: number | null;
  readonly processing_days: number | null;
  readonly claim_instructions: string | null;
  readonly reason: string;
}

export function toWireIssuanceTypeCreate(draft: IssuanceTypeDraft): IssuanceTypeCreateWire {
  return {
    office_id: draft.officeId ?? undefined,
    name: draft.name.trim(),
    description: draft.description,
    requirements: draft.requirements.map(toWireRequirement),
    fee_centavos: draft.fee?.centavos ?? null,
    processing_days: draft.processingDays,
    claim_instructions: draft.claimInstructions,
    reason: draft.reason.trim(),
  };
}

/**
 * `IssuanceTypeUpdate`: only what moved travels. `undefined` is left out of the body; `null` is
 * sent, because clearing a fee or a description is a change.
 */
export interface IssuanceTypeUpdateWire {
  readonly name: string | undefined;
  readonly description: string | null | undefined;
  readonly requirements: readonly IssuanceRequirementWire[] | undefined;
  readonly fee_centavos: number | null | undefined;
  readonly processing_days: number | null | undefined;
  readonly claim_instructions: string | null | undefined;
  readonly reason: string;
}

export function toWireIssuanceTypeUpdate(changes: IssuanceTypeChanges): IssuanceTypeUpdateWire {
  return {
    name: changes.name?.trim(),
    description: changes.description,
    requirements: changes.requirements?.map(toWireRequirement),
    fee_centavos: changes.fee === undefined ? undefined : (changes.fee?.centavos ?? null),
    processing_days: changes.processingDays,
    claim_instructions: changes.claimInstructions,
    reason: changes.reason.trim(),
  };
}

/** `IssuanceTypeRetire`. */
export interface IssuanceTypeRetireWire {
  readonly reason: string;
}

export function toWireIssuanceTypeRetire(reason: string): IssuanceTypeRetireWire {
  return { reason: reason.trim() };
}

/** `IssuanceStatusChange`: claim details only with `ready-for-pickup`, which the API refuses otherwise. */
export interface IssuanceStatusChangeWire {
  readonly to: string;
  readonly reason: string;
  readonly claim_details: string | undefined;
}

export function toWireIssuanceStatusChange(move: IssuanceMove): IssuanceStatusChangeWire {
  return {
    to: move.to,
    reason: move.reason.trim(),
    claim_details: move.claimDetails?.trim() ?? undefined,
  };
}

/** `OfficeDocumentFileRequest`, at `office/issuance-files`. */
export interface IssuanceFileRequestWire {
  readonly handle: string;
}

export function toWireIssuanceFileRequest(grant: IssuanceFileGrant): IssuanceFileRequestWire {
  return { handle: grant.handle };
}

/* ── parts ────────────────────────────────────────────────────────────────── */

function toWireRequirement(requirement: IssuanceRequirement): IssuanceRequirementWire {
  return {
    code: requirement.code,
    label: requirement.label.trim(),
    required: requirement.required,
    hint: blankToNull(requirement.hint),
  };
}

function blankToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
}

function officeRef(wire: unknown): IssuanceOfficeRef | null {
  const officeId = id<OfficeId>(field(wire, 'id'));
  const name = str(field(wire, 'name'));
  return officeId === null || name === null ? null : { id: officeId, name };
}

function typeRef(wire: unknown): IssuanceRequestSummary['type'] | null {
  const typeId = id<IssuanceTypeId>(field(wire, 'id'));
  const name = str(field(wire, 'name'));
  return typeId === null || name === null ? null : { id: typeId, name };
}

function fee(wire: unknown): Money | null {
  const centavos = int(wire);
  return centavos === null ? null : { centavos, currency: 'PHP' };
}

function requirement(wire: unknown): IssuanceRequirement | null {
  const code = str(field(wire, 'code'));
  const label = str(field(wire, 'label'));
  return code === null || label === null
    ? null
    : { code, label, required: bool(field(wire, 'required')), hint: str(field(wire, 'hint')) };
}

function attachment(wire: unknown): IssuanceAttachment | null {
  const attachmentId = id<IssuanceAttachmentId>(field(wire, 'id'));
  const requirementCode = str(field(wire, 'requirement_code'));
  const version = int(field(wire, 'version'));
  const mimeType = oneOf(field(wire, 'mime_type'), ISSUANCE_MIME_TYPES);
  const byteSize = int(field(wire, 'byte_size'));
  const sentAt = dateTime(field(wire, 'created_at'));
  if (
    attachmentId === null ||
    requirementCode === null ||
    version === null ||
    mimeType === null ||
    byteSize === null ||
    sentAt === null
  ) {
    return null;
  }
  return {
    id: attachmentId,
    requirementCode,
    version,
    mimeType,
    byteSize,
    current: bool(field(wire, 'current')),
    sentAt,
  };
}

/** Every line, or `null`: a history missing a move tells the office something untrue. */
function wholeHistory(wire: unknown): readonly IssuanceEvent[] | null {
  if (!Array.isArray(wire)) {
    return null;
  }
  const lines = list(wire, historyLine);
  return lines.length === wire.length ? lines : null;
}

function historyLine(wire: unknown): IssuanceEvent | null {
  const eventId = id<IssuanceEventId>(field(wire, 'id'));
  const to = oneOf(field(wire, 'to_status'), ISSUANCE_STATUSES);
  const side = oneOf(field(wire, 'actor_side'), ['resident', 'office'] as const);
  const actorId = str(field(wire, 'actor_id'));
  const at: IsoDateTime | null = dateTime(field(wire, 'at'));
  if (eventId === null || to === null || side === null || actorId === null || at === null) {
    return null;
  }
  return {
    id: eventId,
    from: oneOf(field(wire, 'from_status'), ISSUANCE_STATUSES),
    to,
    side,
    actorId,
    reason: str(field(wire, 'reason')),
    claimDetails: str(field(wire, 'claim_details')),
    at,
  };
}
