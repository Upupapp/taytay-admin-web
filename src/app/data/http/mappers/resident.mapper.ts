import {
  CIVIL_STATUSES,
  centavos,
  formatPersonName,
  formatPersonNameListed,
  formatProtectedName,
  SEXES,
  TAYTAY_BARANGAYS,
  VULNERABILITY_SECTORS,
  type BarangayId,
  type Resident,
  type ResidentDraft,
  type ResidentField,
  type ResidentId,
  type ResidentView,
  type StaffUserId,
  type VulnerabilitySector,
} from '@domain/index';

import { bool, date, dateTime, field, id, int, oneOf, str } from './wire';

/**
 * The office registry on the wire (`OfficeResident`, `DL-174`).
 *
 * | wire                      | domain                         | if absent or unknown             |
 * | ------------------------- | ------------------------------ | -------------------------------- |
 * | `id`                      | `resident.id`                  | the record is not readable       |
 * | `first_name`, `last_name` | `resident.name`                | the record is not readable       |
 * | `middle_name`, `suffix`   | `resident.name`                | none recorded, or withheld       |
 * | `sex`, `civil_status`     | the same                       | the record is not readable       |
 * | `birth_date`              | `resident.birthDate`           | the record is not readable       |
 * | `barangay_id`             | `resident.address.barangayId`  | the record is not readable       |
 * | `purok_or_sitio`, `street_address` | `resident.address`    | none recorded, or withheld       |
 * | `mobile`, `email`         | `resident.contact`             | none recorded, or withheld       |
 * | `sectors`                 | `resident.sectors`             | a sector it does not know: not readable |
 * | `philsys_last_four`       | `resident.philsysLastFour`     | none recorded, or withheld       |
 * | `monthly_income_centavos` | `resident.monthlyIncome`       | none recorded, or withheld       |
 * | `is_active`               | `resident.isActive`            | —                                |
 * | `is_protected`            | `isProtected`                  | —                                |
 * | `given_name_masked`       | which name `listedName` shows  | —                                |
 * | `withheld`                | `withheld`                     | a field it cannot name: not readable |
 * | `created_*`, `updated_*`  | `resident.audit`               | the record is not readable       |
 *
 * **The server has already redacted the record** (`DL-38`): this mapper applies no disclosure rule
 * of its own, because a second copy of the rule is one that eventually disagrees with the first. It
 * only says what the server said: `withheld` names what was held back, and a masked record's names
 * are formatted as the console's own `formatProtectedName` would — from the surname and the initial,
 * which is all the server sent.
 *
 * **Barangays are matched by name.** The API keys a barangay by its own id (`GET barangays`); this
 * console's screens and filters use `TAYTAY_BARANGAYS`, whose ids are its own (`DL-173`). The two
 * are joined on the barangay's name, and a name that matches none refuses the record rather than
 * placing a person in a barangay this console would have to guess.
 *
 * **Not read**: nothing the API sends is dropped. `householdId` has no wire counterpart — households
 * are a later phase — so it is `null`, which the household screens never read in this configuration:
 * they are withheld (`DL-167`).
 *
 * @consumes GET office/residents
 * @consumes GET office/residents/{id}
 * @consumes POST office/residents
 * @consumes PATCH office/residents/{id}
 * @consumes POST office/residents/{id}/deactivate
 * @consumes POST office/residents/{id}/reactivate
 * @consumes POST office/residents/{id}/sectors
 * @consumes POST office/residents/{id}/sectors/{sector}/end
 */
export function toResidentView(wire: unknown, barangays: BarangayIndex): ResidentView | null {
  const resident = toResident(wire, barangays);
  const withheld = toWithheld(field(wire, 'withheld'));

  if (resident === null || withheld === null) {
    return null;
  }

  const masked = bool(field(wire, 'given_name_masked'));

  return {
    resident,
    isProtected: bool(field(wire, 'is_protected')),
    withheld,
    listedName: masked ? formatProtectedName(resident.name) : formatPersonNameListed(resident.name),
    fullName: masked ? formatProtectedName(resident.name) : formatPersonName(resident.name),
  };
}

/** The record alone, for a write's answer: the port returns the `Resident` that was saved. */
export function toResident(wire: unknown, barangays: BarangayIndex): Resident | null {
  const residentId = id<ResidentId>(field(wire, 'id'));
  const first = str(field(wire, 'first_name'));
  const last = str(field(wire, 'last_name'));
  const sex = oneOf(field(wire, 'sex'), SEXES);
  const birthDate = date(field(wire, 'birth_date'));
  const civilStatus = oneOf(field(wire, 'civil_status'), CIVIL_STATUSES);
  const barangayId = barangays.toConsole(str(field(wire, 'barangay_id')));
  const sectors = toSectors(field(wire, 'sectors'));
  const createdAt = dateTime(field(wire, 'created_at'));
  const updatedAt = dateTime(field(wire, 'updated_at'));

  if (
    residentId === null ||
    first === null ||
    last === null ||
    sex === null ||
    birthDate === null ||
    civilStatus === null ||
    barangayId === null ||
    sectors === null ||
    createdAt === null ||
    updatedAt === null
  ) {
    return null;
  }

  const income = int(field(wire, 'monthly_income_centavos'));

  return {
    id: residentId,
    householdId: null,
    name: {
      first,
      middle: str(field(wire, 'middle_name')),
      last,
      suffix: str(field(wire, 'suffix')),
    },
    sex,
    birthDate,
    civilStatus,
    address: {
      barangayId,
      purokOrSitio: str(field(wire, 'purok_or_sitio')),
      streetAddress: str(field(wire, 'street_address')),
    },
    contact: { mobile: str(field(wire, 'mobile')), email: str(field(wire, 'email')) },
    sectors,
    philsysLastFour: str(field(wire, 'philsys_last_four')),
    monthlyIncome: income === null ? null : centavos(income),
    isActive: bool(field(wire, 'is_active')),
    audit: {
      createdAt,
      createdBy: id<StaffUserId>(field(wire, 'created_by')),
      updatedAt,
      updatedBy: id<StaffUserId>(field(wire, 'updated_by')),
    },
  };
}

