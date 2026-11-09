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
    imageNote:
      'Upload the picture here. The residents’ app shows only a cover stored through the Taytay API, ' +
      'never a link to another site.',
    image: 'Image',
    imageHint: 'Optional. The picture residents see with the event once it is published.',
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
    // Plain words for the safe limit (`DL-195`): what it is, where the number comes from, and
    // that nobody is let in past it — not even by the office.
    safeLimit: 'Safe limit',
    safeLimitHint:
      'Optional. The most people the venue can safely hold — the occupant load posted at the venue — ' +
      'or, for a distribution, the most the stock on hand covers. It must be at least the capacity. ' +
      'The office can still move people past the capacity, with a reason; nobody is let in past the ' +
      'safe limit, by the app or by the office.',
    waitlist: 'Keep a waitlist once it is full',
    eligibilityLegend: 'Who may register',
    eligibilityHint:
      'Most events are for residents whose ID the office has verified. Open one to every app account ' +
      'only if it gives nothing out, such as a clean-up or an orientation.',
    givesOutBenefit: 'This event gives out cash, goods or a benefit',
    givesOutBenefitHint:
      'Tick it if anybody leaves with money, goods, medicine or a service — a starter kit, a food ' +
      'pack. An event that gives something out is for verified residents only.',
    givesOutBenefitFixed:
      'This kind of event always gives something out, so it is for verified residents only.',
    participationNote: 'Who this is for',
    participationHint:
      'Guidance for residents reading the listing. It does not stop anybody registering.',

    remindersHeading: 'Reminders',
    reminders: 'What to bring, and anything else worth saying',

    // What saving does to a chosen cover, said before the button (`DL-193`, as `DL-170` for a banner).
    coverEffectsLead: 'Saving this draft with a cover image:',
    coverEffects: [
      'Stores the image on the server first, then saves the event naming it. If the event is then ' +
        'refused, the image stays stored, unused.',
      'Shows the cover to residents only once the event is published, and after it is completed — ' +
        'never while it is a draft, and not once it is cancelled.',
    ],

    saveDraft: 'Save draft',
    saved: 'Draft saved.',
    saveFailed: 'That could not be saved.',
    problemsHeading: 'Before this can be published',

    // Correcting a published event (`DL-195`).
    correctTitle: 'Correct a published event',
    correctBack: 'Back to the event',
    correctLoading: 'Loading the event…',
    correctUnavailable:
      'This event cannot be corrected: only a published event that has not started can be. A ' +
      'cancelled event that is back on is a new event.',
    correctionHeading: 'The correction',
    correctionNote:
      'Residents have read this event and made plans around it. The correction is kept beside what ' +
      'the event said before, with your reason, and the event’s history lists it.',
    correctionReason: 'Why it is corrected',
    correctionReasonHint:
      'Required. Kept with the correction against your name. Residents are never shown it.',
    tellRegistrants: 'Tell registered residents',
    tellRegistrantsHint:
      'For a change they do not plan around, such as what to bring. A change to when or where it is, ' +
      'who may register, or fewer places always tells them.',
    correctionProblemsHeading: 'Before this can be corrected',
    correctionEffectsLead: 'Saving this correction:',
    correctionNothing: 'Changes nothing yet. Nothing is recorded and nobody is told.',
    correctionChanges: (fields: string) => `Changes ${fields}.`,
    correctionTellsMaterial: (holders: number) =>
      `Tells everybody holding a place or a waitlist place (${holders} by this screen’s last count) ` +
      'in the residents’ app, with the old and the new date, time and venue. Their registrations stand.',
    correctionTellsRequested: (holders: number) =>
      `Tells everybody holding a place or a waitlist place (${holders} by this screen’s last count) ` +
      'in the residents’ app that the details were updated.',
    correctionTellsNobody: 'Sends residents no notice.',
    correctionKept:
      'Keeps what the event said before, and cannot be undone except by another correction.',
    saveCorrection: 'Save the correction',
    corrected: 'Correction saved.',
    correctFailed: 'That correction could not be saved.',
  },

  detail: {
    back: 'Back to events',
    notFoundHeading: 'That event is not available',
    notFoundMessage: 'It may not exist, or your account may not cover events.',

    previewHeading: 'What residents see',
    previewNote: 'A read-only preview of the listing in the resident app.',
    coverShow: 'Show the cover image',
    coverLoading: 'Loading the cover image…',
    coverFailed: 'The cover image could not be loaded.',
    coverHide: 'Hide the cover image',
    coverNotShown:
      'Residents see this cover only while the event is published or completed: not on a draft, and ' +
      'not once it is cancelled or archived.',
    detailsHeading: 'Details',
    whenHeading: 'When',
    whereHeading: 'Where',
    contactHeading: 'Who to ask',
    remindersHeading: 'Reminders',
    participationHeading: 'Who this is for',
    eligibilityHeading: 'Who may register',
    givesOutBenefit: 'Gives out cash, goods or a benefit.',
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
    safeLimit: (limit: number) =>
      `Safe limit: ${limit}. Nobody is let in past it — not by the app, and not by the office.`,

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
    correct: 'Correct this event',
    correctNote:
      'Fix a date, a venue, who may register or anything else before it starts. Residents are told ' +
      'of a change they plan around.',
    duplicate: 'Duplicate',
    keep: 'Keep it',
    saved: 'Saved.',
    failed: 'That could not be saved.',

    registrantsHeading: 'Registrants',
    registrantsNote: 'Residents register in the mobile app. Nobody is added from here.',
    namesNote:
      'Names are in full. For a resident whose ID is verified, the name is the one their account ' +
      'carried when the ID was approved, or one the office corrected since against their ID.',
    notVerified: 'Not ID-verified',
    nameSources: {
      'id-approval': 'Name as it stood when their ID was approved',
      'office-correction': 'Name the office corrected since, against their ID',
      account: 'Name as typed in the app',
    },
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
    promoteAtSafeLimit:
      'Your figures say the safe limit is reached. The backend refuses anybody past it; this goes ' +
      'through only if a place has opened since this screen loaded.',

    // Check-in mode (`DL-195`): one person at a time, never the list.
    checkIn: 'Check-in mode',
    checkInOff: 'Leave check-in mode',
    checkInNote:
      'Finds one registrant by name or reference and never shows the list, so nobody at the table ' +
      'reads the names of everybody else who signed up.',
    checkInSearch: 'Name or reference',
    checkInHint:
      'At least two letters of the name, or the whole reference, such as ER-2026-000123.',
    checkInFind: 'Find',
    checkInNone: 'Nobody registered for this event matches that.',
    checkInMore: 'More than five registrants match. Type more of the name, or the reference.',
    checkInMarked: (reference: string) => `Marked ${reference} as attended.`,
    checkInFailed: 'That lookup could not be completed.',
    cancelRegistration: 'Cancel',
    restoreRegistration: 'Restore',
    registrationReason: 'Why',
    export: 'Export the list',
    exportWarning:
      'The file names residents. It carries its handling rule inside it; keep it in the office ' +
      'and delete it once attendance is recorded.',
    exported: 'Export ready.',
    fileReady:
      'The file is ready. It carries the event, the filter, who produced it and how to handle it.',
    saveFile: (filename: string) => `Save ${filename}`,

    historyHeading: 'What the office did',
    noHistory: 'Nothing recorded for this event in this session.',
  },
} as const;
