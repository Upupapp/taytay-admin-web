import {
  asIsoDateTime,
  EMPTY_ADVISORY,
  INTAKE_SIGNAL_CODES,
  INTAKE_SIGNAL_TONES,
  type IntakeAdvisory,
  type IntakeSignal,
} from '@domain/index';

import { int, str, text } from './wire';

/**
 * `GET admin/assistance-requests/{case}/advisory` → the domain.
 *
 * ## The one payload that maps field for field
 *
 * Every code matches, every tone matches, and each signal carries `rule`, `finding` and
 * `references` — the three things `DL-60` requires so a finding can be checked rather than
 * believed. The two sides agreed because both were written to the same rule, not by coincidence:
 * the server's own class docblock records that it carries no score, no total, no `eligible` and no
 * `recommendation`, which is the console's `check:intake` rule stated from the other end.
 *
 * ## An unrecognised signal is dropped, not shown
 *
 * The alternative is rendering a signal whose code the console has no wording for, which puts a
 * bare identifier in front of a caseworker as though it meant something. A signal the console
 * cannot explain is one it should not display — and `recordsRead` still reports how much was
 * examined, so a shorter list cannot be mistaken for a quieter file (`DL-60`'s "silence can be told
 * from ignorance").
 *
 * ## `windows` is read and deliberately not used
 *
 * The payload publishes `same_programme_days`, `assistance_lookback_months` and
 * `basis: 'convention-pending-confirmation'`. The console builds `ReviewWindowPolicy` from its own
 * TAB 11 constants, and taking the server's numbers instead would be the better answer — they are
 * the ones the findings were actually computed with. It is not done here because the policy feeds
 * screens beyond this one and would need its provenance reworked with it; the drift is recorded in
 * `docs/integration/backend-requests.md` rather than half-fixed.
 *
 * @consumes GET admin/assistance-requests/{case}/advisory
 */
export function toIntakeAdvisory(wire: unknown): IntakeAdvisory {
  if (typeof wire !== 'object' || wire === null) return EMPTY_ADVISORY;
  const row = wire as Record<string, unknown>;

  const signals = Array.isArray(row['signals'])
    ? row['signals']
        .map((signal) => toIntakeSignal(signal))
        .filter((signal): signal is IntakeSignal => signal !== null)
    : [];

  const computedAt = str(row['computed_at']);

  return {
    signals,
    /*
     * The epoch stands for "nothing read yet", which is what `EMPTY_ADVISORY` means. A payload
     * with no timestamp has not told us when it looked, and dating it now would claim a freshness
     * nobody stated (`DL-149`).
     */
    computedAt: computedAt === null ? EMPTY_ADVISORY.computedAt : asIsoDateTime(computedAt),
    recordsRead: int(row['records_read']) ?? 0,
  };
}

function toIntakeSignal(wire: unknown): IntakeSignal | null {
  if (typeof wire !== 'object' || wire === null) return null;
  const row = wire as Record<string, unknown>;

  const code = INTAKE_SIGNAL_CODES.find((candidate) => candidate === str(row['code']));
  const tone = INTAKE_SIGNAL_TONES.find((candidate) => candidate === str(row['tone']));
  if (code === undefined || tone === undefined) return null;

  return {
    code,
    tone,
    rule: text(row['rule']),
    finding: text(row['finding']),
    references: Array.isArray(row['references'])
      ? row['references']
          .map((reference) => str(reference))
          .filter((reference): reference is string => reference !== null)
      : [],
  };
}
