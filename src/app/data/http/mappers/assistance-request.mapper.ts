import {
  ADVISORY_SOURCES,
  ASSISTANCE_STATUS_CATALOG,
  CASE_NOTE_SENSITIVITIES,
  INTAKE_CHANNELS,
  INTAKE_SIGNAL_CODES,
  INTAKE_SIGNAL_TONES,
  REQUIREMENT_OBLIGATIONS,
  REQUIREMENT_STATUS_CATALOG,
  asId,
  centavos,
  type AdvisoryAcknowledgement,
  type AdvisoryGap,
  type AssistanceRequest,
  type AssistanceRequestId,
  type AssistanceRequestStatus,
  type ConditionalApplicability,
  type IntakeAdvisory,
  type IntakeChannel,
  type IntakeDraft,
  type IntakeSignal,
  type ProgramId,
  type RequestNote,
  type RequestNoteId,
  type RequestWithheldField,
  type RequirementId,
  type ResidentId,
  type StaffUserId,
  type StatusChange,
  type SubmittedRequirement,
} from '@domain/index';

import { UNNAMED_ACTOR } from './household.mapper';
import type { BarangayIndex } from './resident.mapper';
import { bool, dateTime, field, id, int, list, oneOf, str } from './wire';

/**
 * Assistance requests on the wire (`OfficeRequest`, casework phase 2a, `DL-177`).
 *
 * | wire                          | domain                       | if absent or unknown                  |
 * | ----------------------------- | ---------------------------- | ------------------------------------- |
 * | `id`, `resident_id`           | the same                     | the request is not readable           |
 * | `reference_number`            | `referenceNumber`            | `''` on a draft; filed: not readable  |
 * | `program_id`                  | `programId`                  | `''` on a draft; filed: not readable  |
 * | `barangay_id`                 | `barangayId`, joined by name | the request is not readable           |
 * | `status`, `channel`           | the same                     | the request is not readable           |
 * | `referred_by`                 | `referredBy`                 | none given, or withheld               |
 * | `reason_for_request`          | `reasonForRequest`           | `''`: none yet, or withheld           |
 * | `requested_amount_centavos`   | `requestedAmount`            | none asked for                        |
 * | `submitted_at`                | `submittedAt`                | a draft; filed: not readable          |
 * | `requirements`                | `requirements`               | one unreadable: the request is not    |
 * | `status_history`              | `statusHistory`              | one unreadable: the request is not    |
 * | `is_protected`, `withheld`    | the same, camelCased         | a field it cannot name: not readable  |
 * | `created_*`, `updated_*`      | `audit`                      | the request is not readable           |
 *
 * **The server has already redacted the request** (`DL-38`): a protected request's words arrive as
 * `null` and `withheld` names them. This mapper applies no disclosure rule of its own — a second copy
 * of the rule is one that eventually disagrees with the first — and only says what the server said.
 *
 * **It refuses what it cannot read rather than default it.** A status, channel, obligation or
 * withheld field it has no word for, a requirement it cannot read, or a move in the history it
 * cannot read, refuses the whole request: a checklist missing a document asks an applicant for less
 * than the office does, and a history missing a move tells the next worker it never happened.
 *
 * **Not sent, because nothing on the server records them yet** (`DL-177`): the approved amount, the
 * assignee, the assessment and the decision remarks are `null` here, which is what is true — none
 * is recorded. So are a requirement's reviewer and its ruling's author and reason, and the document
 * presented against it: the assessment and the document review are phase 2b.
 *
 * @consumes GET office/assistance-requests
 * @consumes GET office/assistance-requests/{id}
 * @consumes POST office/assistance-requests
 * @consumes PATCH office/assistance-requests/{id}
 * @consumes POST office/assistance-requests/{id}/file
 * @consumes POST office/assistance-requests/{id}/status
 */
