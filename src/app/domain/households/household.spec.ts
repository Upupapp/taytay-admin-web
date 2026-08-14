import {
  applyMembershipChanges,
  asId,
  compareBands,
  isAtLeastBand,
  memberRole,
  validateComposition,
  type HouseholdMember,
  type ResidentId,
} from '@domain/index';

const ANA = asId<ResidentId>('res-ana');
const BEN = asId<ResidentId>('res-ben');
const CARLA = asId<ResidentId>('res-carla');

const family: readonly HouseholdMember[] = [
  { residentId: ANA, role: 'head' },
  { residentId: BEN, role: 'spouse' },
  { residentId: CARLA, role: 'child' },
];

describe('membership changes are intents, applied in order', () => {
  it('adds someone who is not already a member', () => {
    const dana = asId<ResidentId>('res-dana');
    const next = applyMembershipChanges(family, ANA, [
      { kind: 'add-member', residentId: dana, role: 'relative' },
    ]);
    expect(next.members).toHaveLength(4);
    expect(memberRole({ members: next.members } as never, dana)).toBe('relative');
  });

  it('ignores adding someone who is already there, rather than duplicating them', () => {
    const next = applyMembershipChanges(family, ANA, [
      { kind: 'add-member', residentId: BEN, role: 'relative' },
    ]);
    expect(next.members).toHaveLength(3);
    // And the existing role is left alone: adding is not a way to demote.
    expect(next.members.find((member) => member.residentId === BEN)?.role).toBe('spouse');
  });

  it('moves the headship and demotes the outgoing head in one act', () => {
    // Two heads for even a moment is a household two screens would read
    // differently, so the demotion is part of the same change.
    const next = applyMembershipChanges(family, ANA, [{ kind: 'set-head', residentId: BEN }]);
    expect(next.headResidentId).toBe(BEN);
    expect(next.members.filter((member) => member.role === 'head')).toHaveLength(1);
    expect(next.members.find((member) => member.residentId === ANA)?.role).toBe('relative');
  });

  it('applies a sequence in order, so a later change sees the earlier one', () => {
    const next = applyMembershipChanges(family, ANA, [
      { kind: 'set-head', residentId: BEN },
      { kind: 'remove-member', residentId: ANA },
    ]);
    expect(next.headResidentId).toBe(BEN);
    expect(next.members.map((member) => member.residentId)).toEqual([BEN, CARLA]);
  });

  it('does not mutate what it was given', () => {
    applyMembershipChanges(family, ANA, [{ kind: 'remove-member', residentId: BEN }]);
    expect(family).toHaveLength(3);
  });
});

describe('composition invariants', () => {
  it('accepts a household with one head who is a member', () => {
    expect(validateComposition(family, ANA)).toHaveLength(0);
  });

  it('refuses two heads', () => {
    const twoHeads: readonly HouseholdMember[] = [
      { residentId: ANA, role: 'head' },
      { residentId: BEN, role: 'head' },
    ];
    expect(validateComposition(twoHeads, ANA)).toContainEqual({
      code: 'several-heads',
      residentId: null,
    });
  });

  it('refuses a head who is not a member', () => {
    const problems = validateComposition(family, asId<ResidentId>('res-stranger'));
    expect(problems.some((problem) => problem.code === 'head-not-a-member')).toBe(true);
  });

  it('refuses a head pointer that disagrees with the member marked head', () => {
    // The two ways of saying "who heads this" must agree, or a report and a
    // screen will each pick a different one.
    const problems = validateComposition(family, BEN);
    expect(problems.some((problem) => problem.code === 'head-not-a-member')).toBe(true);
  });

  it('refuses the same person listed twice', () => {
    const duplicated: readonly HouseholdMember[] = [...family, { residentId: BEN, role: 'child' }];
    expect(validateComposition(duplicated, ANA)).toContainEqual({
      code: 'duplicate-member',
      residentId: BEN,
    });
  });

  it('refuses an empty household', () => {
    expect(validateComposition([], ANA)).toContainEqual({ code: 'no-members', residentId: null });
  });

  it('catches removing the last head before anything is saved', () => {
    const proposed = applyMembershipChanges(family, ANA, [
      { kind: 'change-role', residentId: ANA, role: 'relative' },
    ]);
    expect(validateComposition(proposed.members, proposed.headResidentId)).toContainEqual({
      code: 'no-head',
      residentId: null,
    });
  });
});

describe('bands order without becoming a score', () => {
  it('orders none < watch < elevated < high', () => {
    expect(compareBands('none', 'watch')).toBeLessThan(0);
    expect(compareBands('high', 'elevated')).toBeGreaterThan(0);
    expect(compareBands('watch', 'watch')).toBe(0);
  });

  it('treats a minimum band as inclusive', () => {
    expect(isAtLeastBand('elevated', 'elevated')).toBe(true);
    expect(isAtLeastBand('high', 'elevated')).toBe(true);
    expect(isAtLeastBand('watch', 'elevated')).toBe(false);
  });
});
