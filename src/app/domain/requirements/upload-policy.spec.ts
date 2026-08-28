import { describe, expect, it } from 'vitest';

import { DOCUMENT_UPLOAD_POLICY, refusalFor } from './upload-policy';

const file = (type: string, size: number) => ({ type, size });

describe('what this office accepts as a document', () => {
  it('accepts a PDF within the ceiling', () => {
    expect(refusalFor(file('application/pdf', 2 * 1024 * 1024))).toBeNull();
  });

  it('refuses a file over the ceiling, and says by how much', () => {
    const refusal = refusalFor(file('application/pdf', 12 * 1024 * 1024));

    expect(refusal).toEqual({
      reason: 'too-large',
      maxBytes: DOCUMENT_UPLOAD_POLICY.maxBytes,
      actualBytes: 12 * 1024 * 1024,
    });
  });

  it('refuses a type nobody can read, and names what is accepted', () => {
    const refusal = refusalFor(file('application/x-msdownload', 1024));

    expect(refusal).toEqual({
      reason: 'wrong-type',
      accepted: DOCUMENT_UPLOAD_POLICY.mimeTypes,
      actual: 'application/x-msdownload',
    });
  });

  /**
   * Size before type, and the order is the point.
   *
   * A caseworker whose 40 MB scan is also a TIFF needs to hear the thing they must act on first.
   * Rescanning smaller fixes both; being told about the format sends them to convert a file that
   * would still be refused, and they find out twice.
   */
  it('reports the size when a file is both too large and the wrong type', () => {
    expect(refusalFor(file('image/tiff', 40 * 1024 * 1024))?.reason).toBe('too-large');
  });

  /**
   * A file at exactly the ceiling is accepted.
   *
   * The server's rule is `size > max`, and a client that refused at `>=` would reject a document
   * the office would have taken — sending the caseworker to rescan for nothing.
   */
  it('accepts a file of exactly the maximum size', () => {
    expect(refusalFor(file('image/png', DOCUMENT_UPLOAD_POLICY.maxBytes))).toBeNull();
  });

  /**
   * An empty type is refused rather than waved through.
   *
   * Some browsers report `''` for a file whose extension they do not recognise. Treating that as
   * "unknown, so probably fine" is how an executable reaches an upload endpoint.
   */
  it('refuses a file whose type the browser could not determine', () => {
    expect(refusalFor(file('', 1024))?.reason).toBe('wrong-type');
  });
});
