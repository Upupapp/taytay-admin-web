/**
 * Screen wording for global search.
 *
 * Two sentences are load-bearing. **"Not searched"** never reads as "nothing
 * found": a user who cannot tell which record type they are missing cannot ask
 * the right person for access. And the recent-search notice says plainly that
 * nothing is kept on the device, because an office on a shared machine has no
 * other way to know.
 */
export const SEARCH_COPY = {
  title: 'Search',
  subtitle: 'Residents, households, families, cases, requests and programmes.',

  label: 'Search the registry',
  placeholder: 'Name, control number, case or household reference',
  submit: 'Search',
  minLength: 'Type at least two characters.',

  safeNotice:
    'Results show a name, a reference, a barangay and a status. Case notes and assessments are ' +
    'never searched and never shown here.',

  recentHeading: 'Recent in this tab',
  recentNotice: 'Recent searches are kept for this tab only and are never saved to this device.',
  clearRecent: 'Clear',

  resultsFor: 'Results for',
  seeAll: 'See all',
  withheldHeading: 'Not searched',

  emptyHeading: 'Nothing matched',
  emptyMessage: 'Try a surname, a control number, or part of a reference.',

  idleHeading: 'Search across the office',
  idleMessage: 'Find a resident, a request, a case, a household, a family or a programme.',
} as const;
