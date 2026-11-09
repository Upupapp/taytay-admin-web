import { Observable, type Subscription } from 'rxjs';

import { failureReason } from './failure-reason';

/**
 * The four states every asynchronous screen can be in.
 *
 * Modelling this as a union — rather than three loose booleans — is what lets
 * the shared `AsyncContent` primitive guarantee that a screen can never render
 * "no results" while it is still loading, or show stale data after a failure.
 *
 * A failure may carry `retry`: the way to ask the same question again. `toViewState` always gives
 * one, so the error panel's "Try again" re-runs the read on every screen without each screen wiring
 * its own (`DL-186`). A failure made by hand has none, and the panel then offers no button rather
 * than one that does nothing.
 */
export type ViewState<TValue> =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly value: TValue }
  | { readonly kind: 'error'; readonly message: string; readonly retry?: () => void };

export const IDLE: ViewState<never> = { kind: 'idle' };
export const LOADING: ViewState<never> = { kind: 'loading' };

export function ready<TValue>(value: TValue): ViewState<TValue> {
  return { kind: 'ready', value };
}

export function failed<TValue>(message: string, retry?: () => void): ViewState<TValue> {
  return retry === undefined ? { kind: 'error', message } : { kind: 'error', message, retry };
}

export function isReady<TValue>(
  state: ViewState<TValue>,
): state is { kind: 'ready'; value: TValue } {
  return state.kind === 'ready';
}

export function valueOf<TValue>(state: ViewState<TValue>): TValue | null {
  return state.kind === 'ready' ? state.value : null;
}

const GENERIC_FAILURE = 'The information could not be loaded. Please try again.';

/**
 * Lifts a data-source observable into a `ViewState` stream. Pair with
 * `toSignal` in a component:
 *
 *   readonly state = toSignal(toViewState(repo.list(...)), { initialValue: LOADING });
 *
 * A failure carries `retry`, which subscribes to `source` again — the same request, asked again —
 * and emits `loading` and then its answer on this same stream. So the stream stays open after a
 * failure, waiting to be asked again, until its subscriber leaves; after a value it completes when
 * `source` does, as before. A retry asked for after the subscriber has gone sends nothing.
 */
export function toViewState<TValue>(source: Observable<TValue>): Observable<ViewState<TValue>> {
  return new Observable<ViewState<TValue>>((subscriber) => {
    let attempt: Subscription | null = null;

    const run = (): void => {
      if (subscriber.closed) {
        return;
      }
      attempt?.unsubscribe();
      subscriber.next(LOADING as ViewState<TValue>);
      attempt = source.subscribe({
        next: (value) => subscriber.next(ready(value)),
        // The server's own sentence when it answered (an `ApiFailure`), or an adapter's `Error`:
        // a refused read is said in the screen's place, and no longer by a navigation (`DL-196`).
        error: (error: unknown) =>
          subscriber.next(failed<TValue>(failureReason(error) ?? GENERIC_FAILURE, run)),
        complete: () => subscriber.complete(),
      });
    };

    run();
    return () => attempt?.unsubscribe();
  });
}
