import {
  ADVISORY_SOURCES,
  ASSESSMENT_RECOMMENDATIONS,
  ASSISTANCE_STATUS_CATALOG,
  CASE_NOTE_SENSITIVITIES,
  DOCUMENT_REQUEST_CHANNELS,
  DOCUMENT_SOURCES,
  INTAKE_CHANNELS,
  INTAKE_SIGNAL_CODES,
  INTAKE_SIGNAL_TONES,
  REQUIREMENT_OBLIGATIONS,
  REQUIREMENT_STATUS_CATALOG,
  asId,
  centavos,
  lastFourOf,
  type AdvisoryAcknowledgement,
  type AdvisoryGap,
  type AssessmentAnswers,
  type AssessmentDraft,
  type AssessmentQuestion,
  type AssessmentQuestionKind,
  type AssessmentTemplate,
  type AssessmentTemplateStatus,
  type AssistanceRequest,
  type AssistanceRequestId,
  type AssistanceRequestStatus,
  type ConditionalApplicability,
  type DocumentAccessGrant,
  type DocumentFile,
  type DocumentRequest,
  type DocumentRequestDraft,
  type DocumentRequestId,
  type DocumentRequestState,
  type DocumentSource,
  type DocumentVersion,
  type DocumentVersionDraft,
  type DocumentVersionId,
  type IntakeAdvisory,
  type IntakeChannel,
  type IntakeDraft,
  type IntakeSignal,
  type OpenAssessment,
  type ProgramId,
  type RequestApproval,
  type RequestAssignment,
  type RequestNote,
  type RequestNoteDraft,
  type RequestNoteId,
  type RequestWithheldField,
  type RequirementDocumentId,
  type RequirementId,
  type RequirementStatus,
  type ResidentId,
  type SocialWorker,
  type SocialWorkerAssessment,
  type StaffUserId,
  type StatusChange,
  type SubmittedRequirement,
  type UploadPolicy,
} from '@domain/index';

import { UNNAMED_ACTOR } from './household.mapper';
import type { BarangayIndex } from './resident.mapper';
import { bool, date, dateTime, field, flag, id, int, list, oneOf, str } from './wire';

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
 * | `assigned_to`, `assignments`  | the same, camelCased         | one unreadable: the request is not    |
 * | `assessment`                  | `assessment`                 | present and unreadable: not readable  |
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
 * **Not sent, because nothing on the server records them yet** (`DL-177`, `DL-178`): the approved
 * amount and the decision remarks — the approver's, phase 4's — are `null` here, which is what is
 * true: none is recorded.
 *
 * **A document is its versions** (`DL-178`). The server hangs `document_versions` off the
 * requirement and holds no document apart from them, so the console's `RequirementDocument` takes
 * the requirement's id as its own; a requirement with no version has no document. A version it
 * cannot read refuses the whole request: a history missing a version hides what the office read
 * when it decided (`DL-77`). Its number arrives masked unless the reader may have it whole, and is
 * passed through as it came.
 *
 * @consumes GET office/assistance-requests
 * @consumes GET office/assistance-requests/{id}
 * @consumes POST office/assistance-requests
 * @consumes PATCH office/assistance-requests/{id}
 * @consumes POST office/assistance-requests/{id}/file
 * @consumes POST office/assistance-requests/{id}/status
 * @consumes POST office/assistance-requests/{id}/assignment
 * @consumes POST office/assistance-requests/{id}/assessment/complete
 * @consumes POST office/assistance-requests/{id}/requirements/{requirementId}/review
 * @consumes POST office/assistance-requests/{id}/requirements/{requirementId}/applicability
 */
