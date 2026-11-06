import {
  DISCLOSURE_BASES,
  REFERRAL_DESTINATIONS,
  REFERRAL_STATUS_CATALOG,
  REFERRAL_URGENCIES,
  SERVICE_PROVIDER_STATUS_LABELS,
  REFERRAL_CHANNEL_LABELS,
  SHARED_FIELDS,
  type AssistanceRequestId,
  type CaseId,
  type DisclosureBasis,
  type DisclosurePlan,
  type IsoDate,
  type Referral,
  type ReferralChannel,
  type ReferralDestination,
  type ReferralDraft,
  type ReferralId,
  type ReferralNote,
  type ReferralNoteId,
  type ReferralStatus,
  type ReferralSummarySheet,
  type ReferralUrgency,
  type ReferralWithheldField,
  type ResidentId,
  type ServiceProvider,
  type ServiceProviderId,
  type ServiceProviderStatus,
  type SharedField,
  type SharedFieldChoice,
  type StaffUserId,
  type SummaryLine,
} from '@domain/index';

import type { BarangayIndex } from './resident.mapper';
import { date, dateTime, field, flag, id, int, oneOf, str } from './wire';

/**
 * Referrals and the provider directory, from `office/referrals` and `office/service-providers`
 * (`DL-181`).
 *
 * The server withholds a protected client's words from a reader without `request.view-sensitive`
 * and says so in `withheld`; this mapper applies no disclosure rule of its own. A withheld sentence
 * arrives as `null` and is held as `''` beside `withheld: ['words']`, so the screen says "withheld"
 * rather than showing a blank. A sentence that is `null` **without** being withheld is a record this
 * console cannot read, and the whole referral is refused rather than shown with a hole in it.
 *
 * | Wire                     | Domain                         | Absent / unreadable                  |
 * | ------------------------ | ------------------------------ | ------------------------------------ |
 * | `disclosure`             | `disclosure` (`DisclosurePlan`)| null: no lawful basis recorded yet   |
 * | `disclosure.shared_fields` | `extraFields`                | a field it cannot name: not readable |
 * | `handoff_notes`          | `handoffNotes`                 | a note it cannot read: not readable  |
 * | `responded_at`           | `respondedAt`                  | null: nobody has answered            |
 * | `withheld`               | `withheld`                     | a name it has no word for: not readable |
 */

const STATUSES = Object.keys(REFERRAL_STATUS_CATALOG) as ReferralStatus[];
const PROVIDER_STATUSES = Object.keys(SERVICE_PROVIDER_STATUS_LABELS) as ServiceProviderStatus[];
const CHANNELS = Object.keys(REFERRAL_CHANNEL_LABELS) as ReferralChannel[];
const WITHHELD: readonly ReferralWithheldField[] = ['words'];

/** Every entry read, or `null` — never the readable part of a list presented as the whole of it. */
function every<T>(value: unknown, read: (item: unknown) => T | null): readonly T[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value.map(read);
  return items.every((item): item is T => item !== null) ? items : null;
}

/** A sentence, or `''` when the server withheld it; `null` when it is missing without a reason. */
function words(value: unknown, withheld: boolean): string | null {
  if (withheld) {
    return '';
  }
  return str(value);
}

function toNote(wire: unknown, withheld: boolean): ReferralNote | null {
  const noteId = id<ReferralNoteId>(field(wire, 'id'));
  const authorId = id<StaffUserId>(field(wire, 'author_id'));
  const recordedAt = dateTime(field(wire, 'recorded_at'));
  const isWithheld = flag(field(wire, 'is_withheld'));
  const body = words(field(wire, 'body'), withheld || isWithheld === true);
  if (noteId === null || authorId === null || recordedAt === null || isWithheld === null || body === null) {
    return null;
  }
  return {
    id: noteId,
    body,
    authorId,
    authorName: str(field(wire, 'author_name')) ?? 'A member of staff',
    recordedAt,
  };
}

function toChoice(wire: unknown, withheld: boolean): SharedFieldChoice | null {
  const shared = oneOf<SharedField>(field(wire, 'field'), SHARED_FIELDS);
  const because = words(field(wire, 'because'), withheld);
  return shared === null || because === null ? null : { field: shared, because };
}

function toDisclosure(wire: unknown, withheld: boolean): DisclosurePlan | null {
  const basis = oneOf<DisclosureBasis>(field(wire, 'basis'), DISCLOSURE_BASES);
  const note = words(field(wire, 'note'), withheld);
  const recordedBy = id<StaffUserId>(field(wire, 'recorded_by'));
  const recordedOn = date(field(wire, 'recorded_on'));
  const extraFields = every(field(wire, 'shared_fields'), (entry) => toChoice(entry, withheld));
  if (basis === null || note === null || recordedBy === null || recordedOn === null || extraFields === null) {
    return null;
  }
  return {
    authority: { basis, note, recordedBy, recordedOn },
    extraFields,
    // No act attaches a document to a referral yet; the server says so with an empty list.
    attachments: [],
  };
}

