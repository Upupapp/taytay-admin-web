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

    aggregateNotice:
      'Every report here is a count unless it says otherwise. Figures small enough to identify ' +
      'somebody are withheld rather than shown.',

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
    totalHint: 'Counted before anything was withheld, so it does not always match the rows above.',
    withheldHeading: 'Some figures are withheld',
    disclosureHeading: 'Why figures are withheld',

    namesPeopleHeading: 'This report names people',

    exportHeading: 'Export',
    exportCsv: 'Download as CSV',
    exportHint: 'The file carries the report name, the filter applied, and who generated it.',
    exportWarningHeading: 'Before you export',
    exportConfirm: 'I understand — export it',
    exportCancel: 'Cancel',
    exported: 'Export ready.',
    exportFailed: 'That export could not be produced.',
    noExportPermission: 'Your account can read this report but cannot export it.',

    emptyHeading: 'Nothing matched this filter',
    emptyMessage: 'Try a wider period, or clear the filters.',
  },
} as const;
