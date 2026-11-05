import { describe, expect, it } from 'vitest';

import { BANNER_NO_DESCRIPTION, bannerProblems, HOME_EFFECTS, linkProblems } from './home-screen';

describe('the home screen (DL-170)', () => {
  it('refuses what the API refuses for a banner', () => {
    expect(bannerProblems({ title: 'Senior IDs', href: null, sortOrder: 1, active: true })).toEqual(
      [],
    );
    expect(
      bannerProblems({ title: ' ', href: 'x'.repeat(301), sortOrder: 1001, active: true }).map(
        (problem) => problem.field,
      ),
    ).toEqual(['title', 'href', 'sortOrder']);
  });

  it('asks a link for a label and somewhere to go', () => {
    expect(linkProblems({ label: '', href: '', sortOrder: 0 }).map((p) => p.field)).toEqual([
      'label',
      'href',
    ]);
  });

  it('says the API keeps no description of a banner’s image, rather than collecting one', () => {
    expect(BANNER_NO_DESCRIPTION).toContain('the API keeps none');
  });

  it('says an image outlives what replaces or deletes it, and offers hiding before deleting', () => {
    expect(HOME_EFFECTS.imageReplaced.join(' ')).toContain('stays stored on the server');
    expect(HOME_EFFECTS.imageUpload.join(' ')).toContain('If the banner is then refused');
    expect(HOME_EFFECTS.bannerRemove.join(' ')).toContain('hide it instead');
    expect(HOME_EFFECTS.linkCreate.join(' ')).toContain('there is no hidden link');
  });
});
