import { describe, expect, it } from 'vitest';

import CARD from '../fixtures/digital-id-card.json';
import HOLDER from '../fixtures/digital-id-holder.json';
import LIST_PAGE from '../fixtures/digital-id-list-page.json';
import {
  toDigitalIdCard,
  toDigitalIdCounts,
  toDigitalIdHolder,
  toDigitalIdListing,
  toWireDigitalIdVerify,
} from './digital-id.mapper';

describe('digital ID mappers (DL-171)', () => {
  it('reads a card, and never a QR', () => {
    const card = toDigitalIdCard({ ...CARD.data, qr: { token: 'x', expires_at: 'y' } });
    expect(card).toEqual({
      id: '5d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c01',
      number: 'TAY-2026-000123',
      photo: '33333333-3333-4333-8333-333333333333',
      status: 'active',
      issuedAt: '2026-11-01T02:00:00.000Z',
      expiresAt: '2027-11-01T02:00:00.000Z',
    });
    expect(JSON.stringify(card)).not.toContain('token');
  });

  it('refuses a card with a status or an expiry it cannot read, rather than guessing one', () => {
    expect(toDigitalIdCard({ ...CARD.data, status: 'lost' })).toBeNull();
    expect(toDigitalIdCard({ ...CARD.data, expires_at: 'soon' })).toBeNull();
    expect(toDigitalIdCard({ ...CARD.data, id_number: undefined })).toBeNull();
  });

  it('reads the five fields of a check, the barangay by name, and nothing else', () => {
    expect(toDigitalIdHolder(HOLDER.data)).toEqual({
      name: 'Fixture Resident',
      photo: '33333333-3333-4333-8333-333333333333',
      status: 'suspended',
      expired: false,
      barangayName: 'San Juan',
    });
    expect(toDigitalIdHolder({ ...HOLDER.data, name: null, barangay: null })).toMatchObject({
      name: null,
      barangayName: null,
    });
    expect(toDigitalIdHolder({ ...HOLDER.data, expired: 'no' })).toBeNull();
  });

  it('sends the code as given, trimmed of the whitespace a paste brings', () => {
    expect(toWireDigitalIdVerify('  example.qr \n')).toEqual({ token: 'example.qr' });
  });

  it('reads a listed card, and a closed holder as no name (DL-212)', () => {
    expect(toDigitalIdListing(LIST_PAGE.data[1])).toEqual({
      id: '5d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c02',
      number: 'TAY-2026-000124',
      status: 'revoked',
      expired: false,
      issuedAt: '2026-10-01T02:00:00.000Z',
      expiresAt: '2027-10-01T02:00:00.000Z',
      holder: { account: '0f1e2d3c-4b5a-4968-8776-655443322103', name: null, barangayName: null },
    });
    expect(toDigitalIdListing({ ...LIST_PAGE.data[0], expired: 'no' })).toBeNull();
  });

  it('reads every count or none (DL-212)', () => {
    expect(toDigitalIdCounts(LIST_PAGE.meta)).toEqual({
      active: 12,
      expiring: 4,
      expired: 2,
      suspended: 1,
      revoked: 3,
    });
    expect(
      toDigitalIdCounts({ counts: { ...LIST_PAGE.meta.counts, expiring_30d: null } }),
    ).toBeNull();
  });
});
