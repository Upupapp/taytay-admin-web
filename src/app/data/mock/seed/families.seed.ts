import {
  asId,
  asIsoDate,
  type Family,
  type FamilyId,
  type HouseholdId,
  type Relationship,
  type RelationshipId,
  type ResidentId,
} from '@domain/index';

import { stamp } from './seed-utils';

const family = (id: string): FamilyId => asId<FamilyId>(id);
const household = (id: string): HouseholdId => asId<HouseholdId>(id);
const person = (id: string): ResidentId => asId<ResidentId>(id);
const relationship = (id: string): RelationshipId => asId<RelationshipId>(id);

/**
 * Families, seeded to break the household-equals-family assumption on sight.
 *
 * Three arrangements are deliberately present, because a registry that only
 * ever shows the tidy case teaches staff that the tidy case is the rule:
 *
 *  - **hh-0001 holds two families.** Aurora Mercado (widowed, senior) heads one;
 *    her grandson Joselito is recorded as a family of his own because his own
 *    parent is not on file. Same roof, two units of care.
 *  - **fam-0004 has no household.** The Gonzales family is between addresses —
 *    a real and common situation, and `householdId: null` is the honest record
 *    of it rather than a missing value.
 *  - **fam-0005 is dissolved but retained.** It stopped being a unit when its
 *    members joined others; the record and its history stay (`DL-48`).
 */
export const MOCK_FAMILIES: readonly Family[] = [
  {
    id: family('fam-0001'),
    referenceNumber: 'FAM-SJ-2024-0011',
    name: 'Mercado family',
    householdId: household('hh-0001'),
    members: [
      {
        residentId: person('res-0001'),
        role: 'head',
        joinedOn: asIsoDate('2019-01-10'),
        leftOn: null,
      },
    ],
    formedOn: asIsoDate('2019-01-10'),
    dissolvedOn: null,
    audit: stamp(400, 12),
  },
  {
    // Same roof as fam-0001, different family. This is the record that makes
    // "one household, one family" visibly false on the first screen a user opens.
    id: family('fam-0002'),
    referenceNumber: 'FAM-SJ-2024-0012',
    name: 'Mercado (Joselito) family',
    householdId: household('hh-0001'),
    members: [
      {
        residentId: person('res-0006'),
        role: 'head',
        joinedOn: asIsoDate('2023-06-01'),
        leftOn: null,
      },
    ],
    formedOn: asIsoDate('2023-06-01'),
    dissolvedOn: null,
    audit: stamp(400, 30),
  },
  {
    id: family('fam-0003'),
    referenceNumber: 'FAM-DL-2024-0088',
    name: 'Bautista family',
    householdId: household('hh-0002'),
    members: [
      {
        residentId: person('res-0002'),
        role: 'head',
        joinedOn: asIsoDate('2015-02-14'),
        leftOn: null,
      },
      {
        residentId: person('res-0009'),
        role: 'partner',
        joinedOn: asIsoDate('2015-02-14'),
        leftOn: null,
      },
      {
        residentId: person('res-0010'),
        role: 'child',
        joinedOn: asIsoDate('2016-01-05'),
        leftOn: null,
      },
    ],
    formedOn: asIsoDate('2015-02-14'),
    dissolvedOn: null,
    audit: stamp(310, 5),
  },
  {
    // No household. Between addresses, not missing data.
    id: family('fam-0004'),
    referenceNumber: 'FAM-SA-2025-0140',
    name: 'Gonzales family',
    householdId: null,
    members: [
      {
        residentId: person('res-0008'),
        role: 'head',
        joinedOn: asIsoDate('2022-03-01'),
        leftOn: null,
      },
    ],
    formedOn: asIsoDate('2022-03-01'),
    dissolvedOn: null,
    audit: stamp(160, 60),
  },
  {
    // Dissolved, retained. Its members went elsewhere; the record still explains
    // where they came from.
    id: family('fam-0005'),
    referenceNumber: 'FAM-SI-2023-0004',
    name: 'Manalo family',
    householdId: household('hh-0005'),
    members: [
      {
        residentId: person('res-0005'),
        role: 'head',
        joinedOn: asIsoDate('2018-09-01'),
        leftOn: null,
      },
    ],
    formedOn: asIsoDate('2018-09-01'),
    dissolvedOn: asIsoDate('2025-11-30'),
    audit: stamp(120, 1),
  },
  {
    id: family('fam-0006'),
    referenceNumber: 'FAM-DL-2023-0455',
    name: 'Sarmiento family',
    householdId: household('hh-0006'),
    members: [
      {
        residentId: person('res-0007'),
        role: 'head',
        joinedOn: asIsoDate('2010-05-20'),
        leftOn: null,
      },
    ],
    formedOn: asIsoDate('2010-05-20'),
    dissolvedOn: null,
    audit: stamp(500, 20),
  },
];

/**
 * Relationships between people, independent of any family or household.
 *
 * `rel-0004` deliberately crosses two families: Aurora (fam-0001) is the
 * grandmother of Joselito (fam-0002). A relationship that only worked inside
 * one family would be unable to record it, which is the point.
 */
export const MOCK_RELATIONSHIPS: readonly Relationship[] = [
  {
    id: relationship('rel-0001'),
    fromResidentId: person('res-0002'),
    toResidentId: person('res-0009'),
    kind: 'spouse-of',
    since: asIsoDate('2015-02-14'),
    until: null,
    audit: stamp(310, 5),
  },
  {
    id: relationship('rel-0002'),
    fromResidentId: person('res-0002'),
    toResidentId: person('res-0010'),
    kind: 'parent-of',
    since: asIsoDate('2016-01-05'),
    until: null,
    audit: stamp(310, 5),
  },
  {
    id: relationship('rel-0003'),
    fromResidentId: person('res-0009'),
    toResidentId: person('res-0010'),
    kind: 'parent-of',
    since: asIsoDate('2016-01-05'),
    until: null,
    audit: stamp(310, 5),
  },
  {
    id: relationship('rel-0004'),
    fromResidentId: person('res-0001'),
    toResidentId: person('res-0006'),
    kind: 'grandparent-of',
    since: asIsoDate('2007-02-23'),
    until: null,
    audit: stamp(400, 30),
  },
  {
    // Ended, and kept. Aurora was Joselito's recorded guardian until he turned
    // eighteen; a case study from 2024 still refers to that arrangement.
    id: relationship('rel-0005'),
    fromResidentId: person('res-0001'),
    toResidentId: person('res-0006'),
    kind: 'guardian-of',
    since: asIsoDate('2019-01-10'),
    until: asIsoDate('2025-02-23'),
    audit: stamp(400, 30),
  },
];
