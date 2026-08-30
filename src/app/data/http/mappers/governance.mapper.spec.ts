import { describe, expect, it } from 'vitest';

import { describeRetention, awaitsPolicy } from '@domain/index';

import {
  toClassifiedRecordTypes,
  toRetentionRules,
  toSavedViews,
} from './governance.mapper';

describe('reading the classification register', () => {
  const payload = {
    categories: [
      { key: 'resident', classification: 'sensitive-personal', holds: 'Identity and address' },
      { key: 'audit', classification: 'internal', holds: 'Who did what' },
      { key: 'export', classification: null, holds: null, unclassified: true },
    ],
    approved: false,
    notice: 'A reading of RA 10173…',
  };

  /** The list is under `categories`; `data` is an object, which is why `collection` returned none. */
  it('unwraps the key the endpoint answers with', () => {
    expect(toClassifiedRecordTypes(payload).map((row) => row.key)).toEqual([
      'resident',
      'audit',
      'export',
    ]);
  });

  /**
   * An unclassified category is read as the most protective value, and is not dropped.
   *
   * The server names it rather than leaving a null "somebody reads as public". A record type nobody
   * has ruled on is one nothing should be relaxed about — and dropping the row would say there is
   * no such record series at all, which is `DL-105`'s reason for withholding rather than omitting.
   */
  it('treats a category nobody has classified as the most protective, and keeps it', () => {
    const rows = toClassifiedRecordTypes(payload);

    expect(rows).toHaveLength(3);
    expect(rows[2]?.classification).toBe('sensitive-personal');
  });

  it('is total: a payload of the wrong shape yields no rows and no throw', () => {
    expect(toClassifiedRecordTypes(null)).toEqual([]);
    expect(toClassifiedRecordTypes({ categories: 'nope' })).toEqual([]);
  });
});

describe('reading the retention schedule', () => {
  const unapproved = {
    approved: false,
    approved_by: '',
    approved_on: '',
    categories: { account: 2555, resident: 3650, export: 1 },
    notice: 'These values are placeholders pending review…',
  };

  /** `categories` is a flat map here, not a list — different in shape from `/classifications`. */
  it('reads a flat key-to-days map', () => {
    expect(toRetentionRules(unapproved).map((rule) => rule.recordTypeKey)).toEqual([
      'account',
      'export',
      'resident',
    ]);
  });

  it('carries the period the server actually holds', () => {
    const resident = toRetentionRules(unapproved).find((r) => r.recordTypeKey === 'resident');

    expect(resident?.periodInYears).toBe(10);
  });

  /**
   * And the screen still says "No schedule recorded", which is the whole point.
   *
   * The server's numbers are placeholders pending review, and it says so — nothing is deleted while
   * `approved` is false. An unapproved draft is not a schedule, and printing "Kept for 10 years"
   * beside a record series is the invented policy `DL-113` refuses: the one an office cannot undo
   * once it has acted on it. The data layer reports what exists; the domain decides what may be
   * said.
   */
  it('does not let an unapproved draft be shown as a schedule', () => {
    const [resident] = toRetentionRules(unapproved).filter((r) => r.recordTypeKey === 'resident');

    expect(resident).toBeDefined();
    expect(resident?.provenance).toBe('awaiting-office-policy');
    expect(resident === undefined ? null : awaitsPolicy(resident)).toBe(true);
    expect(resident === undefined ? null : describeRetention(resident)).toBe(
      'No schedule recorded',
    );
  });

  /** And the day the DPO approves it, the same payload reads as a schedule with no code change. */
  it('shows the period once somebody has approved it', () => {
    const [rule] = toRetentionRules({ ...unapproved, approved: true }).filter(
      (r) => r.recordTypeKey === 'resident',
    );

    expect(rule).toBeDefined();
    expect(rule?.provenance).toBe('office-policy');
    expect(rule === undefined ? null : describeRetention(rule)).toBe('Kept for 10 years');
  });

  it('is total', () => {
    expect(toRetentionRules(null)).toEqual([]);
    expect(toRetentionRules({ categories: [] })).toEqual([]);
  });
});

describe('reading saved views', () => {
  const payload = {
    views: [
      {
        id: 'sv-1',
        entity: 'residents',
        name: 'Barangay San Juan, unverified',
        filters: { barangay_id: '2', verified: false },
        columns: ['name'],
        sort: 'name',
        is_shared: true,
        is_mine: false,
        note: 'A view saves a question.',
      },
      { id: 'sv-2', entity: 'kyc-cases', name: 'Not a console screen', filters: {} },
    ],
    grammar: [{ entity: 'residents', fields: { barangay_id: ['eq', 'in'] } }],
  };

  it('unwraps `views` and keeps only resources this console can open', () => {
    const views = toSavedViews(payload);

    expect(views).toHaveLength(1);
    expect(views[0]?.name).toBe('Barangay San Juan, unverified');
  });

  it('stringifies filter values so they can go back out as query parameters', () => {
    expect(toSavedViews(payload)[0]?.params).toEqual({ barangay_id: '2', verified: 'false' });
  });

  /**
   * `ownerId` is null, and that is the API being careful rather than incomplete.
   *
   * It publishes `is_shared` and `is_mine` and withholds `owner_subject_id`, so a reader cannot see
   * *who* owns a shared view they do not own. `DL-111` makes sharing a separate grant because a
   * view's name describes a population to every colleague; not naming its author is the same
   * instinct, and this console does not reconstruct it.
   */
  it('names nobody as the owner of a shared view', () => {
    expect(toSavedViews(payload)[0]?.ownerId).toBeNull();
    expect(toSavedViews(payload)[0]?.isShared).toBe(true);
  });

  it('is total', () => {
    expect(toSavedViews(null)).toEqual([]);
    expect(toSavedViews({ views: 'nope' })).toEqual([]);
  });
});
