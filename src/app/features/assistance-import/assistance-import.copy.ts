import {
  IMPORT_FILE_LIMITS,
  type AssistanceImportAction,
  type AssistanceImportBlocker,
  type AssistanceImportGroup,
  type AssistanceImportOutcomeKind,
  type AssistanceImportStatus,
} from '@domain/index';

const MB = IMPORT_FILE_LIMITS.maxBytes / (1024 * 1024);

const rows = (count: number): string => `${count} ${count === 1 ? 'row' : 'rows'}`;

/** Every sentence the past-assistance import says (`DL-228`). */
export const ASSISTANCE_IMPORT_COPY = {
  title: 'Import past assistance',
  subtitle:
    'Bring in the office’s old Tulong reports, so every figure counts what a family already received. You check every row before anything is filed.',
  cancel: 'Back to assistance requests',
  backToImports: 'Back to the imports',
  noAnswer: 'the system gave no reason.',
  retry: 'Try again',
  unknownPerson: 'somebody not named',

  steps: ['Upload', 'Match columns', 'Review rows', 'Commit', 'Result'] as const,
  stepsLabel: 'Steps of the import',

  upload: {
    heading: 'Upload the report',
    limits: `A .csv (comma or semicolon, UTF-8) or the first sheet of an .xlsx; at most ${MB} MB, ${IMPORT_FILE_LIMITS.maxRows.toLocaleString('en-US')} rows and ${IMPORT_FILE_LIMITS.maxColumns} columns. The first row must be the column names, in English or Filipino. Formulas are not worked out.`,
    label: 'The file',
    hint: 'Choosing a file sends nothing: the upload is its own button below.',
    chosen: (name: string, size: string) => `${name} · ${size}`,
    tooBig: `That file is larger than ${MB} MB, so it was not sent.`,
    wrongKind: 'Only a .csv or .xlsx file can be imported. Nothing was sent.',
    none: 'Choose a file first.',
    effectsLead: 'What uploading does:',
    effects: [
      'Nothing is filed. The rows are held for checking, under a matching of columns guessed from the first row, which you confirm next.',
      'Each row needs a name, a Taytay barangay, a type of assistance the office runs, and the date it was given.',
      'The upload is recorded in the audit trail under your name.',
      'Once the import is committed, the file’s cells are emptied: what was filed is on the records, and the rest of the file is not the office’s to keep.',
    ],
    submit: 'Upload and check',
    sending: 'Uploading…',
    refused: (reason: string) => `Not uploaded: ${reason}`,
  },

  recent: {
    heading: 'Imports of past assistance',
    caption: 'Imports, newest first',
    columnFile: 'File',
    columnBy: 'Uploaded by',
    columnRows: 'Rows',
    columnStatus: 'Status',
    columnResult: 'What became of the rows',
    columnAction: 'Action',
    unknownPerson: 'Not named',
    result: (imported: number, skipped: number, duplicates: number, errors: number) =>
      `${imported} imported, ${skipped} skipped, ${duplicates} already held, ${errors} refused`,
    pending: 'Not committed yet',
    continue: 'Continue',
    view: 'View',
    openLabel: (file: string) => `Open the import of ${file}`,
    withdrawLabel: (file: string) => `Withdraw the import of ${file}`,
    emptyHeading: 'No imports yet',
    emptyMessage: 'Upload a report above to start the first one.',
    shown: (count: number) => `${count} shown.`,
    moreAvailable: 'More are available.',
    noMore: 'That is every import.',
    showMore: 'Show more',
  },

  status: {
    open: 'Being checked',
    committed: 'Committed',
    withdrawn: 'Withdrawn',
  } satisfies Record<AssistanceImportStatus, string>,

  withdrawn: {
    line: (when: string, by: string) => `Withdrawn ${when} by ${by}.`,
    reason: (reason: string) => `Reason: “${reason}”`,
    effect:
      'Its requests are still on the residents’ records, marked withdrawn, and are no longer counted anywhere.',
  },

  withdraw: {
    button: 'Withdraw',
    heading: (file: string) => `Withdraw the import of ${file}?`,
    effects: (imported: number) => [
      `The import, and the ${imported === 1 ? 'request' : `${imported} requests`} and releases it filed, are marked withdrawn under your name, with the time and this reason.`,
      'Its requests stay on the residents’ records, marked withdrawn, and can still be opened. Nothing is deleted.',
      'They are no longer counted in the dashboard, the reports, the intake’s twelve-month look-back, or the request and release lists.',
      'Their control numbers are free again, so a corrected file can be imported. A withdrawn import cannot be committed again.',
    ],
    confirm: 'Withdraw the import',
    reasonHint:
      'Required, up to 500 characters. Kept with the import under your name, and shown wherever the import is.',
    refused: (reason: string) => `Not withdrawn: ${reason}`,
  },

  record: {
    errorHeading: 'The import could not be read',
    notFound: 'That import was not found. It may belong to an office you cannot see.',
    notFoundLink: 'Choose an import from the list',
    file: (name: string, count: number) => `${name} · ${rows(count)}`,
  },

  map: {
    heading: 'Match the report’s columns',
    lead: 'The system guessed these from the first row, in English or Filipino. Each field takes one column at most; a field left empty is not read from this file. A name is either one whole-name column, or surname and given name.',
    field: 'Field',
    column: 'Column in the file',
    required: 'Required',
    notInFile: 'Not in this file',
    columnOption: (header: string, samples: string) =>
      samples === '' ? header : `${header} — e.g. ${samples}`,
    missing: (labels: string) => `Still to match before the import can be committed: ${labels}.`,
    allMatched: 'Every required field has a column.',
    nameField: 'A name (whole, or surname and given name)',
    locked:
      'The columns can no longer be changed: rows have been decided under this matching, and a new one would change what was decided about them.',
    effects: [
      'Saving reads every row again under the new matching, and groups them again.',
      'Recorded in the audit trail under your name.',
    ],
    save: 'Save the matching',
    saving: 'Saving…',
    saved: 'Saved. The rows were read again.',
    next: 'Next: review the rows',
    taken: (label: string) => `That column already feeds ${label}. Choose one field for it.`,
  },

  review: {
    heading: 'Review the rows before anything is filed',
    lead: 'The grouping is advice, read by the system. A row is filed on a record by itself only when one record in its barangay has the whole name, and nothing contradicts it. You may change any proposal.',
    tabsLabel: 'Rows by group',
    groups: {
      ready: 'Ready',
      'needs-review': 'Needs review',
      skipped: 'Skipped',
      duplicate: 'Already held',
      error: 'Problems',
    } satisfies Record<AssistanceImportGroup, string>,
    notes: {
      ready:
        'Each will be filed as a closed request on the record named, or on a record made from the row. You may change any of them.',
      'needs-review':
        'No single record could be named for these rows. Link each to a record, make a record from it, or skip it.',
      skipped: 'Nothing is filed for these rows. You may change your mind.',
      duplicate:
        'These repeat a release already in the system, or earlier in this file. They are skipped and reported, never imported twice.',
      error:
        'These rows cannot be read as they are. They are refused at commit; correct the file and import those rows again.',
    } satisfies Record<AssistanceImportGroup, string>,
    waiting: (count: number) =>
      count === 0
        ? 'No row is waiting for a decision.'
        : `${rows(count)} still ${count === 1 ? 'waits' : 'wait'} for a decision.`,
    none: 'No rows in this group.',
    rowLabel: (row: number, line: number) => `Row ${row} (line ${line} of the file)`,
    noValues: 'The cells are no longer held.',
    proposed: (label: string) =>
      `Proposed: filed on ${label}, the one strong match in its barangay.`,
    linked: (label: string) => `Filed on ${label}, as a person linked it.`,
    willCreate: 'A new registry record will be made from this row when the import is committed.',
    createsWith: (row: number) =>
      `Filed on the new registry record row ${row} makes: the same name, barangay, birth date and sex, so one record, not two.`,
    duplicateOf: {
      'control-number': 'The same control number under the same programme',
      'same-day': 'The same person, programme and day of assistance',
    } satisfies Record<'control-number' | 'same-day', string>,
    duplicateRow: (reason: string, row: number) => `${reason} as row ${row} of this file.`,
    duplicateRequest: (reason: string, reference: string) =>
      `${reason} as request ${reference}, already in the system.`,
    duplicateSystem: (reason: string) => `${reason} as a request already in the system.`,
    candidatesHeading: 'Records it resembles',
    signalsLabel: (label: string) => `Why ${label} was suggested`,
    signal: (attribute: string, outcome: string, rule: string) =>
      `${attribute}: ${outcome} — ${rule}`,
    open: 'Open the record',
    decided: (action: string, by: string, reason: string) => `${action}, by ${by}: “${reason}”`,
    change: 'Decide again',
    next: 'Next: commit',
    back: 'Back to the columns',
  },

  finding: {
    legend: 'Whose record is this row?',
    actions: {
      link: 'Link it to a record',
      create: 'Make a new record from the row',
      skip: 'Do not import this row',
    } satisfies Record<AssistanceImportAction, string>,
    linkTo: (label: string, strength: string) => `File it on ${label} (${strength})`,
    hints: {
      link: 'The request is filed on that record when you commit. Nothing on the record is written over.',
      create:
        'A record is made from the row when you commit, with what the registry needs and the row lacks.',
      skip: 'Nothing is filed for this row.',
    } satisfies Record<AssistanceImportAction, string>,
    createLead:
      'Only what the registry needs and the row lacks. A field left empty keeps the row’s; the barangay is always the row’s.',
    createProblems: 'As the row stands, the registry would refuse the record for this:',
    sex: 'Sex',
    birthDate: 'Birth date',
    civilStatus: 'Civil status',
    streetAddress: 'Street address',
    purok: 'Purok or sitio',
    keepRow: 'Keep the row’s',
    reason: 'Why',
    reasonHint:
      'Kept with your name and the time. A later decision on this row is added, not written over.',
    reasonMissing: 'Say why first.',
    chooseAction: 'Choose what this row is first.',
    submit: 'Record this decision',
    refused: (reason: string) => `Not recorded: ${reason}`,
  },

  commit: {
    heading: 'Commit the import',
    lead: 'The rows are read again inside the commit, against the records as they stand: a release filed since the check is a duplicate, and is skipped.',
    tally: {
      ready: 'To be filed',
      'needs-review': 'Waiting for a decision',
      skipped: 'Skipped',
      duplicate: 'Already held',
      error: 'Refused',
    } satisfies Record<AssistanceImportGroup, string>,
    blockers: {
      'not-open': 'This import is no longer open.',
      unmapped: 'A required field has no column yet.',
      'needs-review': 'A row still waits for a decision.',
    } satisfies Record<AssistanceImportBlocker, string>,
    effectsLead: 'When you commit:',
    effects: [
      'Each ready row is filed as a closed assistance request on its record, on the dates the file gives — never today’s. A released row also gets a release, of the amount given, or of goods when no amount is given.',
      'A row you said to make a record from becomes a registry record first, created under your name.',
      'Your name stands as the approver and releaser of every imported request, because nobody here approved or handed them over; the request says it was imported.',
      'Skipped rows, rows already held, and rows with problems file nothing.',
      'The file’s cells are then emptied, and the import is recorded in the audit trail under your name. It can later be withdrawn, never deleted.',
    ],
    back: 'Back to the rows',
    submit: 'Commit the import',
    sending: 'Committing…',
    refused: (reason: string) => `Not committed: ${reason}`,
  },

  done: {
    heading: 'Result',
    lead: (when: string, by: string) => `Committed ${when} by ${by}.`,
    tally: {
      imported: 'Imported',
      skipped: 'Skipped',
      duplicates: 'Already held',
      errors: 'Refused',
      residentsCreated: 'Records made',
    },
    outcomes: {
      imported: 'Imported',
      skipped: 'Skipped',
      duplicate: 'Already held',
      error: 'Refused',
    } satisfies Record<AssistanceImportOutcomeKind, string>,
    noOutcome: 'Not recorded',
    caption: 'What became of each row',
    columnRow: 'Row',
    columnLine: 'Line in the file',
    columnOutcome: 'Outcome',
    columnNote: 'Note',
    columnRequest: 'Request',
    open: 'Open',
    none: '—',
    another: 'Import another file',
    requests: 'Open assistance requests',
  },
} as const;
