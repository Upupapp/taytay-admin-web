/**
 * The rules that keep global search from becoming a disclosure channel.
 *
 * Two of them, and the second is the one that is easy to miss.
 */

/**
 * **Search matches only what it may show** (`DL-109`).
 *
 * The obvious rule is that a result must not display a case note. The rule that
 * matters as much is that a result must not *match* on one either.
 *
 * Suppose search matched note bodies but showed no snippet. Typing a condition,
 * a surname, or the name of a shelter and getting back one resident tells you
 * that somebody wrote that word in that person's file. The office has disclosed
 * the contents of a protected note without ever rendering it, and the audit
 * trail records a search rather than a disclosure.
 *
 * So the searchable fields and the displayable fields are **the same closed
 * set**: names, reference numbers, barangay, status. Free text is neither
 * matched nor shown.
 *
 * `DL-58` already withholds a protected note's body in the data layer. This
 * makes sure search does not become the surface that reintroduces it.
 */
export const SEARCHABLE_FIELDS: readonly string[] = [
  'name',
  'referenceNumber',
  'controlNumber',
  'code',
  'title',
  'barangay',
  'status',
];

/**
 * Field names that must never be read by search, on either side.
 *
 * Every one of these is free text a person wrote about a family, or an
 * identifier disclosive on its own. The checker refuses any of them appearing
 * in the search adapter.
 */
export const NEVER_SEARCHED: readonly string[] = [
  'body',
  'notes',
  'remarks',
  'findings',
  'reasonForRequest',
  'reason',
  'outcome',
  'serviceNeeds',
  'declinedReason',
  'observations',
  'philsysLastFour',
  'monthlyIncome',
  'sectors',
  'birthDate',
  'contact',
];

/**
 * **A recent search is not written down** (`DL-110`).
 *
 * "Recent searches may be local-only" is permission, not instruction, and the
 * safe reading is the narrow one. A caseworker searching a resident by name
 * leaves that name in the box; persisting it puts a resident's name on the
 * device, outside every disclosure rule the application otherwise applies, and
 * on a shared office machine it is readable by whoever sits down next.
 *
 * There is no way to tell a safe query from an unsafe one — "Dela Cruz" is a
 * surname and also a street — so nothing is persisted at all. Recent searches
 * live in memory for the lifetime of the tab and go when it closes.
 *
 * `CLAUDE.md` §2.5 already forbids this application putting session credentials
 * in `localStorage`. This is the same caution applied to the same storage for
 * the same reason.
 */
export const RECENT_SEARCH_LIMIT = 8;

export const RECENT_SEARCHES_ARE_NOT_PERSISTED =
  'Recent searches are kept for this tab only and are never saved to this device.';

/**
 * Whether a term is worth keeping in the in-memory list at all.
 *
 * Duplicates and whitespace variants are dropped so the list stays short enough
 * to be useful; nothing here is a safety judgement, because the safety decision
 * was made by not persisting it.
 */
export function addRecentSearch(
  existing: readonly string[],
  term: string,
): readonly string[] {
  const trimmed = term.trim();
  if (trimmed === '') {
    return existing;
  }
  const withoutDuplicate = existing.filter(
    (entry) => entry.toLocaleLowerCase() !== trimmed.toLocaleLowerCase(),
  );
  return [trimmed, ...withoutDuplicate].slice(0, RECENT_SEARCH_LIMIT);
}

/**
 * Normalises a term for matching.
 *
 * Case- and accent-insensitive, because a registry holds `Peña` and an officer
 * types `Pena`, and a search that misses on a diacritic is one people stop
 * trusting.
 */
export function normaliseForSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLocaleLowerCase()
    .trim();
}

export function matchesTerm(haystack: string | null, term: string): boolean {
  if (haystack === null) {
    return false;
  }
  return normaliseForSearch(haystack).includes(normaliseForSearch(term));
}
