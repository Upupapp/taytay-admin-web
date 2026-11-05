import { describe, expect, it } from 'vitest';

import {
  APP_IMAGE_POLICY,
  describeImageRefusal,
  imageRefusalFor,
  imageTypeOf,
} from '../media/image-policy';
import { APP_VISIBILITY_CATALOG, APP_VISIBILITY_TRANSITIONS, visibilityOf } from './app-visibility';
import {
  OFFICE_EFFECTS,
  officeChangeProblems,
  officeDraftProblems,
  slugProblems,
  type OfficeDraft,
} from './directory-office';
import { HOTLINE_EFFECTS, hotlineProblems, isDialable } from './hotline';
import {
  listingOf,
  SERVICE_EFFECTS,
  SERVICE_LISTING_CATALOG,
  SERVICE_LISTING_TRANSITIONS,
  serviceProblems,
} from './tulong-service';

const bytes = (...values: number[]) => new Uint8Array(values);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0x10, ...ascii('JFIF'), 0, 1);
const PNG = bytes(0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d);
const WEBP = bytes(...ascii('RIFF'), 0x24, 0, 0, 0, ...ascii('WEBP'));
const PDF = bytes(...ascii('%PDF-1.7'), 0x0a, 0x25, 0xe2, 0xe3);

const OFFICE: OfficeDraft = {
  name: 'Municipal Social Welfare and Development Office',
  slug: 'mswdo',
  shortName: 'MSWDO',
  category: null,
  description: null,
  head: null,
  hours: null,
  phone: null,
  email: null,
  address: null,
  latitude: null,
  longitude: null,
};

describe('APP_IMAGE_POLICY (DL-170)', () => {
  it('is the API’s five megabytes of JPEG, PNG or WebP', () => {
    expect(APP_IMAGE_POLICY.maxBytes).toBe(5 * 1024 * 1024);
    expect(APP_IMAGE_POLICY.mimeTypes).toEqual(['image/jpeg', 'image/png', 'image/webp']);
  });

  it('recognises an image by its first bytes, as the server does', () => {
    expect(imageTypeOf(JPEG)).toBe('image/jpeg');
    expect(imageTypeOf(PNG)).toBe('image/png');
    expect(imageTypeOf(WEBP)).toBe('image/webp');
    expect(imageTypeOf(PDF)).toBeNull();
    expect(imageTypeOf(bytes())).toBeNull();
  });

  it('accepts a PNG named .jpg and refuses a PDF named .jpg', () => {
    expect(imageRefusalFor({ size: 2048, type: 'image/jpeg' }, PNG)).toBeNull();
    expect(imageRefusalFor({ size: 2048, type: 'image/jpeg' }, PDF)).toEqual({
      reason: 'not-an-image',
    });
  });

  it('says the size first, because a smaller export fixes both', () => {
    const refusal = imageRefusalFor({ size: 9 * 1024 * 1024, type: 'image/heic' }, PDF);

    expect(refusal).toEqual({ reason: 'too-large', maxBytes: 5242880, actualBytes: 9437184 });
    expect(refusal === null ? '' : describeImageRefusal(refusal)).toBe(
      'That file is 9 MB. The app takes images up to 5 MB; save a smaller copy and choose it again.',
    );
  });

  it('takes exactly five megabytes, and refuses one byte more', () => {
    expect(imageRefusalFor({ size: 5 * 1024 * 1024, type: 'image/png' }, PNG)).toBeNull();
    expect(imageRefusalFor({ size: 5 * 1024 * 1024 + 1, type: 'image/png' }, PNG)?.reason).toBe(
      'too-large',
    );
  });

  it('refuses an empty file', () => {
    expect(imageRefusalFor({ size: 0, type: 'image/png' }, PNG)).toEqual({
      reason: 'not-an-image',
    });
  });
});

