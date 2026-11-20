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
import { catchError, combineLatest, of, switchMap } from 'rxjs';

import { NotConnected } from '@core/access/not-connected';
import { ServedPorts } from '@core/access/served-ports';
import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import {
  DIRECTORY_OFFICE_REPOSITORY,
  listingOf,
  officeLabel,
  OFFICE_REPOSITORY,
  PROGRAM_REPOSITORY,
  SERVICE_EFFECTS,
  SERVICE_LISTING_CATALOG,
  TULONG_SERVICE_REPOSITORY,
  type OfficeId,
  type TulongService,
  type AssistanceProgram,
} from '@domain/index';
import { ArchiveDialog } from '@shared/archive/archive-dialog';
import { ArchiveHistory } from '@shared/archive/archive-history';
import { ArchiveTabs } from '@shared/archive/archive-tabs';
import { ARCHIVE_COPY, archiveRefusalWords, movedByOthers } from '@shared/archive/archive.copy';
import { officeDirectory } from '@shared/offices/office-directory';
import { DisplayDatePipe } from '@shared/pipes/display-date.pipe';
import { failureReason } from '@shared/state/failure-reason';
import { liveViewState } from '@shared/state/live-view-state';
import { LOADING, ready, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { DIRECTORY_COPY } from './directory.copy';
import { ServiceForm } from './service-form';

/** The app's Tulong pages (`DL-222`). */
export const DIRECTORY_SERVICES_TOPICS: readonly LiveTopic[] = ['services'];

/** An archive or a restore, waiting on its confirmation. */
interface Move {
  readonly act: 'archive' | 'restore';
  readonly service: TulongService;
}

/**
 * Tulong pages (`DL-170`): every page in use — hidden from the catalogue or not — or every archived
 * one, read whole and by name from the administrator's own list (`DL-225`). Before it, the screen
 * read the residents' catalogue, which leaves a hidden page out, and offered "Open a page by its
 * address" as the only way back to one; the administrator's list holds them, so that is gone.
 *
 * A page is archived and restored behind a confirmation that says what the act does and keeps a
 * reason; a restore is refused while the page's office is archived, and says so in plain words.
 */
@Component({
  selector: 'app-services-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    NotConnected,
    ArchiveDialog,
    ArchiveHistory,
    ArchiveTabs,
    AsyncContent,
    DataTable,
    DisplayDatePipe,
    Icon,
    Modal,
    ServiceForm,
    StatusBadge,
  ],
  templateUrl: './services-section.html',
  styleUrl: './directory-section.scss',
})
export class ServicesSection {
  private readonly repository = inject(TULONG_SERVICE_REPOSITORY);
  private readonly live = inject(LiveUpdates);
  private readonly destroyRef = inject(DestroyRef);

  /** Which list: the pages in use, or the archived ones (`?archived=true`). */
  readonly archived = input(false);

  protected readonly copy = DIRECTORY_COPY.services;
  protected readonly listCopy = DIRECTORY_COPY.list;
  protected readonly rowCopy = ARCHIVE_COPY.row;
  protected readonly archiveEffects = SERVICE_EFFECTS.archive;
  protected readonly restoreEffects = SERVICE_EFFECTS.restore;
  protected readonly listingCatalog = SERVICE_LISTING_CATALOG;
  protected readonly listingOf = listingOf;
  /** The offices in use: the form's picker, and the names in the list (`DL-161`). */
  protected readonly offices = officeDirectory(inject(OFFICE_REPOSITORY).list());
  /**
   * The active programmes, read whole, for the form's "applies to" picker (`DL-228`). Read once
   * with the section: a picker that changed under somebody choosing would move what they chose.
   */
  protected readonly servesPrograms = inject(ServedPorts).serves('program');
  protected readonly programs = toSignal(
    this.servesPrograms
      ? toViewState(inject(PROGRAM_REPOSITORY).listActive())
      : of(ready<readonly AssistanceProgram[]>([])),
    { initialValue: LOADING as ViewState<readonly AssistanceProgram[]> },
  );

  /**
   * The archived offices' names, for a page that names one: context, not the record — when they
   * cannot be read, such a page says only that its office is archived.
   */
  private readonly archivedOffices = toSignal(
    inject(DIRECTORY_OFFICE_REPOSITORY)
      .list(true)
      .pipe(catchError(() => of([]))),
    { initialValue: [] },
  );
  private readonly archivedOfficeNames = computed(
    () => new Map(this.archivedOffices().map((office) => [office.id, officeLabel(office)])),
  );

