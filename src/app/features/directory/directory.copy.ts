/**
 * Every sentence the residents' app directory says (`DL-170`). The consequences of an act are not
 * here: they are the domain's (`OFFICE_EFFECTS`, `SERVICE_EFFECTS`, `HOTLINE_EFFECTS`), read from
 * the backend, so two screens cannot say one act does two different things.
 */
export const DIRECTORY_COPY = {
  page: {
    title: 'App directory',
    subtitle:
      'Residents see this in the Taytay app: the offices they can find, the Tulong pages that tell ' +
      'them about a service, and the numbers they can call. A change here reaches every resident ' +
      'the next time the app loads.',
    sectionsLabel: 'Directory sections',
    noSection: 'Your account holds none of the keys for this directory.',
    sections: {
      offices: 'Offices',
      services: 'Tulong pages',
      hotlines: 'Hotlines',
    },
  },

  list: {
    shown: (count: number, noun: string) => `Showing ${count} ${noun}.`,
    moreAvailable: 'More are available.',
    noMore: 'That is all of them.',
    showMore: 'Show more',
    loadingMore: 'Loading more…',
    moreFailed: 'The next page could not be loaded. Try again.',
    edit: 'Edit',
    remove: 'Delete',
    cancel: 'Keep it',
    effectsLead: 'What this does:',
    notDone: (reason: string) => `Not done. ${reason}`,
    failed: 'The server did not answer.',
    order: 'Newest first, as the server sends them.',
  },

  offices: {
    heading: 'Offices',
    lead:
      'The offices residents find in the app’s directory. An office named by a staff account, a ' +
      'Balita article, a Tulong page or a conversation cannot be deleted until those are moved.',
    add: 'Add an office',
    caption: 'Offices in the app’s directory',
    noun: 'offices',
    columnName: 'Office',
    columnAddress: 'Address in the app',
    columnCategory: 'Category',
    columnBanner: 'Banner',
    columnActions: 'Actions',
    hasBanner: 'Has a banner',
    noBanner: 'No banner',
    noCategory: 'None given',
    emptyHeading: 'No offices yet',
    emptyMessage: 'The app’s directory lists no office. Add one for residents to find.',
    editLabel: (name: string) => `Edit ${name}`,
    removeLabel: (name: string) => `Delete ${name}`,
    createHeading: 'Add an office',
    editHeading: 'Edit office',
    removeHeading: (name: string) => `Delete ${name}?`,
    removeConfirm: (name: string) => `Delete ${name}`,
    removed: (name: string) => `${name} was deleted from the app’s directory.`,
    created: (name: string) => `${name} was added to the app’s directory.`,
    saved: (name: string) => `${name} was saved.`,
  },

  officeForm: {
    name: 'Name',
    slug: 'Address in the app',
    slugHint:
      'Lower-case words joined by hyphens. The app opens the office’s page at offices/ and this.',
    shortName: 'Short name',
    shortNameHint: 'A label such as MSWDO. Optional.',
    shortNameKept:
      'A short name can be replaced here but not cleared: the change travels as a form, which cannot say “none”.',
    category: 'Category',
    description: 'Description',
    head: 'Head of office',
    hours: 'Office hours',
    phone: 'Phone',
    email: 'Email',
    address: 'Street address',
    latitude: 'Latitude',
    longitude: 'Longitude',
    position: 'Map position',
    positionHint: 'Decimal degrees, such as 14.5574 and 121.1323. Leave both empty for no pin.',
    optional: 'Optional.',
    banner: 'Banner',
    bannerHint: 'Shown across the top of the office’s page in the app.',
    bannerCurrent: 'This office has a banner. Choosing an image replaces it.',
    bannerNone: 'This office has no banner.',
    fixedHeading: 'Set when the office was created',
    fixedLead: (fields: string) =>
      `The API’s published contract declares no way to change an office’s ${fields}, so they are shown here and cannot be edited.`,
    notGiven: 'Not given',
    unchanged: 'Nothing has changed yet.',
    create: 'Add the office',
    save: 'Save changes',
    saving: 'Saving…',
    problemsLead: 'Not sent — the app would refuse it:',
  },

  services: {
    heading: 'Tulong pages',
    lead:
      'What the app tells residents about a service — what it is, who it is for, what to bring and ' +
      'whom to call. A Tulong page is information only: residents read it, and cannot apply ' +
      'through it. It is not one of the office’s assistance programmes.',
    hiddenNote:
      'A page hidden from the catalogue is not listed here unless it is featured, because the API ' +
      'lists only what residents can browse. Open one by its address below.',
    add: 'Add a page',
    caption: 'Tulong pages in the app’s catalogue',
    noun: 'pages',
    columnName: 'Page',
    columnListing: 'Catalogue',
    columnHome: 'Home screen',
    columnOffice: 'Office',
    columnActions: 'Actions',
    featured: 'Featured',
    notFeatured: 'Not featured',
    noOffice: 'No office',
    emptyHeading: 'No Tulong pages in the catalogue',
    emptyMessage:
      'The app’s catalogue lists no page. A hidden page can still be opened by its address.',
    findHeading: 'Open a page by its address',
    findLabel: 'Address',
    findHint: 'The part after services/ — such as senior-citizen-id. Finds hidden pages too.',
    find: 'Open',
    finding: 'Looking…',
    notFound: (slug: string) => `There is no Tulong page at the address ${slug}.`,
    findFailed: 'The page could not be looked up. Try again.',
    editLabel: (name: string) => `Edit ${name}`,
    removeLabel: (name: string) => `Delete ${name}`,
    createHeading: 'Add a Tulong page',
    editHeading: 'Edit Tulong page',
    removeHeading: (name: string) => `Delete ${name}?`,
    removeConfirm: (name: string) => `Delete ${name}`,
    removed: (name: string) => `${name} was deleted from the app.`,
    created: (name: string) => `${name} was added. Add its picture or feature it below.`,
    saved: (name: string) => `${name} was saved.`,
    imageSaved: (name: string) => `The picture for ${name} was saved.`,
    officesUnnamed:
      'The office directory could not be read, so offices show by their identifier and none can be chosen.',
  },

  serviceForm: {
    name: 'Name',
    slug: 'Address in the app',
    slugHint: 'Lower-case words joined by hyphens. The app opens the page at services/ and this.',
    category: 'Category',
    summary: 'Summary',
    summaryHint: 'One or two sentences, shown on the page’s tile.',
    details: 'Details',
    eligibility: 'Who it is for',
    eligibilityHint: 'In words a resident reads. Nothing in the app or this console evaluates it.',
    requirements: 'What to bring',
    claimSteps: 'Steps to claim',
    linesHint: 'One per line.',
    contacts: 'Contacts',
    contactType: 'Kind',
    contactLabel: 'Label',
    contactValue: 'Number or address',
    addContact: 'Add a contact',
    removeContact: (index: number) => `Remove contact ${index}`,
    locations: 'Places',
    locationName: 'Place',
    locationAddress: 'Address',
    addLocation: 'Add a place',
    removeLocation: (index: number) => `Remove place ${index}`,
    office: 'Office',
    officeNone: 'No office',
    schedule: 'Schedule',
    legalBasis: 'Legal basis',
    badge: 'Badge',
    badgeHint: 'A short label on the tile, such as New. Optional.',
    iconKey: 'Icon name',
    iconKeyHint: 'The name of an icon the app knows. Optional.',
    tileColor: 'Tile colour',
    tileColorHint: 'Written #RGB or #RRGGBB. Optional.',
    hidden: 'Hide from the app’s catalogue',
    featured: 'Feature on the app’s home screen',
    featuredHeadline: 'Headline on the home screen',
    optional: 'Optional.',
    fixedHeading: 'Set when the page was created',
    fixedLead: (fields: string) =>
      `The API’s published contract declares no way to change a page’s ${fields}, so they are shown here and cannot be edited.`,
    notGiven: 'Not given',
    imageHeading: 'Picture',
    image: 'Picture for the page',
    imageHint: 'Shown at the top of the page in the app.',
    imageCurrent: 'This page has a picture. Uploading one replaces it at once.',
    imageNone: 'This page has no picture.',
    imageAfterCreate: 'Add a picture once the page exists.',
    uploadImage: 'Upload the picture',
    uploading: 'Uploading…',
    unchanged: 'Nothing has changed yet.',
    create: 'Add the page',
    save: 'Save changes',
    saving: 'Saving…',
    problemsLead: 'Not sent — the app would refuse it:',
  },

  hotlines: {
    heading: 'Hotlines',
    lead:
      'The numbers residents can call from the app’s hotline list and home screen. The app lists ' +
      'active lines by order, lowest first, then by name.',
    add: 'Add a hotline',
    caption: 'Hotlines in the app',
    columnName: 'Line',
    columnNumber: 'Number',
    columnCategory: 'Category',
    columnKind: 'Kind',
    columnOrder: 'Order',
    columnShown: 'In the app',
    columnActions: 'Actions',
    emptyHeading: 'No hotlines',
    emptyMessage: 'The app lists no number for residents to call. Add one.',
    /** DL-217: after the API's backfill no line is the command center until the office marks one. */
    noCommandCenterTitle: 'No line is marked as the command center.',
    noCommandCenter:
      'The app has no line of the office’s own to show when it tells residents to call for an ' +
      'emergency. Edit the line that should be it, and set its kind to Command center.',
    /** DL-220: a line the server sent with no kind — an API older than kinds — is not set. */
    kindsNotSet: (count: number) =>
      count === 1
        ? '1 line has no type set: the server did not say what it is for. Edit it and choose its kind.'
        : `${count} lines have no type set: the server did not say what they are for. Edit each and choose its kind.`,
    commandCenterIs: (name: string, number: string) =>
      `The command center is ${name}, ${number}: the line the app shows when it tells residents to ` +
      'call for an emergency.',
    count: (count: number) => `${count} ${count === 1 ? 'line' : 'lines'}, shown and hidden.`,
    capped: (cap: number) =>
      `This is ${cap} lines — the most the API sends, to this screen and to the app alike. There may be more that neither shows.`,
    editLabel: (name: string) => `Edit ${name}`,
    removeLabel: (name: string) => `Delete ${name}`,
    createHeading: 'Add a hotline',
    editHeading: 'Edit hotline',
    removeHeading: (name: string) => `Delete ${name}?`,
    removeConfirm: (name: string) => `Delete ${name}`,
    removed: (name: string) => `${name} was deleted.`,
    created: (name: string) => `${name} was added.`,
    saved: (name: string) => `${name} was saved.`,
  },

  hotlineForm: {
    name: 'Name',
    number: 'Number',
    numberHint: 'As a resident dials it, such as (02) 8123 4567. Check every digit.',
    numberWas: (number: string) => `Currently ${number}.`,
    kind: 'Kind',
    kindHint:
      'What the line is for. The app picks a line by its kind, never by its name. Command center ' +
      'is the one line the app shows when it tells residents to call for an emergency; only one ' +
      'active line can be it.',
    /** The select's first option while an existing line's type is not set (`DL-220`). */
    kindNotSet: 'Type not set — choose one',
    kindTakenLead: 'Before you save:',
    kindRefused: (message: string) =>
      `${message} Change the line that is the command center first — another kind, or inactive — ` +
      'then this one.',
    category: 'Category',
    categoryHint: 'Shown with the line in the app, such as Emergency or Health.',
    sortOrder: 'Order',
    sortOrderHint: 'A whole number from 0 to 1000; lower comes first in the app.',
    active: 'Show in the app',
    unchanged: 'Nothing has changed yet.',
    create: 'Add the hotline',
    save: 'Save changes',
    saving: 'Saving…',
    problemsLead: 'Not sent — the app would refuse it:',
  },
} as const;