export function toAssistanceRequest(wire: unknown, barangays: BarangayIndex): AssistanceRequest | null {
  const requestId = id<AssistanceRequestId>(field(wire, 'id'));
  const residentId = id<ResidentId>(field(wire, 'resident_id'));
  const barangayId = barangays.toConsole(str(field(wire, 'barangay_id')));
  const status = oneOf(field(wire, 'status'), STATUSES);
  const channel = oneOf(field(wire, 'channel'), INTAKE_CHANNELS);
  const requirements = toRequirements(field(wire, 'requirements'));
  const statusHistory = toHistory(field(wire, 'status_history'));
  const assignments = toAssignments(field(wire, 'assignments'));
  const withheld = toWithheld(field(wire, 'withheld'));
  const assessmentWire = field(wire, 'assessment');
  const assessment = assessmentWire === null ? null : toAssessment(assessmentWire);
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
    assignments === null ||
    withheld === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }
  // A case study the console cannot read is not "none was done": the request is refused whole. Nor
  // are findings missing without being withheld — that would show a study as having found nothing.
  if (
    (assessmentWire !== null && assessment === null) ||
    (assessment !== null && assessment.findings === null && !withheld.includes('assessment'))
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
  // The latest approval's figure, or its goods (DL-183): integer centavos, never a float.
  const approved = int(field(wire, 'approved_amount_centavos'));

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
    approvedAmount: approved === null ? null : centavos(approved),
    approvedInKindDescription: str(field(wire, 'approved_in_kind_description')),
    reasonForRequest: str(field(wire, 'reason_for_request')) ?? '',
    assignedTo: id<StaffUserId>(field(wire, 'assigned_to')),
    assignments,
    requirements,
    assessment,
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

/**
 * What the applicant was asked to bring, as the server disclosed it (`DL-178`). On a protected
 * request read without `request.view-sensitive` the words — the message, a withdrawal's reason —
 * are `null` and `is_withheld` says so; the entry is still listed. A message that is neither
 * present nor withheld is an entry the console cannot read: a blank would read as the office having
 * asked without saying what.
 *
 * @consumes GET office/assistance-requests/{id}/document-requests
 * @consumes POST office/assistance-requests/{id}/document-requests
 * @consumes POST office/assistance-requests/{id}/document-requests/{documentRequestId}/withdraw
 */
export function toDocumentRequest(wire: unknown): DocumentRequest | null {
  const requestId = id<DocumentRequestId>(field(wire, 'id'));
  const assistanceRequestId = id<AssistanceRequestId>(field(wire, 'request_id'));
  const requirementId = id<RequirementId>(field(wire, 'requirement_id'));
  const state = oneOf(field(wire, 'state'), DOCUMENT_REQUEST_STATES);
  const channel = oneOf(field(wire, 'channel'), DOCUMENT_REQUEST_CHANNELS);
  const requestedAt = dateTime(field(wire, 'requested_at'));
  const isWithheld = flag(field(wire, 'is_withheld'));

  if (
    requestId === null ||
    assistanceRequestId === null ||
    requirementId === null ||
    state === null ||
    channel === null ||
    requestedAt === null ||
    isWithheld === null
  ) {
    return null;
  }

  const message = str(field(wire, 'message'));
  if (message === null && !isWithheld) {
    return null;
  }

  return {
    id: requestId,
    assistanceRequestId,
    requirementId,
    state,
    channel,
    message: isWithheld ? null : message,
    neededBy: date(field(wire, 'needed_by')),
    requestedBy: id<StaffUserId>(field(wire, 'requested_by')),
    requestedByName: str(field(wire, 'requested_by_name')) ?? UNNAMED_ACTOR,
    requestedAt,
    closedAt: dateTime(field(wire, 'closed_at')),
    closedBy: id<StaffUserId>(field(wire, 'closed_by')),
    withdrawnReason: isWithheld ? null : str(field(wire, 'withdrawn_reason')),
    isWithheld,
  };
}

/**
 * A published assessment form. A question whose kind the console cannot render, or a status it
 * has no word for, refuses the form: a form shown without one of its questions is answered
 * incompletely by somebody who believes they answered it all.
 *
 * @consumes GET office/assessment-templates
 */
export function toAssessmentTemplate(wire: unknown): AssessmentTemplate | null {
  const code = str(field(wire, 'code'));
  const version = str(field(wire, 'version'));
  const label = str(field(wire, 'label'));
  const status = oneOf(field(wire, 'status'), TEMPLATE_STATUSES);
  const questions = toQuestions(field(wire, 'questions'));

  if (code === null || version === null || label === null || status === null || questions === null) {
    return null;
  }

  return { code, version, label, status, questions };
}

/**
 * The assessment open on a request, with whatever has been answered. An answer that is neither
 * text nor `null` refuses it: an answer shown blank that was recorded is one an assessor types
 * over.
 *
 * @consumes POST office/assistance-requests/{id}/assessment
 * @consumes POST office/assistance-requests/{id}/assessment/answers
 */
export function toOpenAssessment(wire: unknown): OpenAssessment | null {
  const templateCode = str(field(wire, 'template_code'));
  const templateVersion = str(field(wire, 'template_version'));
  const completed = flag(field(wire, 'completed'));
  const answers = toAnswers(field(wire, 'answers'));

  if (templateCode === null || templateVersion === null || completed === null || answers === null) {
    return null;
  }

  return { templateCode, templateVersion, completed, answers };
}

/**
 * An open social-worker account a request can be assigned to: an id and a name, nothing more.
 *
 * @consumes GET office/social-workers
 */
export function toSocialWorker(wire: unknown): SocialWorker | null {
  const workerId = id<StaffUserId>(field(wire, 'id'));
  if (workerId === null) {
    return null;
  }
  return { id: workerId, name: str(field(wire, 'name')) ?? UNNAMED_ACTOR };
}

/**
 * A grant to open one file, with the warning **the server composed** — what the file is, how to
 * handle it, that the opening is recorded. A grant without its warning is refused rather than
 * shown with one written here: only the server knows whether the person is protected, and a
 * warning guessed client-side would reassure exactly when it should not.
 *
 * @consumes POST office/assistance-requests/{id}/requirements/{requirementId}/documents/{versionId}/access
 */
export function toDocumentAccessGrant(wire: unknown): DocumentAccessGrant | null {
  const versionId = id<DocumentVersionId>(field(wire, 'version_id'));
  const fileName = str(field(wire, 'file_name'));
  const mimeType = str(field(wire, 'mime_type'));
  const handle = str(field(wire, 'handle'));
  const expiresAt = dateTime(field(wire, 'expires_at'));
  const redacted = flag(field(wire, 'redacted_for_sharing'));
  const warning = str(field(wire, 'warning'));

  if (
    versionId === null ||
    fileName === null ||
    mimeType === null ||
    handle === null ||
    expiresAt === null ||
    redacted === null ||
    warning === null
  ) {
    return null;
  }

  return { versionId, fileName, mimeType, handle, expiresAt, redactedForSharing: redacted, warning };
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

/**
 * The move to `approved`, saying what was approved (`OfficeRequestStatusMove`, `DL-183`): integer
 * centavos, or the goods described — one, and the other `null`.
 */
export interface ApprovalMoveWire {
  readonly to: 'approved';
  readonly reason: string;
  readonly approved_amount_centavos: number | null;
  readonly approved_in_kind_description: string | null;
}

export function toWireApproval(approval: RequestApproval, reason: string): ApprovalMoveWire {
  return {
    to: 'approved',
    reason: reason.trim(),
    approved_amount_centavos: approval.kind === 'money' ? approval.amount.centavos : null,
    approved_in_kind_description: approval.kind === 'in-kind' ? approval.description.trim() : null,
  };
}

/** What `POST office/assistance-requests/{id}/assignment` reads (`OfficeRequestAssignmentWrite`). */
export interface AssignmentWire {
  readonly assignee_id: string;
  readonly reason: string;
}

export function toWireAssignment(assigneeId: StaffUserId, reason: string): AssignmentWire {
  return { assignee_id: assigneeId, reason: reason.trim() };
}

/**
 * What `POST office/assistance-requests/{id}/notes` reads (`OfficeRequestNoteWrite`). Who wrote it
 * and when are the server's to record.
 */
export interface NoteWire {
  readonly sensitivity: RequestNoteDraft['sensitivity'];
  readonly body: string;
}

export function toWireNote(note: RequestNoteDraft): NoteWire {
  return { sensitivity: note.sensitivity, body: note.body.trim() };
}

/** What `POST office/assistance-requests/{id}/assessment` reads (`OfficeAssessmentOpen`). */
export interface AssessmentOpenWire {
  readonly template_code: string;
}

export function toWireAssessmentOpen(templateCode: string): AssessmentOpenWire {
  return { template_code: templateCode };
}

/**
 * What `POST office/assistance-requests/{id}/assessment/answers` reads (`OfficeAssessmentAnswers`):
 * a patch of question code to text, `null` for "asked and left blank". The codes are the form's own
 * and travel as they are — they are the server's question codes, not domain field names.
 */
export interface AssessmentAnswersWire {
  readonly answers: Readonly<Record<string, string | null>>;
}

export function toWireAssessmentAnswers(answers: AssessmentAnswers): AssessmentAnswersWire {
  const sent: Record<string, string | null> = {};
  for (const [code, value] of Object.entries(answers)) {
    const trimmed = value?.trim() ?? '';
    sent[code] = trimmed === '' ? null : trimmed;
  }
  return { answers: sent };
}

/**
 * What `POST office/assistance-requests/{id}/assessment/complete` reads
 * (`OfficeAssessmentCompletion`): the findings, the recommendation the assessor chose, and the two
 * facts the server now keeps beside them — the recommended amount, in integer centavos, and whether
 * a home visit was made. Nothing here derives a recommendation; it is sent as the person chose it.
 */
export interface AssessmentCompletionWire {
  readonly findings: string;
  readonly recommended_amount_centavos: number | null;
  readonly home_visit_conducted: boolean;
  readonly recommendation: AssessmentDraft['recommendation'];
  readonly reason: string | null;
}

export function toWireAssessment(assessment: AssessmentDraft): AssessmentCompletionWire {
  const reason = assessment.reason?.trim() ?? '';
  return {
    findings: assessment.findings.trim(),
    recommended_amount_centavos:
      assessment.recommendedAmount === null ? null : assessment.recommendedAmount.centavos,
    home_visit_conducted: assessment.homeVisitConducted,
    recommendation: assessment.recommendation,
    reason: reason === '' ? null : reason,
  };
}

/** The verdicts a person gives a document. `pending` and `submitted` are states, never a review. */
export type ReviewVerdict = Exclude<RequirementStatus, 'pending' | 'submitted'>;

export const REVIEW_VERDICTS: readonly ReviewVerdict[] = [
  'verified',
  'rejected',
  'waived',
  'expired',
  'needs-replacement',
];

/** What `POST …/requirements/{requirementId}/review` reads (`OfficeRequirementReview`). */
export interface RequirementReviewWire {
  readonly status: ReviewVerdict;
  readonly remarks: string | null;
}

export function toWireRequirementReview(
  status: ReviewVerdict,
  remarks: string | null,
): RequirementReviewWire {
  const words = remarks?.trim() ?? '';
  return { status, remarks: words === '' ? null : words };
}

/** What `POST …/requirements/{requirementId}/applicability` reads (`OfficeRequirementRuling`). */
export interface ApplicabilityRulingWire {
  readonly applicability: Exclude<ConditionalApplicability, 'undecided'>;
  readonly reason: string;
}

export function toWireApplicabilityRuling(
  applicability: Exclude<ConditionalApplicability, 'undecided'>,
  reason: string,
): ApplicabilityRulingWire {
  return { applicability, reason: reason.trim() };
}

/**
 * What `POST …/requirements/{requirementId}/documents` reads (`OfficeDocumentUpload`), as **form
 * fields**: a form cannot say `null`, so a field with nothing to say is left out (`undefined`), and
 * the server reads a field left out as null. The file travels only for a source that holds one.
 */
export interface DocumentUploadWire {
  readonly file: Blob | undefined;
  readonly source: DocumentSource;
  readonly document_number: string | undefined;
  readonly issued_on: string | undefined;
  readonly expires_on: string | undefined;
  readonly replaces_because: string | undefined;
}

export function toWireDocumentUpload(draft: DocumentVersionDraft): DocumentUploadWire {
  // Only the last four characters leave the browser: nothing longer is held, here or on the API
  // (DL-183), so nothing longer is sent.
  const number = lastFourOf(draft.documentNumber);
  const because = draft.replacesBecause?.trim() ?? '';
  return {
    file: draft.file ?? undefined,
    source: draft.source,
    document_number: number ?? undefined,
    issued_on: draft.issuedOn ?? undefined,
    expires_on: draft.expiresOn ?? undefined,
    replaces_because: because === '' ? undefined : because,
  };
}

/** What `POST office/assistance-requests/{id}/document-requests` reads (`OfficeDocumentRequestWrite`). */
export interface DocumentRequestWire {
  readonly requirement_id: string;
  readonly channel: DocumentRequestDraft['channel'];
  readonly message: string;
  readonly needed_by: string | null;
}

export function toWireDocumentRequest(draft: DocumentRequestDraft): DocumentRequestWire {
  return {
    requirement_id: draft.requirementId,
    channel: draft.channel,
    message: draft.message.trim(),
    needed_by: draft.neededBy,
  };
}

/** What `POST …/document-requests/{documentRequestId}/withdraw` reads (`OfficeDocumentRequestWithdrawal`). */
export interface DocumentRequestWithdrawalWire {
  readonly reason: string;
}

export function toWireDocumentRequestWithdrawal(reason: string): DocumentRequestWithdrawalWire {
  return { reason: reason.trim() };
}

/**
 * What `POST office/document-files` reads (`OfficeDocumentFileRequest`): the handle, in a body,
 * because request paths are logged and a handle is not a thing to log.
 */
export interface DocumentFileRequestWire {
  readonly handle: string;
}

export function toWireDocumentFileRequest(grant: DocumentAccessGrant): DocumentFileRequestWire {
  return { handle: grant.handle };
}

/* ── parts ────────────────────────────────────────────────────────────────── */

const DOCUMENT_REQUEST_STATES: readonly DocumentRequestState[] = ['open', 'answered', 'withdrawn'];

const TEMPLATE_STATUSES: readonly AssessmentTemplateStatus[] = [
  'placeholder-pending-lgu-approval',
  'adopted',
];

const QUESTION_KINDS: readonly AssessmentQuestionKind[] = ['choice', 'integer', 'text'];

/** Every question, or `null` when one cannot be read. */
function toQuestions(value: unknown): AssessmentQuestion[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const questions = value.map((entry): AssessmentQuestion | null => {
    const code = str(field(entry, 'code'));
    const label = str(field(entry, 'label'));
    const kind = oneOf(field(entry, 'kind'), QUESTION_KINDS);
    const required = flag(field(entry, 'required'));
    const choices = field(entry, 'choices');
    if (code === null || label === null || kind === null || required === null || !Array.isArray(choices)) {
      return null;
    }
    const read = choices.map(str);
    if (!read.every((choice): choice is string => choice !== null)) {
      return null;
    }
    return { code, label, kind, required, choices: read };
  });
  return questions.every((entry): entry is AssessmentQuestion => entry !== null) ? questions : null;
}

/** Answers keyed by question code, each text or `null`; anything else refuses the whole set. */
function toAnswers(value: unknown): Record<string, string | null> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const answers: Record<string, string | null> = {};
  for (const [code, answer] of Object.entries(value)) {
    if (answer !== null && typeof answer !== 'string') {
      return null;
    }
    answers[code] = answer === '' ? null : answer;
  }
  return answers;
}

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
  assignment_reasons: 'assignmentReasons',
  assessment: 'assessment',
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
  const accepts = toUploadPolicy(field(value, 'accepts'));
  const versions = toVersions(field(value, 'document_versions'));

  if (
    requirementId === null ||
    code === null ||
    label === null ||
    obligation === null ||
    applicability === null ||
    status === null ||
    // Without the policy a screen cannot refuse a file before sending it, and would guess one.
    accepts === null ||
    versions === null ||
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
    applicabilityDecidedBy: id<StaffUserId>(field(value, 'applicability_decided_by')),
    applicabilityDecidedAt: dateTime(field(value, 'applicability_decided_at')),
    applicabilityReason: str(field(value, 'applicability_reason')),
    submittedAt: dateTime(field(value, 'submitted_at')),
    reviewedBy: id<StaffUserId>(field(value, 'reviewed_by')),
    reviewedAt: dateTime(field(value, 'reviewed_at')),
    remarks: str(field(value, 'remarks')),
    accepts,
    // One document per requirement, and the server holds none apart from its versions: the
    // requirement's id stands for it (`DL-178`).
    document:
      versions.length === 0
        ? null
        : { id: asId<RequirementDocumentId>(requirementId), requirementId, versions },
  };
}

