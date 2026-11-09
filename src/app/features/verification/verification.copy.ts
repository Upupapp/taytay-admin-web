/**
 * Copy for residents' ID verification review (`DL-167`, `DL-23`).
 *
 * Two things every sentence here keeps straight: the images are a government ID and a person's
 * face, and the reason for a rejection is read by the resident. Neither is said after the fact.
 */
export const VERIFICATION_COPY = {
  queue: {
    title: 'ID verification',
    subtitle:
      'Residents who asked, from the residents’ app, to have their account verified against a ' +
      'government ID and a selfie.',
    filterLabel: 'Show',
    filterAll: 'Every request',
    order: 'Newest first, as the server sends them.',
    caption: 'ID verification requests',
    columnSubmitted: 'Sent',
    columnId: 'ID sent',
    columnStatus: 'Status',
    columnAction: 'Review',
    review: 'Review',
    reviewLabel: (submitted: string): string => `Review the request sent ${submitted}`,
    emptyHeading: 'Nothing here',
    emptyPending: 'No request is waiting for review.',
    emptyOther: 'No request has this status.',
    shown: (count: number): string =>
      count === 1 ? 'Showing 1 request.' : `Showing ${count} requests.`,
    moreAvailable: 'More are available.',
    noMore: 'That is all of them.',
    showMore: 'Show more',
    loadingMore: 'Loading more…',
    moreFailed: 'The next requests could not be loaded. The ones above are still correct.',
    drawerHeading: 'Review an ID verification',
    noAccountDetail:
      'Besides the ID and the selfie, the server sends only the name and birth date the account ' +
      'gives, and only while a request is waiting — they appear in the review, not in this list. ' +
      'A review establishes that the selfie shows the person on the ID, that the ID is legible and ' +
      'of the kind stated, and that it shows the name the account gives.',
  },

  review: {
    detailsHeading: 'The request',
    idType: 'ID sent',
    submitted: 'Sent',
    reviewed: 'Decided',
    status: 'Status',
    residentMessage: 'What the resident wrote with their correction',
    reviewNote: 'Note recorded with the decision',
    reviewNoteForResident: 'Reason given to the resident',

    accountHeading: 'What the account says',
    accountIntro:
      'The resident gave these when they made their account. Check them against the ID: ' +
      'approving says the ID shows this name.',
    accountName: 'Name',
    accountBirthDate: 'Birth date',
    noBirthDate:
      'None given. The residents’ app does not ask for one, so only the name is checked.',
    noName:
      'The account gives no name, so there is nothing to check against the ID and this request ' +
      'cannot be approved. Reject it, and ask the resident to add the name printed on their ID.',
    confirmName: (name: string): string => `The ID shows the name “${name}”.`,
    confirmNameAndBirthDate: (name: string, birthDate: string): string =>
      `The ID shows the name “${name}” and the birth date ${birthDate}.`,
    confirmHint:
      'Required to approve. If the ID shows a different name, reject the request and say so. ' +
      'Once approved, the resident cannot change their name or birth date in the app.',

    imagesHeading: 'The images',
    imagesClosed:
      'The ID and the selfie are not loaded until you ask. They are a government ID and a ' +
      'photograph of somebody’s face.',
    openImages: 'Show the ID and the selfie',
    hideImages: 'Hide the images',
    imagesLoading: 'Opening the images…',
    imagesFailed: 'The images could not be opened. Nothing was kept.',
    imagesKept:
      'Shown in this tab only while this review is open. They are discarded when you hide them, ' +
      'close the review or leave the page.',

    warningHeading: 'Before you open these images',
    warning: [
      'You are about to see a resident’s government ID and a photograph of their face.',
      'Open them only to decide this request, and only where nobody else can see your screen.',
      'They are not saved on this computer. Do not copy, download or photograph them.',
    ],
    warningCancel: 'Cancel',
    warningProceed: 'Show them',

    decisionHeading: 'Decide',
    decisionPrompt: 'Approve or reject this request',
    destinationLabel: 'Decision',
    confirm: 'Record the decision',
    notOpened: 'You have not opened the images in this review.',
    approveLabel: 'Note for the office (the resident does not see this)',
    approveHint: 'Required, and kept with the request against your name. Up to 1,000 characters.',
    rejectLabel: 'Reason the resident will read',
    rejectHint:
      'Required. The resident reads exactly these words in the app as what was wrong, so say what ' +
      'to fix. Up to 1,000 characters.',
    alreadyDecided: 'This request has been decided. Nothing further is done here.',
    awaitingResident:
      'The resident may correct this request and send it again from the app. It then returns to ' +
      'the queue; nothing is done here until it does.',

    outcomeApproved: 'Approved. The server marked the account verified.',
    outcomeRejected: 'Rejected. The resident can now read your reason in the app.',
    notRecorded: (why: string): string => `The decision was not recorded. ${why}`,
    failed: 'The server refused it or could not be reached.',
  },
} as const;
