import type { ArchiveRecord } from '../shared/archive';
import type { IsoDateTime, OfficeId, ProgramId, TulongServiceId } from '../shared/ids';
import type { StatusCatalog, StatusTransitions } from '../shared/status';

import type { FieldProblem } from './directory-office';

/**
 * A **Tulong page**: what the residents' app tells a resident about a service — what it is, who it
 * is for, what to bring, whom to call (`DL-170`).
 *
 * ## Not a programme
 *
 * It looks like one and is not (`DL-164`). A `Program` here carries eligibility guidelines with
 * weights and a basis, a responsibility saying who administers it and who holds the funds, and the
 * catalogue rules of `DL-65`/`DL-66`. A Tulong page carries **free text a resident reads**:
 * `eligibility` is a paragraph, not a rule, and there is no application endpoint — the API's own
 * description says "Information only". Rendering either as the other would invent policy fields or
 * drop them, so the two never share a type, a port or a screen, and `check:directory` fails the
 * build if this module names `Program`.
 */
export interface TulongService {
  readonly id: TulongServiceId;
  readonly name: string;
  /** The address the app opens the page by: `services/{slug}`. */
  readonly slug: string;
  readonly category: string | null;
  /** One or two sentences, shown on the page's tile. */
  readonly summary: string;
  readonly details: string;
  /** Who it is for, in words a resident reads. Never evaluated by anything. */
  readonly eligibility: string | null;
  readonly requirements: readonly string[];
  readonly contacts: readonly ServiceContact[];
  readonly locations: readonly ServiceLocation[];
  readonly officeId: OfficeId | null;
  /**
   * The office programme this page applies to (`DL-228`, the API's ADR 0004 decision 2), or `null`.
   * A Tulong page is not a programme (`DL-170`); this names the one an application from it files
   * under.
   */
  readonly programId: ProgramId | null;
  /**
   * Residents apply from the app: the page shows Apply while it is live, takes applications and its
   * programme is active. Needs `programId`.
   */
  readonly acceptsOnlineApplications: boolean;
  /** Shown among the featured pages on the app's home screen. */
  readonly featured: boolean;
  readonly featuredHeadline: string | null;
  /** Left out of the app's Tulong catalogue; still in the administrator's list (`SERVICE_EFFECTS.hide`). */
  readonly hiddenFromList: boolean;
  readonly badge: string | null;
  readonly iconKey: string | null;
  readonly tileColor: string | null;
  readonly legalBasis: string | null;
  readonly claimSteps: readonly string[];
  readonly schedule: string | null;
  readonly hasImage: boolean;
  readonly updatedAt: IsoDateTime;
  /** `null` while residents can read it; when, by whom and why once it is archived (`DL-225`). */
  readonly archived: ArchiveRecord | null;
}

/** The kinds of contact the API takes, exactly as `ServiceContact.type` lists them. */
export const SERVICE_CONTACT_TYPES = [
  'hotline',
  'landline',
  'mobile',
  'email',
  'facebook',
] as const;

export type ServiceContactType = (typeof SERVICE_CONTACT_TYPES)[number];

export const SERVICE_CONTACT_LABELS: Readonly<Record<ServiceContactType, string>> = {
  hotline: 'Hotline',
  landline: 'Landline',
  mobile: 'Mobile number',
  email: 'Email',
  facebook: 'Facebook page',
};

export interface ServiceContact {
  readonly type: ServiceContactType;
  readonly label: string | null;
  readonly value: string;
}

export interface ServiceLocation {
  readonly name: string;
  readonly address: string;
}

/* ── listing, defined once (rule 7) ──────────────────────────────────────── */

export type ServiceListing = 'listed' | 'unlisted';

export const SERVICE_LISTING_CATALOG: StatusCatalog<ServiceListing> = {
  listed: {
    value: 'listed',
    label: 'In the catalogue',
    tone: 'success',
    description: 'Residents find it in the app’s Tulong catalogue.',
  },
  unlisted: {
    value: 'unlisted',
    label: 'Hidden from the catalogue',
    tone: 'neutral',
    description:
      'Not in the catalogue. It still opens by its address, and on the home screen if featured.',
  },
};

