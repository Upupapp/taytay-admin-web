import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  TemplateRef,
} from '@angular/core';

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
          [actionLabel]="retryLabel()"
          (actionSelected)="retryRequested.emit()"
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

  readonly retryRequested = output<void>();

  /** Idle counts as busy: data has been asked for and has not arrived. */
  protected readonly isBusy = computed(() => {
    const kind = this.state().kind;
    return kind === 'loading' || kind === 'idle';
  });
}
