import type { AuditStamp } from '../shared/audit';
import type { BarangayId, HouseholdId, IsoDate, ResidentId } from '../shared/ids';
import type { Money } from '../shared/money';

export type Sex = 'female' | 'male';

export const SEXES: readonly Sex[] = ['female', 'male'];

export type CivilStatus =
  'single' | 'married' | 'widowed' | 'separated' | 'annulled' | 'cohabiting';

export const CIVIL_STATUSES: readonly CivilStatus[] = [
  'single',
  'married',
  'widowed',
  'separated',
  'annulled',
  'cohabiting',
];

/**
 * Vulnerability sectors recognised by Philippine social-welfare statute. These
 * drive both eligibility and the extra-care handling rules in the constitution.
 *
 * senior-citizen  — RA 9994 (Expanded Senior Citizens Act)
 * pwd             — RA 7277 as amended by RA 10754
 * solo-parent     — RA 8972 as amended by RA 11861
 * four-ps         — RA 11310 (Pantawid Pamilyang Pilipino Program)
 * vawc-survivor   — RA 9262 (heightened confidentiality)
 * cicl            — Children in Conflict with the Law, RA 9344 (records sealed)
 */
export type VulnerabilitySector =
  | 'senior-citizen'
  | 'pwd'
  | 'solo-parent'
  | 'four-ps'
  | 'indigenous-people'
  | 'unemployed'
  | 'out-of-school-youth'
  | 'vawc-survivor'
  | 'cicl'
  | 'displaced-worker';

export const VULNERABILITY_SECTORS: readonly VulnerabilitySector[] = [
  'senior-citizen',
  'pwd',
  'solo-parent',
  'four-ps',
  'indigenous-people',
  'unemployed',
  'out-of-school-youth',
  'vawc-survivor',
  'cicl',
  'displaced-worker',
];

/**
 * Sectors whose mere membership is sensitive personal information. Records
 * touching these are withheld unless the viewer holds `request.view-sensitive`
 * — and the withholding happens in the data layer, not only in the view
 * (`DL-38`).
 */
export const SENSITIVE_SECTORS: readonly VulnerabilitySector[] = ['vawc-survivor', 'cicl'];

export function isSensitiveSector(sector: VulnerabilitySector): boolean {
  return SENSITIVE_SECTORS.includes(sector);
}

/**
 * Vocabulary labels live in the domain beside the union they name, as
 * `PROGRAM_CATEGORY_LABELS` and `PAYOUT_METHOD_LABELS` already do. These are
 * the office's terms for its own categories, not screen copy: the same words
 * belong on a filter, a chip, a detail row and an export.
 */
export const SEX_LABELS: Readonly<Record<Sex, string>> = {
  female: 'Female',
  male: 'Male',
};

export const CIVIL_STATUS_LABELS: Readonly<Record<CivilStatus, string>> = {
  single: 'Single',
  married: 'Married',
  widowed: 'Widowed',
  separated: 'Separated',
  annulled: 'Annulled',
  cohabiting: 'Living together',
};

export const VULNERABILITY_SECTOR_LABELS: Readonly<Record<VulnerabilitySector, string>> = {
  'senior-citizen': 'Senior citizen',
  pwd: 'Person with disability',
  'solo-parent': 'Solo parent',
  'four-ps': '4Ps beneficiary',
  'indigenous-people': 'Indigenous people',
  unemployed: 'Unemployed',
  'out-of-school-youth': 'Out-of-school youth',
  'vawc-survivor': 'VAWC survivor',
  cicl: 'Child in conflict with the law',
  'displaced-worker': 'Displaced worker',
};

export const HOUSEHOLD_ROLE_LABELS: Readonly<Record<HouseholdRole, string>> = {
  head: 'Household head',
  spouse: 'Spouse',
  child: 'Child',
  parent: 'Parent',
  relative: 'Relative',
  'non-relative': 'Other member',
};

export const RESIDENT_AGE_GROUP_LABELS: Readonly<Record<ResidentAgeGroup, string>> = {
  child: 'Children (under 18)',
  youth: 'Youth (18–30)',
  adult: 'Adults (31–59)',
  senior: 'Senior citizens (60+)',
};

export interface PersonName {
  readonly first: string;
  readonly middle: string | null;
  readonly last: string;
  readonly suffix: string | null;
}

export interface ContactDetails {
  readonly mobile: string | null;
  readonly email: string | null;
}

export interface ResidentAddress {
  readonly barangayId: BarangayId;
  /**
   * `null` means either "not recorded" or "not disclosed to you". Which one is
   * answered by `ResidentView.withheld`, never by guessing from the model — a
   * protection case's street address is withheld exactly like an unknown one so
   * that absence itself reveals nothing.
   */
  readonly purokOrSitio: string | null;
  readonly streetAddress: string | null;
}

