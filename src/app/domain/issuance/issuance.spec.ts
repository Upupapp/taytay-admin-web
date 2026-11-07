import { describe, expect, it } from 'vitest';

import {
  asId,
  asIsoDateTime,
  type AppAccountId,
  type IssuanceRequestId,
  type IssuanceTypeId,
  type OfficeId,
} from '../shared/ids';
import { nextStatuses } from '../shared/status';
import {
  describeIssuanceWait,
  ISSUANCE_MOVE_EFFECTS,
  ISSUANCE_OPEN_STATUSES,
  ISSUANCE_STATUS_CATALOG,
  ISSUANCE_STATUS_TRANSITIONS,
  ISSUANCE_STATUSES,
  ISSUANCE_TERMINAL_STATUSES,
  issuanceMoveProblem,
  officeMovesFrom,
  oldestWaitingFirst,
  waitingOn,
  wholeIssuanceReference,
  type IssuanceRequestSummary,
  type IssuanceStatus,
} from './issuance-request';
import {
  describeProcessingStandard,
  feeEntryText,
  issuanceTypeChanges,
  issuanceTypeProblems,
  readFeeEntry,
  suggestRequirementCode,
  type IssuanceTypeFields,
} from './issuance-type';

/**
 * The backend's one transition table (`src/modules/issuance/lifecycle.ts`, `taytay-backend`
 * `2fd0566`), transcribed row for row. If the server's lifecycle changes, this list and the
 * console's map must change together.
 */
const BACKEND_TRANSITIONS: readonly (readonly [
  IssuanceStatus,
  IssuanceStatus,
  'office' | 'resident',
])[] = [
  ['submitted', 'under-review', 'office'],
  ['submitted', 'cancelled', 'resident'],
  ['under-review', 'needs-info', 'office'],
  ['under-review', 'approved', 'office'],
  ['under-review', 'rejected', 'office'],
  ['needs-info', 'under-review', 'resident'],
  ['needs-info', 'cancelled', 'resident'],
  ['approved', 'ready-for-pickup', 'office'],
  ['ready-for-pickup', 'released', 'office'],
];

function row(
  n: number,
  status: IssuanceStatus,
  statusSince: string,
  filedAt = statusSince,
): IssuanceRequestSummary {
  return {
    id: asId<IssuanceRequestId>(`ir-${n}`),
    referenceNumber: `DR-2026-00000${n}`,
    status,
    type: { id: asId<IssuanceTypeId>('type-1'), name: 'Certificate' },
    office: { id: asId<OfficeId>('office-1'), name: 'MSWDO' },
    resident: { accountId: asId<AppAccountId>('account-1'), name: 'A. Resident' },
    filedAt: asIsoDateTime(filedAt),
    statusSince: asIsoDateTime(statusSince),
  };
}

