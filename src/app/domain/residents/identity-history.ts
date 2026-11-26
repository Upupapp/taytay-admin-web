import type { IsoDateTime } from '../shared/ids';

/**
 * A registry record's identity history (`DL-264`; the API's ADR 0016, migration 0080): every change
 * of its name, sex, birth date or barangay — when, who, which field, the reason, through which act,
 * and whether an ID was seen.
 *
 * **The list carries no value** (`DL-114`). An earlier name can be a maiden name, or a name before
 * an adoption or a legitimation; an earlier sex is a fact about a person, not about the office. So
 * the earlier and later values are a separate read, behind the auditor's `audit.view-detail`, and
 * the server says per row whether this reader may open them (`valuesReadable`) — the screen offers
 * only what the server would answer, and opening them is recorded in the audit trail.
 */

export const IDENTITY_FIELDS = [
  'firstName',
  'middleName',
  'lastName',
  'suffix',
  'sex',
  'birthDate',
  'barangay',
] as const;
export type IdentityField = (typeof IDENTITY_FIELDS)[number];

export const IDENTITY_FIELD_LABELS: Readonly<Record<IdentityField, string>> = {
  firstName: 'First name',
  middleName: 'Middle name',
  lastName: 'Last name',
  suffix: 'Suffix',
  sex: 'Sex',
  birthDate: 'Birth date',
  barangay: 'Barangay',
};

/** Where the change was made: the record's own edit, or a link that corrected it to the ID. */
export type IdentityChangeSource = 'registry-edit' | 'account-link';

export const IDENTITY_SOURCE_LABELS: Readonly<Record<IdentityChangeSource, string>> = {
  'registry-edit': 'Edited on the record',
  'account-link': 'Corrected to the ID when an app account was linked',
};

export interface IdentityChange {
  readonly id: string;
  readonly field: IdentityField;
  /** Null when none was given (a barangay move may have none), or when it is withheld. */
  readonly reason: string | null;
  /** A protected record's reason, withheld from a reader without the protected tier. */
  readonly reasonWithheld: boolean;
  readonly source: IdentityChangeSource;
  /** The person making the change said they saw an ID showing the new value. */
  readonly idChecked: boolean;
  readonly actorName: string | null;
  readonly at: IsoDateTime;
  /** Whether this reader may open the values, as the server says. */
  readonly valuesReadable: boolean;
}

/** The values of one change, as text: a date `YYYY-MM-DD`, a sex `female`/`male`, a barangay id. */
export interface IdentityChangeValues {
  readonly id: string;
  readonly field: IdentityField;
  readonly previous: string | null;
  readonly next: string | null;
}