export interface Resident {
  readonly id: ResidentId;
  readonly householdId: HouseholdId | null;
  readonly name: PersonName;
  readonly sex: Sex;
  readonly birthDate: IsoDate;
  readonly civilStatus: CivilStatus;
  readonly address: ResidentAddress;
  readonly contact: ContactDetails;
  readonly sectors: readonly VulnerabilitySector[];
  /**
   * PhilSys reference (RA 11055). Stored as the last four digits only — the
   * full PSN is never held by an LGU front end.
   */
  readonly philsysLastFour: string | null;
  readonly monthlyIncome: Money | null;
  readonly isActive: boolean;
  readonly audit: AuditStamp;
}

export type HouseholdRole = 'head' | 'spouse' | 'child' | 'parent' | 'relative' | 'non-relative';

export const HOUSEHOLD_ROLES: readonly HouseholdRole[] = [
  'head',
  'spouse',
  'child',
  'parent',
  'relative',
  'non-relative',
];

export interface HouseholdMember {
  readonly residentId: ResidentId;
  readonly role: HouseholdRole;
}

export interface Household {
  readonly id: HouseholdId;
  readonly referenceNumber: string;
  readonly headResidentId: ResidentId;
  readonly address: ResidentAddress;
  readonly members: readonly HouseholdMember[];
  readonly monthlyIncome: Money | null;
  readonly isIndigent: boolean;
  readonly audit: AuditStamp;
}

/* ── Filtering ────────────────────────────────────────────────────────────── */

/**
 * Age bands the office actually works in. Statutory rather than arbitrary:
 * `senior` is 60+ under RA 9994, and `child` is under 18 under RA 9344 and the
 * child-welfare programmes.
 */
export type ResidentAgeGroup = 'child' | 'youth' | 'adult' | 'senior';

export const RESIDENT_AGE_GROUPS: readonly ResidentAgeGroup[] = [
  'child',
  'youth',
  'adult',
  'senior',
];

interface AgeRange {
  readonly minAge: number;
  readonly maxAge: number | null;
}

export const RESIDENT_AGE_RANGES: Readonly<Record<ResidentAgeGroup, AgeRange>> = {
  child: { minAge: 0, maxAge: 17 },
  youth: { minAge: 18, maxAge: 30 },
  adult: { minAge: 31, maxAge: 59 },
  senior: { minAge: 60, maxAge: null },
};

export interface ResidentFilter {
  readonly search?: string;
  readonly barangayId?: BarangayId;
  readonly sector?: VulnerabilitySector;
  readonly ageGroup?: ResidentAgeGroup;
  readonly householdId?: HouseholdId;
  readonly includeInactive?: boolean;
}

export const EMPTY_RESIDENT_FILTER: ResidentFilter = {};

export function isResidentFilterActive(filter: ResidentFilter): boolean {
  return (
    Boolean(filter.search) ||
    filter.barangayId !== undefined ||
    filter.sector !== undefined ||
    filter.ageGroup !== undefined ||
    filter.householdId !== undefined ||
    filter.includeInactive === true
  );
}

export type ResidentSortField = 'name' | 'barangay' | 'birthDate' | 'updatedAt';

/* ── Formatting and derived facts ─────────────────────────────────────────── */

export function formatPersonName(name: PersonName): string {
  const middleInitial = name.middle ? `${name.middle.charAt(0)}.` : null;
  return [name.first, middleInitial, name.last, name.suffix].filter(Boolean).join(' ');
}

export function formatPersonNameListed(name: PersonName): string {
  const given = [name.first, name.middle].filter(Boolean).join(' ');
  const family = [name.last, name.suffix].filter(Boolean).join(' ');
  return `${family}, ${given}`;
}

/**
 * Surname plus a given initial, for a record the viewer is not cleared to open.
 *
 * Not zero disclosure, deliberately. An intake officer must be able to notice
 * "there is already a Mercado on file" to avoid registering a duplicate, which
 * is the failure that sends a survivor through the whole intake conversation a
 * second time. Everything past that — sector, address, contact — is withheld.
 */
export function formatProtectedName(name: PersonName): string {
  return `${name.last}, ${name.first.charAt(0)}.`;
}

export function hasSensitiveSector(resident: Resident): boolean {
  return resident.sectors.some(isSensitiveSector);
}

/** Age in whole years at `on` (defaults to today). */
export function ageInYears(birthDate: IsoDate, on: Date = new Date()): number {
  const born = new Date(birthDate);
  let age = on.getFullYear() - born.getFullYear();
  const monthDelta = on.getMonth() - born.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && on.getDate() < born.getDate())) {
    age -= 1;
  }
  return age;
}

export function isInAgeGroup(
  birthDate: IsoDate,
  group: ResidentAgeGroup,
  on: Date = new Date(),
): boolean {
  const age = ageInYears(birthDate, on);
  const range = RESIDENT_AGE_RANGES[group];
  return age >= range.minAge && (range.maxAge === null || age <= range.maxAge);
}

