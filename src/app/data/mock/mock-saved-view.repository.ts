import { inject, Injectable } from '@angular/core';
import { throwError, type Observable } from 'rxjs';

import {
  ACCESS_CONTEXT,
  asId,
  asIsoDateTime,
  isValidSavedViewName,
  PermissionDeniedError,
  SAVED_VIEW_CAP,
  SAVED_VIEW_PERMISSIONS,
  SAVED_VIEW_NAME_MAX_LENGTH,
  SHARE_VIEW_PERMISSION,
  userHasPermission,
  type SavedView,
  type SavedViewDraft,
  type SavedViewId,
  type SavedViewRepository,
  type SavedViewResource,
} from '@domain/index';

import { refuseArchiveState } from './mock-archive';
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

  listFor(resource: SavedViewResource, archived: boolean): Observable<readonly SavedView[]> {
    const user = this.access.currentUser();
    const denied = denyUnless<readonly SavedView[]>(user, SAVED_VIEW_PERMISSIONS[resource]);
    if (denied) {
      return denied;
    }

    // Someone else's personal view is not listed at all. Its *name* can describe
    // a population, so it is disclosive even though it holds no records. An
    // archived list holds only what this account could restore (`DL-225`).
    return this.latency.respond(
      this.views.filter(
        (view) =>
          view.resource === resource &&
          (view.archived !== null) === archived &&
          (archived ? this.mayMove(view) : view.isShared || view.ownerId === (user?.id ?? null)),
      ),
    );
  }

  create(draft: SavedViewDraft): Observable<SavedView> {
    const user = this.access.currentUser();
    const denied = denyUnless<SavedView>(user, SAVED_VIEW_PERMISSIONS[draft.resource]);
    if (denied) {
      return denied;
    }
    // Saving a view for the whole office is a separate grant from saving one
    // for yourself: it appears for every colleague on that screen, its name
    // describes a population, and it outlives whoever wrote it (`DL-111`).
    if (draft.isShared) {
      const cannotShare = denyUnless<SavedView>(user, SHARE_VIEW_PERMISSION);
      if (cannotShare) {
        return cannotShare;
      }
    }
    const inUse = this.views.filter(
      (view) =>
        view.resource === draft.resource &&
        view.archived === null &&
        view.isShared === draft.isShared &&
        (draft.isShared || view.ownerId === (user?.id ?? null)),
    );
    if (inUse.length >= SAVED_VIEW_CAP) {
      return throwError(() => new Error(this.capReached(draft.isShared)));
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
      archived: null,
    };
    this.views = [...this.views, created];
    return this.latency.respond(created);
  }

  archive(id: SavedViewId): Observable<SavedView> {
    const existing = this.views.find((view) => view.id === id);
    if (existing === undefined || !this.mayMove(existing)) {
      return throwError(() => new PermissionDeniedError(null));
    }
    const already = refuseArchiveState<SavedView>(existing.archived, 'archive', 'That saved view');
    if (already) {
      return already;
    }
    return this.put({
      ...existing,
      archived: { at: asIsoDateTime(new Date()), byName: null, reason: null },
    });
  }

  restore(id: SavedViewId): Observable<SavedView> {
    const user = this.access.currentUser();
    const existing = this.views.find((view) => view.id === id);
    if (existing === undefined || !this.mayMove(existing)) {
      return throwError(() => new PermissionDeniedError(null));
    }
    const already = refuseArchiveState<SavedView>(existing.archived, 'restore', 'That saved view');
    if (already) {
      return already;
    }
    const inUse = this.views.filter(
      (view) =>
        view.resource === existing.resource &&
        view.archived === null &&
        view.isShared === existing.isShared &&
        (existing.isShared || view.ownerId === (user?.id ?? null)),
    );
    if (inUse.length >= SAVED_VIEW_CAP) {
      return throwError(() => new Error(this.capReached(existing.isShared)));
    }
    return this.put({ ...existing, archived: null });
  }

  /**
   * A shared view is the office's, not the last person to look at it: archiving or
   * restoring one costs the same grant as creating one, and your own personal view
   * costs nothing beyond owning it.
   */
  private mayMove(view: SavedView): boolean {
    const user = this.access.currentUser();
    return view.isShared
      ? userHasPermission(user, SHARE_VIEW_PERMISSION)
      : view.ownerId !== null && view.ownerId === user?.id;
  }

  /** The API's refusal past a list's cap, in its own words. */
  private capReached(shared: boolean): string {
    return shared
      ? `The office already keeps ${SAVED_VIEW_CAP} shared views of this list. Archive one first.`
      : `You already keep ${SAVED_VIEW_CAP} views of this list. Archive one first.`;
  }

  private put(view: SavedView): Observable<SavedView> {
    this.views = this.views.map((candidate) => (candidate.id === view.id ? view : candidate));
    return this.latency.respond(view);
  }
}
