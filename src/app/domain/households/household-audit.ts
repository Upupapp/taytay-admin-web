import type { AuditAction } from '../shared/audit';
import type { ResidentId } from '../shared/ids';
import type { HouseholdRole, MembershipChange } from './household';
import type { FactorState, VulnerabilityFactorCode } from './household-vulnerability';

/**
 * What a household's trail says happened, in words — composed here and only here.
 *
 * The mock store writes a line when it changes a household; the API sends an event and the HTTP
 * adapter words it. Two composers would drift, and the same act would read one way on a laptop
 * running the mock and another against the office's server. So both call these. The reason stays
 * out of the summary: the summary is *what* changed, the reason is *why*, and `AuditEntry` keeps
 * them apart.
 *
 * Residents are named by id, never by name: a trail line is read by everybody who can open the
 * household, and a protected member's name is not theirs to read (`DL-38`).
 */
export type HouseholdEventKind =
  | 'registered'
  | 'member-added'
  | 'member-removed'
  | 'role-changed'
  | 'head-set'
  | 'factor-corrected'
  | 'correction-withdrawn';

export const HOUSEHOLD_EVENT_KINDS: readonly HouseholdEventKind[] = [
  'registered',
  'member-added',
  'member-removed',
  'role-changed',
  'head-set',
  'factor-corrected',
  'correction-withdrawn',
];

/** The registration's own line. It carries no reason: registering is the act, not a change to one. */
export const HOUSEHOLD_REGISTERED_SUMMARY = 'registered the household';

/** The reason the head's joining carries at registration — the API's words, kept the same here. */
export const HEAD_REGISTERED_REASON = 'Registered as the head of the household.';

export function describeMembershipChange(change: MembershipChange): string {
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
}

/** Several changes saved as one act, in the order they were made. */
export function describeMembershipChanges(changes: readonly MembershipChange[]): string {
  return changes.map(describeMembershipChange).join('; ');
}

export function describeFactorCorrection(
  code: VulnerabilityFactorCode,
  state: FactorState,
): string {
  return `set ${code} to ${state}`;
}

export function describeCorrectionWithdrawn(code: VulnerabilityFactorCode): string {
  return `restored ${code} to the computed value`;
}

/** The facts an event carries; which of them it needs depends on its kind. */
export interface HouseholdEventFacts {
  readonly kind: HouseholdEventKind;
  readonly residentId: ResidentId | null;
  readonly role: HouseholdRole | null;
  readonly factorCode: VulnerabilityFactorCode | null;
  readonly factorState: FactorState | null;
}

/**
 * One event in words, or `null` when it lacks a fact its kind needs — a line that would have to
 * guess who joined, or which indicator was overridden, is one this does not write.
 */
export function describeHouseholdEvent(event: HouseholdEventFacts): string | null {
  const { residentId, role, factorCode, factorState } = event;
  switch (event.kind) {
    case 'registered':
      return HOUSEHOLD_REGISTERED_SUMMARY;
    case 'member-added':
      return residentId === null || role === null
        ? null
        : describeMembershipChange({ kind: 'add-member', residentId, role });
    case 'member-removed':
      return residentId === null
        ? null
        : describeMembershipChange({ kind: 'remove-member', residentId });
    case 'role-changed':
      return residentId === null || role === null
        ? null
        : describeMembershipChange({ kind: 'change-role', residentId, role });
    case 'head-set':
      return residentId === null
        ? null
        : describeMembershipChange({ kind: 'set-head', residentId });
    case 'factor-corrected':
      return factorCode === null || factorState === null
        ? null
        : describeFactorCorrection(factorCode, factorState);
    case 'correction-withdrawn':
      return factorCode === null ? null : describeCorrectionWithdrawn(factorCode);
  }
}

/** Which audit action an event is, in the vocabulary every trail in the console shares. */
export function householdEventAction(kind: HouseholdEventKind): AuditAction {
  switch (kind) {
    case 'registered':
      return 'created';
    case 'member-added':
    case 'member-removed':
    case 'role-changed':
    case 'head-set':
      return 'membership-changed';
    case 'factor-corrected':
    case 'correction-withdrawn':
      return 'factor-corrected';
  }
}
