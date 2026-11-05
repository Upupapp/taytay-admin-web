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
import { switchMap, tap } from 'rxjs';

import {
  asId,
  BALITA_OFFICE_RULES,
  BALITA_REPOSITORY,
  OFFICE_REPOSITORY,
  type BalitaArticle,
  type BalitaArticleId,
  type BalitaCategory,
  type CursorPage,
} from '@domain/index';
import { readText } from '@shared/forms/form-values';
import { officeDirectory } from '@shared/offices/office-directory';
import { failureReason } from '@shared/state/failure-reason';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { DataTable } from '@shared/ui/data-table/data-table';
import type { TableColumn } from '@shared/ui/data-table/table-column';
import { Drawer } from '@shared/ui/drawer/drawer';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { BalitaEditor } from './balita-editor';
import { BALITA_COPY } from './balita.copy';

/** One page at a time from the server; the API's own default. */
const PAGE_SIZE = 20;

/**
 * Balita (`news.write`, `DL-171`): the news residents read in the Taytay app, written and kept here.
 *
 * **Not the newsfeed.** The console's newsfeed module is a different model the API cannot serve
 * (`DL-164`); this screen reads its own port and says near its title that residents read it in the app.
 *
 * **The published list, a page at a time** (`DL-161`), pinned first then newest, as residents see it.
 * The API lists no drafts, so a draft created or opened here is kept in this page's memory — never in
 * storage — and the page says it is gone when the page is left; one can be opened again by its ID.
 */
@Component({
  selector: 'app-balita-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, BalitaEditor, DataTable, Drawer, PageHeader],
  templateUrl: './balita-page.html',
  styleUrl: './balita.scss',
})
export class BalitaPage {
  private readonly repository = inject(BALITA_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly copy = BALITA_COPY;
  protected readonly rules = BALITA_OFFICE_RULES;
  protected readonly directory = officeDirectory(inject(OFFICE_REPOSITORY).list());

  protected readonly categories = toSignal(toViewState(this.repository.categories()), {
    initialValue: LOADING as ViewState<readonly BalitaCategory[]>,
  });

  private readonly titleCell =
    viewChild.required<TemplateRef<{ $implicit: BalitaArticle }>>('titleCell');
  private readonly actionCell =
    viewChild.required<TemplateRef<{ $implicit: BalitaArticle }>>('actionCell');

  /** Bumped to read the list again — after an act, or on "Try again". */
  private readonly generation = signal(0);
  private readonly further = signal<readonly CursorPage<BalitaArticle>[]>([]);
  protected readonly loadingMore = signal(false);
  protected readonly moreFailed = signal(false);

  protected readonly first = toSignal(
    toObservable(this.generation).pipe(
      tap(() => {
        this.further.set([]);
        this.moreFailed.set(false);
        this.loadingMore.set(false);
      }),
      switchMap(() => toViewState(this.repository.list({ limit: PAGE_SIZE, cursor: null }))),
    ),
    { initialValue: LOADING as ViewState<CursorPage<BalitaArticle>> },
  );

  protected readonly rows = computed<readonly BalitaArticle[]>(() => [
    ...(valueOf(this.first())?.items ?? []),
    ...this.further().flatMap((page) => page.items),
  ]);

  private readonly lastPage = computed(
    () => this.further().at(-1) ?? valueOf(this.first()) ?? null,
  );

  protected readonly hasMore = computed(() => {
    const last = this.lastPage();
    return last !== null && last.hasMore && last.nextCursor !== null;
  });

  protected readonly rowKey = (article: BalitaArticle): string => article.id;

  protected readonly columns = computed<readonly TableColumn<BalitaArticle>[]>(() => [
    { key: 'title', header: this.copy.list.columnTitle, cell: this.titleCell() },
    {
      key: 'category',
      header: this.copy.list.columnCategory,
      value: (article) => this.categoryLabel(article),
    },
    {
      key: 'office',
      header: this.copy.list.columnOffice,
      value: (article) => this.directory.name(article.officeId, article.officeId),
    },
    {
      key: 'published',
      header: this.copy.list.columnPublished,
      value: (article) => (article.publishedAt ?? '').slice(0, 10),
    },
    {
      key: 'open',
      header: this.copy.list.columnAction,
      hideHeader: true,
      align: 'end',
      cell: this.actionCell(),
    },
  ]);

  /** Drafts created or opened on this page — in memory only, gone when the page is left. */
  protected readonly drafts = signal<readonly BalitaArticle[]>([]);

  /** The article open in the drawer: `'new'` while writing one, `null` when the drawer is shut. */
  protected readonly editing = signal<BalitaArticle | 'new' | null>(null);
  protected readonly editingArticle = computed(() => {
    const editing = this.editing();
    return editing === 'new' ? null : editing;
  });

  protected readonly lookupId = signal('');
  protected readonly lookupBusy = signal(false);
  protected readonly lookupProblem = signal('');

  protected categoryLabel(article: BalitaArticle): string {
    if (article.category === null) return this.copy.list.noCategory;
    const named = (valueOf(this.categories()) ?? []).find((c) => c.slug === article.category);
    return named?.label ?? article.category;
  }

  protected reload(): void {
    this.generation.update((n) => n + 1);
  }

  protected showMore(): void {
    const cursor = this.lastPage()?.nextCursor ?? null;
    if (cursor === null || this.loadingMore()) return;

    const generation = this.generation();
    this.loadingMore.set(true);
    this.moreFailed.set(false);
    this.repository
      .list({ limit: PAGE_SIZE, cursor })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (page) => {
          // Read again meanwhile: this page continues a list nobody is looking at.
          if (generation === this.generation()) {
            this.further.update((pages) => [...pages, page]);
          }
          this.loadingMore.set(false);
        },
        error: () => {
          this.loadingMore.set(false);
          this.moreFailed.set(true);
        },
      });
  }

  protected write(): void {
    this.editing.set('new');
  }

  protected open(article: BalitaArticle): void {
    this.editing.set(article);
  }

  protected close(): void {
    this.editing.set(null);
  }

  protected typedId(event: Event): void {
    this.lookupId.set(readText(event));
  }

  /** A draft the list cannot show, opened by the ID this page or the audit trail gave. */
  protected openById(): void {
    const typed = this.lookupId().trim();
    if (typed === '') {
      this.lookupProblem.set(this.copy.byId.empty);
      return;
    }
    this.lookupBusy.set(true);
    this.lookupProblem.set('');
    this.repository
      .get(asId<BalitaArticleId>(typed))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (article) => {
          this.lookupBusy.set(false);
          if (article === null) {
            this.lookupProblem.set(this.copy.byId.notFound);
            return;
          }
          this.keep(article);
          this.editing.set(article);
        },
        error: (failure: unknown) => {
          this.lookupBusy.set(false);
          this.lookupProblem.set(failureReason(failure) ?? this.copy.byId.failed);
        },
      });
  }

  /** The server's answer after an act: kept open, kept among this page's drafts, the list re-read. */
  protected onSaved(article: BalitaArticle): void {
    this.keep(article);
    this.editing.set(article);
    this.reload();
  }

  private keep(article: BalitaArticle): void {
    const others = this.drafts().filter((draft) => draft.id !== article.id);
    this.drafts.set(article.status === 'draft' ? [article, ...others] : others);
  }
}
