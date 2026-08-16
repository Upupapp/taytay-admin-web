import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';

import { PermissionService } from '@core/access/permission.service';
import {
  NEWSFEED_REPOSITORY,
  POST_CATEGORY_LABELS,
  POST_STATUS_CATALOG,
  POST_VIEW_LABELS,
  countsByView,
  type Post,
  type PostCategory,
  type PostView,
} from '@domain/index';
import { debouncedTerm } from '@shared/state/debounced';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { StatusBadge } from '@shared/ui/status-badge/status-badge';

import { NEWSFEED_COPY } from './newsfeed.copy';

/**
 * The post list.
 *
 * Views rather than a status filter, because the six the command names are how
 * an editor actually thinks — "what have I got in drafts" is a different
 * question from "show me status = draft", even though the answer is the same
 * rows.
 *
 * Pinned posts sort first, which is what a pin is for; a pinned advisory that
 * appears below a routine update is a pin that does nothing.
 */
@Component({
  selector: 'app-post-list-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, DatePipe, PageHeader, RouterLink, StatusBadge],
  templateUrl: './post-list-page.html',
  styleUrl: './post-list-page.scss',
})
export class PostListPage {
  private readonly repository = inject(NEWSFEED_REPOSITORY);
  private readonly permissions = inject(PermissionService);

  protected readonly copy = NEWSFEED_COPY.list;
  protected readonly statusCatalog = POST_STATUS_CATALOG;
  protected readonly views = Object.keys(POST_VIEW_LABELS) as PostView[];
  protected readonly categories = Object.keys(POST_CATEGORY_LABELS) as PostCategory[];

  protected readonly view = signal<PostView>('all');
  protected readonly search = signal('');
  private readonly settledSearch = debouncedTerm(this.search);
  protected readonly category = signal<PostCategory | null>(null);

  protected readonly canCompose = computed(() => this.permissions.has('newsfeed.create'));

  private readonly query = computed(() => ({
    view: this.view(),
    filter: {
      ...(this.settledSearch() ? { search: this.settledSearch() } : {}),
      ...(this.category() ? { category: this.category() as PostCategory } : {}),
    },
  }));

  protected readonly state = toSignal(
    toObservable(this.query).pipe(
      switchMap((query) => toViewState(this.repository.list(query.view, query.filter))),
    ),
    { initialValue: LOADING as ViewState<readonly Post[]> },
  );

  protected readonly posts = computed<readonly Post[]>(() => valueOf(this.state()) ?? []);
  protected readonly hasAny = computed(() => this.posts().length > 0);
  protected readonly hasFilters = computed(
    () => this.search().length > 0 || this.category() !== null,
  );

  /** Counts for the tabs, taken from the unfiltered set the adapter returned. */
  private readonly allState = toSignal(toViewState(this.repository.list('all', {})), {
    initialValue: LOADING as ViewState<readonly Post[]>,
  });

  protected readonly counts = computed(() => countsByView(valueOf(this.allState()) ?? []));

  protected viewLabel(view: PostView): string {
    return POST_VIEW_LABELS[view];
  }

  protected categoryLabel(category: PostCategory): string {
    return POST_CATEGORY_LABELS[category];
  }

  protected onView(view: PostView): void {
    this.view.set(view);
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected onCategory(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.category.set(value === '' ? null : (value as PostCategory));
  }

  protected clearFilters(): void {
    this.search.set('');
    this.category.set(null);
  }
}
