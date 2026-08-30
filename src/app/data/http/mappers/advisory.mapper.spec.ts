import { describe, expect, it } from 'vitest';

import { toIntakeAdvisory } from './advisory.mapper';

const payload = (over: Record<string, unknown> = {}) => ({
  signals: [
    {
      code: 'open-request-same-programme',
      tone: 'caution',
      rule: 'An unfinished request already exists for this person under this programme.',
      finding: '1 open request under the same programme.',
      references: ['CN-2026-0041'],
    },
  ],
  computed_at: '2026-08-30T03:00:00.000Z',
  records_read: 12,
  windows: {
    same_programme_days: 90,
    assistance_lookback_months: 12,
    basis: 'convention-pending-confirmation',
  },
  ...over,
});

describe('reading the intake advisory', () => {
  it('keeps the rule, the finding and the references on every signal', () => {
    const advisory = toIntakeAdvisory(payload());

    expect(advisory.signals[0]).toEqual({
      code: 'open-request-same-programme',
      tone: 'caution',
      rule: 'An unfinished request already exists for this person under this programme.',
      finding: '1 open request under the same programme.',
      references: ['CN-2026-0041'],
    });
    expect(advisory.recordsRead).toBe(12);
  });

  /**
   * A signal the console has no wording for is dropped, never rendered.
   *
   * Showing it would put a bare identifier in front of a caseworker as though it meant something.
   * `recordsRead` still reports how much was examined, so a shorter list cannot be mistaken for a
   * quieter file — `DL-60`'s "silence can be told from ignorance".
   */
  it('drops a signal whose code it cannot explain, and keeps the records read', () => {
    const advisory = toIntakeAdvisory(
      payload({
        signals: [
          { code: 'something-new', tone: 'note', rule: 'r', finding: 'f', references: [] },
          ...payload().signals,
        ],
      }),
    );

    expect(advisory.signals).toHaveLength(1);
    expect(advisory.recordsRead).toBe(12);
  });

  /**
   * A tone the console does not know is dropped too, and that is the safe direction.
   *
   * `check:intake` fails the build on a blocking tone. If the server ever grew one, rendering it
   * as a `note` would silently import the thing the rule forbids, and rendering it verbatim would
   * put an unknown tone on a control. Dropping it loses a signal and imports no policy.
   */
  it('drops a tone it does not recognise rather than downgrading it', () => {
    const advisory = toIntakeAdvisory(
      payload({ signals: [{ ...payload().signals[0], tone: 'blocking' }] }),
    );

    expect(advisory.signals).toEqual([]);
  });

  /**
   * No timestamp means "nothing read yet", not "read just now".
   *
   * Dating an undated payload with the clock would claim a freshness nobody stated — `DL-149`'s
   * distinction between reporting a fact and inheriting one.
   */
  it('does not date an advisory the server did not stamp', () => {
    const advisory = toIntakeAdvisory(payload({ computed_at: null }));

    expect(advisory.computedAt).toBe('1970-01-01T00:00:00.000Z');
  });

  it('carries no verdict-shaped field out of the payload', () => {
    const wire = JSON.stringify(
      toIntakeAdvisory(payload({ eligible: true, score: 9, recommendation: 'approve' })),
    );

    for (const forbidden of ['eligible', 'score', 'recommendation', 'total']) {
      expect(wire).not.toContain(forbidden);
    }
  });

  it('is total: a payload of the wrong shape yields the empty advisory', () => {
    expect(toIntakeAdvisory(null).signals).toEqual([]);
    expect(toIntakeAdvisory({ signals: 'nope' }).recordsRead).toBe(0);
  });
});
