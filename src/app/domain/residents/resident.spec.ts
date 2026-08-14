import {
  asId,
  asIsoDate,
  asIsoDateTime,
  discloseResident,
  formatProtectedName,
  isInAgeGroup,
  isWithheld,
  isValidSavedViewName,
  pesos,
  sameViewParams,
  toResidentDraft,
  validateResidentDraft,
  type BarangayId,
  type HouseholdId,
  type Permission,
  type Resident,
  type ResidentDraft,
  type ResidentId,
  type StaffUserId,
} from '@domain/index';

const ACTOR = asId<StaffUserId>('staff-test');

function resident(overrides: Partial<Resident> = {}): Resident {
  return {
    id: asId<ResidentId>('res-test'),
    householdId: asId<HouseholdId>('hh-test'),
    name: { first: 'Aurora', middle: 'Delos Santos', last: 'Mercado', suffix: null },
    sex: 'female',
    birthDate: asIsoDate('1990-05-05'),
    civilStatus: 'single',
    address: {
      barangayId: asId<BarangayId>('brgy-san-juan'),
      purokOrSitio: 'Purok 3',
      streetAddress: '18 Rizal Street',
    },
    contact: { mobile: '0917-555-0101', email: 'a@example.com' },
    sectors: ['senior-citizen'],
    philsysLastFour: '4471',
    monthlyIncome: pesos(4000),
    isActive: true,
    audit: {
      createdAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
      createdBy: ACTOR,
      updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
      updatedBy: ACTOR,
    },
    ...overrides,
  };
}

const holding = (...permissions: readonly Permission[]) => {
  const held = new Set<Permission>(permissions);
  return (permission: Permission) => held.has(permission);
};

/* ── Disclosure ───────────────────────────────────────────────────────────── */

describe('discloseResident withholds by default', () => {
  it('removes the identity tier from a viewer who only holds resident.view', () => {
    const view = discloseResident(resident(), holding('resident.view'));
    expect(view.resident.philsysLastFour).toBeNull();
    expect(view.resident.monthlyIncome).toBeNull();
    expect(isWithheld(view, 'philsysLastFour')).toBe(true);
    expect(isWithheld(view, 'monthlyIncome')).toBe(true);
  });

  it('discloses the identity tier to a viewer who holds resident.view-sensitive', () => {
    const view = discloseResident(resident(), holding('resident.view-sensitive'));
    expect(view.resident.philsysLastFour).toBe('4471');
    expect(view.resident.monthlyIncome?.centavos).toBe(400_000);
    expect(view.withheld).toHaveLength(0);
  });

  it('does not report a field as withheld when the record never held one', () => {
    // Otherwise "hidden by your role" would be claimed over an empty field, and
    // the notice would stop meaning anything.
    const view = discloseResident(
      resident({ philsysLastFour: null, monthlyIncome: null }),
      holding('resident.view'),
    );
    expect(view.withheld).toHaveLength(0);
  });

  it('leaves an ordinary resident’s contact details alone', () => {
    // Intake has to be able to ring people back. Only a protected record loses
    // its contact details.
    const view = discloseResident(resident(), holding('resident.view'));
    expect(view.resident.contact.mobile).toBe('0917-555-0101');
    expect(view.resident.address.streetAddress).toBe('18 Rizal Street');
  });
});

describe('discloseResident and the protected tier', () => {
  const protectedRecord = resident({ sectors: ['vawc-survivor', 'solo-parent'] });

  it('strips the sensitive sector, the address and the contact details', () => {
    const view = discloseResident(protectedRecord, holding('resident.view'));
    expect(view.resident.sectors).toEqual(['solo-parent']);
    expect(view.resident.contact).toEqual({ mobile: null, email: null });
    expect(view.resident.address.streetAddress).toBeNull();
    expect(view.resident.address.purokOrSitio).toBeNull();
    // The barangay stays: scope and listing depend on it, and it is not the
    // detail that puts a survivor at risk.
    expect(view.resident.address.barangayId).toBe('brgy-san-juan');
  });

  it('still says the record is protected, so it is handled carefully', () => {
    const view = discloseResident(protectedRecord, holding('resident.view'));
    expect(view.isProtected).toBe(true);
    expect(isWithheld(view, 'protectedSectors')).toBe(true);
  });

  it('masks the name to a surname and an initial', () => {
    const view = discloseResident(protectedRecord, holding('resident.view'));
    expect(view.listedName).toBe('Mercado, A.');
    expect(view.listedName).not.toContain('Aurora');
    expect(view.fullName).toBe(formatProtectedName(protectedRecord.name));
  });

  it('discloses everything to a viewer holding request.view-sensitive', () => {
    const view = discloseResident(
      protectedRecord,
      holding('resident.view', 'resident.view-sensitive', 'request.view-sensitive'),
    );
    expect(view.resident.sectors).toContain('vawc-survivor');
    expect(view.resident.contact.mobile).toBe('0917-555-0101');
    expect(view.listedName).toBe('Mercado, Aurora Delos Santos');
    expect(view.withheld).toHaveLength(0);
  });

  it('withholds nothing extra from an unflagged record', () => {
    const view = discloseResident(resident(), holding('resident.view', 'resident.view-sensitive'));
    expect(view.isProtected).toBe(false);
    expect(view.withheld).toHaveLength(0);
  });

  it('does not mutate the record it was given', () => {
    const original = protectedRecord;
    discloseResident(original, holding('resident.view'));
    expect(original.contact.mobile).toBe('0917-555-0101');
    expect(original.sectors).toContain('vawc-survivor');
  });
});

