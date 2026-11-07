import {
  AUDIT_ACTION_LABELS,
  AUDIT_DETAIL_RATIONALE,
  STAFF_ROLES,
  staffRoleLabel,
  barangayName,
  toAuditRow,
  type AuditAction,
  type AuditEntryDetail,
  type AuditEntryId,
  type AuditRow,
  type AuditSource,
  type ClassifiedRecordType,
  type CorrectableField,
  type CorrectionChange,
  type CorrectionRequest,
  type CorrectionStatus,
  type DataClassification,
  type ResidentId,
  type RetentionProvenance,
  type RetentionRule,
  type StaffAccount,
  type StaffUserId,
} from '@domain/index';

import type { BarangayIndex } from './resident.mapper';
import { dateTime, field, flag, id, int, list, oneOf, str } from './wire';

/**
 * Governance, read off the Node API (`DL-191`).
 *
 * **What the API does not hold is said, never filled in.** A staff account there has no employee ID,
 * unit, office contact, position or record of a sign-in, so `profile` is null, `position` is null and
 * `lastSignInRecorded` is false — the screen says "Not recorded", never "Never" or a blank. The
 * trail records no field names and no values, so a row says `fieldsRecorded: false` and is not
 * counted as touching sensitive information either way.
 *
 * **A row that claims more than this mapper can read is refused, not trimmed.** A trail row saying
 * its fields were recorded, a detail carrying values, a retention period with no office schedule
 * behind it: each is a shape this console has not been told how to show safely, and the page is not
 * shown rather than shown with a guess (`DL-114`, `DL-113`).
 */

const TIERS = ['staff', 'admin'] as const;
const SOURCES: readonly AuditSource[] = ['api', 'system'];
const AUDIT_ACTIONS = Object.keys(AUDIT_ACTION_LABELS) as AuditAction[];
const CLASSIFICATIONS: readonly DataClassification[] = [
  'public',
  'internal',
  'personal',
  'sensitive-personal',
];
const PROVENANCES: readonly RetentionProvenance[] = ['office-policy', 'awaiting-office-policy'];
const CORRECTION_STATUSES: readonly CorrectionStatus[] = [
  'raised',
  'applied',
  'refused',
  'withdrawn',
];

/** The wire's column names for the twelve correctable fields — the transport seam's to name. */
const CORRECTABLE_ON_THE_WIRE: Readonly<Record<string, CorrectableField>> = {
  first_name: 'firstName',
  middle_name: 'middleName',
  last_name: 'lastName',
  suffix: 'suffix',
  birth_date: 'birthDate',
  sex: 'sex',
  civil_status: 'civilStatus',
  barangay_id: 'barangayId',
  street_address: 'streetAddress',
  purok_or_sitio: 'purokOrSitio',
  mobile_number: 'mobileNumber',
  email: 'email',
};

export const STAFF_NAME_NOT_RECORDED = 'No name recorded';

/**
 * `GET office/staff` → a directory entry, or `null` for one this console cannot place.
 *
 * @consumes GET office/staff
 * @consumes GET office/staff/{id}
 * @consumes POST office/staff/{id}/deactivate
 * @consumes POST office/staff/{id}/reactivate
 */
export function toStaffAccount(wire: unknown, barangays: BarangayIndex): StaffAccount | null {
  const staffId = id<StaffUserId>(field(wire, 'id'));
  const tier = oneOf(field(wire, 'role'), TIERS);
  const isActive = flag(field(wire, 'is_active'));
  const sentRole = field(wire, 'office_role');
  const role = sentRole === null ? null : oneOf(sentRole, STAFF_ROLES);
  if (staffId === null || tier === null || isActive === null) {
    return null;
  }
  if (sentRole !== null && role === null) {
    return null;
  }
  // An administrator is always the system administrator; a staff account never is (`DL-173`).
  if ((tier === 'admin') !== (role === 'system-administrator')) {
    return null;
  }
  const apiBarangay = str(field(wire, 'scope_barangay_id'));
  const barangayId = apiBarangay === null ? null : barangays.toConsole(apiBarangay);
  if (apiBarangay !== null && barangayId === null) {
    return null;
  }
  return {
    staffId,
    displayName: str(field(wire, 'name')) ?? STAFF_NAME_NOT_RECORDED,
    role,
    roleLabel: staffRoleLabel(role),
    position: null,
    barangayId,
    barangayLabel: barangayId === null ? null : barangayName(barangayId),
    isActive,
    lastSignInAt: null,
    lastSignInRecorded: false,
    profile: null,
    // The API grants by office role alone; there is no per-account grant to count.
    additionalPermissionCount: 0,
  };
}