export function toAssistanceRequest(wire: unknown, barangays: BarangayIndex): AssistanceRequest | null {
  const requestId = id<AssistanceRequestId>(field(wire, 'id'));
  const residentId = id<ResidentId>(field(wire, 'resident_id'));
  const barangayId = barangays.toConsole(str(field(wire, 'barangay_id')));
  const status = oneOf(field(wire, 'status'), STATUSES);
  const channel = oneOf(field(wire, 'channel'), INTAKE_CHANNELS);
  const requirements = toRequirements(field(wire, 'requirements'));
  const statusHistory = toHistory(field(wire, 'status_history'));
  const withheld = toWithheld(field(wire, 'withheld'));
  const createdAt = dateTime(field(wire, 'created_at'));
  const updatedAt = dateTime(field(wire, 'updated_at'));

  if (
    requestId === null ||
    residentId === null ||
    barangayId === null ||
    status === null ||
    channel === null ||
    requirements === null ||
    statusHistory === null ||
    withheld === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }

  const referenceNumber = str(field(wire, 'reference_number'));
  const programId = id<ProgramId>(field(wire, 'program_id'));
  const submittedAt = dateTime(field(wire, 'submitted_at'));
  const filed = referenceNumber !== null || submittedAt !== null;
  // A filed request without its control number, programme or filing time is one nobody could
  // quote, place or date: refused rather than shown half-read. Only a draft — or a draft cancelled
  // before it was filed, which never had a number — may come without them.
  if (filed && (referenceNumber === null || programId === null || submittedAt === null)) {
    return null;
  }
  if (!filed && status !== 'draft' && status !== 'cancelled') {
    return null;
  }

  const requested = int(field(wire, 'requested_amount_centavos'));

  return {
    id: requestId,
    // A draft has no control number and may have no programme yet; `''` is the console's word
    // for both (`DL-63`), as the mock holds them.
    referenceNumber: referenceNumber ?? '',
    residentId,
    programId: programId ?? asId<ProgramId>(''),
    barangayId,
    status,
    channel,
    referredBy: str(field(wire, 'referred_by')),
    requestedAmount: requested === null ? null : centavos(requested),
    approvedAmount: null,
    reasonForRequest: str(field(wire, 'reason_for_request')) ?? '',
    assignedTo: null,
    requirements,
    assessment: null,
    statusHistory,
    decisionRemarks: null,
    submittedAt,
    isProtected: bool(field(wire, 'is_protected')),
    withheld,
    audit: {
      createdAt,
      createdBy: id<StaffUserId>(field(wire, 'created_by')),
      updatedAt,
      updatedBy: id<StaffUserId>(field(wire, 'updated_by')),
    },
  };
}

/**
 * A note as the server disclosed it (`DL-58`): a withheld body is `null` and the entry still
 * listed. A body that is neither present nor withheld is a note the console cannot read — an empty
 * entry would read as somebody having written nothing.
 *
 * @consumes GET office/assistance-requests/{id}/notes
 */
export function toRequestNote(wire: unknown): RequestNote | null {
  const noteId = id<RequestNoteId>(field(wire, 'id'));
  const requestId = id<AssistanceRequestId>(field(wire, 'request_id'));
  const sensitivity = oneOf(field(wire, 'sensitivity'), CASE_NOTE_SENSITIVITIES);
  const createdAt = dateTime(field(wire, 'created_at'));

  if (noteId === null || requestId === null || sensitivity === null || createdAt === null) {
    return null;
  }

  const body = str(field(wire, 'body'));
  const isWithheld = bool(field(wire, 'is_withheld'));
  if (body === null && !isWithheld) {
    return null;
  }

  return {
    id: noteId,
    requestId,
    authorId: id<StaffUserId>(field(wire, 'author_id')),
    authorName: str(field(wire, 'author_name')) ?? UNNAMED_ACTOR,
    body: isWithheld ? null : body,
    isWithheld,
    sensitivity,
    createdAt,
  };
}

/**
 * The duplicate and previous-assistance check, as the server ran it (`DL-60`, `DL-177`).
 *
 * A signal whose code or tone the console has no word for is **dropped**, as the domain says: a
 * signal it cannot explain is one it should not show, and the server reads the check again at
 * filing, which is where the guarantee lives. A source it could not read is **never** dropped —
 * that sentence is what stops the advisory's silence from reading as "never helped" — so one the
 * console cannot name refuses the whole advisory.
 *
 * @consumes GET office/assistance-requests/advisory
 * @consumes GET office/assistance-requests/{id}/advisory
 */
