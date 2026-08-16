import {
  asId,
  type BarangayId,
  type ServiceProvider,
  type ServiceProviderId,
} from '@domain/index';

import { stamp } from './seed-utils';

const provider = (slug: string): ServiceProviderId => asId<ServiceProviderId>(`svp-${slug}`);
const brgy = (slug: string): BarangayId => asId<BarangayId>(`brgy-${slug}`);

/**
 * The directory of offices the MSWDO refers people to.
 *
 * Fictional contact details throughout — no real person's name, number or
 * address appears, including on the public offices, whose staff are as entitled
 * to that as anybody else.
 *
 * One entry is `suspended` and one is `retired`, because a directory that only
 * ever contained working entries would leave the "this office is not taking
 * referrals" path unexercised — and that path is the one that saves a family a
 * wasted trip.
 */
export const MOCK_SERVICE_PROVIDERS: readonly ServiceProvider[] = [
  {
    id: provider('dswd-fo4a'),
    name: 'DSWD Field Office IV-A (CALABARZON)',
    destination: 'dswd-field-office',
    status: 'active',
    servicesOffered: [
      'Assistance to Individuals in Crisis Situation (AICS)',
      'Medical and burial assistance beyond LGU capacity',
      'Transportation assistance',
    ],
    address: 'Alabang–Zapote Road, Muntinlupa City',
    barangayId: null,
    contact: {
      personName: 'Crisis Intervention Section',
      position: 'Receiving desk',
      phone: '(02) 8555-0142',
      email: 'crisis.fo4a@example.gov.ph',
    },
    channels: ['letter', 'email', 'in-person'],
    usualResponseDays: 10,
    notes: 'Referrals are assessed by their own social workers; the LGU does not decide the outcome.',
    audit: stamp(500, 40),
  },
  {
    id: provider('taytay-doctors'),
    name: 'Taytay Doctors Hospital — Medical Social Work Unit',
    destination: 'hospital-msw',
    status: 'active',
    servicesOffered: [
      'Hospital bill reduction and charity classification',
      'Medicine and laboratory assistance for admitted patients',
      'Discharge planning',
    ],
    address: 'Manila East Road, Taytay, Rizal',
    barangayId: brgy('san-juan'),
    contact: {
      personName: 'Medical Social Work Unit',
      position: 'Duty medical social worker',
      phone: '(02) 8555-0187',
      email: null,
    },
    channels: ['phone', 'in-person', 'letter'],
    usualResponseDays: 2,
    notes: 'Answers quickly for admitted patients. Walk-in referrals need the admission slip.',
    audit: stamp(480, 21),
  },
  {
    id: provider('philhealth-rizal'),
    name: 'PhilHealth Local Health Insurance Office — Rizal',
    destination: 'philhealth',
    status: 'active',
    servicesOffered: [
      'Membership registration and reactivation',
      'Point-of-service enrolment for indigent patients',
      'Benefit eligibility verification',
    ],
    address: 'Ynares Center vicinity, Antipolo City',
    barangayId: null,
    contact: {
      personName: null,
      position: 'Member services',
      phone: '(02) 8555-0231',
      email: 'rizal.lhio@example.gov.ph',
    },
    channels: ['letter', 'in-person'],
    usualResponseDays: 14,
    notes: null,
    audit: stamp(470, 95),
  },
  {
    id: provider('peso-taytay'),
    name: 'Taytay Public Employment Service Office',
    destination: 'peso',
    status: 'active',
    servicesOffered: [
      'Job matching and referral to local employers',
      'Special Program for Employment of Students',
      'Livelihood and skills training referral to TESDA',
    ],
    address: 'Municipal Hall, Taytay, Rizal',
    barangayId: brgy('san-juan'),
    contact: {
      personName: null,
      position: 'PESO manager',
      phone: '(02) 8555-0119',
      email: 'peso@example.gov.ph',
    },
    channels: ['in-person', 'system'],
    usualResponseDays: 7,
    notes: 'Same building. Hand-carried referrals are usually seen the same day.',
    audit: stamp(460, 30),
  },
  {
    id: provider('wcpd-taytay'),
    name: 'PNP Taytay Women and Children Protection Desk',
    destination: 'women-and-children-protection-desk',
    status: 'active',
    servicesOffered: [
      'Protection orders and safety planning',
      'Case build-up for VAWC complaints (RA 9262)',
      'Coordination for children in conflict with the law (RA 9344)',
    ],
    address: 'Taytay Municipal Police Station',
    barangayId: brgy('san-juan'),
    contact: {
      personName: null,
      position: 'Desk officer on duty',
      phone: '(02) 8555-0175',
      email: null,
    },
    channels: ['phone', 'in-person'],
    usualResponseDays: 1,
    notes:
      'Protection cases only. Share the minimum — the survivor’s address is not needed to open a case here.',
    audit: stamp(455, 12),
  },
  {
    id: provider('bantay-bata-rizal'),
    name: 'Bantay Pamilya Rizal (NGO partner)',
    destination: 'ngo-partner',
    status: 'suspended',
    servicesOffered: ['Temporary shelter for women and children', 'Counselling'],
    address: 'Cainta, Rizal',
    barangayId: null,
    contact: {
      personName: null,
      position: 'Intake coordinator',
      phone: '(02) 8555-0288',
      email: 'intake@example.org',
    },
    channels: ['phone', 'email'],
    usualResponseDays: 3,
    // Suspended rather than retired: the office expects to use them again, and
    // a retired entry would lose the referral history attached to it.
    notes: 'Shelter at capacity since June 2026. Confirm by phone before referring.',
    audit: stamp(300, 55),
  },
  {
    id: provider('rizal-provincial-social-welfare'),
    name: 'Rizal Provincial Social Welfare and Development Office',
    destination: 'other-lgu-office',
    status: 'retired',
    servicesOffered: ['Supplementary financial assistance'],
    address: 'Provincial Capitol, Antipolo City',
    barangayId: null,
    contact: {
      personName: null,
      position: null,
      phone: '(02) 8555-0300',
      email: null,
    },
    channels: ['letter'],
    usualResponseDays: 21,
    notes: 'Programme folded into the DSWD field office arrangement. Kept for referral history.',
    audit: stamp(700, 210),
  },
];
