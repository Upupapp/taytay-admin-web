import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  output,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

import { HOME_EFFECTS, HOME_SCREEN_REPOSITORY, type QuickLink } from '@domain/index';
import { failureReason } from '@shared/state/failure-reason';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Drawer } from '@shared/ui/drawer/drawer';
import { Modal } from '@shared/ui/modal/modal';

import { HOME_SCREEN_COPY } from './home-screen.copy';
import { LinkForm } from './link-form';

/**
 * The home screen's quick links (`DL-170`). Every link is shown — the API has no hidden one — so the
 * only way to take one off the home screen is to delete it, and the confirmation says so.
 */
@Component({
  selector: 'app-links-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DataTable, Drawer, LinkForm, Modal],
  templateUrl: './links-section.html',
  styleUrl: './home-screen.scss',
})
export class LinksSection {
  private readonly repository = inject(HOME_SCREEN_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  /** Something on the home screen changed, so a preview beside it is out of date. */
  readonly changed = output<void>();

  protected readonly copy = HOME_SCREEN_COPY.links;
  protected readonly common = HOME_SCREEN_COPY.common;
  protected readonly removeEffects = HOME_EFFECTS.linkRemove;

  private readonly generation = signal(0);
  protected readonly state = toSignal(
    toObservable(this.generation).pipe(switchMap(() => toViewState(this.repository.links()))),
    { initialValue: LOADING as ViewState<readonly QuickLink[]> },
  );
  protected readonly rows = computed(() => valueOf(this.state()) ?? []);

  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: QuickLink }>>('actionCell');

  protected readonly rowKey = (link: QuickLink): string => link.id;

  protected readonly columns = computed<readonly TableColumn<QuickLink>[]>(() => [
    {
      key: 'order',
      header: this.copy.columnOrder,
      align: 'end',
      value: (link) => String(link.sortOrder),
    },
    { key: 'label', header: this.copy.columnLabel, value: (link) => link.label },
    { key: 'href', header: this.copy.columnHref, value: (link) => link.href },
    {
      key: 'actions',
      header: this.copy.columnActions,
      hideHeader: true,
      align: 'end',
      cell: this.actionCell(),
    },
  ]);

  protected readonly editing = signal<QuickLink | 'new' | null>(null);
  protected readonly removing = signal<QuickLink | null>(null);
  protected readonly removeBusy = signal(false);
  protected readonly removeProblem = signal('');
  protected readonly outcome = signal('');

  protected readonly drawerLink = computed(() => {
    const editing = this.editing();
    return editing === 'new' ? null : editing;
  });

  protected reload(): void {
    this.generation.update((n) => n + 1);
  }

  protected add(): void {
    this.editing.set('new');
  }

  protected edit(link: QuickLink): void {
    this.editing.set(link);
  }

  protected closeDrawer(): void {
    this.editing.set(null);
  }

  protected onSaved(link: QuickLink): void {
    this.outcome.set(
      this.editing() === 'new' ? this.copy.created(link.label) : this.copy.saved(link.label),
    );
    this.editing.set(null);
    this.reload();
    this.changed.emit();
  }

  protected askRemove(link: QuickLink): void {
    this.removeProblem.set('');
    this.removing.set(link);
  }

  protected cancelRemove(): void {
    this.removing.set(null);
  }

  protected confirmRemove(): void {
    const link = this.removing();
    if (link === null || this.removeBusy()) {
      return;
    }
    this.removeBusy.set(true);
    this.removeProblem.set('');
    this.repository
      .removeLink(link.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.removeBusy.set(false);
          this.removing.set(null);
          this.outcome.set(this.copy.removed(link.label));
          this.reload();
          this.changed.emit();
        },
        error: (failure: unknown) => {
          this.removeBusy.set(false);
          this.removeProblem.set(this.common.notDone(failureReason(failure) ?? this.common.failed));
        },
      });
  }
}