/** The body of `office/staff/{id}/deactivate` and `…/reactivate`: the reason, and nothing else. */
export interface AccountSwitchWire {
  readonly reason: string;
}

export function toWireAccountSwitch(reason: string): AccountSwitchWire {
  return { reason };
}

/**
 * `GET office/audit` → one row of the office's trail, or `null` for one it cannot read whole.
 *
 * @consumes GET office/audit
 */
export function toGovernanceAuditRow(wire: unknown): AuditRow | null {
  const entryId = id<AuditEntryId>(field(wire, 'id'));
  const action = oneOf(field(wire, 'category'), AUDIT_ACTIONS);
  const recordType = str(field(wire, 'record_type'));
  const recordLabel = str(field(wire, 'record_label'));
  const summary = str(field(wire, 'summary'));
  const actorName = str(field(wire, 'actor_name'));
  const occurredAt = dateTime(field(wire, 'occurred_at'));
  const source = oneOf(field(wire, 'source'), SOURCES);
  const sentActor = field(wire, 'actor_id');
  const actorId = sentActor === null ? null : id<StaffUserId>(sentActor);
  const sentRecord = field(wire, 'record_id');
  const recordId = sentRecord === null ? null : str(sentRecord);
  if (
    entryId === null ||
    action === null ||
    recordType === null ||
    recordLabel === null ||
    summary === null ||
    actorName === null ||
    occurredAt === null ||
    source === null
  ) {
    return null;
  }
  if (
    (sentActor !== null && actorId === null) ||
    (sentRecord !== null && recordId === null) ||
    // Only "not recorded" is a shape this mapper reads; recorded fields would need their names.
    flag(field(wire, 'fields_recorded')) !== false
  ) {
    return null;
  }
  return toAuditRow(
    {
      id: entryId,
      entityType: recordType,
      entityId: recordId ?? '',
      action,
      summary,
      // Kept with the record it explains, not on the trail (`DL-191`).
      reason: null,
      actorId,
      actorName,
      occurredAt,
    },
    recordLabel,
    source,
    null,
    false,
  );
}

/**
 * `GET office/audit/{id}` → what the trail recorded, which on this API is no value.
 *
 * @consumes GET office/audit/{id}
 */
export function toGovernanceAuditDetail(wire: unknown): AuditEntryDetail | null {
  const entryId = id<AuditEntryId>(field(wire, 'id'));
  const notice = str(field(wire, 'notice'));
  const changes = field(wire, 'changes');
  if (entryId === null || notice === null) {
    return null;
  }
  if (
    flag(field(wire, 'values_recorded')) !== false ||
    !Array.isArray(changes) ||
    changes.length > 0
  ) {
    return null;
  }
  return {
    id: entryId,
    changes: [],
    valuesRecorded: false,
    notRecorded: notice,
    accessRationale: AUDIT_DETAIL_RATIONALE,
  };
}

/**
 * One classified record type: reference data about no person.
 *
 * @consumes GET office/governance/classifications
 */
export function toClassifiedRecordType(wire: unknown): ClassifiedRecordType | null {
  const key = str(field(wire, 'key'));
  const label = str(field(wire, 'label'));
  const classification = oneOf(field(wire, 'classification'), CLASSIFICATIONS);
  const holds = str(field(wire, 'holds'));
  if (key === null || label === null || classification === null || holds === null) {
    return null;
  }
  return { key, label, classification, holds };
}

/**
 * A retention rule. A period with no office schedule behind it is refused: an invented period is the
 * one invented policy an office cannot undo once it has deleted on the strength of it (`DL-113`).
 *
 * @consumes GET office/governance/retention
 */
