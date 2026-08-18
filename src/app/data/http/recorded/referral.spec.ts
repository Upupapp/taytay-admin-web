import DETAIL from './referral-detail.json';

/**
 * Recorded from the running API: a service provider was created, a referral
 * raised against it, and the result read back.
 *
 * There is **no mapper for this resource yet**, and one field is the reason.
 * These tests pin what the payload carries so the gap is checkable, and so the
 * day it closes they fail and say the mapper can be written.
 */
describe('the referral payload, as recorded', () => {
  it('carries the disclosure plan the console models', () => {
    // 21 fields on the detail, including `disclosure`, `blockers` and `notes`.
    // The plan is empty until a basis is recorded, which is correct: the
    // console types it `DisclosurePlan | null` for exactly this state.
    expect(DETAIL.data.disclosure).toEqual({
      basis: null,
      note: null,
      recorded_at: null,
      fields: [],
      attachments: [],
    });
  });

  it('refuses to send without a lawful basis — DL-82, enforced server-side', () => {
    /*
     * The console's rule is that a referral cannot be sent without a lawful
     * basis recorded in the same act, "so there is no window in which a
     * sendable referral has none". The API reaches the same conclusion
     * independently: POST .../send answers 422 with
     * `blockers: ["disclosure-basis-required"]`.
     *
     * Both sides agreeing on this without either having read the other is the
     * strongest signal in the integration that the two teams understood the
     * same problem.
     */
    expect(DETAIL.data.blockers).toEqual(['disclosure-basis-required']);
  });

  it('sends a destination the console cannot narrow — L-18', () => {
    /*
     * `ReferralDestination` is a closed union of eight Philippine destinations:
     * dswd-field-office, hospital-msw, philhealth, peso, barangay-vaw-desk,
     * women-and-children-protection-desk, other-lgu-office, ngo-partner.
     *
     * The API validates `destination_type` as ['sometimes','string','max:48'] —
     * free text — and sent `health-facility`.
     *
     * This is not cosmetic. Two of the console's eight are protection desks,
     * and whether a referral is going to one governs how much may be disclosed
     * and whether `referral.disclose-protected` applies. Against a free string
     * the console cannot tell, so it cannot apply the rule.
     */
    expect(DETAIL.data.destination_type).toBe('health-facility');

    const consoleDestinations = [
      'dswd-field-office',
      'hospital-msw',
      'philhealth',
      'peso',
      'barangay-vaw-desk',
      'women-and-children-protection-desk',
      'other-lgu-office',
      'ngo-partner',
    ];

    expect(consoleDestinations).not.toContain(DETAIL.data.destination_type);
  });

  it('carries the reason, unlike the assistance request', () => {
    // Worth contrasting with L-16: a referral says why, an assistance request
    // does not, and both are read by the same social worker.
    expect(DETAIL.data.reason).toBe('Household member needs follow-up care after hospitalisation.');
  });
});
