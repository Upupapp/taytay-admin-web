import {
  ACKNOWLEDGEMENT_KIND_LABELS,
  DEFERRAL_REASON_LABELS,
  PAYOUT_METHOD_LABELS,
  RELEASE_KIND_LABELS,
  RELEASE_STATUS_CATALOG,
  centavos,
  type AcknowledgementKind,
  type AssistanceRequestId,
  type DeferralReason,
  type IsoDate,
  type ManifestLine,
  type PayoutMethod,
  type Release,
  type ReleaseAcknowledgement,
  type ReleaseAcknowledgementDraft,
  type ReleaseBatch,
  type ReleaseBatchDraft,
  type ReleaseBatchId,
  type ReleaseDraft,
  type ReleaseId,
  type ReleaseKind,
  type ReleaseManifest,
  type ReleaseStatus,
  type ResidentId,
  type StaffUserId,
  type WriteIntent,
} from '@domain/index';

import { date, dateTime, field, id, int, list, oneOf, str } from './wire';

/**
 * Releases and payout sessions, from `office/releases` and `office/release-batches` (`DL-180`).
 *
 * Money arrives as integer centavos and stays integer centavos; an in-kind release arrives with no
 * amount and is read with none (`DL-93`). Every body a money write sends carries the intent's key,
 * `idempotency_key`, in the body — the API's CORS policy allows four request headers and is not
 * widened for it — so a retry of the same act replays the first answer and never pays twice.
 *
 * | Wire                         | Domain                   | Absent / unreadable                   |
 * | ---------------------------- | ------------------------ | ------------------------------------- |
 * | `amount_centavos`            | `amount` (`Money`)       | null: goods, which are never valued   |
 * | `acknowledgement`            | `acknowledgement`        | null: nobody has signed               |
 * | `progress`                   | `progress` (counts)      | the session is not shown              |
 * | `acknowledgement_kind` (line)| `acknowledgementKind`    | always null: blank on purpose         |
 */

/** The server's minimum for a status move's reason; shorter is refused before anything is sent. */
export const RELEASE_REASON_MIN_LENGTH = 8;

const STATUSES = Object.keys(RELEASE_STATUS_CATALOG) as ReleaseStatus[];
const KINDS = Object.keys(RELEASE_KIND_LABELS) as ReleaseKind[];
const METHODS = Object.keys(PAYOUT_METHOD_LABELS) as PayoutMethod[];
const REASONS = Object.keys(DEFERRAL_REASON_LABELS) as DeferralReason[];
const RECEIPTS = Object.keys(ACKNOWLEDGEMENT_KIND_LABELS) as AcknowledgementKind[];

function toAcknowledgement(wire: unknown): ReleaseAcknowledgement | null {
  const kind = oneOf(field(wire, 'kind'), RECEIPTS);
  const acknowledgedAt = dateTime(field(wire, 'acknowledged_at'));
  if (kind === null || acknowledgedAt === null) {
    return null;
  }
  return {
    kind,
    acknowledgedAt,
    collectedBy: str(field(wire, 'collected_by')),
    authority: str(field(wire, 'authority')),
  };
}

/**
 * One release. `null` when a field it cannot do without is missing or out of vocabulary, or when
 * what it says it is does not match what it carries — a money release with no amount is not read as
 * a release of nothing.
 *
 * @consumes GET office/releases
 * @consumes GET office/releases/queue
 * @consumes GET office/releases/{id}
 */
