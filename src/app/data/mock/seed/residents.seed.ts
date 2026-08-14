import {
  asId,
  asIsoDate,
  pesos,
  type BarangayId,
  type CivilStatus,
  type Household,
  type HouseholdId,
  type Resident,
  type ResidentId,
  type VulnerabilitySector,
} from '@domain/index';

import { stamp } from './seed-utils';

const brgy = (slug: string): BarangayId => asId<BarangayId>(`brgy-${slug}`);

/**
 * The hand-written records. Each one exists to exercise a specific path — a
 * senior, a PWD, a solo parent, a protected record, a minor in a known
 * household, a deactivated account — and every other seed file references them
 * by id, so their contents must stay stable.
 */
const NAMED_RESIDENTS: readonly Resident[] = [
  {
    id: asId<ResidentId>('res-0001'),
    householdId: asId<HouseholdId>('hh-0001'),
    name: { first: 'Aurora', middle: 'Delos Santos', last: 'Mercado', suffix: null },
    sex: 'female',
    birthDate: asIsoDate('1956-03-14'),
    civilStatus: 'widowed',
    address: {
      barangayId: brgy('san-juan'),
      purokOrSitio: 'Purok 3',
      streetAddress: '18 Rizal Street',
    },
    contact: { mobile: '0917-555-0101', email: null },
    sectors: ['senior-citizen'],
    philsysLastFour: '4471',
    monthlyIncome: pesos(4000),
    isActive: true,
    audit: stamp(400, 12),
  },
  {
    id: asId<ResidentId>('res-0002'),
    householdId: asId<HouseholdId>('hh-0002'),
    name: { first: 'Reynaldo', middle: 'Aguilar', last: 'Bautista', suffix: 'Jr.' },
    sex: 'male',
    birthDate: asIsoDate('1981-11-02'),
    civilStatus: 'married',
    address: {
      purokOrSitio: null,
      barangayId: brgy('dolores'),
      streetAddress: '7 Mabini Extension',
    },
    contact: { mobile: '0918-555-0102', email: 'rey.bautista@example.com' },
    sectors: ['pwd', 'unemployed'],
    philsysLastFour: '9032',
    monthlyIncome: pesos(0),
    isActive: true,
    audit: stamp(310, 5),
  },
  {
    id: asId<ResidentId>('res-0003'),
    householdId: asId<HouseholdId>('hh-0003'),
    name: { first: 'Michelle', middle: 'Ramos', last: 'Cordero', suffix: null },
    sex: 'female',
    birthDate: asIsoDate('1993-06-27'),
    civilStatus: 'single',
    address: {
      barangayId: brgy('santa-ana'),
      purokOrSitio: 'Sitio Ilaya',
      streetAddress: '221 Bonifacio Road',
    },
    contact: { mobile: '0919-555-0103', email: null },
    sectors: ['solo-parent', 'four-ps'],
    philsysLastFour: '1188',
    monthlyIncome: pesos(9500),
    isActive: true,
    audit: stamp(240, 3),
  },
  {
    id: asId<ResidentId>('res-0004'),
    householdId: asId<HouseholdId>('hh-0004'),
    name: { first: 'Danilo', middle: null, last: 'Estrella', suffix: null },
    sex: 'male',
    birthDate: asIsoDate('1974-01-19'),
    civilStatus: 'married',
    address: {
      barangayId: brgy('muzon'),
      purokOrSitio: null,
      streetAddress: '95 Cabrera Compound',
    },
    contact: { mobile: '0920-555-0104', email: null },
    sectors: ['displaced-worker'],
    philsysLastFour: null,
    monthlyIncome: pesos(6200),
    isActive: true,
    audit: stamp(190, 8),
  },
  {
    id: asId<ResidentId>('res-0005'),
    householdId: asId<HouseholdId>('hh-0005'),
    name: { first: 'Cristina', middle: 'Yap', last: 'Manalo', suffix: null },
    sex: 'female',
    birthDate: asIsoDate('1988-09-05'),
    civilStatus: 'separated',
    address: {
      barangayId: brgy('san-isidro'),
      purokOrSitio: 'Purok 1',
      streetAddress: '12 Sampaguita Street',
    },
    contact: { mobile: '0921-555-0105', email: null },
    // Sensitive: this record is masked in lists and requires request.view-sensitive.
    sectors: ['vawc-survivor', 'solo-parent'],
    philsysLastFour: '7745',
    monthlyIncome: pesos(11000),
    isActive: true,
    audit: stamp(120, 1),
  },
  {
    id: asId<ResidentId>('res-0006'),
    householdId: asId<HouseholdId>('hh-0001'),
    name: { first: 'Joselito', middle: 'Mercado', last: 'Mercado', suffix: null },
    sex: 'male',
    birthDate: asIsoDate('2007-02-23'),
    civilStatus: 'single',
    address: {
      barangayId: brgy('san-juan'),
      purokOrSitio: 'Purok 3',
      streetAddress: '18 Rizal Street',
    },
    contact: { mobile: null, email: null },
    sectors: ['out-of-school-youth'],
    philsysLastFour: null,
    monthlyIncome: null,
    isActive: true,
    audit: stamp(400, 30),
  },
  {
    id: asId<ResidentId>('res-0007'),
    householdId: asId<HouseholdId>('hh-0006'),
    name: { first: 'Elena', middle: 'Torres', last: 'Sarmiento', suffix: null },
    sex: 'female',
    birthDate: asIsoDate('1949-12-11'),
    civilStatus: 'widowed',
    address: {
      barangayId: brgy('dolores'),
      purokOrSitio: 'Purok 5',
      streetAddress: '3 Kalayaan Lane',
    },
    contact: { mobile: '0922-555-0107', email: null },
    sectors: ['senior-citizen', 'pwd'],
    philsysLastFour: '5520',
    monthlyIncome: pesos(3000),
    isActive: true,
    audit: stamp(500, 20),
  },
  {
    id: asId<ResidentId>('res-0008'),
    householdId: null,
    name: { first: 'Fernando', middle: 'Uy', last: 'Gonzales', suffix: 'III' },
    sex: 'male',
    birthDate: asIsoDate('1999-04-30'),
    civilStatus: 'single',
    address: {
      barangayId: brgy('santa-ana'),
      purokOrSitio: null,
      streetAddress: '44 Del Pilar Street',
    },
    contact: { mobile: '0923-555-0108', email: 'fgonzales@example.com' },
    sectors: ['unemployed'],
    philsysLastFour: '2264',
    monthlyIncome: pesos(0),
    isActive: false,
    audit: stamp(160, 60),
  },
  // res-0009 and res-0010 exist so one household has a head, a spouse and a
  // child. Without them the family panel has nothing but the subject to show,
  // and the traceability guarantee would be untested against a real shape.
  {
    id: asId<ResidentId>('res-0009'),
    householdId: asId<HouseholdId>('hh-0002'),
    name: { first: 'Marilou', middle: 'Sison', last: 'Bautista', suffix: null },
    sex: 'female',
    birthDate: asIsoDate('1984-07-16'),
    civilStatus: 'married',
    address: {
      barangayId: brgy('dolores'),
      purokOrSitio: null,
      streetAddress: '7 Mabini Extension',
    },
    contact: { mobile: '0918-555-0109', email: null },
    sectors: ['four-ps'],
    philsysLastFour: '6613',
    monthlyIncome: pesos(7800),
    isActive: true,
    audit: stamp(310, 5),
  },
  {
    id: asId<ResidentId>('res-0010'),
    householdId: asId<HouseholdId>('hh-0002'),
    name: { first: 'Aldrin', middle: 'Sison', last: 'Bautista', suffix: null },
    sex: 'male',
    birthDate: asIsoDate('2012-10-08'),
    civilStatus: 'single',
    address: {
      barangayId: brgy('dolores'),
      purokOrSitio: null,
      streetAddress: '7 Mabini Extension',
    },
    contact: { mobile: null, email: null },
    sectors: ['four-ps'],
    philsysLastFour: null,
    monthlyIncome: null,
    isActive: true,
    audit: stamp(310, 40),
  },
];

