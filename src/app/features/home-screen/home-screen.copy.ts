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
    remove: 'Delete',
    cancel: 'Keep it',
    effectsLead: 'What this does:',
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
    count: (count: number) => `${count} ${count === 1 ? 'banner' : 'banners'}, shown and hidden.`,
    editLabel: (title: string) => `Edit the banner ${title}`,
    removeLabel: (title: string) => `Delete the banner ${title}`,
    createHeading: 'Add a banner',
    editHeading: 'Edit banner',
    removeHeading: (title: string) => `Delete the banner ${title}?`,
    removeConfirm: 'Delete the banner',
    removed: (title: string) => `The banner ${title} was deleted.`,
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
  },

  links: {
    heading: 'Quick links',
    lead:
      'The links on the app’s home screen. Every link is shown, by order, lowest first; there is no ' +
      'hidden link — deleting is the only way to take one off.',
    add: 'Add a link',
    caption: 'Quick links on the app’s home screen',
    columnOrder: 'Order',
    columnLabel: 'Label',
    columnHref: 'Opens',
    columnActions: 'Actions',
    emptyHeading: 'No quick links',
    emptyMessage: 'The app’s home screen shows no link. Add one.',
    count: (count: number) => `${count} ${count === 1 ? 'link' : 'links'}, every one shown.`,
    editLabel: (label: string) => `Edit the link ${label}`,
    removeLabel: (label: string) => `Delete the link ${label}`,
    createHeading: 'Add a link',
    editHeading: 'Edit link',
    removeHeading: (label: string) => `Delete the link ${label}?`,
    removeConfirm: 'Delete the link',
    removed: (label: string) => `The link ${label} was deleted.`,
    created: (label: string) => `The link ${label} was added.`,
    saved: (label: string) => `The link ${label} was saved.`,
  },

  linkForm: {
    label: 'Label',
    href: 'Opens',
    create: 'Add the link',
    save: 'Save changes',
  },

  preview: {
    heading: 'What the app shows now',
    lead:
      'The home screen as the app is given it at this moment — shown banners and every link, in the ' +
      'app’s order, with the featured Tulong pages, hotlines and Balita it carries beside them.',
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
