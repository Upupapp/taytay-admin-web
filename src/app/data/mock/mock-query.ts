import type { SortDirection } from '@domain/index';

/** Case-insensitive "any field contains the term" match used by the mock lists. */
export function matchesSearch(
  fields: readonly (string | null)[],
  term: string | undefined,
): boolean {
  if (!term) {
    return true;
  }
  const needle = term.trim().toLowerCase();
  if (needle.length === 0) {
    return true;
  }
  return fields.some((field) => (field ?? '').toLowerCase().includes(needle));
}

export type SortKey = string | number;

export function sortItems<TItem>(
  items: readonly TItem[],
  selector: (item: TItem) => SortKey | null,
  direction: SortDirection,
): readonly TItem[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...items].sort((left, right) => {
    const a = selector(left);
    const b = selector(right);
    if (a === b) {
      return 0;
    }
    // Nulls always sort last regardless of direction — an absent date is not
    // "earlier than everything", it is simply unknown.
    if (a === null) {
      return 1;
    }
    if (b === null) {
      return -1;
    }
    return a < b ? -factor : factor;
  });
}
