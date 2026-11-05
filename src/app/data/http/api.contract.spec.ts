import { describe, expect, it } from 'vitest';

import OPENAPI from './contract/openapi.json';
import {
  isApiErrorCode,
  MAX_LIMIT,
  toCursorPage,
  toQueryParams,
  type ApiCursorPageResponse,
} from './api.contract';

/**
 * The wire shape the Node API serves, asserted against its own published spec where the spec says
 * it, rather than against what the console previously assumed.
 */

describe('toCursorPage', () => {
  const response = {
    data: [1, 2, 3],
    meta: { pagination: { has_more: true, next_cursor: 'opaque-cursor' } },
  } satisfies ApiCursorPageResponse<number>;

  it('reads meta.pagination into the domain cursor page', () => {
    expect(toCursorPage(response)).toEqual({
      items: [1, 2, 3],
      hasMore: true,
      nextCursor: 'opaque-cursor',
    });
  });

  it('invents no total, because the server sends none', () => {
    expect(Object.keys(toCursorPage(response)).sort()).toEqual(['hasMore', 'items', 'nextCursor']);
  });
});

describe('toQueryParams', () => {
  it('sends limit, and a cursor only when there is one', () => {
    expect(toQueryParams({ limit: 20 })).toEqual({ limit: '20' });
    expect(toQueryParams({ limit: 20, cursor: 'abc' })).toEqual({ limit: '20', cursor: 'abc' });
    expect(toQueryParams({ limit: 20, cursor: null })).toEqual({ limit: '20' });
  });

  it('clamps limit to what the server accepts, because past it the server refuses', () => {
    expect(toQueryParams({ limit: 500 })['limit']).toBe(String(MAX_LIMIT));
    expect(toQueryParams({ limit: 0 })['limit']).toBe('1');
  });

  it('never sends page, per_page or sort, which the API would silently drop', () => {
    const params = toQueryParams({ limit: 20 }, { status: 'pending' });

    for (const ignored of ['page', 'per_page', 'sort', 'direction']) {
      expect(params[ignored]).toBeUndefined();
    }
  });

  it('omits empty filter values but keeps a literal zero', () => {
    const params = toQueryParams({ limit: 20 }, { q: '', status: 'pending', count: 0 });

    expect(params['q']).toBeUndefined();
    expect(params['status']).toBe('pending');
    expect(params['count']).toBe('0');
  });
});

describe('isApiErrorCode', () => {
  const published: unknown =
    OPENAPI.components.schemas.ErrorEnvelope.properties.error.properties.code.enum;

  it('recognises every code the vendored spec publishes, the lowercase ones included', () => {
    expect(Array.isArray(published)).toBe(true);
    for (const code of Array.isArray(published) ? published : []) {
      expect(isApiErrorCode(String(code)), String(code)).toBe(true);
    }
  });

  it('no longer recognises the codes only the retired API sent', () => {
    for (const retired of [
      'INVALID_STATE_TRANSITION',
      'SERVER_ERROR',
      'BAD_REQUEST',
      'METHOD_NOT_ALLOWED',
    ]) {
      expect(isApiErrorCode(retired), retired).toBe(false);
    }
  });

  it('treats an unknown code as unknown rather than throwing', () => {
    expect(isApiErrorCode('SOMETHING_ADDED_NEXT_YEAR')).toBe(false);
  });
});
