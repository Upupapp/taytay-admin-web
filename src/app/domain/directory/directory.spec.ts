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
  officeInUseWords,
  officeDraftProblems,
  slugProblems,
  type OfficeDraft,
} from './directory-office';
import {
  activeCommandCenter,
  COMMAND_CENTER_EFFECTS,
  commandCenterEffects,
  commandCenterHolder,
  HOTLINE_EFFECTS,
  HOTLINE_KIND_LABELS,
  HOTLINE_KINDS,
  hotlineProblems,
  isDialable,
  isHotlineKind,
  type Hotline,
} from './hotline';
import { asId, asIsoDateTime, type HotlineId } from '../shared/ids';
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

  it('says an office is archived, refused while anything uses it, and can be restored (DL-225)', () => {
    const words = OFFICE_EFFECTS.archive.join(' ');

    expect(words).toContain('a staff account linked to it');
    expect(words).toContain('a Tulong page or a document type');
    expect(words).toContain('It says how many of each');
    expect(words).toContain('your name, the date and your reason');
    expect(words).toContain('its address stays reserved');
    expect(words).toContain('It can be restored');
    expect(OFFICE_EFFECTS.restore.join(' ')).toContain('returns to the app’s directory');
    expect(OFFICE_EFFECTS.restore.join(' ')).toContain('Its archive history keeps both acts');
    // A replaced banner is kept too: nothing an administrator does deletes a stored file.
    expect(OFFICE_EFFECTS.bannerReplaced.join(' ')).toContain('nothing deletes it');
  });

  it('says what still uses an office in words, one sentence per kind it counted (DL-225)', () => {
    expect(officeInUseWords({ staffAccounts: 2, services: 3, issuanceTypes: 4 })).toEqual([
      '2 staff accounts are linked to it. Link them to another office in Users and roles.',
      '3 Tulong pages in use are under it. Archive them under Tulong pages.',
      '4 document types in use are under it. Retire them in the Document catalogue.',
    ]);
    expect(officeInUseWords({ staffAccounts: 1, services: 1, issuanceTypes: 1 })).toEqual([
      '1 staff account is linked to it. Link them to another office in Users and roles.',
      '1 Tulong page in use is under it. Archive them under Tulong pages.',
      '1 document type in use is under it. Retire them in the Document catalogue.',
    ]);
    // A kind at zero is not mentioned, so the sentence names only what must move.
    expect(officeInUseWords({ staffAccounts: 0, services: 2, issuanceTypes: 0 })).toEqual([
      '2 Tulong pages in use are under it. Archive them under Tulong pages.',
    ]);
    expect(officeInUseWords({ staffAccounts: 0, services: 0, issuanceTypes: 0 })).toEqual([]);
  });
});

