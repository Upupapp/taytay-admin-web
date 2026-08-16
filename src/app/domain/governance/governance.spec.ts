import { PERMISSIONS, ROLE_DEFINITIONS, permissionsForRole } from '../access/permission';
import {
  READ_ONLY_PERMISSIONS,
  rolesBreachingSeparationOfDuties,
} from '../access/permission-matrix';
import { asId, type AuditEntryId, type StaffUserId } from '../shared/ids';
import type { AuditEntry } from '../shared/audit';
import {
  AUDIT_DETAIL_RATIONALE,
  describeAuditFilter,
  describeAuditRows,
  isAuditFilterActive,
  toAuditRow,
  type AuditFieldChange,
  type AuditRow,
} from './audit-view';
import {
  CLASSIFICATION_BASIS,
  CLASSIFIED_RECORD_TYPES,
  classificationOf,
  isSensitive,
} from './data-classification';
import {
  CORRECTION_TRANSITIONS,
  correctionProblems,
  type CorrectionRequest,
} from './correction-request';
import {
  RETENTION_RULES,
  RETENTION_UNSET_DISPLAY,
  awaitsPolicy,
  describeRetention,
  rulesAwaitingPolicy,
} from './retention';
import {
  DEACTIVATED_NOTICE,
  PROVISIONING_IS_NOT_BUILT,
  canHoldSession,
} from './staff-profile';

const ENTRY: AuditEntry = {
  id: asId<AuditEntryId>('aud-test'),
  entityType: 'resident',
  entityId: 'res-0001',
  action: 'updated',
  summary: 'Corrected the household means figure.',
  reason: 'Payslips presented at the counter.',
  actorId: asId<StaffUserId>('staff-intake'),
  actorName: 'Liezl Padilla',
  occurredAt: '2026-08-10T02:00:00.000Z' as AuditEntry['occurredAt'],
};

const SENSITIVE_FIELD: AuditFieldChange = {
  field: 'sectors',
  label: 'Protection sectors',
  classification: 'sensitive-personal',
};

const ORDINARY_FIELD: AuditFieldChange = {
  field: 'contactNumber',
  label: 'Contact number',
  classification: 'personal',
};

/* ── Criterion: the audit list does not display excessive PII ─────────────── */

describe('an audit row', () => {
  it('carries no recorded value at all', () => {
    const row = toAuditRow(ENTRY, 'Resident registry', 'web', [ORDINARY_FIELD], true);

    // The rule is structural: there is nowhere on the row for a value to live,
    // so no template can render one by accident (`DL-114`).
    for (const field of ['before', 'after', 'values', 'changes', 'oldValue', 'newValue']) {
      expect(row as unknown as Record<string, unknown>).not.toHaveProperty(field);
    }
  });

  it('names the fields that moved, without quoting them', () => {
    const row = toAuditRow(ENTRY, 'Resident registry', 'web', [ORDINARY_FIELD], true);

    expect(row.changedFields).toHaveLength(1);
    expect(row.changedFields[0]?.label).toBe('Contact number');
    expect(row.changedFields[0] as unknown as Record<string, unknown>).not.toHaveProperty(
      'before',
    );
  });

  it('flags an entry that moved sensitive personal information', () => {
    const sensitive = toAuditRow(ENTRY, 'Resident registry', 'web', [SENSITIVE_FIELD], true);
    const ordinary = toAuditRow(ENTRY, 'Resident registry', 'web', [ORDINARY_FIELD], true);

    expect(sensitive.touchesSensitive).toBe(true);
    expect(ordinary.touchesSensitive).toBe(false);
  });

  it('says whether there is anything to open, without saying what', () => {
    const withDetail = toAuditRow(ENTRY, 'Resident registry', 'web', [ORDINARY_FIELD], true);
    const without = toAuditRow(ENTRY, 'Resident registry', 'web', [], false);

    expect(withDetail.hasDetail).toBe(true);
    expect(without.hasDetail).toBe(false);
  });

  it('keeps the reason, which is what makes the trail answerable', () => {
    const row = toAuditRow(ENTRY, 'Resident registry', 'web', [], false);

    // A trail that records only the what answers "was this allowed?" and never
    // "was this right?".
    expect(row.reason).toBe('Payslips presented at the counter.');
  });
});

