import { toHousehold } from './household.mapper';

/** The published `admin/households/{household}` payload, field for field. */
const DETAIL = {
  id: 'hh-0001',
  code: 'TR-HH-0001',
  barangay_id: 'brgy-dolores',
  street_address: '12 Rizal Street',
  purok_or_sitio: 'Purok 3',
  member_count: 5,
  verification_status: 'verified',
  status: 'active',
  head: { id: 'res-0001', name: 'Reyes, A.' },
  dwelling_type: 'concrete',
  tenure_status: 'owned',
};

describe('toHousehold', () => {
  it('maps the published payload', () => {
    const household = toHousehold(DETAIL);

    expect(household?.id).toBe('hh-0001');
    expect(household?.referenceNumber).toBe('TR-HH-0001');
    expect(household?.headResidentId).toBe('res-0001');
    expect(household?.address.barangayId).toBe('brgy-dolores');
    expect(household?.address.purokOrSitio).toBe('Purok 3');
  });

  it('stays readable when the head is not disclosed to this caller', () => {
    // Masking the head must not make the record unreadable: a protection case's
    // household is still a household, and the list still has to show it.
    const household = toHousehold({ ...DETAIL, head: null });

    expect(household).not.toBeNull();
    expect(household?.id).toBe('hh-0001');
  });

  it('never derives isIndigent from anything', () => {
    // `DL-42`: a recorded classification made by a person, never computed from
    // the vulnerability factors. The temptation when the field is missing is to
    // infer it, and that would be an automated eligibility decision by another
    // name.
    expect(toHousehold(DETAIL)?.isIndigent).toBe(false);
    expect(toHousehold({ ...DETAIL, verification_status: 'verified' })?.isIndigent).toBe(false);
  });

  it('does not invent means data the endpoint withholds', () => {
    expect(toHousehold(DETAIL)?.monthlyIncome).toBeNull();
  });

  it('drops a record it cannot key on, and survives a non-object', () => {
    expect(toHousehold({ ...DETAIL, barangay_id: null })).toBeNull();
    expect(toHousehold(null)).toBeNull();
    expect(toHousehold('<html>502</html>')).toBeNull();
  });
});
