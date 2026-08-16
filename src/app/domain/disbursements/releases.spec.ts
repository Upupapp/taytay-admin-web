import {
  DISBURSEMENT_STATUS_CATALOG,
  DISBURSEMENT_STATUS_TRANSITIONS,
  MANIFEST_NOTICE,
  SELF_RELEASE_WARNING,
  asId,
  asIsoDate,
  asIsoDateTime,
  batchProblems,
  batchProgress,
  canTransition,
  composeManifest,
  describeBatch,
  disbursementProblems,
  isReleaseOpen,
  isReleased,
  isSelfRelease,
  maskReference,
  pesos,
  sumReleased,
  type Disbursement,
  type DisbursementId,
  type DisbursementStatus,
  type ReleaseBatchDraft,
  type ResidentId,
  type ResidentView,
  type StaffUserId,
} from '@domain/index';

const TODAY = asIsoDate('2026-08-01');
const OFFICER = asId<StaffUserId>('staff-disbursement');
const HEAD = asId<StaffUserId>('staff-head');

function release(overrides: Partial<Disbursement> = {}): Disbursement {
  return {
    id: asId<DisbursementId>('dsb-1'),
    requestId: asId('req-1'),
    residentId: asId<ResidentId>('res-0001'),
    referenceNumber: 'DV-2026-00311',
    status: 'scheduled',
    method: 'cash',
    kind: 'money',
    amount: pesos(3000),
    inKindDescription: null,
    fundingSourceLabel: 'Municipal social welfare fund',
    approvingReference: 'MSWDO-APR-2026-0311',
    batchId: null,
    scheduledFor: asIsoDate('2026-08-10'),
    releasedAt: null,
    releasedBy: null,
    acknowledgedAt: null,
    acknowledgement: null,
    deferralReason: null,
    instrumentReference: null,
    remarks: null,
    audit: {
      createdAt: asIsoDateTime('2026-07-01T00:00:00.000Z'),
      createdBy: null,
      updatedAt: asIsoDateTime('2026-07-01T00:00:00.000Z'),
      updatedBy: null,
    },
    ...overrides,
  };
}

function beneficiary(): ResidentView {
  return {
    resident: {
      id: asId<ResidentId>('res-0001'),
      householdId: null,
      name: { first: 'Aurora', middle: null, last: 'Mercado', suffix: null },
      sex: 'female',
      birthDate: asIsoDate('1956-03-14'),
      civilStatus: 'widowed',
      address: {
        barangayId: asId('brgy-san-juan'),
        purokOrSitio: 'Purok 3',
        streetAddress: '18 Rizal Street',
      },
      contact: { mobile: '0917-555-0101', email: null },
      sectors: ['senior-citizen'],
      philsysLastFour: '4471',
      monthlyIncome: pesos(4000),
      isActive: true,
      audit: {
        createdAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
        createdBy: null,
        updatedAt: asIsoDateTime('2026-01-01T00:00:00.000Z'),
        updatedBy: null,
      },
    },
    isProtected: false,
    withheld: [],
    listedName: 'Mercado, Aurora',
    fullName: 'Aurora Mercado',
  };
}

describe('the release lifecycle', () => {
  it('keeps every status in the catalog and the transition map', () => {
    for (const status of Object.keys(DISBURSEMENT_STATUS_CATALOG) as DisbursementStatus[]) {
      expect(DISBURSEMENT_STATUS_TRANSITIONS[status]).toBeDefined();
    }
  });

  it('separates a deferral from an unclaimed payout, in words', () => {
    // One is the office's failing and one is not, and recording them the same
    // way blames a household for a missing countersignature.
    expect(DISBURSEMENT_STATUS_CATALOG.deferred.description).toContain('against the office');
    expect(DISBURSEMENT_STATUS_CATALOG.unclaimed.description).toContain('Not collected');
  });

  it('lets a deferred or corrected release go back on a schedule', () => {
    expect(canTransition(DISBURSEMENT_STATUS_TRANSITIONS, 'deferred', 'scheduled')).toBe(true);
    expect(canTransition(DISBURSEMENT_STATUS_TRANSITIONS, 'needs-correction', 'scheduled')).toBe(
      true,
    );
  });

  it('treats completed and voided as terminal', () => {
    expect(DISBURSEMENT_STATUS_TRANSITIONS.completed).toEqual([]);
    expect(DISBURSEMENT_STATUS_TRANSITIONS.voided).toEqual([]);
    expect(isReleaseOpen('completed')).toBe(false);
    expect(isReleaseOpen('voided')).toBe(false);
    expect(isReleaseOpen('deferred')).toBe(true);
  });

  it('never lets a for-release payout jump straight to released', () => {
    // It has to be scheduled first: a release with no payout session behind it
    // is one nobody was told to attend.
    expect(canTransition(DISBURSEMENT_STATUS_TRANSITIONS, 'for-release', 'released')).toBe(false);
  });

  it('counts only what reached somebody as released', () => {
    expect(isReleased('released')).toBe(true);
    expect(isReleased('claimed')).toBe(true);
    expect(isReleased('completed')).toBe(true);
    expect(isReleased('deferred')).toBe(false);
    expect(isReleased('unclaimed')).toBe(false);
  });
});

