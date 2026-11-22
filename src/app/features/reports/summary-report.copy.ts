import type { SummaryAgeGroup, SummarySex, SummaryWithheldReason } from '@domain/index';

/**
 * Screen wording for the summary report (`DL-228`), the office's standard template.
 *
 * Everything printed on the sheet itself — the letterhead, the title, the executive summary, every
 * section heading, note, total label and suppression notice — is the server's. These are the
 * console's own words around it: the filters, the buttons and what each does, and the few labels
 * the server leaves to the page (the signature lines, the footer).
 */
export const SUMMARY_REPORT_COPY = {
  back: 'All reports',
  title: 'Summary report',
  subtitle:
    'The office’s standard report: the period’s requests, releases and the people served, on an ' +
    'A4 sheet to download as PDF or print.',

  hubHeading: 'Summary report',
  hubLead:
    'The office’s standard template: letterhead, executive summary, nine sections with charts, ' +
    'and lines for signatures. Download it as a PDF, or as a CSV with permission to export.',
  hubOpen: 'Open the summary report',

  filtersHeading: 'Narrow the report',
  from: 'From',
  to: 'To',
  barangay: 'Barangay',
  allBarangays: 'All barangays',
  program: 'Programme',
  allPrograms: 'All programmes',
  programsUnread:
    'The programme list could not be read for your account, so the report covers every programme.',
  sex: 'Sex',
  allSexes: 'Everyone',
  age: 'Age group',
  allAges: 'All ages',
  sector: 'Sector',
  allSectors: 'All sectors',
  clear: 'Clear filters',
  filtersHint:
    'The period ends today at the latest, and starts on 1 January of its year unless you choose ' +
    'a day. Age is counted on the day a request was filed or served.',
  badPeriod: 'The first day comes after the last, so the period was set back to the year to date.',

  sexLabels: { female: 'Women', male: 'Men' } satisfies Record<SummarySex, string>,
  ageLabels: {
    '0-17': 'Children (0–17)',
    '18-59': 'Adults (18–59)',
    '60-plus': 'Seniors (60 and over)',
  } satisfies Record<SummaryAgeGroup, string>,

  actionsHeading: 'Download the report',
  printHint:
    'Download PDF asks the office record for the report again with these filters, then opens ' +
    'your browser’s print window on the A4 sheet: choose “Save as PDF” as the destination and ' +
    'press Save. To print on paper, choose a printer there instead. The run is recorded in the ' +
    'audit trail.',
  print: 'Download PDF',
  printing: 'Preparing the PDF…',
  pdfName: (from: string, to: string) => `Summary report ${from} to ${to}`,
  printFailed: 'The report could not be read again, so nothing was printed. Try again.',
  excelHint:
    'Download CSV saves the same tables as a CSV file, which opens in Excel. The file ' +
    'carries its conditions — the period, the filters, who made it and when, why figures are ' +
    'withheld and how to handle it — above the first figure. The download is recorded in the ' +
    'audit trail.',
  excel: 'Download CSV (for Excel)',
  exporting: 'Preparing the file…',
  exported: 'Report file ready',
  exportFailed: 'The file could not be made. Nothing was downloaded.',
  fileReady: 'The file is ready.',
  saveFile: (filename: string) => `Save ${filename}`,

  emptyHeading: 'Nothing was counted for this period',
  emptyMessage:
    'No request was filed, served, decided against or left open for these filters. The sheet ' +
    'below still prints, because a period with no service is a finding too.',
  noResultsHeading: 'Nothing was counted for these filters',
  errorHeading: 'The report could not be read',

  periodCovered: 'Period covered',
  narrowedTo: 'Narrowed to',
  narrowedToNothing: 'Nothing: every barangay, programme and person in your scope.',
  executiveSummary: 'Executive summary',
  overdueHeading: 'Overdue',
  overdueNone: 'Not counted',
  notCounted: 'Not counted for you',
  withheld: 'Withheld',
  withheldReasons: {
    // Printed after "Withheld", so neither repeats it (C6, the demo rehearsal).
    'small-cell': 'too few people to show without identifying someone; not a zero',
    'protected-sector':
      'a sector protected by law (RA 9262, RA 9344); your account does not count it',
  } satisfies Record<SummaryWithheldReason, string>,
  chartWithheld: 'withheld',
  waitingOn: { office: 'The office', resident: 'The resident' } as Readonly<Record<string, string>>,
  category: 'Category',
  daysSuffix: (days: string) => `${days} days`,

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
