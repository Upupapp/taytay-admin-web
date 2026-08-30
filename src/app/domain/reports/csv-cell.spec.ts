import { describe, expect, it } from 'vitest';

import { csvCell } from './report-result';

describe('composing a cell that leaves the building', () => {
  it('quotes an ordinary value and leaves it alone', () => {
    expect(csvCell('Barangay San Juan')).toBe('"Barangay San Juan"');
  });

  it('escapes an embedded quote so a column cannot shift', () => {
    expect(csvCell('The "old" market')).toBe('"The ""old"" market"');
  });

  it('keeps a comma inside one cell', () => {
    expect(csvCell('Dela Cruz, Maria')).toBe('"Dela Cruz, Maria"');
  });

  /**
   * Quoting does not stop a spreadsheet evaluating a cell, which is the whole point.
   *
   * Excel, LibreOffice and Sheets strip the quotes while parsing and evaluate what is left, so
   * `"=HYPERLINK(…)"` arrives as a live formula. The defence has to be in the value.
   */
  it('refuses to hand a spreadsheet a formula', () => {
    expect(csvCell('=HYPERLINK("http://elsewhere","click")')).toBe(
      '"\'=HYPERLINK(""http://elsewhere"",""click"")"',
    );
  });

  it('guards every character a spreadsheet would evaluate', () => {
    for (const lead of ['=', '+', '-', '@', '\t', '\r']) {
      expect(csvCell(`${lead}anything`)).toBe(`"'${lead}anything"`);
    }
  });

  /**
   * A hyphen is the realistic one.
   *
   * Nobody types `=cmd` into a name field, but a placeholder dash, a hyphenated surname entered
   * with a leading dash, or a filter description beginning "-" all reach a cell — and `-1+1` is a
   * formula to a spreadsheet exactly as much as `=1+1` is.
   */
  it('guards a value that only looks like punctuation', () => {
    expect(csvCell('-')).toBe(`"'-"`);
  });

  it('does not touch a value that merely contains one of those characters', () => {
    expect(csvCell('Nurse-in-charge')).toBe('"Nurse-in-charge"');
    expect(csvCell('4Ps + AICS')).toBe('"4Ps + AICS"');
  });

  it('leaves an empty cell empty rather than marking it as text', () => {
    expect(csvCell('')).toBe('""');
  });
});
