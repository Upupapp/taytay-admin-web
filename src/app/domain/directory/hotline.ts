import type { HotlineId, IsoDateTime } from '../shared/ids';

import type { FieldProblem } from './directory-office';

/**
 * A number the residents' app lists for a resident to call — the police, the fire station, the
 * MSWDO's own line (`DL-170`).
 *
 * A wrong digit here is a resident in an emergency calling a stranger, so the number is shown
 * exactly as stored, a change to it says so before it is saved, and the list says when it may not be
 * the whole of what the app holds (`HOTLINE_LIST_CAP`).
 */
export interface Hotline {
  readonly id: HotlineId;
  readonly name: string;
  readonly number: string;
  /** Free text: the API keeps no list of categories, and no client picks a line by it. */
  readonly category: string;
  /** What the line is for, so a client picks a line by it rather than by its name (`DL-217`). */
  readonly kind: HotlineKind;
  /** The app lists hotlines by this number, lowest first, then by name. */
  readonly sortOrder: number;
  /** Shown in the app. An inactive hotline is kept here and shown nowhere else. */
  readonly active: boolean;
  readonly updatedAt: IsoDateTime;
}

export interface HotlineDraft {
  readonly name: string;
  readonly number: string;
  readonly category: string;
  readonly kind: HotlineKind;
  readonly sortOrder: number;
  readonly active: boolean;
}

/** A change: any of the draft's fields, as `HotlinePatch` declares them. */
export type HotlineChanges = Partial<HotlineDraft>;

/**
 * The most hotlines the API sends, to this console and to the app alike — `HOTLINE_LIST_CAP` in
 * `src/modules/hotlines/repository.ts` at `2736e28`. The answer carries no "more": a list of exactly
 * this many may be missing some, and the screen says so rather than presenting it as the whole.
 */
export const HOTLINE_LIST_CAP = 100;

/** Read from `src/modules/hotlines/schemas.ts` and `src/http/phone.ts` at `2736e28`. */
export const HOTLINE_LIMITS = { name: 120, number: 32, category: 40, sortOrderMax: 1000 } as const;

/** Digits, spaces and `+ ( ) . -`, two to thirty-two of them, at least two of them digits. */
export function isDialable(number: string): boolean {
  return /^[0-9+(). -]{2,32}$/.test(number) && (number.match(/[0-9]/g) ?? []).length >= 2;
}

export function hotlineProblems(
  values: HotlineChanges,
): readonly FieldProblem<keyof HotlineDraft>[] {
  const problems: FieldProblem<keyof HotlineDraft>[] = [];

  if (values.name !== undefined) {
    if (values.name.trim() === '') problems.push({ field: 'name', message: 'Name the line.' });
    if (values.name.length > HOTLINE_LIMITS.name) {
      problems.push({
        field: 'name',
        message: `A name is at most ${HOTLINE_LIMITS.name} characters.`,
      });
    }
  }
  if (values.number !== undefined && !isDialable(values.number)) {
    problems.push({
      field: 'number',
      message:
        'A number is digits, with spaces and + ( ) . - if wanted, up to 32 characters — such as ' +
        '(02) 8123 4567 or 911.',
    });
  }
  if (values.category !== undefined) {
    if (values.category.trim() === '') {
      problems.push({
        field: 'category',
        message: 'Say what kind of line it is, such as Emergency.',
      });
    }
    if (values.category.length > HOTLINE_LIMITS.category) {
      problems.push({
        field: 'category',
        message: `A category is at most ${HOTLINE_LIMITS.category} characters.`,
      });
    }
  }
  if (
    values.sortOrder !== undefined &&
    (!Number.isInteger(values.sortOrder) ||
      values.sortOrder < 0 ||
      values.sortOrder > HOTLINE_LIMITS.sortOrderMax)
  ) {
    problems.push({
      field: 'sortOrder',
      message: `The order is a whole number from 0 to ${HOTLINE_LIMITS.sortOrderMax}.`,
    });
  }
  return problems;
}

/**
 * What each act on a hotline does in the residents' app, shown **before** the button (`DL-170`).
 *
 * Read from `taytay-backend` `2736e28`: `src/modules/hotlines/routes.ts` (audited as
 * `hotline.created`, `hotline.updated`, `hotline.deleted`, with no reason), `repository.ts` (the
 * app's list is active lines only, by order then name, at most a hundred; a delete removes the row),
 * and `src/modules/home/routes.ts` (the home screen carries every active line).
 */
