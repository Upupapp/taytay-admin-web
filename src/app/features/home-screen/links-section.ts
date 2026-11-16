import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, switchMap } from 'rxjs';

import { LiveUpdates } from '@core/live/live-updates';
import { HOME_EFFECTS, HOME_SCREEN_REPOSITORY, type QuickLink } from '@domain/index';
import { ArchiveDialog } from '@shared/archive/archive-dialog';
import { ArchiveHistory } from '@shared/archive/archive-history';
import { ArchiveTabs } from '@shared/archive/archive-tabs';
import { ARCHIVE_COPY, archiveRefusalWords, movedByOthers } from '@shared/archive/archive.copy';
import { failureReason } from '@shared/state/failure-reason';
import { liveViewState } from '@shared/state/live-view-state';
import { LOADING, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';

import { HOME_SCREEN_TOPICS } from './banners-section';
import { HOME_SCREEN_COPY } from './home-screen.copy';
import { LinkForm } from './link-form';

/** An archive or a restore, waiting on its confirmation. */
interface Move {
  readonly act: 'archive' | 'restore';
  readonly link: QuickLink;
}

/**
 * The home screen's quick links (`DL-170`). Every link in use is shown — the API has no hidden one —
 * so archiving is the way to take one off the home screen, and the confirmation says so; an archived
 * link is kept under Archived and can be restored (`DL-225`). Nothing deletes a link.
 */
@Component({
  selector: 'app-links-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ArchiveDialog,
    ArchiveHistory,
    ArchiveTabs,
    AsyncContent,
    DataTable,
    DatePipe,
    Icon,
    LinkForm,
    Modal,
  ],
  templateUrl: './links-section.html',
  styleUrl: './home-screen.scss',
})
export class LinksSection {
  private readonly repository = inject(HOME_SCREEN_REPOSITORY);
  private readonly live = inject(LiveUpdates);
  private readonly destroyRef = inject(DestroyRef);

  /** Which list: the links in use, or the archived ones (`?archivedLinks=true`). */
  readonly archived = input(false);

  /** Something on the home screen changed, so a preview beside it is out of date. */
  readonly changed = output<void>();

  protected readonly copy = HOME_SCREEN_COPY.links;
  protected readonly common = HOME_SCREEN_COPY.common;
  protected readonly rowCopy = ARCHIVE_COPY.row;
  protected readonly archiveEffects = HOME_EFFECTS.linkArchive;
  protected readonly restoreEffects = HOME_EFFECTS.linkRestore;

  private readonly generation = signal(0);
  /** Live (`DL-222`): the list re-reads; the dialogs hold the link they were opened with. */
  protected readonly state = toSignal(
    combineLatest([toObservable(this.archived), toObservable(this.generation)]).pipe(
      switchMap(([archived]) =>
        liveViewState(
          () => this.repository.links(archived),
          this.live.changes(HOME_SCREEN_TOPICS),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<readonly QuickLink[]> },
  );
  protected readonly rows = computed(() => valueOf(this.state()) ?? []);

  private readonly archivedCell =
    viewChild.required<TemplateRef<{ $implicit: QuickLink }>>('archivedCell');
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
    ...(this.archived()
      ? [{ key: 'archived', header: this.copy.columnArchived, cell: this.archivedCell() }]
      : []),
    {
      key: 'actions',
      header: this.copy.columnActions,
      hideHeader: true,
      align: 'end',
      cell: this.actionCell(),
    },
  ]);

  protected readonly editing = signal<QuickLink | 'new' | null>(null);
  protected readonly moving = signal<Move | null>(null);
  protected readonly moveBusy = signal(false);
  protected readonly moveProblem = signal<string | null>(null);
  protected readonly historyOf = signal<QuickLink | null>(null);
  protected readonly outcome = signal('');

  protected readonly drawerLink = computed(() => {
    const editing = this.editing();
    return editing === 'new' ? null : editing;
  });

  /** The history of whichever link is open — in the edit dialog, or its own. */
  protected readonly historySource = computed(() => {
    const link = this.historyOf() ?? this.drawerLink();
    return link === null ? null : this.repository.linkHistory(link.id);
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

  protected showHistory(link: QuickLink): void {
    this.historyOf.set(link);
  }

  protected closeHistory(): void {
    this.historyOf.set(null);
  }

  protected askArchive(link: QuickLink): void {
    this.moveProblem.set(null);
    this.moving.set({ act: 'archive', link });
  }

  protected askRestore(link: QuickLink): void {
    this.moveProblem.set(null);
    this.moving.set({ act: 'restore', link });
  }

  protected cancelMove(): void {
    this.moving.set(null);
  }

  /** The one place a link is archived or restored: after its confirmation, with its reason. */
  protected confirmMove(reason: string): void {
    const move = this.moving();
    if (move === null || this.moveBusy()) {
      return;
    }
    this.moveBusy.set(true);
    this.moveProblem.set(null);
    const act =
      move.act === 'archive'
        ? this.repository.archiveLink(move.link.id, reason)
        : this.repository.restoreLink(move.link.id, reason);
    act.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (link) => {
        this.moveBusy.set(false);
        this.moving.set(null);
        this.outcome.set(
          move.act === 'archive' ? this.copy.archived(link.label) : this.copy.restored(link.label),
        );
        this.reload();
        this.changed.emit();
      },
      error: (failure: unknown) => {
        this.moveBusy.set(false);
        this.moveProblem.set(
          archiveRefusalWords(failure, HOME_SCREEN_COPY.linkForm.noun)?.sentence ??
            this.common.notDone(failureReason(failure) ?? this.common.failed),
        );
        if (movedByOthers(failure)) {
          this.reload();
          this.changed.emit();
        }
      },
    });
  }
}
