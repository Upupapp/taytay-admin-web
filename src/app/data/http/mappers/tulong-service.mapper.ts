import {
  SERVICE_CONTACT_TYPES,
  type OfficeId,
  type ServiceChanges,
  type ServiceContact,
  type ServiceDraft,
  type ServiceLocation,
  type TulongService,
  type TulongServiceId,
} from '@domain/index';

import { bool, dateTime, field, id, oneOf, str } from './wire';

function contactOf(wire: unknown): ServiceContact | null {
  const type = oneOf(field(wire, 'type'), SERVICE_CONTACT_TYPES);
  const value = str(field(wire, 'value'));
  return type === null || value === null ? null : { type, label: str(field(wire, 'label')), value };
}

function locationOf(wire: unknown): ServiceLocation | null {
  const name = str(field(wire, 'name'));
  const address = str(field(wire, 'address'));
  return name === null || address === null ? null : { name, address };
}

/**
 * Every element read, or `null` — never a list with the unreadable ones dropped. A page is edited
 * and sent back whole: a contact this console could not read and left out would be **deleted** from
 * the page by the next save, with nothing on the screen to say it had been there.
 */
function whole<T>(value: unknown, read: (item: unknown) => T | null): readonly T[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const items = value.map(read);
  return items.every((item): item is T => item !== null) ? items : null;
}

const lines = (value: unknown): readonly string[] | null =>
  whole(value, (item) => (typeof item === 'string' ? item : null));

/**
 * `Service` → `TulongService` (`DL-170`).
 *
 * | wire                                   | domain                 | if absent                |
 * | -------------------------------------- | ---------------------- | ------------------------ |
 * | `id`, `name`, `slug`, `summary`, `details`, `updated_at` | as named | the page is not readable |
 * | `requirements`, `contacts`, `locations` | as named              | the page is not readable |
 * | `claim_steps`                          | `claimSteps`           | none                     |
 * | `media_id`                             | `hasImage`             | no picture               |
 * | the rest                               | as named               | not given                |
 *
 * A list with one element this console cannot read — a contact of a kind it does not know — makes
 * the page unreadable rather than shorter (`whole`), because a save sends the list back.
 *
 * **Not read**: `hero_url`, an address on the API's host (see `toDirectoryOffice`); `office_slug`,
 * which the office's id already says; `created_at`, which only orders the cursor.
 *
 * @consumes GET services
 * @consumes GET services/{slug}
 * @consumes POST admin/services
 * @consumes PATCH admin/services/{id}
 * @consumes POST admin/services/{id}/media
 */
export function toTulongService(wire: unknown): TulongService | null {
  const serviceId = id<TulongServiceId>(field(wire, 'id'));
  const name = str(field(wire, 'name'));
  const slug = str(field(wire, 'slug'));
  const summary = str(field(wire, 'summary'));
  const details = str(field(wire, 'details'));
  const updatedAt = dateTime(field(wire, 'updated_at'));
  const requirements = lines(field(wire, 'requirements'));
  const contacts = whole(field(wire, 'contacts'), contactOf);
  const locations = whole(field(wire, 'locations'), locationOf);
  // Optional on the wire: absent is no steps; present and unreadable refuses the page, as above.
  const claimStepsWire = field(wire, 'claim_steps');
  const claimSteps = claimStepsWire === undefined ? [] : lines(claimStepsWire);

  if (
    serviceId === null ||
    name === null ||
    slug === null ||
    summary === null ||
    details === null ||
    updatedAt === null ||
    requirements === null ||
    contacts === null ||
    locations === null ||
    claimSteps === null
  ) {
    return null;
  }

  return {
    id: serviceId,
    name,
    slug,
    category: str(field(wire, 'category')),
    summary,
    details,
    eligibility: str(field(wire, 'eligibility')),
    requirements,
    contacts,
    locations,
    officeId: id<OfficeId>(field(wire, 'office_id')),
    featured: bool(field(wire, 'featured')),
    featuredHeadline: str(field(wire, 'featured_headline')),
    hiddenFromList: bool(field(wire, 'hidden_from_list')),
    badge: str(field(wire, 'badge')),
    iconKey: str(field(wire, 'icon_key')),
    tileColor: str(field(wire, 'tile_color')),
    legalBasis: str(field(wire, 'legal_basis')),
    claimSteps,
    schedule: str(field(wire, 'schedule')),
    hasImage: str(field(wire, 'media_id')) !== null,
    updatedAt,
  };
}

