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
import { DIRECTORY_OFFICE_REPOSITORY, OFFICE_EFFECTS, type DirectoryOffice } from '@domain/index';
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

import { DIRECTORY_COPY } from './directory.copy';
import { OfficeForm } from './office-form';

/** The app directory's offices (`DL-222`). */
export const DIRECTORY_OFFICES_TOPICS: readonly LiveTopic[] = ['offices'];

/** An archive or a restore, waiting on its confirmation. */
interface Move {
  readonly act: 'archive' | 'restore';
  readonly office: DirectoryOffice;
}

/**
 * The offices of the residents' app directory (`DL-170`): every office in use, or every archived one
 * (`DL-225`), read whole and by name; added and changed in a dialog; archived and restored behind a
 * confirmation that says what the act does and keeps a reason. Nothing deletes an office.
 *
 * An archive the server refuses because the office is still used says so in the dialog, with the
 * counts in words, and the dialog stays open.
 */
@Component({
  selector: 'app-offices-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ArchiveDialog,
    ArchiveHistory,
    ArchiveTabs,
    AsyncContent,
    DataTable,
    DatePipe,
    Icon,
    Modal,
    OfficeForm,
  ],
  templateUrl: './offices-section.html',
  styleUrl: './directory-section.scss',
})
export class OfficesSection {
  private readonly repository = inject(DIRECTORY_OFFICE_REPOSITORY);
  private readonly live = inject(LiveUpdates);
  private readonly destroyRef = inject(DestroyRef);

  /** Which list: the offices in use, or the archived ones (`?archived=true`). */
  readonly archived = input(false);

  protected readonly copy = DIRECTORY_COPY.offices;
  protected readonly listCopy = DIRECTORY_COPY.list;
  protected readonly rowCopy = ARCHIVE_COPY.row;
  protected readonly archiveEffects = OFFICE_EFFECTS.archive;
  protected readonly restoreEffects = OFFICE_EFFECTS.restore;

  private readonly generation = signal(0);
  /** Live (`DL-222`); the dialogs hold their own office through a re-read. */
  protected readonly state = toSignal(
    combineLatest([toObservable(this.archived), toObservable(this.generation)]).pipe(
      switchMap(([archived]) =>
        liveViewState(
          () => this.repository.list(archived),
          this.live.changes(DIRECTORY_OFFICES_TOPICS),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<readonly DirectoryOffice[]> },
  );
  protected readonly rows = computed(() => valueOf(this.state()) ?? []);

  private readonly nameCell =
    viewChild.required<TemplateRef<{ $implicit: DirectoryOffice }>>('nameCell');
  private readonly archivedCell =
    viewChild.required<TemplateRef<{ $implicit: DirectoryOffice }>>('archivedCell');
  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: DirectoryOffice }>>('actionCell');

  protected readonly rowKey = (office: DirectoryOffice): string => office.id;

  protected readonly columns = computed<readonly TableColumn<DirectoryOffice>[]>(() => [
    { key: 'name', header: this.copy.columnName, cell: this.nameCell() },
    { key: 'slug', header: this.copy.columnAddress, value: (office) => office.slug },
    ...(this.archived()
      ? [{ key: 'archived', header: this.copy.columnArchived, cell: this.archivedCell() }]
      : [
          {
            key: 'category',
            header: this.copy.columnCategory,
            value: (office: DirectoryOffice) => office.category ?? this.copy.noCategory,
          },
          {
            key: 'banner',
            header: this.copy.columnBanner,
            value: (office: DirectoryOffice) =>
              office.hasBanner ? this.copy.hasBanner : this.copy.noBanner,
          },
        ]),
    {
      key: 'actions',
      header: this.copy.columnActions,
      hideHeader: true,
      align: 'end',
      cell: this.actionCell(),
    },
  ]);

  /** The office in the dialog: one to change, `'new'` to add one, or nothing. */
  protected readonly editing = signal<DirectoryOffice | 'new' | null>(null);
  protected readonly moving = signal<Move | null>(null);
  protected readonly moveBusy = signal(false);
  protected readonly moveProblem = signal<string | null>(null);
  protected readonly moveProblemLines = signal<readonly string[]>([]);
  /** An archived office whose history is open. */
  protected readonly historyOf = signal<DirectoryOffice | null>(null);
  /** The live region's text: what the last act did. */
  protected readonly outcome = signal('');

  protected readonly drawerOffice = computed(() => {
    const editing = this.editing();
    return editing === 'new' ? null : editing;
  });

  /** The history of whichever office is open — in the edit dialog, or its own. */
  protected readonly historySource = computed(() => {
    const office = this.historyOf() ?? this.drawerOffice();
    return office === null ? null : this.repository.history(office.id);
  });

  protected reload(): void {
    this.generation.update((n) => n + 1);
  }

  protected add(): void {
    this.editing.set('new');
  }

  protected edit(office: DirectoryOffice): void {
    this.editing.set(office);
  }

  protected closeDrawer(): void {
    this.editing.set(null);
  }

  protected onSaved(office: DirectoryOffice): void {
    const wasNew = this.editing() === 'new';
    this.outcome.set(wasNew ? this.copy.created(office.name) : this.copy.saved(office.name));
    this.editing.set(null);
    this.reload();
  }

  protected showHistory(office: DirectoryOffice): void {
    this.historyOf.set(office);
  }

  protected closeHistory(): void {
    this.historyOf.set(null);
  }

  protected askArchive(office: DirectoryOffice): void {
    this.openMove({ act: 'archive', office });
  }

  protected askRestore(office: DirectoryOffice): void {
    this.openMove({ act: 'restore', office });
  }

  protected cancelMove(): void {
    this.moving.set(null);
  }

  /** The one place an office is archived or restored: after its confirmation, with its reason. */
  protected confirmMove(reason: string): void {
    const move = this.moving();
    if (move === null || this.moveBusy()) {
      return;
    }
    this.moveBusy.set(true);
    this.moveProblem.set(null);
    this.moveProblemLines.set([]);
    const act =
      move.act === 'archive'
        ? this.repository.archive(move.office.id, reason)
        : this.repository.restore(move.office.id, reason);
    act.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (office) => {
        this.moveBusy.set(false);
        this.moving.set(null);
        this.outcome.set(
          move.act === 'archive'
            ? this.copy.archived(office.name)
            : this.copy.restored(office.name),
        );
        this.reload();
      },
      error: (failure: unknown) => {
        this.moveBusy.set(false);
        const words = archiveRefusalWords(failure, this.copy.noun);
        this.moveProblem.set(
          words?.sentence ?? this.listCopy.notDone(failureReason(failure) ?? this.listCopy.failed),
        );
        this.moveProblemLines.set(words?.lines ?? []);
        // Somebody else moved it first: the list is read again, so the row shows where it is now.
        if (movedByOthers(failure)) {
          this.reload();
        }
      },
    });
  }

  private openMove(move: Move): void {
    this.moveProblem.set(null);
    this.moveProblemLines.set([]);
    this.moving.set(move);
  }
}