/**
 * One referral as the server disclosed it to this reader. `null` when it cannot be read whole.
 *
 * @consumes GET office/referrals
 * @consumes GET office/referrals/queue
 * @consumes GET office/referrals/{id}
 */
export function toReferral(wire: unknown): Referral | null {
  const referralId = id<ReferralId>(field(wire, 'id'));
  const referenceNumber = str(field(wire, 'reference_number'));
  const residentId = id<ResidentId>(field(wire, 'resident_id'));
  const destination = oneOf<ReferralDestination>(field(wire, 'destination'), REFERRAL_DESTINATIONS);
  const destinationName = str(field(wire, 'destination_name'));
  const status = oneOf<ReferralStatus>(field(wire, 'status'), STATUSES);
  const urgency = oneOf<ReferralUrgency>(field(wire, 'urgency'), REFERRAL_URGENCIES);
  const referredBy = id<StaffUserId>(field(wire, 'referred_by'));
  const referredAt = dateTime(field(wire, 'referred_at'));
  const createdAt = dateTime(field(wire, 'created_at'));
  const updatedAt = dateTime(field(wire, 'updated_at'));
  const withheld = every(field(wire, 'withheld'), (name) => oneOf(name, WITHHELD));
  if (
    referralId === null ||
    referenceNumber === null ||
    residentId === null ||
    destination === null ||
    destinationName === null ||
    status === null ||
    urgency === null ||
    referredBy === null ||
    referredAt === null ||
    createdAt === null ||
    updatedAt === null ||
    withheld === null
  ) {
    return null;
  }

  const masked = withheld.includes('words');
  const serviceRequested = words(field(wire, 'service_requested'), masked);
  const reason = words(field(wire, 'reason'), masked);
  const handoffNotes = every(field(wire, 'handoff_notes'), (entry) => toNote(entry, masked));
  const disclosureWire = field(wire, 'disclosure');
  const disclosure =
    disclosureWire === null || disclosureWire === undefined ? null : toDisclosure(disclosureWire, masked);
  if (
    serviceRequested === null ||
    reason === null ||
    handoffNotes === null ||
    (disclosureWire !== null && disclosureWire !== undefined && disclosure === null)
  ) {
    return null;
  }

  return {
    id: referralId,
    referenceNumber,
    residentId,
    requestId: id<AssistanceRequestId>(field(wire, 'request_id')),
    caseId: id<CaseId>(field(wire, 'case_id')),
    destination,
    destinationName,
    providerId: id<ServiceProviderId>(field(wire, 'provider_id')),
    status,
    urgency,
    serviceRequested,
    reason,
    destinationContact: str(field(wire, 'destination_contact')),
    disclosure,
    referredBy,
    referredAt,
    followUpOn: date(field(wire, 'follow_up_on')),
    respondedAt: dateTime(field(wire, 'responded_at')),
    outcome: masked ? null : str(field(wire, 'outcome')),
    handoffNotes,
    withheld,
    audit: {
      createdAt,
      createdBy: id<StaffUserId>(field(wire, 'created_by')),
      updatedAt,
      updatedBy: id<StaffUserId>(field(wire, 'updated_by')),
    },
  };
}

function toLine(wire: unknown): SummaryLine | null {
  const label = str(field(wire, 'label'));
  const value = str(field(wire, 'value'));
  const isExtra = flag(field(wire, 'is_extra'));
  return label === null || value === null || isExtra === null ? null : { label, value, isExtra };
}

/**
 * The sheet that leaves the building, as the server composed it from what was authorised (`DL-81`).
 * The server answers `null` while no basis is recorded, and for a reader the words are withheld
 * from; that arrives here as no wire at all.
 *
 * @consumes GET office/referrals/{id}/summary
 */
export function toReferralSummary(wire: unknown): ReferralSummarySheet | null {
  const referenceNumber = str(field(wire, 'reference_number'));
  const destinationName = str(field(wire, 'destination_name'));
  const serviceRequested = str(field(wire, 'service_requested'));
  const reason = str(field(wire, 'reason'));
  const lines = every(field(wire, 'lines'), toLine);
  const attachmentLabels = every(field(wire, 'attachment_labels'), str);
  const authorityStatement = str(field(wire, 'authority_statement'));
  const handlingNotice = str(field(wire, 'handling_notice'));
  if (
    referenceNumber === null ||
    destinationName === null ||
    serviceRequested === null ||
    reason === null ||
    lines === null ||
    attachmentLabels === null ||
    authorityStatement === null ||
    handlingNotice === null
  ) {
    return null;
  }
  return {
    referenceNumber,
    destinationName,
    serviceRequested,
    reason,
    lines,
    attachmentLabels,
    authorityStatement,
    handlingNotice,
  };
}

/**
 * One directory entry. Offices, not people.
 *
 * @consumes GET office/service-providers
 * @consumes GET office/service-providers/{id}
 */
