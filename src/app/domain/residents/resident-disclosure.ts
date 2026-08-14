import type { Permission } from '../access/permission';
import {
  formatPersonName,
  formatPersonNameListed,
  formatProtectedName,
  hasSensitiveSector,
  isSensitiveSector,
  type Resident,
} from './resident';

/**
 * The attributes of a resident record that are not disclosed by default.
 *
 * `resident.view` earns the right to know that a person exists and where to
 * find them administratively. It does not earn their identity number, their
 * income, or — for a record under statutory protection — how to reach them.
 */
export type ResidentField =
  'philsysLastFour' | 'monthlyIncome' | 'protectedSectors' | 'contact' | 'exactAddress';

/**
 * Two tiers, because the two kinds of sensitivity are not the same thing.
 *
 * `resident.view-sensitive` covers identity and means — the PhilSys reference
 * (RA 11055) and household income — which every case-working role eventually
 * needs and no read-only or payout role does.
 *
 * `request.view-sensitive` covers the protected-sector tier: records flagged
 * `vawc-survivor` (RA 9262) or `cicl` (RA 9344). That is the narrower grant,
 * held only by the head, social workers and the administrator, and it is what
 * unlocks a survivor's address and contact details.
 */
export const RESIDENT_FIELD_PERMISSIONS: Readonly<Record<ResidentField, Permission>> = {
  philsysLastFour: 'resident.view-sensitive',
  monthlyIncome: 'resident.view-sensitive',
  protectedSectors: 'request.view-sensitive',
  contact: 'request.view-sensitive',
  exactAddress: 'request.view-sensitive',
};

/**
 * A resident as a particular viewer is allowed to see them.
 *
 * `resident` is **already redacted**. A caller cannot render a withheld
 * attribute because it never received one — which is the difference between
 * this and masking in a template, where forgetting one binding leaks the field
 * (`DL-38`). `withheld` exists so the screen can say *"3 details are hidden by
 * your role"* instead of silently showing blanks that read as "not recorded".
 */
export interface ResidentView {
  readonly resident: Resident;
  /**
   * The record is flagged under a protected sector. Stated even when the sector
   * itself is withheld: a worker who does not know a record needs careful
   * handling will handle it carelessly.
   */
  readonly isProtected: boolean;
  readonly withheld: readonly ResidentField[];
  /** `Surname, Given` — already masked when the viewer is not cleared. */
  readonly listedName: string;
  /** `Given Surname` — already masked when the viewer is not cleared. */
  readonly fullName: string;
}

export type PermissionCheck = (permission: Permission) => boolean;

/**
 * Applies the disclosure policy. Pure, so the adapter, the API contract and a
 * test all agree on what a role may see.
 *
 * Called by the **data layer** on the way out. The view layer consumes the
 * result; it is not trusted to perform the redaction itself.
 */
export function discloseResident(resident: Resident, holds: PermissionCheck): ResidentView {
  const withheld: ResidentField[] = [];
  const isProtected = hasSensitiveSector(resident);
  const cleared = holds(RESIDENT_FIELD_PERMISSIONS.protectedSectors);
  const identityCleared = holds(RESIDENT_FIELD_PERMISSIONS.philsysLastFour);

  if (!identityCleared) {
    if (resident.philsysLastFour !== null) {
      withheld.push('philsysLastFour');
    }
    if (resident.monthlyIncome !== null) {
      withheld.push('monthlyIncome');
    }
  }

  // The protected tier bites only on a flagged record. An ordinary resident's
  // phone number is ordinary: intake has to be able to ring them back.
  const redactProtected = isProtected && !cleared;
  if (redactProtected) {
    withheld.push('protectedSectors');
    if (resident.contact.mobile !== null || resident.contact.email !== null) {
      withheld.push('contact');
    }
    if (resident.address.streetAddress !== null || resident.address.purokOrSitio !== null) {
      withheld.push('exactAddress');
    }
  }

  const redacted: Resident = {
    ...resident,
    philsysLastFour: identityCleared ? resident.philsysLastFour : null,
    monthlyIncome: identityCleared ? resident.monthlyIncome : null,
    sectors: redactProtected
      ? resident.sectors.filter((s) => !isSensitiveSector(s))
      : resident.sectors,
    contact: redactProtected ? { mobile: null, email: null } : resident.contact,
    address: redactProtected
      ? { barangayId: resident.address.barangayId, purokOrSitio: null, streetAddress: null }
      : resident.address,
  };

  return {
    resident: redacted,
    isProtected,
    withheld,
    listedName: redactProtected
      ? formatProtectedName(resident.name)
      : formatPersonNameListed(resident.name),
    fullName: redactProtected
      ? formatProtectedName(resident.name)
      : formatPersonName(resident.name),
  };
}

export function isWithheld(view: ResidentView, field: ResidentField): boolean {
  return view.withheld.includes(field);
}