/** The upload policy the requirement publishes, or `null` when it cannot be read whole. */
function toUploadPolicy(value: unknown): UploadPolicy | null {
  const types = field(value, 'mime_types');
  const maxBytes = int(field(value, 'max_bytes'));
  if (!Array.isArray(types) || maxBytes === null || maxBytes <= 0) {
    return null;
  }
  const mimeTypes = types.map(str);
  return mimeTypes.every((type): type is string => type !== null) && mimeTypes.length > 0
    ? { mimeTypes, maxBytes }
    : null;
}

/** Every version, oldest first, or `null` when one cannot be read (`DL-77`). */
function toVersions(value: unknown): DocumentVersion[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const versions = value.map(toVersion);
  return versions.every((entry): entry is DocumentVersion => entry !== null) ? versions : null;
}

function toVersion(value: unknown): DocumentVersion | null {
  const versionId = id<DocumentVersionId>(field(value, 'id'));
  const number = int(field(value, 'version'));
  const source = oneOf(field(value, 'source'), DOCUMENT_SOURCES);
  const fileWire = field(value, 'file');
  const file = fileWire === null ? null : toStoredFile(fileWire);
  const masked = flag(field(value, 'document_number_masked'));
  const receivedBy = id<StaffUserId>(field(value, 'received_by'));
  const receivedAt = dateTime(field(value, 'received_at'));

  if (
    versionId === null ||
    number === null ||
    number < 1 ||
    source === null ||
    (fileWire !== null && file === null) ||
    masked === null ||
    receivedBy === null ||
    receivedAt === null
  ) {
    return null;
  }

  return {
    id: versionId,
    version: number,
    file,
    source,
    // As the server sent it: its last four characters, the only part it holds (DL-183). Screens
    // mask it again regardless (`maskDocumentNumber` is idempotent).
    documentNumber: str(field(value, 'document_number')),
    documentNumberMasked: masked,
    issuedOn: date(field(value, 'issued_on')),
    expiresOn: date(field(value, 'expires_on')),
    receivedBy,
    receivedByName: str(field(value, 'received_by_name')) ?? UNNAMED_ACTOR,
    receivedAt,
    supersededAt: dateTime(field(value, 'superseded_at')),
    supersededBy: id<StaffUserId>(field(value, 'superseded_by')),
    supersededReason: str(field(value, 'superseded_reason')),
  };
}

