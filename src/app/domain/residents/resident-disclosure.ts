import type { Permission } from '../access/permission';
import {
  formatPersonName,
  formatPersonNameListed,
  formatProtectedName,
  hasSensitiveSector,
  isSensitiveSector,
  type Resident,
  type VulnerabilitySector,
} from './resident';
import type { IsoDate, IsoDateTime } from '../shared/ids';
import type { StatusCatalog } from '../shared/status';

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
  /**
   * What the registry list and the record read send beside the record (`DL-232`); absent where
   * the read does not send it (a household's members, a write's answer). Already redacted by the
   * server, like the record.
   */
  readonly registry?: ResidentRegistryFacts;
}

/** A digital ID's standing as a registry row says it: `none` is an account holding no card. */
export const REGISTRY_CARD_STATUSES = ['active', 'suspended', 'expired', 'none'] as const;
export type RegistryCardStatus = (typeof REGISTRY_CARD_STATUSES)[number];

/**
 * The residents' app as a registry row says it. `verified` and `cardStatus` are `null` — "not for
 * this reader", never "no" — without the keys that already open the account and its card
 * (`user.view`, `digital-id.manage`; backend ADR 0006).
 */
export interface RegistryAppAccount {
  readonly linkedSince: IsoDateTime;
  readonly verified: boolean | null;
  readonly cardStatus: RegistryCardStatus | null;
}

/**
 * One current sector and what the office saw on its card. The number is masked to its last four
 * characters (`DL-183`); number, dates, pension and disability are the identity tier's, so without
 * `resident.view-sensitive` they are `null` and `detailsWithheld` says so.
 */
export interface ResidentSectorDetail {
  readonly sector: VulnerabilitySector;
  readonly since: IsoDate;
  readonly idNumber: string | null;
  readonly issuedOn: IsoDate | null;
  readonly validUntil: IsoDate | null;
  /** Senior citizens only. */
  readonly socialPension: boolean | null;
  /** PWD only, free text as recorded. */
  readonly disabilityType: string | null;
  readonly detailsWithheld: boolean;
}

/**
 * Where a registry record stands with the residents' app, as the registry boards' "App and Digital
 * ID" column says it — derived from what the row was sent, never stored. `on-app` is a record an
 * account reads, for a reader not sent whether it is verified or holds a card.
 */
export type RegistryAppStanding =
  | 'not-on-app'
  | 'on-app'
  | 'unverified'
  | 'verified-no-card'
  | 'card-active'
  | 'card-suspended'
  | 'card-expired';

export const REGISTRY_APP_STANDING_CATALOG: StatusCatalog<RegistryAppStanding> = {
  'not-on-app': {
    value: 'not-on-app',
    label: 'Not on the app',
    tone: 'neutral',
    description: 'No residents’ app account reads this record.',
  },
  'on-app': {
    value: 'on-app',
    label: 'On the app',
    tone: 'info',
    description:
      'An app account reads this record. Whether it is verified or holds a card is not sent to your role.',
  },
  unverified: {
    value: 'unverified',
    label: 'On the app, not verified',
    tone: 'info',
    description: 'An app account reads this record and has not been verified.',
  },
  'verified-no-card': {
    value: 'verified-no-card',
    label: 'Verified, no card',
    tone: 'warning',
    description: 'The account is verified and holds no Digital ID.',
  },
  'card-active': {
    value: 'card-active',
    label: 'Digital ID active',
    tone: 'success',
    description: 'The account holds a Digital ID that is active and not past its date.',
  },
  'card-suspended': {
    value: 'card-suspended',
    label: 'Card suspended',
    tone: 'danger',
    description: 'The account’s Digital ID is suspended.',
  },
  'card-expired': {
    value: 'card-expired',
    label: 'Card expired',
    tone: 'danger',
    description: 'The account’s Digital ID is past its date.',
  },
};

/** The standing a row's app facts say. */
export function registryAppStanding(account: RegistryAppAccount | null): RegistryAppStanding {
  if (account === null) return 'not-on-app';
  switch (account.cardStatus) {
    case 'active':
      return 'card-active';
    case 'suspended':
      return 'card-suspended';
    case 'expired':
      return 'card-expired';
    case 'none':
      return account.verified === true ? 'verified-no-card' : 'unverified';
    case null:
      return account.verified === null ? 'on-app' : account.verified ? 'on-app' : 'unverified';
  }
}

export interface ResidentRegistryFacts {
  /**
   * The household the record lives in now. `null` when it lives in none **or** when withheld —
   * `householdWithheld` tells the two apart (`household.view`). Not a field of the record's form,
   * so it is not one of `withheld`, which gates editing.
   */
  readonly householdReference: string | null;
  readonly householdWithheld: boolean;
  /** `null`: no app account reads the record. */
  readonly appAccount: RegistryAppAccount | null;
  readonly sectorDetails: readonly ResidentSectorDetail[];
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

/**
 * A member of a household or family as this viewer may see them, when somebody **else** in it is
 * under a protected sector — the API's rule, applied by the mock.
 *
 * People who share a record usually share a roof, so their exact address is the protected person's
 * too: listed beside the masked member, it would say where she lives. So it is withheld from every
 * member for a viewer not cleared for the protected tier, and named as withheld so the blank does
 * not read as "not recorded" (`DL-38`). A resident's own record, read alone, links nobody to anybody
 * and is disclosed by `discloseResident` as before.
 */
export function discloseMember(
  resident: Resident,
  holds: PermissionCheck,
  sharesProtectedAddress: boolean,
): ResidentView {
  const view = discloseResident(resident, holds);
  if (!sharesProtectedAddress || holds(RESIDENT_FIELD_PERMISSIONS.exactAddress)) {
    return view;
  }
  return {
    ...view,
    resident: {
      ...view.resident,
      address: {
        barangayId: view.resident.address.barangayId,
        purokOrSitio: null,
        streetAddress: null,
      },
    },
    withheld: view.withheld.includes('exactAddress')
      ? view.withheld
      : [...view.withheld, 'exactAddress'],
  };
}

export function isWithheld(view: ResidentView, field: ResidentField): boolean {
  return view.withheld.includes(field);
}
