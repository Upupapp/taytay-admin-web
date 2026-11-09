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
export type ReleaseId = Branded<string, 'ReleaseId'>;
export type ReferralId = Branded<string, 'ReferralId'>;
export type StaffUserId = Branded<string, 'StaffUserId'>;
export type NotificationId = Branded<string, 'NotificationId'>;
export type AuditEntryId = Branded<string, 'AuditEntryId'>;
export type SavedViewId = Branded<string, 'SavedViewId'>;
export type LguEventId = Branded<string, 'LguEventId'>;
export type EventRegistrationId = Branded<string, 'EventRegistrationId'>;
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
 * A pair the office is holding open for review.
 *
 * The pair is a **record**, not a computation. Detection persists a row with its own identity, a
 * decision and a note, and the API addresses every act on the pair by that id — decide, preview,
 * merge. This console used to address a pair by its two resident ids, which cannot name the same
 * thing: two records resemble each other from the moment they both exist, and the pair only exists
 * once somebody has run a detection and the office has taken it on (`DL-148`).
 */
export type DuplicatePairId = Branded<string, 'DuplicatePairId'>;
/** A residents' app identity review (`DL-167`). */
export type VerificationRequestId = Branded<string, 'VerificationRequestId'>;
/**
 * An account in the residents' app. **Not a `ResidentId`**: an app account is a person with a phone,
 * not a record in the office's registry, and the two are kept apart on purpose (`DL-164`).
 */
export type AppAccountId = Branded<string, 'AppAccountId'>;
/** An image the API stores — read as bytes through the data layer, never as a URL. */
export type MediaId = Branded<string, 'MediaId'>;
/** An LGU office in the residents' app's directory — the MSWDO is one of several (`DL-168`). */
export type OfficeId = Branded<string, 'OfficeId'>;
/** A Tulong page in the residents' app — information about a service, never a programme (`DL-170`). */
export type TulongServiceId = Branded<string, 'TulongServiceId'>;
/** An emergency or office number the residents' app lists (`DL-170`). */
export type HotlineId = Branded<string, 'HotlineId'>;
/** A banner on the residents' app's home screen (`DL-170`). */
export type HomeBannerId = Branded<string, 'HomeBannerId'>;
/** A link on the residents' app's home screen (`DL-170`). */
export type QuickLinkId = Branded<string, 'QuickLinkId'>;
/** A resident’s digital ID card, as the API numbers its record — not the card number (`DL-171`). */
export type DigitalIdId = Branded<string, 'DigitalIdId'>;
/** A Balita article in the residents' app — the console's one news channel (`DL-171`, `DL-194`). */
export type BalitaArticleId = Branded<string, 'BalitaArticleId'>;
/** A row of the Node API's audit trail — not the governance module's `AuditEntry` (`DL-171`). */
export type PlatformAuditEntryId = Branded<string, 'PlatformAuditEntryId'>;
/** A conversation between one resident and one office (`DL-168`). */
export type OfficeThreadId = Branded<string, 'OfficeThreadId'>;
/** One message in an office conversation (`DL-168`). */
export type ThreadMessageId = Branded<string, 'ThreadMessageId'>;
/**
 * A kind of document an office issues to residents — a certificate, a clearance (`DL-184`). Not a
 * `RequirementId`: that is a document the office asks an applicant for inside casework.
 */
export type IssuanceTypeId = Branded<string, 'IssuanceTypeId'>;
/**
 * A resident's request for a document an office issues (`DL-184`). Not a `DocumentRequestId`,
 * which is the office asking an applicant for a document.
 */
export type IssuanceRequestId = Branded<string, 'IssuanceRequestId'>;
/** One file a resident sent with a document request — one version of one requirement. */
export type IssuanceAttachmentId = Branded<string, 'IssuanceAttachmentId'>;
/** One move in a document request's history, appended and never changed. */
export type IssuanceEventId = Branded<string, 'IssuanceEventId'>;

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