describe('offices (DL-170)', () => {
  it('accepts a well-formed office', () => {
    expect(officeDraftProblems(OFFICE)).toEqual([]);
  });

  it('refuses what the server refuses, by field', () => {
    const problems = officeDraftProblems({
      ...OFFICE,
      name: ' ',
      slug: 'Civil Registrar',
      email: 'not an address',
      latitude: 91,
      shortName: 'x'.repeat(41),
    });

    expect(problems.map((problem) => problem.field)).toEqual([
      'name',
      'slug',
      'shortName',
      'email',
      'latitude',
    ]);
  });

  it('holds a slug to lower-case words joined by single hyphens', () => {
    expect(slugProblems('civil-registrar')).toEqual([]);
    expect(slugProblems('civil--registrar')).toHaveLength(1);
    expect(slugProblems('-mswdo')).toHaveLength(1);
    expect(slugProblems('')).toEqual(['Give the office an address for the app, such as mswdo.']);
  });

  it('checks only what a change carries', () => {
    expect(officeChangeProblems({})).toEqual([]);
    expect(officeChangeProblems({ slug: 'MSWDO' }).map((problem) => problem.field)).toEqual([
      'slug',
    ]);
  });

  it('says a delete is refused while anything names the office, and cannot be undone', () => {
    const words = OFFICE_EFFECTS.remove.join(' ');

    expect(words).toContain('a staff account assigned to it');
    expect(words).toContain('a Tulong page');
    expect(words).toContain('Nothing brings it back');
    expect(words).toContain('banner image stays stored');
  });
});

describe('Tulong pages (DL-170)', () => {
  it('is listed or hidden, one way and back', () => {
    expect(listingOf({ hiddenFromList: true })).toBe('unlisted');
    expect(SERVICE_LISTING_TRANSITIONS.listed).toEqual(['unlisted']);
    expect(SERVICE_LISTING_CATALOG.unlisted.description).toContain('still opens by its address');
  });

  it('refuses an empty summary, a bad tile colour and a contact with no value', () => {
    const problems = serviceProblems({
      name: 'Senior citizen ID',
      summary: '',
      tileColor: 'teal',
      contacts: [{ type: 'hotline', label: null, value: ' ' }],
    });

    expect(problems.map((problem) => problem.field)).toEqual(['summary', 'contacts', 'tileColor']);
  });

  it('checks only what a change carries', () => {
    expect(serviceProblems({ featured: true })).toEqual([]);
  });

  it('says hiding a page takes it out of this list too, and featuring one may push another off', () => {
    expect(SERVICE_EFFECTS.hide.join(' ')).toContain('leaves this list as well');
    expect(SERVICE_EFFECTS.feature.join(' ')).toContain('six newest featured pages');
    expect(SERVICE_EFFECTS.create.join(' ')).toContain('nothing in the app lets them apply');
  });
});

describe('hotlines (DL-170)', () => {
  it('takes a number as the API checks one', () => {
    expect(isDialable('(02) 8123 4567')).toBe(true);
    expect(isDialable('911')).toBe(true);
    expect(isDialable('+63 917 000 0000')).toBe(true);
    expect(isDialable('9')).toBe(false);
    expect(isDialable('call 911')).toBe(false);
    expect(isDialable('(-)')).toBe(false);
  });

  it('refuses an order outside 0 to 1000, or not whole', () => {
    expect(hotlineProblems({ sortOrder: 1001 })).toHaveLength(1);
    expect(hotlineProblems({ sortOrder: 2.5 })).toHaveLength(1);
    expect(hotlineProblems({ sortOrder: Number.NaN })).toHaveLength(1);
    expect(hotlineProblems({ sortOrder: 0 })).toEqual([]);
  });

  it('offers making a line inactive before deleting it', () => {
    expect(HOTLINE_EFFECTS.remove.join(' ')).toContain('make it inactive instead');
  });

  it('says shown and hidden one way, for hotlines and banners alike', () => {
    expect(visibilityOf(true)).toBe('shown');
    expect(APP_VISIBILITY_CATALOG.hidden.label).toBe('Hidden from the app');
    expect(APP_VISIBILITY_TRANSITIONS.hidden).toEqual(['shown']);
  });
});