/** Every sector, or `null` when one is a sector this console has no word for. */
function toSectors(value: unknown): VulnerabilitySector[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const sectors = value.map((entry) => oneOf(entry, VULNERABILITY_SECTORS));
  return sectors.every((sector): sector is VulnerabilitySector => sector !== null) ? sectors : null;
}

const WITHHELD: Readonly<Record<string, ResidentField>> = {
  philsys_last_four: 'philsysLastFour',
  monthly_income: 'monthlyIncome',
  protected_sectors: 'protectedSectors',
  contact: 'contact',
  exact_address: 'exactAddress',
};

/**
 * What the server held back, or `null` when it names a field this console cannot: a screen that
 * cannot say what is hidden would show a blank that reads as "not recorded".
 */
function toWithheld(value: unknown): ResidentField[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const fields = value.map((entry) => {
    const name = str(entry);
    return name !== null && Object.hasOwn(WITHHELD, name) ? (WITHHELD[name] ?? null) : null;
  });
  return fields.every((entry): entry is ResidentField => entry !== null) ? fields : null;
}

/** The two barangay vocabularies, joined on the barangay's name. */
export interface BarangayIndex {
  toConsole(apiId: string | null): BarangayId | null;
  toApi(consoleId: BarangayId): string | null;
}

/**
 * `GET barangays` → the join. A row whose name is not one of `TAYTAY_BARANGAYS` is left out of it,
 * so a record in that barangay is refused rather than placed somewhere else.
 *
 * @consumes GET barangays
 */
export function toBarangayIndex(rows: readonly unknown[]): BarangayIndex {
  const toConsole = new Map<string, BarangayId>();
  const toApi = new Map<BarangayId, string>();
  for (const row of rows) {
    const apiId = str(field(row, 'id'));
    const name = str(field(row, 'name'))?.trim().toLowerCase();
    const known = TAYTAY_BARANGAYS.find((barangay) => barangay.name.toLowerCase() === name);
    if (apiId !== null && known !== undefined) {
      toConsole.set(apiId, known.id);
      toApi.set(known.id, apiId);
    }
  }
  return {
    toConsole: (apiId) => (apiId === null ? null : (toConsole.get(apiId) ?? null)),
    toApi: (consoleId) => toApi.get(consoleId) ?? null,
  };
}

/**
 * What `POST office/residents` and `PATCH office/residents/{id}` read (`OfficeResidentCreate`), and
 * nothing else: the body is strict on the server. Flat, where `ResidentDraft` nests name, address
 * and contact — mapped field by field, never by a generic converter.
 *
 * **Sectors and the household are not sent.** A sector is its own act with a reason
 * (`recordSector`), and the API holds no households yet; sending either would be refused as an
 * unknown field.
 */
export interface ResidentDraftWire {
  readonly first_name: string;
  readonly middle_name: string | null;
  readonly last_name: string;
  readonly suffix: string | null;
  readonly sex: string;
  readonly birth_date: string;
  readonly civil_status: string;
  readonly barangay_id: string;
  readonly purok_or_sitio: string | null;
  readonly street_address: string;
  readonly mobile: string | null;
  readonly email: string | null;
  readonly philsys_last_four: string | null;
  /** Integer centavos, as `Money` holds them: no pesos, no decimal point. */
  readonly monthly_income_centavos: number | null;
}

/** `barangayId` is the API's id for the draft's barangay, resolved through `BarangayIndex`. */
export function toWireResidentDraft(draft: ResidentDraft, barangayId: string): ResidentDraftWire {
  return {
    first_name: draft.name.first.trim(),
    middle_name: blankToNull(draft.name.middle),
    last_name: draft.name.last.trim(),
    suffix: blankToNull(draft.name.suffix),
    sex: draft.sex,
    birth_date: draft.birthDate,
    civil_status: draft.civilStatus,
    barangay_id: barangayId,
    purok_or_sitio: blankToNull(draft.address.purokOrSitio),
    street_address: (draft.address.streetAddress ?? '').trim(),
    mobile: blankToNull(draft.contact.mobile),
    email: blankToNull(draft.contact.email),
    philsys_last_four: blankToNull(draft.philsysLastFour),
    monthly_income_centavos: draft.monthlyIncome === null ? null : draft.monthlyIncome.centavos,
  };
}

/** What retiring, restoring and ending a sector read (`ReasonBody`). Trimmed: the server keeps it. */
export interface ReasonWire {
  readonly reason: string;
}

export function toWireReason(reason: string): ReasonWire {
  return { reason: reason.trim() };
}

/** What `POST office/residents/{id}/sectors` reads (`OfficeResidentSectorRecord`). */
export interface SectorRecordWire {
  readonly sector: VulnerabilitySector;
  readonly reason: string;
}

export function toWireSectorRecord(sector: VulnerabilitySector, reason: string): SectorRecordWire {
  return { sector, reason: reason.trim() };
}

function blankToNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? '';
  return trimmed.length > 0 ? trimmed : null;
}