describe('reading the trail', () => {
  const rows: readonly AuditRow[] = [
    toAuditRow(ENTRY, 'Resident registry', 'web', [SENSITIVE_FIELD], true),
    toAuditRow(
      { ...ENTRY, id: asId<AuditEntryId>('aud-2') },
      'Resident registry',
      'web',
      [ORDINARY_FIELD],
      true,
    ),
  ];

  it('counts what is shown, and how much of it was sensitive', () => {
    expect(describeAuditRows(rows)).toBe('2 events, 1 touching sensitive information.');
  });

  it('says plainly when a filter matched nothing', () => {
    expect(describeAuditRows([])).toBe('Nothing recorded under this filter.');
  });

  it('states what the view covers, so absence is not read as never happened', () => {
    expect(describeAuditFilter({})).toBe('Everything recorded');
    expect(describeAuditFilter({ sensitiveOnly: true })).toContain('sensitive');
    expect(describeAuditFilter({ action: 'exported' })).toContain('exported');
  });

  it('knows when a filter is narrowing anything', () => {
    expect(isAuditFilterActive({})).toBe(false);
    expect(isAuditFilterActive({ sensitiveOnly: true })).toBe(true);
  });

  it('tells a reader that opening values is itself recorded', () => {
    expect(AUDIT_DETAIL_RATIONALE).toContain('recorded against your name');
  });
});

/* ── Criterion: sensitive actions have distinct permissions ───────────────── */

describe('permissions', () => {
  it('holds reading the trail apart from reading the values in it', () => {
    expect(PERMISSIONS).toContain('audit.view');
    expect(PERMISSIONS).toContain('audit.view-detail');
  });

  it('treats opening recorded values as reading, not as a change', () => {
    // Same catch as `document.download` in TAB 14: a name-shape heuristic would
    // call this a mutation and make the auditor no longer read-only.
    expect(READ_ONLY_PERMISSIONS).toContain('audit.view-detail');
  });

  it('gives the auditor the values and the head only the trail', () => {
    const auditor = permissionsForRole('auditor');
    const head = permissionsForRole('mswdo-head');

    expect(auditor).toContain('audit.view-detail');
    expect(head).toContain('audit.view');
    expect(head).not.toContain('audit.view-detail');
  });

  it('keeps approving and releasing apart in every non-administrator role', () => {
    expect(rolesBreachingSeparationOfDuties()).toEqual([]);
  });

  it('never uses an additional grant to take a permission away', () => {
    for (const role of Object.keys(ROLE_DEFINITIONS) as (keyof typeof ROLE_DEFINITIONS)[]) {
      const baseline = ROLE_DEFINITIONS[role].permissions;
      for (const permission of baseline) {
        expect(permissionsForRole(role)).toContain(permission);
      }
    }
  });
});

/* ── Criterion: a deactivated account loses its affordances ───────────────── */

describe('a deactivated account', () => {
  it('cannot hold a session', () => {
    expect(canHoldSession({ isActive: true })).toBe(true);
    expect(canHoldSession({ isActive: false })).toBe(false);
  });

  it('says that an open session stops being able to act', () => {
    // Before TAB 21 deactivation only blocked a fresh sign-in (`DL-116`).
    expect(DEACTIVATED_NOTICE).toContain('open session');
  });
});

describe('provisioning', () => {
  it('says there is no invite flow rather than offering one', () => {
    expect(PROVISIONING_IS_NOT_BUILT).toContain('cannot yet do it');
    expect(PROVISIONING_IS_NOT_BUILT).toContain('no self-registration');
  });
});

/* ── Data classification ──────────────────────────────────────────────────── */

