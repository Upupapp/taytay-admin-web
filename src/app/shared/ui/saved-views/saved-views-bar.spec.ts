import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { of, throwError, type Observable } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import type { ApiFailure } from '@core/http/api-failure';
import { NotificationStore } from '@core/notifications/notification.store';
import {
  asId,
  asIsoDateTime,
  SAVED_VIEW_REPOSITORY,
  type SavedView,
  type SavedViewDraft,
  type SavedViewId,
  type SavedViewRepository,
  type SavedViewResource,
  type StaffUserId,
} from '@domain/index';

import { SavedViewsBar } from './saved-views-bar';

const READER = 'staff-1';
const STAMP = asIsoDateTime('2026-11-01T00:00:00.000Z');

function view(key: string, values: Partial<SavedView> = {}): SavedView {
  return {
    id: asId<SavedViewId>(`view-${key}`),
    resource: 'residents',
    name: key,
    params: { status: key.toLowerCase() },
    isShared: false,
    ownerId: asId<StaffUserId>(READER),
    audit: { createdAt: STAMP, createdBy: null, updatedAt: STAMP, updatedBy: null },
    archived: null,
    ...values,
  };
}

/** The server's refusal as the transport hands it over: a plain object, not an `Error`. */
function failure(code: string, status: number, message: string): ApiFailure {
  return {
    code,
    status,
    message,
    details: null,
    requestId: 'req-1',
    retryAfterSeconds: null,
    counts: null,
  };
}

/** Records every call, so a test can say what was — and was not — asked of the data layer. */
class RecordingViews implements SavedViewRepository {
  inUse: readonly SavedView[] = [
    view('Pending'),
    view('Office view', { isShared: true }),
    view('Colleague', { ownerId: asId<StaffUserId>('staff-2') }),
  ];
  archivedViews: readonly SavedView[] = [
    view('Old filter', {
      archived: { at: asIsoDateTime('2026-11-03T12:00:00.000Z'), byName: null, reason: null },
    }),
  ];
  readonly listed: { resource: SavedViewResource; archived: boolean }[] = [];
  readonly archivedIds: SavedViewId[] = [];
  readonly restoredIds: SavedViewId[] = [];
  readonly created: SavedViewDraft[] = [];
  refusal: unknown = null;

  listFor(resource: SavedViewResource, archived: boolean): Observable<readonly SavedView[]> {
    this.listed.push({ resource, archived });
    return of(archived ? this.archivedViews : this.inUse);
  }

  create(draft: SavedViewDraft): Observable<SavedView> {
    const refusal = this.refusal;
    if (refusal !== null) return throwError(() => refusal);
    this.created.push(draft);
    return of(view(draft.name, { params: draft.params }));
  }

  archive(id: SavedViewId): Observable<SavedView> {
    const refusal = this.refusal;
    if (refusal !== null) return throwError(() => refusal);
    this.archivedIds.push(id);
    return of(view(id, { id }));
  }

  restore(id: SavedViewId): Observable<SavedView> {
    const refusal = this.refusal;
    if (refusal !== null) return throwError(() => refusal);
    this.restoredIds.push(id);
    const found = this.archivedViews.find((candidate) => candidate.id === id);
    return found === undefined
      ? throwError(() => new Error('No such view.'))
      : of({ ...found, archived: null });
  }
}

interface Notice {
  readonly title: string;
  readonly body: string | undefined;
}

function configure(): { views: RecordingViews; notices: Notice[] } {
  const views = new RecordingViews();
  const notices: Notice[] = [];
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: SAVED_VIEW_REPOSITORY, useValue: views },
      {
        provide: NotificationStore,
        useValue: { success: (title: string, body?: string) => notices.push({ title, body }) },
      },
    ],
  });
  return { views, notices };
}

function bar(params: Readonly<Record<string, string>>): ComponentFixture<SavedViewsBar> {
  const fixture = TestBed.createComponent(SavedViewsBar);
  fixture.componentRef.setInput('resource', 'residents');
  fixture.componentRef.setInput('currentParams', params);
  fixture.componentRef.setInput('currentUserId', READER);
  return fixture;
}

