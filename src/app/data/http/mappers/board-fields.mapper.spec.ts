import { describe, expect, it } from 'vitest';

import RESIDENT from '../fixtures/office-resident-detail.json';
import THREADS from '../fixtures/threads-page.json';
import USERS from '../fixtures/users-page.json';
import VERIFICATION from '../fixtures/verification-requests-page.json';
import LIST from '../fixtures/digital-id-list-page.json';
import { toAppAccountCounts } from './app-account.mapper';
import { toDigitalIdEvent, toDigitalIdFunnel } from './digital-id.mapper';
import { toInboxCounts } from './office-thread.mapper';
import { toBarangayIndex, toResidentView } from './resident.mapper';
import { toVerificationQueueStats } from './verification.mapper';

const BARANGAYS = toBarangayIndex([
  { id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c01', code: 'dolores', name: 'Dolores' },
]);

/** The fields the boards wait on, as backend ADR 0006 sends them (DL-232). */
describe('the board fields from backend ADR 0006 (DL-232)', () => {
  it('reads a registry row’s household and app facts beside the record', () => {
    const view = toResidentView(RESIDENT.data, BARANGAYS);
    expect(view?.registry?.householdReference).toBe('HH-2026-000014');
    expect(view?.registry?.appAccount).toEqual({
      linkedSince: '2026-11-08T03:00:00.000Z',
      verified: true,
      cardStatus: 'active',
    });
  });

  it('keeps a withheld household out of the fields that gate editing the record', () => {
    const view = toResidentView(
      { ...RESIDENT.data, household_reference: null, withheld: ['household'] },
      BARANGAYS,
    );
    expect(view?.withheld).toEqual([]);
    expect(view?.registry?.householdWithheld).toBe(true);
    expect(view?.registry?.householdReference).toBeNull();
  });

  it('says "not for this reader" — never "no" — for app facts the reader holds no key for', () => {
    const view = toResidentView(
      {
        ...RESIDENT.data,
        app_account: { ...RESIDENT.data.app_account, verified: null, digital_id_status: null },
      },
      BARANGAYS,
    );
    expect(view?.registry?.appAccount?.verified).toBeNull();
    expect(view?.registry?.appAccount?.cardStatus).toBeNull();
  });

  it('reads each list’s own figures from beside its page, every figure required', () => {
    expect(toInboxCounts(THREADS.meta)).toEqual({ open: 7, closed: 15, unread: 3 });
    expect(toAppAccountCounts(USERS.meta)).toEqual({
      residents: 1240,
      verified: 640,
      staff: 18,
      admins: 2,
      staffWithoutOffice: 1,
    });
    expect(toDigitalIdFunnel(LIST.meta)?.verifiedWithoutCard).toBe(5);
    const stats = toVerificationQueueStats(VERIFICATION.meta);
    expect(stats?.decided7d).toEqual({ approved: 4, rejected: 1 });
    expect(stats?.sentByDay).toHaveLength(7);
    expect(toInboxCounts({ counts: { open: 1, closed: 1 } })).toBeNull();
  });

  it('keeps a card history row in the trail’s own word, and refuses one with no time', () => {
    const row = {
      id: 'e1',
      action: 'digital_id.scanned',
      card_id: '5d1c2b3a-4e5f-4a6b-8c7d-9e0f1a2b3c01',
      created_at: '2026-11-02T01:00:00.000Z',
      actor: { id: 'a1', name: 'Fixture Officer' },
    };
    expect(toDigitalIdEvent(row)?.action).toBe('digital_id.scanned');
    expect(toDigitalIdEvent(row)?.actorName).toBe('Fixture Officer');
    expect(toDigitalIdEvent({ ...row, created_at: null })).toBeNull();
  });
});
