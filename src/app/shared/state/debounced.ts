import { computed, type Signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { debounceTime } from 'rxjs';

/**
 * How long a search box waits before asking the data layer.
 *
 * 250ms is the band where a fast typist finishes a word before the first
 * request goes out, and a hesitant one still sees results feel immediate.
 * Shorter and a ten-character surname fires ten queries; longer and the box
 * feels broken.
 */
export const SEARCH_DEBOUNCE_MS = 250;

/**
 * A debounced view of a signal.
 *
 * Every list screen in this application binds its search box to a signal and
 * pipes that signal into a repository call. Without this, typing "Sarmiento"
 * fired nine reads across the whole registry — nine sorts, nine paginations,
 * nine disclosure passes — and the eight that were thrown away cost exactly as
 * much as the one that was kept (`DL-119`).
 *
 * Debouncing the **term** rather than the whole query is deliberate: choosing a
 * status from a dropdown is a single deliberate act and should take effect at
 * once. Only the thing somebody types character by character waits.
 *
 * Must be called in an injection context, like `toSignal` itself.
 */
export function debounced<T>(source: Signal<T>, delayMs = SEARCH_DEBOUNCE_MS): Signal<T> {
  return toSignal(toObservable(source).pipe(debounceTime(delayMs)), {
    initialValue: source(),
  });
}

/**
 * A debounced search term, trimmed.
 *
 * The common case, spelled once so twelve screens do not each decide whether to
 * trim before or after debouncing. Trimming after means "sarmiento " and
 * "sarmiento" are one query rather than two.
 */
export function debouncedTerm(source: Signal<string>, delayMs = SEARCH_DEBOUNCE_MS): Signal<string> {
  const settled = debounced(source, delayMs);
  return computed(() => settled().trim());
}