describe('money and goods are different records', () => {
  it('refuses a money release with no amount', () => {
    expect(disbursementProblems(release({ amount: null }))).toContain(
      'money-release-without-an-amount',
    );
  });

  it('refuses an in-kind release carrying a peso figure', () => {
    // Forcing a value onto a sack of rice invents a number that then appears in
    // reports as though somebody counted it.
    expect(
      disbursementProblems(
        release({ kind: 'in-kind', amount: pesos(500), inKindDescription: 'Food pack' }),
      ),
    ).toContain('in-kind-release-with-an-amount');
  });

  it('refuses goods nobody described', () => {
    expect(
      disbursementProblems(release({ kind: 'in-kind', amount: null, inKindDescription: '  ' })),
    ).toContain('in-kind-release-without-a-description');
  });

  it('accepts a well-formed release of each kind', () => {
    expect(disbursementProblems(release())).toEqual([]);
    expect(
      disbursementProblems(
        release({
          kind: 'in-kind',
          amount: null,
          inKindDescription: 'One family food pack: 10kg rice, 12 tinned goods.',
        }),
      ),
    ).toEqual([]);
  });

  it('leaves goods out of a peso total rather than counting them as zero', () => {
    const total = sumReleased([
      release({ status: 'claimed', amount: pesos(3000) }),
      release({
        id: asId<DisbursementId>('dsb-2'),
        status: 'claimed',
        kind: 'in-kind',
        amount: null,
        inKindDescription: 'Food pack',
      }),
      release({ id: asId<DisbursementId>('dsb-3'), status: 'deferred', amount: pesos(9000) }),
    ]);

    expect(total.centavos).toBe(pesos(3000).centavos);
  });

  it('refuses a release nobody is accountable for', () => {
    expect(disbursementProblems(release({ status: 'released', releasedBy: null }))).toContain(
      'released-by-nobody',
    );
  });

  it('refuses a deferral with no stated reason', () => {
    expect(disbursementProblems(release({ status: 'deferred', deferralReason: null }))).toContain(
      'deferred-without-a-reason',
    );
  });

  it('refuses a representative collecting without authority', () => {
    expect(
      disbursementProblems(
        release({
          status: 'claimed',
          releasedBy: OFFICER,
          acknowledgement: {
            kind: 'representative',
            acknowledgedAt: asIsoDateTime('2026-08-10T02:00:00.000Z'),
            collectedBy: 'His daughter',
            authority: '  ',
          },
        }),
      ),
    ).toContain('representative-without-authority');
  });
});

