/**
 * Copy for residents' document requests (`DL-184`).
 *
 * Every screen says "document requests from residents", never "document requests" alone: the
 * console already uses that phrase for the office asking an applicant for a document inside
 * casework, and an officer who confuses the two answers the wrong person.
 *
 * Two things every sentence keeps straight: whatever the office writes on a request is read by the
 * resident, word for word; and the system tracks the request — it neither collects a fee nor makes
 * the document.
 */
export const ISSUANCE_COPY = {
  queue: {
    title: 'Document requests from residents',
    subtitle:
      'Certificates and other documents residents asked your office for in the residents’ app. ' +
      'Not the documents the office asks applicants for, which are on each assistance request.',
    catalogueLink: 'Document catalogue',
    statusLabel: 'Show',
    statusOpen: 'Every request still being worked',
    statusEndedGroup: 'Ended',
    statusOpenGroup: 'Still being worked',
    typeLabel: 'Document',
    typeAll: 'Every document',
    typesFailed:
      'The catalogue could not be read, so the list cannot be narrowed to one document. Every ' +
      'request is still shown.',
    typesNote:
      'Only documents residents can request now are offered here; a request for a retired one is ' +
      'listed under every document.',
    orderOpen:
      'Oldest waiting first: the request that has been in its status longest leads, whatever its ' +
      'status.',
    orderEnded: 'Newest filed first, as the server sends them.',
    standardNote:
      'The office standard is the catalogue’s figure today, in working days from your Citizen’s ' +
      'Charter. A request keeps the one it was filed with, shown on the request. This console does ' +
      'not count working days, so nothing here is called late.',
    caption: 'Document requests from residents',
    columnReference: 'Reference',
    columnResident: 'Resident',
    columnDocument: 'Document',
    columnStatus: 'Status',
    columnWaiting: 'Waiting',
    columnStandard: 'Office standard',
    columnAction: 'Open',
    open: 'Open',
    openLabel: (reference: string): string => `Open document request ${reference}`,
    noName: 'No name on the account',
    emptyHeading: 'Nothing here',
    emptyOpen: 'No request from a resident is waiting.',
    emptyOther: 'No request has this status.',
    emptyReference:
      'No request has that number in the offices you work for. Check it with the resident: another ' +
      'office’s request is not found here.',
    findLabel: 'Find a request by its reference number',
    referenceLabel: 'Reference number',
    referenceHint: 'The whole number the resident quotes, such as DR-2026-000123.',
    find: 'Find',
    referenceShown: (reference: string): string =>
      `Showing the request numbered ${reference}, whatever its status. The other filters do not ` +
      'apply while a number is looked up.',
    backToQueue: 'Back to the queue',
    residentShown: 'Showing one resident’s requests.',
    everyResident: 'Show every resident’s',
    shownAll: (count: number): string =>
      count === 1 ? 'Showing 1 request — all of them.' : `Showing all ${count} requests.`,
    shown: (count: number): string =>
      count === 1 ? 'Showing 1 request.' : `Showing ${count} requests.`,
    moreAvailable: 'More are available.',
    noMore: 'That is all of them.',
    showMore: 'Show more',
    loadingMore: 'Loading more…',
    moreFailed: 'The next requests could not be loaded. The ones above are still correct.',
  },

  request: {
    titleFallback: 'Document request from a resident',
    back: 'Back to document requests from residents',
    notFound:
      'No document request with that ID that you can open: it does not exist, or it belongs to ' +
      'another office.',
    detailsHeading: 'The request',
    reference: 'Reference',
    resident: 'Resident',
    residentNote:
      'The resident’s app account, verified against a government ID. Not a record in the office’s ' +
      'resident registry.',
    residentRequests: 'This resident’s other requests',
    noName: 'No name on the account',
    document: 'Document',
    office: 'Issuing office',
    status: 'Status',
    filed: 'Filed',
    waiting: 'Waiting',
    purpose: 'Purpose, in the resident’s words',
    purposeNote: 'Read here only. It is never put on a list, in a notification or in a log.',
    fee: 'Fee, paid at the office',
    noFee: 'No fee stated by the office',
    standard: 'Office standard when filed',
    claimInstructions: 'Claim instructions when filed',
    claimDetails: 'Claim details given to the resident',
    snapshotNote:
      'The document’s name, requirements, fee and working days are as they were when the resident ' +
      'filed. A later change to the catalogue does not alter them.',

    requirementsHeading: 'What the resident sent',
    required: 'Required',
    optional: 'Optional',
    nothingSent: 'Nothing sent for this.',
    filesClosed:
      'Files are not opened until you ask. Each holds personal information about a resident, and ' +
      'opening one is recorded against your account.',
    version: (n: number): string => `Version ${n}`,
    replaced: 'Replaced by a later version; kept as sent',
    currentVersion: 'Current version',
    sent: 'Sent',
    kind: (mimeType: string): string =>
      mimeType === 'application/pdf'
        ? 'PDF'
        : mimeType === 'image/png'
          ? 'PNG image'
          : 'JPEG image',
    size: (bytes: number): string =>
      bytes < 1024 * 1024
        ? `${Math.max(1, Math.round(bytes / 1024))} KB`
        : `${(bytes / (1024 * 1024)).toFixed(1)} MB`,
    show: 'Show',
    showLabel: (label: string, version: number): string => `Show ${label}, version ${version}`,
    asking: 'Asking the server for permission…',
    otherFiles: 'Files for requirements no longer on the document',

    historyHeading: 'History',
    historyNote: 'Every move, oldest first. Nothing in it is changed or removed.',
    filedLine: 'Filed the request',
    byResident: 'The resident',
    byOffice: 'The office',
    byYou: 'You',
    account: 'Account',
    reasonForResident: 'Words the resident read',
    residentWords: 'The resident wrote',
    claimForResident: 'Claim details',

    movesHeading: 'Move the request on',
    movesPrompt: 'What the office does next',
    destination: 'Move to',
    confirm: 'Record and tell the resident',
    reasonLabel: 'Words for the resident',
    reasonHint:
      'The resident reads this in the app, word for word. Write it for them — 8 to 1,000 ' +
      'characters.',
    claimLabel: 'When and where to claim it',
    claimHint:
      'Read by the resident in the app: the place, the days and hours, and what to bring. 8 to 500 ' +
      'characters.',
    waitingOnResident:
      'Waiting for the resident: the request returns to review only when they send what was ' +
      'asked, and they may cancel it instead.',
    ended: 'This request has ended. Nothing moves it on.',
    moved: (label: string): string => `Recorded: the request is now ${label.toLowerCase()}.`,
    notMoved: (why: string): string => `Not recorded. ${why}`,
    failed: 'The server did not record the move.',

    warningHeading: 'Open a file a resident sent',
    warningLead: 'The server’s warning for this file:',
    warningCancel: 'Do not open it',
    warningProceed: 'Open it',
    fetching: 'Opening…',
    grantFailed: 'The server did not give permission to open that file. Nothing was opened.',
    fileFailed: 'The file could not be opened. Nothing was kept.',
    fileKept:
      'Shown in this tab only while this window is open. It is discarded when you close it or ' +
      'leave the page.',
    imageAlt: (label: string, version: number): string => `${label}, version ${version}`,
    pdfReady: 'The PDF is ready.',
    pdfOpen: 'Open the PDF in a new tab',
    close: 'Close and discard',
  },

  catalogue: {
    title: 'Document catalogue',
    subtitle:
      'The documents your office issues to residents through the app, with what each asks for, ' +
      'its fee and its working days.',
    back: 'Back to document requests from residents',
    add: 'Add a document',
    caption: 'Documents residents can request',
    columnName: 'Document',
    columnOffice: 'Office',
    columnFee: 'Fee',
    columnStandard: 'Office standard',
    columnRequirements: 'Asks for',
    columnStatus: 'Status',
    columnAction: 'Act',
    active: 'Offered',
    retired: 'Retired',
    retiredOn: (date: string): string => `Retired ${date}`,
    noFee: 'Not stated',
    requirementCount: (count: number): string =>
      count === 0 ? 'Nothing' : count === 1 ? '1 thing' : `${count} things`,
    edit: 'Edit',
    editLabel: (name: string): string => `Edit ${name}`,
    retire: 'Retire',
    retireLabel: (name: string): string => `Retire ${name}`,
    emptyHeading: 'No documents yet',
    emptyMessage: 'Your office offers no document to residents yet.',

    drawerNew: 'Add a document',
    drawerEdit: (name: string): string => `Edit ${name}`,
    office: 'Office',
    ownOffice: 'My own office (staff)',
    officeHint:
      'An administrator chooses the office; staff add documents for their own office only.',
    officesFailed: 'The offices could not be read; staff can still add documents for their own.',
    name: 'Name',
    nameHint: 'As residents will see it, 3 to 120 characters.',
    description: 'What it is for',
    descriptionHint: 'Optional. Up to 2,000 characters.',
    fee: 'Fee in pesos',
    feeHint:
      'Paid at the office — nothing is collected online. Leave empty if the office states no fee; ' +
      'type 0 for no fee.',
    feeReads: 'Will be shown to residents as',
    feeNone: 'Will be shown to residents as no fee stated.',
    feeInvalid: 'Type an amount in pesos, like 50 or 1,250.50 — at most two decimal places.',
    days: 'Working days',
    daysHint:
      'From your Citizen’s Charter: 0 for the same day, up to 365. Leave empty if not stated.',
    daysInvalid: 'Type a whole number of working days from 0 to 365.',
    claimInstructions: 'Claim instructions',
    claimInstructionsHint:
      'Optional: where and when a resident collects it. Up to 1,000 characters.',
    requirementsHeading: 'What a resident sends',
    requirementsHint:
      'In the order residents are asked, at most 10. Each is one file — PDF, JPEG or PNG, up to ' +
      '10 MB — sent from the app.',
    requirementLegend: (n: number): string => `Requirement ${n}`,
    label: 'Label',
    code: 'Code',
    codeHint:
      'Lowercase letters or digits joined by - or _. It names the file in the app; requests already ' +
      'filed keep theirs.',
    hint: 'Hint for the resident',
    requiredCheck: 'Required',
    moveUp: 'Move up',
    moveDown: 'Move down',
    remove: 'Remove',
    moveUpLabel: (n: number): string => `Move requirement ${n} up`,
    moveDownLabel: (n: number): string => `Move requirement ${n} down`,
    removeLabel: (n: number): string => `Remove requirement ${n}`,
    addRequirement: 'Add a requirement',
    reason: 'Why',
    reasonHint: 'Kept with the change, 8 to 500 characters. Not shown to residents.',
    effectsLead: 'What saving does:',
    createEffects: [
      'Residents can choose this document in the app straight away.',
      'Your reason is kept with the new entry.',
    ],
    save: 'Save the document',
    saving: 'Saving…',
    unchanged: 'Nothing has changed, so there is nothing to save.',
    saved: 'Saved.',
    notSaved: (why: string): string => `Not saved. ${why}`,
    failed: 'The server did not save it.',
    cancel: 'Cancel',

    retireHeading: (name: string): string => `Retire ${name}`,
    retireLead: 'What retiring does, before you decide:',
    retireReason: 'Why it is retired',
    retireConfirm: 'Retire it — this cannot be undone',
    retiredOutcome: (name: string): string => `${name} is retired.`,
  },
} as const;