  private readonly generation = signal(0);
  /** Live (`DL-222`); the dialogs keep their own state. */
  protected readonly state = toSignal(
    combineLatest([toObservable(this.archived), toObservable(this.generation)]).pipe(
      switchMap(([archived]) =>
        liveViewState(
          () => this.repository.list(archived),
          this.live.changes(DIRECTORY_SERVICES_TOPICS),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<readonly TulongService[]> },
  );
  protected readonly rows = computed(() => valueOf(this.state()) ?? []);

  private readonly nameCell =
    viewChild.required<TemplateRef<{ $implicit: TulongService }>>('nameCell');
  private readonly listingCell =
    viewChild.required<TemplateRef<{ $implicit: TulongService }>>('listingCell');
  private readonly archivedCell =
    viewChild.required<TemplateRef<{ $implicit: TulongService }>>('archivedCell');
  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: TulongService }>>('actionCell');

  protected readonly rowKey = (service: TulongService): string => service.id;

  protected readonly columns = computed<readonly TableColumn<TulongService>[]>(() => [
    { key: 'name', header: this.copy.columnName, cell: this.nameCell() },
    ...(this.archived()
      ? [{ key: 'archived', header: this.copy.columnArchived, cell: this.archivedCell() }]
      : [
          { key: 'listing', header: this.copy.columnListing, cell: this.listingCell() },
          {
            key: 'home',
            header: this.copy.columnHome,
            value: (service: TulongService) =>
              service.featured ? this.copy.featured : this.copy.notFeatured,
            nowrap: true,
          },
        ]),
    {
      key: 'office',
      header: this.copy.columnOffice,
      value: (service) =>
        service.officeId === null ? this.copy.noOffice : this.officeName(service.officeId),
    },
    {
      key: 'actions',
      header: this.copy.columnActions,
      hideHeader: true,
      align: 'end',
      cell: this.actionCell(),
    },
  ]);

  protected readonly editing = signal<TulongService | 'new' | null>(null);
  protected readonly moving = signal<Move | null>(null);
  protected readonly moveBusy = signal(false);
  protected readonly moveProblem = signal<string | null>(null);
  protected readonly moveProblemLines = signal<readonly string[]>([]);
  protected readonly historyOf = signal<TulongService | null>(null);
  protected readonly outcome = signal('');

  protected readonly drawerService = computed(() => {
    const editing = this.editing();
    return editing === 'new' ? null : editing;
  });

  /** The history of whichever page is open — in the edit dialog, or its own. */
  protected readonly historySource = computed(() => {
    const service = this.historyOf() ?? this.drawerService();
    return service === null ? null : this.repository.history(service.id);
  });

  protected reload(): void {
    this.generation.update((n) => n + 1);
  }

  protected add(): void {
    this.editing.set('new');
  }

  protected edit(service: TulongService): void {
    this.editing.set(service);
  }

  protected closeDrawer(): void {
    this.editing.set(null);
  }

  /**
   * A new page stays open in the dialog, as the server answered it, so its picture can be added and
   * it can be featured — the two acts that need it to exist.
   */
  protected onSaved(service: TulongService): void {
    const previous = this.editing();
    this.outcome.set(
      previous === 'new'
        ? this.copy.created(service.name)
        : previous !== null && previous.hasImage !== service.hasImage
          ? this.copy.imageSaved(service.name)
          : this.copy.saved(service.name),
    );
    this.editing.set(service);
    this.reload();
  }

  protected showHistory(service: TulongService): void {
    this.historyOf.set(service);
  }

  protected closeHistory(): void {
    this.historyOf.set(null);
  }

  protected askArchive(service: TulongService): void {
    this.openMove({ act: 'archive', service });
  }

  protected askRestore(service: TulongService): void {
    this.openMove({ act: 'restore', service });
  }

  protected cancelMove(): void {
    this.moving.set(null);
  }

  /** The one place a page is archived or restored: after its confirmation, with its reason. */
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
        ? this.repository.archive(move.service.id, reason)
        : this.repository.restore(move.service.id, reason);
    act.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (service) => {
        this.moveBusy.set(false);
        this.moving.set(null);
        this.outcome.set(
          move.act === 'archive'
            ? this.copy.archived(service.name)
            : this.copy.restored(service.name),
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
        if (movedByOthers(failure)) {
          this.reload();
        }
      },
    });
  }

  /**
   * An office in use by its name; an archived one by its name and the word, when the archived
   * offices could be read — otherwise the directory says only that it is archived (`DL-225`).
   */
  private officeName(id: OfficeId): string {
    const archived = this.archivedOfficeNames().get(id);
    return archived === undefined
      ? this.offices.name(id, id)
      : this.copy.archivedOfficeNamed(archived);
  }

  private openMove(move: Move): void {
    this.moveProblem.set(null);
    this.moveProblemLines.set([]);
    this.moving.set(move);
  }
}
