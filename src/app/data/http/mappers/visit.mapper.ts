import type {
  FieldVisit,
  FieldVisitId,
  ObservationKind,
  ResidentId,
  StaffUserId,
  VisitChecklistItem,
  VisitObservation,
  VisitObservationId,
  VisitPurpose,
  VisitStatus,
} from '@domain/index';

import { bool, date, dateTime, field, id, list, oneOf, str, text } from './wire';

/**
 * `admin/visits` → the domain `FieldVisit`.
 *
 * **The first complex resource whose payload genuinely fills the model**, and
 * worth saying why after three that could not. The detail endpoint returns 19
 * fields including `observations`, `checklist`, `outcome`, `service_needs` and
 * `declined_reason` — everything the visit screens read. Both sides also already
 * agree on the two vocabularies that matter: `VisitStatus` (5 values) and
 * `VisitPurpose` (6), string for string.
 *
 * ## The list and the detail carry different things, and that matters here
 *
 * `GET admin/visits` returns 11 fields with **no** `observations` key at all;
 * the detail returns them. A mapper that filled `observations: []` from a list
 * row would be claiming a worker recorded nothing — which, on a completed
 * visit, is a claim about that worker's diligence.
 *
 * So absence of the key and an empty list are treated as **different things**:
 * a missing key leaves the array empty because the row does not carry it, and
 * `hasDetail` is not something this model has, so screens must fetch the detail
 * before showing "no observations recorded". That is a real constraint and it is
 * stated here rather than left for somebody to discover on a completed visit.
 *
 * ## What the wire does not carry
 *
 * `caseId` and `householdId` are absent and **nullable in the domain**, so they
 * map to `null` honestly. `audit` has no counterpart — the recurring gap across
 * every resource so far.
 *
 * Four wire fields have no domain counterpart and are dropped deliberately:
 * `is_overdue` (the console derives lateness itself, `DL-83`, and a stored flag
 * is wrong every morning until a job runs), `next_action`, `follow_up_on` and
 * `worker_safety_advisory`.
 *
 * @consumes GET admin/visits
 * @consumes GET admin/visits/{visit}
 */
export function toFieldVisit(wire: unknown): FieldVisit | null {
  const visitId = id<FieldVisitId>(field(wire, 'id'));
  const residentId = id<ResidentId>(field(wire, 'resident_id'));
  const scheduledFor = date(field(wire, 'scheduled_for'));
  const status = oneOf<VisitStatus>(field(wire, 'status'), STATUSES);
  const purpose = oneOf<VisitPurpose>(field(wire, 'purpose'), PURPOSES);

  // A visit with no identity, subject, date, status or purpose is not a visit
  // any screen can render or a worker can act on.
  if (visitId === null || residentId === null || scheduledFor === null || status === null || purpose === null) {
    return null;
  }

  return {
    id: visitId,
    referenceNumber: text(field(wire, 'reference_number')),
    // Nullable in the domain, absent on the wire. Honest as null.
    caseId: null,
    residentId,
    householdId: null,
    status,
    purpose,
    assignedTo: id<StaffUserId>(field(wire, 'assigned_to')) ?? ('' as StaffUserId),
    scheduledFor,
    scheduledWindow: str(field(wire, 'scheduled_window')),
    addressVisited: text(field(wire, 'address_visited')),
    checklist: list(field(wire, 'checklist'), toChecklistItem),
    observations: list(field(wire, 'observations'), toObservation),
    serviceNeeds: str(field(wire, 'service_needs')),
    declinedReason: str(field(wire, 'declined_reason')),
    outcome: str(field(wire, 'outcome')),
    completedAt: dateTime(field(wire, 'completed_at')),
    audit: {
      createdAt: '' as never,
      createdBy: null,
      updatedAt: '' as never,
      updatedBy: null,
    },
  };
}

/**
 * One observation, with the kind it was recorded under.
 *
 * `DL-85` is the reason this is not a flat string: "the roof is missing sheets",
 * "she says he has not sent money since March" and "the household appears unable
 * to meet its food costs" are a fact, a report and a judgement. Written as one
 * paragraph they become indistinguishable, and six months on a different worker
 * reads all three as established fact about the family.
 *
 * The API holds the same line and enforces it — recording an attribution on
 * anything other than a third-party account is refused with
 * *"Only something said by a third party carries an attribution."* An
 * unrecognised kind is therefore dropped rather than coerced: guessing which of
 * the four an unknown value meant is guessing whose claim it was.
 */
function toObservation(wire: unknown): VisitObservation | null {
  const observationId = id<VisitObservationId>(field(wire, 'id'));
  const kind = oneOf<ObservationKind>(field(wire, 'kind'), OBSERVATION_KINDS);
  const body = str(field(wire, 'body'));
  const recordedAt = dateTime(field(wire, 'recorded_at'));

  if (observationId === null || kind === null || body === null || recordedAt === null) {
    return null;
  }

  return {
    id: observationId,
    kind,
    body,
    attributedTo: str(field(wire, 'attributed_to')),
    // The payload does not name the recorder. It is required by the domain, so
    // it is empty rather than invented — a wrong name against somebody's
    // observation is worse than none.
    recordedBy: '' as StaffUserId,
    recordedAt,
  };
}

function toChecklistItem(wire: unknown): VisitChecklistItem | null {
  const code = str(field(wire, 'code'));

  if (code === null) {
    return null;
  }

  return {
    code,
    label: text(field(wire, 'label'), code),
    checked: bool(field(wire, 'checked')),
    note: str(field(wire, 'note')),
  };
}

const STATUSES: readonly VisitStatus[] = ['scheduled', 'completed', 'not-found', 'refused', 'cancelled'];

const PURPOSES: readonly VisitPurpose[] = [
  'initial-assessment',
  'verification',
  'follow-up',
  'monitoring',
  'crisis-response',
  'document-collection',
];

const OBSERVATION_KINDS: readonly ObservationKind[] = [
  'observed',
  'client-said',
  'third-party-said',
  'worker-assessed',
];
