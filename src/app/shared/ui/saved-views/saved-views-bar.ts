import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import {
  isValidSavedViewName,
  SAVED_VIEW_REPOSITORY,
  sameViewParams,
  type SavedView,
  type SavedViewId,
  type SavedViewResource,
} from '@domain/index';
import { Modal } from '../modal/modal';

/**
 * Named filters for a list screen.
 *
 * The hook the registry needed, and the reason it is this small: because filter
 * state already lives in the URL (`DL-36`), a saved view is a *name attached to
 * query parameters* and nothing else. There is no second filter model to keep in
 * step, applying a view is a navigation, and sharing one is a link — so a list
 * that grows a new filter tomorrow gains it in saved views for free.
 *
 * Drop it above any list whose filters are URL-driven:
 *
 *   <app-saved-views-bar resource="residents" [currentParams]="params()" />
 */
@Component({
  selector: 'app-saved-views-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal, RouterLink],
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
                <span class="visually-hidden">(shared with the office)</span>
              }
            </a>

            @if (canRemove(view)) {
              <button
                type="button"
                class="icon-button views__remove"
                [attr.aria-label]="'Remove saved view ' + view.name"
                (click)="remove(view.id)"
              >
                ×
              </button>
            }
          </li>
        }
      </ul>

      <button type="button" class="btn btn--subtle views__save" (click)="openSave()">
        {{ saveLabel() }}
      </button>

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
      <label class="views__field" modal-body>
        <span class="views__field-label">{{ nameLabel() }}</span>
        <input
          class="views__field-input"
          type="text"
          [value]="draftName()"
          (input)="onName($event)"
        />
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
  `,
  styleUrl: './saved-views-bar.scss',
})
export class SavedViewsBar {
  private readonly repository = inject(SAVED_VIEW_REPOSITORY);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly resource = input.required<SavedViewResource>();
  /** The filter currently in the URL, exactly as it would be saved. */
  readonly currentParams = input.required<Readonly<Record<string, string>>>();
  /** Staff id of the signed-in user, so personal views can offer removal. */
  readonly currentUserId = input<string | null>(null);

  readonly heading = input('Saved views');
  readonly allLabel = input('All');
  readonly saveLabel = input('Save this view');
  readonly saveDescription = input('Give the current filters a name you will recognise later.');
  readonly nameLabel = input('View name');
  readonly confirmLabel = input('Save view');

  protected readonly saving = signal(false);
  protected readonly draftName = signal('');
  protected readonly error = signal<string | null>(null);

  private readonly stored = signal<readonly SavedView[]>([]);
  protected readonly views = this.stored.asReadonly();

  protected readonly isUnfiltered = computed(() => Object.keys(this.currentParams()).length === 0);

  protected readonly canSave = computed(
    () => isValidSavedViewName(this.draftName()) && !this.isUnfiltered(),
  );

  constructor() {
    // An effect rather than a constructor call: `resource` is a required input
    // and is not bound yet when the constructor runs.
    effect((onCleanup) => {
      const subscription = this.repository.listFor(this.resource()).subscribe({
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
  protected canRemove(view: SavedView): boolean {
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
        error: (failure: unknown) => this.fail(failure),
      });
  }

  protected remove(id: SavedViewId): void {
    this.repository.remove(id).subscribe({
      next: () => {
        this.stored.update((views) => views.filter((view) => view.id !== id));
        // Leaving the URL on a view that no longer exists would show an applied
        // filter with no chip to explain it.
        void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
      },
      error: (failure: unknown) => this.fail(failure),
    });
  }

  private fail(failure: unknown): void {
    this.saving.set(false);
    this.error.set(
      failure instanceof Error
        ? failure.message
        : 'That view could not be saved. Please try again.',
    );
  }
}
