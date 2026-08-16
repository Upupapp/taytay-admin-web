/**
 * Branded identifier types.
 *
 * Every entity id is a distinct nominal type so a `ResidentId` can never be
 * passed where an `AssistanceRequestId` is expected, even though both are
 * strings at runtime.
 */
declare const brand: unique symbol;

export type Branded<TValue extends string, TBrand extends string> = TValue & {
  readonly [brand]: TBrand;
};

export type ResidentId = Branded<string, 'ResidentId'>;
export type HouseholdId = Branded<string, 'HouseholdId'>;
export type BarangayId = Branded<string, 'BarangayId'>;
export type ProgramId = Branded<string, 'ProgramId'>;
export type AssistanceRequestId = Branded<string, 'AssistanceRequestId'>;
/** A note written on one assistance request. Not a note on a case — see `CaseNoteId`. */
export type RequestNoteId = Branded<string, 'RequestNoteId'>;
export type CaseId = Branded<string, 'CaseId'>;
export type CaseNoteId = Branded<string, 'CaseNoteId'>;
export type CaseTaskId = Branded<string, 'CaseTaskId'>;
export type CaseEventId = Branded<string, 'CaseEventId'>;
export type RequirementId = Branded<string, 'RequirementId'>;
export type DisbursementId = Branded<string, 'DisbursementId'>;
export type ReferralId = Branded<string, 'ReferralId'>;
export type StaffUserId = Branded<string, 'StaffUserId'>;
export type NotificationId = Branded<string, 'NotificationId'>;
export type AuditEntryId = Branded<string, 'AuditEntryId'>;
export type SavedViewId = Branded<string, 'SavedViewId'>;
export type FamilyId = Branded<string, 'FamilyId'>;
export type RelationshipId = Branded<string, 'RelationshipId'>;
export type RelationshipEventId = Branded<string, 'RelationshipEventId'>;
export type ProgramEnrollmentId = Branded<string, 'ProgramEnrollmentId'>;
export type RequirementDocumentId = Branded<string, 'RequirementDocumentId'>;
/**
 * One version of a presented document. Versions are never reused and never
 * removed: replacing a file appends, so the record of what the office actually
 * saw when it decided survives (`DL-77`).
 */
export type DocumentVersionId = Branded<string, 'DocumentVersionId'>;
export type DocumentRequestId = Branded<string, 'DocumentRequestId'>;
export type ServiceProviderId = Branded<string, 'ServiceProviderId'>;
export type FieldVisitId = Branded<string, 'FieldVisitId'>;
export type ReleaseBatchId = Branded<string, 'ReleaseBatchId'>;
/**
 * One recorded observation from a visit. Carries its own id because each states
 * *whose claim it is* and is rendered separately (`DL-85`) — a paragraph of
 * mixed prose cannot do that.
 */
export type VisitObservationId = Branded<string, 'VisitObservationId'>;
export type ReferralNoteId = Branded<string, 'ReferralNoteId'>;
/**
 * One recorded judgement about whether two registry records are the same person.
 *
 * Note what is *not* here: there is no `BeneficiaryId`. A beneficiary is a
 * standing a resident holds, not a second record about them (`DL-71`), so the
 * registry keys on `ResidentId` throughout.
 */
export type IdentityResolutionId = Branded<string, 'IdentityResolutionId'>;

/**
 * The single sanctioned way to turn an untyped string (route param, API payload)
 * into a branded id. Adapters own this cast; features never do it themselves.
 */
export function asId<TId extends Branded<string, string>>(value: string): TId {
  return value as TId;
}

/** ISO-8601 timestamp string, e.g. `2026-08-13T04:31:00.000Z`. */
export type IsoDateTime = Branded<string, 'IsoDateTime'>;

/** ISO-8601 calendar date without a time component, e.g. `1968-04-02`. */
export type IsoDate = Branded<string, 'IsoDate'>;

export function asIsoDateTime(value: string | Date): IsoDateTime {
  const iso = value instanceof Date ? value.toISOString() : value;
  return iso as IsoDateTime;
}

export function asIsoDate(value: string): IsoDate {
  return value as IsoDate;
}
