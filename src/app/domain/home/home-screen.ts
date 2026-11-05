import type { FieldProblem } from '../directory/directory-office';
import type { HomeBannerId, IsoDateTime, MediaId, QuickLinkId } from '../shared/ids';

/**
 * A banner on the residents' app's home screen (`DL-170`): a title, an image, and where tapping it
 * goes.
 *
 * ## No description of the image, because the API keeps none
 *
 * A banner is a picture, and a resident who cannot see it is owed words for it (`DL-125`). The API's
 * `Banner` has no field for them — `home_banners` stores a title, an image, a link, an order and
 * whether it is shown, and nothing else — so this model has none either: a field the console
 * collected and the server dropped would be a description somebody believes residents hear. The
 * screen says the app has no description to give, and the gap is recorded for the backend.
 *
 * The image is held as the id of stored bytes, never as an address: it is read through the data
 * layer (`HomeScreenRepository.bannerImage`), like every image in this console.
 */
export interface HomeBanner {
  readonly id: HomeBannerId;
  readonly title: string;
  readonly mediaId: MediaId | null;
  /** What the app opens when the banner is tapped, as written. The API checks only its length. */
  readonly href: string | null;
  /** The app shows shown banners by this, lowest first, then oldest first. */
  readonly sortOrder: number;
  readonly active: boolean;
  readonly createdAt: IsoDateTime;
}

/** A link on the app's home screen. Every one is shown, in order — there is no hidden link. */
export interface QuickLink {
  readonly id: QuickLinkId;
  readonly label: string;
  readonly href: string;
  readonly sortOrder: number;
  readonly createdAt: IsoDateTime;
}

export interface BannerDraft {
  readonly title: string;
  readonly href: string | null;
  readonly sortOrder: number;
  readonly active: boolean;
}

/** What happens to a banner's image on a change. */
export type BannerImageChange =
  | { readonly kind: 'keep' }
  | { readonly kind: 'replace'; readonly image: Blob }
  | { readonly kind: 'remove' };

export interface LinkDraft {
  readonly label: string;
  readonly href: string;
  readonly sortOrder: number;
}

/**
 * The home screen as the app is given it now (`GET home`) — what a resident sees on opening the app.
 * Counts and names, never the bodies of articles or pages: a preview says what is there, and the
 * Balita and Tulong screens are where the words live.
 */
export interface HomePreview {
  readonly banners: readonly HomeBanner[];
  readonly links: readonly QuickLink[];
  readonly featuredServices: readonly string[];
  readonly hotlines: number;
  readonly news: number;
}

/** Read from `src/modules/home/routes.ts` at `2736e28`. */
export const HOME_LIMITS = {
  title: 120,
  href: 300,
  label: 80,
  sortOrderMax: 1000,
} as const;

function orderProblem<T extends string>(field: T, sortOrder: number): FieldProblem<T>[] {
  return Number.isInteger(sortOrder) && sortOrder >= 0 && sortOrder <= HOME_LIMITS.sortOrderMax
    ? []
    : [{ field, message: `The order is a whole number from 0 to ${HOME_LIMITS.sortOrderMax}.` }];
}

export function bannerProblems(draft: BannerDraft): readonly FieldProblem<keyof BannerDraft>[] {
  const problems: FieldProblem<keyof BannerDraft>[] = [];
  if (draft.title.trim() === '')
    problems.push({ field: 'title', message: 'Give the banner a title.' });
  if (draft.title.length > HOME_LIMITS.title) {
    problems.push({
      field: 'title',
      message: `A title is at most ${HOME_LIMITS.title} characters.`,
    });
  }
  if (draft.href !== null && draft.href.length > HOME_LIMITS.href) {
    problems.push({ field: 'href', message: `A link is at most ${HOME_LIMITS.href} characters.` });
  }
  return [...problems, ...orderProblem('sortOrder', draft.sortOrder)];
}

export function linkProblems(draft: LinkDraft): readonly FieldProblem<keyof LinkDraft>[] {
  const problems: FieldProblem<keyof LinkDraft>[] = [];
  if (draft.label.trim() === '')
    problems.push({ field: 'label', message: 'Give the link a label.' });
  if (draft.label.length > HOME_LIMITS.label) {
    problems.push({
      field: 'label',
      message: `A label is at most ${HOME_LIMITS.label} characters.`,
    });
  }
  if (draft.href.trim() === '')
    problems.push({ field: 'href', message: 'Say where the link goes.' });
  if (draft.href.length > HOME_LIMITS.href) {
    problems.push({ field: 'href', message: `A link is at most ${HOME_LIMITS.href} characters.` });
  }
  return [...problems, ...orderProblem('sortOrder', draft.sortOrder)];
}

/** The sentence the banner screen says about the description the API does not keep (`DL-125`). */
export const BANNER_NO_DESCRIPTION =
  'The app has no description of a banner’s image to give a resident who cannot see it: the API ' +
  'keeps none. Only the title is stored with the image.';

/**
 * What each act on the home screen does in the residents' app, shown **before** the button
 * (`DL-170`).
 *
 * Read from `taytay-backend` `2736e28`: `src/modules/home/routes.ts` (banners and links audited as
 * `banner.*` and `link.*` with no reason; an image is any stored media the request names, uploaded
 * first through `POST media`; the public image route answers only a shown banner),
 * `src/modules/home/repository.ts` (the home screen carries shown banners by order then age, and every
 * link by order then age; nothing removes a banner's image from storage when it is replaced or the
 * banner deleted), and `src/modules/media/routes.ts` (an upload is kept whether or not anything ends
 * up naming it).
 */
export const HOME_EFFECTS = {
  bannerCreateShown: [
    'The banner appears on the app’s home screen, among the shown banners in order.',
    'The server records that you added it, and when.',
  ],
  bannerCreateHidden: [
    'The banner is kept here and not shown in the app until it is shown.',
    'The server records that you added it, and when.',
  ],
  bannerUpdate: [
    'Residents see the change the next time the app loads its home screen.',
    'The server records that you changed it, and when. It keeps no reason, so none is asked for.',
  ],
  imageUpload: [
    'The image is uploaded first, then the banner is saved. If the banner is then refused, the image ' +
      'stays stored on the server, unused; nothing removes it.',
  ],
  imageReplaced: [
    'The new image replaces the old one on the banner. The old image stays stored on the server; ' +
      'nothing removes it.',
  ],
  imageRemoved: [
    'The banner shows no image. Its old image stays stored on the server; nothing removes it.',
  ],
  bannerHide: ['The banner leaves the app’s home screen. It is kept here, and can be shown again.'],
  bannerShow: ['The banner appears on the app’s home screen again.'],
  bannerRemove: [
    'The banner leaves the app’s home screen and is deleted. Nothing brings it back. To take it off ' +
      'the home screen for a while, hide it instead.',
    'Its image stays stored on the server; nothing removes it.',
    'The server records that you deleted it, and when.',
  ],
  linkCreate: [
    'The link appears on the app’s home screen. Every link is shown, in order; there is no hidden ' +
      'link.',
    'The server records that you added it, and when.',
  ],
  linkUpdate: [
    'Residents see the change the next time the app loads its home screen.',
    'The server records that you changed it, and when. It keeps no reason, so none is asked for.',
  ],
  linkRemove: [
    'The link leaves the app’s home screen and is deleted. Nothing brings it back.',
    'The server records that you deleted it, and when.',
  ],
  href: [
    'The app opens this when the banner or link is tapped. The API checks only its length, not that ' +
      'it opens anything — try it in the app after saving.',
  ],
} as const;
