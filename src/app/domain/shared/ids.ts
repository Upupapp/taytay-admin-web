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
export type CaseNoteId = Branded<string, 'CaseNoteId'>;
export type RequirementId = Branded<string, 'RequirementId'>;
export type DisbursementId = Branded<string, 'DisbursementId'>;
export type ReferralId = Branded<string, 'ReferralId'>;
export type StaffUserId = Branded<string, 'StaffUserId'>;
export type NotificationId = Branded<string, 'NotificationId'>;
export type AuditEntryId = Branded<string, 'AuditEntryId'>;
export type SavedViewId = Branded<string, 'SavedViewId'>;

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
