import type { IsoDateTime, OfficeId } from '../shared/ids';

/**
 * An office's entry in the residents' app directory, as an administrator keeps it (`DL-170`).
 *
 * Wider than `Office` (`DL-168`), which carries only what names an office in a picker: this is the
 * entry itself — what a resident reads on the office's page in the app. All of it is about the
 * office, none of it about a person, except the head's name, which the office publishes.
 *
 * The banner is said as present or absent, never as an address: the API answers its bytes at a
 * public route, and a template bound to that address would load it from another origin behind the
 * console's image policy (`check:headers`).
 */
export interface DirectoryOffice {
  readonly id: OfficeId;
  readonly name: string;
  /** The address the app opens the office's page by: `offices/{slug}`. */
  readonly slug: string;
  readonly shortName: string | null;
  readonly category: string | null;
  readonly description: string | null;
  readonly head: string | null;
  readonly hours: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly hasBanner: boolean;
  readonly updatedAt: IsoDateTime;
}

/** A new office, as `OfficeWrite` takes it. `null` sends nothing. */
export interface OfficeDraft {
  readonly name: string;
  readonly slug: string;
  readonly shortName: string | null;
  readonly category: string | null;
  readonly description: string | null;
  readonly head: string | null;
  readonly hours: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly address: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
}

/**
 * A change to an office, as `OfficePatch` declares it — and **only** that.
 *
 * The backend's handler accepts every field of `OfficeWrite` on a change, but the published contract
 * declares four, and the contract is what this console is held to (`check:wire-adoption`): a field
 * it does not declare is one the server may drop while reporting success. The other fields are set
 * when the office is created, and the screen says so (`OFFICE_FIXED_AFTER_CREATION`).
 *
 * `shortName` has no `null`: the change travels as a form, which cannot carry one, and the server
 * refuses an empty one — so a short name can be replaced here but not cleared.
 */
export interface OfficeChanges {
  readonly name?: string;
  readonly slug?: string;
  readonly shortName?: string;
  readonly category?: string;
}

/** The fields a change cannot reach, named for the screen. */
export const OFFICE_FIXED_AFTER_CREATION: readonly string[] = [
  'description',
  'head',
  'hours',
  'phone',
  'email',
  'address',
  'map position',
];

/* ── the API's own limits, so a form refuses before the server does ─────── */

/**
 * Read from `src/modules/offices/schemas.ts` at `2736e28`. The server is the boundary; these let a
 * form say what is wrong before anything is sent.
 */
export const OFFICE_LIMITS = {
  name: 120,
  slug: 80,
  shortName: 40,
  description: 2000,
  head: 120,
  hours: 200,
  phone: 32,
  email: 200,
  address: 300,
  category: 80,
} as const;

/** Lower-case words joined by single hyphens: `mswdo`, `civil-registrar`. */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export type OfficeField = keyof OfficeDraft;

export interface FieldProblem<TField extends string> {
  readonly field: TField;
  readonly message: string;
}

const tooLong = (label: string, limit: number): string =>
  `${label} is longer than the ${limit} characters the app takes.`;

/** Every reason the server would refuse this office, in words, by field. */
export function officeDraftProblems(draft: OfficeDraft): readonly FieldProblem<OfficeField>[] {
  const problems: FieldProblem<OfficeField>[] = [];
  const check = (field: OfficeField, label: string, value: string | null, limit: number): void => {
    if (value !== null && value.length > limit) {
      problems.push({ field, message: tooLong(label, limit) });
    }
  };

  if (draft.name.trim() === '') {
    problems.push({ field: 'name', message: 'Give the office a name.' });
  }
  check('name', 'The name', draft.name, OFFICE_LIMITS.name);
  problems.push(
    ...slugProblems(draft.slug).map((message) => ({ field: 'slug' as const, message })),
  );
  check('shortName', 'The short name', draft.shortName, OFFICE_LIMITS.shortName);
  check('category', 'The category', draft.category, OFFICE_LIMITS.category);
  check('description', 'The description', draft.description, OFFICE_LIMITS.description);
  check('head', 'The head’s name', draft.head, OFFICE_LIMITS.head);
  check('hours', 'The hours', draft.hours, OFFICE_LIMITS.hours);
  check('phone', 'The phone number', draft.phone, OFFICE_LIMITS.phone);
  check('address', 'The address', draft.address, OFFICE_LIMITS.address);
  check('email', 'The email address', draft.email, OFFICE_LIMITS.email);
  if (draft.email !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email)) {
    problems.push({ field: 'email', message: 'That does not look like an email address.' });
  }
  if (draft.latitude !== null && (draft.latitude < -90 || draft.latitude > 90)) {
    problems.push({ field: 'latitude', message: 'A latitude is between -90 and 90.' });
  }
  if (draft.longitude !== null && (draft.longitude < -180 || draft.longitude > 180)) {
    problems.push({ field: 'longitude', message: 'A longitude is between -180 and 180.' });
  }
  return problems;
}

