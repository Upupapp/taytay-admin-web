/**
 * Every sentence the home screen page says (`DL-170`). What an act does is the domain's
 * (`HOME_EFFECTS`), read from the backend.
 */
export const HOME_SCREEN_COPY = {
  page: {
    title: 'Home screen',
    subtitle:
      'Residents see this in the Taytay app: the banners and links on the first screen every ' +
      'resident opens. A change here reaches every resident the next time the app loads.',
  },

  common: {
    edit: 'Edit',
    archive: 'Archive',
    restore: 'Restore',
    history: 'History',
    close: 'Close',
    effectsLead: 'What this does:',
    archivedNote:
      'Archived here means taken off the home screen and kept: nothing here is deleted. Each ' +
      'archived entry says who archived it, when and why, and can be restored.',
    notDone: (reason: string) => `Not done. ${reason}`,
    failed: 'The server did not answer.',
    problemsLead: 'Not sent — the app would refuse it:',
    saving: 'Saving…',
    unchanged: 'Nothing has changed yet.',
    order: 'Order',
    orderHint: 'A whole number from 0 to 1000; lower comes first in the app.',
    hrefHint:
      'What the app opens when this is tapped, as the app expects it. The API checks only its length.',
  },

  banners: {
    heading: 'Banners',
    lead:
      'The pictures across the top of the app’s home screen. Shown banners appear by order, lowest ' +
      'first, then oldest first; a hidden banner is kept here and shown nowhere.',
    add: 'Add a banner',
    caption: 'Banners on the app’s home screen',
    columnOrder: 'Order',
    columnTitle: 'Banner',
    columnImage: 'Image',
    columnShown: 'In the app',
    columnActions: 'Actions',
    hasImage: 'Has an image',
    noImage: 'No image',
    noLink: 'Opens nothing',
    emptyHeading: 'No banners',
    emptyMessage: 'The app’s home screen shows no banner. Add one.',
    count: (count: number, archived: boolean) =>
      archived
        ? `${count} archived ${count === 1 ? 'banner' : 'banners'}.`
        : `${count} ${count === 1 ? 'banner' : 'banners'} in use, shown and hidden.`,
    tabsLabel: 'Banners: in use or archived',
    archivedCaption: 'Archived banners',
    columnArchived: 'Archived',
    archivedEmptyHeading: 'No archived banners',
    archivedEmptyMessage:
      'A banner you archive is kept here, with its image, who archived it, when and why, and can ' +
      'be restored.',
    editLabel: (title: string) => `Edit the banner ${title}`,
    archiveLabel: (title: string) => `Archive the banner ${title}`,
    restoreLabel: (title: string) => `Restore the banner ${title}`,
    historyLabel: (title: string) => `History of the banner ${title}`,
    createHeading: 'Add a banner',
    editHeading: 'Edit banner',
    archiveHeading: (title: string) => `Archive the banner ${title}?`,
    restoreHeading: (title: string) => `Restore the banner ${title}?`,
    historyHeading: (title: string) => `The banner ${title}: archive history`,
    archiveConfirm: 'Archive the banner',
    restoreConfirm: 'Restore the banner',
    archived: (title: string) =>
      `The banner ${title} was archived. It is under Archived, with your reason, and can be ` +
      'restored there.',
    restored: (title: string) => `The banner ${title} was restored.`,
    created: (title: string) => `The banner ${title} was added.`,
    saved: (title: string) => `The banner ${title} was saved.`,
  },

  bannerForm: {
    title: 'Title',
    titleHint: 'Stored with the image. Say what the banner announces.',
    href: 'Link',
    active: 'Show on the app’s home screen',
    imageHeading: 'Image',
    image: 'Banner image',
    imageHint: 'Wide images suit the top of the home screen.',
    current: 'This banner has an image.',
    none: 'This banner has no image.',
    showCurrent: 'Show the current image',
    loadingCurrent: 'Loading the image…',
    currentFailed: 'The image could not be loaded. Try again.',
    currentAlt: (title: string) => `The current image of the banner ${title}`,
    removeImage: 'Remove the image from this banner',
    create: 'Add the banner',
    save: 'Save changes',
    noun: 'banner',
  },

  links: {
    heading: 'Quick links',
    lead:
      'The links on the app’s home screen. Every link in use is shown, by order, lowest first; there ' +
      'is no hidden link — archiving is the way to take one off, and it can be restored.',
    add: 'Add a link',
    caption: 'Quick links on the app’s home screen',
    columnOrder: 'Order',
    columnLabel: 'Label',
    columnHref: 'Opens',
    columnActions: 'Actions',
    emptyHeading: 'No quick links',
    emptyMessage: 'The app’s home screen shows no link. Add one.',
    count: (count: number, archived: boolean) =>
      archived
        ? `${count} archived ${count === 1 ? 'link' : 'links'}.`
        : `${count} ${count === 1 ? 'link' : 'links'} in use, every one shown.`,
    tabsLabel: 'Quick links: in use or archived',
    archivedCaption: 'Archived quick links',
    columnArchived: 'Archived',
    archivedEmptyHeading: 'No archived links',
    archivedEmptyMessage:
      'A link you archive is kept here, with who archived it, when and why, and can be restored.',
    editLabel: (label: string) => `Edit the link ${label}`,
    archiveLabel: (label: string) => `Archive the link ${label}`,
    restoreLabel: (label: string) => `Restore the link ${label}`,
    historyLabel: (label: string) => `History of the link ${label}`,
    createHeading: 'Add a link',
    editHeading: 'Edit link',
    archiveHeading: (label: string) => `Archive the link ${label}?`,
    restoreHeading: (label: string) => `Restore the link ${label}?`,
    historyHeading: (label: string) => `The link ${label}: archive history`,
    archiveConfirm: 'Archive the link',
    restoreConfirm: 'Restore the link',
    archived: (label: string) =>
      `The link ${label} was archived. It is under Archived, with your reason, and can be ` +
      'restored there.',
    restored: (label: string) => `The link ${label} was restored.`,
    created: (label: string) => `The link ${label} was added.`,
    saved: (label: string) => `The link ${label} was saved.`,
  },

  linkForm: {
    label: 'Label',
    href: 'Opens',
    create: 'Add the link',
    save: 'Save changes',
    noun: 'link',
  },

  preview: {
    heading: 'What the app shows now',
    lead:
      'The home screen as the app is given it at this moment — shown banners and every link in use, ' +
      'in the app’s order, with the featured Tulong pages, hotlines and Balita it carries beside ' +
      'them.',
    reload: 'Read it again',
    banners: 'Banners',
    noBanners: 'No banner is shown.',
    links: 'Quick links',
    noLinks: 'No link is shown.',
    featured: 'Featured Tulong pages',
    noFeatured: 'No Tulong page is featured.',
    carries: (hotlines: number, news: number) =>
      `It also carries ${hotlines} ${hotlines === 1 ? 'hotline' : 'hotlines'} and the latest ` +
      `${news} Balita ${news === 1 ? 'article' : 'articles'}.`,
    imageAlt: (title: string) => `Banner: ${title}`,
    imageFailed: 'Image could not be loaded.',
    noImage: 'No image',
  },
} as const;
