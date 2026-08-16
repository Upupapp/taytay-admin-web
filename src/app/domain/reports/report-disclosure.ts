import type { ReportRow } from './report-result';

/**
 * Small-cell suppression.
 *
 * An aggregate is not automatically anonymous. "Barangay San Juan: 1 VAWC
 * survivor served" names somebody to anyone in that barangay who knows who has
 * been to the office, and "2" is barely better. A table of counts can identify
 * a person as surely as a list of names, and the office would have published it
 * believing it had published statistics.
 *
 * So counts below a threshold are **withheld and said to be withheld** rather
 * than shown, rounded or silently dropped (`DL-105`):
 *
 *  - **Withheld, not dropped.** A missing row reads as "none", which is a
 *    different and false claim. The row stays, with its label, marked.
 *  - **Not rounded.** Rounding 1 up to 5 puts a number in a report that is not
 *    true, and somebody will act on it.
 *  - **Not zero.** Zero is a real finding — "no one in this barangay was
 *    served" is exactly the gap a planning report exists to show.
 *
 * The threshold is a **convention this office has not yet confirmed**, and it
 * says so, following the same honesty as the review windows (`DL-68`). Five is
 * the figure most commonly used in Philippine and international statistical
 * disclosure practice for small-area counts, but no Taytay issuance was
 * supplied fixing it, so it is marked pending rather than presented as policy.
 */

export const SMALL_CELL_THRESHOLD = 5;

export const SMALL_CELL_PROVENANCE =
  'convention-pending-confirmation' as const;

export const SMALL_CELL_BASIS =
  'A count below ' +
  String(SMALL_CELL_THRESHOLD) +
  ' can identify a person in a barangay of this size, so it is withheld rather than shown. The ' +
  'threshold follows common statistical disclosure practice; the MSWDO has not yet confirmed a ' +
  'figure of its own.';

/** What a screen prints in place of a withheld figure. Never a zero, never blank. */
export const WITHHELD_DISPLAY = 'Withheld';

/**
 * Whether a count is small enough to identify somebody.
 *
 * Zero is **not** suppressed: it identifies nobody, and hiding it would hide
 * the absence of service, which is the finding a planning report most needs.
 */
export function isSmallCell(value: number): boolean {
  return value > 0 && value < SMALL_CELL_THRESHOLD;
}

/**
 * Applies suppression to a set of rows.
 *
 * Only for rows counting **people or households**. A count of documents or
 * requests identifies nobody on its own, and suppressing those would make the
 * reports useless for no privacy gain — so the caller states whether the rows
 * are about people, rather than this guessing.
 */
export function suppressSmallCells(rows: readonly ReportRow[]): readonly ReportRow[] {
  return rows.map((row) =>
    isSmallCell(row.value)
      ? { ...row, value: 0, display: WITHHELD_DISPLAY, isWithheld: true, routerLink: undefined }
      : row,
  );
}

export function withheldCount(rows: readonly ReportRow[]): number {
  return rows.filter((row) => row.isWithheld).length;
}

/**
 * The sentence a screen shows when anything was withheld.
 *
 * Stated on the report itself, not buried in a footnote: a reader who does not
 * know figures are missing will total the column and get a number that is
 * wrong, and then defend it.
 */
export function describeSuppression(rows: readonly ReportRow[]): string | null {
  const withheld = withheldCount(rows);
  if (withheld === 0) {
    return null;
  }
  const noun = withheld === 1 ? 'figure is' : 'figures are';
  return (
    `${withheld} ${noun} withheld because the count is small enough to identify somebody. ` +
    'The column total below therefore does not add up to the sum of the rows shown.'
  );
}

/**
 * The true total, counted before suppression.
 *
 * Reported separately and labelled, because the alternative is a reader adding
 * up the visible rows and quietly believing a smaller number.
 */
export function totalBeforeSuppression(rows: readonly ReportRow[]): number {
  return rows.reduce((total, row) => total + row.value, 0);
}
