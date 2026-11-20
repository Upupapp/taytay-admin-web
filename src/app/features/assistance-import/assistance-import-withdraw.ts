import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ASSISTANCE_IMPORT_REPOSITORY, type AssistanceImportSummary } from '@domain/index';
import { ArchiveDialog } from '@shared/archive/archive-dialog';
import { failureReason } from '@shared/state/failure-reason';

import { ASSISTANCE_IMPORT_COPY } from './assistance-import.copy';

/**
 * Withdrawing a committed import (`DL-228`), through the shared archive dialog (`DL-225`): what it
 * does **before** the button — its requests stay on the records and are never deleted, and stop
 * being counted — and a required reason kept under the officer's name. A refusal stays in the
 * dialog in the server's plain words.
 */
@Component({
  selector: 'app-assistance-import-withdraw',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ArchiveDialog],
  template: `
    <app-archive-dialog
      [heading]="copy.heading(summary().fileName)"
      [effects]="effects()"
      [confirmLabel]="copy.confirm"
      [reasonHint]="copy.reasonHint"
      [busy]="busy()"
      [problem]="problem()"
      (confirmed)="withdraw($event)"
      (dismissed)="dismissed.emit()"
    />
  `,
})
export class AssistanceImportWithdraw {
  private readonly repository = inject(ASSISTANCE_IMPORT_REPOSITORY);
  private readonly destroyRef = inject(DestroyRef);

  readonly summary = input.required<AssistanceImportSummary>();
  readonly withdrawn = output<AssistanceImportSummary>();
  readonly dismissed = output<void>();

  protected readonly copy = ASSISTANCE_IMPORT_COPY.withdraw;
  protected readonly effects = computed(() =>
    this.copy.effects(this.summary().result?.imported ?? 0),
  );
  protected readonly busy = signal(false);
  protected readonly problem = signal<string | null>(null);

  protected withdraw(reason: string): void {
    if (this.busy()) return;
    this.busy.set(true);
    this.problem.set(null);
    this.repository
      .withdraw(this.summary().id, reason)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (answer) => {
          this.busy.set(false);
          this.withdrawn.emit(answer);
        },
        error: (failure: unknown) => {
          this.busy.set(false);
          this.problem.set(
            this.copy.refused(failureReason(failure) ?? ASSISTANCE_IMPORT_COPY.noAnswer),
          );
        },
      });
  }
}
