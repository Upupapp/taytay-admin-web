import {
  asId,
  asIsoDateTime,
  type CorrectableField,
  type CorrectionChange,
  type CorrectionRequest,
  type CorrectionStatus,
  type ResidentId,
  type StaffUserId,
} from '@domain/index';

import { str, text } from './wire';

/**
 * `GET admin/resident-corrections` → the domain.
 *
 * ## Four states, translated rather than renamed
 *
 * The API says `pending | approved | rejected | withdrawn`; the office says `raised | applied |
 * refused | withdrawn`. The console's wording is kept because it is more precise about what
 * happened to the *record*: `applied` says the record was corrected and the previous value stayed
 * in the trail, where "approved" says only that somebody agreed. Same reasoning as the duplicate
 * verdict (`DL-148`) — the domain keeps its word and the seam carries the translation.
 *
 * An unrecognised status reads as **`raised`**, the one that keeps the request in front of
 * somebody. Reading it as `applied` or `refused` would quietly close something the office still
 * owes an answer to, and `withdrawn` would put words in the requester's mouth.
 *
 * ## The values come down whether or not a list shows them
 *
 * `changes[]` carries `current_value` and `proposed_value`, and `birth_date`, `mobile_number` and
 * `street_address` are all correctable — so this payload hands every reviewer a birth date for
 * every pending request. The console renders **field names in the list and values on the one
 * being decided** (`DL-114`'s split, `DL-155`), but rendering is not protection: the data reaches
 * the browser either way. Filed alongside the duplicate-pair disclosure in
 * `docs/integration/backend-requests.md` §3.
 *
 * @consumes GET admin/resident-corrections
 */

const FIELD_FROM_WIRE: Readonly<Record<string, CorrectableField>> = {
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

const STATUS_FROM_WIRE: Readonly<Record<string, CorrectionStatus>> = {
  pending: 'raised',
  approved: 'applied',
  rejected: 'refused',
  withdrawn: 'withdrawn',
};

export function toCorrectionRequest(wire: unknown): CorrectionRequest | null {
  if (typeof wire !== 'object' || wire === null) return null;
  const row = wire as Record<string, unknown>;

  const id = str(row['id']);
  if (id === null) return null;

  const residentWire = row['resident'];
  const resident =
    typeof residentWire === 'object' && residentWire !== null
      ? (residentWire as Record<string, unknown>)
      : {};
  const residentId = str(resident['id']);

  const raisedBy = str(row['requested_by']);
  const decidedBy = str(row['reviewed_by']);
  const raisedAt = str(row['created_at']);
  const decidedAt = str(row['reviewed_at']);

  return {
    id,
    residentId: residentId === null ? null : asId<ResidentId>(residentId),
    /*
     * The name as the server disclosed it. A second surface formatting a resident's name would
     * hand this screen the full name of somebody shown elsewhere as "Cordero, M." (`DL-38`).
     */
    residentName: text(resident['name']),
    changes: toChanges(row['changes']),
    claim: text(row['note']),
    status: STATUS_FROM_WIRE[str(row['status']) ?? ''] ?? 'raised',
    raisedBy: raisedBy === null ? null : asId<StaffUserId>(raisedBy),
    /*
     * The API sends a subject id and no name. Rendering the id would put a uuid where a screen
     * says "raised by", so the field carries an empty string and the screen shows nothing rather
     * than something meaningless. Recorded as a gap.
     */
    raisedByName: '',
    raisedAt: raisedAt === null ? asIsoDateTime(new Date(0)) : asIsoDateTime(new Date(raisedAt)),
    outcome: str(row['review_note']),
    decidedBy: decidedBy === null ? null : asId<StaffUserId>(decidedBy),
    decidedAt: decidedAt === null ? null : asIsoDateTime(new Date(decidedAt)),
    audit: {
      createdAt: raisedAt === null ? asIsoDateTime(new Date(0)) : asIsoDateTime(new Date(raisedAt)),
      createdBy: raisedBy === null ? null : asId<StaffUserId>(raisedBy),
      updatedAt:
        decidedAt === null
          ? raisedAt === null
            ? asIsoDateTime(new Date(0))
            : asIsoDateTime(new Date(raisedAt))
          : asIsoDateTime(new Date(decidedAt)),
      updatedBy: decidedBy === null ? null : asId<StaffUserId>(decidedBy),
    },
  };
}

function toChanges(wire: unknown): readonly CorrectionChange[] {
  if (!Array.isArray(wire)) return [];

  return wire
    .map((entry): CorrectionChange | null => {
      if (typeof entry !== 'object' || entry === null) return null;
      const row = entry as Record<string, unknown>;
      const field = FIELD_FROM_WIRE[str(row['field']) ?? ''];
      /*
       * A field the console has no label for is dropped rather than shown as a raw column name.
       * `fieldsNamed` would otherwise print `civil_status` on a screen where somebody is deciding
       * whether to change a person's record.
       */
      if (field === undefined) return null;

      return {
        field,
        // Null is kept: "we hold no mobile number" and "we hold a blank one" are different records.
        currentValue: str(row['current_value']),
        proposedValue: str(row['proposed_value']),
      };
    })
    .filter((change): change is CorrectionChange => change !== null);
}

/** The list is paginated; the console reads the page it was given. */
export function toCorrectionRequests(wire: unknown): readonly CorrectionRequest[] {
  if (!Array.isArray(wire)) return [];

  return wire
    .map((row) => toCorrectionRequest(row))
    .filter((row): row is CorrectionRequest => row !== null);
}
