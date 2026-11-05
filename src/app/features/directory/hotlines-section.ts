import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

import {
  APP_VISIBILITY_CATALOG,
  HOTLINE_EFFECTS,
  HOTLINE_LIST_CAP,
  HOTLINE_REPOSITORY,
  visibilityOf,
  type Hotline,
  type HotlineListing,
} from '@domain/index';
import { failureReason } from '@shared/state/failure-reason';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Drawer } from '@shared/ui/drawer/drawer';
import { Modal } from '@shared/ui/modal/modal';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { DIRECTORY_COPY } from './directory.copy';
import { HotlineForm } from './hotline-form';

/**
 * Hotlines (`DL-170`): every line, shown and hidden, in the order the app lists them. The API answers
 * the list whole, up to a cap, with no word of more — so a list that reaches the cap says there may
 * be lines neither this screen nor the app shows, rather than presenting itself as the whole.
 */
@Component({
  selector: 'app-hotlines-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DataTable, Drawer, HotlineForm, Modal, StatusBadge],
  templateUrl: './hotlines-section.html',
  styleUrl: './directory-section.scss',
})
export class HotlinesSection {
  private readonly repository = inject(HOTLINE_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly copy = DIRECTORY_COPY.hotlines;
  protected readonly listCopy = DIRECTORY_COPY.list;
  protected readonly removeEffects = HOTLINE_EFFECTS.remove;
  protected readonly visibility = APP_VISIBILITY_CATALOG;
  protected readonly visibilityOf = visibilityOf;
  protected readonly cap = HOTLINE_LIST_CAP;

  private readonly generation = signal(0);
  protected readonly listing = toSignal(
    toObservable(this.generation).pipe(switchMap(() => toViewState(this.repository.list()))),
    { initialValue: LOADING as ViewState<HotlineListing> },
  );
  protected readonly rows = computed(() => valueOf(this.listing())?.hotlines ?? []);
  protected readonly mayBeIncomplete = computed(
    () => valueOf(this.listing())?.mayBeIncomplete === true,
  );

  private readonly shownCell = viewChild.required<TemplateRef<{ $implicit: Hotline }>>('shownCell');
  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: Hotline }>>('actionCell');

  protected readonly rowKey = (hotline: Hotline): string => hotline.id;

  protected readonly columns = computed<readonly TableColumn<Hotline>[]>(() => [
    { key: 'name', header: this.copy.columnName, value: (hotline) => hotline.name },
    { key: 'number', header: this.copy.columnNumber, value: (hotline) => hotline.number },
    { key: 'category', header: this.copy.columnCategory, value: (hotline) => hotline.category },
    {
      key: 'order',
      header: this.copy.columnOrder,
      align: 'end',
      value: (hotline) => String(hotline.sortOrder),
    },
    { key: 'shown', header: this.copy.columnShown, cell: this.shownCell() },
    {
      key: 'actions',
      header: this.copy.columnActions,
      hideHeader: true,
      align: 'end',
      cell: this.actionCell(),
    },
  ]);

  protected readonly editing = signal<Hotline | 'new' | null>(null);
  protected readonly removing = signal<Hotline | null>(null);
  protected readonly removeBusy = signal(false);
  protected readonly removeProblem = signal('');
  protected readonly outcome = signal('');

  protected readonly drawerHotline = computed(() => {
    const editing = this.editing();
    return editing === 'new' ? null : editing;
  });

  protected reload(): void {
    this.generation.update((n) => n + 1);
  }

  protected add(): void {
    this.editing.set('new');
  }

  protected edit(hotline: Hotline): void {
    this.editing.set(hotline);
  }

  protected closeDrawer(): void {
    this.editing.set(null);
  }

  protected onSaved(hotline: Hotline): void {
    this.outcome.set(
      this.editing() === 'new' ? this.copy.created(hotline.name) : this.copy.saved(hotline.name),
    );
    this.editing.set(null);
    this.reload();
  }

  protected askRemove(hotline: Hotline): void {
    this.removeProblem.set('');
    this.removing.set(hotline);
  }

  protected cancelRemove(): void {
    this.removing.set(null);
  }

  protected confirmRemove(): void {
    const hotline = this.removing();
    if (hotline === null || this.removeBusy()) {
      return;
    }
    this.removeBusy.set(true);
    this.removeProblem.set('');
    this.repository
      .remove(hotline.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.removeBusy.set(false);
          this.removing.set(null);
          this.outcome.set(this.copy.removed(hotline.name));
          this.reload();
        },
        error: (failure: unknown) => {
          this.removeBusy.set(false);
          this.removeProblem.set(
            this.listCopy.notDone(failureReason(failure) ?? this.listCopy.failed),
          );
        },
      });
  }
}
