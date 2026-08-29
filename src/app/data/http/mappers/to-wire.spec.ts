import { describe, expect, it } from 'vitest';

import { asId, asIsoDate, asIsoDateTime, centavos } from '@domain/index';
import type {
  AssessmentDraft,
  AssistanceRequestId,
  BarangayId,
  PostDraft,
  ResidentId,
  ReleaseBatchDraft,
  ReleaseId,
  ResidentDraft,
  StaffUserId,
  VisitOutcomeDraft,
} from '@domain/index';

import {
  toWireAssessment,
  toWireEventDraft,
  toWireFieldVisitDraft,
  toWirePostDraft,
  toWireReferralDraft,
  toWireReleaseBatch,
  toWireResidentDraft,
  toWireSavedViewDraft,
  toWireVisitOutcome,
} from './to-wire';

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
      for (const absent of [
        'sectors',
        'philsysLastFour',
        'philsys_last_four',
        'monthlyIncome',
        'monthly_income',
        'householdId',
        'household_id',
        'name',
        'address',
        'contact',
      ]) {
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

  describe('toWireReferralDraft', () => {
    it('drops the two fields the create endpoint does not take', () => {
      const wire = toWireReferralDraft({
        residentId: asId<ResidentId>('res-1'),
        requestId: asId<AssistanceRequestId>('req-1'),
        caseId: null,
        providerId: null,
        destination: 'hospital-msw',
        destinationName: 'Taytay District Hospital MSW',
        destinationContact: '8-555-0101',
        urgency: 'priority',
        serviceRequested: 'Medical social work assessment',
        reason: 'Admitted 3 September; family cannot meet the deposit.',
        followUpOn: asIsoDate('2026-09-10'),
      }) as Record<string, unknown>;

      // `followUpOn` belongs on the PATCH; `requestId` has no counterpart at all.
      expect(wire['follow_up_on']).toBeUndefined();
      expect(wire['request_id']).toBeUndefined();
      expect(wire['destination_type']).toBe('hospital-msw');
      expect(wire['service_requested']).toBe('Medical social work assessment');
    });
  });

  describe('toWirePostDraft', () => {
    const base: Omit<PostDraft, 'audience'> = {
      headline: 'Relief distribution, Saturday',
      body: 'Distribution begins at 8am at the covered court.',
      category: 'public-advisory' as const,
      image: null,
      linkUrl: null,
      commentsEnabled: true,
      scheduledFor: null,
    };

    it('translates the audience scope to the API vocabulary', () => {
      expect(
        toWirePostDraft({ ...base, audience: { scope: 'all-residents', barangayIds: [] } }).audience,
      ).toBe('municipality');

      expect(
        toWirePostDraft({
          ...base,
          audience: { scope: 'selected-barangays', barangayIds: [asId<BarangayId>('brgy-muzon')] },
        }).audience,
      ).toBe('barangay');
    });

    /**
     * Publication is the only route to a public object (ADR 0033 §3), and a schedule is a
     * lifecycle move rather than a field. Putting either in this payload would let a post acquire
     * a publish time, or a public image, without passing the step that checks it.
     */
    it('carries neither the image nor the schedule', () => {
      const wire = toWirePostDraft({
        ...base,
        image: { url: 'https://example.test/a.jpg', altText: 'Residents queueing' },
        linkUrl: 'https://example.test/notice',
        scheduledFor: asIsoDateTime('2026-09-05T08:00:00Z'),
        audience: { scope: 'all-residents', barangayIds: [] },
      }) as Record<string, unknown>;

      expect(Object.keys(wire).sort()).toEqual([
        'audience',
        'body',
        'category',
        'comments_enabled',
        'headline',
      ]);
    });
  });

  describe('toWireEventDraft', () => {
    it('flattens venue, contact and registration into the endpoint fields', () => {
      const wire = toWireEventDraft({
        title: 'Feeding programme',
        summary: 'Weekly feeding for under-fives.',
        details: 'Held every Saturday at the covered court.',
        category: 'feeding-programme',
        image: null,
        startsAt: asIsoDateTime('2026-09-05T00:00:00Z'),
        endsAt: asIsoDateTime('2026-09-05T04:00:00Z'),
        venue: {
          name: 'Barangay San Juan covered court',
          address: 'Rizal Street',
          mapUrl: null,
          barangayId: asId<BarangayId>('brgy-san-juan'),
        },
        contact: { name: 'Ana Cruz', office: 'MSWDO', phone: '8-555-0199' },
        registration: {
          isRequired: true,
          opensAt: asIsoDateTime('2026-08-30T00:00:00Z'),
          closesAt: asIsoDateTime('2026-09-04T00:00:00Z'),
          capacity: 60,
          waitlistEnabled: true,
          participationNote: null,
        },
        reminders: 'Bring the child health card.',
      }) as Record<string, unknown>;

      expect(wire['venue_name']).toBe('Barangay San Juan covered court');
      expect(wire['contact_person']).toBe('Ana Cruz');
      expect(wire['contact_office']).toBe('MSWDO');
      expect(wire['capacity']).toBe(60);
      expect(wire['waitlist_enabled']).toBe(true);
      // `details` is the console's word; the endpoint calls it the description.
      expect(wire['description']).toBe('Held every Saturday at the covered court.');
    });

    /**
     * The barangay, the reminders and the cover image have no field on this endpoint.
     *
     * A cover is referenced by `cover_file_id` — an identifier produced by an upload this draft
     * has not performed — so sending a URL would fail validation, and guessing an id would be
     * worse.
     */
    it('sends nothing it cannot name honestly', () => {
      const wire = toWireEventDraft({
        title: 'x',
        summary: '',
        details: 'y',
        category: 'feeding-programme',
        image: { url: 'https://example.test/c.jpg', altText: 'Cover' },
        startsAt: null,
        endsAt: null,
        venue: { name: 'v', address: 'a', mapUrl: null, barangayId: asId<BarangayId>('brgy-muzon') },
        contact: { name: 'n', office: 'o', phone: null },
        registration: {
          isRequired: false,
          opensAt: null,
          closesAt: null,
          capacity: null,
          waitlistEnabled: false,
          participationNote: null,
        },
        reminders: 'bring id',
      }) as Record<string, unknown>;

      for (const absent of ['cover_file_id', 'cover_alt_text', 'image', 'reminders', 'barangay_id', 'venue_barangay_id']) {
        expect(wire[absent]).toBeUndefined();
      }
    });
  });

  describe('toWireSavedViewDraft', () => {
    it('renames resource to entity and keeps the filter state whole', () => {
      expect(
        toWireSavedViewDraft({
          resource: 'residents',
          name: 'San Juan, unverified',
          params: { barangayId: 'brgy-san-juan', tier: 'unverified' },
          isShared: true,
        }),
      ).toEqual({
        entity: 'residents',
        name: 'San Juan, unverified',
        filters: { barangayId: 'brgy-san-juan', tier: 'unverified' },
        is_shared: true,
      });
    });

    /**
     * `columns` and `sort` are accepted by the endpoint and this console does not model them.
     *
     * Splitting them out of `params` would mean guessing which keys are filters and which are
     * presentation, and a saved view whose name describes a population (`DL-111`) is not a place
     * to guess.
     */
    it('invents neither columns nor sort', () => {
      const wire = toWireSavedViewDraft({
        resource: 'residents',
        name: 'x',
        params: { sort: 'name' },
        isShared: false,
      }) as Record<string, unknown>;

      expect(wire['columns']).toBeUndefined();
      expect(wire['sort']).toBeUndefined();
    });
  });

  describe('toWireFieldVisitDraft', () => {
    const draft = {
      caseId: null,
      residentId: asId<ResidentId>('res-1'),
      householdId: null,
      purpose: 'verification' as const,
      assignedTo: asId<StaffUserId>('staff-1'),
      scheduledFor: asIsoDate('2026-09-03'),
      scheduledWindow: 'Morning',
      addressVisited: '18 Rizal Street',
      checklist: [
        { code: 'roof', label: 'Roof condition', checked: false, note: null },
        { code: 'water', label: 'Water access', checked: false, note: null },
      ],
    };

    it('sends the checklist as codes only', () => {
      expect(toWireFieldVisitDraft(draft).checklist).toEqual([{ code: 'roof' }, { code: 'water' }]);
    });

    /**
     * **This is not a tracking product** (`DL-86`).
     *
     * There is no coordinate, no check-in and no route anywhere in the visit model, and an
     * outbound mapper is one of the places that would quietly become one if a field were added
     * without thought. Asserted here so the absence is deliberate rather than incidental.
     */
    it('carries nothing a tracking product would recognise', () => {
      const wire = JSON.stringify(toWireFieldVisitDraft(draft));

      for (const forbidden of ['lat', 'lng', 'latitude', 'longitude', 'coordinate', 'geo', 'checkin', 'check_in']) {
        expect(wire.toLowerCase()).not.toContain(forbidden);
      }
    });
  });

  describe('toWireAssessment', () => {
    const draft: AssessmentDraft = {
      findings: '  Household of five in one rented room.  ',
      recommendedAmount: centavos(500_000),
      homeVisitConducted: true,
      recommendation: 'recommend-approve',
    };

    it('sends the recommendation the endpoint requires, and trims the findings', () => {
      expect(toWireAssessment(draft)).toEqual({
        recommendation: 'recommend-approve',
        findings: 'Household of five in one rented room.',
      });
    });

    /**
     * `insufficient-information` is a recommendation, not an absence.
     *
     * The backend enum makes it a first-class case for the reason its docblock gives: forcing a
     * view out of an incomplete file is how "insufficient information" becomes "denied" in the
     * record. A mapper that dropped it as falsy would 422 the save and teach the assessor that the
     * honest answer is the one that does not work.
     */
    it('sends "insufficient information" as a recommendation like any other', () => {
      expect(toWireAssessment({ ...draft, recommendation: 'insufficient-information' })).toEqual({
        recommendation: 'insufficient-information',
        findings: 'Household of five in one rented room.',
      });
    });

    /**
     * Empty findings are omitted rather than sent as ''.
     *
     * The field is `nullable` on the endpoint, and a blank string records that the assessor was
     * asked and wrote nothing — which is a different claim from not having reached that part yet.
     */
    it('omits findings nobody has written', () => {
      expect(toWireAssessment({ ...draft, findings: '   ' })).toEqual({
        recommendation: 'recommend-approve',
      });
    });

    /**
     * The two fields the endpoint has no home for are dropped, deliberately.
     *
     * `complete` takes `recommendation`, `reason` and `findings` and nothing else. Inventing a key
     * for the amount is a 422 on every save; folding it into `findings` puts a figure in free text
     * where no report can find it. The loss is recorded in
     * `docs/integration/release-engineering.md` rather than papered over here.
     */
    it('sends no amount and no home-visit flag, because the endpoint has neither', () => {
      const wire = toWireAssessment(draft);

      expect(Object.keys(wire).sort()).toEqual(['findings', 'recommendation']);
    });
  });
});
