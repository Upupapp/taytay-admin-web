import { DOCUMENT } from '@angular/common';
import { DestroyRef, inject, Injectable, signal } from '@angular/core';

/** Below this width the sidebar becomes an overlay drawer rather than a column. */
export const COMPACT_BREAKPOINT = '(width <= 900px)';

/**
 * Observes the one breakpoint the shell needs to change *semantics* at, not
 * just appearance: below it the sidebar is a modal drawer (focus trapped,
 * Escape closes, `aria-modal`), above it a plain landmark that is always
 * present.
 *
 * CSS alone cannot express that difference, which is why this exists rather
 * than the shell reading a media query inline — and being injectable is what
 * lets the responsive behaviour be tested at both sizes.
 */
@Injectable({ providedIn: 'root' })
export class ViewportService {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  private readonly compact = signal(false);
  readonly isCompact = this.compact.asReadonly();

  constructor() {
    const query = this.document.defaultView?.matchMedia(COMPACT_BREAKPOINT);
    if (!query) {
      return;
    }

    this.compact.set(query.matches);
    const onChange = (event: MediaQueryListEvent): void => this.compact.set(event.matches);
    query.addEventListener('change', onChange);
    this.destroyRef.onDestroy(() => query.removeEventListener('change', onChange));
  }
}

/**
 * Test double. Kept beside the real service so the two cannot drift, and so a
 * spec never has to hand-roll a `MediaQueryList` stub.
 */
@Injectable()
export class FakeViewportService {
  private readonly compact = signal(false);
  readonly isCompact = this.compact.asReadonly();

  setCompact(value: boolean): void {
    this.compact.set(value);
  }
}
