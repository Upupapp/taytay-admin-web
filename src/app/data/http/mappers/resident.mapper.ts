import type {
  BarangayId,
  CivilStatus,
  HouseholdId,
  PersonName,
  Resident,
  ResidentId,
  Sex,
} from '@domain/index';

import { bool, date, dateTime, field, id, str, text } from './wire';

/**
 * `admin/residents` → the domain `Resident`.
 *
 * Written against the field names `openapi.json` publishes for this route,
 * which since TAB 05 are read out of `ResidentController`'s own projection
 * methods. Not against the console's guess of what a resident looks like — that
 * guess is what produced divergence D7, and it is invisible to the compiler
 * because the envelope is cast.
 *
 * ## What the wire does not carry
 *
 * The detail payload publishes 19 fields, and the domain `Resident` needs four
 * things that are **not among them**:
 *
 * | Domain field | Status |
 * | --- | --- |
 * | `householdId` | absent — `GET admin/residents/{resident}/households` is a separate call returning a collection |
 * | `sectors` | absent — vulnerability lives at `/vulnerability`, behind its own permission |
 * | `philsysLastFour` | absent — identity tier data, `resident.view-sensitive` |
 * | `monthlyIncome` | absent — means data, same tier |
 *
 * They are mapped to their "absent" value and **not invented**. That is the
 * honest reading: this endpoint does not disclose them, and the reason it does
 * not is the same reason the console masks them — they are a wider tier
 * (`resident.view-sensitive`) than the record itself.
 *
 * The consequence is a real gap, recorded for TAB 07 rather than papered over:
 * a screen that needs a resident's sectors or income must ask for them, and
 * `getProfile` is the method that will have to assemble four calls or receive a
 * projection built for it.
 *
 * `verification_tier` and `verified_at` come back and have **no domain
 * counterpart at all** — the console has never modelled KYC, which is the
 * citizen surface. They are dropped deliberately rather than carried as
 * unmapped extras.
 */
export function toResident(wire: unknown): Resident | null {
  const residentId = id<ResidentId>(field(wire, 'id'));
  const barangayId = id<BarangayId>(field(wire, 'barangay_id'));
  const birthDate = date(field(wire, 'birth_date'));

  // Without an identity, a barangay and a date of birth there is no resident to
  // render — every screen keys on all three. A partial record dropped here is
  // better than one that reaches a template and renders as blanks.
  if (residentId === null || barangayId === null || birthDate === null) {
    return null;
  }

  return {
    id: residentId,
    // Absent from this payload — see the table above. `null` is the honest
    // answer, and `ResidentRepository.getHousehold` is how a screen asks.
    householdId: null as HouseholdId | null,
    name: toPersonName(wire),
    sex: (str(field(wire, 'sex')) ?? 'unspecified') as Sex,
    birthDate,
    civilStatus: (str(field(wire, 'civil_status')) ?? 'unknown') as CivilStatus,
    address: {
      barangayId,
      purokOrSitio: str(field(wire, 'purok_or_sitio')),
      streetAddress: str(field(wire, 'street_address')),
    },
    contact: {
      mobile: str(field(wire, 'mobile_number')),
      email: str(field(wire, 'email')),
    },
    sectors: [],
    philsysLastFour: null,
    monthlyIncome: null,
    isActive: bool(field(wire, 'is_active')),
    audit: {
      createdAt: dateTime(field(wire, 'created_at')) ?? ('' as never),
      createdBy: null,
      updatedAt: dateTime(field(wire, 'updated_at')) ?? ('' as never),
      updatedBy: null,
    },
  };
}

/**
 * The list payload carries a composed `name` string; the detail payload carries
 * the parts. Both are handled, because both are real responses from the same
 * resource and an adapter that only understood one would work on the detail
 * screen and produce blanks in the list.
 */
function toPersonName(wire: unknown): PersonName {
  const first = str(field(wire, 'first_name'));

  if (first !== null) {
    return {
      first,
      middle: str(field(wire, 'middle_name')),
      last: text(field(wire, 'last_name')),
      suffix: str(field(wire, 'suffix')),
    };
  }

  // Composed form. Split conservatively: the last token is the surname unless
  // there is only one token, and no attempt is made to guess a middle name.
  // A Filipino compound surname would be split wrongly by anything cleverer,
  // and a name rendered wrongly to the person it belongs to is not a small bug.
  const composed = text(field(wire, 'name'));
  const parts = composed.split(/\s+/).filter((part) => part.length > 0);

  if (parts.length <= 1) {
    return { first: composed, middle: null, last: '', suffix: null };
  }

  return {
    first: parts.slice(0, -1).join(' '),
    middle: null,
    last: parts[parts.length - 1] ?? '',
    suffix: null,
  };
}
