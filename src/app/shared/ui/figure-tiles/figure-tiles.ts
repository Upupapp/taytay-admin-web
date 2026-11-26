import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { JumpLink } from '../jump-link/jump-link';

/**
 * Where a figure leads (`DL-273`): a list with its filter in the address, or a section of the same
 * page. `says` is read after the figure by a screen reader — where the link goes, in words.
 */
export type FigureLink =
  | {
      readonly kind: 'route';
      readonly route: string;
      /** The whole filter: nothing of the current address is carried unless it is named here. */
      readonly queryParams: Readonly<Record<string, string>>;
      readonly says: string;
    }
  | { readonly kind: 'jump'; readonly target: string; readonly says: string };

/** One figure: what it counts, the figure as text, and a line on what it means. */
export interface FigureTile {
  readonly key: string;
  readonly label: string;
  readonly value: string;
  readonly hint: string;
  /** The dot beside the label: decoration only, the words carry the meaning. */
  readonly dot: 'bar' | 'red' | 'gold' | 'green' | 'muted';
  /** Absent where nothing shows what the figure counts, or the reader could not open it. */
  readonly link?: FigureLink;
}

/**
 * A list board's headline figures (`DL-232`) in the shared strip (`.kpi-strip`, `DL-253`): one
 * panel, a cell per figure — the dot and the label, the figure large, the hint under it.
 * Presentational: the figures are what the page was sent, and a list's figures are never the
 * number of its rows on screen (`DL-161`). A figure with a link is the link, the whole cell
 * (`DL-273`); the page decides where it goes and whether its reader may go there.
 */
@Component({
  selector: 'app-figure-tiles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [JumpLink, NgTemplateOutlet, RouterLink],
  host: { class: 'kpi-strip', role: 'region', '[attr.aria-label]': 'label()' },
  template: `
    @for (tile of tiles(); track tile.key) {
      @if (routeOf(tile); as link) {
        <a class="kpi-strip__cell" [routerLink]="link.route" [queryParams]="link.queryParams">
          <ng-container *ngTemplateOutlet="cell; context: { $implicit: tile }" />
          <span class="visually-hidden">{{ link.says }}</span>
        </a>
      } @else if (jumpOf(tile); as link) {
        <a class="kpi-strip__cell" [appJumpTo]="link.target">
          <ng-container *ngTemplateOutlet="cell; context: { $implicit: tile }" />
          <span class="visually-hidden">{{ link.says }}</span>
        </a>
      } @else {
        <div class="kpi-strip__cell">
          <ng-container *ngTemplateOutlet="cell; context: { $implicit: tile }" />
        </div>
      }
    }

    <ng-template #cell let-tile>
      <span class="kpi-strip__label">
        <span [class]="'kpi-strip__dot kpi-strip__dot--' + tile.dot" aria-hidden="true"></span>
        <span class="kpi-strip__name">{{ tile.label }}</span>
      </span>
      <span class="kpi-strip__value">{{ tile.value }}</span>
      <span class="kpi-strip__hint kpi-strip__hint--note">{{ tile.hint }}</span>
    </ng-template>
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

  protected routeOf(tile: FigureTile): Extract<FigureLink, { kind: 'route' }> | null {
    return tile.link?.kind === 'route' ? tile.link : null;
  }

  protected jumpOf(tile: FigureTile): Extract<FigureLink, { kind: 'jump' }> | null {
    return tile.link?.kind === 'jump' ? tile.link : null;
  }
}