export function toRelease(wire: unknown): Release | null {
  const releaseId = id<ReleaseId>(field(wire, 'id'));
  const requestId = id<AssistanceRequestId>(field(wire, 'request_id'));
  const residentId = id<ResidentId>(field(wire, 'resident_id'));
  const referenceNumber = str(field(wire, 'reference_number'));
  const status = oneOf(field(wire, 'status'), STATUSES);
  const kind = oneOf(field(wire, 'kind'), KINDS);
  const method = oneOf(field(wire, 'method'), METHODS);
  const createdAt = dateTime(field(wire, 'created_at'));
  const updatedAt = dateTime(field(wire, 'updated_at'));
  const amount = int(field(wire, 'amount_centavos'));
  const goods = str(field(wire, 'in_kind_description'));

  if (
    releaseId === null ||
    requestId === null ||
    residentId === null ||
    referenceNumber === null ||
    status === null ||
    kind === null ||
    method === null ||
    createdAt === null ||
    updatedAt === null ||
    (kind === 'money' && amount === null) ||
    (kind === 'in-kind' && (amount !== null || goods === null))
  ) {
    return null;
  }

  const acknowledgementWire = field(wire, 'acknowledgement');
  const acknowledgement =
    acknowledgementWire === null || acknowledgementWire === undefined
      ? null
      : toAcknowledgement(acknowledgementWire);

  return {
    id: releaseId,
    requestId,
    residentId,
    referenceNumber,
    status,
    method,
    kind,
    amount: kind === 'money' && amount !== null ? centavos(amount) : null,
    inKindDescription: kind === 'in-kind' ? goods : null,
    fundingSourceLabel: str(field(wire, 'funding_source_label')),
    approvingReference: str(field(wire, 'approving_reference')),
    approvedBy: id<StaffUserId>(field(wire, 'approved_by')),
    batchId: id<ReleaseBatchId>(field(wire, 'batch_id')),
    scheduledFor: date(field(wire, 'scheduled_for')),
    releasedAt: dateTime(field(wire, 'released_at')),
    releasedBy: id<StaffUserId>(field(wire, 'released_by')),
    acknowledgedAt: acknowledgement?.acknowledgedAt ?? null,
    acknowledgement,
    deferralReason: oneOf(field(wire, 'deferral_reason'), REASONS),
    instrumentReference: str(field(wire, 'instrument_reference')),
    remarks: str(field(wire, 'remarks')),
    audit: {
      createdAt,
      createdBy: id<StaffUserId>(field(wire, 'created_by')),
      updatedAt,
      updatedBy: id<StaffUserId>(field(wire, 'updated_by')),
    },
  };
}

/** Who approved the request behind a release, as the server read it from the request's history. */
export function toReleaseApprover(wire: unknown): StaffUserId | null {
  return id<StaffUserId>(field(wire, 'approved_by'));
}

/**
 * One payout session, with its members counted by the server as they stand. No status: there is
 * none to read (`DL-90`).
 *
 * @consumes GET office/release-batches
 * @consumes GET office/release-batches/{id}
 */
export function toReleaseBatch(wire: unknown): ReleaseBatch | null {
  const batchId = id<ReleaseBatchId>(field(wire, 'id'));
  const referenceNumber = str(field(wire, 'reference_number'));
  const title = str(field(wire, 'title'));
  const scheduledFor = date(field(wire, 'scheduled_for'));
  const venue = str(field(wire, 'venue'));
  const officerId = id<StaffUserId>(field(wire, 'officer_id'));
  const createdAt = dateTime(field(wire, 'created_at'));
  const progress = field(wire, 'progress');
  const counts = {
    total: int(field(progress, 'total')),
    released: int(field(progress, 'released')),
    acknowledged: int(field(progress, 'acknowledged')),
    outstanding: int(field(progress, 'outstanding')),
    // `deferred` on the wire still holds both, for older clients; these are the two apart (`DL-186`).
    deferredOnly: int(field(progress, 'deferred_only')),
    unclaimed: int(field(progress, 'unclaimed')),
    needsCorrection: int(field(progress, 'needs_correction')),
    releasedTotal: int(field(progress, 'released_total_centavos')),
  };

  if (
    batchId === null ||
    referenceNumber === null ||
    title === null ||
    scheduledFor === null ||
    venue === null ||
    officerId === null ||
    createdAt === null ||
    counts.total === null ||
    counts.released === null ||
    counts.acknowledged === null ||
    counts.outstanding === null ||
    counts.deferredOnly === null ||
    counts.unclaimed === null ||
    counts.needsCorrection === null ||
    counts.releasedTotal === null
  ) {
    return null;
  }

  return {
    id: batchId,
    referenceNumber,
    title,
    scheduledFor,
    venue,
    officerId,
    releaseIds: list(field(wire, 'release_ids'), (entry) => id<ReleaseId>(entry)),
    progress: {
      total: counts.total,
      released: counts.released,
      acknowledged: counts.acknowledged,
      outstanding: counts.outstanding,
      // The office's failing and nobody's, counted apart by the server (`DL-94`, `DL-186`).
      deferred: counts.deferredOnly,
      unclaimed: counts.unclaimed,
      needsCorrection: counts.needsCorrection,
      totalReleased: centavos(counts.releasedTotal),
    },
    notes: str(field(wire, 'notes')),
    // The API keeps no close of a session: closing would say nothing about who was paid (`DL-90`).
    closedAt: null,
    audit: {
      createdAt,
      createdBy: id<StaffUserId>(field(wire, 'created_by')),
      updatedAt: createdAt,
      updatedBy: id<StaffUserId>(field(wire, 'created_by')),
    },
  };
}

