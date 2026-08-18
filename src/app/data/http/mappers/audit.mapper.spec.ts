import { toAuditRow } from './audit.mapper';

/** The published `GET admin/audit-entries` payload, field for field. */
const WIRE = {
  id: 'aud-0001',
  occurred_at: '2026-08-18T01:00:00Z',
  actor_subject_id: 'staff-0001',
  actor_account_type: 'staff',
  action: 'updated',
  risk: 'normal',
  entity_type: 'resident',
  entity_id: 'res-0001',
  summary: 'Corrected a household address',
  changed_fields: [
    { field: 'street_address', label: 'Street address', classification: 'personal' },
    { field: 'purok_or_sitio', label: 'Purok', classification: 'internal' },
  ],
  reason: 'Applicant reported a move',
  request_id: '01JB000',
  client_channel: 'web',
  ip_address: '10.0.0.4',
  user_agent: 'Mozilla/5.0',
};

describe('toAuditRow', () => {
  it('maps the published payload', () => {
    const row = toAuditRow(WIRE);

    expect(row?.id).toBe('aud-0001');
    expect(row?.action).toBe('updated');
    expect(row?.summary).toBe('Corrected a household address');
    expect(row?.reason).toBe('Applicant reported a move');
    expect(row?.source).toBe('web');
  });

  it('carries field names and never a value', () => {
    /*
     * `DL-114`. Reading *that* a record changed is oversight; reading *what it
     * changed to* is access to the record. This list is designed to be scrolled
     * and filtered by somebody reviewing other people's work, so a row carrying
     * `monthlyIncome: 3,200 → 18,000` would disclose a resident's income to
     * every reviewer who filtered by date.
     */
    const row = toAuditRow({
      ...WIRE,
      changed_fields: [
        { field: 'monthly_income', label: 'Monthly income', classification: 'sensitive-personal', old: 3200, new: 18000 },
      ],
    });

    expect(row?.changedFields).toEqual([
      { field: 'monthly_income', label: 'Monthly income', classification: 'sensitive-personal' },
    ]);
    expect(JSON.stringify(row)).not.toContain('3200');
    expect(JSON.stringify(row)).not.toContain('18000');
  });

  it('treats a classification it cannot read as the most sensitive, not the least', () => {
    // Failing open here would be the one place in the trail where a mistake
    // discloses something.
    const row = toAuditRow({
      ...WIRE,
      changed_fields: [{ field: 'something_new', classification: 'invented-next-year' }],
    });

    expect(row?.changedFields[0]?.classification).toBe('sensitive-personal');
    expect(row?.touchesSensitive).toBe(true);
  });

  it('flags an entry that touched personal data', () => {
    expect(toAuditRow(WIRE)?.touchesSensitive).toBe(true);
    expect(
      toAuditRow({ ...WIRE, changed_fields: [{ field: 'code', classification: 'internal' }] })?.touchesSensitive,
    ).toBe(false);
  });

  it('names the system rather than leaving the actor blank', () => {
    // A blank actor in an incident review reads as a gap in the record rather
    // than as automation.
    expect(toAuditRow({ ...WIRE, actor_account_type: null })?.actorName).toBe('System');
  });

  it('drops an entry that cannot be located', () => {
    // No id or no time means it cannot be ordered, cited in an incident, or
    // reconciled against the server log.
    expect(toAuditRow({ ...WIRE, occurred_at: null })).toBeNull();
    expect(toAuditRow({ ...WIRE, id: undefined })).toBeNull();
    expect(toAuditRow(null)).toBeNull();
  });
});