/* ── Creating and editing ─────────────────────────────────────────────────── */

/**
 * What a create or edit form submits.
 *
 * Deliberately not `Partial<Resident>`: the id, audit stamp and active flag are
 * decided by the system, never by the form, and the draft carries only fields a
 * person is entitled to type.
 */
export interface ResidentDraft {
  readonly name: PersonName;
  readonly sex: Sex;
  readonly birthDate: IsoDate;
  readonly civilStatus: CivilStatus;
  readonly address: ResidentAddress;
  readonly contact: ContactDetails;
  readonly sectors: readonly VulnerabilitySector[];
  readonly philsysLastFour: string | null;
  readonly monthlyIncome: Money | null;
  readonly householdId: HouseholdId | null;
}

/** Field-keyed so a form can put each message beside the control it belongs to. */
export type ResidentDraftField =
  | 'first'
  | 'last'
  | 'birthDate'
  | 'barangayId'
  | 'streetAddress'
  | 'philsysLastFour'
  | 'mobile'
  | 'email';

export interface ResidentDraftProblem {
  readonly field: ResidentDraftField;
  readonly rule: ResidentDraftRule;
}

/**
 * The rule that failed, not the sentence shown for it. Wording is copy and
 * lives in the feature (`DL-23`); the domain only decides what is wrong.
 */
export type ResidentDraftRule =
  | 'required'
  | 'not-a-date'
  | 'in-the-future'
  | 'implausibly-old'
  | 'must-be-four-digits'
  | 'not-a-mobile-number'
  | 'not-an-email';

const MOBILE_PATTERN = /^(\+?63|0)9\d{2}[- ]?\d{3}[- ]?\d{4}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const OLDEST_PLAUSIBLE_AGE = 120;

/**
 * Validates a draft without touching a repository.
 *
 * A pure function so the same rules run in the form, in the adapter and in a
 * test. The API validates independently; this exists so a person is told what
 * is wrong before a round trip, not so the client can be trusted.
 */
export function validateResidentDraft(
  draft: ResidentDraft,
  on: Date = new Date(),
): readonly ResidentDraftProblem[] {
  const problems: ResidentDraftProblem[] = [];
  const fail = (field: ResidentDraftField, rule: ResidentDraftRule): void => {
    problems.push({ field, rule });
  };

  if (draft.name.first.trim().length === 0) {
    fail('first', 'required');
  }
  if (draft.name.last.trim().length === 0) {
    fail('last', 'required');
  }

  const birth = new Date(draft.birthDate);
  if (draft.birthDate.trim().length === 0) {
    fail('birthDate', 'required');
  } else if (Number.isNaN(birth.getTime())) {
    fail('birthDate', 'not-a-date');
  } else if (birth.getTime() > on.getTime()) {
    fail('birthDate', 'in-the-future');
  } else if (ageInYears(draft.birthDate, on) > OLDEST_PLAUSIBLE_AGE) {
    fail('birthDate', 'implausibly-old');
  }

  if (draft.address.barangayId.trim().length === 0) {
    fail('barangayId', 'required');
  }
  if ((draft.address.streetAddress ?? '').trim().length === 0) {
    fail('streetAddress', 'required');
  }

  // Optional, but wrong is worse than absent: four digits or nothing.
  if (draft.philsysLastFour !== null && !/^\d{4}$/.test(draft.philsysLastFour)) {
    fail('philsysLastFour', 'must-be-four-digits');
  }
  if (draft.contact.mobile !== null && !MOBILE_PATTERN.test(draft.contact.mobile.trim())) {
    fail('mobile', 'not-a-mobile-number');
  }
  if (draft.contact.email !== null && !EMAIL_PATTERN.test(draft.contact.email.trim())) {
    fail('email', 'not-an-email');
  }

  return problems;
}

/**
 * A rejected write, carrying which rules failed and nothing about any other
 * record. The message is fixed and non-technical, like `PermissionDeniedError`.
 */
export class ResidentDraftInvalidError extends Error {
  readonly problems: readonly ResidentDraftProblem[];

  constructor(problems: readonly ResidentDraftProblem[]) {
    super('Some of those details need correcting before the record can be saved.');
    this.name = 'ResidentDraftInvalidError';
    this.problems = problems;
  }
}

export function isResidentDraftInvalid(error: unknown): error is ResidentDraftInvalidError {
  return error instanceof ResidentDraftInvalidError;
}

export function toResidentDraft(resident: Resident): ResidentDraft {
  return {
    name: resident.name,
    sex: resident.sex,
    birthDate: resident.birthDate,
    civilStatus: resident.civilStatus,
    address: resident.address,
    contact: resident.contact,
    sectors: resident.sectors,
    philsysLastFour: resident.philsysLastFour,
    monthlyIncome: resident.monthlyIncome,
    householdId: resident.householdId,
  };
}
