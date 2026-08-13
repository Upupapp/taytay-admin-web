import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  model,
  output,
  viewChild,
} from '@angular/core';

import { bindOverlay } from '../overlay/overlay.behavior';

export type DrawerSide = 'end' | 'start';
export type DrawerSize = 'narrow' | 'wide';

/**
 * Edge-anchored panel for context that sits alongside a list — a case summary,
 * a filter set, an audit trail — without losing the user's place.
 *
 *   <app-drawer [(open)]="showFilters" heading="Filter requests">
 *     <form drawer-body>…</form>
 *     <button drawer-actions class="btn btn--primary">Apply</button>
 *   </app-drawer>
 */
@Component({
  selector: 'app-drawer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './drawer.html',
  styleUrl: './drawer.scss',
})
export class Drawer {
  readonly open = model(false);
  readonly heading = input.required<string>();
  readonly description = input<string | null>(null);
  readonly side = input<DrawerSide>('end');
  readonly size = input<DrawerSize>('narrow');
  readonly dismissible = input(true);

  readonly dismissed = output<void>();

  protected readonly panel = viewChild<ElementRef<HTMLElement>>('panel');

  constructor() {
    bindOverlay({
      isOpen: this.open,
      dismissible: this.dismissible,
      panel: this.panel,
      onDismiss: () => this.close(),
    });
  }

  protected close(): void {
    if (!this.dismissible()) {
      return;
    }
    this.open.set(false);
    this.dismissed.emit();
  }
}
