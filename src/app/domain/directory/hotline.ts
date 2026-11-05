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
  /** Free text: the API keeps no list of categories. */
  readonly category: string;
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
