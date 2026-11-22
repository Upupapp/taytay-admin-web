/**
 * Copy for the office inbox (`DL-168`, `DL-23`).
 *
 * Every sentence keeps three things straight: what a resident wrote is theirs and is read by opening
 * it; a reply goes out in the office's name; and an act the server records but cannot explain is
 * said to be exactly that.
 */
export const INBOX_COPY = {
  list: {
    title: 'Office inbox',
    subtitle:
      'Residents writing to an office from the residents’ app, and the office’s replies. Your ' +
      'office’s conversations — or, for an administrator, every office’s.',
    caption: 'Conversations',
    /* The inbox's own figures and status tabs (DL-232). */
    figuresLabel: 'Inbox figures',
    figures: {
      open: { label: 'Open conversations', hint: 'Either side may write.' },
      unread: {
        label: 'Unread by the office',
        hint: 'Conversations with a message nobody here has read.',
      },
      closed: { label: 'Closed', hint: 'Nobody can write in these again.' },
    },
    tabsLabel: 'Status',
    tabAll: 'All',
    tabs: { open: 'Open', closed: 'Closed' },
    order: 'Newest activity first, as the system sends them.',
    noName:
      'The system names each resident only by an account number, so a conversation shows what ' +
      'was written, not who wrote it. What residents wrote is read by opening a conversation; it ' +
      'is not shown in this list.',
    columnSubject: 'Subject',
    columnOffice: 'Office',
    columnLatest: 'Latest message',
    columnUnread: 'Unread by the office',
    columnStatus: 'Status',
    noMessageYet: 'Nothing written yet',
    unread: (count: number): string => (count === 0 ? 'None' : `${count} unread`),
    officesUnnamed:
      'The office directory could not be loaded, so offices are shown by their short code.',
    emptyHeading: 'No conversations',
    emptyMessage: 'No resident has written to this office yet.',
    shown: (count: number): string =>
      count === 1 ? 'Showing 1 conversation.' : `Showing ${count} conversations.`,
    moreAvailable: 'More are available.',
    noMore: 'That is all of them.',
    showMore: 'Show more',
    loadingMore: 'Loading more…',
    moreFailed: 'The next conversations could not be loaded. The ones above are still correct.',
  },

  noOffice: {
    heading: 'Your account is not assigned to an office',
    body: [
      'The office inbox shows the conversations of the office your account belongs to, and the ' +
        'system has no office linked to this account — so there is nothing it will show you, and ' +
        'this is not an empty inbox.',
      'An administrator assigns staff accounts to offices, under Users and roles. Once you are ' +
        'assigned, sign in again to see your office’s conversations.',
    ],
  },

  thread: {
    back: 'Back to the inbox',
    loadingHeading: 'Conversation',
    detailsHeading: 'About this conversation',
    office: 'Office',
    status: 'Status',
    started: 'Started',
    unread: 'Unread by the office',
    resident:
      'Started by a resident in the residents’ app. The system does not name them to this console.',

    markRead: 'Mark as read for the office',
    markingRead: 'Marking…',
    alreadyRead: 'Nothing here is unread by the office.',

    closeOpen: 'Close this conversation',
    closeHeading: 'Close this conversation?',
    closeLead: 'What closing does:',
    closeConfirm: 'Close it',
    closeCancel: 'Keep it open',
    closing: 'Closing…',
    closedNote:
      'This conversation is closed. Nobody can write in it again; if the resident writes to this ' +
      'office, the app starts a new conversation.',

    messagesHeading: 'Messages',
    order: 'Oldest first. Earlier messages load on request.',
    earlier: 'Show earlier messages',
    loadingEarlier: 'Loading earlier messages…',
    earlierFailed: 'Earlier messages could not be loaded. The ones below are still correct.',
    noMessages: 'There are no messages in this conversation.',
    author: {
      resident: 'The resident',
      office: 'The office',
      you: 'You, for the office',
    } as const,

    imagesHeading: (count: number): string =>
      count === 1 ? '1 image attached' : `${count} images attached`,
    imageLabel: (n: number): string => `Image ${n}`,
    imageAlt: (n: number): string => `Image ${n} attached to this message`,
    showImage: (n: number): string => `Show image ${n}`,
    hideImage: (n: number): string => `Hide image ${n}`,
    imageLoading: 'Opening the image…',
    imageFailed: 'The image could not be opened. Nothing was kept.',
    imagesClosed:
      'Images are not loaded until you ask. They were sent by the resident and may show a ' +
      'document, a place or a person.',
    imageKept:
      'Shown in this tab only while this conversation is open. It is discarded when you hide it or ' +
      'leave the page.',

    warningHeading: 'Before you open this image',
    warning: [
      'A resident sent this image to the office. It may show a document, a home or a person, and ' +
        'what it shows is theirs.',
      'Open it only to answer this conversation, and only where nobody else can see your screen.',
      'It is not saved on this computer. Do not copy, download or photograph it.',
    ],
    warningCancel: 'Cancel',
    warningProceed: 'Show it',

    replyHeading: 'Reply',
    replyLabel: 'Your reply to the resident',
    replyHint:
      'The resident reads this in the app as a message from the office. Up to 4,000 characters.',
    replyNoImages:
      'Replies from this console are words only. The system accepts an image with a reply, but ' +
      'this console does not send one yet.',
    replyCount: (used: number, limit: number): string => `${used} of ${limit} characters`,
    send: 'Send the reply',
    sending: 'Sending…',
    replyEmpty: 'Write something before sending.',
    replyTooLong: 'That is longer than the system accepts. Shorten it to 4,000 characters.',

    sent: 'Sent. The resident can read it in the app.',
    markedRead: 'Marked as read for the office.',
    closed: 'Closed. Nobody can write in this conversation again.',
    notDone: (why: string): string => `That was not done. ${why}`,
    failed: 'The system refused it or could not be reached.',
  },
} as const;
