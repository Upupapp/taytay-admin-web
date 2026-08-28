import { describe, expect, it } from 'vitest';

import { asId, asIsoDate } from '@domain/index';
import type { ReleaseBatchDraft, ReleaseId, StaffUserId, VisitOutcomeDraft } from '@domain/index';

import { toWireReleaseBatch, toWireVisitOutcome } from './to-wire';

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
});
