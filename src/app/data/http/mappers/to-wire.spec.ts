import { describe, expect, it } from 'vitest';

import { asId, asIsoDate, centavos } from '@domain/index';
import type {
  BarangayId,
  ReleaseBatchDraft,
  ReleaseId,
  ResidentDraft,
  StaffUserId,
  VisitOutcomeDraft,
} from '@domain/index';

import { toWireReleaseBatch, toWireResidentDraft, toWireVisitOutcome } from './to-wire';

/**
 * These assert what reaches the wire, which is the thing nothing else in this repository checks.
 *
 * A generic like `post<ReleaseBatch, ReleaseBatchDraft>` is an assertion, not a conversion: it
 * tells TypeScript the domain object *is* the request body and the compiler cannot disagree. So the
 * only way a wrong payload surfaces before production is a test that reads the keys.
 */
describe('outbound mappers', () => {
  describe('toWireReleaseBatch', () => {
    const draft: ReleaseBatchDraft = {
      title: 'San Juan payout, second session',
      scheduledFor: asIsoDate('2026-09-02'),
      venue: 'Barangay San Juan covered court',
      officerId: asId<StaffUserId>('staff-disburse-1'),
      releaseIds: [asId<ReleaseId>('rel-1'), asId<ReleaseId>('rel-2')],
      notes: 'Second session; first was rained off.',
    };

    it('renames the fields the API actually validates', () => {
      expect(toWireReleaseBatch(draft)).toEqual({
        name: 'San Juan payout, second session',
        scheduled_for: '2026-09-02',
        location: 'Barangay San Juan covered court',
      });
    });

    /**
     * The console's own names must not reach the wire.
     *
     * `title` and `venue` are perfectly good domain words and neither exists on the endpoint.
     * Laravel ignores unknown keys, so sending them would succeed, discard them, and leave a payout
     * session with no name — which reads to the office as the office's mistake.
     */
    it('sends no key the endpoint does not validate', () => {
      const wire = toWireReleaseBatch(draft) as Record<string, unknown>;

      expect(Object.keys(wire).sort()).toEqual(['location', 'name', 'scheduled_for']);
      for (const absent of ['title', 'venue', 'officerId', 'releaseIds', 'notes']) {
        expect(wire[absent]).toBeUndefined();
      }
    });

    /**
     * Membership is added afterwards, one release at a time (`DL-90`).
     *
     * A batch arriving with its members baked in would make "when did this family get scheduled"
     * unanswerable, because there would be no separate act to record.
     */
    it('does not carry its members', () => {
      expect(JSON.stringify(toWireReleaseBatch(draft))).not.toContain('rel-1');
    });
  });

  describe('toWireVisitOutcome', () => {
    const outcome: VisitOutcomeDraft = {
      status: 'completed',
      outcome: 'Household visited; roof repair still outstanding.',
      serviceNeeds: 'Materials assistance, and a follow-up on the water connection.',
      declinedReason: null,
    };

    it('sends the fields flat and snake_cased', () => {
      expect(toWireVisitOutcome(outcome)).toEqual({
        status: 'completed',
        outcome: 'Household visited; roof repair still outstanding.',
        service_needs: 'Materials assistance, and a follow-up on the water connection.',
        declined_reason: null,
      });
    });

    /**
     * A null is sent as null, never dropped.
     *
     * "The visit was not declined" and "nobody said whether it was declined" are different facts,
     * and omitting the key would make the second look like the first on a record somebody reads
     * six months later.
     */
    it('sends an absent reason as null rather than omitting it', () => {
      expect('declined_reason' in toWireVisitOutcome(outcome)).toBe(true);
    });

    /**
     * `next_action` and `follow_up_on` are accepted by the endpoint and this draft has neither.
     *
     * Inventing them would put a follow-up date on the record that nobody was asked for, and it
     * would read as though a worker had chosen it.
     */
    it('invents no field the console never collected', () => {
      const wire = toWireVisitOutcome(outcome) as Record<string, unknown>;

      expect(wire['next_action']).toBeUndefined();
      expect(wire['follow_up_on']).toBeUndefined();
    });
  });

  describe('toWireResidentDraft', () => {
    const draft: ResidentDraft = {
      name: { first: 'Marilou', middle: 'Santos', last: 'Bautista', suffix: null },
      sex: 'female',
      birthDate: asIsoDate('1979-11-02'),
      civilStatus: 'widowed',
      address: {
        barangayId: asId<BarangayId>('brgy-san-juan'),
        streetAddress: '18 Rizal Street',
        purokOrSitio: 'Purok 3',
      },
      contact: { mobile: '09171234567', email: null },
      sectors: ['solo-parent'],
      philsysLastFour: '4821',
      monthlyIncome: centavos(850000),
      householdId: null,
    };

    it('flattens the nested value objects the API does not have', () => {
      expect(toWireResidentDraft(draft)).toEqual({
        first_name: 'Marilou',
        middle_name: 'Santos',
        last_name: 'Bautista',
        suffix: null,
        sex: 'female',
        birth_date: '1979-11-02',
        civil_status: 'widowed',
        barangay_code: 'brgy-san-juan',
        street_address: '18 Rizal Street',
        purok_or_sitio: 'Purok 3',
        mobile_number: '09171234567',
        email: null,
      });
    });

    /**
     * The barangay travels as the code, never as the auto-increment key.
     *
     * This console has only ever held the code, and Article 4 keeps the key out of payloads. The
     * endpoint accepts either since L-15, and sending the one we actually hold is the point.
     */
    it('sends the barangay as a code', () => {
      const wire = toWireResidentDraft(draft) as Record<string, unknown>;

      expect(wire['barangay_code']).toBe('brgy-san-juan');
      expect(wire['barangay_id']).toBeUndefined();
    });

    /**
     * The sensitive tier is not smuggled through creation.
     *
     * `philsysLastFour`, `monthlyIncome` and `sectors` sit behind `resident.view-sensitive`
     * (`DL-38`) and the create endpoint accepts none of them. Laravel ignores unknown keys, so
     * sending them would look like it worked and quietly discard a PhilSys fragment — which is the
     * worst of both: nothing recorded, and an intake officer believing otherwise.
     */
    it('sends no field the create endpoint does not accept', () => {
      const wire = toWireResidentDraft(draft) as Record<string, unknown>;

      expect(Object.keys(wire).length).toBe(12);
      for (const absent of ['sectors', 'philsysLastFour', 'philsys_last_four', 'monthlyIncome', 'monthly_income', 'householdId', 'household_id', 'name', 'address', 'contact']) {
        expect(wire[absent]).toBeUndefined();
      }
    });

    /** No nested object survives; every one of the twelve keys is a scalar or null. */
    it('leaves nothing nested', () => {
      for (const value of Object.values(toWireResidentDraft(draft))) {
        expect(typeof value === 'object' && value !== null).toBe(false);
      }
    });
  });
});
