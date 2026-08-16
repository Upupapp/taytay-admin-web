import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map, switchMap } from 'rxjs';

import {
  SEARCH_REPOSITORY,
  addRecentSearch,
  describeResults,
  describeWithheld,
  isSearchable,
  type SearchResults,
} from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';
import { AsyncContent } from '@shared/ui/async-content/async-content';
import { PageHeader } from '@shared/ui/page-header/page-header';

import { SEARCH_COPY } from './search.copy';

/**
 * Global search.
 *
 * The term lives in the URL, like every other filter in this application
 * (`DL-36`), so a search is a link somebody can send a colleague and the back
 * button behaves. The term is the *only* thing in the query string.
 *
 * **Recent searches are held in a signal and nowhere else** (`DL-110`). There
 * is no `localStorage` here and there must not be: a resident's name typed into
 * a search box and written to a shared office machine is a disclosure the
 * office never decided to make, and there is no way to tell a safe query from
 * an unsafe one — "Dela Cruz" is a surname and also a street.
 */
@Component({
  selector: 'app-search-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AsyncContent, PageHeader, RouterLink],
  templateUrl: './search-page.html',
  styleUrl: './search-page.scss',
})
export class SearchPage {
  private readonly repository = inject(SEARCH_REPOSITORY);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly copy = SEARCH_COPY;

  /** The term, read from the URL rather than held privately. */
  protected readonly term = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('q') ?? '')),
    { initialValue: '' },
  );

  protected readonly state = toSignal(
    toObservable(this.term).pipe(switchMap((term) => toViewState(this.repository.search(term)))),
    { initialValue: LOADING as ViewState<SearchResults> },
  );

  protected readonly results = computed(() => valueOf(this.state()) ?? null);
  protected readonly hasTerm = computed(() => isSearchable(this.term()));

  protected readonly summary = computed(() => {
    const results = this.results();
    return results === null ? '' : describeResults(results);
  });

  /** Which record types were skipped for want of access, named rather than hidden. */
  protected readonly withheld = computed(() => {
    const results = this.results();
    return results === null ? null : describeWithheld(results);
  });

  /* ── Recent, for this tab only ──────────────────────────────────────────── */

  private readonly recentTerms = signal<readonly string[]>([]);
  protected readonly recent = this.recentTerms.asReadonly();

  protected onSubmit(event: Event): void {
    event.preventDefault();
    const input = (event.target as HTMLFormElement).querySelector('input');
    this.run((input as HTMLInputElement | null)?.value ?? '');
  }

  protected run(term: string): void {
    const trimmed = term.trim();
    if (isSearchable(trimmed)) {
      this.recentTerms.update((existing) => addRecentSearch(existing, trimmed));
    }
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: trimmed === '' ? {} : { q: trimmed },
    });
  }

  protected clearRecent(): void {
    this.recentTerms.set([]);
  }
}