export const SERVICE_LISTING_TRANSITIONS: StatusTransitions<ServiceListing> = {
  listed: ['unlisted'],
  unlisted: ['listed'],
};

export function listingOf(service: Pick<TulongService, 'hiddenFromList'>): ServiceListing {
  return service.hiddenFromList ? 'unlisted' : 'listed';
}

/* ── writes, as the API's contract declares them ─────────────────────────── */

/**
 * A new page, as `ServiceWrite` takes it. There is no `featured`: the API's create schema is strict
 * and refuses it, so a page is featured by a change after it exists.
 */
export interface ServiceDraft {
  readonly name: string;
  readonly slug: string;
  readonly category: string | null;
  readonly summary: string;
  readonly details: string;
  readonly eligibility: string | null;
  readonly requirements: readonly string[];
  readonly contacts: readonly ServiceContact[];
  readonly locations: readonly ServiceLocation[];
  readonly officeId: OfficeId | null;
  readonly programId: ProgramId | null;
  readonly acceptsOnlineApplications: boolean;
  readonly iconKey: string | null;
  readonly tileColor: string | null;
  readonly badge: string | null;
  readonly legalBasis: string | null;
  readonly claimSteps: readonly string[];
  readonly featuredHeadline: string | null;
  readonly schedule: string | null;
  readonly hiddenFromList: boolean;
}

/**
 * A change, as `ServicePatch` declares it — and only that. The handler also accepts the address,
 * category, eligibility, places and office on a change; the published contract does not declare
 * them, so this console does not send them (`check:wire-adoption`), and the screen says they are
 * fixed once the page exists (`SERVICE_FIXED_AFTER_CREATION`). `null` clears a field.
 */
export interface ServiceChanges {
  readonly name?: string;
  readonly summary?: string;
  readonly details?: string;
  readonly requirements?: readonly string[];
  readonly contacts?: readonly ServiceContact[];
  readonly featured?: boolean;
  readonly programId?: ProgramId | null;
  readonly acceptsOnlineApplications?: boolean;
  readonly iconKey?: string | null;
  readonly tileColor?: string | null;
  readonly badge?: string | null;
  readonly legalBasis?: string | null;
  readonly claimSteps?: readonly string[];
  readonly featuredHeadline?: string | null;
  readonly schedule?: string | null;
  readonly hiddenFromList?: boolean;
}

export const SERVICE_FIXED_AFTER_CREATION: readonly string[] = [
  'address',
  'category',
  'who it is for',
  'places',
  'office',
];

/** Read from `src/modules/services/schemas.ts` at `2736e28`. */
export const SERVICE_LIMITS = {
  name: 160,
  slug: 80,
  category: 80,
  summary: 300,
  details: 20000,
  eligibility: 2000,
  listItem: 300,
  listItems: 30,
  contacts: 20,
  contactLabel: 80,
  contactValue: 200,
  locations: 20,
  locationName: 120,
  locationAddress: 300,
  iconKey: 40,
  badge: 24,
  legalBasis: 500,
  featuredHeadline: 160,
  schedule: 500,
} as const;

/** `#RGB` or `#RRGGBB`, as the API checks a tile colour. */
export const TILE_COLOR_PATTERN = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

export type ServiceField = keyof ServiceDraft | 'featured';

/**
 * Every reason the server would refuse these values, by field. Takes the fields a draft and a change
 * share, so one form says the same thing either way.
 */