/* ── Bulk registry ────────────────────────────────────────────────────────── */

/**
 * Fictional filler so the registry behaves like a registry.
 *
 * A list screen that only ever sees eight rows proves nothing: paging, sorting
 * stability, filter combinations and the cost of the disclosure policy all only
 * show up at volume. These are generated by modular arithmetic rather than a
 * random seed so the same run produces the same registry every time — a flaky
 * fixture is worse than a small one.
 *
 * Every name is drawn from common Philippine surnames and given names combined
 * mechanically. No real person is described, and no field carries real PII.
 */
const GIVEN_NAMES: readonly string[] = [
  'Andres',
  'Bianca',
  'Carlos',
  'Divina',
  'Emilio',
  'Fely',
  'Gregorio',
  'Herminia',
  'Ignacio',
  'Josefa',
  'Kristine',
  'Lorenzo',
  'Marisol',
  'Nestor',
  'Ofelia',
  'Prospero',
  'Querubin',
  'Rosalinda',
  'Salvador',
  'Teresita',
  'Ulysses',
  'Violeta',
  'Wilfredo',
  'Yolanda',
];

const SURNAMES: readonly string[] = [
  'Abad',
  'Bacani',
  'Castillo',
  'Dimalanta',
  'Enriquez',
  'Fajardo',
  'Galvez',
  'Hizon',
  'Ilagan',
  'Javier',
  'Lagman',
  'Marquez',
  'Nuqui',
  'Ocampo',
  'Panganiban',
  'Quinto',
  'Rivera',
  'Salazar',
  'Tolentino',
  'Umali',
  'Velasco',
  'Yabut',
  'Zamora',
  'Alonzo',
];

