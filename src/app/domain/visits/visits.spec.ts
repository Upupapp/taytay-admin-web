import {
  CAPTURE_STATE_DESCRIPTIONS,
  OBSERVATION_KINDS,
  VISIT_STATUS_CATALOG,
  VISIT_STATUS_TRANSITIONS,
  asId,
  asIsoDate,
  asIsoDateTime,
  canTransition,
  emptyCapture,
  groupVisitsByDay,
  hasSomethingToSend,
  isAllJudgement,
  isDueToday,
  isJudgement,
  isUnsent,
  isUpcoming,
  isVisitOpen,
  isVisitOverdue,
  needsAttribution,
  observationMix,
  observationProblems,
  unsentWarning,
  visitDraftProblems,
  visitOutcomeProblems,
  warnsOnLeaving,
  wasAttended,
  type CaptureState,
  type FieldVisit,
  type FieldVisitDraft,
  type FieldVisitId,
  type ResidentId,
  type StaffUserId,
  type VisitObservation,
  type VisitObservationDraft,
  type VisitObservationId,
  type VisitOutcomeDraft,
  type VisitStatus,
} from '@domain/index';

const TODAY = asIsoDate('2026-08-01');

function visit(overrides: Partial<FieldVisit> = {}): FieldVisit {
  return {
    id: asId<FieldVisitId>('fv-1'),
    referenceNumber: 'HV-2026-0001',
    caseId: null,
    residentId: asId<ResidentId>('res-0001'),
    householdId: null,
    status: 'scheduled',
    purpose: 'follow-up',
    assignedTo: asId<StaffUserId>('staff-1'),
    scheduledFor: asIsoDate('2026-07-20'),
    scheduledWindow: null,
    addressVisited: '18 Rizal Street',
    checklist: [],
    observations: [],
    serviceNeeds: null,
    declinedReason: null,
    outcome: null,
    completedAt: null,
    audit: {
      createdAt: asIsoDateTime('2026-07-01T00:00:00.000Z'),
      createdBy: null,
      updatedAt: asIsoDateTime('2026-07-01T00:00:00.000Z'),
      updatedBy: null,
    },
    ...overrides,
  };
}

function observation(overrides: Partial<VisitObservation> = {}): VisitObservation {
  return {
    id: asId<VisitObservationId>('vob-1'),
    kind: 'observed',
    body: 'One room, roof intact, shared tap two doors down.',
    attributedTo: null,
    recordedBy: asId<StaffUserId>('staff-1'),
    recordedAt: asIsoDateTime('2026-07-20T00:00:00.000Z'),
    ...overrides,
  };
}

function draft(overrides: Partial<VisitObservationDraft> = {}): VisitObservationDraft {
  return {
    kind: 'observed',
    body: 'One room, roof intact.',
    attributedTo: null,
    ...overrides,
  };
}

