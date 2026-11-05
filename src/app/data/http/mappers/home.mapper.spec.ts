import { describe, expect, it } from 'vitest';

import BANNERS from '../fixtures/banners.json';
import HOME from '../fixtures/home.json';
import LINK from '../fixtures/link.json';
import MEDIA from '../fixtures/media.json';
import {
  toHomeBanner,
  toHomePreview,
  toQuickLink,
  toStoredMedia,
  toWireMediaUpload,
} from './home.mapper';

describe('the home screen mappers (DL-170)', () => {
  it('reads a banner, its image as an id and never as an address', () => {
    const [shown, hidden] = BANNERS.data.map(toHomeBanner);

    expect(shown).toMatchObject({ title: 'Senior citizen IDs, every weekday', active: true });
    expect(shown?.mediaId).toBe('8e2f1d5b-3c4a-4b6f-8d9e-1f2a3b4c5d70');
    expect(hidden).toMatchObject({ mediaId: null, href: null, active: false });
    expect(JSON.stringify(shown)).not.toContain('image_url');
    expect(JSON.stringify(shown)).not.toContain('/image');
  });

  it('never guesses whether a banner is shown', () => {
    expect(toHomeBanner({ ...BANNERS.data[0], active: undefined })).toBeNull();
  });

  it('reads a link, and refuses one with nowhere to go', () => {
    expect(toQuickLink(LINK.data)?.label).toBe('Hotlines');
    expect(toQuickLink({ ...LINK.data, href: '' })).toBeNull();
  });

  it('reads the home screen as names and counts, never the words of an article', () => {
    const preview = toHomePreview(HOME.data);

    expect(preview).toMatchObject({
      featuredServices: ['Senior citizen ID'],
      hotlines: 1,
      news: 1,
    });
    expect(preview?.banners).toHaveLength(1);
    expect(JSON.stringify(preview)).not.toContain('closed on Monday');
  });

  it('refuses a home screen with a banner it cannot read, rather than previewing it without', () => {
    expect(
      toHomePreview({ ...HOME.data, banners: [...HOME.data.banners, { title: 'No id' }] }),
    ).toBeNull();
  });

  it('reads what was stored, and sends an image as the file field', () => {
    expect(toStoredMedia(MEDIA.data)).toBe('8e2f1d5b-3c4a-4b6f-8d9e-1f2a3b4c5d71');
    const image = new Blob(['x'], { type: 'image/png' });
    expect(toWireMediaUpload(image)).toEqual({ file: image });
  });
});