const MIDDLE_NAMES: readonly string[] = ['Cruz', 'Reyes', 'Santos', 'Garcia', 'Flores'];

const BARANGAY_SLUGS: readonly string[] = [
  'dolores',
  'muzon',
  'san-isidro',
  'san-juan',
  'santa-ana',
];

const STREETS: readonly string[] = [
  'Aguinaldo Street',
  'Bayanihan Road',
  'Camia Street',
  'Dalisay Lane',
  'Evangelista Street',
  'Fortuna Avenue',
  'Gumamela Street',
  'Hilaga Road',
];

const CIVIL_STATUS_CYCLE: readonly CivilStatus[] = [
  'single',
  'married',
  'married',
  'widowed',
  'separated',
  'single',
  'cohabiting',
];

/**
 * Sector assignment is deterministic and thin on purpose: most residents belong
 * to no sector, which is the realistic shape and keeps sector filters meaningful.
 * Two protected records are included so masking is exercised inside a paged
 * result, not only on the one hand-written case.
 */
function sectorsFor(index: number, age: number): readonly VulnerabilitySector[] {
  const sectors: VulnerabilitySector[] = [];
  if (age >= 60) {
    sectors.push('senior-citizen');
  }
  if (index % 11 === 0) {
    sectors.push('pwd');
  }
  if (index % 13 === 0) {
    sectors.push('solo-parent');
  }
  if (index % 7 === 0) {
    sectors.push('four-ps');
  }
  if (index % 17 === 0) {
    sectors.push('unemployed');
  }
  if (age < 18 && index % 19 === 0) {
    sectors.push('out-of-school-youth');
  }
  if (index === 37) {
    sectors.push('vawc-survivor');
  }
  if (index === 88) {
    sectors.push('cicl');
  }
  return sectors;
}

/** `noUncheckedIndexedAccess` is on, so the fallback is stated rather than asserted. */
function pick(items: readonly string[], index: number): string {
  return items[index % items.length] ?? '';
}

function generatedResidents(count: number): readonly Resident[] {
  const residents: Resident[] = [];

  for (let index = 0; index < count; index += 1) {
    const serial = index + 100;
    // Ages spread from 4 to 87 without clustering on a single decade.
    const age = 4 + ((index * 7) % 84);
    const birthYear = 2026 - age;
    const birthMonth = ((index * 5) % 12) + 1;
    const birthDay = ((index * 11) % 27) + 1;
    const sectors = sectorsFor(index, age);
    const hasMobile = index % 5 !== 0;

    residents.push({
      id: asId<ResidentId>(`res-${String(serial).padStart(4, '0')}`),
      householdId: null,
      name: {
        first: pick(GIVEN_NAMES, index),
        middle: index % 3 === 0 ? pick(MIDDLE_NAMES, index) : null,
        last: pick(SURNAMES, index * 5 + 1),
        suffix: null,
      },
      sex: index % 2 === 0 ? 'female' : 'male',
      birthDate: asIsoDate(
        `${birthYear}-${String(birthMonth).padStart(2, '0')}-${String(birthDay).padStart(2, '0')}`,
      ),
      civilStatus:
        age < 18 ? 'single' : (CIVIL_STATUS_CYCLE[index % CIVIL_STATUS_CYCLE.length] ?? 'single'),
      address: {
        barangayId: brgy(pick(BARANGAY_SLUGS, index)),
        purokOrSitio: index % 4 === 0 ? `Purok ${(index % 6) + 1}` : null,
        streetAddress: `${(index % 250) + 1} ${pick(STREETS, index * 3)}`,
      },
      contact: {
        mobile: hasMobile ? `09${String(170000000 + index * 7919).slice(0, 9)}` : null,
        email: null,
      },
      sectors,
      philsysLastFour: index % 3 === 0 ? String(1000 + ((index * 37) % 9000)) : null,
      monthlyIncome: age >= 18 ? pesos(((index * 137) % 26) * 500) : null,
      isActive: index % 29 !== 0,
      audit: stamp(30 + ((index * 3) % 500), 1 + ((index * 13) % 120)),
    });
  }

  return residents;
}

