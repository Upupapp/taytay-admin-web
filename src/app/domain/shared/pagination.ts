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
