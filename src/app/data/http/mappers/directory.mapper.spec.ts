import { describe, expect, it } from 'vitest';

import { asId, type OfficeId } from '@domain/index';

import HOTLINES from '../fixtures/hotlines.json';
import OFFICE from '../fixtures/office.json';
import SERVICE from '../fixtures/service.json';
import SERVICES_PAGE from '../fixtures/services-page.json';
import {
  toDirectoryOffice,
  toWireOfficeChanges,
  toWireOfficeDraft,
} from './directory-office.mapper';
import { toHotline } from './hotline.mapper';
import {
  toTulongService,
  toWireServiceChanges,
  toWireServiceDraft,
  toWireServiceImage,
} from './tulong-service.mapper';

/** The first entry of a fixture's list; a fixture that has none is a broken test, said so. */
function firstOf<T>(items: readonly T[]): T {
  const item = items[0];
  if (item === undefined) {
    throw new Error('The fixture lists nothing.');
  }
  return item;
}

describe('toDirectoryOffice (DL-170)', () => {
  it('reads the whole entry, and the banner as present or absent — never as an address', () => {
    const office = toDirectoryOffice(OFFICE.data);

    expect(office).toMatchObject({
      name: 'Persons with Disability Affairs Office',
      slug: 'pdao',
      shortName: 'PDAO',
      latitude: 14.5574,
      longitude: 121.1323,
      hasBanner: true,
    });
    expect(JSON.stringify(office)).not.toContain('hero');
  });

  it('refuses an entry without its address or its time', () => {
    expect(toDirectoryOffice({ ...OFFICE.data, slug: null })).toBeNull();
    expect(toDirectoryOffice({ ...OFFICE.data, updated_at: 'yesterday' })).toBeNull();
  });
});

describe('the office form (DL-170)', () => {
  const draft = {
    name: 'Tourism Office',
    slug: 'tourism',
    shortName: null,
    category: null,
    description: null,
    head: null,
    hours: null,
    phone: null,
    email: null,
    address: null,
    latitude: 14.5,
    longitude: null,
  };

  it('leaves an absent value out rather than sending it empty, and sends a coordinate as text', () => {
    const wire = toWireOfficeDraft(draft, null);

    expect(Object.entries(wire).filter(([, value]) => value !== undefined)).toEqual([
      ['name', 'Tourism Office'],
      ['slug', 'tourism'],
      ['latitude', '14.5'],
    ]);
  });

  it('carries the banner as a file', () => {
    const banner = new Blob(['x'], { type: 'image/png' });
    expect(toWireOfficeDraft(draft, banner).banner).toBe(banner);
  });

  it('sends a change as the four fields OfficePatch declares, and nothing else', () => {
    expect(toWireOfficeChanges({ slug: 'tourism-office' }, null)).toEqual({
      name: undefined,
      slug: 'tourism-office',
      short_name: undefined,
      category: undefined,
      banner: undefined,
    });
  });
});

describe('toTulongService (DL-170)', () => {
  it('reads a page, its contacts, places and steps', () => {
    const [first, second] = SERVICES_PAGE.data.map(toTulongService);

    expect(first).toMatchObject({
      slug: 'senior-citizen-id',
      officeId: '3c9a7e21-5b84-4d1f-a0c6-1e2f3a4b5c66',
      featured: true,
      hiddenFromList: false,
      hasImage: true,
      contacts: [{ type: 'landline', label: 'Senior citizens desk', value: '(02) 8000 0102' }],
      claimSteps: ['Bring the requirements', 'Have your photograph taken'],
    });
    // The optional fields are optional: absent is not given, never a refusal.
    expect(second).toMatchObject({
      category: null,
      claimSteps: [],
      featured: false,
      hasImage: false,
    });
  });

  it('reads a hidden page by its address', () => {
    expect(toTulongService(SERVICE.data)?.hiddenFromList).toBe(true);
  });

  it('refuses a page with a contact it cannot read, rather than dropping the contact a save would delete', () => {
    const page = firstOf(SERVICES_PAGE.data);
    expect(
      toTulongService({ ...page, contacts: [...page.contacts, { type: 'viber', value: '0917' }] }),
    ).toBeNull();
    expect(toTulongService({ ...page, claim_steps: [1] })).toBeNull();
  });
});

describe('the Tulong page bodies (DL-170)', () => {
  it('sends a new page with nothing ServiceWrite does not declare', () => {
    const wire = toWireServiceDraft({
      name: 'PWD ID',
      slug: 'pwd-id',
      category: null,
      summary: 'The identification card.',
      details: 'Apply at the PDAO.',
      eligibility: null,
      requirements: ['Medical certificate'],
      contacts: [{ type: 'email', label: null, value: 'pdao@directory.example.test' }],
      locations: [],
      officeId: asId<OfficeId>('3c9a7e21-5b84-4d1f-a0c6-1e2f3a4b5c70'),
      iconKey: null,
      tileColor: null,
      badge: null,
      legalBasis: null,
      claimSteps: [],
      featuredHeadline: null,
      schedule: null,
      hiddenFromList: false,
    });

    expect(wire).not.toHaveProperty('featured');
    expect(JSON.parse(JSON.stringify(wire))).toMatchObject({
      office_id: '3c9a7e21-5b84-4d1f-a0c6-1e2f3a4b5c70',
      contacts: [{ type: 'email', label: null, value: 'pdao@directory.example.test' }],
      hidden_from_list: false,
    });
    expect(JSON.parse(JSON.stringify(wire))).not.toHaveProperty('category');
  });

  it('sends a change as only what changed, and null to clear', () => {
    expect(
      JSON.parse(JSON.stringify(toWireServiceChanges({ featured: true, badge: null }))),
    ).toEqual({
      featured: true,
      badge: null,
    });
  });

  it('carries the picture as the file field', () => {
    const image = new Blob(['x'], { type: 'image/webp' });
    expect(toWireServiceImage(image)).toEqual({ file: image });
  });
});

describe('toHotline (DL-170)', () => {
  it('reads a shown and a hidden line', () => {
    expect(HOTLINES.data.map((wire) => toHotline(wire)?.active)).toEqual([true, false]);
  });

  it('never guesses whether a line is shown', () => {
    expect(toHotline({ ...HOTLINES.data[0], active: undefined })).toBeNull();
    expect(toHotline({ ...HOTLINES.data[0], active: 'yes' })).toBeNull();
  });

  it('refuses a line without its number or a whole order', () => {
    expect(toHotline({ ...HOTLINES.data[0], number: '' })).toBeNull();
    expect(toHotline({ ...HOTLINES.data[0], sort_order: 1.5 })).toBeNull();
  });

  it('reads each kind the API names, and never guesses one it does not (DL-217)', () => {
    expect(HOTLINES.data.map((wire) => toHotline(wire)?.kind)).toEqual(['disaster', 'medical']);
    expect(toHotline({ ...HOTLINES.data[0], kind: 'command-center' })?.kind).toBe('command-center');
    // Read as "other", a command center would have the page say the office has none.
    expect(toHotline({ ...HOTLINES.data[0], kind: undefined })).toBeNull();
    expect(toHotline({ ...HOTLINES.data[0], kind: 'Command Center' })).toBeNull();
  });
});
