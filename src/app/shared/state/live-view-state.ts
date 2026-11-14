import {
  catchError,
  defer,
  exhaustMap,
  filter,
  map,
  Observable,
  of,
  type Subscription,
} from 'rxjs';

import { LOADING, ready, toViewState, type ViewState } from './view-state';

/**
 * Who hears how a screen's reads went. `LiveUpdates` is one: it says "Updated 10:32" in the topbar,
 * or that a re-read failed and the screen may be out of date.
 */
export interface RefreshReport {
  noteRefreshed(): void;
  noteRefreshFailed(): void;
}

/**
 * A screen's read, kept fresh by live updates (`DL-222`) without ever flashing the skeleton.
 *
 * - **The first read goes through `toViewState`**: `loading`, then the answer or an error panel with
 *   "Try again". A screen whose query changes builds a new one of these (`switchMap`), so a new
 *   question still shows the skeleton, as it should.
 * - **A re-read never emits `loading`.** Each emission of `refreshes` asks `load()` again; a success
 *   swaps the new value in, and a failure **keeps what is on screen** and tells the report, so the
 *   topbar can say the screen may be out of date. A re-read after a failed first read replaces the
 *   error panel when it succeeds.
 * - **One re-read at a time** (`exhaustMap`): a hint that arrives while a slow read is in flight is
 *   absorbed by it, never stacked behind it. A refresh during the first read is ignored for the same
 *   reason.
 *
 * Nothing here changes data: a re-read is a read (`DL-118`).
 *
 * ```ts
 * private readonly live = inject(LiveUpdates);
 * protected readonly state = toSignal(
 *   this.filter$.pipe(
 *     switchMap((f) =>
 *       liveViewState(() => this.repository.summary(f), this.live.changes(['residents']), this.live),
 *     ),
 *   ),
 *   { initialValue: LOADING },
 * );
 * ```
 */
export function liveViewState<TValue>(
  load: () => Observable<TValue>,
  refreshes: Observable<unknown>,
  report?: RefreshReport,
): Observable<ViewState<TValue>> {
  return new Observable<ViewState<TValue>>((subscriber) => {
    let current: ViewState<TValue> = LOADING;
    const show = (state: ViewState<TValue>): void => {
      current = state;
      if (state.kind === 'ready') report?.noteRefreshed();
      subscriber.next(state);
    };

    // Completion of the first read is not the end of the screen: the re-reads keep it open.
    const first: Subscription = toViewState(defer(load)).subscribe({ next: show });

    const again: Subscription = refreshes
      .pipe(
        filter(() => current.kind === 'ready' || current.kind === 'error'),
        exhaustMap(() =>
          defer(load).pipe(
            map((value): { readonly value: TValue } | null => ({ value })),
            catchError(() => of(null)),
          ),
        ),
      )
      .subscribe((answer) => {
        if (answer === null) {
          report?.noteRefreshFailed();
          return;
        }
        show(ready(answer.value));
      });

    return () => {
      first.unsubscribe();
      again.unsubscribe();
    };
  });
}

/**
 * For a list that can load further pages: the refreshes that may re-read it, and a note of those
 * that may not (`DL-222`).
 *
 * A list with only its first page on screen re-reads quietly like any other screen. Once somebody
 * has loaded more, a re-read of the first page would throw away the rest and reshuffle the rows
 * under their cursor — so the hint is held instead, and `onHeld` shows `ListChangedNotice`: "This
 * list has changed. Reload list". Reloading is then the person's own act.
 */
export function unlessPaged(
  refreshes: Observable<unknown>,
  morePagesLoaded: () => boolean,
  onHeld: () => void,
): Observable<unknown> {
  return refreshes.pipe(
    filter(() => {
      if (morePagesLoaded()) {
        onHeld();
        return false;
      }
      return true;
    }),
  );
}
