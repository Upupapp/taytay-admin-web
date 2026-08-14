import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asId,
  asIsoDateTime,
  isValidSavedViewName,
  PermissionDeniedError,
  SAVED_VIEW_PERMISSIONS,
  SAVED_VIEW_NAME_MAX_LENGTH,
  type SavedView,
  type SavedViewDraft,
  type SavedViewId,
  type SavedViewRepository,
  type SavedViewResource,
} from '@domain/index';

import { MOCK_SAVED_VIEWS } from './seed/saved-views.seed';
import { denyUnless } from './mock-access';
import { MockLatency } from './mock-latency';

/**
 * Saved list parameters, held for the lifetime of the tab.
 *
 * A hook, and honest about it: the API will own persistence and sharing. What
 * this pins down is the contract — a saved view is a *name plus query params*,
 * a shared view is the office's and a personal one is its owner's, and reading
 * either costs the same permission as reading the list it describes.
 */
@Injectable({ providedIn: 'root' })
export class MockSavedViewRepository implements SavedViewRepository {
  private readonly latency = inject(MockLatency);
  private readonly access = inject(ACCESS_CONTEXT);

  private views: readonly SavedView[] = MOCK_SAVED_VIEWS;
  private sequence = MOCK_SAVED_VIEWS.length;

  listFor(resource: SavedViewResource): Observable<readonly SavedView[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly SavedView[]>(user, SAVED_VIEW_PERMISSIONS[resource]);
    if (denied) {
      return denied;
    }

    // Someone else's personal view is not listed at all. Its *name* can describe
    // a population, so it is disclosive even though it holds no records.
    return this.latency.respond(
      this.views.filter(
        (view) =>
          view.resource === resource && (view.isShared || view.ownerId === (user?.id ?? null)),
      ),
    );
  }

  create(draft: SavedViewDraft): Observable<SavedView> {
    const user = this.access.currentUser();
    const denied = denyUnless<SavedView>(user, SAVED_VIEW_PERMISSIONS[draft.resource]);
    if (denied) {
      return denied;
    }
    if (!isValidSavedViewName(draft.name)) {
      return throwError(
        () =>
          new Error(`A saved view needs a name of 1 to ${SAVED_VIEW_NAME_MAX_LENGTH} characters.`),
      );
    }

    this.sequence += 1;
    const now = asIsoDateTime(new Date());
    const created: SavedView = {
      id: asId<SavedViewId>(`view-${String(this.sequence).padStart(4, '0')}`),
      resource: draft.resource,
      name: draft.name.trim(),
      params: { ...draft.params },
      isShared: draft.isShared,
      ownerId: user?.id ?? null,
      audit: {
        createdAt: now,
        createdBy: user?.id ?? null,
        updatedAt: now,
        updatedBy: user?.id ?? null,
      },
    };
    this.views = [...this.views, created];
    return this.latency.respond(created);
  }

  remove(id: SavedViewId): Observable<void> {
    const user = this.access.currentUser();
    const existing = this.views.find((view) => view.id === id);

    // A shared view is the office's, not the last person to look at it. Removing
    // one is a settings change, not a list preference.
    if (
      existing === undefined ||
      existing.isShared ||
      existing.ownerId === null ||
      existing.ownerId !== user?.id
    ) {
      return throwError(() => new PermissionDeniedError(null));
    }

    this.views = this.views.filter((view) => view.id !== id);
    return this.latency.respond(undefined);
  }
}
