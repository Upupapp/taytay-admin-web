import type { BarangayId, Household, HouseholdId, ResidentId } from '@domain/index';

import { field, id, idTolerantOfNumeric, str, text } from './wire';

/**
 * `admin/households` → the domain.
 *
 * This resource maps far more comfortably than residents did, for a structural
 * reason worth naming: **the API and the console draw the summary/detail line
 * in the same place.** `GET admin/households` publishes 8 fields and
 * `GET admin/households/{household}` publishes 21; the console has
 * `HouseholdSummary` and `HouseholdDetail` to match. Neither side has to
 * pretend a list row is a full record.
 *
 * ## What the wire does not carry
 *
 * | Domain field | Status |
 * | --- | --- |
 * | `monthlyIncome` | absent — means data, a wider permission tier |
 * | `isIndigent` | absent — a recorded classification with no wire counterpart |
 * | `audit.createdAt` / `updatedAt` | absent — the payload carries `verified_at` only |
 *
 * `isIndigent` is the one to watch. It is *"a recorded classification, made by a
 * person… never derived from the vulnerability snapshot"* (`DL-42`), and the
 * temptation when a field is missing is to compute it from the factors that
 * *are* present. That would be an automated eligibility decision by another
 * name, so it is `false` here and the gap goes to TAB 07 instead.
 */
export function toHousehold(wire: unknown): Household | null {
  const householdId = id<HouseholdId>(field(wire, 'id'));
  const barangayId = idTolerantOfNumeric<BarangayId>(field(wire, 'barangay_id'));

  if (householdId === null || barangayId === null) {
    return null;
  }

  return {
    id: householdId,
    referenceNumber: text(field(wire, 'code')),
    // The detail payload carries `head`; the list row does not. A household
    // whose head is not disclosed to this caller keys on itself rather than on
    // a person — masking the head must not make the record unreadable.
    headResidentId: id<ResidentId>(field(field(wire, 'head'), 'id')) ?? ('' as ResidentId),
    address: {
      barangayId,
      purokOrSitio: str(field(wire, 'purok_or_sitio')),
      streetAddress: str(field(wire, 'street_address')),
    },
    members: [],
    monthlyIncome: null,
    // Never derived from the vulnerability factors — see the note above.
    isIndigent: false,
    audit: {
      createdAt: '' as never,
      createdBy: null,
      updatedAt: '' as never,
      updatedBy: null,
    },
  };
}

/*
 * ── `toHouseholdSummary` is deliberately NOT written here — ledger L-14 ──
 *
 * `HouseholdSummary` carries `band: HouseholdBand`, and that union is
 * `'none' | 'watch' | 'elevated' | 'high'`. It has **no member meaning "we did
 * not ask"**.
 *
 * The list payload does not carry the vulnerability snapshot — it lives behind
 * its own permission at `/vulnerability` — so a mapper for this row would have
 * to put *something* in `band`, and the only available something is `'none'`.
 * On screen that reads as **"no vulnerability factors present"**: a positive
 * claim about a household, made on the strength of data nobody sent, about
 * exactly the households the office exists to notice.
 *
 * TAB 05 step 5 settled the same question for a different field — *"never
 * render an empty record where the truth is 'we could not ask'"*. Writing this
 * mapper would breach that rule in the one place it matters most, so it is not
 * written. The gap is recorded instead: either `HouseholdBand` gains an
 * unassessed member, or the list screen stops rendering a band, or the endpoint
 * carries the snapshot. All three are decisions, and none belongs in an adapter.
 */