function toManifestLine(wire: unknown): ManifestLine | null {
  const position = int(field(wire, 'position'));
  const beneficiaryName = str(field(wire, 'beneficiary_name'));
  const maskedReference = str(field(wire, 'masked_reference'));
  const kind = oneOf(field(wire, 'kind'), KINDS);
  const method = oneOf(field(wire, 'method'), METHODS);
  const amount = int(field(wire, 'amount_centavos'));
  if (
    position === null ||
    beneficiaryName === null ||
    maskedReference === null ||
    kind === null ||
    method === null ||
    (kind === 'money' && amount === null)
  ) {
    return null;
  }
  return {
    position,
    beneficiaryName,
    maskedReference,
    kind,
    amount: kind === 'money' && amount !== null ? centavos(amount) : null,
    goods: kind === 'in-kind' ? str(field(wire, 'goods')) : null,
    method,
    // Blank on purpose, whatever arrived: pre-filling it is how a sheet comes back signed for
    // somebody who was never there (`DL-92`).
    acknowledgementKind: null,
  };
}

/**
 * The payout list, composed by the server (`DL-92`). `null` when any line cannot be read: a list
 * with a person missing is one somebody is turned away from.
 *
 * @consumes GET office/release-batches/{id}/manifest
 */
export function toReleaseManifest(wire: unknown): ReleaseManifest | null {
  const batchReference = str(field(wire, 'batch_reference'));
  const title = str(field(wire, 'title'));
  const scheduledFor = date(field(wire, 'scheduled_for'));
  const venue = str(field(wire, 'venue'));
  const preparedAt = dateTime(field(wire, 'prepared_at'));
  const handlingNotice = str(field(wire, 'handling_notice'));
  const moneyLineCount = int(field(wire, 'money_line_count'));
  const inKindLineCount = int(field(wire, 'in_kind_line_count'));
  const moneyTotal = int(field(wire, 'money_total_centavos'));
  const rawLines = field(wire, 'lines');
  const lines = Array.isArray(rawLines) ? rawLines.map(toManifestLine) : null;

  if (
    batchReference === null ||
    title === null ||
    scheduledFor === null ||
    venue === null ||
    preparedAt === null ||
    handlingNotice === null ||
    moneyLineCount === null ||
    inKindLineCount === null ||
    moneyTotal === null ||
    lines === null ||
    lines.some((line) => line === null)
  ) {
    return null;
  }

  return {
    batchReference,
    title,
    scheduledFor,
    venue,
    officerName: str(field(wire, 'officer_name')) ?? 'Releasing officer',
    lines: lines.filter((line): line is ManifestLine => line !== null),
    moneyLineCount,
    inKindLineCount,
    moneyTotal: centavos(moneyTotal),
    preparedAt,
    handlingNotice,
  };
}

/* ── what each money write sends ──────────────────────────────────────────────────────────── */

