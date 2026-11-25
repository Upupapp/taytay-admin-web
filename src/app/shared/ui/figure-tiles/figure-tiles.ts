import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/** One figure: what it counts, the figure as text, and a line on what it means. */
export interface FigureTile {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  /** The dot beside the label: decoration only, the words carry the meaning. */
  readonly dot: 'bar' | 'red' | 'gold' | 'green' | 'muted';
}

/**
 * A list board's headline figures (`DL-232`) in the shared strip (`.kpi-strip`, `DL-253`): one
 * panel, a cell per figure — the dot and the label, the figure large, the hint under it.
 * Presentational: the figures are what the page was sent, and a list's figures are never the
 * number of its rows on screen (`DL-161`).
 */
@Component({
  selector: 'app-figure-tiles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'kpi-strip', role: 'region', '[attr.aria-label]': 'label()' },
  template: `
    @for (tile of tiles(); track tile.key) {
      <div class="kpi-strip__cell">
        <span class="kpi-strip__label">
          <span [class]="'kpi-strip__dot kpi-strip__dot--' + tile.dot" aria-hidden="true"></span>
          <span class="kpi-strip__name">{{ tile.label }}</span>
        </span>
        <span class="kpi-strip__value">{{ tile.value }}</span>
        <span class="kpi-strip__hint kpi-strip__hint--note">{{ tile.hint }}</span>
      </div>
    }
  `,
  styles: `
    /* The board's 16px between the strip and the list below it. */
    :host {
      margin-block-end: var(--space-4);
    }
  `,
})
export class FigureTiles {
  readonly tiles = input.required<readonly FigureTile[]>();
  readonly label = input.required<string>();
}