/* ── Age bands ────────────────────────────────────────────────────────────── */

describe('age groups follow statute, not round numbers', () => {
  const on = new Date('2026-08-14T00:00:00.000Z');

  it('treats 60 and over as senior (RA 9994)', () => {
    expect(isInAgeGroup(asIsoDate('1966-01-01'), 'senior', on)).toBe(true);
    expect(isInAgeGroup(asIsoDate('1967-01-01'), 'senior', on)).toBe(false);
  });

  it('treats under 18 as a child', () => {
    expect(isInAgeGroup(asIsoDate('2010-01-01'), 'child', on)).toBe(true);
    expect(isInAgeGroup(asIsoDate('2008-01-01'), 'child', on)).toBe(false);
  });

  it('puts every band end to end, so nobody falls between two of them', () => {
    const born = asIsoDate('2000-06-01');
    const bands = (['child', 'youth', 'adult', 'senior'] as const).filter((band) =>
      isInAgeGroup(born, band, on),
    );
    expect(bands).toHaveLength(1);
  });
});

/* ── Draft validation ─────────────────────────────────────────────────────── */

function draft(overrides: Partial<ResidentDraft> = {}): ResidentDraft {
  return { ...toResidentDraft(resident()), ...overrides };
}

describe('validateResidentDraft', () => {
  const on = new Date('2026-08-14T00:00:00.000Z');

  it('accepts a complete record', () => {
    expect(validateResidentDraft(draft(), on)).toHaveLength(0);
  });

  it('requires a name, a birth date and a street address', () => {
    const problems = validateResidentDraft(
      draft({
        name: { first: '  ', middle: null, last: '', suffix: null },
        birthDate: asIsoDate(''),
        address: {
          barangayId: asId<BarangayId>('brgy-san-juan'),
          purokOrSitio: null,
          streetAddress: null,
        },
      }),
      on,
    );
    expect(problems.map((problem) => problem.field)).toEqual([
      'first',
      'last',
      'birthDate',
      'streetAddress',
    ]);
  });

  it('rejects a birth date in the future', () => {
    const problems = validateResidentDraft(draft({ birthDate: asIsoDate('2030-01-01') }), on);
    expect(problems).toContainEqual({ field: 'birthDate', rule: 'in-the-future' });
  });

  it('rejects an age nobody has reached', () => {
    const problems = validateResidentDraft(draft({ birthDate: asIsoDate('1850-01-01') }), on);
    expect(problems).toContainEqual({ field: 'birthDate', rule: 'implausibly-old' });
  });

  it('accepts an absent PhilSys reference but not a partial one', () => {
    expect(validateResidentDraft(draft({ philsysLastFour: null }), on)).toHaveLength(0);
    expect(validateResidentDraft(draft({ philsysLastFour: '12' }), on)).toContainEqual({
      field: 'philsysLastFour',
      rule: 'must-be-four-digits',
    });
  });

  it('accepts the mobile formats the office actually types', () => {
    for (const mobile of ['09175550101', '0917-555-0101', '+639175550101', '0917 555 0101']) {
      expect(validateResidentDraft(draft({ contact: { mobile, email: null } }), on)).toHaveLength(
        0,
      );
    }
  });

  it('rejects a landline typed into the mobile field', () => {
    const problems = validateResidentDraft(
      draft({ contact: { mobile: '02-8888-8888', email: null } }),
      on,
    );
    expect(problems).toContainEqual({ field: 'mobile', rule: 'not-a-mobile-number' });
  });
});

/* ── Saved views ──────────────────────────────────────────────────────────── */

describe('saved view helpers', () => {
  it('matches params regardless of key order', () => {
    expect(sameViewParams({ a: '1', b: '2' }, { b: '2', a: '1' })).toBe(true);
  });

  it('does not match a subset', () => {
    expect(sameViewParams({ a: '1' }, { a: '1', b: '2' })).toBe(false);
  });

  it('rejects a blank or overlong name', () => {
    expect(isValidSavedViewName('   ')).toBe(false);
    expect(isValidSavedViewName('x'.repeat(61))).toBe(false);
    expect(isValidSavedViewName('Seniors in San Juan')).toBe(true);
  });
});
