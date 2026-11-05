import {
  asId,
  asIsoDateTime,
  type DirectoryOffice,
  type Hotline,
  type HotlineId,
  type TulongService,
  type TulongServiceId,
} from '@domain/index';

import { MOCK_OFFICE_HEALTH, MOCK_OFFICE_MSWDO, MOCK_OFFICES } from './offices.seed';

/**
 * The residents' app directory, for the `local-mock` configuration (`DL-170`).
 *
 * Fictional throughout. The offices are `MOCK_OFFICES` with an entry's worth of made-up detail; the
 * Tulong pages describe kinds of help every municipality publishes, in generic words; the hotline
 * numbers are invented and dial nobody in particular. Every email address is at
 * `directory.example.test`, a reserved name, and `check:bundle` fails a production build that
 * contains it.
 */
export const SAMPLE_DIRECTORY_DOMAIN = 'directory.example.test';

const STAMP = asIsoDateTime('2026-10-01T00:00:00.000Z');

export const MOCK_DIRECTORY_OFFICES: readonly DirectoryOffice[] = MOCK_OFFICES.map(
  (office, index): DirectoryOffice => ({
    ...office,
    category: index === 0 ? 'Social services' : null,
    description:
      index === 0
        ? 'Sample description. Assistance for families in crisis, senior citizens, persons with ' +
          'disability and solo parents.'
        : null,
    head: null,
    hours: 'Monday to Friday, 8:00 to 17:00',
    phone: index === 0 ? '(02) 8000 0101' : null,
    email: `${office.slug}@${SAMPLE_DIRECTORY_DOMAIN}`,
    address: index === 0 ? 'Municipal Hall, ground floor (sample)' : null,
    latitude: null,
    longitude: null,
    hasBanner: index === 0,
    updatedAt: STAMP,
  }),
);

const service = (
  key: string,
  values: Partial<TulongService> & Pick<TulongService, 'name' | 'slug' | 'summary'>,
): TulongService => ({
  id: asId<TulongServiceId>(`service-${key}`),
  category: null,
  details: 'Sample details. What the service is, and how a resident goes about asking for it.',
  eligibility: null,
  requirements: [],
  contacts: [],
  locations: [],
  officeId: null,
  featured: false,
  featuredHeadline: null,
  hiddenFromList: false,
  badge: null,
  iconKey: null,
  tileColor: null,
  legalBasis: null,
  claimSteps: [],
  schedule: null,
  hasImage: false,
  updatedAt: STAMP,
  ...values,
});

export const MOCK_TULONG_SERVICES: readonly TulongService[] = [
  service('senior-id', {
    name: 'Senior citizen ID',
    slug: 'senior-citizen-id',
    category: 'Senior citizens',
    summary:
      'Sample summary. How a resident aged sixty or over applies for the municipal senior ID.',
    eligibility: 'Residents of the municipality aged sixty or over.',
    requirements: ['Proof of age', 'Proof of residence', 'One recent photograph'],
    contacts: [{ type: 'landline', label: 'Senior citizens desk', value: '(02) 8000 0102' }],
    locations: [{ name: 'MSWDO', address: 'Municipal Hall, ground floor (sample)' }],
    officeId: MOCK_OFFICE_MSWDO,
    featured: true,
    featuredHeadline: 'Turning sixty? Get your senior ID',
    claimSteps: ['Bring the requirements to the MSWDO', 'Have your photograph taken'],
    hasImage: true,
  }),
  service('pwd-id', {
    name: 'PWD ID',
    slug: 'pwd-id',
    category: 'Persons with disability',
    summary: 'Sample summary. The identification card for persons with disability.',
    requirements: ['Medical certificate', 'Proof of residence'],
    contacts: [{ type: 'email', label: null, value: `pdao@${SAMPLE_DIRECTORY_DOMAIN}` }],
  }),
  service('feeding', {
    name: 'Supplementary feeding',
    slug: 'supplementary-feeding',
    category: 'Children',
    summary: 'Sample summary. Meals for young children at day care centres.',
    officeId: MOCK_OFFICE_MSWDO,
  }),
  service('checkup', {
    name: 'Free check-up days',
    slug: 'free-check-up-days',
    category: 'Health',
    summary: 'Sample summary. Scheduled consultations at the health centre.',
    officeId: MOCK_OFFICE_HEALTH,
    schedule: 'Every first Monday of the month (sample)',
  }),
  service('archived', {
    name: 'Typhoon relief packs, 2025',
    slug: 'typhoon-relief-2025',
    summary:
      'Sample summary. A past distribution, kept for reference and hidden from the catalogue.',
    hiddenFromList: true,
  }),
];

const hotline = (
  key: string,
  name: string,
  number: string,
  category: string,
  sortOrder: number,
  active = true,
): Hotline => ({
  id: asId<HotlineId>(`hotline-${key}`),
  name,
  number,
  category,
  sortOrder,
  active,
  updatedAt: STAMP,
});

export const MOCK_HOTLINES: readonly Hotline[] = [
  hotline('rescue', 'Municipal rescue (sample)', '(02) 8000 0111', 'Emergency', 1),
  hotline('police', 'Police station (sample)', '(02) 8000 0112', 'Emergency', 2),
  hotline('fire', 'Fire station (sample)', '(02) 8000 0113', 'Emergency', 3),
  hotline('mswdo', 'MSWDO (sample)', '(02) 8000 0101', 'Social services', 10),
  hotline('old-line', 'Former health line (sample)', '(02) 8000 0199', 'Health', 20, false),
];
