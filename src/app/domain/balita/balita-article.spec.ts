import { describe, expect, it } from 'vitest';

import {
  BALITA_COVER_EFFECTS,
  BALITA_EFFECTS,
  BALITA_LIMITS,
  BALITA_STATUS_TRANSITIONS,
  balitaProblem,
} from './balita-article';

describe('Balita (DL-171)', () => {
  it('publishes a draft and takes a published article off, as the API does', () => {
    expect(BALITA_STATUS_TRANSITIONS.draft).toEqual(['published']);
    expect(BALITA_STATUS_TRANSITIONS.published).toEqual(['draft']);
  });

  it('refuses an article without a title or words, or past the API’s limits', () => {
    expect(balitaProblem('', 'words')).toBe('An article needs a title.');
    expect(balitaProblem('Title', '  ')).toBe('An article needs words.');
    expect(balitaProblem('x'.repeat(BALITA_LIMITS.title + 1), 'words')).toContain('160');
    expect(balitaProblem('Title', 'words')).toBeNull();
  });

  it('says publishing cannot be recalled, before anybody publishes', () => {
    const publish = BALITA_EFFECTS.publish.join(' ');
    expect(publish).toContain('cannot be recalled from anybody who has read it');
    expect(publish).toContain('sends no notification');
    expect(BALITA_EFFECTS.unpublish.join(' ')).toContain('keeps its first publication date');
  });

  it('says the API keeps no description of a cover', () => {
    expect(BALITA_COVER_EFFECTS.join(' ')).toContain('The API keeps no description of the cover');
  });
});
