import { computed, DestroyRef, inject, signal, type Signal } from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap, tap, type Observable } from 'rxjs';

import type { CursorPage, CursorRequest } from '@domain/index';
import { LOADING, toViewState, valueOf, type ViewState } from '@shared/state/view-state';

/** One page at a time from the server; the API's own default, and well under its ceiling. */
export const PAGE_SIZE = 20;

export interface CursorList<T> {
  /** The first page as read: loading, ready or failed. */
  readonly first: Signal<ViewState<CursorPage<T>>>;
  /** Every row read so far, the first page's and each further one's. */
  readonly rows: Signal<readonly T[]>;
  readonly hasMore: Signal<boolean>;
  readonly loadingMore: Signal<boolean>;
  readonly moreFailed: Signal<boolean>;
  /** Reads the list again from its first page — after a change, or on "Try again". */
  reload(): void;
  /** Follows the cursor one page further. */
  showMore(): void;
}

/**
 * A browsable cursor list (`DL-161`): a page at a time, "more are available", never "page 1 of N".
 * Call in an injection context.
 *
 * The same shape the ID review and users and roles hold inline; here two lists of one feature share
 * it. After a change the list is read again from the server rather than patched, so what is shown is
 * what the server holds.
 */
export function cursorList<T>(
  load: (page: CursorRequest) => Observable<CursorPage<T>>,
): CursorList<T> {
  const destroyRef = inject(DestroyRef);
  const generation = signal(0);
  const further = signal<readonly CursorPage<T>[]>([]);
  const loadingMore = signal(false);
  const moreFailed = signal(false);

  const first = toSignal(
    toObservable(generation).pipe(
      tap(() => {
        further.set([]);
        moreFailed.set(false);
        loadingMore.set(false);
      }),
      switchMap(() => toViewState(load({ limit: PAGE_SIZE, cursor: null }))),
    ),
    { initialValue: LOADING as ViewState<CursorPage<T>> },
  );

  const rows = computed<readonly T[]>(() => [
    ...(valueOf(first())?.items ?? []),
    ...further().flatMap((page) => page.items),
  ]);
  const lastPage = computed(() => further().at(-1) ?? valueOf(first()) ?? null);
  const hasMore = computed(() => {
    const last = lastPage();
    return last !== null && last.hasMore && last.nextCursor !== null;
  });

  return {
    first,
    rows,
    hasMore,
    loadingMore: loadingMore.asReadonly(),
    moreFailed: moreFailed.asReadonly(),
    reload: () => generation.update((n) => n + 1),
    showMore: () => {
      const cursor = lastPage()?.nextCursor ?? null;
      if (cursor === null || loadingMore()) {
        return;
      }
      const reading = generation();
      loadingMore.set(true);
      moreFailed.set(false);
      load({ limit: PAGE_SIZE, cursor })
        .pipe(takeUntilDestroyed(destroyRef))
        .subscribe({
          next: (page) => {
            // Read again meanwhile: this page continues a list nobody is looking at.
            if (reading === generation()) {
              further.update((pages) => [...pages, page]);
            }
            loadingMore.set(false);
          },
          error: () => {
            loadingMore.set(false);
            moreFailed.set(true);
          },
        });
    },
  };
}