export function serviceProblems(
  values: Partial<ServiceDraft> & { readonly featured?: boolean },
): readonly FieldProblem<ServiceField>[] {
  const problems: FieldProblem<ServiceField>[] = [];
  const long = (
    field: ServiceField,
    label: string,
    value: string | null | undefined,
    limit: number,
  ) => {
    if (value !== null && value !== undefined && value.length > limit) {
      problems.push({
        field,
        message: `${label} is longer than the ${limit} characters the app takes.`,
      });
    }
  };
  const required = (field: ServiceField, value: string | undefined, message: string) => {
    if (value !== undefined && value.trim() === '') problems.push({ field, message });
  };
  const listOf = (field: ServiceField, label: string, items: readonly string[] | undefined) => {
    if (items === undefined) return;
    if (items.length > SERVICE_LIMITS.listItems) {
      problems.push({
        field,
        message: `The app takes at most ${SERVICE_LIMITS.listItems} ${label}.`,
      });
    }
    if (items.some((item) => item.length > SERVICE_LIMITS.listItem)) {
      problems.push({
        field,
        message: `Each of the ${label} is at most ${SERVICE_LIMITS.listItem} characters.`,
      });
    }
  };

  required('name', values.name, 'Give the page a name.');
  long('name', 'The name', values.name, SERVICE_LIMITS.name);
  if (values.slug !== undefined) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(values.slug)) {
      problems.push({
        field: 'slug',
        message:
          'An address is lower-case letters and numbers, in words joined by single hyphens, such ' +
          'as senior-citizen-id.',
      });
    }
    long('slug', 'The address', values.slug, SERVICE_LIMITS.slug);
  }
  required('summary', values.summary, 'Say in a sentence what the service is.');
  long('summary', 'The summary', values.summary, SERVICE_LIMITS.summary);
  required('details', values.details, 'Describe the service for the page.');
  long('details', 'The details', values.details, SERVICE_LIMITS.details);
  long('category', 'The category', values.category, SERVICE_LIMITS.category);
  long('eligibility', 'Who it is for', values.eligibility, SERVICE_LIMITS.eligibility);
  listOf('requirements', 'requirements', values.requirements);
  listOf('claimSteps', 'steps', values.claimSteps);
  if (values.contacts !== undefined) {
    if (values.contacts.length > SERVICE_LIMITS.contacts) {
      problems.push({
        field: 'contacts',
        message: `The app takes at most ${SERVICE_LIMITS.contacts} contacts.`,
      });
    }
    if (values.contacts.some((contact) => contact.value.trim() === '')) {
      problems.push({ field: 'contacts', message: 'Every contact needs a number or an address.' });
    }
    if (
      values.contacts.some(
        (contact) =>
          contact.value.length > SERVICE_LIMITS.contactValue ||
          (contact.label ?? '').length > SERVICE_LIMITS.contactLabel,
      )
    ) {
      problems.push({ field: 'contacts', message: 'A contact is longer than the app takes.' });
    }
  }
  if (values.locations !== undefined) {
    if (values.locations.length > SERVICE_LIMITS.locations) {
      problems.push({
        field: 'locations',
        message: `The app takes at most ${SERVICE_LIMITS.locations} places.`,
      });
    }
    if (values.locations.some((place) => place.name.trim() === '' || place.address.trim() === '')) {
      problems.push({ field: 'locations', message: 'Every place needs a name and an address.' });
    }
  }
  if (
    values.tileColor !== null &&
    values.tileColor !== undefined &&
    !TILE_COLOR_PATTERN.test(values.tileColor)
  ) {
    problems.push({
      field: 'tileColor',
      message: 'A tile colour is written #RGB or #RRGGBB, such as #1F6F8B.',
    });
  }
  long('iconKey', 'The icon name', values.iconKey, SERVICE_LIMITS.iconKey);
  long('badge', 'The badge', values.badge, SERVICE_LIMITS.badge);
  long('legalBasis', 'The legal basis', values.legalBasis, SERVICE_LIMITS.legalBasis);
  long(
    'featuredHeadline',
    'The headline',
    values.featuredHeadline,
    SERVICE_LIMITS.featuredHeadline,
  );
  long('schedule', 'The schedule', values.schedule, SERVICE_LIMITS.schedule);
  // The API's 422 and database check (`DL-228`): an application files under a programme.
  if (values.acceptsOnlineApplications === true && values.programId === null) {
    problems.push({
      field: 'acceptsOnlineApplications',
      message: 'Choose the office programme first: an application from the app is filed under it.',
    });
  }
  return problems;
}