export const MOCK_RESIDENTS: readonly Resident[] = [...NAMED_RESIDENTS, ...generatedResidents(240)];

export const MOCK_HOUSEHOLDS: readonly Household[] = [
  {
    id: asId<HouseholdId>('hh-0001'),
    referenceNumber: 'HH-SJ-2024-0011',
    headResidentId: asId<ResidentId>('res-0001'),
    address: {
      barangayId: brgy('san-juan'),
      purokOrSitio: 'Purok 3',
      streetAddress: '18 Rizal Street',
    },
    members: [
      { residentId: asId<ResidentId>('res-0001'), role: 'head' },
      { residentId: asId<ResidentId>('res-0006'), role: 'child' },
    ],
    monthlyIncome: pesos(4000),
    isIndigent: true,
    audit: stamp(400, 12),
  },
  {
    id: asId<HouseholdId>('hh-0003'),
    referenceNumber: 'HH-SA-2024-0207',
    headResidentId: asId<ResidentId>('res-0003'),
    address: {
      barangayId: brgy('santa-ana'),
      purokOrSitio: 'Sitio Ilaya',
      streetAddress: '221 Bonifacio Road',
    },
    members: [{ residentId: asId<ResidentId>('res-0003'), role: 'head' }],
    monthlyIncome: pesos(9500),
    isIndigent: true,
    audit: stamp(240, 3),
  },
  {
    id: asId<HouseholdId>('hh-0002'),
    referenceNumber: 'HH-DL-2024-0088',
    headResidentId: asId<ResidentId>('res-0002'),
    address: {
      barangayId: brgy('dolores'),
      purokOrSitio: null,
      streetAddress: '7 Mabini Extension',
    },
    members: [
      { residentId: asId<ResidentId>('res-0002'), role: 'head' },
      { residentId: asId<ResidentId>('res-0009'), role: 'spouse' },
      { residentId: asId<ResidentId>('res-0010'), role: 'child' },
    ],
    monthlyIncome: pesos(7800),
    isIndigent: true,
    audit: stamp(310, 5),
  },
  {
    id: asId<HouseholdId>('hh-0004'),
    referenceNumber: 'HH-MZ-2024-0341',
    headResidentId: asId<ResidentId>('res-0004'),
    address: {
      barangayId: brgy('muzon'),
      purokOrSitio: null,
      streetAddress: '95 Cabrera Compound',
    },
    members: [{ residentId: asId<ResidentId>('res-0004'), role: 'head' }],
    monthlyIncome: pesos(6200),
    isIndigent: false,
    audit: stamp(190, 8),
  },
  {
    id: asId<HouseholdId>('hh-0005'),
    referenceNumber: 'HH-SI-2025-0012',
    headResidentId: asId<ResidentId>('res-0005'),
    address: {
      barangayId: brgy('san-isidro'),
      purokOrSitio: 'Purok 1',
      streetAddress: '12 Sampaguita Street',
    },
    members: [{ residentId: asId<ResidentId>('res-0005'), role: 'head' }],
    monthlyIncome: pesos(11000),
    isIndigent: false,
    audit: stamp(120, 1),
  },
  {
    id: asId<HouseholdId>('hh-0006'),
    referenceNumber: 'HH-DL-2023-0455',
    headResidentId: asId<ResidentId>('res-0007'),
    address: {
      barangayId: brgy('dolores'),
      purokOrSitio: 'Purok 5',
      streetAddress: '3 Kalayaan Lane',
    },
    members: [{ residentId: asId<ResidentId>('res-0007'), role: 'head' }],
    monthlyIncome: pesos(3000),
    isIndigent: true,
    audit: stamp(500, 20),
  },
];