/** The same rules, for the four fields a change can carry. */
export function officeChangeProblems(
  changes: OfficeChanges,
): readonly FieldProblem<keyof OfficeChanges>[] {
  const problems: FieldProblem<keyof OfficeChanges>[] = [];
  if (changes.name !== undefined) {
    if (changes.name.trim() === '')
      problems.push({ field: 'name', message: 'Give the office a name.' });
    if (changes.name.length > OFFICE_LIMITS.name) {
      problems.push({ field: 'name', message: tooLong('The name', OFFICE_LIMITS.name) });
    }
  }
  if (changes.slug !== undefined) {
    problems.push(
      ...slugProblems(changes.slug).map((message) => ({ field: 'slug' as const, message })),
    );
  }
  if (changes.shortName !== undefined && changes.shortName.length > OFFICE_LIMITS.shortName) {
    problems.push({
      field: 'shortName',
      message: tooLong('The short name', OFFICE_LIMITS.shortName),
    });
  }
  if (changes.category !== undefined && changes.category.length > OFFICE_LIMITS.category) {
    problems.push({ field: 'category', message: tooLong('The category', OFFICE_LIMITS.category) });
  }
  return problems;
}

export function slugProblems(slug: string): readonly string[] {
  if (slug === '') {
    return ['Give the office an address for the app, such as mswdo.'];
  }
  const problems: string[] = [];
  if (!SLUG_PATTERN.test(slug)) {
    problems.push(
      'An address is lower-case letters and numbers, in words joined by single hyphens, such as ' +
        'civil-registrar.',
    );
  }
  if (slug.length > OFFICE_LIMITS.slug) {
    problems.push(tooLong('The address', OFFICE_LIMITS.slug));
  }
  return problems;
}

/* ── what an act does, as the API says ───────────────────────────────────── */

/**
 * What each act on an office does in the residents' app, shown **before** the button (`DL-170`).
 *
 * Read from the backend, not assumed: `taytay-backend` `2736e28` — `src/modules/offices/routes.ts`
 * (create, change and delete audited as `office.created`, `office.updated`, `office.deleted`, with
 * no reason; a new banner deletes the old image; the banner is set only when a file is sent, so it
 * cannot be removed), `src/modules/offices/repository.ts` (a delete refused with `409` on any
 * reference; nothing else removed with the row), and the four foreign keys on `offices` in
 * `migrations/0004`–`0007` (staff accounts, Balita, Tulong pages, conversations, none of them
 * cascading). If the backend changes, these sentences are wrong until somebody reads it again.
 */
export const OFFICE_EFFECTS = {
  create: [
    'The office appears in the app’s office directory, where any resident can find it and open ' +
      'its page.',
    'Its description, head, hours, phone, email, address and map position can be set only now. ' +
      'The API’s published contract declares no way to change them afterwards.',
    'The server records that you created it, and when.',
  ],
  update: [
    'Residents see the change in the app’s directory the next time the app loads it.',
    'The server records that you changed it, and when. It keeps no reason, so none is asked for.',
  ],
  slug: [
    'The app opens the office’s page by this address. Anything that kept the old one — a link, a ' +
      'shortcut in the app — stops finding it.',
  ],
  bannerReplaced: [
    'The new image replaces the banner on the office’s page in the app. The server deletes the ' +
      'old one.',
  ],
  bannerAdded: ['The image becomes the banner on the office’s page in the app.'],
  remove: [
    'The office leaves the app’s directory. Residents can no longer find it or open its page.',
    'The server refuses while anything still names the office: a staff account assigned to it, a ' +
      'Balita article, a Tulong page, or a conversation with a resident. Its refusal does not say ' +
      'which; move or remove those first.',
    'Nothing brings it back. Creating it again makes a new office that nothing already written ' +
      'points to.',
    'Its banner image stays stored on the server; nothing removes it.',
    'The server records that you deleted it, and when.',
  ],
} as const;

/** Said beside the banner field: what the API cannot do with one. */
export const OFFICE_BANNER_LIMIT =
  'A banner can be replaced but not removed: the API has no way to take one away.';
