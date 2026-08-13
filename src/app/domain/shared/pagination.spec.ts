import { emptyPage, paginate, type PageRequest } from './pagination';

const items = Array.from({ length: 23 }, (_, index) => index + 1);

function request(overrides: Partial<PageRequest> = {}): PageRequest {
  return { page: 1, pageSize: 10, ...overrides };
}

describe('paginate', () => {
  it('returns the first slice and the total counts', () => {
    const page = paginate(items, request());
    expect(page.items).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(page.totalItems).toBe(23);
    expect(page.totalPages).toBe(3);
  });

  it('returns a short final page', () => {
    expect(paginate(items, request({ page: 3 })).items).toEqual([21, 22, 23]);
  });

  it('clamps a page number past the end rather than returning nothing', () => {
    const page = paginate(items, request({ page: 99 }));
    expect(page.page).toBe(3);
    expect(page.items).toHaveLength(3);
  });

  it('clamps a page number below one', () => {
    expect(paginate(items, request({ page: 0 })).page).toBe(1);
  });

  it('reports one page for an empty collection', () => {
    const page = paginate([], request());
    expect(page.items).toHaveLength(0);
    expect(page.totalItems).toBe(0);
    expect(page.totalPages).toBe(1);
  });

  it('never divides by a zero page size', () => {
    expect(paginate(items, request({ pageSize: 0 })).pageSize).toBe(1);
  });
});

describe('emptyPage', () => {
  it('echoes the requested page shape with no items', () => {
    const page = emptyPage<number>(request({ page: 2, pageSize: 5 }));
    expect(page.items).toHaveLength(0);
    expect(page.page).toBe(2);
    expect(page.pageSize).toBe(5);
    expect(page.totalItems).toBe(0);
  });
});
