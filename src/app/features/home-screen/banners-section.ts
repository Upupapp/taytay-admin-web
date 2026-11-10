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

import {
  APP_VISIBILITY_CATALOG,
  BANNER_NO_DESCRIPTION,
  HOME_EFFECTS,
  HOME_SCREEN_REPOSITORY,
  visibilityOf,
  type HomeBanner,
} from '@domain/index';
import { failureReason } from '@shared/state/failure-reason';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Icon } from '@shared/ui/icon/icon';
import { Modal } from '@shared/ui/modal/modal';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { BannerForm } from './banner-form';
import { HOME_SCREEN_COPY } from './home-screen.copy';

/**
 * The home screen's banners (`DL-170`): every banner, shown and hidden, in the app's order; added
 * and changed in a centred dialog; deleted behind a confirmation that offers hiding instead. The
 * section says, under its title, that the app has no description of a banner's image to give.
 */
@Component({
  selector: 'app-banners-section',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, BannerForm, DataTable, Icon, Modal, StatusBadge],
  templateUrl: './banners-section.html',
  styleUrl: './home-screen.scss',
})
export class BannersSection {
  private readonly repository = inject(HOME_SCREEN_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  /** Something on the home screen changed, so a preview beside it is out of date. */
  readonly changed = output<void>();

  protected readonly copy = HOME_SCREEN_COPY.banners;
  protected readonly common = HOME_SCREEN_COPY.common;
  protected readonly noDescription = BANNER_NO_DESCRIPTION;
  protected readonly removeEffects = HOME_EFFECTS.bannerRemove;
  protected readonly visibility = APP_VISIBILITY_CATALOG;
  protected readonly visibilityOf = visibilityOf;

  private readonly generation = signal(0);
  protected readonly state = toSignal(
    toObservable(this.generation).pipe(switchMap(() => toViewState(this.repository.banners()))),
    { initialValue: LOADING as ViewState<readonly HomeBanner[]> },
  );
  protected readonly rows = computed(() => valueOf(this.state()) ?? []);

  private readonly titleCell =
    viewChild.required<TemplateRef<{ $implicit: HomeBanner }>>('titleCell');
  private readonly shownCell =
    viewChild.required<TemplateRef<{ $implicit: HomeBanner }>>('shownCell');
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
    { key: 'shown', header: this.copy.columnShown, cell: this.shownCell() },
    {
      key: 'actions',
      header: this.copy.columnActions,
      hideHeader: true,
      align: 'end',
      cell: this.actionCell(),
    },
  ]);

  protected readonly editing = signal<HomeBanner | 'new' | null>(null);
  protected readonly removing = signal<HomeBanner | null>(null);
  protected readonly removeBusy = signal(false);
  protected readonly removeProblem = signal('');
  protected readonly outcome = signal('');

  protected readonly drawerBanner = computed(() => {
    const editing = this.editing();
    return editing === 'new' ? null : editing;
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

  protected askRemove(banner: HomeBanner): void {
    this.removeProblem.set('');
    this.removing.set(banner);
  }

  protected cancelRemove(): void {
    this.removing.set(null);
  }

  protected confirmRemove(): void {
    const banner = this.removing();
    if (banner === null || this.removeBusy()) {
      return;
    }
    this.removeBusy.set(true);
    this.removeProblem.set('');
    this.repository
      .removeBanner(banner.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.removeBusy.set(false);
          this.removing.set(null);
          this.outcome.set(this.copy.removed(banner.title));
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
