import { WITHHOLDS_SMALL_COUNTS } from '@domain/index';

/**
 * Screen wording for reports and exports.
 *
 * Three words are load-bearing. **Withheld** never appears as "0" or as a blank
 * cell: a reader who does not know a figure is missing will total the column
 * and defend the answer. **Waiting** never appears as "overdue" — no service
 * standard has been adopted. And a **caution** is a sentence about what the
 * numbers do not show, printed above them rather than in a footnote.
 */
export const REPORTS_COPY = {
  hub: {
    title: 'Reports',
    subtitle: 'Figures for planning and accountability, without naming people unless it is needed.',

    // The second sentence follows the small-cell switch (`DL-252`): off, nothing small is withheld.
    aggregateNotice: WITHHOLDS_SMALL_COUNTS
      ? 'Every report here is a count unless it says otherwise. Figures small enough to identify ' +
        'somebody are withheld rather than shown.'
      : 'Every report here is a count unless it says otherwise. Every figure is its real number, ' +
        'however small, so a small count can point to a person: handle it under RA 10173.',

    open: 'Open',
    namesPeople: 'Names people',
    namesPeopleHint: 'This report lists individual residents and needs the export permission.',

    emptyHeading: 'No reports available to your account',
    emptyMessage: 'Reporting is granted separately. Ask the MSWDO head if you need it.',
  },

  view: {
    back: 'All reports',
    notFoundHeading: 'That report is not available',
    notFoundMessage: 'It may not exist, or your account may not cover it.',

    question: 'What this answers',
    coverage: 'Covers',
    generated: 'Generated',
    cautionHeading: 'Read this first',

    filtersHeading: 'Narrow the figures',
    period: 'Period',
    barangay: 'Barangay',
    allBarangays: 'All barangays',
    program: 'Programme',
    allPrograms: 'All programmes',
    clear: 'Clear filters',

    total: 'Total',
    totalHint: WITHHOLDS_SMALL_COUNTS
      ? 'Counted before anything was withheld, so it does not always match the rows above.'
      : '',
    totalOverlappingHint: WITHHOLDS_SMALL_COUNTS
      ? 'Each counted once, however many rows they are under, so the rows above add up to more. Counted before anything was withheld.'
      : 'Each counted once, however many rows they are under, so the rows above add up to more.',
    seriesEmpty: 'Nothing was counted in this table under this filter.',
    withheldHeading: 'Some figures are withheld',
    disclosureHeading: WITHHOLDS_SMALL_COUNTS ? 'Why figures are withheld' : 'Small counts',
    limitsHeading: 'What this report cannot count',

    namesPeopleHeading: 'This report names people',

    exportHeading: 'Export',
    exportCsv: 'Download as CSV',
    exportHint: 'The file carries the report name, the filter applied, and who generated it.',
    exportWarningHeading: 'Before you export',
    exportConfirm: 'I understand — export it',
    exportCancel: 'Cancel',
    exported: 'Export ready.',
    fileReady: 'The file is ready. It carries the report, the filter and who produced it.',
    saveFile: (filename: string) => `Save ${filename}`,
    exportFailed: 'That export could not be produced.',
    noExportPermission: 'Your account can read this report but cannot export it.',

    emptyHeading: 'Nothing matched this filter',
    emptyMessage: 'Try a wider period, or clear the filters.',
  },
} as const;