/* ── what an act does, as the API says ───────────────────────────────────── */

/**
 * What each act on a Tulong page does in the residents' app, shown **before** the button (`DL-170`).
 *
 * Read from `taytay-backend` `2736e28`: `src/modules/services/routes.ts` (audited as
 * `service.created`, `service.updated` — an image upload included — with no reason), and
 * `src/modules/home/repository.ts` (the home screen's featured pages: newest first, six at most,
 * hidden ones included) — and `cc86189` (`DL-225`): nothing deletes a page; it is archived and
 * restored (`service.archived`, `service.restored`, each with a reason kept in its archive history);
 * an archived page leaves every public read, the home screen's featured pages included, keeps its
 * picture and its address, and takes no change until it is restored; a restore is refused while its
 * office is archived; a replaced picture stays in storage; the administrator's list
 * (`GET admin/services`) holds every page, hidden ones included.
 */
export const SERVICE_EFFECTS = {
  create: [
    'The page appears in the app’s Tulong catalogue, unless it is hidden from the catalogue.',
    'Unless it accepts online applications, it is information only: residents read it, and ' +
      'nothing in the app lets them apply through it.',
    'Its address, category, who it is for, places and office can be set only now. The API’s ' +
      'published contract declares no way to change them afterwards.',
    'A picture, and featuring it on the home screen, are added once the page exists.',
    'The server records that you created it, and when.',
  ],
  update: [
    'Residents see the change the next time the app loads the page.',
    'The server records that you changed it, and when. It keeps no reason, so none is asked for.',
  ],
  hide: [
    'The page leaves the app’s Tulong catalogue. It still opens from a link to its address, and ' +
      'still shows on the home screen while it is featured.',
    'It stays in this list, marked as hidden from the catalogue, and can be shown again.',
  ],
  show: ['The page returns to the app’s Tulong catalogue.'],
  feature: [
    'The page joins the featured pages on the app’s home screen. The home screen shows the six ' +
      'newest featured pages, so featuring a seventh pushes the oldest off it.',
  ],
  unfeature: ['The page leaves the featured pages on the app’s home screen.'],
  // Applying from the app (`DL-228`; the API's ADR 0004 decision 2, `can_apply`).
  acceptApplications: [
    'Residents whose accounts are verified and linked to a registry record see Apply on this ' +
      'page in the app, while the page is in use and its programme is active. Anybody else is ' +
      'told what to do first.',
    'An application files an assistance request under the programme, with a control number, in ' +
      'the intake queue as “Applied in the app”, with the documents the resident sent and what the ' +
      'duplicate check found. Intake reviews it as any other request.',
  ],
  stopApplications: [
    'Apply leaves the page in the app. Applications already sent stay in the intake queue.',
  ],
  programChanged: ['Applications sent from this page from now on are filed under this programme.'],
  imageReplaced: [
    'The image replaces the page’s picture in the app at once. The old one stays stored on the ' +
      'server; nothing deletes it.',
    'The server records it as a change to the page.',
  ],
  imageAdded: [
    'The image becomes the page’s picture in the app at once.',
    'The server records it as a change to the page.',
  ],
  archive: [
    'The page leaves the app. Residents can no longer find it in the Tulong catalogue or among the ' +
      'featured pages on the home screen, and a link to its address stops opening it.',
    'It stays here under Archived, with its picture, your name, the date and your reason, and its ' +
      'address stays reserved for it.',
    'It can be restored, and comes back as it was.',
    'The server records that you archived it, when, and why.',
  ],
  restore: [
    'The page returns to the app as it was: in the Tulong catalogue unless it is hidden from it, ' +
      'and among the featured pages on the home screen if it is featured.',
    'The server refuses while the page’s office is archived: restore the office first.',
    'The server records that you restored it, when, and why.',
  ],
} as const;

/** How many featured pages the app's home screen shows (`home/routes.ts`, `featuredServices(6)`). */
export const HOME_FEATURED_SERVICES = 6;