async function settle<T>(fixture: ComponentFixture<T>): Promise<HTMLElement> {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

function buttonNamed(name: string, root: ParentNode = document): HTMLButtonElement | null {
  return (
    [...root.querySelectorAll<HTMLButtonElement>('button')].find(
      (button) => button.textContent?.trim() === name || button.getAttribute('aria-label') === name,
    ) ?? null
  );
}

function chips(element: HTMLElement): (string | undefined)[] {
  return [...element.querySelectorAll('.views__list .views__chip')].map((chip) =>
    chip.textContent?.replace(/\s+/g, ' ').trim(),
  );
}

describe('SavedViewsBar — archive, never delete (DL-225)', () => {
  it('reads the views in use, and offers Archive only on the reader’s own personal view', async () => {
    const { views } = configure();
    const element = await settle(bar({}));

    expect(views.listed).toEqual([{ resource: 'residents', archived: false }]);
    expect(chips(element)).toEqual([
      'All',
      'Pending',
      'Office view (Shared with the office)',
      'Colleague',
    ]);
    const archive = buttonNamed('Archive the saved view Pending');
    expect(archive?.classList).toContain('icon-button');
    expect(archive?.getAttribute('title')).toBe(
      'Archive this view. It can be restored from Archived views.',
    );
    // A shared view is the office's, even when the reader made it; a colleague's is theirs.
    expect(buttonNamed('Archive the saved view Office view')).toBeNull();
    expect(buttonNamed('Archive the saved view Colleague')).toBeNull();
    expect(element.textContent).not.toMatch(/delete/i);
  });

  it('archives without a confirmation, says how to restore, and leaves the reader’s filters alone', async () => {
    const { views, notices } = configure();
    const fixture = bar({ barangay: 'dolores' });
    const element = await settle(fixture);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');

    buttonNamed('Archive the saved view Pending')?.click();
    await settle(fixture);

    expect(views.archivedIds).toEqual(['view-Pending']);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
    expect(chips(element)).not.toContain('Pending');
    expect(notices).toEqual([
      {
        title: '“Pending” was archived.',
        body: 'It is kept under Archived views beside this bar, and can be restored there.',
      },
    ]);
    // Not the view applied: the reader's own filters stay where they are.
    expect(navigate).not.toHaveBeenCalled();
  });

  it('clears the filters only when the archived view was the one applied', async () => {
    configure();
    const fixture = bar({ status: 'pending' });
    const element = await settle(fixture);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
    expect(element.querySelector('[aria-current="true"]')?.textContent?.trim()).toBe('Pending');

    buttonNamed('Archive the saved view Pending')?.click();
    await settle(fixture);

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({ queryParams: {} }));
  });

  it('says what the server said when an archive is refused, never "could not be saved"', async () => {
    const { views, notices } = configure();
    views.refusal = failure('FORBIDDEN', 403, 'Only the owner of a view can archive it.');
    const fixture = bar({});
    const element = await settle(fixture);

    buttonNamed('Archive the saved view Pending')?.click();
    await settle(fixture);

    const alert = element.querySelector('.views__error[role="alert"]');
    expect(alert?.textContent).toContain('Only the owner of a view can archive it.');
    expect(alert?.textContent).not.toContain('could not be saved');
    expect(chips(element)).toContain('Pending');
    expect(notices).toEqual([]);
  });

  it('says what the server said when a save is refused (a refusal is a plain object, not an Error)', async () => {
    const { views } = configure();
    views.refusal = failure(
      'CONFLICT',
      409,
      'This list already keeps 50 saved views. Archive one before saving another.',
    );
    const fixture = bar({ barangay: 'dolores' });
    const element = await settle(fixture);

    buttonNamed('Save this view')?.click();
    await settle(fixture);
    const name = document.querySelector<HTMLInputElement>('[role="dialog"] input');
    if (name === null) throw new Error('No name field.');
    name.value = 'Dolores';
    name.dispatchEvent(new Event('input'));
    await settle(fixture);
    buttonNamed('Save view')?.click();
    await settle(fixture);

    expect(element.querySelector('.views__error')?.textContent).toContain(
      'This list already keeps 50 saved views. Archive one before saving another.',
    );
    expect(views.created).toEqual([]);
  });

  it('lists the archived views in their own dialog, and restores one back to the bar', async () => {
    const { views, notices } = configure();
    const fixture = bar({});
    const element = await settle(fixture);

    buttonNamed('Archived views')?.click();
    await settle(fixture);

    expect(views.listed).toContainEqual({ resource: 'residents', archived: true });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.getAttribute('aria-label')).toBe('Archived views');
    expect(dialog?.textContent).toContain(
      'Views of this list that were archived. Restoring one puts it back in the bar as it was.',
    );
    const row = dialog?.querySelector('li')?.textContent?.replace(/\s+/g, ' ');
    expect(row).toContain('Old filter');
    expect(row).toContain('Archived 3 Nov 2026');

    buttonNamed('Restore the saved view Old filter', dialog ?? document)?.click();
    await settle(fixture);

    expect(views.restoredIds).toEqual(['view-Old filter']);
    expect(chips(element)).toContain('Old filter');
    expect(notices).toEqual([{ title: '“Old filter” is back in the bar.', body: undefined }]);
    // The archived list is read again, so the restored view leaves it.
    expect(views.listed.filter((call) => call.archived)).toHaveLength(2);
  });

  it('says the cap refusal in the server’s words, keeps the dialog open and adds nothing', async () => {
    const { views, notices } = configure();
    const fixture = bar({});
    const element = await settle(fixture);
    buttonNamed('Archived views')?.click();
    await settle(fixture);

    views.refusal = failure(
      'CONFLICT',
      409,
      'This list already keeps 50 saved views. Archive one before restoring another.',
    );
    buttonNamed('Restore the saved view Old filter')?.click();
    await settle(fixture);

    const alert = document.querySelector('[role="dialog"] [role="alert"]');
    expect(alert?.textContent).toContain(
      'This list already keeps 50 saved views. Archive one before restoring another.',
    );
    expect(alert?.textContent).not.toContain('CONFLICT');
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(chips(element)).not.toContain('Old filter');
    expect(notices).toEqual([]);
    expect(buttonNamed('Restore the saved view Old filter')?.disabled).toBe(false);
  });

  it('says so when nothing is archived, and reads nothing archived until asked', async () => {
    const { views } = configure();
    views.archivedViews = [];
    const fixture = bar({});
    await settle(fixture);
    expect(views.listed.filter((call) => call.archived)).toEqual([]);

    buttonNamed('Archived views')?.click();
    await settle(fixture);

    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      'No archived views. A view you archive from this bar is kept here, and can be restored.',
    );

    buttonNamed('Close', document.querySelector('[role="dialog"]') ?? document)?.click();
    await settle(fixture);
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });
});
