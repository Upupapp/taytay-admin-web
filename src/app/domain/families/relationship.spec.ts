import {
  asId,
  asIsoDate,
  asIsoDateTime,
  assignGenerations,
  fromPerspectiveOf,
  INVERSE_KINDS,
  isSameLink,
  isSymmetric,
  RELATIONSHIP_KINDS,
  validateRelationship,
  type Relationship,
  type RelationshipId,
  type ResidentId,
  type StaffUserId,
} from '@domain/index';

const ANA = asId<ResidentId>('res-ana');
const BEN = asId<ResidentId>('res-ben');
const CARLA = asId<ResidentId>('res-carla');
const LOLA = asId<ResidentId>('res-lola');
const ACTOR = asId<StaffUserId>('staff-test');

function link(
  id: string,
  from: ResidentId,
  to: ResidentId,
  kind: Relationship['kind'],
  until: string | null = null,
): Relationship {
  return {
    id: asId<RelationshipId>(id),
    fromResidentId: from,
    toResidentId: to,
    kind,
    since: asIsoDate('2016-01-05'),
    until: until === null ? null : asIsoDate(until),
    audit: {
      createdAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
      createdBy: ACTOR,
      updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
      updatedBy: ACTOR,
    },
  };
}

/*
 * A relationship is a fact about two people. These tests exist to keep it that
 * way — independent of any household, readable from either end, and never
 * silently reversed.
 */

describe('a relationship reads correctly from either end', () => {
  const parenthood = link('rel-1', ANA, BEN, 'parent-of');

  it('reads as recorded from the subject', () => {
    expect(fromPerspectiveOf(parenthood, ANA)).toMatchObject({
      kind: 'parent-of',
      otherResidentId: BEN,
    });
  });

  it('reads as the inverse from the other person', () => {
    // One record, two readings. Two records would be two facts that can
    // disagree, and eventually would.
    expect(fromPerspectiveOf(parenthood, BEN)).toMatchObject({
      kind: 'child-of',
      otherResidentId: ANA,
    });
  });

  it('returns nothing for somebody not involved', () => {
    expect(fromPerspectiveOf(parenthood, CARLA)).toBeNull();
  });

  it('gives every kind an inverse', () => {
    for (const kind of RELATIONSHIP_KINDS) {
      expect(INVERSE_KINDS[kind]).toBeTruthy();
    }
  });

  it('makes symmetric kinds their own inverse', () => {
    expect(isSymmetric('spouse-of')).toBe(true);
    expect(INVERSE_KINDS['spouse-of']).toBe('spouse-of');
    expect(isSymmetric('parent-of')).toBe(false);
  });
});

describe('duplicate detection understands direction', () => {
  it('treats a symmetric link recorded either way as the same link', () => {
    const marriage = link('rel-1', ANA, BEN, 'spouse-of');
    expect(
      isSameLink(marriage, { fromResidentId: BEN, toResidentId: ANA, kind: 'spouse-of' }),
    ).toBe(true);
  });

  it('does not treat a reversed asymmetric link as the same', () => {
    // "Ana is the parent of Ben" and "Ben is the parent of Ana" are different
    // claims, and one of them is wrong.
    const parenthood = link('rel-1', ANA, BEN, 'parent-of');
    expect(
      isSameLink(parenthood, { fromResidentId: BEN, toResidentId: ANA, kind: 'parent-of' }),
    ).toBe(false);
  });
});

describe('validation refuses only what is certainly wrong', () => {
  it('refuses a relationship from a person to themselves', () => {
    expect(
      validateRelationship({ fromResidentId: ANA, toResidentId: ANA, kind: 'sibling-of' }, []),
    ).toContainEqual({ code: 'same-person', residentId: ANA });
  });

  it('refuses an exact duplicate of a current relationship', () => {
    const existing = [link('rel-1', ANA, BEN, 'parent-of')];
    expect(
      validateRelationship({ fromResidentId: ANA, toResidentId: BEN, kind: 'parent-of' }, existing),
    ).toContainEqual({ code: 'already-recorded', residentId: BEN });
  });

  it('allows re-recording a relationship that has ended', () => {
    // People reconcile. A guardianship can resume. An ended record does not
    // block the truth from being recorded again.
    const existing = [link('rel-1', ANA, BEN, 'guardian-of', '2025-02-23')];
    expect(
      validateRelationship(
        { fromResidentId: ANA, toResidentId: BEN, kind: 'guardian-of' },
        existing,
      ),
    ).toHaveLength(0);
  });

  it('refuses a parent link that reverses one already on file', () => {
    const existing = [link('rel-1', ANA, BEN, 'parent-of')];
    expect(
      validateRelationship({ fromResidentId: BEN, toResidentId: ANA, kind: 'parent-of' }, existing),
    ).toContainEqual({ code: 'contradicts-existing', residentId: ANA });
  });

  it('allows arrangements a stricter validator would reject', () => {
    // Two guardians, a step-parent alongside a parent, a grandparent raising a
    // child. A registry that refuses these teaches staff to record something
    // false instead (`DL-49`).
    const existing = [
      link('rel-1', ANA, CARLA, 'parent-of'),
      link('rel-2', LOLA, CARLA, 'guardian-of'),
    ];
    expect(
      validateRelationship(
        { fromResidentId: BEN, toResidentId: CARLA, kind: 'step-parent-of' },
        existing,
      ),
    ).toHaveLength(0);
    expect(
      validateRelationship(
        { fromResidentId: ANA, toResidentId: CARLA, kind: 'guardian-of' },
        existing,
      ),
    ).toHaveLength(0);
  });
});

describe('generations arrange the list without carrying meaning', () => {
  it('puts a child one row below their parent', () => {
    const generations = assignGenerations([ANA, BEN], ANA, [link('rel-1', ANA, BEN, 'parent-of')]);
    expect(generations.get(ANA)).toBe(0);
    expect(generations.get(BEN)).toBe(1);
  });

  it('puts a spouse alongside', () => {
    const generations = assignGenerations([ANA, BEN], ANA, [link('rel-1', ANA, BEN, 'spouse-of')]);
    expect(generations.get(BEN)).toBe(0);
  });

  it('puts a grandparent two rows above', () => {
    const generations = assignGenerations([ANA, LOLA], ANA, [
      link('rel-1', LOLA, ANA, 'grandparent-of'),
    ]);
    expect(generations.get(LOLA)).toBe(-2);
  });

  it('keeps somebody with no recorded relationship rather than dropping them', () => {
    // A family often records who is in it before recording how they are
    // related. Losing that person off the screen would be the worst outcome.
    const generations = assignGenerations([ANA, CARLA], ANA, []);
    expect(generations.get(CARLA)).toBe(0);
    expect(generations.size).toBe(2);
  });

  it('does not walk through a relationship of unknown distance', () => {
    const generations = assignGenerations([ANA, BEN], ANA, [
      link('rel-1', ANA, BEN, 'other-relative-of'),
    ]);
    expect(generations.get(BEN)).toBe(0);
  });

  it('terminates on a cycle rather than looping forever', () => {
    const generations = assignGenerations([ANA, BEN, CARLA], ANA, [
      link('rel-1', ANA, BEN, 'spouse-of'),
      link('rel-2', BEN, CARLA, 'sibling-of'),
      link('rel-3', CARLA, ANA, 'sibling-of'),
    ]);
    expect(generations.size).toBe(3);
  });
});
