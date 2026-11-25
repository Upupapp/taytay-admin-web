import {
  asIsoDate,
  type IsoDateTime,
  type Permission,
  type Resident,
  type ResidentRegistryFacts,
  type ResidentSectorDetail,
  type VulnerabilitySector,
} from '@domain/index';

import { MOCK_HOUSEHOLDS, MOCK_RESIDENTS } from './seed/residents.seed';
import { daysBeforeAnchor } from './seed/seed-utils';

/**
 * The registry facts the API sends beside a record (`DL-232`), as **sample data** for the demo:
 * which records an app account reads, whether it is verified and holds a card, the household's
 * reference, and what the office saw on each sector card. The seed records none of these, so they
 * follow a fixed rule over the seed's order — stable across runs, and never shown by the http set.
 */

/**
 * When the sample cards' status history begins (`DL-257`): a month period starting after it is
 * compared, a longer one says from when the record runs, as the API does after its migration 0079.
 */
export const MOCK_CARD_HISTORY_BEGAN = daysBeforeAnchor(45);

export interface MockAppLink {
  readonly linkedSince: IsoDateTime;
  readonly verified: boolean;
  readonly cardStatus: 'active' | 'suspended' | 'expired' | 'none';
}

const ORDER = new Map(MOCK_RESIDENTS.map((resident, index) => [resident.id, index]));

/** Every third seeded record is read by an app account; half of those verified; some hold a card. */
export function mockAppLinkOf(resident: Resident): MockAppLink | null {
  const index = ORDER.get(resident.id);
  if (index === undefined || index % 3 !== 0) {
    return null;
  }
  const verified = index % 6 === 0;
  return {
    linkedSince: daysBeforeAnchor(10 + (index % 200)),
    verified,
    cardStatus: !verified
      ? 'none'
      : index % 12 === 0
        ? 'active'
        : index % 30 === 0
          ? 'suspended'
          : index % 42 === 0
            ? 'expired'
            : 'none',
  };
}

const CARDED: readonly VulnerabilitySector[] = ['senior-citizen', 'pwd', 'solo-parent'];
const DISABILITY_TYPES = ['Orthopedic', 'Visual', 'Hearing', 'Psychosocial', 'Learning'] as const;

/** What the office saw on each sector card: about two in three cards are on file. */
export function mockSectorDetailsOf(
  resident: Resident,
  sensitive: boolean,
): readonly ResidentSectorDetail[] {
  const index = ORDER.get(resident.id) ?? 0;
  return resident.sectors.map((sector, position) => {
    const onFile = CARDED.includes(sector) && (index + position) % 3 !== 2;
    const issued = new Date(Date.parse(daysBeforeAnchor(100 + ((index * 17) % 900))));
    const valid = new Date(issued);
    valid.setUTCFullYear(valid.getUTCFullYear() + (sector === 'senior-citizen' ? 5 : 3));
    const day = (at: Date) => asIsoDate(at.toISOString().slice(0, 10));
    const shown = sensitive && onFile;
    return {
      sector,
      since: day(new Date(Date.parse(resident.audit.createdAt))),
      idNumber: shown ? `••••${String(1000 + ((index * 53 + position) % 9000))}` : null,
      issuedOn: shown ? day(issued) : null,
      validUntil: shown ? day(valid) : null,
      socialPension: sensitive && sector === 'senior-citizen' ? index % 2 === 0 : null,
      disabilityType:
        sensitive && sector === 'pwd'
          ? (DISABILITY_TYPES[index % DISABILITY_TYPES.length] ?? null)
          : null,
      detailsWithheld: !sensitive,
    };
  });
}

/** The facts a reader is sent, each behind the key the API asks for (backend ADR 0006). */
export function mockRegistryFactsOf(
  resident: Resident,
  holds: (permission: Permission) => boolean,
): ResidentRegistryFacts {
  const household =
    resident.householdId === null
      ? undefined
      : MOCK_HOUSEHOLDS.find((entry) => entry.id === resident.householdId);
  const link = mockAppLinkOf(resident);
  // Without the key that opens the household it is withheld whether or not there is one.
  const householdWithheld = !holds('household.view');
  return {
    householdReference: householdWithheld ? null : (household?.referenceNumber ?? null),
    householdWithheld,
    appAccount:
      link === null
        ? null
        : {
            linkedSince: link.linkedSince,
            verified: holds('user.view') ? link.verified : null,
            cardStatus: holds('digital-id.manage') ? link.cardStatus : null,
          },
    sectorDetails: mockSectorDetailsOf(resident, holds('resident.view-sensitive')),
  };
}