/** The file a version names: the server's name for it, never a link (`DL-178`). */
function toStoredFile(value: unknown): DocumentFile | null {
  const fileName = str(field(value, 'file_name'));
  const mimeType = str(field(value, 'mime_type'));
  const byteSize = int(field(value, 'byte_size'));
  if (fileName === null || mimeType === null || byteSize === null || byteSize < 0) {
    return null;
  }
  // The server counts no pages, and says so with null; a guess would read as somebody having checked.
  return { fileName, mimeType, byteSize, pageCount: int(field(value, 'page_count')) };
}

/** Every assignment, oldest first, or `null` when one cannot be read. */
function toAssignments(value: unknown): RequestAssignment[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const assignments = value.map((entry): RequestAssignment | null => {
    const assigneeId = id<StaffUserId>(field(entry, 'assignee_id'));
    const occurredAt = dateTime(field(entry, 'occurred_at'));
    if (assigneeId === null || occurredAt === null) {
      return null;
    }
    return {
      assigneeId,
      assigneeName: str(field(entry, 'assignee_name')) ?? UNNAMED_ACTOR,
      reason: str(field(entry, 'reason')),
      actorId: id<StaffUserId>(field(entry, 'actor_id')),
      actorName: str(field(entry, 'actor_name')) ?? UNNAMED_ACTOR,
      occurredAt,
    };
  });
  return assignments.every((entry): entry is RequestAssignment => entry !== null)
    ? assignments
    : null;
}

