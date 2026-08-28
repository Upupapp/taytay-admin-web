import { Injectable } from '@angular/core';

import {
  applyMembershipChanges,
  asId,
  asIsoDateTime,
  HouseholdCompositionError,
  validateComposition,
  type AuditEntry,
  type AuditEntryId,
  type FactorCorrection,
  type Household,
  type HouseholdId,
  type HouseholdMember,
  type HouseholdProblem,
  type MembershipChange,
  type Resident,
  type ResidentDraft,
  type ResidentId,
  type StaffUserId,
  type VulnerabilityFactorCode,
  type VulnerabilitySector,
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
  private residents: readonly Resident[] = [...MOCK_RESIDENTS];
  private households: readonly Household[] = [...MOCK_HOUSEHOLDS];
  private readonly correctionsByHousehold = new Map<HouseholdId, readonly FactorCorrection[]>();
  private readonly auditByHousehold = new Map<HouseholdId, readonly AuditEntry[]>();
  private auditSequence = 0;
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

  /** The household a resident belongs to, by membership rather than by pointer. */
  householdOfResident(residentId: ResidentId): Household | undefined {
    return this.households.find((household) =>
      household.members.some((member) => member.residentId === residentId),
    );
  }

  correctionsFor(id: HouseholdId): readonly FactorCorrection[] {
    return this.correctionsByHousehold.get(id) ?? [];
  }

  auditFor(id: HouseholdId): readonly AuditEntry[] {
    return this.auditByHousehold.get(id) ?? [];
  }

  /* ── Household composition ──────────────────────────────────────────────── */

  /**
   * Applies membership changes to a household **transactionally**.
   *
   * The whole next state — the household, every resident whose `householdId`
   * moves, the audit line — is computed and validated before anything is
   * assigned. If a rule fails, `HouseholdCompositionError` is thrown and not one
   * record has changed. The commit itself is a run of plain assignments with no
   * suspension point between them, so nothing can observe it half-applied.
   *
   * This is what keeps household → family → person consistent: a person is
   * added to the household's member list and pointed at the household in one
   * act, and a person removed here cannot keep a pointer to a household that no
   * longer lists them.
   */
  commitMembership(
    household: Household,
    changes: readonly MembershipChange[],
    reason: string,
    actor: Actor,
  ): Household {
    const proposed = applyMembershipChanges(household.members, household.headResidentId, changes);
    const problems = [
      ...validateComposition(proposed.members, proposed.headResidentId),
      ...this.referentialProblems(household, proposed.members),
    ];
    if (problems.length > 0) {
      throw new HouseholdCompositionError(problems);
    }

    const now = asIsoDateTime(new Date());
    const next: Household = {
      ...household,
      members: proposed.members,
      headResidentId: proposed.headResidentId,
      audit: { ...household.audit, updatedAt: now, updatedBy: actor.id },
    };

    const before = new Set(household.members.map((member) => member.residentId));
    const after = new Set(proposed.members.map((member) => member.residentId));
    const joined = [...after].filter((id) => !before.has(id));
    const left = [...before].filter((id) => !after.has(id));

    this.households = this.households.map((candidate) =>
      candidate.id === household.id ? next : candidate,
    );
    this.residents = this.residents.map((resident) => {
      if (joined.includes(resident.id)) {
        return { ...resident, householdId: household.id };
      }
      if (left.includes(resident.id)) {
        return { ...resident, householdId: null };
      }
      return resident;
    });
    this.appendAudit(
      household.id,
      'membership-changed',
      describeChanges(changes),
      reason,
      actor,
      now,
    );

    return next;
  }

  /* ── Vulnerability corrections ──────────────────────────────────────────── */

  recordCorrection(id: HouseholdId, correction: FactorCorrection, summary: string): void {
    const kept = this.correctionsFor(id).filter((entry) => entry.code !== correction.code);
    this.correctionsByHousehold.set(id, [...kept, correction]);
    this.appendAudit(
      id,
      'factor-corrected',
      summary,
      correction.reason,
      { id: correction.actorId, name: correction.actorName },
      correction.correctedAt,
    );
  }

  dropCorrection(
    id: HouseholdId,
    code: VulnerabilityFactorCode,
    summary: string,
    reason: string,
    actor: Actor,
  ): void {
    this.correctionsByHousehold.set(
      id,
      this.correctionsFor(id).filter((entry) => entry.code !== code),
    );
    this.appendAudit(id, 'factor-corrected', summary, reason, actor, asIsoDateTime(new Date()));
  }

  /**
   * Consistency rules that need the rest of the registry to answer, and so
   * cannot live in the pure domain validator: does this person exist, and are
   * they already under another roof?
   */
  private referentialProblems(
    household: Household,
    proposed: readonly HouseholdMember[],
  ): readonly HouseholdProblem[] {
    const problems: HouseholdProblem[] = [];
    for (const member of proposed) {
      if (this.find(member.residentId) === undefined) {
        problems.push({ code: 'member-not-found', residentId: member.residentId });
        continue;
      }
      const current = this.householdOfResident(member.residentId);
      if (current !== undefined && current.id !== household.id) {
        // One person, one household. Moving them silently would empty a family
        // on a screen nobody happened to be looking at.
        problems.push({ code: 'member-in-another-household', residentId: member.residentId });
      }
    }
    return problems;
  }

  private appendAudit(
    id: HouseholdId,
    action: AuditEntry['action'],
    summary: string,
    reason: string | null,
    actor: Actor,
    at: AuditEntry['occurredAt'],
  ): void {
    this.auditSequence += 1;
    const line: AuditEntry = {
      id: asId<AuditEntryId>(`audit-${String(this.auditSequence).padStart(5, '0')}`),
      entityType: 'household',
      entityId: id,
      action,
      summary,
      reason,
      actorId: actor.id,
      actorName: actor.name,
      occurredAt: at,
    };
    // Newest first: an audit panel is read from the top.
    this.auditByHousehold.set(id, [line, ...this.auditFor(id)]);
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

  /**
   * Adds or removes one sectoral membership.
   *
   * Idempotent on both sides, matching the API: recording the same sector twice leaves one entry,
   * because a duplicate would double every sectoral count the LGU reports.
   */
  setSector(
    existing: Resident,
    sector: VulnerabilitySector,
    present: boolean,
    actorId: StaffUserId | null,
  ): Resident {
    const sectors = present
      ? [...new Set([...existing.sectors, sector])]
      : existing.sectors.filter((entry) => entry !== sector);

    return this.write({ ...existing, sectors }, actorId);
  }

  /**
   * Repoints a resident at a household, for a family transfer that moves the
   * address too (TAB 09). Kept here rather than in the family store so the
   * resident record still has exactly one owner — the canonical source of
   * truth does not fork because a second feature needed to write to it.
   */
  setHousehold(
    residentId: ResidentId,
    householdId: HouseholdId | null,
    actorId: StaffUserId | null,
  ): Resident | undefined {
    const existing = this.find(residentId);
    return existing === undefined ? undefined : this.write({ ...existing, householdId }, actorId);
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

export interface Actor {
  readonly id: StaffUserId | null;
  readonly name: string;
}

/**
 * A one-line human summary of what a person did.
 *
 * Not screen copy: this is the permanent record, and it has to read the same in
 * an export, in a support ticket and on the page.
 */
function describeChanges(changes: readonly MembershipChange[]): string {
  return changes
    .map((change) => {
      switch (change.kind) {
        case 'add-member':
          return `added ${change.residentId} as ${change.role}`;
        case 'remove-member':
          return `removed ${change.residentId}`;
        case 'change-role':
          return `changed ${change.residentId} to ${change.role}`;
        case 'set-head':
          return `made ${change.residentId} the household head`;
      }
    })
    .join('; ');
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
