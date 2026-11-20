import { describe, expect, it } from 'vitest';

import { asId, type OfficeId, type ProgramId } from '@domain/index';

import HOTLINES from '../fixtures/hotlines.json';
import OFFICE from '../fixtures/office.json';
import OFFICE_ARCHIVED from '../fixtures/office-archived.json';
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

  it('reads an office in use as not archived, and an archived one with when, by whom and why (DL-225)', () => {
    expect(toDirectoryOffice(OFFICE.data)?.archived).toBeNull();
    expect(toDirectoryOffice(OFFICE_ARCHIVED.data)?.archived).toEqual({
      at: '2026-11-10T01:00:00.000Z',
      byName: 'Fixture Administrator',
      reason: 'Merged into the MSWDO.',
    });
    // An office that cannot say whether residents see it is not read as one they do.
    expect(toDirectoryOffice({ ...OFFICE_ARCHIVED.data, archived_at: 'recently' })).toBeNull();
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

  it('reads a hidden page, which the administrator’s list holds', () => {
    expect(toTulongService(SERVICE.data)?.hiddenFromList).toBe(true);
  });

  it('reads where a page stands in the archive: in use when the residents’ shape omits it (DL-225)', () => {
    expect(toTulongService(SERVICE.data)?.archived).toBeNull();
    expect(toTulongService(firstOf(SERVICES_PAGE.data))?.archived).toBeNull();
    expect(
      toTulongService({
        ...SERVICE.data,
        archived_at: '2026-11-10T01:00:00.000Z',
        archive_reason: 'The distribution has ended.',
        archived_by_name: 'An account since closed',
      })?.archived,
    ).toEqual({
      at: '2026-11-10T01:00:00.000Z',
      byName: 'An account since closed',
      reason: 'The distribution has ended.',
    });
    expect(toTulongService({ ...SERVICE.data, archived_at: 'recently' })).toBeNull();
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
      programId: asId<ProgramId>('5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c80'),
      acceptsOnlineApplications: true,
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
      program_id: '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c80',
      accepts_online_applications: true,
    });
    expect(JSON.parse(JSON.stringify(wire))).not.toHaveProperty('category');
  });

  it('reads the programme a page applies to and whether it takes applications (DL-228)', () => {
    const read = toTulongService({
      ...SERVICE.data,
      program_id: '5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c80',
      accepts_online_applications: true,
    });
    expect(read?.programId).toBe('5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c80');
    expect(read?.acceptsOnlineApplications).toBe(true);
    // The public read carries neither: information only.
    expect(toTulongService(SERVICE.data)?.acceptsOnlineApplications).toBe(false);
    expect(
      JSON.parse(
        JSON.stringify(toWireServiceChanges({ programId: null, acceptsOnlineApplications: false })),
      ),
    ).toEqual({ program_id: null, accepts_online_applications: false });
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

  it('reads an archived line apart from a hidden one, and refuses one it cannot place (DL-225)', () => {
    expect(HOTLINES.data.map((wire) => toHotline(wire)?.archived)).toEqual([null, null]);
    const archived = toHotline({
      ...HOTLINES.data[0],
      archived_at: '2026-11-10T01:00:00.000Z',
      archive_reason: 'The 2025 relief line was closed.',
      archived_by_name: 'Fixture Administrator',
    });
    // Archived is not hidden: the line keeps whether it is active, for when it is restored.
    expect(archived).toMatchObject({
      active: true,
      archived: {
        at: '2026-11-10T01:00:00.000Z',
        byName: 'Fixture Administrator',
        reason: 'The 2025 relief line was closed.',
      },
    });
    expect(toHotline({ ...HOTLINES.data[0], archived_at: 'recently' })).toBeNull();
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
    expect(toHotline({ ...HOTLINES.data[0], kind: 'Command Center' })).toBeNull();
    expect(toHotline({ ...HOTLINES.data[0], kind: 7 })).toBeNull();
  });

  it('reads a line from an API older than kinds as one whose kind is not set (DL-220)', () => {
    const older = Object.fromEntries(
      Object.entries(HOTLINES.data[0] ?? {}).filter(([key]) => key !== 'kind'),
    );

    expect(toHotline(older)).not.toBeNull();
    expect(toHotline(older)?.kind).toBeNull();
    expect(toHotline({ ...HOTLINES.data[0], kind: null })?.kind).toBeNull();
    expect(toHotline({ ...HOTLINES.data[0], kind: '' })?.kind).toBeNull();
  });
});
