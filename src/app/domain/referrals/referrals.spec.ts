import {
  FOLLOW_UP_DAYS,
  HANDLING_NOTICE,
  REFERRAL_STATUS_CATALOG,
  REFERRAL_STATUS_TRANSITIONS,
  asId,
  asIsoDate,
  asIsoDateTime,
  byReferralUrgency,
  canTransition,
  composeReferralSummary,
  defaultFollowUpDate,
  disclosurePlanProblems,
  isReferralFilterActive,
  isReferralOpen,
  isReferralOverdue,
  needsExtraCare,
  providerProblems,
  referralDraftProblems,
  type DisclosurePlan,
  type Referral,
  type ReferralDraft,
  type ReferralId,
  type ReferralStatus,
  type ResidentId,
  type ResidentView,
  type ServiceProvider,
  type ServiceProviderId,
  type StaffUserId,
} from '@domain/index';

const TODAY = asIsoDate('2026-08-01');

function plan(overrides: Partial<DisclosurePlan> = {}): DisclosurePlan {
  return {
    authority: {
      basis: 'client-consent',
      note: 'Explained at the counter which office would receive her details, and why. She agreed.',
      recordedBy: asId<StaffUserId>('staff-1'),
      recordedOn: TODAY,
    },
    extraFields: [],
    attachments: [],
    ...overrides,
  };
}

function referral(overrides: Partial<Referral> = {}): Referral {
  return {
    id: asId<ReferralId>('ref-1'),
    referenceNumber: 'RF-2026-0001',
    residentId: asId<ResidentId>('res-0001'),
    requestId: null,
    caseId: null,
    destination: 'peso',
    destinationName: 'Taytay Public Employment Service Office',
    providerId: null,
    status: 'sent',
    urgency: 'routine',
    serviceRequested: 'Job matching',
    reason: 'Retrenched in June.',
    destinationContact: null,
    disclosure: plan(),
    referredBy: asId<StaffUserId>('staff-1'),
    referredAt: asIsoDateTime('2026-07-01T00:00:00.000Z'),
    followUpOn: asIsoDate('2026-07-15'),
    respondedAt: null,
    outcome: null,
    handoffNotes: [],
    audit: {
      createdAt: asIsoDateTime('2026-07-01T00:00:00.000Z'),
      createdBy: null,
      updatedAt: asIsoDateTime('2026-07-01T00:00:00.000Z'),
      updatedBy: null,
    },
    ...overrides,
  };
}

function client(overrides: Partial<ResidentView['resident']> = {}): ResidentView {
  const resident = {
    id: asId<ResidentId>('res-0001'),
    householdId: null,
    name: { first: 'Aurora', middle: null, last: 'Mercado', suffix: null },
    sex: 'female' as const,
    birthDate: asIsoDate('1956-03-14'),
    civilStatus: 'widowed' as const,
    address: {
      barangayId: asId<ResidentView['resident']['address']['barangayId']>('brgy-san-juan'),
      purokOrSitio: 'Purok 3',
      streetAddress: '18 Rizal Street',
    },
    contact: { mobile: '0917-555-0101', email: null },
    sectors: ['senior-citizen' as const],
    philsysLastFour: '4471',
    monthlyIncome: { centavos: 400_000, currency: 'PHP' as const },
    isActive: true,
    audit: {
      createdAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
      createdBy: null,
      updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
      updatedBy: null,
    },
    ...overrides,
  };

  return {
    resident,
    isProtected: false,
    withheld: [],
    listedName: 'Mercado, Aurora',
    fullName: 'Aurora Mercado',
  };
}

describe('the referral lifecycle', () => {
  it('keeps every status in the catalog and the transition map', () => {
    for (const status of Object.keys(REFERRAL_STATUS_CATALOG) as ReferralStatus[]) {
      expect(REFERRAL_STATUS_TRANSITIONS[status]).toBeDefined();
    }
  });

  it('lets a referral waiting on the client return to progress', () => {
    // The one loop in the lifecycle, and it exists because families routinely
    // come back with the missing paper.
    expect(canTransition(REFERRAL_STATUS_TRANSITIONS, 'waiting-requirements', 'in-progress')).toBe(
      true,
    );
  });

  it('treats closed as terminal', () => {
    expect(REFERRAL_STATUS_TRANSITIONS.closed).toEqual([]);
    expect(isReferralOpen('closed')).toBe(false);
    expect(isReferralOpen('declined')).toBe(false);
    expect(isReferralOpen('waiting-requirements')).toBe(true);
  });

  it('never lets a referral jump straight from draft to served', () => {
    expect(canTransition(REFERRAL_STATUS_TRANSITIONS, 'draft', 'served')).toBe(false);
  });
});

