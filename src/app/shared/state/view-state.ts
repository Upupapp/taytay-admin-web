import { catchError, map, of, startWith, type Observable } from 'rxjs';

/**
 * The four states every asynchronous screen can be in.
 *
 * Modelling this as a union — rather than three loose booleans — is what lets
 * the shared `AsyncContent` primitive guarantee that a screen can never render
 * "no results" while it is still loading, or show stale data after a failure.
 */
export type ViewState<TValue> =
  | { readonly kind: 'idle' }
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly value: TValue }
  | { readonly kind: 'error'; readonly message: string };

export const IDLE: ViewState<never> = { kind: 'idle' };
export const LOADING: ViewState<never> = { kind: 'loading' };

export function ready<TValue>(value: TValue): ViewState<TValue> {
  return { kind: 'ready', value };
}

export function failed<TValue>(message: string): ViewState<TValue> {
  return { kind: 'error', message };
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
 */
export function toViewState<TValue>(source: Observable<TValue>): Observable<ViewState<TValue>> {
  return source.pipe(
    map((value) => ready(value)),
    catchError((error: unknown) =>
      of(failed<TValue>(error instanceof Error ? error.message : GENERIC_FAILURE)),
    ),
    startWith(LOADING as ViewState<TValue>),
  );
}
