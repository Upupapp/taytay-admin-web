import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, of, switchMap } from 'rxjs';

import { NotificationStore } from '@core/notifications/notification.store';
import {
  isValidSavedViewName,
  SAVED_VIEW_REPOSITORY,
  sameViewParams,
  type SavedView,
  type SavedViewId,
  type SavedViewResource,
} from '@domain/index';
import { DisplayDatePipe } from '@shared/pipes/display-date.pipe';
import { plainRefusal } from '../../archive/archive.copy';
import { IDLE, toViewState, type ViewState } from '../../state/view-state';
import { AsyncContent } from '../async-content/async-content';
import { Icon } from '../icon/icon';
import { Modal } from '../modal/modal';
import { SAVED_VIEWS_COPY } from './saved-views.copy';

/**
 * Named filters for a list screen.
 *
 * The hook the registry needed, and the reason it is this small: because filter
 * state already lives in the URL (`DL-36`), a saved view is a *name attached to
 * query parameters* and nothing else. There is no second filter model to keep in
 * step, applying a view is a navigation, and sharing one is a link — so a list
 * that grows a new filter tomorrow gains it in saved views for free.
 *
 * A view is archived, never deleted (`DL-225`): one of your own personal views
 * can be put away from the bar, and "Archived views" lists what was put away
 * with a Restore beside each. Archiving is reversible and keeps no reason, so it
 * asks for no confirmation; the outcome is announced, saying how to restore.
 *
 * Drop it above any list whose filters are URL-driven:
 *
 *   <app-saved-views-bar resource="residents" [currentParams]="params()" />
 */