describe('chasing a referral', () => {
  it('counts the follow-up date from the day it was sent, by urgency', () => {
    expect(defaultFollowUpDate(TODAY, 'urgent')).toBe('2026-08-03');
    expect(defaultFollowUpDate(TODAY, 'priority')).toBe('2026-08-08');
    expect(defaultFollowUpDate(TODAY, 'routine')).toBe('2026-08-15');
    expect(FOLLOW_UP_DAYS.urgent).toBeLessThan(FOLLOW_UP_DAYS.routine);
  });

  it('reports an unanswered referral past its date as overdue', () => {
    expect(isReferralOverdue(referral(), TODAY)).toBe(true);
  });

  it('stops calling it overdue once the office has heard back', () => {
    const answered = referral({ respondedAt: asIsoDateTime('2026-07-10T00:00:00.000Z') });
    expect(isReferralOverdue(answered, TODAY)).toBe(false);
  });

  it('does not chase a closed or declined referral', () => {
    expect(isReferralOverdue(referral({ status: 'closed' }), TODAY)).toBe(false);
    expect(isReferralOverdue(referral({ status: 'declined' }), TODAY)).toBe(false);
  });

  it('does not chase one with no date set', () => {
    expect(isReferralOverdue(referral({ followUpOn: null }), TODAY)).toBe(false);
  });

  it('orders the queue overdue first, then by urgency', () => {
    const overdueRoutine = referral({ id: asId<ReferralId>('a'), urgency: 'routine' });
    const urgentNotDue = referral({
      id: asId<ReferralId>('b'),
      urgency: 'urgent',
      followUpOn: asIsoDate('2026-09-01'),
    });
    const priorityNotDue = referral({
      id: asId<ReferralId>('c'),
      urgency: 'priority',
      followUpOn: asIsoDate('2026-09-01'),
    });

    const ordered = [priorityNotDue, urgentNotDue, overdueRoutine].sort((a, b) =>
      byReferralUrgency(a, b, TODAY),
    );

    expect(ordered.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('the disclosure plan', () => {
  it('refuses a lawful basis nobody explained', () => {
    const problems = disclosurePlanProblems(
      plan({ authority: { ...plan().authority, note: '  ' } }),
    );
    expect(problems).toContain('authority-note-required');
  });

  it('refuses a field shared without a stated need', () => {
    const problems = disclosurePlanProblems(
      plan({ extraFields: [{ field: 'address', because: '' }] }),
    );
    expect(problems).toContain('field-needs-a-reason');
  });

  it('refuses an attachment shared without a stated need', () => {
    const problems = disclosurePlanProblems(
      plan({
        attachments: [{ documentId: asId('doc-1'), label: 'Medical abstract', because: '   ' }],
      }),
    );
    expect(problems).toContain('attachment-needs-a-reason');
  });

  it('refuses the same field chosen twice', () => {
    const problems = disclosurePlanProblems(
      plan({
        extraFields: [
          { field: 'address', because: 'For the home visit.' },
          { field: 'address', because: 'Again.' },
        ],
      }),
    );
    expect(problems).toContain('duplicate-field');
  });

  it('accepts a well-formed plan', () => {
    expect(
      disclosurePlanProblems(
        plan({ extraFields: [{ field: 'birth-date', because: 'To trace an existing record.' }] }),
      ),
    ).toEqual([]);
  });

  it('flags the fields that need a second thought', () => {
    expect(needsExtraCare('vulnerability-sectors')).toBe(true);
    expect(needsExtraCare('address')).toBe(true);
    expect(needsExtraCare('birth-date')).toBe(false);
  });
});

describe('the summary that leaves the building', () => {
  it('carries only the minimum when nothing extra was chosen', () => {
    const sheet = composeReferralSummary({
      referral: referral(),
      client: client(),
      plan: plan(),
      serviceRequested: 'Job matching',
    });

    expect(sheet.lines.map((line) => line.label)).toEqual(['Client', 'Referred by']);
    // The seeded address, number and contact are all absent by default.
    const printed = JSON.stringify(sheet);
    expect(printed).not.toContain('18 Rizal Street');
    expect(printed).not.toContain('0917-555-0101');
    expect(printed).not.toContain('1956-03-14');
  });

  it('carries a field only when somebody chose it', () => {
    const sheet = composeReferralSummary({
      referral: referral(),
      client: client(),
      plan: plan({
        extraFields: [{ field: 'contact-number', because: 'PESO calls applicants directly.' }],
      }),
      serviceRequested: 'Job matching',
    });

    const contact = sheet.lines.find((line) => line.label === 'Contact number');
    expect(contact?.value).toBe('0917-555-0101');
    expect(contact?.isExtra).toBe(true);
  });

  it('omits a chosen field the record does not hold, rather than printing it empty', () => {
    // An empty line invites the receiving office to ask for it.
    const sheet = composeReferralSummary({
      referral: referral(),
      client: client({ contact: { mobile: null, email: null } }),
      plan: plan({ extraFields: [{ field: 'contact-number', because: 'To reach her.' }] }),
      serviceRequested: 'Job matching',
    });

    expect(sheet.lines.some((line) => line.label === 'Contact number')).toBe(false);
  });

  it('cannot carry a field its author was not cleared to read', () => {
    // The redaction is inherited from `ResidentView`, not re-implemented, so a
    // withheld address is simply not there to print (`DL-38`).
    const sheet = composeReferralSummary({
      referral: referral(),
      client: client({ address: { barangayId: asId('brgy-san-juan'), purokOrSitio: null, streetAddress: null } }),
      plan: plan({ extraFields: [{ field: 'address', because: 'For the home visit.' }] }),
      serviceRequested: 'Job matching',
    });

    expect(sheet.lines.some((line) => line.label === 'Home address')).toBe(false);
  });

  it('prints the handling notice and the basis it was shared on', () => {
    const sheet = composeReferralSummary({
      referral: referral(),
      client: client(),
      plan: plan(),
      serviceRequested: 'Job matching',
    });

    expect(sheet.handlingNotice).toBe(HANDLING_NOTICE);
    expect(sheet.handlingNotice).toContain('RA 10173');
    expect(sheet.authorityStatement).toContain('agreed');
  });
});

describe('creating a referral', () => {
  function draft(overrides: Partial<ReferralDraft> = {}): ReferralDraft {
    return {
      residentId: asId<ResidentId>('res-0001'),
      requestId: null,
      caseId: null,
      providerId: null,
      destination: 'peso',
      destinationName: 'Taytay PESO',
      destinationContact: null,
      urgency: 'routine',
      serviceRequested: 'Job matching',
      reason: 'Retrenched in June.',
      followUpOn: null,
      ...overrides,
    };
  }

  it('accepts a well-formed draft', () => {
    expect(referralDraftProblems(draft(), TODAY)).toEqual([]);
  });

  it('refuses one that does not say what is being asked for', () => {
    expect(referralDraftProblems(draft({ serviceRequested: '  ' }), TODAY)).toContain(
      'service-required',
    );
  });

  it('refuses one with no reason and one with no destination', () => {
    expect(referralDraftProblems(draft({ reason: '' }), TODAY)).toContain('reason-required');
    expect(referralDraftProblems(draft({ destinationName: ' ' }), TODAY)).toContain(
      'destination-required',
    );
  });

  it('refuses a follow-up date already in the past', () => {
    expect(
      referralDraftProblems(draft({ followUpOn: asIsoDate('2026-07-01') }), TODAY),
    ).toContain('follow-up-in-the-past');
  });
});

describe('the provider directory', () => {
  function provider(overrides: Partial<ServiceProvider> = {}): ServiceProvider {
    return {
      id: asId<ServiceProviderId>('svp-1'),
      name: 'Taytay PESO',
      destination: 'peso',
      status: 'active',
      servicesOffered: ['Job matching'],
      address: 'Municipal Hall',
      barangayId: null,
      contact: { personName: null, position: null, phone: '(02) 8555-0119', email: null },
      channels: ['in-person'],
      usualResponseDays: 7,
      notes: null,
      audit: {
        createdAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
        createdBy: null,
        updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
        updatedBy: null,
      },
      ...overrides,
    };
  }

  it('accepts a usable entry', () => {
    expect(providerProblems(provider())).toEqual([]);
  });

  it('refuses an entry nobody could actually send to', () => {
    expect(providerProblems(provider({ channels: [] }))).toContain('provider-needs-a-channel');
    expect(
      providerProblems(
        provider({
          address: null,
          contact: { personName: null, position: null, phone: null, email: null },
        }),
      ),
    ).toContain('provider-needs-a-way-to-reach-it');
  });

  it('refuses an entry that does not say what it does', () => {
    expect(providerProblems(provider({ servicesOffered: [] }))).toContain(
      'provider-needs-a-service',
    );
  });
});

describe('referral filtering', () => {
  it('reports an empty filter as inactive', () => {
    expect(isReferralFilterActive({})).toBe(false);
  });

  it('notices every dimension', () => {
    expect(isReferralFilterActive({ overdueOnly: true })).toBe(true);
    expect(isReferralFilterActive({ urgency: 'urgent' })).toBe(true);
    expect(isReferralFilterActive({ caseId: asId('case-0001') })).toBe(true);
  });
});
