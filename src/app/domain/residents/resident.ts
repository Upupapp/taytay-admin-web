import type { AuditStamp } from '../shared/audit';
import type { BarangayId, HouseholdId, IsoDate, ResidentId } from '../shared/ids';
import type { Money } from '../shared/money';

export type Sex = 'female' | 'male';

export type CivilStatus =
  'single' | 'married' | 'widowed' | 'separated' | 'annulled' | 'cohabiting';

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

/**
 * Sectors whose mere membership is sensitive personal information. Records
 * touching these are masked in list views and require an explicit
 * `case.view-sensitive` permission to open.
 */
export const SENSITIVE_SECTORS: readonly VulnerabilitySector[] = ['vawc-survivor', 'cicl'];

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
  readonly purokOrSitio: string | null;
  readonly streetAddress: string;
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

export interface ResidentFilter {
  readonly search?: string;
  readonly barangayId?: BarangayId;
  readonly sector?: VulnerabilitySector;
  readonly includeInactive?: boolean;
}

export type ResidentSortField = 'name' | 'barangay' | 'birthDate' | 'updatedAt';

export function formatPersonName(name: PersonName): string {
  const middleInitial = name.middle ? `${name.middle.charAt(0)}.` : null;
  return [name.first, middleInitial, name.last, name.suffix].filter(Boolean).join(' ');
}

export function formatPersonNameListed(name: PersonName): string {
  const given = [name.first, name.middle].filter(Boolean).join(' ');
  const family = [name.last, name.suffix].filter(Boolean).join(' ');
  return `${family}, ${given}`;
}

export function hasSensitiveSector(resident: Resident): boolean {
  return resident.sectors.some((sector) => SENSITIVE_SECTORS.includes(sector));
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