export const HOTLINE_EFFECTS = {
  createShown: [
    'The number appears in the app’s hotline list and on its home screen, for any resident to call.',
    'The server records that you added it, and when.',
  ],
  createHidden: [
    'The number is kept here and shown nowhere in the app until it is made active.',
    'The server records that you added it, and when.',
  ],
  update: [
    'Residents see the change the next time the app loads its hotlines.',
    'The server records that you changed it, and when. It keeps no reason, so none is asked for.',
  ],
  number: ['A resident who taps this line in the app calls the new number from then on.'],
  hide: [
    'The number leaves the app’s hotline list and home screen. It is kept here, and can be shown ' +
      'again.',
  ],
  show: ['The number appears in the app’s hotline list and on its home screen again.'],
  remove: [
    'The number is deleted. It leaves the app’s hotline list and home screen.',
    'Nothing brings it back: adding it again makes a new entry. To take it out of the app for a ' +
      'while, make it inactive instead.',
    'The server records that you deleted it, and when.',
  ],
} as const;

/* ── what a line is for (`DL-217`) ──────────────────────────────────────────── */

/**
 * `HotlineKind`, as the API declares it at `ebd7aeb` — `check:directory` holds this list to the
 * vendored spec's enum. A client picks a line by its kind, never by its name or category: the
 * residents' app shows the active command center when it tells a resident to call for an emergency.
 */
export const HOTLINE_KINDS = [
  'command-center',
  'emergency',
  'police',
  'fire',
  'medical',
  'disaster',
  'other',
] as const;

export type HotlineKind = (typeof HOTLINE_KINDS)[number];

export function isHotlineKind(value: unknown): value is HotlineKind {
  return typeof value === 'string' && (HOTLINE_KINDS as readonly string[]).includes(value);
}

/** Each kind in words, as the form offers it and the list shows it — text, never a colour alone. */
export const HOTLINE_KIND_LABELS: Readonly<Record<HotlineKind, string>> = {
  'command-center': 'Command center',
  emergency: 'Emergency 911',
  police: 'Police',
  fire: 'Fire',
  medical: 'Medical',
  disaster: 'Disaster and rescue',
  other: 'Other',
};

/**
 * The one active line the app shows when it tells residents to call for an emergency, or `null`
 * when no active line is marked as the command center. The server allows at most one (a partial
 * unique index), so a second in a list is not something to choose between.
 */
export function activeCommandCenter(hotlines: readonly Hotline[]): Hotline | null {
  return hotlines.find((line) => line.active && line.kind === 'command-center') ?? null;
}

/**
 * The line that already holds the command center role, when saving `line` as it would be would make
 * a second active one — which the server refuses with a 409. The office's own list, read a moment
 * ago, so it warns and never blocks: the server decides (`DL-129`'s rule).
 */
export function commandCenterHolder(
  line: { readonly id: HotlineId | null; readonly kind: HotlineKind; readonly active: boolean },
  holder: Hotline | null,
): Hotline | null {
  return line.active && line.kind === 'command-center' && holder !== null && holder.id !== line.id
    ? holder
    : null;
}

/**
 * The server refused a line because another active line is the command center (409, `ebd7aeb`),
 * with its own words, so the form can say it beside the kind it is about.
 */
export class HotlineCommandCenterTakenError extends Error {
  readonly field = 'kind';

  constructor(message: string) {
    super(message);
    this.name = 'HotlineCommandCenterTakenError';
  }
}

export function isCommandCenterTaken(error: unknown): error is HotlineCommandCenterTakenError {
  return error instanceof HotlineCommandCenterTakenError;
}

/**
 * What a change to the command center does, before the button (`DL-217`). Read from `ebd7aeb`: one
 * active `command-center` at most, a second refused rather than moved — the old line is changed or
 * made inactive first — and nobody made the command center by inference after the backfill.
 */
export const COMMAND_CENTER_EFFECTS = {
  taken: (name: string, number: string) => [
    `${name} (${number}) is the command center now, and only one active line can be. The server ` +
      `will refuse this until ${name} is given another kind or made inactive: change that line ` +
      'first, then this one.',
  ],
  becomes: [
    'This becomes the line the app shows when it tells residents to call for an emergency.',
  ],
  leaves: [
    'No line will be the command center: the app will have no line of the office’s own to show ' +
      'when it tells residents to call for an emergency, until another is marked as one.',
  ],
} as const;

/** The command center's part of what a save does: it becomes one, it stops being one, or neither. */
export function commandCenterEffects(
  before: { readonly kind: HotlineKind; readonly active: boolean } | null,
  after: { readonly kind: HotlineKind; readonly active: boolean },
): readonly string[] {
  const was = before !== null && before.active && before.kind === 'command-center';
  const is = after.active && after.kind === 'command-center';
  if (is && !was) return COMMAND_CENTER_EFFECTS.becomes;
  if (was && !is) return COMMAND_CENTER_EFFECTS.leaves;
  return [];
}
