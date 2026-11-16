import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
  TemplateRef,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { combineLatest, switchMap } from 'rxjs';

import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import {
  activeCommandCenter,
  APP_VISIBILITY_CATALOG,
  COMMAND_CENTER_EFFECTS,
  HOTLINE_EFFECTS,
  hotlineKindLabel,
  linesWithoutKind,
  HOTLINE_REPOSITORY,
  isCommandCenterTaken,
  visibilityOf,
  type Hotline,
} from '@domain/index';
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
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { DIRECTORY_COPY } from './directory.copy';
import { HotlineForm } from './hotline-form';

/** The app's hotlines, read whole (`DL-222`). */
export const DIRECTORY_HOTLINES_TOPICS: readonly LiveTopic[] = ['hotlines'];

/** An archive or a restore, waiting on its confirmation. */
interface Move {
  readonly act: 'archive' | 'restore';
  readonly hotline: Hotline;
}

/**
 * Hotlines (`DL-170`): every line in use, shown and hidden, in the order the app lists them — or
 * every archived one (`DL-225`). The API answers each list whole, or refuses past its cap rather than
 * cutting it short (`ca71f23`), so a list shown is the whole of it.
 *
 * Each line's kind is a column of words (`DL-217`), and the section says which line is the command
 * center — or, plainly, that none is: after the API's backfill no line is one until the office marks
 * it, and the app then has no line of the office's own to show for an emergency.
 */
@Component({
  selector: 'app-hotlines-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ArchiveDialog,
    ArchiveHistory,
    ArchiveTabs,
    AsyncContent,
    DataTable,
    DatePipe,
    HotlineForm,
    Icon,
    Modal,
    StatusBadge,
  ],
  templateUrl: './hotlines-section.html',
  styleUrl: './directory-section.scss',
})
export class HotlinesSection {
  private readonly repository = inject(HOTLINE_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);
  private readonly live = inject(LiveUpdates);

  /** Which list: the lines in use, or the archived ones (`?archived=true`). */
  readonly archived = input(false);

  protected readonly copy = DIRECTORY_COPY.hotlines;
  protected readonly listCopy = DIRECTORY_COPY.list;
  protected readonly rowCopy = ARCHIVE_COPY.row;
  protected readonly visibility = APP_VISIBILITY_CATALOG;
  protected readonly visibilityOf = visibilityOf;
  protected readonly restoreEffects = HOTLINE_EFFECTS.restore;

  private readonly generation = signal(0);
  /**
   * Read again quietly when a line changes (`DL-222`). The dialogs hold the line they were opened
   * with, so a re-read never closes them or refills a form.
   */
  protected readonly listing = toSignal(
    combineLatest([toObservable(this.archived), toObservable(this.generation)]).pipe(
      switchMap(([archived]) =>
        liveViewState(
          () => this.repository.list(archived),
          this.live.changes(DIRECTORY_HOTLINES_TOPICS),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<readonly Hotline[]> },
  );
  protected readonly rows = computed(() => valueOf(this.listing()) ?? []);
  /**
   * The active command center among the lines in use, or `null` when none is marked as one. An
   * archived line holds no role (`DL-225`), so the archived list has none to say.
   */
  protected readonly commandCenter = computed(() =>
    this.archived() ? null : activeCommandCenter(this.rows()),
  );
  /** Lines the server sent with no kind (`DL-220`): shown as not set, never as `other`. */
  protected readonly withoutKind = computed(() => linesWithoutKind(this.rows()));

  private readonly shownCell = viewChild.required<TemplateRef<{ $implicit: Hotline }>>('shownCell');
  private readonly archivedCell =
    viewChild.required<TemplateRef<{ $implicit: Hotline }>>('archivedCell');
  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: Hotline }>>('actionCell');

  protected readonly rowKey = (hotline: Hotline): string => hotline.id;

  protected readonly columns = computed<readonly TableColumn<Hotline>[]>(() => [
    { key: 'name', header: this.copy.columnName, value: (hotline) => hotline.name },
    {
      key: 'number',
      header: this.copy.columnNumber,
      value: (hotline) => hotline.number,
      nowrap: true,
    },
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
    this.archived()
      ? { key: 'archived', header: this.copy.columnArchived, cell: this.archivedCell() }
      : { key: 'shown', header: this.copy.columnShown, cell: this.shownCell() },
    {
      key: 'actions',
      header: this.copy.columnActions,
      hideHeader: true,
      align: 'end',
      cell: this.actionCell(),
    },
  ]);

  protected readonly editing = signal<Hotline | 'new' | null>(null);
  protected readonly moving = signal<Move | null>(null);
  /** Archiving the command center leaves the app without one, and says so first (`DL-217`). */
  protected readonly archiveEffects = computed<readonly string[]>(() => {
    const move = this.moving();
    return move !== null && move.hotline.id === this.commandCenter()?.id
      ? [...COMMAND_CENTER_EFFECTS.leaves, ...HOTLINE_EFFECTS.archive]
      : HOTLINE_EFFECTS.archive;
  });
  protected readonly moveBusy = signal(false);
  protected readonly moveProblem = signal<string | null>(null);
  protected readonly historyOf = signal<Hotline | null>(null);
  protected readonly outcome = signal('');

  protected readonly drawerHotline = computed(() => {
    const editing = this.editing();
    return editing === 'new' ? null : editing;
  });

  /** The history of whichever line is open — in the edit dialog, or its own. */
  protected readonly historySource = computed(() => {
    const hotline = this.historyOf() ?? this.drawerHotline();
    return hotline === null ? null : this.repository.history(hotline.id);
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

  protected showHistory(hotline: Hotline): void {
    this.historyOf.set(hotline);
  }

  protected closeHistory(): void {
    this.historyOf.set(null);
  }

  protected askArchive(hotline: Hotline): void {
    this.moveProblem.set(null);
    this.moving.set({ act: 'archive', hotline });
  }

  protected askRestore(hotline: Hotline): void {
    this.moveProblem.set(null);
    this.moving.set({ act: 'restore', hotline });
  }

  protected cancelMove(): void {
    this.moving.set(null);
  }

  /** The one place a line is archived or restored: after its confirmation, with its reason. */
  protected confirmMove(reason: string): void {
    const move = this.moving();
    if (move === null || this.moveBusy()) {
      return;
    }
    this.moveBusy.set(true);
    this.moveProblem.set(null);
    const act =
      move.act === 'archive'
        ? this.repository.archive(move.hotline.id, reason)
        : this.repository.restore(move.hotline.id, reason);
    act.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (hotline) => {
        this.moveBusy.set(false);
        this.moving.set(null);
        this.outcome.set(
          move.act === 'archive'
            ? this.copy.archived(hotline.name)
            : this.copy.restored(hotline.name),
        );
        this.reload();
      },
      error: (failure: unknown) => {
        this.moveBusy.set(false);
        // A restore that would make a second command center says which line to change first.
        this.moveProblem.set(
          isCommandCenterTaken(failure)
            ? DIRECTORY_COPY.hotlineForm.kindRefused(failure.message)
            : (archiveRefusalWords(failure, this.copy.noun)?.sentence ??
                this.listCopy.notDone(failureReason(failure) ?? this.listCopy.failed)),
        );
        if (movedByOthers(failure)) {
          this.reload();
        }
      },
    });
  }
}
