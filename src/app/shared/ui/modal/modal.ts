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

export type ModalSize = 'small' | 'medium' | 'large';

/**
 * Centred modal dialog for focused decisions — confirmations, short forms,
 * approval remarks.
 *
 *   <app-modal [(open)]="confirming" heading="Approve request" (dismissed)="…">
 *     <p modal-body>…</p>
 *     <button modal-actions class="btn btn--primary">Approve</button>
 *   </app-modal>
 *
 * Use a drawer instead when the user needs to keep reading the list behind it.
 */
@Component({
  selector: 'app-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
})
export class Modal {
  readonly open = model(false);
  readonly heading = input.required<string>();
  readonly description = input<string | null>(null);
  readonly size = input<ModalSize>('medium');
  /** When false the backdrop and Escape no longer close the dialog. */
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
