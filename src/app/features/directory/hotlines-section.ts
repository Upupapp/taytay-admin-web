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
  activeCommandCenter,
  APP_VISIBILITY_CATALOG,
  COMMAND_CENTER_EFFECTS,
  HOTLINE_EFFECTS,
  hotlineKindLabel,
  linesWithoutKind,
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
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { DIRECTORY_COPY } from './directory.copy';
import { HotlineForm } from './hotline-form';

/**
 * Hotlines (`DL-170`): every line, shown and hidden, in the order the app lists them. The API answers
 * the list whole, up to a cap, with no word of more — so a list that reaches the cap says there may
 * be lines neither this screen nor the app shows, rather than presenting itself as the whole.
 *
 * Each line's kind is a column of words (`DL-217`), and the section says which line is the command
 * center — or, plainly, that none is: after the API's backfill no line is one until the office marks
 * it, and the app then has no line of the office's own to show for an emergency.
 */
@Component({
  selector: 'app-hotlines-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DataTable, HotlineForm, Icon, Modal, StatusBadge],
  templateUrl: './hotlines-section.html',
  styleUrl: './directory-section.scss',
})
export class HotlinesSection {
  private readonly repository = inject(HOTLINE_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly copy = DIRECTORY_COPY.hotlines;
  protected readonly listCopy = DIRECTORY_COPY.list;
  protected readonly visibility = APP_VISIBILITY_CATALOG;
  protected readonly visibilityOf = visibilityOf;
  protected readonly cap = HOTLINE_LIST_CAP;

  private readonly generation = signal(0);
  protected readonly listing = toSignal(
    toObservable(this.generation).pipe(switchMap(() => toViewState(this.repository.list()))),
    { initialValue: LOADING as ViewState<HotlineListing> },
  );
  protected readonly rows = computed(() => valueOf(this.listing())?.hotlines ?? []);
  /** The active command center in the list as read, or `null` when no line is marked as one. */
  protected readonly commandCenter = computed(() => activeCommandCenter(this.rows()));
  /** Lines the server sent with no kind (`DL-220`): shown as not set, never as `other`. */
  protected readonly withoutKind = computed(() => linesWithoutKind(this.rows()));
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
    {
      key: 'kind',
      header: this.copy.columnKind,
      value: (hotline) => hotlineKindLabel(hotline.kind),
    },
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
  /** Deleting the command center leaves the app without one, and says so first (`DL-217`). */
  protected readonly removeEffects = computed<readonly string[]>(() => {
    const hotline = this.removing();
    return hotline !== null && hotline.id === this.commandCenter()?.id
      ? [...COMMAND_CENTER_EFFECTS.leaves, ...HOTLINE_EFFECTS.remove]
      : HOTLINE_EFFECTS.remove;
  });
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
