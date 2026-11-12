import {
  IMPORT_FILE_LIMITS,
  type ImportAction,
  type ImportGroup,
  type ImportOutcomeKind,
  type ResidentImportStatus,
} from '@domain/index';

const MB = IMPORT_FILE_LIMITS.maxBytes / (1024 * 1024);

/** Every sentence the import wizard says (`DL-214`). */
export const RESIDENT_IMPORT_COPY = {
  title: 'Import citizens',
  subtitle:
    'Bring in a list the office keeps — a barangay census, an OSCA, PDAO or solo parent list. You check every row before the registry changes.',
  cancel: 'Back to the registry',
  noAnswer: 'the server gave no reason.',
  retry: 'Try again',

  steps: ['Upload', 'Match columns', 'Check rows', 'Confirm', 'Done'] as const,
  stepsLabel: 'Steps of the import',
  stepOf: (step: number) => `Step ${step} of 5`,

  upload: {
    heading: 'Upload the file',
    limits: `A .csv (comma or semicolon, UTF-8) or the first sheet of an .xlsx; at most ${MB} MB, ${IMPORT_FILE_LIMITS.maxRows.toLocaleString('en-US')} rows and ${IMPORT_FILE_LIMITS.maxColumns} columns. The first row must be the column names. Formulas are not worked out.`,
    label: 'The file',
    hint: 'Choosing a file sends nothing: the upload is its own button below.',
    chosen: (name: string, size: string) => `${name} · ${size}`,
    tooBig: `That file is larger than ${MB} MB, so it was not sent.`,
    wrongKind: 'Only a .csv or .xlsx file can be imported. Nothing was sent.',
    none: 'Choose a file first.',
    effectsLead: 'What uploading does:',
    effects: [
      'Nothing is written to the registry. The rows are held for checking, under a matching of columns guessed from the first row, which you confirm next.',
      'The upload is recorded in the audit trail under your name.',
      'Once the import is confirmed, the file’s cells are emptied: what was recorded is in the registry, and the rest of the file is not the office’s to keep.',
    ],
    submit: 'Upload and check',
    sending: 'Uploading…',
    refused: (reason: string) => `Not uploaded: ${reason}`,
  },

  recent: {
    heading: 'Recent imports',
    caption: 'Imports, newest first',
    columnFile: 'File',
    columnBy: 'Uploaded by',
    columnRows: 'Rows',
    columnStatus: 'Status',
    columnResult: 'What became of the rows',
    columnAction: 'Action',
    unknownPerson: 'Not named',
    result: (created: number, attached: number, skipped: number, errors: number) =>
      `${created} added, ${attached} attached, ${skipped} skipped, ${errors} refused`,
    pending: 'Not confirmed yet',
    continue: 'Continue',
    view: 'View',
    openLabel: (file: string) => `Open the import of ${file}`,
    emptyHeading: 'No imports yet',
    emptyMessage: 'Upload a file above to start the first one.',
    shown: (count: number) => `${count} shown.`,
    moreAvailable: 'More are available.',
    noMore: 'That is every import.',
    showMore: 'Show more',
  },

  status: {
    open: 'Being checked',
    committed: 'Confirmed',
  } satisfies Record<ResidentImportStatus, string>,

  record: {
    errorHeading: 'The import could not be read',
    notFound: 'That import was not found. It may belong to an office you cannot see.',
    file: (name: string, rows: number) => `${name} · ${rows} ${rows === 1 ? 'row' : 'rows'}`,
  },

  map: {
    heading: 'Match the file’s columns to the registry',
    lead: 'The API guessed these from the first row. Each registry field takes one column at most; a field left empty is not filled from this file.',
    field: 'Registry field',
    column: 'Column in the file',
    required: 'Required',
    notInFile: 'Not in this file',
    columnOption: (header: string, samples: string) =>
      samples === '' ? header : `${header} — e.g. ${samples}`,
    missing: (labels: string) => `Still to match before the import can be confirmed: ${labels}.`,
    allMatched: 'Every required field has a column.',
    locked:
      'The columns can no longer be changed: rows have been resolved under this matching, and a new one would change what was decided about them.',
    effects: [
      'Saving reads every row again under the new matching, and groups them again.',
      'Recorded in the audit trail under your name.',
    ],
    save: 'Save the matching',
    saving: 'Saving…',
    saved: 'Saved. The rows were read again.',
    next: 'Next: check the rows',
    taken: (label: string) => `That column already feeds ${label}. Choose one field for it.`,
  },

  check: {
    heading: 'Check the rows before anything is saved',
    lead: 'The grouping is advice, read by the API: a match is a name and birth date already on the registry, not a finding that it is the same person. You decide each one.',
    tabsLabel: 'Rows by group',
    groups: {
      new: 'New',
      match: 'Matches the registry',
      duplicate: 'Repeated in the file',
      error: 'Problems',
    } satisfies Record<ImportGroup, string>,
    notes: {
      new: 'Not on the registry by name and birth date. Each becomes a new record when you confirm.',
      match:
        'The registry already holds somebody with this name and birth date. Say whether the row is that person, a different one, or not to be imported.',
      duplicate:
        'The same name and birth date as an earlier row of this file. Say whether it is a different person or not to be imported.',
      error:
        'These rows cannot become records as they are. They are refused when you confirm; fix the file and import them again.',
    } satisfies Record<ImportGroup, string>,
    unresolved: (count: number) =>
      count === 0
        ? 'Every match and repeat has been decided.'
        : `${count} ${count === 1 ? 'row is' : 'rows are'} still to decide.`,
    none: 'No rows in this group.',
    rowLabel: (row: number, line: number) => `Row ${row} (line ${line} of the file)`,
    noValues: 'The cells are no longer held.',
    repeats: (row: number) => `Repeats row ${row} of this file.`,
    candidatesHeading: 'On the registry',
    inactive: 'Retired record',
    open: 'Open the record',
    decided: (action: string, by: string, reason: string) => `${action}, by ${by}: “${reason}”`,
    decidedBy: 'somebody not named',
    change: 'Decide again',
    columns: { name: 'Name', birthDate: 'Birth date', sex: 'Sex', barangay: 'Barangay' },
    next: 'Next: confirm',
    back: 'Back to the columns',
  },

  finding: {
    legend: 'What is this row?',
    actions: {
      create: 'A different person — add a new record',
      'same-person': 'The same person as',
      skip: 'Do not import this row',
    } satisfies Record<ImportAction, string>,
    hints: {
      create: 'A new record is created when you confirm.',
      'same-person':
        'The row is attached to that record when you confirm. Nothing on the record is written over or deleted.',
      skip: 'Nothing is written for this row.',
    } satisfies Record<ImportAction, string>,
    reason: 'Why',
    reasonHint: 'Kept with your name and the time. A later decision on this row is added, not written over.',
    reasonMissing: 'Say why first.',
    chooseRecord: 'Choose which record first.',
    submit: 'Record this decision',
    saving: 'Recording…',
    refused: (reason: string) => `Not recorded: ${reason}`,
    recorded: 'Recorded.',
  },

  confirm: {
    heading: 'Confirm the import',
    lead: 'The rows are read again against the registry as it stands now: a record added since the check becomes a new match, and the confirmation is refused until it is decided.',
    tally: {
      new: 'New records',
      match: 'Matches decided',
      duplicate: 'Repeats decided',
      error: 'Rows refused',
    } satisfies Record<ImportGroup, string>,
    blockers: {
      unmapped: 'A required field has no column yet.',
      unresolved: 'A match or a repeat is still to decide.',
      committed: 'This import is already confirmed.',
    },
    effectsLead: 'When you confirm:',
    effects: [
      'Each new row, and each row you said is a different person, becomes a registry record, created under your name.',
      'Each row you said is the same person is attached to that record. Nothing on it is written over or deleted.',
      'Skipped rows and rows with problems write nothing.',
      'The file’s cells are then emptied, and the import is recorded in the audit trail under your name. It cannot be undone from here.',
    ],
    submit: 'Confirm the import',
    sending: 'Confirming…',
    refused: (reason: string) => `Not confirmed: ${reason}`,
  },

  done: {
    heading: 'Imported',
    lead: (when: string, by: string) => `Confirmed ${when} by ${by}.`,
    tally: {
      created: 'Added',
      attached: 'Attached to an existing record',
      skipped: 'Skipped',
      error: 'Refused',
    } satisfies Record<ImportOutcomeKind, string>,
    caption: 'What became of each row',
    columnRow: 'Row',
    columnLine: 'Line in the file',
    columnOutcome: 'Outcome',
    columnRecord: 'Record',
    open: 'Open',
    noRecord: '—',
    another: 'Import another file',
    registry: 'Open the registry',
  },
} as const;
