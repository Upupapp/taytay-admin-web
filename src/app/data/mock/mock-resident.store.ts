import { Injectable } from '@angular/core';

import {
  asId,
  asIsoDateTime,
  type Household,
  type HouseholdId,
  type Resident,
  type ResidentDraft,
  type ResidentId,
  type StaffUserId,
} from '@domain/index';

import { MOCK_HOUSEHOLDS, MOCK_RESIDENTS } from './seed/residents.seed';

/**
 * Mutable mock state for the registry.
 *
 * The seed arrays stay frozen constants — several other mock adapters read them
 * and a shared mutable export would let one repository's write surprise another.
 * This holds the working copy instead, so create and edit behave like a registry
 * (the record you just saved is the record the list shows) without pretending to
 * be durable: it lives for the lifetime of the tab, and says so.
 */
@Injectable({ providedIn: 'root' })
export class MockResidentStore {
  private residents: Resident[] = [...MOCK_RESIDENTS];
  private readonly households: Household[] = [...MOCK_HOUSEHOLDS];
  // Derived from the highest id in the seed, not from its length: the generated
  // block is numbered from res-0100, so counting records would hand a new
  // resident an id that already belongs to someone.
  private sequence = highestSerial(MOCK_RESIDENTS);

  all(): readonly Resident[] {
    return this.residents;
  }

  find(id: ResidentId): Resident | undefined {
    return this.residents.find((resident) => resident.id === id);
  }

  allHouseholds(): readonly Household[] {
    return this.households;
  }

  findHousehold(id: HouseholdId): Household | undefined {
    return this.households.find((household) => household.id === id);
  }

  add(draft: ResidentDraft, actorId: StaffUserId | null): Resident {
    this.sequence += 1;
    const now = asIsoDateTime(new Date());
    const created: Resident = {
      ...fromDraft(draft),
      id: asId<ResidentId>(`res-${String(this.sequence).padStart(4, '0')}`),
      isActive: true,
      audit: { createdAt: now, createdBy: actorId, updatedAt: now, updatedBy: actorId },
    };
    this.residents = [created, ...this.residents];
    return created;
  }

  replace(existing: Resident, draft: ResidentDraft, actorId: StaffUserId | null): Resident {
    return this.write(
      {
        ...existing,
        ...fromDraft(draft),
        id: existing.id,
        isActive: existing.isActive,
        audit: existing.audit,
      },
      actorId,
    );
  }

  setActive(existing: Resident, isActive: boolean, actorId: StaffUserId | null): Resident {
    return this.write({ ...existing, isActive }, actorId);
  }

  private write(next: Resident, actorId: StaffUserId | null): Resident {
    const stamped: Resident = {
      ...next,
      audit: {
        ...next.audit,
        updatedAt: asIsoDateTime(new Date()),
        updatedBy: actorId,
      },
    };
    this.residents = this.residents.map((resident) =>
      resident.id === stamped.id ? stamped : resident,
    );
    return stamped;
  }
}

function highestSerial(residents: readonly Resident[]): number {
  return residents.reduce((highest, resident) => {
    const serial = Number.parseInt(resident.id.replace(/\D/g, ''), 10);
    return Number.isNaN(serial) ? highest : Math.max(highest, serial);
  }, 0);
}

function fromDraft(draft: ResidentDraft): Omit<Resident, 'id' | 'isActive' | 'audit'> {
  return {
    householdId: draft.householdId,
    name: {
      first: draft.name.first.trim(),
      middle: emptyToNull(draft.name.middle),
      last: draft.name.last.trim(),
      suffix: emptyToNull(draft.name.suffix),
    },
    sex: draft.sex,
    birthDate: draft.birthDate,
    civilStatus: draft.civilStatus,
    address: {
      barangayId: draft.address.barangayId,
      purokOrSitio: emptyToNull(draft.address.purokOrSitio),
      streetAddress: emptyToNull(draft.address.streetAddress),
    },
    contact: {
      mobile: emptyToNull(draft.contact.mobile),
      email: emptyToNull(draft.contact.email),
    },
    sectors: [...draft.sectors],
    philsysLastFour: emptyToNull(draft.philsysLastFour),
    monthlyIncome: draft.monthlyIncome,
  };
}

function emptyToNull(value: string | null): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed.length > 0 ? trimmed : null;
}
