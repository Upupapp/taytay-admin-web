import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, TemplateRef } from '@angular/core';
import { outputFromObservable } from '@angular/core/rxjs-interop';
import { Subject } from 'rxjs';

import type { ViewState } from '@shared/state/view-state';

import { EmptyState } from '../empty-state/empty-state';
import { LoadingIndicator } from '../loading/loading-indicator';
import { Skeleton } from '../loading/skeleton';

/**
 * Renders the right surface for a `ViewState`: skeleton while loading, error
 * panel on failure, and the caller's template once data is ready.
 *
 *   <app-async-content [state]="summary()" [content]="body">
 *     <ng-template #body let-summary>…</ng-template>
 *   </app-async-content>
 *
 * Screens get consistent loading and failure behaviour without repeating it,
 * and cannot accidentally read a value that has not arrived.
 *
 * **"Try again" always does something, or is not offered** (`DL-186`). A screen that listens to
 * `retryRequested` owns its reload and is told; otherwise the failure's own `retry` — which every
 * state from `toViewState` carries — asks the same question again. A failure with neither gets no
 * button. Before this, eighteen pages showed a "Try again" that nobody was listening to.
 */
@Component({
  selector: 'app-async-content',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, EmptyState, LoadingIndicator, Skeleton],
  // aria-busy marks the whole region as in-flight, so assistive technology
  // announces "busy" rather than reading a half-built section. Resolves the
  // first half of DL-16 (superseded by DL-25).
  host: {
    '[attr.aria-busy]': 'isBusy() ? "true" : null',
  },
  template: `
    @let current = state();

    @switch (current.kind) {
      @case ('ready') {
        <ng-container
          *ngTemplateOutlet="content(); context: { $implicit: current.value }"
        ></ng-container>
      }
      @case ('error') {
        <app-empty-state
          variant="error"
          [heading]="errorHeading()"
          [message]="current.message"
          [actionLabel]="canRetry(current) ? retryLabel() : null"
          (actionSelected)="retry(current)"
        />
      }
      @case ('loading') {
        @if (skeletonLines() > 0) {
          <app-skeleton [lines]="skeletonLines()" />
        } @else {
          <app-loading-indicator [message]="loadingMessage()" />
        }
      }
      @default {
        <app-loading-indicator size="small" [message]="loadingMessage()" />
      }
    }
  `,
})
export class AsyncContent<TValue> {
  readonly state = input.required<ViewState<TValue>>();
  readonly content = input.required<TemplateRef<{ $implicit: TValue }>>();

  readonly errorHeading = input('Could not load this section');
  readonly retryLabel = input<string | null>('Try again');
  readonly loadingMessage = input<string | null>(null);
  /** Set to 0 to show a spinner instead of skeleton lines. */
  readonly skeletonLines = input(4);

  /**
   * A subject rather than a plain output, so the panel can tell whether the screen listens: binding
   * `(retryRequested)` subscribes to it, and a screen that does owns its reload.
   */
  private readonly retries = new Subject<void>();
  readonly retryRequested = outputFromObservable(this.retries);

  /** Idle counts as busy: data has been asked for and has not arrived. */
  protected readonly isBusy = computed(() => {
    const kind = this.state().kind;
    return kind === 'loading' || kind === 'idle';
  });

  protected canRetry(failure: { readonly retry?: () => void }): boolean {
    return this.retries.observed || failure.retry !== undefined;
  }

  /** The screen's own reload when it has one, else the failed read asked again — never both. */
  protected retry(failure: { readonly retry?: () => void }): void {
    if (this.retries.observed) {
      this.retries.next();
      return;
    }
    failure.retry?.();
  }
}
