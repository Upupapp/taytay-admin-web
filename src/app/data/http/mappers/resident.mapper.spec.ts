import { toResident } from './resident.mapper';
import RECORDED_LIST from '../recorded/residents-list.json';
import RECORDED_DETAIL from '../recorded/resident-detail.json';

/**
 * Fixtures are the **published** payload for `admin/residents`, field for
 * field — `openapi.json` describes both shapes since TAB 05, read out of the
 * projection methods that build them.
 *
 * The `RECORDED_*` imports are **captured from the API actually running** — that
 * is what TAB 05 step 10 asks for, and it immediately earned its keep: see
 * `barangay_id` below. The inline `DETAIL`/`LIST_ROW` objects remain as the
 * hand-written contrast, because the difference between the two is the finding.
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

describe('against responses recorded from the running API', () => {
  it('maps a real list row', () => {
    const resident = toResident(RECORDED_LIST.data[0]);

    expect(resident).not.toBeNull();
    expect(resident?.name.last).toBe('Bautista');
    expect(resident?.birthDate).toBe('1982-06-17');
  });

  it('maps a real detail payload', () => {
    const resident = toResident(RECORDED_DETAIL.data);

    expect(resident?.name).toEqual({ first: 'Aurelia', middle: null, last: 'Bautista', suffix: null });
    expect(resident?.contact.email).toBe('aurelia.bautista@example.test');
    expect(resident?.address.streetAddress).toBe('7 Ilang-Ilang Street');
  });

  it('survives barangay_id arriving as a number — the finding a fixture could not catch', () => {
    /*
     * L-15. The API sends `"barangay_id": 2` — the raw auto-increment key —
     * where `conventions.md` §6 says identifiers exposed to clients are UUID
     * strings and auto-increment keys must never appear in a payload.
     *
     * The hand-written fixture above used a string, because that is what the
     * console's own mock used. Against the real payload the mapper required a
     * string, found a number, and returned null — which would have dropped
     * EVERY resident, silently, on the busiest screen in the console.
     *
     * The published schema could not have caught it either: it declares payload
     * properties untyped, so there was nothing to disagree with.
     */
    expect(typeof RECORDED_LIST.data[0]?.barangay_id).toBe('number');
    expect(toResident(RECORDED_LIST.data[0])).not.toBeNull();
    expect(toResident(RECORDED_LIST.data[0])?.address.barangayId).toBe('2');
  });

  it('still maps a UUID barangay when the backend fixes it', () => {
    // The tolerance is one-way: a proper UUID string passes through unchanged,
    // so the console needs no further change when TAB 07 closes L-15.
    const fixed = { ...RECORDED_DETAIL.data, barangay_id: 'brgy-dolores' };

    expect(toResident(fixed)?.address.barangayId).toBe('brgy-dolores');
  });
});
