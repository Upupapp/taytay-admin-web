import {
  asId,
  asIsoDate,
  asIsoDateTime,
  type AssistanceRequestId,
  type DocumentRequest,
  type DocumentRequestChannel,
  type DocumentRequestId,
  type DocumentRequestState,
  type RequirementId,
} from '@domain/index';

import { str, text } from './wire';

/**
 * The office's requests for a document, read from the API.
 *
 * ## Two shapes the console had wrong
 *
 * The write was posted to `admin/assistance-requests/{case}/document-requests`. The API raises a
 * request against the **requirement that needs it** —
 * `.../{case}/requirements/{requirement}/document-requests` — and that nesting is the model rather
 * than a URL preference: a request exists because a particular slot on the checklist is unfilled,
 * and one that named only the case could not say which. The console already held the
 * `requirementId` on the draft, so the change is which side of the request it travels on.
 *
 * The read asked `collection<DocumentRequest>`, which hands back `response.data` as an array. This
 * endpoint answers `{ "requests": [...] }`, so `data` is an **object**, and every screen reading it
 * would have found no rows and shown an empty list — the failure `DL-146` names, on a record that
 * says what an applicant was told.
 *
 * ## `is_applicant_overdue` is deliberately not read
 *
 * The projection publishes it. `DL-83` settled that overdue is **derived** from the date and never
 * stored, because a stored flag needs a nightly job to stay true and is wrong every morning until
 * it runs. The console computes it from `neededBy`, and taking the server's copy would import
 * exactly the staleness the rule exists to avoid.
 *
 * @consumes GET admin/assistance-requests/{case}/document-requests
 * @consumes POST admin/assistance-requests/{case}/requirements/{requirement}/document-requests
 */

const CHANNELS: readonly DocumentRequestChannel[] = [
  'in-person',
  'sms',
  'phone-call',
  'barangay-relay',
];

const STATES: readonly DocumentRequestState[] = ['open', 'answered', 'withdrawn'];

export function toDocumentRequest(
  assistanceRequestId: AssistanceRequestId,
  wire: unknown,
): DocumentRequest | null {
  if (typeof wire !== 'object' || wire === null) return null;
  const row = wire as Record<string, unknown>;

  const id = str(row['id']);
  const requirementId = str(row['requirement_id']);
  if (id === null || requirementId === null) return null;

  const channelValue = str(row['channel']);
  const stateValue = str(row['state']);
  const neededBy = str(row['needed_by']);
  const requestedAt = str(row['requested_at']);
  const closedAt = str(row['closed_at']);

  return {
    id: asId<DocumentRequestId>(id),
    // Known from the URL the caller asked at. The row does not repeat it.
    assistanceRequestId,
    requirementId: asId<RequirementId>(requirementId),
    /*
     * An unrecognised state reads as `open`, which is the one that keeps the row in front of
     * somebody. Defaulting to `answered` or `withdrawn` would quietly close a request the office
     * still owes an applicant.
     */
    state: STATES.find((candidate) => candidate === stateValue) ?? 'open',
    channel: CHANNELS.find((candidate) => candidate === channelValue) ?? 'in-person',
    message: text(row['message']),
    neededBy: neededBy === null ? null : asIsoDate(neededBy),
    // The projection carries no requester. Never invented — that would name somebody.
    requestedBy: null,
    requestedAt: asIsoDateTime(requestedAt === null ? new Date(0) : new Date(requestedAt)),
    closedAt: closedAt === null ? null : asIsoDateTime(new Date(closedAt)),
    withdrawnReason: str(row['withdrawn_reason']),
  };
}

/** The list arrives as `{ requests: [...] }`, not as a bare array. */
export function toDocumentRequests(
  assistanceRequestId: AssistanceRequestId,
  wire: unknown,
): readonly DocumentRequest[] {
  if (typeof wire !== 'object' || wire === null) return [];
  const rows = (wire as Record<string, unknown>)['requests'];
  if (!Array.isArray(rows)) return [];

  return rows
    .map((row) => toDocumentRequest(assistanceRequestId, row))
    .filter((row): row is DocumentRequest => row !== null);
}
