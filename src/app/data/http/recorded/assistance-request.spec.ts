import DETAIL from './assistance-request-detail.json';
import LIST from './assistance-requests-list.json';

/**
 * Recorded from the running API after creating a real assistance request.
 *
 * There is **no mapper for this resource**, and these tests are why. They pin
 * what the payload does and does not carry, so that the gap is a fact somebody
 * can check rather than a claim in a document — and so that the day the backend
 * closes it, these fail and tell somebody the mapper can now be written.
 */
describe('the assistance request payload, as recorded', () => {
  it('carries the lifecycle the console already models', () => {
    expect(DETAIL.data.status).toBe('draft');
    expect(LIST.data[0]?.status).toBe('draft');
  });

  it('tells the client which transitions are allowed', () => {
    // The server decides; the console renders what it is told. This is the
    // staff-side equivalent of ADR 0007's `available_actions`, and it means the
    // console never has to re-derive the transition map.
    expect(DETAIL.data.available_transitions).toEqual(['submitted', 'cancelled']);
  });

  it('does not carry the reason the family applied — L-16', () => {
    /*
     * `AssistanceRequest.reasonForRequest` is a required string in the domain,
     * and there is no field for it anywhere in the payload. `welfare_cases` has
     * no narrative column either, so it is not hidden behind a permission — it
     * does not exist.
     *
     * A console that cannot show why a household applied cannot support the
     * decision it is asking a social worker to make.
     */
    expect('narrative' in DETAIL.data).toBe(false);
    expect(Object.keys(DETAIL.data).some((k) => /reason/.test(k) && k !== 'priority_reason')).toBe(false);
  });

  it('does not carry any amount — L-17', () => {
    // `requestedAmount` and `approvedAmount` are core domain fields. There is no
    // money on this resource at all; it lives on releases. TAB 08 owns it.
    expect(Object.keys(DETAIL.data).some((k) => /amount|currency|centavo/.test(k))).toBe(false);
  });

  it('sends a null programme, which the domain types as required', () => {
    // `programId: ProgramId` is non-nullable in the domain.
    expect(DETAIL.data.program_id).toBeNull();
  });

  it('sends barangay_id as a number here too — L-15', () => {
    expect(typeof DETAIL.data.barangay_id).toBe('number');
  });
});
