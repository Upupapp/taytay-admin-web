import type { ResidentImportSource } from '@domain/index';

/** What the registry panels the boards wait on say (`DL-232`). */
export const REGISTRY_PANELS_COPY = {
  withheld: 'Withheld',
  withheldHint: 'Too few to show without identifying somebody',

  growthHeading: 'Citizens on the registry',
  growthWindow: 'Last 12 months',
  growthCaption: 'Active records on the registry at the end of each month, last 12 months',
  growthMonthHeader: 'Month',
  growthCountHeader: 'Active records',
  growthNote:
    'The registry under the filter at the end of each month, this month as it stands. A month too small to show is withheld, and the line breaks there.',
  growthCallout: (n: number) => `${n.toLocaleString('en-PH')} now`,

  funnelHeading: 'From the registry to a Digital ID',
  funnelLink: 'Citizen IDs',
  funnelSteps: {
    onRegistry: 'On the registry',
    onApp: 'On the residents’ app',
    verified: 'Verified residents',
    activeIds: 'Active Digital IDs',
  },
  funnelNote:
    'Only a verified resident can hold a card. Each step counts the records under the filter; the last three are people, withheld when too few to show.',

  thisMonthHeading: 'This month',
  thisMonth: {
    turning60: 'turn 60 and become senior citizens (RA 9994)',
    turning18: 'turn 18 and leave the children’s count',
    soloParentIdsDue: 'Solo Parent IDs whose recorded validity ends this month',
    pwdIdsExpiring: 'PWD IDs whose recorded validity ends this month',
  },
  thisMonthNote: (month: string) =>
    `${month}, under the filter. Counted from recorded birth dates and ID validity; it decides nothing.`,

  femaleTotal: 'female',
  maleTotal: 'male',
  sexTotalsNote: 'Totals by sex, taken before any figure was withheld.',

  importsHeading: 'Recent imports',
  importsLink: 'Import citizens',
  importsEmpty: 'No list has been imported yet.',
  importsError: 'The imports could not be read.',
  importsRetry: 'Try again',
  importMeta: (when: string, who: string | null, rows: number) =>
    `${when}${who === null ? '' : ` · ${who}`} · ${rows} ${rows === 1 ? 'row' : 'rows'}`,
  importOpen: 'Being checked: nothing has reached the registry yet',
  importAdded: (created: number, attached: number) =>
    `${created} added · ${attached} matched to a record`,
  importOther: (skipped: number, errors: number) =>
    `${skipped} skipped · ${errors} with a problem`,
  importSourceNotSaid: 'Source not said',
  sources: {
    'rbi-census': 'Barangay RBI or census',
    osca: 'OSCA senior list',
    pdao: 'PDAO list',
    'solo-parent-office': 'Solo parent office list',
    'four-ps': '4Ps list',
    'other-spreadsheet': 'Another spreadsheet',
  } satisfies Record<ResidentImportSource, string>,

  attentionHeading: 'Needs attention',
  attentionBasis: 'Counted:',
  attentionAdvice: 'These counts advise; none of them decides anything about a person.',

  coverageHeading: 'Benefits and IDs',
  coverageHeadingSupport: 'IDs and support',
  coverageHeadingServices: 'IDs and services',
  coverage: {
    sectorIdOnFile: 'Sector ID on file',
    socialPension: 'Receiving the social pension',
    appAccounts: 'On the residents’ app',
    digitalIds: 'Holding an active Digital ID',
  },
  coverageOf: (total: number) => `of ${total.toLocaleString('en-PH')} on the registry`,
  coverageNote: 'Each a count of people under the filter, withheld when too few to show.',

  /* A sector page's figures, above its list. */
  sectorFiguresLabel: 'The sector’s figures',
  sectorErrorHeading: 'The sector’s figures could not be read',
  sectorTotalHint: 'On the registry, under the barangay chosen below',
  sectorIdHint: 'Members with the number of their sector card recorded',
  sectorAppHint: (ids: string) => `${ids} holding an active Digital ID`,
  byBarangay: 'By barangay',
  ageBands: 'Age bands',
  disabilityType: 'Type of disability',
  childrenInCare: 'Children in their care',
  total: (total: number) => `Total before anything was withheld: ${total}.`,
  sectorKpi: {
    'senior-citizen': {
      total: 'Senior citizens',
      id: 'Senior Citizen ID recorded',
      third: 'On the social pension',
      thirdHint: 'Recorded on their latest sector record',
    },
    pwd: {
      total: 'Persons with disability',
      id: 'PWD ID recorded',
      third: 'PWD IDs ending this month',
      thirdHint: 'Their recorded validity ends this month',
    },
    'solo-parent': {
      total: 'Solo parents',
      id: 'Solo Parent ID recorded',
      third: 'Solo Parent IDs due this month',
      thirdHint: 'Their recorded validity ends this month',
    },
  },
} as const;
