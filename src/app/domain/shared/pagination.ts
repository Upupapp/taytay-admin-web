export type SortDirection = 'asc' | 'desc';

export interface SortSpec<TField extends string = string> {
  readonly field: TField;
  readonly direction: SortDirection;
}

export interface PageRequest<TSortField extends string = string> {
  /** 1-based page number. */
  readonly page: number;
  readonly pageSize: number;
  readonly sort?: SortSpec<TSortField>;
}

export interface Page<TItem> {
  readonly items: readonly TItem[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalItems: number;
  readonly totalPages: number;
}

/**
 * A request for one cursor page: how many rows, and where the previous page stopped.
 *
 * Cursor paging answers "what comes after this row", not "what is on page N", so there is no page
 * number and no sort to ask for — the order is the server's. `cursor` is opaque; it is handed back
 * exactly as it was received and never built or parsed here.
 */
export interface CursorRequest {
  readonly limit: number;
  readonly cursor?: string | null;
}

/**
 * One cursor page.
 *
 * Deliberately carries no total and no page count, because the server sends neither. A screen
 * reading this says "the first fifty, more available" — never "page 1 of N", which would assert a
 * number nobody computed (`DL-161`). `Page<T>` stays for the ports that are not served over a
 * cursor API.
 */
export interface CursorPage<TItem> {
  readonly items: readonly TItem[];
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

export const DEFAULT_PAGE_SIZE = 20;

/**
 * Typed as `PageRequest<never>` so it can be handed to a repository with any
 * sort-field union — it carries no sort of its own.
 */
export const DEFAULT_PAGE_REQUEST: PageRequest<never> = {
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

export function emptyPage<TItem>(request: PageRequest<string> = DEFAULT_PAGE_REQUEST): Page<TItem> {
  return {
    items: [],
    page: request.page,
    pageSize: request.pageSize,
    totalItems: 0,
    totalPages: 0,
  };
}

/** In-memory paging helper shared by the mock adapters. */
export function paginate<TItem>(items: readonly TItem[], request: PageRequest): Page<TItem> {
  const pageSize = Math.max(1, request.pageSize);
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const page = Math.min(Math.max(1, request.page), totalPages);
  const start = (page - 1) * pageSize;

  return {
    items: items.slice(start, start + pageSize),
    page,
    pageSize,
    totalItems,
    totalPages,
  };
}