export function toRetentionRule(wire: unknown): RetentionRule | null {
  const recordTypeKey = str(field(wire, 'record_type_key'));
  const label = str(field(wire, 'label'));
  const classification = oneOf(field(wire, 'classification'), CLASSIFICATIONS);
  const provenance = oneOf(field(wire, 'provenance'), PROVENANCES);
  const sentPeriod = field(wire, 'period_in_years');
  const periodInYears = sentPeriod === null ? null : int(sentPeriod);
  const sentBasis = field(wire, 'basis');
  const basis = sentBasis === null ? null : str(sentBasis);
  const sentNote = field(wire, 'disposal_note');
  const disposalNote = sentNote === null ? null : str(sentNote);
  if (recordTypeKey === null || label === null || classification === null || provenance === null) {
    return null;
  }
  if (
    (sentPeriod !== null && periodInYears === null) ||
    (sentBasis !== null && basis === null) ||
    (sentNote !== null && disposalNote === null) ||
    (provenance === 'awaiting-office-policy' && (periodInYears !== null || basis !== null)) ||
    (provenance === 'office-policy' && (periodInYears === null || basis === null))
  ) {
    return null;
  }
  return { recordTypeKey, label, classification, periodInYears, provenance, basis, disposalNote };
}

export const RESIDENT_NOT_LISTED = 'A resident the registry does not list for you';

/**
 * `GET office/governance/corrections` → one request and its answer, or `null`.
 *
 * @consumes GET office/governance/corrections
 */
export function toCorrectionRequest(wire: unknown): CorrectionRequest | null {
  const requestId = str(field(wire, 'id'));
  const residentId = id<ResidentId>(field(wire, 'resident_id'));
  const claim = str(field(wire, 'claim'));
  const status = oneOf(field(wire, 'status'), CORRECTION_STATUSES);
  const raisedBy = id<StaffUserId>(field(wire, 'raised_by'));
  const raisedAt = dateTime(field(wire, 'raised_at'));
  const sentDecider = field(wire, 'decided_by');
  const decidedBy = sentDecider === null ? null : id<StaffUserId>(sentDecider);
  const sentDecided = field(wire, 'decided_at');
  const decidedAt = sentDecided === null ? null : dateTime(sentDecided);
  const sentOutcome = field(wire, 'outcome');
  const outcome = sentOutcome === null ? null : str(sentOutcome);
  const sentFields = field(wire, 'fields');
  const changes = list(sentFields, toCorrectionChange);
  if (
    requestId === null ||
    residentId === null ||
    claim === null ||
    status === null ||
    raisedBy === null ||
    raisedAt === null
  ) {
    return null;
  }
  if (
    (sentDecider !== null && decidedBy === null) ||
    (sentDecided !== null && decidedAt === null) ||
    (sentOutcome !== null && outcome === null) ||
    !Array.isArray(sentFields) ||
    changes.length !== sentFields.length ||
    // An answer without its words is the one a resident cannot challenge (`DL-117`).
    ((status === 'applied' || status === 'refused') && outcome === null)
  ) {
    return null;
  }
  return {
    id: requestId,
    residentId,
    residentName: str(field(wire, 'resident_name')) ?? RESIDENT_NOT_LISTED,
    changes,
    claim,
    status,
    raisedBy,
    raisedByName: str(field(wire, 'raised_by_name')) ?? STAFF_NAME_NOT_RECORDED,
    raisedAt,
    outcome,
    decidedBy,
    decidedAt,
    audit: {
      createdAt: raisedAt,
      createdBy: raisedBy,
      updatedAt: decidedAt ?? raisedAt,
      updatedBy: decidedBy ?? raisedBy,
    },
  };
}

function toCorrectionChange(wire: unknown): CorrectionChange | null {
  const name = str(field(wire, 'field'));
  const correctable = name === null ? undefined : CORRECTABLE_ON_THE_WIRE[name];
  if (correctable === undefined) {
    return null;
  }
  return {
    field: correctable,
    currentValue: str(field(wire, 'current_value')),
    proposedValue: str(field(wire, 'proposed_value')),
  };
}