export function toIntakeAdvisory(wire: unknown): IntakeAdvisory | null {
  const computedAt = dateTime(field(wire, 'computed_at'));
  const recordsRead = int(field(wire, 'records_read'));
  const unread = toGaps(field(wire, 'not_read'));
  const signals = toSignals(field(wire, 'signals'));

  if (computedAt === null || recordsRead === null || unread === null || signals === null) {
    return null;
  }

  return { signals, computedAt, recordsRead, unread };
}

/* ── what is sent ─────────────────────────────────────────────────────────── */

/** One document's answer at the counter (`requirementAnswer`): what was done, never its label. */
export interface RequirementAnswerWire {
  readonly code: string;
  readonly presented: boolean;
  readonly waived_reason: string | null;
  readonly applicability: ConditionalApplicability;
}

/**
 * What `POST office/assistance-requests` and `PATCH office/assistance-requests/{id}` read
 * (`OfficeRequestDraft`), and nothing else: the body is strict. The whole draft every time, because
 * `PATCH` replaces it whole.
 *
 * The checklist is sent as **answers by code**: the server builds the list from the programme and
 * applies them, so the labels, obligations and circumstances are the programme's as it stands and
 * not whatever the screen held. No control number — that is issued at filing (`DL-63`).
 */
export interface RequestDraftWire {
  readonly resident_id: string;
  readonly program_id: string | null;
  readonly channel: IntakeChannel;
  readonly referred_by: string | null;
  readonly reason_for_request: string;
  /** Integer centavos, as `Money` holds them: no pesos, no decimal point. */
  readonly requested_amount_centavos: number | null;
  readonly requirements: readonly RequirementAnswerWire[];
}

/** `residentId` is the draft's own, passed apart because a draft may not have named one yet. */
export function toWireRequestDraft(draft: IntakeDraft, residentId: ResidentId): RequestDraftWire {
  const referredBy = draft.referredBy?.trim() ?? '';
  return {
    resident_id: residentId,
    program_id: draft.programId,
    channel: draft.channel,
    referred_by: referredBy === '' ? null : referredBy,
    reason_for_request: draft.reasonForRequest.trim(),
    requested_amount_centavos: draft.requestedAmount === null ? null : draft.requestedAmount.centavos,
    requirements: draft.requirements.map((entry) => ({
      code: entry.code,
      presented: entry.presented,
      // An empty reason is a waiver begun and not yet explained; the server keeps it as still owed.
      waived_reason: entry.waivedReason,
      applicability: entry.applicability,
    })),
  };
}

/** The encoder's sentence and the cautions it answers. */
export interface AcknowledgementWire {
  readonly codes: readonly string[];
  readonly reason: string;
}

/**
 * What `POST office/assistance-requests/{id}/file` reads (`OfficeRequestFiling`). Who acknowledged
 * and when are the server's to record, not the client's to say, so neither is sent.
 */
export interface RequestFilingWire {
  readonly acknowledgement: AcknowledgementWire | null;
}

export function toWireRequestFiling(
  acknowledgement: AdvisoryAcknowledgement | null,
): RequestFilingWire {
  return {
    acknowledgement:
      acknowledgement === null
        ? null
        : { codes: [...acknowledgement.codes], reason: acknowledgement.reason.trim() },
  };
}

/** What `POST office/assistance-requests/{id}/status` reads (`OfficeRequestStatusMove`). */
export interface StatusMoveWire {
  readonly to: AssistanceRequestStatus;
  readonly reason: string;
}

export function toWireStatusMove(to: AssistanceRequestStatus, reason: string): StatusMoveWire {
  return { to, reason: reason.trim() };
}

/* ── parts ────────────────────────────────────────────────────────────────── */

const STATUSES: readonly AssistanceRequestStatus[] = Object.values(ASSISTANCE_STATUS_CATALOG).map(
  (entry) => entry.value,
);

const REQUIREMENT_STATUSES = Object.values(REQUIREMENT_STATUS_CATALOG).map((entry) => entry.value);

const APPLICABILITIES: readonly ConditionalApplicability[] = ['undecided', 'applies', 'does-not-apply'];

const WITHHELD: Readonly<Record<string, RequestWithheldField>> = {
  reason_for_request: 'reasonForRequest',
  referred_by: 'referredBy',
  status_reasons: 'statusReasons',
  requirement_remarks: 'requirementRemarks',
  notes: 'notes',
};