describe('an observation says whose claim it is', () => {
  it('names four kinds, and they are not interchangeable', () => {
    expect(OBSERVATION_KINDS).toEqual([
      'observed',
      'client-said',
      'third-party-said',
      'worker-assessed',
    ]);
  });

  it('requires an attribution when somebody else is being quoted', () => {
    // "A neighbour said" with no neighbour named is a rumour the office cannot
    // check and cannot answer for.
    expect(needsAttribution('third-party-said')).toBe(true);
    expect(
      observationProblems(draft({ kind: 'third-party-said', body: 'Says she is managing alone.' })),
    ).toContain('attribution-required');
  });

  it('accepts a third-party account once somebody is named', () => {
    expect(
      observationProblems(
        draft({
          kind: 'third-party-said',
          body: 'Says she is managing alone.',
          attributedTo: 'Barangay kagawad, Purok 5',
        }),
      ),
    ).toEqual([]);
  });

  it('refuses an attribution on the worker’s own observation', () => {
    // It would read as though somebody else vouched for what the worker saw.
    expect(observationProblems(draft({ attributedTo: 'A neighbour' }))).toContain(
      'attribution-not-applicable',
    );
  });

  it('refuses an observation with nothing in it', () => {
    expect(observationProblems(draft({ body: 'ok' }))).toContain('body-required');
  });

  it('keeps a judgement distinguishable from a fact', () => {
    expect(isJudgement('worker-assessed')).toBe(true);
    expect(isJudgement('observed')).toBe(false);
    expect(isJudgement('client-said')).toBe(false);
  });

  it('counts the mix, so a screen can say what a record consists of', () => {
    const mix = observationMix([
      observation({ id: asId<VisitObservationId>('a'), kind: 'observed' }),
      observation({ id: asId<VisitObservationId>('b'), kind: 'client-said' }),
      observation({
        id: asId<VisitObservationId>('c'),
        kind: 'third-party-said',
        attributedTo: 'Kagawad',
      }),
      observation({ id: asId<VisitObservationId>('d'), kind: 'worker-assessed' }),
    ]);

    expect(mix).toEqual({
      observed: 1,
      clientSaid: 1,
      thirdPartySaid: 1,
      workerAssessed: 1,
    });
  });

  it('notices a record built only of judgement', () => {
    // Not blocked — a doorstep conversation can legitimately produce one — but
    // surfaced, because that is the shape that hardens into a label.
    expect(
      isAllJudgement([
        observation({ kind: 'worker-assessed' }),
        observation({ id: asId<VisitObservationId>('b'), kind: 'worker-assessed' }),
      ]),
    ).toBe(true);

    expect(isAllJudgement([observation({ kind: 'observed' })])).toBe(false);
    expect(isAllJudgement([])).toBe(false);
  });
});

describe('the visit lifecycle', () => {
  it('keeps every status in the catalog and the transition map', () => {
    for (const status of Object.keys(VISIT_STATUS_CATALOG) as VisitStatus[]) {
      expect(VISIT_STATUS_TRANSITIONS[status]).toBeDefined();
    }
  });

  it('makes every outcome terminal', () => {
    // A second attempt is a second visit, so "how many times did we go?" keeps
    // one answer.
    for (const status of ['completed', 'not-found', 'refused', 'cancelled'] as VisitStatus[]) {
      expect(VISIT_STATUS_TRANSITIONS[status]).toEqual([]);
    }
    expect(canTransition(VISIT_STATUS_TRANSITIONS, 'completed', 'not-found')).toBe(false);
  });

  it('separates nobody-home from a household declining', () => {
    // One is the household doing nothing; the other is a decision they made.
    expect(VISIT_STATUS_CATALOG['not-found'].description).toContain('household did nothing');
    expect(VISIT_STATUS_CATALOG.refused.description).toContain('declined');
    expect(wasAttended('not-found')).toBe(true);
    expect(wasAttended('refused')).toBe(true);
    expect(wasAttended('cancelled')).toBe(false);
  });

  it('reports a scheduled visit past its date as overdue', () => {
    expect(isVisitOverdue(visit(), TODAY)).toBe(true);
    expect(isVisitOverdue(visit({ status: 'completed' }), TODAY)).toBe(false);
    expect(isVisitOpen('scheduled')).toBe(true);
  });

  it('separates due today from upcoming', () => {
    expect(isDueToday(visit({ scheduledFor: TODAY }), TODAY)).toBe(true);
    expect(isUpcoming(visit({ scheduledFor: asIsoDate('2026-08-05') }), TODAY)).toBe(true);
    expect(isUpcoming(visit(), TODAY)).toBe(false);
  });

  it('groups by day, earliest first', () => {
    const days = groupVisitsByDay([
      visit({ id: asId<FieldVisitId>('b'), scheduledFor: asIsoDate('2026-08-05') }),
      visit({ id: asId<FieldVisitId>('a'), scheduledFor: asIsoDate('2026-08-01') }),
      visit({ id: asId<FieldVisitId>('c'), scheduledFor: asIsoDate('2026-08-05') }),
    ]);

    expect(days.map((day) => day.date)).toEqual(['2026-08-01', '2026-08-05']);
    expect(days[1]?.visits).toHaveLength(2);
  });
});

