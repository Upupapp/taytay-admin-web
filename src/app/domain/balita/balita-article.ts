import type { StatusCatalog, StatusTransitions } from '../shared/status';
import type { BalitaArticleId, IsoDateTime, OfficeId } from '../shared/ids';

/**
 * Balita — the news residents read in the Taytay app (`DL-171`), read from the Node API at `2736e28`
 * (`src/modules/news`).
 *
 * **Not the console's newsfeed** (`DL-164`). The newsfeed module keeps scheduling, archiving, image
 * descriptions and moderation the API has none of; it stays unserved, and nothing here borrows its
 * model, its port or its key. A Balita article is a title, words, an optional category and cover, an
 * office, and whether it is published or pinned.
 *
 * **No image address.** The model knows whether there is a cover, never `cover_url`: the cover is
 * read as bytes through the data layer on request.
 */
export interface BalitaArticle {
  readonly id: BalitaArticleId;
  readonly title: string;
  readonly body: string;
  readonly category: BalitaCategorySlug | null;
  readonly officeId: OfficeId;
  readonly status: BalitaStatus;
  /** The first time it was published; kept by the API when it is taken off and published again. */
  readonly publishedAt: IsoDateTime | null;
  readonly pinned: boolean;
  readonly hasCover: boolean;
  readonly updatedAt: IsoDateTime;
}

export const BALITA_CATEGORY_SLUGS = ['abiso', 'advisory', 'negosyo', 'safety', 'events'] as const;

export type BalitaCategorySlug = (typeof BALITA_CATEGORY_SLUGS)[number];

/** A category as the API names it (`GET news/categories`). */
export interface BalitaCategory {
  readonly slug: BalitaCategorySlug;
  readonly label: string;
}

export const BALITA_STATUSES = ['draft', 'published'] as const;

export type BalitaStatus = (typeof BALITA_STATUSES)[number];

export const BALITA_STATUS_CATALOG: StatusCatalog<BalitaStatus> = {
  draft: {
    value: 'draft',
    label: 'Draft',
    tone: 'neutral',
    description: 'Not in the app. Only its office’s staff and administrators can open it.',
  },
  published: {
    value: 'published',
    label: 'Published',
    tone: 'success',
    description: 'In the app’s Balita, for every resident, and open to anyone with its link.',
  },
};

/** The API's own moves: a draft is published, and a published article can be taken off again. */
export const BALITA_STATUS_TRANSITIONS: StatusTransitions<BalitaStatus> = {
  draft: ['published'],
  published: ['draft'],
};

/** A new article. `officeId` is `null` to let the API use the staff member's own office. */
export interface BalitaDraft {
  readonly title: string;
  readonly body: string;
  readonly category: BalitaCategorySlug | null;
  readonly officeId: OfficeId | null;
  readonly status: BalitaStatus;
}

/**
 * A change: `undefined` leaves a field as it is. There is no way to clear a category or remove a
 * cover — the API's change takes neither — so neither can be asked for.
 */
export interface BalitaChanges {
  readonly title?: string;
  readonly body?: string;
  readonly category?: BalitaCategorySlug;
  readonly status?: BalitaStatus;
}

/** The API's limits (`news/schemas.ts`). */
export const BALITA_LIMITS = { title: 160, body: 20000 } as const;

/** What would stop a draft being accepted, in words; `null` when nothing does. */
export function balitaProblem(title: string, body: string): string | null {
  if (title.trim() === '') return 'An article needs a title.';
  if (title.trim().length > BALITA_LIMITS.title) {
    return `A title can be at most ${BALITA_LIMITS.title} characters.`;
  }
  if (body.trim() === '') return 'An article needs words.';
  if (body.trim().length > BALITA_LIMITS.body) {
    return `An article can be at most ${BALITA_LIMITS.body} characters.`;
  }
  return null;
}

export type BalitaAct = 'publish' | 'save-draft' | 'unpublish' | 'edit-published' | 'pin' | 'unpin';

/**
 * What each act does, read from the backend's handlers at `2736e28` (`news/routes.ts`,
 * `repository.ts`) and shown **before** the button that does it (`DL-124`'s doctrine: somebody
 * deciding reads a warning; somebody who has decided dismisses a confirmation).
 */
export const BALITA_EFFECTS: Readonly<Record<BalitaAct, readonly string[]>> = {
  publish: [
    'Every resident can read it in the app’s Balita at once, and anyone with its link can open it.',
    'It cannot be recalled from anybody who has read it. Taking it off the app later removes it only from then on.',
    'The API sends no notification: residents find it when they open Balita.',
  ],
  'save-draft': [
    'Residents cannot see it.',
    'The API keeps no list of drafts. It can be opened from this page until you leave, and afterwards only by its ID, which this page shows.',
  ],
  unpublish: [
    'It leaves the app’s Balita from now on. Anybody who has already read it, or copied its link or words, keeps them.',
    'The API keeps no list of drafts. It can be opened from this page until you leave, and afterwards only by its ID.',
    'Published again later, it keeps its first publication date, so it does not return to the top of the list.',
  ],
  'edit-published': [
    'Residents read the new words the next time they open it. Anybody who read the earlier words keeps them.',
  ],
  pin: [
    'It moves to the top of the app’s Balita, above newer articles, until it is unpinned — even when residents choose a category.',
  ],
  unpin: ['It returns to its place by publication date.'],
};

/** Said beside the cover, because the API keeps no description of it (`DL-125`, `DL-171`). */
export const BALITA_COVER_EFFECTS: readonly string[] = [
  'The API keeps no description of the cover, so the app has none to give a resident who cannot see it. Say what matters in the words.',
  'Choosing a new cover deletes the old image from storage. A cover cannot be removed, only replaced.',
];

/** Who may write, as the API decides it (`officeForWrite`, `canEdit`). */
export const BALITA_OFFICE_RULES: readonly string[] = [
  'Staff write for their own office only; the API uses it when no office is chosen and refuses another.',
  'An administrator must choose the office.',
  'Staff can change only their own office’s articles. Every published article is listed, whichever office wrote it.',
];
