import type { StatusCatalog, StatusTransitions } from '../shared/status';

/**
 * Whether residents see an entry in the app — a hotline, a home banner (`DL-170`).
 *
 * Defined once (rule 7) because the API keeps it as one boolean, `active`, on both, and the two
 * screens must say it the same way. "Hidden" is not "deleted": a hidden entry is kept and can be
 * shown again, and the screens say which of the two an act does.
 */
export type AppVisibility = 'shown' | 'hidden';

export const APP_VISIBILITY_CATALOG: StatusCatalog<AppVisibility> = {
  shown: {
    value: 'shown',
    label: 'Shown in the app',
    tone: 'success',
    description: 'Residents see it in the Taytay app.',
  },
  hidden: {
    value: 'hidden',
    label: 'Hidden from the app',
    tone: 'neutral',
    description: 'Kept here; residents do not see it until it is shown again.',
  },
};

export const APP_VISIBILITY_TRANSITIONS: StatusTransitions<AppVisibility> = {
  shown: ['hidden'],
  hidden: ['shown'],
};

export function visibilityOf(active: boolean): AppVisibility {
  return active ? 'shown' : 'hidden';
}
