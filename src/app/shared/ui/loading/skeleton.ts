import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Placeholder blocks for content whose shape is known before it arrives —
 * preferred over a spinner for tables and detail panes because the layout does
 * not jump when data lands.
 */
@Component({
  selector: 'app-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="skeleton" aria-hidden="true">
      @for (row of rows(); track $index) {
        <span class="skeleton__line" [style.width.%]="widthFor($index)"></span>
      }
    </div>
  `,
  styleUrl: './skeleton.scss',
})
export class Skeleton {
  readonly lines = input(3);

  protected rows(): readonly number[] {
    return Array.from({ length: Math.max(1, this.lines()) }, (_, index) => index);
  }

  /** Ragged right edge reads as text rather than as a broken layout. */
  protected widthFor(index: number): number {
    const widths = [100, 92, 76, 88, 64];
    return widths[index % widths.length] ?? 100;
  }
}