interface ServiceContactWire {
  readonly type: string;
  readonly label: string | null;
  readonly value: string;
}

const contactWire = (contact: ServiceContact): ServiceContactWire => ({
  type: contact.type,
  label: contact.label,
  value: contact.value,
});

/** `ServiceWrite`. Absent values are left out: the server's schema refuses an empty string. */
export interface ServiceWriteWire {
  readonly name: string;
  readonly slug: string;
  readonly category: string | undefined;
  readonly summary: string;
  readonly details: string;
  readonly eligibility: string | undefined;
  readonly requirements: readonly string[];
  readonly contacts: readonly ServiceContactWire[];
  readonly locations: readonly { readonly name: string; readonly address: string }[];
  readonly office_id: string | null;
  readonly icon_key: string | null;
  readonly tile_color: string | null;
  readonly badge: string | null;
  readonly legal_basis: string | null;
  readonly claim_steps: readonly string[];
  readonly featured_headline: string | null;
  readonly schedule: string | null;
  readonly hidden_from_list: boolean;
}

export function toWireServiceDraft(draft: ServiceDraft): ServiceWriteWire {
  return {
    name: draft.name,
    slug: draft.slug,
    category: draft.category ?? undefined,
    summary: draft.summary,
    details: draft.details,
    eligibility: draft.eligibility ?? undefined,
    requirements: draft.requirements,
    contacts: draft.contacts.map(contactWire),
    locations: draft.locations.map((place) => ({ name: place.name, address: place.address })),
    office_id: draft.officeId,
    icon_key: draft.iconKey,
    tile_color: draft.tileColor,
    badge: draft.badge,
    legal_basis: draft.legalBasis,
    claim_steps: draft.claimSteps,
    featured_headline: draft.featuredHeadline,
    schedule: draft.schedule,
    hidden_from_list: draft.hiddenFromList,
  };
}

/** `ServicePatch` — what it declares, and nothing else. `undefined` is left out; `null` clears. */
export interface ServicePatchWire {
  readonly name: string | undefined;
  readonly summary: string | undefined;
  readonly details: string | undefined;
  readonly requirements: readonly string[] | undefined;
  readonly contacts: readonly ServiceContactWire[] | undefined;
  readonly featured: boolean | undefined;
  readonly icon_key: string | null | undefined;
  readonly tile_color: string | null | undefined;
  readonly badge: string | null | undefined;
  readonly legal_basis: string | null | undefined;
  readonly claim_steps: readonly string[] | undefined;
  readonly featured_headline: string | null | undefined;
  readonly schedule: string | null | undefined;
  readonly hidden_from_list: boolean | undefined;
}

export function toWireServiceChanges(changes: ServiceChanges): ServicePatchWire {
  return {
    name: changes.name,
    summary: changes.summary,
    details: changes.details,
    requirements: changes.requirements,
    contacts: changes.contacts?.map(contactWire),
    featured: changes.featured,
    icon_key: changes.iconKey,
    tile_color: changes.tileColor,
    badge: changes.badge,
    legal_basis: changes.legalBasis,
    claim_steps: changes.claimSteps,
    featured_headline: changes.featuredHeadline,
    schedule: changes.schedule,
    hidden_from_list: changes.hiddenFromList,
  };
}

/** The picture, as the form `POST admin/services/{id}/media` reads it. */
export interface ServiceMediaWire {
  readonly file: Blob;
}

export function toWireServiceImage(image: Blob): ServiceMediaWire {
  return { file: image };
}
