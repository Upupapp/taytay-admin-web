import {
  OBSERVATION_KINDS,
  VISIT_PURPOSES,
  VISIT_STATUS_CATALOG,
  type CaseId,
  type FieldVisit,
  type FieldVisitDraft,
  type FieldVisitId,
  type HouseholdId,
  type IsoDate,
  type ObservationKind,
  type ResidentId,
  type StaffUserId,
  type VisitChecklistItem,
  type VisitChecklistSelection,
  type VisitObservation,
  type VisitObservationDraft,
  type VisitObservationId,
  type VisitOutcomeDraft,
  type VisitPurpose,
  type VisitStatus,
  type VisitWithheldField,
} from '@domain/index';

import { date, dateTime, field, flag, id, oneOf, str } from './wire';

/**
 * Field visits, from `office/visits` (`DL-181`).
 *
 * What is read is what the server holds: the address the visit was made to and what was found
 * there. There is no field here, read or sent, for where anybody was — no coordinate, check-in,
 * route, arrival time or device (`DL-86`); `completed_at` and `recorded_at` are when the office
 * record received the outcome or the line, the server's clock.
 *
 * A protected household's words and address arrive `null` with `withheld` naming them, and are
 * held as `''`; a caseload reader is not given the household (`household`). This mapper applies no
 * disclosure rule of its own, and a sentence missing without being withheld makes the visit
 * unreadable rather than blank.
 *
 * | Wire               | Domain            | Absent / unreadable                             |
 * | ------------------ | ----------------- | ----------------------------------------------- |
 * | `observations`     | `observations`    | a line it cannot read, or a kind it has no word for: not readable |
 * | `attributed_to`    | `attributedTo`    | null for every kind but `third-party-said`      |
 * | `checklist`        | `checklist`       | a line it cannot read: not readable             |
 * | `completed_at`     | `completedAt`     | null while scheduled                            |
 * | `withheld`         | `withheld`        | a name it has no word for: not readable         |
 */

const STATUSES = Object.keys(VISIT_STATUS_CATALOG) as VisitStatus[];
const WITHHELD: readonly VisitWithheldField[] = ['words', 'address', 'household'];

function every<T>(value: unknown, read: (item: unknown) => T | null): readonly T[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value.map(read);
  return items.every((item): item is T => item !== null) ? items : null;
}

function toObservation(wire: unknown, withheld: boolean): VisitObservation | null {
  const observationId = id<VisitObservationId>(field(wire, 'id'));
  const kind = oneOf<ObservationKind>(field(wire, 'kind'), OBSERVATION_KINDS);
  const recordedBy = id<StaffUserId>(field(wire, 'recorded_by'));
  const recordedAt = dateTime(field(wire, 'recorded_at'));
  const isWithheld = flag(field(wire, 'is_withheld'));
  if (observationId === null || kind === null || recordedBy === null || recordedAt === null || isWithheld === null) {
    return null;
  }
  const masked = withheld || isWithheld;
  const body = masked ? '' : str(field(wire, 'body'));
  const attributedTo = masked ? null : str(field(wire, 'attributed_to'));
  // A third party's account names who gave it; a line that says otherwise is not read (DL-85).
  if (body === null || (!masked && (kind === 'third-party-said') !== (attributedTo !== null))) {
    return null;
  }
  return { id: observationId, kind, body, attributedTo, recordedBy, recordedAt };
}

function toChecklistItem(wire: unknown): VisitChecklistItem | null {
  const code = str(field(wire, 'code'));
  const label = str(field(wire, 'label'));
  const checked = flag(field(wire, 'checked'));
  return code === null || label === null || checked === null ? null : { code, label, checked, note: null };
}

/**
 * One visit as the server disclosed it to this reader. `null` when it cannot be read whole.
 *
 * @consumes GET office/visits
 * @consumes GET office/visits/{id}
 */
