import type { DirectoryOffice, OfficeChanges, OfficeDraft, OfficeId } from '@domain/index';

import { dateTime, field, id, str } from './wire';

/** A coordinate, or `null`: any finite number, which `int` would refuse for having a fraction. */
function coordinate(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * `Office` → `DirectoryOffice` (`DL-170`).
 *
 * | wire              | domain        | if absent                  |
 * | ----------------- | ------------- | -------------------------- |
 * | `id`              | `id`          | the office is not readable |
 * | `name`            | `name`        | the office is not readable |
 * | `slug`            | `slug`        | the office is not readable |
 * | `updated_at`      | `updatedAt`   | the office is not readable |
 * | `short_name` …    | as named      | not given                  |
 * | `banner_media_id` | `hasBanner`   | no banner                  |
 *
 * **Not read**: `hero_url`, an absolute address of the banner's bytes on the API's host — a template
 * bound to it would load an image from another origin, which the console's image policy refuses;
 * `service_lines`, which the published contract offers no way to write; `created_at`, which only
 * orders the server's cursor.
 *
 * @consumes GET offices
 * @consumes POST admin/offices
 * @consumes PATCH admin/offices/{id}
 */
export function toDirectoryOffice(wire: unknown): DirectoryOffice | null {
  const officeId = id<OfficeId>(field(wire, 'id'));
  const name = str(field(wire, 'name'));
  const slug = str(field(wire, 'slug'));
  const updatedAt = dateTime(field(wire, 'updated_at'));

  if (officeId === null || name === null || slug === null || updatedAt === null) {
    return null;
  }

  return {
    id: officeId,
    name,
    slug,
    shortName: str(field(wire, 'short_name')),
    category: str(field(wire, 'category')),
    description: str(field(wire, 'description')),
    head: str(field(wire, 'head')),
    hours: str(field(wire, 'hours')),
    phone: str(field(wire, 'phone')),
    email: str(field(wire, 'email')),
    address: str(field(wire, 'address')),
    latitude: coordinate(field(wire, 'latitude')),
    longitude: coordinate(field(wire, 'longitude')),
    hasBanner: str(field(wire, 'banner_media_id')) !== null,
    updatedAt,
  };
}

/** `OfficeWrite`, as a form: every field text, the banner a file. */
export interface OfficeWriteWire {
  readonly name: string;
  readonly slug: string;
  readonly short_name: string | undefined;
  readonly category: string | undefined;
  readonly description: string | undefined;
  readonly head: string | undefined;
  readonly hours: string | undefined;
  readonly phone: string | undefined;
  readonly email: string | undefined;
  readonly address: string | undefined;
  readonly latitude: string | undefined;
  readonly longitude: string | undefined;
  readonly banner: Blob | undefined;
}

/**
 * A new office as the form `POST admin/offices` reads. An absent value is **left out**, never sent
 * empty: the server refuses an empty text field, and reads an empty coordinate as zero — a pin in
 * the Gulf of Guinea for an office in Taytay.
 */
export function toWireOfficeDraft(draft: OfficeDraft, banner: Blob | null): OfficeWriteWire {
  const text = (value: string | null): string | undefined => value ?? undefined;
  const number = (value: number | null): string | undefined =>
    value === null ? undefined : String(value);

  return {
    name: draft.name,
    slug: draft.slug,
    short_name: text(draft.shortName),
    category: text(draft.category),
    description: text(draft.description),
    head: text(draft.head),
    hours: text(draft.hours),
    phone: text(draft.phone),
    email: text(draft.email),
    address: text(draft.address),
    latitude: number(draft.latitude),
    longitude: number(draft.longitude),
    banner: banner ?? undefined,
  };
}

/** `OfficePatch`, as a form — the four fields it declares, and the banner. */
export interface OfficePatchWire {
  readonly name: string | undefined;
  readonly slug: string | undefined;
  readonly short_name: string | undefined;
  readonly category: string | undefined;
  readonly banner: Blob | undefined;
}

export function toWireOfficeChanges(changes: OfficeChanges, banner: Blob | null): OfficePatchWire {
  return {
    name: changes.name,
    slug: changes.slug,
    short_name: changes.shortName,
    category: changes.category,
    banner: banner ?? undefined,
  };
}
