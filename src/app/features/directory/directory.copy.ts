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
    /* The board's three figures, each section's records in use (DL-232). */
    figuresLabel: 'What residents see',
    figures: {
      offices: {
        label: 'Offices in the app',
        hint: (banners: number) => `${banners} ${banners === 1 ? 'has a banner' : 'have a banner'}`,
      },
      services: {
        label: 'Tulong pages',
        hint: (featured: number) => `${featured} featured on the home screen`,
      },
      hotlines: {
        label: 'Hotlines shown',
        hint: (kept: number) => `of ${kept} ${kept === 1 ? 'line' : 'lines'} kept here`,
      },
    },
    noSection: 'Your account holds none of the keys for this directory.',
    sections: {
      offices: 'Offices',
      services: 'Tulong pages',
      hotlines: 'Hotlines',
    },
  },

  list: {
    edit: 'Edit',
    archive: 'Archive',
    restore: 'Restore',
    history: 'History',
    close: 'Close',
    effectsLead: 'What this does:',
    notDone: (reason: string) => `Not done. ${reason}`,
    failed: 'The server did not answer.',
    byName: 'By name, as the server sends them.',
    archivedNote:
      'Archived here means taken out of the app and kept: nothing in this directory is deleted. ' +
      'Each archived entry says who archived it, when and why, and can be restored.',
  },

  offices: {
    heading: 'Offices',
    lead:
      'The offices residents find in the app’s directory. An office still used by a staff account, ' +
      'a Tulong page or a document type cannot be archived until those are moved, archived or ' +
      'retired.',
    add: 'Add an office',
    tabsLabel: 'Offices: in use or archived',
    caption: 'Offices in the app’s directory',
    archivedCaption: 'Archived offices',
    noun: 'office',
    count: (count: number, archived: boolean) =>
      `${count} ${archived ? 'archived ' : ''}${count === 1 ? 'office' : 'offices'}${archived ? '' : ' in use'}.`,
    columnName: 'Office',
    columnAddress: 'Address in the app',
    columnCategory: 'Category',
    columnBanner: 'Banner',
    columnArchived: 'Archived',
    columnActions: 'Actions',
    hasBanner: 'Has a banner',
    noBanner: 'No banner',
    noCategory: 'None given',
    emptyHeading: 'No offices yet',
    emptyMessage: 'The app’s directory lists no office. Add one for residents to find.',
    archivedEmptyHeading: 'No archived offices',
    archivedEmptyMessage:
      'An office you archive is kept here, with who archived it, when and why, and can be restored.',
    editLabel: (name: string) => `Edit ${name}`,
    archiveLabel: (name: string) => `Archive ${name}`,
    restoreLabel: (name: string) => `Restore ${name}`,
    historyLabel: (name: string) => `History of ${name}`,
    createHeading: 'Add an office',
    editHeading: 'Edit office',
    archiveHeading: (name: string) => `Archive ${name}?`,
    restoreHeading: (name: string) => `Restore ${name}?`,
    historyHeading: (name: string) => `${name}: archive history`,
    archiveConfirm: 'Archive the office',
    restoreConfirm: 'Restore the office',
    archived: (name: string) =>
      `${name} was archived. It is under Archived, with your reason, and can be restored there.`,
    restored: (name: string) => `${name} was restored to the app’s directory.`,
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
      'whom to call. A page is information only unless it names an office programme and accepts ' +
      'online applications; then a verified resident linked to a registry record can apply through ' +
      'it, and the request reaches intake. A page is never a programme itself.',
    add: 'Add a page',
    tabsLabel: 'Tulong pages: in use or archived',
    caption: 'Tulong pages, hidden ones included',
    archivedCaption: 'Archived Tulong pages',
    noun: 'Tulong page',
    count: (count: number, archived: boolean) =>
      `${count} ${archived ? 'archived ' : ''}${count === 1 ? 'page' : 'pages'}${archived ? '' : ' in use, hidden ones included'}.`,
    columnName: 'Page',
    columnListing: 'Catalogue',
    columnHome: 'Home screen',
    columnOffice: 'Office',
    columnArchived: 'Archived',
    columnActions: 'Actions',
    featured: 'Featured',
    notFeatured: 'Not featured',
    noOffice: 'No office',
    /** An archived office a page names (`DL-225`). */
    archivedOfficeNamed: (name: string) => `${name} (archived)`,
    emptyHeading: 'No Tulong pages',
    emptyMessage: 'The app has no Tulong page in use. Add one for residents to read.',
    archivedEmptyHeading: 'No archived Tulong pages',
    archivedEmptyMessage:
      'A page you archive is kept here, with who archived it, when and why, and can be restored.',
    editLabel: (name: string) => `Edit ${name}`,
    archiveLabel: (name: string) => `Archive ${name}`,
    restoreLabel: (name: string) => `Restore ${name}`,
    historyLabel: (name: string) => `History of ${name}`,
    createHeading: 'Add a Tulong page',
    editHeading: 'Edit Tulong page',
    archiveHeading: (name: string) => `Archive ${name}?`,
    restoreHeading: (name: string) => `Restore ${name}?`,
    historyHeading: (name: string) => `${name}: archive history`,
    archiveConfirm: 'Archive the page',
    restoreConfirm: 'Restore the page',
    archived: (name: string) =>
      `${name} was archived. It is under Archived, with your reason, and can be restored there.`,
    restored: (name: string) => `${name} was restored to the app.`,
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
    // Applying from the app (`DL-228`).
    applications: 'Applications from the app',
    applicationsLead:
      'A Tulong page is information, not a programme. Name the office programme it applies to, ' +
      'and residents can apply for it from the app.',
    program: 'Office programme this page applies to',
    programNone: 'None',
    programInactive: 'A programme that is not active',
    programHint:
      'The active programmes. An application from this page is filed under the one chosen.',
    programsFailed:
      'The office’s programmes could not be read, so none can be chosen now. Reopen this form to ' +
      'try again.',
    acceptsOnline: 'Accepts online applications',
    acceptsOnlineHint:
      'Residents see Apply in the app while the page is in use and its programme is active. ' +
      'Needs a programme.',
    onlineYes: 'Accepts online applications',
    onlineNo: 'Information only',
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
    count: (count: number, archived: boolean) =>
      archived
        ? `${count} archived ${count === 1 ? 'line' : 'lines'}.`
        : `${count} ${count === 1 ? 'line' : 'lines'} in use, shown and hidden.`,
    tabsLabel: 'Hotlines: in use or archived',
    archivedCaption: 'Archived hotlines',
    noun: 'hotline',
    columnArchived: 'Archived',
    archivedEmptyHeading: 'No archived hotlines',
    archivedEmptyMessage:
      'A line you archive is kept here, with who archived it, when and why, and can be restored.',
    editLabel: (name: string) => `Edit ${name}`,
    archiveLabel: (name: string) => `Archive ${name}`,
    restoreLabel: (name: string) => `Restore ${name}`,
    historyLabel: (name: string) => `History of ${name}`,
    createHeading: 'Add a hotline',
    editHeading: 'Edit hotline',
    archiveHeading: (name: string) => `Archive ${name}?`,
    restoreHeading: (name: string) => `Restore ${name}?`,
    historyHeading: (name: string) => `${name}: archive history`,
    archiveConfirm: 'Archive the hotline',
    restoreConfirm: 'Restore the hotline',
    archived: (name: string) =>
      `${name} was archived. It is under Archived, with your reason, and can be restored there.`,
    restored: (name: string) => `${name} was restored.`,
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
