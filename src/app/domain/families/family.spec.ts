import {
  asId,
  asIsoDate,
  asIsoDateTime,
  FAMILY_MEMBERS_MAX,
  headOfFamily,
  validateFamilyDraft,
  type Family,
  type FamilyDraft,
  type FamilyId,
  type ResidentId,
} from '@domain/index';

const A = asId<ResidentId>('res-a');
const B = asId<ResidentId>('res-b');
const C = asId<ResidentId>('res-c');

function draft(overrides: Partial<FamilyDraft> = {}): FamilyDraft {
  return {
    name: 'Bautista family',
    householdId: null,
    formedOn: null,
    members: [
      { residentId: A, role: 'head' },
      { residentId: B, role: 'child' },
    ],
    ...overrides,
  };
}

const codes = (value: FamilyDraft, reason = 'Intake interview.') =>
  validateFamilyDraft(value, reason).map((problem) => problem.code);

describe('validateFamilyDraft', () => {
  it('accepts a family between addresses: no household is an answer (DL-47)', () => {
    expect(codes(draft())).toEqual([]);
  });

  it('accepts two heads, or none recorded yet — arrangements the office meets (DL-49)', () => {
    expect(
      codes(draft({ members: [{ residentId: A, role: 'head' }, { residentId: B, role: 'head' }] })),
    ).toEqual([]);
    expect(codes(draft({ members: [{ residentId: A, role: 'child' }] }))).toEqual([]);
  });

  it('needs a name, a member and a reason', () => {
    expect(codes(draft({ name: '   ', members: [] }), '  ')).toEqual([
      'no-name',
      'no-members',
      'no-reason',
    ]);
    expect(codes(draft({ name: 'x'.repeat(121) }))).toEqual(['no-name']);
  });

  it('names the person listed twice, and refuses more members than the API keeps', () => {
    expect(
      validateFamilyDraft(
        draft({
          members: [
            { residentId: A, role: 'head' },
            { residentId: A, role: 'child' },
          ],
        }),
        'Intake interview.',
      ),
    ).toEqual([{ code: 'duplicate-member', residentId: A }]);

    const crowd = Array.from({ length: FAMILY_MEMBERS_MAX + 1 }, (_, index) => ({
      residentId: asId<ResidentId>(`res-${index}`),
      role: 'other-member' as const,
    }));
    expect(codes(draft({ members: crowd }))).toEqual(['too-many-members']);
  });
});

describe('headOfFamily', () => {
  const STAMP = {
    createdAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
    createdBy: null,
    updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
    updatedBy: null,
  };

  function family(members: Family['members']): Family {
    return {
      id: asId<FamilyId>('fam-test'),
      referenceNumber: 'FAM-2026-000001',
      name: 'Test family',
      householdId: null,
      members,
      formedOn: null,
      dissolvedOn: null,
      audit: STAMP,
    };
  }

  const joined = asIsoDate('2026-01-01');

  it('is the current member recorded as head, wherever they are listed — the API’s rule', () => {
    expect(
      headOfFamily(
        family([
          { residentId: A, role: 'partner', joinedOn: joined, leftOn: null },
          { residentId: B, role: 'head', joinedOn: joined, leftOn: null },
        ]),
      ),
    ).toBe(B);
  });

  it('falls back to the first current member, and never to somebody who left', () => {
    expect(
      headOfFamily(
        family([
          { residentId: A, role: 'head', joinedOn: joined, leftOn: asIsoDate('2026-02-01') },
          { residentId: C, role: 'child', joinedOn: joined, leftOn: null },
        ]),
      ),
    ).toBe(C);
    expect(headOfFamily(family([]))).toBeNull();
  });
});