describe('the document-request lifecycle (DL-184)', () => {
  it('holds every move the server makes, and no other', () => {
    const ours = ISSUANCE_STATUSES.flatMap((from) =>
      nextStatuses(ISSUANCE_STATUS_TRANSITIONS, from).map((to) => `${from}→${to}`),
    );
    expect(ours.sort()).toEqual(BACKEND_TRANSITIONS.map(([from, to]) => `${from}→${to}`).sort());
  });

  it('offers the office only its own moves; the resident’s are made in the app', () => {
    for (const from of ISSUANCE_STATUSES) {
      const office = BACKEND_TRANSITIONS.filter(([f, , by]) => f === from && by === 'office').map(
        ([, to]) => to,
      );
      expect(officeMovesFrom(from), from).toEqual(office);
    }
  });

  it('ends at released, rejected and cancelled, and nothing moves on from them', () => {
    expect([...ISSUANCE_TERMINAL_STATUSES].sort()).toEqual(['cancelled', 'rejected', 'released']);
    expect(ISSUANCE_OPEN_STATUSES).toEqual([
      'submitted',
      'under-review',
      'needs-info',
      'approved',
      'ready-for-pickup',
    ]);
  });

  it('names every status once, and says what every office move does before it is made', () => {
    for (const status of ISSUANCE_STATUSES) {
      expect(ISSUANCE_STATUS_CATALOG[status].value).toBe(status);
      expect(ISSUANCE_STATUS_CATALOG[status].description.length).toBeGreaterThan(0);
      for (const to of officeMovesFrom(status)) {
        expect(ISSUANCE_MOVE_EFFECTS[to]?.length ?? 0, to).toBeGreaterThan(0);
      }
    }
  });

  it('needs words for the resident on every move, and claim details only to mark it ready', () => {
    expect(issuanceMoveProblem({ to: 'approved', reason: 'ok', claimDetails: null })).toMatch(
      /for the resident/,
    );
    expect(
      issuanceMoveProblem({ to: 'approved', reason: 'Approved after review.', claimDetails: null }),
    ).toBeNull();
    expect(
      issuanceMoveProblem({
        to: 'ready-for-pickup',
        reason: 'Your certificate is ready.',
        claimDetails: null,
      }),
    ).toMatch(/when and where/);
    expect(
      issuanceMoveProblem({
        to: 'ready-for-pickup',
        reason: 'Your certificate is ready.',
        claimDetails: 'MSWDO counter, weekdays 8–5.',
      }),
    ).toBeNull();
    expect(
      issuanceMoveProblem({
        to: 'approved',
        reason: 'Approved after review.',
        claimDetails: 'MSWDO counter.',
      }),
    ).toMatch(/only with marking/);
  });
});

describe('the queue (DL-184, DL-101)', () => {
  const now = new Date('2026-11-07T09:00:00.000Z');

  it('says on whom a request waits and for how long, never that it is late', () => {
    expect(describeIssuanceWait(row(1, 'submitted', '2026-10-28T09:00:00.000Z'), now)).toBe(
      'With the office for 10 days',
    );
    expect(describeIssuanceWait(row(2, 'needs-info', '2026-11-06T08:00:00.000Z'), now)).toBe(
      'With the resident for 1 day',
    );
    expect(describeIssuanceWait(row(3, 'approved', '2026-11-07T08:00:00.000Z'), now)).toBe(
      'With the office since today',
    );
    expect(describeIssuanceWait(row(4, 'released', '2026-11-04T09:00:00.000Z'), now)).toBe(
      'Ended 3 days ago',
    );
    expect(waitingOn('rejected')).toBeNull();
    for (const status of ISSUANCE_STATUSES) {
      expect(describeIssuanceWait(row(5, status, '2026-01-01T00:00:00.000Z'), now)).not.toMatch(
        /late|overdue|due/i,
      );
    }
  });

  it('puts the request that has waited longest first', () => {
    const ordered = oldestWaitingFirst([
      row(1, 'submitted', '2026-11-05T00:00:00.000Z'),
      row(2, 'approved', '2026-11-01T00:00:00.000Z'),
      row(3, 'under-review', '2026-11-03T00:00:00.000Z'),
    ]);
    expect(ordered.map((request) => request.id)).toEqual(['ir-2', 'ir-3', 'ir-1']);
  });

  it('states the office standard in working days, and never as a date', () => {
    expect(describeProcessingStandard(null)).toBe('Office standard: not stated');
    expect(describeProcessingStandard(0)).toBe('Office standard: the same day');
    expect(describeProcessingStandard(1)).toBe('Office standard: 1 working day');
    expect(describeProcessingStandard(3)).toBe('Office standard: 3 working days');
  });
});

