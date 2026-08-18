import { toFieldVisit } from './visit.mapper';
import DETAIL from '../recorded/visit-detail.json';
import CREATED from '../recorded/visit-created.json';

/**
 * Both fixtures are recorded from the API actually running: a visit created
 * through `POST admin/visits`, then read back after an observation was
 * recorded against it.
 */
describe('toFieldVisit', () => {
  it('maps a real detail payload', () => {
    const visit = toFieldVisit(DETAIL.data);

    expect(visit?.referenceNumber).toBe('FV-20260818-PN8CR');
    expect(visit?.status).toBe('scheduled');
    expect(visit?.purpose).toBe('initial-assessment');
    expect(visit?.scheduledFor).toBe('2026-08-25');
    expect(visit?.addressVisited).toBe('7 Ilang-Ilang Street');
  });

  it('keeps each observation under the kind it was recorded as', () => {
    /*
     * `DL-85`. "The roof is missing sheets", "she says he has not sent money
     * since March" and "the household appears unable to meet its food costs"
     * are a fact, a report and a judgement. Flattened into prose they become
     * indistinguishable, and six months on a different worker reads all three
     * as established fact about the family.
     */
    const visit = toFieldVisit(DETAIL.data);

    expect(visit?.observations).toHaveLength(1);
    expect(visit?.observations[0]?.kind).toBe('observed');
    expect(visit?.observations[0]?.body).toBe('Roof sheeting missing over the kitchen.');
    expect(visit?.observations[0]?.attributedTo).toBeNull();
  });

  it('drops an observation whose kind it cannot read, rather than guessing', () => {
    // Guessing which of the four an unknown kind meant is guessing whose claim
    // it was — the worker's, the client's, or a neighbour's.
    const wire = {
      ...DETAIL.data,
      observations: [{ ...DETAIL.data.observations[0], kind: 'invented-next-year' }],
    };

    expect(toFieldVisit(wire)?.observations).toEqual([]);
  });

  it('maps the create response, which carries no observations key at all', () => {
    // The list and create payloads have 11 fields; the detail has 19. A newly
    // scheduled visit genuinely has no observations, so an empty list is true
    // here — but see the mapper's note: on a *completed* visit read from a list
    // row, it would not be.
    const visit = toFieldVisit(CREATED.data);

    expect(visit).not.toBeNull();
    expect(visit?.observations).toEqual([]);
    expect(visit?.checklist).toEqual([]);
  });

  it('leaves the fields the wire does not carry honestly absent', () => {
    const visit = toFieldVisit(DETAIL.data);

    expect(visit?.caseId).toBeNull();
    expect(visit?.householdId).toBeNull();
    expect(visit?.completedAt).toBeNull();
    expect(visit?.outcome).toBeNull();
  });

  it('drops a record missing anything a screen keys on', () => {
    expect(toFieldVisit({ ...DETAIL.data, status: 'invented' })).toBeNull();
    expect(toFieldVisit({ ...DETAIL.data, purpose: 'invented' })).toBeNull();
    expect(toFieldVisit({ ...DETAIL.data, scheduled_for: null })).toBeNull();
    expect(toFieldVisit(null)).toBeNull();
  });
});
