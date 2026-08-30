import { describe, expect, it } from 'vitest';

import { asId, type AssistanceRequestId } from '@domain/index';

import { toDocumentRequest, toDocumentRequests } from './document-request.mapper';

const CASE = asId<AssistanceRequestId>('case-1');

const row = (over: Record<string, unknown> = {}) => ({
  id: 'dr-1',
  requirement_id: 'req-1',
  state: 'open',
  channel: 'sms',
  message: 'Please bring the barangay certificate.',
  needed_by: '2026-09-05',
  requested_at: '2026-08-30T01:00:00.000Z',
  closed_at: null,
  withdrawn_reason: null,
  is_applicant_overdue: true,
  ...over,
});

describe('reading the office’s requests for a document', () => {
  /**
   * The list arrives as `{ requests: [...] }`, so `data` is an object rather than an array.
   *
   * `collection<T>` hands back `response.data` untouched, so the old call gave every screen a
   * non-array where it expected rows — an empty list on a record that says what an applicant was
   * told, which is `DL-146`'s failure on the surface where it is least visible.
   */
  it('unwraps the `requests` key the endpoint answers with', () => {
    const rows = toDocumentRequests(CASE, { requests: [row(), row({ id: 'dr-2' })] });

    expect(rows.map((entry) => entry.id)).toEqual(['dr-1', 'dr-2']);
  });

  it('carries the case from the URL, because the row does not repeat it', () => {
    expect(toDocumentRequest(CASE, row())?.assistanceRequestId).toBe(CASE);
  });

  /**
   * `is_applicant_overdue` is published and deliberately not read.
   *
   * `DL-83` settled that overdue is derived from the date and never stored: a stored flag needs a
   * nightly job to stay true and is wrong every morning until it runs. Taking the server's copy
   * would import exactly the staleness the rule exists to avoid.
   */
  it('reads no overdue flag from the wire', () => {
    const mapped = toDocumentRequest(CASE, row());

    expect(JSON.stringify(mapped)).not.toMatch(/overdue/i);
  });

  /**
   * The requester is `null`, not invented.
   *
   * The projection carries no `requested_by`. A record saying the office asked, without saying who,
   * is weaker than it looks — and a fabricated id would be worse, because it would name somebody.
   */
  it('reports no requester rather than naming one', () => {
    expect(toDocumentRequest(CASE, row())?.requestedBy).toBeNull();
  });

  /**
   * An unrecognised state reads as `open` — the one that keeps the row in front of somebody.
   *
   * Defaulting to `answered` or `withdrawn` would quietly close a request the office still owes an
   * applicant, and nothing downstream would ever ask again.
   */
  it('treats an unknown state as still open', () => {
    expect(toDocumentRequest(CASE, row({ state: 'something-new' }))?.state).toBe('open');
  });

  it('keeps the message in the words the applicant was given', () => {
    expect(toDocumentRequest(CASE, row())?.message).toBe(
      'Please bring the barangay certificate.',
    );
  });

  it('is total: a payload of the wrong shape yields no rows and no throw', () => {
    expect(toDocumentRequests(CASE, null)).toEqual([]);
    expect(toDocumentRequests(CASE, { requests: 'nope' })).toEqual([]);
    expect(toDocumentRequest(CASE, { state: 'open' })).toBeNull();
  });
});
