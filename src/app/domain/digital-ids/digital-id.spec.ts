import { describe, expect, it } from 'vitest';

import { asId, asIsoDateTime, type DigitalIdId, type MediaId } from '../shared/ids';
import {
  actsOn,
  DIGITAL_ID_ALWAYS,
  DIGITAL_ID_CHECK_EFFECTS,
  DIGITAL_ID_EFFECTS,
  DIGITAL_ID_STATUS_TRANSITIONS,
  isPastExpiry,
  type DigitalIdCard,
  type DigitalIdStatus,
} from './digital-id';

function card(status: DigitalIdStatus, expiresAt = '2027-11-05T00:00:00.000Z'): DigitalIdCard {
  return {
    id: asId<DigitalIdId>('card-1'),
    number: 'TAY-2026-000001',
    photo: asId<MediaId>('photo-1'),
    status,
    issuedAt: asIsoDateTime('2026-11-05T00:00:00.000Z'),
    expiresAt: asIsoDateTime(expiresAt),
  };
}

describe('digital IDs (DL-171)', () => {
  it('moves as the API moves a card, and never back to active', () => {
    expect(DIGITAL_ID_STATUS_TRANSITIONS.active).toEqual(['suspended', 'revoked']);
    expect(DIGITAL_ID_STATUS_TRANSITIONS.suspended).toEqual(['revoked']);
    expect(DIGITAL_ID_STATUS_TRANSITIONS.revoked).toEqual([]);
    for (const moves of Object.values(DIGITAL_ID_STATUS_TRANSITIONS)) {
      expect(moves).not.toContain('active');
    }
  });

  it('offers suspend only on an active card, and replacing on any current one', () => {
    expect(actsOn(card('active'))).toEqual(['suspend', 'revoke', 'reissue']);
    expect(actsOn(card('suspended'))).toEqual(['revoke', 'reissue']);
    expect(actsOn(card('revoked'))).toEqual([]);
  });

  it('reads expiry by the clock it is given', () => {
    const now = new Date('2027-01-01T00:00:00.000Z');
    expect(isPastExpiry(card('active', '2026-12-31T23:59:59.000Z'), now)).toBe(true);
    expect(isPastExpiry(card('active', '2027-01-02T00:00:00.000Z'), now)).toBe(false);
  });

  it('says what each act does to the resident’s card in the app, before it is done', () => {
    expect(DIGITAL_ID_EFFECTS.suspend.join(' ')).toContain('stops working in the app');
    expect(DIGITAL_ID_EFFECTS.suspend.join(' ')).toContain(
      'No route makes a suspended card active',
    );
    expect(DIGITAL_ID_EFFECTS.revoke.join(' ')).toContain('stops working in the app for good');
    expect(DIGITAL_ID_EFFECTS.reissue.join(' ')).toContain('new number');
    expect(DIGITAL_ID_EFFECTS.issue.join(' ')).toContain('latest approved verification selfie');
    expect(DIGITAL_ID_ALWAYS.join(' ')).toContain('keeps no reason');
  });

  it('says the server records a check and this console keeps nothing', () => {
    const said = DIGITAL_ID_CHECK_EFFECTS.join(' ');
    expect(said).toContain('records that you checked this card');
    expect(said).toContain('This console keeps nothing');
    expect(said).toContain('2 minutes');
  });
});
