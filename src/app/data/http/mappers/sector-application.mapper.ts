import {
  APPLICATION_SECTORS,
  SECTOR_APPLICATION_STATUSES,
  type AppAccountId,
  type ApplicantRecord,
  type MediaId,
  type ResidentId,
  type SectorApplication,
  type SectorApplicationDetail,
  type SectorApplicationId,
  type SectorApproval,
} from '@domain/index';

import type { BarangayIndex } from './resident.mapper';
import { dateTime, field, id, int, oneOf, str } from './wire';

function nameOf(value: unknown): string | null | undefined {
  if (value === null) return null;
  const name = field(value, 'name');
  if (name === null) return null;
  return str(name) ?? undefined;
}

/**
 * `SectorApplication` → `SectorApplication` (`DL-215`).
 *
 * | wire                     | domain                    | if absent or malformed      |
 * | ------------------------ | ------------------------- | --------------------------- |
 * | `id`                     | `id`                      | not readable                |
 * | `sector`                 | `sector`                  | not readable                |
 * | `status`                 | `status`                  | not readable                |
 * | `submitted_at`           | `submittedAt`             | not readable                |
 * | `decided_at`             | `decidedAt`               | `null` only when `null`     |
 * | `decided_by.name`        | `decidedBy`               | `null` only when `null`     |
 * | `return_reason`          | `returnReason`            | `null` only when `null`     |
 * | `resident_id`            | `residentId`              | `null` only when `null`     |
 * | `proof_count`            | `proofCount`              | not readable                |
 * | `applicant.id`           | `applicant.account`       | not readable                |
 * | `applicant.name`         | `applicant.name`          | no name                     |
 * | `applicant.barangay.name`| `applicant.barangayName`  | no barangay                 |
 *
 * @consumes GET office/sector-applications
 * @consumes POST office/sector-applications/{id}/approve
 * @consumes POST office/sector-applications/{id}/return
 */
export function toSectorApplication(wire: unknown): SectorApplication | null {
  const applicationId = id<SectorApplicationId>(field(wire, 'id'));
  const sector = oneOf(field(wire, 'sector'), APPLICATION_SECTORS);
  const status = oneOf(field(wire, 'status'), SECTOR_APPLICATION_STATUSES);
  const submittedAt = dateTime(field(wire, 'submitted_at'));
  const rawDecidedAt = field(wire, 'decided_at');
  const decidedAt = rawDecidedAt === null ? null : dateTime(rawDecidedAt);
  const decidedBy = nameOf(field(wire, 'decided_by'));
  const rawReason = field(wire, 'return_reason');
  const returnReason = rawReason === null ? null : str(rawReason);
  const rawResident = field(wire, 'resident_id');
  const residentId = rawResident === null ? null : id<ResidentId>(rawResident);
  const proofCount = int(field(wire, 'proof_count'));
  const applicant = field(wire, 'applicant');
  const account = id<AppAccountId>(field(applicant, 'id'));

  if (
    applicationId === null ||
    sector === null ||
    status === null ||
    submittedAt === null ||
    (rawDecidedAt !== null && decidedAt === null) ||
    decidedBy === undefined ||
    (rawReason !== null && returnReason === null) ||
    (rawResident !== null && residentId === null) ||
    proofCount === null ||
    account === null
  ) {
    return null;
  }

  return {
    id: applicationId,
    sector,
    status,
    submittedAt,
    decidedAt,
    decidedBy,
    returnReason,
    residentId,
    proofCount,
    applicant: {
      account,
      name: str(field(applicant, 'name')),
      barangayName: str(field(field(applicant, 'barangay'), 'name')),
    },
  };
}

function toApplicantRecord(wire: unknown, barangays: BarangayIndex): ApplicantRecord | null {
  const residentId = id<ResidentId>(field(wire, 'resident_id'));
  const name = str(field(wire, 'name'));
  if (residentId === null || name === null) return null;
  return { residentId, name, barangayId: barangays.toConsole(str(field(wire, 'barangay_id'))) };
}

/**
 * `SectorApplicationDetail` → `SectorApplicationDetail` (`DL-215`): the row, the proofs by media id,
 * the API's warning before a proof is opened, the linked record or the suggested ones, and whether
 * this reader may record the card's details. Whole or nothing.
 *
 * **Not read**: a record's `birth_date` — every candidate shares the account's (`DL-73`).
 *
 * @consumes GET office/sector-applications/{id}
 */
export function toSectorApplicationDetail(
  wire: unknown,
  barangays: BarangayIndex,
): SectorApplicationDetail | null {
  const base = toSectorApplication(wire);
  const proofsWire = field(wire, 'proofs');
  const proofs = Array.isArray(proofsWire)
    ? proofsWire.map((proof) => id<MediaId>(field(proof, 'media_id')))
    : null;
  const proofWarning = str(field(wire, 'proof_warning'));
  const rawLinked = field(wire, 'linked_resident');
  const linkedResident = rawLinked === null ? null : toApplicantRecord(rawLinked, barangays);
  const candidatesWire = field(wire, 'candidates');
  const candidates = Array.isArray(candidatesWire)
    ? candidatesWire.map((candidate) => toApplicantRecord(candidate, barangays))
    : null;
  const detailsWritable = field(wire, 'details_writable');

  if (
    base === null ||
    proofs === null ||
    proofs.some((proof) => proof === null) ||
    proofWarning === null ||
    (rawLinked !== null && linkedResident === null) ||
    candidates === null ||
    candidates.some((candidate) => candidate === null) ||
    typeof detailsWritable !== 'boolean'
  ) {
    return null;
  }

  return {
    ...base,
    proofs: proofs.filter((proof): proof is MediaId => proof !== null),
    proofWarning,
    linkedResident,
    candidates: candidates.filter((candidate): candidate is ApplicantRecord => candidate !== null),
    detailsWritable,
  };
}

/** `SectorApplicationApproveBody`: the reason, the link when one is made, the card's details. */
export interface SectorApplicationApproveWire {
  readonly reason: string;
  readonly resident_id?: string;
  readonly link_reason?: string;
  readonly id_number?: string;
  readonly issued_on?: string;
  readonly valid_until?: string;
  readonly social_pension?: boolean;
  readonly disability_type?: string;
}

export function toWireSectorApproval(approval: SectorApproval): SectorApplicationApproveWire {
  const details = approval.details;
  const idLastFour = details?.idLastFour?.trim();
  const disabilityType = details?.disabilityType?.trim();
  return {
    reason: approval.reason.trim(),
    ...(approval.link === undefined
      ? {}
      : { resident_id: approval.link.residentId, link_reason: approval.link.reason.trim() }),
    ...(idLastFour === undefined || idLastFour === '' ? {} : { id_number: idLastFour }),
    ...(details?.issuedOn === undefined ? {} : { issued_on: details.issuedOn }),
    ...(details?.validUntil === undefined ? {} : { valid_until: details.validUntil }),
    ...(details?.socialPension === undefined ? {} : { social_pension: details.socialPension }),
    ...(disabilityType === undefined || disabilityType === ''
      ? {}
      : { disability_type: disabilityType }),
  };
}

/** `ReasonBody`: the reason the resident reads. */
export interface SectorApplicationReturnWire {
  readonly reason: string;
}

export function toWireSectorReturn(reason: string): SectorApplicationReturnWire {
  return { reason: reason.trim() };
}
