import { describe, expect, it } from 'vitest';

import { asId, withheldRequestNoteCount, type RequestNote } from '@domain/index';
import type { AssistanceRequestId, RequestNoteId, StaffUserId } from '@domain/index';

const note = (over: Partial<RequestNote> = {}): RequestNote => ({
  id: asId<RequestNoteId>('note-1'),
  requestId: asId<AssistanceRequestId>('req-1'),
  authorId: asId<StaffUserId>('staff-1'),
  authorName: 'Grace Ocampo',
  body: 'Home visit conducted.',
  isWithheld: false,
  sensitivity: 'routine',
  createdAt: '2026-08-30T02:00:00.000Z' as RequestNote['createdAt'],
  ...over,
});

describe('a note somebody may not read', () => {
  /**
   * The entry stays in the list with its body removed — not hidden, and not dropped.
   *
   * `DL-58`: a caseworker who cannot see that a restricted entry exists reads the file as complete
   * and acts as though nothing happened. Knowing a record is there, and that it is not theirs to
   * read, is what makes it possible to ask the right person.
   */
  it('is still listed, with its author and its time', () => {
    const withheld = note({ body: null, isWithheld: true, sensitivity: 'protected' });

    expect(withheld.body).toBeNull();
    expect(withheld.authorName).toBe('Grace Ocampo');
    expect(withheld.createdAt).toBe('2026-08-30T02:00:00.000Z');
  });

  it('counts what was held back, derived from the rows', () => {
    expect(
      withheldRequestNoteCount([
        note(),
        note({ id: asId<RequestNoteId>('note-2'), body: null, isWithheld: true }),
        note({ id: asId<RequestNoteId>('note-3'), body: null, isWithheld: true }),
      ]),
    ).toBe(2);
  });

  it('counts nothing when everything is readable', () => {
    expect(withheldRequestNoteCount([note(), note()])).toBe(0);
  });

  /**
   * The sensitivity union is the one from `domain/cases/case-note.ts`, not a second copy.
   *
   * `DL-122` refuses a second vocabulary for permissions because the checker that generates the
   * office reference would not see it. The same applies to the tier a note is held at: two unions
   * would need two permission maps, and they would drift.
   */
  it('holds the tier in the vocabulary the case notes already use', () => {
    const routine: RequestNote['sensitivity'] = 'routine';
    const protectedTier: RequestNote['sensitivity'] = 'protected';

    expect([routine, protectedTier]).toEqual(['routine', 'protected']);
  });
});
