import {
  isApiErrorCode,
  MAX_PER_PAGE,
  toPage,
  toQueryParams,
  type ApiListResponse,
} from './api.contract';

/**
 * These assert the wire shape the backend was measured to serve, not the one
 * the console previously assumed. Every case below is a divergence the
 * integration sweep found — each of which compiled, typechecked and failed only
 * at runtime, because the envelope is cast at the boundary.
 */

function listResponse(overrides: Partial<ApiListResponse<number>['meta']['pagination']> = {}) {
  return {
    data: [1, 2, 3],
    meta: {
      request_id: '01JB000000000000000000',
      pagination: {
        page: 2,
        per_page: 25,
        total: 138,
        total_pages: 6,
        has_more: true,
        ...overrides,
      },
    },
  } satisfies ApiListResponse<number>;
}

describe('toPage', () => {
  it('reads meta.pagination and maps it into the domain page', () => {
    const page = toPage(listResponse());

    expect(page.items).toEqual([1, 2, 3]);
    expect(page.page).toBe(2);
    expect(page.pageSize).toBe(25);
    expect(page.totalItems).toBe(138);
    expect(page.totalPages).toBe(6);
  });

  it('produces no undefined counts, which is what a flat meta used to give', () => {
    const page = toPage(listResponse());

    for (const value of [page.page, page.pageSize, page.totalItems, page.totalPages]) {
      expect(Number.isFinite(value)).toBe(true);
    }
  });
});

describe('toQueryParams', () => {
  it('sends per_page, because the API does not read pageSize', () => {
    const params = toQueryParams({ page: 3, pageSize: 25 });

    expect(params).toEqual({ page: '3', per_page: '25' });
    expect(params['pageSize']).toBeUndefined();
  });

  it('clamps per_page to the server maximum rather than letting it clamp silently', () => {
    // The server clamps instead of rejecting, so an over-large ask is not an
    // error — it is a silent disagreement between what the grid believes it
    // requested and what it received.
    expect(toQueryParams({ page: 1, pageSize: 500 })['per_page']).toBe(String(MAX_PER_PAGE));
  });

  it('encodes a descending sort as a leading minus, with no direction parameter', () => {
    const params = toQueryParams({ page: 1, pageSize: 20, sort: { field: 'surname', direction: 'desc' } });

    expect(params['sort']).toBe('-surname');
    expect(params['direction']).toBeUndefined();
  });

  it('encodes an ascending sort as the bare field', () => {
    const params = toQueryParams({ page: 1, pageSize: 20, sort: { field: 'surname', direction: 'asc' } });

    expect(params['sort']).toBe('surname');
  });

  it('omits empty filter values but keeps a literal zero', () => {
    const params = toQueryParams({ page: 1, pageSize: 20 }, { barangay: '', status: 'approved', count: 0 });

    expect(params['barangay']).toBeUndefined();
    expect(params['status']).toBe('approved');
    expect(params['count']).toBe('0');
  });
});

describe('isApiErrorCode', () => {
  it('recognises the vocabulary the API publishes', () => {
    expect(isApiErrorCode('VALIDATION_FAILED')).toBe(true);
    expect(isApiErrorCode('INVALID_STATE_TRANSITION')).toBe(true);
  });

  it('rejects the PHP case names the contract used to publish', () => {
    // openapi.json and types.ts declared these until TAB 01 fixed both
    // generators. A console that had branched on them would have matched
    // nothing, ever.
    expect(isApiErrorCode('ValidationFailed')).toBe(false);
    expect(isApiErrorCode('Unauthenticated')).toBe(false);
  });

  it('treats an unknown code as unknown rather than throwing', () => {
    expect(isApiErrorCode('SOMETHING_ADDED_NEXT_YEAR')).toBe(false);
  });
});