describe('nothing an administrator does here deletes a record (DL-225)', () => {
  const said = [
    ...Object.values(OFFICE_EFFECTS).flat(),
    ...Object.values(SERVICE_EFFECTS).flat(),
    ...Object.values(HOTLINE_EFFECTS).flat(),
  ].join(' ');

  it('never says a record is deleted, or that nothing brings it back', () => {
    expect(said).not.toMatch(/\bis deleted\b|\bdeletes the\b|deleted it/i);
    expect(said).not.toContain('Nothing brings it back');
    expect(said).not.toContain('The system deletes');
  });

  it('offers an archive and a restore for every record the directory keeps', () => {
    for (const effects of [OFFICE_EFFECTS, SERVICE_EFFECTS, HOTLINE_EFFECTS]) {
      expect(effects.archive.join(' ')).toContain('The system records that you archived it');
      expect(effects.restore.join(' ')).toContain('The system records that you restored it');
    }
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

  it('takes online applications only on a page that names its programme (DL-228)', () => {
    expect(
      serviceProblems({ acceptsOnlineApplications: true, programId: null }).map(
        (problem) => problem.field,
      ),
    ).toEqual(['acceptsOnlineApplications']);
    expect(serviceProblems({ acceptsOnlineApplications: false, programId: null })).toEqual([]);
  });

  it('says a hidden page stays in this list, and featuring one may push another off', () => {
    expect(SERVICE_EFFECTS.hide.join(' ')).toContain('It stays in this list');
    expect(SERVICE_EFFECTS.hide.join(' ')).not.toContain('Open a page by its address');
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

  it('says an archived line leaves the app whether active or not, and a restore may be refused (DL-225)', () => {
    expect(HOTLINE_EFFECTS.archive.join(' ')).toContain('whether it is active or not');
    expect(HOTLINE_EFFECTS.restore.join(' ')).toContain('another active line holds that role');
  });

  it('says an archived page leaves the app and keeps its address, and waits on its office (DL-225)', () => {
    expect(SERVICE_EFFECTS.archive.join(' ')).toContain('its address stays reserved');
    expect(SERVICE_EFFECTS.restore.join(' ')).toContain('restore the office first');
  });

  it('says shown and hidden one way, for hotlines and banners alike', () => {
    expect(visibilityOf(true)).toBe('shown');
    expect(APP_VISIBILITY_CATALOG.hidden.label).toBe('Hidden from the app');
    expect(APP_VISIBILITY_TRANSITIONS.hidden).toEqual(['shown']);
  });
});

describe('a hotline’s kind (DL-217)', () => {
  const line = (key: string, kind: Hotline['kind'], active = true): Hotline => ({
    id: asId<HotlineId>(key),
    name: key,
    number: '(02) 8000 0100',
    category: 'Emergency',
    kind,
    sortOrder: 0,
    active,
    updatedAt: asIsoDateTime('2026-11-01T00:00:00.000Z'),
    archived: null,
  });

  it('knows the API’s kinds, each in words', () => {
    expect(HOTLINE_KINDS).toHaveLength(7);
    expect(HOTLINE_KINDS.every((kind) => HOTLINE_KIND_LABELS[kind].length > 0)).toBe(true);
    expect(isHotlineKind('command-center')).toBe(true);
    expect(isHotlineKind('Command Center')).toBe(false);
  });

  it('finds the one active command center, and none when it is inactive or unmarked', () => {
    const center = line('center', 'command-center');
    expect(activeCommandCenter([line('a', 'other'), center])).toBe(center);
    expect(activeCommandCenter([line('b', 'command-center', false)])).toBeNull();
    expect(activeCommandCenter([line('c', 'emergency')])).toBeNull();
  });

  it('names the line that holds the role when a save would make a second', () => {
    const center = line('center', 'command-center');
    const other = line('other', 'police');
    expect(commandCenterHolder({ ...other, kind: 'command-center' }, center)).toBe(center);
    expect(commandCenterHolder({ id: null, kind: 'command-center', active: true }, center)).toBe(
      center,
    );
    // The line itself, an inactive one, or another kind is no second.
    expect(commandCenterHolder(center, center)).toBeNull();
    expect(
      commandCenterHolder({ ...other, kind: 'command-center', active: false }, center),
    ).toBeNull();
    expect(commandCenterHolder(other, center)).toBeNull();
    expect(commandCenterHolder({ ...other, kind: 'command-center' }, null)).toBeNull();
  });

  it('says what a save does to the command center, before the button', () => {
    const center = line('center', 'command-center');
    expect(commandCenterEffects(null, center)).toBe(COMMAND_CENTER_EFFECTS.becomes);
    expect(commandCenterEffects(center, { ...center, kind: 'other' })).toBe(
      COMMAND_CENTER_EFFECTS.leaves,
    );
    expect(commandCenterEffects(center, { ...center, active: false })).toBe(
      COMMAND_CENTER_EFFECTS.leaves,
    );
    expect(commandCenterEffects(center, center)).toEqual([]);
    expect(COMMAND_CENTER_EFFECTS.taken('Rescue', '911').join(' ')).toContain(
      'The server will refuse this until Rescue is given another kind or made inactive',
    );
  });
});