export function toServiceProvider(wire: unknown, barangays: BarangayIndex): ServiceProvider | null {
  const providerId = id<ServiceProviderId>(field(wire, 'id'));
  const name = str(field(wire, 'name'));
  const destination = oneOf<ReferralDestination>(field(wire, 'destination'), REFERRAL_DESTINATIONS);
  const status = oneOf<ServiceProviderStatus>(field(wire, 'status'), PROVIDER_STATUSES);
  const servicesOffered = every(field(wire, 'services_offered'), str);
  const channels = every(field(wire, 'channels'), (channel) => oneOf<ReferralChannel>(channel, CHANNELS));
  const contact = field(wire, 'contact');
  const createdAt = dateTime(field(wire, 'created_at'));
  const updatedAt = dateTime(field(wire, 'updated_at'));
  const barangayWire = str(field(wire, 'barangay_id'));
  const barangayId = barangays.toConsole(barangayWire);
  if (
    providerId === null ||
    name === null ||
    destination === null ||
    status === null ||
    servicesOffered === null ||
    channels === null ||
    contact === null ||
    typeof contact !== 'object' ||
    createdAt === null ||
    updatedAt === null ||
    (barangayWire !== null && barangayId === null)
  ) {
    return null;
  }
  return {
    id: providerId,
    name,
    destination,
    status,
    servicesOffered,
    address: str(field(wire, 'address')),
    barangayId,
    contact: {
      personName: str(field(contact, 'person_name')),
      position: str(field(contact, 'position')),
      phone: str(field(contact, 'phone')),
      email: str(field(contact, 'email')),
    },
    channels,
    usualResponseDays: int(field(wire, 'usual_response_days')),
    notes: str(field(wire, 'notes')),
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

/** What `POST office/referrals` reads (`OfficeReferralDraft`). Drafting discloses nothing. */
export interface ReferralDraftWire {
  readonly resident_id: string;
  readonly request_id: string | null;
  readonly case_id: string | null;
  readonly provider_id: string | null;
  readonly destination: ReferralDestination;
  readonly destination_name: string;
  readonly destination_contact: string | null;
  readonly urgency: ReferralUrgency;
  readonly service_requested: string;
  readonly reason: string;
  readonly follow_up_on: IsoDate | null;
}

export function toWireReferralDraft(draft: ReferralDraft): ReferralDraftWire {
  return {
    resident_id: draft.residentId,
    request_id: draft.requestId,
    case_id: draft.caseId,
    provider_id: draft.providerId,
    destination: draft.destination,
    destination_name: draft.destinationName.trim(),
    destination_contact: trimmedOrNull(draft.destinationContact),
    urgency: draft.urgency,
    service_requested: draft.serviceRequested.trim(),
    reason: draft.reason.trim(),
    follow_up_on: draft.followUpOn,
  };
}

/** What `POST office/referrals/{id}/basis` reads (`OfficeReferralBasis`). */
export interface ReferralBasisWire {
  readonly basis: DisclosureBasis;
  readonly note: string;
}

export function toWireReferralBasis(basis: DisclosureBasis, note: string): ReferralBasisWire {
  return { basis, note: note.trim() };
}

/** What `POST office/referrals/{id}/shared-fields` reads (`OfficeReferralSharedField`): one field. */
export interface ReferralSharedFieldWire {
  readonly field: SharedField;
  readonly because: string;
}

export function toWireReferralSharedField(shared: SharedField, because: string): ReferralSharedFieldWire {
  return { field: shared, because: because.trim() };
}

/** What `POST office/referrals/{id}/status` reads (`OfficeReferralMove`). */
export interface ReferralMoveWire {
  readonly to: ReferralStatus;
  readonly reason: string;
}

export function toWireReferralMove(to: ReferralStatus, reason: string): ReferralMoveWire {
  return { to, reason: reason.trim() };
}

/** What `POST office/referrals/{id}/outcome` reads (`OfficeReferralOutcome`). */
export interface ReferralOutcomeWire {
  readonly outcome: string;
  readonly status: ReferralStatus;
}

export function toWireReferralOutcome(outcome: string, status: ReferralStatus): ReferralOutcomeWire {
  return { outcome: outcome.trim(), status };
}

/** What `POST office/referrals/{id}/follow-up` reads (`OfficeReferralFollowUp`). */
export interface ReferralFollowUpWire {
  readonly follow_up_on: IsoDate;
  readonly reason: string;
}

export function toWireReferralFollowUp(followUpOn: IsoDate, reason: string): ReferralFollowUpWire {
  return { follow_up_on: followUpOn, reason: reason.trim() };
}

/** What `POST office/referrals/{id}/notes` reads (`OfficeReferralNote`). */
export interface ReferralNoteWire {
  readonly body: string;
}

export function toWireReferralNote(body: string): ReferralNoteWire {
  return { body: body.trim() };
}
