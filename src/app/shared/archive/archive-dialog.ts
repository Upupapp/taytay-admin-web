import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { ARCHIVE_REASON_LIMIT, archiveReasonProblem } from '@domain/index';

import { Modal } from '../ui/modal/modal';
import { ARCHIVE_COPY } from './archive.copy';

let dialogs = 0;

/**
 * The confirmation every archive and restore goes through (`DL-225`): what the act does, **before**
 * its button; a required reason, kept with the record under the administrator's name; and, when the
 * server refuses, its refusal in plain words with the dialog left open.
 *
 * Archive is reversible, so its button is the dialog's primary act (`.btn--primary`), as in App
 * settings' review — never the destructive `.btn--danger`, which says something cannot be undone.
 * The button stays disabled until a reason is given, and the hint beside the box says why, as the
 * issuance catalogue's Retire does (`DL-184`).
 *
 * Presentational: it holds only the reason being typed. The section does the act on `confirmed`,
 * passes `busy` while it is in flight, and passes the refusal back as `problem`.
 */
@Component({
  selector: 'app-archive-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Modal],
  template: `
    <app-modal [open]="true" [heading]="heading()" (dismissed)="dismissed.emit()">
      <div modal-body class="stack">
        <div class="effects">
          <p class="effects__lead">{{ copy.effectsLead }}</p>
          <ul [id]="effectsId">
            @for (line of effects(); track $index) {
              <li>{{ line }}</li>
            }
          </ul>
        </div>
        <div class="field">
          <label class="field__label" [for]="reasonId">{{ copy.reasonLabel }}</label>
          <textarea
            class="field__input"
            rows="3"
            [id]="reasonId"
            [attr.maxlength]="limit"
            [attr.aria-describedby]="describedBy()"
            [attr.aria-invalid]="showProblem() ? 'true' : null"
            [value]="reason()"
            (input)="onReason($event)"
          ></textarea>
          <p class="field__hint" [id]="hintId">{{ reasonHint() ?? copy.reasonHint }}</p>
          @if (showProblem()) {
            <p class="field__error" [id]="errorId">{{ reasonProblem() }}</p>
          }
        </div>
        @if (problem(); as message) {
          <!-- One block inside: a callout lays its children side by side, and the lines belong
               under the sentence they finish. -->
          <div class="callout callout--danger" role="alert">
            <div class="stack">
              <p>{{ message }}</p>
              @if (problemLines().length > 0) {
                <ul>
                  @for (line of problemLines(); track $index) {
                    <li>{{ line }}</li>
                  }
                </ul>
              }
            </div>
          </div>
        }
      </div>
      <button type="button" modal-actions class="btn btn--secondary" (click)="dismissed.emit()">
        {{ copy.cancel }}
      </button>
      <button
        type="button"
        modal-actions
        class="btn btn--primary"
        [attr.aria-describedby]="effectsId"
        [disabled]="busy() || reasonProblem() !== null"
        (click)="confirm()"
      >
        {{ busy() ? copy.busy : confirmLabel() }}
      </button>
    </app-modal>
  `,
})
export class ArchiveDialog {
  readonly heading = input.required<string>();
  /** What the act does, said before its button. */
  readonly effects = input.required<readonly string[]>();
  readonly confirmLabel = input.required<string>();
  /** Where the reason is kept, when it is not an archive history (a withdrawal, `DL-228`). */
  readonly reasonHint = input<string | null>(null);
  readonly busy = input(false);
  /** The server's refusal, in plain words; the dialog stays open beneath it. */
  readonly problem = input<string | null>(null);
  /** Lines under the refusal: what still uses an office, in words. */
  readonly problemLines = input<readonly string[]>([]);

  /** The reason, trimmed — sent only when the server would take it. */
  readonly confirmed = output<string>();
  readonly dismissed = output<void>();

  protected readonly copy = ARCHIVE_COPY.dialog;
  protected readonly limit = ARCHIVE_REASON_LIMIT;

  private readonly id = `archive-dialog-${++dialogs}`;
  protected readonly effectsId = `${this.id}-effects`;
  protected readonly reasonId = `${this.id}-reason`;
  protected readonly hintId = `${this.id}-hint`;
  protected readonly errorId = `${this.id}-error`;

  protected readonly reason = signal('');
  private readonly touched = signal(false);
  protected readonly reasonProblem = computed(() => archiveReasonProblem(this.reason()));
  /** Said once something was typed: an empty box is explained by its hint, not scolded. */
  protected readonly showProblem = computed(() => this.touched() && this.reasonProblem() !== null);
  protected readonly describedBy = computed(() =>
    this.showProblem() ? `${this.hintId} ${this.errorId}` : this.hintId,
  );

  protected onReason(event: Event): void {
    this.reason.set(event.target instanceof HTMLTextAreaElement ? event.target.value : '');
    this.touched.set(true);
  }

  protected confirm(): void {
    if (this.busy() || this.reasonProblem() !== null) {
      return;
    }
    this.confirmed.emit(this.reason().trim());
  }
}
