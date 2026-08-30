import { describe, expect, it } from 'vitest';

import type { HouseholdMemberView } from '../households/household-profile';

import {
  HOUSEHOLD_COMPOSITION_UNREADABLE,
  membersOf,
  type HouseholdComposition,
} from './resident-profile';

const member = { role: 'spouse', isHead: false } as unknown as HouseholdMemberView;

describe('who else lives at this address', () => {
  it('gives back what was read', () => {
    const composition: HouseholdComposition = { kind: 'read', members: [member] };

    expect(membersOf(composition)).toEqual([member]);
  });

  it('gives back nothing when the household genuinely has no other members', () => {
    expect(membersOf({ kind: 'read', members: [] })).toEqual([]);
  });

  /**
   * The whole point: unavailable yields an empty list to a *counter*, and a counter must never be
   * the thing that renders the answer.
   *
   * `membersOf` exists so a caller that only needs a length is not forced to duplicate the
   * narrowing. It is deliberately lossy, and every screen therefore switches on `kind` before it
   * decides what sentence to show — an empty list rendered as "no household members" is a positive
   * claim about a family, made from data nobody sent.
   */
  it('is empty for unavailable too, which is why a screen must not ask it first', () => {
    expect(membersOf({ kind: 'unavailable', because: 'x' })).toEqual([]);
  });

  /**
   * The sentence names what is missing from the record, never the software that is missing it.
   *
   * A caseworker reading "the API omits household roles" learns something about this office's
   * procurement. A caseworker reading "who else lives at this address could not be read" learns
   * something about the family in front of them, and knows to open the household record.
   */
  it('says what is missing rather than naming the defect', () => {
    expect(HOUSEHOLD_COMPOSITION_UNREADABLE).not.toMatch(/API|endpoint|payload|null|undefined/i);
    expect(HOUSEHOLD_COMPOSITION_UNREADABLE).toMatch(/could not be read/);
  });

  /** And it refuses the reading it exists to prevent, in as many words. */
  it('says explicitly that it is not a claim that nobody else lives there', () => {
    expect(HOUSEHOLD_COMPOSITION_UNREADABLE).toMatch(/not a statement that nobody does/i);
  });
});
