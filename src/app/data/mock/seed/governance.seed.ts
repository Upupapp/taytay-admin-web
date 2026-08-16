import {
  asId,
  type AuditEntry,
  type AuditEntryId,
  type AuditFieldChange,
  type AuditSource,
  type AuditValueChange,
  type CorrectionRequest,
  type StaffProfile,
  type StaffUserId,
} from '@domain/index';

import { daysBeforeAnchor, stamp } from './seed-utils';

/**
 * Directory entries for the staff on file.
 *
 * Held apart from the account itself (`DL-115`): a role is office structure, a
 * mobile number is personal information about an employee with the same
 * protection a resident's has.
 */
export const MOCK_STAFF_PROFILES: readonly StaffProfile[] = [
  {
    staffId: asId<StaffUserId>('staff-admin'),
    employeeId: 'TR-MSWDO-0001',
    unit: 'Office of the head',
    contactNumber: '(02) 8286 1234 loc. 101',
    officeEmail: 'marisol.alcantara@taytayrizal.gov.ph',
    audit: stamp(400, 30),
  },
  {
    staffId: asId<StaffUserId>('staff-head'),
    employeeId: 'TR-MSWDO-0002',
    unit: 'Office of the head',
    contactNumber: '(02) 8286 1234 loc. 102',
    officeEmail: 'teodoro.lim@taytayrizal.gov.ph',
    audit: stamp(400, 30),
  },
  {
    staffId: asId<StaffUserId>('staff-sw-1'),
    employeeId: 'TR-MSWDO-0011',
    unit: 'Casework',
    contactNumber: '(02) 8286 1234 loc. 120',
    officeEmail: 'grace.ocampo@taytayrizal.gov.ph',
    audit: stamp(360, 30),
  },
  {
    staffId: asId<StaffUserId>('staff-sw-2'),
    employeeId: 'TR-MSWDO-0012',
    unit: 'Casework',
    contactNumber: null,
    officeEmail: 'jomar.villanueva@taytayrizal.gov.ph',
    audit: stamp(300, 30),
  },
  {
    staffId: asId<StaffUserId>('staff-intake'),
    employeeId: 'TR-MSWDO-0021',
    unit: 'Intake and records',
    contactNumber: '(02) 8286 1234 loc. 110',
    officeEmail: 'liezl.padilla@taytayrizal.gov.ph',
    audit: stamp(300, 30),
  },
  {
    staffId: asId<StaffUserId>('staff-disbursement'),
    employeeId: 'TR-MSWDO-0031',
    unit: 'Disbursement',
    contactNumber: '(02) 8286 1234 loc. 140',
    officeEmail: 'ronald.mendoza@taytayrizal.gov.ph',
    audit: stamp(280, 30),
  },
  {
    staffId: asId<StaffUserId>('staff-brgy-link'),
    employeeId: 'TR-BRGY-0104',
    unit: 'Barangay link — San Juan',
    contactNumber: null,
    officeEmail: 'anabelle.gatchalian@taytayrizal.gov.ph',
    audit: stamp(200, 30),
  },
  {
    staffId: asId<StaffUserId>('staff-auditor'),
    employeeId: 'TR-INT-0002',
    unit: 'Internal audit',
    contactNumber: '(02) 8286 1234 loc. 190',
    officeEmail: 'perla.enriquez@taytayrizal.gov.ph',
    audit: stamp(200, 30),
  },
];

/**
 * The office-wide trail.
 *
 * Each entry says **what happened** and **which fields moved**, and carries no
 * recorded value at all. The values live in `MOCK_AUDIT_DETAILS`, keyed by
 * entry id, so a row physically cannot quote one (`DL-114`).
 */
export const MOCK_AUDIT_ENTRIES: readonly AuditEntry[] = [
  {
    id: asId<AuditEntryId>('aud-0001'),
    entityType: 'resident',
    entityId: 'res-0002',
    action: 'created',
    summary: 'Registered a new resident record.',
    reason: null,
    actorId: asId<StaffUserId>('staff-intake'),
    actorName: 'Liezl Padilla',
    occurredAt: daysBeforeAnchor(40, 9),
  },
  {
    id: asId<AuditEntryId>('aud-0002'),
    entityType: 'resident',
    entityId: 'res-0002',
    action: 'updated',
    summary: 'Corrected the household means figure after the family brought payslips.',
    reason: 'Payslips presented at the counter did not match what was first recorded.',
    actorId: asId<StaffUserId>('staff-intake'),
    actorName: 'Liezl Padilla',
    occurredAt: daysBeforeAnchor(38, 11),
  },
  {
    id: asId<AuditEntryId>('aud-0003'),
    entityType: 'assistance-request',
    entityId: 'req-0001',
    action: 'status-changed',
    summary: 'Endorsed for approval.',
    reason: 'Assessment complete and the requirements are in order.',
    actorId: asId<StaffUserId>('staff-sw-1'),
    actorName: 'Grace Ocampo',
    occurredAt: daysBeforeAnchor(8, 15),
  },
  {
    id: asId<AuditEntryId>('aud-0004'),
    entityType: 'resident',
    entityId: 'res-0005',
    action: 'updated',
    summary: 'Added a protection sector to a resident record.',
    reason: 'Disclosed during a home visit and confirmed with the client.',
    actorId: asId<StaffUserId>('staff-sw-1'),
    actorName: 'Grace Ocampo',
    occurredAt: daysBeforeAnchor(6, 14),
  },
  {
    id: asId<AuditEntryId>('aud-0005'),
    entityType: 'resident',
    entityId: 'res-0003',
    action: 'updated',
    summary: 'Updated a contact number.',
    reason: null,
    actorId: asId<StaffUserId>('staff-intake'),
    actorName: 'Liezl Padilla',
    occurredAt: daysBeforeAnchor(5, 10),
  },
  {
    id: asId<AuditEntryId>('aud-0006'),
    entityType: 'report',
    entityId: 'data-completeness',
    action: 'exported',
    summary: 'Exported a report that names individual residents.',
    reason: 'Records clean-up for the quarter.',
    actorId: asId<StaffUserId>('staff-head'),
    actorName: 'Teodoro Lim',
    occurredAt: daysBeforeAnchor(4, 16),
  },
  {
    id: asId<AuditEntryId>('aud-0007'),
    entityType: 'case',
    entityId: 'case-0001',
    action: 'viewed',
    summary: 'Opened a protected case note.',
    reason: null,
    actorId: asId<StaffUserId>('staff-sw-2'),
    actorName: 'Jomar Villanueva',
    occurredAt: daysBeforeAnchor(3, 11),
  },
  {
    id: asId<AuditEntryId>('aud-0008'),
    entityType: 'staff',
    entityId: 'staff-brgy-link',
    action: 'status-changed',
    summary: 'Deactivated a staff account.',
    reason: 'Barangay focal person reassigned; access no longer required.',
    actorId: asId<StaffUserId>('staff-admin'),
    actorName: 'Marisol Alcantara',
    occurredAt: daysBeforeAnchor(2, 9),
  },
];