describe('the catalogue (DL-184)', () => {
  const fields: IssuanceTypeFields = {
    name: 'Certificate of residency',
    description: null,
    requirements: [
      { code: 'valid-id', label: 'A valid ID', required: true, hint: null },
      { code: 'cedula', label: 'Community tax certificate', required: false, hint: 'This year’s' },
    ],
    fee: { centavos: 5000, currency: 'PHP' },
    processingDays: 3,
    claimInstructions: 'Claim at the MSWDO counter.',
  };

  it('reads a fee typed in pesos into whole centavos, without floating-point arithmetic', () => {
    expect(readFeeEntry('')).toEqual({ kind: 'none' });
    expect(readFeeEntry('50')).toEqual({
      kind: 'amount',
      fee: { centavos: 5000, currency: 'PHP' },
    });
    expect(readFeeEntry('₱1,250.5')).toEqual({
      kind: 'amount',
      fee: { centavos: 125050, currency: 'PHP' },
    });
    // 0.1 + 0.2 is not 0.3 in floating point; read as two integers it is exactly 30 centavos.
    expect(readFeeEntry('0.30')).toEqual({
      kind: 'amount',
      fee: { centavos: 30, currency: 'PHP' },
    });
    expect(readFeeEntry('1.005')).toEqual({ kind: 'invalid' });
    expect(readFeeEntry('fifty')).toEqual({ kind: 'invalid' });
    expect(feeEntryText({ centavos: 125050, currency: 'PHP' })).toBe('1250.50');
    expect(feeEntryText({ centavos: 5, currency: 'PHP' })).toBe('0.05');
    expect(feeEntryText(null)).toBe('');
  });

  it('refuses in words what the API would refuse', () => {
    expect(issuanceTypeProblems(fields)).toEqual([]);
    const problems = issuanceTypeProblems({
      ...fields,
      name: 'ab',
      fee: { centavos: 100_000_001, currency: 'PHP' },
      processingDays: 400,
      requirements: [
        { code: 'Valid ID', label: 'A valid ID', required: true, hint: null },
        { code: 'purpose', label: 'Purpose', required: true, hint: null },
        { code: 'cedula', label: 'x', required: false, hint: null },
        { code: 'cedula', label: 'Again', required: false, hint: null },
      ],
    });
    expect(problems.join(' ')).toMatch(/name needs 3 to 120/);
    expect(problems.join(' ')).toMatch(/₱1,000,000\.00/);
    expect(problems.join(' ')).toMatch(/0 to 365/);
    expect(problems.join(' ')).toMatch(/Requirement 1: the code/);
    expect(problems.join(' ')).toMatch(/“purpose” is used by the app/);
    expect(problems.join(' ')).toMatch(/Requirement 3: the label/);
    expect(problems.join(' ')).toMatch(/“cedula” is used twice/);
  });

  it('sends only the fields that moved, and nothing when none did', () => {
    expect(issuanceTypeChanges(fields, fields, 'No change at all.')).toBeNull();
    expect(
      issuanceTypeChanges(
        fields,
        { ...fields, fee: { centavos: 7500, currency: 'PHP' }, processingDays: null },
        'The Citizen’s Charter was revised.',
      ),
    ).toEqual({
      fee: { centavos: 7500, currency: 'PHP' },
      processingDays: null,
      reason: 'The Citizen’s Charter was revised.',
    });
    const reordered = [...fields.requirements].reverse();
    expect(
      issuanceTypeChanges(fields, { ...fields, requirements: reordered }, 'Reordered.'),
    ).toEqual({ requirements: reordered, reason: 'Reordered.' });
  });

  it('suggests a requirement code the API accepts', () => {
    expect(suggestRequirementCode('Barangay clearance (original)')).toBe(
      'barangay-clearance-original',
    );
    expect(suggestRequirementCode('  ID  ')).toBe('id');
  });
});

describe('wholeIssuanceReference (DL-186)', () => {
  it('reads a whole number as the API matches it: trimmed, any case', () => {
    expect(wholeIssuanceReference('  dr-2026-000123 ')).toBe('DR-2026-000123');
    expect(wholeIssuanceReference('DR-2026-1234567')).toBe('DR-2026-1234567');
  });

  it('refuses part of a number, so no fragment is ever searched', () => {
    for (const partial of [
      '',
      'DR-2026',
      '000123',
      'DR-2026-12345',
      'RL-2026-000123',
      'DR-26-000123',
    ]) {
      expect(wholeIssuanceReference(partial), partial).toBeNull();
    }
  });
});