describe('scheduling and closing', () => {
  function visitDraft(overrides: Partial<FieldVisitDraft> = {}): FieldVisitDraft {
    return {
      caseId: null,
      residentId: asId<ResidentId>('res-0001'),
      householdId: null,
      purpose: 'follow-up',
      assignedTo: asId<StaffUserId>('staff-1'),
      scheduledFor: asIsoDate('2026-08-10'),
      scheduledWindow: null,
      addressVisited: '18 Rizal Street',
      checklist: [],
      ...overrides,
    };
  }

  it('accepts a well-formed schedule', () => {
    expect(visitDraftProblems(visitDraft(), TODAY)).toEqual([]);
  });

  it('refuses a visit scheduled into the past, or with no address', () => {
    expect(visitDraftProblems(visitDraft({ scheduledFor: asIsoDate('2026-07-01') }), TODAY)).toContain(
      'scheduled-in-the-past',
    );
    expect(visitDraftProblems(visitDraft({ addressVisited: '  ' }), TODAY)).toContain(
      'address-required',
    );
  });

  function outcome(overrides: Partial<VisitOutcomeDraft> = {}): VisitOutcomeDraft {
    return {
      status: 'completed',
      outcome: 'Household seen; assessment recorded.',
      serviceNeeds: null,
      declinedReason: null,
      ...overrides,
    };
  }

  it('refuses a closing with no outcome recorded', () => {
    expect(visitOutcomeProblems(outcome({ outcome: '  ' }))).toContain('outcome-required');
  });

  it('keeps a declined reason to a refusal', () => {
    // Attaching one to a completed visit would put words in a household's
    // mouth.
    expect(
      visitOutcomeProblems(outcome({ declinedReason: 'They said no.' })),
    ).toContain('declined-reason-not-applicable');

    expect(
      visitOutcomeProblems(
        outcome({ status: 'refused', declinedReason: 'Did not want a visit while working.' }),
      ),
    ).toEqual([]);
  });
});

describe('writing a visit up in the field', () => {
  const visitId = asId<FieldVisitId>('fv-1');
  const at = asIsoDateTime('2026-08-01T02:00:00.000Z');

  it('starts held on the device, and says so', () => {
    const capture = emptyCapture(visitId, at);

    expect(capture.state).toBe('held-locally');
    expect(isUnsent('held-locally')).toBe(true);
    expect(isUnsent('sent')).toBe(false);
  });

  it('has no state meaning "probably saved"', () => {
    const states: readonly CaptureState[] = ['held-locally', 'sending', 'sent', 'send-failed'];
    // Exactly one state means the office record has it.
    expect(states.filter((state) => !isUnsent(state))).toEqual(['sent']);
  });

  it('warns on leaving whenever the office record does not have it', () => {
    expect(warnsOnLeaving('held-locally')).toBe(true);
    expect(warnsOnLeaving('send-failed')).toBe(true);
    // Mid-send too: navigating away leaves the worker unable to find out
    // whether it landed.
    expect(warnsOnLeaving('sending')).toBe(true);
    expect(warnsOnLeaving('sent')).toBe(false);
  });

  it('does not warn about an empty capture', () => {
    expect(unsentWarning(emptyCapture(visitId, at))).toBeNull();
  });

  it('warns in words that say what is at stake', () => {
    const capture = {
      ...emptyCapture(visitId, at),
      observations: [draft()],
    };

    expect(hasSomethingToSend(capture)).toBe(true);
    const warning = unsentWarning(capture);
    expect(warning).toContain('on this device only');
    expect(warning).toContain('nothing has been sent');
  });

  it('says plainly that a failed send queued nothing in the background', () => {
    // A worker who believes a visit was filed and returns to find it was not
    // has been failed twice — once by the network and once by the interface.
    expect(CAPTURE_STATE_DESCRIPTIONS['send-failed']).toContain(
      'Nothing was queued in the background',
    );
  });
});
