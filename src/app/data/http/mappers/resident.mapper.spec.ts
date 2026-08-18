import { toResident } from './resident.mapper';

/**
 * Fixtures are the **published** payload for `admin/residents`, field for
 * field — `openapi.json` describes both shapes since TAB 05, read out of the
 * projection methods that build them.
 *
 * They are not recorded from a running API, and that limit is real: TAB 05
 * step 10 asks for responses captured from staging *"not hand-written fixtures,
 * which drift toward what the author expected"*, and no staging API exists on
 * this machine. What these do prove is that the mapper agrees with the
 * published contract — which is a strictly weaker claim, and an honest one.
 */

const DETAIL = {
  id: '9b1f0000-0000-4000-8000-000000000001',
  name: 'Ana Maria Reyes',
  birth_date: '1984-03-11',
  barangay_id: 'brgy-dolores',
  verification_tier: 'verified',
  is_active: true,
  first_name: 'Ana',
  middle_name: 'Maria',
  last_name: 'Reyes',
  suffix: null,
  sex: 'female',
  civil_status: 'married',
  street_address: '12 Rizal Street',
  purok_or_sitio: 'Purok 3',
  mobile_number: '+639170000000',
  email: null,
  verified_at: '2026-02-01T00:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-02-01T00:00:00Z',
};

const LIST_ROW = {
  id: '9b1f0000-0000-4000-8000-000000000002',
  name: 'Jomar Villanueva',
  birth_date: '1990-07-02',
  barangay_id: 'brgy-san-juan',
  verification_tier: 'unverified',
  is_active: true,
};

describe('toResident', () => {
  it('maps the detail payload into the domain model', () => {
    const resident = toResident(DETAIL);

    expect(resident?.id).toBe(DETAIL.id);
    expect(resident?.name).toEqual({ first: 'Ana', middle: 'Maria', last: 'Reyes', suffix: null });
    expect(resident?.birthDate).toBe('1984-03-11');
    expect(resident?.address.barangayId).toBe('brgy-dolores');
    expect(resident?.address.streetAddress).toBe('12 Rizal Street');
    expect(resident?.contact.mobile).toBe('+639170000000');
    expect(resident?.contact.email).toBeNull();
    expect(resident?.isActive).toBe(true);
  });

  it('handles the list payload, which composes the name instead of splitting it', () => {
    // Both are real responses from the same resource. A mapper that understood
    // only the detail shape would work on one screen and render blanks in the
    // list.
    const resident = toResident(LIST_ROW);

    expect(resident?.name.first).toBe('Jomar');
    expect(resident?.name.last).toBe('Villanueva');
  });

  it('does not invent the fields this endpoint does not disclose', () => {
    /*
     * Household, sectors, PhilSys and income are all absent from the payload —
     * they sit behind a wider permission tier. Mapping them to plausible
     * defaults would be the console asserting something the server did not say.
     */
    const resident = toResident(DETAIL);

    expect(resident?.householdId).toBeNull();
    expect(resident?.sectors).toEqual([]);
    expect(resident?.philsysLastFour).toBeNull();
    expect(resident?.monthlyIncome).toBeNull();
  });

  it('drops a record it cannot key on rather than rendering blanks', () => {
    // Every screen keys on id, barangay and date of birth. A partial record
    // dropped here beats one that reaches a template and renders as gaps.
    expect(toResident({ ...DETAIL, id: undefined })).toBeNull();
    expect(toResident({ ...DETAIL, barangay_id: null })).toBeNull();
    expect(toResident({ ...DETAIL, birth_date: 'not-a-date' })).toBeNull();
  });

  it('survives a payload that is not an object at all', () => {
    // A parser that throws while mapping turns one unexpected response into a
    // blank screen.
    expect(toResident(null)).toBeNull();
    expect(toResident('<html>502 Bad Gateway</html>')).toBeNull();
    expect(toResident(undefined)).toBeNull();
  });

  it('rejects a birth date that is a timestamp, not a date', () => {
    // `YYYY-MM-DD` per conventions.md §6. A timestamp here would mean the
    // backend changed a field's type, and that must not pass silently.
    expect(toResident({ ...DETAIL, birth_date: '1984-03-11T00:00:00Z' })).toBeNull();
  });
});