/** What `POST office/releases` reads (`OfficeReleasePrepare`). */
export interface ReleasePrepareWire {
  readonly request_id: string;
  readonly kind: ReleaseKind;
  readonly method: PayoutMethod;
  readonly amount_centavos: number | null;
  readonly in_kind_description: string | null;
  readonly funding_source_label: string | null;
  readonly approving_reference: string | null;
  readonly remarks: string | null;
  readonly idempotency_key: string;
}

const trimmedOrNull = (value: string | null): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
};

export function toWireReleasePrepare(draft: ReleaseDraft, intent: WriteIntent): ReleasePrepareWire {
  return {
    request_id: draft.requestId,
    kind: draft.kind,
    method: draft.method,
    // Integer centavos as the domain holds them: never pesos, never a decimal point.
    amount_centavos: draft.kind === 'money' ? (draft.amount?.centavos ?? null) : null,
    in_kind_description: draft.kind === 'in-kind' ? trimmedOrNull(draft.inKindDescription) : null,
    funding_source_label: trimmedOrNull(draft.fundingSourceLabel),
    approving_reference: trimmedOrNull(draft.approvingReference),
    remarks: trimmedOrNull(draft.remarks),
    idempotency_key: intent.key,
  };
}

/** What `POST office/release-batches` reads (`OfficeReleaseBatchOpen`). The officer is the sender. */
export interface ReleaseBatchOpenWire {
  readonly title: string;
  readonly scheduled_for: IsoDate;
  readonly venue: string;
  readonly notes: string | null;
  readonly release_ids: readonly string[];
  readonly idempotency_key: string;
}

export function toWireReleaseBatchOpen(
  draft: ReleaseBatchDraft,
  intent: WriteIntent,
): ReleaseBatchOpenWire {
  return {
    title: draft.title.trim(),
    scheduled_for: draft.scheduledFor,
    venue: draft.venue.trim(),
    notes: trimmedOrNull(draft.notes),
    release_ids: [...draft.releaseIds],
    idempotency_key: intent.key,
  };
}

/** What `POST office/releases/{id}/release` reads (`OfficeReleaseHandOver`). */
export interface ReleaseHandOverWire {
  readonly instrument_reference: string | null;
  readonly remarks: string | null;
  readonly idempotency_key: string;
}

export function toWireReleaseHandOver(
  instrumentReference: string | null,
  remarks: string | null,
  intent: WriteIntent,
): ReleaseHandOverWire {
  return {
    instrument_reference: trimmedOrNull(instrumentReference),
    remarks: trimmedOrNull(remarks),
    idempotency_key: intent.key,
  };
}

/** What `POST office/releases/{id}/acknowledgement` reads (`OfficeReleaseAcknowledgement`). */
export interface ReleaseAcknowledgementWire {
  readonly kind: AcknowledgementKind;
  readonly collected_by: string | null;
  readonly authority: string | null;
  readonly idempotency_key: string;
}

export function toWireReleaseAcknowledgement(
  draft: ReleaseAcknowledgementDraft,
  intent: WriteIntent,
): ReleaseAcknowledgementWire {
  return {
    kind: draft.kind,
    collected_by: trimmedOrNull(draft.collectedBy),
    authority: trimmedOrNull(draft.authority),
    idempotency_key: intent.key,
  };
}

/** What `POST office/releases/{id}/deferral` reads (`OfficeReleaseDeferral`). */
export interface ReleaseDeferralWire {
  readonly reason: DeferralReason;
  readonly remarks: string;
  readonly idempotency_key: string;
}

export function toWireReleaseDeferral(
  reason: DeferralReason,
  remarks: string,
  intent: WriteIntent,
): ReleaseDeferralWire {
  return { reason, remarks: remarks.trim(), idempotency_key: intent.key };
}

/** What `POST office/releases/{id}/status` reads (`OfficeReleaseStatusChange`). */
export interface ReleaseStatusWire {
  readonly to: ReleaseStatus;
  readonly reason: string;
  readonly idempotency_key: string;
}

export function toWireReleaseStatus(
  to: ReleaseStatus,
  reason: string,
  intent: WriteIntent,
): ReleaseStatusWire {
  return { to, reason: reason.trim(), idempotency_key: intent.key };
}
