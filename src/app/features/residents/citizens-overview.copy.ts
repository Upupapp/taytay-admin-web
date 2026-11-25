import {
  WITHHOLDS_SMALL_COUNTS,
  type RecordsToTidyKind,
  type ResidentSummaryPeriod,
} from '@domain/index';

const figure = (n: number): string => n.toLocaleString('en-PH');

/** Every sentence the Citizens overview says (`DL-213`). */
export const CITIZENS_OVERVIEW_COPY = {
  title: 'Citizen overview',
  subtitle:
    'The registry counted by the system: who is on it, where, and in which sectors. Every figure opens the registry filtered the same way.',
  register: 'Register a citizen',
  downloadReport: 'Download report',

  filterHeading: 'Filter the figures',
  /** Each filter's visible name, and its unfiltered choice, as on the dashboard's bar (DL-255). */
  barangay: 'Barangay',
  sector: 'Sector',
  ageGroup: 'Age group',
  sex: 'Sex',
  period: 'Period',
  all: 'All',
  periods: {
    month: 'This month',
    quarter: 'This quarter',
    year: 'This year',
  } satisfies Record<ResidentSummaryPeriod, string>,
  clear: 'Clear filters',

  asOf: (when: string, from: string, to: string) =>
    `Figures as of ${when}, counted by the system for ${from} to ${to}, under the filter above.`,
  errorHeading: 'The figures could not be read',

  onRegistry: 'On the registry',
  registered: (period: ResidentSummaryPeriod) => `Registered this ${period}`,
  viewRecords: 'Open these records in the registry',
  /** A figure in the strip, grouped as every other count on the console is. */
  count: figure,
  withheld: 'Withheld',
  withheldHint: 'Too few to show without identifying somebody',

  /** The change, as a screen reader hears it beside the strip's arrow (DL-253). */
  delta: {
    up: (amount: number) => `Up ${figure(amount)} on the previous period`,
    down: (amount: number) => `Down ${figure(amount)} on the previous period`,
    same: 'The same as the previous period',
    none: 'No comparison: a figure was withheld',
    /** Said on the tile itself: the server records no earlier figure for it (DL-254). */
    notRecorded: 'No earlier figure recorded',
    /** The same, with the day the record begins: the cards' status history (DL-257). */
    notRecordedFrom: (date: string) => `No earlier figure recorded. Recorded from ${date}`,
  },

  /** The change, as the strip shows it: "↑ 1,236 vs last period" (DL-253). */
  change: {
    up: (amount: number) => `↑ ${figure(amount)}`,
    down: (amount: number) => `↓ ${figure(amount)}`,
    same: '→ 0',
    against: 'vs last period',
    none: '—',
  },

  kpiSector: {
    'senior-citizen': 'Senior citizens',
    pwd: 'Persons with disability',
    'solo-parent': 'Solo parents',
  },

  byBarangay: 'By barangay',
  byBarangayShare: 'Share of the total',
  byBarangayTotal: 'residents in all',
  byBarangayWithheld: 'A withheld barangay is listed, and left out of the ring.',
  bySector: 'By sector',
  bySectorEmpty: 'No sector is recorded for anyone under this filter yet.',
  bySectorCounted: 'The sectors counted',
  bySectorNone: 'None recorded under this filter',
  bySectorNote:
    'Sectors overlap: one person may be counted in several. The two protected sectors are counted only for staff cleared to see sensitive records.',
  byAgeSex: 'By age group and sex',
  byAgeSexNote: 'Ages in whole years today. Senior citizens are 60 and over (RA 9994).',
  // "Before anything was withheld" only while small counts are (`DL-252`).
  total: (total: number) =>
    WITHHOLDS_SMALL_COUNTS ? `Total before anything was withheld: ${total}.` : `Total: ${total}.`,

  tidyHeading: 'Records to tidy up',
  tidyNone: 'Nothing to tidy under this filter.',
  tidy: {
    'missing-contact': 'Records with no way to reach the person',
    'possible-duplicates': 'Possible duplicates across the registry',
  } satisfies Record<RecordsToTidyKind, string>,
  tidyNotRun: 'Not checked yet: no detection pass has run.',
  tidyLastRun: (when: string) => `Last checked ${when}.`,
  tidyOpen: 'Review them',

  disclosureHeading: WITHHOLDS_SMALL_COUNTS ? 'Why some figures are withheld' : 'Small counts',
  /** From the server's threshold, which the mapper holds to the console's (`DL-252`). */
  disclosure: (threshold: number) =>
    threshold > 1
      ? `A count of people from 1 to ${threshold - 1} is withheld rather than shown, never shown as zero, and cannot be opened. Totals are taken before anything is withheld, so the rows shown do not add up to them.`
      : 'No count of people is withheld for being small: every figure here is its real number, and a zero is a zero.',
  /**
   * Where the threshold comes from, in words. The API sends a token; printed as it came it read
   * "…add up to them. convention-pending-confirmation" (DL-227, pass 2). An unknown token is not
   * printed: the sentence for it is not written yet, and a code is not a sentence.
   */
  provenance: {
    'convention-pending-confirmation':
      'This threshold is a working convention: the MSWDO has not yet confirmed it.',
    'office-confirmed': 'The MSWDO has confirmed this threshold.',
    'owner-decision': 'This is the MSWDO’s own decision, recorded as DL-252.',
  } as Readonly<Record<string, string>>,
} as const;