/** Which fields moved on each entry, named and classified but never quoted. */
export const MOCK_AUDIT_FIELDS: Readonly<Record<string, readonly AuditFieldChange[]>> = {
  'aud-0002': [
    { field: 'monthlyIncome', label: 'Monthly income', classification: 'personal' },
  ],
  'aud-0004': [
    { field: 'sectors', label: 'Protection sectors', classification: 'sensitive-personal' },
  ],
  'aud-0005': [
    { field: 'contactNumber', label: 'Contact number', classification: 'personal' },
  ],
};

/** Where each entry came from. */
export const MOCK_AUDIT_SOURCES: Readonly<Record<string, AuditSource>> = {
  'aud-0008': 'web',
};

/**
 * Recorded values, kept **only** here.
 *
 * Deliberately a separate map keyed by entry id rather than a field on the
 * audit entry. The row cannot carry a value it does not hold, which is what
 * makes `DL-114` structural instead of a rendering habit.
 */
export const MOCK_AUDIT_DETAILS: Readonly<Record<string, readonly AuditValueChange[]>> = {
  'aud-0002': [
    {
      field: 'monthlyIncome',
      label: 'Monthly income',
      classification: 'personal',
      before: '₱3,200.00',
      after: '₱4,000.00',
    },
  ],
  'aud-0004': [
    {
      field: 'sectors',
      label: 'Protection sectors',
      classification: 'sensitive-personal',
      before: 'Solo parent',
      after: 'Solo parent, VAWC survivor',
    },
  ],
  'aud-0005': [
    {
      field: 'contactNumber',
      label: 'Contact number',
      classification: 'personal',
      before: '0917 555 0101',
      after: '0917 555 0188',
    },
  ],
};

export const MOCK_CORRECTION_REQUESTS: readonly CorrectionRequest[] = [
  {
    id: 'cor-0001',
    entityType: 'resident',
    entityId: 'res-0004',
    field: 'birthDate',
    claim:
      'The applicant brought a PSA birth certificate showing 14 March 1979. The registry has ' +
      '14 March 1997.',
    status: 'under-review',
    raisedBy: asId<StaffUserId>('staff-intake'),
    raisedByName: 'Liezl Padilla',
    raisedAt: daysBeforeAnchor(9, 10),
    outcome: null,
    decidedBy: null,
    decidedAt: null,
    audit: stamp(9, 9),
  },
  {
    id: 'cor-0002',
    entityType: 'resident',
    entityId: 'res-0007',
    field: 'name',
    claim: 'Surname is spelled Sarmiento on every document the family holds, not Sarmento.',
    status: 'applied',
    raisedBy: asId<StaffUserId>('staff-sw-1'),
    raisedByName: 'Grace Ocampo',
    raisedAt: daysBeforeAnchor(30, 9),
    outcome:
      'Corrected against the PSA certificate presented on 20 July. The previous spelling stays ' +
      'in the audit trail.',
    decidedBy: asId<StaffUserId>('staff-head'),
    decidedAt: daysBeforeAnchor(27, 14),
    audit: stamp(30, 27),
  },
  {
    id: 'cor-0003',
    entityType: 'assistance-request',
    entityId: 'req-0005',
    field: 'approvedAmount',
    claim: 'Applicant says the amount approved was ₱10,000, not ₱8,000.',
    status: 'refused',
    raisedBy: asId<StaffUserId>('staff-intake'),
    raisedByName: 'Liezl Padilla',
    raisedAt: daysBeforeAnchor(50, 11),
    outcome:
      'The approval minute and the voucher both show ₱8,000. The applicant was shown both and ' +
      'the difference explained. Nothing was changed.',
    decidedBy: asId<StaffUserId>('staff-head'),
    decidedAt: daysBeforeAnchor(48, 9),
    audit: stamp(50, 48),
  },
];

/** Which entries have recorded values behind them. */
export function hasAuditDetail(id: AuditEntryId): boolean {
  return Object.prototype.hasOwnProperty.call(MOCK_AUDIT_DETAILS, id);
}
