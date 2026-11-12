import type { RecordsToTidyKind, ResidentSummaryPeriod } from '@domain/index';

/** Every sentence the Citizens overview says (`DL-213`). */
export const CITIZENS_OVERVIEW_COPY = {
  title: 'Citizen overview',
  subtitle:
    'The registry counted by the API: who is on it, where, and in which sectors. Every figure opens the registry filtered the same way.',
  register: 'Register a citizen',

  filterHeading: 'Filter the figures',
  barangay: 'Barangay',
  allBarangays: 'All barangays',
  sector: 'Sector',
  allSectors: 'All sectors',
  ageGroup: 'Age group',
  allAges: 'All ages',
  sex: 'Sex',
  allSexes: 'Female and male',
  period: 'Compared with',
  periods: {
    month: 'This month and last',
    quarter: 'This quarter and last',
    year: 'This year and last',
  } satisfies Record<ResidentSummaryPeriod, string>,
  clear: 'Clear filters',

  asOf: (when: string, from: string, to: string) =>
    `Figures as of ${when}, counted by the API for ${from} to ${to}, under the filter above.`,
  errorHeading: 'The figures could not be read',

  onRegistry: 'On the registry',
  onRegistryHint: 'Active citizen records',
  registered: (period: ResidentSummaryPeriod) => `Registered this ${period}`,
  registeredHint: 'Records added, to date',
  notLinked: 'The registry cannot be filtered by when a record was added.',
  viewRecords: 'Open these records in the registry',
  withheld: 'Withheld',
  withheldHint: 'Too few to show without identifying somebody',

  delta: {
    up: (amount: number) => `Up ${amount} on the previous period`,
    down: (amount: number) => `Down ${amount} on the previous period`,
    same: 'The same as the previous period',
    none: 'No comparison: a figure was withheld',
  },

  kpiSector: {
    'senior-citizen': { label: 'Senior citizens', hint: '60 and over (RA 9994)' },
    pwd: { label: 'Persons with disability', hint: 'RA 7277, as amended by RA 10754' },
    'solo-parent': { label: 'Solo parents', hint: 'RA 8972, as amended by RA 11861' },
  },

  byBarangay: 'By barangay',
  bySector: 'By sector',
  bySectorNote:
    'Sectors overlap: one person may be counted in several. The two protected sectors are counted only for staff cleared to see sensitive records.',
  byAgeSex: 'By age group and sex',
  byAgeSexNote: 'Ages in whole years today. Senior citizens are 60 and over (RA 9994).',
  total: (total: number) => `Total before anything was withheld: ${total}.`,

  tidyHeading: 'Records to tidy up',
  tidyNone: 'Nothing to tidy under this filter.',
  tidy: {
    'missing-contact': 'Records with no way to reach the person',
    'possible-duplicates': 'Possible duplicates across the registry',
  } satisfies Record<RecordsToTidyKind, string>,
  tidyNotRun: 'Not checked yet: no detection pass has run.',
  tidyLastRun: (when: string) => `Last checked ${when}.`,
  tidyOpen: 'Review them',

  disclosureHeading: 'Why some figures are withheld',
  disclosure: (threshold: number) =>
    `A count of people from 1 to ${threshold - 1} is withheld rather than shown, never shown as zero, and cannot be opened. Totals are taken before anything is withheld, so the rows shown do not add up to them.`,
} as const;
