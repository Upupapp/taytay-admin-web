/**
 * Screen wording for the events console.
 *
 * Three sentences are load-bearing, and each of them is the office being told
 * something the software cannot enforce:
 *
 *  - **the count is a snapshot** — residents are registering while this screen
 *    is open, and the backend decides who gets the last place (`DL-129`);
 *  - **completing an event does not sweep the unmarked** into no-shows, which
 *    is why "not checked in" is worded as an absence of a record rather than
 *    an absence of a person (`DL-131`);
 *  - **cancelling reaches everybody and cannot be undone**, unlike cancelling
 *    one person's place.
 */
export const EVENTS_COPY = {
  list: {
    title: 'Events',
    subtitle: 'Municipal activities, registrations and attendance.',
    compose: 'Create an event',

    search: 'Search',
    searchPlaceholder: 'Title, summary or venue',
    category: 'Category',
    allCategories: 'Any category',
    from: 'From',
    to: 'To',
    clear: 'Clear filters',

    when: 'When',
    venue: 'Venue',
    registration: 'Registration',
    registered: 'Registered',
    noCapacity: 'no limit',
    createdBy: 'Created by',
    updated: 'Updated',
    open: 'Open',
    noAltText: 'Event cover image',

    emptyHeading: 'No events yet',
    emptyMessage: 'Events you create appear here as drafts until they are published.',
    noResultsHeading: 'No events match those filters',
    noResultsMessage: 'Try a wider category or date range, or clear the filters.',
  },

  composer: {
    title: 'Create an event',
    editTitle: 'Edit event',
    back: 'Back to events',

    aboutHeading: 'What it is',
    eventTitle: 'Event title',
    summary: 'One-line summary',
    summaryHint: 'What residents see in the list before they open it.',
    details: 'Full details',
    detailsHint: 'What to expect, who is running it, and how the day works.',
    category: 'Category',

    imageHeading: 'Cover image',
    imageUrl: 'Image',
    altText: 'Describe the image',
    altTextHint:
      'Required before publishing. A resident using a screen reader gets nothing from a poster ' +
      'with no description.',

    whenHeading: 'When',
    startsAt: 'Starts',
    endsAt: 'Ends',
    timezoneHint: 'All times are Philippine Standard Time (Asia/Manila).',

    whereHeading: 'Where',
    venueName: 'Venue name',
    barangay: 'Barangay',
    address: 'Complete address',
    addressHint: 'Findable by somebody who has never been. "Covered court" is not enough.',
    mapUrl: 'Map link',
    mapUrlHint: 'Optional. Must start with http:// or https://.',

    contactHeading: 'Who to ask',
    contactName: 'Contact person',
    contactOffice: 'Office',
    contactPhone: 'Phone',

    registrationHeading: 'Registration',
    registrationRequired: 'Residents need to register for this',
    registrationHint:
      'Residents register in the mobile app. Nobody is registered from this console — the office ' +
      'manages what arrives.',
    opensAt: 'Registration opens',
    closesAt: 'Registration closes',
    capacity: 'Capacity',
    capacityHint: 'Leave blank if there is no limit.',
    waitlist: 'Keep a waitlist once it is full',
    participationNote: 'Who this is for',
    participationHint:
      'Guidance for residents reading the listing. It does not stop anybody registering.',

    remindersHeading: 'Reminders',
    reminders: 'What to bring, and anything else worth saying',

    saveDraft: 'Save draft',
    saved: 'Draft saved.',
    saveFailed: 'That could not be saved.',
    problemsHeading: 'Before this can be published',
  },

  detail: {
    back: 'Back to events',
    notFoundHeading: 'That event is not available',
    notFoundMessage: 'It may not exist, or your account may not cover events.',

    previewHeading: 'What residents see',
    previewNote: 'A read-only preview of the listing in the resident app.',
    detailsHeading: 'Details',
    whenHeading: 'When',
    whereHeading: 'Where',
    contactHeading: 'Who to ask',
    remindersHeading: 'Reminders',
    participationHeading: 'Who this is for',
    mapLink: 'Open the map',

    metaHeading: 'Publication',
    publishedOn: 'Published',
    lastUpdated: 'Last updated',
    cancelledOn: 'Cancelled',
    cancellationReason: 'Why it was cancelled',
    replaces: 'This replaces a cancelled event',

    capacityHeading: 'Registration',
    registration: 'Registration',
    remaining: 'Places left',
    deadline: 'Registration closes',
    asOf: 'Counted at',
    // The sentence the whole capacity design exists to make true (`DL-129`).
    snapshotNote:
      'These numbers were true when this screen last asked. Residents are registering in the app ' +
      'while you read them, and the system of record decides who gets the last place.',
    attendanceHeading: 'Attendance',
    attendanceOpenNote:
      'Attendance is still open. Anybody not marked is simply not marked — it does not mean they ' +
      'did not come.',
    attendanceFinalNote: 'Attendance is final for this event.',

    actionsHeading: 'Actions',
    reason: 'Why',
    reasonHint: 'Recorded in the trail against your name. Required.',
    publish: 'Publish',
    publishWarning:
      'Publishing puts this in the resident app and opens registration on the dates you set. ' +
      'People will make plans around it.',
    cancelEvent: 'Cancel event',
    cancelWarning:
      'Cancelling tells everybody registered that it is off, and it cannot be undone. If the ' +
      'event goes ahead later it is a new event.',
    cancelConfirmHeading: 'Cancel this event?',
    cancelConfirmBody:
      'Everybody registered is told it is off. This cannot be reversed — an event that is back ' +
      'on is created fresh, naming this one.',
    cancelConfirm: 'Cancel the event',
    complete: 'Mark completed',
    completeWarning:
      'This declares attendance final. Anybody still unmarked stays unmarked — nobody is turned ' +
      'into a no-show by this.',
    archive: 'Archive',
    duplicate: 'Duplicate',
    keep: 'Keep it',
    saved: 'Saved.',
    failed: 'That could not be saved.',

    registrantsHeading: 'Registrants',
    registrantsNote: 'Residents register in the mobile app. Nobody is added from here.',
    registrantSearch: 'Search registrants',
    status: 'Status',
    attendance: 'Attendance',
    anyStatus: 'Any status',
    anyAttendance: 'Any attendance',
    reference: 'Reference',
    name: 'Name',
    barangay: 'Barangay',
    registeredOn: 'Registered',
    notes: 'Notes',
    noRegistrants: 'Nobody has registered yet.',
    noMatchingRegistrants: 'No registrants match those filters.',
    markAttended: 'Attended',
    markNoShow: 'No-show',
    markUnmarked: 'Clear',
    promote: 'Move to registered',
    promoteOverCapacity:
      'Your figures say this event is full. The backend decides — if a place has opened since ' +
      'this screen loaded, this will go through.',
    cancelRegistration: 'Cancel',
    restoreRegistration: 'Restore',
    registrationReason: 'Why',
    export: 'Export the list',
    exportWarning:
      'The file names residents. It carries its handling rule inside it; keep it in the office ' +
      'and delete it once attendance is recorded.',
    exported: 'Exported.',

    historyHeading: 'What the office did',
    noHistory: 'Nothing recorded for this event in this session.',
  },
} as const;