describe('a batch is a plan, not a unit', () => {
  it('has no status of its own — progress is counted from its members', () => {
    const progress = batchProgress([
      release({ status: 'claimed', releasedBy: OFFICER, amount: pesos(3000) }),
      release({ id: asId<DisbursementId>('b'), status: 'deferred', deferralReason: 'voucher-error' }),
      release({ id: asId<DisbursementId>('c'), status: 'scheduled' }),
      release({ id: asId<DisbursementId>('d'), status: 'needs-correction' }),
    ]);

    expect(progress.total).toBe(4);
    expect(progress.released).toBe(1);
    expect(progress.deferred).toBe(1);
    expect(progress.outstanding).toBe(1);
    expect(progress.needsCorrection).toBe(1);
  });

  it('never summarises a session as complete while somebody is still waiting', () => {
    const sentence = describeBatch(
      batchProgress([
        release({ status: 'claimed', releasedBy: OFFICER }),
        release({ id: asId<DisbursementId>('b'), status: 'scheduled' }),
      ]),
    );

    expect(sentence).toContain('1 of 2 released');
    expect(sentence).toContain('still to release');
    expect(sentence).not.toBe('Complete.');
  });

  it('totals only what was handed over, never what was scheduled', () => {
    const progress = batchProgress([
      release({ status: 'claimed', amount: pesos(3000) }),
      release({ id: asId<DisbursementId>('b'), status: 'scheduled', amount: pesos(50_000) }),
    ]);

    expect(progress.totalReleased.centavos).toBe(pesos(3000).centavos);
  });

  it('refuses a session with no venue, or nothing in it', () => {
    const draft = (overrides: Partial<ReleaseBatchDraft> = {}): ReleaseBatchDraft => ({
      title: 'AICS payout',
      scheduledFor: asIsoDate('2026-08-10'),
      venue: 'Municipal Hall lobby',
      officerId: OFFICER,
      disbursementIds: [asId<DisbursementId>('dsb-1')],
      notes: null,
      ...overrides,
    });

    expect(batchProblems(draft(), TODAY)).toEqual([]);
    // A payout with no stated place is one a beneficiary cannot be told to attend.
    expect(batchProblems(draft({ venue: '  ' }), TODAY)).toContain('venue-required');
    expect(batchProblems(draft({ disbursementIds: [] }), TODAY)).toContain('nothing-to-release');
    expect(batchProblems(draft({ scheduledFor: asIsoDate('2026-07-01') }), TODAY)).toContain(
      'scheduled-in-the-past',
    );
  });
});

describe('the manifest that goes to the table', () => {
  const manifest = composeManifest({
    batchReference: 'RB-2026-0014',
    title: 'AICS payout',
    scheduledFor: asIsoDate('2026-08-10'),
    venue: 'Municipal Hall lobby',
    officerName: 'Disbursing officer',
    preparedAt: asIsoDateTime('2026-08-09T01:00:00.000Z'),
    entries: [
      { release: release(), beneficiary: beneficiary() },
      {
        release: release({
          id: asId<DisbursementId>('dsb-2'),
          kind: 'in-kind',
          amount: null,
          inKindDescription: 'One family food pack',
        }),
        beneficiary: beneficiary(),
      },
    ],
  });

  it('carries a name and a masked reference, and nothing else about the person', () => {
    const printed = JSON.stringify(manifest);

    expect(printed).toContain('Mercado, Aurora');
    expect(printed).toContain('••••0311');
    // None of these help anybody at a payout table.
    expect(printed).not.toContain('1956-03-14');
    expect(printed).not.toContain('18 Rizal Street');
    expect(printed).not.toContain('4471');
    expect(printed).not.toContain('senior-citizen');
    expect(printed).not.toContain('DV-2026-00311');
  });

  it('numbers the rows so a table can call people in order', () => {
    expect(manifest.lines.map((line) => line.position)).toEqual([1, 2]);
  });

  it('counts goods but does not value them', () => {
    expect(manifest.moneyLineCount).toBe(1);
    expect(manifest.inKindLineCount).toBe(1);
    expect(manifest.moneyTotal.centavos).toBe(pesos(3000).centavos);
  });

  it('leaves the acknowledgement blank', () => {
    // Pre-filling how somebody will acknowledge is how a sheet comes back
    // signed for a person who was never there.
    for (const line of manifest.lines) {
      expect(line.acknowledgementKind).toBeNull();
    }
  });

  it('prints the handling notice with the statute on it', () => {
    expect(manifest.handlingNotice).toBe(MANIFEST_NOTICE);
    expect(manifest.handlingNotice).toContain('RA 10173');
  });

  it('masks a short reference whole rather than revealing most of it', () => {
    expect(maskReference('12')).toBe('••');
    expect(maskReference('DV-2026-00311')).toBe('••••0311');
  });
});

describe('segregation of duties', () => {
  it('notices when the approver is also the releasing officer', () => {
    expect(isSelfRelease(HEAD, HEAD)).toBe(true);
    expect(isSelfRelease(HEAD, OFFICER)).toBe(false);
    expect(isSelfRelease(null, OFFICER)).toBe(false);
  });

  it('warns rather than refuses', () => {
    // A small office on a bad day may genuinely have one person available, and
    // blocking the payout punishes the family for the office's staffing.
    expect(SELF_RELEASE_WARNING).toContain('Ask another officer');
    expect(SELF_RELEASE_WARNING).not.toContain('cannot');
  });
});
