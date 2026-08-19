/**
 * Screen wording for the beneficiary registry.
 *
 * Copy lives in the feature, never in the domain (`DL-23`). The office's terms
 * for its own categories are domain labels; the sentences around them are here.
 *
 * A note on the words chosen. This screen shows a person their own history in
 * front of them, so it says "received" rather than "benefited", "on file" rather
 * than "in the system", and never describes somebody as a "case". The registry
 * lists people the office has served.
 */
export const BENEFICIARIES_COPY = {
  list: {
    title: 'Beneficiaries',
    subtitle: 'Everyone this office has served, and what they have received.',
    reviewDuplicates: 'Review possible duplicates',

    search: 'Search',
    searchPlaceholder: 'Name, barangay or programme',
    searchHint:
      'Searches names, barangays and current programmes. Results stay within the barangays you may see.',
    barangay: 'Barangay',
    allBarangays: 'All barangays',
    programme: 'Programme',
    allProgrammes: 'All programmes',
    standing: 'Standing',
    allStandings: 'Anyone on file',
    receivedFrom: 'Received from',
    receivedTo: 'Received to',
    onlyDuplicates: 'Only records with a possible duplicate',
    clear: 'Clear filters',
    periodReversed: 'The "from" date is after the "to" date, so nothing can match. Swap them.',

    caption: 'Beneficiaries, with their standing and assistance history',
    columnPerson: 'Person',
    columnBarangay: 'Barangay',
    columnStanding: 'Standing',
    columnProgrammes: 'Current programmes',
    columnEvents: 'Events',
    columnReceived: 'Total received',
    columnLast: 'Last assistance',

    none: '—',
    noProgrammes: 'Not enrolled',
    neverAssisted: 'No assistance yet',
    restricted: 'Restricted record',
    duplicateFlag: 'Possible duplicate',
    duplicateFlagHint: 'Another record on file resembles this one.',

    emptyHeading: 'Nobody on file yet',
    emptyMessage: 'Once requests are filed and assistance is released, the people served appear here.',
    noResultsHeading: 'No one matches those filters',
    noResultsMessage: 'Try a wider period, or clear the filters to see everyone.',
  },

  detail: {
    back: 'Back to beneficiaries',
    notFoundHeading: 'That record is not available',
    notFoundMessage:
      'It may not exist, or it may be outside the barangays your account covers. Ask the MSWDO if you believe you should see it.',

    standingHeading: 'Standing',
    standingHint: 'Derived from what this office has recorded, not from a flag anybody set.',

    householdHeading: 'Household and family',
    householdNone: 'Not linked to a household.',
    householdHead: 'Head of household',
    familiesNone: 'Not recorded as part of a family.',
    openHousehold: 'Open household',
    openFamily: 'Open family',

    enrollmentsHeading: 'Programmes',
    enrollmentsNone: 'Not enrolled in any continuing programme.',
    enrolledOn: 'Enrolled',
    exitedOn: 'Left',
    exitReason: 'Reason',
    continues: 'Resumes an earlier enrollment',

    totalsHeading: 'Totals',
    totalReceived: 'Total received',
    totalReceivedHint: 'Counts only assistance actually handed over — never what was merely approved.',
    eventCount: 'Recorded events',
    openCases: 'Open cases',

    timelineHeading: 'Assistance history',
    timelineHint: 'Every request, release, referral and enrollment, newest first.',

    duplicatesHeading: 'Possible duplicates',
    duplicatesNone: 'No other record on file resembles this one.',
    duplicatesHint:
      'Comparisons show which details agree, not what they are. Open a comparison only when you are reviewing it.',
    review: 'Review',
  },

  duplicates: {
    title: 'Possible duplicates',
    subtitle: 'Records that may belong to the same person, waiting for a decision.',
    back: 'Back to beneficiaries',

    caption: 'Pairs of records awaiting an identity decision',
    columnRecords: 'Records',
    columnStrength: 'Resemblance',
    columnAgreement: 'What agrees',
    columnAction: '',
    open: 'Review pair',

    emptyHeading: 'Nothing waiting',
    emptyMessage: 'Every pair the office has surfaced has been answered.',

    strengthHint:
      'Resemblance orders this queue. It decides nothing — a person makes the finding, and records why.',
    sensitiveNotice:
      'One of these records is handled under a protected sector. Open it only if reviewing it is your work.',

    comparisonHeading: 'What the two records have in common',
    comparisonHint:
      'Each line says whether a detail agrees, not what the detail is. Values are never shown here.',

    verdictHeading: 'Your finding',
    verdictSame: 'The same person',
    verdictSameHint:
      'Keeps one record as the one the office uses. Nothing is deleted — the other record and everything attached to it stay on file.',
    verdictDistinct: 'Two different people',
    verdictDistinctHint:
      'Records that these two were checked and are not the same, so the pair stops being raised again.',

    canonicalHeading: 'Which record does the office keep using?',
    canonicalHint: 'The other record stays readable and keeps its history.',

    reasonLabel: 'Why (required)',
    reasonPlaceholder: 'What did you check, and with whom?',
    reasonHint: 'Recorded against your name. Somebody reading this later needs to be able to follow it.',

    previewHeading: 'What this finding carries across',
    previewRequests: 'Assistance requests',
    previewReleases: 'Releases',
    previewCases: 'Open cases',
    previewEnrollments: 'Programme enrollments',
    previewOverlap: 'Recorded under both records',
    previewOverlapHint:
      'The same programme appears on both. Check whether it is one episode recorded twice before you decide.',
    previewNothing: 'Nothing is attached to the record being superseded.',

    submit: 'Record finding',
    submitting: 'Recording…',
    cancel: 'Cancel',
    recorded: 'Finding recorded.',
    failed: 'That finding could not be recorded.',

    problemReason: 'Give a reason before recording this.',
    problemCanonical: 'Choose which record the office keeps using.',
    problemPair: 'A record cannot be compared with itself.',
  },
} as const;
