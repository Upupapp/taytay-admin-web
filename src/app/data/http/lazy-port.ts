import { EnvironmentInjector, inject, runInInjectionContext, type Type } from '@angular/core';
import { defer, isObservable, switchMap, throwError, type Observable } from 'rxjs';

/** The http adapters, as the module a browser fetches on a screen's first question. */
export type HttpAdapters = typeof import('./http-repositories');

/**
 * Fetches the adapters once; a failed fetch is forgotten, so the next question tries again rather
 * than failing for the rest of the session because the network dropped once.
 */
let adapters: Promise<HttpAdapters> | null = null;

export function loadHttpAdapters(): Promise<HttpAdapters> {
  adapters ??= import('./http-repositories').catch((failure: unknown) => {
    adapters = null;
    throw failure;
  });
  return adapters;
}

/**
 * Names asked of a value that are never port methods. Answering them with a method would make the
 * port look like a promise (`then`) or like something Angular must destroy (`ngOnDestroy`).
 */
const NOT_PORT_METHODS: ReadonlySet<string> = new Set([
  'then',
  'ngOnDestroy',
  'constructor',
  'toJSON',
]);

/**
 * A port whose adapter is fetched the first time anybody asks it something (`DL-224`).
 *
 * Binding a class to a token references it, so every adapter — and every mapper behind it — used to
 * be in the first file the browser downloads, before the sign-in screen could paint. Every port
 * method answers with an `Observable`, so a call can wait for its adapter inside the Observable it
 * already returns: nothing is fetched or sent before the caller subscribes, the adapter is built
 * once in the root injector exactly as `useClass` built it, and a failed download arrives as that
 * call's error, which every screen already shows in its error state.
 *
 * Used only in `data-access.providers.ts`, the one place ports are bound, so the seam is unchanged.
 */
export function lazyPort<TPort extends object>(
  pick: (module: HttpAdapters) => Type<TPort>,
): () => TPort {
  return lazyAdapter(() => loadHttpAdapters().then(pick));
}

/**
 * The mechanism behind `lazyPort`, for any loader: the adapter class is loaded and built on the
 * first call that is subscribed to, once, and a failed load is forgotten so the next call retries.
 */
export function lazyAdapter<TPort extends object>(load: () => Promise<Type<TPort>>): () => TPort {
  return () => {
    const injector = inject(EnvironmentInjector);
    let adapter: Promise<TPort> | null = null;
    const resolve = (): Promise<TPort> => {
      adapter ??= load().then(
        (type) => runInInjectionContext(injector, () => new type()),
        (failure: unknown) => {
          adapter = null;
          throw failure;
        },
      );
      return adapter;
    };

    return new Proxy({} as TPort, {
      get: (_target, name) => {
        if (typeof name !== 'string' || NOT_PORT_METHODS.has(name)) {
          return undefined;
        }
        return (...args: readonly unknown[]): Observable<unknown> =>
          defer(resolve).pipe(
            switchMap((port) => {
              const method: unknown = Reflect.get(port, name);
              const answer: unknown =
                typeof method === 'function' ? Reflect.apply(method, port, args) : undefined;
              return isObservable(answer)
                ? answer
                : throwError(
                    () =>
                      new Error('This part of the console could not be reached. Nothing was sent.'),
                  );
            }),
          );
      },
    });
  };
}
