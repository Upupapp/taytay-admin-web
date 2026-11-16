import {
  actorInSentence,
  isArchiveRefusal,
  officeInUseWords,
  type ArchiveRefusalKind,
} from '@domain/index';
import { failureReason } from '../state/failure-reason';

/**
 * The words every archive and restore says the same way (`DL-225`), wherever the record lives: the
 * tabs, the dialog, the history, and a plain sentence for each refusal — never the API's code.
 */
export const ARCHIVE_COPY = {
  tabs: {
    inUse: 'In use',
    archived: 'Archived',
  },
  dialog: {
    effectsLead: 'What this does:',
    reasonLabel: 'Reason',
    reasonHint:
      'Required, up to 500 characters. Kept with the record under your name, and shown in its ' +
      'archive history.',
    cancel: 'Cancel',
    busy: 'Saving…',
  },
  row: {
    archivedOn: (date: string, name: string | null): string =>
      name === null ? `Archived ${date}` : `Archived ${date} by ${actorInSentence(name)}`,
    reason: (reason: string): string => `Reason: ${reason}`,
    noReason: 'No reason was recorded.',
    history: 'History',
  },
  history: {
    heading: 'Archive history',
    lead: 'Every time this was archived and restored, newest first. Nothing here can be changed.',
    empty: 'It has never been archived.',
    archived: 'Archived',
    restored: 'Restored',
    by: 'by',
    reasonGiven: 'Reason given',
    noReason: 'No reason was recorded.',
    failed: 'The archive history could not be read',
    close: 'Close',
  },
  refusal: {
    'already-archived': (noun: string): string =>
      `Someone else archived this ${noun} a moment ago, so nothing was done. It is under ` +
      'Archived now.',
    'not-archived': (noun: string): string =>
      `Someone else restored this ${noun} a moment ago, so nothing was done. It is under In use ` +
      'now.',
    'read-only': (noun: string): string =>
      `This ${noun} was archived while you were working on it, so nothing was saved. An archived ` +
      `${noun} cannot be changed: restore it first, then make the change.`,
    'office-in-use': (): string =>
      'The office is still in use, so it was not archived. It stays under In use until nothing ' +
      'uses it:',
    'office-archived': (): string =>
      'That office has been archived, so nothing was put under it. Choose an office in use, or ' +
      'restore that office first under App directory, Offices, Archived.',
  } satisfies Readonly<Record<ArchiveRefusalKind, (noun: string) => string>>,
} as const;

/** What a refusal says in plain words: a sentence, and the counts' own lines when there are any. */
export interface ArchiveRefusalWords {
  readonly sentence: string;
  readonly lines: readonly string[];
}

/**
 * The plain sentence for an archive refusal, or `null` for any other failure — which keeps its own
 * words. Never the API's code (`DL-225`).
 */
export function archiveRefusalWords(failure: unknown, noun: string): ArchiveRefusalWords | null {
  if (!isArchiveRefusal(failure)) {
    return null;
  }
  return {
    sentence: ARCHIVE_COPY.refusal[failure.kind](noun),
    lines: failure.inUse === null ? [] : officeInUseWords(failure.inUse),
  };
}

/**
 * What a refused act says: the archive refusal's plain sentence and its lines, or the failure's own
 * words, or `fallback` when it carries none.
 */
export function plainRefusal(failure: unknown, noun: string, fallback: string): string {
  const words = archiveRefusalWords(failure, noun);
  if (words !== null) {
    return [words.sentence, ...words.lines].join(' ');
  }
  return failureReason(failure) ?? fallback;
}

/** Somebody else archived or restored it first: the list is worth reading again. */
export function movedByOthers(failure: unknown): boolean {
  return (
    isArchiveRefusal(failure) &&
    (failure.kind === 'already-archived' || failure.kind === 'not-archived')
  );
}