/** Every requirement, or `null` when one cannot be read. */
function toRequirements(value: unknown): SubmittedRequirement[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const requirements = value.map(toRequirement);
  return requirements.every((entry): entry is SubmittedRequirement => entry !== null)
    ? requirements
    : null;
}

function toRequirement(value: unknown): SubmittedRequirement | null {
  const requirementId = id<RequirementId>(field(value, 'id'));
  const code = str(field(value, 'code'));
  const label = str(field(value, 'label'));
  const obligation = oneOf(field(value, 'obligation'), REQUIREMENT_OBLIGATIONS);
  const applicability = oneOf(field(value, 'applicability'), APPLICABILITIES);
  const status = oneOf(field(value, 'status'), REQUIREMENT_STATUSES);
  const appliesWhen = str(field(value, 'applies_when'));

  if (
    requirementId === null ||
    code === null ||
    label === null ||
    obligation === null ||
    applicability === null ||
    status === null ||
    // A conditional document without its circumstances cannot be judged by anybody (`DL-76`).
    (obligation === 'conditional' && appliesWhen === null)
  ) {
    return null;
  }

  return {
    id: requirementId,
    code,
    label,
    status,
    obligation,
    applicability,
    appliesWhen,
    applicabilityDecidedBy: null,
    applicabilityReason: null,
    submittedAt: dateTime(field(value, 'submitted_at')),
    reviewedBy: null,
    reviewedAt: null,
    remarks: str(field(value, 'remarks')),
    document: null,
  };
}

/** Every move, oldest first, or `null` when one cannot be read. */
function toHistory(value: unknown): StatusChange[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const changes = value.map(toChange);
  return changes.every((entry): entry is StatusChange => entry !== null) ? changes : null;
}

function toChange(value: unknown): StatusChange | null {
  const raw = field(value, 'from');
  const from = raw === null ? null : oneOf(raw, STATUSES);
  const to = oneOf(field(value, 'to'), STATUSES);
  const occurredAt = dateTime(field(value, 'occurred_at'));

  if ((raw !== null && from === null) || to === null || occurredAt === null) {
    return null;
  }

  return {
    from,
    to,
    reason: str(field(value, 'reason')),
    actorId: id<StaffUserId>(field(value, 'actor_id')),
    actorName: str(field(value, 'actor_name')) ?? UNNAMED_ACTOR,
    occurredAt,
  };
}

/**
 * What the server held back, or `null` when it names a field this console cannot: a screen that
 * cannot say what is hidden would show a blank that reads as "none given".
 */
function toWithheld(value: unknown): RequestWithheldField[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const fields = value.map((entry) => {
    const name = str(entry);
    return name !== null && Object.hasOwn(WITHHELD, name) ? (WITHHELD[name] ?? null) : null;
  });
  return fields.every((entry): entry is RequestWithheldField => entry !== null) ? fields : null;
}

/** The signals the console can explain, or `null` when there is no list at all. */
function toSignals(value: unknown): readonly IntakeSignal[] | null {
  return Array.isArray(value) ? list(value, toSignal) : null;
}

function toSignal(value: unknown): IntakeSignal | null {
  const code = oneOf(field(value, 'code'), INTAKE_SIGNAL_CODES);
  const tone = oneOf(field(value, 'tone'), INTAKE_SIGNAL_TONES);
  const rule = str(field(value, 'rule'));
  const finding = str(field(value, 'finding'));
  const references = field(value, 'references');

  if (code === null || tone === null || rule === null || finding === null) {
    return null;
  }
  // A signal that cannot say which records it read is one nobody can check (`DL-60`).
  if (!Array.isArray(references)) {
    return null;
  }

  return { code, tone, rule, finding, references: list(references, str) };
}

/** Every gap, or `null` when one cannot be read: a dropped gap is silence read as "none". */
function toGaps(value: unknown): AdvisoryGap[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const gaps = value.map((entry): AdvisoryGap | null => {
    const source = oneOf(field(entry, 'source'), ADVISORY_SOURCES);
    const because = str(field(entry, 'because'));
    return source === null || because === null ? null : { source, because };
  });
  return gaps.every((entry): entry is AdvisoryGap => entry !== null) ? gaps : null;
}