describe('what the office holds', () => {
  it('classifies every record type it lists', () => {
    for (const type of CLASSIFIED_RECORD_TYPES) {
      expect(type.classification).toBeTruthy();
      expect(type.holds.length).toBeGreaterThan(0);
    }
  });

  it('puts protection sectors, case notes, documents and referrals at the top tier', () => {
    for (const key of ['resident-sector', 'case-note', 'document', 'referral']) {
      expect(classificationOf(key)).toBe('sensitive-personal');
    }
  });

  it('does not classify the programme catalogue as personal, because it names nobody', () => {
    expect(classificationOf('programme')).toBe('internal');
  });

  it('cites the statute for every label it uses', () => {
    for (const type of CLASSIFIED_RECORD_TYPES) {
      expect(CLASSIFICATION_BASIS[type.classification]).toContain('RA 10173');
    }
  });

  it('names the sensitive tier as the restricted one', () => {
    expect(isSensitive('sensitive-personal')).toBe(true);
    expect(isSensitive('personal')).toBe(false);
  });

  it('returns null for a record type it does not know, rather than guessing', () => {
    expect(classificationOf('not-a-record-type')).toBeNull();
  });
});

/* ── Retention: empty on purpose ──────────────────────────────────────────── */

describe('retention', () => {
  it('records no schedule for anything, because none was supplied', () => {
    expect(rulesAwaitingPolicy(RETENTION_RULES)).toBe(RETENTION_RULES.length);
    for (const rule of RETENTION_RULES) {
      expect(rule.periodInYears).toBeNull();
      expect(awaitsPolicy(rule)).toBe(true);
    }
  });

  it('says "no schedule recorded" rather than a zero or a blank', () => {
    const rule = RETENTION_RULES[0];

    expect(rule).toBeDefined();
    if (rule) {
      expect(describeRetention(rule)).toBe(RETENTION_UNSET_DISPLAY);
      expect(describeRetention(rule)).not.toContain('0');
    }
  });

  it('describes a real period once one is supplied', () => {
    const rule = RETENTION_RULES[0];

    expect(rule).toBeDefined();
    if (rule) {
      expect(
        describeRetention({
          ...rule,
          periodInYears: 5,
          provenance: 'office-policy',
          basis: 'MSWDO records disposition schedule',
        }),
      ).toBe('Kept for 5 years');
    }
  });

  it('covers every classified record type, so no gap reads as needing none', () => {
    expect(RETENTION_RULES).toHaveLength(CLASSIFIED_RECORD_TYPES.length);
  });
});

/* ── Correction requests ──────────────────────────────────────────────────── */

function correction(overrides: Partial<CorrectionRequest> = {}): CorrectionRequest {
  return {
    id: 'cor-test',
    entityType: 'resident',
    entityId: 'res-0001',
    field: 'birthDate',
    claim: 'The PSA certificate shows a different year.',
    status: 'under-review',
    raisedBy: asId<StaffUserId>('staff-intake'),
    raisedByName: 'Liezl Padilla',
    raisedAt: '2026-08-01T02:00:00.000Z' as CorrectionRequest['raisedAt'],
    outcome: null,
    decidedBy: null,
    decidedAt: null,
    audit: {
      createdAt: '2026-08-01T02:00:00.000Z' as CorrectionRequest['audit']['createdAt'],
      createdBy: null,
      updatedAt: '2026-08-01T02:00:00.000Z' as CorrectionRequest['audit']['updatedAt'],
      updatedBy: null,
    },
    ...overrides,
  };
}

describe('a correction request', () => {
  it('cannot be answered without a reason', () => {
    // A refusal with no reason is the one a resident cannot challenge.
    expect(correctionProblems(correction(), 'refused')).toContain('outcome-required');
    expect(correctionProblems(correction(), 'applied')).toContain('outcome-required');
  });

  it('accepts an answer that carries one', () => {
    expect(
      correctionProblems(correction({ outcome: 'Corrected against the PSA certificate.' }), 'applied'),
    ).toEqual([]);
  });

  it('is terminal once answered, so a disagreement is a new request', () => {
    // Same rule as a closed case (`DL-53`): reopening rewrites what the office
    // decided and when.
    expect(CORRECTION_TRANSITIONS.applied).toEqual([]);
    expect(CORRECTION_TRANSITIONS.refused).toEqual([]);
    expect(CORRECTION_TRANSITIONS.withdrawn).toEqual([]);
  });

  it('refuses a move the lifecycle does not permit', () => {
    expect(correctionProblems(correction({ status: 'applied' }), 'raised')).toContain(
      'not-a-permitted-move',
    );
  });

  it('needs a claim to exist at all', () => {
    expect(correctionProblems(correction({ claim: '   ' }), 'under-review')).toContain(
      'claim-required',
    );
  });
});
