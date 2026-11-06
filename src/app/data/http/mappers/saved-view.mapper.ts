import {
  SAVED_VIEW_RESOURCES,
  type SavedView,
  type SavedViewDraft,
  type SavedViewId,
  type SavedViewResource,
  type StaffUserId,
} from '@domain/index';

import { dateTime, field, flag, id, oneOf, str } from './wire';

/**
 * Saved views on the wire (`SavedView`).
 *
 * | wire          | domain              | if absent or unknown                          |
 * | ------------- | ------------------- | --------------------------------------------- |
 * | `id`          | `id`                | the view is not readable                      |
 * | `resource`    | `resource`          | a list this console has no bar for: not readable |
 * | `name`        | `name`              | the view is not readable                      |
 * | `params`      | `params`            | a value that is not text: not readable        |
 * | `is_shared`   | `isShared`          | the view is not readable                      |
 * | `owner_id`    | `ownerId`, `audit`  | the view is not readable                      |
 * | `created_at`  | `audit`             | the view is not readable                      |
 *
 * **Whose a view is decides what the bar offers.** A personal view of your own offers removal; a
 * shared one does not. So a view whose sharing could not be read is refused rather than defaulted:
 * read as personal it would offer to delete office configuration, read as shared it would hide
 * somebody's own view from them.
 *
 * A view is never edited — it is created and taken away — so `audit` is its creation twice.
 *
 * @consumes GET office/saved-views
 * @consumes POST office/saved-views
 */
export function toSavedView(wire: unknown): SavedView | null {
  const viewId = id<SavedViewId>(field(wire, 'id'));
  const resource = oneOf<SavedViewResource>(field(wire, 'resource'), SAVED_VIEW_RESOURCES);
  const name = str(field(wire, 'name'));
  const params = toParams(field(wire, 'params'));
  const isShared = flag(field(wire, 'is_shared'));
  const ownerId = id<StaffUserId>(field(wire, 'owner_id'));
  const createdAt = dateTime(field(wire, 'created_at'));

  if (
    viewId === null ||
    resource === null ||
    name === null ||
    params === null ||
    isShared === null ||
    ownerId === null ||
    createdAt === null
  ) {
    return null;
  }

  return {
    id: viewId,
    resource,
    name,
    params,
    isShared,
    ownerId,
    audit: { createdAt, createdBy: ownerId, updatedAt: createdAt, updatedBy: ownerId },
  };
}

/** `name → value`, every value text — exactly what goes in the URL — or `null`. */
function toParams(value: unknown): Readonly<Record<string, string>> | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const params: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry !== 'string') {
      return null;
    }
    params[key] = entry;
  }
  return params;
}

/**
 * What `POST office/saved-views` reads (`SavedViewCreate`), and nothing else: the body is strict.
 * The owner is the signed-in account, decided by the server and never sent.
 */
export interface SavedViewDraftWire {
  readonly resource: SavedViewResource;
  readonly name: string;
  readonly params: Readonly<Record<string, string>>;
  readonly is_shared: boolean;
}

export function toWireSavedViewDraft(draft: SavedViewDraft): SavedViewDraftWire {
  return {
    resource: draft.resource,
    name: draft.name.trim(),
    params: { ...draft.params },
    is_shared: draft.isShared,
  };
}
