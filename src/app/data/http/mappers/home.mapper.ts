import type {
  HomeBanner,
  HomeBannerId,
  HomePreview,
  MediaId,
  QuickLink,
  QuickLinkId,
} from '@domain/index';

import { dateTime, field, id, int, str } from './wire';

/** A boolean, or `null` for anything that is not one. */
function flag(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

/**
 * `Banner` → `HomeBanner` (`DL-170`).
 *
 * | wire         | domain      | if absent                  |
 * | ------------ | ----------- | -------------------------- |
 * | `id`         | `id`        | the banner is not readable |
 * | `title`      | `title`     | the banner is not readable |
 * | `sort_order` | `sortOrder` | the banner is not readable |
 * | `active`     | `active`    | the banner is not readable |
 * | `created_at` | `createdAt` | the banner is not readable |
 * | `media_id`   | `mediaId`   | no image                   |
 * | `href`       | `href`      | tapping it opens nothing   |
 *
 * **Not read**: `image_url`, an address of the image on the API's host; the image is read as bytes
 * through the data layer instead. There is no description of the image to read — the API keeps none.
 *
 * @consumes GET admin/home/banners
 * @consumes POST admin/home/banners
 * @consumes PATCH admin/home/banners/{id}
 */
export function toHomeBanner(wire: unknown): HomeBanner | null {
  const bannerId = id<HomeBannerId>(field(wire, 'id'));
  const title = str(field(wire, 'title'));
  const sortOrder = int(field(wire, 'sort_order'));
  const active = flag(field(wire, 'active'));
  const createdAt = dateTime(field(wire, 'created_at'));

  if (
    bannerId === null ||
    title === null ||
    sortOrder === null ||
    active === null ||
    createdAt === null
  ) {
    return null;
  }

  return {
    id: bannerId,
    title,
    mediaId: id<MediaId>(field(wire, 'media_id')),
    href: str(field(wire, 'href')),
    sortOrder,
    active,
    createdAt,
  };
}

/**
 * `QuickLink` → `QuickLink` (`DL-170`). Every field is required by the spec and by the screen.
 *
 * @consumes GET admin/home/links
 * @consumes POST admin/home/links
 * @consumes PATCH admin/home/links/{id}
 */
export function toQuickLink(wire: unknown): QuickLink | null {
  const linkId = id<QuickLinkId>(field(wire, 'id'));
  const label = str(field(wire, 'label'));
  const href = str(field(wire, 'href'));
  const sortOrder = int(field(wire, 'sort_order'));
  const createdAt = dateTime(field(wire, 'created_at'));

  if (
    linkId === null ||
    label === null ||
    href === null ||
    sortOrder === null ||
    createdAt === null
  ) {
    return null;
  }

  return { id: linkId, label, href, sortOrder, createdAt };
}

/** Every element read, or `null` — a preview with a banner left out is not what residents see. */
function whole<T>(value: unknown, read: (item: unknown) => T | null): readonly T[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value.map(read);
  return items.every((item): item is T => item !== null) ? items : null;
}

/**
 * `GET home` → `HomePreview` (`DL-170`): the banners and links as the app is given them, the names of
 * the featured Tulong pages, and how many hotlines and Balita articles it carries. The articles' and
 * pages' words are not read: a preview says what is there.
 *
 * @consumes GET home
 */
export function toHomePreview(wire: unknown): HomePreview | null {
  const banners = whole(field(wire, 'banners'), toHomeBanner);
  const links = whole(field(wire, 'quick_links'), toQuickLink);
  const services = whole(field(wire, 'services'), (item) => str(field(item, 'name')));
  const hotlines = field(wire, 'hotlines');
  const news = field(wire, 'news');

  if (
    banners === null ||
    links === null ||
    services === null ||
    !Array.isArray(hotlines) ||
    !Array.isArray(news)
  ) {
    return null;
  }

  return {
    banners,
    links,
    featuredServices: services,
    hotlines: hotlines.length,
    news: news.length,
  };
}

/**
 * `MediaMeta` → the id of what was stored, to name in a banner (`DL-170`).
 *
 * @consumes POST media
 */
export function toStoredMedia(wire: unknown): MediaId | null {
  return id<MediaId>(field(wire, 'id'));
}

/** The image, as the form `POST media` reads it. */
export interface MediaUploadWire {
  readonly file: Blob;
}

export function toWireMediaUpload(image: Blob): MediaUploadWire {
  return { file: image };
}
