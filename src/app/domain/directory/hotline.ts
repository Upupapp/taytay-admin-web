import type { ArchiveRecord } from '../shared/archive';
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
  /**
   * What the line is for, so a client picks a line by it rather than by its name (`DL-217`).
   * `null` is **not set**: the API sent no kind, as one older than `ebd7aeb` does (`DL-220`). It is
   * shown as "Type not set" and can be edited; it is never read as `other`, which would be a claim
   * about the line nobody made.
   */
  readonly kind: HotlineKind | null;
  /** The app lists hotlines by this number, lowest first, then by name. */
  readonly sortOrder: number;
  /** Shown in the app. An inactive hotline is kept here and shown nowhere else. */
  readonly active: boolean;
  readonly updatedAt: IsoDateTime;
  /**
   * `null` while it is in use, active or not; when, by whom and why once it is archived (`DL-225`).
   * An archived line is in no list the app reads, whatever `active` says.
   */
  readonly archived: ArchiveRecord | null;
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
 * The most hotlines the API reads whole — `HOTLINE_LIST_CAP` in `src/modules/hotlines/repository.ts`.
 * Since `ca71f23` a longer list is **refused** with a 503 rather than cut short, so an answer is the
 * whole list, however long, and the console no longer says one as long as the cap may be missing
 * lines (`DL-225`).
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
 * `hotline.created`, `hotline.updated`, with no reason), `repository.ts` (the app's list is active
 * lines only, by order then name), and `src/modules/home/routes.ts` (the home screen carries every
 * active line) — and `cc86189` (`DL-225`): nothing deletes a line; it is archived and restored
 * (`hotline.archived`, `hotline.restored`, each with a reason kept in its archive history); an
 * archived line is in no public read and takes no change until it is restored; the one-command-center
 * rule ignores archived lines, so a restore that would make a second active one is refused.
 */
export const HOTLINE_EFFECTS = {
  createShown: [
    'The number appears in the app’s hotline list and on its home screen, for any resident to call.',
    'The system records that you added it, and when.',
  ],
  createHidden: [
    'The number is kept here and shown nowhere in the app until it is made active.',
    'The system records that you added it, and when.',
  ],
  update: [
    'Residents see the change the next time the app loads its hotlines.',
    'The system records that you changed it, and when. It keeps no reason, so none is asked for.',
  ],
  number: ['A resident who taps this line in the app calls the new number from then on.'],
  hide: [
    'The number leaves the app’s hotline list and home screen. It is kept here, and can be shown ' +
      'again.',
  ],
  show: ['The number appears in the app’s hotline list and on its home screen again.'],
  archive: [
    'The number leaves the app’s hotline list and home screen, whether it is active or not.',
    'It stays here under Archived, with your name, the date and your reason, and can be restored.',
    'The system records that you archived it, when, and why.',
  ],
  restore: [
    'The line returns as it was: in the app’s hotline list and on its home screen if it is active, ' +
      'and kept here only if it is not.',
    'If it is an active command center and another active line holds that role now, the system ' +
      'refuses: change that line first.',
    'The system records that you restored it, when, and why.',
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

/** A line whose kind the API did not send (`DL-220`), in words. */
export const HOTLINE_KIND_NOT_SET = 'Type not set';

/** A line's kind in words, or that it is not set. */
export function hotlineKindLabel(kind: HotlineKind | null): string {
  return kind === null ? HOTLINE_KIND_NOT_SET : HOTLINE_KIND_LABELS[kind];
}

/** How many lines have no kind set: an API older than kinds, or a line nobody has typed yet. */
export function linesWithoutKind(hotlines: readonly Hotline[]): number {
  return hotlines.filter((line) => line.kind === null).length;
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
  line: {
    readonly id: HotlineId | null;
    readonly kind: HotlineKind | null;
    readonly active: boolean;
  },
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
  before: { readonly kind: HotlineKind | null; readonly active: boolean } | null,
  after: { readonly kind: HotlineKind | null; readonly active: boolean },
): readonly string[] {
  const was = before !== null && before.active && before.kind === 'command-center';
  const is = after.active && after.kind === 'command-center';
  if (is && !was) return COMMAND_CENTER_EFFECTS.becomes;
  if (was && !is) return COMMAND_CENTER_EFFECTS.leaves;
  return [];
}
