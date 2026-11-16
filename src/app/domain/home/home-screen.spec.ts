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

  it('says an image outlives what replaces or archives its banner', () => {
    expect(HOME_EFFECTS.imageReplaced.join(' ')).toContain('stays stored on the server');
    expect(HOME_EFFECTS.imageUpload.join(' ')).toContain('If the banner is then refused');
    expect(HOME_EFFECTS.bannerArchive.join(' ')).toContain('Its image stays stored on the server');
    expect(HOME_EFFECTS.linkCreate.join(' ')).toContain('there is no hidden link');
  });

  it('archives a banner or a link with a reason, and restores it as it was (DL-225)', () => {
    expect(HOME_EFFECTS.bannerArchive.join(' ')).toContain('whether it is shown or hidden');
    expect(HOME_EFFECTS.bannerArchive.join(' ')).toContain('your name, the date and your reason');
    expect(HOME_EFFECTS.bannerRestore.join(' ')).toContain('returns as it was');
    expect(HOME_EFFECTS.linkArchive.join(' ')).toContain('can be restored');
    expect(HOME_EFFECTS.linkRestore.join(' ')).toContain('in its place in the order');
    for (const effects of [
      HOME_EFFECTS.bannerArchive,
      HOME_EFFECTS.bannerRestore,
      HOME_EFFECTS.linkArchive,
      HOME_EFFECTS.linkRestore,
    ]) {
      expect(effects.join(' ')).toMatch(
        /The server records that you (archived|restored) it, when, and why/,
      );
    }
  });

  it('never says a banner, a link or an image is deleted (DL-225)', () => {
    const said = Object.values(HOME_EFFECTS).flat().join(' ');
    expect(said).not.toMatch(/\bis deleted\b|deleted it|\bdeletes the\b/i);
    expect(said).not.toContain('Nothing brings it back');
  });
});
