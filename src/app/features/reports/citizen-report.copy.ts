import type { ResidentSummaryPeriod, Sex } from '@domain/index';

/**
 * Screen wording for the citizen registry report (`DL-234`), in the summary report's template.
 *
 * Everything printed on the sheet — letterhead, title, executive summary, section headings, notes,
 * total labels, suppression notices — is the server's. These are the console's words around it:
 * the filters, the buttons and what each does, and the labels the server leaves to the page.
 */
export const CITIZEN_REPORT_COPY = {
  back: 'Citizen overview',
  title: 'Citizen registry report',
  subtitle:
    'The registry in the office’s standard template: who is on it, where, by age, sex and sector, ' +
    'and how many hold a Digital ID, on an A4 sheet to download as PDF or print.',

  hubHeading: 'Citizen registry report',
  hubLead:
    'The Citizen overview in the same template: letterhead, executive summary, seven sections with ' +
    'charts, and lines for signatures. Download it as a PDF, or as a CSV with permission to export.',
  hubOpen: 'Open the citizen registry report',

  filtersHeading: 'Narrow the report',
  barangay: 'Barangay',
  allBarangays: 'All barangays',
  sector: 'Sector',
  allSectors: 'All sectors',
  age: 'Age group',
  allAges: 'All ages',
  sex: 'Sex',
  allSexes: 'Everyone',
  period: 'Change counted over',
  clear: 'Clear filters',
  filtersHint:
    'The registry is counted as it stands today. The period is the calendar month, quarter or ' +
    'year to date that new records and the change in the registry are counted over. Age is age today.',
  periodLabels: {
    month: 'This month',
    quarter: 'This quarter',
    year: 'This year',
  } satisfies Record<ResidentSummaryPeriod, string>,
  sexLabels: { female: 'Women and girls', male: 'Men and boys' } satisfies Record<Sex, string>,

  actionsHeading: 'Download the report',
  printHint:
    'Download PDF asks the office record for the report again with these filters, then opens ' +
    'your browser’s print window on the A4 sheet: choose “Save as PDF” as the destination and ' +
    'press Save. To print on paper, choose a printer there instead. The run is recorded in the ' +
    'audit trail.',
  print: 'Download PDF',
  printing: 'Preparing the PDF…',
  pdfName: (to: string) => `Citizen registry report ${to}`,
  printFailed: 'The report could not be read again, so nothing was printed. Try again.',
  csvHint:
    'Download CSV saves the same tables as a CSV file, which opens in Excel. The file carries its ' +
    'conditions — the period, the filters, who made it and when, why figures are withheld and how ' +
    'to handle it — above the first figure. The download is recorded in the audit trail.',
  csv: 'Download CSV (for Excel)',
  exporting: 'Preparing the file…',
  exported: 'Report file ready',
  exportFailed: 'The file could not be made. Nothing was downloaded.',
  fileReady: 'The file is ready.',
  saveFile: (filename: string) => `Save ${filename}`,

  emptyHeading: 'Nobody is on the registry yet',
  noResultsHeading: 'Nobody on the registry matches these filters',
  emptyMessage:
    'The sheet below still prints, with every figure at zero: an empty registry is a finding too.',
  errorHeading: 'The report could not be read',

  periodCovered: 'Period covered',
  narrowedTo: 'Narrowed to',
  narrowedToNothing: 'Nothing: every barangay, sector, age group and sex in your scope.',
  executiveSummary: 'Executive summary',

  signaturesHeading: 'Signatures',
  signaturesHint:
    'Type the names and positions as they should print. They are not saved or sent anywhere, ' +
    'and are gone when you leave this page.',
  preparedBy: 'Prepared by',
  notedBy: 'Noted by',
  approvedBy: 'Approved by',
  signatoryName: (role: string) => `${role}: name`,
  signatoryTitle: (role: string) => `${role}: position`,

  generated: (date: string, name: string) =>
    `Generated from the Taytay Social Welfare console on ${date} by ${name}.`,
  disclosureHeading: 'Why some figures are withheld',
} as const;