/**
 * The latest completed case study, or `null` when it cannot be read. Its words arrive `null` when
 * withheld from this reader, and `withheld` lists `assessment`; they are passed through as `null`,
 * never as an empty finding.
 */
function toAssessment(value: unknown): SocialWorkerAssessment | null {
  const templateCode = str(field(value, 'template_code'));
  const templateVersion = str(field(value, 'template_version'));
  const assessedBy = id<StaffUserId>(field(value, 'assessed_by'));
  const assessedAt = dateTime(field(value, 'assessed_at'));
  const recommendation = oneOf(field(value, 'recommendation'), ASSESSMENT_RECOMMENDATIONS);
  const homeVisit = flag(field(value, 'home_visit_conducted'));
  const amountWire = field(value, 'recommended_amount_centavos');
  const amount = int(amountWire);

  if (
    templateCode === null ||
    templateVersion === null ||
    assessedBy === null ||
    assessedAt === null ||
    recommendation === null ||
    homeVisit === null ||
    (amountWire !== null && (amount === null || amount < 0))
  ) {
    return null;
  }

  return {
    templateCode,
    templateVersion,
    assessedBy,
    assessedByName: str(field(value, 'assessed_by_name')) ?? UNNAMED_ACTOR,
    assessedAt,
    findings: str(field(value, 'findings')),
    recommendedAmount: amount === null ? null : centavos(amount),
    homeVisitConducted: homeVisit,
    recommendation,
    recommendationReason: str(field(value, 'recommendation_reason')),
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
