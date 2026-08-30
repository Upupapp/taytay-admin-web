import { asId, centavos, type ProgramId, type ProgramUtilization } from '@domain/index';

import { bool, int, str } from './wire';

/**
 * `GET admin/programs/utilization` → the domain.
 *
 * The rows are under `rows`; `data` is an object, which is why `collection<T>` handed back a
 * non-array and the screen showed nothing (`DL-156`).
 *
 * ## A withheld cell keeps its row and loses its numbers
 *
 * The office record suppresses a count below five: it sets `total` and `released_centavos` to
 * `null`, marks `suppressed: true`, and **keeps the row**. That is `DL-105` implemented on the
 * server — withheld rather than dropped, because a missing row reads as "none"; never rounded,
 * because that puts an untrue figure in a report; never zeroed, because an absence of service is
 * itself the finding.
 *
 * The mapper carries all three properties through unchanged. Coercing a suppressed count to `0`
 * here would undo the suppression's whole purpose while looking like tidying up.
 *
 * ## The programme is identified by its code
 *
 * The wire sends `program_code`; the domain keys on `ProgramId`. They are branded strings and this
 * is the one place that knows the row is a programme, so the code is carried as the id and the
 * screens match on it. A row with no code at all is dropped — it names no programme, so nothing
 * could render it against one.
 *
 * @consumes GET admin/programs/utilization
 */
export function toProgramUtilization(wire: unknown): readonly ProgramUtilization[] {
  const row = typeof wire === 'object' && wire !== null ? (wire as Record<string, unknown>) : {};
  const rows = row['rows'];
  if (!Array.isArray(rows)) return [];

  return rows.flatMap((entry): ProgramUtilization[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const cell = entry as Record<string, unknown>;

    const code = str(cell['program_code']);
    if (code === null) return [];

    const releaseCount = int(cell['total']);
    const releasedCentavos = int(cell['released_centavos']);

    return [
      {
        programId: asId<ProgramId>(code),
        releaseCount,
        releasedTotal: releasedCentavos === null ? null : centavos(releasedCentavos),
        /*
         * Trusted from the server rather than inferred from the nulls. A null could also mean the
         * office genuinely has no figure, and reading suppression off an absence would report a
         * withholding nobody performed.
         */
        isWithheld: bool(cell['suppressed']),
      },
    ];
  });
}
