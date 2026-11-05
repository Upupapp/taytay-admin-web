import {
  BALITA_CATEGORY_SLUGS,
  BALITA_STATUSES,
  type BalitaArticle,
  type BalitaArticleId,
  type BalitaCategory,
  type BalitaChanges,
  type BalitaDraft,
  type OfficeId,
} from '@domain/index';

import { bool, dateTime, field, id, oneOf, str } from './wire';

/**
 * `NewsItem` → `BalitaArticle` (`DL-171`).
 *
 * | wire             | domain        | if absent                    |
 * | ---------------- | ------------- | ---------------------------- |
 * | `id`             | `id`          | the article is not readable  |
 * | `title`          | `title`       | the article is not readable  |
 * | `body`           | `body`        | the article is not readable  |
 * | `office_id`      | `officeId`    | the article is not readable  |
 * | `status`         | `status`      | the article is not readable  |
 * | `updated_at`     | `updatedAt`   | the article is not readable  |
 * | `category`       | `category`    | no category                  |
 * | `published_at`   | `publishedAt` | never published              |
 * | `pinned`         | `pinned`      | not pinned                   |
 * | `cover_media_id` | `hasCover`    | no cover                     |
 *
 * **Not read**: `cover_url` — the cover is read as bytes through the data layer, never from an
 * address; `share_url`, which this console does not hand out; `author_id`, an account id nothing here
 * shows; `office_slug`, which the office's id already names; `pinned_at` and `created_at`, which only
 * order the server's list.
 *
 * @consumes GET news
 * @consumes GET news/{id}
 * @consumes POST news
 * @consumes PATCH news/{id}
 * @consumes POST news/{id}/pin
 * @consumes DELETE news/{id}/pin
 */
export function toBalitaArticle(wire: unknown): BalitaArticle | null {
  const articleId = id<BalitaArticleId>(field(wire, 'id'));
  const title = str(field(wire, 'title'));
  const body = str(field(wire, 'body'));
  const officeId = id<OfficeId>(field(wire, 'office_id'));
  const status = oneOf(field(wire, 'status'), BALITA_STATUSES);
  const updatedAt = dateTime(field(wire, 'updated_at'));

  if (
    articleId === null ||
    title === null ||
    body === null ||
    officeId === null ||
    status === null ||
    updatedAt === null
  ) {
    return null;
  }

  return {
    id: articleId,
    title,
    body,
    category: oneOf(field(wire, 'category'), BALITA_CATEGORY_SLUGS),
    officeId,
    status,
    publishedAt: dateTime(field(wire, 'published_at')),
    pinned: bool(field(wire, 'pinned')),
    hasCover: str(field(wire, 'cover_media_id')) !== null,
    updatedAt,
  };
}

/**
 * `NewsCategory` → `BalitaCategory`. A slug outside the five the spec names is dropped: nothing could
 * be filed under it, because the API's write takes only those.
 *
 * @consumes GET news/categories
 */
export function toBalitaCategory(wire: unknown): BalitaCategory | null {
  const slug = oneOf(field(wire, 'slug'), BALITA_CATEGORY_SLUGS);
  const label = str(field(wire, 'label'));
  return slug === null || label === null ? null : { slug, label };
}

/** `NewsWrite`, a form: the cover travels as a file beside the words. */
export interface NewsWriteWire {
  readonly title: string;
  readonly body: string;
  readonly category: string | undefined;
  readonly office_id: string | undefined;
  readonly status: string;
  readonly cover: Blob | undefined;
}

export function toWireNewsWrite(draft: BalitaDraft, cover: Blob | null): NewsWriteWire {
  return {
    title: draft.title.trim(),
    body: draft.body.trim(),
    category: draft.category ?? undefined,
    office_id: draft.officeId ?? undefined,
    status: draft.status,
    cover: cover ?? undefined,
  };
}

/** `NewsPatch`, a form: only what changed travels; a form cannot say `null`. */
export interface NewsPatchWire {
  readonly title: string | undefined;
  readonly body: string | undefined;
  readonly category: string | undefined;
  readonly status: string | undefined;
  readonly cover: Blob | undefined;
}

export function toWireNewsPatch(changes: BalitaChanges, cover: Blob | null): NewsPatchWire {
  return {
    title: changes.title?.trim(),
    body: changes.body?.trim(),
    category: changes.category,
    status: changes.status,
    cover: cover ?? undefined,
  };
}
