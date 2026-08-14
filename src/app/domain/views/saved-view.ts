import type { Permission } from '../access/permission';
import type { AuditStamp } from '../shared/audit';
import type { SavedViewId, StaffUserId } from '../shared/ids';

/**
 * A named set of list parameters.
 *
 * The whole design rests on one earlier decision: filter state lives in the URL
 * (`DL-36`). That makes a saved view nothing more than a name attached to query
 * parameters — no parallel filter model, no second way to express "seniors in
 * San Juan", and nothing to keep in step when a list grows a new filter. Applying
 * a view is a navigation; sharing one is a link.
 */
export type SavedViewResource = 'residents' | 'assistance-requests' | 'disbursements';

export const SAVED_VIEW_RESOURCES: readonly SavedViewResource[] = [
  'residents',
  'assistance-requests',
  'disbursements',
];

/**
 * Seeing a saved view for a resource is exactly seeing the resource: the view
 * holds no data of its own, but its *name* can describe a population ("VAWC
 * survivors, Santa Ana") and so is disclosive in the same way the list is.
 */
export const SAVED_VIEW_PERMISSIONS: Readonly<Record<SavedViewResource, Permission>> = {
  residents: 'resident.view',
  'assistance-requests': 'request.view',
  disbursements: 'disbursement.view',
};

export interface SavedView {
  readonly id: SavedViewId;
  readonly resource: SavedViewResource;
  readonly name: string;
  /** Exactly what goes in the URL. Empty means "everything". */
  readonly params: Readonly<Record<string, string>>;
  /** Shared views are the office's; personal ones belong to their owner alone. */
  readonly isShared: boolean;
  readonly ownerId: StaffUserId | null;
  readonly audit: AuditStamp;
}

export interface SavedViewDraft {
  readonly resource: SavedViewResource;
  readonly name: string;
  readonly params: Readonly<Record<string, string>>;
  readonly isShared: boolean;
}

/** Same keys, same values — used to mark which chip is currently applied. */
export function sameViewParams(
  a: Readonly<Record<string, string>>,
  b: Readonly<Record<string, string>>,
): boolean {
  const aKeys = Object.keys(a).sort();
  const bKeys = Object.keys(b).sort();
  if (aKeys.length !== bKeys.length) {
    return false;
  }
  return aKeys.every((key, index) => bKeys[index] === key && a[key] === b[key]);
}

export const SAVED_VIEW_NAME_MAX_LENGTH = 60;

export function isValidSavedViewName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= SAVED_VIEW_NAME_MAX_LENGTH;
}
