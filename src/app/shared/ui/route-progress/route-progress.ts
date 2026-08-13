import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  NavigationCancel,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router';
import { filter, map, startWith } from 'rxjs';

/**
 * Global navigation feedback.
 *
 * Every feature route is lazy, so choosing a module fetches a chunk before
 * anything renders. Without a signal the console looks frozen on a slow
 * connection — which is exactly the office's connection.
 *
 * It is an indeterminate bar, not a percentage: we do not know how long a chunk
 * takes, and inventing a number would be the "fake progress" that EPL-03
 * forbids. The bar is `aria-hidden`; the accessible announcement is a
 * visually-hidden live region, so screen-reader users are told once rather than
 * hearing an animation.
 */
@Component({
  selector: 'app-route-progress',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (busy()) {
      <div class="route-progress" aria-hidden="true">
        <span class="route-progress__bar"></span>
      </div>
    }
    <span class="visually-hidden" role="status" aria-live="polite">
      {{ busy() ? loadingMessage() : '' }}
    </span>
  `,
  styleUrl: './route-progress.scss',
})
export class RouteProgress {
  private readonly router = inject(Router);

  /** Overridable so the copy stays in the consuming layer's copy module. */
  readonly loadingMessage = computed(() => 'Loading page');

  protected readonly busy = toSignal(
    this.router.events.pipe(
      filter(
        (event) =>
          event instanceof NavigationStart ||
          event instanceof NavigationEnd ||
          event instanceof NavigationCancel ||
          event instanceof NavigationError,
      ),
      map((event) => event instanceof NavigationStart),
      startWith(false),
    ),
    { initialValue: false },
  );
}
