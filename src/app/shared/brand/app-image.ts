import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';

import { BRAND_COPY } from './brand.copy';

export type ImageState = 'loading' | 'loaded' | 'error';

/**
 * Image with a guaranteed box and an honest failure state.
 *
 * `width` and `height` are required, and the wrapper reserves that box before
 * the network responds, so a slow or failed image can never reflow the page —
 * the mechanism NgOptimizedImage relies on, applied directly (see `DL-24` for
 * why NgOptimizedImage itself is deferred).
 *
 * On error the component does not disappear and does not show a broken-image
 * glyph: it renders a labelled fallback in exactly the same box.
 */
@Component({
  selector: 'app-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span
      class="img"
      [class.img--rounded]="rounded()"
      [style.width.px]="width()"
      [style.height.px]="height()"
      [style.aspect-ratio]="ratio()"
      [attr.aria-busy]="state() === 'loading' ? 'true' : null"
    >
      @if (state() !== 'error') {
        <img
          class="img__el"
          [src]="src()"
          [attr.alt]="decorative() ? '' : alt()"
          [attr.aria-hidden]="decorative() ? 'true' : null"
          [attr.width]="width()"
          [attr.height]="height()"
          [attr.loading]="priority() ? 'eager' : 'lazy'"
          [attr.fetchpriority]="priority() ? 'high' : 'auto'"
          decoding="async"
          [class.img__el--pending]="state() === 'loading'"
          (load)="onLoad()"
          (error)="onError()"
        />
      }

      @if (state() === 'loading') {
        <span class="img__pending" aria-hidden="true"></span>
        <span class="visually-hidden">{{ copy.imageLoading }}</span>
      }

      @if (state() === 'error') {
        <span class="img__fallback" [attr.title]="fallbackLabel() ?? copy.imageUnavailable">
          <span class="img__fallback-glyph" aria-hidden="true">▨</span>
          @if (decorative()) {
            <span class="visually-hidden">{{ copy.imageUnavailable }}</span>
          } @else {
            <span class="visually-hidden">{{ fallbackLabel() ?? copy.imageUnavailable }}</span>
          }
        </span>
      }
    </span>
  `,
  styleUrl: './app-image.scss',
})
export class AppImage {
  readonly src = input.required<string>();
  /** Required so the a11y decision is explicit; pass `decorative` to suppress it. */
  readonly alt = input.required<string>();
  readonly width = input.required<number>();
  readonly height = input.required<number>();

  readonly rounded = input(false, { transform: booleanAttribute });
  readonly priority = input(false, { transform: booleanAttribute });
  readonly decorative = input(false, { transform: booleanAttribute });
  readonly fallbackLabel = input<string | null>(null);

  readonly stateChanged = output<ImageState>();

  protected readonly copy = BRAND_COPY;
  private readonly currentState = signal<ImageState>('loading');
  readonly state = this.currentState.asReadonly();

  protected readonly ratio = computed(() => `${this.width()} / ${this.height()}`);

  protected onLoad(): void {
    this.currentState.set('loaded');
    this.stateChanged.emit('loaded');
  }

  protected onError(): void {
    this.currentState.set('error');
    this.stateChanged.emit('error');
  }
}
