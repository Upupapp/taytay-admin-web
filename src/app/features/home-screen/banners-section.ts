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

import type { LiveTopic } from '@core/live/change-feed';
import { LiveUpdates } from '@core/live/live-updates';
import {
  APP_VISIBILITY_CATALOG,
  BANNER_NO_DESCRIPTION,
  HOME_EFFECTS,
  HOME_SCREEN_REPOSITORY,
  visibilityOf,
  type HomeBanner,
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

import { BannerForm } from './banner-form';
import { HOME_SCREEN_COPY } from './home-screen.copy';

/** The home screen's banners and links feed `home` (`DL-222`). */
export const HOME_SCREEN_TOPICS: readonly LiveTopic[] = ['home'];

/** An archive or a restore, waiting on its confirmation. */
interface Move {
  readonly act: 'archive' | 'restore';
  readonly banner: HomeBanner;
}

/**
 * The home screen's banners (`DL-170`): every banner in use, shown and hidden, in the app's order —
 * or every archived one (`DL-225`); added and changed in a centred dialog; archived and restored
 * behind a confirmation that says what the act does and keeps a reason. Nothing deletes a banner.
 * The section says, under its title, that the app has no description of a banner's image to give.
 */
@Component({
  selector: 'app-banners-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ArchiveDialog,
    ArchiveHistory,
    ArchiveTabs,
    AsyncContent,
    BannerForm,
    DataTable,
    DatePipe,
    Icon,
    Modal,
    StatusBadge,
  ],
  templateUrl: './banners-section.html',
  styleUrl: './home-screen.scss',
})
export class BannersSection {
  private readonly repository = inject(HOME_SCREEN_REPOSITORY);
  private readonly live = inject(LiveUpdates);
  private readonly destroyRef = inject(DestroyRef);

  /** Which list: the banners in use, or the archived ones (`?archivedBanners=true`). */
  readonly archived = input(false);

  /** Something on the home screen changed, so a preview beside it is out of date. */
  readonly changed = output<void>();

  protected readonly copy = HOME_SCREEN_COPY.banners;
  protected readonly common = HOME_SCREEN_COPY.common;
  protected readonly rowCopy = ARCHIVE_COPY.row;
  protected readonly noDescription = BANNER_NO_DESCRIPTION;
  protected readonly archiveEffects = HOME_EFFECTS.bannerArchive;
  protected readonly restoreEffects = HOME_EFFECTS.bannerRestore;
  protected readonly visibility = APP_VISIBILITY_CATALOG;
  protected readonly visibilityOf = visibilityOf;

  private readonly generation = signal(0);
  /** Live (`DL-222`): the list re-reads; the dialogs hold the banner they were opened with. */
  protected readonly state = toSignal(
    combineLatest([toObservable(this.archived), toObservable(this.generation)]).pipe(
      switchMap(([archived]) =>
        liveViewState(
          () => this.repository.banners(archived),
          this.live.changes(HOME_SCREEN_TOPICS),
          this.live,
        ),
      ),
    ),
    { initialValue: LOADING as ViewState<readonly HomeBanner[]> },
  );
  protected readonly rows = computed(() => valueOf(this.state()) ?? []);

  private readonly titleCell =
    viewChild.required<TemplateRef<{ $implicit: HomeBanner }>>('titleCell');
  private readonly shownCell =
    viewChild.required<TemplateRef<{ $implicit: HomeBanner }>>('shownCell');
  private readonly archivedCell =
    viewChild.required<TemplateRef<{ $implicit: HomeBanner }>>('archivedCell');
  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: HomeBanner }>>('actionCell');

  protected readonly rowKey = (banner: HomeBanner): string => banner.id;

  protected readonly columns = computed<readonly TableColumn<HomeBanner>[]>(() => [
    {
      key: 'order',
      header: this.copy.columnOrder,
      align: 'end',
      value: (banner) => String(banner.sortOrder),
    },
    { key: 'title', header: this.copy.columnTitle, cell: this.titleCell() },
    {
      key: 'image',
      header: this.copy.columnImage,
      value: (banner) => (banner.mediaId === null ? this.copy.noImage : this.copy.hasImage),
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

  protected readonly editing = signal<HomeBanner | 'new' | null>(null);
  protected readonly moving = signal<Move | null>(null);
  protected readonly moveBusy = signal(false);
  protected readonly moveProblem = signal<string | null>(null);
  protected readonly historyOf = signal<HomeBanner | null>(null);
  protected readonly outcome = signal('');

  protected readonly drawerBanner = computed(() => {
    const editing = this.editing();
    return editing === 'new' ? null : editing;
  });

  /** The history of whichever banner is open — in the edit dialog, or its own. */
  protected readonly historySource = computed(() => {
    const banner = this.historyOf() ?? this.drawerBanner();
    return banner === null ? null : this.repository.bannerHistory(banner.id);
  });

  protected reload(): void {
    this.generation.update((n) => n + 1);
  }

  protected add(): void {
    this.editing.set('new');
  }

  protected edit(banner: HomeBanner): void {
    this.editing.set(banner);
  }

  protected closeDrawer(): void {
    this.editing.set(null);
  }

  protected onSaved(banner: HomeBanner): void {
    this.outcome.set(
      this.editing() === 'new' ? this.copy.created(banner.title) : this.copy.saved(banner.title),
    );
    this.editing.set(null);
    this.reload();
    this.changed.emit();
  }

  protected showHistory(banner: HomeBanner): void {
    this.historyOf.set(banner);
  }

  protected closeHistory(): void {
    this.historyOf.set(null);
  }

  protected askArchive(banner: HomeBanner): void {
    this.moveProblem.set(null);
    this.moving.set({ act: 'archive', banner });
  }

  protected askRestore(banner: HomeBanner): void {
    this.moveProblem.set(null);
    this.moving.set({ act: 'restore', banner });
  }

  protected cancelMove(): void {
    this.moving.set(null);
  }

  /** The one place a banner is archived or restored: after its confirmation, with its reason. */
  protected confirmMove(reason: string): void {
    const move = this.moving();
    if (move === null || this.moveBusy()) {
      return;
    }
    this.moveBusy.set(true);
    this.moveProblem.set(null);
    const act =
      move.act === 'archive'
        ? this.repository.archiveBanner(move.banner.id, reason)
        : this.repository.restoreBanner(move.banner.id, reason);
    act.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (banner) => {
        this.moveBusy.set(false);
        this.moving.set(null);
        this.outcome.set(
          move.act === 'archive'
            ? this.copy.archived(banner.title)
            : this.copy.restored(banner.title),
        );
        this.reload();
        this.changed.emit();
      },
      error: (failure: unknown) => {
        this.moveBusy.set(false);
        this.moveProblem.set(
          archiveRefusalWords(failure, HOME_SCREEN_COPY.bannerForm.noun)?.sentence ??
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
