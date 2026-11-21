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
 * A row of headline figures as the list boards draw them above their lists (`DL-232`): label and a
 * coloured dot, the figure large, a hint under it. Presentational: the figures are what the page
 * was sent, and a list's figures are never the number of its rows on screen (`DL-161`).
 */
@Component({
  selector: 'app-figure-tiles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { role: 'region', '[attr.aria-label]': 'label()' },
  template: `
    @for (tile of tiles(); track tile.key) {
      <div class="kpi figure-tiles__tile">
        <span class="figure-tiles__label">
          {{ tile.label }}
          <span
            [class]="'figure-tiles__dot figure-tiles__dot--' + tile.dot"
            aria-hidden="true"
          ></span>
        </span>
        <span class="figure-tiles__value">{{ tile.value }}</span>
        <span class="figure-tiles__hint">{{ tile.hint }}</span>
      </div>
    }
  `,
  styles: `
    /* The board's 18-20px between the row and the list below it. */
    :host {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(190px, 100%), 1fr));
      gap: var(--space-4);
      margin-block-end: var(--space-4);
    }

    .figure-tiles__tile {
      gap: var(--space-1);
      padding: 18px 20px;
      border-radius: var(--r-card);
    }

    .figure-tiles__label {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--space-2);
      font-size: var(--fs-sm);
      font-weight: var(--fw-semibold);
    }

    .figure-tiles__dot {
      flex: 0 0 auto;
      inline-size: 10px;
      block-size: 10px;
      border-radius: var(--r-pill);
    }

    .figure-tiles__dot--bar {
      background: var(--bar);
    }

    .figure-tiles__dot--red {
      background: var(--red);
    }

    .figure-tiles__dot--gold {
      background: var(--gold);
    }

    .figure-tiles__dot--green {
      background: var(--green-ink);
    }

    .figure-tiles__dot--muted {
      background: var(--muted);
    }

    .figure-tiles__value {
      font-family: var(--font-display);
      font-size: var(--fs-kpi);
      font-weight: var(--fw-medium);
      line-height: 1.05;
      letter-spacing: var(--ls-display);
      font-variant-numeric: tabular-nums;
    }

    .figure-tiles__hint {
      color: var(--muted);
      font-size: var(--fs-xs);
    }
  `,
})
export class FigureTiles {
  readonly tiles = input.required<readonly FigureTile[]>();
  readonly label = input.required<string>();
}