export function toFieldVisit(wire: unknown): FieldVisit | null {
  const visitId = id<FieldVisitId>(field(wire, 'id'));
  const referenceNumber = str(field(wire, 'reference_number'));
  const residentId = id<ResidentId>(field(wire, 'resident_id'));
  const status = oneOf<VisitStatus>(field(wire, 'status'), STATUSES);
  const purpose = oneOf<VisitPurpose>(field(wire, 'purpose'), VISIT_PURPOSES);
  const assignedTo = id<StaffUserId>(field(wire, 'assigned_to'));
  const scheduledFor = date(field(wire, 'scheduled_for'));
  const createdAt = dateTime(field(wire, 'created_at'));
  const updatedAt = dateTime(field(wire, 'updated_at'));
  const withheld = every(field(wire, 'withheld'), (name) => oneOf(name, WITHHELD));
  const checklist = every(field(wire, 'checklist'), toChecklistItem);
  if (
    visitId === null ||
    referenceNumber === null ||
    residentId === null ||
    status === null ||
    purpose === null ||
    assignedTo === null ||
    scheduledFor === null ||
    createdAt === null ||
    updatedAt === null ||
    withheld === null ||
    checklist === null
  ) {
    return null;
  }

  const masked = withheld.includes('words');
  const addressVisited = withheld.includes('address') ? '' : str(field(wire, 'address_visited'));
  const observations = every(field(wire, 'observations'), (entry) => toObservation(entry, masked));
  if (addressVisited === null || observations === null) {
    return null;
  }

  return {
    id: visitId,
    referenceNumber,
    caseId: id<CaseId>(field(wire, 'case_id')),
    residentId,
    householdId: id<HouseholdId>(field(wire, 'household_id')),
    status,
    purpose,
    assignedTo,
    scheduledFor,
    scheduledWindow: str(field(wire, 'scheduled_window')),
    addressVisited,
    checklist,
    observations,
    serviceNeeds: masked ? null : str(field(wire, 'service_needs')),
    declinedReason: masked ? null : str(field(wire, 'declined_reason')),
    outcome: masked ? null : str(field(wire, 'outcome')),
    completedAt: dateTime(field(wire, 'completed_at')),
    withheld,
    audit: {
      createdAt,
      createdBy: id<StaffUserId>(field(wire, 'created_by')),
      updatedAt,
      updatedBy: id<StaffUserId>(field(wire, 'updated_by')),
    },
  };
}

/* ── what each write sends ────────────────────────────────────────────────────────────────── */

const trimmedOrNull = (value: string | null): string | null => {
  const trimmed = value?.trim() ?? '';
  return trimmed === '' ? null : trimmed;
};

/**
 * What `POST office/visits` reads (`OfficeVisitSchedule`): what the visit is for, who goes, when,
 * and the address. The checklist goes as prompts — codes and labels — with nothing ticked.
 */
export interface VisitScheduleWire {
  readonly resident_id: string;
  readonly case_id: string | null;
  readonly household_id: string | null;
  readonly purpose: VisitPurpose;
  readonly assigned_to: string;
  readonly scheduled_for: IsoDate;
  readonly scheduled_window: string | null;
  readonly address_visited: string;
  readonly checklist: readonly VisitChecklistPromptWire[];
}

/** One line of the checklist as it is set: a prompt, with nothing ticked. */
export interface VisitChecklistPromptWire {
  readonly code: string;
  readonly label: string;
}

export function toWireVisitSchedule(draft: FieldVisitDraft): VisitScheduleWire {
  return {
    resident_id: draft.residentId,
    case_id: draft.caseId,
    household_id: draft.householdId,
    purpose: draft.purpose,
    assigned_to: draft.assignedTo,
    scheduled_for: draft.scheduledFor,
    scheduled_window: trimmedOrNull(draft.scheduledWindow),
    address_visited: draft.addressVisited.trim(),
    checklist: draft.checklist.map((item) => ({ code: item.code, label: item.label })),
  };
}

/** What `POST office/visits/{id}/observations` reads (`OfficeVisitObservations`). Appended. */
export interface VisitObservationsWire {
  readonly observations: readonly VisitObservationWire[];
}

/** One observation: its kind, what was found or said, and — for a third party's account — whose. */
export interface VisitObservationWire {
  readonly kind: ObservationKind;
  readonly body: string;
  readonly attributed_to: string | null;
}

export function toWireVisitObservations(
  observations: readonly VisitObservationDraft[],
): VisitObservationsWire {
  return {
    observations: observations.map((entry) => ({
      kind: entry.kind,
      body: entry.body.trim(),
      attributed_to: trimmedOrNull(entry.attributedTo),
    })),
  };
}

/** What `POST office/visits/{id}/checklist` reads (`OfficeVisitChecklist`): every line, with its state. */
export interface VisitChecklistWire {
  readonly items: readonly VisitChecklistLineWire[];
}

/** One line, with the state it should end in. */
export interface VisitChecklistLineWire {
  readonly code: string;
  readonly checked: boolean;
}

export function toWireVisitChecklist(items: readonly VisitChecklistSelection[]): VisitChecklistWire {
  return { items: items.map((item) => ({ code: item.code, checked: item.checked })) };
}

/** What `POST office/visits/{id}/close` reads (`OfficeVisitClose`). Once. */
export interface VisitCloseWire {
  readonly status: VisitOutcomeDraft['status'];
  readonly outcome: string;
  readonly service_needs: string | null;
  readonly declined_reason: string | null;
}

export function toWireVisitClose(outcome: VisitOutcomeDraft): VisitCloseWire {
  return {
    status: outcome.status,
    outcome: outcome.outcome.trim(),
    service_needs: trimmedOrNull(outcome.serviceNeeds),
    // A refusal's alone: on any other outcome it would put words in a household's mouth.
    declined_reason: outcome.status === 'refused' ? trimmedOrNull(outcome.declinedReason) : null,
  };
}