@Component({
  selector: 'app-saved-views-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DisplayDatePipe, Icon, Modal, RouterLink],
  template: `
    <section class="views" [attr.aria-label]="heading()">
      <h2 class="visually-hidden">{{ heading() }}</h2>

      <ul class="views__list">
        <li>
          <a
            class="views__chip"
            [class.views__chip--active]="isUnfiltered()"
            [attr.aria-current]="isUnfiltered() ? 'true' : null"
            [routerLink]="[]"
            [queryParams]="{}"
          >
            {{ allLabel() }}
          </a>
        </li>

        @for (view of views(); track view.id) {
          <li class="views__item">
            <a
              class="views__chip"
              [class.views__chip--active]="isActive(view)"
              [attr.aria-current]="isActive(view) ? 'true' : null"
              [routerLink]="[]"
              [queryParams]="view.params"
            >
              {{ view.name }}
              @if (view.isShared) {
                <span class="visually-hidden">({{ copy.shared }})</span>
              }
            </a>

            @if (canArchive(view)) {
              <button
                type="button"
                class="icon-button views__archive"
                [attr.aria-label]="copy.archiveLabel(view.name)"
                [title]="copy.archiveHint"
                (click)="archive(view)"
              >
                <app-icon name="close" [size]="14" [stroke]="2.2" />
              </button>
            }
          </li>
        }
      </ul>

      <div class="views__acts">
        <button type="button" class="btn btn--subtle" (click)="openArchived()">
          {{ copy.archivedViews }}
        </button>
        <button type="button" class="btn btn--subtle" (click)="openSave()">
          {{ saveLabel() }}
        </button>
      </div>

      @if (error(); as message) {
        <p class="views__error" role="alert">{{ message }}</p>
      }
    </section>

    <app-modal
      [(open)]="saving"
      [heading]="saveLabel()"
      [description]="saveDescription()"
      size="small"
    >
      <label class="field" modal-body>
        <span class="field__label">{{ nameLabel() }}</span>
        <input class="field__input" type="text" [value]="draftName()" (input)="onName($event)" />
      </label>

      <button
        modal-actions
        type="button"
        class="btn btn--primary"
        [disabled]="!canSave()"
        (click)="save()"
      >
        {{ confirmLabel() }}
      </button>
    </app-modal>

    @if (showingArchived()) {
      <app-modal
        [open]="true"
        [heading]="copy.archivedViews"
        [description]="copy.archivedLead"
        size="small"
        (dismissed)="closeArchived()"
      >
        <div modal-body class="stack">
          <app-async-content
            [state]="archivedState()"
            [content]="archivedList"
            [skeletonLines]="2"
            [errorHeading]="copy.archivedFailed"
          >
            <ng-template #archivedList let-archived>
              @if (archived.length === 0) {
                <p class="note-box">
                  <strong>{{ copy.noArchived }}.</strong> {{ copy.noArchivedMessage }}
                </p>
              } @else {
                <ul class="soft-list">
                  @for (view of archived; track view.id) {
                    <li class="soft-row">
                      <span class="views__archived-name">
                        <strong>{{ view.name }}</strong>
                        <span class="soft-row__meta">
                          @if (view.isShared) {
                            {{ copy.shared }} ·
                          }
                          @if (view.archived; as when) {
                            {{ copy.archivedOn((when.at | displayDate) ?? '') }}
                          }
                        </span>
                      </span>
                      <button
                        type="button"
                        class="btn btn--small"
                        [attr.aria-label]="copy.restoreLabel(view.name)"
                        [disabled]="restoring() !== null"
                        (click)="restore(view)"
                      >
                        {{ restoring() === view.id ? copy.restoring : copy.restore }}
                      </button>
                    </li>
                  }
                </ul>
              }
            </ng-template>
          </app-async-content>
          @if (restoreProblem(); as message) {
            <p class="callout callout--danger" role="alert">{{ message }}</p>
          }
        </div>
        <button modal-actions type="button" class="btn btn--secondary" (click)="closeArchived()">
          {{ copy.close }}
        </button>
      </app-modal>
    }
  `,
  styleUrl: './saved-views-bar.scss',
})
export class SavedViewsBar {
  private readonly repository = inject(SAVED_VIEW_REPOSITORY);
  private readonly notifications = inject(NotificationStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly resource = input.required<SavedViewResource>();
  /** The filter currently in the URL, exactly as it would be saved. */
  readonly currentParams = input.required<Readonly<Record<string, string>>>();
  /** Staff id of the signed-in user, so personal views can offer archiving. */
  readonly currentUserId = input<string | null>(null);

  readonly heading = input('Saved views');
  readonly allLabel = input('All');
  readonly saveLabel = input('Save this view');
  readonly saveDescription = input('Give the current filters a name you will recognise later.');
  readonly nameLabel = input('View name');
  readonly confirmLabel = input('Save view');

  protected readonly copy = SAVED_VIEWS_COPY;

  protected readonly saving = signal(false);
  protected readonly draftName = signal('');
  protected readonly error = signal<string | null>(null);

  private readonly stored = signal<readonly SavedView[]>([]);
  protected readonly views = this.stored.asReadonly();

  protected readonly isUnfiltered = computed(() => Object.keys(this.currentParams()).length === 0);

  protected readonly canSave = computed(
    () => isValidSavedViewName(this.draftName()) && !this.isUnfiltered(),
  );

  /** The archived views, read when their list is opened and again after a restore. */
  protected readonly showingArchived = signal(false);
  private readonly archivedGeneration = signal(0);
  protected readonly archivedState = toSignal(
    combineLatest([toObservable(this.showingArchived), toObservable(this.archivedGeneration)]).pipe(
      switchMap(([open]) =>
        open ? toViewState(this.repository.listFor(this.resource(), true)) : of(IDLE),
      ),
    ),
    { initialValue: IDLE as ViewState<readonly SavedView[]> },
  );
  protected readonly restoring = signal<SavedViewId | null>(null);
  protected readonly restoreProblem = signal<string | null>(null);

  constructor() {
    // An effect rather than a constructor call: `resource` is a required input
    // and is not bound yet when the constructor runs.
    effect((onCleanup) => {
      const subscription = this.repository.listFor(this.resource(), false).subscribe({
        next: (views) => this.stored.set(views),
        // A refused list is not something the user can act on: the screen they
        // are already looking at proves they may read the resource. Fail quiet.
        error: () => this.stored.set([]),
      });
      onCleanup(() => subscription.unsubscribe());
    });
  }

  protected isActive(view: SavedView): boolean {
    return sameViewParams(view.params, this.currentParams());
  }

  /** Only a personal view of your own. A shared view belongs to the office. */
  protected canArchive(view: SavedView): boolean {
    return !view.isShared && view.ownerId !== null && view.ownerId === this.currentUserId();
  }

  protected openSave(): void {
    this.error.set(null);
    this.draftName.set('');
    this.saving.set(true);
  }

  protected onName(event: Event): void {
    this.draftName.set((event.target as HTMLInputElement).value);
  }

  protected save(): void {
    if (!this.canSave()) {
      return;
    }
    this.repository
      .create({
        resource: this.resource(),
        name: this.draftName(),
        params: this.currentParams(),
        isShared: false,
      })
      .subscribe({
        next: (created) => {
          this.stored.update((views) => [...views, created]);
          this.saving.set(false);
        },
        error: (failure: unknown) => {
          this.saving.set(false);
          this.error.set(plainRefusal(failure, this.copy.noun, this.copy.saveFailed));
        },
      });
  }

  /**
   * Puts a view away. Reversible and kept, so no confirmation: the outcome says where it went and
   * how to bring it back (`DL-225`).
   */
  protected archive(view: SavedView): void {
    this.error.set(null);
    const wasApplied = this.isActive(view);
    this.repository.archive(view.id).subscribe({
      next: () => {
        this.stored.update((views) => views.filter((candidate) => candidate.id !== view.id));
        this.notifications.success(this.copy.archivedTitle(view.name), this.copy.archivedBody);
        // Only the applied view: leaving the URL on it would show a filter with no chip to explain
        // it. Archiving another view leaves the reader's own filters where they are.
        if (wasApplied) {
          void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
        }
      },
      error: (failure: unknown) =>
        this.error.set(plainRefusal(failure, this.copy.noun, this.copy.archiveFailed)),
    });
  }

  protected openArchived(): void {
    this.restoreProblem.set(null);
    this.showingArchived.set(true);
  }

  protected closeArchived(): void {
    this.showingArchived.set(false);
  }

  protected restore(view: SavedView): void {
    if (this.restoring() !== null) {
      return;
    }
    this.restoring.set(view.id);
    this.restoreProblem.set(null);
    this.repository.restore(view.id).subscribe({
      next: (restored) => {
        this.restoring.set(null);
        this.stored.update((views) => [...views.filter((v) => v.id !== restored.id), restored]);
        this.archivedGeneration.update((n) => n + 1);
        this.notifications.success(this.copy.restoredTitle(restored.name));
      },
      error: (failure: unknown) => {
        this.restoring.set(null);
        this.restoreProblem.set(plainRefusal(failure, this.copy.noun, this.copy.restoreFailed));
        this.archivedGeneration.update((n) => n + 1);
      },
    });
  }
}
