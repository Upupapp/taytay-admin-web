import { asId, type Office, type OfficeId } from '@domain/index';

/**
 * The offices of the residents' app directory, for the `local-mock` configuration (`DL-168`).
 *
 * Kinds of office every municipality has, named generically. The real directory is the API's, kept
 * by an administrator in the residents' app; nothing here describes it.
 */
export const MOCK_OFFICES: readonly Office[] = [
  {
    id: asId<OfficeId>('office-mswdo'),
    name: 'Municipal Social Welfare and Development Office',
    slug: 'mswdo',
    shortName: 'MSWDO',
  },
  {
    id: asId<OfficeId>('office-mho'),
    name: 'Municipal Health Office',
    slug: 'mho',
    shortName: 'MHO',
  },
  {
    id: asId<OfficeId>('office-mcr'),
    name: 'Municipal Civil Registrar',
    slug: 'civil-registrar',
    shortName: null,
  },
  {
    id: asId<OfficeId>('office-pdao'),
    name: 'Persons with Disability Affairs Office',
    slug: 'pdao',
    shortName: 'PDAO',
  },
];

export const MOCK_OFFICE_MSWDO = asId<OfficeId>('office-mswdo');
export const MOCK_OFFICE_HEALTH = asId<OfficeId>('office-mho');
